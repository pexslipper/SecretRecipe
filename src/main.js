import Phaser from 'phaser';
import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/600.css';
import '@fontsource/fredoka/700.css';
import { Boot } from './scenes/Boot.js';
import { Preloader } from './scenes/Preloader.js';
import { MainMenu } from './scenes/MainMenu.js';
import { CraftingScene } from './scenes/CraftingScene.js';
import { Congrats } from './scenes/Congrats.js';
import { gameSizeFor } from './ui/layout.js';

const container = document.getElementById('game-container');

/** CSS px the game can use (the container already excludes phone notches via safe-area padding). */
function viewportSize() {
  const style = getComputedStyle(container);
  const padX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
  const padY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
  return { w: container.clientWidth - padX, h: container.clientHeight - padY };
}

const initial = viewportSize();
const { width, height } = gameSizeFor(initial.w, initial.h);

const config = {
  type: Phaser.AUTO,
  parent: container,
  width,
  height,
  backgroundColor: '#e9d5b7',
  disableContextMenu: true,
  input: { mouse: { preventDefaultWheel: true } },
  // The item sprite sheet is drawn ~4x smaller than its source; mipmaps keep the icons smooth.
  render: { mipmapFilter: 'LINEAR_MIPMAP_LINEAR' },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [Boot, Preloader, MainMenu, CraftingScene, Congrats],
};

const game = new Phaser.Game(config);

// Re-pick the game size when the window resizes or the device rotates. Scenes listen for the
// scale manager's resize event and lay themselves out again when the game size changed.
let resizeTimer = null;
function onViewportChange() {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const { w, h } = viewportSize();
    const next = gameSizeFor(w, h);
    const size = game.scale.gameSize;
    if (next.width !== size.width || next.height !== size.height) {
      game.scale.setGameSize(next.width, next.height);
    } else {
      game.scale.refresh();
    }
  }, 150);
}
window.addEventListener('resize', onViewportChange);
window.addEventListener('orientationchange', onViewportChange);
window.visualViewport?.addEventListener('resize', onViewportChange);

export default game;
