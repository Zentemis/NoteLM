// ============================================
// NoteLM — Speaker Management
// ============================================

import { VOICE_KEYS, CONFIG } from './config.js';
import {
  speakers, openEditorId, dom,
  generateId, voiceLabel, getSpeaker,
  setOpenEditorId, setSpeakers,
} from './state.js';

// Lazy import to break circular dep with script.js
const getScriptModule = () => import('./script.js');

export function addSpeaker(name, voiceId) {
  const id = generateId('s');
  speakers.push({
    id,
    name: name || `Speaker ${speakers.length + 1}`,
    voice: voiceId || VOICE_KEYS[speakers.length % VOICE_KEYS.length],
    color: CONFIG.colors[speakers.length % CONFIG.colors.length],
  });
  renderSpeakers();
  return id;
}

export function removeSpeaker(id) {
  setSpeakers(speakers.filter(s => s.id !== id));
  if (openEditorId === id) setOpenEditorId(null);
  renderSpeakers();
}

export function toggleEditor(id) {
  setOpenEditorId(openEditorId === id ? null : id);
  renderSpeakers();
}

function positionEditor(chipEl) {
  const rect = chipEl.getBoundingClientRect();
  const editor = dom.editorPortal;
  if (!editor) return;
  Object.assign(editor.style, {
    display: 'block',
    position: 'fixed',
    top: (rect.bottom + 6) + 'px',
    left: (rect.left + rect.width / 2) + 'px',
    transform: 'translateX(-50%)',
    zIndex: '10000',
  });
}

function renderSpeakerEditor(speaker) {
  const portal = dom.editorPortal;
  if (!portal) return;
  portal.innerHTML = `
    <div class="editor-arrow"></div>
    <div class="editor-field">
      <span class="editor-label">Name</span>
      <input class="editor-input" type="text" value="${speaker.name}" id="editorNameInput">
    </div>
    <div class="editor-field">
      <span class="editor-label">Voice</span>
      <select class="editor-select" id="editorVoiceSelect">
        ${VOICE_KEYS.map(v => {
          const vo = CONFIG.voices[v];
          return `<option value="${v}" ${v === speaker.voice ? 'selected' : ''}>${vo.name} (${vo.gender})</option>`;
        }).join('')}
      </select>
    </div>
  `;

  const nameInput = document.getElementById('editorNameInput');
  const voiceSelect = document.getElementById('editorVoiceSelect');
  nameInput.oninput = () => {
    speaker.name = nameInput.value;
    const chipName = document.querySelector(`[data-chip-id="${speaker.id}"] .chip-name`);
    if (chipName) chipName.textContent = nameInput.value;
  };
  nameInput.onchange = () => renderSpeakers();
  voiceSelect.onchange = () => { speaker.voice = voiceSelect.value; renderSpeakers(); };
  nameInput.focus();
}

export function closeEditor() {
  setOpenEditorId(null);
  const portal = dom.editorPortal;
  if (portal) { portal.style.display = 'none'; portal.innerHTML = ''; }
}

export async function renderSpeakers() {
  dom.speakersList.innerHTML = speakers.map(s => `
    <div class="speaker-chip${openEditorId === s.id ? ' active' : ''}" data-chip-id="${s.id}">
      <span class="chip-dot" style="background:${s.color}"></span>
      <span class="chip-name">${s.name}</span>
      <span class="chip-voice">${voiceLabel(s.voice)}</span>
      <button class="chip-remove" data-remove="${s.id}" title="Remove">×</button>
    </div>
  `).join('');

  dom.speakersList.querySelectorAll('.speaker-chip').forEach(chip => {
    chip.addEventListener('click', e => {
      if (e.target.closest('.chip-remove')) return;
      const id = chip.dataset.chipId;
      if (openEditorId === id) {
        closeEditor();
      } else {
        setOpenEditorId(id);
        renderSpeakers();
        const spk = getSpeaker(id);
        const chipEl = document.querySelector(`[data-chip-id="${id}"]`);
        if (spk && chipEl) { positionEditor(chipEl); renderSpeakerEditor(spk); }
      }
    });
  });

  dom.speakersList.querySelectorAll('.chip-remove').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); closeEditor(); removeSpeaker(btn.dataset.remove); });
  });

  if (openEditorId) {
    const chipEl = document.querySelector(`[data-chip-id="${openEditorId}"]`);
    if (chipEl) positionEditor(chipEl);
  }

  // Update speaker dropdowns in script lines (lazy import to break cycle)
  const { updateLineSpeakerOptions } = await getScriptModule();
  updateLineSpeakerOptions();
}