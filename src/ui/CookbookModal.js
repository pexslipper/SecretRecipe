import { COLORS, textStyle } from './theme.js';
import { makeRoundButton } from './Buttons.js';
import { PointerGesture } from './PointerGesture.js';
import { KineticScroller, attachScroller } from './KineticScroller.js';

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
const GAP_ROW_H = 20;
const CENSOR_COLOR = 0x2a1d14;

/**
 * Full-screen modal listing every dish and its steps from raw ingredients to the finished food.
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
    const PANEL_W = Math.min(MAX_PANEL_W, width - 32);
    const PANEL_H = Math.min(MAX_PANEL_H, height - 64);
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
    frame.fillStyle(0x000000, 0.18).fillRoundedRect(this.left + 4, this.top + 8, PANEL_W, PANEL_H, 20);
    frame.fillStyle(COLORS.woodDark).fillRoundedRect(this.left, this.top, PANEL_W, PANEL_H, 20);
    frame.lineStyle(3, COLORS.woodEdge).strokeRoundedRect(this.left, this.top, PANEL_W, PANEL_H, 20);
    frame.fillStyle(PARCHMENT).fillRoundedRect(this.left + 12, this.top + 12, PANEL_W - 24, PANEL_H - 24, 12);
    frame.lineStyle(2, 0xe6cfa8).strokeRoundedRect(this.left + 12, this.top + 12, PANEL_W - 24, PANEL_H - 24, 12);

    // Parchment covers over the header and footer: rows scrolling past the edges slide under these.
    const covers = this.add(this.scene.add.graphics(), L.covers);
    const coverX = this.left + PAGE_INSET;
    const coverW = PANEL_W - PAGE_INSET * 2;
    covers.fillStyle(PARCHMENT);
    covers.fillRoundedRect(coverX, this.top + PAGE_INSET, coverW, this.contentTop - this.top - PAGE_INSET, { tl: 11, tr: 11, bl: 0, br: 0 });
    covers.fillRoundedRect(coverX, this.contentBottom, coverW, this.top + PANEL_H - PAGE_INSET - this.contentBottom, { tl: 0, tr: 0, bl: 11, br: 11 });
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
    const textX = this.left + (this.compact ? 28 : 40);
    const stepX = textX + 44;
    const stepWrap = this.left + this.panelW - (this.compact ? 28 : 40) - stepX;

    this.cookbook.forEach(({ dishId, steps }, d) => {
      if (d > 0) this.rows.push({ height: GAP_ROW_H, parts: [this.part(this.rule(), GAP_ROW_H / 2)] });

      const dish = this.itemsById.get(dishId);
      const served = this.isDishServed(dishId);
      const found = steps.filter((r) => this.isRecipeDiscovered(r.id)).length;

      const title = this.text(textX, `${dish.emoji ?? ''} ${dish.name}`, textStyle(this.compact ? 21 : 24, 700));
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
        const line = this.text(
          stepX,
          this.describeStep(recipe),
          textStyle(this.compact ? 17 : 19, 500, COLORS.ink, { wordWrap: { width: stepWrap } }),
        );
        // Long steps wrap on narrow screens, so the row grows to fit.
        const height = Math.max(STEP_ROW_H, line.height + 8);
        this.rows.push({
          height,
          parts: [this.part(number, height / 2), ...this.censorable(line, !this.isRecipeDiscovered(recipe.id), height / 2)],
        });
      });
    });
  }

  describeStep(recipe) {
    const label = (id) => {
      const item = this.itemsById.get(id);
      return item ? `${item.emoji ?? ''} ${item.name}` : id;
    };
    const [a, b] = recipe.inputs.map(label);
    return `${a}   +   ${b}   →   ${label(recipe.output)}`;
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
