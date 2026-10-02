const test = require('node:test');
const assert = require('node:assert/strict');
const { APPS, appFile, engineFile } = require('./paths.js');
const { start, RULES } = require(engineFile('study-kit.js'));

function storage(initial) {
  const data = Object.assign({}, initial);
  return {
    data,
    getItem(k) { return k in data ? data[k] : null; },
    setItem(k, v) { data[k] = String(v); },
  };
}

// A fake page: records what the kit asks the other engine files and the DOM to do.
function page({ search = '', stored = {}, shield = false, recall = null, now = new Date(2026, 9, 2, 9) } = {}) {
  const log = [];
  const live = [{ innerHTML: '' }];
  let shieldOn = shield;
  const root = {
    localStorage: storage(stored),
    location: { search, pathname: '/school/subjects/grade-5/gmrc/index.html', hash: '#top' },
    history: { replaceState(s, t, url) { log.push(['replaceState', url]); } },
    document: { querySelectorAll(sel) { log.push(['query', sel]); return live; } },
    Fx: { correct(n) { log.push(['Fx.correct', n]); }, wrong() { log.push(['Fx.wrong']); } },
    PowerUps: { shield() { log.push(['shield']); const on = shieldOn; shieldOn = false; return on; } },
    Wallet: { renderCoins() { log.push(['renderCoins']); }, liveHtml() { return '<w>'; } },
    StudyHistory: { appOpened(app, title) { log.push(['appOpened', app, title]); } },
  };
  if (recall) root.Recall = recall;
  const kit = start({ app: 'rise-shine', title: 'Rise & Shine', pointsKey: 'riseshine_points_v1', progressKey: 'riseshine_progress_v1' }, root, () => now);
  return { kit, root, log, live };
}

test('the scoring rules are unchanged', () => {
  assert.deepEqual(RULES, { POINTS_PER_CORRECT: 10, EXAM_POINTS_PER_CORRECT: 20, STREAK_BONUS: 5, STREAK_BONUS_AT: 3 });
});

test('a perfect round of 5 pays 10 each, plus 5 from the third answer in a row', () => {
  const { kit, root } = page();
  kit.startRound();
  const paid = [1, 2, 3, 4, 5].map(() => kit.answer(true, {}));
  assert.deepEqual(paid, [10, 10, 15, 15, 15]);
  assert.equal(kit.sessionPoints(), 65);
  assert.equal(kit.streak(), 5);
  assert.equal(kit.bestStreak(), 5);
  assert.equal(kit.totalPoints(), 65);
  assert.equal(root.localStorage.data.riseshine_points_v1, '65');
});

test('the mock exam pays 20 a question', () => {
  const { kit } = page();
  assert.deepEqual([kit.answer(true, { exam: true }), kit.answer(true, { exam: true }), kit.answer(true, { exam: true })], [20, 20, 25]);
});

test('a helped answer pays half, never grows the streak, and plays a quiet ding', () => {
  const { kit, log } = page();
  kit.answer(true, {});
  assert.equal(kit.answer(true, { helped: true }), 5);
  assert.equal(kit.streak(), 1);
  assert.deepEqual(log.filter((l) => l[0] === 'Fx.correct'), [['Fx.correct', 1], ['Fx.correct', 0]]);
});

test('a wrong answer breaks the streak unless a Streak Shield saves it', () => {
  const plain = page();
  plain.kit.answer(true, {});
  plain.kit.answer(false, {});
  assert.equal(plain.kit.streak(), 0);
  assert.deepEqual(plain.log.filter((l) => l[0] === 'Fx.wrong' || l[0] === 'shield'), [['shield'], ['Fx.wrong']]);

  const shielded = page({ shield: true });
  shielded.kit.answer(true, {});
  shielded.kit.answer(false, {});
  assert.equal(shielded.kit.streak(), 1, 'the shield kept it');
  shielded.kit.answer(false, {});
  assert.equal(shielded.kit.streak(), 0, 'a shield works once');
});

test('shield: false never asks for (and so never uses up) a Streak Shield', () => {
  const { kit, log } = page({ shield: true });
  kit.answer(true, {});
  kit.answer(false, { shield: false });
  assert.equal(kit.streak(), 0);
  assert.equal(log.filter((l) => l[0] === 'shield').length, 0);
});

test('Recall decides the pay when it is loaded', () => {
  const calls = [];
  const recall = { points(helped, base, bonus) { calls.push([helped, base, bonus]); return 0; }, resultLine() { return ' · ⏳ rest'; } };
  const { kit } = page({ recall });
  kit.answer(true, {});
  kit.answer(true, { helped: true, exam: true });
  assert.deepEqual(calls, [[false, 10, 0], [true, 20, 0]]);
  assert.equal(kit.sessionPoints(), 0);
  assert.equal(kit.resultLine(), '⭐ +0 points this round · ⏳ rest');
});

test('startRound clears the round but keeps the total', () => {
  const { kit } = page({ stored: { riseshine_points_v1: '100' } });
  kit.answer(true, {});
  kit.startRound();
  assert.deepEqual([kit.sessionPoints(), kit.streak(), kit.bestStreak(), kit.totalPoints()], [0, 0, 0, 110]);
});

test('the round line names the best streak once it reaches the bonus', () => {
  const { kit } = page();
  kit.answer(true, {});
  kit.answer(true, {});
  assert.equal(kit.roundLine('this problem'), '⭐ +20 points this problem');
  kit.answer(true, {});
  assert.equal(kit.resultLine(), '⭐ +35 points this round · 🔥 best streak: 3 in a row!');
});

test('the live counter shows points, a streak from 2, and the coin badge', () => {
  const { kit, live, log } = page();
  kit.answer(true, {});
  assert.equal(live[0].innerHTML, '⭐ 10 pts<w>');
  kit.answer(true, {});
  assert.equal(live[0].innerHTML, '⭐ 20 pts <span class="streak">🔥 x2</span><w>');
  assert.deepEqual(log.filter((l) => l[0] === 'query')[0], ['query', '#points-live']);
});

test('the live label and selector can be set per game', () => {
  const root = page().root;
  const queried = [];
  root.document = { querySelectorAll(sel) { queried.push(sel); return [{ innerHTML: '' }]; } };
  const kit = start({ app: 'kuwentista', title: 'Kuwentista', pointsKey: 'k_points_v1', progressKey: 'k_progress_v1', liveLabel: 'puntos (points)', liveSelector: '.points-live' }, root, () => new Date());
  kit.renderLive();
  assert.deepEqual(queried, ['.points-live']);
});

test('saving points refreshes the coin badge', () => {
  const { kit, log } = page();
  kit.answer(true, {});
  assert.ok(log.some((l) => l[0] === 'renderCoins'));
});

test('stars reset on a new day, and stay for the rest of the same day', () => {
  const stored = { riseshine_progress_v1: '{"a":3}', riseshine_progress_v1_day: '2026-10-1' };
  const { kit, root } = page({ stored });
  assert.deepEqual(kit.progress(), {});
  assert.equal(root.localStorage.data.riseshine_progress_v1_day, '2026-10-2');
  kit.saveProgress({ a: 2 });
  const again = page({ stored: root.localStorage.data });
  assert.deepEqual(again.kit.progress(), { a: 2 });
});

test('opening from the lobby with ?reset=1 logs the visit and drops the flag from the address', () => {
  const { log } = page({ search: '?reset=1' });
  assert.deepEqual(log.filter((l) => l[0] === 'appOpened' || l[0] === 'replaceState'),
    [['appOpened', 'rise-shine', 'Rise & Shine'], ['replaceState', '/school/subjects/grade-5/gmrc/index.html#top']]);
  assert.equal(page({ search: '' }).log.some((l) => l[0] === 'appOpened'), false);
});

test('missing storage, history or other engine files never break scoring', () => {
  const root = { location: { search: '?reset=1', pathname: '/', hash: '' }, document: { querySelectorAll() { return []; } } };
  root.localStorage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  const kit = start({ app: 'x', title: 'X', pointsKey: 'x_points_v1', progressKey: 'x_progress_v1' }, root, () => new Date());
  assert.equal(kit.answer(true, {}), 10);
  assert.equal(kit.answer(false, {}), 0);
  assert.deepEqual(kit.progress(), {});
});

const fs = require('node:fs');
for (const app of APPS) {
  test(app.id + ' scores through the study kit, with no copy of the rules of its own', () => {
    const html = fs.readFileSync(appFile(app.id), 'utf8');
    const tag = '<script src="../../../engine/study-kit.js" data-grade="grade' + app.grade + '"></script>';
    assert.equal(html.split(tag).length - 1, 1, 'loads study-kit.js once');
    assert.equal(html.indexOf('<script src="../../../engine/', html.indexOf(tag) + 1), -1, 'after the other engine files');
    assert.equal(html.split('StudyKit.start({ app: SH_APP, title: SH_TITLE, pointsKey: ').length - 1, 1, 'starts the kit once');
    assert.match(html, /pointsKey: '[a-z]+_points_v1', progressKey: STORAGE_KEY/);
    assert.ok(html.split('kit.answer(').length - 1 > 0, 'answers are scored by the kit');
    assert.equal(html.split('kit.startRound();').length - 1 >= 2, true, 'every quiz starts a fresh round');
    for (const gone of ['POINTS_PER_CORRECT', 'STREAK_BONUS =', 'saveTotalPoints', 'sessionPoints +=', 'streak++', 'STARS_DAY_KEY', 'reset=1(&|$)']) {
      assert.equal(html.split(gone).length - 1, 0, 'leftover ' + gone);
    }
  });
}

test('lessons come back in the order their files loaded, and content by name', () => {
  const { library } = require(engineFile('study-kit.js'));
  const lib = library();
  lib.lesson({ id: 'a' });
  lib.lesson({ id: 'b' });
  assert.deepEqual(lib.lessons().map((l) => l.id), ['a', 'b']);
  assert.equal(lib.content('strategy'), undefined);
  lib.content('strategy', [{ title: 'Read twice' }]);
  assert.deepEqual(lib.content('strategy'), [{ title: 'Read twice' }]);
});

test('a wrong answer tells Recall, so the question goes back to box 1', () => {
  const calls = [];
  const recall = { points() { return 10; }, missed() { calls.push('missed'); }, resultLine() { return ''; } };
  const { kit } = page({ recall });
  kit.answer(false, { helped: false });
  kit.answer(true, { helped: false });
  assert.deepEqual(calls, ['missed']);
});

test('extra points are added to an unhelped right answer only', () => {
  const { kit } = page();
  assert.equal(kit.answer(true, { helped: false, extra: 6 }), RULES.POINTS_PER_CORRECT + 6);
  assert.equal(kit.answer(true, { helped: true, extra: 6 }), RULES.POINTS_PER_CORRECT / 2);
  assert.equal(kit.answer(false, { helped: false, extra: 6 }), 0);
});

test('a shielded wrong answer still tells Recall and keeps the streak', () => {
  const calls = [];
  const recall = { points() { return 10; }, missed() { calls.push('missed'); }, resultLine() { return ''; } };
  const { kit } = page({ recall, shield: true });
  kit.answer(true, { helped: false });
  kit.answer(false, { helped: false });
  assert.deepEqual(calls, ['missed']);
  assert.equal(kit.streak(), 1);
});

test('award adds milestone points to the total but not to the round', () => {
  const { kit, root, log } = page();
  kit.startRound();
  kit.answer(true, {});
  kit.award(40);
  kit.award(0);
  assert.equal(kit.sessionPoints(), 10);
  assert.equal(kit.totalPoints(), 50);
  assert.equal(root.localStorage.data.riseshine_points_v1, '50');
  assert.equal(log.filter((l) => l[0] === 'renderCoins').length, 2, 'coins redrawn after the answer and the award only');
});
