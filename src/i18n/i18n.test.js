import { describe, it, expect, beforeEach } from 'vitest';
import { STRINGS } from './strings.js';
import { TH_ITEMS, TH_LEVELS, TH_CUISINES } from './items.th.js';
import { t, setLang, localizedItems, levelName, levelBlurb, cuisineName } from './lang.js';
import items from '../data/items.json';
import { LEVELS } from '../data/levels.js';
import { CHAPTERS } from '../data/chapters.js';

const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('interface strings', () => {
  it('has every key in both languages', () => {
    expect(Object.keys(STRINGS.th).sort()).toEqual(Object.keys(STRINGS.en).sort());
  });

  it('uses the same placeholders in both languages', () => {
    for (const key of Object.keys(STRINGS.en)) {
      expect(placeholders(STRINGS.th[key]), key).toEqual(placeholders(STRINGS.en[key]));
    }
  });

  it('has no empty text', () => {
    for (const lang of ['en', 'th']) {
      for (const [key, text] of Object.entries(STRINGS[lang])) expect(text.trim(), `${lang} ${key}`).not.toBe('');
    }
  });
});

describe('Thai game content', () => {
  it('names and describes every item', () => {
    for (const item of items) {
      expect(TH_ITEMS[item.id]?.name, item.id).toBeTruthy();
      expect(TH_ITEMS[item.id]?.desc, item.id).toBeTruthy();
    }
    expect(Object.keys(TH_ITEMS).sort()).toEqual(items.map((i) => i.id).sort());
  });

  it('names every chapter and Recipe Book section', () => {
    expect(TH_LEVELS).toHaveLength(LEVELS.length);
    TH_LEVELS.forEach((level, i) => {
      expect(level.name, `level ${i}`).toBeTruthy();
      expect(level.blurb, `level ${i}`).toBeTruthy();
    });
    for (const chapter of CHAPTERS) expect(TH_CUISINES[chapter.key], chapter.key).toBeTruthy();
  });
});

describe('lang', () => {
  beforeEach(() => setLang('en'));

  it('fills placeholders and switches language', () => {
    expect(t('hud.recipes', { found: 3, total: 39 })).toBe('Recipes 3/39');
    setLang('th');
    expect(t('hud.recipes', { found: 3, total: 39 })).toBe('สูตร 3/39');
  });

  it('falls back to the key for unknown text, and ignores unknown languages', () => {
    expect(t('no.such.key')).toBe('no.such.key');
    setLang('fr');
    expect(t('hud.hint')).toBe('Hint');
  });

  it('swaps item, chapter and section names for Thai', () => {
    expect(localizedItems().find((i) => i.id === 'ing_egg').name).toBe('Egg');
    expect(levelName(0)).toBe('First Day');
    setLang('th');
    const egg = localizedItems().find((i) => i.id === 'ing_egg');
    expect(egg.name).toBe('ไข่');
    expect(egg.emoji).toBe('🥚');
    expect(levelName(0)).toBe('วันแรก');
    expect(levelBlurb(0)).toBe(TH_LEVELS[0].blurb);
    expect(cuisineName('breakfast')).toBe('อาหารเช้า');
  });
});
