(function () {
  var $ = function (id) { return document.getElementById(id); };
  var KEY = __E2E_KEY;
  var APPS = __E2E_APPS;
  var WALLET = __E2E_WALLET;
  var OTHER_WALLET = __E2E_OTHER_WALLET;

  function out(obj) {
    obj.errors = window.__e2eErrors || [];
    var pre = document.createElement('pre');
    pre.id = 'e2e-out';
    pre.textContent = JSON.stringify(obj);
    document.body.appendChild(pre);
  }
  function at(daysAgo, h, m) {
    var d = new Date();
    d.setDate(d.getDate() - daysAgo);
    d.setHours(h, m, 0, 0);
    return d.getTime();
  }
  function press(digits, pad) {
    digits.split('').forEach(function (ch) {
      Array.prototype.filter.call($(pad || 'pin-pad').querySelectorAll('button'), function (b) {
        return b.textContent === ch;
      })[0].click();
    });
  }
  function rows() { return document.querySelectorAll('#hist-list .h-item').length; }
  function change(id, value) { $(id).value = value; $(id).dispatchEvent(new Event('change')); }

  var mode = (location.hash.match(/e2e=(\w+)/) || [])[1];
  var r = {};
  function wallet() { return JSON.parse(__store.getItem(WALLET)); }
  function shopRow(id) { return document.querySelector('#shop-items [data-item="' + id + '"]'); }

  if (mode === 'testscore') {
    $('parent-open').click();
    press('0108');
    r.shown = !$('test-score').hidden;
    r.subjects = $('ts-subject').options.length;
    var fill = function (name, score, total) {
      $('ts-name').value = name;
      $('ts-score').value = score;
      $('ts-total').value = total;
      $('ts-total').dispatchEvent(new Event('input'));
    };
    fill('Science ST1', '14', '15');
    r.preview = $('ts-add').textContent;
    $('ts-add').click();
    r.bonusAfterFirst = wallet().bonus;
    r.listed = /📝 Real test · .* · Science ST1 — 14\/15 · \+40 coins/.test($('hist-list').textContent);
    fill('science st1', '15', '15');
    $('ts-add').click();
    r.dupWarning = $('ts-msg').textContent;
    r.bonusAfterWarn = wallet().bonus;
    $('ts-add').click();
    r.bonusAfterSecond = wallet().bonus;
    fill('Bad', '16', '15');
    r.badDisabled = $('ts-add').disabled;
    r.entries = JSON.parse(__store.getItem(KEY)).entries.filter(function (e) { return e.type === 'test'; }).length;
    r.shopEarned = $('shop-earned').textContent;
    return out(r);
  }

  if (mode === 'nojs') {
    $('parent-open').click();
    press('0108');
    r.missingShown = !$('history-missing').hidden;
    r.bodyHidden = $('history-body').hidden;
    r.coinRowHidden = $('coin-row').hidden;
    return out(r);
  }

  r.coinRowShown = !$('coin-row').hidden;
  r.coinBadge0 = $('coin-badge').textContent;
  r.baselineKeys = Object.keys(wallet().baselines).sort();
  r.guideAutoShown = !!(window.Wallet && Wallet.guideOpen());
  r.guideSeen = __store.getItem('coin_guide_seen_v1');
  document.querySelector('.coin-guide .cg-close').click();
  r.guideClosed = !Wallet.guideOpen();
  r.guideButton = $('coin-guide-open').textContent;

  __store.setItem(KEY, JSON.stringify({ v: 1, entries: [
    { id: 'a', type: 'open', app: APPS[0], appTitle: 'Word Train', t: at(0, 9, 0) },
    { id: 'b', type: 'quiz', app: APPS[0], appTitle: 'Word Train', lessonId: '0', lessonTitle: 'Nouns', final: false,
      total: 10, answered: 10, correct: 8, finished: true, stars: 2, points: 95, bestStreak: 5,
      powerUps: [{ kind: 'hint', coins: 3, q: 'Pick the noun' }, { kind: 'mommy', coins: 4, q: 'Pick the verb' }],
      wrong: [{ q: 'Pick the noun', picked: 'run', answer: 'cat' }, { q: 'Pick the verb', picked: 'cat', answer: 'run' }],
      t: at(0, 9, 5), updatedAt: at(0, 9, 9) },
    { id: 'c', type: 'lesson', app: APPS[1], appTitle: 'Kuwentista', lessonId: 'x', lessonTitle: 'Pangngalan',
      cardsTotal: 8, cardsViewed: 6, t: at(3, 16, 0), updatedAt: at(3, 16, 4) },
    { id: 'd', type: 'quiz', app: APPS[1], appTitle: 'Kuwentista', lessonId: 'final', lessonTitle: 'Pangwakas', final: true,
      total: 21, answered: 4, correct: 3, finished: false, stars: 0, points: 0, bestStreak: 0,
      wrong: [{ q: 'Q', picked: 'A', answer: 'B' }], t: at(40, 10, 0), updatedAt: at(40, 10, 3) },
    { id: 'e', type: 'quiz', kind: 'walkthrough', app: APPS[1], appTitle: 'Math Mastery', lessonTitle: 'Dough problem',
      total: 5, answered: 5, correct: 4, finished: true, stars: 0, points: 50, bestStreak: 3,
      wrong: [{ q: 'Plan: What is your plan?', picked: 'Add', answer: 'Divide' }],
      t: at(1, 9, 0), updatedAt: at(1, 9, 7) },
    { id: 'f', type: 'quiz', kind: 'case', app: APPS[1], appTitle: 'Math Mastery', lessonTitle: 'Bibingka at the Fiesta',
      total: 3, answered: 1, correct: 1, finished: false, stars: 0, points: 0, bestStreak: 1,
      wrong: [], powerUps: [{ kind: 'later', coins: 2, q: 'Q1' }], t: at(1, 15, 0), updatedAt: at(1, 15, 5) }
  ] }));

  $('parent-open').click();
  r.overlayOpen = !$('parent-overlay').hidden;
  press('1234');
  r.wrongPinLocked = $('history-view').hidden;
  press('0108');
  r.unlocked = !$('history-view').hidden && $('pin-view').hidden;

  Object.defineProperty(document, 'hidden', { configurable: true, get: function () { return true; } });
  document.dispatchEvent(new Event('visibilitychange'));
  r.hiddenRelocked = $('parent-overlay').hidden;
  delete document.hidden;
  $('parent-open').click();
  press('0108');
  r.reunlocked = !$('parent-overlay').hidden && !$('history-view').hidden;

  r.missingHidden = $('history-missing').hidden;

  r.rows7 = rows();
  r.summary7 = $('hist-summary').textContent;
  r.detailsCount = document.querySelectorAll('#hist-list details').length;
  r.detailsText = document.querySelector('#hist-list details').textContent;

  document.querySelector('#range-buttons [data-range="all"]').click();
  r.rowsAll = rows();
  r.allText = $('hist-list').textContent;
  r.weakAll = $('weak-spots').textContent;
  var seeded = __store.getItem(KEY), withWeak = JSON.parse(seeded);
  withWeak.entries.push({ id: 'w', type: 'quiz', app: APPS[0], appTitle: 'X', lessonTitle: 'Verbs', total: 10, answered: 10, correct: 4,
    finished: true, stars: 0, points: 40, bestStreak: 1, wrong: [], t: at(0, 8, 0), updatedAt: at(0, 8, 5) });
  __store.setItem(KEY, JSON.stringify(withWeak));
  document.querySelector('#range-buttons [data-range="all"]').click();
  r.weakList = Array.prototype.map.call(document.querySelectorAll('#weak-spots li'), function (li) { return li.textContent; });
  __store.setItem(KEY, seeded);
  document.querySelector('#range-buttons [data-range="all"]').click();
  change('subject-filter', APPS[1]);
  r.rowsKuwentista = rows();
  change('subject-filter', '');
  r.subjectOptions = $('subject-filter').options.length;

  window.confirm = function () { return true; };
  var day3 = window.StudyHistory.dateKey(at(3, 12, 0));
  $('del-from').value = day3;
  $('del-to').value = day3;
  $('delete-range').click();
  r.afterRange = JSON.parse(__store.getItem(KEY)).entries.map(function (e) { return e.id; }).join(',');
  r.deleteMsg = $('delete-msg').textContent;
  $('delete-all').click();
  r.afterAll = __store.getItem(KEY);

  $('parent-close').click();
  r.closed = $('parent-overlay').hidden;
  $('parent-open').click();
  r.relocked = !$('pin-view').hidden && $('history-view').hidden;
  $('parent-close').click();

  localStorage.setItem(OTHER_WALLET, 'untouched');
  __store.setItem(r.baselineKeys[0], '3000');
  $('shop-open').click();
  r.shopOpen = !$('shop-overlay').hidden;
  r.shopCoins = $('shop-coins').textContent;
  r.shopGoal = $('shop-goal').textContent;
  r.movieNeed = shopRow('movie').querySelector('.shop-need').textContent;
  r.mlBuyable = !!shopRow('ml').querySelector('[data-buy]');
  r.mlHasNote = !!shopRow('ml').querySelector('.shop-note');
  r.allItems = document.querySelectorAll('#shop-items [data-item]').length;
  var search = $('shop-search');
  search.value = 'TATAY';
  search.dispatchEvent(new Event('input'));
  r.tatayItems = Array.prototype.map.call(document.querySelectorAll('#shop-items [data-item]'), function (e) { return e.getAttribute('data-item'); });
  search.value = 'zzz';
  search.dispatchEvent(new Event('input'));
  r.noMatchShown = !$('shop-empty').hidden && $('shop-empty').textContent.indexOf('zzz') >= 0;
  search.value = '';
  search.dispatchEvent(new Event('input'));
  r.allBack = document.querySelectorAll('#shop-items [data-item]').length;
  shopRow('ml').querySelector('[data-buy]').click();
  r.pinShown = !$('shop-pin-view').hidden;
  press('1234', 'shop-pin-pad');
  r.wrongPinSpent = wallet().spent;
  r.wrongPinStays = !$('shop-pin-view').hidden;
  press('0108', 'shop-pin-pad');
  r.doneText = $('shop-done').textContent;
  r.badgeAfter = $('coin-badge').textContent;
  r.spentAfter = wallet().spent;
  r.pointsAfter = __store.getItem(r.baselineKeys[0]);
  $('shop-back').click();
  r.mlAfter = shopRow('ml').querySelector('.shop-need').textContent;
  r.earnedText = $('shop-earned').textContent;
  shopRow('dinner').querySelector('[data-buy]').click();
  $('shop-cancel').click();
  r.cancelSpent = wallet().spent;
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  r.escClosed = $('shop-overlay').hidden;
  r.otherWallet = localStorage.getItem(OTHER_WALLET);
  r.purchaseLogged = JSON.parse(__store.getItem(KEY)).entries
    .filter(function (e) { return e.type === 'purchase'; })
    .map(function (e) { return { item: e.item, coins: e.coins }; });
  $('parent-open').click();
  press('0108');
  r.parentList = $('hist-list').textContent;
  var realClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () { r.shopDownload = this.download; };
  $('export-shop').click();
  HTMLAnchorElement.prototype.click = realClick;
  r.today = window.StudyHistory.dateKey(Date.now());
  out(r);
})();
