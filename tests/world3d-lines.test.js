const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile } = require('./paths.js');
const L = require(worldFile('layout.js'));
const B = require(worldFile('buddies.js'));
const { TEXT, QUOTES } = require(worldFile('lines.js'));

// Every string or function result inside an object, called with sample arguments.
function said(o, path = '') {
  return Object.keys(o).flatMap((k) => {
    const v = o[k];
    if (typeof v === 'function') return [[path + k, v(2, '🎮 ML game')], [path + k + '(1)', v(1, 'Math')]];
    if (Array.isArray(v)) return v.map((s, i) => [path + k + '.' + i, s]);
    if (v && typeof v === 'object') return said(v, path + k + '.');
    return [[path + k, v]];
  });
}

for (const grade of ['grade5', 'grade2']) {
  test(grade + ': every door has a buddy, built from known parts', () => {
    const apps = L.buildings(grade).map((b) => b.app);
    assert.deepEqual(Object.keys(B.BUDDIES[grade]).sort(), apps.slice().sort(), 'a new game needs a buddy in web/world/buddies.js');
    const names = new Set();
    for (const app of apps) {
      const b = B.BUDDIES[grade][app];
      assert.ok(b.name && b.face && b.hi, app);
      assert.ok(!names.has(b.name), app + ' has a name of its own');
      names.add(b.name);
      assert.ok(B.KINDS.includes(b.look.kind), app + ' kind');
      assert.match(b.look.fur, /^#[0-9a-f]{6}$/i, app + ' fur');
      if (b.look.prop) assert.ok(B.PROPS.includes(b.look.prop), app + ' prop');
      if (b.look.hat) assert.ok(B.HATS.includes(b.look.hat), app + ' hat');
      if (grade === 'grade2') assert.match(b.hi, / · /, app + ' hello is Filipino · English');
    }
  });
}

test('both grades have the same lines', () => {
  assert.deepEqual(said(TEXT.grade2).map((x) => x[0]), said(TEXT.grade5).map((x) => x[0]));
});

test('Grade 2 lines pair Filipino with English; Grade 5 lines are English', () => {
  for (const [k, v] of said(TEXT.grade2)) assert.match(v, / · /, k);
  for (const [k, v] of said(TEXT.grade5)) assert.doesNotMatch(v, / · /, k);
});

test('counts read right in English', () => {
  assert.match(TEXT.grade5.due(1), /1 question is /);
  assert.match(TEXT.grade5.due(3), /3 questions are /);
  assert.match(TEXT.grade5.toGold(1), /1 more lesson for gold/);
  assert.match(TEXT.grade5.toGold(2), /2 more lessons for gold/);
  assert.equal(TEXT.grade5.right(0), '🎉 Right!');
  assert.equal(TEXT.grade5.right(14), '🎉 Right! +14 points');
});

const FIL_WRONG = /tunog tama|natutunan|\bpwede\b|nakakatakot|^Tapos\b/i;

test('Grade 2 lines and buddy hellos follow the Filipino wording rules', () => {
  for (const [k, v] of said(TEXT.grade2)) assert.doesNotMatch(v, FIL_WRONG, k);
  for (const [app, b] of Object.entries(B.BUDDIES.grade2)) assert.doesNotMatch(b.hi, FIL_WRONG, app);
});

test('60 different quotes, each Filipino · English', () => {
  assert.equal(QUOTES.length, 60);
  assert.equal(new Set(QUOTES.map((q) => q[1])).size, 60);
  for (const [fil, en] of QUOTES) {
    assert.ok(fil && en && !fil.includes(' · ') && !en.includes(' · '), en);
    assert.doesNotMatch(fil, FIL_WRONG, fil);
  }
});
