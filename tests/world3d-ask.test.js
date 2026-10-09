const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile, engineFile } = require('./paths.js');
const { lessons } = require('./content.js');
const { create: createRecall, keyOf } = require(engineFile('recall.js'));
const SK = require(engineFile('study-kit.js'));
const Q = require(worldFile('quiz.js'));
const A = require(worldFile('ask.js'));

const NOW = new Date(2026, 9, 6, 10).getTime();
const textOf = (s) => String(s == null ? '' : s).replace(/<[^>]*>/g, '');
const FILES = {
  'life-lab': { title: 'Life Lab', pointsKey: 'lifelab_points_v1', progressKey: 'lifelab_progress_v1', dir: 'x/', files: ['a.js'] },
  'page-turners': { title: 'Page Turners', pointsKey: 'pageturners_points_v1', progressKey: 'pageturners_progress_v1', dir: 'y/', files: ['b.js'] },
};

function memory(init) {
  const m = new Map(Object.entries(init || {}));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

// A page with the real Recall and StudyKit; load() answers from the lesson data, or fails for a missing app.
function page(items, data, quiz) {
  const storage = memory({ review_v1: JSON.stringify({ v: 1, items }) });
  const history = [];
  const loaded = [];
  const win = { Learner: { storage }, location: { search: '' }, document: { querySelectorAll: () => [] } };
  win.Recall = Object.assign(createRecall(storage, () => NOW, 'grade5'), { keyOf });
  win.StudyKit = { start: (opts) => SK.start(opts, win, () => new Date(NOW)) };
  win.StudyHistory = {
    quizStarted: (...a) => { history.push({ started: a }); return 'h' + history.length; },
    quizAnswered: (...a) => { history.push({ answered: a }); },
  };
  const load = (app) => { loaded.push(app); return data[app] ? Promise.resolve(data[app]) : Promise.reject(new Error('404')); };
  const asker = A.create({ win, files: FILES, quiz: quiz || Q, load, textOf, title: 'Ask me!', rand: () => 0.4 });
  return { storage, history, loaded, asker };
}

function questions(app, n) {
  const ls = lessons(app);
  const out = [];
  ls.forEach((l) => (l.quiz || []).forEach((q) => { if (out.length < n && Q.askable(app, l, q)) out.push(q); }));
  return out;
}
const key = (app, q) => keyOf(app, Q.info(app, q, textOf));
const due = (box) => ({ box, due: '2026-10-01', t: 1 });

test('a due question is asked, and a right answer moves its box and pays like a review in the game', async () => {
  const [q, later] = questions('life-lab', 2);
  const p = page({ [key('life-lab', q)]: due(2), [key('life-lab', later)]: { box: 3, due: '2026-10-20', t: 1 } }, { 'life-lab': lessons('life-lab') });
  const list = await p.asker.pick(['life-lab']);
  assert.equal(list.length, 1, 'only the due question');
  assert.equal(list[0].item, q);
  const r = p.asker.answer(list, 0, list[0].view.options.findIndex((o) => o.right));
  assert.equal(r.right, true);
  assert.equal(r.pts, 14, '10 points + the box-2 gap bonus of 4');
  assert.equal(p.storage.getItem('lifelab_points_v1'), '14');
  assert.equal(JSON.parse(p.storage.getItem('review_v1')).items[key('life-lab', q)].box, 3);
  assert.deepEqual(p.history[0].started, ['life-lab', 'Life Lab', 'review', 'Ask me!', false, 1, 'review']);
  assert.deepEqual(p.history[1].answered.slice(0, 2), ['h1', true]);
});

test('a wrong answer sends the question to box 1 and shows the game\'s explanation', async () => {
  const [q] = questions('life-lab', 1);
  const p = page({ [key('life-lab', q)]: due(3) }, { 'life-lab': lessons('life-lab') });
  const list = await p.asker.pick(['life-lab']);
  const r = p.asker.answer(list, 0, list[0].view.options.findIndex((o) => !o.right));
  assert.equal(r.right, false);
  assert.equal(r.pts, 0);
  assert.equal(r.answer, list[0].view.answer);
  assert.equal(JSON.parse(p.storage.getItem('review_v1')).items[key('life-lab', q)].box, 1);
  assert.equal(p.storage.getItem('lifelab_points_v1'), null);
});

test('nothing due: nothing is loaded and nothing is asked', async () => {
  const p = page({}, { 'life-lab': lessons('life-lab') });
  assert.deepEqual(await p.asker.pick(['life-lab']), []);
  assert.deepEqual(p.loaded, []);
  assert.equal(p.asker.supported('math-mastery'), false);
  assert.deepEqual(await p.asker.pick(['math-mastery']), []);
});

test('a lesson file that fails: the pick fails when nothing loaded, and skips that game when another loaded', async () => {
  const [q] = questions('life-lab', 1);
  const [r] = questions('page-turners', 1);
  const items = { [key('life-lab', q)]: due(2), [key('page-turners', r)]: due(2) };
  await assert.rejects(page(items, {}).asker.pick(['life-lab']));
  const list = await page(items, { 'life-lab': lessons('life-lab') }).asker.pick(['life-lab', 'page-turners']);
  assert.deepEqual(list.map((x) => x.app), ['life-lab']);
});

test('Professor Hoot asks up to 3, taking turns across the subjects with the most due first', async () => {
  const life = questions('life-lab', 3);
  const page2 = questions('page-turners', 2);
  const items = {};
  life.forEach((q) => { items[key('life-lab', q)] = due(2); });
  page2.forEach((q) => { items[key('page-turners', q)] = due(2); });
  const p = page(items, { 'life-lab': lessons('life-lab'), 'page-turners': lessons('page-turners') });
  assert.deepEqual(p.asker.dueApps(), ['life-lab', 'page-turners']);
  const list = await p.asker.pick(p.asker.dueApps(), 3);
  assert.deepEqual(list.map((x) => x.app), ['life-lab', 'page-turners', 'life-lab']);
});

test('answering the same question twice records it once', async () => {
  const [q] = questions('life-lab', 1);
  const p = page({ [key('life-lab', q)]: due(2) }, { 'life-lab': lessons('life-lab') });
  const list = await p.asker.pick(['life-lab']);
  const right = list[0].view.options.findIndex((o) => o.right);
  assert.equal(p.asker.answer(list, 0, right).right, true);
  const count = p.history.length;
  assert.equal(p.asker.answer(list, 0, right), null);
  assert.equal(p.history.length, count);
});

test('bad question data in one game counts as that game failing', async () => {
  const [q] = questions('life-lab', 1);
  const [r] = questions('page-turners', 1);
  const items = { [key('life-lab', q)]: due(2), [key('page-turners', r)]: due(2) };
  const data = { 'life-lab': lessons('life-lab'), 'page-turners': lessons('page-turners') };
  const bad = Object.assign({}, Q, { view: (app, ...a) => { if (app === 'page-turners') throw new Error('bad'); return Q.view(app, ...a); } });
  const list = await page(items, data, bad).asker.pick(['life-lab', 'page-turners']);
  assert.deepEqual(list.map((x) => x.app), ['life-lab']);
  await assert.rejects(page({ [key('page-turners', r)]: due(2) }, data, bad).asker.pick(['page-turners']));
});

test('a page without Recall has nothing to ask', async () => {
  const asker = A.create({ win: {}, files: FILES, quiz: Q, load: () => Promise.reject(new Error('no')), textOf, title: 'Ask me!' });
  assert.deepEqual(asker.dueApps(), []);
  assert.deepEqual(await asker.pick(['life-lab', 'page-turners']), []);
});

test('everyone gets the same lesson loader, so two loads at once never mix lessons or leave StudyKit.lesson swapped', async () => {
  const Loader = require(worldFile('ask.js')).loader;
  const original = () => {};
  const win = { StudyKit: { lesson: original } };
  // A lesson script hands its lesson to StudyKit.lesson a moment after it is added, then loads.
  win.document = {
    createElement: () => ({}),
    head: { appendChild: (s) => setTimeout(() => { win.StudyKit.lesson({ from: s.src }); s.onload(); }, 5) }
  };
  const files = { a: { dir: 'a/', files: ['1.js', '2.js'] }, b: { dir: 'b/', files: ['1.js'] } };
  const ask = Loader(win, files), kids = Loader(win, files);
  assert.equal(ask, kids);
  assert.notEqual(Loader({ document: win.document, StudyKit: win.StudyKit }, files), ask, 'another window gets its own');
  const [a, b] = await Promise.all([ask('a'), kids('b')]);
  assert.deepEqual(a.map((l) => l.from), ['a/1.js', 'a/2.js']);
  assert.deepEqual(b.map((l) => l.from), ['b/1.js']);
  assert.equal(win.StudyKit.lesson, original);
  assert.equal(kids('a'), ask('a'), 'a game loads once');
});
