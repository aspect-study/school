function __e2eAnswer(right) {
  var q = currentQuizSet[quizIdx];
  selectOption(right ? q.correct : (q.correct + 1) % q.options.length);
  __e2eExploreAll('#q-options .option', 'q-explore');
}

function __e2eAnswerAll(right) {
  var n = currentQuizSet.length;
  for (var k = 0; k < n; k++) { __e2eAnswer(right); nextQuestion(); }
  return n;
}

function __e2eWtPick(right) {
  document.querySelector('#wt-options .option[data-right="' + (right ? 1 : 0) + '"]').click();
  __e2eExploreAll('#wt-options .option', 'wt-explore');
}
function __e2eWalk(right) {
  startWalkthrough();
  var p = wtCurrent();
  p.givens.forEach(function (g, i) { if (right ? g.is : !g.is) wtPicks.add(i); });
  wtCheckGivens();
  __e2eExploreAll('#wt-options .option', 'wt-explore');
  wtAdvance();
  __e2eWtPick(right); wtAdvance();
  __e2eWtPick(right); wtAdvance();
  document.getElementById('wt-answer').value = right ? fracToString(p.answer.num, p.answer.den) : '999';
  wtCheckAnswer(); wtAdvance();
  __e2eWtPick(right); wtAdvance();
}
function __e2eCase(i, right) {
  openCase(i);
  var cs = CASES[i];
  for (var k = 0; k < cs.questions.length; k++) {
    var q = cs.questions[k];
    if (q.type === 'num') {
      document.getElementById('case-answer').value = right ? fracToString(q.answer.num, q.answer.den) : '999';
      caseCheckNum();
    } else {
      document.querySelector('#case-options .option[data-right="' + (right ? 1 : 0) + '"]').click();
      __e2eExploreAll('#case-options .option', 'case-explore');
    }
    if (k < cs.questions.length - 1) { caseQ++; renderCase(); } else caseShowKey();
  }
  return cs.questions.length;
}

function __e2eRun() {
  var mode = __e2eMode();
  if (mode === 'seed') return __e2eSeed();
  if (mode === 'refresh') return __e2eOut({ entries: __e2eHistory() });
  if (mode === 'nojs') {
    currentLessonIdx = 0; startQuiz();
    var n0 = __e2eAnswerAll(true);
    return __e2eOut({ score: quizScore, total: n0, hasSH: !!window.StudyHistory, coinBadgeHidden: document.querySelector('[data-coins="badge"]').hidden });
  }
  if (mode === 'powerups') return __e2ePowerUps(function () { currentLessonIdx = 0; startQuiz(); }, nextQuestion, startFinalExam);
  if (mode === 'powerups2') return __e2ePowerUps2(function () { currentLessonIdx = 0; startQuiz(); }, nextQuestion);
  if (mode === 'powerups3') return __e2ePowerUps3(function () { currentLessonIdx = 0; startQuiz(); }, startFinalExam);
  if (mode === 'medal') return __e2eMedal(function () { currentLessonIdx = 0; startQuiz(); });
  if (mode === 'boss') {
    currentLessonIdx = 0; startQuiz();
    var bn = currentQuizSet.length;
    for (var bk = 0; bk < bn; bk++) { selectOption(currentQuizSet[quizIdx].correct); nextQuestion(); }
    var bskill = SH_APP + '|skill:' + LESSONS[0].id;
    __store.setItem('boss_v1', JSON.stringify({ v: 1, week: Boss.weekKey(Date.now()), paid: [],
      stages: [{ app: SH_APP, title: SH_TITLE, cleared: false }, { app: 'other-app', title: 'Other', cleared: false }] }));
    startReview(true);
    var btotal = currentQuizSet.length, btitle = currentQuizMeta.title;
    var bminions = document.querySelectorAll('.army-minion').length;
    var bpopped = 0;
    for (var bj = 0; bj < btotal; bj++) {
      selectOption(currentQuizSet[quizIdx].correct);
      if (bj === btotal - 1) bpopped = document.querySelectorAll('.army-minion.popped').length;
      nextQuestion();
    }
    var bstate = JSON.parse(__store.getItem('boss_v1'));
    return __e2eOut({ boss: { title: btitle, total: btotal, minions: bminions, popped: bpopped, card: !!document.querySelector('.army-card'), cleared: bstate.stages[0].cleared, paid: bstate.paid,
      box: JSON.parse(__store.getItem('review_v1')).items[bskill].box,
      hit: (Fx.queued() || []).filter(function (e) { return e.icon === '⚔️'; }).length } });
  }
  if (mode === 'review') {
    currentLessonIdx = 0; startQuiz();
    var n = currentQuizSet.length;
    for (var k = 0; k < n; k++) { selectOption(currentQuizSet[quizIdx].correct); nextQuestion(); }
    var skill = SH_APP + '|skill:' + LESSONS[0].id;
    var before = JSON.parse(__store.getItem('review_v1')).items[skill];
    __e2eAllDueToday();
    startReview();
    var total = currentQuizSet.length;
    for (var j = 0; j < total; j++) { selectOption(currentQuizSet[quizIdx].correct); nextQuestion(); }
    var after = JSON.parse(__store.getItem('review_v1')).items[skill];
    var mathQuizzes = __e2eHistory().filter(function (e) { return e.type === 'quiz'; });
    return __e2eOut({ review: { before: before.box, after: after.box, total: total, points: kit.sessionPoints(), kind: mathQuizzes[mathQuizzes.length - 1].kind,
      resultText: document.getElementById('points-earned').textContent } });
  }
  if (mode !== 'play') return;

  var expect = { cardsTotal: LESSONS[0].flashcards.length, lessonTitle: LESSONS[0].title };
  openLesson(0);
  cardStep(1);
  cardStep(1);
  goHome();

  currentLessonIdx = 0; startQuiz();
  expect.perfectTotal = __e2eAnswerAll(true);
  expect.perfectPoints = kit.sessionPoints();

  currentLessonIdx = 0; startQuiz();
  expect.wrongTotal = __e2eAnswerAll(false);

  currentLessonIdx = 0; startQuiz();
  expect.partialTotal = currentQuizSet.length;
  __e2eAnswer(true); nextQuestion();
  __e2eAnswer(true);
  goHome();

  startFinalExam();
  expect.finalTotal = __e2eAnswerAll(true);

  __e2eWalk(true); __e2eWalk(false);
  startWalkthrough(); wtCheckGivens(); goHome();
  expect.casePerfectTotal = __e2eCase(0, true);
  expect.caseWrongTotal = __e2eCase(1, false);

  expect.explore = __e2eExplore;
  expect.coins = __e2eCoins();
  __e2eOut({ entries: __e2eHistory(), expect: expect });
}
__e2eRun();
