import { describe, it, expect } from 'vitest';
import { KineticScroller } from './KineticScroller.js';

function makeScroller(max = 500) {
  let t = 0;
  const s = new KineticScroller({ max, now: () => t });
  const advance = (ms) => {
    t += ms;
  };
  const run = (ms, step = 16) => {
    for (let i = 0; i < ms; i += step) {
      advance(step);
      s.update(step);
    }
  };
  return { s, advance, run };
}

describe('KineticScroller', () => {
  it('follows the finger exactly while dragging (no snapping)', () => {
    const { s, advance } = makeScroller();
    s.dragStart();
    advance(16);
    s.dragBy(-37); // finger moves up 37px
    expect(s.pos).toBe(37);
    advance(16);
    s.dragBy(-5.5);
    expect(s.pos).toBe(42.5);
  });

  it('keeps gliding after a fling, then comes to rest inside the bounds', () => {
    const { s, advance, run } = makeScroller();
    s.dragStart();
    for (let i = 0; i < 5; i++) {
      advance(16);
      s.dragBy(-20); // fast upward swipe
    }
    const atRelease = s.pos;
    s.dragEnd();
    expect(s.velocity).toBeGreaterThan(0);
    run(100);
    expect(s.pos).toBeGreaterThan(atRelease); // momentum
    run(3000);
    expect(s.velocity).toBe(0);
    expect(s.pos).toBeGreaterThanOrEqual(0);
    expect(s.pos).toBeLessThanOrEqual(500);
    expect(Number.isInteger(s.pos / 104)).toBe(false); // not snapped to a row
  });

  it('does not fling if the finger stopped before lifting', () => {
    const { s, advance } = makeScroller();
    s.dragStart();
    advance(16);
    s.dragBy(-30);
    advance(200);
    s.dragEnd();
    expect(s.velocity).toBe(0);
  });

  it('stretches with resistance past the start and springs back', () => {
    const { s, advance, run } = makeScroller();
    s.dragStart();
    advance(16);
    s.dragBy(100); // pull down at the top
    expect(s.pos).toBeLessThan(0);
    expect(s.pos).toBeGreaterThan(-100);
    advance(200);
    s.dragEnd();
    run(1000);
    expect(s.pos).toBe(0);
  });

  it('eases to wheel targets and adds repeated wheel steps together', () => {
    const { s, run } = makeScroller();
    s.scrollBy(100);
    s.scrollBy(100);
    run(30);
    expect(s.pos).toBeGreaterThan(0);
    expect(s.pos).toBeLessThan(200);
    run(1000);
    expect(s.pos).toBe(200);
  });

  it('clamps when the content shrinks', () => {
    const { s } = makeScroller();
    s.scrollTo(400, { animate: false });
    s.setMax(150);
    expect(s.pos).toBe(150);
  });
});
