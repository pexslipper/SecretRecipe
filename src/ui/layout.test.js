import { describe, it, expect } from 'vitest';
import { computeLayout, drawerHeight, layoutFor } from './layout.js';

const VIEWPORTS = {
  desktop: [1440, 900, 'landscape', 'column'],
  ipadLandscape: [1180, 820, 'landscape', 'column'],
  ipadPortrait: [820, 1180, 'portrait', 'drawer'],
  phonePortrait: [390, 844, 'portrait', 'drawer'],
  phoneLandscape: [844, 390, 'landscape', 'column'],
};

const inside = (r, w, h) => r.x >= 0 && r.y >= 0 && r.x + r.w <= w && r.y + r.h <= h;
const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe('computeLayout', () => {
  for (const [name, [vw, vh, orientation, kind]] of Object.entries(VIEWPORTS)) {
    describe(name, () => {
      const l = computeLayout(vw, vh);

      it(`is ${orientation} with a ${kind}`, () => {
        expect(l.orientation).toBe(orientation);
        expect(l.storage.kind).toBe(kind);
      });

      it('keeps every area on screen without overlapping', () => {
        for (const r of [l.hud, l.workspace, l.storage.rect]) expect(inside(r, l.width, l.height)).toBe(true);
        expect(overlaps(l.workspace, l.storage.rect)).toBe(false);
        expect(overlaps(l.hud, l.workspace)).toBe(false);
        expect(overlaps(l.hud, l.storage.rect)).toBe(false);
      });

      it('gives the workspace at least 40% of the screen', () => {
        expect((l.workspace.w * l.workspace.h) / (l.width * l.height)).toBeGreaterThanOrEqual(0.4);
      });

      it('matches the viewport shape (no letterboxing for common devices)', () => {
        expect(l.width / l.height).toBeCloseTo(vw / vh, 1);
      });
    });
  }

  it('laying out a game size gives the same result as the viewport it came from', () => {
    for (const [vw, vh] of Object.values(VIEWPORTS)) {
      const l = computeLayout(vw, vh);
      expect(layoutFor(l.width, l.height)).toEqual(l);
    }
  });

  it('closing Tools gives the portrait workspace more room', () => {
    const open = computeLayout(390, 844, { toolsOpen: true });
    const closed = computeLayout(390, 844, { toolsOpen: false });
    expect(closed.workspace.h - open.workspace.h).toBe(drawerHeight(true) - drawerHeight(false));
    expect(closed.width).toBe(open.width);
    expect(closed.height).toBe(open.height);
  });
});
