/* The Study Loft upstairs in My Little House: a fixed 6x6 floor with a desk per game of her grade (Term 2 lessons),
   the Exam Corner board on the west wall and the ladder down in the south-east corner. Pure (no 3D). Squares use
   room.js maths (same ORIGIN and SQ), so the loft stands where her room does while the room is hidden. */
(function (root) {
  'use strict';
  var node = typeof module !== 'undefined' && module.exports;
  var Room = node ? require('./room.js') : root.World3D.Room;
  var Layout = node ? require('./layout.js') : root.World3D.Layout;

  var SIZE = 6, LADDER = [5, 0], ARRIVE = [4, 0], EXAM = [0, 2];

  function deskSquares(n) {
    var out = [], c, r;
    for (c = 0; c < SIZE; c++) out.push([c, SIZE - 1]);
    for (r = SIZE - 2; r >= 1; r--) out.push([SIZE - 1, r]);
    for (r = SIZE - 2; r >= 3; r--) out.push([0, r]);
    return out.slice(0, n);
  }

  function countOf(counts, app) { return counts && counts[app] ? counts[app] : { lessons: 0, exams: 0 }; }

  // apps: Layout.APPS[grade]; counts: World3D.TermLessons.
  function desks(apps, counts) {
    var sq = deskSquares(apps.length);
    return apps.map(function (a, i) {
      return { app: a.app, folder: a.folder, emoji: a.emoji, sign: a.sign, roof: a.roof, c: sq[i][0], r: sq[i][1], ready: countOf(counts, a.app).lessons > 0 };
    });
  }

  function examApps(apps, counts) {
    return apps.filter(function (a) { var n = countOf(counts, a.app); return n.lessons + n.exams > 0; });
  }

  function deskUrl(grade, a) { return Layout.appUrl(grade, a.folder) + '&term=2'; }
  function examUrl(grade, a) { return deskUrl(grade, a) + '&exam=1'; }
  function oldUrl(grade, a) { return Layout.appUrl(grade, a.folder) + '&term=1'; }

  function items(list) {
    var out = list.map(function (d) {
      var p = Room.center(d.c, d.r);
      return { kind: 'loft-desk', id: 'loft:' + d.app, app: d.app, x: p.x, z: p.z, r: 2.1 };
    });
    var e = Room.center(EXAM[0], EXAM[1]), l = Room.center(LADDER[0], LADDER[1]);
    out.push({ kind: 'loft-exam', id: 'loft-exam', x: e.x, z: e.z, r: 2.3 });
    out.push({ kind: 'ladder-down', id: 'ladder-down', x: l.x, z: l.z, r: 1.3 });
    return out;
  }

  // Boxes she and her pet walk round: each desk (a little short of its square) and the Exam Corner board on the wall.
  function solid(list) {
    var out = list.map(function (d) {
      var p = Room.center(d.c, d.r);
      return { x: p.x, z: p.z, hx: 0.9, hz: 0.9 };
    });
    var e = Room.center(EXAM[0], EXAM[1]);
    out.push({ x: Room.ORIGIN.x + 0.35, z: e.z, hx: 0.35, hz: 1.6 });
    return out;
  }

  var exported = { SIZE: SIZE, LADDER: LADDER, ARRIVE: ARRIVE, EXAM: EXAM, deskSquares: deskSquares, desks: desks,
    examApps: examApps, deskUrl: deskUrl, examUrl: examUrl, oldUrl: oldUrl, items: items, solid: solid };
  if (node) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.Loft = exported;
})(this);
