// A new game starts small; more ingredients and tools unlock as the player discovers recipes.
export const STARTING_ITEMS = ['ing_meat', 'ing_tomato', 'ing_flour', 'ing_water', 'ing_egg', 'tool_cut', 'tool_pan'];

// `at` = number of recipes discovered (any successful new combination counts).
export const UNLOCKS = [
  { at: 2, item: 'tool_grill' },
  { at: 3, item: 'ing_onion' },
  { at: 4, item: 'tool_pot' },
  { at: 5, item: 'ing_chicken' },
  { at: 6, item: 'tool_oven' },
  { at: 8, item: 'ing_salt' },
  { at: 9, item: 'ing_rice' },
  { at: 10, item: 'ing_garlic' },
  { at: 12, item: 'tool_mortar' },
  { at: 13, item: 'ing_pork' },
  { at: 15, item: 'ing_chili' },
];

/** Items whose milestone has been reached but that aren't unlocked yet, in milestone order. */
export function unlocksDue(discoveredCount, unlocked) {
  return UNLOCKS.filter((u) => u.at <= discoveredCount && !unlocked.has(u.item)).map((u) => u.item);
}

/** The next locked milestone: `{ item, remaining }`, or null when everything is unlocked. */
export function nextUnlock(discoveredCount, unlocked) {
  const next = UNLOCKS.find((u) => !unlocked.has(u.item));
  if (!next) return null;
  return { item: next.item, remaining: Math.max(0, next.at - discoveredCount) };
}
