const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { stage, makeWorkDir, dumpDom, readOutput, injectDriver } = require('./chrome.js');
const { ENGINE_FILES, app: appInfo, appFile, engineFile } = require('../paths.js');

const GRADE2_APPS = [
  { slug: 'block-bot', title: 'Block Bot', family: 'a' },
  { slug: 'kuwentista', title: 'Kuwentista', family: 'a' },
  { slug: 'word-train', title: 'Word Train', family: 'b' },
  { slug: 'batang-bayani', title: 'Batang Bayani', family: 'b' },
  { slug: 'growing-good', title: 'Growing Good', family: 'b' },
  { slug: 'byte-buddies', title: 'Byte Buddies', family: 'b' },
  { slug: 'science-detectives', title: 'Science Detectives', family: 'b' },
];

const GRADE5_APPS = [
  { slug: 'history-explorers', title: 'History Explorers', family: 'c' },
  { slug: 'wikaharian', title: 'Wikaharian', family: 'c' },
  { slug: 'page-turners', title: 'Page Turners', family: 'c' },
  { slug: 'rise-shine', title: 'Rise & Shine', family: 'c' },
  { slug: 'rally-ready', title: 'Rally Ready', family: 'c' },
  { slug: 'craft-corner', title: 'Craft Corner', family: 'c' },
  { slug: 'life-lab', title: 'Life Lab', family: 'c' },
  { slug: 'net-navigators', title: 'Net Navigators', family: 'c' },
  { slug: 'rhythm-hues', title: 'Rhythm & Hues', family: 'c' },
  { slug: 'math-mastery', title: 'Math Mastery', family: 'math' },
];

const grade = process.argv[2] === '5' ? 5 : 2;
const key = 'history_v1';
const APPS = grade === 5 ? GRADE5_APPS : GRADE2_APPS;
const { plain } = require(engineFile('study-history.js'));
const REVIEW_TITLE = require(engineFile('recall.js')).TEXT['grade' + grade].reviewTitle;

const read = (name) => fs.readFileSync(path.join(__dirname, name), 'utf8');

function driverFileFor(app) {
  return app.family === 'math' ? 'driver-math.page.js' : 'driver-family-' + app.family + '.page.js';
}

function checkMath(mine, x) {
  const walkthroughs = mine.filter((e) => e.kind === 'walkthrough');
  assert.equal(walkthroughs.length, 3, 'walkthrough entry count');
  const [perfect, wrong, partial] = walkthroughs;

  assert.equal(perfect.finished, true);
  assert.equal(perfect.total, 5);
  assert.equal(perfect.correct, 5);
  assert.equal(perfect.points, 65);
  assert.equal(perfect.wrong.length, 0);

  assert.equal(wrong.finished, true);
  assert.equal(wrong.correct, 0);
  assert.equal(wrong.wrong.length, 5);
  const stripEllipsis = (s) => (s.endsWith('...') ? s.slice(0, -3) : s);
  wrong.wrong.forEach((w) => {
    assert.ok(w.q && w.picked && w.answer, 'wrong walkthrough entry has question, pick and answer');
    assert.notEqual(w.picked, w.answer, 'pick differs from answer');
    assert.ok(w.q.endsWith(']'), 'walkthrough wrong q names the problem, e.g. "...[Dough problem]"');
    assert.ok(
      stripEllipsis(w.q).includes(stripEllipsis(wrong.lessonTitle)),
      'the bracketed problem name matches this entry\'s lessonTitle'
    );
  });

  assert.equal(partial.finished, false);
  assert.equal(partial.answered, 1);

  const cases = mine.filter((e) => e.kind === 'case');
  assert.equal(cases.length, 2, 'case entry count');
  const [casePerfect, caseWrong] = cases;

  assert.equal(casePerfect.finished, true);
  assert.equal(casePerfect.correct, x.casePerfectTotal);
  assert.equal(casePerfect.total, x.casePerfectTotal);
  assert.equal(casePerfect.points, 10 * x.casePerfectTotal + 5 * Math.max(0, x.casePerfectTotal - 2));

  assert.equal(caseWrong.correct, 0);
  assert.equal(caseWrong.wrong.length, x.caseWrongTotal);

  walkthroughs.concat(cases).forEach((e) => {
    assert.ok(e.lessonTitle, 'lessonTitle present');
    assert.doesNotMatch(e.lessonTitle, /[<]|&(#\d+|[a-z]+);/i, 'lessonTitle is plain text');
    if (e.kind === 'walkthrough') assert.ok(e.lessonTitle.length <= 60, 'walkthrough title is at most 60 chars');
  });
}

function checkPlay(app, out) {
  const x = out.expect;
  assert.deepEqual(out.errors, [], 'page errors');
  assert.ok(Array.isArray(out.entries), 'history is readable');
  assert.ok(out.entries.some((e) => e.id === 'seed-1'), '?reset=1 kept the existing history');
  assert.ok(x.explore.taps > 0, 'other options were tapped after answering');
  assert.ok(x.coins.expected > 40, 'the playthrough earned coins');
  assert.ok(x.coins.badge.includes(' ' + x.coins.expected + ' coins'), 'home badge shows the coin balance: ' + x.coins.badge);
  assert.ok(x.coins.have.includes(' ' + x.coins.expected + ' coins'), 'results line shows the coin balance: ' + x.coins.have);
  assert.ok(x.coins.live.includes(String(x.coins.expected)), 'quiz header shows the coin balance: ' + x.coins.live);
  assert.equal(x.coins.guideOpened, true, 'tapping the coin badge opens the guide');
  assert.equal(x.coins.guideClosed, true, 'the guide closes');
  assert.equal(x.explore.empty, 0, 'every tapped option showed its reason');
  const mine = out.entries.filter((e) => e.app === app.slug);

  const opens = mine.filter((e) => e.type === 'open');
  assert.equal(opens.length, 1, 'one open entry');
  assert.equal(opens[0].appTitle, app.title);

  const lessons = mine.filter((e) => e.type === 'lesson');
  assert.equal(lessons.length, x.wrapLesson ? 2 : 1, 'lesson entry count');
  assert.equal(lessons[0].cardsViewed, 3, 'cards viewed');
  assert.equal(lessons[0].cardsTotal, x.cardsTotal);
  assert.equal(lessons[0].lessonTitle, plain(x.lessonTitle));
  if (x.wrapLesson) {
    assert.equal(lessons[1].cardsViewed, 2, 'wrapped lesson cards viewed (card 1 plus the wrapped-to last card)');
  }

  const quizzes = mine.filter((e) => e.type === 'quiz' && !e.kind);
  assert.equal(quizzes.length, x.numberlineTotal ? 5 : 4, 'quiz entry count');
  const [perfect, wrong, partial, final] = quizzes;

  assert.equal(perfect.finished, true);
  assert.equal(perfect.total, x.perfectTotal);
  assert.equal(perfect.correct, x.perfectTotal);
  assert.equal(perfect.wrong.length, 0);
  assert.equal(perfect.stars, 3);
  assert.equal(perfect.points, x.perfectPoints, 'points match the app');
  assert.equal(perfect.points, 10 * x.perfectTotal + 5 * Math.max(0, x.perfectTotal - 2), 'points formula');
  assert.equal(perfect.bestStreak, x.perfectTotal);

  assert.equal(wrong.finished, true);
  assert.equal(wrong.answered, x.wrongTotal);
  assert.equal(wrong.correct, 0);
  assert.equal(wrong.wrong.length, x.wrongTotal);
  assert.equal(wrong.stars, 0);
  assert.equal(wrong.points, 0);
  wrong.wrong.forEach((w) => {
    assert.ok(w.q && w.picked && w.answer, 'wrong answer has question, pick and answer');
    assert.notEqual(w.picked, w.answer, 'pick differs from answer');
    assert.doesNotMatch(w.q + w.picked + w.answer, /&(#\d+|[a-z]+);/i, 'stored as plain text');
  });

  assert.equal(partial.finished, false);
  assert.equal(partial.total, x.partialTotal);
  assert.equal(partial.answered, 2);
  assert.equal(partial.correct, 2);

  assert.equal(final.final, true);
  assert.equal(final.finished, true);
  assert.equal(final.correct, x.finalTotal);
  assert.equal(final.points, 20 * x.finalTotal + 5 * Math.max(0, x.finalTotal - 2), 'the mock exam pays 20 a question');

  if (x.numberlineTotal) {
    const nl = quizzes[4];
    assert.equal(nl.wrong.length, x.numberlineTotal);
    nl.wrong.filter((w) => /^\d+ \+ \d+ = \?$/.test(w.q)).forEach((w) => {
      assert.equal(w.picked, String(Number(w.answer) + 1), 'number-line pick is the typed number');
    });
  }

  if (app.family === 'math') checkMath(mine, x);
}

function checkRefresh(play, refresh) {
  assert.deepEqual(refresh.errors, []);
  assert.equal(refresh.entries.length, play.entries.length, 'a refresh adds no entries');
}

function checkPowerUps(app, out) {
  const r = out.pu;
  assert.deepEqual(out.errors, [], 'page errors');
  assert.ok(r.used.length >= 1, 'at least one power-up was usable in lesson 1');
  assert.equal(r.spent, r.used.reduce((sum, k) => sum + r.prices[k], 0), 'coins spent match the prices');
  r.helpedPoints.forEach((p) => assert.equal(p, 5, 'a helped right answer earns half points'));
  assert.equal(r.streakKept, true, 'a helped answer does not grow the streak');
  assert.equal(r.tipShown, true, 'the hint shows the tip');
  r.outCounts.forEach((c) => assert.ok(c >= 1, '50/50 crossed out a wrong answer'));
  assert.equal(r.outReenabled, true, 'crossed-out answers can be explored after answering');
  if (r.used.length === 2 && r.maxBlocked !== null) assert.equal(r.maxBlocked, true, 'no third power-up in a quiz');
  assert.equal(r.examBlocked, true, 'no power-ups in the mock exam');
  assert.match(r.examNote, /Mock Exam/);
  const quiz = out.entries.filter((e) => e.app === app.slug && e.type === 'quiz' && !e.final && !e.kind).pop();
  assert.deepEqual((quiz.powerUps || []).map((p) => p.kind), r.used, 'every use is logged on the quiz');
  console.log('  power-ups used: ' + r.used.join(', '));
}

function checkPowerUps2(app, out) {
  const r = out.pu;
  assert.deepEqual(out.errors, [], 'page errors');
  assert.ok(r.later, 'Save for Later was offered on question 1');
  assert.equal(r.later.movedToEnd, true, 'the saved question moved to the end');
  assert.equal(r.later.sameLength, true, 'no question was lost');
  assert.equal(r.later.nextShown, true, 'the next question shows in its place');
  assert.match(r.later.note, /⏭️/, 'the saved note shows');
  if (r.second) {
    assert.equal(r.second.tried, true, 'the missed pick is marked');
    assert.equal(r.second.stillOpen, true, 'the question stays open after the first miss');
    assert.equal(r.second.noPoints, true, 'the miss itself gives nothing');
    assert.equal(r.second.helpedPoints, 5, 'a right second try earns half points');
  }
  assert.ok(r.shield, 'Streak Shield was offered after 2 right answers');
  assert.equal(r.shield.after, r.shield.before, 'the shield kept the streak through a miss');
  assert.match(r.shield.note, /🛡️/, 'the shield-saved note shows');
  assert.equal(r.spent, r.used.reduce((sum, k) => sum + r.prices[k], 0), 'coins spent match the prices');
  const quizzes = out.entries.filter((e) => e.app === app.slug && e.type === 'quiz' && !e.final && !e.kind);
  const logged = quizzes.slice(-2).map((q) => (q.powerUps || []).map((p) => p.kind)).flat();
  assert.deepEqual(logged, r.used, 'every use is logged on its quiz');
  console.log('  2b power-ups used: ' + r.used.join(', '));
}

function checkPowerUps3(app, out) {
  const r = out.pu;
  assert.deepEqual(out.errors, [], 'page errors');
  assert.deepEqual(r.helpers, grade === 2 ? ['ate', 'mommy', 'tatay'] : ['mommy', 'tatay'], 'Ate is Grade 2 only');
  assert.equal(r.askedMommy, true);
  assert.match(r.card, /Mommy/, 'the card names the helper');
  assert.equal(r.noCancel, true, 'paying is final: no cancel button');
  assert.equal(r.tatayBlocked, true, 'one helper per question');
  assert.equal(r.helpedPoints, 5, 'a family-helped right answer earns half points');
  assert.equal(r.cardAfterAnswer, false, 'the card closes after answering');
  assert.equal(r.spent, r.prices.mommy);
  const quizzes = out.entries.filter((e) => e.app === app.slug && e.type === 'quiz' && !e.final && !e.kind);
  assert.deepEqual((quizzes[quizzes.length - 2].powerUps || []).map((p) => p.kind), ['mommy'], 'the ask is logged on its quiz');
  assert.equal(r.examShowsAsk, false, 'an unfinished ask does not follow her into the mock exam');
  assert.equal(r.examShowsPicker, false, 'nor does an open helper picker');
}

// Only study-kit.js is required; every other engine file is optional.
function checkNoJs(out) {
  assert.deepEqual(out.errors, [], 'no errors with only study-kit.js');
  assert.equal(out.hasSH, false);
  assert.ok(out.total > 0 && out.score === out.total, 'quiz still plays to the end');
  assert.equal(out.coinBadgeHidden, true, 'no wallet file: the empty coin badge stays hidden');
}

function checkRecall(app, out) {
  assert.deepEqual(out.errors, [], 'recall: page errors');
  assert.equal(out.hasRecall, true, 'recall file loaded');
  const { first, second, third, exam } = out.recall;
  const perfect = (base, n) => base * n + 5 * Math.max(0, n - 2);
  assert.equal(first.score, first.total);
  assert.equal(first.resting, 0, 'nothing rests on the first round');
  assert.equal(first.points, perfect(10, first.total), 'a wrong typed guess, then the right pick, pays normally');
  assert.equal(second.resting, second.total, 'every question rests on the same day');
  assert.equal(second.points, 0, 'a resting round pays nothing');
  assert.equal(second.score, second.total, 'but still counts for the score');
  assert.equal(second.bars, 0, 'no power-up bar on a resting question');
  assert.match(second.resultText, /⏳/, 'the results screen says questions were resting');
  assert.ok(third.typedBoxes > 0, 'the chosen lesson has a typed question');
  assert.equal(third.resting, 0, 'due questions pay again');
  assert.equal(out.recall.boxesBefore.every((b) => b === 2), true, 'the first round put every question in box 2');
  assert.equal(third.points, perfect(10, third.total) + 5 * third.typedBoxes + 4 * third.total, 'typed answers add 5, box 2 adds 4 each');
  assert.match(third.resultText, /📦/, 'the results screen says questions moved up');
  assert.equal(third.typedLogged, third.typedBoxes, 'history counts typed answers');
  assert.equal(exam.points, perfect(20, exam.total), 'the mock exam pays 20 a question');
  console.log('  recall: typed ' + third.typedBoxes + ', exam ' + exam.points + ' pts');
}

// A wrong answer is due tomorrow and a right one in 3 days, so nothing is due today until the driver moves the days.
function checkReview(app, out) {
  assert.deepEqual(out.errors, [], 'review: page errors');
  const r = out.review;
  assert.equal(r.keysWrong, 0, 'reviewInfo gives the same key Recall used');
  assert.ok(r.keysMatch > 0);
  assert.equal(r.dueToday, 0, 'nothing is due on the day it was answered');
  assert.equal(r.reviewTotal, Math.min(10, r.due), 'a review round takes up to 10 due questions');
  assert.equal(r.kind, 'review');
  assert.equal(r.reviewTitle, REVIEW_TITLE);
  const n = r.reviewTotal;
  const bonus = 2 + 4 * (n - 1);
  assert.equal(r.points, 10 * n + 5 * Math.max(0, n - 2) + bonus, 'the missed question (box 1, +2) comes first, the rest are box 2 (+4)');
  assert.match(r.resultText, new RegExp('📦 ' + n + ' .*\\+' + bonus + ' review bonus\\)'), 'moved-up count and bonus');
  assert.equal(r.missedPlayed, true, 'the missed question is in the review');
  assert.deepEqual([r.missedAfter.box, r.missedAfter.due], [2, r.in3], 'box 1 right moves to box 2, due in 3 days');
  assert.equal(r.othersAfter.length, n - 1);
  r.othersAfter.forEach((it) => assert.deepEqual([it.box, it.due], [3, r.in7], 'box 2 right moves to box 3, due in 7 days'));
  assert.equal(r.retryTotal, Math.min(10, r.due - r.reviewTotal), 'what was just answered rests; retry plays only what is still due');
  assert.equal(r.fixedEvents, 1, 'answering a missed question right on its due day celebrates a fixed mistake');
  assert.ok(r.fixedPop, 'the fixed-mistakes popup opens');
  assert.equal(r.fixedPop.big, r.fixedExpectBig, 'its size follows its events');
  assert.equal(r.fixedPop.hasFix, true, 'the fixed-mistakes event is shown, as the headline or in the list');
  assert.equal(r.questDone, true, 'a Review round ticks off the Review quest');
  assert.equal(r.questEvents, 1, 'with a quest popup');
  console.log('  review: ' + r.reviewTotal + ' of ' + r.due + ' due, ' + r.points + ' pts');
}

function checkMathReview(out) {
  assert.deepEqual(out.errors, [], 'review: page errors');
  const r = out.review;
  assert.equal(r.before, 2, 'a perfect lesson quiz puts the skill in box 2');
  assert.equal(r.after, 3, 'a perfect review moves it to box 3');
  assert.equal(r.total, 3, 'one due skill = 3 fresh problems');
  assert.equal(r.kind, 'review', 'history logs the skill review as a review');
  assert.equal(r.points, 3 * (10 + 4) + 5, 'RULES: 10 a question + box 2 bonus 4 each, +5 streak bonus on the 3rd in a row');
  assert.match(r.resultText, /📦/);
  console.log('  skill review: ' + r.points + ' pts');
}

function checkMedal(app, out) {
  assert.deepEqual(out.errors, [], 'medal: page errors');
  const m = out.medal;
  if (app.family === 'math') assert.deepEqual([m.first, m.second], [20, 40], 'a skill at box 2 pays Bronze, at box 3 Silver');
  else {
    assert.ok(m.first === 0 || m.first === 20, 'Bronze only when the quiz covered the whole lesson: ' + m.first);
    assert.equal(m.first + m.second, 60, 'Bronze and Silver pay 20 + 40, once each');
  }
  assert.equal(m.third, 0, 'replaying after the medal is paid pays nothing');
  assert.equal(m.homeLineFirst, 1, 'the open-time medal line shows on the first home screen');
  assert.equal(m.homeLineAfter, 0, 'and is gone the next time');
  assert.match(m.newText, /🏅/, 'the results show the new medal');
  assert.deepEqual(m.saved, { now: 2, best: 2, paid: 2 });
  assert.ok(m.badges.includes('🥈'), 'the lesson card shows Silver: ' + m.badges.join(' '));
  assert.match(m.chip, /🥈 1/, 'the header chip counts it');
  assert.equal(m.slipPaid, 0, 'a slip pays nothing');
  assert.ok(m.slipBadges.includes('🥈🔧'), 'a slipped lesson keeps its medal with a polish mark');
  assert.equal(m.queued.length, 1, 'one popup event for the new Silver: ' + JSON.stringify(m.queued));
  assert.deepEqual([m.queued[0].big, m.queued[0].icon], [true, '🥈']);
  assert.ok(m.pop, 'the popup opens');
  assert.equal(m.pop.role, 'dialog');
  assert.equal(m.pop.big, true, 'Silver is a big celebration');
  assert.ok(m.pop.title.includes(m.lessonTitle), 'the headline names the lesson: ' + m.pop.title);
  assert.ok(m.pop.bits > 0, 'big celebrations have confetti');
  assert.equal(m.pop.button, 'Nice!');
  assert.equal(m.popClosed, true, 'a tap closes it');
  assert.deepEqual(m.calm, { bits: 0, calmClass: true }, 'reduced motion: no confetti, a plain fade');
  assert.equal(m.listed, 3, 'a popup lists at most 3 more events');
  assert.equal(m.hiddenAnchorOpens, false, 'a hidden anchor drops the popup');
  assert.equal(m.detachedAnchorOpens, false, 'a detached anchor drops the popup');
  assert.equal(m.visibleAnchorOpens, true, 'a visible anchor still opens it');
  console.log('  medal: ' + m.first + ' + ' + m.second + ' pts');
}

const work = makeWorkDir('study-history-e2e');
const withJs = path.join(work, 'with-js');
const noJs = path.join(work, 'no-js');
const withRecall = path.join(work, 'with-recall');
const WITHOUT_RECALL = ENGINE_FILES.filter((f) => f !== 'recall.js');

const common = "var __store = window.Learner ? Learner.storage : localStorage;\nvar __E2E_KEY = '" + key + "';\nvar __E2E_WALLET_KEY = 'wallet_v1';\n" + read('driver-common.page.js');
const failures = [];
for (const app of APPS) {
  const driver = common + '\n' + read(driverFileFor(app));
  const page = appInfo(app.slug).page;
  const html = injectDriver(fs.readFileSync(appFile(app.slug), 'utf8'), driver);
  const file = stage(withJs, page, html, WITHOUT_RECALL);
  const noJsFile = stage(noJs, page, html, ['study-kit.js']);
  const recallFile = stage(withRecall, page, html, ENGINE_FILES);
  const profile = path.join(work, 'profile-' + app.slug);
  try {
    dumpDom(profile, file, '#e2e=seed');
    const play = readOutput(dumpDom(profile, file, '?reset=1#e2e=play'));
    checkPlay(app, play);
    checkRefresh(play, readOutput(dumpDom(profile, file, '#e2e=refresh')));
    checkPowerUps(app, readOutput(dumpDom(profile, file, '#e2e=powerups')));
    checkPowerUps2(app, readOutput(dumpDom(profile, file, '#e2e=powerups2')));
    checkPowerUps3(app, readOutput(dumpDom(profile, file, '#e2e=powerups3')));
    const reviewOut = readOutput(dumpDom(path.join(work, 'profile-review-' + app.slug), recallFile, '#e2e=review'));
    if (app.family === 'math') checkMathReview(reviewOut);
    else {
      checkRecall(app, readOutput(dumpDom(path.join(work, 'profile-recall-' + app.slug), recallFile, '#e2e=recall')));
      checkReview(app, reviewOut);
    }
    checkMedal(app, readOutput(dumpDom(path.join(work, 'profile-medal-' + app.slug), recallFile, '#e2e=medal')));
    checkNoJs(readOutput(dumpDom(path.join(work, 'profile-nojs-' + app.slug), noJsFile, '#e2e=nojs')));
    console.log('PASS ' + app.slug);
  } catch (err) {
    failures.push(app.slug);
    console.log('FAIL ' + app.slug + ': ' + err.message);
  }
}
fs.rmSync(work, { recursive: true, force: true });
if (failures.length) {
  console.log(failures.length + ' of ' + APPS.length + ' apps failed');
  process.exit(1);
}
console.log('All ' + APPS.length + ' apps passed');
