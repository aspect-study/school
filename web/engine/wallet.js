/* Loaded by the lobbies and every game. The pages are decoded as UTF-8, so the text can hold emoji. */
(function (root) {
  'use strict';

  var WELCOME_GIFT = 40;
  var POINTS_PER_COIN = 10;

  var CATALOG = [
    { id: 'ml', emoji: '🎮', name: 'Rest: play 1 ML (Mobile Legends) game', goal: 'ML game', coins: 40, perDay: 1 },
    { id: 'dinner', emoji: '🍽️', name: 'Choose what\'s for dinner', goal: 'Dinner pick', coins: 100 },
    { id: 'dessert', emoji: '🍨', name: 'Dessert treat', goal: 'Dessert treat', coins: 100 },
    { id: 'screen', emoji: '📱', name: '30 min extra screen time', goal: 'Extra screen time', coins: 120 },
    { id: 'movie', emoji: '🎬', name: 'Movie night pick', goal: 'Movie night', coins: 300 },
    { id: 'late', emoji: '🌙', name: 'Stay up 30 min later', goal: 'Stay up later', coins: 400 },
    { id: 'toy', emoji: '🧸', name: 'Small toy', goal: 'Small toy', coins: 500 },
    { id: 'big', emoji: '🎡', name: 'Big goal: outing or a toy you\'ve wanted', goal: 'Big goal', coins: 1200 }
  ];

  // Paid for inside a quiz (powerups.js), never in the shop.
  var POWER_UPS = { hint: 3, fifty: 5, second: 5, shield: 4, later: 2, ate: 2, mommy: 4, tatay: 4 };

  // A real school test, entered by a parent in the lobby. score * 100 >= total * pct, checked top-down.
  var TEST_BONUS_TIERS = [{ pct: 100, coins: 50 }, { pct: 90, coins: 40 }, { pct: 80, coins: 30 }, { pct: 0, coins: 10 }];

  function testBonus(score, total) {
    if (!Number.isInteger(score) || !Number.isInteger(total) || total < 1 || score < 0 || score > total) return 0;
    for (var i = 0; i < TEST_BONUS_TIERS.length; i++) {
      if (score * 100 >= total * TEST_BONUS_TIERS[i].pct) return TEST_BONUS_TIERS[i].coins;
    }
    return 0;
  }

  function pad(n) { return n < 10 ? '0' + n : String(n); }

  function dateKey(ms) {
    var d = new Date(ms);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function findItem(id) {
    for (var i = 0; i < CATALOG.length; i++) if (CATALOG[i].id === id) return CATALOG[i];
    return null;
  }

  function own(obj, key) { return Object.prototype.hasOwnProperty.call(obj, key); }

  function create(storage, now, grade) {
    if (!/^grade[0-9]+$/.test(grade || '')) throw new Error('Wallet needs a grade like "grade5".');
    var KEY = 'wallet_v1';

    function fresh() { return { v: 1, baselines: {}, spent: 0, bonus: 0, purchases: [], oldPointsCounted: false }; }

    function read() {
      var raw = null;
      try { raw = storage.getItem(KEY); } catch (e) {}
      if (!raw) return fresh();
      try {
        var d = JSON.parse(raw);
        if (!d || d.v !== 1) return fresh();
        return {
          v: 1,
          baselines: d.baselines && typeof d.baselines === 'object' && !Array.isArray(d.baselines) ? d.baselines : {},
          spent: typeof d.spent === 'number' ? d.spent : 0,
          bonus: typeof d.bonus === 'number' && d.bonus > 0 ? d.bonus : 0,
          purchases: Array.isArray(d.purchases) ? d.purchases.filter(function (p) { return p && typeof p.t === 'number'; }) : [],
          oldPointsCounted: d.oldPointsCounted === true
        };
      } catch (e) {
        return fresh();
      }
    }

    function write(state) {
      try {
        storage.setItem(KEY, JSON.stringify(state));
        return true;
      } catch (e) {
        return false;
      }
    }

    function newPoints(state, points) {
      var gained = 0;
      Object.keys(points || {}).forEach(function (key) {
        if (own(state.baselines, key)) gained += (Number(points[key]) || 0) - (Number(state.baselines[key]) || 0);
      });
      return Math.max(0, gained);
    }

    function balanceOf(state, points) {
      var earned = Math.floor(newPoints(state, points) / POINTS_PER_COIN);
      return Math.max(0, WELCOME_GIFT + earned + state.bonus - state.spent);
    }

    function storedBalanceOf(state) {
      var points = {};
      Object.keys(state.baselines).forEach(function (key) {
        var raw = null;
        try { raw = storage.getItem(key); } catch (e) {}
        points[key] = parseInt(raw, 10) || 0;
      });
      return balanceOf(state, points);
    }

    function boughtToday(state, id) {
      var today = dateKey(now());
      return state.purchases.filter(function (p) { return p.item === id && dateKey(p.t) === today; }).length;
    }

    function check(state, id, points) {
      var item = findItem(id);
      if (!item) return { ok: false, need: 0, daily: false };
      if (item.perDay && boughtToday(state, id) >= item.perDay) return { ok: false, need: 0, daily: true };
      var need = Math.max(0, item.coins - balanceOf(state, points));
      return { ok: need === 0, need: need, daily: false };
    }

    return {
      grade: grade,
      catalog: CATALOG,
      powerUps: POWER_UPS,

      // The first track counts every point earned so far, once (parent's choice, 2026-10-01).
      // After that, a points key seen for the first time starts from its current value.
      track: function (points) {
        var state = read(), changed = false;
        if (!state.oldPointsCounted) {
          Object.keys(points || {}).forEach(function (key) { state.baselines[key] = 0; });
          state.oldPointsCounted = true;
          changed = true;
        }
        Object.keys(points || {}).forEach(function (key) {
          if (!own(state.baselines, key)) { state.baselines[key] = Number(points[key]) || 0; changed = true; }
        });
        if (changed) write(state);
      },

      balance: function (points) { return balanceOf(read(), points); },

      // For the games, which do not know the other subjects' keys: reads every tracked key.
      balanceStored: function () { return storedBalanceOf(read()); },

      // The coins a backup file's saved keys would give, read without writing anything.
      savedBalance: function (saved) {
        var get = function (k) { return own(saved, k) ? saved[k] : null; };
        return create({ getItem: get, setItem: function () {} }, now, grade).balanceStored();
      },

      // In-quiz power-ups: no PIN and no purchase record, just fewer coins.
      spend: function (coins) {
        var state = read();
        if (!(coins > 0) || storedBalanceOf(state) < coins) return false;
        state.spent += coins;
        return write(state);
      },

      earned: function (points) {
        var state = read(), gained = newPoints(state, points);
        return { points: gained, coins: Math.floor(gained / POINTS_PER_COIN), welcome: WELCOME_GIFT, spent: state.spent, bonus: state.bonus };
      },

      addBonus: function (coins) {
        if (!Number.isInteger(coins) || coins <= 0) return false;
        var state = read();
        state.bonus += coins;
        return write(state);
      },

      testBonus: testBonus,

      // Drops purchases before the last `days` local days; `spent` stays, so no coins come back.
      prune: function (days) {
        var d = new Date(now());
        var cutoff = new Date(d.getFullYear(), d.getMonth(), d.getDate() - (days - 1)).getTime();
        var state = read();
        var kept = state.purchases.filter(function (p) { return p.t >= cutoff; });
        if (kept.length === state.purchases.length) return;
        state.purchases = kept;
        write(state);
      },

      canBuy: function (id, points) { return check(read(), id, points); },

      buy: function (id, points) {
        var state = read();
        if (!check(state, id, points).ok) return null;
        var purchase = { item: id, coins: findItem(id).coins, t: now() };
        state.spent += purchase.coins;
        state.purchases.push(purchase);
        return write(state) ? purchase : null;
      },

      purchases: function () { return read().purchases; }
    };
  }

  function coinWord(n) { return n === 1 ? ' coin' : ' coins'; }

  // Kid-facing copy for the coin badges and the "how it works" guide, per child.
  var GUIDE_TEXT = {
    grade5: {
      title: 'How Points, Coins & the Shop Work',
      titleEn: '',
      have: function (n) { return '🪙 You have ' + n + coinWord(n); },
      goal: function (need) { return need > 0 ? need + ' more' + coinWord(need) + ' to 🎮 1 ML game' : 'You have enough coins for 🎮 1 ML game!'; },
      sections: function (ml) {
        return [
          ['⭐', 'Points', 'Every right answer gives you 10 points. When you get 3 or more right in a row 🔥, each one gives 15. A wrong answer never takes points away.'],
          ['🪙', 'Coins', 'Every 10 points turns into 1 coin by itself. You do not need to press anything. A perfect 10-question lesson = 140 points = 14 coins.'],
          ['🛒', 'The Shop', 'In the lobby, tap 🛒 Shop and pick a reward. Then ask Mommy or Tatay to type the PIN. Buying uses up coins, but your ⭐ points stay the same.'],
          ['🎮', 'ML game', 'One ML game costs ' + ml + ' coins. You can buy 1 a day, and only after studying. That is about 3 perfect lessons!'],
          ['💡', 'Power-ups', 'Stuck on a lesson quiz question? Use 💡 Hint (' + POWER_UPS.hint + ' coins) to see a tip, or ✂️ 50/50 (' + POWER_UPS.fifty +
            ' coins) to cross out some wrong answers. Tap it twice to pay. You can use 2 per quiz, and none in the Mock Exam. A helped right answer gives half points and does not grow your 🔥 streak.'],
          ['🛡️', 'More power-ups', '🔁 2nd Chance (' + POWER_UPS.second + ' coins): if you miss, try once more. Half points only if you needed it. ' +
            '🛡️ Shield (' + POWER_UPS.shield + ' coins): when you have a 🔥 streak, your next miss will not break it. ' +
            '⏭️ Later (' + POWER_UPS.later + ' coins): skip a hard question before using any help; it comes back at the end, for full points.'],
          ['👨‍👩‍👧', 'Ask Family', 'Ask Mommy (' + POWER_UPS.mommy + ' coins) or Tatay (' + POWER_UPS.tatay + ' coins) to explain the idea. They will not tell you the answer; you still choose, for half points. ' +
            'Once you pay, the coins are spent, so check first that they are free to help.'],
          ['⏳', 'Resting questions', 'When you get a question right on your own, it rests for 3 days. You can still practice it, but it gives points again only after the rest. Remembering after days is what counts!'],
          ['✏️', 'Type it first', 'See a ✏️ box? Type the answer before you look at the choices. If it is right, you earn 5 bonus points. If not, just pick from the choices.'],
          ['🏆', 'Mock Exam', 'Every right answer in the Mock Exam is worth 20 points, double a lesson quiz!'],
          ['📝', 'Real test bonus', 'Got your real test back from school? Show it to Mommy or Tatay. They can add up to 50 coins: 50 for a perfect score, 40 for 90% or more, 30 for 80% or more, and 10 for trying.'],
          ['★', 'Stars', 'Stars show your best score in each lesson today. They start fresh each new day, so you can win them again. Points and coins are never wiped.'],
          ['🔒', 'Just yours', 'Your coins belong to you only, and they stay on this tablet.']
        ];
      },
      close: 'Got it! 👍',
      badge: function (n) { return '🪙 ' + n + coinWord(n) + ' ❓'; },
      badgeLabel: 'How points and coins work',
      haveNow: function (n) { return '🪙 You now have ' + n + coinWord(n); }
    },
    grade2: {
      title: 'Paano gumagana ang Points, Coins at Shop?',
      titleEn: 'How do Points, Coins and the Shop work?',
      have: function (n) { return '🪙 You have ' + n + coinWord(n); },
      goal: function (need) { return need > 0 ? need + ' more' + coinWord(need) + ' to 🎮 1 ML game' : 'You have enough coins for 🎮 1 ML game!'; },
      sections: function (ml) {
        return [
          ['⭐', 'Points', 'Bawat tamang sagot = 10 points. Kapag 3 o higit pang sunod-sunod na tama 🔥, 15 points bawat isa. Hindi nababawasan ang points kapag mali ang sagot.',
            'Every right answer = 10 points. When you get 3 or more right in a row 🔥, each one gives 15 points. A wrong answer never takes points away.'],
          ['🪙', 'Coins', 'Bawat 10 points = 1 coin. Kusa itong nagiging coin, wala kang pipindutin. Perfect sa 10 tanong = 140 points = 14 coins!',
            'Every 10 points = 1 coin. Points turn into coins by themselves, so you do not need to press anything. A perfect 10-question lesson = 140 points = 14 coins!'],
          ['🛒', 'Shop', 'Sa lobby, pindutin ang 🛒 Shop at pumili ng reward. Tapos ipa-type kay Mommy o Tatay ang PIN. Coins lang ang nagagastos, hindi nababawasan ang ⭐ points mo.',
            'In the lobby, tap 🛒 Shop and pick a reward. Then ask Mommy or Tatay to type the PIN. Buying uses only coins; your ⭐ points stay the same.'],
          ['🎮', 'ML game', 'Ang 1 ML game ay ' + ml + ' coins. Isa lang bawat araw, at pagkatapos lang mag-aral. Mga 3 perfect na lesson lang yan!',
            'One ML game costs ' + ml + ' coins. You can buy only 1 a day, and only after studying. That is just about 3 perfect lessons!'],
          ['💡', 'Power-ups', 'Nahihirapan sa tanong? Gamitin ang 💡 Hint (' + POWER_UPS.hint + ' coins) para makita ang tip, o ✂️ 50/50 (' + POWER_UPS.fifty +
            ' coins) para mawala ang ilang maling sagot. Pindutin nang 2 beses para magbayad. 2 lang bawat quiz, at wala sa Mock Exam. Kapag may tulong, kalahati lang ang points at hindi tataas ang 🔥 streak.',
            'Stuck on a question? Use 💡 Hint (' + POWER_UPS.hint + ' coins) to see a tip, or ✂️ 50/50 (' + POWER_UPS.fifty +
            ' coins) to take away some wrong answers. Tap twice to pay. Only 2 per quiz, and none in the Mock Exam. With help, you get half points and your 🔥 streak does not grow.'],
          ['🛡️', 'Iba pang power-ups · More power-ups', '🔁 2nd Chance (' + POWER_UPS.second + ' coins): kapag mali, isa pang subok. Kalahati lang ang points kung kinailangan mo. ' +
            '🛡️ Shield (' + POWER_UPS.shield + ' coins): kapag may 🔥 streak ka, hindi ito mawawala sa susunod na mali. ' +
            '⏭️ Mamaya na (' + POWER_UPS.later + ' coins): laktawan ang mahirap na tanong bago gumamit ng tulong; babalik ito sa dulo, buong points pa rin.',
            '🔁 2nd Chance (' + POWER_UPS.second + ' coins): if you miss, try once more. Half points only if you needed it. ' +
            '🛡️ Shield (' + POWER_UPS.shield + ' coins): when you have a 🔥 streak, your next miss will not break it. ' +
            '⏭️ Later (' + POWER_UPS.later + ' coins): skip a hard question before using any help; it comes back at the end, for full points.'],
          ['👨‍👩‍👧', 'Ask Family', 'Tanungin si Ate (' + POWER_UPS.ate + ' coins), Mommy (' + POWER_UPS.mommy + ' coins) o Tatay (' + POWER_UPS.tatay + ' coins). Ipapaliwanag nila ang aralin, pero hindi nila sasabihin ang sagot. Ikaw pa rin ang pipili, kalahati ng points. ' +
            'Kapag nagbayad ka na, wala nang balikan, kaya tingnan muna kung libre sila.',
            'Ask Ate (' + POWER_UPS.ate + ' coins), Mommy (' + POWER_UPS.mommy + ' coins) or Tatay (' + POWER_UPS.tatay + ' coins). They explain the lesson but do not tell you the answer. You still choose, for half points. ' +
            'Once you pay, there is no going back, so check first that they are free.'],
          ['⏳', 'Pahinga · Resting questions', 'Kapag tama ang sagot mo nang walang tulong, magpapahinga ang tanong nang 3 araw. Puwede mo pa rin itong sagutan, pero walang points hanggang matapos ang pahinga.',
            'When you get a question right on your own, it rests for 3 days. You can still answer it, but it gives no points until the rest is over.'],
          ['✏️', 'I-type muna · Type it first', 'May kahon na ✏️? I-type muna ang sagot bago tumingin sa choices. Kapag tama, may 5 bonus points ka. Kapag mali, pumili lang sa choices.',
            'See a ✏️ box? Type the answer before you look at the choices. If it is right, you get 5 bonus points. If not, just pick from the choices.'],
          ['🏆', 'Mock Exam', 'Bawat tamang sagot sa Mock Exam = 20 points, doble ng lesson quiz!',
            'Every right answer in the Mock Exam = 20 points, double a lesson quiz!'],
          ['📝', 'Totoong test · Real test bonus', 'Ipakita kay Mommy o Tatay ang score mo sa totoong test sa school. Hanggang 50 coins: 50 kapag perfect, 40 kapag 90% pataas, 30 kapag 80% pataas, at 10 dahil sumubok ka.',
            'Show Mommy or Tatay your real test score from school. Up to 50 coins: 50 for a perfect score, 40 for 90% or more, 30 for 80% or more, and 10 for trying.'],
          ['★', 'Stars', 'Ang stars ay para sa araw na ito lang. Kinabukasan, simula ulit para makuha mo ulit. Hindi nawawala ang points at coins.',
            'Stars are for today only. Tomorrow they start fresh, so you can win them again. Your points and coins never disappear.'],
          ['🔒', 'Sa iyo lang · Just yours', 'Sa iyo lang ang coins mo, at nandito lang sila sa tablet na ito.',
            'Your coins belong only to you, and they stay on this tablet.']
        ];
      },
      close: 'Gets ko na! · Got it! 👍',
      badge: function (n) { return '🪙 ' + n + coinWord(n) + ' ❓'; },
      badgeLabel: 'How points and coins work',
      haveNow: function (n) { return '🪙 You now have ' + n + coinWord(n); }
    }
  };

  var UI_CSS =
    '.coins-badge{display:inline-flex;align-items:center;gap:6px;margin:10px 0 0 6px;padding:6px 14px;border-radius:999px;' +
      'border:2px solid #F2C94C;background:#FFF6D8;color:#6B4A00;font:inherit;font-size:.85rem;font-weight:800;cursor:pointer;}' +
    '.coins-badge:focus-visible,.cg-close:focus-visible{outline:3px solid #6B4A00;outline-offset:2px;}' +
    '.coins-live{margin-left:6px;white-space:nowrap;}' +
    '.coins-have{font-weight:800;margin-top:4px;}' +
    '.coin-guide{position:fixed;top:0;right:0;bottom:0;left:0;z-index:9999;display:flex;justify-content:center;align-items:flex-start;' +
      'overflow:auto;padding:16px;background:rgba(20,16,10,.55);}' +
    '.coin-guide[hidden]{display:none;}' +
    '.cg-box{width:100%;max-width:560px;margin:auto 0;background:#FFFDF6;color:#2B2320;border-radius:20px;padding:20px;' +
      'box-shadow:0 14px 40px rgba(0,0,0,.3);line-height:1.45;text-align:left;}' +
    '.cg-box h2{margin:0 0 6px;font-size:1.25rem;}' +
    '.cg-have{margin:0;font-size:1.4rem;font-weight:800;color:#8A5A00;}' +
    '.cg-goal{margin:2px 0 6px;font-weight:700;}' +
    '.cg-item{display:flex;gap:12px;align-items:flex-start;margin-top:8px;padding:10px 12px;background:#fff;' +
      'border:1px solid #EFE3C8;border-radius:14px;}' +
    '.cg-icon{flex:none;width:34px;font-size:1.6rem;line-height:1;text-align:center;}' +
    '.cg-item b{display:block;margin-bottom:2px;}' +
    '.cg-item p{margin:0;font-size:.95rem;}' +
    '.cg-item p.cg-en,.cg-title-en{margin-top:6px;font-size:.88rem;color:#6B5E57;}' +
    '.cg-title-en{margin:-2px 0 6px;font-weight:700;}' +
    '.cg-item .cg-en b{display:inline;margin:0;}' +
    '.cg-close{display:block;width:100%;margin-top:14px;padding:12px;border:0;border-radius:999px;background:#2E9E5B;' +
      'color:#fff;font:inherit;font-size:1rem;font-weight:800;cursor:pointer;}';

  // Fills every [data-coins] element ("badge" or "haveNow") and opens the guide
  // from any [data-coins-guide] element.
  function mountUi(win, wallet) {
    var doc = win.document, T = GUIDE_TEXT[wallet.grade];
    if (!T) return;
    var overlay = null, styled = false;

    function el(tag, cls, text) {
      var e = doc.createElement(tag);
      if (cls) e.className = cls;
      if (text !== undefined) e.textContent = text;
      return e;
    }

    function render() {
      var n = wallet.balanceStored();
      Array.prototype.forEach.call(doc.querySelectorAll('[data-coins]'), function (node) {
        var kind = node.getAttribute('data-coins');
        if (kind !== 'badge' && kind !== 'haveNow') return;
        node.textContent = T[kind](n);
        node.hidden = false;
        if (kind === 'badge') node.setAttribute('aria-label', T.have(n) + '. ' + T.badgeLabel);
      });
    }

    function hide() { if (overlay) overlay.hidden = true; }

    function addStyle() {
      if (styled) return;
      styled = true;
      doc.head.appendChild(el('style', '', UI_CSS));
    }

    function build() {
      addStyle();
      overlay = el('div', 'coin-guide');
      overlay.hidden = true;
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-labelledby', 'cg-title');
      var box = el('div', 'cg-box');
      var h = el('h2', '', T.title);
      h.id = 'cg-title';
      box.appendChild(h);
      if (T.titleEn) box.appendChild(el('p', 'cg-title-en', T.titleEn));
      box.appendChild(el('p', 'cg-have'));
      box.appendChild(el('p', 'cg-goal'));
      T.sections(findItem('ml').coins).forEach(function (s) {
        var item = el('div', 'cg-item');
        item.appendChild(el('div', 'cg-icon', s[0]));
        var body = el('div');
        body.appendChild(el('b', '', s[1]));
        body.appendChild(el('p', '', s[2]));
        if (s[3]) {
          var en = el('p', 'cg-en');
          en.appendChild(el('b', '', 'Sa English: '));
          en.appendChild(doc.createTextNode(s[3]));
          body.appendChild(en);
        }
        item.appendChild(body);
        box.appendChild(item);
      });
      var close = el('button', 'cg-close', T.close);
      close.type = 'button';
      close.addEventListener('click', hide);
      box.appendChild(close);
      overlay.appendChild(box);
      overlay.addEventListener('click', function (ev) { if (ev.target === overlay) hide(); });
      doc.body.appendChild(overlay);
    }

    function show() {
      if (!overlay) build();
      var n = wallet.balanceStored();
      overlay.querySelector('.cg-have').textContent = T.have(n);
      overlay.querySelector('.cg-goal').textContent = T.goal(Math.max(0, findItem('ml').coins - n));
      overlay.hidden = false;
      overlay.querySelector('.cg-close').focus();
    }

    function start() {
      addStyle();
      render();
    }

    doc.addEventListener('click', function (ev) {
      if (ev.target.closest && ev.target.closest('[data-coins-guide]')) show();
    });
    doc.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && overlay && !overlay.hidden) hide();
    });
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start);
    else start();

    wallet.renderCoins = render;
    wallet.showGuide = show;
    wallet.guideOpen = function () { return !!overlay && !overlay.hidden; };
    wallet.liveHtml = function () { return ' <span class="coins-live">🪙 ' + wallet.balanceStored() + '</span>'; };
  }

  var exported = { create: create, CATALOG: CATALOG, POWER_UPS: POWER_UPS, TEST_BONUS_TIERS: TEST_BONUS_TIERS, testBonus: testBonus, findItem: findItem, GUIDE_TEXT: GUIDE_TEXT };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  var script = root.document && root.document.currentScript;
  // A page with no grade (the parent page) only builds wallets of its own.
  if (!(script && script.getAttribute('data-grade'))) { root.Wallet = { create: create }; return; }
  try {
    root.Wallet = create(root.Learner ? root.Learner.storage : root.localStorage, Date.now, script ? script.getAttribute('data-grade') : null);
    root.Wallet.create = create;
    mountUi(root, root.Wallet);
  } catch (e) {}
})(this);
