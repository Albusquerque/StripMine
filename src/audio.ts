import type { StripMineStatus, WorkerState } from "./types";

type ScoreState = Pick<StripMineStatus, "age" | "progress" | "worker_count" | "tempo">;
type WaveSpec = [OscillatorType, number, number];
type SynthOptions = {
  destination?: AudioNode;
  filterType?: BiquadFilterType;
  cutoff?: number;
  q?: number;
  attack?: number;
  sustain?: number;
  pan?: number;
  reverb?: boolean;
  echo?: boolean;
  waves?: WaveSpec[];
  type?: OscillatorType;
  glideTo?: number;
};

/** Original, procedural score: no samples, downloads or third-party recording. */
export class StripMineAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private music: GainNode | null = null;
  private sfx: GainNode | null = null;
  private reverb: ConvolverNode | null = null;
  private delay: DelayNode | null = null;
  private noise: AudioBuffer | null = null;
  private timer = 0;
  private step = 0;
  private nextNote = 0;
  private state: ScoreState = { age: 0, progress: 0, worker_count: 1, tempo: 2 };
  private lastCue = -1;
  private lastCashout = -1;
  private lastReward = -1;
  private workerImpacts = new Map<number, number>();
  private defaultUnlock: (() => void) | null = null;
  private screenActive = false;
  musicEnabled = this.readEnabled("stripmine.musicEnabled", true);
  effectsEnabled = this.readEnabled("stripmine.effectsEnabled", true);
  musicVolume = this.readVolume("stripmine.musicVolume", 0.8);
  effectsVolume = this.readVolume("stripmine.effectsVolume", 0.65);

  private readEnabled(key: string, fallback: boolean) {
    try {
      const raw = window.localStorage.getItem(key);
      return raw === null ? fallback : raw === "true";
    } catch { return fallback; }
  }

  private writeEnabled(key: string, enabled: boolean) {
    try { window.localStorage.setItem(key, String(enabled)); } catch { /* Decky storage may be unavailable during bootstrap. */ }
  }

  private readVolume(key: string, fallback: number) {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return fallback;
      const value = Number(raw);
      return Number.isFinite(value) && value >= 0 && value <= 1 ? value : fallback;
    } catch { return fallback; }
  }

  private ensure(): AudioContext | null {
    if (!this.screenActive) return null;
    if (this.context) {
      if (this.context.state === "suspended") void this.context.resume().catch(() => undefined);
      return this.context;
    }
    try {
      const context = new AudioContext();
      this.context = context;
      this.master = context.createGain();
      this.music = context.createGain();
      this.sfx = context.createGain();
      this.reverb = context.createConvolver();
      this.delay = context.createDelay(1);
      const compressor = context.createDynamicsCompressor();
      compressor.threshold.value = -20;
      compressor.knee.value = 14;
      compressor.ratio.value = 4;
      compressor.attack.value = 0.008;
      compressor.release.value = 0.28;
      this.master.gain.value = 0.50;
      this.music.gain.value = 0.65 * this.musicVolume;
      this.sfx.gain.value = (0.42 / 0.65) * this.effectsVolume;
      this.delay.delayTime.value = 0.27;
      const feedback = context.createGain();
      feedback.gain.value = 0.19;
      this.delay.connect(feedback);
      feedback.connect(this.delay);
      this.delay.connect(this.master);
      const impulse = context.createBuffer(2, Math.floor(context.sampleRate * 2.8), context.sampleRate);
      for (let channel = 0; channel < impulse.numberOfChannels; channel += 1) {
        const data = impulse.getChannelData(channel);
        for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2.7);
      }
      this.reverb.buffer = impulse;
      const reverbLevel = context.createGain();
      reverbLevel.gain.value = 0.23;
      this.reverb.connect(reverbLevel).connect(this.master);
      this.noise = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
      const noiseData = this.noise.getChannelData(0);
      for (let i = 0; i < noiseData.length; i += 1) noiseData[i] = Math.random() * 2 - 1;
      this.music.connect(this.master);
      this.sfx.connect(this.master);
      this.master.connect(compressor).connect(context.destination);
      return context;
    } catch { return null; }
  }

  private midi(note: number) { return 440 * Math.pow(2, (note - 69) / 12); }

  private route(node: AudioNode, destination: AudioNode, reverb = true) {
    node.connect(destination);
    if (reverb && this.reverb) node.connect(this.reverb);
  }

  private synthNote(note: number, start: number, duration: number, gain: number, options: SynthOptions = {}) {
    const context = this.context;
    const destination = options.destination ?? this.music;
    if (!context || !destination || !Number.isFinite(note)) return;
    const level = context.createGain();
    const filter = context.createBiquadFilter();
    const panner = context.createStereoPanner();
    filter.type = options.filterType ?? "lowpass";
    filter.frequency.setValueAtTime(options.cutoff ?? 2400, start);
    filter.Q.value = options.q ?? 0.7;
    level.gain.setValueAtTime(0.0001, start);
    level.gain.linearRampToValueAtTime(gain, start + (options.attack ?? 0.018));
    level.gain.setValueAtTime(gain * (options.sustain ?? 0.72), start + Math.max(0.03, duration * 0.36));
    level.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    panner.pan.value = options.pan ?? 0;
    filter.connect(panner).connect(level).connect(destination);
    if (options.reverb !== false && this.reverb) level.connect(this.reverb);
    if (options.echo && this.delay) level.connect(this.delay);
    const waves = options.waves ?? [[options.type ?? "triangle", 0, 1]];
    waves.forEach(([type, cents, volume]) => {
      const oscillator = context.createOscillator();
      const mix = context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(this.midi(note), start);
      oscillator.detune.value = cents;
      if (options.glideTo) oscillator.frequency.exponentialRampToValueAtTime(this.midi(options.glideTo), start + duration);
      mix.gain.value = volume;
      oscillator.connect(mix).connect(filter);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.06);
    });
  }

  private noiseHit(start: number, duration: number, gain: number, cutoff: number, destination?: AudioNode, pan = 0) {
    const context = this.context;
    if (!context || !this.noise || !destination) return;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const level = context.createGain();
    const panner = context.createStereoPanner();
    source.buffer = this.noise;
    filter.type = "bandpass";
    filter.frequency.value = cutoff;
    filter.Q.value = 0.8;
    level.gain.setValueAtTime(Math.max(0.0001, gain), start);
    level.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    panner.pan.value = pan;
    source.connect(filter).connect(panner).connect(level).connect(destination);
    source.start(start);
    source.stop(start + duration);
  }

  private strings(note: number, start: number, duration: number, gain: number, pan = 0) {
    const context = this.context;
    if (!context || !this.music) return;
    const bus = context.createGain();
    const filter = context.createBiquadFilter();
    const panner = context.createStereoPanner();
    const vibrato = context.createOscillator();
    const vibratoDepth = context.createGain();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(900, start);
    filter.frequency.exponentialRampToValueAtTime(2500, start + Math.min(0.65, duration * 0.3));
    bus.gain.setValueAtTime(0.0001, start);
    bus.gain.linearRampToValueAtTime(gain, start + 0.36);
    bus.gain.setValueAtTime(gain * 0.8, start + duration * 0.68);
    bus.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    panner.pan.value = pan;
    filter.connect(panner).connect(bus);
    this.route(bus, this.music);
    vibrato.frequency.value = 5.1;
    vibratoDepth.gain.value = 7;
    vibrato.connect(vibratoDepth);
    [-13, -5, 5, 13].forEach((detune, index) => {
      const oscillator = context.createOscillator();
      const mix = context.createGain();
      oscillator.type = index % 2 ? "sawtooth" : "triangle";
      oscillator.frequency.value = this.midi(note);
      oscillator.detune.value = detune;
      mix.gain.value = index % 2 ? 0.17 : 0.31;
      vibratoDepth.connect(oscillator.detune);
      oscillator.connect(mix).connect(filter);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.08);
    });
    vibrato.start(start);
    vibrato.stop(start + duration);
  }

  private brass(note: number, start: number, duration: number, gain: number, pan = 0) {
    const context = this.context;
    if (!context || !this.music) return;
    const bus = context.createGain();
    const filter = context.createBiquadFilter();
    const panner = context.createStereoPanner();
    filter.type = "lowpass";
    filter.Q.value = 3.2;
    filter.frequency.setValueAtTime(430, start);
    filter.frequency.exponentialRampToValueAtTime(1850, start + 0.16);
    filter.frequency.exponentialRampToValueAtTime(920, start + duration);
    bus.gain.setValueAtTime(0.0001, start);
    bus.gain.linearRampToValueAtTime(gain, start + 0.075);
    bus.gain.setValueAtTime(gain * 0.8, start + duration * 0.58);
    bus.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    panner.pan.value = pan;
    filter.connect(panner).connect(bus);
    this.route(bus, this.music);
    ([[-8, 0.48], [8, 0.48], [0, 0.11]] as Array<[number, number]>).forEach(([detune, volume], index) => {
      const oscillator = context.createOscillator();
      const mix = context.createGain();
      oscillator.type = index === 2 ? "square" : "sawtooth";
      oscillator.frequency.value = this.midi(note);
      oscillator.detune.value = detune;
      mix.gain.value = volume;
      oscillator.connect(mix).connect(filter);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.08);
    });
  }

  private choir(note: number, start: number, duration: number, gain: number, pan = 0) {
    const context = this.context;
    if (!context || !this.music) return;
    const source = context.createOscillator();
    const overtone = context.createOscillator();
    const output = context.createGain();
    const panner = context.createStereoPanner();
    source.type = "sawtooth";
    overtone.type = "triangle";
    source.frequency.value = this.midi(note);
    overtone.frequency.value = this.midi(note) * 2;
    [620, 1220, 2700].forEach((frequency, index) => {
      const filter = context.createBiquadFilter();
      const level = context.createGain();
      filter.type = "bandpass";
      filter.frequency.value = frequency;
      filter.Q.value = 7;
      level.gain.value = [1, 0.48, 0.22][index];
      source.connect(filter);
      overtone.connect(filter);
      filter.connect(level).connect(output);
    });
    output.gain.setValueAtTime(0.0001, start);
    output.gain.linearRampToValueAtTime(gain, start + 0.7);
    output.gain.setValueAtTime(gain * 0.74, start + duration * 0.72);
    output.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    panner.pan.value = pan;
    output.connect(panner);
    this.route(panner, this.music);
    source.start(start); overtone.start(start);
    source.stop(start + duration + 0.1); overtone.stop(start + duration + 0.1);
  }

  private pluck(note: number, start: number, gain: number, pan = 0) {
    const context = this.context;
    if (!context || !this.music) return;
    const period = Math.max(2, Math.round(context.sampleRate / this.midi(note)));
    const buffer = context.createBuffer(1, period, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < period; i += 1) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / period, 0.18);
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const level = context.createGain();
    const panner = context.createStereoPanner();
    source.buffer = buffer; source.loop = true;
    filter.type = "lowpass"; filter.frequency.value = 4200;
    panner.pan.value = pan;
    level.gain.setValueAtTime(gain, start);
    level.gain.exponentialRampToValueAtTime(0.0001, start + 1.8);
    source.connect(filter).connect(panner).connect(level);
    this.route(level, this.music);
    source.start(start); source.stop(start + 1.9);
  }

  private celesta(note: number, start: number, gain: number, pan = 0) {
    const context = this.context;
    const music = this.music;
    if (!context || !music || !Number.isFinite(note)) return;
    [1, 2.01, 3.98, 6.05].forEach((partial, index) => {
      const oscillator = context.createOscillator();
      const level = context.createGain();
      const panner = context.createStereoPanner();
      oscillator.type = "sine";
      oscillator.frequency.value = this.midi(note) * partial;
      level.gain.setValueAtTime(gain / [1, 2.2, 5, 8][index], start);
      level.gain.exponentialRampToValueAtTime(0.0001, start + [1.7, 1.2, 0.8, 0.55][index]);
      panner.pan.value = pan;
      oscillator.connect(level).connect(panner);
      this.route(panner, music);
      oscillator.start(start);
      oscillator.stop(start + 1.8);
    });
  }

  private timpani(note: number, start: number, gain: number) {
    const context = this.context;
    if (!context || !this.music) return;
    const oscillator = context.createOscillator();
    const level = context.createGain();
    oscillator.frequency.setValueAtTime(this.midi(note) * 1.45, start);
    oscillator.frequency.exponentialRampToValueAtTime(this.midi(note), start + 0.12);
    level.gain.setValueAtTime(gain, start);
    level.gain.exponentialRampToValueAtTime(0.0001, start + 1.05);
    oscillator.connect(level);
    this.route(level, this.music);
    oscillator.start(start); oscillator.stop(start + 1.1);
    this.noiseHit(start, 0.13, gain * 0.28, 260, this.music);
  }

  private cymbal(start: number, gain: number, long = false) {
    if (!this.music) return;
    this.noiseHit(start, long ? 2.8 : 0.13, gain, long ? 5900 : 8200, this.music);
  }

  private finaleScore(start: number) {
    if (!this.context || !this.music) return;
    window.clearInterval(this.timer);
    this.timer = 0;
    const chords = [[38, 45, 50, 54], [41, 48, 53, 57], [43, 50, 55, 59], [45, 52, 57, 62], [50, 57, 62, 66]];
    [0, 1.65, 3.25].forEach((offset, index) => {
      this.timpani(26 + index * 2, start + offset, 0.09 + index * 0.025);
      this.noiseHit(start + offset, 1.25, 0.035 + index * 0.016, 5200, this.music!);
    });
    chords.forEach((chord, chordIndex) => {
      const at = start + 4.8 + chordIndex * 3.45;
      chord.forEach((note, voice) => {
        this.strings(note, at, 5.8, 0.026 + chordIndex * 0.003, (voice - 1.5) * 0.3);
        if (voice > 0) this.choir(note + 12, at + 0.35, 5.1, 0.011 + chordIndex * 0.0025, (voice - 2) * 0.34);
      });
      this.timpani(chord[0] - 12, at, 0.065 + chordIndex * 0.008);
      if (chordIndex >= 2) chord.slice(1).forEach((note, voice) => this.brass(note + 12, at + 0.12, 1.7, 0.023 + chordIndex * 0.004, (voice - 1) * 0.34));
    });
    const ostinato = [62, 66, 69, 74, 69, 78, 74, 81];
    for (let step = 0; step < 32; step += 1) this.pluck(ostinato[step % ostinato.length], start + 7.2 + step * 0.42, 0.027 + step * 0.0007, step % 2 ? 0.48 : -0.48);
    [50, 57, 62, 66, 69, 74, 78, 81].forEach((note, index) => this.brass(note, start + 20.1 + index * 0.095, 3.2, 0.038 + index * 0.004, (index - 3.5) * 0.15));
    this.noiseHit(start + 20.1, 5.8, 0.1, 6800, this.music);
    this.choir(74, start + 20.3, 7.2, 0.025, -0.25);
    this.choir(81, start + 20.3, 7.2, 0.022, 0.25);
  }

  private schedule(step: number, start: number) {
    const tonic = [38, 38, 41, 43, 45][this.state.age];
    const scale = [0, 2, 3, 5, 7, 9, 10];
    const chords = [[0, 2, 4], [3, 5, 0], [5, 0, 2], [4, 6, 1]];
    const motif = [0, 2, 4, 2, 5, 4, 2, 1, 0, 2, 5, 4, 6, 5, 3, 2];
    const beat = step % 16;
    const bar = Math.floor(step / 16);
    const chord = chords[bar % chords.length];
    const intensity = Math.min(1, 0.18 + this.state.progress * 0.46 + this.state.worker_count * 0.065 + this.state.age * 0.08);
    if (beat === 0) {
      chord.forEach((degree, index) => this.strings(tonic + 12 + scale[degree], start, 3.7, 0.018 + intensity * 0.012, (index - 1) * 0.42));
      this.strings(tonic + scale[chord[0]], start, 3.7, 0.025 + intensity * 0.011, -0.08);
      if (this.state.age >= 1) {
        this.choir(tonic + 12 + scale[chord[0]], start, 3.6, 0.011 + this.state.age * 0.003, -0.28);
        this.choir(tonic + 12 + scale[chord[2]], start, 3.6, 0.009 + this.state.age * 0.0025, 0.28);
      }
      if (bar % 4 === 0) this.cymbal(start, 0.022 + intensity * 0.02, true);
    }
    if (beat % 4 === 0) {
      this.strings(tonic - 12 + scale[chord[0]], start, 0.7, 0.032 + intensity * 0.018, -0.12);
      this.timpani(tonic - 12 + scale[chord[0]], start, 0.035 + intensity * 0.04);
    }
    if (beat === 4 || beat === 12) {
      this.timpani(tonic - 17 + scale[chord[0]], start, 0.025 + intensity * 0.035);
      this.cymbal(start, 0.012 + intensity * 0.008);
    }
    if (intensity > 0.34 && beat % 2 === 0) {
      const degree = chord[(beat / 2) % chord.length];
      this.pluck(tonic + 24 + scale[degree], start, 0.026 + intensity * 0.02, beat % 4 ? 0.42 : -0.42);
    }
    if (intensity > 0.66 && beat % 2 === 1) this.cymbal(start, 0.006 + intensity * 0.006);
    if (beat % 4 === 2) {
      const motifDegree = motif[(bar * 4 + Math.floor(beat / 4)) % motif.length];
      this.celesta(tonic + 24 + scale[motifDegree], start, 0.018 + this.state.age * 0.004, Math.sin(step * 0.7) * 0.4);
    }
    if (this.state.age >= 2 && (beat === 0 || beat === 8)) chord.forEach((degree, index) => this.brass(tonic + 12 + scale[degree], start + 0.03, 0.82, 0.012 + intensity * 0.009, (index - 1) * 0.28));
    if (this.state.age >= 3 && beat === 8) this.brass(tonic + 24 + scale[chord[1]], start, 1.55, 0.019 + intensity * 0.008, 0.15);
  }

  private scheduler = () => {
    if (!this.musicEnabled || !this.context) return;
    const sixteenth = 60 / ([68, 82, 96, 112][this.state.tempo - 1] + this.state.age * 3) / 4;
    while (this.nextNote < this.context.currentTime + 0.18) {
      this.schedule(this.step, this.nextNote);
      this.nextNote += sixteenth;
      this.step = (this.step + 1) % 64;
    }
  };

  private startMusicScheduler(context: AudioContext) {
    if (!this.musicEnabled || context !== this.context || context.state !== "running") return;
    window.clearInterval(this.timer);
    this.step = 0;
    this.nextNote = context.currentTime + 0.05;
    this.scheduler();
    this.timer = window.setInterval(this.scheduler, 45);
  }

  private clearDefaultUnlock() {
    if (!this.defaultUnlock) return;
    window.removeEventListener("pointerdown", this.defaultUnlock, true);
    window.removeEventListener("keydown", this.defaultUnlock, true);
    this.defaultUnlock = null;
  }

  startDefaults() {
    if (!this.screenActive) return;
    const unlock = () => {
      if (this.musicEnabled) this.setMusic(true);
      else if (this.effectsEnabled) this.ensure();
      if (this.context?.state === "running") this.clearDefaultUnlock();
    };
    unlock();
    if (this.context?.state !== "running" && !this.defaultUnlock) {
      this.defaultUnlock = unlock;
      window.addEventListener("pointerdown", unlock, true);
      window.addEventListener("keydown", unlock, true);
    }
  }

  setMusic(enabled: boolean): boolean {
    this.musicEnabled = enabled;
    this.writeEnabled("stripmine.musicEnabled", enabled);
    window.clearInterval(this.timer);
    this.timer = 0;
    if (!enabled || !this.screenActive) return true;
    const context = this.ensure();
    if (!context) return false;
    if (context.state === "running") this.startMusicScheduler(context);
    else void context.resume().then(() => this.startMusicScheduler(context)).catch(() => undefined);
    return true;
  }

  setEffects(enabled: boolean) {
    this.effectsEnabled = enabled;
    this.writeEnabled("stripmine.effectsEnabled", enabled);
    if (enabled && this.screenActive) this.ensure();
  }

  setScreenActive(active: boolean) {
    if (this.screenActive === active) return;
    this.screenActive = active;
    if (active) {
      this.startDefaults();
      return;
    }
    // Closing rather than merely suspending discards notes already scheduled
    // by the look-ahead sequencer. They must not leak into Steam or replay as
    // a stale burst when the player comes back later.
    this.stopOutput();
  }

  private stopOutput() {
    this.clearDefaultUnlock();
    window.clearInterval(this.timer);
    this.timer = 0;
    const context = this.context;
    if (context && this.master) {
      // Silence synchronously. AudioContext.close() is asynchronous and some
      // WebKit/Chromium builds can otherwise emit a short tail while a new
      // full-screen instance is already starting.
      this.master.gain.cancelScheduledValues(context.currentTime);
      this.master.gain.setValueAtTime(0, context.currentTime);
    }
    this.context = null;
    this.master = null;
    this.music = null;
    this.sfx = null;
    this.reverb = null;
    this.delay = null;
    this.noise = null;
    void context?.close().catch(() => undefined);
  }

  setMusicVolume(value: number) {
    this.musicVolume = Math.max(0, Math.min(1, value));
    if (this.music) this.music.gain.value = 0.65 * this.musicVolume;
    try { window.localStorage.setItem("stripmine.musicVolume", String(this.musicVolume)); } catch { /* Decky storage may be unavailable during bootstrap. */ }
  }

  setEffectsVolume(value: number) {
    this.effectsVolume = Math.max(0, Math.min(1, value));
    if (this.sfx) this.sfx.gain.value = (0.42 / 0.65) * this.effectsVolume;
    try { window.localStorage.setItem("stripmine.effectsVolume", String(this.effectsVolume)); } catch { /* Decky storage may be unavailable during bootstrap. */ }
  }

  play(kind: string) {
    if (!this.screenActive) return;
    const finaleMusic = kind === "finale" && this.musicEnabled;
    if (!this.effectsEnabled && !finaleMusic) return;
    const context = this.ensure();
    if (!context || !this.sfx) return;
    const start = context.currentTime + 0.008;
    if (kind === "finale") {
      if (this.effectsEnabled) this.noiseHit(start, 2.1, 0.13, 2600, this.sfx);
      if (this.musicEnabled) this.finaleScore(start);
      return;
    }
    if (kind === "finale_armed") {
      this.timpani(26, start, 0.11);
      this.brass(38, start + 0.18, 2.6, 0.03);
      this.noiseHit(start, 1.4, 0.045, 900, this.sfx);
      return;
    }
    if (kind === "strike" || kind === "miss") {
      this.noiseHit(start, 0.11, kind === "strike" ? 0.24 : 0.12, 820, this.sfx);
      this.synthNote(41, start, 0.18, 0.16, { destination: this.sfx, waves: [["square", 0, 0.5], ["triangle", -1200, 0.8]], cutoff: 950, glideTo: 29, reverb: false });
      this.synthNote(88, start + 0.025, 0.32, 0.035, { destination: this.sfx, type: "sine", cutoff: 5000 });
      return;
    }
    if (kind === "critical") { this.noiseHit(start, 0.18, 0.3, 1350, this.sfx); [64, 71, 76, 83].forEach((note, index) => this.synthNote(note, start + index * 0.028, 0.72, 0.07, { destination: this.sfx!, waves: [["triangle", 0, 1], ["sine", 1200, 0.25]], cutoff: 4600, echo: true, pan: (index - 1.5) * 0.2 })); return; }
    if (kind === "overcharge") {
      for (let index = 0; index < 9; index += 1) this.synthNote(38 + index * 2, start + index * 0.055, 0.38, 0.035, { destination: this.sfx, waves: [["sawtooth", -8, 0.45], ["sawtooth", 8, 0.45]], cutoff: 600 + index * 300, pan: -0.7 + index * 0.175 });
      this.synthNote(74, start + 0.46, 0.9, 0.07, { destination: this.sfx, type: "sine", cutoff: 5000, echo: true });
      return;
    }
    if (kind === "recall") {
      [79, 74, 69, 62].forEach((note, index) => this.synthNote(note, start + index * 0.075, 0.32, 0.055, { destination: this.sfx!, type: "sine", cutoff: 3000, echo: true }));
      return;
    }
    if (kind === "tempo") {
      [50, 57, 62, 69].slice(0, this.state.tempo).forEach((note, index) => this.pluck(note, start + index * 0.055, 0.06, -0.4 + index * 0.25));
      return;
    }
    if (kind === "milestone" || kind === "cashout") { [62, 69, 74].forEach((note, index) => this.synthNote(note, start + index * 0.09, 0.62, 0.065, { destination: this.sfx!, waves: [["triangle", 0, 1], ["sine", 1200, 0.23]], cutoff: 4200, echo: true, pan: (index - 1) * 0.24 })); return; }
    if (kind === "recruit" || kind === "rank") { [62, 66, 69, 74, 78].forEach((note, index) => this.synthNote(note, start + index * 0.075, 0.72, 0.058, { destination: this.sfx!, type: "triangle", cutoff: 4500, echo: true, pan: (index - 2) * 0.2 })); return; }
    if (kind === "city") { [50, 57, 62].forEach((note, index) => this.synthNote(note, start + index * 0.045, 1.1, 0.085, { destination: this.sfx!, waves: [["sawtooth", -7, 0.34], ["triangle", 7, 0.8]], cutoff: 1700 + index * 500 })); this.noiseHit(start, 0.22, 0.14, 520, this.sfx); return; }
    if (kind === "age") { [50, 57, 62, 66, 69, 74, 78, 81].forEach((note, index) => this.synthNote(note, start + index * 0.105, 1.3, 0.075, { destination: this.sfx!, waves: [["sawtooth", -9, 0.28], ["triangle", 9, 0.78], ["sine", 1200, 0.13]], cutoff: 3800, echo: true, pan: Math.sin(index) * 0.5 })); return; }
    if (kind === "cashout_big" || kind === "upgrade" || kind === "reward") { this.noiseHit(start, 0.36, 0.18, 2200, this.sfx); [50, 57, 62, 65, 69, 74].forEach((note, index) => this.synthNote(note, start + index * 0.095, 1.05, 0.072, { destination: this.sfx!, waves: [["sawtooth", -5, 0.34], ["triangle", 5, 0.8]], attack: 0.025, cutoff: 3200, echo: index > 2, pan: (index - 2.5) * 0.14 })); }
  }

  private playWorkerImpact(worker: WorkerState, simultaneous: number) {
    if (!this.effectsEnabled) return;
    const context = this.ensure();
    if (!context || !this.sfx) return;
    // The canvas reaches the rock at 69% of its articulated swing. Both are
    // started from the same impact sequence, so the transient lands on the
    // visible pick head rather than on a later outbound/return poll.
    const contactDelay = (0.72 / this.state.tempo) * 0.69;
    const spread = worker.side === "left" ? -0.56 : 0.56;
    const lane = (worker.id % 4 < 2 ? -0.06 : 0.06) * (worker.side === "left" ? 1 : -1);
    const pan = Math.max(-0.8, Math.min(0.8, spread + lane));
    const start = context.currentTime + contactDelay + Math.min(0.018, simultaneous * 0.006);
    const weight = 0.16 + worker.rank * 0.018;
    this.noiseHit(start, 0.095, weight, 690 + worker.rank * 115, this.sfx, pan);
    this.synthNote(35 + worker.rank * 2 + (worker.id % 2), start, 0.16, 0.105, {
      destination: this.sfx, waves: [["square", 0, 0.34], ["triangle", -1200, 0.9]],
      cutoff: 760 + worker.rank * 130, glideTo: 27 + worker.rank, reverb: false, pan,
    });
    this.synthNote(82 + worker.id * 2, start + 0.018, 0.22, 0.024, {
      destination: this.sfx, type: "sine", cutoff: 4700, pan,
    });
  }

  onStatus(status: StripMineStatus) {
    this.state = status;
    if (this.lastCue < 0) {
      this.lastCue = status.cue_seq;
      this.lastCashout = status.cashout_seq;
      this.lastReward = status.reward_seq;
      this.workerImpacts = new Map(status.workers.map((worker) => [worker.id, worker.impact_seq]));
      return;
    }

    const impacts = status.workers.filter((worker) => {
      const previous = this.workerImpacts.get(worker.id);
      return previous !== undefined && worker.impact_seq > previous;
    });
    impacts.forEach((worker, index) => this.playWorkerImpact(worker, impacts.length > 1 ? index : 0));
    status.workers.forEach((worker) => this.workerImpacts.set(worker.id, worker.impact_seq));

    const rewardChanged = status.reward_seq > this.lastReward;
    const cashoutChanged = status.cashout_seq > this.lastCashout;
    if (rewardChanged) this.play(status.reward_kind || "reward");
    else if (cashoutChanged) this.play(status.last_cashout && status.last_cashout.workers.length > 1 ? "cashout_big" : "cashout");

    if (status.cue_seq > this.lastCue) {
      const sequencedElsewhere = status.cue_kind.startsWith("cashout") || ["recruit", "rank", "city", "finale_armed"].includes(status.cue_kind);
      if (!sequencedElsewhere) this.play(status.cue_kind);
      this.lastCue = status.cue_seq;
    }
    this.lastCashout = status.cashout_seq;
    this.lastReward = status.reward_seq;
  }

  dispose() {
    this.screenActive = false;
    this.stopOutput();
  }
}
