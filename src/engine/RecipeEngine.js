/**
 * Handles 2-item combinations, lookup indexing, and dynamic output routing.
 */
export class RecipeEngine {
  constructor(recipesData) {
    this.recipeMap = new Map();
    this.inputRegistry = new Set();
    this.init(recipesData);
  }

  /**
   * Initializes lookup indices for fast runtime execution.
   */
  init(recipesData) {
    recipesData.forEach((recipe) => {
      if (recipe.inputs.length !== 2) {
        console.warn(`Recipe ${recipe.id} ignored: Must have exactly 2 inputs.`);
        return;
      }

      // Index input IDs to determine if outputs can be used in future recipes
      recipe.inputs.forEach((inputId) => this.inputRegistry.add(inputId));

      // Canonical key: Alphabetical sort ensures order independence
      const canonicalKey = this.getCanonicalKey(recipe.inputs[0], recipe.inputs[1]);
      this.recipeMap.set(canonicalKey, recipe);
    });
  }

  /**
   * Constructs a sorted canonical key for two item IDs.
   */
  getCanonicalKey(idA, idB) {
    return [idA, idB].sort().join('+');
  }

  /**
   * Checks if an item ID is used as an input anywhere in the recipe database.
   */
  isIntermediateIngredient(itemId) {
    return this.inputRegistry.has(itemId);
  }

  /**
   * Combines 2 items and calculates the result & output destination.
   *
   * @param {string} itemA - First input item ID
   * @param {string} itemB - Second input item ID
   * @returns {Object} CombineResult
   */
  combine(itemA, itemB) {
    if (!itemA || !itemB) {
      return { success: false, reason: 'INVALID_SLOTS' };
    }

    const key = this.getCanonicalKey(itemA, itemB);
    const recipe = this.recipeMap.get(key);

    // Combination failed: invalid pair. Nothing is used up — ingredients are only consumed on success.
    if (!recipe) {
      return {
        success: false,
        action: 'NO_MATCH',
        output: null,
        consumed: [],
      };
    }

    const outputId = recipe.output;
    const isIntermediate = this.isIntermediateIngredient(outputId);

    return {
      success: true,
      recipeId: recipe.id,
      output: outputId,
      consumed: recipe.consumed || [],
      // Route item based on whether it can be used further
      action: isIntermediate ? 'ADD_TO_INGREDIENTS' : 'DISAPPEAR_SERVED',
    };
  }
}
