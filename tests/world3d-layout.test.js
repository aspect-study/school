const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { APPS, worldFile, engineFile, lobbyFile } = require('./paths.js');
const L = require(worldFile('layout.js'));
const { SUBJECTS } = require(engineFile('subjects.js'));

const GRADES = { grade5: 5, grade2: 2 };

for (const [grade, n] of Object.entries(GRADES)) {
  test(grade + ': one building per subject, in the lobby order, named like the lobby', () => {
    const b = L.buildings(grade);
    assert.deepEqual(b.map((x) => x.app), SUBJECTS[n].map((s) => s.app), 'a new game needs a building in web/world/layout.js');
    b.forEach((x, i) => {
      const title = SUBJECTS[n][i].title;
      assert.ok(x.sign === title || x.sign.endsWith(' · ' + title), x.app + ' sign: ' + x.sign);
      assert.equal(x.folder, APPS.find((a) => a.id === x.app).subject, x.app + ' folder');
    });
  });

  test(grade + ': a door opens the same page as the lobby card', () => {
    const html = fs.readFileSync(lobbyFile(n), 'utf8');
    for (const b of L.buildings(grade)) {
      const m = html.match(new RegExp('data-app="' + b.app + '" href="([^"]+)"'));
      assert.ok(m, b.app + ' card');
      assert.equal(L.appUrl(grade, b.folder), m[1]);
    }
  });

  test(grade + ': buildings stay off the street and apart', () => {
    const b = L.buildings(grade);
    for (const x of b) assert.ok(Math.abs(x.x) - L.BUILDING.hx >= L.STREET.half, x.app + ' is on the street');
    for (let i = 0; i < b.length; i++) {
      for (let j = i + 1; j < b.length; j++) {
        const apart = Math.abs(b[i].x - b[j].x) >= 2 * L.BUILDING.hx || Math.abs(b[i].z - b[j].z) >= 2 * L.BUILDING.hz;
        assert.ok(apart, b[i].app + ' overlaps ' + b[j].app);
      }
    }
  });

  test(grade + ': every place, door, mirror and signpost can be walked to from the gate', () => {
    const obs = L.obstacles(grade);
    const bounds = L.GRADES[grade].bounds;
    const free = (x, z) => !L.blocked(obs, bounds, x, z, L.PLAYER_R);
    const start = L.spawnFor(grade, null);
    assert.ok(free(start.x, start.z), 'the gate is open');
    const key = (x, z) => x + ',' + z;
    const first = [Math.round(start.x), Math.round(start.z)];
    const seen = new Set([key(first[0], first[1])]);
    const queue = [first];
    while (queue.length) {
      const [x, z] = queue.shift();
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const nz = z + dz;
        if (!seen.has(key(nx, nz)) && free(nx, nz)) { seen.add(key(nx, nz)); queue.push([nx, nz]); }
      }
    }
    const cells = [...seen].map((k) => k.split(',').map(Number));
    const reach = (x, z, r) => cells.some(([a, b]) => Math.hypot(a - x, b - z) <= r);
    for (const s of L.spots(grade)) {
      assert.ok(free(s.x, s.z), s.id + ' stands in the open');
      assert.ok(reach(s.x, s.z, 1), s.id + ' can be walked to');
    }
    for (const it of L.interactables(grade)) assert.ok(reach(it.x, it.z, it.r - 0.2), it.id + ' can be walked up to');
  });

  test(grade + ': a door spot faces its building', () => {
    for (const b of L.buildings(grade)) {
      const s = L.spots(grade).find((x) => x.id === b.app);
      const look = Math.atan2(b.x - s.x, b.z - s.z);
      const diff = Math.abs(Math.atan2(Math.sin(look - s.face), Math.cos(look - s.face)));
      assert.ok(diff < 1e-9, b.app);
    }
  });
}

test('standing on a door finds that door; the middle of the street finds nothing', () => {
  const items = L.interactables('grade5');
  const door = items.find((x) => x.id === 'life-lab');
  assert.equal(L.nearest(items, door.x, door.z).id, 'life-lab');
  assert.equal(L.nearest(items, 0, -31), null);
});

test('buildings block, the street does not', () => {
  const obs = L.obstacles('grade5');
  const bounds = L.GRADES.grade5.bounds;
  const b = L.buildings('grade5')[0];
  assert.equal(L.blocked(obs, bounds, b.x, b.z, L.PLAYER_R), true);
  assert.equal(L.blocked(obs, bounds, 0, -40, L.PLAYER_R), false);
  assert.equal(L.blocked(obs, bounds, 0, bounds.maxZ + 5, L.PLAYER_R), true, 'outside the world');
});

test('back from a game she starts at its door; otherwise at the gate', () => {
  assert.equal(L.spawnFor('grade5', { grade: 'grade5', app: 'life-lab' }).id, 'life-lab');
  assert.equal(L.spawnFor('grade5', null).id, 'gate');
  assert.equal(L.spawnFor('grade5', { grade: 'grade2', app: 'block-bot' }).id, 'gate', 'the other grade\'s door is not here');
  assert.equal(L.spawnFor('grade5', { grade: 'grade5', app: 'gone' }).id, 'gate');
});

test('onPath knows the paths', () => {
  assert.equal(L.onPath('grade5', 0, 50, 1), true);
  assert.equal(L.onPath('grade5', 30, 20, 1), false);
});

test('gradeOf falls back to Grade 5', () => {
  assert.equal(L.gradeOf('grade2'), 'grade2');
  assert.equal(L.gradeOf('grade5'), 'grade5');
  assert.equal(L.gradeOf(null), 'grade5');
});

for (const grade of ['grade5', 'grade2']) {
  test(grade + ': Mimi, the shop counter and the fort gate can be walked up to', () => {
    const ids = L.interactables(grade).map((i) => i.id);
    for (const id of ['mimi', 'counter', 'fort', 'signpost', 'carpenter', 'house-in', 'house-visit']) assert.ok(ids.includes(id), id);
    assert.ok(!ids.includes('mirror'), 'the mirror is inside My Little House now');
    assert.ok(!('mirror' in L.props(grade)), 'no outdoor mirror prop');
  });

  test(grade + ': every trail starts at the plaza, ends at its spot and stays in the open', () => {
    const obs = L.obstacles(grade);
    const bounds = L.GRADES[grade].bounds;
    for (const s of L.spots(grade)) {
      const pts = L.route(grade, s.id);
      assert.ok(pts.length >= 2, s.id);
      assert.ok(Math.hypot(pts[0][0], pts[0][1]) <= 6, s.id + ' starts at the plaza');
      assert.deepEqual(pts[pts.length - 1], [s.x, s.z], s.id + ' ends at the spot');
      for (let i = 1; i < pts.length; i++) {
        const [ax, az] = pts[i - 1];
        const [bx, bz] = pts[i];
        const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.5));
        for (let k = 0; k <= steps; k++) {
          const x = ax + (bx - ax) * k / steps;
          const z = az + (bz - az) * k / steps;
          assert.equal(L.blocked(obs, bounds, x, z, 0.3), false, s.id + ' trail is blocked at ' + x.toFixed(1) + ',' + z.toFixed(1));
        }
      }
    }
    assert.deepEqual(L.route(grade, 'nowhere'), []);
  });
}

test('back from the shop or the fort she starts in that place', () => {
  assert.equal(L.spawnFor('grade5', { grade: 'grade5', app: 'shop' }).id, 'shop');
  assert.equal(L.spawnFor('grade2', { grade: 'grade2', app: 'boss' }).id, 'boss');
});

for (const grade of ['grade5', 'grade2']) {
  test(grade + ': a buddy stands beside every door, off the street and out of the doorway', () => {
    const b = L.buddies(grade);
    assert.deepEqual(b.map((x) => x.app), L.buildings(grade).map((x) => x.app));
    const items = L.interactables(grade);
    for (const x of b) {
      assert.ok(Math.abs(x.x) - 0.8 > L.STREET.half, x.app + ' is on the street');
      const door = L.buildings(grade).find((d) => d.app === x.app).door;
      assert.equal(L.nearest(items, door.x, door.z).id, x.app, 'the door mat still finds the door');
      assert.equal(L.nearest(items, x.x, x.z + 2).id, 'buddy:' + x.app, 'in front of the buddy finds the buddy');
      const side = L.buildings(grade).find((d) => d.app === x.app).side;
      assert.equal(L.nearest(items, x.x - side * 2, x.z).id, 'buddy:' + x.app, 'on the street side of the buddy finds the buddy');
    }
  });

  test(grade + ': Hoot, Bunny\'s counter and 8 talking trees in the park can be talked to', () => {
    const ids = L.interactables(grade).map((i) => i.id);
    for (const id of ['hoot', 'counter']) assert.ok(ids.includes(id), id);
    const t = L.talkTrees(grade);
    assert.deepEqual(t.map((x) => x.talk), [0, 1, 2, 3, 4, 5, 6, 7]);
    const park = L.places(grade).park;
    for (const x of t) {
      assert.ok(Math.hypot(x.x - park.x, x.z - park.z) <= 13, 'tree ' + x.talk + ' is in the park');
      assert.ok(ids.includes('tree:' + x.talk));
    }
  });
}

for (const grade of ['grade5', 'grade2']) {
  test(grade + ': Jesus sits on the garden bench with the lamb beside him, and she can walk up to him', () => {
    const pr = L.props(grade), g = L.places(grade).garden, obs = L.obstacles(grade), b = L.GRADES[grade].bounds;
    assert.ok(Math.abs(pr.jesus.x - pr.bench.x) <= pr.bench.hx && Math.abs(pr.jesus.z - pr.bench.z) <= pr.bench.hz, 'on the bench');
    assert.ok(Math.hypot(pr.lamb.x - g.x, pr.lamb.z - g.z) < g.r, 'the lamb is in the garden');
    assert.ok(L.blocked(obs, b, pr.lamb.x, pr.lamb.z, 0.1), 'she bumps into the lamb, not through it');
    const spot = L.jesusSpot(grade);
    assert.equal(L.blocked(obs, b, spot.x, spot.z, L.PLAYER_R), false, 'the talk spot is free');
    assert.ok(Math.hypot(spot.x - pr.jesus.x, spot.z - pr.jesus.z) < 4, 'close to him');
  });

  test(grade + ': her sister stands by the gate, in the open', () => {
    const obs = L.obstacles(grade), b = L.GRADES[grade].bounds, gate = L.places(grade).gate;
    const spots = L.sisterSpots(grade);
    assert.ok(spots.length >= 1);
    for (const s of spots) {
      assert.equal(L.blocked(obs, b, s.x, s.z, L.PLAYER_R), false);
      assert.ok(Math.hypot(s.x - gate.x, s.z - gate.z) < 16, 'near the gate');
      assert.ok(Math.hypot(s.x - gate.stand[0], s.z - gate.stand[1]) > 3, 'not where she starts');
    }
  });

  test(grade + ': each ride has a free spot to tap and a free spot to land after', () => {
    const obs = L.obstacles(grade), b = L.GRADES[grade].bounds, pg = L.places(grade).playground, items = L.interactables(grade);
    const rides = L.rideSpots(grade);
    assert.deepEqual(rides.map((r) => r.id), ['slide', 'swings', 'seesaw', 'merry']);
    for (const r of rides) {
      for (const p of [r, r.end]) assert.equal(L.blocked(obs, b, p.x, p.z, L.PLAYER_R), false, r.id);
      assert.ok(Math.hypot(r.x - pg.x, r.z - pg.z) < pg.r, r.id + ' is in the playground');
      const it = items.find((i) => i.id === 'ride:' + r.id);
      assert.ok(it && it.kind === 'ride' && it.ride === r.id, r.id);
      assert.equal(L.nearest(items, r.x, r.z).id, 'ride:' + r.id, 'standing there finds that ride');
    }
  });

  test(grade + ': freeSpot finds an open spot ahead of her, or one nearby when ahead is blocked', () => {
    const obs = L.obstacles(grade), b = L.GRADES[grade].bounds, fort = L.props(grade).fort;
    const a = L.freeSpot(grade, 0, 84, Math.PI, 7);
    assert.ok(Math.abs(a.x) < 1e-9 && Math.abs(a.z - 77) < 1e-9, 'straight up the street');
    const s = L.freeSpot(grade, 0, fort.z + fort.r + 2, Math.PI, 7);
    assert.equal(L.blocked(obs, b, s.x, s.z, 1.2), false, 'never inside the fort');
  });
}

for (const grade of ['grade5', 'grade2']) {
  test(grade + ': Lola Lana\'s Boutique stands in Shop Plaza, clear of Bunny\'s counter, and can be walked up to', () => {
    const pr = L.props(grade), shop = L.places(grade).shop, items = L.interactables(grade);
    const lana = items.find((i) => i.id === 'boutique');
    assert.ok(lana && lana.kind === 'boutique', 'boutique item');
    assert.ok(Math.hypot(pr.lana.x - shop.x, pr.lana.z - shop.z) <= shop.r, 'Lola Lana is in Shop Plaza');
    assert.equal(L.nearest(items, lana.x, lana.z).id, 'boutique');
    const counter = items.find((i) => i.id === 'counter');
    assert.equal(L.nearest(items, counter.x, counter.z).id, 'counter', 'the counter still finds Bunny');
    assert.equal(L.blocked(L.obstacles(grade), L.GRADES[grade].bounds, lana.x, lana.z, L.PLAYER_R), false, 'she can stand there');
    assert.equal(L.blocked(L.obstacles(grade), L.GRADES[grade].bounds, pr.stall.x, pr.stall.z, 0.1), true, 'the stall is solid');
    assert.ok(!L.onPath(grade, pr.stall.x, pr.stall.z, pr.stall.hz), 'the stall is off the path');
  });
}

for (const grade of ['grade5', 'grade2']) {
  test(grade + ': Mang Kiko\'s Pet Stall stands in Shop Plaza, clear of trees and the other stalls, and can be walked up to', () => {
    const pr = L.props(grade), shop = L.places(grade).shop, items = L.interactables(grade), obs = L.obstacles(grade), b = L.GRADES[grade].bounds;
    const kiko = items.find((i) => i.id === 'petshop');
    assert.ok(kiko && kiko.kind === 'petshop', 'petshop item');
    assert.ok(Math.hypot(pr.kiko.x - shop.x, pr.kiko.z - shop.z) <= shop.r, 'Mang Kiko is in Shop Plaza');
    assert.equal(L.nearest(items, kiko.x, kiko.z).id, 'petshop');
    for (const id of ['counter', 'boutique']) {
      const it = items.find((i) => i.id === id);
      assert.equal(L.nearest(items, it.x, it.z).id, id, id + ' still finds its own');
    }
    assert.equal(L.blocked(obs, b, kiko.x, kiko.z, L.PLAYER_R), false, 'she can stand there');
    assert.equal(L.blocked(obs, b, pr.petStall.x, pr.petStall.z, 0.1), true, 'the stall is solid');
    assert.ok(!L.onPath(grade, pr.petStall.x, pr.petStall.z, pr.petStall.hz), 'the stall is off the path');
    for (const t of L.trees(grade)) assert.ok(Math.hypot(t.x - pr.petStall.x, t.z - pr.petStall.z) > 3.5, 'no tree in the stall');
    const spawn = L.spots(grade).find((s) => s.id === 'shop');
    assert.equal(L.blocked(obs, b, spawn.x, spawn.z, L.PLAYER_R), false, 'quick travel to Shop Plaza still lands free');
  });
}

for (const grade of ['grade5', 'grade2']) {
  test(grade + ": Kuya Pilo's Toy Stall stands in a row south of Lola Lana's, clear of trees, paths and the other stalls", () => {
    const pr = L.props(grade), shop = L.places(grade).shop, items = L.interactables(grade), obs = L.obstacles(grade), b = L.GRADES[grade].bounds;
    const pilo = items.find((i) => i.id === 'toyshop');
    assert.ok(pilo && pilo.kind === 'toyshop', 'toyshop item');
    assert.deepEqual([pr.toyStall.x, pr.toyStall.z], [61, -16]);
    assert.ok(Math.hypot(pr.pilo.x - shop.x, pr.pilo.z - shop.z) <= 18, 'Kuya Pilo is by Shop Plaza');
    assert.equal(L.nearest(items, pilo.x, pilo.z).id, 'toyshop');
    for (const id of ['counter', 'boutique', 'petshop']) {
      const it = items.find((i) => i.id === id);
      assert.equal(L.nearest(items, it.x, it.z).id, id, id + ' still finds its own');
    }
    assert.equal(L.blocked(obs, b, pilo.x, pilo.z, L.PLAYER_R), false, 'she can stand there');
    assert.equal(L.blocked(obs, b, pr.toyStall.x, pr.toyStall.z, 0.1), true, 'the stall is solid');
    assert.equal(L.blocked(obs, b, pr.pilo.x, pr.pilo.z, 0.1), true, 'Kuya Pilo is solid');
    assert.ok(!L.onPath(grade, pr.toyStall.x, pr.toyStall.z, pr.toyStall.hz), 'the stall is off the path');
    for (const t of L.trees(grade)) assert.ok(Math.hypot(t.x - pr.toyStall.x, t.z - pr.toyStall.z) > 3.5, 'no tree in the stall');
    const gap = Math.abs(pr.toyStall.z - pr.stall.z) - pr.toyStall.hz - pr.stall.hz;
    assert.ok(gap >= 2, "room between Lola Lana's stall and Kuya Pilo's");
  });
}

for (const grade of ['grade5', 'grade2']) {
  test(grade + ": Tito Tasyo's Workshop stands south of Kuya Pilo's, clear of trees, paths and the other stalls", () => {
    const pr = L.props(grade), shop = L.places(grade).shop, items = L.interactables(grade), obs = L.obstacles(grade), b = L.GRADES[grade].bounds;
    const it = items.find((i) => i.id === 'carpenter');
    assert.ok(it && it.kind === 'carpenter', 'carpenter item');
    assert.ok(Math.hypot(pr.tasyo.x - shop.x, pr.tasyo.z - shop.z) <= 25, 'Tito Tasyo is by Shop Plaza');
    assert.equal(L.nearest(items, it.x, it.z).id, 'carpenter');
    for (const id of ['counter', 'boutique', 'petshop', 'toyshop']) {
      const o = items.find((i) => i.id === id);
      assert.equal(L.nearest(items, o.x, o.z).id, id, id + ' still finds its own');
    }
    assert.equal(L.blocked(obs, b, it.x, it.z, L.PLAYER_R), false, 'she can stand there');
    assert.equal(L.blocked(obs, b, pr.tasyoStall.x, pr.tasyoStall.z, 0.1), true, 'the stall is solid');
    assert.equal(L.blocked(obs, b, pr.tasyo.x, pr.tasyo.z, 0.1), true, 'Tito Tasyo is solid');
    assert.ok(!L.onPath(grade, pr.tasyoStall.x, pr.tasyoStall.z, pr.tasyoStall.hz), 'the stall is off the path');
    for (const t of L.trees(grade)) assert.ok(Math.hypot(t.x - pr.tasyoStall.x, t.z - pr.tasyoStall.z) > 3.5, 'no tree in the stall');
    assert.ok(Math.abs(pr.tasyoStall.z - pr.toyStall.z) - pr.tasyoStall.hz - pr.toyStall.hz >= 2, "room between Kuya Pilo's stall and Tito Tasyo's");
  });

  test(grade + ': the house door and the visit spot stand in front of My Little House, apart, and the doorstep is free', () => {
    const pr = L.props(grade), items = L.interactables(grade), obs = L.obstacles(grade), b = L.GRADES[grade].bounds;
    const door = items.find((i) => i.id === 'house-in'), visit = items.find((i) => i.id === 'house-visit');
    assert.deepEqual([door.x, door.z], [51.4, 54]);
    assert.deepEqual([visit.x, visit.z], [51.4, 58.6]);
    assert.equal(L.nearest(items, door.x, door.z).id, 'house-in');
    assert.equal(L.nearest(items, visit.x, visit.z).id, 'house-visit');
    const ds = L.ROOM_DOORSTEP;
    assert.equal(L.blocked(obs, b, ds.x, ds.z, L.PLAYER_R), false, 'the doorstep is free');
    assert.ok(Math.hypot(ds.x - door.x, ds.z - door.z) > door.r, 'out of the door\'s reach, so a double tap does not go back in');
    assert.ok(Math.hypot(ds.x - door.x, ds.z - door.z) < door.r + 1.5, 'but a step from the door');
    assert.equal(L.nearest(items, ds.x, ds.z), null, 'nothing else to tap there');
    assert.ok(Math.abs(Math.sin(ds.face) + 1) < 1e-9, 'facing west, away from the house');
    assert.ok(ds.x < pr.house.x - pr.house.hx);
  });
}

test('the kids\' walkways: every path point joins up to the plaza, and every place has free room in it', () => {
  for (const grade of ['grade5', 'grade2']) {
    const w = L.walkways(grade), obs = L.obstacles(grade), bounds = L.GRADES[grade].bounds;
    for (const id of Object.keys(w.nodes)) {
      let n = id, hops = 0;
      while (w.nodes[n].up) { n = w.nodes[n].up; hops++; assert.ok(hops < 10, id); }
      assert.equal(n, w.hub, grade + ' ' + id + ' reaches the plaza');
      if (id !== w.hub) assert.equal(L.blocked(obs, bounds, w.nodes[id].x, w.nodes[id].z, 0.7), false, grade + ' ' + id + ' is free');
    }
    for (const h of w.hangouts) {
      assert.ok(w.nodes[h.node], h.id);
      const free = [];
      for (let i = 0; i < 400; i++) {
        const x = h.x + (h.r || h.hx) * (2 * ((i * 0.618) % 1) - 1), z = h.z + (h.r || h.hz) * (2 * ((i * 0.381) % 1) - 1);
        if (!L.blocked(obs, bounds, x, z, 0.7)) free.push(1);
      }
      assert.ok(free.length > 100, grade + ' ' + h.id + ' has room: ' + free.length);
    }
    assert.equal(w.hangouts[0].id, 'playground');
  }
});

test('the camera sees a building as a wall, but not a tree or a post', () => {
  const obs = L.obstacles('grade5');
  const b = L.buildings('grade5')[0];
  assert.equal(L.wallAt(obs, b.x, b.z), true);
  assert.equal(L.wallAt(obs, b.door.x, b.door.z), false, 'the doorstep is outside');
  const tree = obs.circles[obs.circles.length - 30];
  assert.equal(L.wallAt({ boxes: [], circles: obs.circles }, tree.x, tree.z), false);
});
