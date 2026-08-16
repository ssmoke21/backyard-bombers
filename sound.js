/* ==========================================================================
   BACKYARD BOMBERS - SOUND
   --------------------------------------------------------------------------
   Every noise in the game is built out of thin air with the Web Audio API.
   There are no sound files anywhere. If something is too loud, change its
   `vol` number below. If everything is too loud, change SOUND.volume.
   ========================================================================== */

const SOUND = {
  enabled: true,
  volume: 0.55,           // master volume, 0 to 1
  key: "backyardBombers.sound",
};

try {
  const stored = localStorage.getItem(SOUND.key);
  if (stored !== null) SOUND.enabled = stored === "on";
} catch (e) { }

function setSound(on) {
  SOUND.enabled = on;
  try { localStorage.setItem(SOUND.key, on ? "on" : "off"); } catch (e) { }
}


/* ---- Plumbing ------------------------------------------------------------ */

let AC = null;
let masterGain = null;
let noiseBuf = null;

function ac() {
  if (!SOUND.enabled) return null;
  if (!AC) {
    try {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = AC.createGain();
      masterGain.gain.value = SOUND.volume;
      masterGain.connect(AC.destination);
    } catch (e) { return null; }
  }
  if (AC.state === "suspended") { try { AC.resume(); } catch (e) { } }
  if (masterGain) masterGain.gain.value = SOUND.volume;
  return AC;
}

// Browsers won't let sound start until the player touches something.
function wakeAudio() { ac(); }

function noise(a) {
  if (!noiseBuf) {
    const len = Math.floor(a.sampleRate * 1.2);
    noiseBuf = a.createBuffer(1, len, a.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = a.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  return src;
}

// A single pitched blip.
function tone(o) {
  const a = ac();
  if (!a) return;
  try {
    const t = a.currentTime + (o.delay || 0);
    const osc = a.createOscillator();
    const g = a.createGain();
    osc.type = o.type || "square";
    osc.frequency.setValueAtTime(o.freq, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.to), t + o.dur);
    const peak = o.vol === undefined ? 0.15 : o.vol;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + (o.attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    osc.connect(g).connect(masterGain);
    osc.start(t);
    osc.stop(t + o.dur + 0.02);
  } catch (e) { }
}

// A burst of filtered noise. This is where all the thumps and cracks come from.
function hiss(o) {
  const a = ac();
  if (!a) return;
  try {
    const t = a.currentTime + (o.delay || 0);
    const src = noise(a);
    const f = a.createBiquadFilter();
    f.type = o.filter || "bandpass";
    f.frequency.setValueAtTime(o.freq, t);
    if (o.to) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + o.dur);
    f.Q.value = o.q === undefined ? 1 : o.q;
    const g = a.createGain();
    const peak = o.vol === undefined ? 0.15 : o.vol;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + (o.attack || 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    src.connect(f).connect(g).connect(masterGain);
    src.start(t);
    src.stop(t + o.dur + 0.02);
  } catch (e) { }
}


/* ---- The actual noises --------------------------------------------------- */

const sfx = {

  click: function () {
    tone({ freq: 640, to: 900, dur: 0.06, type: "square", vol: 0.07 });
  },

  // The pitcher lets go
  pitchThrow: function () {
    hiss({ freq: 900, to: 2600, dur: 0.20, q: 1.2, vol: 0.09 });
  },

  // Swung and missed
  whiff: function () {
    hiss({ freq: 2400, to: 400, dur: 0.26, q: 0.8, vol: 0.10 });
    tone({ freq: 160, to: 70, dur: 0.16, type: "sine", vol: 0.05, delay: 0.04 });
  },

  // Watched it go by
  strike: function () {
    tone({ freq: 300, to: 150, dur: 0.20, type: "triangle", vol: 0.08 });
    hiss({ freq: 500, dur: 0.10, q: 3, vol: 0.06, delay: 0.10 });
  },

  // Bat meets ball. Every bat sounds like the thing it is.
  hit: function (batId, sweet, power) {
    const v = 0.10 + 0.12 * clamp01(power);
    switch (batId) {
      case "noodle":                                   // a sad foam boing
        tone({ freq: 420, to: 90, dur: 0.34, type: "sine", vol: v * 1.1 });
        tone({ freq: 300, to: 70, dur: 0.30, type: "triangle", vol: v * 0.5, delay: 0.02 });
        break;
      case "banana":                                   // wet slap
        hiss({ freq: 380, to: 120, dur: 0.20, filter: "lowpass", q: 1, vol: v * 1.5 });
        tone({ freq: 200, to: 60, dur: 0.16, type: "sine", vol: v * 0.7 });
        break;
      case "fryingPan":                                // CLANG
        tone({ freq: 1720, to: 900, dur: 0.55, type: "square", vol: v * 0.8 });
        tone({ freq: 2310, to: 1180, dur: 0.48, type: "square", vol: v * 0.5, delay: 0.005 });
        tone({ freq: 640, to: 300, dur: 0.60, type: "triangle", vol: v * 0.6 });
        hiss({ freq: 3600, dur: 0.12, q: 2, vol: v * 0.4 });
        break;
      case "baguette":                                 // crusty crunch
        hiss({ freq: 2200, to: 700, dur: 0.22, q: 0.9, vol: v * 1.3 });
        tone({ freq: 240, to: 90, dur: 0.18, type: "square", vol: v * 0.7 });
        break;
      case "frozenFish":                               // heavy cold slap
        hiss({ freq: 260, to: 90, dur: 0.26, filter: "lowpass", vol: v * 1.6 });
        tone({ freq: 130, to: 50, dur: 0.22, type: "sine", vol: v * 0.9 });
        break;
      default:                                         // honest wooden crack
        hiss({ freq: 2000, to: 600, dur: 0.09, q: 1.4, vol: v * 1.2 });
        tone({ freq: 420, to: 150, dur: 0.14, type: "square", vol: v * 0.8 });
        tone({ freq: 900, to: 320, dur: 0.09, type: "triangle", vol: v * 0.5 });
    }
    if (sweet) sfx.sweet();
  },

  // The extra sparkle on a perfectly timed swing
  sweet: function () {
    tone({ freq: 1050, to: 1600, dur: 0.10, type: "triangle", vol: 0.11, delay: 0.02 });
    tone({ freq: 1570, to: 2100, dur: 0.12, type: "triangle", vol: 0.09, delay: 0.09 });
    tone({ freq: 2100, to: 2650, dur: 0.16, type: "sine", vol: 0.08, delay: 0.16 });
  },

  // Ball comes down
  land: function (dist) {
    if (dist <= 0) return;
    hiss({ freq: 200 + Math.min(400, dist), to: 80, dur: 0.18, filter: "lowpass", vol: 0.10 });
    tone({ freq: 90, to: 45, dur: 0.20, type: "sine", vol: 0.08 });
  },

  // A backyard crowd. Noise + a few voices, scaled by how good the hit was.
  crowd: function (intensity) {
    const i = clamp01(intensity);
    if (i <= 0.02) return;
    const dur = 0.5 + i * 1.5;
    hiss({ freq: 700 + i * 700, dur: dur, q: 0.5, vol: 0.05 + i * 0.13, attack: 0.10 + (1 - i) * 0.2 });
    const voices = Math.round(1 + i * 4);
    for (let n = 0; n < voices; n++) {
      const base = 260 + Math.random() * 420;
      tone({
        freq: base, to: base * (1 + i * 0.8), dur: 0.30 + Math.random() * 0.5,
        type: "sawtooth", vol: 0.015 + i * 0.030, attack: 0.08,
        delay: 0.05 + Math.random() * 0.35,
      });
    }
  },

  // The polite "ohhh" when you dribble one
  groan: function () {
    tone({ freq: 300, to: 180, dur: 0.55, type: "sawtooth", vol: 0.045, attack: 0.12 });
    tone({ freq: 240, to: 140, dur: 0.60, type: "sawtooth", vol: 0.035, attack: 0.15, delay: 0.05 });
    hiss({ freq: 500, dur: 0.5, q: 0.6, vol: 0.03, attack: 0.2 });
  },

  // Uncle Matt
  siren: function () {
    for (let i = 0; i < 4; i++) {
      tone({ freq: 760, to: 460, dur: 0.30, type: "sawtooth", vol: 0.075, delay: i * 0.32 });
      tone({ freq: 470, to: 780, dur: 0.30, type: "sawtooth", vol: 0.075, delay: i * 0.32 + 0.16 });
    }
  },

  bark: function () {
    tone({ freq: 420, to: 180, dur: 0.10, type: "sawtooth", vol: 0.13 });
    tone({ freq: 300, to: 120, dur: 0.14, type: "square", vol: 0.09, delay: 0.11 });
  },

  unlock: function () {
    [523, 659, 784, 1047].forEach(function (f, i) {
      tone({ freq: f, dur: 0.28, type: "triangle", vol: 0.11, delay: i * 0.10 });
    });
  },

  win: function () {
    [523, 659, 784, 1047, 1319].forEach(function (f, i) {
      tone({ freq: f, dur: 0.35, type: "square", vol: 0.09, delay: i * 0.11 });
    });
    sfx.crowd(1);
  },

  lose: function () {
    [440, 392, 330, 262].forEach(function (f, i) {
      tone({ freq: f, dur: 0.32, type: "triangle", vol: 0.09, delay: i * 0.13 });
    });
  },
};

function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }
