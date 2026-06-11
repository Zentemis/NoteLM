// ============================================
// NoteLM — App Orchestrator
// Imports modules, wires events, inits app
// ============================================

import { CONFIG } from './config.js';
import {
  speakers, scriptLines, currentAudioBuffer,
  audioContext, isPlaying, playStartTime, playOffset,
  animFrameId, openEditorId, dom,
  setStatus, fmtTime, setAnimFrameId, setCurrentAudioBuffer,
} from './state.js';
import {
  addSpeaker, renderSpeakers, closeEditor,
} from './speakers.js';
import {
  addScriptLine, renderScriptLines,
  openPasteModal, closePasteModal, parseAndImport,
  loadExample, clearSelection, getSelectedLines,
} from './script.js';
import {
  generate, regenerateLine, regenerateSelected,
  playAudio, pauseAudio, stopPlayback, ensureAudioContext,
  seekTo, downloadWav,
} from './audio.js';
import { drawMainWaveform } from './waveform.js';
import { initScrollPanelHeightManager } from './src/script-panel-height.js';

// ===== Interactive waveform (main player) =====
let waveformSamples = null;

function renderMainWaveform(progress = 0) {
  if (waveformSamples) drawMainWaveform(dom.waveformCanvas, waveformSamples, progress);
}

function tickSeekBar() {
  if (!currentAudioBuffer || !audioContext) return;
  const elapsed = isPlaying
    ? (playOffset + audioContext.currentTime - playStartTime)
    : playOffset;
  const dur = currentAudioBuffer.duration;
  const pct = Math.min((elapsed / dur) * 100, 100);
  dom.timeDisplay.textContent = fmtTime(elapsed);
  renderMainWaveform(pct / 100);
  if (isPlaying) setAnimFrameId(requestAnimationFrame(tickSeekBar));
}

function initWaveformInteraction() {
  const canvas = dom.waveformCanvas;
  let dragging = false;

  const seekFromEvent = e => {
    const rect = canvas.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * 100;
    seekTo(pct);
    renderMainWaveform(pct / 100);
  };

  canvas.addEventListener('mousedown', e => {
    if (!waveformSamples) return;
    dragging = true;
    seekFromEvent(e);
  });
  document.addEventListener('mousemove', e => { if (dragging) seekFromEvent(e); });
  document.addEventListener('mouseup', () => { dragging = false; });
}

// ===== Shared: play merged samples after generation =====
function playMerged(merged) {
  if (!merged) return;
  waveformSamples = merged;
  renderMainWaveform();
  playAudio();
  setAnimFrameId(requestAnimationFrame(tickSeekBar));
}

// ===== Handlers =====
async function handleGenerate() {
  const merged = await generate();
  playMerged(merged);
}

async function handleRegenerateSelected() {
  const selected = getSelectedLines();
  if (!selected.length) return;
  const ids = selected.map(l => l.id);
  clearSelection();
  const merged = await regenerateSelected(ids);
  playMerged(merged);
}

// ===== Event Bindings =====
dom.addSpeakerBtn.onclick = () => addSpeaker();
dom.addLineBtn.onclick = () => addScriptLine();
dom.clearScriptBtn.onclick = () => { scriptLines.length = 0; renderScriptLines(); };
dom.loadExampleBtn.onclick = loadExample;
dom.generateBtn.onclick = handleGenerate;
dom.stopBtn.onclick = stopPlayback;
dom.downloadBtn.onclick = downloadWav;
dom.playPauseBtn.onclick = () => {
  if (isPlaying) { pauseAudio(); }
  else { playAudio(); setAnimFrameId(requestAnimationFrame(tickSeekBar)); }
};

// Selection bar
dom.regenerateSelectedBtn.onclick = handleRegenerateSelected;
dom.clearSelectionBtn.onclick = () => { clearSelection(); renderScriptLines(); };

// Play single line (dispatched from script.js)
document.addEventListener('playLine', e => {
  const line = scriptLines.find(l => l.id === e.detail.id);
  if (!line || !line.audioBuffer) return;

  const ac = ensureAudioContext();
  const buf = ac.createBuffer(1, line.audioBuffer.length, CONFIG.sampleRate);
  buf.getChannelData(0).set(line.audioBuffer);

  stopPlayback();
  setCurrentAudioBuffer(buf);

  waveformSamples = line.audioBuffer;
  renderMainWaveform();
  playAudio();
  setAnimFrameId(requestAnimationFrame(tickSeekBar));
});

// Regenerate single line (dispatched from script.js)
document.addEventListener('regenerateLine', async e => {
  const merged = await regenerateLine(e.detail.id);
  playMerged(merged);
});

// Paste modal
dom.pasteScriptBtn.addEventListener('click', openPasteModal);
dom.pasteCancelBtn.addEventListener('click', closePasteModal);
dom.pasteParseBtn.addEventListener('click', e => { e.stopPropagation(); parseAndImport(); });
dom.pasteOverlay.addEventListener('mousedown', e => {
  if (e.target === dom.pasteOverlay) dom.pasteOverlay.style.display = 'none';
});
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && e.target.id === 'pasteTextarea') {
    e.preventDefault(); parseAndImport();
  }
});

// Close editor on outside click
document.addEventListener('mousedown', e => {
  if (!openEditorId) return;
  const portal = dom.editorPortal;
  if (portal && !portal.contains(e.target) && !e.target.closest('.speaker-chip')) {
    closeEditor(); renderSpeakers();
  }
});

// ===== Init =====
initWaveformInteraction();
initScrollPanelHeightManager();
addSpeaker('Alice', 'af_heart');
addSpeaker('Bob', 'am_puck');
addScriptLine(speakers[0].id, 'Hello! Welcome to NoteLM.');
addScriptLine(speakers[1].id, 'Thanks! This is pretty cool.');
setStatus('Ready');
