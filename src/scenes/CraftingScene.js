import Phaser from 'phaser';
import { RecipeEngine } from '../engine/RecipeEngine.js';
import { buildCookbook } from '../engine/Cookbook.js';
import { combinationHints, isUsedUp } from '../engine/Hints.js';
import recipesData from '../data/recipes.json';
import itemsData from '../data/items.json';
import { STARTING_ITEMS, REUSABLE_TYPES } from '../data/start.js';
import { unlocksDue, nextUnlock } from '../data/unlocks.js';
import { CHAPTERS, CHAPTERS_BY_KEY, chapterDishes } from '../data/chapters.js';
import { loadSave, writeSave, resetGame, WORKSPACE_REGISTRY_KEY, CONGRATS_SEEN_KEY } from '../data/save.js';
import { addPlayTime } from '../engine/PlayClock.js';
import { HintBank } from '../engine/HintBank.js';
import { Sfx } from '../audio/Sfx.js';
import { RevealCard } from '../ui/RevealCard.js';
import { ItemToken, TOKEN_RADIUS } from '../ui/ItemToken.js';
import { Sidebar } from '../ui/Sidebar.js';
import { StorageDrawer } from '../ui/StorageDrawer.js';
import { CookbookModal } from '../ui/CookbookModal.js';
import { HintCard } from '../ui/HintCard.js';
import { drawKitchen, drawPlank } from '../ui/KitchenBackdrop.js';
import { makeRibbonButton, makeRoundButton } from '../ui/Buttons.js';
import { COLORS, textStyle } from '../ui/theme.js';
import { layoutFor } from '../ui/layout.js';
import { loadToolsOpen } from '../ui/storageShared.js';

const AUTOSAVE_MS = 5000; // keeps the saved play time fresh
const COMBINE_DISTANCE = TOKEN_RADIUS * 1.6;
const DOUBLE_CLICK_MS = 300;
const LIFT_SCALE = 1.15; // held item
const HOVER_SCALE = 1.12; // item the held one would combine with
const MAX_TILT = 14; // degrees the held item leans while moving

// Depth bands: workspace tokens count up from 1, the hint card and storage panel sit above them,
// and the token being dragged sits above everything.
const HINT_DEPTH = 900_000;
const STORAGE_DEPTH = 1_000_000;
const HUD_DEPTH = 1_000_000;
const DRAG_DEPTH = 2_000_000;
const FX_DEPTH = 3_000_000;
const REVEAL_DEPTH = 3_500_000;
const MODAL_DEPTH = 4_000_000;

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const formatTime = (ms) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export class CraftingScene extends Phaser.Scene {
  constructor() {
    super('CraftingScene');
  }

  init() {
    this.workspaceTokens = new Set();
    this.dragging = null;
    this.resetting = false;
    this.hintMode = false;
    this.hintCardFresh = false;
    this.zCounter = 1;
    this.loadProgress();
  }

  create() {
    this.engine = new RecipeEngine(recipesData);
    this.itemsById = new Map(itemsData.map((item) => [item.id, item]));
    this.layout = layoutFor(this.scale.width, this.scale.height, { toolsOpen: loadToolsOpen() });
    this.ws = this.layout.workspace;
    this.sfx = new Sfx(this);

    this.setupUI();
    this.setupInput();
    this.restoreWorkspace();
    this.watchResize();
    this.watchPageLeave();

    // A finished game opens on the congratulations page (until the player chooses to look around).
    if (this.isComplete() && !this.registry.get(CONGRATS_SEEN_KEY)) this.showCongrats();
  }

  // ---------------------------------------------------------------- Layout changes

  /** Lay the screen out again when the game size changes (window resize / device rotation). */
  watchResize() {
    const onResize = (gameSize) => {
      if (gameSize.width !== this.layout.width || gameSize.height !== this.layout.height) this.relayout();
    };
    this.scale.on('resize', onResize);
    this.events.once('shutdown', () => {
      this.scale.off('resize', onResize);
      if (this.resetting) return;
      this.saveWorkspace();
      this.saveProgress();
    });
  }

  relayout() {
    this.scene.restart();
  }

  /** Remembers table items as fractions of the workspace so they land in the same place after a relayout. */
  saveWorkspace() {
    const tokens = [...this.workspaceTokens].map((t) => ({
      id: t.itemId,
      fx: (t.x - this.ws.x) / this.ws.w,
      fy: (t.y - this.ws.y) / this.ws.h,
    }));
    this.registry.set(WORKSPACE_REGISTRY_KEY, tokens);
  }

  restoreWorkspace() {
    const saved = this.registry.get(WORKSPACE_REGISTRY_KEY) ?? [];
    this.registry.remove(WORKSPACE_REGISTRY_KEY);
    for (const { id, fx, fy } of saved) {
      if (!this.itemsById.has(id) || !this.unlockedIngredients.has(id) || this.isUsedUp(id)) continue;
      const { x, y } = this.clampToWorkspace(this.ws.x + fx * this.ws.w, this.ws.y + fy * this.ws.h);
      this.spawnWorkspaceToken(id, x, y);
    }
  }

  // ---------------------------------------------------------------- UI

  setupUI() {
    const { hud: hudRect, storage } = this.layout;

    const board = drawKitchen(this, this.ws);
    const touch = this.sys.game.device.input.touch;
    this.hint = this.add
      .text(board.x, board.y, `${touch ? 'Tap or drag' : 'Drag'} ingredients here,\nthen drop one onto another to cook, Drag to storage to remove.`, {
        ...textStyle(Math.round(21 * Math.max(0.75, board.scale)), 500, COLORS.chalk),
        align: 'center',
        lineSpacing: 6,
        wordWrap: { width: board.width * 0.9 },
      })
      .setOrigin(0.5)
      .setAlpha(0.92);

    // Top bar sits above workspace tokens so dragged items slide under it.
    const midY = hudRect.y + hudRect.h / 2;
    const hud = [drawPlank(this, hudRect.x, hudRect.y, hudRect.w - 2, hudRect.h)];
    // Recipes ribbon doubles as the progress counter: dishes served so far / all dishes.
    this.recipesButton = makeRibbonButton(this, hudRect.x + 14, midY - 28, 'Recipes', () => {
      this.exitHintMode();
      this.hintCard.hide();
      this.cookbook.open();
    });
    hud.push(this.recipesButton);
    // Hint: click it, then click an item to see how many of its combinations are left.
    this.hintButton = makeRoundButton(this, 0, midY + 2, 32, 'Hint', {
      color: 0xf2c44f,
      darkColor: 0xc9952e,
      onClick: () => this.toggleHintMode(),
    });
    hud.push(this.hintButton);
    // Badge with the number of hints left.
    this.hintBadge = this.add.circle(24, -22, 13, 0xdd5a50).setStrokeStyle(2, 0xffffff);
    this.hintBadgeText = this.add.text(24, -22, '', textStyle(15, 700, '#ffffff')).setOrigin(0.5);
    this.hintButton.add([this.hintBadge, this.hintBadgeText]);
    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.refreshHintBadge() });

    const right = hudRect.x + hudRect.w;
    this.muteButton = makeRoundButton(this, right - 232, midY + 2, 28, '', {
      color: 0xb7a3d6,
      darkColor: 0x8f78b5,
      onClick: () => this.setMuteLabel(this.sfx.toggleMute()),
    });
    // Speaker icon drawn by hand (the emoji is murky on the button).
    this.muteIcon = this.add.graphics();
    this.muteButton.addAt(this.muteIcon, 2);
    this.setMuteLabel(this.sfx.muted);
    hud.push(this.muteButton);
    hud.push(
      makeRoundButton(this, right - 152, midY + 2, 36, 'Reset', {
        color: 0x72bdbd,
        darkColor: 0x4f9799,
        onClick: () => this.resetProgress(),
      }),
    );
    hud.push(
      makeRoundButton(this, right - 58, midY + 2, 36, 'Clear', {
        color: 0xec7d7e,
        darkColor: 0xc65a5c,
        onClick: () => this.clearWorkspace(),
      }),
    );
    hud.forEach((o) => o.setDepth(HUD_DEPTH));

    const cookbook = buildCookbook(recipesData, this.engine);
    this.dishIds = new Set(cookbook.map((entry) => entry.dishId));
    this.cookbook = new CookbookModal(this, {
      cookbook,
      itemsById: this.itemsById,
      depth: MODAL_DEPTH,
      isRecipeDiscovered: (id) => this.discoveredRecipes.has(id),
      isDishServed: (id) => this.servedDishes.has(id),
    });

    this.hintCard = new HintCard(this, {
      rect: this.ws,
      depth: HINT_DEPTH,
      itemsById: this.itemsById,
      getHints: (id) => combinationHints(id, recipesData, this.itemsById, (rid) => this.discoveredRecipes.has(rid)),
    });

    const storageOptions = {
      rect: storage.rect,
      itemsById: this.itemsById,
      depth: STORAGE_DEPTH,
      onPick: (id, pointer) => {
        const token = this.spawnWorkspaceToken(id, pointer.x, pointer.y);
        this.startDrag(token, pointer);
      },
      onTap: (id) => this.placeFromStorage(id),
      onToggleTools: () => this.relayout(),
      interceptPress: (id) => this.useHintOn(id),
    };
    this.storage = storage.kind === 'drawer' ? new StorageDrawer(this, storageOptions) : new Sidebar(this, storageOptions);
    this.storage.refresh(this.storageItems());

    this.reveal = new RevealCard(this, { depth: REVEAL_DEPTH });

    this.updateHud();
    this.refreshHintBadge();
  }

  setMuteLabel(muted) {
    const g = this.muteIcon.clear();
    g.fillStyle(0xffffff);
    g.fillRect(-11, -5, 7, 10);
    g.fillTriangle(-6, -5, 3, -12, 3, 12);
    g.fillTriangle(-6, -5, 3, 12, -6, 5);
    g.lineStyle(3, 0xffffff);
    if (muted) {
      g.lineBetween(7, -6, 15, 6);
      g.lineBetween(15, -6, 7, 6);
    } else {
      g.beginPath().arc(4, 0, 7, -0.9, 0.9).strokePath();
      g.beginPath().arc(4, 0, 13, -0.9, 0.9).strokePath();
    }
  }

  updateHud() {
    const found = [...this.dishIds].filter((id) => this.servedDishes.has(id)).length;
    this.recipesButton.setLabel(`Recipes ${found}/${this.dishIds.size}`);
    this.hintButton.setX(this.recipesButton.x + this.recipesButton.ribbonWidth + 42);
    this.hint.setVisible(this.workspaceTokens.size === 0);
  }

  isUsedUp(itemId) {
    return isUsedUp(itemId, recipesData, (rid) => this.discoveredRecipes.has(rid));
  }

  /** What the storage shows: unlocked items that still have combinations left to discover. */
  storageItems() {
    return new Set([...this.unlockedIngredients].filter((id) => !this.isUsedUp(id)));
  }

  /**
   * Takes items with nothing left to discover off the table and the shelves. Only removes: new
   * items still appear on the shelves when their reveal card closes. `keep` is a just-made result,
   * which gets its moment on the table first (see retireResultSoon).
   */
  retireUsedUpItems(keep = null) {
    for (const token of [...this.workspaceTokens]) {
      if (token === keep || !this.isUsedUp(token.itemId)) continue;
      this.tweens.killTweensOf(token);
      this.removeToken(token, true);
    }

    const shown = [...this.storage.entries.keys()];
    if (!shown.some((id) => this.isUsedUp(id))) return;
    this.storage.refresh(new Set(shown.filter((id) => !this.isUsedUp(id))));
  }

  /** Tap on a storage item: drop a copy on the table near the middle, in a free spot. */
  placeFromStorage(itemId) {
    const centre = this.clampToWorkspace(this.ws.x + this.ws.w / 2, this.ws.y + this.ws.h * 0.55);
    const minGap = TOKEN_RADIUS * 2.4;
    const free = [...this.workspaceTokens].every(
      (t) => Phaser.Math.Distance.Between(t.x, t.y, centre.x, centre.y) >= minGap,
    );
    const spot = free ? centre : this.findFreeSpot(centre, null, []);
    const token = this.spawnWorkspaceToken(itemId, spot.x, spot.y);
    token.setScale(0).tweenScale(1, 250, 'Back.easeOut');
  }

  // ---------------------------------------------------------------- Hints

  /** Catches up on regenerated hints and redraws the badge (runs every second). */
  refreshHintBadge() {
    const bank = this.hintBank;
    if (bank.tick(Date.now()) > 0) {
      this.saveProgress();
      this.hintEarned();
    }
    this.hintBadgeText.setText(String(bank.charges));
    this.hintBadge.setFillStyle(bank.charges > 0 ? 0xdd5a50 : 0xa08466);
  }

  hintEarned() {
    this.sfx.play('chime');
    const p = this.hintButton;
    this.floatText(p.x, p.y + 52, '+1 💡', '#c9952e');
    this.tweens.add({ targets: p, scale: 1.2, duration: 160, yoyo: true });
  }

  toggleHintMode() {
    if (this.hintMode) {
      this.exitHintMode();
      this.hintCard.hide();
      return;
    }
    this.hintCardFresh = true; // don't let this same click close the prompt
    const bank = this.hintBank;
    bank.tick(Date.now());
    if (bank.charges === 0) {
      const wait = formatTime(bank.msUntilNext(Date.now()));
      this.hintCard.showMessage(
        `No hints left! Find ${plural(bank.discoveriesToNext, 'more recipe')} or wait ${wait}`,
        { autoHideMs: 3500 },
      );
      this.sfx.play('whoosh');
      this.tweens.add({ targets: this.hintButton, angle: { from: -8, to: 8 }, duration: 60, yoyo: true, repeat: 2, onComplete: () => this.hintButton.setAngle(0) });
      return;
    }
    this.hintMode = true;
    const verb = this.sys.game.device.input.touch ? 'Tap' : 'Click';
    this.hintCard.showMessage(`💡 ${verb} an item to see its hints`);
    this.hintPulse = this.tweens.add({ targets: this.hintButton, scale: 1.12, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  exitHintMode() {
    if (!this.hintMode) return;
    this.hintMode = false;
    this.hintPulse?.remove();
    this.hintPulse = null;
    this.hintButton.setScale(1);
  }

  /** While hint mode is on, a press on any item shows its hints instead of picking it up. */
  useHintOn(itemId) {
    if (!this.hintMode) return false;
    this.exitHintMode();
    this.hintCardFresh = true;
    this.hintBank.spend(Date.now());
    this.refreshHintBadge();
    this.saveProgress();
    this.sfx.play('pop');
    this.hintCard.show(itemId, { autoHideMs: 5000 });
    return true;
  }

  // ---------------------------------------------------------------- Workspace & dragging

  setupInput() {
    this.input.on('pointermove', (pointer) => {
      const drag = this.dragging;
      if (!drag) return;
      const { token } = drag;
      const x = pointer.x - drag.offsetX;
      drag.tilt = Phaser.Math.Clamp(drag.tilt + (x - token.x) * 0.5, -MAX_TILT, MAX_TILT);
      token.setPosition(x, pointer.y - drag.offsetY);
      // Over the storage, letting go deletes the copy: fade it to say so.
      const overStorage = this.storage.contains(token.x, token.y);
      token.setAlpha(overStorage ? 0.55 : 1);
      this.setHoverTarget(overStorage ? null : this.findDropTarget(token));
    });
    this.input.on('pointerup', () => this.endDrag());
    this.input.on('pointerupoutside', () => this.endDrag());

    // Any later click dismisses a hint card (but not the click that just opened it).
    this.input.on('pointerdown', () => {
      if (this.hintCardFresh) {
        this.hintCardFresh = false;
        return;
      }
      if (!this.hintMode && this.hintCard.visible) this.hintCard.hide();
    });

    this.input.on('wheel', (pointer, _over, _dx, dy) => {
      if (dy === 0) return;
      if (this.cookbook.isOpen) this.cookbook.wheel(dy);
      else if (this.storage.contains(pointer.x, pointer.y)) this.storage.wheel(pointer, dy);
    });

    this.input.keyboard.on('keydown-ESC', () => {
      if (this.reveal.isOpen) this.reveal.close();
      else if (this.cookbook.isOpen) this.cookbook.close();
      else if (this.hintMode) {
        this.exitHintMode();
        this.hintCard.hide();
      } else this.scene.start('MainMenu');
    });
  }

  spawnWorkspaceToken(itemId, x, y) {
    const token = new ItemToken(this, x, y, this.itemsById.get(itemId)).setDepth(this.zCounter++);
    token.hit.on('pointerdown', (pointer) => {
      if (this.useHintOn(token.itemId)) return;
      if (pointer.downTime - token.lastDownTime < DOUBLE_CLICK_MS) {
        token.lastDownTime = 0;
        this.duplicateToken(token);
        return;
      }
      token.lastDownTime = pointer.downTime;
      this.startDrag(token, pointer);
    });
    this.workspaceTokens.add(token);
    this.updateHud();
    return token;
  }

  duplicateToken(token) {
    const copy = this.spawnWorkspaceToken(token.itemId, token.x, token.y);
    const { x, y } = this.clampToWorkspace(token.x + 40, token.y + 40);
    this.tweens.add({ targets: copy, x, y, duration: 150, ease: 'Quad.easeOut' });
  }

  startDrag(token, pointer) {
    this.tweens.killTweensOf(token); // stop any slide/nudge: the pointer owns it now
    this.dragging = { token, offsetX: pointer.x - token.x, offsetY: pointer.y - token.y, tilt: 0, hover: null };
    token.setDepth(DRAG_DEPTH).setAngle(0);
    token.tweenScale(LIFT_SCALE, 140, 'Back.easeOut').setLifted(true);
    this.sfx.play('pop');
  }

  update(_time, delta) {
    // The play timer runs while the kitchen is open, and stops for good once everything is collected.
    if (!this.isComplete()) this.playMs = addPlayTime(this.playMs, delta);

    // While dragging, the held item leans into its movement and eases upright when it slows.
    const drag = this.dragging;
    if (!drag) return;
    drag.tilt *= Math.pow(0.8, delta / 16.7);
    drag.token.setAngle(Phaser.Math.Linear(drag.token.angle, drag.tilt, 0.35));
  }

  /** Highlights the item the held one would combine with if dropped now. */
  setHoverTarget(target) {
    const drag = this.dragging;
    if (!drag || drag.hover === target) return;
    if (drag.hover?.scene) drag.hover.tweenScale(1, 120).setGlow(false);
    drag.hover = target;
    if (target) target.tweenScale(HOVER_SCALE, 160, 'Back.easeOut').setGlow(true);
  }

  endDrag() {
    if (!this.dragging) return;
    const { token } = this.dragging;
    this.setHoverTarget(null);
    this.dragging = null;
    token.setDepth(this.zCounter++).setAlpha(1).setLifted(false);
    this.tweens.add({ targets: token, angle: 0, duration: 200, ease: 'Back.easeOut' });

    // Dropping back on the storage panel removes the copy.
    if (this.storage.contains(token.x, token.y)) {
      this.removeToken(token, true);
      this.sfx.play('whoosh');
      return;
    }

    const target = this.findDropTarget(token);
    if (target) {
      this.onCombineTriggered(token, target);
    } else {
      // Set down with a little bounce; slide back in if it was dropped off the table.
      token.tweenScale(1, 260, 'Back.easeOut');
      const { x, y } = this.clampToWorkspace(token.x, token.y);
      if (x !== token.x || y !== token.y) this.tweens.add({ targets: token, x, y, duration: 220, ease: 'Back.easeOut' });
    }
  }

  findDropTarget(token) {
    let best = null;
    let bestDist = COMBINE_DISTANCE;
    for (const other of this.workspaceTokens) {
      if (other === token) continue;
      const d = Phaser.Math.Distance.Between(token.x, token.y, other.x, other.y);
      if (d < bestDist) {
        best = other;
        bestDist = d;
      }
    }
    return best;
  }

  clampToWorkspace(x, y) {
    const { x: wx, y: wy, w, h } = this.ws;
    return {
      x: Phaser.Math.Clamp(x, wx + TOKEN_RADIUS + 4, wx + w - TOKEN_RADIUS - 4),
      y: Phaser.Math.Clamp(y, wy + TOKEN_RADIUS + 4, wy + h - TOKEN_RADIUS - 24),
    };
  }

  /** Takes a token off the table. Animated, it shrinks away — or, with `into`, gets pulled into that point. */
  removeToken(token, animate = false, into = null) {
    this.workspaceTokens.delete(token);
    if (this.dragging?.hover === token) this.dragging.hover = null;
    if (this.dragging?.token === token) {
      this.setHoverTarget(null);
      this.dragging = null;
    }
    if (animate) {
      token.setInputEnabled(false);
      this.tweens.killTweensOf(token);
      token.scaleTween?.stop();
      this.tweens.add({
        targets: token,
        ...(into && { x: into.x, y: into.y }),
        scale: 0,
        alpha: 0,
        duration: into ? 220 : 150,
        ease: into ? 'Quad.easeIn' : 'Linear',
        onComplete: () => token.destroy(),
      });
    } else {
      token.destroy();
    }
    this.updateHud();
  }

  clearWorkspace() {
    for (const token of [...this.workspaceTokens]) this.removeToken(token, true);
  }

  // ---------------------------------------------------------------- Crafting

  /**
   * Called when `dropped` is released on top of `target`.
   */
  onCombineTriggered(dropped, target) {
    const result = this.engine.combine(dropped.itemId, target.itemId);
    const at = this.clampToWorkspace(target.x, target.y);

    // Not a recipe: nothing is used up, both items stay on the table.
    if (!result.success) {
      this.rejectCombination(dropped, target);
      return;
    }

    const isNewRecipe = !this.discoveredRecipes.has(result.recipeId);
    this.discoveredRecipes.add(result.recipeId);
    let resultToken = null;
    if (result.action === 'ADD_TO_INGREDIENTS') {
      const isNew = !this.unlockedIngredients.has(result.output);
      this.unlockedIngredients.add(result.output);
      resultToken = this.spawnResult(result.output, at);
      this.sfx.play('success');
      this.sfx.vibrate(25);
      // Re-made something that has nothing left to discover: let it pop in, then take it away.
      if (this.isUsedUp(result.output)) this.retireResultSoon(resultToken);
      if (isNew) {
        this.reveal.enqueue({
          banner: 'NEW!',
          bannerColor: 0x3f86c4,
          item: this.itemsById.get(result.output),
          footer: () => this.unlockTeaser(),
          onShow: () => this.sfx.play('chime'),
          onClose: () => this.animateToIngredientTab(result.output, at),
          holdMs: 750,
        });
      }
    } else if (result.action === 'DISAPPEAR_SERVED') {
      this.animateServeAndDisappear(result.output, at);
    }

    this.clearSlotsAfterCrafting([dropped, target], at);
    this.retireUsedUpItems(resultToken);
    if (isNewRecipe) this.onNewDiscovery();
    this.saveProgress();
  }

  retireResultSoon(token) {
    this.time.delayedCall(900, () => {
      if (!this.workspaceTokens.has(token)) return;
      this.floatText(token.x, token.y - 60, `Nothing left to make with ${token.item.name}`, '#a0522d');
      this.tweens.killTweensOf(token);
      this.removeToken(token, true);
    });
  }

  /** Every new recipe counts toward the next hint and the next unlock. */
  onNewDiscovery() {
    if (this.hintBank.onDiscovery(Date.now())) {
      this.refreshHintBadge();
      this.hintEarned();
    }

    for (const id of unlocksDue(this.discoveredRecipes.size, this.unlockedIngredients)) {
      this.unlockedIngredients.add(id);
      const item = this.itemsById.get(id);
      const kind = REUSABLE_TYPES.has(item.type) ? 'tool' : 'ingredient';
      this.reveal.enqueue({
        banner: 'UNLOCKED!',
        bannerColor: 0x5a9a3c,
        item,
        title: `New ${kind}: ${item.name}`,
        footer: () => this.unlockTeaser(),
        onShow: () => this.sfx.play('chime'),
        onClose: () => {
          this.storage.refresh(this.storageItems());
          this.storage.revealEntry(id);
          this.time.delayedCall(300, () => this.storage.flashNew(id));
        },
        holdMs: 500,
      });
    }
  }

  /** "🔒 Something new unlocks in 2 more discoveries" — or nothing when it's about to unlock / all unlocked. */
  unlockTeaser() {
    const next = nextUnlock(this.discoveredRecipes.size, this.unlockedIngredients);
    if (!next || next.remaining === 0) return '';
    const n = next.remaining;
    return `🔒 Something new unlocks in ${n} more ${n === 1 ? 'discovery' : 'discoveries'}`;
  }

  spawnResult(itemId, at) {
    const token = this.spawnWorkspaceToken(itemId, at.x, at.y);
    token.setScale(0).tweenScale(1, 300, 'Back.easeOut');
    return token;
  }

  animateToIngredientTab(itemId, from) {
    this.storage.refresh(this.storageItems());
    const target = this.storage.revealEntry(itemId);

    const ghost = new ItemToken(this, from.x, from.y, this.itemsById.get(itemId)).setDepth(FX_DEPTH);
    ghost.setInputEnabled(false);
    this.tweens.add({
      targets: ghost,
      x: target.x,
      y: target.y,
      scale: { from: 1.3, to: 0.8 },
      duration: 650,
      ease: 'Cubic.easeInOut',
      onComplete: () => {
        ghost.destroy();
        this.storage.flashNew(itemId);
      },
    });

    this.floatText(from.x, from.y - 60, `New: ${this.itemsById.get(itemId).name}!`, '#3f86c4');
  }

  animateServeAndDisappear(itemId, at) {
    const dish = new ItemToken(this, at.x, at.y, this.itemsById.get(itemId)).setDepth(FX_DEPTH);
    dish.setInputEnabled(false).setScale(0);

    this.tweens.chain({
      targets: dish,
      tweens: [
        { scale: 1.5, duration: 300, ease: 'Back.easeOut' },
        { y: at.y - 120, alpha: 0, scale: 1, delay: 500, duration: 600, ease: 'Quad.easeIn' },
      ],
      onComplete: () => dish.destroy(),
    });
    const item = this.itemsById.get(itemId);
    const joke = item.type === 'joke';
    this.burst(at, joke ? [0xb594d6, 0xff6b6b, 0xffd166] : [0xf2c230, 0xffffff, 0xff9f43], joke ? 20 : 14);

    if (item.sfx) {
      this.sfx.play(item.sfx);
      this.sfx.vibrate([60, 30, 90]);
      if (item.sfx === 'explosion') this.cameras.main.shake(250, 0.008);
    } else if (joke) {
      this.sfx.play('success');
      this.sfx.vibrate(25);
    } else {
      this.sfx.play('success');
      this.time.delayedCall(150, () => this.sfx.play('jingle'));
      this.sfx.vibrate([30, 40, 60]);
    }

    const isFirstServe = !this.servedDishes.has(itemId);
    this.servedDishes.add(itemId);
    this.updateHud();

    this.floatText(at.x, at.y - 70, joke ? `Oops! ${item.name}!` : `${item.name} served!`, joke ? '#8f5fc4' : '#d08a18');
    if (!isFirstServe) return;

    this.reveal.enqueue({
      banner: joke ? 'OOPS!' : 'NEW DISH!',
      bannerColor: joke ? 0x9b6fd0 : 0xe0912f,
      item,
      footer: () => this.unlockTeaser(),
      // Draw the eye to the counter that just went up.
      onClose: () => this.tweens.add({ targets: this.recipesButton, scale: 1.12, duration: 160, yoyo: true, repeat: 1 }),
    });

    const chapter = CHAPTERS_BY_KEY.get(item.chapter);
    const inChapter = chapter ? chapterDishes(chapter.key, this.dishIds, this.itemsById) : [];
    if (inChapter.length && inChapter.every((id) => this.servedDishes.has(id))) {
      this.reveal.enqueue({
        banner: 'CHAPTER COMPLETE!',
        bannerColor: 0xd4a017,
        icon: '🏅',
        title: `${chapter.emoji} ${chapter.name}`,
        desc: `You found all ${inChapter.length} recipes in this chapter!`,
        onShow: () => this.sfx.play('fanfare'),
      });
    }

    if (this.isComplete()) {
      this.saveProgress(); // the play timer has just stopped
      this.reveal.enqueue({
        banner: 'YOU DID IT!',
        bannerColor: 0xd4a017,
        icon: '🏆',
        title: 'Every recipe collected!',
        desc: `All ${this.dishIds.size} recipes are in your Recipe Book.`,
        onShow: () => this.sfx.play('fanfare'),
        onClose: () => this.showCongrats(),
      });
    }
  }

  /** Two items that don't make anything: both wiggle "no", and the dropped one bounces off to a free spot. */
  rejectCombination(dropped, target) {
    for (const token of [dropped, target]) {
      this.tweens.killTweensOf(token);
      token.setAngle(0).setScale(1);
      this.tweens.add({
        targets: token,
        angle: { from: -10, to: 10 },
        duration: 60,
        yoyo: true,
        repeat: 2,
        onComplete: () => token.setAngle(0),
      });
    }

    const spot = this.findFreeSpot({ x: target.x, y: target.y }, dropped, []);
    this.tweens.add({ targets: dropped, x: spot.x, y: spot.y, duration: 260, ease: 'Back.easeOut' });
    this.sfx.play('fail');
    this.sfx.vibrate(15);
    this.floatText(target.x, target.y - 70, "Doesn't go together!", '#a0522d');
  }

  /**
   * After a successful combination both inputs leave the table — tools and stations too — pulled
   * into the result as it pops in, so only the result is left. Tools stay in storage for next time.
   */
  clearSlotsAfterCrafting(tokens, at) {
    for (const token of tokens) this.removeToken(token, true, at);
  }

  /** Finds a position near `at` that doesn't overlap other workspace tokens or the result at `at`. */
  findFreeSpot(at, self, reserved) {
    const minGap = TOKEN_RADIUS * 2.4;
    const occupied = [at, ...reserved];
    for (const other of this.workspaceTokens) if (other !== self) occupied.push(other);

    for (let ring = 1; ring <= 4; ring++) {
      const radius = TOKEN_RADIUS * 2.6 * ring;
      for (let step = 0; step < 8; step++) {
        const angle = (step * Math.PI) / 4;
        const spot = this.clampToWorkspace(at.x + Math.cos(angle) * radius, at.y + Math.sin(angle) * radius);
        if (occupied.every((o) => Phaser.Math.Distance.Between(spot.x, spot.y, o.x, o.y) >= minGap)) return spot;
      }
    }
    return this.clampToWorkspace(at.x + TOKEN_RADIUS * 2.6, at.y);
  }

  // ---------------------------------------------------------------- Effects

  burst(at, colors, count) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const dist = 60 + Math.random() * 50;
      const dot = this.add
        .circle(at.x, at.y, 4 + Math.random() * 4, Phaser.Utils.Array.GetRandom(colors))
        .setDepth(FX_DEPTH);
      this.tweens.add({
        targets: dot,
        x: at.x + Math.cos(angle) * dist,
        y: at.y + Math.sin(angle) * dist,
        alpha: 0,
        scale: 0.3,
        duration: 600 + Math.random() * 200,
        ease: 'Cubic.easeOut',
        onComplete: () => dot.destroy(),
      });
    }
  }

  floatText(x, y, text, color, delay = 0) {
    const t = this.add
      .text(x, y, text, textStyle(22, 700, color, { stroke: COLORS.cream, strokeThickness: 6 }))
      .setOrigin(0.5)
      .setDepth(FX_DEPTH)
      .setAlpha(0);
    this.tweens.chain({
      targets: t,
      tweens: [
        { alpha: 1, delay, duration: 150 },
        { y: y - 40, alpha: 0, delay: 700, duration: 500 },
      ],
      onComplete: () => t.destroy(),
    });
  }

  // ---------------------------------------------------------------- Save data

  loadProgress() {
    this.unlockedIngredients = new Set(STARTING_ITEMS);
    this.servedDishes = new Set();
    this.discoveredRecipes = new Set();
    // Storage unavailable or corrupt: start fresh.
    const saved = loadSave();
    if (saved) {
      saved.unlocked?.forEach((id) => this.unlockedIngredients.add(id));
      saved.served?.forEach((id) => this.servedDishes.add(id));
      saved.recipes?.forEach((id) => this.discoveredRecipes.add(id));
    }
    this.hintBank = HintBank.fromSave(saved?.hints, Date.now());
    this.playMs = Number(saved?.playMs) || 0;

    // Saves from before recipe tracking: count a recipe as found if its output was ever made.
    const starting = new Set(STARTING_ITEMS);
    for (const recipe of recipesData) {
      const made =
        this.servedDishes.has(recipe.output) ||
        (this.unlockedIngredients.has(recipe.output) && !starting.has(recipe.output));
      if (made) this.discoveredRecipes.add(recipe.id);
    }

    // Milestones already passed (e.g. an older save) unlock quietly.
    unlocksDue(this.discoveredRecipes.size, this.unlockedIngredients).forEach((id) => this.unlockedIngredients.add(id));
  }

  saveProgress() {
    if (this.resetting) return;
    writeSave({
      unlocked: [...this.unlockedIngredients],
      served: [...this.servedDishes],
      recipes: [...this.discoveredRecipes],
      hints: this.hintBank.toSave(),
      playMs: Math.round(this.playMs),
    });
  }

  /** Saves when the player leaves the page (tab switch, close, phone lock) and every few seconds, for the play timer. */
  watchPageLeave() {
    const save = () => this.saveProgress();
    this.game.events.on(Phaser.Core.Events.HIDDEN, save);
    window.addEventListener('pagehide', save);
    this.time.addEvent({ delay: AUTOSAVE_MS, loop: true, callback: save });
    this.events.once('shutdown', () => {
      this.game.events.off(Phaser.Core.Events.HIDDEN, save);
      window.removeEventListener('pagehide', save);
    });
  }

  resetProgress() {
    if (!window.confirm('Reset all progress?')) return;
    resetGame(this.registry); // progress, play time and the table
    this.resetting = true; // nothing is saved on the way out
    this.scene.restart();
  }

  // ---------------------------------------------------------------- The end

  /** Every dish and disaster in the Recipe Book has been served. */
  isComplete() {
    return [...this.dishIds].every((id) => this.servedDishes.has(id));
  }

  /** Numbers for the congratulations page. */
  summary() {
    const dishIds = [...this.dishIds];
    const served = (ids) => ids.filter((id) => this.servedDishes.has(id)).length;
    const ofType = (type) => dishIds.filter((id) => this.itemsById.get(id).type === type);
    return {
      playMs: this.playMs,
      chapters: CHAPTERS.map((chapter) => {
        const ids = chapterDishes(chapter.key, this.dishIds, this.itemsById);
        return { key: chapter.key, served: served(ids), total: ids.length };
      }).filter((c) => c.total > 0),
      recipes: served(dishIds),
      recipesTotal: dishIds.length,
      dishes: served(ofType('final_dish')),
      disasters: served(ofType('joke')),
      combos: this.discoveredRecipes.size,
      combosTotal: recipesData.length,
    };
  }

  showCongrats() {
    this.saveProgress();
    this.scene.start('Congrats', this.summary());
  }
}
