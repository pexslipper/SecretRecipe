// Customer art: public/assets/Customers.png, 10 poses across and one character per row (6 rows).
// Columns are evenly spaced; each row is cropped to its character, who is cut off flat at the
// waist, so sprites are anchored at the bottom-centre and stand behind the counter.
export const CUSTOMER_TEXTURE = 'customers';
export const CUSTOMER_FILE = 'Customers.png';

const COL_W = 2752 / 10;
const FRAME_W = 275;
// [top, bottom] pixel rows of each character, measured from the sheet.
const ROWS = [
  [51, 278],
  [306, 529],
  [547, 776],
  [790, 1028],
  [1045, 1275],
  [1296, 1528],
];

export const CHARACTER_COUNT = ROWS.length;
export const CUSTOMER_FRAME_W = FRAME_W;
export const CUSTOMER_FRAME_H = Math.max(...ROWS.map(([top, bottom]) => bottom - top + 1));

// Column of each pose on the sheet.
export const POSES = {
  idle: 0,
  wave: 2, // walking in
  cheer: 3,
  thumbsUp: 4, // served while happy
  armsCrossed: 5, // starting to get impatient
  fidget: 6, // checking the watch / hand on head
  sigh: 7, // served, but only once angry
  scold: 8, // angry
  furious: 9, // walking out without food
};

export function customerFrame(character, pose) {
  return `customer_${character % CHARACTER_COUNT}_${POSES[pose]}`;
}

/** Registers a named frame for every character and pose on the loaded sheet. */
export function addCustomerFrames(texture) {
  ROWS.forEach(([top, bottom], character) => {
    for (const col of new Set(Object.values(POSES))) {
      texture.add(`customer_${character}_${col}`, 0, Math.round(col * COL_W), top, FRAME_W, bottom - top + 1);
    }
  });
}

/** Height of one character's frame, so a bar can sit just above their head. */
export function characterHeight(character) {
  const [top, bottom] = ROWS[character % CHARACTER_COUNT];
  return bottom - top + 1;
}
