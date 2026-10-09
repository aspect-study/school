const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile } = require('./paths.js');
const Items = require(worldFile('items.js'));
const Wear = require(worldFile('wear.js'));
const Look = require(worldFile('look.js'));

const TABLE = { clothes: 'CLOTHES', hat: 'HATS', glasses: 'GLASSES', back: 'BACK', neck: 'NECK', sticker: 'STICKERS', paint: 'PAINTS', dye: 'DYE', shimmer: 'SHIMMER', prop: 'PROPS' };

test('every catalog item can be drawn (a new item fails here until wear.js draws it)', () => {
  for (const it of Items.ITEMS) {
    const table = Wear[TABLE[it.slot]];
    assert.ok(table && Object.prototype.hasOwnProperty.call(table, it.id), it.id + ' needs a ' + TABLE[it.slot] + ' entry in wear.js');
  }
});

test('wear.js draws nothing that is not in the catalog', () => {
  for (const [slot, name] of Object.entries(TABLE)) {
    for (const id of Object.keys(Wear[name])) assert.equal(Items.find(id) && Items.find(id).slot, slot, name + '.' + id);
  }
});

// A 2D canvas that accepts any drawing call, so the face painters can run in Node.
function fakeCtx() {
  const calls = [];
  return new Proxy({ calls }, {
    get: (t, k) => (k in t ? t[k] : (...args) => { calls.push(k); }),
    set: () => true,
  });
}

test('every eye shape, sticker and face paint paints without errors', () => {
  for (const eyes of Look.OPTIONS.eyes) {
    for (const it of Items.ITEMS.filter((i) => i.slot === 'sticker' || i.slot === 'paint')) {
      const look = Object.assign({}, Look.DEFAULT, { eyes, freckles: true, wear: Object.assign(Items.emptyWear(), { [it.slot]: it.id }) });
      const x = fakeCtx();
      Wear.paintFace(x, look, '#ffe0c7');
      assert.ok(x.calls.length > 10, eyes + ' ' + it.id);
    }
  }
});

function vec(v = 0) {
  return { x: v, y: v, z: v, set(a, b, c) { this.x = a; this.y = b; this.z = c; return this; }, setScalar(k) { this.x = this.y = this.z = k; return this; } };
}
class Obj {
  constructor() { this.children = []; this.position = vec(); this.rotation = vec(); this.scale = vec(1); this.parent = null; this.visible = true; }
  add(c) { this.children.push(c); c.parent = this; return this; }
  remove(c) { this.children = this.children.filter((x) => x !== c); c.parent = null; return this; }
}
function fakeS(mats = []) {
  const geo = () => ({});
  return {
    THREE: { Group: Obj },
    add: (g, m, x, y, z, parent) => { const o = new Obj(); o.position.set(x, y, z); parent.add(o); return o; },
    toon: () => { const m = { emissiveIntensity: 0, disposed: false, dispose() { this.disposed = true; } }; mats.push(m); return m; },
    ball: geo, rbox: geo, cyl: geo, cone: geo, torus: geo,
  };
}

const walk = (o, fn) => { fn(o); o.children.forEach((c) => walk(c, fn)); };
const count = (o) => o.children.reduce((n, c) => n + 1 + count(c), 0);

test('every prop builds in her hand and animates while held and while used', () => {
  for (const it of Items.inGroup('props')) {
    const hand = new Obj(), mats = [], S = fakeS(mats);
    const h = Wear.prop(S, hand, it.id);
    assert.ok(h, it.id + ' builds');
    assert.equal(hand.children.length, 1, it.id + ' is one group in the hand');
    assert.ok(count(hand.children[0]) >= 2, it.id + ' has shapes');
    for (const k of [null, undefined, 0, 0.25, 0.5, 0.75, 1]) {
      h.animate(1.3, k);
      walk(hand, (o) => {
        for (const p of [o.position, o.scale, o.rotation]) for (const a of ['x', 'y', 'z']) assert.ok(Number.isFinite(p[a]), it.id + ' k=' + k + ' ' + a);
      });
    }
    h.dispose();
    assert.equal(hand.children.length, 0, it.id + ' leaves the hand empty');
    for (const m of mats) assert.ok(m.disposed, it.id + ' disposes its own materials');
  }
  assert.equal(Wear.prop(fakeS(), new Obj(), ''), null, 'no prop: nothing');
  assert.equal(Wear.prop(fakeS(), new Obj(), 'crown'), null, 'not a prop: nothing');
});
