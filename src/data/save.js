// Saved progress: one JSON blob in localStorage, plus a couple of per-session flags in the game registry.
const SAVE_KEY = 'secret-recipe-save-v1';

// Items on the table, kept across scene restarts (resize / rotation) but not page reloads.
export const WORKSPACE_REGISTRY_KEY = 'workspace-tokens';
// Set once the player has seen the congratulations page this session, so the kitchen doesn't keep sending them back.
export const CONGRATS_SEEN_KEY = 'congrats-seen';

/** The saved progress, or null when there is none (or storage is unavailable / corrupt). */
export function loadSave() {
  try {
    return JSON.parse(localStorage.getItem(SAVE_KEY));
  } catch {
    return null;
  }
}

export function writeSave(data) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // Ignore: progress just won't persist.
  }
}

/** Wipes saved progress and the session flags: the next kitchen starts a brand-new game. */
export function resetGame(registry) {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // Ignore.
  }
  registry.remove(WORKSPACE_REGISTRY_KEY);
  registry.remove(CONGRATS_SEEN_KEY);
}
