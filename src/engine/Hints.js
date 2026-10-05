import { REUSABLE_TYPES } from '../data/start.js';

/** Which hint group an item falls into when it's the *partner* in a combination. */
export function partnerCategory(item) {
  if (!item) return 'processed';
  if (REUSABLE_TYPES.has(item.type)) return 'tool';
  if (item.type === 'base_ingredient') return 'raw';
  return 'processed';
}

/**
 * How many combinations an item takes part in, and how many the player has found, grouped by what
 * the other ingredient is (tool / raw / processed). A recipe of the item with itself counts in the
 * item's own group, and flags `tryDouble` while it's still undiscovered.
 *
 * @returns {{ tool, raw, processed, found, total, tryDouble }} each group is `{ found, total }`
 */
export function combinationHints(itemId, recipes, itemsById, isDiscovered) {
  const groups = {
    tool: { found: 0, total: 0 },
    raw: { found: 0, total: 0 },
    processed: { found: 0, total: 0 },
  };
  let tryDouble = false;

  for (const recipe of recipes) {
    const [a, b] = recipe.inputs;
    if (a !== itemId && b !== itemId) continue;
    const partner = a === itemId ? b : a;
    const group = groups[partnerCategory(itemsById.get(partner))];
    group.total += 1;
    if (isDiscovered(recipe.id)) group.found += 1;
    else if (a === b) tryDouble = true;
  }

  const found = groups.tool.found + groups.raw.found + groups.processed.found;
  const total = groups.tool.total + groups.raw.total + groups.processed.total;
  return { ...groups, found, total, tryDouble };
}
