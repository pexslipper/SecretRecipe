// Saved progress: one JSON blob in localStorage, plus per-session state in the game registry.
// The blob: { unlocked, served, recipes, levels: { [chapterIndex]: bestStars }, playMs }.
const SAVE_KEY = 'secret-recipe-save-v1';

// Items on the table, kept across scene restarts (resize / rotation) but not page reloads.
export const WORKSPACE_REGISTRY_KEY = 'workspace-tokens';
// The chapter being played (customers, timers, hints), kept across scene restarts (resize /
// rotation) but not page reloads: leaving a chapter means starting it over.
export const RUN_REGISTRY_KEY = 'chapter-run';

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

/** Wipes saved progress and the session state: the next kitchen starts a brand-new game. */
export function resetGame(registry) {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // Ignore.
  }
  registry.remove(WORKSPACE_REGISTRY_KEY);
  registry.remove(RUN_REGISTRY_KEY);
}
