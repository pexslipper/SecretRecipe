import Phaser from 'phaser';
import { SOUND_FILES, SOUND_EXTENSIONS } from '../audio/Sfx.js';
import { ITEM_ATLAS } from '../ui/ItemToken.js';
import { CUSTOMER_TEXTURE, CUSTOMER_FILE, addCustomerFrames } from '../ui/CustomerSprites.js';
import { MUSIC_KEY, MUSIC_FILE } from '../audio/Music.js';

// Sound files can sit in public/assets/sounds/ or straight in public/assets/.
const SOUND_FOLDERS = ['sounds/', ''];

/** Finds <name>.<ext> in the first folder/extension that exists (null if none). */
async function findSound(name) {
  for (const folder of SOUND_FOLDERS) {
    for (const ext of SOUND_EXTENSIONS) {
      const url = `${folder}${name}.${ext}`;
      try {
        // The dev/preview server answers unknown paths with index.html, so check it's really audio.
        const res = await fetch(`assets/${url}`, { method: 'HEAD' });
        if (res.ok && (res.headers.get('content-type') ?? '').startsWith('audio')) return url;
      } catch {
        // Offline or blocked: treat as missing.
      }
    }
  }
  return null;
}

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
    // Item icons: one sprite sheet, with a frame per `icon` field in src/data/items.json.
    // items.json is generated from items.png by `npm run atlas`; re-run it whenever the sheet changes.
    this.load.atlas(ITEM_ATLAS, 'items.png', 'items.json');
    // Customers: one sheet, cut into a frame per character and pose (see CustomerSprites.js).
    this.load.image(CUSTOMER_TEXTURE, CUSTOMER_FILE);
    this.load.audio(MUSIC_KEY, MUSIC_FILE);
  }

  async create() {
    addCustomerFrames(this.textures.get(CUSTOMER_TEXTURE));

    // Sound effects are optional: load whichever ones are in public/assets/sounds/.
    const found = await Promise.all(SOUND_FILES.map(async (name) => [name, await findSound(name)]));
    const files = found.filter(([, url]) => url);
    if (files.length) {
      for (const [name, url] of files) this.load.audio(`sfx_${name}`, url);
      this.load.once('complete', () => this.scene.start('MainMenu'));
      this.load.start();
    } else {
      this.scene.start('MainMenu');
    }
  }
}
