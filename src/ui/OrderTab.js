import Phaser from 'phaser';
import { COLORS, textStyle } from './theme.js';
import { makeItemLabel } from './ItemLabel.js';
import { makeRecipeStep, CENSOR_COLOR } from './RecipeStep.js';
import { t } from '../i18n/lang.js';

const PAD = 10;
const HEADER_H = 30;
const DISH_H = 34;
const STEP_H = 34;
const COL_GAP = 14;
const ICON = 26;
const MAX_SHARE_W = 0.62; // of the table width
const HINT_FILL = 0xfff0b8;

/**
 * Little recipe card pinned to the top-right of the table while a customer waits: every step of
 * the ordered dish(es), like in the Recipe Book. Steps not made yet are black bars; a hint uncovers
 * one (shown with a 💡). Tap the header to fold it away.
 */
export class OrderTab {
  constructor(scene, { rect, itemsById, stepsByDish, depth, isDiscovered, isRevealed }) {
    this.scene = scene;
    this.rect = rect;
    this.itemsById = itemsById;
    this.stepsByDish = stepsByDish;
    this.isDiscovered = isDiscovered;
    this.isRevealed = isRevealed;
    this.order = null;
    this.served = new Set();
    this.collapsed = false;
    this.rowsById = new Map();
    this.container = scene.add.container(0, 0).setDepth(depth).setVisible(false);
  }

  show(order, served = []) {
    this.order = order;
    this.served = new Set(served);
    this.build();
    this.container.setVisible(true).setAlpha(0);
    this.scene.tweens.add({ targets: this.container, alpha: 1, duration: 200 });
  }

  hide() {
    this.order = null;
    this.scene.tweens.killTweensOf(this.container);
    this.container.setVisible(false).removeAll(true);
  }

  markServed(dishId) {
    this.served.add(dishId);
    this.refresh();
  }

  refresh() {
    if (this.order) this.build();
  }

  toggle() {
    this.collapsed = !this.collapsed;
    this.refresh();
  }

  /** Draws attention to a step (after a hint uncovers it). */
  flashStep(recipeId) {
    if (this.collapsed) this.toggle();
    const row = this.rowsById.get(recipeId);
    if (!row) return;
    this.scene.tweens.add({ targets: row, scale: { from: 1.25, to: 1 }, duration: 400, ease: 'Back.easeOut' });
  }

  // ---------------------------------------------------------------- Drawing

  build() {
    const scene = this.scene;
    this.container.removeAll(true);
    this.rowsById.clear();
    const style = textStyle(16, 700, COLORS.ink);

    // Rows: a title per dish, then its steps.
    const rows = [];
    if (!this.collapsed) {
      for (const dishId of this.order) {
        const done = this.served.has(dishId);
        const title = makeItemLabel(scene, this.itemsById.get(dishId), textStyle(15, 700, done ? '#5a9a3c' : COLORS.ink), ICON);
        if (done) title.setAlpha(0.6);
        rows.push({ obj: title, h: DISH_H, check: done });
        if (done) continue;
        for (const recipe of this.stepsByDish.get(dishId)) {
          const step = makeRecipeStep(scene, recipe, this.itemsById, { style, iconSize: ICON, gap: 6, names: false });
          const known = this.isDiscovered(recipe.id);
          const hinted = !known && this.isRevealed(recipe.id);
          rows.push({ obj: step, h: STEP_H, censored: !known && !hinted, hinted, recipeId: recipe.id, indent: 12 });
        }
      }
    }

    // Fill columns top to bottom, as many as the table's height needs.
    const maxH = this.rect.h - 20 - HEADER_H - PAD * 2;
    const columns = [[]];
    let colH = 0;
    for (const row of rows) {
      if (colH + row.h > maxH && columns[columns.length - 1].length) {
        columns.push([]);
        colH = 0;
      }
      columns[columns.length - 1].push(row);
      colH += row.h;
    }
    const colW = columns.map((col) => Math.max(0, ...col.map((r) => (r.indent ?? 0) + r.obj.width + (r.check ? 26 : 0) + (r.hinted ? 24 : 0))));
    const header = new Phaser.GameObjects.Text(scene, 0, 0, `${t('order.title')} ${this.collapsed ? '▼' : '▲'}`, textStyle(15, 700, '#8a5a00')).setOrigin(0, 0.5);
    const contentW = Math.max(header.width, colW.reduce((a, b) => a + b, 0) + COL_GAP * (columns.length - 1));
    const contentH = Math.max(0, ...columns.map((col) => col.reduce((sum, r) => sum + r.h, 0)));
    const w = contentW + PAD * 2;
    const h = HEADER_H + (rows.length ? contentH + PAD : 0) + PAD / 2;

    const bg = new Phaser.GameObjects.Graphics(scene);
    bg.fillStyle(0x000000, 0.14).fillRoundedRect(2, 4, w, h, 12);
    bg.fillStyle(0xfff8ec, 0.97).fillRoundedRect(0, 0, w, h, 12);
    bg.lineStyle(2.5, COLORS.woodEdge).strokeRoundedRect(0, 0, w, h, 12);
    if (rows.length) bg.lineStyle(1.5, 0xe6cfa8).lineBetween(PAD, HEADER_H, w - PAD, HEADER_H);
    header.setPosition(PAD, HEADER_H / 2 + 2);
    const pieces = [bg, header];

    let x = PAD;
    columns.forEach((col, c) => {
      let y = HEADER_H + PAD / 2;
      for (const row of col) {
        const cy = y + row.h / 2;
        const rx = x + (row.indent ?? 0) + (row.hinted ? 24 : 0);
        row.obj.setPosition(rx, cy);
        if (row.hinted) {
          bg.fillStyle(HINT_FILL).fillRoundedRect(rx - 26, cy - row.h / 2 + 2, row.obj.width + 30, row.h - 4, 8);
          pieces.push(new Phaser.GameObjects.Text(scene, rx - 24, cy, '💡', { fontSize: 16, padding: { y: 4 } }).setOrigin(0, 0.5));
        }
        if (row.censored) {
          row.obj.setVisible(false);
          pieces.push(new Phaser.GameObjects.Rectangle(scene, rx, cy, row.obj.width, row.h - 12, CENSOR_COLOR).setOrigin(0, 0.5));
        }
        if (row.check) pieces.push(new Phaser.GameObjects.Text(scene, rx + row.obj.width + 6, cy, '✓', textStyle(18, 700, '#4f9a3a')).setOrigin(0, 0.5));
        if (row.recipeId) this.rowsById.set(row.recipeId, row.obj);
        pieces.push(row.obj);
        y += row.h;
      }
      x += colW[c] + COL_GAP;
    });

    // Tapping the header folds the card.
    const hit = new Phaser.GameObjects.Zone(scene, 0, 0, w, HEADER_H + 4).setOrigin(0);
    hit.setInteractive({ useHandCursor: true });
    hit.on('pointerdown', (pointer, _x, _y, event) => {
      event?.stopPropagation();
      this.toggle();
    });
    pieces.push(hit);
    this.container.add(pieces);

    // Pinned to the top-right corner; shrunk if it would cover too much of the table.
    const scale = Math.min(1, (this.rect.w * MAX_SHARE_W) / w);
    this.container.setScale(scale).setPosition(this.rect.x + this.rect.w - w * scale - 10, this.rect.y + 8);
  }

  /** True when a point is over the card (so items aren't set down underneath it by accident). */
  contains(x, y) {
    if (!this.container.visible) return false;
    const b = this.container.getBounds();
    return b.contains(x, y);
  }
}
