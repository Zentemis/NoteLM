// ===== NoteLM — Script Lines & Paste Parser
// ============================================

import { VOICE_KEYS } from './config.js';
import {
  speakers, scriptLines, dom,
  generateId, getSpeaker, setStatus, fmtTime,
  setSpeakers, setScriptLines,
} from './state.js';
import { addSpeaker, renderSpeakers } from './speakers.js';
import { drawMiniWaveform } from './waveform.js';

// ===== Selection State =====
let lastSelectedIndex = -1;

export function getSelectedLines() {
  return scriptLines.filter(l => l.selected);
}

export function clearSelection() {
  scriptLines.forEach(l => { l.selected = false; });
  lastSelectedIndex = -1;
}

export function toggleLineSelect(id, shiftKey) {
  const idx = scriptLines.findIndex(l => l.id === id);
  if (idx === -1) return;

  if (shiftKey && lastSelectedIndex !== -1) {
    // Range select: toggle all lines between lastSelectedIndex and idx
    const start = Math.min(lastSelectedIndex, idx);
    const end = Math.max(lastSelectedIndex, idx);
    const targetState = !scriptLines[idx].selected; // match the target's new state
    for (let i = start; i <= end; i++) {
      scriptLines[i].selected = targetState;
    }
  } else {
    scriptLines[idx].selected = !scriptLines[idx].selected;
  }
  lastSelectedIndex = idx;
  renderScriptLines();
  updateSelectionUI();
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

// ===== Render =====
export function renderScriptLines() {
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
      ? `<button class="line-regen" data-regen="${line.id}" title="Regenerate this line">⟳</button>`
      : '';

    // Play button
    const playBtn = hasAudio
      ? `<button class="line-play" data-play-line="${line.id}" title="Play this line">▶</button>`
      : '';

    return `
      <div class="script-line${line._active ? ' active' : ''}${line.selected ? ' selected' : ''}${isEmpty ? ' empty' : ''}" data-id="${line.id}">
        <label class="line-select-col">
          <input type="checkbox" class="line-checkbox" data-select="${line.id}" ${line.selected ? 'checked' : ''} />
          <span class="line-checkbox-visual"></span>
        </label>
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
          <button class="line-remove" data-remove="${line.id}" title="Remove">×</button>
        </div>
      </div>
    `;
  }).join('');

  // Resize textareas
  dom.scriptLines.querySelectorAll('.line-textarea').forEach(ta => {
    const resize = () => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; };
    ta.addEventListener('input', resize);
    resize();
  });

  // Speaker change → mark dirty
  dom.scriptLines.querySelectorAll('.line-speaker-select').forEach(sel => {
    sel.addEventListener('change', e => {
      const line = scriptLines.find(l => l.id === e.target.dataset.lid);
      if (line) {
        line.speakerId = e.target.value;
        markLineDirty(line.id);
      }
      renderScriptLines();
    });
  });

  // Text input → mark dirty
  dom.scriptLines.querySelectorAll('.line-textarea').forEach(ta => {
    ta.addEventListener('input', e => {
      const line = scriptLines.find(l => l.id === e.target.dataset.lid);
      if (line) {
        line.text = e.target.value;
        markLineDirty(line.id);
      }
    });
  });

  // Remove buttons
  dom.scriptLines.querySelectorAll('.line-remove').forEach(btn => {
    btn.addEventListener('click', () => removeScriptLine(btn.dataset.remove));
  });

  // Checkbox selection
  dom.scriptLines.querySelectorAll('.line-checkbox').forEach(cb => {
    cb.addEventListener('click', e => {
      e.stopPropagation();
      toggleLineSelect(cb.dataset.select, e.shiftKey);
    });
  });

  // Play single line
  dom.scriptLines.querySelectorAll('.line-play').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const event = new CustomEvent('playLine', { detail: { id: btn.dataset.playLine } });
      document.dispatchEvent(event);
    });
  });

  // Regenerate single line
  dom.scriptLines.querySelectorAll('.line-regen').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const event = new CustomEvent('regenerateLine', { detail: { id: btn.dataset.regen } });
      document.dispatchEvent(event);
    });
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
