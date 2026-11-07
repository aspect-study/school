const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile } = require('./paths.js');
const L = require(worldFile('layout.js'));
const Up = require(worldFile('upstairs.js'));

const TERMS = { 'history-explorers': { lessons: 9, exams: 0, ids: ['kolonyalismo', 'bandalagalyon'] }, 'life-lab': { lessons: 0, exams: 1, ids: ['st1'] } };
const GRADES = ['grade5', 'grade2'];

test('every building has a balcony, stairs and spots; the stairs foot is free and clear of the door and the street', () => {
  GRADES.forEach((g) => {
    const obs = L.obstacles(g), bounds = L.GRADES[g].bounds;
    obs.circles = obs.circles.concat(Up.solids(g));
    const doors = L.interactables(g).filter((it) => it.kind === 'door' || it.kind === 'buddy');
    Up.all(g, TERMS).forEach((i) => {
      assert.equal(L.blocked(obs, bounds, i.foot.x, i.foot.z, L.PLAYER_R), false, i.app + ' foot is walkable');
      assert.ok(Math.abs(i.foot.x) > L.STREET.half + L.PLAYER_R, i.app + ' foot is off the street');
      doors.forEach((d) => assert.ok(Math.hypot(d.x - i.foot.x, d.z - i.foot.z) > d.r + Up.FOOT_R, i.app + ' foot clear of ' + d.id));
      const box = i.box;
      assert.ok(box.maxX - box.minX > 2 * L.PLAYER_R && box.maxZ - box.minZ > 2 * L.PLAYER_R, 'room to walk on the balcony');
      [i.head, i.down, i.door, i.exam].forEach((p) => assert.equal(Up.blocked(i, p.x, p.z, L.PLAYER_R), false, i.app + ' spot on the balcony'));
      const items = Up.items(i), at = L.nearest(items, i.head.x, i.head.z);
      assert.equal(at, null, i.app + ': she lands clear of every balcony spot');
      assert.equal(L.nearest(items, i.door.x, i.door.z).kind, 'up-door');
      assert.equal(L.nearest(items, i.exam.x, i.exam.z).kind, 'up-exam');
      assert.equal(L.nearest(items, i.down.x, i.down.z).kind, 'stairs-down');
      assert.equal(Up.blocked(i, i.door.x, i.door.z + 6, L.PLAYER_R), true, 'the railing ends the balcony');
    });
  });
});

test('the stairs stand between buildings, never on a neighbour', () => {
  GRADES.forEach((g) => {
    const bs = L.buildings(g);
    Up.all(g, {}).forEach((i) => bs.forEach((b) => {
      const inX = Math.abs(i.stairs.x - b.x) < L.BUILDING.hx + i.stairs.r, inZ = Math.abs(i.stairs.z - b.z) < L.BUILDING.hz + i.stairs.r;
      assert.ok(!(inX && inZ), i.app + ' stairs clear of ' + b.app);
    }));
  });
});

test('feet: one Go up spot per building', () => {
  GRADES.forEach((g) => {
    const feet = Up.feet(g);
    assert.equal(feet.length, L.APPS[g].length);
    feet.forEach((f) => assert.deepEqual([f.kind, f.id], ['stairs-up', 'up:' + f.app]));
  });
});

test('ready states: the door needs a Term 2 lesson, the exam board any Term 2 lesson', () => {
  const he = Up.find('grade5', TERMS, 'history-explorers'), ll = Up.find('grade5', TERMS, 'life-lab'), fil = Up.find('grade5', TERMS, 'wikaharian');
  assert.deepEqual([he.ready, he.examReady], [true, true]);
  assert.deepEqual([ll.ready, ll.examReady], [false, true]);
  assert.deepEqual([fil.ready, fil.examReady], [false, false]);
  assert.equal(Up.find('grade5', TERMS, 'nope'), null);
});

test('links: ground Term 1, balcony Term 2, exam board Term 2 exam', () => {
  const he = Up.find('grade5', TERMS, 'history-explorers');
  assert.deepEqual(Up.links('grade5', he, null, TERMS), {
    ground: '../subjects/grade-5/araling-panlipunan/index.html?reset=1&term=1',
    upper: '../subjects/grade-5/araling-panlipunan/index.html?reset=1&term=2',
    exam: '../subjects/grade-5/araling-panlipunan/index.html?reset=1&term=2&exam=1'
  });
});

test('the guide: a Term 2 lesson step goes upstairs, a Term 1 lesson stays down, review and boss keep both terms', () => {
  const he = Up.find('grade5', TERMS, 'history-explorers'), base = '../subjects/grade-5/araling-panlipunan/index.html?reset=1';
  const t2 = { step: { kind: 'lesson', app: 'history-explorers', lesson: 'bandalagalyon' }, stepHref: base + '&lesson=bandalagalyon' };
  const t1 = { step: { kind: 'lesson', app: 'history-explorers', lesson: 'unang-aralin' }, stepHref: base + '&lesson=unang-aralin' };
  const boss = { step: { kind: 'boss', app: 'history-explorers' }, stepHref: base + '&boss=1' };
  const other = { step: { kind: 'lesson', app: 'life-lab', lesson: 'x' }, stepHref: '../subjects/grade-5/science/index.html?reset=1&lesson=x' };
  assert.equal(Up.stepFloor(t2, TERMS), 'upper');
  assert.equal(Up.stepFloor(t1, TERMS), 'ground');
  assert.equal(Up.stepFloor(boss, TERMS), 'ground');
  assert.equal(Up.stepFloor(null, TERMS), 'ground');
  assert.equal(Up.stepHref(t2, TERMS), base + '&lesson=bandalagalyon&term=2');
  assert.equal(Up.stepHref(t1, TERMS), base + '&lesson=unang-aralin&term=1');
  assert.equal(Up.stepHref(boss, TERMS), base + '&boss=1');
  assert.equal(Up.stepHref({ step: { kind: 'shop', shop: true }, stepHref: null }, TERMS), null);
  assert.equal(Up.links('grade5', he, t2, TERMS).upper, base + '&lesson=bandalagalyon&term=2');
  assert.equal(Up.links('grade5', he, t2, TERMS).ground, base + '&term=1');
  assert.equal(Up.links('grade5', he, t1, TERMS).ground, base + '&lesson=unang-aralin&term=1');
  assert.equal(Up.links('grade5', he, boss, TERMS).ground, base + '&boss=1');
  assert.equal(Up.links('grade5', he, other, TERMS).ground, base + '&term=1', "another game's step changes nothing here");
  const visit = { step: { kind: 'visit', app: 'history-explorers' }, stepHref: base };
  assert.equal(Up.links('grade5', he, visit, TERMS).ground, base + '&term=1', 'a first visit keeps the Term 1 door');
  assert.equal(Up.buddyHref('grade5', he, visit, TERMS), base + '&term=2', 'and the buddy opens Term 2 once it is ready');
});

test('a buddy opens Term 2 when it is ready, else Term 1; the guide step in its game wins', () => {
  const he = Up.find('grade5', TERMS, 'history-explorers'), fil = Up.find('grade5', TERMS, 'wikaharian');
  const base = '../subjects/grade-5/araling-panlipunan/index.html?reset=1';
  assert.equal(Up.buddyHref('grade5', he, null, TERMS), base + '&term=2');
  assert.equal(Up.buddyHref('grade5', fil, null, TERMS), '../subjects/grade-5/filipino/index.html?reset=1&term=1');
  const boss = { step: { kind: 'boss', app: 'history-explorers' }, stepHref: base + '&boss=1' };
  assert.equal(Up.buddyHref('grade5', he, boss, TERMS), base + '&boss=1');
  const t1 = { step: { kind: 'lesson', app: 'history-explorers', lesson: 'a' }, stepHref: base + '&lesson=a' };
  assert.equal(Up.buddyHref('grade5', he, t1, TERMS), base + '&lesson=a&term=1');
});
