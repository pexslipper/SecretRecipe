import Phaser from 'phaser';
import { ItemToken } from './ItemToken.js';
import { COLORS, textStyle } from './theme.js';
import { t } from '../i18n/lang.js';

const AUTO_CLOSE_MS = 4000;
// Ignore taps for a moment so the press that caused the discovery can't skip its card.
const GRACE_MS = 350;
const MAX_W = 440;

/**
 * Big "NEW!" card for first-time discoveries, unlocks and completed chapters.
 * Cards queue up and show one at a time; tap anywhere (or wait) to continue.
 *
 * enqueue({ banner, bannerColor, item | icon, title, desc, footer (string or () => string), onShow, onClose, holdMs })
 */
export class RevealCard {
  constructor(scene, { depth }) {
    this.scene = scene;
    this.depth = depth;
    this.queue = [];
    this.current = null;
    scene.events.once('shutdown', () => this.queue.splice(0));
  }

  get isOpen() {
    return this.current !== null;
  }

  enqueue(card) {
    this.queue.push(card);
    if (!this.current) this.showNext();
  }

  showNext() {
    const card = this.queue.shift();
    if (!card) {
      this.current = null;
      return;
    }
    const scene = this.scene;
    const { width, height } = scene.scale;
    const cardW = Math.min(MAX_W, width - 48);
    const objects = [];
    const touch = scene.sys.game.device.input.touch;

    const overlay = scene.add.rectangle(0, 0, width, height, 0x3a2414, 0.5).setOrigin(0).setDepth(this.depth).setAlpha(0);
    overlay.setInteractive();
    objects.push(overlay);
    scene.tweens.add({ targets: overlay, alpha: 1, duration: 150 });

    const box = scene.add.container(width / 2, height / 2).setDepth(this.depth + 1);
    objects.push(box);

    // Content, top to bottom (y relative to the token's centre, fixed up once heights are known).
    const wrap = { wordWrap: { width: cardW - 48 }, align: 'center' };
    const title = new Phaser.GameObjects.Text(scene, 0, 0, card.title ?? card.item.name, textStyle(30, 700, COLORS.ink, wrap)).setOrigin(0.5, 0);
    const desc = new Phaser.GameObjects.Text(scene, 0, 0, card.desc ?? card.item?.desc ?? '', textStyle(19, 500, '#8a6446', wrap)).setOrigin(0.5, 0);
    const footerText = typeof card.footer === 'function' ? card.footer() : card.footer;
    const footer = footerText
      ? new Phaser.GameObjects.Text(scene, 0, 0, footerText, textStyle(16, 600, '#5a8fc4', wrap)).setOrigin(0.5, 0)
      : null;
    const prompt = new Phaser.GameObjects.Text(scene, 0, 0, t(touch ? 'reveal.continue.touch' : 'reveal.continue.mouse'), textStyle(14, 500, COLORS.inkSoft)).setOrigin(0.5, 0);

    const TOKEN_Y = 0;
    let y = TOKEN_Y + 78;
    title.setY(y);
    y += title.height + 2;
    if (desc.text) {
      desc.setY(y);
      y += desc.height + 6;
    }
    if (footer) {
      footer.setY(y + 4);
      y += footer.height + 10;
    }
    prompt.setY(y + 4);
    y += prompt.height + 18;
    const top = TOKEN_Y - 96;
    const cardH = y - top;
    // Centre the whole card on screen; `cy` is where the token ends up.
    const cy = height / 2 - (top + cardH / 2);
    box.setY(cy);

    // Sunburst behind everything
    const rays = new Phaser.GameObjects.Graphics(scene);
    rays.fillStyle(0xffe08a, 0.35);
    const R = Math.max(cardW, cardH) * 0.8;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      rays.fillTriangle(0, 0, Math.cos(a - 0.12) * R, Math.sin(a - 0.12) * R, Math.cos(a + 0.12) * R, Math.sin(a + 0.12) * R);
    }
    // Between the overlay and the card, so the rays fan out from behind it.
    const raysHolder = scene.add.container(width / 2, cy + TOKEN_Y, [rays]).setDepth(this.depth + 0.5);
    objects.push(raysHolder);
    scene.tweens.add({ targets: rays, angle: 360, duration: 14000, repeat: -1 });

    const bg = new Phaser.GameObjects.Graphics(scene);
    bg.fillStyle(0x000000, 0.18).fillRoundedRect(-cardW / 2 + 4, top + 8, cardW, cardH, 22);
    bg.fillStyle(COLORS.woodDark).fillRoundedRect(-cardW / 2, top, cardW, cardH, 22);
    bg.lineStyle(3, COLORS.woodEdge).strokeRoundedRect(-cardW / 2, top, cardW, cardH, 22);
    bg.fillStyle(0xfff8ec).fillRoundedRect(-cardW / 2 + 10, top + 10, cardW - 20, cardH - 20, 14);

    // Banner pill sticking out of the top edge
    const bannerText = new Phaser.GameObjects.Text(scene, 0, top, card.banner, textStyle(22, 700, '#ffffff', { stroke: '#00000033', strokeThickness: 2 })).setOrigin(0.5);
    const bw = bannerText.width + 44;
    const banner = new Phaser.GameObjects.Graphics(scene);
    banner.fillStyle(0x000000, 0.15).fillRoundedRect(-bw / 2 + 2, top - 18 + 4, bw, 38, 19);
    banner.fillStyle(card.bannerColor ?? 0xdd5a50).fillRoundedRect(-bw / 2, top - 18, bw, 38, 19);

    const glow = new Phaser.GameObjects.Arc(scene, 0, TOKEN_Y, 58, 0, 360, false, 0xffe9a8, 0.8);
    box.add([bg, glow, banner, bannerText, title, desc, prompt]);
    if (footer) box.add(footer);
    if (card.item) {
      const token = new ItemToken(scene, 0, TOKEN_Y, card.item).setScale(1.6);
      token.setInputEnabled(false);
      token.list[token.list.length - 1].setVisible(false); // the name is shown big underneath instead
      box.add(token);
      scene.tweens.add({ targets: token, scale: 1.75, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    } else if (card.icon) {
      box.add(new Phaser.GameObjects.Text(scene, 0, TOKEN_Y, card.icon, { fontSize: 64, padding: { y: 10 } }).setOrigin(0.5));
    }

    box.setScale(0);
    raysHolder.setScale(0);
    scene.tweens.add({ targets: [box, raysHolder], scale: 1, duration: 380, ease: 'Back.easeOut' });
    this.sparkle(width / 2, cy + TOKEN_Y);

    this.current = { card, objects, shownAt: scene.time.now };
    card.onShow?.();
    overlay.on('pointerdown', () => {
      if (scene.time.now - this.current.shownAt >= GRACE_MS) this.close();
    });
    this.current.timer = scene.time.delayedCall(AUTO_CLOSE_MS, () => this.close());
  }

  close() {
    if (!this.current?.card) return; // nothing showing (or pausing between cards)
    const { card, objects, timer } = this.current;
    timer?.remove();
    const scene = this.scene;
    for (const o of objects) {
      o.disableInteractive?.();
      scene.tweens.killTweensOf(o);
    }
    scene.tweens.add({
      targets: objects,
      alpha: 0,
      duration: 160,
      onComplete: () => objects.forEach((o) => o.destroy()),
    });
    card.onClose?.();
    // `holdMs`: pause before the next card so an animation started by onClose can be seen.
    if (card.holdMs && this.queue.length) {
      this.current = { card: null, objects: [], shownAt: Infinity };
      this.current.timer = scene.time.delayedCall(card.holdMs, () => {
        this.current = null;
        this.showNext();
      });
    } else {
      this.current = null;
      this.showNext();
    }
  }

  sparkle(x, y) {
    const colors = [0xf2c230, 0xffffff, 0xff9f43, 0x8fd3ff];
    for (let i = 0; i < 18; i++) {
      const angle = (Math.PI * 2 * i) / 18 + Math.random() * 0.3;
      const dist = 90 + Math.random() * 70;
      const dot = this.scene.add.star(x, y, 4, 3, 8, Phaser.Utils.Array.GetRandom(colors)).setDepth(this.depth + 2);
      this.scene.tweens.add({
        targets: dot,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        angle: 180,
        alpha: 0,
        duration: 800 + Math.random() * 300,
        ease: 'Cubic.easeOut',
        onComplete: () => dot.destroy(),
      });
    }
  }
}
