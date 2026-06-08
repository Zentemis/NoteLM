// ============================================
// NoteLM — Multi-Speaker TTS App
// Powered by Kokoro JS (browser-local)
// ============================================

// --- Kokoro voice catalog ---
const VOICES = {
    // American English — Female
    'af_heart':    { name: 'Heart',    lang: 'en-us', gender: 'Female', quality: 'A' },
    'af_alloy':    { name: 'Alloy',    lang: 'en-us', gender: 'Female', quality: 'B' },
    'af_aoede':    { name: 'Aoede',    lang: 'en-us', gender: 'Female', quality: 'B' },
    'af_bella':    { name: 'Bella',    lang: 'en-us', gender: 'Female', quality: 'A' },
    'af_jessica':  { name: 'Jessica',  lang: 'en-us', gender: 'Female', quality: 'C' },
    'af_kore':     { name: 'Kore',     lang: 'en-us', gender: 'Female', quality: 'B' },
    'af_nicole':   { name: 'Nicole',   lang: 'en-us', gender: 'Female', quality: 'B' },
    'af_nova':     { name: 'Nova',     lang: 'en-us', gender: 'Female', quality: 'B' },
    'af_river':    { name: 'River',    lang: 'en-us', gender: 'Female', quality: 'C' },
    'af_sarah':    { name: 'Sarah',    lang: 'en-us', gender: 'Female', quality: 'B' },
    'af_sky':      { name: 'Sky',      lang: 'en-us', gender: 'Female', quality: 'B' },
    // American English — Male
    'am_adam':     { name: 'Adam',     lang: 'en-us', gender: 'Male',   quality: 'D' },
    'am_echo':     { name: 'Echo',     lang: 'en-us', gender: 'Male',   quality: 'C' },
    'am_eric':     { name: 'Eric',     lang: 'en-us', gender: 'Male',   quality: 'C' },
    'am_fenrir':   { name: 'Fenrir',   lang: 'en-us', gender: 'Male',   quality: 'B' },
    'am_liam':     { name: 'Liam',     lang: 'en-us', gender: 'Male',   quality: 'C' },
    'am_michael':  { name: 'Michael',  lang: 'en-us', gender: 'Male',   quality: 'B' },
    'am_onyx':     { name: 'Onyx',     lang: 'en-us', gender: 'Male',   quality: 'C' },
    'am_puck':     { name: 'Puck',     lang: 'en-us', gender: 'Male',   quality: 'B' },
    'am_santa':    { name: 'Santa',    lang: 'en-us', gender: 'Male',   quality: 'C' },
    // British English — Female
    'bf_emma':     { name: 'Emma',     lang: 'en-gb', gender: 'Female', quality: 'B' },
    'bf_isabella': { name: 'Isabella', lang: 'en-gb', gender: 'Female', quality: 'B' },
    'bf_alice':    { name: 'Alice',    lang: 'en-gb', gender: 'Female', quality: 'C' },
    'bf_lily':     { name: 'Lily',     lang: 'en-gb', gender: 'Female', quality: 'C' },
    // British English — Male
    'bm_george':   { name: 'George',   lang: 'en-gb', gender: 'Male',   quality: 'B' },
    'bm_lewis':    { name: 'Lewis',    lang: 'en-gb', gender: 'Male',   quality: 'C' },
    'bm_daniel':   { name: 'Daniel',   lang: 'en-gb', gender: 'Male',   quality: 'C' },
    'bm_fable':    { name: 'Fable',    lang: 'en-gb', gender: 'Male',   quality: 'B' },
};

const SPEAKER_COLORS = [
    '#6c63ff', '#f87171', '#4ade80', '#fbbf24',
    '#60a5fa', '#f472b6', '#a78bfa', '#34d399',
    '#fb923c', '#38bdf8', '#e879f9', '#facc15',
];

// --- State ---
let speakers = [];
let scriptLines = [];
let kokoroModel = null;
let isGenerating = false;
let audioContext = null;
let currentAudioBuffer = null;
let currentSource = null;
let isPlaying = false;
let playStartTime = 0;
let playOffset = 0;
let animFrameId = null;

// --- DOM refs ---
const $ = (sel) => document.querySelector(sel);
const speakersList = $('#speakersList');
const scriptLinesEl = $('#scriptLines');
const addSpeakerBtn = $('#addSpeakerBtn');
const addLineBtn = $('#addLineBtn');
const clearScriptBtn = $('#clearScriptBtn');
const loadExampleBtn = $('#loadExampleBtn');
const generateBtn = $('#generateBtn');
const downloadBtn = $('#downloadBtn');
const stopBtn = $('#stopBtn');
const progressSection = $('#progressSection');
const progressBar = $('#progressBar');
const progressText = $('#progressText');
const audioPlayer = $('#audioPlayer');
const waveformCanvas = $('#waveformCanvas');
const playPauseBtn = $('#playPauseBtn');
const timeDisplay = $('#timeDisplay');
const seekBar = $('#seekBar');
const volumeSlider = $('#volumeSlider');
const loadingOverlay = $('#loadingOverlay');
const modelProgressBar = $('#modelProgressBar');
const modelProgressPercent = $('#modelProgressPercent');
const loadingText = $('#loadingText');
const statusDot = $('#statusDot');
const statusText = $('#statusText');
const pasteScriptBtn = $('#pasteScriptBtn');
const pasteOverlay = $('#pasteOverlay');
const pasteCancelBtn = $('#pasteCancelBtn');
const pasteParseBtn = $('#pasteParseBtn');

// --- Helpers ---
function setStatus(text, state = 'ready') {
    statusText.textContent = text;
    statusDot.className = 'status-dot' + (state === 'loading' ? ' loading' : state === 'error' ? ' error' : '');
}

function getVoiceOptions() {
    return Object.entries(VOICES).map(([id, v]) => {
        const label = `${v.name} (${v.gender}, ${v.lang}) — ${v.quality}`;
        return `<option value="${id}">${label}</option>`;
    }).join('');
}

function getSpeakerById(id) {
    return speakers.find(s => s.id === id);
}

// --- Speaker management ---
function addSpeaker(name, voiceId) {
    const id = 'spk_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    const colorIdx = speakers.length % SPEAKER_COLORS.length;
    speakers.push({
        id,
        name: name || `Speaker ${speakers.length + 1}`,
        voice: voiceId || Object.keys(VOICES)[speakers.length % Object.keys(VOICES).length],
        color: SPEAKER_COLORS[colorIdx],
    });
    renderSpeakers();
    return id;
}

function removeSpeaker(id) {
    speakers = speakers.filter(s => s.id !== id);
    renderSpeakers();
}

function renderSpeakers() {
    speakersList.innerHTML = speakers.map(s => `
        <div class="speaker-card" data-id="${s.id}">
            <div class="speaker-color" style="background:${s.color}"></div>
            <div class="speaker-fields">
                <label>
                    Name
                    <input type="text" value="${s.name}" data-field="name" data-id="${s.id}" placeholder="Speaker name">
                </label>
                <label>
                    Voice
                    <select data-field="voice" data-id="${s.id}">
                        ${Object.entries(VOICES).map(([vid, v]) =>
                            `<option value="${vid}" ${vid === s.voice ? 'selected' : ''}>${v.name} (${v.gender}, ${v.lang})</option>`
                        ).join('')}
                    </select>
                </label>
            </div>
            <button class="speaker-remove" data-remove="${s.id}" title="Remove speaker">×</button>
        </div>
    `).join('');

    // Bind events
    speakersList.querySelectorAll('input, select').forEach(el => {
        el.addEventListener('change', (e) => {
            const spk = getSpeakerById(e.target.dataset.id);
            if (spk) spk[e.target.dataset.field] = e.target.value;
        });
    });
    speakersList.querySelectorAll('.speaker-remove').forEach(el => {
        el.addEventListener('click', () => removeSpeaker(el.dataset.remove));
    });

    // Update script line speaker dropdowns
    updateLineSpeakerOptions();
}

// --- Script line management ---
function addScriptLine(speakerId, text) {
    scriptLines.push({
        id: 'line_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        speakerId: speakerId || (speakers[0]?.id || ''),
        text: text || '',
    });
    renderScriptLines();
}

function removeScriptLine(id) {
    scriptLines = scriptLines.filter(l => l.id !== id);
    renderScriptLines();
}

function updateLineSpeakerOptions() {
    scriptLinesEl.querySelectorAll('.line-speaker').forEach(sel => {
        const currentVal = sel.value;
        sel.innerHTML = speakers.map(s =>
            `<option value="${s.id}">${s.name}</option>`
        ).join('');
        // Try to preserve selection
        if (speakers.find(s => s.id === currentVal)) {
            sel.value = currentVal;
        }
    });
}

function renderScriptLines() {
    scriptLinesEl.innerHTML = scriptLines.map((line, i) => `
        <div class="script-line" data-id="${line.id}">
            <span class="line-number">${i + 1}</span>
            <select class="line-speaker" data-lid="${line.id}">
                ${speakers.map(s =>
                    `<option value="${s.id}" ${s.id === line.speakerId ? 'selected' : ''}>${s.name}</option>`
                ).join('')}
            </select>
            <textarea class="line-text" data-lid="${line.id}" rows="1" placeholder="Enter dialogue...">${line.text}</textarea>
            <button class="line-remove" data-remove="${line.id}" title="Remove line">×</button>
        </div>
    `).join('');

    // Auto-resize textareas
    scriptLinesEl.querySelectorAll('.line-text').forEach(ta => {
        ta.addEventListener('input', () => {
            ta.style.height = 'auto';
            ta.style.height = ta.scrollHeight + 'px';
        });
        // Trigger initial resize
        ta.style.height = 'auto';
        ta.style.height = ta.scrollHeight + 'px';
    });

    // Bind events
    scriptLinesEl.querySelectorAll('.line-speaker').forEach(sel => {
        sel.addEventListener('change', (e) => {
            const line = scriptLines.find(l => l.id === e.target.dataset.lid);
            if (line) line.speakerId = e.target.value;
        });
    });
    scriptLinesEl.querySelectorAll('.line-text').forEach(ta => {
        ta.addEventListener('input', (e) => {
            const line = scriptLines.find(l => l.id === e.target.dataset.lid);
            if (line) line.text = e.target.value;
        });
    });
    scriptLinesEl.querySelectorAll('.line-remove').forEach(el => {
        el.addEventListener('click', () => removeScriptLine(el.dataset.remove));
    });
}

// --- Example script ---
function loadExample() {
    // Ensure we have at least 2 speakers
    if (speakers.length < 2) {
        speakers = [];
        addSpeaker('Alice', 'af_heart');
        addSpeaker('Bob', 'am_puck');
    }

    scriptLines = [
        { id: 'ex1', speakerId: speakers[0].id, text: 'Hey Bob, have you heard about this new text-to-speech technology?' },
        { id: 'ex2', speakerId: speakers[1].id, text: 'Oh yeah! It runs entirely in the browser. No server needed at all.' },
        { id: 'ex3', speakerId: speakers[0].id, text: "That's incredible. And each speaker can have a completely different voice?" },
        { id: 'ex4', speakerId: speakers[1].id, text: "Absolutely. You can pick from dozens of voices. It's all powered by Kokoro." },
        { id: 'ex5', speakerId: speakers[0].id, text: 'This is going to change how we create audio content.' },
        { id: 'ex6', speakerId: speakers[1].id, text: "Couldn't agree more. Give it a try!" },
    ];
    renderScriptLines();
}

// --- Kokoro model loading ---
async function loadKokoroModel() {
    if (kokoroModel) return kokoroModel;

    loadingOverlay.style.display = 'flex';
    setStatus('Loading Kokoro model...', 'loading');

    try {
        // Dynamic import of kokoro-js
        const { KokoroTTS } = await import('https://cdn.jsdelivr.net/npm/kokoro-js@latest');

        loadingText.textContent = 'Initializing model... This may take a moment on first visit.';

        kokoroModel = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
            dtype: 'fp32',
            device: 'webgpu',
            progress_callback: (progress) => {
                if (progress.status === 'progress' && progress.total) {
                    const pct = Math.round((progress.progress / progress.total) * 100);
                    modelProgressBar.style.width = pct + '%';
                    modelProgressPercent.textContent = pct + '%';
                    loadingText.textContent = `Downloading model: ${pct}%`;
                } else if (progress.status === 'done') {
                    modelProgressBar.style.width = '100%';
                    modelProgressPercent.textContent = '100%';
                }
            }
        });

        loadingOverlay.style.display = 'none';
        setStatus('Model loaded — ready to generate', 'ready');
        return kokoroModel;
    } catch (err) {
        console.error('Failed to load Kokoro model:', err);
        loadingOverlay.style.display = 'none';
        setStatus('Failed to load model: ' + err.message, 'error');
        throw err;
    }
}

// --- Audio generation ---
async function generateAudio() {
    if (isGenerating) return;

    // Validate
    const validLines = scriptLines.filter(l => l.text.trim());
    if (validLines.length === 0) {
        setStatus('Add some script lines first!', 'error');
        return;
    }
    if (speakers.length === 0) {
        setStatus('Add at least one speaker first!', 'error');
        return;
    }

    isGenerating = true;
    generateBtn.disabled = true;
    downloadBtn.disabled = true;
    stopBtn.disabled = false;
    progressSection.style.display = 'block';
    audioPlayer.style.display = 'none';
    setStatus('Generating audio...', 'loading');

    try {
        const model = await loadKokoroModel();

        // Generate audio for each line
        const audioChunks = [];
        const sampleRate = 24000; // Kokoro's sample rate

        for (let i = 0; i < validLines.length; i++) {
            const line = validLines[i];
            const speaker = getSpeakerById(line.speakerId);
            const voiceId = speaker?.voice || 'af_heart';
            const pct = Math.round(((i) / validLines.length) * 100);

            progressBar.style.width = pct + '%';
            progressText.textContent = `Generating line ${i + 1} of ${validLines.length} (${speaker?.name || 'Unknown'})...`;

            // Highlight active line
            scriptLinesEl.querySelectorAll('.script-line').forEach(el => el.classList.remove('active'));
            const activeEl = scriptLinesEl.querySelector(`[data-id="${line.id}"]`);
            if (activeEl) activeEl.classList.add('active');

            // Generate speech for this line
            const audio = await model.generate(line.text, { voice: voiceId });

            // Get raw Float32 samples
            const raw = audio.audio; // Float32Array
            audioChunks.push(raw);

            // Add a short silence between speakers (0.4s)
            if (i < validLines.length - 1) {
                const silence = new Float32Array(Math.floor(sampleRate * 0.4));
                audioChunks.push(silence);
            }
        }

        // Concatenate all chunks
        const totalLength = audioChunks.reduce((sum, c) => sum + c.length, 0);
        const merged = new Float32Array(totalLength);
        let offset = 0;
        for (const chunk of audioChunks) {
            merged.set(chunk, offset);
            offset += chunk.length;
        }

        // Create AudioBuffer
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        const buffer = audioContext.createBuffer(1, merged.length, sampleRate);
        buffer.getChannelData(0).set(merged);
        currentAudioBuffer = buffer;

        // Done!
        progressBar.style.width = '100%';
        progressText.textContent = 'Done!';
        scriptLinesEl.querySelectorAll('.script-line').forEach(el => el.classList.remove('active'));

        // Show player
        audioPlayer.style.display = 'block';
        downloadBtn.disabled = false;
        drawWaveform(merged);
        playAudio();

        setStatus(`Generated ${validLines.length} lines successfully`, 'ready');

    } catch (err) {
        console.error('Generation error:', err);
        setStatus('Error: ' + err.message, 'error');
        progressText.textContent = 'Error: ' + err.message;
    } finally {
        isGenerating = false;
        generateBtn.disabled = false;
        stopBtn.disabled = true;
    }
}

// --- Playback ---
function playAudio() {
    if (!currentAudioBuffer || !audioContext) return;

    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }

    stopPlayback();

    currentSource = audioContext.createBufferSource();
    currentSource.buffer = currentAudioBuffer;
    currentSource.connect(audioContext.destination);
    currentSource.onended = () => {
        isPlaying = false;
        playPauseBtn.textContent = '▶';
        cancelAnimationFrame(animFrameId);
    };

    playStartTime = audioContext.currentTime;
    playOffset = 0;
    currentSource.start(0, playOffset);
    isPlaying = true;
    playPauseBtn.textContent = '⏸';
    updateSeekBar();
}

function pauseAudio() {
    if (!isPlaying || !currentSource) return;
    playOffset += audioContext.currentTime - playStartTime;
    currentSource.stop();
    currentSource = null;
    isPlaying = false;
    playPauseBtn.textContent = '▶';
    cancelAnimationFrame(animFrameId);
}

function stopPlayback() {
    if (currentSource) {
        try { currentSource.stop(); } catch(e) {}
        currentSource = null;
    }
    isPlaying = false;
    playOffset = 0;
    playPauseBtn.textContent = '▶';
    cancelAnimationFrame(animFrameId);
    seekBar.value = 0;
    timeDisplay.textContent = '0:00 / 0:00';
}

function seekTo(pct) {
    if (!currentAudioBuffer) return;
    const wasPlaying = isPlaying;
    if (isPlaying) stopPlayback();
    playOffset = (pct / 100) * currentAudioBuffer.duration;
    if (wasPlaying) {
        currentSource = audioContext.createBufferSource();
        currentSource.buffer = currentAudioBuffer;
        currentSource.connect(audioContext.destination);
        currentSource.onended = () => {
            isPlaying = false;
            playPauseBtn.textContent = '▶';
            cancelAnimationFrame(animFrameId);
        };
        currentSource.start(0, playOffset);
        isPlaying = true;
        playStartTime = audioContext.currentTime;
        playPauseBtn.textContent = '⏸';
        updateSeekBar();
    }
}

function updateSeekBar() {
    if (!currentAudioBuffer) return;
    const elapsed = isPlaying ? (playOffset + (audioContext.currentTime - playStartTime)) : playOffset;
    const duration = currentAudioBuffer.duration;
    const pct = Math.min((elapsed / duration) * 100, 100);
    seekBar.value = pct;
    timeDisplay.textContent = formatTime(elapsed) + ' / ' + formatTime(duration);
    if (isPlaying) {
        animFrameId = requestAnimationFrame(updateSeekBar);
    }
}

function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
}

// --- Waveform drawing ---
function drawWaveform(samples) {
    const canvas = waveformCanvas;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    ctx.scale(dpr, dpr);

    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const step = Math.ceil(samples.length / w);

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(108, 99, 255, 0.15)';
    ctx.strokeStyle = '#6c63ff';
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.moveTo(0, h / 2);

    for (let i = 0; i < w; i++) {
        let min = 1, max = -1;
        for (let j = 0; j < step; j++) {
            const idx = i * step + j;
            if (idx < samples.length) {
                if (samples[idx] < min) min = samples[idx];
                if (samples[idx] > max) max = samples[idx];
            }
        }
        const yLow = (1 + min) * h / 2;
        const yHigh = (1 + max) * h / 2;
        ctx.fillRect(i, yLow, 1, yHigh - yLow || 1);
        ctx.lineTo(i, (yLow + yHigh) / 2);
    }

    ctx.stroke();
}

// --- Download WAV ---
function downloadWav() {
    if (!currentAudioBuffer) return;

    const numChannels = currentAudioBuffer.numberOfChannels;
    const sampleRate = currentAudioBuffer.sampleRate;
    const format = 1; // PCM
    const bitsPerSample = 16;
    const samples = currentAudioBuffer.getChannelData(0);
    const dataLength = samples.length * (bitsPerSample / 8);
    const buffer = new ArrayBuffer(44 + dataLength);
    const view = new DataView(buffer);

    // WAV header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // chunk size
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true);
    view.setUint16(32, numChannels * (bitsPerSample / 8), true);
    view.setUint16(34, bitsPerSample, true);
    writeString(view, 36, 'data');
    view.setUint32(40, dataLength, true);

    // Write samples
    let offset = 44;
    for (let i = 0; i < samples.length; i++, offset += 2) {
        const s = Math.max(-1, Math.min(1, samples[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }

    const blob = new Blob([buffer], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'noteLM-output.wav';
    a.click();
    URL.revokeObjectURL(url);
}

function writeString(view, offset, str) {
    for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
    }
}

// --- Paste script parsing ---
function openPasteModal() {
    $('#pasteOverlay').style.display = 'flex';
    $('#pasteTextarea').value = '';
    $('#pasteTextarea').focus();
}

function closePasteModal() {
    $('#pasteOverlay').style.display = 'none';
}

function parseAndImportScript() {
    const raw = $('#pasteTextarea').value.trim();
    if (!raw) {
        setStatus('Nothing to parse — paste some text first!', 'error');
        return;
    }

    // Parse lines matching "Speaker Name: text"
    // Supports: "Alice: hello", "Speaker 1: hello", "Alice : hello" (with optional space before colon)
    const lines = raw.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const parsed = [];
    const speakerNames = new Set();

    for (const line of lines) {
        // Match: anything followed by colon and text
        // Be flexible: allow "Name:" or "Name :" at the start
        const match = line.match(/^(.+?)\s*:\s*(.+)$/);
        if (match) {
            const name = match[1].trim();
            const text = match[2].trim();
            if (name && text) {
                parsed.push({ speakerName: name, text });
                speakerNames.add(name);
            }
        }
    }

    if (parsed.length === 0) {
        setStatus('No lines matched the "Speaker: text" pattern. Try format like: Alice: Hello!', 'error');
        return;
    }

    // Create speakers for any new names found
    // Try to match existing speakers by name first
    const nameToId = {};
    let voiceIdx = 0;
    const voiceKeys = Object.keys(VOICES);

    for (const name of speakerNames) {
        // Check if speaker already exists
        const existing = speakers.find(s => s.name.toLowerCase() === name.toLowerCase());
        if (existing) {
            nameToId[name] = existing.id;
        } else {
            // Create new speaker with rotating voice
            const newId = addSpeaker(name, voiceKeys[voiceIdx % voiceKeys.length]);
            nameToId[name] = newId;
            voiceIdx++;
        }
    }

    // Build script lines
    scriptLines = parsed.map((p, i) => ({
        id: 'paste_' + Date.now() + '_' + i,
        speakerId: nameToId[p.speakerName],
        text: p.text,
    }));

    renderSpeakers();
    renderScriptLines();
    closePasteModal();
    setStatus(`Imported ${parsed.length} lines with ${speakerNames.size} speaker(s)`, 'ready');
}

// --- Event listeners ---
addSpeakerBtn.addEventListener('click', () => addSpeaker());
addLineBtn.addEventListener('click', () => addScriptLine());
clearScriptBtn.addEventListener('click', () => {
    scriptLines = [];
    renderScriptLines();
});
pasteScriptBtn.addEventListener('click', openPasteModal);
pasteCancelBtn.addEventListener('click', closePasteModal);
pasteParseBtn.addEventListener('click', parseAndImportScript);

// Close paste modal on backdrop click
pasteOverlay.addEventListener('click', (e) => {
    if (e.target === pasteOverlay) closePasteModal();
});
loadExampleBtn.addEventListener('click', loadExample);
generateBtn.addEventListener('click', generateAudio);
stopBtn.addEventListener('click', stopPlayback);
downloadBtn.addEventListener('click', downloadWav);

playPauseBtn.addEventListener('click', () => {
    if (isPlaying) pauseAudio();
    else playAudio();
});

seekBar.addEventListener('input', (e) => {
    seekTo(parseFloat(e.target.value));
});

volumeSlider.addEventListener('input', (e) => {
    // Volume is handled at the AudioContext destination level
    // For simplicity, we'll use a GainNode if needed
});

// --- Init ---
function init() {
    // Add default speakers
    addSpeaker('Speaker 1', 'af_heart');
    addSpeaker('Speaker 2', 'am_puck');

    // Add a couple default lines
    addScriptLine(speakers[0].id, 'Hello! Welcome to NoteLM.');
    addScriptLine(speakers[1].id, 'Thanks! This is pretty cool.');

    setStatus('Ready — add speakers and a script, then generate!', 'ready');
}

init();
