import Phaser from 'phaser';
import { textStyle } from './theme.js';

function wireHover(scene, container, hit, onClick) {
  const baseY = container.y;
  hit.setInteractive({ useHandCursor: true });
  hit.on('pointerover', () => scene.tweens.add({ targets: container, y: baseY - 2, duration: 80 }));
  hit.on('pointerout', () => scene.tweens.add({ targets: container, y: baseY, duration: 80 }));
  hit.on('pointerdown', () => {
    scene.tweens.add({ targets: container, scale: 0.94, duration: 60, yoyo: true });
    onClick();
  });
}

/** Glossy round candy-style button (Reset / Clear). */
export function makeRoundButton(scene, x, y, radius, label, { color, darkColor, onClick, fontSize = Math.round(radius * 0.55) }) {
  const g = new Phaser.GameObjects.Graphics(scene);
  g.fillStyle(0x000000, 0.12).fillCircle(0, 6, radius);
  g.fillStyle(darkColor).fillCircle(0, 3, radius);
  g.fillStyle(color).fillCircle(0, 0, radius - 2);
  g.fillStyle(0xffffff, 0.28).fillEllipse(0, -radius * 0.42, radius * 1.15, radius * 0.6);
  g.lineStyle(2, 0xffffff, 0.5).strokeCircle(0, 0, radius - 2);

  const darkHex = `#${darkColor.toString(16).padStart(6, '0')}`;
  const text = new Phaser.GameObjects.Text(
    scene, 0, 1, label,
    textStyle(fontSize, 700, '#ffffff', { stroke: darkHex, strokeThickness: 4 }),
  ).setOrigin(0.5);

  const hit = new Phaser.GameObjects.Zone(scene, 0, 0, radius * 2, radius * 2);
  const container = scene.add.container(x, y, [g, text, hit]);
  wireHover(scene, container, hit, onClick);
  return container;
}

const RIBBON_LEFT = 30;
const RIBBON_TEXT_PAD = 26;
const RIBBON_TAIL = 28;
const RIBBON_MIN_W = 166;

function drawRibbon(g, width) {
  const right = RIBBON_LEFT + width;
  const pts = [
    { x: RIBBON_LEFT, y: 8 },
    { x: right, y: 8 },
    { x: right - 14, y: 28 },
    { x: right, y: 48 },
    { x: RIBBON_LEFT, y: 48 },
  ];
  g.clear();
  g.fillStyle(0x000000, 0.12).fillPoints(pts.map((p) => ({ x: p.x, y: p.y + 4 })), true);
  g.fillStyle(0xdd5a50).fillPoints(pts, true);
  g.fillStyle(0xef7d70).fillRect(RIBBON_LEFT, 10, width - 16, 9);
  g.lineStyle(2, 0xb03e36).strokePoints(pts, true);
  g.lineStyle(1.5, 0xffd9d0, 0.7);
  for (let sx = RIBBON_LEFT + 10; sx < right - 24; sx += 10) g.lineBetween(sx, 42, sx + 5, 42);
  // little green bookmark tab
  const tab = right - 34;
  g.fillStyle(0x7cc0a0).fillRect(tab, 0, 12, 14);
  g.fillStyle(0x7cc0a0).fillTriangle(tab, 14, tab + 12, 14, tab + 6, 9);
}

/**
 * Red ribbon banner with an open recipe book on its left end. The ribbon grows to fit its label;
 * call `container.setLabel(text)` to change it.
 */
export function makeRibbonButton(scene, x, y, label, onClick) {
  const g = new Phaser.GameObjects.Graphics(scene);
  const text = new Phaser.GameObjects.Text(
    scene, 0, 28, '',
    textStyle(21, 700, '#fff4e6', { stroke: '#a83a33', strokeThickness: 4 }),
  ).setOrigin(0.5);
  const book = new Phaser.GameObjects.Text(scene, 22, 28, '📖', { fontSize: 42, padding: { y: 6 } }).setOrigin(0.5);
  const hit = new Phaser.GameObjects.Zone(scene, 0, 28, 1, 56).setOrigin(0, 0.5);
  const container = scene.add.container(x, y, [g, text, book, hit]);

  container.setLabel = (str) => {
    text.setText(str);
    // Text sits between the book (left) and the notched tail (right).
    const textLeft = RIBBON_LEFT + RIBBON_TEXT_PAD;
    const width = Math.max(RIBBON_MIN_W, RIBBON_TEXT_PAD + text.width + RIBBON_TAIL);
    const right = RIBBON_LEFT + width;
    drawRibbon(g, width);
    text.setX((textLeft + right - RIBBON_TAIL) / 2 + 4);
    hit.setSize(right, 56);
    container.ribbonWidth = right;
    return container;
  };
  container.setLabel(label);

  wireHover(scene, container, hit, onClick);
  return container;
}
