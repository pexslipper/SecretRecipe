// Smooth, free-scrolling position with touch-style physics. No Phaser dependency, so it's unit testable.
//
// - Dragging moves the content 1:1 with the finger; past either end it stretches with resistance.
// - Letting go keeps the content gliding (momentum) and it slows down naturally.
// - Anything left past an end springs back. Wheel/arrow scrolling eases to its target.
// Positions are never snapped to rows or columns.

const OVERSCROLL_RESISTANCE = 0.35;
const FRICTION = 0.995; // per ms while inside bounds
const OUT_OF_BOUNDS_FRICTION = 0.97; // per ms while overscrolled
const SPRING = 0.985; // per ms, pull back toward the edge
const EASE = 0.98; // per ms, approach to a wheel/arrow target
const MIN_VELOCITY = 0.01; // px/ms
const MAX_VELOCITY = 4; // px/ms
const VELOCITY_WINDOW_MS = 100;

export class KineticScroller {
  constructor({ max = 0, onChange = () => {}, now = () => performance.now() } = {}) {
    this.pos = 0;
    this.max = Math.max(0, max);
    this.onChange = onChange;
    this.now = now;
    this.velocity = 0;
    this.target = null;
    this.dragging = false;
    this.samples = [];
  }

  get isMoving() {
    return this.dragging || this.velocity !== 0 || this.target !== null || this.pos < 0 || this.pos > this.max;
  }

  /** Content size changed. Keeps the position inside the new range. */
  setMax(max) {
    this.max = Math.max(0, max);
    if (this.target !== null) this.target = clamp(this.target, 0, this.max);
    if (!this.dragging && (this.pos < 0 || this.pos > this.max)) {
      this.pos = clamp(this.pos, 0, this.max);
      this.velocity = 0;
      this.onChange(this.pos);
    }
  }

  /** Touching moving content stops it where it is (an overscroll still springs back). */
  stop() {
    this.velocity = 0;
    this.target = null;
  }

  dragStart() {
    this.dragging = true;
    this.velocity = 0;
    this.target = null;
    // Track where the finger "would" put the content; past the ends only part of that shows.
    this.raw = this.toRaw(this.pos);
    this.samples = [{ t: this.now(), pos: this.pos }];
  }

  /** `deltaPx` is how far the finger moved; the content follows it (finger up/left => position grows). */
  dragBy(deltaPx) {
    this.raw -= deltaPx;
    this.pos = this.fromRaw(this.raw);
    const t = this.now();
    this.samples.push({ t, pos: this.pos });
    while (this.samples.length > 2 && t - this.samples[0].t > VELOCITY_WINDOW_MS) this.samples.shift();
    this.onChange(this.pos);
  }

  dragEnd() {
    this.dragging = false;
    const t = this.now();
    const last = this.samples[this.samples.length - 1];
    const first = this.samples.find((s) => t - s.t <= VELOCITY_WINDOW_MS) ?? last;
    // Finger held still before lifting: no fling.
    if (!last || t - last.t > 80 || last.t === first.t) {
      this.velocity = 0;
    } else {
      const v = (last.pos - first.pos) / (last.t - first.t);
      this.velocity = Math.abs(v) < 0.05 ? 0 : clamp(v, -MAX_VELOCITY, MAX_VELOCITY);
    }
    this.samples = [];
  }

  /** Eased scroll by a distance (mouse wheel, arrow buttons). Repeated calls add up. */
  scrollBy(px) {
    this.velocity = 0;
    const base = this.target ?? clamp(this.pos, 0, this.max);
    this.target = clamp(base + px, 0, this.max);
  }

  scrollTo(pos, { animate = true } = {}) {
    this.velocity = 0;
    if (animate) {
      this.target = clamp(pos, 0, this.max);
    } else {
      this.target = null;
      this.pos = clamp(pos, 0, this.max);
      this.onChange(this.pos);
    }
  }

  fromRaw(raw) {
    if (raw < 0) return raw * OVERSCROLL_RESISTANCE;
    if (raw > this.max) return this.max + (raw - this.max) * OVERSCROLL_RESISTANCE;
    return raw;
  }

  toRaw(pos) {
    if (pos < 0) return pos / OVERSCROLL_RESISTANCE;
    if (pos > this.max) return this.max + (pos - this.max) / OVERSCROLL_RESISTANCE;
    return pos;
  }

  /** Advance the physics by `dt` ms. Call every frame. */
  update(dt) {
    if (this.dragging || dt <= 0) return;
    let moved = false;

    if (this.target !== null) {
      this.pos += (this.target - this.pos) * (1 - Math.pow(EASE, dt));
      if (Math.abs(this.target - this.pos) < 0.5) {
        this.pos = this.target;
        this.target = null;
      }
      moved = true;
    } else if (this.velocity !== 0) {
      this.pos += this.velocity * dt;
      const out = this.pos < 0 || this.pos > this.max;
      this.velocity *= Math.pow(out ? OUT_OF_BOUNDS_FRICTION : FRICTION, dt);
      if (Math.abs(this.velocity) < MIN_VELOCITY) this.velocity = 0;
      moved = true;
    } else if (this.pos < 0 || this.pos > this.max) {
      const edge = this.pos < 0 ? 0 : this.max;
      this.pos += (edge - this.pos) * (1 - Math.pow(SPRING, dt));
      if (Math.abs(edge - this.pos) < 0.5) this.pos = edge;
      moved = true;
    }

    if (moved) this.onChange(this.pos);
  }
}

/** Runs the scroller's physics on the scene's update loop until the scene shuts down. */
export function attachScroller(scene, scroller) {
  const tick = (_time, delta) => scroller.update(Math.min(delta, 50));
  scene.events.on('update', tick);
  scene.events.once('shutdown', () => scene.events.off('update', tick));
  return scroller;
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}
