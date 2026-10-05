const MUTE_KEY = 'secret-recipe-muted';

// Sound files dropped into public/assets/sounds/ (or public/assets/) as <name>.<ext>, found and loaded by the Preloader.
export const SOUND_FILES = ['success', 'fail', 'explosion'];
export const SOUND_EXTENSIONS = ['mp3', 'ogg', 'wav', 'm4a'];

// Little synthesized blips, so we don't need a file for every sound: [frequency Hz, start s, length s].
const SYNTH = {
  pop: { type: 'sine', notes: [[660, 0, 0.07]], volume: 0.18, slide: 1.6 },
  whoosh: { type: 'triangle', notes: [[500, 0, 0.12]], volume: 0.12, slide: 0.4 },
  chime: { type: 'triangle', notes: [[784, 0, 0.18], [1175, 0.09, 0.3]], volume: 0.2 },
  jingle: { type: 'triangle', notes: [[523, 0, 0.14], [659, 0.1, 0.14], [784, 0.2, 0.14], [1047, 0.3, 0.32]], volume: 0.2 },
  fanfare: {
    type: 'square',
    notes: [[523, 0, 0.12], [523, 0.12, 0.12], [784, 0.24, 0.16], [659, 0.4, 0.12], [784, 0.52, 0.12], [1047, 0.64, 0.45]],
    volume: 0.08,
  },
};

function loadMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Plays the game's sound effects and phone vibrations. File sounds that weren't found are skipped
 * silently; the rest are tiny WebAudio synth sounds. Muting also turns vibration off.
 */
export class Sfx {
  constructor(scene) {
    this.scene = scene;
    this.muted = loadMuted();
    scene.sound.mute = this.muted;
  }

  toggleMute() {
    this.muted = !this.muted;
    this.scene.sound.mute = this.muted;
    try {
      localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0');
    } catch {
      // Ignore: the setting just won't persist.
    }
    return this.muted;
  }

  play(name) {
    if (this.muted) return;
    if (SOUND_FILES.includes(name)) {
      const key = `sfx_${name}`;
      if (this.scene.cache.audio.exists(key)) this.scene.sound.play(key, { volume: 0.7 });
      return;
    }
    if (SYNTH[name]) this.synth(SYNTH[name]);
  }

  vibrate(pattern) {
    if (this.muted) return;
    try {
      navigator.vibrate?.(pattern);
    } catch {
      // Not supported (e.g. iOS): ignore.
    }
  }

  synth({ type, notes, volume, slide = 1 }) {
    const { context: ctx, destination } = this.scene.sound;
    if (!ctx || !destination || ctx.state !== 'running') return;
    const t0 = ctx.currentTime;
    for (const [freq, start, length] of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0 + start);
      if (slide !== 1) osc.frequency.exponentialRampToValueAtTime(freq * slide, t0 + start + length);
      gain.gain.setValueAtTime(0.0001, t0 + start);
      gain.gain.exponentialRampToValueAtTime(volume, t0 + start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + start + length);
      osc.connect(gain).connect(destination);
      osc.start(t0 + start);
      osc.stop(t0 + start + length + 0.02);
    }
  }
}
