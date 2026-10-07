// Interface text in each language. `{name}` placeholders are filled in by t() (see lang.js).
// Keys differing only by `.touch` / `.mouse` are picked by input type.
export const STRINGS = {
  en: {
    // Main menu
    'menu.start.touch': 'Tap to start',
    'menu.start.mouse': 'Click or press SPACE to start',

    // Chapters screen
    'chapters.title': 'Chapters',
    'chapters.label': 'Chapter {n}',
    'chapters.locked': 'Earn a ⭐ in Chapter {n} first',
    'chapters.play': 'Play ▶',
    'chapters.replay': 'Replay ↻',
    'chapters.back': 'Back',
    'chapters.reset': 'Reset progress',
    'confirm.reset': 'Reset all progress? Stars, recipes and unlocked items will be lost.',

    // Kitchen
    'hud.recipes': 'Recipes {found}/{total}',
    'hud.hint': 'Hint',
    'hud.menu': 'Menu',
    'hud.clear': 'Clear',
    'board.touch': 'Tap or drag ingredients here,\nthen drop one onto another to cook, Drag to storage to remove.',
    'board.mouse': 'Drag ingredients here,\nthen drop one onto another to cook, Drag to storage to remove.',
    'confirm.leave': 'Leave this chapter? You will have to start it again.',
    'intro.banner': 'CHAPTER {n}',
    'intro.desc': '{blurb}. Serve {count} customers: each one who gets their food before turning angry earns a ⭐',
    'intro.newItems': 'New in storage: {items}',
    'hint.wait': 'Wait for a customer!',
    'hint.known': 'You already know this recipe!',
    'hint.none': 'No hints left this chapter',
    'cook.fail': "Doesn't go together!",
    'cook.served': '{name} served!',
    'cook.oops': 'Oops! {name}!',
    'cook.unordered': 'Nobody ordered that!',
    'customer.left': 'Too slow! They left 😤',

    // Customers
    'mood.happy': 'Happy',
    'mood.impatient': 'Impatient',
    'mood.angry': 'Angry',
    'mood.left': 'Gone',
    'bubble.one': "I'd like:",
    'bubble.both': "I'd like both:",
    'sign.progress': 'Chapter {n} · {shown}/{total}',
    'order.title': '📋 Recipe',

    // Pop-up cards
    'reveal.new': 'NEW!',
    'reveal.newDish': 'NEW DISH!',
    'reveal.oops': 'OOPS!',
    'reveal.continue.touch': 'Tap to continue',
    'reveal.continue.mouse': 'Click to continue',

    // Storage
    'storage.title': 'My Kitchen Storage!',
    'storage.tools': 'Tools',
    'storage.raw': 'Raw Ingredients',
    'storage.toolsEmpty': 'No tools yet!',
    'storage.rawEmpty': 'Nothing here yet!',
    'storage.hide': 'hide',
    'storage.show': 'show',
    'storage.new': 'NEW!',
    'scroll.more': 'scroll for more',

    // Recipe Book
    'book.title': 'Recipe Book',
    'book.complete': '🏅 Complete!',
    'book.served': 'Served ✓',
    'book.found': '{found}/{total} found',

    // Chapter results
    'result.subtitle': 'Chapter {n} · {name}',
    'result.perfect': 'Perfect service!',
    'result.complete': 'Chapter complete!',
    'result.none': 'Nobody was happy…',
    'result.newBest': '🏅 New best!',
    'result.total': '🏆 All chapters: ⭐ {stars} / {max}',
    'result.retry': 'Retry',
    'result.next': 'Next ▶',
    'result.chapters': 'Chapters',
  },

  th: {
    // Main menu
    'menu.start.touch': 'แตะเพื่อเริ่มเล่น',
    'menu.start.mouse': 'คลิกหรือกด SPACE เพื่อเริ่มเล่น',

    // Chapters screen
    'chapters.title': 'เลือกบท',
    'chapters.label': 'บทที่ {n}',
    'chapters.locked': 'ต้องได้ ⭐ ในบทที่ {n} ก่อนนะ',
    'chapters.play': 'เล่น ▶',
    'chapters.replay': 'เล่นอีกครั้ง ↻',
    'chapters.back': 'กลับ',
    'chapters.reset': 'เริ่มใหม่ทั้งหมด',
    'confirm.reset': 'ล้างความคืบหน้าทั้งหมด? ดาว สูตรอาหาร และของที่ปลดล็อกจะหายไปทั้งหมด',

    // Kitchen
    'hud.recipes': 'สูตร {found}/{total}',
    'hud.hint': 'คำใบ้',
    'hud.menu': 'เมนู',
    'hud.clear': 'ล้าง',
    'board.touch': 'แตะหรือลากวัตถุดิบมาวางที่นี่\nแล้ววางซ้อนกันเพื่อปรุง ลากกลับไปที่ห้องเก็บของเพื่อทิ้ง',
    'board.mouse': 'ลากวัตถุดิบมาวางที่นี่\nแล้ววางซ้อนกันเพื่อปรุง ลากกลับไปที่ห้องเก็บของเพื่อทิ้ง',
    'confirm.leave': 'ออกจากบทนี้ไหม? ต้องเริ่มบทนี้ใหม่ตั้งแต่ต้นนะ',
    'intro.banner': 'บทที่ {n}',
    'intro.desc': '{blurb} เสิร์ฟลูกค้า {count} คน ทุกคนที่ได้อาหารก่อนจะโกรธ จะให้ ⭐ หนึ่งดวง',
    'intro.newItems': 'ของใหม่ในห้องเก็บของ: {items}',
    'hint.wait': 'รอลูกค้าก่อนนะ!',
    'hint.known': 'สูตรนี้รู้หมดแล้ว!',
    'hint.none': 'คำใบ้ในบทนี้หมดแล้ว',
    'cook.fail': 'เข้ากันไม่ได้!',
    'cook.served': 'เสิร์ฟ{name}แล้ว!',
    'cook.oops': 'อุ๊ย! {name}!',
    'cook.unordered': 'ไม่มีใครสั่งเมนูนี้!',
    'customer.left': 'ช้าไป! ลูกค้าเดินออกไปแล้ว 😤',

    // Customers
    'mood.happy': 'อารมณ์ดี',
    'mood.impatient': 'หงุดหงิด',
    'mood.angry': 'โกรธ',
    'mood.left': 'กลับไปแล้ว',
    'bubble.one': 'ขอสั่ง:',
    'bubble.both': 'ขอทั้งสองอย่าง:',
    'sign.progress': 'บทที่ {n} · {shown}/{total}',
    'order.title': '📋 สูตร',

    // Pop-up cards
    'reveal.new': 'ใหม่!',
    'reveal.newDish': 'เมนูใหม่!',
    'reveal.oops': 'อุ๊ย!',
    'reveal.continue.touch': 'แตะเพื่อไปต่อ',
    'reveal.continue.mouse': 'คลิกเพื่อไปต่อ',

    // Storage
    'storage.title': 'ห้องเก็บของในครัว!',
    'storage.tools': 'อุปกรณ์',
    'storage.raw': 'วัตถุดิบ',
    'storage.toolsEmpty': 'ยังไม่มีอุปกรณ์!',
    'storage.rawEmpty': 'ยังไม่มีอะไรเลย!',
    'storage.hide': 'ซ่อน',
    'storage.show': 'แสดง',
    'storage.new': 'ใหม่!',
    'scroll.more': 'เลื่อนดูเพิ่ม',

    // Recipe Book
    'book.title': 'สมุดสูตรอาหาร',
    'book.complete': '🏅 ครบแล้ว!',
    'book.served': 'เสิร์ฟแล้ว ✓',
    'book.found': 'พบ {found}/{total}',

    // Chapter results
    'result.subtitle': 'บทที่ {n} · {name}',
    'result.perfect': 'บริการสมบูรณ์แบบ!',
    'result.complete': 'ผ่านบทนี้แล้ว!',
    'result.none': 'ไม่มีใครพอใจเลย…',
    'result.newBest': '🏅 สถิติใหม่!',
    'result.total': '🏆 ทุกบท: ⭐ {stars} / {max}',
    'result.retry': 'เล่นอีกครั้ง',
    'result.next': 'บทถัดไป ▶',
    'result.chapters': 'เลือกบท',
  },
};
