import { describe, it, expect } from 'vitest';
import { combinationHints } from './Hints.js';
import recipes from '../data/recipes.json';
import items from '../data/items.json';

const itemsById = new Map(items.map((i) => [i.id, i]));
const hints = (id, found = []) => combinationHints(id, recipes, itemsById, (rid) => found.includes(rid));

describe('combinationHints', () => {
  it('groups by the partner type: Beef pairs with 2 tools and itself', () => {
    const h = hints('ing_meat');
    expect(h.tool).toEqual({ found: 0, total: 2 }); // Knife, Mortar
    expect(h.raw).toEqual({ found: 0, total: 1 }); // Beef + Beef
    expect(h.processed).toEqual({ found: 0, total: 0 });
    expect(h.tryDouble).toBe(true);
  });

  it('counts what has been found', () => {
    const h = hints('ing_meat', ['rec_001', 'rec_064']);
    expect(h.tool).toEqual({ found: 1, total: 2 });
    expect(h.raw).toEqual({ found: 1, total: 1 });
    expect(h.found).toBe(2);
    expect(h.total).toBe(3);
    expect(h.tryDouble).toBe(false); // Beef + Beef already found
  });

  it('works for tools too: the Knife only pairs with ingredients', () => {
    const h = hints('tool_cut');
    expect(h.tool.total).toBe(0);
    expect(h.raw.total).toBe(4); // Beef, Tomato, Onion, Chicken
    expect(h.processed.total).toBe(1); // Dough
  });

  it('every ingredient and tool has at least one combination', () => {
    for (const item of items) {
      if (item.type === 'final_dish') continue;
      expect(hints(item.id).total, item.id).toBeGreaterThan(0);
    }
  });
});
