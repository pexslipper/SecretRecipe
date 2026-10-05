import { describe, it, expect } from 'vitest';
import { STARTING_ITEMS, UNLOCKS, unlocksDue, nextUnlock } from './unlocks.js';
import recipes from './recipes.json';
import items from './items.json';

/** Recipes the player can make with only `available` base items/tools. */
function reachableRecipes(available) {
  const have = new Set(available);
  const made = new Set();
  let changed = true;
  while (changed) {
    changed = false;
    for (const r of recipes) {
      if (!made.has(r.id) && r.inputs.every((id) => have.has(id))) {
        made.add(r.id);
        have.add(r.output);
        changed = true;
      }
    }
  }
  return made;
}

describe('unlocks', () => {
  it('every base ingredient and tool is either a starting item or unlocked later', () => {
    const covered = new Set([...STARTING_ITEMS, ...UNLOCKS.map((u) => u.item)]);
    const base = items.filter((i) => ['base_ingredient', 'tool', 'station'].includes(i.type)).map((i) => i.id);
    expect(base.filter((id) => !covered.has(id))).toEqual([]);
    expect(UNLOCKS.filter((u) => STARTING_ITEMS.includes(u.item))).toEqual([]);
  });

  it('the player can always reach the next milestone with what they already have', () => {
    const available = [...STARTING_ITEMS];
    for (const { at, item } of UNLOCKS) {
      expect(reachableRecipes(available).size, `stuck before ${item} (needs ${at})`).toBeGreaterThanOrEqual(at);
      available.push(item);
    }
  });

  it('milestones are in order', () => {
    const ats = UNLOCKS.map((u) => u.at);
    expect([...ats].sort((a, b) => a - b)).toEqual(ats);
  });

  it('unlocksDue / nextUnlock', () => {
    const unlocked = new Set(STARTING_ITEMS);
    expect(unlocksDue(1, unlocked)).toEqual([]);
    expect(unlocksDue(3, unlocked)).toEqual(['tool_grill', 'ing_onion']);
    expect(nextUnlock(1, unlocked)).toEqual({ item: 'tool_grill', remaining: 1 });
    const all = new Set([...STARTING_ITEMS, ...UNLOCKS.map((u) => u.item)]);
    expect(nextUnlock(99, all)).toBeNull();
  });
});
