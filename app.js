// ============================================
// NoteLM — Multi-Speaker TTS
// Powered by Kokoro JS (browser-local)
// ============================================

const VOICES = {
    af_heart:    { name: 'Heart',    lang: 'en-us', gender: 'Female' },
    af_alloy:    { name: 'Alloy',    lang: 'en-us', gender: 'Female' },
    af_aoede:    { name: 'Aoede',    lang: 'en-us', gender: 'Female' },
    af_bella:    { name: 'Bella',    lang: 'en-us', gender: 'Female' },
    af_jessica:  { name: 'Jessica',  lang: 'en-us', gender: 'Female' },
    af_kore:     { name: 'Kore',     lang: 'en-us', gender: 'Female' },
    af_nicole:   { name: 'Nicole',   lang: 'en-us', gender: 'Female' },
    af_nova:     { name: 'Nova',     lang: 'en-us', gender: 'Female' },
    af_river:    { name: 'River',    lang: 'en-us', gender: 'Female' },
    af_sarah:    { name: 'Sarah',    lang: 'en-us', gender: 'Female' },
    af_sky:      { name: 'Sky',      lang: 'en-us', gender: 'Female' },
    am_adam:     { name: 'Adam',     lang: 'en-us', gender: 'Male'   },
    am_echo:     { name: 'Echo',     lang: 'en-us', gender: 'Male'   },
    am_eric:     { name: 'Eric',     lang: 'en-us', gender: 'Male'   },
    am_fenrir:   { name: 'Fenrir',   lang: 'en-us', gender: 'Male'   },
    am_liam:     { name: 'Liam',     lang: 'en-us', gender: 'Male'   },
    am_michael:  { name: 'Michael',  lang: 'en-us', gender: 'Male'   },
    am_onyx:     { name: 'Onyx',     lang: 'en-us', gender: 'Male'   },
    am_puck:     { name: 'Puck',     lang: 'en-us', gender: 'Male'   },
    am_santa:    { name: 'Santa',    lang: 'en-us', gender: 'Male'   },
    bf_emma:     { name: 'Emma',     lang: 'en-gb', gender: 'Female' },
    bf_isabella: { name: 'Isabella', lang: 'en-gb', gender: 'Female' },
    bf_alice:    { name: 'Alice',    lang: 'en-gb', gender: 'Female' },
    bf_lily:     { name: 'Lily',     lang: 'en-gb', gender: 'Female' },
    bm_george:   { name: 'George',   lang: 'en-gb', gender: 'Male'   },
    bm_lewis:    { name: 'Lewis',    lang: 'en-gb', gender: 'Male'   },
    bm_daniel:   { name: 'Daniel',   lang: 'en-gb', gender: 'Male'   },
    bm_fable:    { name: 'Fable',    lang: 'en-gb', gender: 'Male'   },
};

const COLORS = ['#2dd4bf','#f472b6','#fbbf24','#a78bfa','#60a5fa','#4ade80','#fb923c','#38bdf8','#e879f9','#facc15','#34d399','#f87171'];
const VOICE_KEYS = Object.keys(VOICES);

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
let openEditorId = null; // which speaker chip has its editor open
let currentEngine = 'kokoro'; // kokoro | piper | kitten
let detectedDevice = null; // 'webgpu' | 'wasm'

// Engine configs
const ENGINES = {
    kokoro: {
        name: 'Kokoro',
        size: '~82 MB',
        voices: VOICE_KEYS,
        getVoiceName: vid => VOICES[vid]?.name || vid,
    },
    piper: {
        name: 'Piper',
        size: '~15 MB',
        voices: ['en_US-amy-medium', 'en_US-lessac-medium', 'en_US-libritts_r-medium', 'en_GB-alan-medium'],
        getVoiceName: vid => vid.replace('en_US-', '').replace('en_GB-', '').replace('-medium', ''),
    },
    kitten: {
        name: 'Kitten',
        size: '~5 MB',
        voices: ['default'],
        getVoiceName: () => 'default',
    },
};

// --- DOM ---
const $ = s => document.querySelector(s);
const dom = {
    speakersList:    $('#speakersList'),
    scriptLines:     $('#scriptLines'),
    addSpeakerBtn:   $('#addSpeakerBtn'),
    addLineBtn:      $('#addLineBtn'),
    clearScriptBtn:  $('#clearScriptBtn'),
    loadExampleBtn:  $('#loadExampleBtn'),
    pasteScriptBtn:  $('#pasteScriptBtn'),
    pasteOverlay:    $('#pasteOverlay'),
    pasteCancelBtn:  $('#pasteCancelBtn'),
    pasteParseBtn:   $('#pasteParseBtn'),
    generateBtn:     $('#generateBtn'),
    downloadBtn:     $('#downloadBtn'),
    stopBtn:         $('#stopBtn'),
    progressSection: $('#progressSection'),
    progressBar:     $('#progressBar'),
    progressText:    $('#progressText'),
    audioPlayer:     $('#audioPlayer'),
    waveformCanvas:  $('#waveformCanvas'),
    playPauseBtn:    $('#playPauseBtn'),
    timeDisplay:     $('#timeDisplay'),
    seekBar:         $('#seekBar'),
    volumeSlider:    $('#volumeSlider'),
    loadingOverlay:  $('#loadingOverlay'),
    modelProgressBar:    $('#modelProgressBar'),
    modelProgressPercent: $('#modelProgressPercent'),
    loadingText:     $('#loadingText'),
    statusDot:       $('#statusDot'),
    statusText:      $('#statusText'),
    // Lazy lookups for elements that may not exist at parse time
    get pasteTextarea() { return $('#pasteTextarea'); },
    get editorPortal() { return $('#speakerEditorPortal'); },
    get backendNotice() { return $('#backendNotice'); },
    get backendNoticeText() { return $('#backendNoticeText'); },
    get engineOptions() { return $('#engineOptions'); },
};

// --- Helpers ---
const setStatus = (text, state = 'ready') => {
    dom.statusText.textContent = text;
    dom.statusDot.className = 'status-dot' + (state === 'loading' ? ' loading' : state === 'error' ? ' error' : '');
};

const getSpeaker = id => speakers.find(s => s.id === id);

const voiceLabel = vid => {
    const eng = ENGINES[currentEngine];
    return eng ? eng.getVoiceName(vid) : vid;
};

// --- Speaker Management ---
function addSpeaker(name, voiceId) {
    const id = 's' + Date.now() + Math.random().toString(36).slice(2, 5);
    speakers.push({
        id,
        name: name || `Speaker ${speakers.length + 1}`,
        voice: voiceId || VOICE_KEYS[speakers.length % VOICE_KEYS.length],
        color: COLORS[speakers.length % COLORS.length],
    });
    renderSpeakers();
    return id;
}

function removeSpeaker(id) {
    speakers = speakers.filter(s => s.id !== id);
    if (openEditorId === id) openEditorId = null;
    renderSpeakers();
}

function toggleEditor(id) {
    openEditorId = openEditorId === id ? null : id;
    renderSpeakers();
}

// Speaker editor portal — rendered at body level, positioned via JS
function positionEditor(chipEl) {
    const rect = chipEl.getBoundingClientRect();
    const editor = dom.editorPortal;
    if (!editor) return;
    editor.style.display = 'block';
    editor.style.position = 'fixed';
    editor.style.top = (rect.bottom + 6) + 'px';
    editor.style.left = (rect.left + rect.width / 2) + 'px';
    editor.style.transform = 'translateX(-50%)';
    editor.style.zIndex = '10000';
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
                ${ENGINES[currentEngine].voices.map(v => {
                    const sel = v === speaker.voice ? 'selected' : '';
                    return `<option value="${v}" ${sel}>${ENGINES[currentEngine].getVoiceName(v)}</option>`;
                }).join('')}
            </select>
        </div>
    `;
    // Bind
    const nameInput = document.getElementById('editorNameInput');
    const voiceSelect = document.getElementById('editorVoiceSelect');
    nameInput.oninput = () => {
        speaker.name = nameInput.value;
        // Live update chip text
        const chipName = document.querySelector(`[data-chip-id="${speaker.id}"] .chip-name`);
        if (chipName) chipName.textContent = nameInput.value;
    };
    nameInput.onchange = () => renderSpeakers();
    voiceSelect.onchange = () => {
        speaker.voice = voiceSelect.value;
        renderSpeakers();
    };
    nameInput.focus();
}

function closeEditor() {
    openEditorId = null;
    const portal = dom.editorPortal;
    if (portal) { portal.style.display = 'none'; portal.innerHTML = ''; }
}

function renderSpeakers() {
    dom.speakersList.innerHTML = speakers.map(s => `
        <div class="speaker-chip${openEditorId === s.id ? ' active' : ''}" data-chip-id="${s.id}">
            <span class="chip-dot" style="background:${s.color}"></span>
            <span class="chip-name">${s.name}</span>
            <span class="chip-voice">${voiceLabel(s.voice)}</span>
            <button class="chip-remove" data-remove="${s.id}" title="Remove">×</button>
        </div>
    `).join('');

    // Bind chip clicks
    dom.speakersList.querySelectorAll('.speaker-chip').forEach(chip => {
        chip.addEventListener('click', e => {
            if (e.target.closest('.chip-remove')) return;
            const id = chip.dataset.chipId;
            if (openEditorId === id) {
                closeEditor();
            } else {
                openEditorId = id;
                renderSpeakers();
                const spk = getSpeaker(id);
                const chipEl = document.querySelector(`[data-chip-id="${id}"]`);
                if (spk && chipEl) {
                    positionEditor(chipEl);
                    renderSpeakerEditor(spk);
                }
            }
        });
    });

    // Bind remove buttons
    dom.speakersList.querySelectorAll('.chip-remove').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            closeEditor();
            removeSpeaker(btn.dataset.remove);
        });
    });

    // Reposition editor if open
    if (openEditorId) {
        const chipEl = document.querySelector(`[data-chip-id="${openEditorId}"]`);
        if (chipEl) positionEditor(chipEl);
    }

    updateLineSpeakerOptions();
}

// --- Script Lines ---
function addScriptLine(speakerId, text) {
    scriptLines.push({
        id: 'l' + Date.now() + Math.random().toString(36).slice(2, 5),
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
    dom.scriptLines.querySelectorAll('.line-speaker-select').forEach(sel => {
        const val = sel.value;
        sel.innerHTML = speakers.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
        if (speakers.find(s => s.id === val)) sel.value = val;
    });
}

function renderScriptLines() {
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

    // Auto-resize
    dom.scriptLines.querySelectorAll('.line-textarea').forEach(ta => {
        const resize = () => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; };
        ta.addEventListener('input', resize);
        resize();
    });

    // Bind
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

// --- Paste Parser ---
function openPasteModal(e) {
    if (e) e.stopPropagation();
    dom.pasteOverlay.style.display = 'flex';
    dom.pasteTextarea.value = '';
    setTimeout(() => dom.pasteTextarea.focus(), 50);
}

function closePasteModal(e) {
    if (e) e.stopPropagation();
    dom.pasteOverlay.style.display = 'none';
}

function parseAndImport() {
    console.log('[Paste] Starting parse...');

    const raw = dom.pasteTextarea.value.trim();
    if (!raw) { setStatus('Paste some text first!', 'error'); return; }

    const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
    const parsed = [];
    const nameSet = new Set();

    for (const line of lines) {
        // Simple: find first colon, split there
        const colonIdx = line.indexOf(':');
        if (colonIdx > 0 && colonIdx < line.length - 1) {
            const name = line.substring(0, colonIdx).trim();
            const text = line.substring(colonIdx + 1).trim();
            if (name.length > 0 && text.length > 0) {
                parsed.push({ name, text });
                nameSet.add(name);
            }
        }
    }

    if (!parsed.length) {
        setStatus('No "Speaker: text" lines found. Use: Alice: Hello!', 'error');
        return;
    }

    // Close modal
    dom.pasteOverlay.style.display = 'none';

    // Map names -> speaker ids
    const nameMap = {};
    let vi = 0;
    for (const name of nameSet) {
        const existing = speakers.find(s => s.name.toLowerCase() === name.toLowerCase());
        if (existing) {
            nameMap[name] = existing.id;
        } else {
            nameMap[name] = addSpeaker(name, VOICE_KEYS[vi % VOICE_KEYS.length]);
            vi++;
        }
    }

    scriptLines = parsed.map((p, i) => ({
        id: 'p' + Date.now() + '_' + i,
        speakerId: nameMap[p.name],
        text: p.text,
    }));

    renderScriptLines();
    setStatus(`Imported ${parsed.length} lines · ${nameSet.size} speaker(s)`, 'ready');
}

// --- Example ---
function loadExample() {
    if (speakers.length < 2) {
        speakers = [];
        addSpeaker('Alice', 'af_heart');
        addSpeaker('Bob', 'am_puck');
    }
    scriptLines = [
        { id: 'e1', speakerId: speakers[0].id, text: "Hey Bob, have you heard about this new text-to-speech technology?" },
        { id: 'e2', speakerId: speakers[1].id, text: "Oh yeah! It runs entirely in the browser. No server needed at all." },
        { id: 'e3', speakerId: speakers[0].id, text: "That's incredible. And each speaker can have a completely different voice?" },
        { id: 'e4', speakerId: speakers[1].id, text: "Absolutely. You can pick from dozens of voices. It's all powered by Kokoro." },
        { id: 'e5', speakerId: speakers[0].id, text: "This is going to change how we create audio content." },
        { id: 'e6', speakerId: speakers[1].id, text: "Couldn't agree more. Give it a try!" },
    ];
    renderScriptLines();
}

// --- Kokoro Model ---
async function probeWebGPU() {
    if (!navigator.gpu) {
        console.warn('[NoteLM] navigator.gpu not found');
        return 'wasm';
    }
    try {
        const adapter = await navigator.gpu.requestAdapter();
        if (adapter) return 'webgpu';
    } catch (e) {
        console.warn('[NoteLM] WebGPU probe failed:', e.message);
    }
    return 'wasm';
}

function showBackendNotice(device) {
    detectedDevice = device;
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

async function loadModel() {
    if (kokoroModel) return kokoroModel;
    dom.loadingOverlay.style.display = 'flex';
    setStatus('Probing hardware…', 'loading');

    try {
        // Step 1: Probe WebGPU
        dom.loadingText.textContent = 'Checking WebGPU support…';
        dom.modelProgressBar.style.width = '5%';
        dom.modelProgressPercent.textContent = '';

        const device = await probeWebGPU();
        showBackendNotice(device);

        dom.loadingText.textContent = device === 'webgpu'
            ? '✓ WebGPU found — loading with GPU acceleration'
            : '✗ WebGPU not available — using WASM (CPU) fallback';
        dom.modelProgressBar.style.width = '10%';

        await new Promise(r => setTimeout(r, 600)); // brief pause to show status

        // Step 2: Import library
        dom.loadingText.textContent = 'Loading Kokoro library…';
        const { KokoroTTS } = await import('https://cdn.jsdelivr.net/npm/kokoro-js@latest');
        dom.modelProgressBar.style.width = '15%';

        // Step 3: Download model
        dom.loadingText.textContent = `Downloading model (~82 MB) — ${device === 'webgpu' ? 'fp32' : 'q8 quantized'}…`;

        kokoroModel = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
            dtype: device === 'webgpu' ? 'fp32' : 'q8',
            device,
            progress_callback: p => {
                if (p.status === 'progress' && p.total) {
                    const pct = Math.round((p.progress / p.total) * 100);
                    const overall = 15 + Math.round(pct * 0.83); // 15% -> 98%
                    dom.modelProgressBar.style.width = overall + '%';
                    dom.modelProgressPercent.textContent = overall + '%';
                    const mb = Math.round(p.total / (1024 * 1024));
                    const dl = Math.round(p.progress / (1024 * 1024));
                    dom.loadingText.textContent = `Downloading: ${dl} / ${mb} MB (${pct}%)`;
                } else if (p.status === 'done') {
                    dom.modelProgressBar.style.width = '98%';
                    dom.loadingText.textContent = 'Initializing model…';
                }
            }
        });

        dom.modelProgressBar.style.width = '100%';
        dom.modelProgressPercent.textContent = '100%';
        dom.loadingText.textContent = 'Ready!';
        await new Promise(r => setTimeout(r, 300));

        dom.loadingOverlay.style.display = 'none';
        setStatus(`Kokoro loaded (${device})`, 'ready');
        return kokoroModel;
    } catch (err) {
        dom.loadingOverlay.style.display = 'none';
        setStatus('Model load failed: ' + err.message, 'error');
        throw err;
    }
}

// --- Generation ---
async function generate() {
    if (isGenerating) return;

    const valid = scriptLines.filter(l => l.text.trim());
    if (!valid.length) { setStatus('Add some script lines first!', 'error'); return; }
    if (!speakers.length) { setStatus('Add at least one speaker!', 'error'); return; }

    isGenerating = true;
    dom.generateBtn.disabled = true;
    dom.downloadBtn.disabled = true;
    dom.stopBtn.disabled = false;
    dom.progressSection.style.display = 'flex';
    dom.audioPlayer.style.display = 'none';
    setStatus('Generating…', 'loading');

    try {
        const model = await loadModel();
        const chunks = [];
        const sr = 24000;

        for (let i = 0; i < valid.length; i++) {
            const line = valid[i];
            const spk = getSpeaker(line.speakerId);
            const pct = Math.round((i / valid.length) * 100);

            dom.progressBar.style.width = pct + '%';
            dom.progressText.textContent = `Line ${i + 1}/${valid.length} — ${spk?.name || '?'}`;

            // Highlight active line
            scriptLines.forEach(l => l._active = l.id === line.id);
            renderScriptLines();

            const audio = await model.generate(line.text, { voice: spk?.voice || 'af_heart' });
            chunks.push(audio.audio);

            if (i < valid.length - 1) chunks.push(new Float32Array(Math.floor(sr * 0.35)));
        }

        // Merge chunks
        const total = chunks.reduce((s, c) => s + c.length, 0);
        const merged = new Float32Array(total);
        let off = 0;
        for (const c of chunks) { merged.set(c, off); off += c.length; }

        if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const buf = audioContext.createBuffer(1, merged.length, sr);
        buf.getChannelData(0).set(merged);
        currentAudioBuffer = buf;

        // Cleanup active highlights
        scriptLines.forEach(l => l._active = false);
        renderScriptLines();

        dom.progressBar.style.width = '100%';
        dom.progressText.textContent = 'Done!';
        dom.audioPlayer.style.display = 'flex';
        dom.downloadBtn.disabled = false;
        drawWaveform(merged);
        playAudio();
        setStatus(`Generated ${valid.length} lines`, 'ready');
    } catch (err) {
        setStatus('Error: ' + err.message, 'error');
        dom.progressText.textContent = 'Error';
    } finally {
        isGenerating = false;
        dom.generateBtn.disabled = false;
        dom.stopBtn.disabled = true;
    }
}

// --- Playback ---
function playAudio() {
    if (!currentAudioBuffer || !audioContext) return;
    if (audioContext.state === 'suspended') audioContext.resume();
    stopPlayback();

    currentSource = audioContext.createBufferSource();
    currentSource.buffer = currentAudioBuffer;
    currentSource.connect(audioContext.destination);
    currentSource.onended = () => { isPlaying = false; dom.playPauseBtn.textContent = '▶'; cancelAnimationFrame(animFrameId); };

    playStartTime = audioContext.currentTime;
    playOffset = 0;
    currentSource.start(0);
    isPlaying = true;
    dom.playPauseBtn.textContent = '⏸';
    tickSeekBar();
}

function pauseAudio() {
    if (!isPlaying || !currentSource) return;
    playOffset += audioContext.currentTime - playStartTime;
    currentSource.stop();
    currentSource = null;
    isPlaying = false;
    dom.playPauseBtn.textContent = '▶';
    cancelAnimationFrame(animFrameId);
}

function stopPlayback() {
    if (currentSource) try { currentSource.stop(); } catch {}
    currentSource = null;
    isPlaying = false;
    playOffset = 0;
    dom.playPauseBtn.textContent = '▶';
    cancelAnimationFrame(animFrameId);
    dom.seekBar.value = 0;
    dom.timeDisplay.textContent = '0:00';
}

function seekTo(pct) {
    if (!currentAudioBuffer) return;
    const was = isPlaying;
    if (isPlaying) stopPlayback();
    playOffset = (pct / 100) * currentAudioBuffer.duration;
    if (was) {
        currentSource = audioContext.createBufferSource();
        currentSource.buffer = currentAudioBuffer;
        currentSource.connect(audioContext.destination);
        currentSource.onended = () => { isPlaying = false; dom.playPauseBtn.textContent = '▶'; cancelAnimationFrame(animFrameId); };
        currentSource.start(0, playOffset);
        isPlaying = true;
        playStartTime = audioContext.currentTime;
        dom.playPauseBtn.textContent = '⏸';
        tickSeekBar();
    }
}

function tickSeekBar() {
    if (!currentAudioBuffer) return;
    const elapsed = isPlaying ? (playOffset + audioContext.currentTime - playStartTime) : playOffset;
    const dur = currentAudioBuffer.duration;
    dom.seekBar.value = Math.min((elapsed / dur) * 100, 100);
    dom.timeDisplay.textContent = fmtTime(elapsed);
    if (isPlaying) animFrameId = requestAnimationFrame(tickSeekBar);
}

const fmtTime = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// --- Waveform ---
function drawWaveform(samples) {
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

        const grad = ctx.createLinearGradient(0, y1, 0, y1 + height);
        grad.addColorStop(0, 'rgba(45, 212, 191, 0.6)');
        grad.addColorStop(0.5, 'rgba(45, 212, 191, 0.9)');
        grad.addColorStop(1, 'rgba(45, 212, 191, 0.6)');
        ctx.fillStyle = grad;
        ctx.fillRect(i, y1, 1, height);
    }
}

// --- Download WAV ---
function downloadWav() {
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

// --- Event Bindings ---
dom.addSpeakerBtn.onclick = () => addSpeaker();
dom.addLineBtn.onclick = () => addScriptLine();
dom.clearScriptBtn.onclick = () => { scriptLines = []; renderScriptLines(); };
dom.loadExampleBtn.onclick = loadExample;
dom.generateBtn.onclick = generate;
dom.stopBtn.onclick = stopPlayback;
dom.downloadBtn.onclick = downloadWav;
dom.playPauseBtn.onclick = () => isPlaying ? pauseAudio() : playAudio();
dom.seekBar.oninput = e => seekTo(parseFloat(e.target.value));

// Paste modal
dom.pasteScriptBtn.addEventListener('click', e => {
    e.stopPropagation();
    dom.pasteOverlay.style.display = 'flex';
    const ta = dom.pasteTextarea;
    if (ta) { ta.value = ''; setTimeout(() => ta.focus(), 50); }
});

dom.pasteCancelBtn.addEventListener('click', e => {
    e.stopPropagation();
    dom.pasteOverlay.style.display = 'none';
});

dom.pasteParseBtn.addEventListener('click', e => {
    e.stopPropagation();
    parseAndImport();
});

dom.pasteOverlay.addEventListener('mousedown', e => {
    if (e.target === dom.pasteOverlay) dom.pasteOverlay.style.display = 'none';
});

// Ctrl+Enter in paste textarea triggers import — bind via delegation
document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && e.target.id === 'pasteTextarea') {
        e.preventDefault();
        parseAndImport();
    }
});

// Engine selector
document.addEventListener('click', e => {
    const btn = e.target.closest('.engine-btn');
    if (!btn) return;
    const engine = btn.dataset.engine;
    if (!engine || engine === currentEngine) return;

    // Update active state
    document.querySelectorAll('.engine-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // Switch engine
    currentEngine = engine;
    kokoroModel = null; // force re-download for new engine

    // Update speaker voice options for new engine
    const eng = ENGINES[engine];
    speakers.forEach((s, i) => {
        s.voice = eng.voices[i % eng.voices.length];
    });
    renderSpeakers();

    setStatus(`Switched to ${eng.name}`, 'ready');
    // Hide backend notice until model loads again
    const notice = dom.backendNotice;
    if (notice) notice.style.display = 'none';
});

// Close speaker editor portal on outside click
document.addEventListener('mousedown', e => {
    if (!openEditorId) return;
    const portal = dom.editorPortal;
    if (portal && !portal.contains(e.target) && !e.target.closest('.speaker-chip')) {
        closeEditor();
        renderSpeakers();
    }
});

// --- Init ---
addSpeaker('Alice', 'af_heart');
addSpeaker('Bob', 'am_puck');
addScriptLine(speakers[0].id, 'Hello! Welcome to NoteLM.');
addScriptLine(speakers[1].id, 'Thanks! This is pretty cool.');
setStatus('Ready', 'ready');
