/* 中文 for FruiTTy Kids: the words on the page, the toasts, the canvas pop-ups and the ? panel (Kit.lang, from
   kit/lang.js). The kids' names, the other chefs' names and the FruiTTy Kids logo stay in English on purpose. */
(function () {
  const L = Kit.lang;
  L.keep(['FruiTTy Kids', 'FRUI', 'KIDS', 'TEDDY', 'TOMMY', 'Teddy', 'Tommy', 'ZOOM', 'LUNA', 'BOLT', 'BRUNO', 'Claude Code', 'Esc']);

  L.add({
    // title screen
    "Swipe to slice the fruit! Don't slice the zombies. Pop a bubble to freeze time.": '划一下就能切水果！别切到僵尸哦。戳破泡泡，时间会冻住。',
    'PICK YOUR CHEF': '选你的小厨师', 'Pick your chef': '选你的小厨师', 'ZOMBIE': '僵尸',
    'BUDDY · TAP ME!': '叫他来！', 'Call your buddy (T)': '叫兄弟来帮忙 (T)',
    '🖱️ hold the mouse button and swipe to slice': '🖱️ 按住鼠标划过水果就能切', 'pick chef': '选厨师',
    'call': '叫', 'play': '开始', 'sound': '声音', '👆 swipe your finger across the fruit to slice': '👆 用手指划过水果就能切',
    "'S BEST": ' 的最高分',
    // the HUD and its buttons
    'Pause (P)': '暂停 (P)', 'Sound (M)': '声音 (M)', 'Your buddy is guarding you': '兄弟在保护你',
    // pause and game over
    '🏠 MENU': '🏠 菜单', 'P · Esc · Space': 'P · Esc · 空格',
    'NICE CHOPPING!': '切得真棒！', 'AWESOME!': '太厉害了！', 'FRUIT MASTER!': '水果大师！',
    'FRUIT SLICED': '切开的水果', 'BEST COMBO': '最多连切', '★ NEW BEST! ★': '★ 新纪录！★',
    '↻ PLAY AGAIN': '↻ 再玩一次', '🧑‍🍳 CHANGE CHEF': '🧑‍🍳 换厨师', 'Space · Enter': '空格 · 回车',
    'LOADING…': '加载中…', 'This browser can’t run WebGL, so the game can’t start.': '这个浏览器跑不了 WebGL，游戏开不了。',
    // toasts
    '🧟 OOPS, A ZOMBIE!': '🧟 哎呀，是僵尸！', '+❤️ BONUS HEART!': '+❤️ 奖励一颗心！',
    'DOUBLE! +1': '两个一起切！+1', 'TRIPLE COMBO! +3': '三连切！+3', '👆 SWIPE ACROSS THE FRUIT!': '👆 划过水果试试！',
    // drawn on the canvas (game.js asks through Kit.lang.t)
    'SWISH!': '唰！进球！', 'SAVED!': '接住啦！', 'BOO!': '哇呜！',
    // the ? panel (js/keys.js)
    'slice': '切水果', 'hold the mouse button and drag': '按住鼠标拖动', 'pick your chef (title)': '选厨师（标题页）',
    'start · play again': '开始 · 再玩一次',
    "Swipe a finger to slice (several fingers work at once). Tap your brother's face (bottom right) to call him.":
      '用手指划过去切水果（几根手指可以一起切）。点右下角兄弟的头像，叫他来帮忙。',
  });

  const TREAT = { 'ICE CREAM': '冰淇淋', WATER: '水', 'JUICE BOX': '果汁', COOKIE: '饼干', WATERMELON: '西瓜', BANANA: '香蕉' };
  L.rule(/^(.+)'S BEST$/, '$1 的最高分');
  L.rule(/^BEST (\d+)$/, '最高分 $1');
  L.rule(/^Call (Teddy|Tommy) \(T\)$/, '叫 $1 来帮忙 (T)');
  L.rule(/^(.+) SAVED YOU!$/, '$1 救了你！');
  L.rule(/^(.+)'S HERE!$/, '$1 来啦！');
  L.rule(/^(\S+) (ICE CREAM|WATER|JUICE BOX|COOKIE|WATERMELON|BANANA) FROM (.+)!$/, (m, emoji, item, who) => `${emoji} ${who} 送来的${TREAT[item]}！`);
  L.rule(/^⭐ GOLDEN! \+(\d+)$/, '⭐ 金色水果！+$1');
  L.rule(/^❄️ (.+) FREEZE! ❄️$/, '❄️ $1 冻住时间！❄️');
  L.rule(/^SUPER COMBO ×(\d+)! \+(\d+)$/, '超级连切 ×$1！+$2');
  L.rule(/^MEGA COMBO ×(\d+)! \+(\d+)$/, '无敌连切 ×$1！+$2');
  L.rule(/^🃏 (.+) CARD! \+(\d+)$/, (m, name, n) => `🃏 ${L.t(name)} 卡片！+${n}`);

  // the character cards are painted once; repaint their names (ZOMBIE ↔ 僵尸) when the language changes
  L.onChange(() => FT.fruits.repaintCards());
})();
