// ============================================
// NoteLM — Configuration & Constants
// ============================================

export const CONFIG = {
  voices: {
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
  },
  colors: ['#2dd4bf','#f472b6','#fbbf24','#a78bfa','#60a5fa','#4ade80','#fb923c','#38bdf8','#e879f9','#facc15','#34d399','#f87171'],
  sampleRate: 24000,
  lineGap: 0.35,
};

export const VOICES = CONFIG.voices;
export const VOICE_KEYS = Object.keys(VOICES);