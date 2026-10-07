import { describe, it, expect } from 'vitest';
import { RecipeEngine } from './RecipeEngine.js';
import recipes from '../data/recipes.json';
import items from '../data/items.json';
import { buildCookbook } from './Cookbook.js';
import { levelUnlocks, dishPool } from './Orders.js';
import { LEVELS } from '../data/levels.js';
import { CHAPTERS_BY_KEY } from '../data/chapters.js';

const engine = new RecipeEngine(recipes);

describe('RecipeEngine', () => {
  it('Test 1: meat + knife -> sliced meat, routed to ingredients', () => {
    const r = engine.combine('ing_meat', 'tool_cut');
    expect(r.success).toBe(true);
    expect(r.output).toBe('ing_sliced_meat');
    expect(r.action).toBe('ADD_TO_INGREDIENTS');
    expect(r.consumed).toEqual(['ing_meat']);
  });

  it('Test 2: sliced meat + grill -> steak, served', () => {
    const r = engine.combine('ing_sliced_meat', 'tool_grill');
    expect(r.success).toBe(true);
    expect(r.output).toBe('dish_steak');
    expect(r.action).toBe('DISAPPEAR_SERVED');
  });

  it('Test 3: order independence', () => {
    const r = engine.combine('tool_cut', 'ing_meat');
    expect(r.success).toBe(true);
    expect(r.output).toBe('ing_sliced_meat');
  });

  it('Test 4: invalid pair fails and uses nothing up', () => {
    const r = engine.combine('ing_water', 'tool_cut');
    expect(r.success).toBe(false);
    expect(r.action).toBe('NO_MATCH');
    expect(r.output).toBeNull();
    expect(r.consumed).toEqual([]);
  });

  it('tomato + knife -> tomato sauce, routed to ingredients', () => {
    const r = engine.combine('ing_tomato', 'tool_cut');
    expect(r.output).toBe('ing_tomato_sauce');
    expect(r.action).toBe('ADD_TO_INGREDIENTS');
  });

  it('empty slot is rejected', () => {
    expect(engine.combine('ing_meat', null)).toEqual({ success: false, reason: 'INVALID_SLOTS' });
  });
});

describe('data integrity', () => {
  const itemIds = new Set(items.map((i) => i.id));

  it('every recipe input and output exists in items.json', () => {
    for (const r of recipes) {
      for (const id of [...r.inputs, r.output, ...(r.consumed || [])]) {
        expect(itemIds.has(id), `${r.id} references unknown item ${id}`).toBe(true);
      }
    }
  });

  /** Everything that can be made from `start`, following recipes until nothing new appears. */
  const reachableFrom = (start) => {
    const have = new Set(start);
    let changed = true;
    while (changed) {
      changed = false;
      for (const r of recipes) {
        if (r.inputs.every((id) => have.has(id)) && !have.has(r.output)) {
          have.add(r.output);
          changed = true;
        }
      }
    }
    return have;
  };
  const cookbook = buildCookbook(recipes, engine);
  const itemsById = new Map(items.map((i) => [i.id, i]));

  it('every recipe is reachable once the last chapter has unlocked everything', () => {
    const have = reachableFrom(levelUnlocks(LEVELS.length - 1, cookbook, itemsById));
    const unreachable = recipes.filter((r) => !have.has(r.output)).map((r) => r.id);
    expect(unreachable).toEqual([]);
  });

  it("every chapter's dishes can be cooked from what that chapter unlocks", () => {
    LEVELS.forEach((level, i) => {
      const have = reachableFrom(levelUnlocks(i, cookbook, itemsById));
      for (const dishId of dishPool(level, cookbook, itemsById)) expect(have.has(dishId), `chapter ${i + 1}: ${dishId}`).toBe(true);
    });
  });

  it('no two recipes use the same pair of inputs', () => {
    const keys = recipes.map((r) => engine.getCanonicalKey(...r.inputs));
    const dupes = keys.filter((k, i) => keys.indexOf(k) !== i);
    expect(dupes).toEqual([]);
  });

  it('item types agree with how the engine routes them', () => {
    for (const item of items) {
      if (item.type === 'crafted_ingredient') {
        expect(engine.isIntermediateIngredient(item.id), `${item.id} is never used as an input`).toBe(true);
      }
      if (item.type === 'final_dish' || item.type === 'joke') {
        expect(engine.isIntermediateIngredient(item.id), `${item.id} is final but used as an input`).toBe(false);
      }
    }
  });

  it('every dish and joke belongs to a Recipe Book chapter', () => {
    const finals = items.filter((i) => !engine.isIntermediateIngredient(i.id) && recipes.some((r) => r.output === i.id));
    for (const item of finals) {
      expect(CHAPTERS_BY_KEY.has(item.chapter), `${item.id} has no chapter`).toBe(true);
    }
  });

  it('every item has a description for its reveal card', () => {
    for (const item of items) expect(item.desc, item.id).toBeTruthy();
  });

  it('every item has its own emoji', () => {
    const emojis = items.map((i) => i.emoji);
    const dupes = emojis.filter((e, i) => emojis.indexOf(e) !== i);
    expect(dupes).toEqual([]);
  });
});
