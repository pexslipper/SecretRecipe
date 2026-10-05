import { describe, it, expect } from 'vitest';
import { RecipeEngine } from './RecipeEngine.js';
import recipes from '../data/recipes.json';
import items from '../data/items.json';
import { STARTING_ITEMS } from '../data/start.js';

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
    const r = engine.combine('ing_water', 'tool_grill');
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
    STARTING_ITEMS.forEach((id) => expect(itemIds.has(id)).toBe(true));
  });

  it('every recipe is reachable from the starting set', () => {
    const unlocked = new Set(STARTING_ITEMS);
    let changed = true;
    while (changed) {
      changed = false;
      for (const r of recipes) {
        if (r.inputs.every((id) => unlocked.has(id)) && !unlocked.has(r.output)) {
          unlocked.add(r.output);
          changed = true;
        }
      }
    }
    const unreachable = recipes.filter((r) => !unlocked.has(r.output)).map((r) => r.id);
    expect(unreachable).toEqual([]);
  });

  it('early game: plenty to discover straight from the starting items', () => {
    const start = new Set(STARTING_ITEMS);
    const firstStep = recipes.filter((r) => r.inputs.every((id) => start.has(id)));
    expect(firstStep.length).toBeGreaterThanOrEqual(15);
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
      if (item.type === 'final_dish') {
        expect(engine.isIntermediateIngredient(item.id), `${item.id} is a dish but used as an input`).toBe(false);
      }
    }
  });

  it('every item has its own emoji', () => {
    const emojis = items.map((i) => i.emoji);
    const dupes = emojis.filter((e, i) => emojis.indexOf(e) !== i);
    expect(dupes).toEqual([]);
  });
});
