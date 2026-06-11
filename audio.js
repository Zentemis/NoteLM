// ============================================
// NoteLM — Audio Engine
// Model loading, TTS generation, playback,
// waveform visualization, WAV export
// ============================================

import { CONFIG } from './config.js';
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
import { renderScriptLines } from './script.js';

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

// ===== TTS Generation =====
export async function generate() {
  if (isGenerating) return;

  const valid = scriptLines.filter(l => l.text.trim());
  if (!valid.length) { setStatus('Add some script lines first!', 'error'); return; }
  if (!speakers.length) { setStatus('Add at least one speaker!', 'error'); return; }

  setIsGenerating(true);
  dom.generateBtn.disabled = true;
  dom.downloadBtn.disabled = true;
  dom.stopBtn.disabled = false;
  dom.progressSection.style.display = 'flex';
  dom.audioPlayer.style.display = 'none';
  setStatus('Generating…', 'loading');

  try {
    const model = await loadModel();

    const chunks = [];
    for (let i = 0; i < valid.length; i++) {
      const line = valid[i];
      const spk = getSpeaker(line.speakerId);
      const pct = Math.round((i / valid.length) * 100);

      dom.progressBar.style.width = pct + '%';
      dom.progressText.textContent = `Line ${i + 1}/${valid.length} — ${spk?.name || '?'}`;

      scriptLines.forEach(l => l._active = l.id === line.id);
      renderScriptLines();

      const audio = await model.generate(line.text, { voice: spk?.voice || 'af_heart' });
      chunks.push(audio.audio);

      if (i < valid.length - 1) {
        chunks.push(new Float32Array(Math.floor(CONFIG.sampleRate * CONFIG.lineGap)));
      }
    }

    // Merge chunks into one Float32Array
    const total = chunks.reduce((s, c) => s + c.length, 0);
    const merged = new Float32Array(total);
    let off = 0;
    for (const c of chunks) { merged.set(c, off); off += c.length; }

    if (!audioContext) setAudioContext(new (window.AudioContext || window.webkitAudioContext)());
    const buf = audioContext.createBuffer(1, merged.length, CONFIG.sampleRate);
    buf.getChannelData(0).set(merged);
    setCurrentAudioBuffer(buf);

    scriptLines.forEach(l => l._active = false);
    renderScriptLines();

    dom.progressBar.style.width = '100%';
    dom.progressText.textContent = 'Done!';
    dom.audioPlayer.style.display = 'flex';
    dom.downloadBtn.disabled = false;
    setStatus(`Generated ${valid.length} lines`);

    return merged; // Return raw samples for waveform drawing
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

// ===== Playback =====
function createBufferSource() {
  const source = audioContext.createBufferSource();
  source.buffer = currentAudioBuffer;
  source.connect(audioContext.destination);
  source.onended = () => {
    setIsPlaying(false);
    dom.playPauseBtn.textContent = '▶';
    cancelAnimationFrame(animFrameId);
  };
  setCurrentSource(source);
  return source;
}

export function playAudio() {
  if (!currentAudioBuffer) return;
  if (!audioContext) setAudioContext(new (window.AudioContext || window.webkitAudioContext)());
  if (audioContext.state === 'suspended') audioContext.resume();
  stopPlayback();

  const source = createBufferSource();
  setPlayStartTime(audioContext.currentTime);
  setPlayOffset(0);
  source.start(0);
  setIsPlaying(true);
  dom.playPauseBtn.textContent = '⏸';
}

export function pauseAudio() {
  if (!isPlaying || !currentSource) return;
  setPlayOffset(playOffset + audioContext.currentTime - playStartTime);
  currentSource.stop();
  setCurrentSource(null);
  setIsPlaying(false);
  dom.playPauseBtn.textContent = '▶';
  cancelAnimationFrame(animFrameId);
}

export function stopPlayback() {
  if (currentSource) try { currentSource.stop(); } catch {}
  setCurrentSource(null);
  setIsPlaying(false);
  setPlayOffset(0);
  dom.playPauseBtn.textContent = '▶';
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
    dom.playPauseBtn.textContent = '⏸';
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
