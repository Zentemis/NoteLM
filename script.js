// ===== NoteLM — Script Lines & Paste Parser
// ============================================

import { VOICE_KEYS } from './config.js';
import {
  speakers, scriptLines, dom,
  generateId, getSpeaker, setStatus, fmtTime,
  setSpeakers, setScriptLines,
} from './state.js';
import { addSpeaker, renderSpeakers } from './speakers.js';
import { ICON } from './icons.js';
import { drawMiniWaveform } from './waveform.js';
import { onScriptLinesRendered } from './script-panel-height.js';

// ===== Selection State =====
let isDragging = false;
let dragAnchorIdx = -1;

export function getSelectedLines() {
  return scriptLines.filter(l => l.selected);
}

export function clearSelection() {
  scriptLines.forEach(l => { l.selected = false; });
  dragAnchorIdx = -1;
  renderScriptLines();
  updateSelectionUI();
}

function getLineIdxFromPoint(y) {
  const gutters = dom.scriptLines.querySelectorAll('.line-select-gutter');
  for (let i = 0; i < gutters.length; i++) {
    const rect = gutters[i].getBoundingClientRect();
    if (y >= rect.top && y <= rect.bottom) return i;
  }
  return -1;
}

function selectRangeExclusive(fromIdx, toIdx) {
  const start = Math.min(fromIdx, toIdx);
  const end = Math.max(fromIdx, toIdx);
  scriptLines.forEach(l => { l.selected = false; });
  for (let i = start; i <= end; i++) {
    if (scriptLines[i]) scriptLines[i].selected = true;
  }
  updateSelectionUI();
  updateGutterVisuals();
}

function updateGutterVisuals() {
  dom.scriptLines.querySelectorAll('.line-select-gutter').forEach((g, i) => {
    const line = scriptLines[i];
    g.classList.toggle('selected', line?.selected ?? false);
    const dot = g.querySelector('.gutter-dot');
    if (dot) dot.classList.toggle('selected', line?.selected ?? false);
  });
}

function handleGutterMouseDown(e) {
  e.preventDefault();
  const idx = parseInt(this.dataset.gutterIdx, 10);
  if (isNaN(idx)) return;

  isDragging = true;
  dragAnchorIdx = idx;

  // Toggle this line on click
  scriptLines[idx].selected = !scriptLines[idx].selected;
  updateSelectionUI();
  updateGutterVisuals();

  document.addEventListener('mousemove', handleGutterDragMove);
  document.addEventListener('mouseup', handleGutterDragEnd);
}

function handleGutterDragMove(e) {
  if (!isDragging || dragAnchorIdx === -1) return;
  const idx = getLineIdxFromPoint(e.clientY);
  if (idx === -1 || idx === dragAnchorIdx) return;

  // Dragging: select range from anchor to current (exclusive of toggle)
  selectRangeExclusive(dragAnchorIdx, idx);
}

function handleGutterDragEnd() {
  isDragging = false;
  document.removeEventListener('mousemove', handleGutterDragMove);
  document.removeEventListener('mouseup', handleGutterDragEnd);
}

function updateSelectionUI() {
  const count = scriptLines.filter(l => l.selected).length;
  const bar = dom.selectionBar;
  if (!bar) return;
  bar.style.display = count > 0 ? 'flex' : 'none';
  const label = bar.querySelector('.selection-count');
  if (label) label.textContent = `${count} selected`;
}

export function markLineDirty(id) {
  const line = scriptLines.find(l => l.id === id);
  if (line) {
    line.dirty = true;
    line.audioBuffer = null;
    line.duration = 0;
  }
}

// ===== Script Line Factory =====
export function createLineData(speakerId, text) {
  return {
    id: generateId('l'),
    speakerId: speakerId || (speakers[0]?.id || ''),
    text: text || '',
    dirty: true,
    selected: false,
    audioBuffer: null,
    duration: 0,
  };
}

// ===== Script Line CRUD =====
export function addScriptLine(speakerId, text) {
  scriptLines.push(createLineData(speakerId, text));
  renderScriptLines();
}

export function removeScriptLine(id) {
  setScriptLines(scriptLines.filter(l => l.id !== id));
  renderScriptLines();
  updateSelectionUI();
}

export function updateLineSpeakerOptions() {
  dom.scriptLines.querySelectorAll('.line-speaker-select').forEach(sel => {
    const val = sel.value;
    sel.innerHTML = speakers.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    if (speakers.find(s => s.id === val)) sel.value = val;
  });
}

// ===== Event Delegation (set up once) =====
let delegationBound = false;

function bindScriptLineEvents() {
  if (delegationBound || !dom.scriptLines) return;
  delegationBound = true;

  // Single click handler — covers remove, play, regenerate
  dom.scriptLines.addEventListener('click', e => {
    const removeBtn = e.target.closest('.line-remove');
    if (removeBtn) { removeScriptLine(removeBtn.dataset.remove); return; }

    const playBtn = e.target.closest('.line-play');
    if (playBtn) { e.stopPropagation(); document.dispatchEvent(new CustomEvent('playLine', { detail: { id: playBtn.dataset.playLine } })); return; }

    const regenBtn = e.target.closest('.line-regen');
    if (regenBtn) { e.stopPropagation(); document.dispatchEvent(new CustomEvent('regenerateLine', { detail: { id: regenBtn.dataset.regen } })); return; }
  });

  // Speaker select changes
  dom.scriptLines.addEventListener('change', e => {
    const sel = e.target.closest('.line-speaker-select');
    if (!sel) return;
    const line = scriptLines.find(l => l.id === sel.dataset.lid);
    if (line) { line.speakerId = sel.value; markLineDirty(line.id); }
    renderScriptLines();
  });

  // Gutter drag-to-select (mousedown bubbles, mousemove/mouseup are on document)
  dom.scriptLines.addEventListener('mousedown', e => {
    const gutter = e.target.closest('.line-select-gutter');
    if (!gutter) return;
    handleGutterMouseDown.call(gutter, e);
  });
}

// ===== Render =====
export function renderScriptLines() {
  if (!dom.scriptLines) return;
  bindScriptLineEvents();
  dom.scriptLines.innerHTML = scriptLines.map((line, i) => {
    const spk = getSpeaker(line.speakerId);
    const color = spk?.color || '#475569';
    const hasAudio = !!line.audioBuffer;
    const isDirty = line.dirty && hasAudio;
    const isEmpty = !hasAudio;

    // Status indicator
    let statusDot = '';
    if (isDirty) {
      statusDot = '<span class="line-status-dot dirty" title="Modified — needs regeneration"></span>';
    } else if (hasAudio) {
      statusDot = '<span class="line-status-dot generated" title="Generated"></span>';
    } else {
      statusDot = '<span class="line-status-dot empty" title="Not generated"></span>';
    }

    // Mini waveform or placeholder
    const waveformHtml = hasAudio
      ? `<canvas class="line-mini-waveform" data-waveform-id="${line.id}" width="120" height="24"></canvas>`
      : '<div class="line-mini-waveform-placeholder"></div>';

    // Duration label
    const durationHtml = hasAudio
      ? `<span class="line-duration">${fmtTime(line.duration)}</span>`
      : '';

    // Regenerate button
    const regenBtn = hasAudio
      ? `<button class="line-regen" data-regen="${line.id}" title="Regenerate this line">${ICON.refreshCw}</button>`
      : '';

    // Play button
    const playBtn = hasAudio
      ? `<button class="line-play" data-play-line="${line.id}" title="Play this line">${ICON.play}</button>`
      : '';

    return `
      <div class="script-line${line._active ? ' active' : ''}${line.selected ? ' selected' : ''}${isEmpty ? ' empty' : ''}" data-id="${line.id}" data-idx="${i}">
        <div class="line-accent" style="background:${color}"></div>
        <span class="line-number">${statusDot}${i + 1}</span>
        <select class="line-speaker-select" data-lid="${line.id}">
          ${speakers.map(s => `<option value="${s.id}"${s.id === line.speakerId ? ' selected' : ''}>${s.name}</option>`).join('')}
        </select>
        <textarea class="line-textarea" data-lid="${line.id}" rows="1" placeholder="Enter dialogue…">${line.text}</textarea>
        <div class="line-actions">
          ${waveformHtml}
          ${durationHtml}
          ${playBtn}
          ${regenBtn}
          <button class="line-remove" data-remove="${line.id}" title="Remove">${ICON.close}</button>
        </div>
        <div class="line-select-gutter${line.selected ? ' selected' : ''}" data-gutter-idx="${i}"><div class="gutter-dot${line.selected ? ' selected' : ''}"></div></div>
      </div>
    `;
  }).join('');

  // Auto-resize textareas + mark dirty on text input (input events don't bubble)
  dom.scriptLines.querySelectorAll('.line-textarea').forEach(ta => {
    const resize = () => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; };
    ta.addEventListener('input', () => {
      resize();
      const line = scriptLines.find(l => l.id === ta.dataset.lid);
      if (line) { line.text = ta.value; markLineDirty(line.id); }
    });
    resize();
  });

  // Draw mini waveforms
  requestAnimationFrame(() => {
    dom.scriptLines.querySelectorAll('.line-mini-waveform').forEach(canvas => {
      const id = canvas.dataset.waveformId;
      const line = scriptLines.find(l => l.id === id);
      if (line && line.audioBuffer) drawMiniWaveform(canvas, line.audioBuffer);
    });
  });

  updateSelectionUI();
  onScriptLinesRendered();
}

// ===== Paste Parser =====
export function openPasteModal(e) {
  if (e) e.stopPropagation();
  dom.pasteOverlay.style.display = 'flex';
  const ta = dom.pasteTextarea;
  if (ta) { ta.value = ''; setTimeout(() => ta.focus(), 50); }
}

export function closePasteModal(e) {
  if (e) e.stopPropagation();
  dom.pasteOverlay.style.display = 'none';
}

export function parseAndImport() {
  const raw = dom.pasteTextarea.value.trim();
  if (!raw) { setStatus('Paste some text first!', 'error'); return; }

  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
  const parsed = [];
  const nameSet = new Set();

  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0 && colonIdx < line.length - 1) {
      const name = line.substring(0, colonIdx).trim();
      const text = line.substring(colonIdx + 1).trim();
      if (name && text) { parsed.push({ name, text }); nameSet.add(name); }
    }
  }

  if (!parsed.length) {
    setStatus('No "Speaker: text" lines found. Use: Alice: Hello!', 'error');
    return;
  }

  dom.pasteOverlay.style.display = 'none';

  const nameMap = {};
  let vi = 0;
  for (const name of nameSet) {
    const existing = speakers.find(s => s.name.toLowerCase() === name.toLowerCase());
    nameMap[name] = existing ? existing.id : addSpeaker(name, VOICE_KEYS[vi++ % VOICE_KEYS.length]);
  }

  setScriptLines(parsed.map(p => ({
    ...createLineData(nameMap[p.name], p.text),
    id: generateId('p'),
  })));

  renderScriptLines();
  setStatus(`Imported ${parsed.length} lines · ${nameSet.size} speaker(s)`);
}

// ===== Example =====
export function loadExample() {
  if (speakers.length < 2) {
    setSpeakers([]);
    addSpeaker('Alice', 'af_heart');
    addSpeaker('Bob', 'am_puck');
  }
  setScriptLines([
    { ...createLineData(speakers[0].id, "Hey Bob, have you heard about this new text-to-speech technology?"), id: generateId('e') },
    { ...createLineData(speakers[1].id, "Oh yeah! It runs entirely in the browser. No server needed at all."), id: generateId('e') },
    { ...createLineData(speakers[0].id, "That's incredible. And each speaker can have a completely different voice?"), id: generateId('e') },
    { ...createLineData(speakers[1].id, "Absolutely. You can pick from dozens of voices. It's all powered by Kokoro."), id: generateId('e') },
    { ...createLineData(speakers[0].id, "This is going to change how we create audio content."), id: generateId('e') },
    { ...createLineData(speakers[1].id, "Couldn't agree more. Give it a try!"), id: generateId('e') },
  ]);
  renderScriptLines();
}
