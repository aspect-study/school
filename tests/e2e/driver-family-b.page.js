function __e2eAnswer(right) {
  var item = currentQuizSet[qIdx];
  if (item.type === 'tf') {
    var want = right ? item.answer : !item.answer;
    document.querySelector('#q-options .tf-row').children[want ? 0 : 1].click();
    __e2eExploreAll('#q-options .tf-btn', 'q-explore');
    return;
  }
  var pick = -1;
  item.options.forEach(function (o, i) { if (pick < 0 && (right ? o.correct : !o.correct)) pick = i; });
  document.querySelectorAll('#q-options .opt')[pick].click();
  __e2eExploreAll('#q-options .opt', 'q-explore');
}

function __e2eAnswerAll(right) {
  var n = currentQuizSet.length;
  for (var k = 0; k < n; k++) { __e2eAnswer(right); document.getElementById('btn-next').click(); }
  return n;
}

function __e2eRun() {
  var mode = __e2eMode();
  if (mode === 'seed') return __e2eSeed();
  if (mode === 'refresh') return __e2eOut({ entries: __e2eHistory() });
  if (mode === 'nojs') {
    currentLesson = 0; startQuiz();
    var n0 = __e2eAnswerAll(true);
    return __e2eOut({ score: score, total: n0, hasSH: !!window.StudyHistory, coinBadgeHidden: document.querySelector('[data-coins="badge"]').hidden });
  }
  if (mode === 'powerups') return __e2ePowerUps(function () { currentLesson = 0; startQuiz(); }, function () { document.getElementById('btn-next').click(); }, startFinalExam);
  if (mode === 'powerups2') return __e2ePowerUps2(function () { currentLesson = 0; startQuiz(); }, function () { document.getElementById('btn-next').click(); });
  if (mode === 'powerups3') return __e2ePowerUps3(function () { currentLesson = 0; startQuiz(); }, startFinalExam);
  if (mode === 'recall') return __e2eRecall(function () { currentLesson = __e2eTypedLesson(lessons); startQuiz(); }, function () { document.getElementById('btn-next').click(); }, startFinalExam);
  if (mode === 'review') return __e2eReview(function () { currentLesson = 0; startQuiz(); }, function () { document.getElementById('btn-next').click(); });
  if (mode === 'boss') return __e2eBoss(function () { currentLesson = 0; startQuiz(); }, function () { document.getElementById('btn-next').click(); }, function () { document.getElementById('btn-retry').click(); });
  if (mode === 'medal') return __e2eMedal(function () { currentLesson = 0; startQuiz(); });
  if (mode !== 'play') return;

  var expect = { cardsTotal: lessons[0].flashcards.length, lessonTitle: lessons[0].title };
  document.querySelector('button[data-lesson="0"]').click();
  document.getElementById('btn-flash-next').click();
  document.getElementById('btn-flash-next').click();
  goHome();

  currentLesson = 0; startQuiz();
  expect.perfectTotal = __e2eAnswerAll(true);
  expect.perfectPoints = kit.sessionPoints();

  currentLesson = 0; startQuiz();
  expect.wrongTotal = __e2eAnswerAll(false);

  currentLesson = 0; startQuiz();
  expect.partialTotal = currentQuizSet.length;
  __e2eAnswer(true); document.getElementById('btn-next').click();
  __e2eAnswer(true);
  goHome();

  startFinalExam();
  expect.finalTotal = __e2eAnswerAll(true);

  expect.explore = __e2eExplore;
  expect.coins = __e2eCoins();
  __e2eOut({ entries: __e2eHistory(), expect: expect });
}
__e2eRun();
