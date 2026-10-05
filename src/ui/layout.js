// Screen layout for every device. Pure (no Phaser) so it can be unit tested.
//
// Landscape (desktop, iPad landscape, phone landscape): storage is a column on the right.
// Portrait (phone/iPad held upright): storage is a drawer along the bottom.

export const HUD_H = 64;
export const PORTRAIT_HUD_H = 72;
export const COLUMN_W = 322;

// Shared row metrics for the storage UIs.
export const SECTION_H = 32;
export const TOOL_ROW_H = 100;
export const SHELF_ROW_H = 104;
export const DRAWER_HEADER_H = 52;
export const DRAWER_PAD_BOTTOM = 10;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Height of the bottom drawer: title, then Tools / Raw / Processed strips (one row each). */
export function drawerHeight(toolsOpen = true) {
  return (
    DRAWER_HEADER_H +
    SECTION_H + (toolsOpen ? TOOL_ROW_H : 0) +
    (SECTION_H + SHELF_ROW_H) * 2 +
    DRAWER_PAD_BOTTOM
  );
}

/**
 * @param {number} viewportW CSS px available to the game
 * @param {number} viewportH
 * @returns {{ width, height, orientation, hud, workspace, storage: { kind, rect } }}
 *   Rects are `{ x, y, w, h }` in game coordinates.
 */
export function computeLayout(viewportW, viewportH, opts) {
  const { width, height } = gameSizeFor(viewportW, viewportH);
  return layoutFor(width, height, opts);
}

/** Picks the logical game size for a viewport so the game's shape matches the screen. */
export function gameSizeFor(viewportW, viewportH) {
  const vw = Math.max(1, viewportW);
  const vh = Math.max(1, viewportH);
  const aspect = vw / vh;
  if (aspect >= 1) {
    const height = vh < 500 ? 540 : 720;
    return { width: Math.round(clamp(height * aspect, height * 1.25, height * 2.25)), height };
  }
  const width = vw < 500 ? 600 : 760;
  return { width, height: Math.round(clamp(width / aspect, width * 1.3, width * 2.3)) };
}

/** Splits a game size into HUD, workspace and storage areas. */
export function layoutFor(width, height, { toolsOpen = true } = {}) {
  if (width >= height) {
    const left = width - COLUMN_W;
    return {
      width,
      height,
      orientation: 'landscape',
      hud: { x: 0, y: 0, w: left, h: HUD_H },
      workspace: { x: 0, y: HUD_H, w: left, h: height - HUD_H },
      storage: { kind: 'column', rect: { x: left, y: 0, w: COLUMN_W, h: height } },
    };
  }

  const drawerH = drawerHeight(toolsOpen);
  return {
    width,
    height,
    orientation: 'portrait',
    hud: { x: 0, y: 0, w: width, h: PORTRAIT_HUD_H },
    workspace: { x: 0, y: PORTRAIT_HUD_H, w: width, h: height - PORTRAIT_HUD_H - drawerH },
    storage: { kind: 'drawer', rect: { x: 0, y: height - drawerH, w: width, h: drawerH } },
  };
}

export function rectContains(rect, x, y) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}
