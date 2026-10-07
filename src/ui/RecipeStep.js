import Phaser from 'phaser';
import { makeItemLabel, makeFlowRow } from './ItemLabel.js';
import { makeItemIcon } from './ItemToken.js';

// One cooking step drawn as "[icon] A  +  [icon] B  →  [icon] Out", shared by the Recipe Book and
// the order tab. Steps the player hasn't made yet are covered with a censor bar of this colour.
export const CENSOR_COLOR = 0x2a1d14;

/** Just the icon, in a square slot, anchored like a Text with origin (0, 0.5). */
function iconOnly(scene, item, size) {
  const icon = makeItemIcon(scene, item, size).setPosition(size / 2, 0);
  return new Phaser.GameObjects.Container(scene, 0, 0, [icon]).setSize(size, size);
}

/**
 * Builds the step as a flow row (see ItemLabel.js), wrapping onto more lines past `maxWidth`.
 * With `names: false` it shows icons only, for tight spaces.
 */
export function makeRecipeStep(scene, recipe, itemsById, { style, iconSize, maxWidth = Infinity, gap = 12, names = true }) {
  const piece = (id) => {
    const item = itemsById.get(id);
    if (!item) return new Phaser.GameObjects.Text(scene, 0, 0, id, style).setOrigin(0, 0.5);
    return names ? makeItemLabel(scene, item, style, iconSize) : iconOnly(scene, item, iconSize);
  };
  // Each operator stays with the item after it, so a wrapped line never starts with a bare "+".
  const withOp = (op, id) =>
    makeFlowRow(scene, [new Phaser.GameObjects.Text(scene, 0, 0, op, style).setOrigin(0, 0.5), piece(id)], { gap });
  const [a, b] = recipe.inputs;
  return makeFlowRow(scene, [piece(a), withOp('+', b), withOp('→', recipe.output)], { maxWidth, gap });
}
