const DECIDE_DISTANCE = 8;

/**
 * Tells apart scroll / pick / tap for one pointer (mouse or finger) pressed on a storage panel.
 *
 * - `scrollAxis`: 'vertical' (column) or 'horizontal' (drawer). Movement mostly along it scrolls.
 * - `pickDirection`: 'left' or 'up' — movement mostly that way pulls the item out.
 * Once the pointer has moved past a few px the intent is fixed for the rest of the gesture.
 */
export class PointerGesture {
  constructor(scene, { scrollAxis, pickDirection, onScrollStart, onScroll, onScrollEnd, onPick, onTap }) {
    this.scene = scene;
    this.scrollAxis = scrollAxis;
    this.pickDirection = pickDirection;
    this.onScrollStart = onScrollStart;
    this.onScroll = onScroll;
    this.onScrollEnd = onScrollEnd;
    this.onPick = onPick;
    this.onTap = onTap;
    this.active = null;

    scene.input.on('pointermove', this.handleMove, this);
    scene.input.on('pointerup', this.handleUp, this);
    scene.input.on('pointerupoutside', this.handleUp, this);
    scene.events.once('shutdown', () => {
      scene.input.off('pointermove', this.handleMove, this);
      scene.input.off('pointerup', this.handleUp, this);
      scene.input.off('pointerupoutside', this.handleUp, this);
    });
  }

  /** Start tracking. `target` is passed back to the callbacks (e.g. the item id, or null for empty space). */
  begin(pointer, target, { canPick = true, context } = {}) {
    this.active = {
      pointerId: pointer.id,
      target,
      canPick,
      context,
      startX: pointer.x,
      startY: pointer.y,
      lastX: pointer.x,
      lastY: pointer.y,
      intent: null,
    };
  }

  cancel() {
    if (this.active?.intent === 'scroll') this.onScrollEnd?.(this.active.context);
    this.active = null;
  }

  handleMove(pointer) {
    const g = this.active;
    if (!g || pointer.id !== g.pointerId || !pointer.isDown) return;

    if (!g.intent) {
      const dx = pointer.x - g.startX;
      const dy = pointer.y - g.startY;
      if (Math.hypot(dx, dy) < DECIDE_DISTANCE) return;

      const alongScroll = this.scrollAxis === 'vertical' ? Math.abs(dy) > Math.abs(dx) : Math.abs(dx) > Math.abs(dy);
      const towardPick = this.pickDirection === 'left' ? dx < 0 : dy < 0;
      if (alongScroll) {
        g.intent = 'scroll';
        this.onScrollStart?.(g.context);
      } else if (g.canPick && towardPick) {
        g.intent = 'pick';
        this.active = null;
        this.onPick?.(g.target, pointer, g.context);
        return;
      } else {
        g.intent = 'ignore';
      }
    }

    if (g.intent === 'scroll') {
      const delta = this.scrollAxis === 'vertical' ? pointer.y - g.lastY : pointer.x - g.lastX;
      this.onScroll?.(delta, g.context);
    }
    g.lastX = pointer.x;
    g.lastY = pointer.y;
  }

  handleUp(pointer) {
    const g = this.active;
    if (!g || pointer.id !== g.pointerId) return;
    this.active = null;
    if (g.intent === 'scroll') this.onScrollEnd?.(g.context);
    else if (!g.intent && g.target != null) this.onTap?.(g.target, pointer, g.context);
  }
}
