// ============================================
// NoteLM — Audio Engine
// Model loading, TTS generation, playback,
// waveform visualization, WAV export
// ============================================

import { CONFIG } from './config.js';
import { ICON } from './icons.js';
import {
  speakers, scriptLines,
  audioContext, currentAudioBuffer, currentSource,
  isPlaying, playStartTime, playOffset, animFrameId,
  isGenerating, kokoroModel, detectedDevice, dom,
  getSpeaker, setStatus, fmtTime,
  setAudioContext, setCurrentAudioBuffer, setCurrentSource,
  setIsPlaying, setPlayStartTime, setPlayOffset,
  setAnimFrameId, setIsGenerating, setKokoroModel,
  setDetectedDevice,
} from './state.js';
import { renderScriptLines, markLineDirty } from './script.js';

// ===== Backend Detection =====
export async function detectBackend() {
  if (navigator.gpu) {
    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (adapter) return 'webgpu';
    } catch (e) {
      console.warn('[NoteLM] WebGPU probe failed:', e.message);
    }
  }
  return 'wasm';
}

export function showBackendNotice(device) {
  setDetectedDevice(device);
  const notice = dom.backendNotice;
  const text = dom.backendNoticeText;
  if (!notice || !text) return;
  notice.style.display = 'flex';
  if (device === 'webgpu') {
    notice.className = 'backend-notice webgpu';
    text.textContent = 'WebGPU active — fastest generation';
  } else {
    notice.className = 'backend-notice';
    text.textContent = 'Using WASM (CPU) — enable WebGPU in Chrome flags for faster generation';
  }
}

// ===== Model Loading =====
function updateLoadProgress(pct, msg) {
  dom.modelProgressBar.style.width = pct + '%';
  dom.modelProgressPercent.textContent = pct + '%';
  if (msg) dom.loadingText.textContent = msg;
}

export async function loadModel() {
  if (kokoroModel) return kokoroModel;
  dom.loadingOverlay.style.display = 'flex';
  setStatus('Loading Kokoro…', 'loading');
  updateLoadProgress(5, 'Probing hardware…');

  try {
    const device = await detectBackend();
    showBackendNotice(device);

    updateLoadProgress(10, device === 'webgpu'
      ? '✓ WebGPU found — using GPU acceleration'
      : '✗ WebGPU not available — using WASM fallback');
    await new Promise(r => setTimeout(r, 500));

    updateLoadProgress(12, 'Loading Kokoro library…');
    const { KokoroTTS } = await import('https://cdn.jsdelivr.net/npm/kokoro-js@latest');

    updateLoadProgress(15, `Downloading Kokoro model (~82 MB) — ${device === 'webgpu' ? 'fp32' : 'q8'}…`);

    const model = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
      dtype: device === 'webgpu' ? 'fp32' : 'q8',
      device,
      progress_callback: p => {
        if (p.status === 'progress' && p.total) {
          const pct = Math.round((p.progress / p.total) * 100);
          const mb = Math.round(p.total / (1024 * 1024));
          const dl = Math.round(p.progress / (1024 * 1024));
          updateLoadProgress(15 + Math.round(pct * 0.83), `Downloading: ${dl} / ${mb} MB (${pct}%)`);
        } else if (p.status === 'done') {
          updateLoadProgress(98, 'Initializing model…');
        }
      }
    });

    setKokoroModel(model);
    updateLoadProgress(100, 'Ready!');
    await new Promise(r => setTimeout(r, 300));
    dom.loadingOverlay.style.display = 'none';
    setStatus('Kokoro loaded');
    return model;
  } catch (err) {
    dom.loadingOverlay.style.display = 'none';
    setStatus('Load failed: ' + err.message, 'error');
    throw err;
  }
}

// ===== AudioContext Helper =====
export function ensureAudioContext() {
  if (!audioContext) setAudioContext(new (window.AudioContext || window.webkitAudioContext)());
  if (audioContext.state === 'suspended') audioContext.resume();
  return audioContext;
}

// ===== Generate Single Line (stores buffer on line object) =====
async function generateLineAudio(model, line, index, total) {
  const spk = getSpeaker(line.speakerId);
  const pct = Math.round((index / total) * 100);

  dom.progressBar.style.width = pct + '%';
  dom.progressText.textContent = `Line ${index + 1}/${total} — ${spk?.name || '?'}`;

  scriptLines.forEach(l => l._active = l.id === line.id);
  renderScriptLines();

  const audio = await model.generate(line.text, { voice: spk?.voice || 'af_heart' });
  const samples = audio.audio;

  // Store per-line data (single source of truth — audioBuffer holds the Float32Array)
  line.audioBuffer = samples;
  line.duration = samples.length / CONFIG.sampleRate;
  line.dirty = false;

  return samples;
}

// ===== Merge All Line Buffers =====
function mergeLineBuffers() {
  const ac = ensureAudioContext();
  const chunks = [];
  const valid = scriptLines.filter(l => l.text.trim() && l.audioBuffer);

  for (let i = 0; i < valid.length; i++) {
    chunks.push(valid[i].audioBuffer);
    if (i < valid.length - 1) {
      chunks.push(new Float32Array(Math.floor(CONFIG.sampleRate * CONFIG.lineGap)));
    }
  }

  if (!chunks.length) return null;

  const total = chunks.reduce((s, c) => s + c.length, 0);
  const merged = new Float32Array(total);
  let off = 0;
  for (const c of chunks) { merged.set(c, off); off += c.length; }

  const buf = ac.createBuffer(1, merged.length, CONFIG.sampleRate);
  buf.getChannelData(0).set(merged);
  setCurrentAudioBuffer(buf);
  return merged;
}

// ===== Full Generate (skip clean lines) =====
export async function generate() {
  if (isGenerating) return;

  const valid = scriptLines.filter(l => l.text.trim());
  if (!valid.length) { setStatus('Add some script lines first!', 'error'); return; }
  if (!speakers.length) { setStatus('Add at least one speaker!', 'error'); return; }

  // Determine which lines need generation
  const dirty = valid.filter(l => l.dirty || !l.audioBuffer);
  if (!dirty.length) {
    // All clean — just merge and play
    const merged = mergeLineBuffers();
    if (merged) {
      setStatus(`All ${valid.length} lines already generated — playing`);
      dom.audioPlayer.style.display = 'flex';
      dom.downloadBtn.disabled = false;
    }
    return merged;
  }

  setIsGenerating(true);
  dom.generateBtn.disabled = true;
  dom.downloadBtn.disabled = true;
  dom.stopBtn.disabled = false;
  dom.progressSection.style.display = 'flex';
  dom.audioPlayer.style.display = 'none';
  setStatus(`Generating ${dirty.length} of ${valid.length} lines…`, 'loading');

  try {
    const model = await loadModel();

    for (let i = 0; i < dirty.length; i++) {
      await generateLineAudio(model, dirty[i], i, dirty.length);
    }

    scriptLines.forEach(l => l._active = false);
    renderScriptLines();

    // Merge all line buffers (clean + newly generated)
    const merged = mergeLineBuffers();

    dom.progressBar.style.width = '100%';
    dom.progressText.textContent = 'Done!';
    dom.audioPlayer.style.display = 'flex';
    dom.downloadBtn.disabled = false;
    setStatus(`Generated ${dirty.length} lines · ${valid.length} total`);

    return merged;
  } catch (err) {
    setStatus('Error: ' + err.message, 'error');
    dom.progressText.textContent = 'Error';
    return null;
  } finally {
    setIsGenerating(false);
    dom.generateBtn.disabled = false;
    dom.stopBtn.disabled = true;
  }
}

// ===== Shared generation runner =====
async function runGeneration(lines, label) {
  if (isGenerating || !lines.length) return null;

  setIsGenerating(true);
  dom.generateBtn.disabled = true;
  dom.stopBtn.disabled = false;
  dom.progressSection.style.display = 'flex';
  setStatus(`${label} ${lines.length} line${lines.length > 1 ? 's' : ''}…`, 'loading');

  try {
    const model = await loadModel();
    for (let i = 0; i < lines.length; i++) {
      await generateLineAudio(model, lines[i], i, lines.length);
    }
    scriptLines.forEach(l => l._active = false);
    renderScriptLines();

    const merged = mergeLineBuffers();
    if (merged) {
      dom.audioPlayer.style.display = 'flex';
      dom.downloadBtn.disabled = false;
    }
    dom.progressBar.style.width = '100%';
    dom.progressText.textContent = 'Done!';
    setStatus(`${label} ${lines.length} line${lines.length > 1 ? 's' : ''} — done`);
    return merged;
  } catch (err) {
    setStatus('Error: ' + err.message, 'error');
    return null;
  } finally {
    setIsGenerating(false);
    dom.generateBtn.disabled = false;
    dom.stopBtn.disabled = true;
  }
}

// ===== Regenerate Single Line =====
export function regenerateLine(id) {
  const line = scriptLines.find(l => l.id === id);
  if (!line || !line.text.trim()) return Promise.resolve(null);
  return runGeneration([line], 'Regenerated');
}

// ===== Regenerate Selected Lines =====
export function regenerateSelected(selectedIds) {
  const toRegen = scriptLines.filter(l => selectedIds.includes(l.id) && l.text.trim());
  return runGeneration(toRegen, 'Regenerated');
}

// ===== Playback =====
function createBufferSource() {
  const source = audioContext.createBufferSource();
  source.buffer = currentAudioBuffer;
  source.connect(audioContext.destination);
  source.onended = () => {
    setIsPlaying(false);
    dom.playPauseBtn.innerHTML = ICON.play;
    cancelAnimationFrame(animFrameId);
  };
  setCurrentSource(source);
  return source;
}

export function playAudio() {
  if (!currentAudioBuffer) return;
  ensureAudioContext();
  stopPlayback();

  const source = createBufferSource();
  setPlayStartTime(audioContext.currentTime);
  setPlayOffset(0);
  source.start(0);
  setIsPlaying(true);
  dom.playPauseBtn.innerHTML = ICON.pause;
}

export function pauseAudio() {
  if (!isPlaying || !currentSource) return;
  setPlayOffset(playOffset + audioContext.currentTime - playStartTime);
  currentSource.stop();
  setCurrentSource(null);
  setIsPlaying(false);
  dom.playPauseBtn.innerHTML = ICON.play;
  cancelAnimationFrame(animFrameId);
}

export function stopPlayback() {
  if (currentSource) try { currentSource.stop(); } catch {}
  setCurrentSource(null);
  setIsPlaying(false);
  setPlayOffset(0);
  dom.playPauseBtn.innerHTML = ICON.play;
  cancelAnimationFrame(animFrameId);
  dom.timeDisplay.textContent = '0:00';
}

export function seekTo(pct) {
  if (!currentAudioBuffer) return;
  const was = isPlaying;
  if (isPlaying) stopPlayback();
  setPlayOffset((pct / 100) * currentAudioBuffer.duration);
  if (was) {
    const source = createBufferSource();
    source.start(0, playOffset);
    setIsPlaying(true);
    setPlayStartTime(audioContext.currentTime);
    dom.playPauseBtn.innerHTML = ICON.pause;
  }
}

// ===== WAV Export =====
export function downloadWav() {
  if (!currentAudioBuffer) return;
  const sr = currentAudioBuffer.sampleRate;
  const samples = currentAudioBuffer.getChannelData(0);
  const len = samples.length * 2;
  const buf = new ArrayBuffer(44 + len);
  const v = new DataView(buf);

  const write = (off, str) => { for (let i = 0; i < str.length; i++) v.setUint8(off + i, str.charCodeAt(i)); };
  write(0, 'RIFF'); v.setUint32(4, 36 + len, true);
  write(8, 'WAVE'); write(12, 'fmt '); v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true);
  v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  write(36, 'data'); v.setUint32(40, len, true);

  let off = 44;
  for (let i = 0; i < samples.length; i++, off += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }

  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
  a.download = 'noteLM-output.wav';
  a.click();
}
