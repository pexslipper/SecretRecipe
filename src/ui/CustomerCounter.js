import Phaser from 'phaser';
import { COLORS, textStyle } from './theme.js';
import { makeItemLabel } from './ItemLabel.js';
import { moodAt, moodColor } from '../engine/Orders.js';
import { HAPPY_ABOVE, ANGRY_BELOW } from '../data/levels.js';
import { t } from '../i18n/lang.js';
import { CUSTOMER_TEXTURE, CUSTOMER_FRAME_W, CUSTOMER_FRAME_H, customerFrame, characterHeight } from './CustomerSprites.js';

const PLANK_H = 20;
const BAR_W = 118;
const BAR_H = 20;
const BAR_SPACE = 30; // room above the tallest head for the patience bar
const HIDDEN = 12; // how far the customer's waist reaches down behind the plank
const BUBBLE_GAP = 6;
const WALK_MS = 520;
const SIGN_W = 132;
const SIGN_H = 50;

// Each mood's face; its name is the `mood.<key>` string (see src/i18n/strings.js).
export const MOODS = {
  happy: { face: '😊' },
  impatient: { face: '😐' },
  angry: { face: '😠' },
  left: { face: '😤' },
};

/** How the customer stands while waiting: calm, then arms crossed, then fidgeting, then scolding. */
function waitingPose(fractionLeft) {
  if (fractionLeft >= HAPPY_ABOVE) return 'idle';
  if (fractionLeft >= (HAPPY_ABOVE + ANGRY_BELOW) / 2) return 'armsCrossed';
  if (fractionLeft >= ANGRY_BELOW) return 'fidget';
  return 'scold';
}

/** How they react on the way out, by how they felt when the food came (or 'left' with none). */
export const LEAVING_POSE = { happy: 'thumbsUp', impatient: 'wave', angry: 'sigh', left: 'furious' };

/**
 * The band at the top of the table: a counter plank, the customer standing behind it with a
 * patience bar over their head, a speech bubble with what they'd like, and a little sign in the
 * corner with the chapter's progress.
 */
export class CustomerCounter {
  constructor(scene, { rect, itemsById, depth }) {
    this.scene = scene;
    this.rect = rect;
    this.itemsById = itemsById;
    this.depth = depth;
    this.customer = null;
    this.bubble = null;
    this.bar = null;
    this.slots = new Map(); // dishId → its label in the bubble
    this.mood = 'happy';

    // Waist-up behind the plank, scaled so the tallest character leaves room for the bar.
    this.feetY = rect.y + rect.h - PLANK_H + HIDDEN;
    this.scale = (this.feetY - rect.y - BAR_SPACE) / CUSTOMER_FRAME_H;
    this.halfW = (CUSTOMER_FRAME_W * this.scale) / 2;
    this.homeX = rect.x + 10 + this.halfW;
    this.character = 0;
    this.pose = null;

    this.drawPlank();
    this.sign = scene.add.container(rect.x + rect.w - SIGN_W / 2 - 10, rect.y + SIGN_H / 2 + 8).setDepth(depth + 1);
  }

  /** "Chapter 2 · 3/5" and a star per customer: gold if earned, faded if missed, outline if still to come. */
  setSign(levelIndex, customerIndex, results, total) {
    const scene = this.scene;
    this.sign.removeAll(true);
    const g = new Phaser.GameObjects.Graphics(scene);
    g.fillStyle(0x000000, 0.14).fillRoundedRect(-SIGN_W / 2 + 2, -SIGN_H / 2 + 3, SIGN_W, SIGN_H, 10);
    g.fillStyle(0x4a3527).fillRoundedRect(-SIGN_W / 2, -SIGN_H / 2, SIGN_W, SIGN_H, 10);
    g.lineStyle(3, COLORS.woodEdge).strokeRoundedRect(-SIGN_W / 2, -SIGN_H / 2, SIGN_W, SIGN_H, 10);
    const shown = Math.min(customerIndex + 1, total);
    const title = new Phaser.GameObjects.Text(scene, 0, -11, t('sign.progress', { n: levelIndex + 1, shown, total }), textStyle(14, 700, COLORS.chalk)).setOrigin(0.5);
    const stars = [];
    for (let i = 0; i < total; i++) {
      const result = results[i];
      const earned = result === 'happy' || result === 'impatient';
      const pending = result === undefined;
      const color = earned ? '#f6c945' : pending ? '#d9c9b0' : '#7a6656';
      const star = new Phaser.GameObjects.Text(scene, (i - (total - 1) / 2) * 22, 11, pending ? '☆' : '★', textStyle(19, 700, color));
      stars.push(star.setOrigin(0.5));
    }
    this.sign.add([g, title, ...stars]);
    return stars;
  }

  /** Where the star for customer `i` sits on the sign (for the "+⭐" effect). */
  starPoint(i, total) {
    return { x: this.sign.x + (i - (total - 1) / 2) * 22, y: this.sign.y + 11 };
  }

  drawPlank() {
    const { x, y, w, h } = this.rect;
    const g = this.scene.add.graphics().setDepth(this.depth + 2);
    const top = y + h - PLANK_H;
    g.fillStyle(0x000000, 0.14).fillRect(x, top + PLANK_H, w, 5);
    g.fillStyle(COLORS.woodLight).fillRect(x, top, w, PLANK_H);
    g.fillStyle(0xe6bd88).fillRect(x, top + PLANK_H - 6, w, 6);
    g.lineStyle(2, COLORS.woodGrain, 0.9);
    for (let gx = x + 30; gx < x + w - 60; gx += 170) g.lineBetween(gx, top + 8, gx + 60, top + 9);
    g.lineStyle(2, COLORS.woodEdge).strokeRect(x, top, w, PLANK_H);
  }

  /** A new customer walks in from the left with their order. `served` are dishes already handed over. */
  arrive(order, character, { served = [], instant = false } = {}) {
    this.clear();
    const scene = this.scene;
    this.character = character;
    this.headTop = this.feetY - characterHeight(character) * this.scale;

    this.customer = scene.add
      .image(instant ? this.homeX : this.rect.x - this.halfW, this.feetY, CUSTOMER_TEXTURE, customerFrame(character, 'wave'))
      .setOrigin(0.5, 1)
      .setScale(this.scale)
      .setDepth(this.depth);
    this.bar = this.buildBar().setPosition(this.homeX, this.headTop - BAR_H / 2 - 4);
    this.bubble = this.buildBubble(order, served);

    if (instant) {
      this.setPose(waitingPose(1));
      return;
    }
    this.bar.setAlpha(0);
    this.bubble.setAlpha(0).setScale(0.6);
    // Waves while walking in, then settles into the mood's pose.
    scene.tweens.add({ targets: this.customer, x: this.homeX, duration: WALK_MS, ease: 'Quad.easeOut' });
    scene.tweens.add({ targets: this.customer, y: this.feetY - 6, duration: WALK_MS / 4, yoyo: true, repeat: 1 });
    scene.tweens.add({ targets: this.bar, alpha: 1, delay: WALK_MS - 100, duration: 200 });
    scene.tweens.add({ targets: this.bubble, alpha: 1, scale: 1, delay: WALK_MS, duration: 260, ease: 'Back.easeOut' });
    this.waveTimer = scene.time.delayedCall(WALK_MS + 700, () => {
      this.waveTimer = null;
      if (this.customer) this.setPose(waitingPose(this.fraction ?? 1));
    });
    this.setPose('wave');
  }

  setPose(pose) {
    if (!this.customer || pose === this.pose) return;
    this.pose = pose;
    this.customer.setFrame(customerFrame(this.character, pose));
  }

  buildBar() {
    const scene = this.scene;
    const bg = new Phaser.GameObjects.Graphics(scene);
    bg.fillStyle(0x000000, 0.18).fillRoundedRect(-BAR_W / 2, -BAR_H / 2 + 3, BAR_W, BAR_H, BAR_H / 2);
    bg.fillStyle(0x5a3a24).fillRoundedRect(-BAR_W / 2, -BAR_H / 2, BAR_W, BAR_H, BAR_H / 2);
    this.barFill = new Phaser.GameObjects.Graphics(scene);
    this.barLabel = new Phaser.GameObjects.Text(scene, 0, 0, '', textStyle(13, 700, '#ffffff', { stroke: '#5a3a24', strokeThickness: 4 })).setOrigin(0.5);
    const border = new Phaser.GameObjects.Graphics(scene);
    border.lineStyle(2, 0xffffff, 0.7).strokeRoundedRect(-BAR_W / 2, -BAR_H / 2, BAR_W, BAR_H, BAR_H / 2);
    const bar = scene.add.container(0, 0, [bg, this.barFill, border, this.barLabel]).setDepth(this.depth + 3);
    this.mood = null;
    this.setProgress(1);
    return bar;
  }

  /** Redraws the patience bar and mood for the share of patience left (1 → 0). */
  setProgress(fractionLeft) {
    if (!this.bar && !this.barFill) return;
    const f = Phaser.Math.Clamp(fractionLeft, 0, 1);
    const inner = BAR_W - 6;
    const w = Math.max(BAR_H - 6, inner * f);
    this.barFill.clear();
    if (f > 0) this.barFill.fillStyle(moodColor(f)).fillRoundedRect(-inner / 2, -BAR_H / 2 + 3, w, BAR_H - 6, (BAR_H - 6) / 2);

    this.fraction = f;
    if (!this.waveTimer) this.setPose(waitingPose(f));

    const mood = moodAt(f);
    if (mood === this.mood || mood === 'left') return;
    const wasHappier = this.mood !== null;
    this.mood = mood;
    this.barLabel.setText(t(`mood.${mood}`));
    if (wasHappier && this.customer) {
      // A little huff when they get grumpier.
      const customer = this.customer;
      this.scene.tweens.add({ targets: customer, angle: { from: -3, to: 3 }, duration: 70, yoyo: true, repeat: 2, onComplete: () => customer.setAngle(0) });
    }
  }

  buildBubble(order, served) {
    const scene = this.scene;
    const PAD_X = 14;
    const PAD_Y = 8;
    const GAP = 22;
    const HEAD_H = 18;
    const maxRight = this.rect.x + this.rect.w - SIGN_W - 22;
    const left = this.homeX + this.halfW + BUBBLE_GAP;
    const maxW = maxRight - left;

    // Dishes side by side under "I'd like:" when they fit, otherwise stacked (and a bit smaller).
    const make = (iconSize, size) => order.map((id) => makeItemLabel(scene, this.itemsById.get(id), textStyle(size, 700), iconSize));
    let pieces = make(38, 17);
    const rowW = pieces.reduce((sum, p) => sum + p.width, 0) + GAP * (pieces.length - 1);
    const stacked = rowW + PAD_X * 2 > maxW;
    if (stacked) {
      pieces.forEach((p) => p.destroy());
      pieces = make(32, 16);
    }
    order.forEach((id, i) => this.slots.set(id, pieces[i]));

    const head = new Phaser.GameObjects.Text(scene, 0, 0, t(order.length > 1 ? 'bubble.both' : 'bubble.one'), textStyle(13, 600, COLORS.inkSoft)).setOrigin(0, 0.5);
    const lineH = stacked ? 36 : 42;
    const contentW = stacked ? Math.max(...pieces.map((p) => p.width)) : rowW;
    const w = Math.min(Math.max(contentW, head.width) + PAD_X * 2, maxW);
    const headH = stacked ? 0 : HEAD_H;
    const h = PAD_Y * 2 + headH + lineH * (stacked ? pieces.length : 1);

    const g = new Phaser.GameObjects.Graphics(scene);
    g.fillStyle(0x000000, 0.14).fillRoundedRect(2, -h / 2 + 4, w, h, 14);
    g.fillStyle(0xffffff).fillRoundedRect(0, -h / 2, w, h, 14);
    g.fillTriangle(1, -8, 1, 8, -14, 6);
    g.lineStyle(2.5, COLORS.woodEdge).strokeRoundedRect(0, -h / 2, w, h, 14);
    g.lineStyle(2.5, COLORS.woodEdge).lineBetween(0, -8, -14, 6).lineBetween(-14, 6, 0, 8);
    g.fillStyle(0xffffff).fillRect(-1, -7, 4, 14);

    head.setPosition(PAD_X, -h / 2 + PAD_Y + HEAD_H / 2).setVisible(!stacked);
    let x = PAD_X;
    pieces.forEach((p, i) => {
      if (stacked) {
        p.setPosition(PAD_X, -h / 2 + PAD_Y + lineH * (i + 0.5));
        // Squeeze long names into a narrow bubble.
        if (p.width > w - PAD_X * 2) p.setScale((w - PAD_X * 2) / p.width);
      } else {
        p.setPosition(x, -h / 2 + PAD_Y + headH + lineH / 2);
        x += p.width + GAP;
      }
    });

    // Level with the customer's face, but inside the band.
    const faceY = this.headTop + (this.feetY - this.headTop) * 0.3;
    const y = Math.max(this.rect.y + h / 2 + 6, Math.min(faceY, this.rect.y + this.rect.h - PLANK_H - h / 2 + 10));
    const bubble = scene.add.container(left, y, [g, head, ...pieces]).setDepth(this.depth + 4);
    bubble.setSize(w, h);
    served.forEach((id) => this.tick(id, false));
    return bubble;
  }

  /** Where a delivered dish should fly to. */
  dishPoint(dishId) {
    const label = this.slots.get(dishId);
    if (!label || !this.bubble) return { x: this.homeX, y: this.headTop };
    return { x: this.bubble.x + label.x + 19, y: this.bubble.y + label.y };
  }

  /** Marks a dish in the bubble as handed over. */
  tick(dishId, animate = true) {
    const label = this.slots.get(dishId);
    if (!label || label.ticked) return;
    label.ticked = true;
    label.setAlpha(0.55);
    const check = new Phaser.GameObjects.Text(this.scene, label.x + 19, label.y, '✓', textStyle(30, 700, '#4f9a3a', { stroke: '#ffffff', strokeThickness: 5 })).setOrigin(0.5);
    this.bubble.add(check);
    if (animate) this.scene.tweens.add({ targets: check, scale: { from: 2, to: 1 }, duration: 250, ease: 'Back.easeOut' });
  }

  /** The customer walks out to the right. `mood` is how they felt when they got their food (or 'left'). */
  leave(mood, onDone) {
    const scene = this.scene;
    const customer = this.customer;
    const bar = this.bar;
    const bubble = this.bubble;
    this.customer = null;
    this.bar = null;
    this.bubble = null;
    this.barFill = null;
    this.slots.clear();
    this.waveTimer?.remove();
    this.waveTimer = null;
    if (!customer) {
      onDone?.();
      return;
    }
    customer.setFrame(customerFrame(this.character, LEAVING_POSE[mood]));
    scene.tweens.add({ targets: [bar, bubble], alpha: 0, duration: 200, onComplete: () => { bar.destroy(); bubble.destroy(); } });

    const angry = mood === 'left' || mood === 'angry';
    const exit = () =>
      scene.tweens.add({
        targets: customer,
        x: this.rect.x + this.rect.w + this.halfW,
        duration: WALK_MS * 1.6,
        ease: 'Quad.easeIn',
        onComplete: () => {
          customer.destroy();
          onDone?.();
        },
      });
    if (angry) {
      scene.tweens.add({ targets: customer, angle: { from: -4, to: 4 }, duration: 60, yoyo: true, repeat: 3, onComplete: () => { customer.setAngle(0); scene.time.delayedCall(250, exit); } });
    } else {
      scene.tweens.add({ targets: customer, y: customer.y - 10, duration: 140, yoyo: true, repeat: 1, onComplete: () => scene.time.delayedCall(350, exit) });
    }
  }

  clear() {
    this.waveTimer?.remove();
    this.waveTimer = null;
    this.pose = null;
    this.fraction = null;
    for (const obj of [this.customer, this.bar, this.bubble]) {
      if (!obj) continue;
      this.scene.tweens.killTweensOf(obj);
      obj.destroy();
    }
    this.customer = null;
    this.bar = null;
    this.bubble = null;
    this.barFill = null;
    this.slots.clear();
  }
}
