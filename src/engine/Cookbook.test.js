import { describe, it, expect } from 'vitest';
import { RecipeEngine } from './RecipeEngine.js';
import { buildCookbook } from './Cookbook.js';
import recipes from '../data/recipes.json';
import items from '../data/items.json';

const cookbook = buildCookbook(recipes, new RecipeEngine(recipes));
const stepsOf = (dishId) => cookbook.find((d) => d.dishId === dishId).steps.map((r) => r.id);

describe('buildCookbook', () => {
  it('lists every final dish and nothing else', () => {
    const dishes = items.filter((i) => i.type === 'final_dish').map((i) => i.id);
    expect(cookbook.map((d) => d.dishId).sort()).toEqual(dishes.sort());
  });

  it('spicy pork bbq: sauce and flakes are made before they are combined', () => {
    expect(stepsOf('dish_spicy_pork_bbq')).toEqual(['rec_006', 'rec_008', 'rec_010', 'rec_025', 'rec_026']);
  });

  it('steak: slice then grill', () => {
    expect(stepsOf('dish_steak')).toEqual(['rec_001', 'rec_002']);
  });

  it('pizza: every input is made before it is used', () => {
    const steps = stepsOf('dish_pizza');
    expect(steps).toEqual(['rec_003', 'rec_006', 'rec_004', 'rec_005']);
  });
});
