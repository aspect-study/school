const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { stage, makeWorkDir, dumpDom, readOutput, injectDriver } = require('./chrome.js');
const { ENGINE_FILES, app, appFile } = require('../paths.js');

// One game per family: start a quiz the way each family's own e2e driver does.
const CASES = [
  { id: 'life-lab', lobby: '../../../lobby/grade-5.html', home: 'home', quiz: 'quizScreen', start: 'currentLessonIdx = 0; startQuiz();' },
  { id: 'math-mastery', lobby: '../../../lobby/grade-5.html', home: 'screen-home', quiz: 'screen-quiz', start: 'currentLessonIdx = 0; startQuiz();' },
  { id: 'word-train', lobby: '../../../lobby/grade-2.html', home: 'home', quiz: 'quiz', start: 'currentLesson = 0; startQuiz();' },
  { id: 'kuwentista', lobby: '../../../lobby/grade-2.html', home: 'screen-home', quiz: 'screen-quiz', start: 'currentLessonIdx = 0; startQuiz();' },
];

const work = makeWorkDir('nav-e2e');
const driver = fs.readFileSync(path.join(__dirname, 'driver-nav.page.js'), 'utf8');

for (const c of CASES) {
  const html = injectDriver(fs.readFileSync(appFile(c.id), 'utf8'), 'function __NAV_QUIZ(){ ' + c.start + ' }\n' + driver);
  const file = stage(path.join(work, c.id), app(c.id).page, html, ENGINE_FILES);
  const r = readOutput(dumpDom(path.join(work, 'profile-' + c.id), file));
  assert.deepEqual(r.errors, [], c.id + ': page errors');
  assert.equal(r.barFirst, true, c.id + ': the bar is the first thing on the page');
  assert.equal(r.noFloatingMute, true, c.id + ': no floating sound button in games');
  assert.equal(r.backFromHome, c.lobby, c.id + ': ← on the home goes to the lobby');
  assert.equal(r.quizScreen, c.quiz, c.id + ': the quiz started');
  assert.equal(r.askShown, true, c.id + ': ← during a quiz asks first');
  assert.equal(r.keptScreen, c.quiz, c.id + ': Keep playing stays in the quiz');
  assert.equal(r.askHiddenAfterKeep, true, c.id + ': the check closes');
  assert.equal(r.afterLeave, c.home, c.id + ': Leave goes to the game home');
  assert.equal(r.menuOpen, true, c.id + ': ☰ opens the menu');
  assert.equal(r.soundToggled, true, c.id + ': the menu switches sound');
  assert.equal(r.shop, c.lobby + '#shop', c.id + ': Shop goes to the lobby shop');
  assert.equal(r.menuClosed, true, c.id + ': picking an item closes the menu');
  console.log('ok ' + c.id);
}
