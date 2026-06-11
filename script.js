// ============================================
// NoteLM — Script Lines & Paste Parser
// ============================================

import { VOICE_KEYS } from './config.js';
import {
  speakers, scriptLines, dom,
  generateId, getSpeaker, setStatus,
  setSpeakers, setScriptLines,
} from './state.js';
import { addSpeaker, renderSpeakers } from './speakers.js';

export function addScriptLine(speakerId, text) {
  scriptLines.push({
    id: generateId('l'),
    speakerId: speakerId || (speakers[0]?.id || ''),
    text: text || '',
  });
  renderScriptLines();
}

export function removeScriptLine(id) {
  setScriptLines(scriptLines.filter(l => l.id !== id));
  renderScriptLines();
}

export function updateLineSpeakerOptions() {
  dom.scriptLines.querySelectorAll('.line-speaker-select').forEach(sel => {
    const val = sel.value;
    sel.innerHTML = speakers.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    if (speakers.find(s => s.id === val)) sel.value = val;
  });
}

export function renderScriptLines() {
  dom.scriptLines.innerHTML = scriptLines.map((line, i) => {
    const spk = getSpeaker(line.speakerId);
    const color = spk?.color || '#475569';
    return `
      <div class="script-line${line._active ? ' active' : ''}" data-id="${line.id}">
        <div class="line-accent" style="background:${color}"></div>
        <span class="line-number">${i + 1}</span>
        <select class="line-speaker-select" data-lid="${line.id}">
          ${speakers.map(s => `<option value="${s.id}"${s.id === line.speakerId ? ' selected' : ''}>${s.name}</option>`).join('')}
        </select>
        <textarea class="line-textarea" data-lid="${line.id}" rows="1" placeholder="Enter dialogue…">${line.text}</textarea>
        <button class="line-remove" data-remove="${line.id}" title="Remove">×</button>
      </div>
    `;
  }).join('');

  dom.scriptLines.querySelectorAll('.line-textarea').forEach(ta => {
    const resize = () => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; };
    ta.addEventListener('input', resize);
    resize();
  });

  dom.scriptLines.querySelectorAll('.line-speaker-select').forEach(sel => {
    sel.addEventListener('change', e => {
      const line = scriptLines.find(l => l.id === e.target.dataset.lid);
      if (line) line.speakerId = e.target.value;
      renderScriptLines();
    });
  });

  dom.scriptLines.querySelectorAll('.line-textarea').forEach(ta => {
    ta.addEventListener('input', e => {
      const line = scriptLines.find(l => l.id === e.target.dataset.lid);
      if (line) line.text = e.target.value;
    });
  });

  dom.scriptLines.querySelectorAll('.line-remove').forEach(btn => {
    btn.addEventListener('click', () => removeScriptLine(btn.dataset.remove));
  });
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

  setScriptLines(parsed.map((p, i) => ({
    id: generateId('p'),
    speakerId: nameMap[p.name],
    text: p.text,
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
    { id: generateId('e'), speakerId: speakers[0].id, text: "Hey Bob, have you heard about this new text-to-speech technology?" },
    { id: generateId('e'), speakerId: speakers[1].id, text: "Oh yeah! It runs entirely in the browser. No server needed at all." },
    { id: generateId('e'), speakerId: speakers[0].id, text: "That's incredible. And each speaker can have a completely different voice?" },
    { id: generateId('e'), speakerId: speakers[1].id, text: "Absolutely. You can pick from dozens of voices. It's all powered by Kokoro." },
    { id: generateId('e'), speakerId: speakers[0].id, text: "This is going to change how we create audio content." },
    { id: generateId('e'), speakerId: speakers[1].id, text: "Couldn't agree more. Give it a try!" },
  ]);
  renderScriptLines();
}