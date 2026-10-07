import Phaser from 'phaser';
import { RecipeEngine } from '../engine/RecipeEngine.js';
import { buildCookbook } from '../engine/Cookbook.js';
import { dishPool, levelUnlocks, drawOrders, patienceMs, moodAt, chapterStars, nextHintStep } from '../engine/Orders.js';
import recipesData from '../data/recipes.json';
import itemsData from '../data/items.json';
import { LEVELS, CUSTOMERS_PER_LEVEL, HINTS_PER_LEVEL } from '../data/levels.js';
import { loadSave, writeSave, WORKSPACE_REGISTRY_KEY, RUN_REGISTRY_KEY } from '../data/save.js';
import { addPlayTime, MAX_STEP_MS } from '../engine/PlayClock.js';
import { Sfx } from '../audio/Sfx.js';
import { startMusic, toggleMusic, musicEnabled } from '../audio/Music.js';
import { RevealCard } from '../ui/RevealCard.js';
import { ItemToken, TOKEN_RADIUS } from '../ui/ItemToken.js';
import { Sidebar } from '../ui/Sidebar.js';
import { StorageDrawer } from '../ui/StorageDrawer.js';
import { CookbookModal } from '../ui/CookbookModal.js';
import { CustomerCounter } from '../ui/CustomerCounter.js';
import { OrderTab } from '../ui/OrderTab.js';
import { drawKitchen, drawPlank } from '../ui/KitchenBackdrop.js';
import { makeRibbonButton, makeRoundButton } from '../ui/Buttons.js';
import { COLORS, textStyle } from '../ui/theme.js';
import { layoutFor } from '../ui/layout.js';
import { loadToolsOpen, isStorageItem } from '../ui/storageShared.js';

const AUTOSAVE_MS = 5000; // keeps the saved play time fresh
const COMBINE_DISTANCE = TOKEN_RADIUS * 1.6;
const DOUBLE_CLICK_MS = 300;
const LIFT_SCALE = 1.15; // held item
const HOVER_SCALE = 1.12; // item the held one would combine with
const MAX_TILT = 14; // degrees the held item leans while moving
const NEXT_CUSTOMER_MS = 500; // pause between one customer leaving and the next walking in
const SERVE_FLIGHT_MS = 600;

// Depth bands: workspace tokens count up from 1, the counter, order tab and storage panel sit
// above them, and the token being dragged sits above everything.
const COUNTER_DEPTH = 500_000;
const ORDER_DEPTH = 900_000;
const STORAGE_DEPTH = 1_000_000;
const HUD_DEPTH = 1_000_000;
const DRAG_DEPTH = 2_000_000;
const FX_DEPTH = 3_000_000;
const REVEAL_DEPTH = 3_500_000;
const MODAL_DEPTH = 4_000_000;

/**
 * One chapter in the kitchen: customers come in one at a time and order dishes; cook them from the
 * storage before their patience runs out. Scene data: `{ level }` (chapter index).
 */
export class CraftingScene extends Phaser.Scene {
  constructor() {
    super('CraftingScene');
  }

  init(data) {
    this.levelIndex = Phaser.Math.Clamp(data?.level ?? 0, 0, LEVELS.length - 1);
    this.level = LEVELS[this.levelIndex];
    this.workspaceTokens = new Set();
    this.dragging = null;
    this.endingRun = false;
    this.customerActive = false;
    this.zCounter = 1;
    this.loadProgress();
  }

  create() {
    this.engine = new RecipeEngine(recipesData);
    this.itemsById = new Map(itemsData.map((item) => [item.id, item]));
    const cookbook = buildCookbook(recipesData, this.engine);
    this.cookbookEntries = cookbook;
    this.stepsByDish = new Map(cookbook.map((entry) => [entry.dishId, entry.steps]));
    this.dishIds = new Set(cookbook.map((entry) => entry.dishId));
    // Starting a chapter stocks the storage with whatever its dishes need.
    this.newUnlocks = [...levelUnlocks(this.levelIndex, cookbook, this.itemsById)].filter((id) => !this.unlockedIngredients.has(id));
    this.newUnlocks.forEach((id) => this.unlockedIngredients.add(id));

    this.layout = layoutFor(this.scale.width, this.scale.height, { toolsOpen: loadToolsOpen() });
    this.ws = this.layout.workspace;
    this.sfx = new Sfx(this);
    startMusic(this);

    const resumed = this.restoreRun();
    this.setupUI();
    this.setupInput();
    this.restoreWorkspace();
    this.watchResize();
    this.watchPageLeave();

    if (!resumed) this.announceChapter();
    this.showCustomer({ instant: resumed });
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
      this.saveProgress();
      if (this.endingRun) return;
      this.saveWorkspace();
      this.registry.set(RUN_REGISTRY_KEY, this.run);
    });
  }

  relayout() {
    this.scene.restart({ level: this.levelIndex });
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
      if (!this.itemsById.has(id) || !this.unlockedIngredients.has(id)) continue;
      const { x, y } = this.clampToWorkspace(this.ws.x + fx * this.ws.w, this.ws.y + fy * this.ws.h);
      this.spawnWorkspaceToken(id, x, y);
    }
  }

  // ---------------------------------------------------------------- Chapter run

  /**
   * Picks up the chapter where a relayout left it, or starts it fresh. Returns true when resumed.
   * Run: { level, orders, customer, elapsed, served, results, hintsLeft, revealed, look }.
   */
  restoreRun() {
    const saved = this.registry.get(RUN_REGISTRY_KEY);
    this.registry.remove(RUN_REGISTRY_KEY);
    if (saved?.level === this.levelIndex) {
      this.run = saved;
      return true;
    }
    // A different chapter (or none): the table from before doesn't belong here.
    this.registry.remove(WORKSPACE_REGISTRY_KEY);
    const pool = dishPool(this.level, this.cookbookEntries, this.itemsById);
    this.run = {
      level: this.levelIndex,
      orders: drawOrders(this.level, pool, this.stepsByDish),
      customer: 0,
      elapsed: 0,
      served: [],
      results: [],
      hintsLeft: HINTS_PER_LEVEL,
      revealed: [],
      look: Phaser.Math.Between(0, 99),
    };
    return false;
  }

  get currentOrder() {
    return this.run.orders[this.run.customer] ?? null;
  }

  get patience() {
    return patienceMs(this.currentOrder, this.level, this.stepsByDish);
  }

  get fractionLeft() {
    return 1 - this.run.elapsed / this.patience;
  }

  announceChapter() {
    const n = this.levelIndex + 1;
    const fresh = this.newUnlocks.map((id) => this.itemsById.get(id)).map((item) => `${item.emoji} ${item.name}`);
    this.reveal.enqueue({
      banner: `CHAPTER ${n}`,
      bannerColor: 0xd4a017,
      icon: '🍽️',
      title: this.level.name,
      desc: `${this.level.blurb}. Serve ${CUSTOMERS_PER_LEVEL} customers: each one who gets their food before turning angry earns a ⭐`,
      footer: fresh.length ? `New in storage: ${fresh.join(', ')}` : '',
      onShow: () => this.sfx.play('chime'),
    });
  }

  /** The current customer walks in (or is simply there again, after a relayout). */
  showCustomer({ instant = false } = {}) {
    this.counter.setSign(this.levelIndex, this.run.customer, this.run.results, CUSTOMERS_PER_LEVEL);
    const order = this.currentOrder;
    if (!order) {
      this.endChapter();
      return;
    }
    this.counter.arrive(order, this.run.look + this.run.customer, { served: this.run.served, instant });
    this.counter.setProgress(this.fractionLeft);
    this.orderTab.show(order, this.run.served);
    this.customerActive = true;
    if (!instant) this.sfx.play('pop');
  }

  /** Patience runs down while the kitchen is in play (not while a card or the Recipe Book is up). */
  tickCustomer(delta) {
    if (!this.customerActive || this.reveal.isOpen || this.cookbook.isOpen) return;
    this.run.elapsed += Math.min(Math.max(0, delta || 0), MAX_STEP_MS);
    const left = this.fractionLeft;
    this.counter.setProgress(left);
    if (left <= 0) {
      this.sfx.play('fail');
      this.sfx.vibrate([40, 30, 40]);
      const at = this.counter.dishPoint(this.currentOrder[0]);
      this.floatText(at.x, at.y - 30, 'Too slow! They left 😤', '#c0392b');
      this.finishCustomer('left');
    }
  }

  /**
   * Records how this customer went and sends them off. The run moves on right away (so a relayout
   * mid-animation shows the next customer); the walk-out plays first.
   */
  finishCustomer(result, { leaveDelay = 0 } = {}) {
    const i = this.run.customer;
    this.customerActive = false;
    this.run.results.push(result);
    this.run.customer++;
    this.run.elapsed = 0;
    this.run.served = [];
    this.orderTab.hide();

    const earned = result === 'happy' || result === 'impatient';
    this.counter.setSign(this.levelIndex, Math.min(this.run.customer, CUSTOMERS_PER_LEVEL - 1), this.run.results, CUSTOMERS_PER_LEVEL);
    if (earned) this.starBurst(i);

    this.time.delayedCall(leaveDelay, () =>
      this.counter.leave(result, () => this.time.delayedCall(NEXT_CUSTOMER_MS, () => this.showCustomer())),
    );
  }

  starBurst(i) {
    const at = this.counter.starPoint(i, CUSTOMERS_PER_LEVEL);
    this.sfx.play('jingle');
    this.burst(at, [0xf6c945, 0xffffff, 0xffe28a], 12);
    this.floatText(at.x, at.y + 34, '+⭐', '#d4a017');
  }

  /** All customers done: save the best score and show the results once any open card is closed. */
  endChapter() {
    if (this.endingRun) return;
    this.endingRun = true;
    this.customerActive = false;
    const stars = chapterStars(this.run.results);
    const previousBest = this.bestStars[this.levelIndex];
    const newBest = previousBest === undefined || stars > previousBest;
    if (newBest) this.bestStars[this.levelIndex] = stars;
    this.registry.remove(RUN_REGISTRY_KEY);
    this.registry.remove(WORKSPACE_REGISTRY_KEY);
    this.saveProgress();

    const result = {
      level: this.levelIndex,
      orders: this.run.orders,
      results: this.run.results,
      look: this.run.look,
      stars,
      newBest: newBest && stars > 0,
      bestStars: { ...this.bestStars },
    };
    const go = () => {
      if (this.reveal.isOpen) this.time.delayedCall(200, go);
      else this.scene.start('ChapterResult', result);
    };
    this.time.delayedCall(600, go);
  }

  /** Back to the chapter list. The chapter's customers are lost; discoveries are kept. */
  leaveChapter() {
    if (!window.confirm('Leave this chapter? You will have to start it again.')) return;
    this.endingRun = true;
    this.registry.remove(RUN_REGISTRY_KEY);
    this.registry.remove(WORKSPACE_REGISTRY_KEY);
    this.scene.start('ChapterSelect');
  }

  // ---------------------------------------------------------------- UI

  setupUI() {
    const { hud: hudRect, counter: counterRect, storage } = this.layout;

    // The table fills the workspace; its wall and window reach up behind the counter, so customers stand in front of the window.
    const board = drawKitchen(this, this.ws, { topOverlap: this.ws.y - counterRect.y + 8 });
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

    this.counter = new CustomerCounter(this, { rect: counterRect, itemsById: this.itemsById, depth: COUNTER_DEPTH });
    this.orderTab = new OrderTab(this, {
      rect: this.ws,
      itemsById: this.itemsById,
      stepsByDish: this.stepsByDish,
      depth: ORDER_DEPTH,
      isDiscovered: (id) => this.discoveredRecipes.has(id),
      isRevealed: (id) => this.run.revealed.includes(id),
    });

    // Top bar sits above workspace tokens so dragged items slide under it.
    const midY = hudRect.y + hudRect.h / 2;
    const hud = [drawPlank(this, hudRect.x, hudRect.y, hudRect.w - 2, hudRect.h)];
    // Recipes ribbon doubles as the Recipe Book's counter: dishes served so far / all dishes.
    this.recipesButton = makeRibbonButton(this, hudRect.x + 14, midY - 28, 'Recipes', () => this.cookbook.open());
    hud.push(this.recipesButton);
    // Hint: uncovers one hidden step of the current order. A few per chapter, no refills.
    this.hintButton = makeRoundButton(this, 0, midY + 2, 32, 'Hint', {
      color: 0xf2c44f,
      darkColor: 0xc9952e,
      onClick: () => this.useHint(),
    });
    hud.push(this.hintButton);
    // Badge with the number of hints left.
    this.hintBadge = this.add.circle(24, -22, 13, 0xdd5a50).setStrokeStyle(2, 0xffffff);
    this.hintBadgeText = this.add.text(24, -22, '', textStyle(15, 700, '#ffffff')).setOrigin(0.5);
    this.hintButton.add([this.hintBadge, this.hintBadgeText]);

    // Right side, packed tight enough to fit a phone held upright: music, sound effects, Menu, Clear.
    const right = hudRect.x + hudRect.w;
    this.musicButton = makeRoundButton(this, right - 260, midY + 2, 26, '', {
      color: 0xf0a060,
      darkColor: 0xc97a3c,
      onClick: () => this.setMusicLabel(toggleMusic(this)),
    });
    this.musicIcon = this.add.graphics();
    this.musicButton.addAt(this.musicIcon, 2);
    this.setMusicLabel(musicEnabled());
    hud.push(this.musicButton);
    this.muteButton = makeRoundButton(this, right - 202, midY + 2, 26, '', {
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
      makeRoundButton(this, right - 132, midY + 2, 34, 'Menu', {
        color: 0x72bdbd,
        darkColor: 0x4f9799,
        onClick: () => this.leaveChapter(),
      }),
    );
    hud.push(
      makeRoundButton(this, right - 52, midY + 2, 34, 'Clear', {
        color: 0xec7d7e,
        darkColor: 0xc65a5c,
        onClick: () => this.clearWorkspace(),
      }),
    );
    hud.forEach((o) => o.setDepth(HUD_DEPTH));

    this.cookbook = new CookbookModal(this, {
      cookbook: this.cookbookEntries,
      itemsById: this.itemsById,
      depth: MODAL_DEPTH,
      isRecipeDiscovered: (id) => this.discoveredRecipes.has(id),
      isDishServed: (id) => this.servedDishes.has(id),
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
    };
    this.storage = storage.kind === 'drawer' ? new StorageDrawer(this, storageOptions) : new Sidebar(this, storageOptions);
    this.storage.refresh(this.storageItems());

    this.reveal = new RevealCard(this, { depth: REVEAL_DEPTH });

    this.updateHud();
    this.refreshHintBadge();
  }

  /** Music note, struck through when the music is off. */
  setMusicLabel(on) {
    const g = this.musicIcon.clear();
    g.fillStyle(0xffffff);
    g.fillEllipse(-6, 7, 9, 7);
    g.fillEllipse(6, 4, 9, 7);
    g.fillRect(-3, -10, 3, 17);
    g.fillRect(9, -13, 3, 17);
    g.fillPoints([{ x: -3, y: -10 }, { x: 12, y: -13 }, { x: 12, y: -8 }, { x: -3, y: -5 }], true);
    if (!on) {
      g.lineStyle(5, 0xc97a3c).lineBetween(-12, -12, 12, 12);
      g.lineStyle(3, 0xffffff).lineBetween(-12, -12, 12, 12);
    }
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

  /**
   * What the storage holds: the raw ingredients and tools unlocked so far. Anything cooked from
   * them only exists on the table, so every order is cooked from scratch.
   */
  storageItems() {
    return new Set([...this.unlockedIngredients].filter((id) => isStorageItem(this.itemsById.get(id))));
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

  refreshHintBadge() {
    const left = this.run.hintsLeft;
    this.hintBadgeText.setText(String(left));
    this.hintBadge.setFillStyle(left > 0 ? 0xdd5a50 : 0xa08466);
  }

  /** Uncovers the next hidden step of the current order in the order tab. */
  useHint() {
    const p = this.hintButton;
    const say = (text) => this.floatText(p.x, p.y + 52, text, '#c0632d');
    const shake = () => {
      this.sfx.play('whoosh');
      this.tweens.add({ targets: p, angle: { from: -8, to: 8 }, duration: 60, yoyo: true, repeat: 2, onComplete: () => p.setAngle(0) });
    };

    if (!this.customerActive) {
      say('Wait for a customer!');
      return;
    }
    const toServe = this.currentOrder.filter((id) => !this.run.served.includes(id));
    const revealed = new Set(this.run.revealed);
    const stepId = nextHintStep(toServe, this.stepsByDish, (id) => this.discoveredRecipes.has(id), revealed);
    if (!stepId) {
      say('You already know this recipe!');
      shake();
      return;
    }
    if (this.run.hintsLeft <= 0) {
      say('No hints left this chapter');
      shake();
      return;
    }
    this.run.hintsLeft--;
    this.run.revealed.push(stepId);
    this.refreshHintBadge();
    this.orderTab.refresh();
    this.orderTab.flashStep(stepId);
    this.sfx.play('chime');
    this.tweens.add({ targets: p, scale: 1.2, duration: 160, yoyo: true });
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

    this.input.on('wheel', (pointer, _over, _dx, dy) => {
      if (dy === 0) return;
      if (this.cookbook.isOpen) this.cookbook.wheel(dy);
      else if (this.storage.contains(pointer.x, pointer.y)) this.storage.wheel(pointer, dy);
    });

    this.input.keyboard.on('keydown-ESC', () => {
      if (this.reveal.isOpen) this.reveal.close();
      else if (this.cookbook.isOpen) this.cookbook.close();
      else this.leaveChapter();
    });
  }

  spawnWorkspaceToken(itemId, x, y) {
    const token = new ItemToken(this, x, y, this.itemsById.get(itemId)).setDepth(this.zCounter++);
    token.hit.on('pointerdown', (pointer) => {
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
    this.playMs = addPlayTime(this.playMs, delta);
    this.tickCustomer(delta);

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
    if (result.action === 'ADD_TO_INGREDIENTS') {
      const isNew = !this.unlockedIngredients.has(result.output);
      this.unlockedIngredients.add(result.output);
      this.spawnResult(result.output, at);
      this.sfx.play('success');
      this.sfx.vibrate(25);
      if (isNew) {
        this.reveal.enqueue({
          banner: 'NEW!',
          bannerColor: 0x3f86c4,
          item: this.itemsById.get(result.output),
          onShow: () => this.sfx.play('chime'),
          holdMs: 750,
        });
      }
    } else if (result.action === 'DISAPPEAR_SERVED') {
      this.finishDish(result.output, at);
    }

    this.clearSlotsAfterCrafting([dropped, target], at);
    // A step just made stops being hidden in the order tab.
    if (isNewRecipe) this.orderTab.refresh();
    this.saveProgress();
  }

  spawnResult(itemId, at) {
    const token = this.spawnWorkspaceToken(itemId, at.x, at.y);
    token.setScale(0).tweenScale(1, 300, 'Back.easeOut');
    return token;
  }

  /** A finished dish: handed to the customer if they ordered it, otherwise it pops and is gone. */
  finishDish(itemId, at) {
    const item = this.itemsById.get(itemId);
    const ordered = this.customerActive && this.currentOrder.includes(itemId) && !this.run.served.includes(itemId);
    if (ordered) this.serveToCustomer(item, at);
    else this.popDish(item, at);

    const isFirstServe = !this.servedDishes.has(itemId);
    this.servedDishes.add(itemId);
    this.updateHud();
    if (!isFirstServe) return;

    const joke = item.type === 'joke';
    this.reveal.enqueue({
      banner: joke ? 'OOPS!' : 'NEW DISH!',
      bannerColor: joke ? 0x9b6fd0 : 0xe0912f,
      item,
      // Draw the eye to the Recipe Book counter that just went up.
      onClose: () => this.tweens.add({ targets: this.recipesButton, scale: 1.12, duration: 160, yoyo: true, repeat: 1 }),
    });
  }

  /** The dish flies up to the customer's speech bubble and gets ticked off. */
  serveToCustomer(item, at) {
    this.run.served.push(item.id);
    const target = this.counter.dishPoint(item.id);
    const dish = new ItemToken(this, at.x, at.y, item).setDepth(FX_DEPTH);
    dish.setInputEnabled(false).setScale(0);
    this.tweens.chain({
      targets: dish,
      tweens: [
        { scale: 1.4, duration: 260, ease: 'Back.easeOut' },
        { x: target.x, y: target.y, scale: 0.6, duration: SERVE_FLIGHT_MS, ease: 'Cubic.easeInOut' },
        { alpha: 0, duration: 120 },
      ],
      onComplete: () => {
        dish.destroy();
        this.counter.tick(item.id);
        this.burst(target, [0xf2c230, 0xffffff, 0xff9f43], 10);
      },
    });
    this.sfx.play('success');
    this.time.delayedCall(150, () => this.sfx.play('jingle'));
    this.sfx.vibrate([30, 40, 60]);
    this.floatText(at.x, at.y - 70, `${item.name} served!`, '#d08a18');

    this.orderTab.markServed(item.id);
    if (this.currentOrder.every((id) => this.run.served.includes(id))) {
      // Happy with how long it took, judged the moment the food is ready.
      this.finishCustomer(moodAt(this.fractionLeft), { leaveDelay: SERVE_FLIGHT_MS + 400 });
    }
  }

  /** Nobody ordered it (or it's a kitchen disaster): it pops on the table and disappears. */
  popDish(item, at) {
    const dish = new ItemToken(this, at.x, at.y, item).setDepth(FX_DEPTH);
    dish.setInputEnabled(false).setScale(0);
    this.tweens.chain({
      targets: dish,
      tweens: [
        { scale: 1.5, duration: 300, ease: 'Back.easeOut' },
        { y: at.y - 120, alpha: 0, scale: 1, delay: 500, duration: 600, ease: 'Quad.easeIn' },
      ],
      onComplete: () => dish.destroy(),
    });
    const joke = item.type === 'joke';
    this.burst(at, joke ? [0xb594d6, 0xff6b6b, 0xffd166] : [0xf2c230, 0xffffff, 0xff9f43], joke ? 20 : 14);

    if (item.sfx) {
      this.sfx.play(item.sfx);
      this.sfx.vibrate([60, 30, 90]);
      if (item.sfx === 'explosion') this.cameras.main.shake(250, 0.008);
    } else {
      this.sfx.play('success');
      this.sfx.vibrate(25);
    }
    this.floatText(at.x, at.y - 70, joke ? `Oops! ${item.name}!` : 'Nobody ordered that!', joke ? '#8f5fc4' : '#a0522d');
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
    // Every item the player has: the chapters' raw ingredients and tools, plus anything they've
    // cooked (remembered so its "NEW!" card shows only the first time; it isn't kept in storage).
    this.unlockedIngredients = new Set();
    this.servedDishes = new Set();
    this.discoveredRecipes = new Set();
    this.bestStars = {};
    // Storage unavailable or corrupt: start fresh.
    const saved = loadSave();
    if (saved) {
      saved.unlocked?.forEach((id) => this.unlockedIngredients.add(id));
      saved.served?.forEach((id) => this.servedDishes.add(id));
      saved.recipes?.forEach((id) => this.discoveredRecipes.add(id));
      Object.assign(this.bestStars, saved.levels);
    }
    this.playMs = Number(saved?.playMs) || 0;
  }

  saveProgress() {
    writeSave({
      unlocked: [...this.unlockedIngredients],
      served: [...this.servedDishes],
      recipes: [...this.discoveredRecipes],
      levels: this.bestStars,
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
}
