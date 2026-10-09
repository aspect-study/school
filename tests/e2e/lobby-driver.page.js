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
  function visiblePanels() {
    return Array.prototype.filter.call(document.querySelectorAll('.p-panel[data-panel]'), function (p) { return !p.hidden; })
      .map(function (p) { return p.getAttribute('data-panel'); });
  }
  function focusSubjects() { return document.querySelectorAll('#focus .f-subject'); }
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

  if (mode === 'review') {
    var box = $('review-due');
    __store.removeItem('review_v1');
    box.hidden = false;
    Recall.renderLobby(box, document.querySelectorAll('.subject-card[data-app]'));
    r.newLearnerHidden = box.hidden;
    var card = document.querySelector('.subject-card[data-app]');
    var app = card.getAttribute('data-app');
    var key = function (x) { return x.getFullYear() + '-' + ('0' + (x.getMonth() + 1)).slice(-2) + '-' + ('0' + x.getDate()).slice(-2); };
    var later = new Date();
    later.setDate(later.getDate() + 2);
    var items = {};
    items[app + '|aa'] = { box: 1, due: key(new Date()), t: 1 };
    items[app + '|bb'] = { box: 2, due: key(later), t: 1 };
    __store.setItem('review_v1', JSON.stringify({ v: 1, items: items }));
    Recall.renderLobby(box, document.querySelectorAll('.subject-card[data-app]'));
    var chip = box.querySelector('.review-chip');
    r.first = { hidden: box.hidden, text: box.textContent, chips: box.querySelectorAll('.review-chip').length, href: chip && chip.getAttribute('href') };
    delete items[app + '|aa'];
    __store.setItem('review_v1', JSON.stringify({ v: 1, items: items }));
    Recall.renderLobby(box, document.querySelectorAll('.subject-card[data-app]'));
    r.caughtUp = { hidden: box.hidden, text: box.textContent };
    __store.setItem('review_v1', JSON.stringify({ v: 1, items: {} }));
    Recall.renderLobby(box, document.querySelectorAll('.subject-card[data-app]'));
    r.emptyHidden = box.hidden;
    r.cardHref = card.getAttribute('href');
    return out(r);
  }

  if (mode === 'map') {
    var mcard = document.querySelector('.subject-card[data-app]'), mapp = mcard.getAttribute('data-app'), apps = {};
    apps[mapp] = { t: 1, order: ['x', 'y'], lessons: {
      x: { title: 'Lesson X', icon: '', now: 3, best: 3, paid: 3 },
      y: { title: 'Lesson Y', icon: '', now: 1, best: 2, paid: 2 } } };
    __store.setItem('mastery_v1', JSON.stringify({ v: 1, apps: apps }));
    r.buttonHidden = $('map-open').hidden;
    $('map-open').click();
    var view = $('map-view'), mrow = view.querySelector('.map-row[data-app="' + mapp + '"]');
    r.viewHidden = view.hidden;
    r.expanded = $('map-open').getAttribute('aria-expanded');
    r.tiles = Array.prototype.map.call(mrow.querySelectorAll('.map-tile'), function (t) { return { text: t.textContent, href: t.getAttribute('href') }; });
    r.count = mrow.querySelector('.map-count').textContent;
    r.empty = view.querySelectorAll('.map-empty').length;
    r.rows = view.querySelectorAll('.map-row').length;
    r.cards = document.querySelectorAll('.subject-card[data-app]').length;
    r.cardHref = mcard.getAttribute('href');
    $('map-open').click();
    r.closed = view.hidden;
    return out(r);
  }
  if (mode === 'quests') {
    var qcard = document.querySelector('.subject-card[data-app]'), qapp = qcard.getAttribute('data-app');
    var qkey = function (x) { return x.getFullYear() + '-' + ('0' + (x.getMonth() + 1)).slice(-2) + '-' + ('0' + x.getDate()).slice(-2); };
    var qitems = {};
    qitems[qapp + '|aa'] = { box: 1, due: qkey(new Date()), t: 1 };
    __store.setItem('review_v1', JSON.stringify({ v: 1, items: qitems }));
    __store.removeItem('quests_v1');
    __store.setItem(KEY, JSON.stringify({ v: 1, entries: [] }));
    var qcards = Array.prototype.map.call(document.querySelectorAll('.subject-card[data-app]'), function (c) {
      return { app: c.getAttribute('data-app'), title: c.getAttribute('data-app'), href: c.getAttribute('href') };
    });
    Quests.pick(qcards);
    Quests.renderLobby($('quests'), qcards);
    r.hidden = $('quests').hidden;
    r.items = Array.prototype.map.call($('quests').querySelectorAll('li'), function (li) { return li.textContent; });
    var link = $('quests').querySelector('li a');
    r.firstHref = link ? link.getAttribute('href') : null;
    r.cardHref = qcard.getAttribute('href');
    r.streakBefore = $('quests').querySelector('.quests-streak').textContent;
    var bonusBefore = (JSON.parse(__store.getItem('wallet_v1') || '{}').bonus) || 0;
    var t = Date.now() + 1000, n = 0;
    var entry = function (f) { var e = { id: 'qe' + (n++), type: 'quiz', app: qapp, appTitle: qapp, lessonId: 'l', lessonTitle: 'L', final: false, total: 10, answered: 10, correct: 10, wrong: [], finished: true, stars: 3, points: 0, bestStreak: 0, t: t + n }; for (var k in f) e[k] = f[k]; return e; };
    __store.setItem(KEY, JSON.stringify({ v: 1, entries: [entry({ kind: 'review', lessonTitle: 'Review', stars: 0 }), entry({}), entry({ correct: 12 })] }));
    r.events = Quests.check().map(function (e) { return { big: e.big, icon: e.icon }; });
    r.again = Quests.check().length;
    r.bonusPaid = ((JSON.parse(__store.getItem('wallet_v1') || '{}').bonus) || 0) - bonusBefore;
    Quests.renderLobby($('quests'), qcards);
    r.doneCount = $('quests').querySelectorAll('li .done').length;
    r.streakAfter = $('quests').querySelector('.quests-streak').textContent;
    var bonusDone = ((JSON.parse(__store.getItem('wallet_v1') || '{}').bonus) || 0);
    document.dispatchEvent(new Event('cloud-synced'));
    document.dispatchEvent(new Event('cloud-synced'));
    r.bonusAfterSync = ((JSON.parse(__store.getItem('wallet_v1') || '{}').bonus) || 0) - bonusDone;
    r.queuedAfterSync = ((window.Fx && Fx.queued && Fx.queued()) || []).length;
    return out(r);
  }
  if (mode === 'boss') {
    var bcards = Array.prototype.map.call(document.querySelectorAll('.subject-card[data-app]'), function (c) {
      return { app: c.getAttribute('data-app'), href: c.getAttribute('href') };
    });
    var bday = function (x) { return x.getFullYear() + '-' + ('0' + (x.getMonth() + 1)).slice(-2) + '-' + ('0' + x.getDate()).slice(-2); };
    var bitems = {};
    for (var bi = 0; bi < 4; bi++) bitems[bcards[0].app + '|a' + bi] = { box: 1, due: bday(new Date()), t: 1 };
    for (var bj = 0; bj < 3; bj++) bitems[bcards[1].app + '|b' + bj] = { box: 1, due: bday(new Date()), t: 1 };
    __store.setItem('review_v1', JSON.stringify({ v: 1, items: bitems }));
    __store.removeItem('boss_v1');
    var bcoins = function () { return (JSON.parse(__store.getItem('wallet_v1') || '{}').bonus) || 0; };
    document.dispatchEvent(new Event('cloud-synced'));
    r.hidden = $('boss').hidden;
    r.stages = JSON.parse(__store.getItem('boss_v1')).stages.map(function (s) { return s.app; });
    r.expect = [bcards[0].app, bcards[1].app];
    var blink = $('boss').querySelector('.boss-list a');
    r.firstHref = blink ? blink.getAttribute('href') : null;
    r.cardHref = bcards[0].href;
    r.rows = $('boss').querySelectorAll('.boss-list li').length;
    var before = bcoins();
    Boss.stageResult(bcards[0].app, 3, 3);
    var bbeat = Boss.stageResult(bcards[1].app, 2, 3).filter(function (e) { return e.big; });
    r.beat = bbeat.length;
    r.beatArt = /^<svg /.test((bbeat[0] || {}).art || '');
    r.beatWho = (bbeat[0] || {}).who || '';
    r.coins = bcoins() - before;
    document.dispatchEvent(new Event('cloud-synced'));
    r.title = $('boss').querySelector('.boss-title').textContent;
    r.links = $('boss').querySelectorAll('.boss-list a').length;
    r.coinsAfterSync = bcoins() - before;
    return out(r);
  }
  if (mode === 'campus') {
    var wcards = document.querySelectorAll('.subject-card[data-app]');
    var first = wcards[0].getAttribute('data-app'), second = wcards[1].getAttribute('data-app');
    var campus = $('campus'), grid = document.querySelector('.grid'), toggle = $('campus-toggle');
    var place = function (id) { return campus.querySelector('[data-place="' + id + '"]'); };
    var marks = function (id) { return Array.prototype.map.call(place(id).querySelectorAll('.w-marker text'), function (t) { return t.textContent; }); };
    var tap = function (el) { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); };
    var world = function () { return JSON.parse(__store.getItem('world_v1') || 'null'); };
    var remount = function () { World.mount(campus, grid, toggle); };
    var buddyAt = function () { return campus.querySelector('.w-avatar').getAttribute('transform'); };
    r.firstApp = first;
    r.campusShown = !campus.hidden;
    r.gridHidden = grid.hidden;
    r.toggleShown = !toggle.hidden;
    r.toggleText = toggle.textContent;
    r.buildings = campus.querySelectorAll('.w-game').length;
    r.cards = wcards.length;
    r.pickerOpen = !campus.querySelector('.w-picker').hidden;
    campus.querySelector('[data-pick="owl"]').click();
    r.avatar = world().avatar;
    r.buddy = campus.querySelector('.w-avatar text').textContent;
    r.pickerAfter = !campus.querySelector('.w-picker').hidden;
    var wday = function (x) { return x.getFullYear() + '-' + ('0' + (x.getMonth() + 1)).slice(-2) + '-' + ('0' + x.getDate()).slice(-2); };
    var witems = {};
    for (var wi = 0; wi < 3; wi++) witems[first + '|w' + wi] = { box: 1, due: wday(new Date()), t: 1 };
    __store.setItem('review_v1', JSON.stringify({ v: 1, items: witems }));
    __store.setItem('quests_v1', JSON.stringify({ v: 1, day: wday(new Date()), at: 1, list: [{ kind: 'explore', app: second, title: 'Second', done: false }], days: [], paidDay: '', streakPaid: [] }));
    __store.setItem('boss_v1', JSON.stringify({ v: 1, week: Boss.weekKey(Date.now()), stages: [{ app: second, title: 'Second', cleared: false }, { app: first, title: 'First', cleared: true }], paid: [] }));
    remount();
    r.firstMarks = marks(first);
    r.secondMarks = marks(second);
    r.arenaSub = campus.querySelector('.w-arena .w-sub').textContent;
    r.firstLabel = place(first).getAttribute('aria-label');
    var went = null;
    World.walkMs = 0;
    World.navigate = function (href) { went = href; };
    r.atGate = buddyAt();
    tap(place(first));
    r.went = went;
    r.cardHref = wcards[0].getAttribute('href');
    r.savedAt = world().at;
    r.afterWalk = buddyAt();
    remount();
    r.afterReturn = buddyAt();
    tap(place('shop'));
    r.shopOpen = !$('shop-overlay').hidden;
    $('shop-close').click();
    tap(toggle);
    r.listGridShown = !grid.hidden;
    r.listCampusHidden = campus.hidden;
    r.listToggle = toggle.textContent;
    r.savedView = world().view;
    remount();
    r.listAfterReload = !grid.hidden && campus.hidden;
    return out(r);
  }
  if (mode === 'nojs') {
    r.gridShownNoWorld = !document.querySelector('.grid').hidden;
    r.campusHiddenNoWorld = $('campus').hidden;
    r.toggleHiddenNoWorld = $('campus-toggle').hidden;
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

  r.rows30 = rows();
  r.summary30 = $('hist-summary').textContent;
  r.panelsAtOpen = visiblePanels();
  r.focusHeads = Array.prototype.map.call(focusSubjects(), function (d) { return d.querySelector('.f-head').textContent; });
  r.focusFirstOpen = focusSubjects()[0].open;
  r.focusQuestions = Array.prototype.map.call(focusSubjects()[0].querySelectorAll('.f-question'), function (q) { return q.textContent; });
  r.focusChips = document.querySelectorAll('#focus .f-chip').length;
  var fs = focusSubjects();
  fs[0].open = false;
  fs[1].open = true;
  document.querySelector('#range-buttons .p-btn.on').click();
  fs = focusSubjects();
  r.keptClosed = !fs[0].open;
  r.keptOpen = fs[1].open;
  fs[0].open = true;
  fs[1].open = false;
  r.detailsCount = document.querySelectorAll('#hist-list details').length;
  r.detailsText = document.querySelector('#hist-list details').textContent;

  document.querySelector('#range-buttons [data-range="all"]').click();
  r.rowsAll = rows();
  r.allText = $('hist-list').textContent;
  r.focusWeakAll = document.querySelectorAll('#focus .f-lesson').length;
  var seeded = __store.getItem(KEY), withWeak = JSON.parse(seeded), seededReview = __store.getItem('review_v1');
  var seededPractice = __store.getItem('practice_v1');
  var restore = function (k, v) { if (v === null) __store.removeItem(k); else __store.setItem(k, v); };
  withWeak.entries.push({ id: 'w', type: 'quiz', app: APPS[0], appTitle: 'X', lessonTitle: 'Verbs', total: 10, answered: 10, correct: 4,
    finished: true, stars: 0, points: 40, bestStreak: 1, t: at(0, 8, 0), updatedAt: at(0, 8, 5),
    wrong: [{ q: 'Pick the adjective', picked: 'run', answer: 'red', key: 'k-adj', t: at(0, 8, 1) },
      { q: 'Pick the pronoun', picked: 'cat', answer: 'she', key: 'k-pro', t: at(0, 8, 2) }] });
  __store.setItem(KEY, JSON.stringify(withWeak));
  __store.setItem('review_v1', JSON.stringify({ v: 1, items: {
    'k-adj': { box: 2, due: '2099-01-01', t: at(0, 8, 3) },
    'k-pro': { box: 1, due: '2099-01-01', t: at(0, 8, 2) }
  } }));
  document.querySelector('#range-buttons [data-range="all"]').click();
  r.weakList = Array.prototype.map.call(focusSubjects()[0].querySelectorAll('.f-lesson'), function (li) { return li.textContent; });
  r.fixedChip = Array.prototype.map.call(document.querySelectorAll('#focus .f-chip'), function (c) { return c.textContent; }).sort();
  r.fixedFolded = focusSubjects()[0].querySelector('.f-more summary').textContent;
  r.todayKey = window.StudyHistory.dateKey(Date.now());
  r.adjSeeded = JSON.parse(__store.getItem('review_v1')).items['k-adj'];
  r.practiceLabel = focusSubjects()[0].querySelector('.f-practice-btn').textContent;
  var sendsBefore = Object.keys((JSON.parse(__store.getItem('practice_v1') || 'null') || { sends: {} }).sends);
  focusSubjects()[0].querySelector('.f-practice-btn').click();
  var practiceAfter = JSON.parse(__store.getItem('practice_v1') || 'null');
  r.practiceSends = practiceAfter ? Object.keys(practiceAfter.sends).filter(function (id) { return sendsBefore.indexOf(id) < 0; })
    .map(function (id) { return practiceAfter.sends[id]; }) : [];
  var rv = JSON.parse(__store.getItem('review_v1')).items;
  r.practiceDue = rv['k-pro'];
  r.adjAfter = rv['k-adj'];
  r.practiceAfter = focusSubjects()[0].querySelector('.f-practice').textContent;
  r.practiceKeptOpen = focusSubjects()[0].open;
  __store.setItem(KEY, seeded);
  restore('review_v1', seededReview);
  restore('practice_v1', seededPractice);

  // This week: Monday 00:00 to now. On Monday "this week" is today only, so this week's seeds sit just after midnight.
  var dow = (new Date().getDay() + 6) % 7, lastWeek = dow + 3, thisWeek = at(0, 0, 1);
  __store.setItem(KEY, JSON.stringify({ v: 1, entries: [
    { id: 'wk1', type: 'quiz', app: APPS[0], appTitle: 'X', lessonTitle: 'Nouns', total: 10, answered: 10, correct: 8,
      finished: true, stars: 2, points: 80, bestStreak: 3, wrong: [], t: thisWeek, updatedAt: thisWeek },
    { id: 'wk2', type: 'quiz', app: APPS[0], appTitle: 'X', lessonTitle: 'Verbs', total: 10, answered: 10, correct: 6,
      finished: true, stars: 1, points: 60, bestStreak: 2, t: at(lastWeek, 10, 0), updatedAt: at(lastWeek, 10, 5),
      wrong: [{ q: 'Pick the verb', picked: 'cat', answer: 'run', key: 'k-wk', t: at(lastWeek, 10, 1) }] },
    { id: 'wk3', type: 'quiz', app: APPS[1], appTitle: 'Y', lessonTitle: 'Z', total: 10, answered: 10, correct: 7,
      finished: true, stars: 1, points: 70, bestStreak: 2, wrong: [], t: at(lastWeek, 11, 0), updatedAt: at(lastWeek, 11, 5) }
  ] }));
  __store.setItem('review_v1', JSON.stringify({ v: 1, items: {
    'k-wk': { box: 2, due: '2099-01-01', t: thisWeek + 60000 },
    'k-still': { box: 1, due: '2099-01-01', t: thisWeek + 60000 }
  } }));
  __store.setItem('practice_v1', JSON.stringify({ v: 1, sends: { 'wk-send': { t: thisWeek, app: APPS[0], keys: ['k-wk', 'k-still'] } } }));
  document.querySelector('#range-buttons .p-btn.on').click();
  var week = $('week');
  r.weekFirst = week && week.parentNode.firstElementChild === week && week.parentNode.getAttribute('data-panel');
  r.weekRows = week ? Array.prototype.map.call(week.querySelectorAll('.w-row'), function (row) {
    return { name: row.querySelector('.w-name').textContent, stat: row.querySelector('.w-stat').textContent,
      chip: (row.querySelector('.w-up, .w-down, .w-same') || {}).className || '' };
  }) : [];
  r.weekFixed = week ? week.querySelector('.w-fixed').textContent : '';
  r.weekSends = week ? Array.prototype.map.call(week.querySelectorAll('.w-send'), function (x) { return x.textContent; }) : [];
  __store.setItem(KEY, JSON.stringify({ v: 1, entries: [] }));
  __store.removeItem('practice_v1');
  document.querySelector('#range-buttons .p-btn.on').click();
  r.weekEmpty = week ? week.textContent : '';
  __store.setItem(KEY, seeded);
  restore('review_v1', seededReview);
  restore('practice_v1', seededPractice);
  document.querySelector('#range-buttons [data-range="all"]').click();
  change('subject-filter', APPS[1]);
  r.rowsKuwentista = rows();
  change('subject-filter', '');
  r.subjectOptions = $('subject-filter').options.length;
  document.querySelector('#p-tabs [data-tab="subjects"]').click();
  r.panelsSubjects = visiblePanels();
  r.subjectRows = document.querySelectorAll('#subjects-list .f-subject').length;
  r.subjectsTabOn = document.querySelector('#p-tabs [data-tab="subjects"]').getAttribute('aria-selected');

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
  press('0108');
  r.panelsAfterReopen = visiblePanels();
  $('parent-close').click();

  localStorage.setItem(OTHER_WALLET, 'untouched');
  __store.setItem(r.baselineKeys[0], '6000');
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
