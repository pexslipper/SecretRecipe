import Phaser from 'phaser';
import { COLORS, textStyle } from './theme.js';
import { LANGS, getLang, setLang } from '../i18n/lang.js';

const LABELS = { en: 'EN', th: 'TH' };
const SIDE_W = 46;
const H = 38;

/**
 * Wooden "EN | TH" pill; the current language is highlighted. Picking the other one switches the
 * game's language and restarts the scene so everything redraws in it.
 */
export function makeLangToggle(scene, x, y) {
  const w = SIDE_W * LANGS.length;
  const current = getLang();
  const g = new Phaser.GameObjects.Graphics(scene);
  g.fillStyle(0x000000, 0.15).fillRoundedRect(-w / 2 + 2, -H / 2 + 4, w, H, H / 2);
  g.fillStyle(COLORS.woodLight).fillRoundedRect(-w / 2, -H / 2, w, H, H / 2);
  g.lineStyle(2.5, COLORS.woodEdge).strokeRoundedRect(-w / 2, -H / 2, w, H, H / 2);

  const parts = [g];
  LANGS.forEach((lang, i) => {
    const cx = -w / 2 + SIDE_W * (i + 0.5);
    const active = lang === current;
    if (active) g.fillStyle(0xdd5a50).fillRoundedRect(cx - SIDE_W / 2 + 4, -H / 2 + 4, SIDE_W - 8, H - 8, (H - 8) / 2);
    parts.push(new Phaser.GameObjects.Text(scene, cx, 0, LABELS[lang], textStyle(16, 700, active ? '#ffffff' : COLORS.ink)).setOrigin(0.5));

    const hit = new Phaser.GameObjects.Zone(scene, cx, 0, SIDE_W, H);
    hit.setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => {
      if (active) return;
      setLang(lang);
      scene.scene.restart();
    });
    parts.push(hit);
  });
  return scene.add.container(x, y, parts);
}
