// Game chapters, easiest first. (Not to be confused with the Recipe Book's cuisine chapters in chapters.js.)
//
// minSteps / maxSteps: the shortest / longest dish a customer may order, in combinations (maxSteps null = no limit).
// doubles:  how many of the chapter's customers order two dishes at once.
// patience: multiplies how long every customer is willing to wait.
export const LEVELS = [
  { name: 'First Day', blurb: 'Quick and simple dishes', maxSteps: 2, doubles: 0, patience: 1.0 },
  { name: 'Lunch Rush', blurb: 'Dishes up to 3 steps', maxSteps: 3, doubles: 0, patience: 0.95 },
  { name: 'Busy Evening', blurb: 'Dishes up to 4 steps', maxSteps: 4, doubles: 0, patience: 0.9 },
  { name: 'Food Critic', blurb: 'Dishes up to 5 steps', maxSteps: 5, doubles: 0, patience: 0.8 },
  { name: 'Full House', blurb: 'Dishes of 3+ steps, one double order', minSteps: 3, maxSteps: null, doubles: 1, patience: 0.75 },
  { name: 'Grand Banquet', blurb: 'Dishes of 3+ steps, two double orders', minSteps: 3, maxSteps: null, doubles: 2, patience: 0.65 },
];

export const CUSTOMERS_PER_LEVEL = 5;
export const HINTS_PER_LEVEL = 3;

// How long a customer waits: base + per combination needed for the whole order, times the chapter's `patience`.
export const PATIENCE_BASE_MS = 25_000;
export const PATIENCE_PER_STEP_MS = 12_000;

// Mood by the share of patience left. Below ANGRY_BELOW they're angry; at 0 they walk out.
export const HAPPY_ABOVE = 0.55;
export const ANGRY_BELOW = 0.25;
