/* Where everything stands in the 3D world, for each grade. Pure data and geometry with no Three.js, so the Node tests
   can walk it. x runs west (-) to east (+); z runs north (-, toward the Boss Fort) to south (+, toward the gate).
   A facing angle is atan2(dx, dz) of the direction she looks: facing north is Math.PI. */
(function (root) {
  'use strict';

  var PLAYER_R = 0.9;
  var STREET = { side: 15, half: 4.5, firstRow: -22, rowGap: 18 };
  var BUILDING = { hx: 4.75, hz: 5.75, doorOut: 6.6 };
  var DOOR_R = 2.6;
  var BUDDY_AHEAD = 3.6;
  // Two more talking trees inside Whispering Park, besides its ring of six.
  var TALK_TREES = [[-44, 54], [-60, 42]];

  // Lobby order (engine/subjects.js). sign = the subject name the lobby card shows; Grade 2 adds Filipino first.
  var APPS = {
    grade5: [
      { app: 'history-explorers', folder: 'araling-panlipunan', emoji: '🇵🇭', sign: 'Araling Panlipunan', wall: '#ffe08a', roof: '#ff9f68', shape: 'cone' },
      { app: 'wikaharian', folder: 'filipino', emoji: '✍️', sign: 'Filipino', wall: '#dcb8ff', roof: '#a77bff', shape: 'dome' },
      { app: 'math-mastery', folder: 'math', emoji: '📐', sign: 'Math', wall: '#ffb38a', roof: '#ff7f7f', shape: 'cake' },
      { app: 'page-turners', folder: 'english', emoji: '📖', sign: 'English', wall: '#9ed2ff', roof: '#6aa9ff', shape: 'dome' },
      { app: 'rise-shine', folder: 'gmrc', emoji: '🌱', sign: 'GMRC', wall: '#b8f2d0', roof: '#5fcf9a', shape: 'cone' },
      { app: 'rally-ready', folder: 'pe-health', emoji: '🏃', sign: 'P.E. & Health', wall: '#ffb8d9', roof: '#ff7ab8', shape: 'cake' },
      { app: 'craft-corner', folder: 'tle', emoji: '🧵', sign: 'TLE', wall: '#ffd0c2', roof: '#ff9e9e', shape: 'dome' },
      { app: 'life-lab', folder: 'science', emoji: '🔬', sign: 'Science', wall: '#a6eb9c', roof: '#4cc9a0', shape: 'cone' },
      { app: 'net-navigators', folder: 'computer', emoji: '💻', sign: 'Computer', wall: '#a8ecf7', roof: '#4cb8e0', shape: 'cake' },
      { app: 'rhythm-hues', folder: 'music-arts', emoji: '🎵', sign: 'Music & Arts', wall: '#ffe4b0', roof: '#ffb347', shape: 'dome' }
    ],
    grade2: [
      { app: 'block-bot', folder: 'math', emoji: '🔢', sign: 'Matematika · Math', wall: '#ffb38a', roof: '#ff7f7f', shape: 'cake' },
      { app: 'kuwentista', folder: 'filipino', emoji: '📚', sign: 'Filipino', wall: '#dcb8ff', roof: '#a77bff', shape: 'dome' },
      { app: 'word-train', folder: 'english', emoji: '🚂', sign: 'Ingles · English', wall: '#9ed2ff', roof: '#6aa9ff', shape: 'cone' },
      { app: 'batang-bayani', folder: 'makabansa', emoji: '🇵🇭', sign: 'Makabansa', wall: '#ffe08a', roof: '#ff9f68', shape: 'cake' },
      { app: 'growing-good', folder: 'gmrc', emoji: '🌱', sign: 'GMRC', wall: '#b8f2d0', roof: '#5fcf9a', shape: 'dome' },
      { app: 'byte-buddies', folder: 'computer', emoji: '💻', sign: 'Kompyuter · Computer', wall: '#a8ecf7', roof: '#4cb8e0', shape: 'cone' },
      { app: 'science-detectives', folder: 'science', emoji: '🔍', sign: 'Agham · Science', wall: '#a6eb9c', roof: '#4cc9a0', shape: 'cake' }
    ]
  };

  var GRADES = {
    grade5: { bossZ: -124, bounds: { minX: -82, maxX: 82, minZ: -140, maxZ: 98 }, tapWalk: false, bigJoystick: false, signScale: 1 },
    grade2: { bossZ: -106, bounds: { minX: -82, maxX: 82, minZ: -122, maxZ: 98 }, tapWalk: true, bigJoystick: true, signScale: 1.25 }
  };

  // stand: where quick travel puts her; face: which way she then looks.
  var PLACES = {
    gate: { x: 0, z: 92, r: 6, stand: [0, 84], face: Math.PI },
    plaza: { x: 0, z: 0, r: 10, stand: [0, 12], face: Math.PI },
    garden: { x: -62, z: 0, r: 14, stand: [-50, 0], face: -Math.PI / 2 },
    shop: { x: 62, z: 0, r: 12, stand: [54, 0], face: Math.PI / 2 },
    park: { x: -52, z: 48, r: 18, stand: [-48, 44], face: -Math.PI / 4 },
    house: { x: 52, z: 48, r: 12, stand: [47, 47.5], face: 0 },
    playground: { x: 22, z: 74, r: 16, stand: [22, 74], face: Math.PI }
  };
  // Where each side path leaves the plaza for its place (the street, gate and playground run along x = 0).
  var PATH_END = { garden: [-50, 0], shop: [54, 0], park: [-44, 42], house: [46, 44] };
  var PLACE_ORDER = ['gate', 'plaza', 'garden', 'shop', 'park', 'house', 'playground', 'boss'];
  var PLACE_EMOJI = { gate: '🏫', plaza: '⛲', garden: '💛', shop: '🛍️', park: '🌳', house: '🏡', playground: '🛝', boss: '⚔️' };

  // Where she lands when she comes out of My Little House: a step past the door's reach (so a double tap does not take
  // her straight back in), facing away from the door.
  var ROOM_DOORSTEP = { x: 48.3, z: 54, face: -Math.PI / 2 };

  function gradeOf(value) { return value === 'grade2' ? 'grade2' : 'grade5'; }

  function places(grade) {
    var out = {};
    Object.keys(PLACES).forEach(function (k) { out[k] = PLACES[k]; });
    var z = GRADES[grade].bossZ;
    out.boss = { x: 0, z: z, r: 10, stand: [0, z + 16], face: Math.PI };
    return out;
  }

  // Things she bumps into, in world coordinates: boxes have half extents hx/hz, circles a radius r.
  function props(grade) {
    var p = places(grade);
    return {
      fort: { x: p.boss.x, z: p.boss.z, r: 10.5 },
      fountain: { x: 0, z: 0, r: 3.2 },
      signpost: { x: -7.5, z: -7.5, r: 0.5 },
      mimi: { x: 6.5, z: -6, r: 0.8 },
      hoot: { x: -50, z: 52.5, hx: 1.7, hz: 0.7 },
      bunny: { x: 62.6, z: 4.4 },
      bench: { x: -70, z: 0, hx: 1, hz: 2.6 },
      jesus: { x: -69.8, z: 0 },
      lamb: { x: -67.4, z: 2.4, r: 0.9 },
      shop: { x: 68, z: 0, hx: 6, hz: 6 },
      stall: { x: 61, z: -9.5, hx: 2, hz: 1.5 },
      lana: { x: 57.8, z: -9.5, r: 0.8 },
      petStall: { x: 61, z: 9.5, hx: 2, hz: 1.5 },
      kiko: { x: 57.8, z: 9.5, r: 0.8 },
      toyStall: { x: 61, z: -16, hx: 2, hz: 1.5 },
      pilo: { x: 57.8, z: -16, r: 0.8 },
      tasyoStall: { x: 61, z: -22.5, hx: 2, hz: 1.5 },
      tasyo: { x: 57.8, z: -22.5, r: 0.8 },
      house: { x: 58, z: 54, hx: 4.5, hz: 5 },
      pond: { x: -58, z: 54, r: 4 },
      slide: { x: 15, z: 67, hx: 1.2, hz: 3 },
      swings: { x: 29, z: 67, hx: 3, hz: 1 },
      seesaw: { x: 15, z: 81, hx: 3, hz: 0.6 },
      merry: { x: 29, z: 81, r: 2.2 },
      posts: [{ x: -6.5, z: 92, r: 0.8 }, { x: 6.5, z: 92, r: 0.8 }]
    };
  }

  function buildings(grade) {
    return APPS[grade].map(function (a, i) {
      var side = i % 2 ? 1 : -1;
      var x = side * STREET.side;
      var z = STREET.firstRow - Math.floor(i / 2) * STREET.rowGap;
      var rot = -side * Math.PI / 2;
      return Object.assign({}, a, { x: x, z: z, side: side, rot: rot, face: rot + Math.PI, door: { x: x - side * BUILDING.doorOut, z: z } });
    });
  }

  function paths(grade) {
    var p = places(grade);
    var out = [
      { from: [0, p.gate.z], to: [0, 0], w: 7 },
      { from: [0, 0], to: [0, p.boss.z + 10], w: STREET.half * 2 }
    ];
    ['garden', 'shop'].forEach(function (id) { out.push({ from: [0, 0], to: PATH_END[id], w: 6 }); });
    ['park', 'house'].forEach(function (id) { out.push({ from: [0, 0], to: PATH_END[id], w: 5 }); });
    out.push({ from: [0, 74], to: [16, 74], w: 5 });
    return out;
  }

  function onPath(grade, x, z, margin) {
    return paths(grade).some(function (p) {
      var ax = p.from[0], az = p.from[1], dx = p.to[0] - ax, dz = p.to[1] - az;
      var len2 = dx * dx + dz * dz;
      var t = len2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / len2)) : 0;
      return Math.hypot(x - (ax + t * dx), z - (az + t * dz)) <= p.w / 2 + (margin || 0);
    });
  }

  // Border trees, a ring in the park, four in the garden and two more in the park. c indexes the tree colours in
  // build.js; talk numbers the park's talking trees (0-7).
  function trees(grade) {
    var b = GRADES[grade].bounds, out = [], i = 0;
    function push(x, z, talk) {
      var t = { x: x, z: z, s: 0.85 + (i % 3) * 0.2, c: i % 4 };
      if (talk !== undefined) t.talk = talk;
      out.push(t);
      i++;
    }
    for (var x = b.minX + 4; x <= b.maxX - 4; x += 9) {
      if (Math.abs(x) > 14) { push(x, b.minZ + 4); push(x, b.maxZ - 4); }
    }
    for (var z = b.minZ + 13; z <= b.maxZ - 13; z += 9) { push(b.minX + 4, z); push(b.maxX - 4, z); }
    var park = PLACES.park, garden = PLACES.garden;
    for (var k = 0; k < 6; k++) push(park.x + 12 * Math.cos(k * Math.PI / 3), park.z + 12 * Math.sin(k * Math.PI / 3), k);
    for (k = 0; k < 4; k++) push(garden.x + 11 * Math.cos(Math.PI / 4 + k * Math.PI / 2), garden.z + 11 * Math.sin(Math.PI / 4 + k * Math.PI / 2));
    TALK_TREES.forEach(function (p, j) { push(p[0], p[1], 6 + j); });
    return out;
  }

  function talkTrees(grade) { return trees(grade).filter(function (t) { return t.talk !== undefined; }); }

  // Each subject buddy stands beside its door on the street side, a little toward the plaza, facing the street.
  function buddies(grade) {
    return buildings(grade).map(function (b) { return { app: b.app, x: b.door.x, z: b.z + BUDDY_AHEAD, face: b.rot }; });
  }

  function obstacles(grade) {
    var pr = props(grade);
    var boxes = buildings(grade).map(function (b) { return { x: b.x, z: b.z, hx: BUILDING.hx, hz: BUILDING.hz }; })
      .concat([pr.bench, pr.shop, pr.stall, pr.petStall, pr.toyStall, pr.tasyoStall, pr.house, pr.slide, pr.swings, pr.seesaw, pr.hoot]);
    var circles = [pr.fort, pr.fountain, pr.signpost, pr.mimi, pr.pond, pr.merry, pr.lamb, pr.lana, pr.kiko, pr.pilo, pr.tasyo].concat(pr.posts,
      trees(grade).map(function (t) { return { x: t.x, z: t.z, r: 1.1 * t.s }; }),
      buddies(grade).map(function (b) { return { x: b.x, z: b.z, r: 0.8 }; }));
    return { boxes: boxes, circles: circles };
  }

  function blocked(obs, bounds, x, z, r) {
    if (x - r < bounds.minX || x + r > bounds.maxX || z - r < bounds.minZ || z + r > bounds.maxZ) return true;
    for (var i = 0; i < obs.boxes.length; i++) {
      var b = obs.boxes[i];
      if (Math.abs(x - b.x) < b.hx + r && Math.abs(z - b.z) < b.hz + r) return true;
    }
    for (i = 0; i < obs.circles.length; i++) {
      var c = obs.circles[i], dx = x - c.x, dz = z - c.z;
      if (dx * dx + dz * dz < (c.r + r) * (c.r + r)) return true;
    }
    return false;
  }

  // Things she can use when she stands close enough (within r).
  function interactables(grade) {
    var pr = props(grade);
    var list = buildings(grade).map(function (b) {
      return { kind: 'door', id: b.app, app: b.app, folder: b.folder, emoji: b.emoji, sign: b.sign, x: b.door.x, z: b.door.z, r: DOOR_R };
    });
    list.push({ kind: 'signpost', id: 'signpost', x: pr.signpost.x, z: pr.signpost.z, r: 2.8 });
    list.push({ kind: 'mimi', id: 'mimi', x: pr.mimi.x, z: pr.mimi.z, r: 3.2 });
    list.push({ kind: 'counter', id: 'counter', x: pr.shop.x - pr.shop.hx - 1.4, z: pr.shop.z, r: 2.6 });
    list.push({ kind: 'boutique', id: 'boutique', x: pr.lana.x - 2.2, z: pr.lana.z, r: 2.6 });
    list.push({ kind: 'petshop', id: 'petshop', x: pr.kiko.x - 2.2, z: pr.kiko.z, r: 2.6 });
    list.push({ kind: 'toyshop', id: 'toyshop', x: pr.pilo.x - 2.2, z: pr.pilo.z, r: 2.6 });
    list.push({ kind: 'carpenter', id: 'carpenter', x: pr.tasyo.x - 2.2, z: pr.tasyo.z, r: 2.6 });
    // My Little House's door (her room is inside, reached by the sparkle hop) and, beside it, her sister's room.
    list.push({ kind: 'house-in', id: 'house-in', x: pr.house.x - pr.house.hx - 2.1, z: pr.house.z, r: 2.2 });
    list.push({ kind: 'house-visit', id: 'house-visit', x: pr.house.x - pr.house.hx - 2.1, z: pr.house.z + 4.6, r: 2.0 });
    list.push({ kind: 'fort', id: 'fort', x: pr.fort.x, z: pr.fort.z + pr.fort.r + 2, r: 3 });
    buddies(grade).forEach(function (b) { list.push({ kind: 'buddy', id: 'buddy:' + b.app, app: b.app, x: b.x, z: b.z, r: 2.8 }); });
    list.push({ kind: 'hoot', id: 'hoot', x: pr.hoot.x, z: pr.hoot.z - pr.hoot.hz - 1.6, r: 2.6 });
    talkTrees(grade).forEach(function (t) { list.push({ kind: 'tree', id: 'tree:' + t.talk, tree: t.talk, x: t.x, z: t.z, r: 1.1 * t.s + 2.2 }); });
    rideSpots(grade).forEach(function (s) { list.push({ kind: 'ride', id: 'ride:' + s.id, ride: s.id, x: s.x, z: s.z, r: 2.2 }); });
    return list;
  }

  function nearest(items, x, z) {
    var best = null, bestD = Infinity;
    items.forEach(function (it) {
      var d = Math.hypot(it.x - x, it.z - z);
      if (d <= it.r && d < bestD) { best = it; bestD = d; }
    });
    return best;
  }

  // Quick-travel destinations: the 8 places, then every subject door.
  function spots(grade) {
    var p = places(grade);
    var out = PLACE_ORDER.map(function (id) { return { id: id, kind: 'place', x: p[id].stand[0], z: p[id].stand[1], face: p[id].face }; });
    buildings(grade).forEach(function (b) {
      out.push({ id: b.app, kind: 'door', emoji: b.emoji, sign: b.sign, x: b.door.x, z: b.door.z, face: b.face });
    });
    return out;
  }

  // Back from a game she starts at its door; back from the shop or the fort, in that place.
  function spawnFor(grade, ret) {
    var all = spots(grade);
    var hit = ret && ret.grade === grade ? all.filter(function (s) { return s.id === ret.app; })[0] : null;
    return hit || all[0];
  }

  // Mayor Mimi's sparkle trail: from the plaza, along the paths, to a quick-travel spot. [] for an unknown spot.
  function route(grade, id) {
    var spot = spots(grade).filter(function (s) { return s.id === id; })[0];
    if (!spot) return [];
    var lead;
    if (spot.kind === 'door' || id === 'boss') lead = [[0, -5], [0, spot.z]];
    else if (id === 'playground') lead = [[0, 5], [0, 76], [22, 76]];
    else if (id === 'gate' || id === 'plaza') lead = [[0, 5]];
    else {
      var end = PATH_END[id], len = Math.hypot(end[0], end[1]);
      lead = [[5 * end[0] / len, 5 * end[1] / len], end];
    }
    return lead.concat([[spot.x, spot.z]]);
  }

  // Where she stands to talk with Jesus on his bench (he looks east, into the garden).
  function jesusSpot(grade) {
    var j = props(grade).jesus;
    return { x: j.x + 3.4, z: j.z };
  }

  // Her sister waits beside the street just inside the gate, facing the gate, so she sees her on the way in.
  function sisterSpots() {
    return [{ x: -5.5, z: 80, face: 0.4 }, { x: 5.5, z: 80, face: -0.4 }];
  }

  // Where she taps each ride, and where she lands when it ends (the bottom of the slide; beside the others).
  function rideSpots(grade) {
    var pr = props(grade), sl = pr.slide, sw = pr.swings, se = pr.seesaw, mr = pr.merry;
    function spot(id, x, z, end) { return { id: id, x: x, z: z, end: end || { x: x, z: z, face: 0 } }; }
    return [
      spot('slide', sl.x, sl.z - sl.hz - 1.6, { x: sl.x, z: sl.z + sl.hz + 2.2, face: 0 }),
      spot('swings', sw.x + 1.2, sw.z + sw.hz + 1.6),
      spot('seesaw', se.x + 2.6, se.z + se.hz + 1.6),
      spot('merry', mr.x, mr.z + mr.r + 1.4)
    ];
  }

  // A free spot about d from (x, z), ahead of `face` when it can be, so a visitor appears where she can see them.
  function freeSpot(grade, x, z, face, d) {
    var obs = obstacles(grade), b = GRADES[grade].bounds, turns = [0, 0.6, -0.6, 1.2, -1.2, 1.8, -1.8, Math.PI];
    for (var i = 0; i < turns.length; i++) {
      var a = face + turns[i], px = x + Math.sin(a) * d, pz = z + Math.cos(a) * d;
      if (!blocked(obs, b, px, pz, 1.2)) return { x: px, z: pz };
    }
    return { x: x, z: z };
  }

  // Where the playground kids walk on their own: a tree of path points from the plaza (each names the point before it,
  // up, so any two are joined through the plaza), and the places they hang out at the end of them: a circle r, or the
  // street's strip hx by hz in front of the doors. The plaza point sits in the fountain, so walkers skip it.
  function walkways(grade) {
    var p = places(grade), rows = buildings(grade), lastZ = rows[rows.length - 1].z, pg = p.playground, nodes = {};
    function add(id, x, z, up) { nodes[id] = { x: x, z: z, up: up || null }; }
    function out(id, end) {
      var len = Math.hypot(end[0], end[1]);
      add('to-' + id, 7 * end[0] / len, 7 * end[1] / len, 'plaza');
      add(id, end[0], end[1], 'to-' + id);
    }
    add('plaza', 0, 0);
    add('to-south', 0, 7, 'plaza');
    add('south', 0, 74, 'to-south');
    add('playground', pg.x - 8, 74, 'south');
    add('gate', 0, 84, 'south');
    add('street', 0, -7, 'plaza');
    Object.keys(PATH_END).forEach(function (id) { out(id, PATH_END[id]); });
    return {
      hub: 'plaza',
      nodes: nodes,
      hangouts: [
        { id: 'playground', node: 'playground', x: pg.x, z: pg.z, r: pg.r * 0.8 },
        { id: 'gate', node: 'gate', x: 0, z: 84, r: 4 },
        { id: 'plaza', node: 'plaza', x: 0, z: 0, r: 9 },
        { id: 'street', node: 'street', x: 0, z: (-10 + lastZ) / 2, hx: 3, hz: (-10 - lastZ) / 2 },
        { id: 'garden', node: 'garden', x: -58, z: 0, r: 8 },
        { id: 'shop', node: 'shop', x: 52, z: 0, r: 3.5 },
        { id: 'park', node: 'park', x: -48, z: 45, r: 10 },
        { id: 'house', node: 'house', x: 48, z: 45, r: 4 }
      ]
    };
  }

  function appUrl(grade, folder) {
    return '../subjects/grade-' + (grade === 'grade2' ? '2' : '5') + '/' + folder + '/index.html?reset=1';
  }

  var exported = {
    PLAYER_R: PLAYER_R, STREET: STREET, BUILDING: BUILDING, APPS: APPS, GRADES: GRADES, PLACE_ORDER: PLACE_ORDER, PLACE_EMOJI: PLACE_EMOJI, ROOM_DOORSTEP: ROOM_DOORSTEP,
    gradeOf: gradeOf, places: places, props: props, buildings: buildings, paths: paths, onPath: onPath, trees: trees,
    talkTrees: talkTrees, buddies: buddies, jesusSpot: jesusSpot, sisterSpots: sisterSpots, rideSpots: rideSpots, freeSpot: freeSpot, walkways: walkways,
    obstacles: obstacles, blocked: blocked, interactables: interactables, nearest: nearest, spots: spots, spawnFor: spawnFor, route: route, appUrl: appUrl
  };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.Layout = exported;
})(this);
