const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile } = require('./paths.js');
const F = require(worldFile('furniture.js'));
const Room = require(worldFile('room.js'));
const Layout = require(worldFile('layout.js'));
const R3 = require(worldFile('room3d.js'));

// Anything: every property, call and `new` gives itself back, so drawing code runs without a real Three.js or canvas.
const any = new Proxy(function () {}, {
  get: (t, k) => (k === Symbol.toPrimitive ? () => 0 : k === 'then' ? undefined : any),
  apply: () => any,
  construct: () => any,
  set: () => true,
});
const loose = (o) => new Proxy(o, { get: (t, k) => (k in t ? t[k] : any) });
const vec = (v) => loose({ x: v, y: v, z: v, set(a, b, c) { this.x = a; this.y = b; this.z = c; return this; }, copy(p) { return this.set(p.x, p.y, p.z); } });
class Obj {
  constructor() { this.children = []; this.parent = null; this.userData = {}; this.position = vec(0); this.rotation = vec(0); this.scale = vec(1); }
  add(c) { this.children.push(c); c.parent = this; return this; }
  remove(c) { this.children = this.children.filter((x) => x !== c); c.parent = null; return this; }
  traverse(fn) { fn(this); this.children.forEach((c) => c.traverse(fn)); }
}
const obj = () => loose(new Obj());
let uuid = 0;
const material = () => loose({ uuid: 'm' + ++uuid, clone: material, dispose() {} });
const mesh = (m) => { const o = obj(); o.material = typeof m === 'string' ? material() : m; o.isMesh = true; return o; };
function fakeS() {
  const scene = obj();
  const THREE = new Proxy({}, { get: (t, k) => (k === 'Group' ? function () { return obj(); } : k === 'Mesh' ? function (g, m) { return mesh(m); } : any) });
  return new Proxy({ scene, THREE }, {
    get: (t, k) => {
      if (k in t) return t[k];
      if (k === 'add') return (g, m, x, y, z, parent) => { const o = mesh(m); o.position.set(x || 0, y || 0, z || 0); (parent || scene).add(o); return o; };
      if (k === 'sprite') return () => { const o = obj(); o.material = any; return o; };
      if (k === 'toon') return material;
      return () => any;
    },
  });
}
global.document = { createElement: () => ({ getContext: () => any }) };

const PIECES = F.ITEMS.filter((it) => it.kind === 'floor' || it.kind === 'wall');
const count = (o) => o.children.reduce((n, c) => n + 1 + count(c), 0);

test('every floor and wall piece has a builder, and nothing else does', () => {
  assert.deepEqual(Object.keys(R3.BUILDERS).sort(), PIECES.map((it) => it.id).sort());
});

test('every builder draws on a fake stage, with a modest number of shapes', () => {
  for (const it of PIECES) {
    const g = obj();
    const r = R3.BUILDERS[it.id](fakeS(), g, it) || {};
    const n = count(g);
    assert.ok(n >= 3 && n <= 30, it.id + ' draws ' + n + ' shapes');
    if (r.animate) r.animate(1.7);
  }
});

const ROOM_PICKS = (part) => F.ITEMS.filter((it) => it.kind === 'room' && it.part === part).map((it) => it.id);

// Rooms that together hold every piece: fill one until the next piece does not fit, then start another.
function rooms(size) {
  const out = [];
  let room = Room.start(F, size);
  const shown = new Set(room.placed.map((p) => p.id));
  for (const it of PIECES) {
    if (shown.has(it.id)) continue;
    let next = Room.place(F, room, it.id);
    if (!next) {
      out.push(room);
      room = { size, placed: [], wall: room.wall, floor: room.floor, stars: false };
      next = Room.place(F, room, it.id);
    }
    if (next) { room = next; shown.add(it.id); }
  }
  out.push(room);
  return { rooms: out, shown };
}

test('the room builds and shows at every size with every piece placed', () => {
  for (const grade of ['grade5', 'grade2']) {
    for (const size of [4, 5, 6, 7, 8]) {
      const S = fakeS();
      const apps = Layout.APPS[grade];
      const view = R3.create(S, { grade, apps, stars: false });
      assert.equal(S.scene.children.length, 1, 'one group in the scene');
      const { rooms: list, shown } = rooms(size);
      assert.deepEqual([...shown].sort(), PIECES.map((it) => it.id).sort(), 'every piece fits somewhere at ' + size);
      const trophies = {};
      apps.forEach((a, i) => { trophies[a.app] = i % 4; });
      const walls = ROOM_PICKS('wall'), floors = ROOM_PICKS('floor');
      list.forEach((room, k) => {
        view.show(Object.assign({}, room, { wall: walls[k % walls.length], floor: floors[k % floors.length], stars: true, trophies }));
        const placed = view.group.children[1].children;
        assert.equal(placed.length, room.placed.length, 'one group per placed piece');
        placed.forEach((n, j) => assert.deepEqual(n.userData.hit, { kind: 'item', k: j }));
        view.select(0);
        view.glow(Room.spots(F, room, 0));
        view.fade(true);
        view.shake(0);
        view.animate(1.2, 0.016);
        view.ghost({ id: 'home-lights', side: 'n', i: 0 }, 'home-lights');
        view.roomGhost('wall', 'home-wall-stars');
        view.animate(1.3, 0.016);
        view.ghost(null);
        view.roomGhost('wall', null);
        view.fade(false);
        view.glow(null);
        view.select(null);
      });
      for (const a of apps) {
        const p = view.trophyAt(a.app);
        assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z), a.app);
        assert.ok(p.y > 3.3 && p.y < Room.WALL_H, a.app + ' sits above furniture height');
        assert.ok(Room.squareAt(p.x, p.z, size).c === 0, a.app + ' is on the west wall');
      }
      assert.equal(view.trophyAt('nope'), null);
      assert.equal(view.hit({ intersectObjects: () => [] }), null);
      view.dispose();
      assert.equal(S.scene.children.length, 0, 'dispose takes the room out of the scene');
    }
  }
});

test('show keeps the groups of pieces that did not move and replaces the rest', () => {
  const view = R3.create(fakeS(), { grade: 'grade5', apps: Layout.APPS.grade5 });
  const room = Room.place(F, Room.start(F, 4), 'home-lamp');
  view.show(room);
  const before = view.group.children[1].children.slice();
  const moved = Room.putAway(room, 0);
  view.show(moved);
  const after = view.group.children[1].children;
  assert.equal(after.length, 2);
  assert.ok(after.includes(before[1]) && after.includes(before[2]), 'the rug and the lamp keep their groups');
  assert.ok(!after.includes(before[0]), 'the bed is gone');
});

test('hit names what the ray meets: a piece just behind a floor square (a rug) wins', () => {
  const view = R3.create(fakeS(), { grade: 'grade2', apps: Layout.APPS.grade2 });
  const room = Room.start(F, 4);
  view.show(room);
  const layer = view.group.children[1];
  const floorTile = (c, r) => { let t = null; view.group.traverse((o) => { if (o.userData.hit && o.userData.hit.kind === 'floor' && o.userData.hit.c === c && o.userData.hit.r === r) t = o; }); return t; };
  const rug = layer.children[1].children[0].children[0];
  const ray = (hits) => ({ intersectObjects: () => hits });
  assert.deepEqual(view.hit(ray([{ object: floorTile(1, 1), distance: 10 }, { object: rug, distance: 10.05 }])), { kind: 'item', k: 1, sq: { c: 1, r: 1 } });
  assert.deepEqual(view.hit(ray([{ object: floorTile(1, 1), distance: 10 }, { object: rug, distance: 13 }])), { kind: 'floor', c: 1, r: 1 });
  assert.equal(view.hit(ray([{ object: obj(), distance: 3 }])), null);
});

test('the walls the camera stands beyond turn see-through, with what hangs on them; Decorate fades south and east', () => {
  const view = R3.create(fakeS(), { grade: 'grade5', apps: Layout.APPS.grade5 });
  const room = Room.place(F, Room.start(F, 4), 'home-poster-stars');
  view.show(room);
  const L = 4 * Room.SQ, O = Room.ORIGIN;
  const poster = view.group.children[1].children[2];
  const faded = (n) => { let any = false; n.traverse((o) => { if (o.userData.solid) any = true; }); return any; };
  assert.deepEqual(view.seeThrough(), []);
  view.see(O.x + L / 2, O.z + 6);
  assert.deepEqual(view.seeThrough(), ['s'], 'behind the south wall');
  assert.equal(faded(poster), false, 'the poster on the north wall stays');
  view.see(O.x - 3, O.z - L - 2);
  assert.deepEqual(view.seeThrough(), ['n', 'w'], 'beyond the north-west corner');
  assert.equal(faded(poster), true, 'the poster on the north wall fades with it');
  view.see(O.x + L / 2, O.z - L / 2);
  assert.deepEqual(view.seeThrough(), [], 'from inside, every wall is solid');
  assert.equal(faded(poster), false, 'and the poster is back');
  view.fade(true);
  assert.deepEqual(view.seeThrough(), ['e', 's'], 'the Decorate view');
  view.see(O.x - 3, O.z - L / 2);
  assert.deepEqual(view.seeThrough(), ['e', 'w', 's']);
  view.fade(false);
  assert.deepEqual(view.seeThrough(), ['w']);
  view.dispose();
});
