// Pieces shared by the storage column (landscape) and the storage drawer (portrait).
import { ItemToken } from './ItemToken.js';
import { COLORS, textStyle } from './theme.js';
import { REUSABLE_TYPES } from '../data/start.js';
import { SECTION_H } from './layout.js';

const TOOLS_OPEN_KEY = 'secret-recipe-tools-open';

const isRaw = (item) => item.type === 'base_ingredient';

// The `pinned` section is Tools: it never scrolls away and can be opened/closed.
// `empty` is shown on an empty shelf: Processed starts empty; the others always hold the chapter's starting items.
export const SECTIONS = [
  {
    key: 'tools',
    label: 'Tools',
    style: 'pegboard',
    pinned: true,
    empty: 'No tools yet!',
    filter: (item) => REUSABLE_TYPES.has(item.type),
  },
  { key: 'raw', label: 'Raw Ingredients', style: 'shelf', empty: 'Nothing here yet!', filter: (item) => isRaw(item) },
  {
    key: 'processed',
    label: 'Processed Ingredients',
    style: 'shelf',
    empty: 'Cook something to fill this shelf!',
    filter: (item) => !REUSABLE_TYPES.has(item.type) && !isRaw(item),
  },
];

/** Ids of `entries` that belong in `section`, sorted A→Z by name. */
export function sectionIds(section, ids, itemsById) {
  return ids
    .filter((id) => section.filter(itemsById.get(id)))
    .sort((a, b) => itemsById.get(a).name.localeCompare(itemsById.get(b).name, undefined, { sensitivity: 'base' }));
}

export function makeShelfToken(scene, item, depth) {
  return new ItemToken(scene, 0, 0, item, { variant: 'shelf' }).setDepth(depth);
}

/** Removes shelf tokens whose id isn't in `ids` (items with nothing left to discover): they shrink away. */
export function retireShelfTokens(scene, entries, ids) {
  for (const [id, token] of entries) {
    if (ids.has(id)) continue;
    entries.delete(id);
    token.setInputEnabled(false);
    scene.tweens.killTweensOf(token);
    if (!token.visible) {
      token.destroy();
      continue;
    }
    scene.tweens.add({ targets: token, scale: 0, alpha: 0, duration: 300, ease: 'Back.easeIn', onComplete: () => token.destroy() });
  }
}

/** Section title row with dashed rule. With `toggle`, shows a caret + hide/show and is clickable. */
export function makeSectionHeader(scene, { x, w, text, depth, toggle = null }) {
  const objs = [];
  const add = (o) => {
    o.setDepth(depth);
    objs.push(o);
    return o;
  };
  const labelText = toggle ? `${toggle.open ? '▾' : '▸'} ${text}` : text;
  const label = add(scene.add.text(x + 8, 0, labelText, textStyle(16, 600)).setOrigin(0, 0.5));
  const g = add(scene.add.graphics());
  g.lineStyle(2, COLORS.woodShadow, 0.9);
  const startX = label.x + label.width + 10;
  const endX = x + w - (toggle ? 56 : 10);
  for (let dx = startX; dx < endX; dx += 14) g.lineBetween(dx, SECTION_H / 2, Math.min(dx + 8, endX), SECTION_H / 2);

  const parts = [
    { obj: label, relY: SECTION_H / 2 },
    { obj: g, relY: 0 },
  ];

  if (toggle) {
    const hint = add(
      scene.add.text(x + w - 8, 0, toggle.open ? 'hide' : 'show', textStyle(13, 600, COLORS.inkSoft)).setOrigin(1, 0.5),
    );
    const hit = add(scene.add.zone(x, 0, w, SECTION_H).setOrigin(0));
    hit.setInteractive({ useHandCursor: true });
    hit.on('pointerup', () => toggle.onToggle());
    hit.on('pointerover', () => label.setColor('#a0522d'));
    hit.on('pointerout', () => label.setColor(COLORS.ink));
    parts.push({ obj: hint, relY: SECTION_H / 2 }, { obj: hit, relY: 0 });
  }
  return { parts, objs };
}

/** Pegboard backing for a row of tools, drawn with its top at y = 0. */
export function drawPegboard(scene, x, w, height, depth) {
  const g = scene.add.graphics().setDepth(depth);
  const left = x + 6;
  const iw = w - 12;
  g.fillStyle(0x000000, 0.1).fillRoundedRect(left + 2, 4, iw, height - 6, 10);
  g.fillStyle(0xf4dcb6).fillRoundedRect(left, 2, iw, height - 6, 10);
  g.lineStyle(2, COLORS.woodEdge).strokeRoundedRect(left, 2, iw, height - 6, 10);
  g.fillStyle(COLORS.woodShadow, 0.55);
  for (let py = 16; py < height - 10; py += 22) {
    for (let px = left + 14; px < left + iw - 8; px += 22) g.fillCircle(px, py, 2.6);
  }
  return g;
}

export const SHELF_BOARD_Y = 64;

/** Shelf board for a row of ingredients, drawn with its top at y = 0. */
export function drawShelf(scene, x, w, depth) {
  const g = scene.add.graphics().setDepth(depth);
  g.fillStyle(0x000000, 0.08).fillRect(x, 6, w, SHELF_BOARD_Y - 6);
  g.fillStyle(COLORS.wood).fillRect(x, SHELF_BOARD_Y, w, 24);
  g.fillStyle(0xf3d8ae).fillRect(x, SHELF_BOARD_Y, w, 5);
  g.fillStyle(COLORS.woodShadow, 0.5).fillRect(x, SHELF_BOARD_Y + 24, w, 6);
  g.lineStyle(2, COLORS.woodEdge).strokeRect(x, SHELF_BOARD_Y, w, 24);
  return g;
}

/** Cabinet back + side posts filling a storage rect. */
export function drawCabinet(scene, rect, depth, postW) {
  return fillCabinet(scene.add.graphics().setDepth(depth), rect, postW);
}

/** Draws the cabinet look into an existing Graphics (used to redraw covers when they resize). */
export function fillCabinet(g, rect, postW) {
  const { x, y, w, h } = rect;
  g.fillStyle(0xe2bb89).fillRect(x, y, w, h);
  g.fillStyle(0xd6aa76, 0.35)
    .fillRect(x + postW, y, 18, h)
    .fillRect(x + w - postW - 18, y, 18, h);
  fillPosts(g, rect, postW);
  return g;
}

/** Just the side posts. Drawn above scrolling items so they slide out of sight behind them. */
export function drawPosts(scene, rect, depth, postW) {
  return fillPosts(scene.add.graphics().setDepth(depth), rect, postW);
}

function fillPosts(g, { x, y, w, h }, postW) {
  g.fillStyle(COLORS.woodDark).fillRect(x, y, postW, h).fillRect(x + w - postW, y, postW, h);
  g.lineStyle(2, COLORS.woodEdge)
    .strokeRect(x, y, postW, h)
    .strokeRect(x + w - postW, y, postW, h);
  return g;
}

export function flashNew(scene, token, depth) {
  scene.tweens.add({ targets: token, scale: 1.2, duration: 160, yoyo: true, repeat: 1, ease: 'Sine.easeInOut' });
  const badge = scene.add
    .text(token.x + 26, token.y - 30, 'NEW!', {
      ...textStyle(13, 700, '#ffffff'),
      backgroundColor: '#dd5a50',
      padding: { x: 6, y: 3 },
    })
    .setOrigin(0.5)
    .setDepth(depth);
  scene.tweens.add({ targets: badge, alpha: 0, delay: 1400, duration: 400, onComplete: () => badge.destroy() });
}

// Open/closed state of the Tools section is a per-player convenience; default open.
export function loadToolsOpen() {
  try {
    return localStorage.getItem(TOOLS_OPEN_KEY) !== 'false';
  } catch {
    return true;
  }
}

export function saveToolsOpen(open) {
  try {
    localStorage.setItem(TOOLS_OPEN_KEY, String(open));
  } catch {
    // Ignore: it just won't be remembered.
  }
}
