// Time spent playing. It advances in frame-sized steps only while the kitchen is on screen; each
// step is capped, so a long gap (tab hidden, device asleep) never counts as play.
export const MAX_STEP_MS = 1000;

export function addPlayTime(totalMs, deltaMs) {
  return totalMs + Math.min(Math.max(0, deltaMs || 0), MAX_STEP_MS);
}

/** "4:05", or "1:02:05" from an hour up. */
export function formatPlayTime(ms) {
  const total = Math.floor(Math.max(0, ms) / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor(total / 60) % 60;
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
