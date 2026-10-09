const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile } = require('./paths.js');
const F = require(worldFile('furniture.js'));
const R = require(worldFile('room.js'));

const empty = (size) => ({ size, placed: [], wall: 'home-wall-pink', floor: 'home-floor-wood', stars: false });
const all = () => true;
const KEPT = [R.DOOR, R.WALK, R.MIRROR, R.DESK].map((s) => s.join(','));

// A small seeded random, so a failing run can be repeated.
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

test('the room grows with medals: Grade 5 at 8, 20, 40 and 70, Grade 2 at 5, 12, 25 and 40', () => {
  assert.deepEqual([0, 7, 8, 19, 20, 39, 40, 69, 70].map((n) => R.sizeFor('grade5', n)), [4, 4, 5, 5, 6, 6, 7, 7, 8]);
  assert.deepEqual([4, 5, 11, 12, 24, 25, 39, 40].map((n) => R.sizeFor('grade2', n)), [4, 5, 5, 6, 6, 7, 7, 8]);
  assert.equal(R.sizeFor('grade2', 0), 4);
  assert.equal(R.sizeFor('grade5', 1000), 8);
});

test('squares, their centres and the wall squares the door, mirror, shelf and alcove take', () => {
  assert.deepEqual(R.center(0, 0), { x: 201.2, z: 198.8 });
  assert.deepEqual(R.squareAt(201.2, 198.8, 4), { c: 0, r: 0 });
  assert.deepEqual(R.squareAt(200 + 3.5 * 2.4, 200 - 2.5 * 2.4, 4), { c: 3, r: 2 });
  assert.equal(R.squareAt(199, 199, 4), null);
  assert.equal(R.squareAt(201, 190, 4), null, 'row 4 is off a 4x4 room');
  assert.deepEqual(R.WALL_TAKEN(4), ['s1', 's2', 'w1', 'w2']);
  assert.deepEqual(R.WALL_TAKEN(5), ['s1', 's2', 'w1', 'w2']);
  assert.deepEqual(R.WALL_TAKEN(6), ['s1', 's2', 'w1', 'w2', 'n5']);
  assert.deepEqual(R.footprint(F.find('home-bed'), { c: 0, r: 3, turn: 1 }), [[0, 3], [1, 3]]);
  assert.deepEqual(R.wallSquares(F.find('home-lights'), { side: 'n', i: 2 }), ['n2', 'n3']);
});

test('auto-place in an empty 4x4: each hint picks its square', () => {
  const room = empty(4);
  assert.deepEqual(R.autoPlace(F, room, 'home-bed'), { id: 'home-bed', c: 0, r: 3, turn: 1 });
  assert.deepEqual(R.autoPlace(F, room, 'home-lamp'), { id: 'home-lamp', c: 0, r: 3, turn: 0 });
  assert.deepEqual(R.autoPlace(F, room, 'home-rug-round'), { id: 'home-rug-round', c: 1, r: 1, turn: 0 });
  assert.deepEqual(R.autoPlace(F, room, 'home-beanbag'), { id: 'home-beanbag', c: 1, r: 2, turn: 0 }, 'the walkway (1,1) stays clear');
  assert.deepEqual(R.autoPlace(F, room, 'home-poster-stars'), { id: 'home-poster-stars', side: 'n', i: 0 });
  assert.deepEqual(R.autoPlace(F, room, 'home-lights'), { id: 'home-lights', side: 'n', i: 0 });
  assert.equal(R.autoPlace(F, room, 'home-wall-blue'), null, 'a room pick takes no square');
  assert.equal(R.autoPlace(F, room, 'nope'), null);
});

test('auto-place never stands a piece on the door, walkway, mirror or desk square, nor on another piece', () => {
  const placeable = F.ITEMS.filter((it) => it.kind !== 'room').map((it) => it.id);
  let placements = 0;
  for (const size of [4, 5, 6, 7, 8]) {
    for (let seed = 1; seed <= 40; seed++) {
      const rand = rng(seed * 7 + size);
      const ids = placeable.slice().sort(() => rand() - 0.5);
      let room = empty(size);
      for (const id of ids) {
        const next = R.place(F, room, id);
        if (!next) continue;
        room = next;
        placements++;
        const p = room.placed[room.placed.length - 1], it = F.find(id);
        if (it.kind === 'wall') {
          for (const s of R.wallSquares(it, p)) assert.ok(!R.WALL_TAKEN(size).includes(s), id + ' on ' + s);
          continue;
        }
        for (const [c, r] of R.footprint(it, p)) {
          assert.ok(c >= 0 && r >= 0 && c < size && r < size, id + ' off the room');
          assert.notEqual(c + ',' + r, R.DESK.join(','), id + ' on the desk');
          if (!it.rug) assert.ok(!KEPT.includes(c + ',' + r), id + ' stands on a kept square ' + c + ',' + r);
          if (!it.rug && size >= 6) assert.notEqual(c + ',' + r, R.SEAT.join(','), id + ' stands before the window seat');
        }
      }
      // Every square carries at most one standing piece and one rug; every wall square at most one piece.
      const stand = {}, rugs = {}, wall = {};
      room.placed.forEach((p) => {
        const it = F.find(p.id);
        if (it.kind === 'wall') { for (const s of R.wallSquares(it, p)) { assert.ok(!wall[s], s); wall[s] = true; } return; }
        const map = it.rug ? rugs : stand;
        for (const [c, r] of R.footprint(it, p)) { assert.ok(!map[c + ',' + r], p.id + ' overlaps'); map[c + ',' + r] = true; }
      });
      assert.deepEqual(R.repair(F, room, size, all).placed, room.placed, 'auto-placed rooms need no repair');
    }
  }
  assert.ok(placements >= 200, placements + ' placements');
});

test('the starter room: the bed and the round rug where auto-place puts them, pink walls, wooden floor, no stars', () => {
  assert.deepEqual(R.start(F, 4), {
    size: 4, placed: [{ id: 'home-bed', c: 0, r: 3, turn: 1 }, { id: 'home-rug-round', c: 1, r: 1, turn: 0 }],
    wall: 'home-wall-pink', floor: 'home-floor-wood', stars: false
  });
  assert.equal(R.place(F, R.start(F, 4), 'home-bed'), null, 'a piece is placed once');
});

test("a boy's new room has the free blue walls; a girl's stays pink", () => {
  assert.equal(R.start(F, 4, true).wall, 'home-wall-blue');
  assert.equal(R.start(F, 4).wall, 'home-wall-pink');
  assert.deepEqual(R.start(F, 4, true).placed, R.start(F, 4).placed);
});

test('move and turn refuse overlaps, walls and kept squares and leave the room unchanged', () => {
  const room = R.start(F, 4);
  const before = JSON.stringify(room);
  const withLamp = R.place(F, room, 'home-lamp');
  const lamp = withLamp.placed.length - 1;
  assert.deepEqual(withLamp.placed[lamp], { id: 'home-lamp', c: 2, r: 3, turn: 0 }, 'next to the bed');
  assert.equal(R.move(F, withLamp, lamp, 0, 3), null, 'onto the bed');
  assert.equal(R.move(F, withLamp, lamp, 4, 3), null, 'through the east wall');
  assert.equal(R.move(F, withLamp, lamp, 1, 0), null, 'the door square');
  assert.equal(R.move(F, withLamp, lamp, 1, 1), null, 'the walkway');
  assert.equal(R.move(F, withLamp, lamp, 2, 0), null, 'the mirror square');
  assert.equal(R.move(F, withLamp, lamp, 0, 0), null, 'the desk');
  assert.equal(R.move(F, withLamp, lamp, 0.5, 2), null, 'between squares');
  assert.deepEqual(R.move(F, withLamp, lamp, 3, 0).placed[lamp], { id: 'home-lamp', c: 3, r: 0, turn: 0 });
  assert.equal(JSON.stringify(room), before, 'the room itself never changes');
});

test('at 6x6 the square before the window seat stays clear of standing pieces, so 🪑 Sit stays reachable', () => {
  assert.deepEqual(R.SEAT, [5, 5]);
  const room = R.place(F, empty(6), 'home-lamp');
  assert.equal(R.move(F, room, 0, 5, 5), null, 'a lamp cannot stand there');
  assert.ok(!R.spots(F, room, 0).some((s) => s.c === 5 && s.r === 5), 'and the square never glows for it');
  assert.equal(R.fits(F, empty(6), { id: 'home-rug-round', c: 5, r: 5, turn: 0 }), false, 'a 2x2 rug would leave the room');
  assert.equal(R.fits(F, empty(6), { id: 'home-rug-round', c: 4, r: 4, turn: 0 }), true, 'a rug may lie there');
  assert.equal(R.fits(F, empty(6), { id: 'home-tent', c: 4, r: 4, turn: 0 }), false, 'a 2x2 tent would cover it');
  const kept = R.repair(F, { placed: [{ id: 'home-lamp', c: 5, r: 5, turn: 0 }] }, 6, all);
  assert.deepEqual(kept.placed, [], 'an old save with a piece there loses it to storage');
});

test('a 1x2 piece turned a quarter turn is 2x1; turning that would not fit is refused', () => {
  const room = R.place(F, empty(4), 'home-bed');
  assert.equal(R.turn(F, room, 0), null, 'turning back to 1x2 on row 3 would cross the north wall');
  assert.equal(R.move(F, room, 0, 3, 2), null, 'a 2x1 bed is too wide at column 3');
  const moved = R.move(F, room, 0, 2, 2);
  assert.deepEqual(moved.placed[0], { id: 'home-bed', c: 2, r: 2, turn: 1 });
  assert.deepEqual(R.footprint(F.find('home-bed'), moved.placed[0]), [[2, 2], [3, 2]]);
  const turned = R.turn(F, moved, 0);
  assert.deepEqual(turned.placed[0], { id: 'home-bed', c: 2, r: 2, turn: 2 });
  assert.deepEqual(R.footprint(F.find('home-bed'), turned.placed[0]), [[2, 2], [2, 3]]);
  const blocked = R.place(F, moved, 'home-lamp');
  assert.deepEqual(blocked.placed[1], { id: 'home-lamp', c: 0, r: 3, turn: 0 });
  assert.deepEqual(R.turn(F, R.move(F, blocked, 1, 2, 3), 0), null, 'a lamp on (2,3) blocks the turn');
  const wall = R.place(F, empty(4), 'home-poster-stars');
  assert.equal(R.turn(F, wall, 0), null, 'wall pieces never turn');
  assert.equal(R.move(F, wall, 0, 1, 2), null, 'a wall piece moves along the walls only');
  assert.deepEqual(R.moveWall(F, wall, 0, 'e', 3).placed[0], { id: 'home-poster-stars', side: 'e', i: 3 });
  assert.equal(R.moveWall(F, wall, 0, 's', 1), null, 'the door');
  assert.equal(R.moveWall(F, wall, 0, 'w', 2), null, 'the trophy shelf');
  assert.equal(R.moveWall(F, wall, 0, 'n', 4), null, 'off the wall');
  assert.equal(R.moveWall(F, wall, 0, 'x', 0), null);
  const lights = R.place(F, wall, 'home-lights');
  assert.deepEqual(lights.placed[1], { id: 'home-lights', side: 'n', i: 1 });
  assert.equal(R.moveWall(F, lights, 1, 'n', 3), null, 'two squares wide: n3 and n4 do not both exist');
  assert.equal(R.moveWall(F, lights, 1, 's', 0), null, 'its second square would be the door');
  assert.equal(R.moveWall(F, lights, 0, 'n', 2), null, 'onto the lights');
  assert.deepEqual(R.putAway(lights, 0).placed, [{ id: 'home-lights', side: 'n', i: 1 }]);
});

test('rugs lie under one standing piece, never under another rug, and may cover the walkway', () => {
  const room = R.start(F, 4);
  const beanbag = R.place(F, room, 'home-beanbag');
  const b = beanbag.placed[2];
  assert.deepEqual(b, { id: 'home-beanbag', c: 1, r: 2, turn: 0 }, 'on the rug');
  assert.equal(R.fits(F, beanbag, { id: 'home-tea-table', c: 1, r: 2, turn: 0 }), false, 'one standing piece per square');
  assert.equal(R.fits(F, beanbag, { id: 'home-tea-table', c: 2, r: 2, turn: 0 }), true, 'another rug square is free');
  assert.equal(R.fits(F, room, { id: 'home-rug-heart', c: 2, r: 1, turn: 0 }), false, 'a second rug may not overlap the first');
  assert.equal(R.fits(F, room, { id: 'home-rug-heart', c: 2, r: 0, turn: 0 }), false);
  assert.equal(R.fits(F, empty(5), { id: 'home-rug-heart', c: 3, r: 0, turn: 0 }), true);
  assert.equal(R.fits(F, empty(4), { id: 'home-rug-round', c: 1, r: 0, turn: 0 }), true, 'a rug may cover the door, walkway and mirror');
  assert.equal(R.fits(F, empty(4), { id: 'home-rug-round', c: 0, r: 0, turn: 0 }), false, 'never the desk');
  assert.equal(R.fits(F, empty(4), { id: 'home-tent', c: 1, r: 1, turn: 0 }), false, 'a tent stands, so not on the walkway');
  const heart = R.place(F, room, 'home-rug-heart');
  if (heart) for (const [c, r] of R.footprint(F.find('home-rug-heart'), heart.placed[2])) {
    assert.ok(!R.footprint(F.find('home-rug-round'), room.placed[1]).some(([x, y]) => x === c && y === r));
  }
  assert.deepEqual(R.solid(F, beanbag).map((s) => [s.x, s.z]), [[202.4, 191.6], [R.center(1, 2).x, R.center(1, 2).z]], 'the bed and the beanbag block, the rug does not');
});

test('growing keeps every piece on its square', () => {
  let room = R.start(F, 4);
  for (const id of ['home-lamp', 'home-plant', 'home-beanbag', 'home-poster-stars', 'home-lights', 'home-clock', 'home-toybox']) room = R.place(F, room, id) || room;
  const kept = (size) => R.repair(F, room, size, all).placed;
  assert.deepEqual(kept(4), room.placed);
  assert.deepEqual(kept(5), room.placed);
  assert.deepEqual(kept(6), room.placed);
});

test('repair drops what is not hers, unknown, off the room, on a kept square or overlapping, and keeps the rest in order', () => {
  const has = (id) => id !== 'home-aquarium';
  const room = {
    placed: [
      { id: 'home-bed', c: 0, r: 3, turn: 1 },
      { id: 'home-aquarium', c: 3, r: 0, turn: 0 },
      { id: 'home-sofa', c: 3, r: 3, turn: 0 },
      { id: 'home-lamp', c: 4, r: 3, turn: 0 },
      { id: 'home-plant', c: 1, r: 1, turn: 0 },
      { id: 'home-globe', c: 1, r: 3, turn: 0 },
      { id: 'home-rug-round', c: 1, r: 1, turn: 0 },
      { id: 'home-toybox', c: 3, r: 2, turn: 0 },
      { id: 'home-wall-blue', c: 3, r: 1, turn: 0 },
      { id: 'home-toybox', c: 3, r: 1, turn: 0 },
      { id: 'home-poster-stars', side: 'n', i: 5 },
      { id: 'home-clock', side: 's', i: 3 },
      { id: 'home-window', side: 'w', i: 1 },
      { id: 'home-pet-bed', c: 3, r: 1, turn: 7 },
      'junk', null
    ],
    wall: 'home-wall-blue', floor: 'home-wall-pink', stars: true
  };
  const fixed = R.repair(F, room, 6, has);
  assert.deepEqual(fixed.placed, [
    { id: 'home-bed', c: 0, r: 3, turn: 1 },
    { id: 'home-lamp', c: 4, r: 3, turn: 0 },
    { id: 'home-rug-round', c: 1, r: 1, turn: 0 },
    { id: 'home-toybox', c: 3, r: 2, turn: 0 },
    { id: 'home-clock', side: 's', i: 3 }
  ]);
  assert.equal(fixed.size, 6);
  assert.equal(fixed.wall, 'home-wall-blue');
  assert.equal(fixed.floor, 'home-floor-wood', 'a wallpaper is not a floor');
  assert.equal(fixed.stars, true);
  assert.equal(R.repair(F, room, 6, (id) => id !== 'home-star-ceiling').stars, false, 'the star ceiling must be hers');
  assert.equal(R.repair(F, room, 4, has).placed.some((p) => p.id === 'home-lamp'), false, 'column 4 is off a 4x4 room');
  assert.deepEqual(R.repair(F, { placed: [{ id: 'home-poster-stars', side: 'n', i: 5 }] }, 6, all).placed, [], 'n5 is the alcove at 6x6');
  assert.deepEqual(R.repair(F, null, 4, all), { size: 4, placed: [], wall: 'home-wall-pink', floor: 'home-floor-wood', stars: false });
});

test('spots lists exactly the squares where a move succeeds', () => {
  let room = R.start(F, 5);
  for (const id of ['home-lamp', 'home-aquarium', 'home-tent', 'home-poster-stars', 'home-lights']) room = R.place(F, room, id) || room;
  room.placed.forEach((p, k) => {
    const it = F.find(p.id), list = R.spots(F, room, k).map((s) => JSON.stringify(s)), want = [];
    if (it.kind === 'wall') {
      for (const side of ['n', 'e', 'w', 's']) for (let i = -1; i <= 6; i++) if (R.moveWall(F, room, k, side, i)) want.push(JSON.stringify({ side, i }));
    } else {
      for (let r = -1; r <= 6; r++) for (let c = -1; c <= 6; c++) if (R.move(F, room, k, c, r)) want.push(JSON.stringify({ c, r }));
    }
    assert.deepEqual(list.slice().sort(), want.sort(), p.id);
    assert.ok(list.length > 0, p.id + ' can at least stay where it is');
  });
});
