// ============================================
// NoteLM — Shared State & DOM References
// ============================================

import { VOICES, VOICE_KEYS, CONFIG } from './config.js';

// ===== State =====
export let speakers = [];
export let scriptLines = [];
export let isGenerating = false;
export let audioContext = null;
export let currentAudioBuffer = null;
export let currentSource = null;
export let isPlaying = false;
export let playStartTime = 0;
export let playOffset = 0;
export let animFrameId = null;
export let openEditorId = null;
export let detectedDevice = null;
export let kokoroModel = null;

// ===== DOM =====
const $ = s => document.querySelector(s);
export const dom = {
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
  loadingOverlay:  $('#loadingOverlay'),
  modelProgressBar:    $('#modelProgressBar'),
  modelProgressPercent: $('#modelProgressPercent'),
  loadingText:     $('#loadingText'),
  statusDot:       $('#statusDot'),
  statusText:      $('#statusText'),
  get pasteTextarea() { return $('#pasteTextarea'); },
  get editorPortal()  { return $('#speakerEditorPortal'); },
  get backendNotice() { return $('#backendNotice'); },
  get backendNoticeText() { return $('#backendNoticeText'); },
};

// ===== Helpers =====
export const generateId = prefix => prefix + Date.now() + Math.random().toString(36).slice(2, 5);

export const setStatus = (text, state = 'ready') => {
  dom.statusText.textContent = text;
  dom.statusDot.className = 'status-dot' + (state === 'loading' ? ' loading' : state === 'error' ? ' error' : '');
};

export const getSpeaker = id => speakers.find(s => s.id === id);
export const voiceLabel = vid => { const v = VOICES[vid]; return v ? `${v.name} (${v.gender[0]})` : vid; };
export const fmtTime = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// Mutable setters (needed because ES module exports are live bindings but
// reassigning a primitive export inside the module doesn't propagate).
export const setSpeakers = val => { speakers.length = 0; speakers.push(...val); };
export const setScriptLines = val => { scriptLines.length = 0; scriptLines.push(...val); };
export const setIsGenerating = val => { isGenerating = val; };
export const setAudioContext = val => { audioContext = val; };
export const setCurrentAudioBuffer = val => { currentAudioBuffer = val; };
export const setCurrentSource = val => { currentSource = val; };
export const setIsPlaying = val => { isPlaying = val; };
export const setPlayStartTime = val => { playStartTime = val; };
export const setPlayOffset = val => { playOffset = val; };
export const setAnimFrameId = val => { animFrameId = val; };
export const setOpenEditorId = val => { openEditorId = val; };
export const setDetectedDevice = val => { detectedDevice = val; };
export const setKokoroModel = val => { kokoroModel = val; };