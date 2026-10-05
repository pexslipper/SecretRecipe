/**
 * Builds the full preparation chain for every final dish.
 * Steps are ordered so each recipe comes after the recipes that make its inputs.
 *
 * @returns {{ dishId: string, steps: Object[] }[]}
 */
export function buildCookbook(recipesData, engine) {
  const producedBy = new Map();
  for (const recipe of recipesData) {
    if (recipe.inputs.length === 2 && !producedBy.has(recipe.output)) producedBy.set(recipe.output, recipe);
  }

  const dishIds = [...new Set(recipesData.map((r) => r.output))].filter(
    (id) => !engine.isIntermediateIngredient(id),
  );

  return dishIds.map((dishId) => {
    const steps = [];
    const seen = new Set();
    const visit = (itemId) => {
      const recipe = producedBy.get(itemId);
      if (!recipe || seen.has(recipe.id)) return;
      seen.add(recipe.id);
      recipe.inputs.forEach(visit);
      steps.push(recipe);
    };
    visit(dishId);
    return { dishId, steps };
  });
}
