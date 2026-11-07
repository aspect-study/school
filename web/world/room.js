/* My Room's squares: its size from her medals, which squares stay clear, where a piece fits, auto-place, move, turn,
   put away and the load repair. Pure (no 3D), so the Node tests can read it. cat is the Furniture catalog, passed in.
   A room is { size, placed, wall, floor, stars }; a floor piece is { id, c, r, turn } with (c, r) its south-west
   square, a wall piece { id, side, i }. Columns run west to east, rows south to north. */
(function (root) {
  'use strict';

  var SQ = 2.4;
  var ORIGIN = { x: 200, z: 200 };
  var WALL_H = 5.5;
  // [medals, size]: the room grows at these counts of lessons with a medal.
  var SIZES = { grade5: [[0, 4], [8, 5], [20, 6], [40, 7], [70, 8]], grade2: [[0, 4], [5, 5], [12, 6], [25, 7], [40, 8]] };
  var DOOR = [1, 0], WALK = [1, 1], MIRROR = [2, 0], DESK = [0, 0], SEAT = [5, 5];
  var SIDES = ['n', 'e', 'w', 's'];

  function sizeFor(grade, medals) {
    var steps = SIZES[grade === 'grade2' ? 'grade2' : 'grade5'], size = steps[0][1];
    steps.forEach(function (s) { if (medals >= s[0]) size = s[1]; });
    return size;
  }

  // The door, the mirror and the trophy shelf take these wall squares; at 6x6 the window seat's alcove takes n5.
  function WALL_TAKEN(size) { return size >= 6 ? ['s1', 's2', 'w1', 'w2', 'n5'] : ['s1', 's2', 'w1', 'w2']; }

  function center(c, r) { return { x: ORIGIN.x + (c + 0.5) * SQ, z: ORIGIN.z - (r + 0.5) * SQ }; }
  function squareAt(x, z, size) {
    var c = Math.floor((x - ORIGIN.x) / SQ), r = Math.floor((ORIGIN.z - z) / SQ);
    return c >= 0 && r >= 0 && c < size && r < size ? { c: c, r: r } : null;
  }

  function isInt(v) { return typeof v === 'number' && isFinite(v) && Math.floor(v) === v; }
  function same(a, c, r) { return a[0] === c && a[1] === r; }
  function dims(it, turn) {
    var w = it.size[0], d = it.size[1];
    return turn % 2 ? [d, w] : [w, d];
  }
  function footprint(it, p) {
    var wd = dims(it, p.turn || 0), out = [];
    for (var dc = 0; dc < wd[0]; dc++) for (var dr = 0; dr < wd[1]; dr++) out.push([p.c + dc, p.r + dr]);
    return out;
  }
  function wallSquares(it, p) {
    var out = [];
    for (var k = 0; k < it.size[0]; k++) out.push(p.side + (p.i + k));
    return out;
  }
  function touchesWall(sq, size) {
    return sq.some(function (s) { return s[0] === 0 || s[1] === 0 || s[0] === size - 1 || s[1] === size - 1; });
  }

  // Whether p fits in the room, ignoring placed piece number skip (the one being moved or turned).
  function fits(cat, room, p, skip) {
    var it = p ? cat.find(p.id) : null, size = room.size;
    if (!it || it.kind === 'room') return false;
    var others = room.placed.filter(function (q, k) { return k !== skip; });
    if (it.kind === 'wall') {
      if (SIDES.indexOf(p.side) < 0 || !isInt(p.i)) return false;
      var mine = wallSquares(it, p), taken = WALL_TAKEN(size);
      if (p.i < 0 || p.i + it.size[0] > size) return false;
      var used = {};
      others.forEach(function (q) {
        var o = cat.find(q.id);
        if (o && o.kind === 'wall') wallSquares(o, q).forEach(function (s) { used[s] = true; });
      });
      return mine.every(function (s) { return taken.indexOf(s) < 0 && !used[s]; });
    }
    if (!isInt(p.c) || !isInt(p.r) || !isInt(p.turn || 0)) return false;
    var sq = footprint(it, p), rug = !!it.rug;
    var ok = sq.every(function (s) {
      if (s[0] < 0 || s[1] < 0 || s[0] >= size || s[1] >= size || same(DESK, s[0], s[1])) return false;
      // At 6x6 the square before the window seat stays clear too, so she can reach 🪑 Sit.
      return rug || !(same(DOOR, s[0], s[1]) || same(WALK, s[0], s[1]) || same(MIRROR, s[0], s[1]) || (size >= 6 && same(SEAT, s[0], s[1])));
    });
    if (!ok) return false;
    // A rug lies under one standing piece: rugs never overlap rugs, standing pieces never overlap standing pieces.
    var used2 = {};
    others.forEach(function (q) {
      var o = cat.find(q.id);
      if (o && o.kind === 'floor' && !!o.rug === rug) footprint(o, q).forEach(function (s) { used2[s[0] + ',' + s[1]] = true; });
    });
    return sq.every(function (s) { return !used2[s[0] + ',' + s[1]]; });
  }

  function floorScan(size) {
    var out = [];
    for (var r = size - 1; r >= 0; r--) for (var c = 0; c < size; c++) out.push({ c: c, r: r, turn: 0 }, { c: c, r: r, turn: 1 });
    return out;
  }
  function wallScan(size) {
    var out = [], i;
    for (i = 0; i < size; i++) out.push({ side: 'n', i: i });
    for (i = size - 1; i >= 0; i--) out.push({ side: 'e', i: i });
    for (i = size - 1; i >= 0; i--) out.push({ side: 'w', i: i });
    for (i = 0; i < size; i++) out.push({ side: 's', i: i });
    return out;
  }

  // Where a piece goes when she picks it: wall-side touches a wall (from the north-west), middle is nearest the centre
  // (ties to the earlier wall-side scan spot), wall the first free wall square (north, east, west, then south).
  function autoPlace(cat, room, id) {
    var it = cat.find(id), size = room.size;
    if (!it || it.kind === 'room') return null;
    if (it.kind === 'wall') {
      var w = wallScan(size).map(function (s) { return { id: id, side: s.side, i: s.i }; });
      for (var k = 0; k < w.length; k++) if (fits(cat, room, w[k])) return w[k];
      return null;
    }
    var spots = floorScan(size).map(function (s) { return { id: id, c: s.c, r: s.r, turn: s.turn }; })
      .filter(function (p) { return fits(cat, room, p); });
    if (it.hint === 'middle') {
      var best = null, bestD = Infinity, mid = size / 2;
      spots.forEach(function (p) {
        var wd = dims(it, p.turn), dx = p.c + wd[0] / 2 - mid, dz = p.r + wd[1] / 2 - mid, d = dx * dx + dz * dz;
        if (d < bestD - 1e-9) { best = p; bestD = d; }
      });
      return best;
    }
    for (var j = 0; j < spots.length; j++) if (touchesWall(footprint(it, spots[j]), size)) return spots[j];
    return null;
  }

  function withPlaced(room, placed) {
    var out = Object.assign({}, room);
    out.placed = placed;
    return out;
  }
  function placedIds(room) { return room.placed.map(function (q) { return q.id; }); }

  function place(cat, room, id) {
    if (placedIds(room).indexOf(id) >= 0) return null;
    var p = autoPlace(cat, room, id);
    return p ? withPlaced(room, room.placed.concat([p])) : null;
  }

  function replaceAt(cat, room, k, p) {
    if (!fits(cat, room, p, k)) return null;
    var placed = room.placed.slice();
    placed[k] = p;
    return withPlaced(room, placed);
  }
  function kindAt(cat, room, k) {
    var q = room.placed[k], it = q ? cat.find(q.id) : null;
    return it ? it.kind : null;
  }

  function move(cat, room, k, c, r) {
    if (kindAt(cat, room, k) !== 'floor') return null;
    var q = room.placed[k];
    return replaceAt(cat, room, k, { id: q.id, c: c, r: r, turn: q.turn || 0 });
  }
  function moveWall(cat, room, k, side, i) {
    if (kindAt(cat, room, k) !== 'wall') return null;
    return replaceAt(cat, room, k, { id: room.placed[k].id, side: side, i: i });
  }
  // A quarter turn about the piece's south-west square; wall pieces never turn.
  function turn(cat, room, k) {
    if (kindAt(cat, room, k) !== 'floor') return null;
    var q = room.placed[k];
    return replaceAt(cat, room, k, { id: q.id, c: q.c, r: q.r, turn: ((q.turn || 0) + 1) % 4 });
  }
  function putAway(room, k) { return withPlaced(room, room.placed.filter(function (q, j) { return j !== k; })); }

  // Where piece k could move with its current turn (the squares that glow while it is selected).
  function spots(cat, room, k) {
    var kind = kindAt(cat, room, k), q = room.placed[k], out = [], size = room.size;
    if (kind === 'wall') {
      SIDES.forEach(function (side) {
        for (var i = 0; i < size; i++) if (fits(cat, room, { id: q.id, side: side, i: i }, k)) out.push({ side: side, i: i });
      });
    } else if (kind === 'floor') {
      for (var r = 0; r < size; r++) for (var c = 0; c < size; c++) {
        if (fits(cat, room, { id: q.id, c: c, r: r, turn: q.turn || 0 }, k)) out.push({ c: c, r: r });
      }
    }
    return out;
  }

  function roomPick(cat, id, part, has, fallback) {
    var it = cat.find(id);
    return it && it.kind === 'room' && it.part === part && has(id) ? id : fallback;
  }
  function starsId(cat) {
    var it = cat.ITEMS.filter(function (x) { return x.kind === 'room' && x.part === 'stars'; })[0];
    return it ? it.id : '';
  }

  // The saved room made safe for this size: each piece she owns (has(id)) and this version knows, once, on the room,
  // off the kept-clear squares and not overlapping an earlier one; walls and floor fall back to the starters.
  function repair(cat, room, size, has) {
    room = room && typeof room === 'object' ? room : {};
    var out = { size: size, placed: [], wall: cat.STARTER_ROOM.wall, floor: cat.STARTER_ROOM.floor, stars: false };
    (Array.isArray(room.placed) ? room.placed : []).forEach(function (q) {
      if (!q || typeof q !== 'object' || typeof q.id !== 'string' || !has(q.id)) return;
      var it = cat.find(q.id);
      if (!it || it.kind === 'room' || placedIds(out).indexOf(q.id) >= 0) return;
      var p = it.kind === 'wall' ? { id: q.id, side: q.side, i: q.i } : { id: q.id, c: q.c, r: q.r, turn: q.turn === undefined ? 0 : q.turn };
      if (it.kind === 'floor' && !(p.turn >= 0 && p.turn <= 3)) return;
      if (fits(cat, out, p)) out.placed.push(p);
    });
    out.wall = roomPick(cat, room.wall, 'wall', has, out.wall);
    out.floor = roomPick(cat, room.floor, 'floor', has, out.floor);
    out.stars = room.stars === true && has(starsId(cat));
    return out;
  }

  // A new room: the starter pieces auto-placed in order; a boy's walls are the free blue ones.
  function start(cat, size, boy) {
    var room = { size: size, placed: [], wall: boy ? 'home-wall-blue' : cat.STARTER_ROOM.wall, floor: cat.STARTER_ROOM.floor, stars: false };
    cat.STARTER_ROOM.placed.forEach(function (id) { room = place(cat, room, id) || room; });
    return room;
  }

  // Standing pieces as boxes she and her pet cannot walk through (rugs and wall pieces are skipped).
  function solid(cat, room) {
    var out = [];
    room.placed.forEach(function (q) {
      var it = cat.find(q.id);
      if (!it || it.kind !== 'floor' || it.rug) return;
      var wd = dims(it, q.turn || 0);
      out.push({ x: ORIGIN.x + (q.c + wd[0] / 2) * SQ, z: ORIGIN.z - (q.r + wd[1] / 2) * SQ, hx: wd[0] * SQ / 2 - 0.15, hz: wd[1] * SQ / 2 - 0.15 });
    });
    return out;
  }

  var exported = {
    SQ: SQ, ORIGIN: ORIGIN, WALL_H: WALL_H, SIZES: SIZES, DOOR: DOOR, WALK: WALK, MIRROR: MIRROR, DESK: DESK, SEAT: SEAT,
    WALL_TAKEN: WALL_TAKEN, sizeFor: sizeFor, center: center, squareAt: squareAt, footprint: footprint,
    wallSquares: wallSquares, fits: fits, autoPlace: autoPlace, place: place, move: move, moveWall: moveWall, turn: turn,
    putAway: putAway, spots: spots, repair: repair, start: start, solid: solid
  };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.Room = exported;
})(this);
