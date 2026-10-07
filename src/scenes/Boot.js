import Phaser from 'phaser';

const FONT_FACES = ['500 20px Fredoka', '600 20px Fredoka', '700 20px Fredoka'];
// Thai text: Mitr. The sample letter makes the browser fetch its Thai subset, not just Latin.
const THAI_FACES = ['500 20px Mitr', '600 20px Mitr', '700 20px Mitr'];
const FONT_TIMEOUT_MS = 3000;

// Waits for the bundled fonts so the first rendered text doesn't fall back to Arial.
export class Boot extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    const fonts = Promise.all([
      ...FONT_FACES.map((face) => document.fonts.load(face)),
      ...THAI_FACES.map((face) => document.fonts.load(face, 'ก')),
    ]);
    const timeout = new Promise((resolve) => setTimeout(resolve, FONT_TIMEOUT_MS));
    Promise.race([fonts, timeout])
      .catch(() => {})
      .finally(() => this.scene.start('Preloader'));
  }
}
