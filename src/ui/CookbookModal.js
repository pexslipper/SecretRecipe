import Phaser from 'phaser';
import { COLORS, textStyle } from './theme.js';
import { makeRoundButton } from './Buttons.js';
import { makeItemLabel, makeFlowRow } from './ItemLabel.js';
import { PointerGesture } from './PointerGesture.js';
import { KineticScroller, attachScroller } from './KineticScroller.js';
import { CHAPTERS } from '../data/chapters.js';

const MAX_PANEL_W = 820;
const MAX_PANEL_H = 600;
const HEADER_H = 84;
// Tall enough that a row sliding out at the bottom stays hidden under the page's footer.
const FOOTER_H = 80;
const PAGE_INSET = 13;
const PARCHMENT = 0xfff8ec;

// Depth layers: rows scroll *under* the header/footer covers, which is what clips them.
const L = { page: 0, rows: 1, covers: 2, chrome: 3 };
const DISH_ROW_H = 56;
const STEP_ROW_H = 40;
const STEP_GAP = 12;
const GAP_ROW_H = 20;
const CENSOR_COLOR = 0x2a1d14;

/**
 * Full-screen modal listing every dish and its steps from raw ingredients to the finished food,
 * grouped into chapters (Breakfast, Italian, …) with a medal for each completed chapter.
 * Steps the player hasn't made yet are covered by a black censor bar.
 * Content is rebuilt on every open, sized to the screen, and scrolls freely: swipe up/down on the
 * page (with momentum) or use the mouse wheel.
 */
export class CookbookModal {
  constructor(scene, { cookbook, itemsById, depth, isRecipeDiscovered, isDishServed }) {
    this.scene = scene;
    this.cookbook = [...cookbook].sort((a, b) =>
      itemsById.get(a.dishId).name.localeCompare(itemsById.get(b.dishId).name, undefined, { sensitivity: 'base' }),
    );
    this.itemsById = itemsById;
    this.depth = depth;
    this.isRecipeDiscovered = isRecipeDiscovered;
    this.isDishServed = isDishServed;
    this.objects = [];
    this.rows = [];

    this.scroller = attachScroller(scene, new KineticScroller({ onChange: () => this.layoutRows() }));
    this.gesture = new PointerGesture(scene, {
      scrollAxis: 'vertical',
      pickDirection: 'left',
      onScrollStart: () => this.scroller.dragStart(),
      onScroll: (delta) => this.scroller.dragBy(delta),
      onScrollEnd: () => this.scroller.dragEnd(),
    });
  }

  get isOpen() {
    return this.objects.length > 0;
  }

  open() {
    if (this.isOpen) return;
    const { width, height } = this.scene.scale;
    // Portrait screens get the whole screen; landscape keeps a centred book.
    const fullScreen = height > width;
    const PANEL_W = fullScreen ? width : Math.min(MAX_PANEL_W, width - 32);
    const PANEL_H = fullScreen ? height : Math.min(MAX_PANEL_H, height - 64);
    const frameR = fullScreen ? 0 : 20;
    const pageR = fullScreen ? 0 : 12;
    this.panelW = PANEL_W;
    this.compact = PANEL_W < 640;
    this.left = (width - PANEL_W) / 2;
    this.top = (height - PANEL_H) / 2;
    // A little below the dashed rule, so rows sliding under the header are cut cleanly beneath it.
    this.contentTop = this.top + HEADER_H + 8;
    this.contentBottom = this.top + PANEL_H - FOOTER_H;

    // Dark overlay swallows clicks so nothing underneath can be dragged while open.
    // Outside the page closes it; on the page, dragging up/down scrolls.
    const overlay = this.add(this.scene.add.rectangle(0, 0, width, height, 0x3a2414, 0.55).setOrigin(0));
    overlay.setInteractive();
    overlay.on('pointerdown', (pointer) => {
      const inside =
        pointer.x >= this.left && pointer.x <= this.left + PANEL_W && pointer.y >= this.top && pointer.y <= this.top + PANEL_H;
      if (!inside) {
        this.close();
        return;
      }
      this.scroller.stop();
      this.gesture.begin(pointer, null, { canPick: false });
    });

    // Wooden frame around a parchment page
    const frame = this.add(this.scene.add.graphics());
    if (!fullScreen) frame.fillStyle(0x000000, 0.18).fillRoundedRect(this.left + 4, this.top + 8, PANEL_W, PANEL_H, frameR);
    frame.fillStyle(COLORS.woodDark).fillRoundedRect(this.left, this.top, PANEL_W, PANEL_H, frameR);
    frame.lineStyle(3, COLORS.woodEdge).strokeRoundedRect(this.left, this.top, PANEL_W, PANEL_H, frameR);
    frame.fillStyle(PARCHMENT).fillRoundedRect(this.left + 12, this.top + 12, PANEL_W - 24, PANEL_H - 24, pageR);
    frame.lineStyle(2, 0xe6cfa8).strokeRoundedRect(this.left + 12, this.top + 12, PANEL_W - 24, PANEL_H - 24, pageR);

    // Parchment covers over the header and footer: rows scrolling past the edges slide under these.
    const covers = this.add(this.scene.add.graphics(), L.covers);
    const coverX = this.left + PAGE_INSET;
    const coverW = PANEL_W - PAGE_INSET * 2;
    covers.fillStyle(PARCHMENT);
    const coverR = Math.max(0, pageR - 1);
    covers.fillRoundedRect(coverX, this.top + PAGE_INSET, coverW, this.contentTop - this.top - PAGE_INSET, { tl: coverR, tr: coverR, bl: 0, br: 0 });
    covers.fillRoundedRect(coverX, this.contentBottom, coverW, this.top + PANEL_H - PAGE_INSET - this.contentBottom, { tl: 0, tr: 0, bl: coverR, br: coverR });
    covers.fillStyle(0x000000, 0.06).fillRect(coverX, this.contentBottom, coverW, 3);
    covers.fillStyle(0x000000, 0.06).fillRect(coverX, this.contentTop - 3, coverW, 3);

    this.add(this.scene.add.text(this.left + 30, this.top + HEADER_H / 2 + 4, '📖', { fontSize: 34, padding: { y: 6 } }).setOrigin(0, 0.5), L.chrome);
    this.add(this.scene.add.text(this.left + 80, this.top + HEADER_H / 2 + 4, 'Recipe Book', textStyle(30, 700)).setOrigin(0, 0.5), L.chrome);
    const rule = this.add(this.scene.add.graphics(), L.chrome);
    rule.lineStyle(2, COLORS.woodShadow, 0.8);
    for (let dx = this.left + 32; dx < this.left + PANEL_W - 32; dx += 14) {
      rule.lineBetween(dx, this.top + HEADER_H, dx + 8, this.top + HEADER_H);
    }

    const close = makeRoundButton(this.scene, this.left + PANEL_W - 46, this.top + HEADER_H / 2 + 4, 24, '✕', {
      color: 0xec7d7e,
      darkColor: 0xc65a5c,
      fontSize: 24,
      onClick: () => this.close(),
    });
    this.add(close, L.chrome);

    this.moreHint = this.add(
      this.scene.add
        .text(this.left + PANEL_W / 2, this.top + PANEL_H - PAGE_INSET - 18, '', textStyle(13, 500, COLORS.inkSoft))
        .setOrigin(0.5),
      L.chrome,
    );

    this.buildRows();
    const contentH = this.rows.reduce((sum, row) => sum + row.height, 0);
    this.scroller.setMax(contentH - (this.contentBottom - this.contentTop));
    this.scroller.scrollTo(0, { animate: false });
    this.layoutRows();
  }

  close() {
    this.gesture.cancel();
    this.scroller.stop();
    this.scene.tweens.killTweensOf(this.objects);
    this.objects.forEach((o) => o.destroy());
    this.objects = [];
    this.rows = [];
  }

  wheel(dy) {
    if (this.isOpen) this.scroller.scrollBy(dy);
  }

  // ---------------------------------------------------------------- Content

  buildRows() {
    const groups = CHAPTERS.map((chapter) => ({
      chapter,
      entries: this.cookbook.filter(({ dishId }) => this.itemsById.get(dishId).chapter === chapter.key),
    })).filter((g) => g.entries.length);
    const progress = (entries) => ({
      served: entries.filter(({ dishId }) => this.isDishServed(dishId)).length,
      total: entries.length,
    });

    this.buildBadgeRow(groups.map((g) => ({ chapter: g.chapter, ...progress(g.entries) })));
    groups.forEach((g) => {
      this.rows.push({ height: GAP_ROW_H, parts: [] });
      this.buildChapterHeader(g.chapter, progress(g.entries));
      this.buildDishes(g.entries);
    });
  }

  /** A row of small chips, one per chapter: "🥐 2/4", or a medal once the chapter is complete. */
  buildBadgeRow(chapters) {
    const H = 48;
    const margin = this.compact ? 24 : 36;
    const gap = 8;
    const avail = this.panelW - margin * 2;
    const chipW = Math.min(118, (avail - gap * (chapters.length - 1)) / chapters.length);
    const startX = this.left + this.panelW / 2 - (chipW * chapters.length + gap * (chapters.length - 1)) / 2;
    const parts = [];
    chapters.forEach(({ chapter, served, total }, i) => {
      const cx = startX + i * (chipW + gap) + chipW / 2;
      const done = served === total;
      const g = this.add(this.scene.add.graphics({ x: cx }), L.rows);
      g.fillStyle(done ? 0xf6d365 : 0xf3e6cf).fillRoundedRect(-chipW / 2, -16, chipW, 32, 16);
      g.lineStyle(2, done ? 0xd4a017 : 0xe2cfae).strokeRoundedRect(-chipW / 2, -16, chipW, 32, 16);
      const label = this.add(
        this.scene.add
          .text(cx, 0, `${chapter.emoji} ${done ? '🏅' : `${served}/${total}`}`, textStyle(15, 700, done ? '#8a5a00' : COLORS.inkSoft))
          .setOrigin(0.5),
        L.rows,
      );
      parts.push(this.part(g, H / 2), this.part(label, H / 2));
    });
    this.rows.push({ height: H, parts });
  }

  buildChapterHeader(chapter, { served, total }) {
    const H = 50;
    const x = this.left + (this.compact ? 20 : 30);
    const w = this.panelW - (this.compact ? 40 : 60);
    const done = served === total;
    const band = this.add(this.scene.add.graphics(), L.rows);
    band.fillStyle(chapter.color, 0.28).fillRoundedRect(x, -H / 2 + 4, w, H - 8, 12);
    band.lineStyle(2, chapter.color, 0.7).strokeRoundedRect(x, -H / 2 + 4, w, H - 8, 12);
    const title = this.text(x + 14, `${chapter.emoji} ${chapter.name}`, textStyle(this.compact ? 20 : 22, 700));
    const status = this.text(
      x + w - 14,
      done ? '🏅 Complete!' : `${served}/${total}`,
      textStyle(this.compact ? 15 : 17, 700, done ? '#b07d00' : COLORS.ink),
    ).setOrigin(1, 0.5);
    this.rows.push({ height: H, parts: [this.part(band, H / 2), this.part(title, H / 2), this.part(status, H / 2)] });
  }

  buildDishes(entries) {
    const textX = this.left + (this.compact ? 28 : 40);
    const stepX = textX + 44;
    const stepWrap = this.left + this.panelW - (this.compact ? 28 : 40) - stepX;

    entries.forEach(({ dishId, steps }, d) => {
      if (d > 0) this.rows.push({ height: GAP_ROW_H, parts: [this.part(this.rule(), GAP_ROW_H / 2)] });

      const dish = this.itemsById.get(dishId);
      const served = this.isDishServed(dishId);
      const found = steps.filter((r) => this.isRecipeDiscovered(r.id)).length;

      const title = this.addRow(
        textX,
        makeItemLabel(this.scene, dish, textStyle(this.compact ? 21 : 24, 700), this.compact ? 36 : 42),
      );
      const status = this.text(
        this.left + this.panelW - (this.compact ? 28 : 40),
        served ? 'Served ✓' : `${found}/${steps.length} found`,
        textStyle(this.compact ? 14 : 16, 600, served ? '#5a9a3c' : COLORS.inkSoft),
      ).setOrigin(1, 0.5);
      this.rows.push({
        height: DISH_ROW_H,
        parts: [...this.censorable(title, !served, DISH_ROW_H / 2), this.part(status, DISH_ROW_H / 2)],
      });

      steps.forEach((recipe, i) => {
        const number = this.text(textX + 8, `${i + 1}.`, textStyle(this.compact ? 16 : 18, 600, COLORS.inkSoft));
        const line = this.addRow(stepX, this.buildStep(recipe, stepWrap));
        // Long steps wrap on narrow screens, so the row grows to fit.
        const height = Math.max(STEP_ROW_H, line.height + 8);
        this.rows.push({
          height,
          parts: [this.part(number, height / 2), ...this.censorable(line, !this.isRecipeDiscovered(recipe.id), height / 2)],
        });
      });
    });
  }

  /** "[icon] A  +  [icon] B  →  [icon] Out", wrapping onto more lines when it doesn't fit `maxWidth`. */
  buildStep(recipe, maxWidth) {
    const scene = this.scene;
    const style = textStyle(this.compact ? 17 : 19, 500, COLORS.ink);
    const iconSize = this.compact ? 28 : 32;
    const label = (id) => {
      const item = this.itemsById.get(id);
      return item ? makeItemLabel(scene, item, style, iconSize) : new Phaser.GameObjects.Text(scene, 0, 0, id, style).setOrigin(0, 0.5);
    };
    // Each operator stays with the item after it, so a wrapped line never starts with a bare "+".
    const withOp = (op, id) =>
      makeFlowRow(scene, [new Phaser.GameObjects.Text(scene, 0, 0, op, style).setOrigin(0, 0.5), label(id)], { gap: STEP_GAP });
    const [a, b] = recipe.inputs;
    return makeFlowRow(scene, [label(a), withOp('+', b), withOp('→', recipe.output)], { maxWidth, gap: STEP_GAP });
  }

  /** Returns the text as-is, or a black bar of the same size in its place. */
  censorable(textObj, censored, relY) {
    if (!censored) return [this.part(textObj, relY)];
    textObj.setVisible(false);
    const bar = this.add(
      this.scene.add.rectangle(textObj.x, 0, textObj.width, Math.max(20, textObj.height - 8), CENSOR_COLOR).setOrigin(0, 0.5),
      L.rows,
    );
    // The hidden text stays in `objects` so it's destroyed on close, but isn't laid out.
    return [this.part(bar, relY)];
  }

  text(x, str, style) {
    return this.add(this.scene.add.text(x, 0, str, style).setOrigin(0, 0.5), L.rows);
  }

  /** Adds an item label / flow row (see ItemLabel.js) as a row piece at `x`. */
  addRow(x, obj) {
    return this.add(this.scene.add.existing(obj.setX(x)), L.rows);
  }

  rule() {
    return this.add(this.scene.add.rectangle(this.left + 40, 0, this.panelW - 80, 2, 0xeedcc0).setOrigin(0, 0.5), L.rows);
  }

  part(obj, relY) {
    return { obj, relY };
  }

  add(obj, layer = L.page) {
    obj.setDepth(this.depth + layer);
    this.objects.push(obj);
    return obj;
  }

  // ---------------------------------------------------------------- Layout

  /** Positions rows for the current scroll offset (called every frame while scrolling). */
  layoutRows() {
    if (!this.isOpen) return;
    let top = this.contentTop - this.scroller.pos;
    for (const row of this.rows) {
      const visible = top < this.contentBottom && top + row.height > this.contentTop;
      for (const { obj, relY } of row.parts) obj.setY(top + relY).setVisible(visible);
      top += row.height;
    }

    const hints = [];
    if (this.scroller.pos > 1) hints.push('▲');
    if (this.scroller.pos < this.scroller.max - 1) hints.push('▼');
    this.moreHint.setText(hints.length ? `${hints.join(' ')}  scroll for more` : '');
  }
}
