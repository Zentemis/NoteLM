// ============================================
// NoteLM — Speaker Management
// ============================================

import { VOICE_KEYS, CONFIG, LANGUAGES } from './config.js';
import {
  speakers, openEditorId, dom,
  generateId, voiceLabel, getSpeaker,
  setOpenEditorId, setSpeakers,
} from './state.js';

// Lazy import to break circular dep with script.js
const getScriptModule = () => import('./script.js');

// Track which language filter is active in the editor
let editorLangFilter = null;

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

function getFilteredVoiceKeys(lang) {
  if (!lang) return VOICE_KEYS;
  return VOICE_KEYS.filter(k => CONFIG.voices[k].lang === lang);
}

function renderVoiceSelect(speaker, container) {
  const filtered = getFilteredVoiceKeys(editorLangFilter);
  const voiceSelect = container.querySelector('#editorVoiceSelect');
  if (!voiceSelect) return;
  voiceSelect.innerHTML = filtered.map(v => {
    const vo = CONFIG.voices[v];
    return `<option value="${v}" ${v === speaker.voice ? 'selected' : ''}>${vo.name} (${vo.gender})</option>`;
  }).join('');

  // If current speaker voice isn't in filtered list, select the first available
  if (!filtered.includes(speaker.voice) && filtered.length > 0) {
    speaker.voice = filtered[0];
    voiceSelect.value = filtered[0];
  }

  voiceSelect.onchange = () => { speaker.voice = voiceSelect.value; renderSpeakers(); };
}

function renderSpeakerEditor(speaker) {
  const portal = dom.editorPortal;
  if (!portal) return;

  // Default filter to the speaker's current voice language
  const currentLang = CONFIG.voices[speaker.voice]?.lang || null;
  if (editorLangFilter === null) editorLangFilter = currentLang;

  // Get unique languages that have voices
  const availableLangs = [...new Set(VOICE_KEYS.map(k => CONFIG.voices[k].lang))];

  portal.innerHTML = `
    <div class="editor-arrow"></div>
    <div class="editor-field">
      <span class="editor-label">Name</span>
      <input class="editor-input" type="text" value="${speaker.name}" id="editorNameInput">
    </div>
    <div class="editor-field">
      <div class="editor-label-row">
        <span class="editor-label">Voice</span>
        <div class="lang-filter" id="langFilter">
          ${availableLangs.map(lang => {
            const info = LANGUAGES[lang] || { code: lang.toUpperCase() };
            const isActive = editorLangFilter === lang;
            return `<button class="lang-pill${isActive ? ' active' : ''}" data-lang="${lang}">${info.code}</button>`;
          }).join('')}
        </div>
      </div>
      <select class="editor-select" id="editorVoiceSelect"></select>
    </div>
  `;

  // Render filtered voice options
  renderVoiceSelect(speaker, portal);

  // Name input handlers
  const nameInput = document.getElementById('editorNameInput');
  nameInput.oninput = () => {
    speaker.name = nameInput.value;
    const chipName = document.querySelector(`[data-chip-id="${speaker.id}"] .chip-name`);
    if (chipName) chipName.textContent = nameInput.value;
  };
  nameInput.onchange = () => renderSpeakers();

  // Language filter pill handlers
  portal.querySelectorAll('.lang-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const lang = pill.dataset.lang;
      editorLangFilter = editorLangFilter === lang ? null : lang;
      // Update pill active states
      portal.querySelectorAll('.lang-pill').forEach(p => {
        p.classList.toggle('active', editorLangFilter === p.dataset.lang);
      });
      renderVoiceSelect(speaker, portal);
    });
  });

  nameInput.focus();
}

export function closeEditor() {
  setOpenEditorId(null);
  editorLangFilter = null;
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
