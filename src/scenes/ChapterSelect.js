import Phaser from 'phaser';
import { drawKitchen, drawPlank } from '../ui/KitchenBackdrop.js';
import { makePillButton } from '../ui/Buttons.js';
import { COLORS, textStyle } from '../ui/theme.js';
import { startMusic } from '../audio/Music.js';
import { LEVELS, CUSTOMERS_PER_LEVEL } from '../data/levels.js';
import { loadSave, resetGame } from '../data/save.js';
import { isLevelOpen } from '../engine/Orders.js';

const CARD_H = 132;
const GAP = 14;
const PAD = 20;
const PARCHMENT = 0xfff8ec;

/** The six chapters, each with its best score. Tap an open one to play it. */
export class ChapterSelect extends Phaser.Scene {
  constructor() {
    super('ChapterSelect');
  }

  create() {
    const { width, height } = this.scale;
    startMusic(this);
    this.best = loadSave()?.levels ?? {};

    drawKitchen(this, { x: 0, y: 0, w: width, h: height }, { topOverlap: 0 });
    this.add.rectangle(0, 0, width, height, 0x3a2414, 0.35).setOrigin(0);

    const panel = this.buildPanel(Math.min(860, width - 24));
    const scale = Math.min(1, (height - 24) / panel.height);
    panel.container.setScale(scale).setPosition(width / 2, (height - panel.height * scale) / 2);

    this.input.keyboard.on('keydown-ESC', () => this.scene.start('MainMenu'));
    const onResize = (gameSize) => {
      if (gameSize.width !== width || gameSize.height !== height) this.scene.restart();
    };
    this.scale.on('resize', onResize);
    this.events.once('shutdown', () => this.scale.off('resize', onResize));
  }

  /** Builds everything in a container centred on x = 0 with its top at y = 0. */
  buildPanel(panelW) {
    const c = this.add.container(0, 0);
    const add = (obj) => {
      c.add(obj);
      return obj;
    };
    const inner = panelW - PAD * 2;
    let y = 0;

    // Title sign with the total score
    const total = LEVELS.reduce((sum, _, i) => sum + (this.best[i] ?? 0), 0);
    const signW = Math.min(460, panelW);
    const sign = drawPlank(this, -signW / 2, y, signW, 96);
    c.add(sign);
    add(this.add.text(0, y + 32, 'Chapters', textStyle(signW < 400 ? 34 : 40, 700)).setOrigin(0.5));
    add(this.add.text(0, y + 70, `⭐ ${total} / ${LEVELS.length * CUSTOMERS_PER_LEVEL}`, textStyle(20, 700, '#8a5a00')).setOrigin(0.5));
    y += 96 + 18;

    // Chapter cards
    const cols = inner >= 760 ? 3 : 2;
    const cardW = (inner - GAP * (cols - 1)) / cols;
    LEVELS.forEach((level, i) => {
      const x = -inner / 2 + (i % cols) * (cardW + GAP);
      const cy = y + Math.floor(i / cols) * (CARD_H + GAP);
      add(this.buildCard(level, i, x, cy, cardW));
    });
    y += Math.ceil(LEVELS.length / cols) * (CARD_H + GAP) + 18;

    // Buttons
    const sideBySide = inner >= 420;
    const back = { label: 'Back', color: 0x72bdbd, darkColor: 0x4f9799, onClick: () => this.scene.start('MainMenu') };
    const reset = { label: 'Reset progress', color: 0xec7d7e, darkColor: 0xc65a5c, onClick: () => this.resetProgress() };
    const make = (cfg, x, by) => add(makePillButton(this, x, by, cfg.label, { ...cfg, minWidth: sideBySide ? 190 : inner * 0.8 }));
    if (sideBySide) {
      make(back, -inner / 4, y + 30);
      make(reset, inner / 4, y + 30);
      y += 70;
    } else {
      make(back, 0, y + 30);
      make(reset, 0, y + 98);
      y += 138;
    }
    return { container: c, height: y };
  }

  buildCard(level, i, x, y, w) {
    const open = isLevelOpen(i, this.best);
    const best = this.best[i];
    const card = this.add.container(x, y);

    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.18).fillRoundedRect(3, 6, w, CARD_H, 18);
    g.fillStyle(COLORS.woodDark).fillRoundedRect(0, 0, w, CARD_H, 18);
    g.lineStyle(3, COLORS.woodEdge).strokeRoundedRect(0, 0, w, CARD_H, 18);
    g.fillStyle(open ? PARCHMENT : 0xe9dccb).fillRoundedRect(8, 8, w - 16, CARD_H - 16, 12);
    card.add(g);

    const title = this.add.text(22, 18, `Chapter ${i + 1}`, textStyle(15, 700, COLORS.inkSoft));
    const name = this.add.text(22, 38, level.name, textStyle(w < 240 ? 20 : 23, 700, open ? COLORS.ink : '#a08466'));
    const blurb = this.add.text(22, 70, open ? level.blurb : `Earn a ⭐ in Chapter ${i} first`, textStyle(14, 500, COLORS.inkSoft, { wordWrap: { width: w - 44 } }));
    card.add([title, name, blurb]);
    if (name.width > w - 44) name.setScale((w - 44) / name.width);

    if (open) {
      const stars = Array.from({ length: CUSTOMERS_PER_LEVEL }, (_, s) => (s < (best ?? 0) ? '★' : '☆')).join('');
      card.add(this.add.text(22, CARD_H - 28, stars, textStyle(22, 700, best ? '#e0a800' : '#cdbba3')).setOrigin(0, 0.5));
      const play = this.add.text(w - 22, CARD_H - 28, best === undefined ? 'Play ▶' : 'Replay ↻', textStyle(16, 700, '#5a9a3c')).setOrigin(1, 0.5);
      card.add(play);

      const hit = this.add.zone(0, 0, w, CARD_H).setOrigin(0).setInteractive({ useHandCursor: true });
      hit.on('pointerover', () => this.tweens.add({ targets: card, y: y - 3, duration: 80 }));
      hit.on('pointerout', () => this.tweens.add({ targets: card, y, duration: 80 }));
      hit.on('pointerdown', () => this.scene.start('CraftingScene', { level: i }));
      card.add(hit);
    } else {
      card.add(this.add.text(w - 30, 32, '🔒', { fontSize: 28, padding: { y: 6 } }).setOrigin(0.5));
    }
    return card;
  }

  resetProgress() {
    if (!window.confirm('Reset all progress? Stars, recipes and unlocked items will be lost.')) return;
    resetGame(this.registry);
    this.scene.restart();
  }
}
