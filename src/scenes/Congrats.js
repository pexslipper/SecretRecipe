import Phaser from 'phaser';
import { drawKitchen } from '../ui/KitchenBackdrop.js';
import { makePillButton } from '../ui/Buttons.js';
import { COLORS, textStyle } from '../ui/theme.js';
import { CHAPTERS_BY_KEY } from '../data/chapters.js';
import { resetGame, CONGRATS_SEEN_KEY } from '../data/save.js';
import { formatPlayTime } from '../engine/PlayClock.js';

const MAX_PANEL_W = 600;
const PAD = 28;
const CHIP_H = 64;
const GAP = 10;
const PARCHMENT = 0xfff8ec;
const CONFETTI_COLORS = [0xf2c44f, 0xdd5a50, 0x8cc474, 0x7fb3dd, 0xb594d6, 0xf0a060];

/**
 * Shown once every recipe has been collected: total play time, a medal per Recipe Book chapter and
 * a few totals, with buttons to start a new game or go back and look around the finished kitchen.
 * Scene data is the summary from CraftingScene#summary().
 */
export class Congrats extends Phaser.Scene {
  constructor() {
    super('Congrats');
  }

  create(summary) {
    this.summary = summary;
    const { width, height } = this.scale;
    this.registry.set(CONGRATS_SEEN_KEY, true);

    drawKitchen(this, { x: 0, y: 0, w: width, h: height }, { topOverlap: 0 });
    this.add.rectangle(0, 0, width, height, 0x3a2414, 0.5).setOrigin(0);
    this.confetti(width, height);

    const panelW = Math.min(MAX_PANEL_W, width - 24);
    const panel = this.buildPanel(panelW);
    // Fit the whole card on screen: shrink it on short screens, then centre it.
    const scale = Math.min(1, (height - 24) / panel.height);
    panel.container.setScale(scale).setPosition(width / 2, (height - panel.height * scale) / 2);
    panel.container.setAlpha(0).setY(panel.container.y + 30);
    this.tweens.add({ targets: panel.container, alpha: 1, y: panel.container.y - 30, duration: 450, ease: 'Back.easeOut' });

    this.input.keyboard.on('keydown-ESC', () => this.scene.start('MainMenu'));
    const onResize = (gameSize) => {
      if (gameSize.width !== width || gameSize.height !== height) this.scene.restart(this.summary);
    };
    this.scale.on('resize', onResize);
    this.events.once('shutdown', () => this.scale.off('resize', onResize));
  }

  /** Builds the card top-down in a container centred on x = 0 with its top at y = 0. */
  buildPanel(panelW) {
    const s = this.summary;
    const inner = panelW - PAD * 2;
    const left = -inner / 2;
    const c = this.add.container(0, 0);
    const add = (obj) => {
      c.add(obj);
      return obj;
    };
    const text = (x, y, str, style, origin = 0.5) => add(this.add.text(x, y, str, style).setOrigin(origin, 0));
    let y = PAD + 4;

    const trophy = text(0, y, '🏆', { fontSize: 64, padding: { y: 10 } });
    this.tweens.add({ targets: trophy, angle: { from: -6, to: 6 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    y += trophy.height;
    y += text(0, y, 'Congratulations!', textStyle(panelW < 420 ? 34 : 42, 700)).height;
    y += text(0, y, `You collected all ${s.recipesTotal} recipes!`, textStyle(20, 500, '#8a6446', { align: 'center', wordWrap: { width: inner } })).height + 14;

    // Play time
    const timeH = 92;
    const timeBox = add(this.add.graphics());
    timeBox.fillStyle(0xf6d365, 0.45).fillRoundedRect(left, y, inner, timeH, 16);
    timeBox.lineStyle(2, 0xd4a017, 0.8).strokeRoundedRect(left, y, inner, timeH, 16);
    text(0, y + 8, '⏱ Time in the kitchen', textStyle(17, 600, '#8a5a00'));
    text(0, y + 32, formatPlayTime(s.playMs), textStyle(42, 700, COLORS.ink));
    y += timeH + 20;

    // Achievements: one medal per chapter
    text(left, y, 'Achievements', textStyle(22, 700), 0);
    y += 38;
    const cols = inner >= 440 ? 3 : 2;
    const chipW = (inner - GAP * (cols - 1)) / cols;
    s.chapters.forEach((entry, i) => {
      const chapter = CHAPTERS_BY_KEY.get(entry.key);
      const done = entry.served === entry.total;
      const x = left + (i % cols) * (chipW + GAP);
      const cy = y + Math.floor(i / cols) * (CHIP_H + GAP);
      const g = add(this.add.graphics());
      g.fillStyle(chapter.color, done ? 0.3 : 0.12).fillRoundedRect(x, cy, chipW, CHIP_H, 14);
      g.lineStyle(2, chapter.color, done ? 0.85 : 0.35).strokeRoundedRect(x, cy, chipW, CHIP_H, 14);
      const medal = add(this.add.text(x + 28, cy + CHIP_H / 2, done ? '🏅' : '🔒', { fontSize: 30, padding: { y: 6 } }).setOrigin(0.5));
      if (done) this.tweens.add({ targets: medal, scale: 1.15, duration: 300, delay: 500 + i * 120, yoyo: true, ease: 'Sine.easeInOut' });
      const name = add(this.add.text(x + 52, cy + 12, chapter.name, textStyle(15, 700, COLORS.ink)).setOrigin(0, 0));
      if (name.width > chipW - 58) name.setScale((chipW - 58) / name.width);
      add(this.add.text(x + 52, cy + 34, `${entry.served}/${entry.total} recipes`, textStyle(13, 600, done ? '#b07d00' : COLORS.inkSoft)).setOrigin(0, 0));
    });
    y += Math.ceil(s.chapters.length / cols) * (CHIP_H + GAP) + 12;

    // Totals
    const stats = [
      [String(s.dishes), 'dishes served'],
      [String(s.disasters), 'kitchen disasters'],
      [`${s.combos}/${s.combosTotal}`, 'combinations'],
    ];
    const statW = inner / stats.length;
    stats.forEach(([value, label], i) => {
      const x = left + statW * (i + 0.5);
      text(x, y, value, textStyle(28, 700, COLORS.ink));
      text(x, y + 38, label, textStyle(14, 500, COLORS.inkSoft));
    });
    y += 76;

    // Buttons: side by side when they fit, stacked otherwise
    const again = { label: 'Play again', color: 0x8cc474, darkColor: 0x5f9a4a, onClick: () => this.playAgain() };
    const back = { label: 'Back to kitchen', color: 0x72bdbd, darkColor: 0x4f9799, onClick: () => this.backToKitchen() };
    const sideBySide = inner >= 400;
    const btnY = y + 32;
    const make = (cfg, x, by) => add(makePillButton(this, x, by, cfg.label, { ...cfg, minWidth: sideBySide ? 180 : inner * 0.8 }));
    if (sideBySide) {
      make(again, -inner / 4 + 4, btnY);
      make(back, inner / 4 - 4, btnY);
      y += 72;
    } else {
      make(again, 0, btnY);
      make(back, 0, btnY + 68);
      y += 140;
    }
    y += PAD - 6;

    // Wooden frame and parchment behind everything
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.18).fillRoundedRect(-panelW / 2 + 4, 8, panelW, y, 22);
    bg.fillStyle(COLORS.woodDark).fillRoundedRect(-panelW / 2, 0, panelW, y, 22);
    bg.lineStyle(3, COLORS.woodEdge).strokeRoundedRect(-panelW / 2, 0, panelW, y, 22);
    bg.fillStyle(PARCHMENT).fillRoundedRect(-panelW / 2 + 12, 12, panelW - 24, y - 24, 14);
    c.addAt(bg, 0);

    return { container: c, height: y + 8 };
  }

  /** Paper confetti drifting down behind the card. */
  confetti(width, height) {
    const count = Math.round(Math.min(90, width / 10));
    for (let i = 0; i < count; i++) {
      const piece = this.add
        .rectangle(Math.random() * width, -20 - Math.random() * height, 6 + Math.random() * 6, 10 + Math.random() * 8, Phaser.Utils.Array.GetRandom(CONFETTI_COLORS))
        .setAngle(Math.random() * 360);
      const fall = () => {
        piece.setPosition(Math.random() * width, -20);
        this.tweens.add({
          targets: piece,
          y: height + 20,
          x: piece.x + (Math.random() - 0.5) * 160,
          angle: piece.angle + 360 + Math.random() * 360,
          duration: 3500 + Math.random() * 3000,
          onComplete: fall,
        });
      };
      // First drop starts somewhere above the screen so the pieces arrive spread out.
      this.tweens.add({
        targets: piece,
        y: height + 20,
        angle: piece.angle + 360,
        duration: 3500 + Math.random() * 3000,
        onComplete: fall,
      });
    }
  }

  playAgain() {
    if (!window.confirm('Start a new game? Your progress and time will be reset.')) return;
    resetGame(this.registry);
    this.scene.start('CraftingScene');
  }

  backToKitchen() {
    this.scene.start('CraftingScene');
  }
}
