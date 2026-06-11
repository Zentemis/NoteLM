// ============================================
// NoteLM — Configuration & Constants
// ============================================

export const LANGUAGES = {
  'en-us':  { name: 'English (US)', code: 'US' },
  'en-gb':  { name: 'English (UK)', code: 'UK' },
  'ja':     { name: 'Japanese', code: 'JA' },
  'zh':     { name: 'Mandarin', code: 'ZH' },
  'es':     { name: 'Spanish', code: 'ES' },
  'fr-fr':  { name: 'French', code: 'FR' },
  'hi':     { name: 'Hindi', code: 'HI' },
  'it':     { name: 'Italian', code: 'IT' },
  'pt-br':  { name: 'Portuguese', code: 'PT' },
};

export const CONFIG = {
  voices: {
    // English (US)
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

    // English (UK)
    bf_emma:     { name: 'Emma',     lang: 'en-gb', gender: 'Female' },
    bf_isabella: { name: 'Isabella', lang: 'en-gb', gender: 'Female' },
    bf_alice:    { name: 'Alice',    lang: 'en-gb', gender: 'Female' },
    bf_lily:     { name: 'Lily',     lang: 'en-gb', gender: 'Female' },
    bm_george:   { name: 'George',   lang: 'en-gb', gender: 'Male'   },
    bm_lewis:    { name: 'Lewis',    lang: 'en-gb', gender: 'Male'   },
    bm_daniel:   { name: 'Daniel',   lang: 'en-gb', gender: 'Male'   },
    bm_fable:    { name: 'Fable',    lang: 'en-gb', gender: 'Male'   },

    // Japanese
    jf_alpha:    { name: 'Alpha',     lang: 'ja',    gender: 'Female' },
    jf_gongitsune: { name: 'Gongitsune', lang: 'ja', gender: 'Female' },
    jf_nezumi:   { name: 'Nezumi',   lang: 'ja',    gender: 'Female' },
    jf_tebukuro: { name: 'Tebukuro', lang: 'ja',    gender: 'Female' },
    jm_kumo:     { name: 'Kumo',     lang: 'ja',    gender: 'Male'   },

    // Mandarin Chinese
    zf_xiaobei:  { name: 'Xiaobei',  lang: 'zh',    gender: 'Female' },
    zf_xiaoni:   { name: 'Xiaoni',   lang: 'zh',    gender: 'Female' },
    zf_xiaoxiao: { name: 'Xiaoxiao', lang: 'zh',    gender: 'Female' },
    zf_xiaoyi:   { name: 'Xiaoyi',   lang: 'zh',    gender: 'Female' },
    zm_yunjian:  { name: 'Yunjian',  lang: 'zh',    gender: 'Male'   },
    zm_yunxi:    { name: 'Yunxi',    lang: 'zh',    gender: 'Male'   },
    zm_yunxia:   { name: 'Yunxia',   lang: 'zh',    gender: 'Male'   },
    zm_yunyang:  { name: 'Yunyang',  lang: 'zh',    gender: 'Male'   },

    // Spanish
    ef_dora:     { name: 'Dora',     lang: 'es',    gender: 'Female' },
    em_alex:     { name: 'Alex',     lang: 'es',    gender: 'Male'   },
    em_santa:    { name: 'Santa',    lang: 'es',    gender: 'Male'   },

    // French
    ff_siwis:    { name: 'Siwis',    lang: 'fr-fr', gender: 'Female' },

    // Hindi
    hf_alpha:    { name: 'Alpha',    lang: 'hi',    gender: 'Female' },
    hf_beta:     { name: 'Beta',     lang: 'hi',    gender: 'Female' },
    hm_omega:    { name: 'Omega',    lang: 'hi',    gender: 'Male'   },
    hm_psi:      { name: 'Psi',      lang: 'hi',    gender: 'Male'   },

    // Italian
    if_sara:     { name: 'Sara',     lang: 'it',    gender: 'Female' },
    im_nicola:   { name: 'Nicola',   lang: 'it',    gender: 'Male'   },

    // Portuguese (Brazil)
    pf_dora:     { name: 'Dora',     lang: 'pt-br', gender: 'Female' },
    pm_alex:     { name: 'Alex',     lang: 'pt-br', gender: 'Male'   },
    pm_santa:    { name: 'Santa',    lang: 'pt-br', gender: 'Male'   },
  },
  colors: ['#2dd4bf','#f472b6','#fbbf24','#a78bfa','#60a5fa','#4ade80','#fb923c','#38bdf8','#e879f9','#facc15','#34d399','#f87171'],
  sampleRate: 24000,
  lineGap: 0.35,
};

export const VOICES = CONFIG.voices;
export const VOICE_KEYS = Object.keys(VOICES);
