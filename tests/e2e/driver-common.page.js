function __e2eOut(obj) {
  obj.errors = window.__e2eErrors || [];
  var pre = document.createElement('pre');
  pre.id = 'e2e-out';
  pre.textContent = JSON.stringify(obj);
  document.body.appendChild(pre);
}

function __e2eHistory() {
  try { return (JSON.parse(__store.getItem(__E2E_KEY)) || { entries: [] }).entries; }
  catch (e) { return 'unparseable'; }
}

function __e2eMode() {
  return (location.hash.match(/e2e=(\w+)/) || [])[1];
}

function __e2eSeed() {
  __store.setItem(__E2E_KEY, JSON.stringify({
    v: 1, entries: [{ id: 'seed-1', type: 'open', app: 'seed', appTitle: 'Seed', t: 1 }]
  }));
  var baselines = {};
  baselines[kit.pointsKey] = 0;
  __store.setItem(__E2E_WALLET_KEY, JSON.stringify({ v: 1, baselines: baselines, spent: 0, purchases: [], oldPointsCounted: true }));
  __e2eOut({ seeded: true });
}

var __e2eExplore = { taps: 0, empty: 0 };
function __e2eExploreAll(btnSelector, boxId) {
  var btns = document.querySelectorAll(btnSelector);
  for (var i = 0; i < btns.length; i++) {
    if (btns[i].disabled) continue;
    btns[i].click();
    __e2eExplore.taps++;
    var why = document.querySelector('#' + boxId + ' .explore-card .learn-why');
    if (!why || !why.textContent.trim() || /not the right answer\.$|Hindi ito ang tamang sagot\.$/.test(why.textContent)) __e2eExplore.empty++;
  }
}

function __e2eCoins() {
  var pts = parseInt(__store.getItem(kit.pointsKey), 10) || 0;
  var badge = document.querySelector('[data-coins="badge"]');
  var have = document.querySelector('[data-coins="haveNow"]');
  var live = document.querySelector('.points-live .coins-live');
  badge.click();
  var open = !!(window.Wallet && Wallet.guideOpen());
  var close = document.querySelector('.coin-guide .cg-close');
  if (close) close.click();
  return {
    expected: 40 + Math.floor(pts / 10), badge: badge.textContent, have: have.textContent,
    live: live ? live.textContent : '', guideOpened: open, guideClosed: !(window.Wallet && Wallet.guideOpen())
  };
}

function __e2eSpent() {
  return (JSON.parse(__store.getItem(__E2E_WALLET_KEY)) || {}).spent || 0;
}

function __e2ePu(kind) {
  var b = document.querySelector('.pu-bar [data-pu="' + kind + '"]');
  if (!b || b.disabled || b.closest('[hidden]')) return false;
  b.click();
  b.click();
  return true;
}

function __e2ePowerUps(startLesson, next, startExam) {
  var r = { used: [], helpedPoints: [], outCounts: [], streakKept: true, tipShown: true, outReenabled: true, maxBlocked: null };
  var spent0 = __e2eSpent();
  startLesson();
  var n = currentQuizSet.length;
  for (var k = 0; k < n; k++) {
    var here = [];
    if (r.used.length === 2 && r.maxBlocked === null) r.maxBlocked = !__e2ePu('hint') && !__e2ePu('fifty');
    if (r.used.length < 2 && __e2ePu('fifty')) {
      here.push('fifty');
      r.outCounts.push(document.querySelectorAll('.pu-out').length);
    }
    if (r.used.length + here.length < 2 && __e2ePu('hint')) {
      here.push('hint');
      var tip = document.querySelector('.pu-tip');
      if (!tip || tip.hidden || !tip.textContent.trim()) r.tipShown = false;
    }
    var streak0 = kit.streak(), points0 = kit.sessionPoints();
    __e2eAnswer(true);
    if (here.length) {
      r.helpedPoints.push(kit.sessionPoints() - points0);
      if (kit.streak() !== streak0) r.streakKept = false;
      if (document.querySelector('.pu-out:disabled')) r.outReenabled = false;
    }
    r.used = r.used.concat(here);
    next();
  }
  r.spent = __e2eSpent() - spent0;
  r.prices = Wallet.powerUps;
  startExam();
  var bar = document.querySelector('.pu-bar');
  r.examNote = bar && !bar.hidden ? bar.textContent : '';
  r.examBlocked = !__e2ePu('hint') && !__e2ePu('fifty');
  __e2eOut({ pu: r, entries: __e2eHistory() });
}

function __e2eIdx() { return typeof qIdx !== 'undefined' ? qIdx : quizIdx; }
function __e2eRightIdx() {
  var q = currentQuizSet[__e2eIdx()];
  return typeof q.correct === 'number' ? q.correct : q.options.findIndex(function (o) { return o.correct; });
}
function __e2eOptionButtons() {
  var bar = document.querySelector('.pu-bar');
  return bar && bar.nextElementSibling ? bar.nextElementSibling.querySelectorAll('button') : [];
}

function __e2ePowerUps2(startLesson, next) {
  var r = { later: null, second: null, shield: null, used: [] };
  var spent0 = __e2eSpent();

  startLesson();
  var n = currentQuizSet.length;
  var first = currentQuizSet[__e2eIdx()];
  if (__e2ePu('later')) {
    r.used.push('later');
    r.later = { movedToEnd: currentQuizSet[n - 1] === first, sameLength: currentQuizSet.length === n, nextShown: currentQuizSet[__e2eIdx()] !== first,
      note: document.querySelector('.pu-bar .pu-note').textContent };
  }
  for (var k = 0; k < n; k++) {
    if (!r.second && __e2ePu('second')) {
      r.used.push('second');
      var right = __e2eRightIdx(), btns = __e2eOptionButtons(), points0 = kit.sessionPoints();
      btns[(right + 1) % btns.length].click();
      r.second = { tried: btns[(right + 1) % btns.length].classList.contains('pu-tried'), stillOpen: !Array.prototype.some.call(btns, function (b) { return b.classList.contains('correct'); }),
        noPoints: kit.sessionPoints() === points0 };
      btns[right].click();
      r.second.helpedPoints = kit.sessionPoints() - points0;
    } else {
      __e2eAnswer(true);
    }
    next();
  }

  startLesson();
  __e2eAnswer(true); next();
  __e2eAnswer(true); next();
  if (__e2ePu('shield')) {
    r.used.push('shield');
    var before = kit.streak();
    __e2eAnswer(false);
    r.shield = { before: before, after: kit.streak(), note: document.querySelector('.pu-bar .pu-note').textContent };
  }
  r.spent = __e2eSpent() - spent0;
  r.prices = Wallet.powerUps;
  __e2eOut({ pu: r, entries: __e2eHistory() });
}

function __e2eVisible(sel) {
  var e = document.querySelector(sel);
  return !!e && !e.closest('[hidden]');
}

function __e2ePowerUps3(startLesson, startExam) {
  var r = {};
  var spent0 = __e2eSpent();
  startLesson();
  document.querySelector('.pu-bar [data-pu="family"]').click();
  r.helpers = ['ate', 'mommy', 'tatay'].filter(function (h) { return __e2eVisible('.pu-bar [data-pu="' + h + '"]'); });
  r.askedMommy = __e2ePu('mommy');
  r.card = __e2eVisible('.pu-ask') ? document.querySelector('.pu-ask').textContent : '';
  r.noCancel = !document.querySelector('.pu-ask button');
  r.tatayBlocked = !__e2ePu('tatay');
  var points0 = kit.sessionPoints();
  __e2eAnswer(true);
  r.helpedPoints = kit.sessionPoints() - points0;
  r.cardAfterAnswer = __e2eVisible('.pu-ask');
  r.spent = __e2eSpent() - spent0;
  r.prices = Wallet.powerUps;
  startLesson();
  document.querySelector('.pu-bar [data-pu="family"]').click();
  __e2ePu('mommy');
  startExam();
  r.examShowsAsk = __e2eVisible('.pu-ask');
  r.examShowsPicker = __e2eVisible('.pu-pick');
  __e2eOut({ pu: r, entries: __e2eHistory() });
}

function __e2eTypedLesson(list) {
  for (var i = 0; i < list.length; i++) {
    if ((list[i].quiz || []).some(function (q) { return Object.prototype.hasOwnProperty.call(TYPE_IT, q.q); })) return i;
  }
  return 0;
}

// typed: 'right' or 'wrong' types into each typing box; null taps Show choices instead.
function __e2eRecallRound(start, next, typed) {
  start();
  var n = currentQuizSet.length, r = { resting: 0, bars: 0, typedBoxes: 0 };
  for (var k = 0; k < n; k++) {
    Array.prototype.forEach.call(document.querySelectorAll('.recall-note'), function (e) { if (e.textContent.indexOf('⏳') >= 0) r.resting++; });
    if (__e2eVisible('.pu-bar')) r.bars++;
    var box = document.querySelector('.recall-type'), done = false;
    if (box) {
      r.typedBoxes++;
      if (typed) {
        box.querySelector('input').value = typed === 'right' ? box.nextElementSibling.querySelectorAll('button')[__e2eRightIdx()].textContent : 'zzzz';
        box.querySelector('.recall-check').click();
        done = typed === 'right';
      } else {
        box.querySelector('.recall-show').click();
      }
    }
    if (!done) __e2eAnswer(true);
    next();
  }
  var quizzes = __e2eHistory().filter(function (e) { return e.type === 'quiz'; });
  var last = quizzes[quizzes.length - 1];
  r.total = last.total;
  r.score = last.correct;
  r.points = last.points;
  r.typedLogged = last.typed || 0;
  r.resultText = document.getElementById('points-earned').textContent;
  return r;
}

function __e2eToday(plusDays) {
  var d = new Date();
  d.setDate(d.getDate() + (plusDays || 0));
  return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
}

function __e2eAllDueToday() {
  var store = JSON.parse(__store.getItem('review_v1'));
  Object.keys(store.items).forEach(function (k) { store.items[k].due = __e2eToday(); });
  __store.setItem('review_v1', JSON.stringify(store));
  return store;
}

function __e2eRecall(startLesson, next, startExam) {
  var r = {};
  r.first = __e2eRecallRound(startLesson, next, 'wrong');
  r.second = __e2eRecallRound(startLesson, next, 'wrong');
  var store = __e2eAllDueToday();
  r.boxesBefore = Object.keys(store.items).map(function (k) { return store.items[k].box; });
  r.third = __e2eRecallRound(startLesson, next, 'right');
  __store.setItem('review_v1', JSON.stringify({ v: 1, items: {} }));
  r.exam = __e2eRecallRound(startExam, next, null);
  __e2eOut({ recall: r, hasRecall: !!window.Recall });
}

// Every question's reviewInfo key must equal the key Recall used when it was shown.
function __e2eReview(startLesson, next) {
  var r = { keysMatch: 0, keysWrong: 0 }, missedKey = null;
  startLesson();
  for (var k = 0; k < currentQuizSet.length; k++) {
    var q = currentQuizSet[__e2eIdx()];
    if (Recall.lastKey() === Recall.keyOf(SH_APP, reviewInfo(q))) r.keysMatch++; else r.keysWrong++;
    if (k === 0) missedKey = Recall.lastKey();
    __e2eAnswer(k !== 0);
    next();
  }
  r.dueToday = Recall.dueCount(SH_APP);
  __e2eAllDueToday();
  r.due = Recall.dueCount(SH_APP);
  __store.setItem('quests_v1', JSON.stringify({ v: 1, day: __e2eToday(), at: Date.now(), list: [
    { id: 'review|' + SH_APP, kind: 'review', app: SH_APP, title: SH_TITLE, done: false },
    { id: 'right', kind: 'right', done: false }, { id: 'rounds', kind: 'rounds', done: false }], days: [], paidDay: '', streakPaid: [] }));
  startReview();
  r.reviewTotal = currentQuizSet.length;
  r.reviewTitle = currentQuizMeta.title;
  var played = currentQuizSet.map(function (pq) { return Recall.keyOf(SH_APP, reviewInfo(pq)); });
  for (var j = 0; j < r.reviewTotal; j++) { __e2eAnswer(true); next(); }
  var items = JSON.parse(__store.getItem('review_v1')).items;
  r.missedPlayed = played.indexOf(missedKey) >= 0;
  r.missedAfter = items[missedKey];
  r.othersAfter = played.filter(function (pk) { return pk !== missedKey; }).map(function (pk) { return items[pk]; });
  r.in3 = __e2eToday(3);
  r.in7 = __e2eToday(7);
  var quizzes = __e2eHistory().filter(function (e) { return e.type === 'quiz'; });
  r.kind = quizzes[quizzes.length - 1].kind;
  r.points = quizzes[quizzes.length - 1].points;
  r.resultText = document.getElementById('points-earned').textContent;
  r.fixedEvents = (Fx.queued() || []).filter(function (e) { return e.icon === '🔧'; }).length;
  r.questEvents = (Fx.queued() || []).filter(function (e) { return e.icon === '🎯'; }).length;
  r.questDone = JSON.parse(__store.getItem('quests_v1')).list[0].done;
  var queuedNow = Fx.queued() || [];
  Fx.celebrateNow();
  var fixedPop = document.getElementById('fx-pop');
  r.fixedPop = fixedPop ? { icon: fixedPop.querySelector('.fx-pop-icon').textContent, big: fixedPop.className.indexOf('fx-pop-big') >= 0,
    hasFix: fixedPop.querySelector('.fx-pop-icon').textContent === '🔧' || (fixedPop.querySelector('.fx-pop-more') || { textContent: '' }).textContent.indexOf('🔧') >= 0 } : null;
  r.fixedExpectBig = queuedNow.some(function (e) { return e.big; });
  if (fixedPop) fixedPop.click();
  startReview();
  r.retryTotal = currentQuizMeta.id === 'review' ? currentQuizSet.length : 0;
  __e2eOut({ review: r });
}

function __e2eMedal(startLesson) {
  var r = {}, lesson = medalLessons()[0];
  function texts(sel) { return Array.prototype.map.call(document.querySelectorAll(sel), function (e) { return e.textContent; }); }
  function bonus() { return (JSON.parse(__store.getItem('wallet_v1') || '{}').bonus) || 0; }
  function round() {
    var before = bonus();
    startLesson(lesson);
    __e2eAnswerAll(true);
    return bonus() - before;
  }
  function setBox(keys, box) {
    var store = JSON.parse(__store.getItem('review_v1') || '{"v":1,"items":{}}');
    keys.forEach(function (k) { store.items[k] = { box: box, due: __e2eToday(30), t: Date.now() }; });
    __store.setItem('review_v1', JSON.stringify(store));
  }
  r.first = round();
  setBox(lesson.keys, 3);
  r.second = round();
  r.lessonTitle = lesson.title;
  r.queued = (Fx.queued() || []).map(function (e) { return { big: e.big, icon: e.icon, title: e.title }; });
  Fx.celebrateNow();
  var pop = document.getElementById('fx-pop');
  r.pop = pop ? { big: pop.className.indexOf('fx-pop-big') >= 0, title: pop.querySelector('.fx-pop-title').textContent,
    bits: pop.querySelectorAll('.fx-bit').length, role: pop.getAttribute('role'), button: pop.querySelector('.fx-pop-ok').textContent } : null;
  if (pop) pop.click();
  r.popClosed = !document.getElementById('fx-pop');
  var realMatch = window.matchMedia;
  window.matchMedia = function () { return { matches: true }; };
  Fx.celebrate([{ big: true, icon: '🥇', title: 'Calm', line: '', next: '' }]);
  Fx.celebrateNow();
  var calm = document.getElementById('fx-pop');
  r.calm = calm ? { bits: calm.querySelectorAll('.fx-bit').length, calmClass: calm.className.indexOf('fx-pop-calm') >= 0 } : null;
  if (calm) calm.click();
  window.matchMedia = realMatch;
  var many = [];
  for (var i = 0; i < 5; i++) many.push({ big: false, icon: '🔧', title: 'Event ' + i, line: '', next: '' });
  Fx.celebrate(many);
  Fx.celebrateNow();
  var manyPop = document.getElementById('fx-pop');
  r.listed = manyPop ? manyPop.querySelectorAll('.fx-pop-more li').length : -1;
  if (manyPop) manyPop.click();
  var hidden = document.createElement('div');
  hidden.style.display = 'none';
  document.body.appendChild(hidden);
  Fx.celebrate([{ big: false, icon: '🔧', title: 'Hidden anchor', line: '', next: '' }], hidden);
  Fx.celebrateNow();
  r.hiddenAnchorOpens = !!document.getElementById('fx-pop');
  Fx.celebrate([{ big: false, icon: '🔧', title: 'Detached anchor', line: '', next: '' }], document.createElement('div'));
  Fx.celebrateNow();
  r.detachedAnchorOpens = !!document.getElementById('fx-pop');
  document.body.removeChild(hidden);
  var shown = document.createElement('div');
  shown.textContent = 'anchor';
  document.body.appendChild(shown);
  Fx.celebrate([{ big: false, icon: '🔧', title: 'Visible anchor', line: '', next: '' }], shown);
  Fx.celebrateNow();
  var visible = document.getElementById('fx-pop');
  r.visibleAnchorOpens = !!visible;
  if (visible) visible.click();
  document.body.removeChild(shown);
  r.newText = texts('.medal-new').join(' | ');
  var saved = JSON.parse(__store.getItem('mastery_v1')).apps[SH_APP].lessons[lesson.id];
  r.saved = { now: saved.now, best: saved.best, paid: saved.paid };
  r.third = round();
  renderHome();
  r.badges = texts('.medal');
  r.chip = (document.getElementById('medal-chip') || {}).textContent || '';
  setBox(lesson.keys.slice(0, 1), 1);
  r.slipPaid = updateMedals().coins;
  renderHome();
  r.slipBadges = texts('.medal');
  Mastery.showNew(document.getElementById('points-total-badge'), [{ level: 1, title: 'X', coins: 3 }]);
  renderHome();
  r.homeLineFirst = document.querySelectorAll('.medal-new[data-home]').length;
  renderHome();
  r.homeLineAfter = document.querySelectorAll('.medal-new[data-home]').length;
  __e2eOut({ medal: r });
}

// A boss stage: this game and one already-cleared stage. A failed try keeps it open; Try Again and 3 right clear it
// and pay the whole boss, once.
function __e2eBoss(startLesson, next, retry) {
  var r = {};
  startLesson();
  for (var k = 0; k < currentQuizSet.length; k++) { __e2eAnswer(true); next(); }
  __store.setItem('boss_v1', JSON.stringify({ v: 1, week: Boss.weekKey(Date.now()), paid: [],
    stages: [{ app: SH_APP, title: SH_TITLE, cleared: false }, { app: 'other-app', title: 'Other', cleared: true }] }));
  var bonus = function () { return (JSON.parse(__store.getItem('wallet_v1') || '{}').bonus) || 0; };
  var before = bonus(), pointsBefore = kit.totalPoints();
  r.isStage = Boss.isStage(SH_APP);
  startReview(true);
  r.title = currentQuizMeta.title;
  r.total = currentQuizSet.length;
  r.minions = document.querySelectorAll('.army-minion').length;
  r.hello = (document.querySelector('.army-say') || {}).textContent || '';
  for (var j = 0; j < r.total; j++) {
    __e2eAnswer(false);
    if (j === r.total - 1) r.stayed = document.querySelectorAll('.army-minion.stayed').length;
    next();
  }
  r.homeCard = (document.querySelector('.army-card') || {}).textContent || '';
  r.missEvents = (Fx.queued() || []).filter(function (e) { return e.icon === '⚔️'; }).length;
  r.openAfterMiss = Boss.isStage(SH_APP);
  retry();
  r.retryBoss = !!currentQuizMeta.boss;
  r.retryMinions = document.querySelectorAll('.army-minion').length;
  for (var i = 0; i < currentQuizSet.length; i++) {
    __e2eAnswer(i !== 1);
    if (i === currentQuizSet.length - 1) {
      r.popped = document.querySelectorAll('.army-minion.popped').length;
      r.giggled = document.querySelectorAll('.army-minion.stayed').length;
    }
    next();
  }
  r.burst = !!document.querySelector('.army-burst');
  r.popOpenDuringBurst = !!document.getElementById('fx-pop');
  var queued = Fx.queued() || [];
  r.beat = queued.filter(function (e) { return e.icon === '🐉' && e.big; }).length;
  r.hit = queued.filter(function (e) { return e.icon === '⚔️'; }).length;
  r.coins = bonus() - before;
  r.points = kit.totalPoints() - pointsBefore;
  r.openAfter = Boss.isStage(SH_APP);
  r.paid = JSON.parse(__store.getItem('boss_v1')).paid;
  var quizzes = __e2eHistory().filter(function (e) { return e.type === 'quiz'; });
  r.kind = quizzes[quizzes.length - 1].kind;
  __e2eOut({ boss: r });
}
