// Recipe Book chapters, in display order. Each dish/joke in items.json names its chapter by `key`.
export const CHAPTERS = [
  { key: 'breakfast', name: 'Breakfast', emoji: '🥐', color: 0xf6c75a },
  // (flag emoji don't render on Windows, so no 🇮🇹)
  { key: 'italian', name: 'Italian', emoji: '🍝', color: 0x8fc46a },
  { key: 'asian', name: 'Asian', emoji: '🥢', color: 0xe98b6d },
  { key: 'bbq', name: 'BBQ & Roasts', emoji: '🔥', color: 0xd9734a },
  { key: 'comfort', name: 'Comfort Food', emoji: '🥣', color: 0x7cb8c9 },
  { key: 'disasters', name: 'Kitchen Disasters', emoji: '😂', color: 0xb594d6 },
];

export const CHAPTERS_BY_KEY = new Map(CHAPTERS.map((c) => [c.key, c]));

/** Final items (dishes and jokes) in a chapter. */
export function chapterDishes(chapterKey, dishIds, itemsById) {
  return [...dishIds].filter((id) => itemsById.get(id)?.chapter === chapterKey);
}
