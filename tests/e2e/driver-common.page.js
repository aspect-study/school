function __e2eOut(obj) {
  obj.errors = window.__e2eErrors || [];
  var pre = document.createElement('pre');
  pre.id = 'e2e-out';
  pre.textContent = JSON.stringify(obj);
  document.body.appendChild(pre);
}

function __e2eHistory() {
  try { return (JSON.parse(localStorage.getItem(__E2E_KEY)) || { entries: [] }).entries; }
  catch (e) { return 'unparseable'; }
}

function __e2eMode() {
  return (location.hash.match(/e2e=(\w+)/) || [])[1];
}

function __e2eSeed() {
  localStorage.setItem(__E2E_KEY, JSON.stringify({
    v: 1, entries: [{ id: 'seed-1', type: 'open', app: 'seed', appTitle: 'Seed', t: 1 }]
  }));
  var baselines = {};
  baselines[POINTS_KEY] = 0;
  localStorage.setItem(__E2E_WALLET_KEY, JSON.stringify({ v: 1, baselines: baselines, spent: 0, purchases: [], oldPointsCounted: true }));
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
  var pts = parseInt(localStorage.getItem(POINTS_KEY), 10) || 0;
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
  return (JSON.parse(localStorage.getItem(__E2E_WALLET_KEY)) || {}).spent || 0;
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
    var streak0 = streak, points0 = sessionPoints;
    __e2eAnswer(true);
    if (here.length) {
      r.helpedPoints.push(sessionPoints - points0);
      if (streak !== streak0) r.streakKept = false;
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
      var right = __e2eRightIdx(), btns = __e2eOptionButtons(), points0 = sessionPoints;
      btns[(right + 1) % btns.length].click();
      r.second = { tried: btns[(right + 1) % btns.length].classList.contains('pu-tried'), stillOpen: !Array.prototype.some.call(btns, function (b) { return b.classList.contains('correct'); }),
        noPoints: sessionPoints === points0 };
      btns[right].click();
      r.second.helpedPoints = sessionPoints - points0;
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
    var before = streak;
    __e2eAnswer(false);
    r.shield = { before: before, after: streak, note: document.querySelector('.pu-bar .pu-note').textContent };
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
  var points0 = sessionPoints;
  __e2eAnswer(true);
  r.helpedPoints = sessionPoints - points0;
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

function __e2eRecall(startLesson, next, startExam) {
  var key = __E2E_KEY.replace('_history_v1', '_recall_v1');
  var r = {};
  r.first = __e2eRecallRound(startLesson, next, 'wrong');
  r.second = __e2eRecallRound(startLesson, next, 'wrong');
  var store = JSON.parse(localStorage.getItem(key));
  var d = new Date();
  d.setDate(d.getDate() - 3);
  var back = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  Object.keys(store.rest).forEach(function (k) { store.rest[k] = back; });
  localStorage.setItem(key, JSON.stringify(store));
  r.third = __e2eRecallRound(startLesson, next, 'right');
  r.exam = __e2eRecallRound(startExam, next, null);
  __e2eOut({ recall: r, hasRecall: !!window.Recall });
}
