import Phaser from 'phaser';
import { drawKitchen, drawPlank } from '../ui/KitchenBackdrop.js';
import { COLORS, textStyle } from '../ui/theme.js';
import { startMusic } from '../audio/Music.js';
import { makeLangToggle } from '../ui/LangToggle.js';
import { t } from '../i18n/lang.js';

export class MainMenu extends Phaser.Scene {
  constructor() {
    super('MainMenu');
  }

  create() {
    const { width, height } = this.scale;
    startMusic(this);

    // Same kitchen as the game, filling the whole screen.
    const board = drawKitchen(this, { x: 0, y: 0, w: width, h: height }, { topOverlap: 0 });

    const signW = Math.min(500, width - 60);
    const signY = Math.max(30, Math.min(70, board.y - board.scale * 300));
    drawPlank(this, (width - signW) / 2, signY, signW, 110);
    this.add.text(width / 2, signY + 52, 'Secret Recipe', textStyle(signW < 440 ? 46 : 56, 700)).setOrigin(0.5);

    const touch = this.sys.game.device.input.touch;
    const prompt = this.add
      .text(
        board.x,
        board.y,
        t(touch ? 'menu.start.touch' : 'menu.start.mouse'),
        textStyle(Math.round(24 * Math.max(0.8, board.scale)), 500, COLORS.chalk, { align: 'center', wordWrap: { width: board.width * 0.9 } }),
      )
      .setOrigin(0.5);
    this.tweens.add({ targets: prompt, alpha: 0.4, duration: 800, yoyo: true, repeat: -1 });

    makeLangToggle(this, width - 62, 34);

    // Any tap starts, except on a button (the language switch).
    const start = () => this.scene.start('ChapterSelect');
    this.input.on('pointerdown', (_pointer, over) => {
      if (!over.length) start();
    });
    this.input.keyboard.once('keydown-SPACE', start);

    // Redraw for the new size when the window resizes or the device rotates.
    const onResize = (gameSize) => {
      if (gameSize.width !== width || gameSize.height !== height) this.scene.restart();
    };
    this.scale.on('resize', onResize);
    this.events.once('shutdown', () => this.scale.off('resize', onResize));
  }
}
