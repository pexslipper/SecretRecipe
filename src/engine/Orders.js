import {
  LEVELS,
  CUSTOMERS_PER_LEVEL,
  PATIENCE_BASE_MS,
  PATIENCE_PER_STEP_MS,
  HAPPY_ABOVE,
  ANGRY_BELOW,
} from '../data/levels.js';

// Chapter rules: what customers order, how long they wait, how they feel and what it scores. Pure.

const STARTER_TYPES = new Set(['base_ingredient', 'tool', 'station']);
const STAR_MOODS = new Set(['happy', 'impatient']);

/** Real dishes (never jokes) a customer may order in `level`. */
export function dishPool(level, cookbook, itemsById) {
  return cookbook
    .filter(({ dishId }) => itemsById.get(dishId)?.type === 'final_dish')
    .filter(({ steps }) => steps.length >= (level.minSteps ?? 1))
    .filter(({ steps }) => level.maxSteps === null || steps.length <= level.maxSteps)
    .map(({ dishId }) => dishId);
}

/** Raw ingredients and tools needed for every dish orderable up to and including chapter `levelIndex`. */
export function levelUnlocks(levelIndex, cookbook, itemsById) {
  const stepsByDish = new Map(cookbook.map((e) => [e.dishId, e.steps]));
  const ids = new Set();
  for (const level of LEVELS.slice(0, levelIndex + 1)) {
    for (const dishId of dishPool(level, cookbook, itemsById)) {
      for (const recipe of stepsByDish.get(dishId)) {
        for (const id of recipe.inputs) if (STARTER_TYPES.has(itemsById.get(id)?.type)) ids.add(id);
      }
    }
  }
  return ids;
}

/**
 * The chapter's customers: CUSTOMERS_PER_LEVEL orders, each an array of dish ids. No dish appears
 * twice in a chapter. Single orders come first, easiest to hardest, then the two-dish orders.
 */
export function drawOrders(level, pool, stepsByDish, rng = Math.random) {
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const singles = CUSTOMERS_PER_LEVEL - level.doubles;
  const steps = (id) => stepsByDish.get(id).length;
  const orders = shuffled.slice(0, singles).sort((a, b) => steps(a) - steps(b)).map((id) => [id]);
  for (let i = 0; i < level.doubles; i++) {
    const at = singles + i * 2;
    orders.push(shuffled.slice(at, at + 2));
  }
  return orders;
}

/** Combinations needed for an order (a step shared by both dishes counts once). */
export function orderSteps(order, stepsByDish) {
  const seen = new Map();
  for (const dishId of order) for (const recipe of stepsByDish.get(dishId)) seen.set(recipe.id, recipe);
  return [...seen.values()];
}

export function patienceMs(order, level, stepsByDish) {
  return Math.round((PATIENCE_BASE_MS + PATIENCE_PER_STEP_MS * orderSteps(order, stepsByDish).length) * level.patience);
}

/** 'happy' | 'impatient' | 'angry' | 'left', from the share of patience left (1 → 0). */
export function moodAt(fractionLeft) {
  if (fractionLeft <= 0) return 'left';
  if (fractionLeft < ANGRY_BELOW) return 'angry';
  if (fractionLeft < HAPPY_ABOVE) return 'impatient';
  return 'happy';
}

const GREEN = 0x6cc04a;
const YELLOW = 0xf2c230;
const ORANGE = 0xf08a3a;
const RED = 0xdd4a3c;
const BLEND = 0.06; // colours ease into the next mood's over this much of the bar

function lerpColor(a, b, t) {
  const k = Math.min(1, Math.max(0, t));
  const ch = (c, shift) => (c >> shift) & 0xff;
  const mix = (shift) => Math.round(ch(a, shift) + (ch(b, shift) - ch(a, shift)) * k) << shift;
  return mix(16) | mix(8) | mix(0);
}

/** Timer bar colour: green while happy, yellow → orange while impatient, red when angry. */
export function moodColor(fractionLeft) {
  const f = fractionLeft;
  if (f >= HAPPY_ABOVE + BLEND) return GREEN;
  if (f >= HAPPY_ABOVE) return lerpColor(YELLOW, GREEN, (f - HAPPY_ABOVE) / BLEND);
  if (f >= ANGRY_BELOW + BLEND) return lerpColor(ORANGE, YELLOW, (f - ANGRY_BELOW - BLEND) / (HAPPY_ABOVE - ANGRY_BELOW - BLEND));
  if (f >= ANGRY_BELOW) return lerpColor(RED, ORANGE, (f - ANGRY_BELOW) / BLEND);
  return RED;
}

/** One star per customer served while still happy or impatient. */
export function chapterStars(results) {
  return results.filter((mood) => STAR_MOODS.has(mood)).length;
}

/** The first chapter is always open; each later one needs a star in the one before. */
export function isLevelOpen(index, bestStars) {
  return index === 0 || (bestStars[index - 1] ?? 0) >= 1;
}

/**
 * The combination a hint reveals: the first one, in cooking order, of the dishes still to serve
 * that is neither discovered nor already revealed. Null when there's nothing left to reveal.
 */
export function nextHintStep(dishIds, stepsByDish, isDiscovered, revealed) {
  const recipe = orderSteps(dishIds, stepsByDish).find((r) => !isDiscovered(r.id) && !revealed.has(r.id));
  return recipe?.id ?? null;
}
