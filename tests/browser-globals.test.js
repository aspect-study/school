const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { engineFile } = require('./paths.js');

// Runs engine files as a browser would (no `module`), on a page with no data-grade, like the parent page.
function browser(...files) {
  const data = {};
  const win = {
    localStorage: {
      getItem: (k) => (k in data ? data[k] : null),
      setItem: (k, v) => { data[k] = String(v); },
      removeItem: (k) => { delete data[k]; },
      key: (i) => Object.keys(data)[i] ?? null,
      get length() { return Object.keys(data).length; },
    },
  };
  win.window = win;
  vm.createContext(win);
  for (const f of files) vm.runInContext(fs.readFileSync(engineFile(f), 'utf8'), win);
  return win;
}

test('the parent page can build a wallet and a history on a child\'s in-memory space', () => {
  const win = browser('storage.js', 'study-history.js', 'wallet.js');
  const s = win.StudyStore.memorySpace('kid');
  const w = win.Wallet.create(s, () => 1000, 'grade5');
  assert.ok(w.addBonus(40));
  assert.equal(JSON.parse(s.getItem('wallet_v1')).bonus, 40);
  const h = win.StudyHistory.create(s, () => 1000, 'grade5');
  h.testScore('rise-shine', 'GMRC', 'ST1', 19, 20, 40);
  assert.equal(h.findTest('rise-shine', 'st1').score, 19);
});

test('the parent page can read medals from a child\'s in-memory space', () => {
  const win = browser('storage.js', 'mastery.js');
  const s = win.StudyStore.memorySpace('kid');
  s.put('mastery_v1', JSON.stringify({ v: 1, apps: { 'life-lab': { t: 1, order: ['a', 'b'], lessons: {
    a: { title: 'Plants', now: 3, best: 3, paid: 3 }, b: { title: 'Rocks', now: 1, best: 2, paid: 2 } } } } }));
  const e = win.Mastery.read(s).apps['life-lab'];
  assert.deepEqual({ ...win.Mastery.counts(e) }, { gold: 1, silver: 1, bronze: 0, total: 2 });
  assert.deepEqual([...win.Mastery.polishList(e)], ['Rocks']);
  assert.equal(win.Mastery.update, undefined, 'no grade: no game helpers');
});

test('the parent page can show a child\'s streak line', () => {
  const win = browser('storage.js', 'quests.js');
  const s = win.StudyStore.memorySpace('kid');
  s.put('quests_v1', JSON.stringify({ v: 1, day: '2026-10-02', at: 1, list: [{ done: true }], days: ['2026-10-02'], paidDay: '', streakPaid: [] }));
  assert.equal(win.Quests.parentLine(win.Quests.read(s), new Date(2026, 9, 2, 9).getTime()), '🔥 1-day streak · today 1 of 1 quests');
  assert.equal(win.Quests.check, undefined, 'no grade: no lobby or game helpers');
});

test('Fx.setMuted switches the saved sound setting', () => {
  const data = {};
  const win = {
    localStorage: { getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); } },
    document: { readyState: 'loading', addEventListener() {}, currentScript: null, getElementById: () => null },
  };
  win.window = win;
  vm.createContext(win);
  vm.runInContext(fs.readFileSync(engineFile('fx.js'), 'utf8'), win);
  win.Fx.setMuted(true);
  assert.equal(win.Fx.muted(), true);
  assert.equal(data.study_fx_muted_v1, '1');
  win.Fx.setMuted(false);
  assert.equal(win.Fx.muted(), false);
});

function fxWindow(data) {
  const win = {
    localStorage: { getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); } },
    document: { readyState: 'loading', addEventListener() {}, currentScript: null, getElementById: () => null },
  };
  win.window = win;
  vm.createContext(win);
  vm.runInContext(fs.readFileSync(engineFile('fx.js'), 'utf8'), win);
  return win;
}

test('Fx.setPack saves the sound pack, ignores unknown ids and defaults to Happy Chimes', () => {
  const data = {};
  const win = fxWindow(data);
  assert.equal(win.Fx.pack(), 'kids');
  assert.deepEqual(Array.from(win.Fx.packs()), ['kids', 'battle']);
  assert.equal(win.Fx.packLabel('battle'), 'Battle announcer');
  win.Fx.setPack('battle');
  assert.equal(win.Fx.pack(), 'battle');
  assert.equal(data.study_fx_pack_v1, 'battle');
  win.Fx.setPack('nope');
  win.Fx.setPack('__proto__');
  assert.equal(win.Fx.pack(), 'battle');
  assert.equal(fxWindow({ study_fx_pack_v1: 'battle' }).Fx.pack(), 'battle', 'a saved choice survives a reload');
  assert.equal(fxWindow({ study_fx_pack_v1: 'junk' }).Fx.pack(), 'kids', 'a bad saved value means the default');
});

test('Fx.setPack still switches for the page when storage is unavailable', () => {
  const win = fxWindow({});
  win.localStorage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  win.Fx.setPack('battle');
  assert.equal(win.Fx.pack(), 'battle');
});

test('the parent page can show a child\'s boss line', () => {
  const win = browser('storage.js', 'boss.js');
  const s = win.StudyStore.memorySpace('kid');
  s.put('boss_v1', JSON.stringify({ v: 1, week: '2026-10-05', stages: [{ app: 'a', title: 'A', cleared: true }, { app: 'b', title: 'B', cleared: false }], paid: [] }));
  assert.equal(win.Boss.parentLine(win.Boss.read(s), new Date(2026, 9, 6, 9).getTime()), '🐉 Weekly boss: 1 of 2 stages');
  assert.equal(win.Boss.ensure, undefined, 'no grade: no lobby or game helpers');
});

test('the parent page can group a child\'s answers', () => {
  const win = browser('insights.js');
  const r = win.Insights.build([{ id: 'a', type: 'quiz', app: 'x', appTitle: 'X', lessonTitle: 'L', answered: 2, correct: 1, wrong: [{ q: 'Q', picked: 'p', answer: 'a' }], t: 1 }],
    { subjects: [{ app: 'x', title: 'X' }], items: {} });
  assert.equal(r.toFix, 1);
  assert.equal(r.subjects[0].pct, 50);
});
