// Festive sound for the booth, synthesized live with the Web Audio API, so there are no audio files to license.
// The music is arranged from three public-domain carols: Jingle Bells, We Wish You a Merry Christmas and Deck the Halls.
//
// Browsers only allow sound after someone taps, clicks or presses a key on the page. Until then everything here
// is silent; the kiosk unlocks on the first guest's tap, and the TVs show a "Click for sound" button for staff.

const AudioCtx = window.AudioContext || window.webkitAudioContext;
const MASTER_LEVEL = 0.9;
const MUSIC_LEVEL = 0.32;
const SFX_LEVEL = 0.75;

let ctx = null;
let master, sfxBus, musicBus, noiseBuf;
let prefs = { sound: true, music: true };
let prefKey = "sw-sound";
let musicWanted = false;
let musicOpts = {};
let music = null;
const listeners = new Set();

// ---- Setup, unlocking and the on-screen toggles ------------------------------------------

/**
 * Turns sound on for a page and adds its controls.
 * @param page         name used to remember this screen's settings
 * @param mount        element to put a single mute button in (kiosk); omit for the TV corner controls
 * @param musicButton  show a separate music toggle (TV corner controls only)
 */
export function setUpSound({ page, mount = null, musicButton = false }) {
  prefKey = `sw-sound-${page}`;
  try { prefs = { ...prefs, ...JSON.parse(localStorage.getItem(prefKey) || "{}") }; } catch { /* private mode */ }
  if (!AudioCtx) return;

  for (const type of ["pointerdown", "touchend", "click", "keydown"]) {
    addEventListener(type, unlock, { capture: true, passive: true });
  }

  const box = document.createElement("div");
  box.className = mount ? "sound-ctl sound-ctl-inline" : "sound-ctl";
  (mount || document.body).appendChild(box);
  const render = () => {
    box.classList.toggle("locked", !mount && !running());
    if (!mount && !running()) {
      box.innerHTML = `<button type="button" class="sound-unlock">🔈 Click anywhere for sound${musicButton ? " &amp; music" : ""}</button>`;
      return;
    }
    box.innerHTML =
      `<button type="button" class="sound-btn${prefs.sound ? "" : " off"}" data-pref="sound" aria-pressed="${prefs.sound}"
         aria-label="Sound" title="Sound ${prefs.sound ? "on" : "off"}${mount ? "" : " (S)"}">${prefs.sound ? "🔊" : "🔇"}</button>` +
      (musicButton
        ? `<button type="button" class="sound-btn${prefs.music ? "" : " off"}" data-pref="music" aria-pressed="${prefs.music}"
             aria-label="Music" title="Music ${prefs.music ? "on" : "off"} (M)">🎵</button>`
        : "");
  };
  box.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-pref]");
    if (btn) toggle(btn.dataset.pref);
  });
  if (!mount) {
    addEventListener("keydown", (e) => {
      if (e.key === "s" || e.key === "S") toggle("sound");
      if ((e.key === "m" || e.key === "M") && musicButton) toggle("music");
    });
  }
  listeners.add(render);
  render();
}

function ensure() {
  if (ctx || !AudioCtx) return ctx;
  ctx = new AudioCtx();
  const limiter = ctx.createDynamicsCompressor(); // keeps stacked sounds from clipping
  master = ctx.createGain();
  master.gain.value = prefs.sound ? MASTER_LEVEL : 0;
  master.connect(limiter).connect(ctx.destination);
  sfxBus = ctx.createGain();
  sfxBus.gain.value = SFX_LEVEL;
  sfxBus.connect(master);
  musicBus = ctx.createGain();
  musicBus.gain.value = prefs.music ? MUSIC_LEVEL : 0;
  musicBus.connect(master);
  ctx.onstatechange = notify;
  return ctx;
}

function unlock() {
  if (!ensure()) return;
  if (ctx.state !== "running") ctx.resume().then(notify, () => {});
}

const running = () => !!ctx && ctx.state === "running";
const audible = () => running() && prefs.sound;

function notify() {
  for (const fn of listeners) fn();
  syncMusic();
}

function toggle(name) {
  prefs[name] = !prefs[name];
  try { localStorage.setItem(prefKey, JSON.stringify(prefs)); } catch { /* private mode */ }
  if (ctx) {
    const now = ctx.currentTime;
    master.gain.setTargetAtTime(prefs.sound ? MASTER_LEVEL : 0, now, 0.05);
    musicBus.gain.cancelScheduledValues(now);
    musicBus.gain.setTargetAtTime(prefs.music ? MUSIC_LEVEL : 0, now, 0.05);
  }
  notify();
}

/** Turns the music down while sound effects play, then brings it back. */
function duck(seconds) {
  if (!ctx || !prefs.music) return;
  const g = musicBus.gain, now = ctx.currentTime;
  g.cancelScheduledValues(now);
  g.setValueAtTime(g.value, now);
  g.linearRampToValueAtTime(MUSIC_LEVEL * 0.3, now + 0.15);
  g.setValueAtTime(MUSIC_LEVEL * 0.3, now + seconds);
  g.linearRampToValueAtTime(MUSIC_LEVEL, now + seconds + 0.8);
}

// ---- Synth building blocks ------------------------------------------------------------------

function envelope(param, t, attack, peak, decay) {
  param.setValueAtTime(0.0001, t);
  param.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack);
  param.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

function tone(type, freq, t, dur, peak, { to, attack = 0.005, out = sfxBus, filter } = {}) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  envelope(g.gain, t, attack, peak, dur);
  let node = o;
  if (filter) {
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = filter;
    node = node.connect(f);
  }
  node.connect(g).connect(out);
  o.start(t);
  o.stop(t + attack + dur + 0.05);
  return o;
}

function noise(t, dur, peak, { type = "bandpass", freq = 1000, to, q = 1, attack = 0.003, out = sfxBus } = {}) {
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, t);
  if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
  f.Q.value = q;
  const g = ctx.createGain();
  envelope(g.gain, t, attack, peak, dur);
  src.connect(f).connect(g).connect(out);
  src.start(t, Math.random() * 0.9);
  src.stop(t + attack + dur + 0.05);
}

/** A struck bell: a few inharmonic partials that die away at different rates. */
function bell(freq, t, dur, peak, out = sfxBus) {
  [[1, 1], [2, 0.45], [2.76, 0.3], [5.4, 0.14], [8.93, 0.06]].forEach(([ratio, amp], i) => {
    tone("sine", freq * ratio, t, dur / (1 + i * 0.7), peak * amp, { attack: 0.002, out });
  });
}

function sleighShake(t, length, peak = 0.12, out = sfxBus) {
  for (let i = 0; i < length / 0.055; i++) {
    const at = t + i * 0.055 + Math.random() * 0.02;
    noise(at, 0.07, peak * (0.6 + Math.random() * 0.4), { type: "bandpass", freq: 6500 + Math.random() * 2500, q: 2, out });
    tone("sine", 2400 + Math.random() * 1600, at, 0.05, peak * 0.15, { out });
  }
}

// ---- Sound effects --------------------------------------------------------------------------

const FX = {
  tap: (t) => bell(1568, t, 0.35, 0.09),
  micOn: (t) => tone("sine", 620, t, 0.12, 0.14, { to: 940 }),
  micOff: (t) => tone("sine", 940, t, 0.12, 0.14, { to: 620 }),
  send: (t) => {
    sleighShake(t, 0.7);
    noise(t, 0.7, 0.14, { freq: 350, to: 3200, q: 1.4, attack: 0.08 });
  },
  fanfare: (t) => {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      tone("triangle", f, t + i * 0.1, 0.5, 0.16);
      tone("sine", f * 2, t + i * 0.1, 0.3, 0.05);
    });
    bell(2093, t + 0.4, 1.6, 0.13);
    sleighShake(t + 0.4, 0.9, 0.1);
  },
  naughty: (t) => {
    // Sad trombone: wah, wah, wah, wahhhh.
    [[392, 0.34], [370, 0.34], [349.2, 0.34], [329.6, 1.1]].reduce((at, [f, d], i) => {
      const o = tone("sawtooth", f, at, d, 0.18, { attack: 0.04, filter: 1100 });
      if (i === 3) {
        const lfo = ctx.createOscillator(), depth = ctx.createGain();
        lfo.frequency.value = 6;
        depth.gain.value = 30;
        lfo.connect(depth).connect(o.detune);
        lfo.start(at); lfo.stop(at + d + 0.1);
      }
      return at + d;
    }, t);
  },
  oops: (t) => {
    tone("sine", 220, t, 0.4, 0.3, { to: 55 });
    noise(t, 0.08, 0.1, { type: "lowpass", freq: 600 });
  },
  odometer: (t) => {
    // Wheels clicking over, slowing down, then the till.
    let at = t;
    for (let i = 0; i < 18; i++) {
      noise(at, 0.02, 0.16, { type: "highpass", freq: 3500 });
      tone("square", 1900, at, 0.015, 0.03);
      at += 0.04 + i * 0.006;
    }
    FX.chaching(at + 0.05);
  },
  chaching: (t) => {
    noise(t, 0.06, 0.22, { freq: 3000, q: 3 });
    bell(1318.5, t + 0.06, 0.9, 0.14);
    bell(1760, t + 0.18, 1.2, 0.14);
  },
  freeTime: (t) => {
    [1568, 1975.5, 2349.3, 3136].forEach((f, i) => bell(f, t + i * 0.07, 0.7, 0.08));
  },
};

// Each machine part makes one of these noises when the machine starts up.
const PART_FX = {
  whoosh: (t) => noise(t, 0.45, 0.22, { freq: 300, to: 2600, q: 1.5, attack: 0.06 }),
  zap: (t) => {
    for (let i = 0; i < 5; i++) noise(t + i * 0.05, 0.04, 0.2, { type: "highpass", freq: 2500 + Math.random() * 3000 });
    tone("sawtooth", 90, t, 0.3, 0.1, { to: 140, filter: 2200 });
  },
  bleep: (t) => {
    for (let i = 0; i < 4; i++) tone("square", 650 + Math.floor(Math.random() * 5) * 220, t + i * 0.075, 0.05, 0.06, { filter: 3500 });
  },
  ratchet: (t) => {
    for (let i = 0; i < 7; i++) {
      noise(t + i * 0.045, 0.025, 0.22, { freq: 2200, q: 6 });
      tone("square", 160, t + i * 0.045, 0.02, 0.04, { filter: 900 });
    }
  },
  clank: (t) => {
    noise(t, 0.12, 0.25, { freq: 2600, q: 9 });
    tone("triangle", 180, t, 0.18, 0.18, { to: 120 });
    bell(940, t, 0.3, 0.04);
  },
  thump: (t) => {
    tone("sine", 140, t, 0.2, 0.4, { to: 48 });
    noise(t, 0.08, 0.15, { type: "lowpass", freq: 900 });
    noise(t + 0.18, 0.04, 0.12, { freq: 3000, q: 4 });
  },
  ding: (t) => bell(1046.5, t, 1.1, 0.16),
  blub: (t) => {
    for (let i = 0; i < 4; i++) tone("sine", 260 + i * 90, t + i * 0.08, 0.08, 0.14, { to: 700 + i * 120 });
  },
  sparkle: (t) => [2093, 2637, 3136, 2637, 3520].forEach((f, i) => bell(f, t + i * 0.05, 0.4, 0.05)),
  boing: (t) => {
    const o = tone("triangle", 160, t, 0.45, 0.22, { to: 420 });
    const lfo = ctx.createOscillator(), depth = ctx.createGain();
    lfo.frequency.value = 14;
    depth.gain.value = 60;
    lfo.connect(depth).connect(o.detune);
    lfo.start(t); lfo.stop(t + 0.5);
  },
  servo: (t) => {
    tone("sawtooth", 260, t, 0.32, 0.07, { to: 520, filter: 1600 });
    tone("sawtooth", 263, t, 0.32, 0.05, { to: 525, filter: 1600 });
  },
  grind: (t) => {
    tone("sawtooth", 70, t, 0.42, 0.14, { to: 95, filter: 900 });
    noise(t, 0.42, 0.12, { freq: 1200, q: 2 });
  },
};

const PART_SOUND = {
  hopper: "whoosh", magnet: "zap", scanner: "bleep", brain: "bleep", gears: "ratchet", sorter: "clank",
  "robot-arm": "servo", conveyor: "ratchet", stamp: "thump", tank: "blub", bell: "ding", antenna: "zap",
  printer: "thump", "gift-wrapper": "sparkle", chimney: "whoosh", rocket: "whoosh", shredder: "grind",
  mailbox: "ding", calculator: "bleep", clock: "ratchet", "crystal-ball": "sparkle", lightbulb: "zap",
  "elf-wheel": "ratchet", catapult: "boing", crane: "servo", vacuum: "whoosh", "filing-cabinet": "clank",
  "tesla-coil": "zap", telescope: "bleep", chatbot: "bleep", "helper-bot": "bleep", spreadsheet: "bleep", vault: "ratchet",
};

/** Plays a named sound effect now. */
export function sfx(name, delay = 0) {
  if (!audible() || !FX[name]) return;
  const t = ctx.currentTime + 0.02 + delay;
  FX[name](t);
  if (name === "fanfare" || name === "odometer" || name === "naughty") duck(2.2);
}

/**
 * Starts the machine: each part, left to right, lights up and makes its noise, then out pops the free time.
 * The glow happens even with the sound off.
 */
export function startMachine(kinds, svg, { delay = 0.5, gap = 0.45 } = {}) {
  const parts = svg ? [...svg.querySelectorAll(".bp-part")] : [];
  kinds.forEach((kind, i) => {
    const at = delay + i * gap;
    const el = parts[i];
    if (el) {
      setTimeout(() => {
        el.classList.add("bp-on");
        setTimeout(() => el.classList.remove("bp-on"), 650);
      }, at * 1000);
    }
    if (audible()) (PART_FX[PART_SOUND[kind]] || PART_FX.clank)(ctx.currentTime + at);
  });
  if (audible()) {
    FX.freeTime(ctx.currentTime + delay + kinds.length * gap);
    duck(delay + kinds.length * gap + 1);
  }
}

// ---- Music ----------------------------------------------------------------------------------

// Melodies as "note:beats" (R = rest), and one chord per bar for the bass and the off-beat chords.
const SONGS = {
  jingle: {
    bpm: 176, beatsPerBar: 4, pickup: 0,
    melody: `E4:1 E4:1 E4:2  E4:1 E4:1 E4:2  E4:1 G4:1 C4:1.5 D4:.5  E4:4
             F4:1 F4:1 F4:1.5 F4:.5  F4:1 E4:1 E4:1 E4:.5 E4:.5  E4:1 D4:1 D4:1 E4:1  D4:2 G4:2
             E4:1 E4:1 E4:2  E4:1 E4:1 E4:2  E4:1 G4:1 C4:1.5 D4:.5  E4:4
             F4:1 F4:1 F4:1.5 F4:.5  F4:1 E4:1 E4:1 E4:.5 E4:.5  G4:1 G4:1 F4:1 D4:1  C4:4`,
    chords: "C C C C F C D G C C C C F C G C",
  },
  wish: {
    bpm: 150, beatsPerBar: 3, pickup: 1,
    melody: `D4:1  G4:1 G4:.5 A4:.5 G4:.5 F#4:.5  E4:1 E4:1 E4:1  A4:1 A4:.5 B4:.5 A4:.5 G4:.5  F#4:1 D4:1 D4:1
             B4:1 B4:.5 C5:.5 B4:.5 A4:.5  G4:1 E4:1 D4:.5 D4:.5  E4:1 A4:1 F#4:1  G4:2 R:1`,
    chords: "G C A D B Em C G",
  },
  deck: {
    bpm: 132, beatsPerBar: 4, pickup: 0,
    melody: `G4:1.5 F4:.5 E4:1 D4:1  C4:1 D4:1 E4:1 C4:1  D4:.5 E4:.5 F4:.5 D4:.5 E4:1.5 D4:.5  C4:1 B3:1 C4:2
             G4:1.5 F4:.5 E4:1 D4:1  C4:1 D4:1 E4:1 C4:1  D4:.5 E4:.5 F4:.5 D4:.5 E4:1.5 D4:.5  C4:1 B3:1 C4:2
             D4:1.5 E4:.5 F4:1 D4:1  E4:1.5 F4:.5 G4:1 D4:1  E4:.5 F#4:.5 G4:1 A4:.5 B4:.5 C5:1  B4:1 A4:1 G4:2
             G4:1.5 F4:.5 E4:1 D4:1  C4:1 D4:1 E4:1 C4:1  A4:.5 A4:.5 A4:.5 A4:.5 G4:1.5 F4:.5  E4:1 D4:1 C4:2`,
    chords: "C C G C C C G C G C D G C C F C",
  },
};

const SEMITONE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function midi(name) {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(name);
  return 12 * (Number(m[3]) + 1) + SEMITONE[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);
}

const hz = (n) => 440 * 2 ** ((n - 69) / 12);

function buildSong(song, tempo) {
  const spb = 60 / (song.bpm * tempo);
  const events = [];
  let beat = 0;
  for (const token of song.melody.trim().split(/\s+/)) {
    const [note, beats] = token.split(":");
    if (note !== "R") events.push({ at: beat * spb, play: "melody", freq: hz(midi(note) + 12), dur: Number(beats) * spb });
    beat += Number(beats);
  }
  song.chords.split(" ").forEach((chord, bar) => {
    const start = (song.pickup + bar * song.beatsPerBar) * spb;
    const root = SEMITONE[chord[0]];
    const triad = chord.endsWith("m") ? [0, 3, 7] : [0, 4, 7];
    events.push({ at: start, play: "bass", freq: hz(36 + root), dur: spb * 1.6 });
    if (song.beatsPerBar === 4) events.push({ at: start + 2 * spb, play: "bass", freq: hz(43 + root), dur: spb * 1.6 });
    const offBeats = song.beatsPerBar === 4 ? [1, 3] : [1, 2];
    for (const b of offBeats) {
      for (const step of triad) events.push({ at: start + b * spb, play: "chord", freq: hz(60 + root + step), dur: spb * 0.5 });
    }
  });
  for (let b = 0; b < beat; b += 0.5) events.push({ at: b * spb, play: "bells", accent: b % 1 === 0 });
  events.sort((a, b) => a.at - b.at);
  return { events, length: beat * spb };
}

function playEvent(ev, t, out) {
  switch (ev.play) {
    case "melody": { // music box
      const ring = Math.min(1.6, Math.max(0.5, ev.dur * 1.8));
      tone("sine", ev.freq, t, ring, 0.24, { attack: 0.004, out });
      tone("sine", ev.freq * 2, t, ring * 0.45, 0.07, { attack: 0.003, out });
      tone("triangle", ev.freq * 4, t, 0.1, 0.02, { attack: 0.002, out });
      break;
    }
    case "bass":
      tone("triangle", ev.freq, t, ev.dur, 0.26, { attack: 0.01, out });
      break;
    case "chord":
      tone("triangle", ev.freq, t, ev.dur, 0.035, { attack: 0.006, out });
      break;
    case "bells":
      noise(t, 0.06, ev.accent ? 0.07 : 0.035, { type: "bandpass", freq: 7500, q: 1.8, out });
      break;
  }
}

/** Plays music for as long as the page wants it (and the music setting is on). */
export function startMusic({ playlist = ["jingle", "wish", "deck"], tempo = 1 } = {}) {
  musicWanted = true;
  musicOpts = { playlist, tempo };
  ensure();
  syncMusic();
}

export function stopMusic(fade = 0.8) {
  musicWanted = false;
  syncMusic(fade);
}

function syncMusic(fade = 0.8) {
  const want = musicWanted && prefs.music && prefs.sound && running();
  if (want && !music) beginMusic();
  else if (!want && music) endMusic(fade);
}

function beginMusic() {
  const out = ctx.createGain();
  out.gain.setValueAtTime(0.0001, ctx.currentTime);
  out.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 1.2);
  out.connect(musicBus);
  const { playlist, tempo } = musicOpts;
  const first = buildSong(SONGS[playlist[0]], tempo);
  music = { out, playlist, tempo, index: 0, song: first, next: 0, start: ctx.currentTime + 0.15 };
  music.timer = setInterval(pump, 100);
  pump();
}

function pump() {
  if (!music) return;
  const horizon = ctx.currentTime + 0.6;
  for (;;) {
    if (music.next >= music.song.events.length) {
      // One bar of breathing room, then the next carol.
      music.start += music.song.length + 60 / (SONGS[music.playlist[music.index]].bpm * music.tempo) * 2;
      music.index = (music.index + 1) % music.playlist.length;
      music.song = buildSong(SONGS[music.playlist[music.index]], music.tempo);
      music.next = 0;
    }
    const ev = music.song.events[music.next];
    const t = music.start + ev.at;
    if (t > horizon) break;
    if (t >= ctx.currentTime - 0.02) playEvent(ev, t, music.out);
    music.next++;
  }
}

function endMusic(fade) {
  const { out, timer } = music;
  music = null;
  clearInterval(timer);
  const now = ctx.currentTime;
  out.gain.cancelScheduledValues(now);
  out.gain.setValueAtTime(Math.max(out.gain.value, 0.0001), now);
  out.gain.exponentialRampToValueAtTime(0.0001, now + fade);
  setTimeout(() => out.disconnect(), fade * 1000 + 300);
}
