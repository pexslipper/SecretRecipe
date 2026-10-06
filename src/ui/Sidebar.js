import { drawPlank } from './KitchenBackdrop.js';
import { COLORS, textStyle } from './theme.js';
import { SECTION_H, TOOL_ROW_H, SHELF_ROW_H } from './layout.js';
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
  fillCabinet,
  flashNew,
  loadToolsOpen,
  saveToolsOpen,
} from './storageShared.js';

const HEADER_HEIGHT = 62;
const FOOTER_HEIGHT = 24;
const POST_W = 12;
const COLS = 3;
const ICON_Y = 40;

// Depth layers inside the column, bottom to top. Scrolling shelves slide *under* the pinned
// Tools section and the footer, which is what clips them (Phaser 4 masks are avoided on purpose).
const L = {
  back: 0,
  scrollDecor: 1,
  scrollItems: 2,
  cover: 3,
  pinnedDecor: 4,
  pinnedItems: 5,
  frame: 6,
  overlay: 7,
};

/**
 * Landscape storage: "My Kitchen Storage!" column on the right. Tools hang on a pegboard pinned
 * under the title (click its header to open/close it); ingredients sit on shelves below and
 * scroll freely — swipe with momentum on touch, or the mouse wheel. Pull an item left to drag it
 * out, or tap it to drop a copy on the table.
 */
export class Sidebar {
  constructor(scene, { rect, itemsById, depth, onPick, onTap, interceptPress }) {
    // Lets the scene take over a press on an item (hint mode) before it becomes a drag/tap.
    this.interceptPress = interceptPress;
    this.scene = scene;
    this.x = rect.x;
    this.y = rect.y;
    this.width = rect.w;
    this.height = rect.h;
    this.itemsById = itemsById;
    this.depth = depth;
    this.entries = new Map();
    this.pinnedHeader = null;
    this.pinnedRows = [];
    this.rows = [];
    this.decor = [];
    this.innerLeft = this.x + POST_W;
    this.innerWidth = this.width - POST_W * 2;
    this.bottom = this.y + this.height - FOOTER_HEIGHT;
    this.toolsOpen = loadToolsOpen();

    this.scroller = attachScroller(scene, new KineticScroller({ onChange: () => this.layoutScrolling() }));
    this.gesture = new PointerGesture(scene, {
      scrollAxis: 'vertical',
      pickDirection: 'left',
      onScrollStart: () => this.scroller.dragStart(),
      onScroll: (delta) => this.scroller.dragBy(delta),
      onScrollEnd: () => this.scroller.dragEnd(),
      onPick: (id, pointer) => onPick(id, pointer),
      onTap: (id) => onTap(id),
    });

    drawCabinet(scene, rect, depth + L.back, POST_W);
    // Empty shelf space: pressing here can only scroll.
    this.scrollZone = scene.add.zone(this.innerLeft, 0, this.innerWidth, 1).setOrigin(0).setDepth(depth + L.back);
    this.scrollZone.setInteractive();
    this.scrollZone.on('pointerdown', (pointer) => this.press(pointer, null, { canPick: false }));

    // Covers everything above the scrolling area (title + pinned Tools); redrawn when Tools opens/closes.
    this.cover = scene.add.graphics().setDepth(depth + L.cover);

    const footer = scene.add.graphics().setDepth(depth + L.frame);
    footer.fillStyle(COLORS.wood).fillRect(this.innerLeft, this.bottom, this.innerWidth, FOOTER_HEIGHT);
    footer.lineStyle(2, COLORS.woodEdge).lineBetween(this.innerLeft, this.bottom, this.innerLeft + this.innerWidth, this.bottom);

    // Shadow along the bottom edge of the pinned section, so the shelves read as sliding under it.
    this.stickyEdge = scene.add.graphics().setDepth(depth + L.frame);
    this.stickyEdge.fillStyle(0x000000, 0.12).fillRect(this.innerLeft, 0, this.innerWidth, 5);
    this.stickyEdge.lineStyle(2, COLORS.woodEdge).lineBetween(this.innerLeft, 0, this.innerLeft + this.innerWidth, 0);

    drawPlank(scene, this.x, this.y, this.width, HEADER_HEIGHT).setDepth(depth + L.frame);
    scene.add
      .text(this.x + this.width / 2, this.y + HEADER_HEIGHT / 2 - 2, 'My Kitchen Storage!', textStyle(26, 700))
      .setOrigin(0.5)
      .setDepth(depth + L.frame);
    this.moreHint = scene.add
      .text(this.x + this.width / 2, this.y + this.height - FOOTER_HEIGHT / 2, '', textStyle(13, 500, COLORS.ink))
      .setOrigin(0.5)
      .setDepth(depth + L.overlay);
  }

  contains(px, _py) {
    return px >= this.x;
  }

  wheel(_pointer, dy) {
    this.scroller.scrollBy(dy);
  }

  press(pointer, id, opts) {
    this.scroller.stop();
    this.gesture.begin(pointer, id, opts);
  }

  /** Shows exactly the items in `ids` (a Set): new ones are added, missing ones shrink away. */
  refresh(ids) {
    this.ids = ids;
    retireShelfTokens(this.scene, this.entries, ids);
    for (const id of ids) {
      if (this.entries.has(id)) continue;
      const item = this.itemsById.get(id);
      if (!item) continue;
      const token = makeShelfToken(this.scene, item, this.depth + L.scrollItems);
      token.hit.on('pointerdown', (pointer) => {
        if (!this.interceptPress?.(id)) this.press(pointer, id);
      });
      this.entries.set(id, token);
    }

    this.decor.forEach((o) => o.destroy());
    this.decor = [];
    this.pinnedHeader = null;
    this.pinnedRows = [];
    this.rows = [];

    const shown = [...this.entries.keys()];
    for (const section of SECTIONS) {
      const pinned = !!section.pinned;
      const decorDepth = this.depth + (pinned ? L.pinnedDecor : L.scrollDecor);
      const itemDepth = this.depth + (pinned ? L.pinnedItems : L.scrollItems);
      const sectionItems = sectionIds(section, shown, this.itemsById);

      const header = makeSectionHeader(this.scene, {
        x: this.innerLeft,
        w: this.innerWidth,
        text: `${section.label} (${sectionItems.length})`,
        depth: decorDepth,
        toggle: pinned ? { open: this.toolsOpen, onToggle: () => this.toggleTools() } : null,
      });
      this.decor.push(...header.objs);
      const headerRow = { height: SECTION_H, parts: header.parts };

      const itemRows = [];
      for (let i = 0; i < sectionItems.length; i += COLS) {
        const rowIds = sectionItems.slice(i, i + COLS);
        const height = section.style === 'pegboard' ? TOOL_ROW_H : SHELF_ROW_H;
        const bg =
          section.style === 'pegboard'
            ? drawPegboard(this.scene, this.innerLeft, this.innerWidth, height, decorDepth)
            : drawShelf(this.scene, this.innerLeft, this.innerWidth, decorDepth);
        this.decor.push(bg);
        const parts = [{ obj: bg, relY: 0 }];
        rowIds.forEach((id, c) => {
          const token = this.entries.get(id).setDepth(itemDepth);
          token.setX(this.innerLeft + (c + 0.5) * (this.innerWidth / COLS));
          parts.push({ obj: token, relY: ICON_Y, token });
        });
        itemRows.push({ height, ids: rowIds, parts });
      }

      if (pinned) {
        this.pinnedHeader = headerRow;
        this.pinnedRows = itemRows;
      } else {
        this.rows.push(headerRow, ...itemRows);
      }
    }

    this.layout();
  }

  toggleTools() {
    this.toolsOpen = !this.toolsOpen;
    saveToolsOpen(this.toolsOpen);
    this.refresh(this.ids); // rebuilds the header so the caret flips
  }

  // ---------------------------------------------------------------- Layout & scrolling

  /** Top of the scrolling area: just below the pinned Tools section (open or closed). */
  get scrollTop() {
    let top = this.y + HEADER_HEIGHT;
    if (this.pinnedHeader) top += this.pinnedHeader.height;
    if (this.toolsOpen) for (const row of this.pinnedRows) top += row.height;
    return top;
  }

  get contentHeight() {
    return this.rows.reduce((sum, row) => sum + row.height, 0);
  }

  /** Lays out the pinned section and the scrolling area's frame; then the shelves. */
  layout() {
    let top = this.y + HEADER_HEIGHT;
    if (this.pinnedHeader) {
      this.place(this.pinnedHeader, top, true);
      top += this.pinnedHeader.height;
    }
    for (const row of this.pinnedRows) {
      this.place(row, top, this.toolsOpen);
      if (this.toolsOpen) top += row.height;
    }

    if (top !== this.coverBottom) {
      this.coverBottom = top;
      this.cover.clear();
      fillCabinet(this.cover, { x: this.x, y: this.y, w: this.width, h: top - this.y }, POST_W);
      this.stickyEdge.setY(top);
      this.scrollZone.setPosition(this.innerLeft, top).setSize(this.innerWidth, Math.max(1, this.bottom - top));
    }

    this.scroller.setMax(this.contentHeight - (this.bottom - top));
    this.layoutScrolling();
  }

  /** Positions the scrolling shelves for the current scroll offset (called every frame while moving). */
  layoutScrolling() {
    const viewTop = this.scrollTop;
    let top = viewTop - this.scroller.pos;
    for (const row of this.rows) {
      const visible = top + row.height > viewTop - SHELF_ROW_H && top < this.bottom;
      this.place(row, top, visible, viewTop);
      top += row.height;
    }

    const hints = [];
    if (this.scroller.pos > 1) hints.push('▲');
    if (this.scroller.pos < this.scroller.max - 1) hints.push('▼');
    this.moreHint.setText(hints.length ? `${hints.join(' ')}  scroll for more` : '');
  }

  place(row, top, visible, viewTop = null) {
    for (const { obj, relY, token } of row.parts) {
      obj.setY(top + relY).setVisible(visible);
      if (token) {
        // Only items fully in view can be grabbed; half-hidden ones are under the covers.
        const inView = viewTop === null || (obj.y - 30 >= viewTop && obj.y + 30 <= this.bottom);
        token.setInputEnabled(visible && inView);
      } else if (obj.input) {
        obj.input.enabled = visible;
      }
    }
  }

  /** Scrolls the entry into view and returns where it will end up. */
  revealEntry(id) {
    const token = this.entries.get(id);
    if (token && this.pinnedRows.some((row) => row.ids.includes(id))) {
      if (!this.toolsOpen) this.toggleTools();
      return { x: token.x, y: token.y };
    }

    const r = this.rows.findIndex((row) => row.ids?.includes(id));
    if (r < 0 || !token) return { x: this.x + this.width / 2, y: this.y + HEADER_HEIGHT / 2 };

    // Show the section header too when the item is in its section's first row.
    const first = this.rows[r - 1]?.ids ? r : r - 1;
    const offsetOf = (i) => this.rows.slice(0, i).reduce((sum, row) => sum + row.height, 0);
    const rowTop = offsetOf(first);
    const rowBottom = offsetOf(r) + this.rows[r].height;
    const viewH = this.bottom - this.scrollTop;

    let target = this.scroller.pos;
    if (rowTop < target) target = rowTop;
    else if (rowBottom > target + viewH) target = rowBottom - viewH;
    target = Math.min(Math.max(0, target), this.scroller.max);
    this.scroller.scrollTo(target);

    return { x: token.x, y: this.scrollTop - target + offsetOf(r) + ICON_Y };
  }

  flashNew(id) {
    const token = this.entries.get(id);
    if (token) flashNew(this.scene, token, this.depth + L.overlay);
  }
}
