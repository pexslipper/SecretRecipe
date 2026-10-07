import Phaser from 'phaser';
import { drawKitchen } from '../ui/KitchenBackdrop.js';
import { makePillButton } from '../ui/Buttons.js';
import { makeItemIcon } from '../ui/ItemToken.js';
import { MOODS, LEAVING_POSE } from '../ui/CustomerCounter.js';
import { CUSTOMER_TEXTURE, CUSTOMER_FRAME_H, customerFrame } from '../ui/CustomerSprites.js';
import { COLORS, textStyle } from '../ui/theme.js';
import { startMusic } from '../audio/Music.js';
import { t, localizedItems, levelName } from '../i18n/lang.js';
import { LEVELS, CUSTOMERS_PER_LEVEL } from '../data/levels.js';
import { isLevelOpen } from '../engine/Orders.js';

const MAX_PANEL_W = 560;
const PAD = 28;
const ROW_H = 58;
const PARCHMENT = 0xfff8ec;
const CONFETTI_COLORS = [0xf2c44f, 0xdd5a50, 0x8cc474, 0x7fb3dd, 0xb594d6, 0xf0a060];

/**
 * End of a chapter: the stars earned, how each customer felt, and where to go next.
 * Scene data: { level, orders, results, look, stars, newBest, bestStars } from CraftingScene#endChapter.
 */
export class ChapterResult extends Phaser.Scene {
  constructor() {
    super('ChapterResult');
  }

  create(data) {
    this.result = data;
    this.itemsById = new Map(localizedItems().map((item) => [item.id, item]));
    const { width, height } = this.scale;
    startMusic(this);

    drawKitchen(this, { x: 0, y: 0, w: width, h: height }, { topOverlap: 0 });
    this.add.rectangle(0, 0, width, height, 0x3a2414, 0.5).setOrigin(0);
    if (data.stars >= 3) this.confetti(width, height);

    const panelW = Math.min(MAX_PANEL_W, width - 24);
    const panel = this.buildPanel(panelW);
    const scale = Math.min(1, (height - 24) / panel.height);
    panel.container.setScale(scale).setPosition(width / 2, (height - panel.height * scale) / 2);
    panel.container.setAlpha(0).setY(panel.container.y + 30);
    this.tweens.add({ targets: panel.container, alpha: 1, y: panel.container.y - 30, duration: 450, ease: 'Back.easeOut' });

    this.input.keyboard.on('keydown-ESC', () => this.scene.start('ChapterSelect'));
    const onResize = (gameSize) => {
      if (gameSize.width !== width || gameSize.height !== height) this.scene.restart(this.result);
    };
    this.scale.on('resize', onResize);
    this.events.once('shutdown', () => this.scale.off('resize', onResize));
  }

  /** Builds the card top-down in a container centred on x = 0 with its top at y = 0. */
  buildPanel(panelW) {
    const d = this.result;
    const inner = panelW - PAD * 2;
    const left = -inner / 2;
    const c = this.add.container(0, 0);
    const add = (obj) => {
      c.add(obj);
      return obj;
    };
    const text = (x, y, str, style, origin = 0.5) => add(this.add.text(x, y, str, style).setOrigin(origin, 0));
    let y = PAD + 6;

    text(0, y, t('result.subtitle', { n: d.level + 1, name: levelName(d.level) }), textStyle(18, 600, COLORS.inkSoft));
    y += 28;
    const headline = t(d.stars === CUSTOMERS_PER_LEVEL ? 'result.perfect' : d.stars > 0 ? 'result.complete' : 'result.none');
    y += text(0, y, headline, textStyle(panelW < 420 ? 32 : 38, 700)).height + 6;

    // Big stars, popping in one by one
    for (let i = 0; i < CUSTOMERS_PER_LEVEL; i++) {
      const earned = i < d.stars;
      const star = add(this.add.text((i - (CUSTOMERS_PER_LEVEL - 1) / 2) * 56, y + 28, '★', textStyle(52, 700, earned ? '#f2b705' : '#e2d3bd', { stroke: earned ? '#b07d00' : '#cdbba3', strokeThickness: 4 })).setOrigin(0.5));
      if (earned) {
        star.setScale(0);
        this.tweens.add({ targets: star, scale: 1, delay: 450 + i * 220, duration: 300, ease: 'Back.easeOut' });
      }
    }
    y += 64;
    if (d.newBest) {
      const best = text(0, y, t('result.newBest'), textStyle(18, 700, '#b07d00'));
      this.tweens.add({ targets: best, scale: 1.12, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      y += 30;
    }
    y += 8;

    // One row per customer: who they were, what they ordered and how they felt
    d.orders.forEach((order, i) => {
      const result = d.results[i] ?? 'left';
      const cy = y + ROW_H / 2;
      const g = add(this.add.graphics());
      g.fillStyle(i % 2 ? 0xf6ead6 : 0xfbf2e3).fillRoundedRect(left, y, inner, ROW_H - 4, 10);
      // Waist-up portrait standing on the row's bottom edge, in their parting pose.
      const portrait = this.add.image(left + 34, y + ROW_H - 4, CUSTOMER_TEXTURE, customerFrame((d.look ?? 0) + i, LEAVING_POSE[result]));
      add(portrait.setOrigin(0.5, 1).setScale((ROW_H - 8) / CUSTOMER_FRAME_H));
      order.forEach((dishId, k) => {
        const icon = makeItemIcon(this, this.itemsById.get(dishId), 34).setPosition(left + 90 + k * 40, cy - 2);
        add(this.add.existing(icon));
      });
      const name = order.map((id) => this.itemsById.get(id).name).join(' + ');
      const nameX = left + 90 + order.length * 40 - 14;
      const nameText = add(this.add.text(nameX, cy - 2, name, textStyle(16, 600, COLORS.ink)).setOrigin(0, 0.5));
      const mood = MOODS[result];
      const earned = result === 'happy' || result === 'impatient';
      const moodText = add(this.add.text(left + inner - 12, cy - 2, `${mood.face} ${t(`mood.${result}`)}${earned ? ' ⭐' : ''}`, textStyle(15, 700, earned ? '#5a9a3c' : '#c0632d')).setOrigin(1, 0.5));
      const room = moodText.x - moodText.width - 10 - nameX;
      if (nameText.width > room) nameText.setScale(Math.max(0.5, room / nameText.width));
      y += ROW_H;
    });
    y += 8;

    // After the last chapter: the grand total
    if (d.level === LEVELS.length - 1) {
      const total = LEVELS.reduce((sum, _, i) => sum + (d.bestStars[i] ?? 0), 0);
      y += text(0, y, t('result.total', { stars: total, max: LEVELS.length * CUSTOMERS_PER_LEVEL }), textStyle(20, 700, '#8a5a00')).height + 8;
    }

    // Buttons
    const hasNext = d.level < LEVELS.length - 1 && isLevelOpen(d.level + 1, d.bestStars);
    const buttons = [
      { label: t('result.retry'), color: 0xf2c44f, darkColor: 0xc9952e, onClick: () => this.scene.start('CraftingScene', { level: d.level }) },
      ...(hasNext ? [{ label: t('result.next'), color: 0x8cc474, darkColor: 0x5f9a4a, onClick: () => this.scene.start('CraftingScene', { level: d.level + 1 }) }] : []),
      { label: t('result.chapters'), color: 0x72bdbd, darkColor: 0x4f9799, onClick: () => this.scene.start('ChapterSelect') },
    ];
    const sideBySide = inner >= 150 * buttons.length;
    if (sideBySide) {
      const w = inner / buttons.length;
      buttons.forEach((b, i) => add(makePillButton(this, left + w * (i + 0.5), y + 32, b.label, { ...b, minWidth: w - 12, fontSize: 20 })));
      y += 72;
    } else {
      buttons.forEach((b, i) => add(makePillButton(this, 0, y + 32 + i * 66, b.label, { ...b, minWidth: inner * 0.8 })));
      y += 66 * buttons.length + 6;
    }
    y += PAD - 10;

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
}
