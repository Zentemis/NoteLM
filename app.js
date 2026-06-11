// ============================================
// NoteLM — App Orchestrator
// Imports modules, wires events, inits app
// ============================================

import { CONFIG } from './config.js';
import {
  speakers, scriptLines, currentAudioBuffer,
  audioContext, isPlaying, playStartTime, playOffset,
  animFrameId, openEditorId, dom,
  setStatus, fmtTime, setAnimFrameId,
} from './state.js';
import {
  addSpeaker, renderSpeakers, closeEditor,
} from './speakers.js';
import {
  addScriptLine, renderScriptLines,
  openPasteModal, closePasteModal, parseAndImport,
  loadExample,
} from './script.js';
import {
  generate, playAudio, pauseAudio, stopPlayback,
  seekTo, downloadWav,
} from './audio.js';

// ===== Waveform (interactive) =====
let waveformSamples = null;

function drawWaveform(samples, progress = 0) {
  waveformSamples = samples;
  const canvas = dom.waveformCanvas;
  const ctx = canvas.getContext('2d');
  const dpr = devicePixelRatio || 1;
  canvas.width = canvas.clientWidth * dpr;
  canvas.height = canvas.clientHeight * dpr;
  ctx.scale(dpr, dpr);

  const w = canvas.clientWidth, h = canvas.clientHeight;
  const step = Math.ceil(samples.length / w);

  ctx.clearRect(0, 0, w, h);

  for (let i = 0; i < w; i++) {
    let min = 1, max = -1;
    for (let j = 0; j < step; j++) {
      const v = samples[i * step + j];
      if (v !== undefined) { if (v < min) min = v; if (v > max) max = v; }
    }
    const y1 = (1 + min) * h / 2;
    const y2 = (1 + max) * h / 2;
    const height = Math.max(y2 - y1, 1);

    const played = i / w <= progress;
    if (played) {
      const grad = ctx.createLinearGradient(0, y1, 0, y1 + height);
      grad.addColorStop(0, 'rgba(45, 212, 191, 0.7)');
      grad.addColorStop(0.5, 'rgba(45, 212, 191, 1.0)');
      grad.addColorStop(1, 'rgba(45, 212, 191, 0.7)');
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = 'rgba(45, 212, 191, 0.25)';
    }
    ctx.fillRect(i, y1, 1, height);
  }

  // Playhead
  if (progress > 0) {
    const x = Math.round(progress * w);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillRect(x - 1, 0, 2, h);
  }
}

function getWaveformProgress() {
  if (!currentAudioBuffer || !audioContext) return 0;
  const elapsed = isPlaying
    ? (playOffset + audioContext.currentTime - playStartTime)
    : playOffset;
  return Math.min(elapsed / currentAudioBuffer.duration, 1);
}

function tickSeekBar() {
  if (!currentAudioBuffer || !audioContext) return;
  const elapsed = isPlaying
    ? (playOffset + audioContext.currentTime - playStartTime)
    : playOffset;
  const dur = currentAudioBuffer.duration;
  const pct = Math.min((elapsed / dur) * 100, 100);
  dom.timeDisplay.textContent = fmtTime(elapsed);
  if (waveformSamples) drawWaveform(waveformSamples, pct / 100);
  if (isPlaying) setAnimFrameId(requestAnimationFrame(tickSeekBar));
}

// ===== Waveform click-to-seek =====
function initWaveformInteraction() {
  const canvas = dom.waveformCanvas;
  let dragging = false;

  const seekFromEvent = e => {
    const rect = canvas.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * 100;
    seekTo(pct);
    if (waveformSamples) drawWaveform(waveformSamples, pct / 100);
  };

  canvas.addEventListener('mousedown', e => {
    if (!waveformSamples) return;
    dragging = true;
    seekFromEvent(e);
  });

  document.addEventListener('mousemove', e => {
    if (dragging) seekFromEvent(e);
  });

  document.addEventListener('mouseup', () => { dragging = false; });
}

// ===== Generate handler (UI + audio) =====
async function handleGenerate() {
  const merged = await generate();
  if (merged) {
    drawWaveform(merged);
    playAudio();
    // Start the seek bar ticker
    setAnimFrameId(requestAnimationFrame(tickSeekBar));
  }
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
  if (isPlaying) {
    pauseAudio();
  } else {
    playAudio();
    setAnimFrameId(requestAnimationFrame(tickSeekBar));
  }
};

// Paste modal
dom.pasteScriptBtn.addEventListener('click', openPasteModal);
dom.pasteCancelBtn.addEventListener('click', closePasteModal);
dom.pasteParseBtn.addEventListener('click', e => { e.stopPropagation(); parseAndImport(); });
dom.pasteOverlay.addEventListener('mousedown', e => {
  if (e.target === dom.pasteOverlay) dom.pasteOverlay.style.display = 'none';
});
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && e.target.id === 'pasteTextarea') {
    e.preventDefault();
    parseAndImport();
  }
});

// Close editor on outside click
document.addEventListener('mousedown', e => {
  if (!openEditorId) return;
  const portal = dom.editorPortal;
  if (portal && !portal.contains(e.target) && !e.target.closest('.speaker-chip')) {
    closeEditor();
    renderSpeakers();
  }
});

// ===== Init =====
initWaveformInteraction();
addSpeaker('Alice', 'af_heart');
addSpeaker('Bob', 'am_puck');
addScriptLine(speakers[0].id, 'Hello! Welcome to NoteLM.');
addScriptLine(speakers[1].id, 'Thanks! This is pretty cool.');
setStatus('Ready');
