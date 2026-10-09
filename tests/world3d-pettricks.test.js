const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile } = require('./paths.js');
const Pets = require(worldFile('pets.js'));
const PT = require(worldFile('pettricks.js'));
const PB = require(worldFile('petbody.js'));

function vec(v = 0) {
  return { x: v, y: v, z: v, set(a, b, c) { this.x = a; this.y = b; this.z = c; return this; }, setScalar(k) { this.x = this.y = this.z = k; return this; } };
}
class Obj {
  constructor() { this.children = []; this.position = vec(); this.rotation = vec(); this.scale = vec(1); this.parent = null; }
  add(c) { this.children.push(c); c.parent = this; return this; }
  remove(c) { this.children = this.children.filter((x) => x !== c); c.parent = null; return this; }
}
const geo = () => ({});
function fakeS() {
  return {
    THREE: { Group: Obj },
    add: (g, m, x, y, z, parent) => { const o = new Obj(); o.position.set(x, y, z); parent.add(o); return o; },
    ball: geo, rbox: geo, cyl: geo, cone: geo, torus: geo,
  };
}
function fakePet() {
  return { body: new Obj(), top: 2.5, anchors: { face: [0, 1.5, 1.1], s: 0.8 } };
}
function rest(b) {
  b.position.set(0, 0, 0);
  b.rotation.set(0, 0, 0);
  b.scale.set(1, 1, 1);
}
const near = (a, b) => Math.abs(a - b) < 1e-6;
const turned = (r) => near(Math.cos(r.x), 1) && near(Math.cos(r.y), 1) && near(Math.cos(r.z), 1);

test('every trick has a move and every toy a shape (a new catalog entry fails here until it is drawn)', () => {
  assert.deepEqual(Object.keys(PT.MOVES).sort(), Pets.TRICKS.map((t) => t.id).sort());
  assert.deepEqual(Object.keys(PT.TOYS).sort(), Pets.TOYS.map((t) => t.id).sort());
});

test('every trick starts and ends at rest, and moves the body in the middle', () => {
  for (const t of Pets.TRICKS) {
    for (const small of [false, true]) {
      const pet = fakePet();
      for (const p of [0, 1]) {
        rest(pet.body);
        PT.trick(pet, t.id, p, small);
        const b = pet.body;
        assert.ok(near(b.position.x, 0) && near(b.position.y, 0) && near(b.position.z, 0), t.id + ' position at ' + p);
        assert.ok(turned(b.rotation), t.id + ' rotation at ' + p);
        assert.deepEqual([b.scale.x, b.scale.y, b.scale.z], [1, 1, 1], t.id + ' scale at ' + p);
      }
      let moved = false;
      for (const p of [0.25, 0.5, 0.75]) {
        rest(pet.body);
        PT.trick(pet, t.id, p, small);
        const b = pet.body;
        if (!near(b.position.y, 0) || !turned(b.rotation)) moved = true;
      }
      assert.ok(moved, t.id + (small ? ' riding' : '') + ' moves');
    }
  }
});

test('riding on her: a third of the hop, and roll and backflip become a spin', () => {
  const pet = fakePet();
  PT.trick(pet, 'trick-jump', 0.5, false);
  const full = pet.body.position.y;
  rest(pet.body);
  PT.trick(pet, 'trick-jump', 0.5, true);
  assert.ok(near(pet.body.position.y, full / 3));
  for (const id of ['trick-roll', 'trick-backflip']) {
    rest(pet.body);
    PT.trick(pet, id, 0.5, true);
    assert.equal(pet.body.rotation.x, 0, id);
    assert.equal(pet.body.rotation.z, 0, id);
    assert.ok(near(pet.body.rotation.y, Math.PI), id + ' spins');
  }
});

test('a roll turns about the middle of the pet, so it never goes under the ground', () => {
  const pet = fakePet();
  for (const id of ['trick-roll', 'trick-backflip']) {
    for (let p = 0; p <= 1; p += 0.05) {
      rest(pet.body);
      PT.trick(pet, id, p, false);
      assert.ok(pet.body.position.y >= -1e-9, id + ' at ' + p);
    }
  }
});

test('an unknown trick does nothing; toys build, and a held toy sits at the pet\'s mouth', () => {
  const pet = fakePet();
  PT.trick(pet, 'trick-nope', 0.5, false);
  assert.ok(turned(pet.body.rotation) && pet.body.position.y === 0);
  for (const t of Pets.TOYS) assert.ok(PT.toy(fakeS(), t.id).children.length > 0, t.id);
  const g = PT.toy(fakeS(), 'toy-ball');
  PT.hold(pet, g);
  assert.equal(g.parent, pet.body);
  assert.ok(near(g.position.z, 1.2));
  assert.equal(g.scale.x, 0.8 * 0.9);
});

test('over a real frame loop (animate, then the trick) no trick drifts away', () => {
  for (const t of Pets.TRICKS) {
    const pet = PB.build(fakeS(), { pet: 'chick', petColor: 0, petSpot: 'walk', petWear: Pets.emptyWear() });
    for (let f = 0; f <= 72; f++) {
      pet.animate(f / 10, 'idle');
      PT.trick(pet, t.id, f / 72, false);
      assert.ok(Math.abs(pet.body.position.x) <= pet.top, t.id + ' x at ' + f);
      assert.ok(Math.abs(pet.body.position.z) <= pet.top, t.id + ' z at ' + f);
    }
    pet.animate(8, 'idle');
    assert.ok(near(pet.body.position.x, 0) && near(pet.body.position.z, 0), t.id + ' back at rest');
  }
});
