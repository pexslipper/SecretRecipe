import Phaser from 'phaser';
import { COLORS, textStyle } from './theme.js';
import { makeItemLabel } from './ItemLabel.js';

const GROUPS = [
  { key: 'tool', label: 'Tools' },
  { key: 'raw', label: 'Raw' },
  { key: 'processed', label: 'Processed' },
];
const DONE_COLOR = '#5a9a3c';
const PAD_X = 18;
const PAD_Y = 10;
const HIDE_AFTER_MS = 1800;

/**
 * Small card at the top of the table telling the player how many combinations an item has left,
 * grouped by what to try it with: "Tools 0/2 · Raw 1/1 ✓ · Processed 0/3".
 * Purely informational — it never takes input, so it can't block the table.
 */
export class HintCard {
  constructor(scene, { rect, depth, itemsById, getHints }) {
    this.scene = scene;
    this.rect = rect;
    this.itemsById = itemsById;
    this.getHints = getHints;
    this.itemId = null;
    this.hideTimer = null;
    this.container = scene.add.container(rect.x + rect.w / 2, rect.y + 12).setDepth(depth).setAlpha(0).setVisible(false);
  }

  get visible() {
    return this.container.visible;
  }

  /** Show hints for an item. With `autoHideMs`, it fades away by itself after that long. */
  show(itemId, { autoHideMs = 0 } = {}) {
    const item = this.itemsById.get(itemId);
    if (!item) return;
    this.itemId = itemId;
    this.build(item, this.getHints(itemId));
    this.reveal(autoHideMs);
  }

  /** A one-line prompt in the same card (e.g. "Click an item to see its hints"). */
  showMessage(text, { autoHideMs = 0 } = {}) {
    this.itemId = null;
    this.buildLines([[new Phaser.GameObjects.Text(this.scene, 0, 0, text, textStyle(17, 700, '#c0632d'))]]);
    this.reveal(autoHideMs);
  }

  reveal(autoHideMs) {
    this.cancelHide();
    this.scene.tweens.killTweensOf(this.container);
    this.container.setVisible(true);
    this.scene.tweens.add({ targets: this.container, alpha: 1, duration: 120 });
    if (autoHideMs) this.hideSoon(autoHideMs);
  }

  hideSoon(ms = HIDE_AFTER_MS) {
    this.cancelHide();
    this.hideTimer = this.scene.time.delayedCall(ms, () => this.hide());
  }

  hide() {
    this.cancelHide();
    this.scene.tweens.killTweensOf(this.container);
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: 200,
      onComplete: () => {
        this.container.setVisible(false);
        this.itemId = null;
      },
    });
  }

  cancelHide() {
    this.hideTimer?.remove();
    this.hideTimer = null;
  }

  // ---------------------------------------------------------------- Drawing

  build(item, hints) {
    const scene = this.scene;
    const lines = [];

    // Title: item and overall progress
    const title = makeItemLabel(scene, item, textStyle(19, 700), 32);
    const allDone = hints.found === hints.total;
    const overall = new Phaser.GameObjects.Text(
      scene, 0, 0,
      allDone ? 'All combos found ✓' : `${hints.found}/${hints.total} combos found`,
      textStyle(15, 600, allDone ? DONE_COLOR : COLORS.inkSoft),
    );
    lines.push([title, overall]);

    // Per partner type
    if (!allDone) {
      const chips = GROUPS.map(({ key, label }) => {
        const g = hints[key];
        if (g.total === 0) return new Phaser.GameObjects.Text(scene, 0, 0, `${label} —`, textStyle(16, 500, '#c2ae94'));
        const done = g.found === g.total;
        return new Phaser.GameObjects.Text(
          scene, 0, 0,
          `${label} ${g.found}/${g.total}${done ? ' ✓' : ''}`,
          textStyle(16, done ? 600 : 700, done ? DONE_COLOR : COLORS.ink),
        );
      });
      lines.push(chips);
      if (hints.tryDouble) {
        const how = scene.sys.game.device.input.touch ? 'double-tap to copy' : 'double-click to copy';
        lines.push([
          new Phaser.GameObjects.Text(scene, 0, 0, `💡 Try two of these together! (${how})`, textStyle(15, 600, '#c0632d')),
        ]);
      }
    }

    this.buildLines(lines);
  }

  /** Lays out rows of text pieces, each row centred, on a parchment card. */
  buildLines(lines) {
    const scene = this.scene;
    const maxW = this.rect.w - 24;
    this.container.removeAll(true);
    const GAP = 18;
    const lineWidths = lines.map((parts) => parts.reduce((w, t) => w + t.width, 0) + GAP * (parts.length - 1));
    const width = Math.min(maxW, Math.max(...lineWidths) + PAD_X * 2);
    let y = PAD_Y;
    const placed = [];
    for (let i = 0; i < lines.length; i++) {
      const parts = lines[i];
      const lineH = Math.max(...parts.map((t) => t.height));
      let x = -lineWidths[i] / 2;
      for (const t of parts) {
        // Item labels are containers, already anchored at their left-centre.
        t.setOrigin?.(0, 0.5);
        t.setPosition(x, y + lineH / 2);
        x += t.width + GAP;
        placed.push(t);
      }
      y += lineH + (i === 0 ? 2 : 0);
    }
    const height = y + PAD_Y;

    const bg = new Phaser.GameObjects.Graphics(scene);
    bg.fillStyle(0x000000, 0.14).fillRoundedRect(-width / 2 + 2, 4, width, height, 14);
    bg.fillStyle(0xfff8ec, 0.97).fillRoundedRect(-width / 2, 0, width, height, 14);
    bg.lineStyle(3, COLORS.woodEdge).strokeRoundedRect(-width / 2, 0, width, height, 14);
    this.container.add([bg, ...placed]);
  }
}
