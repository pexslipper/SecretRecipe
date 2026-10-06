// Slices public/assets/items.png into a Phaser texture atlas (public/assets/items.json).
//
// The generated sheet is not a perfectly even grid, so instead of cutting fixed-size cells this finds
// each icon's bounding box from the alpha channel: first the rows (horizontal bands with content),
// then the icons inside each row. Boxes are named in reading order from SHEET below, so if the sheet
// is regenerated in a different order, only SHEET needs editing.
//
// Run with: npm run atlas
import { readFileSync, writeFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

const SRC = 'public/assets/items.png';
const OUT = 'public/assets/items.json';
const ALPHA_MIN = 24; // pixels fainter than this count as background
const PAD = 2; // transparent margin kept around each icon

// Icon keys (the `icon` field in src/data/items.json) in sheet order, one array per row.
// `null` marks a picture on the sheet that no item uses.
const SHEET = [
  ['icon_cut', 'icon_mortar', 'icon_grill', 'icon_oven', 'icon_pan', 'icon_pot', 'icon_meat', 'icon_chicken', 'icon_pork', 'icon_flour', 'icon_water'],
  ['icon_tomato', 'icon_garlic', 'icon_onion', 'icon_chili', 'icon_salt', 'icon_rice', 'icon_egg', 'icon_sliced_meat', 'icon_dough', 'icon_bread', null /* spare baguette */, 'icon_tomato_sauce'],
  ['icon_raw_pizza', 'icon_garlic_paste', 'icon_chili_flakes', 'icon_spice_rub', 'icon_spicy_sauce', 'icon_chopped_onion', 'icon_steamed_rice', 'icon_egg_rice', 'icon_diced_chicken', 'icon_seasoned_chicken', 'icon_chicken_broth'],
  ['icon_garlic_pork', 'icon_rubbed_pork', 'icon_spicy_pork', 'icon_brine', 'icon_brined_chicken', 'icon_caramelized_onion', 'icon_fried_garlic', 'icon_salsa', 'icon_tortilla', 'icon_batter', 'icon_battered_chicken'],
  ['icon_ground_beef', 'icon_beef_patty', 'icon_ground_pork', 'icon_raw_dumplings', 'icon_noodles', 'icon_beaten_eggs', 'icon_tomato_paste', 'icon_bolognese', 'icon_pasta_sheets', 'icon_raw_lasagna', 'icon_chili_oil'],
  ['icon_beef_joint', 'icon_pork_belly', 'icon_rice_ball', 'icon_steak', 'icon_pizza', 'icon_garlic_bread', 'icon_tomato_soup', 'icon_fried_egg', 'icon_fried_rice', 'icon_grilled_chicken', 'icon_chicken_soup'],
  ['icon_pork_stir_fry', 'icon_roast_pork', 'icon_spicy_pork_bbq', 'icon_boiled_egg', 'icon_onion_soup', 'icon_garlic_rice', 'icon_taco', 'icon_pancakes', 'icon_fried_chicken', 'icon_roast_chicken', 'icon_burger'],
  ['icon_dumplings', 'icon_ramen', 'icon_spaghetti', 'icon_omelette', 'icon_spaghetti_bolognese', 'icon_lasagna', 'icon_spicy_noodles', 'icon_roast_beef', 'icon_braised_pork', 'icon_grilled_rice_ball'],
  ['icon_very_wet_water', 'icon_exploded_egg', 'icon_chicken_or_egg', 'icon_tears', 'icon_vampire_repellent', 'icon_flour_cloud', 'icon_salt_mountain', 'icon_drum_solo', 'icon_big_steam', null /* spare utensils */, 'icon_dragon_egg'],
];

/** Minimal decoder for 8-bit, non-interlaced RGBA/RGB PNGs. Returns { width, height, alpha(x, y) }. */
function decodePng(buf) {
  let pos = 8;
  let width, height, colorType;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      if (data[8] !== 8 || data[12] !== 0) throw new Error('Only 8-bit, non-interlaced PNGs are supported');
      colorType = data[9];
    } else if (type === 'IDAT') {
      idat.push(data);
    }
    pos += 12 + len;
  }
  if (colorType !== 6) throw new Error('The sheet needs a transparent background (RGBA PNG)');

  const bpp = 4;
  const stride = width * bpp;
  const raw = inflateSync(Buffer.concat(idat));
  const px = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const out = y * stride;
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? px[out + i - bpp] : 0;
      const b = y > 0 ? px[out - stride + i] : 0;
      const c = i >= bpp && y > 0 ? px[out - stride + i - bpp] : 0;
      let v = line[i];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      px[out + i] = v & 0xff;
    }
  }
  return { width, height, alpha: (x, y) => px[y * stride + x * bpp + 3] };
}

/** Runs of indices in [from, to) where `filled(i)` holds, joining runs separated by fewer than `minGap` empty indices. */
function runs(from, to, filled, minGap) {
  const result = [];
  let start = -1;
  let lastFilled = -Infinity;
  for (let i = from; i < to; i++) {
    if (!filled(i)) continue;
    if (start >= 0 && i - lastFilled - 1 >= minGap) {
      result.push([start, lastFilled + 1]);
      start = -1;
    }
    if (start < 0) start = i;
    lastFilled = i;
  }
  if (start >= 0) result.push([start, lastFilled + 1]);
  return result;
}

const img = decodePng(readFileSync(SRC));
const solid = (x, y) => img.alpha(x, y) >= ALPHA_MIN;

// Rows: horizontal bands that contain icon pixels (some rows are only ~4px apart). Specks are dropped.
const rows = runs(0, img.height, (y) => {
  for (let x = 0; x < img.width; x++) if (solid(x, y)) return true;
  return false;
}, 3).filter(([a, b]) => b - a > 12);

if (rows.length !== SHEET.length) {
  console.error(`Found ${rows.length} rows, expected ${SHEET.length}:`, rows);
  process.exit(1);
}

const frames = {};
let failed = false;
rows.forEach(([top, bottom], r) => {
  // Icons: vertical strips with content inside this row. Small gaps (splash droplets, steam puffs) are bridged.
  const cols = runs(0, img.width, (x) => {
    for (let y = top; y < bottom; y++) if (solid(x, y)) return true;
    return false;
  }, 14).filter(([a, b]) => b - a > 12);

  if (cols.length !== SHEET[r].length) {
    console.error(`Row ${r + 1}: found ${cols.length} icons, expected ${SHEET[r].length}:`, cols.map(([a, b]) => `${a}-${b}`).join(' '));
    failed = true;
    return;
  }

  cols.forEach(([left, right], c) => {
    const key = SHEET[r][c];
    if (!key) return;
    // Tighten the box vertically to this icon alone.
    const [[y0, y1]] = runs(top, bottom, (y) => {
      for (let x = left; x < right; x++) if (solid(x, y)) return true;
      return false;
    }, Infinity);
    const x = Math.max(0, left - PAD);
    const y = Math.max(0, y0 - PAD);
    const w = Math.min(img.width, right + PAD) - x;
    const h = Math.min(img.height, y1 + PAD) - y;
    frames[key] = { frame: { x, y, w, h }, rotated: false, trimmed: false, spriteSourceSize: { x: 0, y: 0, w, h }, sourceSize: { w, h } };
  });
});
if (failed) process.exit(1);

// Every item in the game should have a frame.
const items = JSON.parse(readFileSync('src/data/items.json', 'utf8'));
const missing = items.filter((i) => !frames[i.icon]).map((i) => i.icon);
if (missing.length) {
  console.error('No frame for:', missing.join(', '));
  process.exit(1);
}

writeFileSync(OUT, JSON.stringify({ frames, meta: { image: 'items.png', size: { w: img.width, h: img.height }, scale: '1' } }, null, 1) + '\n');
console.log(`Wrote ${Object.keys(frames).length} frames to ${OUT}`);
