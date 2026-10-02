function __e2eAnswer(right) {
  var q = currentQuizSet[quizIdx];
  selectOption(right ? q.correct : (q.correct + 1) % q.options.length);
  __e2eExploreAll('#optionsBox .option', 'exploreBox');
}

function __e2eAnswerAll(right) {
  var n = currentQuizSet.length;
  for (var k = 0; k < n; k++) { __e2eAnswer(right); nextQuestion(); }
  return n;
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
  if (mode === 'recall') return __e2eRecall(function () { currentLessonIdx = __e2eTypedLesson(LESSONS); startQuiz(); }, nextQuestion, startFinalExam);
  if (mode !== 'play') return;

  var expect = { cardsTotal: LESSONS[0].cards.length, lessonTitle: LESSONS[0].title, wrapLesson: true };
  openLesson(0); nextCard(); nextCard(); prevCard(); goHome();
  openLesson(0); prevCard(); goHome();

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

  expect.explore = __e2eExplore;
  expect.coins = __e2eCoins();
  __e2eOut({ entries: __e2eHistory(), expect: expect });
}
__e2eRun();
