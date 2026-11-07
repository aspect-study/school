/* Term 2 upstairs on every subject building: the balcony across its front (Term 2 door, exam board), the spiral stairs
   at its north front corner, the spots she uses, the three game links and which floor the guide's step belongs to.
   Pure (no Three.js). Distances "out" run from a building's centre toward the street. */
(function (root) {
  'use strict';
  var node = typeof module !== 'undefined' && module.exports;
  var Layout = node ? require('./layout.js') : root.World3D.Layout;
  var B = Layout.BUILDING;

  var FRONT = 4.0, RAIL = 6.8, MID = 5.4, HALF = 5;
  var STAIRS = { out: 5.2, north: 7.4, r: 1.4 }, FOOT_OUT = 7.8, FOOT_R = 1.8, POST = { out: 6.6, z: 4.8, r: 0.35 };
  var LAND_Z = -2.6, DOWN_Z = -4.1, EXAM_Z = 3.6;

  function countOf(terms, app) { return terms && terms[app] ? terms[app] : { lessons: 0, exams: 0, ids: [] }; }

  function info(b, terms) {
    var s = b.side, n = countOf(terms, b.app);
    var out = function (d) { return b.x - s * d; };
    return {
      app: b.app, folder: b.folder, emoji: b.emoji, sign: b.sign, roof: b.roof, side: s, y: B.upY,
      ready: n.lessons > 0, examReady: n.lessons + n.exams > 0,
      wall: out(FRONT), rail: out(RAIL),
      stairs: { x: out(STAIRS.out), z: b.z - STAIRS.north, r: STAIRS.r },
      foot: { x: out(FOOT_OUT), z: b.z - STAIRS.north, face: Math.atan2(-s, 0) },
      box: { minX: Math.min(out(FRONT), out(RAIL)), maxX: Math.max(out(FRONT), out(RAIL)), minZ: b.z - HALF, maxZ: b.z + HALF },
      head: { x: out(MID), z: b.z + LAND_Z, face: 0 },
      down: { x: out(MID), z: b.z + DOWN_Z },
      door: { x: out(MID), z: b.z },
      exam: { x: out(MID), z: b.z + EXAM_Z },
      posts: [{ x: out(POST.out), z: b.z - POST.z, r: POST.r }, { x: out(POST.out), z: b.z + POST.z, r: POST.r }]
    };
  }

  function all(grade, terms) { return Layout.buildings(grade).map(function (b) { return info(b, terms); }); }
  function find(grade, terms, app) { return all(grade, terms).filter(function (i) { return i.app === app; })[0] || null; }

  // Street-level: the Go up spot at each stairs' foot, and what she walks round (the stairs, the balcony posts).
  function feet(grade) {
    return all(grade, {}).map(function (i) { return { kind: 'stairs-up', id: 'up:' + i.app, app: i.app, x: i.foot.x, z: i.foot.z, r: FOOT_R }; });
  }
  function solids(grade) {
    var out = [];
    all(grade, {}).forEach(function (i) { out.push(i.stairs, i.posts[0], i.posts[1]); });
    return out;
  }

  // On the balcony: the three spots, and the railing round it.
  function items(i) {
    return [
      { kind: 'up-door', id: 'up-door:' + i.app, app: i.app, x: i.door.x, z: i.door.z, r: 1.4 },
      { kind: 'up-exam', id: 'up-exam:' + i.app, app: i.app, x: i.exam.x, z: i.exam.z, r: 1.4 },
      { kind: 'stairs-down', id: 'stairs-down:' + i.app, app: i.app, x: i.down.x, z: i.down.z, r: 1.0 }
    ];
  }
  function blocked(i, x, z, r) {
    var b = i.box;
    return x - r < b.minX || x + r > b.maxX || z - r < b.minZ || z + r > b.maxZ;
  }

  function lessonOf(snap) {
    var s = snap && snap.step;
    return s && snap.stepHref && typeof s.lesson === 'string' && s.lesson ? s.lesson : null;
  }
  function termOf(terms, app, id) { var ids = countOf(terms, app).ids || []; return ids.indexOf(id) >= 0 ? 2 : 1; }
  function stepFloor(snap, terms) {
    var id = lessonOf(snap);
    return id && termOf(terms, snap.step.app, id) === 2 ? 'upper' : 'ground';
  }
  // The guide's link with its lesson's term; review, boss, visit and mock steps keep the full game (both terms).
  function stepHref(snap, terms) {
    if (!snap || !snap.step || !snap.stepHref) return null;
    var id = lessonOf(snap);
    return id ? snap.stepHref + '&term=' + termOf(terms, snap.step.app, id) : snap.stepHref;
  }

  // A first visit needs nothing special, so the plain Term 1 door serves it.
  function guided(snap, i) { return !!(snap && snap.step && snap.step.app === i.app && snap.stepHref && snap.step.kind !== 'visit'); }

  function links(grade, i, snap, terms) {
    var base = Layout.appUrl(grade, i.folder);
    var out = { ground: base + '&term=1', upper: base + '&term=2', exam: base + '&term=2&exam=1' };
    if (guided(snap, i)) out[stepFloor(snap, terms)] = stepHref(snap, terms);
    return out;
  }
  function buddyHref(grade, i, snap, terms) {
    var l = links(grade, i, snap, terms);
    if (guided(snap, i)) return l[stepFloor(snap, terms)];
    return i.ready ? l.upper : l.ground;
  }

  var exported = { FOOT_R: FOOT_R, info: info, all: all, find: find, feet: feet, solids: solids, items: items, blocked: blocked,
    stepFloor: stepFloor, stepHref: stepHref, links: links, buddyHref: buddyHref };
  if (node) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.Upstairs = exported;
})(this);
