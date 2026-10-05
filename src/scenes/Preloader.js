import Phaser from 'phaser';

export class Preloader extends Phaser.Scene {
  constructor() {
    super('Preloader');
  }

  init() {
    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, 468, 32).setStrokeStyle(1, 0xffffff);
    const bar = this.add.rectangle(width / 2 - 230, height / 2, 4, 28, 0xffffff);

    this.load.on('progress', (progress) => {
      bar.width = 4 + 460 * progress;
    });
  }

  preload() {
    // Files in /public are served from the root, e.g. public/assets/logo.png -> 'assets/logo.png'
    this.load.setPath('assets');
    // Item icons: load a texture keyed by the item's `icon` field in src/data/items.json
    // and it replaces the emoji placeholder automatically, e.g.
    // this.load.image('icon_meat', 'icons/meat.png');
  }

  create() {
    this.scene.start('MainMenu');
  }
}
