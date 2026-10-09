const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile } = require('./paths.js');
const M = require(worldFile('mates.js'));
const Look = require(worldFile('look.js'));

function seeded(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

test('six friends, each with a name, a valid look, a favourite ride and the kind of question they ask', () => {
  assert.deepEqual(M.FRIENDS.map((f) => f.id), ['migo', 'ella', 'tomas', 'bea', 'jun', 'luna']);
  assert.deepEqual(M.FRIENDS.map((f) => f.name), ['Migo', 'Ella', 'Tomas', 'Bea', 'Jun', 'Luna']);
  assert.deepEqual(M.FRIENDS.filter((f) => f.asks === 'study').map((f) => f.id), ['ella', 'bea', 'jun']);
  for (const f of M.FRIENDS) {
    assert.ok(M.RIDES.includes(f.fav), f.id);
    assert.deepEqual(f.look, Look.clean(f.look), f.id + ' look is already clean');
    assert.ok(f.face, f.id);
  }
  assert.equal(new Set(M.FRIENDS.map((f) => M.lookKey(f.look))).size, 6, 'no two friends look the same');
});

test('three new kids each visit, unnamed, fun questions only, never looking like a friend or each other', () => {
  const friends = M.FRIENDS.map((f) => M.lookKey(f.look));
  for (const rand of [() => 0, () => 0.999, seeded(1), seeded(2), seeded(3)]) {
    const kids = M.newKids(rand);
    assert.equal(kids.length, 3);
    const keys = kids.map((k) => M.lookKey(k.look));
    assert.equal(new Set(keys).size, 3);
    for (const k of kids) {
      assert.equal(k.name, '');
      assert.equal(k.asks, 'fun');
      assert.equal(k.isNew, true);
      assert.ok(!friends.includes(M.lookKey(k.look)));
      assert.deepEqual(k.look, Look.clean(k.look));
    }
  }
  assert.deepEqual(M.all(seeded(9)).map((k) => k.id), ['migo', 'ella', 'tomas', 'bea', 'jun', 'luna', 'new1', 'new2', 'new3']);
});

const Q = require(worldFile('matequiz.js'));
const { engineFile } = require('./paths.js');
const { kindOf } = require(engineFile('sync-core.js'));

function memory(initial) {
  const data = Object.assign({}, initial);
  return { data, getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); }, removeItem: (k) => { delete data[k]; } };
}

test('mates_v1 is a synced replace key; junk reads as empty', () => {
  assert.equal(Q.KEY, 'mates_v1');
  assert.equal(kindOf('mates_v1'), 'replace');
  for (const raw of [null, '7', '[1]', '{bad', '{"asked":"x","fun":[1]}']) {
    assert.deepEqual(Q.read(memory(raw === null ? {} : { mates_v1: raw }), 'D1'), { v: 1, day: 'D1', asked: [], fun: {}, t: 0 });
  }
});

test('asked questions are kept for the day; a new day clears them and keeps her fun answers', () => {
  const s = memory();
  Q.markAsked(s, 'D1', 'fun:pet', 5);
  Q.markAsked(s, 'D1', 'fun:pet', 6);
  Q.saveFun(s, 'D1', 'pet', 1, 7);
  assert.deepEqual(Q.read(s, 'D1'), { v: 1, day: 'D1', asked: ['fun:pet'], fun: { pet: 1 }, t: 7 });
  assert.deepEqual(Q.read(s, 'D2'), { v: 1, day: 'D2', asked: [], fun: { pet: 1 }, t: 7 });
});

test('pickers skip what was asked today and give null when nothing is left', () => {
  const bank = [{ id: 'a', choices: ['x', 'y'] }, { id: 'b', choices: ['x', 'y'] }];
  assert.equal(Q.pickFun(bank, ['fun:a'], () => 0).id, 'b');
  assert.equal(Q.pickFun(bank, ['fun:a', 'fun:b'], () => 0), null);
  const cands = [{ app: 'life-lab', item: { q: 'One?' } }, { app: 'life-lab', item: { q: 'Two?' } }];
  assert.equal(Q.pickStudy(cands, [Q.studyKey('life-lab', 'One?')], () => 0).item.q, 'Two?');
  assert.equal(Q.pickStudy(cands, cands.map((c) => Q.studyKey(c.app, c.item.q)), () => 0), null);
  assert.equal(Q.studyKey('x', 'y'.repeat(500)).length, 'study:x:'.length + 120);
});

test('a friend remembers her answer, and each kid has a steady favourite choice', () => {
  const bank = [{ id: 'pet', choices: ['cat', 'dog'] }, { id: 'fruit', choices: ['a', 'b', 'c'] }];
  assert.equal(Q.remembered(bank, {}, () => 0), null);
  assert.deepEqual(Q.remembered(bank, { fruit: 2, gone: 0 }, () => 0), { q: bank[1], choice: 2 });
  assert.equal(Q.remembered(bank, { pet: 5 }, () => 0), null, 'a choice the question no longer has is ignored');
  const favs = new Set();
  for (const kid of ['migo', 'ella', 'tomas', 'bea', 'jun', 'luna']) {
    const f = Q.favourite(kid, bank[1]);
    assert.equal(f, Q.favourite(kid, bank[1]));
    assert.ok(f >= 0 && f < 3);
    favs.add(f);
  }
  assert.ok(favs.size > 1, 'kids like different things');
});

const ML = require(worldFile('matelines.js'));

test('60 fun questions with unique ids, 2-4 unique choices, English and Filipino', () => {
  assert.equal(ML.FUN.length, 60);
  assert.equal(new Set(ML.FUN.map((q) => q.id)).size, 60);
  for (const q of ML.FUN) {
    assert.ok(q.en && q.fil, q.id);
    assert.ok(q.choices.length >= 2 && q.choices.length <= 4, q.id);
    assert.equal(new Set(q.choices).size, q.choices.length, q.id);
    assert.ok(!q.choices.some((c) => c.includes(' · ')), q.id + ': buttons are English only');
  }
  const g5 = ML.fun('grade5'), g2 = ML.fun('grade2');
  assert.equal(g5[0].text, ML.FUN[0].en);
  assert.equal(g5[0].sub, ML.FUN[0].en);
  assert.equal(g2[0].text, ML.FUN[0].fil + ' · ' + ML.FUN[0].en);
  assert.equal(g2[0].sub, ML.FUN[0].fil + '\n' + ML.FUN[0].en);
});

test('every kid line exists in both grades; Grade 2 lines are Filipino · English pairs, Grade 5 lines are not', () => {
  const facts = { gold: 'Science', golds: 3, streak: 4, bossLeft: 2, bossBeaten: false };
  for (const grade of ['grade5', 'grade2']) {
    const T = ML.TEXT[grade], q = ML.fun(grade)[0];
    const said = [].concat(...Object.values(T.hello), T.newHello, T.right, ML.progress(grade, facts),
      ML.progress(grade, { gold: null, golds: 0, streak: 0, bossLeft: 0, bossBeaten: true }),
      T.remember(q, q.choices[0]), T.answerIs('7'), T.same, T.other('🐶 Dogs'), T.thinking, T.pickRide, T.newFriend);
    for (const f of ['migo', 'ella', 'tomas', 'bea', 'jun', 'luna']) assert.ok(T.hello[f].length >= 3, grade + ' ' + f);
    for (const s of said) {
      assert.equal(typeof s, 'string');
      assert.equal(s.includes(' · '), grade === 'grade2', grade + ': ' + s);
    }
    for (const b of [T.play, T.tara, T.yourTurn]) assert.ok(!b.includes(' · '), 'buttons and pops are English only: ' + b);
  }
});

test('progress lines come from what she really did', () => {
  assert.deepEqual(ML.progress('grade5', { gold: null, golds: 0, streak: 1, bossLeft: 0, bossBeaten: false }), []);
  const all = ML.progress('grade5', { gold: 'Math', golds: 3, streak: 5, bossLeft: 0, bossBeaten: true });
  assert.ok(all.some((l) => l.includes('Math')));
  assert.ok(all.some((l) => l.includes('3 gold')));
  assert.ok(all.some((l) => l.includes('5-day')));
  assert.ok(all.some((l) => l.includes('boss')));
  const facts = ML.facts({ apps: { a: { tally: { gold: 1 } }, b: { tally: { gold: 2 } } }, fort: { cleared: 1, total: 4, beaten: false } },
    { a: 'Science', b: 'Math' }, 6);
  assert.deepEqual(facts, { gold: 'Math', golds: 3, streak: 6, bossLeft: 3, bossBeaten: false });
  assert.deepEqual(ML.facts(null, {}, 0), { gold: null, golds: 0, streak: 0, bossLeft: 0, bossBeaten: false });
});
