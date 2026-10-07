import { drawPlank } from './KitchenBackdrop.js';
import { COLORS, textStyle } from './theme.js';
import { SECTION_H, TOOL_ROW_H, SHELF_ROW_H, DRAWER_HEADER_H } from './layout.js';
import { PointerGesture } from './PointerGesture.js';
import { KineticScroller, attachScroller } from './KineticScroller.js';
import {
  SECTIONS,
  sectionIds,
  makeShelfToken,
  retireShelfTokens,
  makeSectionHeader,
  drawPegboard,
  drawShelf,
  drawCabinet,
  drawPosts,
  flashNew,
  loadToolsOpen,
  saveToolsOpen,
} from './storageShared.js';

const POST_W = 10;
const MIN_CELL_W = 96;
const ICON_Y = 40;

// Depth layers inside the drawer, bottom to top. Items slide behind the side posts (and off the
// screen edge), which is what clips them — no masks needed.
const L = { back: 0, items: 1, posts: 2, arrows: 3, overlay: 4 };

/**
 * Portrait storage: a drawer along the bottom of the screen. Each section (Tools, Raw, Processed)
 * is one shelf that scrolls sideways freely — swipe with momentum, mouse wheel, or the ‹ › arrows.
 * Pull an item up to drag it onto the table, or tap it to drop a copy there. Opening/closing Tools
 * changes the drawer's height, so the scene lays itself out again (`onToggleTools`).
 */
export class StorageDrawer {
  constructor(scene, { rect, itemsById, depth, onPick, onTap, onToggleTools }) {
    this.scene = scene;
    this.rect = rect;
    this.itemsById = itemsById;
    this.depth = depth;
    this.onToggleTools = onToggleTools;
    this.entries = new Map();
    this.strips = [];
    this.decor = [];
    this.scrollers = new Map(); // one per section, kept across refreshes
    this.toolsOpen = loadToolsOpen();
    this.innerLeft = rect.x + POST_W;
    this.innerWidth = rect.w - POST_W * 2;
    this.innerRight = this.innerLeft + this.innerWidth;
    this.cols = Math.max(3, Math.floor(this.innerWidth / MIN_CELL_W));
    this.cellW = this.innerWidth / this.cols;

    this.gesture = new PointerGesture(scene, {
      scrollAxis: 'horizontal',
      pickDirection: 'up',
      onScrollStart: (strip) => strip?.scroller.dragStart(),
      onScroll: (delta, strip) => strip?.scroller.dragBy(delta),
      onScrollEnd: (strip) => strip?.scroller.dragEnd(),
      onPick: (id, pointer) => onPick(id, pointer),
      onTap: (id) => onTap(id),
    });

    drawCabinet(scene, rect, depth + L.back, POST_W);
    drawPosts(scene, rect, depth + L.posts, POST_W);
    drawPlank(scene, rect.x, rect.y, rect.w, DRAWER_HEADER_H, { roundBottom: false }).setDepth(depth + L.back);
    scene.add
      .text(rect.x + rect.w / 2, rect.y + DRAWER_HEADER_H / 2 - 2, 'My Kitchen Storage!', textStyle(24, 700))
      .setOrigin(0.5)
      .setDepth(depth + L.back);
  }

  contains(_px, py) {
    return py >= this.rect.y;
  }

  wheel(pointer, dy) {
    this.stripAt(pointer.y)?.scroller.scrollBy(dy);
  }

  stripAt(y) {
    return this.strips.find((s) => y >= s.y && y < s.y + s.h);
  }

  press(pointer, id, strip, opts = {}) {
    strip?.scroller.stop();
    this.gesture.begin(pointer, id, { ...opts, context: strip });
  }

  scrollerFor(key) {
    if (!this.scrollers.has(key)) {
      const scroller = attachScroller(
        this.scene,
        new KineticScroller({
          onChange: () => {
            const strip = this.strips.find((s) => s.key === key);
            if (strip) this.layoutStrip(strip);
          },
        }),
      );
      this.scrollers.set(key, scroller);
    }
    return this.scrollers.get(key);
  }

  /** Shows exactly the items in `ids` (a Set): new ones are added, missing ones shrink away. */
  refresh(ids) {
    retireShelfTokens(this.scene, this.entries, ids);
    for (const id of ids) {
      if (this.entries.has(id)) continue;
      const item = this.itemsById.get(id);
      if (!item) continue;
      const token = makeShelfToken(this.scene, item, this.depth + L.items);
      token.hit.on('pointerdown', (pointer) => this.press(pointer, id, this.strips.find((s) => s.ids.includes(id))));
      this.entries.set(id, token);
    }

    this.decor.forEach((o) => o.destroy());
    this.decor = [];
    this.strips = [];
    const track = (o) => {
      this.decor.push(o);
      return o;
    };

    const shown = [...this.entries.keys()];
    let y = this.rect.y + DRAWER_HEADER_H;
    for (const section of SECTIONS) {
      const sectionItems = sectionIds(section, shown, this.itemsById);
      const header = makeSectionHeader(this.scene, {
        x: this.innerLeft,
        w: this.innerWidth,
        text: `${section.label} (${sectionItems.length})`,
        depth: this.depth + L.back,
        toggle: section.pinned ? { open: this.toolsOpen, onToggle: () => this.toggleTools() } : null,
      });
      this.decor.push(...header.objs);
      for (const { obj, relY } of header.parts) obj.setY(y + relY);
      y += SECTION_H;

      const open = !section.pinned || this.toolsOpen;
      if (!open) {
        for (const id of sectionItems) this.entries.get(id).setVisible(false).setInputEnabled(false);
        continue;
      }

      const h = section.style === 'pegboard' ? TOOL_ROW_H : SHELF_ROW_H;
      const bg =
        section.style === 'pegboard'
          ? drawPegboard(this.scene, this.innerLeft, this.innerWidth, h, this.depth + L.back)
          : drawShelf(this.scene, this.innerLeft, this.innerWidth, this.depth + L.back);
      track(bg).setY(y);

      const strip = { key: section.key, ids: sectionItems, y, h, scroller: this.scrollerFor(section.key) };

      // Empty shelf space: pressing here can only scroll this strip.
      const zone = track(this.scene.add.zone(this.innerLeft, y, this.innerWidth, h).setOrigin(0).setDepth(this.depth + L.back));
      zone.setInteractive();
      zone.on('pointerdown', (pointer) => this.press(pointer, null, strip, { canPick: false }));

      const page = this.innerWidth - this.cellW;
      strip.prev = track(this.arrow(this.innerLeft + 14, y + ICON_Y, '‹', () => strip.scroller.scrollBy(-page)));
      strip.next = track(this.arrow(this.innerRight - 14, y + ICON_Y, '›', () => strip.scroller.scrollBy(page)));
      if (!sectionItems.length) {
        track(
          this.scene.add
            .text(this.innerLeft + this.innerWidth / 2, y + ICON_Y, section.empty, textStyle(15, 500, COLORS.inkSoft))
            .setOrigin(0.5)
            .setDepth(this.depth + L.items),
        );
      }

      this.strips.push(strip);
      strip.scroller.setMax(sectionItems.length * this.cellW - this.innerWidth);
      this.layoutStrip(strip);
      y += h;
    }
  }

  arrow(x, y, label, onClick) {
    const t = this.scene.add
      .text(x, y, label, textStyle(34, 700, COLORS.ink, { stroke: COLORS.cream, strokeThickness: 6 }))
      .setOrigin(0.5)
      .setDepth(this.depth + L.arrows)
      .setInteractive({ useHandCursor: true });
    t.on('pointerup', onClick);
    return t;
  }

  /** Positions a strip's items for its current scroll offset (called every frame while it moves). */
  layoutStrip(strip) {
    const offset = strip.scroller.pos;
    strip.ids.forEach((id, i) => {
      const token = this.entries.get(id);
      const x = this.innerLeft + (i + 0.5) * this.cellW - offset;
      const visible = x + this.cellW / 2 > this.innerLeft && x - this.cellW / 2 < this.innerRight;
      // Only items fully in view can be grabbed; half-hidden ones are behind the posts.
      const inView = x - this.cellW * 0.35 >= this.innerLeft && x + this.cellW * 0.35 <= this.innerRight;
      token.setPosition(x, strip.y + ICON_Y).setVisible(visible).setInputEnabled(inView);
    });

    const showPrev = offset > 1;
    const showNext = offset < strip.scroller.max - 1;
    strip.prev.setVisible(showPrev);
    strip.next.setVisible(showNext);
    strip.prev.input.enabled = showPrev;
    strip.next.input.enabled = showNext;
  }

  toggleTools() {
    this.toolsOpen = !this.toolsOpen;
    saveToolsOpen(this.toolsOpen);
    this.onToggleTools(); // drawer height changes, so the whole screen is laid out again
  }

  /** Scrolls the entry's shelf so it's in view and returns where it will end up. */
  revealEntry(id) {
    const token = this.entries.get(id);
    const strip = this.strips.find((s) => s.ids.includes(id));
    if (!token || !strip) return { x: this.rect.x + this.rect.w / 2, y: this.rect.y + DRAWER_HEADER_H / 2 };

    const i = strip.ids.indexOf(id);
    const left = i * this.cellW;
    let target = strip.scroller.pos;
    if (left < target) target = left;
    else if (left + this.cellW > target + this.innerWidth) target = left + this.cellW - this.innerWidth;
    target = Math.min(Math.max(0, target), strip.scroller.max);
    strip.scroller.scrollTo(target);

    return { x: this.innerLeft + (i + 0.5) * this.cellW - target, y: strip.y + ICON_Y };
  }

  flashNew(id) {
    const token = this.entries.get(id);
    if (token?.visible) flashNew(this.scene, token, this.depth + L.overlay);
  }
}
