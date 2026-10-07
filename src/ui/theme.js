import { getLang } from '../i18n/lang.js';

// Shared look for the cozy-kitchen UI.
// Fredoka has no Thai letters: the browser picks Mitr for those, glyph by glyph, so mixed text
// like "สูตร 3/39" uses both fonts.
export const FONT = 'Fredoka, Mitr, "Arial Rounded MT Bold", Arial, sans-serif';

export const COLORS = {
  ink: '#6b3f22', // main brown text
  inkSoft: '#a08466',
  cream: '#fff8ec',
  chalk: '#f1ece2',

  woodLight: 0xf2d3a6,
  wood: 0xe8c393,
  woodDark: 0xd9ae7c,
  woodEdge: 0xc4925f,
  woodShadow: 0xb98a5c,
  woodGrain: 0xe2b886,
};

export const TYPE_COLORS = {
  base_ingredient: 0x8cc474,
  crafted_ingredient: 0x7fb3dd,
  tool: 0xb0a49a,
  station: 0xf0a060,
  final_dish: 0xf2c44f,
  joke: 0xb594d6,
};

// Thai stacks vowels and tone marks above and below the line: measure with them, and pad more,
// so nothing gets clipped.
const THAI_TEST_STRING = 'ปั๊ญู่|MÉqgy';
const THAI_PADDING_Y = 8;

let segmenter;

/** Splits a line into words. Thai has no spaces between words, so this needs a real word segmenter. */
function words(line) {
  if (segmenter === undefined) segmenter = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('th', { granularity: 'word' }) : null;
  if (segmenter) return [...segmenter.segment(line)].map((s) => s.segment);
  return line.split(/(\s+)/);
}

/** Word wrap for Thai: fills each line word by word up to `width`, measured with the text's own font. */
function thaiWrap(width) {
  return (text, textObject) => {
    const ctx = textObject.context;
    const lines = [];
    for (const paragraph of text.split('\n')) {
      let line = '';
      for (const word of words(paragraph)) {
        const next = line + word;
        if (line.trim() && ctx.measureText(next.trimEnd()).width > width) {
          lines.push(line.trimEnd());
          line = word.trimStart();
        } else {
          line = next;
        }
      }
      lines.push(line.trimEnd());
    }
    return lines;
  };
}

/** Text style helper with the shared font (and Thai line metrics and wrapping when the game is in Thai). */
export function textStyle(size, weight = 600, color = COLORS.ink, extra = {}) {
  const style = { fontFamily: FONT, fontSize: size, fontStyle: String(weight), color, padding: { y: 4 }, ...extra };
  if (getLang() !== 'th') return style;
  style.padding = { ...style.padding, y: Math.max(THAI_PADDING_Y, style.padding.y ?? 0) };
  style.testString = THAI_TEST_STRING;
  if (style.wordWrap?.width) style.wordWrap = { callback: thaiWrap(style.wordWrap.width) };
  return style;
}
