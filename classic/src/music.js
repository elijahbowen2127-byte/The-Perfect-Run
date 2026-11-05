// Procedural music: a calm lobby theme and randomized in-run fight music
// (drums + taiko + bass, a flute lead, and a soft pad underneath).
// Everything is synthesized by a small look-ahead scheduler, so no files
// load and only a handful of short-lived nodes exist at any moment.
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
// The lobby swaps in a seeded generator so the menu theme is the same song every time.
let R = Math.random;
const pick = (a) => a[(R() * a.length) | 0];
const chance = (p) => R() < p;
const seeded = (seed) => () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

const SCALES = {
  aeolian: { s: [0, 2, 3, 5, 7, 8, 10], progs: [[0, 5, 2, 6], [0, 6, 5, 6], [0, 3, 6, 5], [0, 5, 3, 4], [0, 0, 5, 6]] },
  dorian: { s: [0, 2, 3, 5, 7, 9, 10], progs: [[0, 3, 0, 6], [0, 6, 3, 0], [0, 4, 3, 6], [0, 2, 3, 6]] },
  harmonic: { s: [0, 2, 3, 5, 7, 8, 11], progs: [[0, 5, 3, 4], [0, 3, 4, 0], [0, 5, 0, 4]] },
  phrygian: { s: [0, 1, 3, 5, 7, 8, 10], progs: [[0, 1, 0, 6], [0, 6, 5, 1], [0, 1, 5, 6]] },
  phrygdom: { s: [0, 1, 4, 5, 7, 8, 10], progs: [[0, 1, 0, 6], [0, 1, 6, 0], [0, 5, 1, 0]] },
};
// One style per stage (same order as BIOMES), so every stage has its own
// sound; each run still randomizes the melody, chords and fills within it.
// All are drum-driven and much faster than the slow, drumless menu theme.
const STAGES = [
  { scales: ['harmonic'], roots: [45, 46], bpm: [112, 120], kicks: [0, 2], taikos: [0], basses: [2], taiko: 0.6, lead: 1, echo: 0.4 }, // Graveyard
  { scales: ['dorian'], roots: [50, 52], bpm: [136, 144], kicks: [1], taikos: [2], basses: [1], taiko: 0.25, lead: 2, echo: 0.25 }, // Haunted Forest
  { scales: ['phrygdom'], roots: [47, 48], bpm: [126, 134], kicks: [3], taikos: [1], basses: [3], taiko: 0.5, lead: 2, echo: 0.3 }, // Scorched Desert
  { scales: ['aeolian'], roots: [52, 49], bpm: [118, 126], kicks: [2], taikos: [0, 2], basses: [2, 0], taiko: 0.3, lead: 2, echo: 0.5 }, // Frozen
  { scales: ['phrygian'], roots: [45, 47], bpm: [148, 156], kicks: [1, 3], taikos: [1], basses: [0, 3], taiko: 0.35, lead: 1, echo: 0.2, busy: true }, // Volcanic
  { scales: ['harmonic', 'phrygian'], roots: [44, 46], bpm: [138, 146], kicks: [0], taikos: [2, 1], basses: [0], taiko: 0.45, lead: 1, echo: 0.35 }, // Abyss
  { scales: ['dorian'], roots: [55, 57], bpm: [108, 116], kicks: [0], taikos: [0], basses: [2], taiko: 0.2, lead: 2, echo: 0.5 }, // Hot Springs Valley
  { scales: ['phrygian'], roots: [43, 45], bpm: [132, 140], kicks: [3], taikos: [2], basses: [3], taiko: 0.4, lead: 1, echo: 0.6 }, // Crash Site Prime
];
const KICKS = [
  [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
  [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0],
  [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 0, 0],
  [1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0],
];
// 0 rest, 1 low taiko, 2 high taiko
const TAIKOS = [
  [1, 0, 0, 0, 0, 0, 2, 0, 0, 0, 1, 0, 2, 0, 0, 0],
  [1, 0, 0, 2, 0, 0, 1, 0, 1, 0, 0, 0, 2, 0, 2, 0],
  [1, 0, 0, 0, 1, 0, 0, 0, 2, 0, 2, 0, 1, 0, 0, 0],
];
// 0 rest, 1 root, 2 octave, 3 fifth
const BASSES = [
  [1, 0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 1, 0, 3, 0],
  [1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 3, 0, 3, 3],
  [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 3, 0],
  [1, 1, 0, 1, 1, 0, 2, 0, 1, 1, 0, 1, 3, 0, 2, 0],
];
const RHYTHMS = [[4, 2, 2, 4, 4, 8, 8], [2, 2, 4, 2, 2, 4, 8, 8], [6, 2, 4, 4, 4, 4, 8], [4, 4, 2, 2, 4, 8, 8], [8, 4, 4, 6, 2, 8]];

export class Music {
  constructor(audio) {
    this.a = audio;
    this.mode = null;
    this.song = null;
    this.paused = false;
    this.level = 1;
    this.intensity = 0.5;
    this.timer = null;
  }
  get ctx() { return this.a.ctx; }

  // ---- public API (called through Audio) ----
  start(mode, stage) {
    if (mode === 'lobby' && this.mode === mode && this.song && !this.paused) return;
    this.mode = mode;
    this.paused = false;
    if (!this.ctx) return; // Audio.unlock() calls resume() once sound is allowed
    this.build();
    const c = this.ctx, now = c.currentTime, switching = !!this.song;
    this.song = mode === 'lobby' ? this.makeLobby() : this.makeRun(stage);
    this.step = 0;
    this.next = now + (switching ? 0.6 : 0.1);
    if (switching) this.fade(0, 0.15);
    this.echo.delayTime.setValueAtTime(this.song.spb * 3, this.next);
    this.send.gain.setValueAtTime(this.song.echo || 0.3, this.next);
    this.fadeIn(this.next);
    if (!this.timer) this.timer = setInterval(() => this.tick(), 50);
  }
  stop() {
    this.mode = null;
    if (!this.song) return;
    this.song = null;
    this.fade(0, 0.4);
    clearInterval(this.timer); this.timer = null;
  }
  pause(on) {
    if (!this.song || this.paused === on) return;
    this.paused = on;
    if (on) this.fade(0, 0.15);
    else { this.next = this.ctx.currentTime + 0.1; this.fadeIn(this.next); }
  }
  setIntensity(x) { this.intensity = Math.max(0, Math.min(1, x)); }
  setLevel(v) { this.level = v; if (this.song && !this.paused) this.fade(this.target(), 0.2); }
  resume() { if (this.mode && !this.song) { const m = this.mode; this.mode = null; this.start(m); } }

  // ---- plumbing ----
  build() {
    if (this.bus) return;
    const c = this.ctx;
    this.bus = c.createGain(); this.bus.gain.value = 0;
    this.bus.connect(this.a.master);
    // One shared, filtered echo stands in for reverb on the flute and pad.
    this.send = c.createGain(); this.send.gain.value = 0.3;
    this.echo = c.createDelay(1.5);
    const fb = c.createGain(); fb.gain.value = 0.38;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2000;
    this.send.connect(this.echo).connect(lp).connect(fb).connect(this.echo);
    lp.connect(this.bus);
    this.makeDrums();
  }
  target() { return 0.2 * this.level * (this.song ? this.song.gain : 1); }
  fade(v, tc) { const g = this.bus.gain, t = this.ctx.currentTime; g.cancelScheduledValues(t); g.setTargetAtTime(v, t, tc); }
  fadeIn(at) { const g = this.bus.gain; g.cancelScheduledValues(at); g.setTargetAtTime(this.target(), at, 0.8); }
  tick() {
    const c = this.ctx;
    if (!c || !this.song || this.paused) return;
    const now = c.currentTime;
    // Tab was throttled or the context was suspended: skip ahead, never burst.
    if (this.next < now - 0.1) this.next = now + 0.05;
    while (this.next < now + 0.25) {
      if (this.a.vol > 0) this.song.play(this.step, this.next);
      this.step++;
      this.next += this.song.spb;
    }
  }
  note(key, deg, oct = 0) {
    const s = key.s, n = s.length, o = Math.floor(deg / n);
    return key.root + 12 * (o + oct) + s[((deg % n) + n) % n];
  }

  // ---- instruments ----
  // Drums are rendered once into small buffers, so each hit costs one
  // buffer source and one gain instead of a live oscillator/filter chain.
  makeDrums() {
    const sr = this.ctx.sampleRate;
    const make = (secs, fn) => {
      const b = this.ctx.createBuffer(1, Math.ceil(secs * sr), sr), d = b.getChannelData(0);
      fn(d, sr);
      return b;
    };
    const hp = (d, f) => { const a = 1 / (1 + 2 * Math.PI * f / sr); let y = 0, px = 0; for (let i = 0; i < d.length; i++) { const x = d[i]; y = a * (y + x - px); px = x; d[i] = y; } };
    const lp = (d, f) => { const k = 1 - Math.exp(-2 * Math.PI * f / sr); let y = 0; for (let i = 0; i < d.length; i++) { y += k * (d[i] - y); d[i] = y; } };
    const rnd = () => Math.random() * 2 - 1;
    const tone = (d, f0, f1, sweep, dec, amp) => {
      let ph = 0;
      for (let i = 0; i < d.length; i++) {
        const t = i / sr, f = f1 + (f0 - f1) * Math.exp(-t / sweep);
        ph += 2 * Math.PI * f / sr;
        d[i] += Math.sin(ph) * amp * Math.exp(-t / dec);
      }
    };
    const noiseEnv = (d, dec, amp) => { for (let i = 0; i < d.length; i++) d[i] = rnd() * amp * Math.exp(-i / sr / dec); };
    this.drums = {
      kick: make(0.34, (d) => tone(d, 150, 42, 0.035, 0.08, 0.9)),
      snare: make(0.2, (d) => { noiseEnv(d, 0.045, 0.6); hp(d, 1800); tone(d, 210, 150, 0.03, 0.025, 0.35); }),
      hat: make(0.05, (d) => { noiseEnv(d, 0.009, 0.5); hp(d, 7000); }),
      taiko: make(0.55, (d) => { noiseEnv(d, 0.03, 0.5); lp(d, 500); tone(d, 100, 62, 0.15, 0.12, 0.85); }),
      crash: make(1, (d) => { noiseEnv(d, 0.25, 0.25); hp(d, 5000); }),
    };
  }
  hit(t, name, v, rate = 1) {
    const c = this.ctx, src = c.createBufferSource(), g = c.createGain();
    src.buffer = this.drums[name];
    src.playbackRate.value = rate * (0.98 + Math.random() * 0.04);
    g.gain.value = v;
    src.connect(g).connect(this.bus);
    src.start(t);
  }
  kick(t, v) { this.hit(t, 'kick', v); }
  snare(t, v) { this.hit(t, 'snare', v); }
  hat(t, v) { this.hit(t, 'hat', 0.4 * v); }
  taiko(t, f, v) { this.hit(t, 'taiko', v, f / 100); }
  crash(t, v) { this.hit(t, 'crash', 0.5 * v); }
  bass(t, m, dur, v) {
    const c = this.ctx, o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
    o.type = 'sawtooth'; o.frequency.value = mtof(m);
    f.type = 'lowpass'; f.Q.value = 2;
    f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(220, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.32 * v, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f).connect(g).connect(this.bus); o.start(t); o.stop(t + dur + 0.02);
  }
  softBass(t, m, dur, v) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.frequency.value = mtof(m);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35 * v, t + 0.3);
    g.gain.setTargetAtTime(0.0001, t + dur - 0.6, 0.25);
    o.connect(g).connect(this.bus); o.start(t); o.stop(t + dur + 0.6);
  }
  pad(t, notes, dur, v) {
    const c = this.ctx, f = c.createBiquadFilter(), g = c.createGain();
    f.type = 'lowpass'; f.frequency.value = 850;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.09 * v, t + Math.min(1.2, dur * 0.4));
    g.gain.setTargetAtTime(0.0001, t + dur - 0.3, 0.35);
    f.connect(g); g.connect(this.bus); g.connect(this.send);
    for (const m of notes) {
      for (const d of [-7, 7]) {
        const o = c.createOscillator();
        o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = d;
        o.connect(f); o.start(t); o.stop(t + dur + 1.2);
      }
    }
  }
  flute(t, m, dur, v) {
    const c = this.ctx, fr = mtof(m);
    const o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), g2 = c.createGain();
    o.frequency.value = fr;
    o2.type = 'triangle'; o2.frequency.value = fr * 2; g2.gain.value = 0.08;
    // Vibrato fades in on longer notes, like a player settling into the note.
    const lfo = c.createOscillator(), lg = c.createGain();
    lfo.frequency.value = 5 + Math.random() * 0.6;
    lg.gain.setValueAtTime(0, t);
    lg.gain.linearRampToValueAtTime(dur > 0.35 ? fr * 0.007 : 0, t + Math.min(0.4, dur));
    lfo.connect(lg); lg.connect(o.frequency); lg.connect(o2.detune);
    const end = t + dur;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.2 * v, t + 0.05);
    g.gain.setTargetAtTime(0.15 * v, t + 0.05, 0.2);
    g.gain.setTargetAtTime(0.0001, end - 0.04, 0.06);
    o.connect(g); o2.connect(g2).connect(g);
    g.connect(this.bus); g.connect(this.send);
    for (const n of [o, o2, lfo]) { n.start(t); n.stop(end + 0.4); }
  }
  harp(t, m, v) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = 'triangle'; o.frequency.value = mtof(m);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12 * v, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
    o.connect(g); g.connect(this.bus); g.connect(this.send);
    o.start(t); o.stop(t + 1.45);
  }

  // ---- composition ----
  makeKey(names, roots = [45, 47, 48, 50, 52]) {
    const name = pick(names), sc = SCALES[name];
    return { s: sc.s, root: pick(roots), prog: pick(sc.progs) };
  }
  makeMotif() {
    const notes = [];
    let deg = pick([0, 2, 4, 7]), s = 0;
    for (const len of pick(RHYTHMS)) {
      notes.push({ s, len, deg, rest: s > 0 && chance(0.12) });
      s += len;
      deg = Math.max(-1, Math.min(9, deg + pick([-2, -1, -1, 0, 1, 1, 2, 3])));
    }
    const last = notes[notes.length - 1];
    last.deg = Math.round(last.deg / 2) * 2; // land on a chord tone
    last.rest = false;
    return notes;
  }
  // Plays a 2-bar motif starting at bar step 0, shifted and lightly varied.
  phrase(key, motif, shift, i, t, oct, v) {
    const n = motif.find((x) => x.s === i);
    if (!n || n.rest) return;
    const deg = n.deg + shift + (n.vary || 0);
    this.flute(t, this.note(key, deg, oct), n.len * this.song.spb * 0.95, v);
  }
  vary(motif) {
    for (const n of motif) n.vary = 0;
    const n = pick(motif); n.vary = pick([-1, 1, 2]);
  }

  makeLobby() {
    const rng = seeded(20261016);
    R = rng;
    const key = this.makeKey(['dorian']);
    const bpm = 72, spb = 60 / bpm / 4;
    const motif = this.makeMotif();
    const arp = pick([[0, 1, 2, 3, 2, 1, 0, 1], [0, 2, 1, 3, 2, 3, 1, 2], [0, 1, 2, 1, 3, 2, 1, 2]]);
    R = Math.random;
    return {
      spb, gain: 0.85, echo: 0.35,
      play: (step, t) => { R = rng; try { this.lobbyStep(key, motif, arp, spb, step, t); } finally { R = Math.random; } },
    };
  }
  lobbyStep(key, motif, arp, spb, step, t) {
    const bar = step >> 4, i = step & 15;
    const chord = key.prog[(bar >> 1) % key.prog.length], cstep = step & 31;
    const tones = [0, 2, 4, 7].map((d) => this.note(key, chord + d, 1));
    if (cstep === 0) {
      this.pad(t, tones.slice(0, 3), 32 * spb, 1);
      this.softBass(t, this.note(key, chord, -1), 32 * spb, 0.8);
    }
    if (i % 2 === 0 && chance(0.85)) this.harp(t, tones[arp[i >> 1]] + 12, 0.7);
    const ph = bar % 8;
    if (ph === 0 && i === 0) { this.vary(motif); this.shift = pick([0, 0, 2, -2]); this.playFl = chance(0.75); }
    if (this.playFl && ph < 2) this.phrase(key, motif, this.shift, (ph << 4) | i, t, 2, 0.8);
    if (this.playFl && ph >= 4 && ph < 6) this.phrase(key, motif, this.shift + 4, ((ph - 4) << 4) | i, t, 2, 0.65);
  }


  makeRun(stage) {
    const st = STAGES[Number.isInteger(stage) ? stage % STAGES.length : (Math.random() * STAGES.length) | 0];
    const key = this.makeKey(st.scales, st.roots);
    const bpm = st.bpm[0] + Math.random() * (st.bpm[1] - st.bpm[0]), spb = 60 / bpm / 4;
    const motifs = [this.makeMotif(), this.makeMotif()];
    const kickP = KICKS[pick(st.kicks)], taikoP = TAIKOS[pick(st.taikos)], bassP = BASSES[pick(st.basses)];
    const tLow = 70 + Math.random() * 20;
    let sec = { type: 'intro', bars: 4, start: 0 };
    const nextSection = (bar) => {
      const I = this.intensity, roll = Math.random();
      let type;
      if (sec.type === 'calm') type = 'drive';
      else if (roll < 0.14 * (1.2 - I)) type = 'calm';
      else if (roll < 0.14 + st.taiko * 0.6) type = 'taiko';
      else type = 'drive';
      sec = { type, bars: type === 'calm' ? 4 : 8, start: bar, motif: pick(motifs), shift: pick([0, 0, 2, 4, -3]) };
    };
    return {
      spb, gain: 1, echo: st.echo,
      play: (step, t) => {
        const bar = step >> 4, i = step & 15;
        if (i === 0 && bar - sec.start >= sec.bars) {
          nextSection(bar);
          if (sec.type !== 'calm') this.crash(t, 1);
          this.vary(sec.motif || motifs[0]);
        }
        const rel = bar - sec.start, lastBar = rel === sec.bars - 1, type = sec.type;
        const chord = key.prog[bar % key.prog.length];
        const root = this.note(key, chord, -1);
        const I = this.intensity;
        if (i === 0) this.pad(t, [0, 2, 4].map((d) => this.note(key, chord + d, 1)), 16 * spb, type === 'calm' ? 1.3 : 0.8);

        if (type === 'intro') {
          if (i % 4 === 0) this.taiko(t, i === 0 ? tLow : tLow * 1.5, 0.4 + rel * 0.15);
          if (rel === 3 && i >= 8 && i % 2 === 0) this.taiko(t, tLow * 1.5, 0.3 + i * 0.03);
          return;
        }
        if (type === 'calm') {
          if (i === 0) { this.taiko(t, tLow, 0.35); this.softBass(t, root, 16 * spb, 0.7); }
          this.phrase(key, sec.motif, sec.shift, ((rel & 1) << 4) | i, t, st.lead, 0.75);
          return;
        }
        // Fill on the last beat of a section.
        if (lastBar && i >= 12) { this.taiko(t, tLow * (i % 2 ? 1.5 : 1.2), 0.5); return; }
        if (type === 'drive') {
          if (kickP[i]) this.kick(t, 1);
          if (i === 4 || i === 12 || (i === 14 && chance(0.25))) this.snare(t, i === 14 ? 0.4 : 1);
          if (i % 2 === 0 || ((st.busy || I > 0.7) && chance(0.6))) this.hat(t, i % 4 === 2 ? 1 : 0.55);
          const b = bassP[i];
          if (b) this.bass(t, b === 2 ? root + 12 : b === 3 ? this.note(key, chord + 4, -1) : root, spb * 1.6, 1);
        } else {
          const tk = taikoP[i];
          if (tk) this.taiko(t, tk === 1 ? tLow : tLow * 1.5, tk === 1 ? 0.9 : 0.6);
          if (i === 8) this.snare(t, 0.7);
          if (i % 4 === 2) this.hat(t, 0.6);
          if (i === 0) this.bass(t, root, spb * 12, 0.8);
        }
        // Flute answers in bars 3-4 and 7-8 of each section.
        const half = rel & 3;
        if (half >= 2) this.phrase(key, sec.motif, sec.shift + (rel >= 4 ? 2 : 0), ((half - 2) << 4) | i, t, st.lead, 0.7);
      },
    };
  }
}
