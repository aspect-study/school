const test = require('node:test');
const assert = require('node:assert/strict');
const { engineFile } = require('./paths.js');
const { create, plain, KEY } = require(engineFile('study-history.js'));

function memStorage() {
  const data = {};
  return {
    data,
    getItem: (k) => (Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: (k) => { delete data[k]; },
  };
}

function makeClock() {
  const clock = { ms: new Date(2026, 8, 28, 15, 41).getTime() };
  clock.now = () => clock.ms;
  clock.advance = (minutes) => { clock.ms += minutes * 60000; };
  clock.set = (y, mo, d, h, mi) => { clock.ms = new Date(y, mo - 1, d, h, mi).getTime(); };
  return clock;
}

function setup() {
  const storage = memStorage();
  const clock = makeClock();
  return { storage, clock, sh: create(storage, clock.now) };
}

const saved = (storage) => JSON.parse(storage.getItem(KEY)).entries;

test('plain strips tags, decodes entities and collapses whitespace', () => {
  assert.equal(plain('<b>Tom</b> &amp; Jerry&rsquo;s &mdash; &#8369;50\n ok'), 'Tom & Jerry’s — ₱50 ok');
  assert.equal(plain(42), '42');
  assert.equal(plain(null), '');
  assert.equal(plain('&unknown;'), '&unknown;');
});

test('plain leaves an out-of-range numeric entity untouched instead of throwing', () => {
  assert.equal(plain('&#99999999;'), '&#99999999;');
});

test('plain only strips tag-shaped runs, not bare angle brackets', () => {
  assert.equal(plain('3 < 5 > 2'), '3 < 5 > 2');
  assert.equal(plain('<b>x</b>'), 'x');
});

test('plain decodes named entities with digits, like fractions', () => {
  assert.equal(plain('&frac12;'), '½');
});

test('appOpened records an open entry with the time', () => {
  const { sh, storage, clock } = setup();
  const id = sh.appOpened('word-train', 'Word Train');
  const data = JSON.parse(storage.getItem(KEY));
  assert.equal(data.v, 1);
  assert.deepEqual(data.entries, [{ type: 'open', app: 'word-train', appTitle: 'Word Train', id, t: clock.ms }]);
});

test('lessonOpened and cardViewed track the furthest card reached', () => {
  const { sh, storage, clock } = setup();
  const start = clock.ms;
  const id = sh.lessonOpened('kuwentista', 'Kuwentista', 'pangngalan', 'Pangngalan &amp; Panghalip', 8);
  sh.cardViewed(id, 1);
  clock.advance(2);
  sh.cardViewed(id, 3);
  sh.cardViewed(id, 2);
  const [e] = saved(storage);
  assert.equal(e.type, 'lesson');
  assert.equal(e.lessonId, 'pangngalan');
  assert.equal(e.lessonTitle, 'Pangngalan & Panghalip');
  assert.equal(e.cardsTotal, 8);
  assert.equal(e.cardsViewed, 3);
  assert.equal(e.t, start);
  assert.equal(e.updatedAt, start + 2 * 60000);
});

test('a quiz records answers, wrong picks as plain text, and the finish', () => {
  const { sh, storage, clock } = setup();
  const start = clock.ms;
  const id = sh.quizStarted('word-train', 'Word Train', 0, 'Nouns', false, 3);
  sh.quizAnswered(id, true, 'Q1', 'a', 'a');
  clock.advance(2);
  sh.quizAnswered(id, false, 'Which is a &ldquo;noun&rdquo;?', '<b>run</b>', 'cat');
  sh.quizAnswered(id, true, 'Q3', 'x', 'x');
  clock.advance(1);
  sh.quizFinished(id, 2, 45, 1);
  const [e] = saved(storage);
  assert.equal(e.type, 'quiz');
  assert.equal(e.lessonId, '0');
  assert.equal(e.final, false);
  assert.equal(e.total, 3);
  assert.equal(e.answered, 3);
  assert.equal(e.correct, 2);
  assert.deepEqual(e.wrong, [{ q: 'Which is a “noun”?', picked: 'run', answer: 'cat' }]);
  assert.equal(e.finished, true);
  assert.equal(e.stars, 2);
  assert.equal(e.points, 45);
  assert.equal(e.bestStreak, 1);
  assert.equal(e.t, start);
  assert.equal(e.updatedAt, start + 3 * 60000);
});

test('a quiz left halfway stays unfinished with its partial counts', () => {
  const { sh, storage } = setup();
  const id = sh.quizStarted('word-train', 'Word Train', 'final', 'Word Train Review', true, 21);
  sh.quizAnswered(id, true, 'Q1', 'a', 'a');
  sh.quizAnswered(id, false, 'Q2', 'b', 'c');
  const [e] = saved(storage);
  assert.equal(e.final, true);
  assert.equal(e.finished, false);
  assert.equal(e.answered, 2);
  assert.equal(e.correct, 1);
});

test('calls with a missing entry id are ignored', () => {
  const { sh, storage } = setup();
  sh.cardViewed(null, 2);
  sh.quizAnswered(null, false, 'q', 'a', 'b');
  sh.quizFinished(null, 3, 10, 1);
  assert.equal(storage.getItem(KEY), null);
});

test('a full storage drops the entry, sets the error marker and never throws', () => {
  const { sh, storage, clock } = setup();
  const realSet = storage.setItem;
  storage.setItem = (k, v) => { if (k === KEY) throw new Error('QuotaExceededError'); realSet(k, v); };
  assert.equal(sh.appOpened('word-train', 'Word Train'), null);
  assert.equal(sh.storageError(), clock.ms);
  assert.equal(storage.getItem(KEY), null);
});

test('corrupt history is copied aside before new writes', () => {
  const { sh, storage, clock } = setup();
  storage.setItem(KEY, '{not json');
  sh.appOpened('word-train', 'Word Train');
  assert.equal(storage.getItem('history_corrupt_v1_' + clock.ms), '{not json');
  assert.equal(saved(storage).length, 1);
});

test('corrupt history that cannot be copied aside is left untouched', () => {
  const { sh, storage } = setup();
  storage.setItem(KEY, '{not json');
  const realSet = storage.setItem;
  storage.setItem = (k, v) => { if (k.startsWith('history_corrupt')) throw new Error('full'); realSet(k, v); };
  assert.equal(sh.appOpened('word-train', 'Word Train'), null);
  assert.equal(storage.getItem(KEY), '{not json');
  assert.notEqual(sh.storageError(), null);
});

test('malformed stored entries never throw out of an update call', () => {
  const { sh, storage } = setup();
  storage.setItem(KEY, '{"v":1,"entries":[null]}');
  assert.doesNotThrow(() => sh.cardViewed('x', 2));
  assert.doesNotThrow(() => sh.quizAnswered('x', false, 'q', 'a', 'b'));
});

test('an update with an unmatched id leaves storage untouched', () => {
  const { sh, storage } = setup();
  sh.appOpened('word-train', 'Word Train');
  const before = storage.getItem(KEY);
  sh.cardViewed('nope', 2);
  assert.equal(storage.getItem(KEY), before);
});

function seed() {
  const ctx = setup();
  const { sh, clock } = ctx;

  clock.set(2026, 9, 1, 9, 0);
  sh.appOpened('word-train', 'Word Train');

  clock.set(2026, 9, 15, 23, 59);
  const lesson = sh.lessonOpened('kuwentista', 'Kuwentista', 'pangngalan', 'Pangngalan', 8);
  clock.advance(4);
  for (let i = 1; i <= 8; i++) sh.cardViewed(lesson, i);

  clock.set(2026, 9, 16, 0, 0);
  const c = sh.quizStarted('word-train', 'Word Train', 0, 'Nouns', false, 10);
  for (let i = 0; i < 8; i++) sh.quizAnswered(c, true, 'ok', 'a', 'a');
  sh.quizAnswered(c, false, 'Pick the noun', 'run', 'cat');
  sh.quizAnswered(c, false, 'Spell "cat"', 'kat', 'cat');
  clock.advance(5);
  sh.quizFinished(c, 2, 95, 8);

  clock.set(2026, 9, 20, 10, 0);
  const d = sh.quizStarted('word-train', 'Word Train', 'final', 'Word Train Review', true, 4);
  sh.quizAnswered(d, true, 'ok', 'a', 'a');
  sh.quizAnswered(d, false, 'Pick the noun', 'run', 'cat');
  sh.quizAnswered(d, false, 'Pick the verb', 'cat', 'run');
  sh.quizAnswered(d, true, 'ok', 'a', 'a');
  clock.advance(3);
  sh.quizFinished(d, 1, 20, 1);

  clock.set(2026, 9, 28, 15, 0);
  const e = sh.quizStarted('kuwentista', 'Kuwentista', 'pangngalan', 'Pangngalan', false, 10);
  clock.advance(2);
  sh.quizAnswered(e, false, 'Q', 'A', 'B');

  return ctx;
}

const kinds = (entries) => entries.map((e) => e.type + ':' + e.app + ':' + new Date(e.t).getDate());

test('list returns everything newest first', () => {
  const { sh } = seed();
  assert.deepEqual(kinds(sh.list()), [
    'quiz:kuwentista:28', 'quiz:word-train:20', 'quiz:word-train:16', 'lesson:kuwentista:15', 'open:word-train:1',
  ]);
});

test('list date range is inclusive of whole local days', () => {
  const { sh } = seed();
  assert.deepEqual(kinds(sh.list('2026-09-15', '2026-09-15')), ['lesson:kuwentista:15']);
  assert.deepEqual(kinds(sh.list('2026-09-16', null)), ['quiz:kuwentista:28', 'quiz:word-train:20', 'quiz:word-train:16']);
});

test('list filters by app', () => {
  const { sh } = seed();
  assert.deepEqual(kinds(sh.list(null, null, 'kuwentista')), ['quiz:kuwentista:28', 'lesson:kuwentista:15']);
});

test('summary totals time, quizzes, average and the most-missed question', () => {
  const { sh } = seed();
  assert.deepEqual(sh.summary(sh.list('2026-09-01', '2026-09-30')), {
    studyMs: 14 * 60000,
    quizzes: 3,
    averagePct: 65,
    mostMissed: { app: 'word-train', appTitle: 'Word Train', q: 'Pick the noun', count: 2 },
  });
});

test('summary of nothing is empty', () => {
  const { sh } = setup();
  assert.deepEqual(sh.summary([]), { studyMs: 0, quizzes: 0, averagePct: null, mostMissed: null });
});

test('summary caps one entry at 60 minutes', () => {
  const { sh, clock } = setup();
  const id = sh.lessonOpened('word-train', 'Word Train', 0, 'Nouns', 5);
  clock.advance(180);
  sh.cardViewed(id, 5);
  assert.equal(sh.summary(sh.list()).studyMs, 60 * 60000);
});

test('list skips malformed entries instead of throwing', () => {
  const { sh, storage } = setup();
  storage.setItem(KEY, '{"v":1,"entries":[null,{"id":"x","type":"open","app":"a","appTitle":"A","t":5}]}');
  assert.equal(sh.list().length, 1);
  assert.doesNotThrow(() => sh.summary(sh.list()));
});

test('deleteRange removes only entries inside the inclusive range', () => {
  const { sh } = seed();
  assert.equal(sh.deleteRange('2026-09-15', '2026-09-16'), 2);
  assert.deepEqual(kinds(sh.list()), ['quiz:kuwentista:28', 'quiz:word-train:20', 'open:word-train:1']);
});

test('deleting clears the storage-full marker', () => {
  const { sh, storage } = seed();
  storage.setItem('history_error_v1', '123');
  sh.deleteRange('2026-09-01', '2026-09-01');
  assert.equal(sh.storageError(), null);
});

test('deleteAll empties history and reports the count', () => {
  const { sh, storage } = seed();
  assert.equal(sh.deleteAll(), 5);
  assert.equal(storage.getItem(KEY), null);
  assert.deepEqual(sh.list(), []);
});

test('export then import restores identical entries and a second import adds nothing', () => {
  const { sh } = seed();
  const backup = sh.exportJson();
  const other = setup().sh;
  assert.deepEqual(other.importJson(backup), { added: 5, skipped: 0 });
  assert.deepEqual(other.list(), sh.list());
  assert.deepEqual(other.importJson(backup), { added: 0, skipped: 5 });
});

test('import merges with existing entries in time order', () => {
  const { sh } = seed();
  const backup = sh.exportJson();
  sh.deleteRange('2026-09-15', '2026-09-20');
  assert.deepEqual(sh.importJson(backup), { added: 3, skipped: 2 });
  assert.equal(sh.list().length, 5);
  const t = JSON.parse(sh.exportJson()).entries.map((e) => e.t);
  assert.deepEqual(t, [...t].sort((a, b) => a - b));
});

test('import rejects files that are not a history backup and changes nothing', () => {
  const { sh } = seed();
  const before = sh.exportJson();
  for (const bad of ['hello', '{"v":2,"entries":[]}', '{"v":1,"entries":[{"type":"open","t":1,"app":"x"}]}']) {
    assert.throws(() => sh.importJson(bad), /not a Study History backup/);
  }
  assert.equal(sh.exportJson(), before);
});

test('exportCsv names each row with the subject lookup when given one', () => {
  const { sh } = seed();
  const subjects = { 'word-train': 'English' };
  const lines = sh.exportCsv((app, appTitle) => subjects[app] || appTitle).slice(1).split('\r\n');
  assert.equal(lines[1], '2026-09-01,09:00,English,Opened app,,,,,,,,,,');
  assert.equal(lines[2], '2026-09-15,23:59,Kuwentista,Lesson,Pangngalan,,,,,4,8 of 8,,,');
});

test('exportCsv writes one spreadsheet-safe row per entry', () => {
  const { sh } = seed();
  const csv = sh.exportCsv();
  assert.ok(csv.startsWith('﻿'));
  const lines = csv.slice(1).split('\r\n');
  assert.equal(lines[0], 'Date,Time,Subject,Type,Lesson,Score,Answered,Stars,Points,Minutes,Cards viewed,Finished,Wrong answers,Power-ups');
  assert.equal(lines[1], '2026-09-01,09:00,Word Train,Opened app,,,,,,,,,,');
  assert.equal(lines[2], '2026-09-15,23:59,Kuwentista,Lesson,Pangngalan,,,,,4,8 of 8,,,');
  assert.equal(lines[3], '2026-09-16,00:00,Word Train,Quiz,Nouns,8 of 10,10,2,95,5,,Yes,"Pick the noun → run (correct: cat) | Spell ""cat"" → kat (correct: cat)",');
  assert.equal(lines[4], '2026-09-20,10:00,Word Train,Final exam,Final Mock Exam,2 of 4,4,1,20,3,,Yes,Pick the noun → run (correct: cat) | Pick the verb → cat (correct: run),');
  assert.equal(lines[5], '2026-09-28,15:00,Kuwentista,Quiz,Pangngalan,0 of 10,1,,,2,,No,Q → A (correct: B),');
  assert.equal(lines[6], '');
});

test('readers tolerate malformed stored entries without throwing', () => {
  const { sh, storage } = setup();
  storage.setItem(KEY, '{"v":1,"entries":[null,{"id":"x","type":"open","app":"a","appTitle":"A","t":5}]}');
  const csvLines = sh.exportCsv().slice(1).split('\r\n').filter((l) => l !== '');
  assert.equal(csvLines.length, 2);
  const backup = sh.exportJson();
  assert.equal(JSON.parse(backup).entries.length, 1);
  assert.doesNotThrow(() => sh.deleteRange('1970-01-01', '1970-01-01'));
  const other = setup();
  other.storage.setItem(KEY, '{"v":1,"entries":[{"id":"y","type":"open","app":"b","appTitle":"B","t":6}]}');
  assert.deepEqual(other.sh.importJson(backup), { added: 1, skipped: 0 });
});

test('reads never copy corrupt data aside', () => {
  const { sh, storage } = setup();
  storage.setItem(KEY, '{not json');
  sh.list();
  sh.list();
  sh.list();
  const corruptKeys = Object.keys(storage.data).filter((k) => k.startsWith('history_corrupt'));
  assert.deepEqual(corruptKeys, []);
});

test('deleteRange requires both dates to be well-formed, else it changes nothing', () => {
  const { sh } = seed();
  assert.equal(sh.deleteRange('', ''), 0);
  assert.equal(sh.deleteRange('abc', null), 0);
  assert.equal(sh.deleteRange(null, null), 0);
  assert.equal(sh.list().length, 5);
});

test('list uses the same validity check as the exports', () => {
  const { sh, storage } = setup();
  storage.setItem(KEY, '{"v":1,"entries":[{"id":"a","type":"open","t":5},{"id":"b","type":"open","app":"w","appTitle":"W","t":6}]}');
  assert.equal(sh.list().length, 1);
  assert.equal(JSON.parse(sh.exportJson()).entries.length, 1);
  const csvLines = sh.exportCsv().slice(1).split('\r\n').filter((l) => l !== '');
  assert.equal(csvLines.length, 2);
});

test('summary and exportCsv tolerate valid entries with missing or odd fields', () => {
  const { sh } = setup();
  const backup = JSON.stringify({
    v: 1,
    entries: [
      { id: 'q', type: 'quiz', app: 'x', appTitle: 'X', t: 5 },
      { id: 'w', type: 'quiz', app: 'x', appTitle: 'X', t: 6, wrong: [null], finished: true, total: 2, correct: 1 },
      { id: 'l', type: 'lesson', app: 'x', appTitle: 'X', t: 7 },
    ],
  });
  sh.importJson(backup);
  assert.doesNotThrow(() => sh.exportCsv());
  const csv = sh.exportCsv();
  assert.ok(!csv.includes('NaN'));
  assert.ok(!csv.includes('undefined'));
  let summary;
  assert.doesNotThrow(() => { summary = sh.summary(sh.list()); });
  assert.equal(summary.studyMs, 0);
  assert.equal(summary.averagePct, 50);
});

test('deleteAll returns 0 without removing anything when storage cannot be read', () => {
  const { sh, storage } = seed();
  storage.getItem = () => { throw new Error('broken'); };
  let removed = false;
  const realRemove = storage.removeItem;
  storage.removeItem = (k) => { removed = true; realRemove(k); };
  assert.equal(sh.deleteAll(), 0);
  assert.equal(removed, false);
});

test('deleteRange leaves the storage-full marker when nothing is removed', () => {
  const { sh, storage } = seed();
  storage.setItem('history_error_v1', '123');
  assert.equal(sh.deleteRange('2020-01-01', '2020-01-01'), 0);
  assert.equal(sh.storageError(), 123);
});

test('importJson treats "constructor" as an ordinary id, not an inherited property', () => {
  const { sh } = setup();
  const backup = JSON.stringify({ v: 1, entries: [{ id: 'constructor', type: 'open', app: 'a', appTitle: 'A', t: 1 }] });
  assert.deepEqual(sh.importJson(backup), { added: 1, skipped: 0 });
});

test('list and exportCsv break equal timestamps by id', () => {
  const { sh, storage } = setup();
  storage.setItem(KEY, JSON.stringify({
    v: 1,
    entries: [
      { id: 'z', type: 'open', app: 'a', appTitle: 'Zeta', t: 10 },
      { id: 'a', type: 'open', app: 'a', appTitle: 'Alpha', t: 10 },
    ],
  }));
  assert.deepEqual(sh.list().map((e) => e.appTitle), ['Alpha', 'Zeta']);
  const csvLines = sh.exportCsv().slice(1).split('\r\n').filter((l) => l !== '');
  assert.ok(csvLines[1].includes('Alpha'));
  assert.ok(csvLines[2].includes('Zeta'));
});

test('import merge sort breaks equal timestamps by id', () => {
  const { sh } = setup();
  const backup = JSON.stringify({
    v: 1,
    entries: [
      { id: 'z', type: 'open', app: 'a', appTitle: 'Zeta', t: 10 },
      { id: 'a', type: 'open', app: 'a', appTitle: 'Alpha', t: 10 },
    ],
  });
  sh.importJson(backup);
  assert.deepEqual(JSON.parse(sh.exportJson()).entries.map((e) => e.id), ['a', 'z']);
});

test('cardViewed counts distinct cards, so wrapping back does not inflate the count', () => {
  const { sh, storage } = setup();
  const id = sh.lessonOpened('rise-shine', 'Rise & Shine', 'l1', 'Signs', 8);
  sh.cardViewed(id, 1);
  sh.cardViewed(id, 8);
  sh.cardViewed(id, 1);
  assert.equal(saved(storage)[0].cardsViewed, 2);
});

test('quizStarted stores a walkthrough or case kind, and ignores unknown kinds', () => {
  const { sh, storage } = setup();
  sh.quizStarted('math-mastery', 'Math Mastery', 'wt1', 'A baker has 3/4 kg...', false, 5, 'walkthrough');
  sh.quizStarted('math-mastery', 'Math Mastery', 'bibingka', 'Bibingka at the Fiesta', false, 3, 'case');
  sh.quizStarted('math-mastery', 'Math Mastery', 'l1', 'Fractions', false, 10, 'bogus');
  const [w, c, q] = saved(storage);
  assert.equal(w.kind, 'walkthrough');
  assert.equal(c.kind, 'case');
  assert.equal('kind' in q, false);
});

test('exportCsv labels walkthrough and case rounds', () => {
  const { sh, clock } = setup();
  const w = sh.quizStarted('math-mastery', 'Math Mastery', 'wt1', 'Dough problem', false, 5, 'walkthrough');
  sh.quizFinished(w, 0, 65, 5);
  clock.advance(1);
  const c = sh.quizStarted('math-mastery', 'Math Mastery', 'bibingka', 'Bibingka at the Fiesta', false, 3, 'case');
  sh.quizFinished(c, 0, 35, 3);
  const lines = sh.exportCsv().slice(1).split('\r\n');
  assert.match(lines[1], /^[^,]*,[^,]*,Math Mastery,UPAC walkthrough,Dough problem,/);
  assert.match(lines[2], /^[^,]*,[^,]*,Math Mastery,Case study,Bibingka at the Fiesta,/);
  const cols = (line) => line.split(',');
  assert.equal(cols(lines[1])[7], '', 'Stars is blank for a walkthrough row');
  assert.equal(cols(lines[2])[7], '', 'Stars is blank for a case study row');
});

test('exportCsv labels a review round as Review', () => {
  const { sh } = setup();
  const r = sh.quizStarted('word-train', 'Word Train', 'review', 'Review', false, 3, 'review');
  sh.quizAnswered(r, true, 'Q1', 'a', 'a');
  sh.quizFinished(r, 0, 12, 1);
  const lines = sh.exportCsv().slice(1).split('\r\n');
  assert.match(lines[1], /^[^,]*,[^,]*,Word Train,Review,Review,1 of 3,/);
});

test('history is saved as history_v1 in the learner space given, whatever the grade', () => {
  const storage = memStorage();
  const clock = makeClock();
  create(storage, clock.now, 'grade5').appOpened('math-mastery', 'Math Mastery');
  assert.equal(KEY, 'history_v1');
  assert.equal(JSON.parse(storage.getItem('history_v1')).entries.length, 1);
  assert.equal(create(storage, clock.now, 'grade6').list().length, 1, 'moving up a grade keeps her history');
  assert.equal(create(memStorage(), clock.now, 'grade5').list().length, 0, 'another learner starts empty');
});

test('exportJson stamps the entries with the instance\'s grade', () => {
  const { sh } = seed();
  assert.equal(sh.grade, 'grade2');
  assert.equal(JSON.parse(sh.exportJson()).grade, 'grade2');
  const g5 = create(memStorage(), makeClock().now, 'grade5');
  assert.equal(g5.grade, 'grade5');
  assert.equal(JSON.parse(g5.exportJson()).grade, 'grade5');
});

test('importJson rejects a backup from a different grade and changes nothing', () => {
  const { sh } = seed();
  const before = sh.exportJson();
  const g5Backup = create(memStorage(), makeClock().now, 'grade5');
  g5Backup.appOpened('math-mastery', 'Math Mastery');
  assert.throws(() => sh.importJson(g5Backup.exportJson()), /This backup is from a different grade \(grade5\)\./);
  assert.equal(sh.exportJson(), before);
});

test('importJson accepts an older, grade-less backup', () => {
  const { sh } = seed();
  const data = JSON.parse(sh.exportJson());
  delete data.grade;
  const other = setup().sh;
  assert.deepEqual(other.importJson(JSON.stringify(data)), { added: 5, skipped: 0 });
});

test('purchased records a shop purchase that lists, exports and imports like other entries', () => {
  const { sh, storage, clock } = setup();
  const id = sh.purchased('movie', 'Movie night pick', 300);
  const [e] = saved(storage);
  assert.deepEqual(e, {
    type: 'purchase', app: 'shop', appTitle: 'Shop', item: 'movie', itemName: 'Movie night pick', coins: 300,
    id, t: clock.ms, updatedAt: clock.ms,
  });
  assert.equal(sh.list().length, 1);
  assert.deepEqual(sh.summary(sh.list()), { studyMs: 0, quizzes: 0, averagePct: null, mostMissed: null });
  const other = setup().sh;
  assert.deepEqual(other.importJson(sh.exportJson()), { added: 1, skipped: 0 });
});

test('exportCsv labels a shop purchase with the item and its coins', () => {
  const { sh } = setup();
  sh.purchased('dinner', "Choose what's for dinner", 100);
  const lines = sh.exportCsv().slice(1).split('\r\n');
  assert.equal(lines[1], "2026-09-28,15:41,Shop,Shop purchase,Choose what's for dinner (100 coins),,,,,,,,,");
});

test('prunePurchases removes shop purchases older than the last 7 local days and nothing else', () => {
  const { sh, clock } = setup();
  clock.set(2026, 9, 1, 23, 0);
  sh.purchased('dessert', 'Dessert treat', 100);
  sh.appOpened('word-train', 'Word Train');
  clock.set(2026, 9, 2, 0, 30);
  sh.purchased('ml', 'ML game', 40);
  clock.set(2026, 9, 8, 9, 0);
  assert.equal(sh.prunePurchases(7), 1);
  assert.deepEqual(sh.list().map((e) => e.type + ':' + (e.item || e.app)), ['purchase:ml', 'open:word-train']);
  assert.equal(sh.prunePurchases(7), 0);
});

test('exportPurchasesCsv lists only shop purchases, oldest first', () => {
  const { sh, clock } = setup();
  clock.set(2026, 9, 2, 8, 5);
  sh.purchased('ml', 'Rest: play 1 ML game', 40);
  sh.appOpened('word-train', 'Word Train');
  clock.set(2026, 9, 3, 19, 30);
  sh.purchased('dinner', "Choose what's for dinner", 100);
  const lines = sh.exportPurchasesCsv().slice(1).split('\r\n');
  assert.deepEqual(lines, [
    'Date,Time,Item,Coins',
    '2026-09-02,08:05,Rest: play 1 ML game,40',
    "2026-09-03,19:30,Choose what's for dinner,100",
    '',
  ]);
});

test('the study-history file stays ASCII-only, since app pages load it without a charset', () => {
  const src = require('node:fs').readFileSync(engineFile('study-history.js'), 'utf8');
  assert.doesNotMatch(src, /[^\x00-\x7f]/);
});

test('prunePurchases on corrupt history copies nothing aside and writes nothing, however often the lobby loads', () => {
  const { sh, storage } = setup();
  storage.setItem(KEY, '{not json');
  assert.equal(sh.prunePurchases(7), 0);
  assert.equal(sh.prunePurchases(7), 0);
  assert.deepEqual(Object.keys(storage.data), [KEY]);
  assert.equal(storage.getItem(KEY), '{not json');
});

test('powerUpUsed logs each power-up on its quiz, and the CSV lists them with the coins spent', () => {
  const { sh, storage } = setup();
  const id = sh.quizStarted('rise-shine', 'Rise & Shine', 'self', 'Knowing Myself', false, 10);
  sh.powerUpUsed(id, 'hint', 3, '<b>Which</b> is true?');
  sh.powerUpUsed(id, 'fifty', 5, 'Pick one');
  sh.powerUpUsed(null, 'hint', 3, 'no quiz id: ignored');
  assert.deepEqual(saved(storage)[0].powerUps, [
    { kind: 'hint', coins: 3, q: 'Which is true?' },
    { kind: 'fifty', coins: 5, q: 'Pick one' },
  ]);
  assert.equal(sh.powerUpsText(saved(storage)[0]), 'Hint, 50/50 (8 coins)');
  assert.equal(sh.powerUpsText({}), '');
  const lines = sh.exportCsv().slice(1).split('\r\n');
  assert.ok(lines[1].endsWith(',No,,"Hint, 50/50 (8 coins)"'), lines[1]);
});

test('Ask Family uses are named in the power-ups text', () => {
  const { sh, storage } = setup();
  const id = sh.quizStarted('kuwentista', 'Kuwentista', 'x', 'X', false, 10);
  sh.powerUpUsed(id, 'hint', 3, 'Q1');
  sh.powerUpUsed(id, 'ate', 2, 'Q3');
  assert.equal(sh.powerUpsText(saved(storage)[0]), 'Hint, Ask Ate (5 coins)');
});

test('quizAnswered counts answers she typed', () => {
  const { storage, sh } = setup();
  const id = sh.quizStarted('life-lab', 'Life Lab', 'roots', 'Roots', false, 3);
  sh.quizAnswered(id, true, 'Q1', 'Roots', 'Roots', true);
  sh.quizAnswered(id, true, 'Q2', 'Stem', 'Stem', false);
  sh.quizAnswered(id, true, 'Q3', 'Leaf', 'Leaf');
  assert.equal(saved(storage)[0].typed, 1);
});

test('a real test score is stored, listed, findable, never pruned, and exported', () => {
  const { storage, clock, sh } = setup();
  sh.testScore('life-lab', 'Life <b>Lab</b>', 'Science ST1', 14, 15, 40);
  const e = saved(storage)[0];
  assert.deepEqual([e.type, e.app, e.appTitle, e.testName, e.score, e.total, e.coins], ['test', 'life-lab', 'Life Lab', 'Science ST1', 14, 15, 40]);
  assert.equal(sh.list().length, 1);
  assert.equal(sh.findTest('life-lab', 'science st1').id, e.id, 'case-insensitive');
  assert.equal(sh.findTest('life-lab', 'Science ST2'), null);
  assert.equal(sh.findTest('rise-shine', 'Science ST1'), null);
  clock.set(2026, 12, 1, 9, 0);
  sh.prunePurchases(7);
  assert.equal(saved(storage).length, 1, 'only purchases are pruned');
  const row = sh.exportCsv().slice(1).split('\r\n')[1];
  assert.match(row, /,Real test,Science ST1 \(\+40 coins\),14 of 15,/);
  assert.equal(row.split(',').length, 14, 'same column count as every other row');
});

test('a full backup carries points, wallet, rest-days and her name, for its own grade only', () => {
  const { storage, clock } = setup();
  const sh = create(storage, clock.now, 'grade5');
  const state = {
    lifelab_points_v1: '420',
    wallet_v1: '{"v":1,"spent":40}',
    recall_v1: '{"v":1,"rest":{}}',
    review_v1: '{"v":1,"items":{}}',
    mastery_v1: '{"v":1,"apps":{}}',
    quests_v1: '{"v":1}',
    history_v1: '[]',
    'not a key': 'x',
    mathmastery_points_v1: 7,
  };
  const backup = sh.exportJson(state, { id: 'l1', name: 'Ana', emoji: '🌻', grade: 5 });
  assert.deepEqual(sh.backupState(backup), {
    exportedAt: clock.ms,
    state: { lifelab_points_v1: '420', wallet_v1: '{"v":1,"spent":40}', recall_v1: '{"v":1,"rest":{}}', review_v1: '{"v":1,"items":{}}', mastery_v1: '{"v":1,"apps":{}}', quests_v1: '{"v":1}' },
    learner: { name: 'Ana', emoji: '🌻' },
  });
  assert.equal(create(memStorage(), clock.now, 'grade2').backupState(backup), null, 'another grade never restores it');
  assert.deepEqual(create(memStorage(), clock.now, 'grade5').importJson(backup), { added: 0, skipped: 0 }, 'history import still accepts it');
});

test('a backup made before learners still restores: its grade-named keys map to her space', () => {
  const { storage, clock } = setup();
  const sh = create(storage, clock.now, 'grade5');
  const old = JSON.stringify({ v: 1, grade: 'grade5', exportedAt: 5, entries: [], state: {
    lifelab_points_v1: '420', grade5_wallet_v1: '{"v":1,"spent":40}', grade5_recall_v1: '{"v":1,"rest":{}}', grade2_wallet_v1: '{"v":1}',
  } });
  assert.deepEqual(sh.backupState(old), {
    exportedAt: 5,
    state: { lifelab_points_v1: '420', wallet_v1: '{"v":1,"spent":40}', recall_v1: '{"v":1,"rest":{}}' },
    learner: null,
  });
});

test('a history-only backup has no state to restore', () => {
  const { sh } = seed();
  assert.equal(sh.backupState(sh.exportJson()), null);
  assert.equal(JSON.parse(sh.exportJson()).state, undefined);
  assert.equal(sh.backupState('hello'), null);
  assert.equal(sh.backupState('{"v":1,"grade":"grade2","entries":[],"state":[1]}'), null);
});

test('the last full backup time is remembered per learner', () => {
  const { storage, clock } = setup();
  const mine = create(storage, clock.now, 'grade5');
  const sister = create(memStorage(), clock.now, 'grade2');
  assert.equal(mine.lastBackup(), null);
  mine.markBackedUp();
  assert.equal(mine.lastBackup(), clock.ms);
  assert.equal(storage.getItem('last_backup_v1'), String(clock.ms));
  assert.equal(sister.lastBackup(), null);
  mine.deleteAll();
  assert.equal(mine.lastBackup(), clock.ms, 'deleting history does not forget the backup');
});

test('weakSpots ranks lessons by accuracy, needs 5 answers, and keeps the exam separate', () => {
  const { sh } = setup();
  const q = (app, appTitle, lessonTitle, answered, correct, extra) =>
    Object.assign({ type: 'quiz', app, appTitle, lessonTitle, answered, correct, total: 10, finished: answered === 10 }, extra);
  const entries = [
    q('life-lab', 'Life Lab', 'Fungi', 10, 6),
    q('life-lab', 'Life Lab', 'Fungi', 10, 5),
    q('life-lab', 'Life Lab', 'Roots', 10, 9),
    q('life-lab', 'Life Lab', 'Roots', 4, 0),
    q('rise-shine', 'Rise & Shine', 'Gratitude', 3, 0),
    q('life-lab', 'Life Lab', 'Life Lab Review', 20, 13, { final: true }),
    q('math-mastery', 'Math Mastery', 'Dough problem', 5, 2, { kind: 'walkthrough' }),
    { type: 'lesson', app: 'life-lab', appTitle: 'Life Lab', lessonTitle: 'Fungi' },
  ];
  assert.deepEqual(sh.weakSpots(entries).map((s) => [s.appTitle, s.lesson, s.pct, s.correct, s.answered, s.quizzes]), [
    ['Math Mastery', 'UPAC Walkthrough: Dough problem', 40, 2, 5, 1],
    ['Life Lab', 'Fungi', 55, 11, 20, 2],
    ['Life Lab', 'Final Mock Exam', 65, 13, 20, 1],
    ['Life Lab', 'Roots', 64, 9, 14, 2],
  ].sort((a, b) => a[2] - b[2]));
  assert.equal(sh.weakSpots(entries, 2).length, 2);
  assert.deepEqual(sh.weakSpots([]), []);
});

test('a purchase remembers how it was approved: the PIN on the tablet or the parent\'s phone', () => {
  const { sh, storage } = setup();
  sh.purchased('ml', 'ML game', 40, 'phone');
  sh.purchased('ml', 'ML game', 40, 'pin');
  sh.purchased('ml', 'ML game', 40, 'anything else');
  assert.deepEqual(saved(storage).map((e) => e.via), ['phone', 'pin', undefined]);
});

test('a Review round is saved with kind review and kept out of Needs practice', () => {
  const { sh } = setup();
  const id = sh.quizStarted('life-lab', 'Life Lab', 'review', 'Review', false, 5, 'review');
  sh.quizAnswered(id, false, 'Q1', 'x', 'A1');
  sh.quizAnswered(id, false, 'Q2', 'x', 'A2');
  sh.quizAnswered(id, false, 'Q3', 'x', 'A3');
  sh.quizAnswered(id, false, 'Q4', 'x', 'A4');
  sh.quizAnswered(id, false, 'Q5', 'x', 'A5');
  const entries = sh.list();
  assert.equal(entries[0].kind, 'review');
  assert.deepEqual(sh.weakSpots(entries), []);
});
