const test = require('node:test');
const assert = require('node:assert/strict');
const { engineFile } = require('./paths.js');
const { controller, lobbyUrl, homeUrl, WORLD_RETURN, TEXT } = require(engineFile('nav.js'));

// A stand-in for window.history: records calls; back() lands on the game-home entry (state null).
function setup(over = {}) {
  const log = [];
  const history = {
    state: null,
    pushState(s) { this.state = s; log.push('push:' + s.nav); },
    replaceState(s) { this.state = s; log.push('replace:' + s.nav); },
    back() { if (!over.asyncBack) this.state = null; log.push('back'); },
  };
  let round = false;
  let asked = null;
  const ctl = controller(Object.assign({
    home: 'home',
    lobby: '../../../lobby/grade-5.html',
    goHome: () => { log.push('goHome'); ctl.screen('home'); },
    inRound: () => round,
    go: (url) => log.push('go:' + url),
    ask: (proceed, stay) => { asked = { proceed, stay }; log.push('ask'); },
    history,
  }, over));
  return { ctl, log, history, setRound: (v) => { round = v; }, asked: () => asked };
}

test('the lobby is two folders up from the subject folder, per grade', () => {
  assert.equal(lobbyUrl('grade5'), '../../../lobby/grade-5.html');
  assert.equal(lobbyUrl('grade2'), '../../../lobby/grade-2.html');
  assert.equal(lobbyUrl(null), '../../../lobby/grade-5.html');
});

test('← on the game home goes to the lobby', () => {
  const s = setup();
  s.ctl.back();
  assert.deepEqual(s.log, ['go:../../../lobby/grade-5.html']);
});

test('leaving the home pushes one history entry, later screens replace it, home goes back once', () => {
  const s = setup();
  s.ctl.screen('quizScreen');
  s.ctl.screen('resultsScreen');
  s.ctl.screen('home');
  assert.deepEqual(s.log, ['push:quizScreen', 'replace:resultsScreen', 'back']);
  s.ctl.popstate();
  assert.deepEqual(s.log, ['push:quizScreen', 'replace:resultsScreen', 'back'], 'the popstate from our own back() is ignored');
  assert.equal(s.ctl.current(), 'home');
});

test('← on an inner screen outside a round goes straight to the game home', () => {
  const s = setup();
  s.ctl.screen('flashScreen');
  s.ctl.back();
  assert.deepEqual(s.log, ['push:flashScreen', 'goHome', 'back']);
});

test('← during a round asks first: Keep playing stays, Leave goes home', () => {
  const s = setup();
  s.ctl.screen('quizScreen');
  s.setRound(true);
  s.ctl.back();
  assert.deepEqual(s.log, ['push:quizScreen', 'ask']);
  s.asked().stay();
  assert.equal(s.ctl.current(), 'quizScreen');
  s.ctl.back();
  s.asked().proceed();
  assert.deepEqual(s.log.slice(-2), ['goHome', 'back']);
});

test('🏠 asks during a round, then goes to the lobby; outside a round it goes at once', () => {
  const s = setup();
  s.ctl.screen('quizScreen');
  s.setRound(true);
  s.ctl.home();
  assert.equal(s.log.at(-1), 'ask');
  s.asked().proceed();
  assert.equal(s.log.at(-1), 'go:../../../lobby/grade-5.html');
  s.setRound(false);
  s.ctl.home();
  assert.equal(s.log.at(-1), 'go:../../../lobby/grade-5.html');
});

test('Shop goes to the lobby with #shop', () => {
  const s = setup();
  s.ctl.shop();
  assert.deepEqual(s.log, ['go:../../../lobby/grade-5.html#shop']);
});

test('Lessons does nothing on the game home and goes home from inside', () => {
  const s = setup();
  s.ctl.lessons();
  assert.deepEqual(s.log, []);
  s.ctl.screen('flashScreen');
  s.ctl.lessons();
  assert.deepEqual(s.log, ['push:flashScreen', 'goHome', 'back']);
});

test('the back gesture during a round asks; Keep playing puts the history entry back', () => {
  const s = setup();
  s.ctl.screen('quizScreen');
  s.setRound(true);
  s.history.state = null; // the browser already moved to the game-home entry
  s.ctl.popstate();
  assert.equal(s.log.at(-1), 'ask');
  s.asked().stay();
  assert.equal(s.log.at(-1), 'push:quizScreen');
  assert.equal(s.ctl.current(), 'quizScreen');
});

test('the back gesture outside a round goes home without a second history step', () => {
  const s = setup();
  s.ctl.screen('flashScreen');
  s.history.state = null;
  s.ctl.popstate();
  assert.deepEqual(s.log, ['push:flashScreen', 'goHome']);
  assert.equal(s.ctl.current(), 'home');
});

test('the back gesture on the game home is left to the browser (it returns to the lobby)', () => {
  const s = setup();
  s.ctl.popstate();
  assert.deepEqual(s.log, []);
});

test('a game can replace what ← does on inner screens (Math case studies)', () => {
  const calls = [];
  const s = setup({ back: () => calls.push('caseBack') });
  s.ctl.screen('screen-cases');
  s.ctl.back();
  assert.deepEqual(calls, ['caseBack']);
});

test('the check buttons stay English in both grades', () => {
  for (const g of ['grade5', 'grade2']) {
    assert.equal(TEXT[g].keep, 'Keep playing');
    assert.equal(TEXT[g].leave, 'Leave');
  }
  assert.equal(TEXT.grade5.leaveTitle, 'Leave the quiz?');
  assert.equal(TEXT.grade5.leaveBody, 'Points you earned are kept.');
});

test('a screen shown in the same tick as going home still gets its own history entry', () => {
  const s = setup({ asyncBack: true });
  s.ctl.screen('quizScreen');
  s.ctl.screen('home');
  s.ctl.screen('flashScreen');
  s.history.state = null;
  s.ctl.popstate();
  assert.deepEqual(s.log, ['push:quizScreen', 'back', 'push:flashScreen']);
  assert.equal(s.ctl.current(), 'flashScreen');
});

test('same-tick screen cycles queue one back per leave and swallow exactly those popstates', () => {
  const s = setup({ asyncBack: true });
  s.ctl.screen('quizScreen');
  s.ctl.screen('home');
  s.ctl.screen('quizScreen');
  s.ctl.screen('home');
  assert.equal(s.log.filter((e) => e === 'back').length, 2);
  assert.equal(s.log.filter((e) => e.startsWith('push:')).length, 2);
  const before = s.log.length;
  s.ctl.popstate();
  s.ctl.popstate();
  assert.equal(s.log.length, before);
  assert.equal(s.ctl.current(), 'home');
});

test('after a swallowed popstate, a real back gesture on an inner screen goes home', () => {
  const s = setup({ asyncBack: true });
  s.ctl.screen('quizScreen');
  s.ctl.screen('home');
  s.ctl.popstate();
  s.ctl.screen('flashScreen');
  s.history.state = null;
  s.ctl.popstate();
  assert.equal(s.log.at(-1), 'goHome');
  assert.equal(s.ctl.current(), 'home');
});

test('🏠 goes back to the world when the game was opened from it', () => {
  assert.equal(homeUrl('grade5', { grade: 'grade5', app: 'life-lab' }), '../../../world/grade-5.html');
  assert.equal(homeUrl('grade2', { grade: 'grade2', app: 'block-bot' }), '../../../world/grade-2.html');
  assert.equal(homeUrl('grade5', null), '../../../lobby/grade-5.html');
  assert.equal(homeUrl('grade5', { grade: 'grade2', app: 'block-bot' }), '../../../lobby/grade-5.html');
});

test('with a world to go back to, ← and 🏠 go there and the shop still opens in the lobby', () => {
  const s = setup({ away: '../../../world/grade-5.html' });
  s.ctl.back();
  s.ctl.home();
  s.ctl.shop();
  assert.deepEqual(s.log, ['go:../../../world/grade-5.html', 'go:../../../world/grade-5.html', 'go:../../../lobby/grade-5.html#shop']);
});

test('nav reads the same return key the world writes', () => {
  const { RETURN_KEY } = require(require('./paths.js').worldFile('prefs.js'));
  assert.equal(WORLD_RETURN, RETURN_KEY);
});

test('the menu has a sound-pack label in both grades, paired in Grade 2', () => {
  assert.equal(TEXT.grade5.soundPack, '🎵 Sounds');
  assert.equal(TEXT.grade2.soundPack, '🎵 Sounds · Mga tunog');
});
