const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile } = require('./paths.js');
const Pets = require(worldFile('pets.js'));
const PB = require(worldFile('petbody.js'));

// Enough of Three.js and scene.js for the builders to run in Node.
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
const count = (o) => o.children.reduce((n, c) => n + 1 + count(c), 0);
const look = (pet, extra) => Object.assign({ pet, petColor: 0, petSpot: 'walk', petWear: Pets.emptyWear() }, extra);

test('every pet and every gear piece has a builder (a new catalog entry fails here until it is drawn)', () => {
  assert.deepEqual(Object.keys(PB.BODIES).sort(), Pets.PETS.map((p) => p.id).sort());
  assert.deepEqual(Object.keys(PB.GEAR).sort(), Pets.GEAR.map((g) => g.id).sort());
});

test('every pet builds in every colour with anchors, and every mood animates', () => {
  for (const p of Pets.PETS) {
    for (let c = 0; c < Pets.COLORS; c++) {
      const pet = PB.build(fakeS(), look(p.id, { petColor: c }));
      assert.ok(count(pet.body) >= 4, p.id);
      assert.ok(pet.top > 1, p.id + ' top');
      for (const k of ['head', 'neck', 'back', 'face']) assert.equal(pet.anchors[k].length, 3, p.id + ' ' + k);
      for (const m of ['walk', 'idle', 'sit', 'sleep', 'stretch', 'happy', 'munch', undefined]) pet.animate(1.3, m);
    }
  }
});

test('gear goes on its anchor, scaled to the pet', () => {
  const all = { hat: 'pet-crown', neck: 'pet-bell', back: 'pet-wings', glasses: 'pet-sunglasses' };
  for (const p of Pets.PETS) {
    const bare = count(PB.build(fakeS(), look(p.id)).body);
    const dressed = PB.build(fakeS(), look(p.id, { petWear: all }));
    assert.ok(count(dressed.body) > bare + 4, p.id);
    assert.equal(dressed.gear.hat.position.y, dressed.anchors.head[1], p.id);
    assert.equal(dressed.gear.hat.scale.x, dressed.anchors.s, p.id);
  }
  for (const g of Pets.GEAR) {
    const pet = PB.build(fakeS(), look('kitten', { petWear: { [g.slot]: g.id } }));
    assert.ok(count(pet.gear[g.slot]) > 0, g.id);
  }
});

test('a pet rides on her shoulder, head or in her arms; walking pets are not mounted', () => {
  const ch = { mounts: { shoulder: new Obj(), head: new Obj(), arms: new Obj() } };
  const pet = PB.build(fakeS(), look('hamster'));
  assert.equal(PB.mount(pet, ch, 'walk'), false);
  assert.equal(PB.mount(pet, ch, 'shoulder'), true);
  assert.equal(pet.group.parent, ch.mounts.shoulder);
  assert.equal(pet.group.scale.x, PB.MOUNT.shoulder);
  assert.equal(PB.mount(pet, {}, 'head'), false, 'no mounts, no ride');
});

test('every pet has a neck radius, and neck gear is sized to it', () => {
  for (const p of Pets.PETS) {
    const pet = PB.build(fakeS(), look(p.id, { petWear: Object.assign(Pets.emptyWear(), { neck: 'pet-bell' }) }));
    assert.ok(pet.anchors.nr > 0, p.id);
    assert.equal(pet.gear.neck.scale.x, pet.anchors.nr * 2.2, p.id);
  }
});
