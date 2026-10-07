// Background music: one looping track shared by every scene (Phaser's sound manager is game-wide,
// so the track keeps playing across scene changes). On/off is remembered, separately from the
// sound-effects mute.
export const MUSIC_KEY = 'bgm';
export const MUSIC_FILE = 'backgroundmusic.mp3';
const MUSIC_OFF_KEY = 'secret-recipe-music-off';
const VOLUME = 0.35;

export function musicEnabled() {
  try {
    return localStorage.getItem(MUSIC_OFF_KEY) !== '1';
  } catch {
    return true;
  }
}

/** Starts the track if music is on and it isn't playing yet. Safe to call from every scene. */
export function startMusic(scene) {
  if (!musicEnabled() || !scene.cache.audio.exists(MUSIC_KEY)) return;
  const sound = scene.sound;
  const track = sound.get(MUSIC_KEY) ?? sound.add(MUSIC_KEY, { loop: true, volume: VOLUME });
  if (track.isPlaying) return;
  // Browsers only allow audio after the first tap/click; Phaser unlocks it then.
  if (sound.locked) sound.once('unlocked', () => musicEnabled() && !track.isPlaying && track.play());
  else track.play();
}

/** Turns music on/off and remembers it. Returns true when music is now on. */
export function toggleMusic(scene) {
  const on = !musicEnabled();
  try {
    localStorage.setItem(MUSIC_OFF_KEY, on ? '0' : '1');
  } catch {
    // Ignore: the setting just won't persist.
  }
  if (on) startMusic(scene);
  else scene.sound.get(MUSIC_KEY)?.stop();
  return on;
}
