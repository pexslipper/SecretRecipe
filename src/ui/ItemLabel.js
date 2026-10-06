import Phaser from 'phaser';
import { makeItemIcon } from './ItemToken.js';

/*
 * Inline pieces for text rows that show items with their sprite-sheet icons.
 * Text can't hold images, so these build containers instead. Each one is anchored like a Text with
 * origin (0, 0.5): its local (0, 0) is the left edge, vertically centred, and width/height are set,
 * so it can be positioned, measured and hidden the same way as a text object.
 */

const ICON_GAP = 6;

function group(scene, children, width, height) {
  return new Phaser.GameObjects.Container(scene, 0, 0, children).setSize(width, height);
}

/** "[icon] Name". The icon sits in a square slot so names line up in a column. */
export function makeItemLabel(scene, item, style, iconSize) {
  const icon = makeItemIcon(scene, item, iconSize);
  const slot = Math.max(iconSize, icon.displayWidth);
  icon.setPosition(slot / 2, 0);
  const name = new Phaser.GameObjects.Text(scene, slot + ICON_GAP, 0, item.name, style).setOrigin(0, 0.5);
  return group(scene, [icon, name], name.x + name.width, Math.max(iconSize, name.height));
}

/**
 * Lays pieces (Texts with origin (0, 0.5), or containers from this file) left to right,
 * wrapping onto a new line when the next one would pass `maxWidth`.
 */
export function makeFlowRow(scene, pieces, { maxWidth = Infinity, gap = 10, lineGap = 4 } = {}) {
  const lines = [[]];
  let x = 0;
  for (const piece of pieces) {
    if (x > 0 && x + piece.width > maxWidth) {
      lines.push([]);
      x = 0;
    }
    lines[lines.length - 1].push({ piece, x });
    x += piece.width + gap;
  }

  const heights = lines.map((line) => Math.max(...line.map(({ piece }) => piece.height)));
  const height = heights.reduce((sum, h) => sum + h, 0) + lineGap * (lines.length - 1);
  let width = 0;
  let y = -height / 2;
  lines.forEach((line, i) => {
    for (const { piece, x: px } of line) piece.setPosition(px, y + heights[i] / 2);
    const last = line[line.length - 1];
    width = Math.max(width, last.x + last.piece.width);
    y += heights[i] + lineGap;
  });
  return group(scene, pieces, width, height);
}
