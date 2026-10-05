import Phaser from 'phaser';
import { COLORS, TYPE_COLORS, textStyle } from './theme.js';

export const TOKEN_RADIUS = 32;
const SHELF_LABEL_MAX_W = 94;

/**
 * Visual for one item.
 * - `workspace` variant: cream disc with a soft shadow, type-coloured ring and a name label underneath.
 * - `shelf` variant: just the icon, sitting on a sidebar shelf, with the name printed on the shelf board.
 * Uses the texture keyed by `item.icon` when it has been loaded, otherwise the emoji placeholder.
 * Input is attached to `this.hit` rather than the container.
 */
export class ItemToken extends Phaser.GameObjects.Container {
  constructor(scene, x, y, item, { variant = 'workspace' } = {}) {
    super(scene, x, y);
    this.item = item;
    this.itemId = item.id;
    this.lastDownTime = 0;

    const shelf = variant === 'shelf';
    const parts = [];

    if (!shelf) {
      parts.push(new Phaser.GameObjects.Ellipse(scene, 0, TOKEN_RADIUS - 2, TOKEN_RADIUS * 1.8, 12, 0x000000, 0.14));
      const disc = new Phaser.GameObjects.Arc(scene, 0, 0, TOKEN_RADIUS, 0, 360, false, 0xfff8ec);
      disc.setStrokeStyle(4, TYPE_COLORS[item.type] ?? 0xc4925f);
      parts.push(disc);
    }

    // Invisible circle used for hit-testing in the shelf variant; the disc itself otherwise.
    const hit = shelf
      ? new Phaser.GameObjects.Arc(scene, 0, 0, TOKEN_RADIUS + 6, 0, 360, false, 0xffffff, 0)
      : parts[parts.length - 1];
    if (shelf) parts.push(hit);

    const iconSize = shelf ? 42 : 32;
    let icon;
    if (scene.textures.exists(item.icon)) {
      icon = new Phaser.GameObjects.Image(scene, 0, 0, item.icon);
      icon.setDisplaySize(iconSize * 1.3, iconSize * 1.3);
    } else {
      icon = new Phaser.GameObjects.Text(scene, 0, 0, item.emoji ?? '?', {
        fontSize: iconSize,
        padding: { y: 8 },
      }).setOrigin(0.5);
    }
    parts.push(icon);

    const label = new Phaser.GameObjects.Text(
      scene,
      0,
      shelf ? 37 : TOKEN_RADIUS + 13,
      item.name,
      textStyle(shelf ? 15 : 14, 600, COLORS.ink, shelf ? {} : { stroke: COLORS.cream, strokeThickness: 4 }),
    ).setOrigin(0.5);
    if (shelf) {
      // Shrink long names so they don't run into the neighbouring shelf slot.
      for (let size = 15; label.width > SHELF_LABEL_MAX_W && size > 11; size--) label.setFontSize(size - 1);
    }
    parts.push(label);

    this.add(parts);
    this.hit = hit;
    hit.setInteractive({ useHandCursor: true });

    scene.add.existing(this);
  }

  setInputEnabled(enabled) {
    if (this.hit.input) this.hit.input.enabled = enabled;
    return this;
  }
}
