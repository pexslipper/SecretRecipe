// Shared look for the cozy-kitchen UI.
export const FONT = 'Fredoka, "Arial Rounded MT Bold", Arial, sans-serif';

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

/** Text style helper with the shared font. */
export function textStyle(size, weight = 600, color = COLORS.ink, extra = {}) {
  return { fontFamily: FONT, fontSize: size, fontStyle: String(weight), color, padding: { y: 4 }, ...extra };
}
