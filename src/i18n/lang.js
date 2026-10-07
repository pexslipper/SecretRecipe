import itemsData from '../data/items.json';
import { LEVELS } from '../data/levels.js';
import { CHAPTERS } from '../data/chapters.js';
import { STRINGS } from './strings.js';
import { TH_ITEMS, TH_LEVELS, TH_CUISINES } from './items.th.js';

// Game language: English or Thai. The player's choice is remembered; before they pick one, it
// follows the device. Scenes restart when it changes, so everything just reads the current one.
export const LANGS = ['en', 'th'];
const LANG_KEY = 'secret-recipe-lang';

let current = null;

function deviceLang() {
  try {
    return (navigator.language ?? '').toLowerCase().startsWith('th') ? 'th' : 'en';
  } catch {
    return 'en';
  }
}

export function getLang() {
  if (current) return current;
  let saved = null;
  try {
    saved = localStorage.getItem(LANG_KEY);
  } catch {
    // Storage unavailable: just follow the device.
  }
  current = LANGS.includes(saved) ? saved : deviceLang();
  return current;
}

export function setLang(lang) {
  if (!LANGS.includes(lang)) return;
  current = lang;
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    // Ignore: the choice just won't persist.
  }
}

/** The text for `key` in the current language (English if missing), with `{name}` placeholders filled from `vars`. */
export function t(key, vars = {}) {
  const text = STRINGS[getLang()][key] ?? STRINGS.en[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match));
}

/** items.json with names and descriptions in the current language. */
export function localizedItems() {
  if (getLang() === 'en') return itemsData;
  return itemsData.map((item) => ({ ...item, ...TH_ITEMS[item.id] }));
}

export function levelName(index) {
  return (getLang() === 'th' && TH_LEVELS[index]?.name) || LEVELS[index].name;
}

export function levelBlurb(index) {
  return (getLang() === 'th' && TH_LEVELS[index]?.blurb) || LEVELS[index].blurb;
}

/** Recipe Book section name (Breakfast, Italian, …). */
export function cuisineName(key) {
  return (getLang() === 'th' && TH_CUISINES[key]) || CHAPTERS.find((c) => c.key === key)?.name || key;
}
