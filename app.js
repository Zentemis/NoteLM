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
};

// --- Helpers ---
const setStatus = (text, state = 'ready') => {
    dom.statusText.textContent = text;
    dom.statusDot.className = 'status-dot' + (state === 'loading' ? ' loading' : state === 'error' ? ' error' : '');
};

const getSpeaker = id => speakers.find(s => s.id === id);

const voiceLabel = vid => {
    const v = VOICES[vid];
    return v ? `${v.name} · ${v.gender[0]}` : vid;
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

function renderSpeakers() {
    dom.speakersList.innerHTML = speakers.map(s => `
        <div class="speaker-chip${openEditorId === s.id ? ' active' : ''}" data-chip-id="${s.id}">
            <span class="chip-dot" style="background:${s.color}"></span>
            <span class="chip-name">${s.name}</span>
            <span class="chip-voice">${voiceLabel(s.voice)}</span>
            <button class="chip-remove" data-remove="${s.id}" title="Remove">×</button>
            ${openEditorId === s.id ? `
                <div class="speaker-editor open" onclick="event.stopPropagation()">
                    <div class="editor-field">
                        <span class="editor-label">Name</span>
                        <input class="editor-input" type="text" value="${s.name}" data-edit="name" data-id="${s.id}">
                    </div>
                    <div class="editor-field">
                        <span class="editor-label">Voice</span>
                        <select class="editor-select" data-edit="voice" data-id="${s.id}">
                            ${VOICE_KEYS.map(v => {
                                const vo = VOICES[v];
                                const sel = v === s.voice ? 'selected' : '';
                                return `<option value="${v}" ${sel}>${vo.name} (${vo.gender}, ${vo.lang})</option>`;
                            }).join('')}
                        </select>
                    </div>
                </div>
            ` : ''}
        </div>
    `).join('');

    // Bind chip click -> toggle editor
    dom.speakersList.querySelectorAll('.speaker-chip').forEach(chip => {
        chip.addEventListener('click', e => {
            // Don't toggle if clicking remove btn, editor inputs, or inside editor
            if (e.target.closest('.chip-remove') || e.target.closest('.speaker-editor')) return;
            toggleEditor(chip.dataset.chipId);
        });
    });

    // Bind remove buttons
    dom.speakersList.querySelectorAll('.chip-remove').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            removeSpeaker(btn.dataset.remove);
        });
    });

    // Bind editor inputs — update speaker on change
    dom.speakersList.querySelectorAll('.editor-input, .editor-select').forEach(el => {
        el.addEventListener('change', () => {
            const spk = getSpeaker(el.dataset.id);
            if (spk) spk[el.dataset.edit] = el.value;
            renderSpeakers();
        });
        el.addEventListener('input', () => {
            // Live update name in chip
            const spk = getSpeaker(el.dataset.id);
            if (spk && el.dataset.edit === 'name') spk.name = el.value;
        });
    });

    // Close editor on outside click
    if (openEditorId) {
        requestAnimationFrame(() => {
            const handler = e => {
                if (!e.target.closest(`[data-chip-id="${openEditorId}"]`)) {
                    openEditorId = null;
                    document.removeEventListener('click', handler);
                    renderSpeakers();
                }
            };
            document.addEventListener('click', handler);
        });
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

function parseAndImport(e) {
    if (e) e.stopPropagation();
    const raw = dom.pasteTextarea.value.trim();
    if (!raw) { setStatus('Paste some text first!', 'error'); return; }

    const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
    const parsed = [];
    const nameSet = new Set();

    for (const line of lines) {
        // Match "Name: text" pattern — require at least 2 chars for name
        const m = line.match(/^(.{2,}?)\s*:\s*(.+)$/);
        if (m) {
            parsed.push({ name: m[1].trim(), text: m[2].trim() });
            nameSet.add(m[1].trim());
        }
    }

    if (!parsed.length) {
        setStatus('No "Speaker: text" lines found. Use format: Alice: Hello!', 'error');
        return;
    }

    // Close modal first
    dom.pasteOverlay.style.display = 'none';

    // Map names -> speaker ids (reuse existing, create new)
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
        id: 'p' + Date.now() + i,
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
async function loadModel() {
    if (kokoroModel) return kokoroModel;
    dom.loadingOverlay.style.display = 'flex';
    setStatus('Loading Kokoro model…', 'loading');

    try {
        const { KokoroTTS } = await import('https://cdn.jsdelivr.net/npm/kokoro-js@latest');
        dom.loadingText.textContent = 'Initializing model…';

        kokoroModel = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
            dtype: 'fp32',
            device: 'webgpu',
            progress_callback: p => {
                if (p.status === 'progress' && p.total) {
                    const pct = Math.round((p.progress / p.total) * 100);
                    dom.modelProgressBar.style.width = pct + '%';
                    dom.modelProgressPercent.textContent = pct + '%';
                    dom.loadingText.textContent = `Downloading: ${pct}%`;
                }
            }
        });

        dom.loadingOverlay.style.display = 'none';
        setStatus('Model loaded', 'ready');
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
// Use direct onclick for reliability
dom.addSpeakerBtn.onclick = () => addSpeaker();
dom.addLineBtn.onclick = () => addScriptLine();
dom.clearScriptBtn.onclick = () => { scriptLines = []; renderScriptLines(); };
dom.loadExampleBtn.onclick = loadExample;
dom.generateBtn.onclick = generate;
dom.stopBtn.onclick = stopPlayback;
dom.downloadBtn.onclick = downloadWav;
dom.playPauseBtn.onclick = () => isPlaying ? pauseAudio() : playAudio();
dom.seekBar.oninput = e => seekTo(parseFloat(e.target.value));

// Paste modal — explicit handlers
dom.pasteScriptBtn.onclick = e => {
    e.stopPropagation();
    dom.pasteOverlay.style.display = 'flex';
    dom.pasteTextarea.value = '';
    setTimeout(() => dom.pasteTextarea.focus(), 50);
};

dom.pasteCancelBtn.onclick = e => {
    e.stopPropagation();
    dom.pasteOverlay.style.display = 'none';
};

dom.pasteParseBtn.onclick = e => {
    e.stopPropagation();
    parseAndImport();
};

// Close paste modal on backdrop click
dom.pasteOverlay.addEventListener('mousedown', e => {
    if (e.target === dom.pasteOverlay) dom.pasteOverlay.style.display = 'none';
});

// Ctrl+Enter in paste textarea triggers import
dom.pasteTextarea.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        parseAndImport();
    }
});

// --- Init ---
addSpeaker('Alice', 'af_heart');
addSpeaker('Bob', 'am_puck');
addScriptLine(speakers[0].id, 'Hello! Welcome to NoteLM.');
addScriptLine(speakers[1].id, 'Thanks! This is pretty cool.');
setStatus('Ready', 'ready');
