import { COLORS } from './theme.js';

// The table, cloth, chalkboard and props are drawn in a fixed 960×656 design space (which started
// at y = 64 under the original top bar), then scaled to fit whatever workspace the device has.
const BASE_W = 960;
const BASE_H = 656;
const BASE_TOP = 64;
const BOARD = { x: 285, y: 266, w: 393, h: 217 };

/**
 * Draws the cozy kitchen filling `rect`: window with sky, table with a striped cloth,
 * a chalkboard, and a few props. Purely decorative; nothing here is interactive.
 * The wall and window stretch to the rect; the table group keeps its proportions and sits at the
 * bottom centre. Returns where the chalkboard ended up so the hint text can sit on it.
 */
export function drawKitchen(scene, rect, { topOverlap = 8 } = {}) {
  const s = Math.min(rect.w / BASE_W, rect.h / BASE_H);
  const ox = rect.x + (rect.w - BASE_W * s) / 2;
  const oy = rect.y + rect.h - BASE_H * s;
  const toScreenX = (bx) => ox + bx * s;
  const toScreenY = (by) => oy + (by - BASE_TOP) * s;

  const g = scene.add.graphics();
  const top = rect.y - topOverlap;
  const bottom = rect.y + rect.h;
  const margin = Math.max(12, 26 * s);

  // Wall
  g.fillStyle(0xf8eedf).fillRect(rect.x, top, rect.w, bottom - top);

  const sill = toScreenY(474);
  drawWindow(g, { left: rect.x + margin, right: rect.x + rect.w - margin + 4 * s, top, sill, s });

  // Pink lower wall + floor strip
  const floorY = toScreenY(690);
  const pinkTop = sill + 16 * s;
  g.fillStyle(0xf3d5cf).fillRect(rect.x + margin, pinkTop, rect.w - margin * 2, floorY - pinkTop);
  g.lineStyle(2, 0xe8c2bb).strokeRect(rect.x + margin, pinkTop, rect.w - margin * 2, floorY - pinkTop);
  g.fillStyle(0xf1e3cf).fillRect(rect.x, floorY, rect.w, bottom - floorY);

  // Table group, scaled as one piece.
  const group = scene.add.container(ox, oy - BASE_TOP * s).setScale(s);
  const tg = scene.add.graphics();
  drawTable(tg);
  drawChalkboard(tg, BOARD);
  group.add([tg, ...drawProps(scene)]);

  return {
    x: toScreenX(BOARD.x + BOARD.w / 2),
    y: toScreenY(BOARD.y + BOARD.h / 2),
    width: BOARD.w * s,
    scale: s,
  };
}

function drawWindow(g, { left, right, top, sill, s }) {
  const w = right - left;
  // Frame
  g.fillStyle(0xefd2a9).fillRoundedRect(left, top, w, sill - top + 6, 10);
  g.lineStyle(2, COLORS.woodEdge).strokeRoundedRect(left, top, w, sill - top + 6, 10);

  const inset = Math.max(8, 14 * s);
  const mullion = Math.max(8, 14 * s);
  const colW = (w - inset * 2 - mullion * 2) / 3;
  const midY = top + (sill - top) * 0.52;
  const rows = [
    { y: top + inset, h: midY - top - inset - mullion / 2 },
    { y: midY + mullion / 2, h: sill - midY - mullion / 2 - 4 },
  ];

  for (let c = 0; c < 3; c++) {
    const px = left + inset + c * (colW + mullion);
    for (const { y, h } of rows) {
      g.fillGradientStyle(0xc6e3ef, 0xc6e3ef, 0xe9f6fa, 0xe9f6fa, 1).fillRect(px, y, colW, h);
      // diagonal light streaks, kept inside the pane
      g.fillStyle(0xffffff, 0.35);
      for (const [off, sw] of [[0.25, 0.16], [0.55, 0.07]]) {
        const x0 = px + colW * off;
        const slant = Math.min(h * 0.5, colW * 0.2);
        g.fillPoints(
          [
            { x: x0 + slant, y },
            { x: x0 + slant + colW * sw, y },
            { x: x0 + colW * sw, y: y + h },
            { x: x0, y: y + h },
          ],
          true,
        );
      }
      g.lineStyle(2, 0xd7b88f).strokeRect(px, y, colW, h);
    }
  }

  // Bushes peeking in at the bottom corners
  const bush = (bx, dir) => {
    g.fillStyle(0x93c47b);
    [[0, 0, 26], [dir * 26, 8, 20], [dir * 46, 14, 16]].forEach(([dx, dy, r]) =>
      g.fillCircle(bx + dx * s, sill - 6 * s + dy * s, r * s),
    );
    g.fillStyle(0xa9d391);
    [[dir * 6, -4, 16], [dir * 30, 6, 12]].forEach(([dx, dy, r]) => g.fillCircle(bx + dx * s, sill - 6 * s + dy * s, r * s));
  };
  bush(left + inset + 16 * s, 1);
  bush(right - inset - 16 * s, -1);

  // Sill
  const sillH = Math.max(10, 18 * s);
  g.fillStyle(0xe8c597).fillRoundedRect(left - 10, sill, w + 20, sillH, 5);
  g.lineStyle(2, COLORS.woodEdge).strokeRoundedRect(left - 10, sill, w + 20, sillH, 5);
}

function drawTable(g) {
  // Legs + apron
  g.fillStyle(0xe2b98a);
  g.fillRect(142, 612, 40, 80).fillRect(786, 612, 40, 80);
  g.lineStyle(2, COLORS.woodEdge).strokeRect(142, 612, 40, 80).strokeRect(786, 612, 40, 80);
  g.fillStyle(0xd9ad7c).fillRect(150, 612, 10, 80).fillRect(808, 612, 10, 80);

  // Top surface
  const top = [
    { x: 136, y: 160 },
    { x: 828, y: 160 },
    { x: 864, y: 596 },
    { x: 98, y: 596 },
  ];
  g.fillStyle(0xf4d8ae).fillPoints(top, true);
  // grain
  g.lineStyle(2, 0xe6c294, 0.9);
  [[200, 640, 205], [150, 420, 300], [520, 840, 330], [120, 380, 470], [600, 850, 520], [300, 560, 560]].forEach(
    ([x1, x2, y]) => {
      g.beginPath();
      g.moveTo(x1, y);
      for (let x = x1; x <= x2; x += 40) g.lineTo(x, y + Math.sin(x / 50) * 3);
      g.strokePath();
    },
  );
  g.lineStyle(3, COLORS.woodEdge).strokePoints(top, true);

  // Front edge
  g.fillStyle(0xe7bf8d).fillRect(98, 596, 766, 18);
  g.lineStyle(3, COLORS.woodEdge).strokeRect(98, 596, 766, 18);

  // Striped tablecloth
  const cloth = { x: 232, y: 232, w: 486, h: 282 };
  g.fillStyle(0xfbf3e5).fillRect(cloth.x, cloth.y, cloth.w, cloth.h);
  const stripes = [0xf2b8b1, 0xbfd8ad, 0xf7cb9d, 0xc9dfb6];
  for (let i = 0, sx = cloth.x + 10; sx < cloth.x + cloth.w - 10; sx += 38, i++) {
    g.fillStyle(stripes[i % stripes.length], 0.85).fillRect(sx, cloth.y, 16, cloth.h);
  }
  g.lineStyle(2, 0xe3cfb2).strokeRect(cloth.x, cloth.y, cloth.w, cloth.h);
  g.lineStyle(2, 0xd6bf9f);
  for (let y = cloth.y + 6; y < cloth.y + cloth.h; y += 9) {
    g.lineBetween(cloth.x - 7, y, cloth.x, y);
    g.lineBetween(cloth.x + cloth.w, y, cloth.x + cloth.w + 7, y);
  }
}

function drawChalkboard(g, { x, y, w, h }) {
  g.fillStyle(0x000000, 0.15).fillRoundedRect(x + 4, y + 6, w, h, 10);
  g.fillStyle(0xa8723f).fillRoundedRect(x, y, w, h, 10);
  g.fillStyle(0xc48c55).fillRoundedRect(x + 6, y + 6, w - 12, h - 12, 7);
  g.fillStyle(0x3c3a37).fillRect(x + 16, y + 16, w - 32, h - 32);
  // chalk smudges
  g.fillStyle(0x56534e, 0.45);
  g.fillEllipse(x + w * 0.3, y + h * 0.35, 140, 40).fillEllipse(x + w * 0.68, y + h * 0.62, 170, 46);
  g.fillStyle(0x4a4744, 0.5).fillEllipse(x + w * 0.5, y + h * 0.82, 220, 20);
  g.lineStyle(3, 0x7d5230).strokeRoundedRect(x, y, w, h, 10);
  return { x: x + w / 2, y: y + h / 2 };
}

function drawProps(scene) {
  // Rolling pin with a puff of flour
  const pin = scene.add.graphics({ x: 300, y: 530 }).setAngle(38);
  pin.fillStyle(0xffffff, 0.85).fillCircle(-40, 18, 14).fillCircle(-22, 24, 10).fillCircle(-52, 8, 9);
  pin.fillStyle(0xd99a5f).fillRoundedRect(-55, -13, 110, 26, 12);
  pin.fillStyle(0xe8b47c).fillRect(-50, -10, 100, 6);
  pin.fillStyle(0xc4844b).fillRoundedRect(-82, -6, 30, 12, 6).fillRoundedRect(52, -6, 30, 12, 6);
  pin.lineStyle(2, 0x9a6234).strokeRoundedRect(-55, -13, 110, 26, 12);

  // Cookie cutter
  const cutter = scene.add.graphics({ x: 395, y: 548 });
  cutter.lineStyle(5, 0x9fb3c4);
  cutter.strokeCircle(-8, -6, 11).strokeCircle(8, -6, 11).strokeCircle(0, 8, 11);

  // Smiling bowl
  const bowl = scene.add.graphics({ x: 700, y: 520 });
  bowl.fillStyle(0x000000, 0.1).fillEllipse(0, 34, 80, 12);
  bowl.fillStyle(0xf6cf72);
  bowl.beginPath();
  bowl.arc(0, 0, 42, 0, Math.PI, false);
  bowl.closePath();
  bowl.fillPath();
  bowl.fillStyle(0xfae2a6).fillEllipse(0, 0, 84, 16);
  bowl.fillStyle(0xe9b752).fillEllipse(0, 1, 70, 9);
  bowl.lineStyle(2, 0xc9953c).strokeEllipse(0, 0, 84, 16);
  bowl.fillStyle(0x5a3a22).fillCircle(-12, 16, 3).fillCircle(12, 16, 3);
  bowl.lineStyle(2, 0x5a3a22);
  bowl.beginPath();
  bowl.arc(0, 19, 6, 0.2, Math.PI - 0.2, false);
  bowl.strokePath();
  bowl.fillStyle(0xf29a8a, 0.7).fillCircle(-22, 22, 4).fillCircle(22, 22, 4);

  // Cracker on the cloth
  const cracker = scene.add.graphics({ x: 712, y: 440 });
  cracker.fillStyle(0xf3c35a);
  [[0, 0, 14], [12, -6, 10], [-10, 8, 9], [10, 10, 9]].forEach(([dx, dy, r]) => cracker.fillCircle(dx, dy, r));
  cracker.fillStyle(0xd99e3a).fillCircle(-2, -2, 2.5).fillCircle(8, 4, 2.5).fillCircle(2, 8, 2);

  return [pin, cutter, bowl, cracker];
}

/** Wooden plank used for the top bar and the sidebar header. */
export function drawPlank(scene, x, y, w, h, { roundBottom = true } = {}) {
  const g = scene.add.graphics();
  const r = roundBottom ? { tl: 0, tr: 0, bl: 14, br: 14 } : 0;
  g.fillStyle(0x000000, 0.12).fillRoundedRect(x, y + 4, w, h, r);
  g.fillStyle(COLORS.woodLight).fillRoundedRect(x, y, w, h, r);
  g.fillStyle(0xe6bd88).fillRoundedRect(x, y + h - 10, w, 10, roundBottom ? { tl: 0, tr: 0, bl: 14, br: 14 } : 0);
  g.lineStyle(2, COLORS.woodGrain, 0.9);
  for (const [fx, fy, fw] of [[0.05, 0.3, 0.25], [0.4, 0.55, 0.3], [0.7, 0.25, 0.22]]) {
    g.lineBetween(x + w * fx, y + h * fy, x + w * (fx + fw), y + h * fy + 1);
  }
  g.lineStyle(3, COLORS.woodEdge).strokeRoundedRect(x, y, w, h, r);
  return g;
}
