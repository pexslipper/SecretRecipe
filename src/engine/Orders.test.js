import { describe, it, expect } from 'vitest';
import { RecipeEngine } from './RecipeEngine.js';
import { buildCookbook } from './Cookbook.js';
import {
  dishPool,
  levelUnlocks,
  drawOrders,
  orderSteps,
  patienceMs,
  moodAt,
  moodColor,
  chapterStars,
  isLevelOpen,
  nextHintStep,
} from './Orders.js';
import { LEVELS, CUSTOMERS_PER_LEVEL, PATIENCE_BASE_MS, PATIENCE_PER_STEP_MS } from '../data/levels.js';
import recipes from '../data/recipes.json';
import items from '../data/items.json';

const cookbook = buildCookbook(recipes, new RecipeEngine(recipes));
const itemsById = new Map(items.map((i) => [i.id, i]));
const stepsByDish = new Map(cookbook.map((e) => [e.dishId, e.steps]));

/** Deterministic rng for repeatable draws. */
function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

describe('dishPool', () => {
  it('grows with each chapter, then drops the short dishes: 9 / 15 / 23 / 27 / 20 / 20 dishes', () => {
    expect(LEVELS.map((l) => dishPool(l, cookbook, itemsById).length)).toEqual([9, 15, 23, 27, 20, 20]);
  });

  it('never offers jokes, and respects the step limits', () => {
    for (const level of LEVELS) {
      for (const id of dishPool(level, cookbook, itemsById)) {
        expect(itemsById.get(id).type).toBe('final_dish');
        expect(stepsByDish.get(id).length).toBeGreaterThanOrEqual(level.minSteps ?? 1);
        if (level.maxSteps !== null) expect(stepsByDish.get(id).length).toBeLessThanOrEqual(level.maxSteps);
      }
    }
  });

  it('has enough dishes to fill every chapter without repeats', () => {
    for (const level of LEVELS) {
      expect(dishPool(level, cookbook, itemsById).length).toBeGreaterThanOrEqual(CUSTOMERS_PER_LEVEL + level.doubles);
    }
  });
});

describe('levelUnlocks', () => {
  it('covers every raw ingredient and tool used by the chapter pool', () => {
    LEVELS.forEach((level, i) => {
      const unlocked = levelUnlocks(i, cookbook, itemsById);
      for (const dishId of dishPool(level, cookbook, itemsById)) {
        for (const recipe of stepsByDish.get(dishId)) {
          for (const id of recipe.inputs) {
            const type = itemsById.get(id).type;
            if (type === 'base_ingredient' || type === 'tool' || type === 'station') expect(unlocked.has(id)).toBe(true);
          }
        }
      }
    });
  });

  it('only adds, chapter after chapter, and holds nothing processed', () => {
    let previous = new Set();
    LEVELS.forEach((_, i) => {
      const unlocked = levelUnlocks(i, cookbook, itemsById);
      for (const id of previous) expect(unlocked.has(id)).toBe(true);
      for (const id of unlocked) expect(itemsById.get(id).type).not.toBe('crafted_ingredient');
      previous = unlocked;
    });
  });
});

describe('drawOrders', () => {
  it('gives 5 customers, no repeated dish, and the right number of two-dish orders', () => {
    LEVELS.forEach((level, i) => {
      const pool = dishPool(level, cookbook, itemsById);
      const orders = drawOrders(level, pool, stepsByDish, seeded(i + 1));
      expect(orders).toHaveLength(CUSTOMERS_PER_LEVEL);
      expect(orders.filter((o) => o.length === 2)).toHaveLength(level.doubles);
      const all = orders.flat();
      expect(new Set(all).size).toBe(all.length);
      for (const id of all) expect(pool).toContain(id);
    });
  });

  it('puts single orders first, easiest to hardest', () => {
    const level = LEVELS[5];
    const orders = drawOrders(level, dishPool(level, cookbook, itemsById), stepsByDish, seeded(7));
    const singles = orders.filter((o) => o.length === 1).map(([id]) => stepsByDish.get(id).length);
    expect(singles).toEqual([...singles].sort((a, b) => a - b));
    expect(orders.slice(-level.doubles).every((o) => o.length === 2)).toBe(true);
  });
});

describe('patience', () => {
  it('is base + per step, scaled by the chapter', () => {
    const order = ['dish_steak']; // slice, grill
    expect(patienceMs(order, { patience: 1 }, stepsByDish)).toBe(PATIENCE_BASE_MS + 2 * PATIENCE_PER_STEP_MS);
    expect(patienceMs(order, { patience: 0.5 }, stepsByDish)).toBe((PATIENCE_BASE_MS + 2 * PATIENCE_PER_STEP_MS) / 2);
  });

  it('counts a step shared by two dishes once', () => {
    const shared = orderSteps(['dish_pizza', 'dish_tomato_soup'], stepsByDish);
    const ids = shared.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('moods', () => {
  it('goes happy → impatient → angry → left as patience runs out', () => {
    expect(moodAt(1)).toBe('happy');
    expect(moodAt(0.6)).toBe('happy');
    expect(moodAt(0.5)).toBe('impatient');
    expect(moodAt(0.2)).toBe('angry');
    expect(moodAt(0)).toBe('left');
  });

  it('colours the bar green when happy and red when angry', () => {
    expect(moodColor(1)).toBe(0x6cc04a);
    expect(moodColor(0.1)).toBe(0xdd4a3c);
    const mid = moodColor(0.4);
    expect(mid).not.toBe(0x6cc04a);
    expect(mid).not.toBe(0xdd4a3c);
  });

  it('gives a star for each happy or impatient customer', () => {
    expect(chapterStars(['happy', 'impatient', 'angry', 'left', 'happy'])).toBe(3);
    expect(chapterStars([])).toBe(0);
  });
});

describe('isLevelOpen', () => {
  it('opens the first chapter, and each next one after a star in the previous', () => {
    expect(isLevelOpen(0, {})).toBe(true);
    expect(isLevelOpen(1, {})).toBe(false);
    expect(isLevelOpen(1, { 0: 0 })).toBe(false);
    expect(isLevelOpen(1, { 0: 1 })).toBe(true);
  });
});

describe('nextHintStep', () => {
  it('reveals the first undiscovered step in cooking order, then the next', () => {
    const none = () => false;
    expect(nextHintStep(['dish_pizza'], stepsByDish, none, new Set())).toBe('rec_003');
    expect(nextHintStep(['dish_pizza'], stepsByDish, none, new Set(['rec_003']))).toBe('rec_006');
  });

  it('skips discovered steps and returns null when all are known', () => {
    const found = new Set(['rec_001']);
    expect(nextHintStep(['dish_steak'], stepsByDish, (id) => found.has(id), new Set())).toBe('rec_002');
    expect(nextHintStep(['dish_steak'], stepsByDish, () => true, new Set())).toBeNull();
  });
});
