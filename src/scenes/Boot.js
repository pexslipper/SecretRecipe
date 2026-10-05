import Phaser from 'phaser';

const FONT_FACES = ['500 20px Fredoka', '600 20px Fredoka', '700 20px Fredoka'];
const FONT_TIMEOUT_MS = 3000;

// Waits for the bundled Fredoka font so the first rendered text doesn't fall back to Arial.
export class Boot extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    const fonts = Promise.all(FONT_FACES.map((face) => document.fonts.load(face)));
    const timeout = new Promise((resolve) => setTimeout(resolve, FONT_TIMEOUT_MS));
    Promise.race([fonts, timeout])
      .catch(() => {})
      .finally(() => this.scene.start('Preloader'));
  }
}
