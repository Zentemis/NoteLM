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

// HTML-escape for safe innerHTML interpolation
function escapeHTML(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

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

  const langInfo = LANGUAGES[editorLangFilter] || LANGUAGES['en-us'];

  portal.innerHTML = `
    <div class="editor-arrow"></div>
    <div class="editor-field">
      <span class="editor-label">Name</span>
      <input class="editor-input" type="text" value="${escapeHTML(speaker.name)}" id="editorNameInput">
    </div>
    <div class="editor-field">
      <div class="editor-label-row">
        <span class="editor-label">Voice</span>
        <button class="lang-flag-btn" id="langFlagBtn" title="${langInfo.name}">
          ${langInfo.flag}
        </button>
        <div class="lang-dropdown" id="langDropdown">
          ${Object.entries(LANGUAGES).map(([key, lang]) =>
            `<button class="lang-option${key === editorLangFilter ? ' active' : ''}" data-lang="${key}">
              <span class="lang-option-flag">${lang.flag}</span>
              <span class="lang-option-name">${lang.name}</span>
            </button>`
          ).join('')}
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

  // Flag button — toggle dropdown
  const flagBtn = document.getElementById('langFlagBtn');
  const dropdown = document.getElementById('langDropdown');

  flagBtn.addEventListener('click', e => {
    e.stopPropagation();
    dropdown.classList.toggle('open');
  });

  // Language option handlers
  dropdown.querySelectorAll('.lang-option').forEach(opt => {
    opt.addEventListener('click', e => {
      e.stopPropagation();
      const lang = opt.dataset.lang;
      editorLangFilter = lang;
      dropdown.classList.remove('open');
      // Update flag button
      flagBtn.textContent = LANGUAGES[lang].flag;
      flagBtn.title = LANGUAGES[lang].name;
      // Update active state
      dropdown.querySelectorAll('.lang-option').forEach(o => {
        o.classList.toggle('active', o.dataset.lang === lang);
      });
      renderVoiceSelect(speaker, portal);
    });
  });

  // Close dropdown when clicking outside
  const closeDropdown = e => {
    if (!dropdown.contains(e.target) && e.target !== flagBtn) {
      dropdown.classList.remove('open');
    }
  };
  document.addEventListener('click', closeDropdown);
  // Clean up on next editor render
  portal._cleanupDropdown = () => document.removeEventListener('click', closeDropdown);

  nameInput.focus();
}

export function closeEditor() {
  setOpenEditorId(null);
  editorLangFilter = null;
  const portal = dom.editorPortal;
  if (portal) {
    if (portal._cleanupDropdown) { portal._cleanupDropdown(); portal._cleanupDropdown = null; }
    portal.style.display = 'none';
    portal.innerHTML = '';
  }
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
