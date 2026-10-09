# Walkable 3D World — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A cute, walkable 3D world page per grade (Grade 5 Campus, Grade 2 Bayan), opened from a 🌸 Play World button in each lobby, with a free character maker, a pet, 8 places, doors that open the games, ⚡ quick travel, music, a quality switch, and safe fallbacks.

**Architecture:** Two new pages, `web/world/grade-5.html` and `web/world/grade-2.html`, load classic scripts from `web/world/`. Pure modules (words, layout, look, prefs, walk maths, music data) export through `module.exports` for Node tests and attach to `window.World3D.*` in the browser, like the existing engine files. 3D modules (scene, build, avatar, move, maker, world-main) use the vendored Three.js r149 global `THREE` and are covered by a headless-Chrome e2e test. `nav.js` sends 🏠 back to the world when the game was opened from it.

**Tech Stack:** Plain HTML/CSS/JS (no build step), Three.js r149 (`three.min.js`, vendored), Node's built-in test runner (`node --test`), headless Chrome e2e via `tests/e2e/chrome.js`.

**Spec:** `docs/superpowers/specs/2026-10-05-walkable-3d-world-design.md` (Phase 1 section). Phases 2–4 get their own plans after this one is built.

**Look reference:** `docs/superpowers/mockups/2026-10-05-walkable-3d-world/cute-campus.html` (agreed look; it uses r160 from a CDN, the build uses r149 vendored).

**House rules for this repo (read before starting):**
- Never run `git commit`. Each task ends by staging files with `git add`; the user commits.
- Comments sparingly: only for non-obvious code. Match the surrounding style (ES5-style `var` and `function` in browser files, `const`/arrow functions in tests).
- Grade 2 text: labels pair Filipino with English as `Filipino · English`; buttons are English only.
- Every file under `web/` must be in `web/sw.js` PRECACHE: run `node tools/update-precache.js` after adding files.
- Script paths must match file names exactly, case included (GitHub Pages is case-sensitive).
- Run unit tests from the repo root with `node --test`.

---

## File map

| File | Status | Responsibility |
|---|---|---|
| `web/vendor/three/three.min.js` | Create (download) | Three.js r149 classic build, global `THREE` |
| `web/vendor/three/rounded-box.js` | Create | `THREE.RoundedBoxGeometry`, ported from r149 examples |
| `web/world/text.js` | Create | All world words per grade |
| `web/world/layout.js` | Create | Places, buildings, props, paths, trees, obstacles, doors, travel spots, URLs (pure) |
| `web/world/look.js` | Create | `avatar_v1` options, cleaning, read/save (pure) |
| `web/world/prefs.js` | Create | `world3d_device_v1`, the session return spot, the frame-rate watcher (pure) |
| `web/world/walk.js` | Create | Movement maths: input → direction, step with sliding, turning (pure) |
| `web/world/music.js` | Create | Synthesized music-box loop |
| `web/world/scene.js` | Create | Renderer, sky, lights, cached toon materials and shapes, labels, quality |
| `web/world/build.js` | Create | Draws ground, paths, buildings and the 8 places |
| `web/world/avatar.js` | Create | Her chibi character from `avatar_v1`, and the 3 pets |
| `web/world/move.js` | Create | Joystick, keys, drag-to-look, tap-to-walk, camera follow |
| `web/world/maker.js` | Create | Character maker panel |
| `web/world/world-main.js` | Create | Boot, fallback card, HUD, doors, mirror, quick travel, settings, music, context loss, `WorldDebug` |
| `web/world/world.css` | Create | World page styles |
| `web/world/grade-5.html`, `web/world/grade-2.html` | Create | The world pages |
| `web/engine/nav.js` | Modify | 🏠 and ← on a game home go back to the world when opened from it |
| `web/engine/sync-core.js` | Modify | `world3d_device_v1` is device-only |
| `web/lobby/grade-5.html`, `web/lobby/grade-2.html` | Modify | 🌸 Play World button, clear the return flag |
| `web/sw.js` | Modify (tool) | PRECACHE |
| `tools/update-precache.js` | Modify | Group `world/` and `vendor/` |
| `tests/paths.js` | Modify | `WORLDS`, `WORLD_FILES`, `VENDOR_FILES`, `worldFile` |
| `tests/e2e/chrome.js` | Modify | `dumpDom` extra args, `WEBGL_ARGS` |
| `tests/world3d-*.test.js`, `tests/nav.test.js` | Create / modify | Unit and wiring tests |
| `tests/e2e/world-e2e.js`, `tests/e2e/world-driver.page.js` | Create | Browser test |
| `README.md` | Modify | Run command, new-game checklist step |

---

### Task 1: Vendor Three.js r149 and the rounded box

**Files:**
- Create: `web/vendor/three/three.min.js` (download)
- Create: `web/vendor/three/rounded-box.js`
- Modify: `tests/paths.js`
- Modify: `tools/update-precache.js`
- Test: `tests/world3d-vendor.test.js`

- [ ] **Step 1: Download Three.js r149**

```bash
mkdir -p web/vendor/three && curl -sSfL -o web/vendor/three/three.min.js https://cdn.jsdelivr.net/npm/three@0.149.0/build/three.min.js && head -c 120 web/vendor/three/three.min.js
```

Expected: about 600 KB written; the first bytes are `/**\n * @license\n * Copyright 2010-2023 Three.js Authors`.

- [ ] **Step 2: Add the world paths to `tests/paths.js`**

After the `ENGINE_FILES` line add:

```js
const WORLD = path.join(WEB, 'world');
// The 3D world pages and the scripts they load from web/world/, in load order.
const WORLDS = { 5: 'world/grade-5.html', 2: 'world/grade-2.html' };
const WORLD_FILES = ['text.js', 'layout.js', 'look.js', 'prefs.js', 'walk.js', 'music.js', 'scene.js', 'build.js', 'avatar.js', 'move.js', 'maker.js', 'world-main.js'];
const VENDOR_FILES = ['vendor/three/three.min.js', 'vendor/three/rounded-box.js'];
```

After `const engineFile = ...` add:

```js
const worldFile = (name) => path.join(WORLD, name);
```

And add `WORLD, WORLDS, WORLD_FILES, VENDOR_FILES, worldFile` to `module.exports`.

- [ ] **Step 3: Write the failing test** `tests/world3d-vendor.test.js`

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { web, VENDOR_FILES } = require('./paths.js');

function three() {
  const win = {};
  win.window = win;
  win.self = win;
  vm.createContext(win);
  for (const f of VENDOR_FILES) vm.runInContext(fs.readFileSync(web(f), 'utf8'), win);
  return win.THREE;
}

test('the vendored Three.js is r149 with a classic build', () => {
  assert.equal(three().REVISION, '149');
});

test('rounded-box.js adds a rounded box with the asked size', () => {
  const THREE = three();
  const g = new THREE.RoundedBoxGeometry(2, 1, 1, 2, 0.3);
  g.computeBoundingBox();
  const size = g.boundingBox.getSize(new THREE.Vector3());
  assert.ok(Math.abs(size.x - 2) < 1e-6 && Math.abs(size.y - 1) < 1e-6 && Math.abs(size.z - 1) < 1e-6, JSON.stringify(size));
  assert.equal(g.index, null);
  assert.ok(g.groups.length === 6, 'one group per face, so a face can have its own material');
});
```

- [ ] **Step 4: Run it and see it fail**

Run: `node --test tests/world3d-vendor.test.js`
Expected: FAIL, `ENOENT ... rounded-box.js`.

- [ ] **Step 5: Write `web/vendor/three/rounded-box.js`**

```js
/* RoundedBoxGeometry from three.js r149 (examples/jsm/geometries/RoundedBoxGeometry.js, MIT License,
   Copyright 2010-2023 Three.js Authors), as a classic script so the world also runs from file://.
   Adds THREE.RoundedBoxGeometry(width, height, depth, segments, radius). */
(function (THREE) {
  'use strict';
  if (!THREE) return;
  var tempNormal = new THREE.Vector3();

  function getUv(faceDirVector, normal, uvAxis, projectionAxis, radius, sideLength) {
    var totArcLength = 2 * Math.PI * radius / 4;
    var centerLength = Math.max(sideLength - 2 * radius, 0);
    var halfArc = Math.PI / 4;
    tempNormal.copy(normal);
    tempNormal[projectionAxis] = 0;
    tempNormal.normalize();
    var arcUvRatio = 0.5 * totArcLength / (totArcLength + centerLength);
    var arcAngleRatio = 1.0 - (tempNormal.angleTo(faceDirVector) / halfArc);
    if (Math.sign(tempNormal[uvAxis]) === 1) return arcAngleRatio * arcUvRatio;
    var lenUv = centerLength / (totArcLength + centerLength);
    return lenUv + arcUvRatio + arcUvRatio * (1.0 - arcAngleRatio);
  }

  class RoundedBoxGeometry extends THREE.BoxGeometry {
    constructor(width = 1, height = 1, depth = 1, segments = 2, radius = 0.1) {
      segments = segments * 2 + 1;
      radius = Math.min(width / 2, height / 2, depth / 2, radius);
      super(1, 1, 1, segments, segments, segments);
      if (segments === 1) return;

      var geometry2 = this.toNonIndexed();
      this.index = null;
      this.attributes.position = geometry2.attributes.position;
      this.attributes.normal = geometry2.attributes.normal;
      this.attributes.uv = geometry2.attributes.uv;

      var position = new THREE.Vector3();
      var normal = new THREE.Vector3();
      var box = new THREE.Vector3(width, height, depth).divideScalar(2).subScalar(radius);
      var positions = this.attributes.position.array;
      var normals = this.attributes.normal.array;
      var uvs = this.attributes.uv.array;
      var faceTris = positions.length / 6;
      var faceDirVector = new THREE.Vector3();
      var halfSegmentSize = 0.5 / segments;

      for (var i = 0, j = 0; i < positions.length; i += 3, j += 2) {
        position.fromArray(positions, i);
        normal.copy(position);
        normal.x -= Math.sign(normal.x) * halfSegmentSize;
        normal.y -= Math.sign(normal.y) * halfSegmentSize;
        normal.z -= Math.sign(normal.z) * halfSegmentSize;
        normal.normalize();

        positions[i + 0] = box.x * Math.sign(position.x) + normal.x * radius;
        positions[i + 1] = box.y * Math.sign(position.y) + normal.y * radius;
        positions[i + 2] = box.z * Math.sign(position.z) + normal.z * radius;

        normals[i + 0] = normal.x;
        normals[i + 1] = normal.y;
        normals[i + 2] = normal.z;

        var side = Math.floor(i / faceTris);
        switch (side) {
          case 0:
            faceDirVector.set(1, 0, 0);
            uvs[j + 0] = getUv(faceDirVector, normal, 'z', 'y', radius, depth);
            uvs[j + 1] = 1.0 - getUv(faceDirVector, normal, 'y', 'z', radius, height);
            break;
          case 1:
            faceDirVector.set(-1, 0, 0);
            uvs[j + 0] = 1.0 - getUv(faceDirVector, normal, 'z', 'y', radius, depth);
            uvs[j + 1] = 1.0 - getUv(faceDirVector, normal, 'y', 'z', radius, height);
            break;
          case 2:
            faceDirVector.set(0, 1, 0);
            uvs[j + 0] = 1.0 - getUv(faceDirVector, normal, 'x', 'z', radius, width);
            uvs[j + 1] = getUv(faceDirVector, normal, 'z', 'x', radius, depth);
            break;
          case 3:
            faceDirVector.set(0, -1, 0);
            uvs[j + 0] = 1.0 - getUv(faceDirVector, normal, 'x', 'z', radius, width);
            uvs[j + 1] = 1.0 - getUv(faceDirVector, normal, 'z', 'x', radius, depth);
            break;
          case 4:
            faceDirVector.set(0, 0, 1);
            uvs[j + 0] = 1.0 - getUv(faceDirVector, normal, 'x', 'y', radius, width);
            uvs[j + 1] = 1.0 - getUv(faceDirVector, normal, 'y', 'x', radius, height);
            break;
          case 5:
            faceDirVector.set(0, 0, -1);
            uvs[j + 0] = getUv(faceDirVector, normal, 'x', 'y', radius, width);
            uvs[j + 1] = 1.0 - getUv(faceDirVector, normal, 'y', 'x', radius, height);
            break;
        }
      }
    }
  }

  THREE.RoundedBoxGeometry = RoundedBoxGeometry;
})(typeof window !== 'undefined' ? window.THREE : this.THREE);
```

- [ ] **Step 6: Run the test**

Run: `node --test tests/world3d-vendor.test.js`
Expected: PASS (2 tests). If `three.min.js` throws in the vm because a browser global is missing, add that global to `win` in `three()` (e.g. `win.navigator = {}`), not to the vendored file.

- [ ] **Step 7: Group the new folders in `tools/update-precache.js`**

Replace the `GROUPS` line with:

```js
const GROUPS = [/^index\.html$/, /^lobby\//, /^parent\//, /^engine\//, /^world\//, /^vendor\//, /^subjects\//, /^assets\//];
```

- [ ] **Step 8: Update the precache and run all tests**

Run: `node tools/update-precache.js && node --test`
Expected: `web/sw.js precaches N files`; all tests pass.

- [ ] **Step 9: Stage**

```bash
git add web/vendor/three tests/paths.js tools/update-precache.js web/sw.js tests/world3d-vendor.test.js
```

---

### Task 2: World words (`text.js`)

**Files:**
- Create: `web/world/text.js`
- Test: `tests/world3d-text.test.js`

- [ ] **Step 1: Write the failing test** `tests/world3d-text.test.js`

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile } = require('./paths.js');
const { TEXT } = require(worldFile('text.js'));

function keys(o, prefix = '') {
  return Object.keys(o).sort().flatMap((k) => (typeof o[k] === 'object' ? keys(o[k], prefix + k + '.') : [prefix + k]));
}
const at = (o, k) => k.split('.').reduce((v, p) => v[p], o);

// Buttons are English on both grades; names are names.
const ENGLISH_ONLY = new Set(['go', 'mirror', 'signpost', 'close', 'lobby', 'toLobby', 'settings', 'on', 'off',
  'qualityNames.auto', 'qualityNames.high', 'qualityNames.low', 'maker.done',
  'maker.bodies.girl', 'maker.bodies.boy', 'maker.hairs.pigtails', 'maker.hairs.bob', 'maker.hairs.short',
  'maker.pets.chick', 'maker.pets.kitten', 'maker.pets.puppy', 'petNames.chick', 'petNames.kitten', 'petNames.puppy']);

test('both grades have the same words', () => {
  assert.deepEqual(keys(TEXT.grade2), keys(TEXT.grade5));
});

test('Grade 2 pairs Filipino with English on every label, and buttons stay English', () => {
  for (const k of keys(TEXT.grade2)) {
    const v = at(TEXT.grade2, k);
    if (ENGLISH_ONLY.has(k)) assert.equal(v, at(TEXT.grade5, k), k + ' is a button: same English as Grade 5');
    else assert.match(v, / · /, k + ' needs Filipino · English');
  }
});

test('the Go button has a place for the subject name', () => {
  assert.ok(TEXT.grade5.go.includes('{name}'));
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/world3d-text.test.js`
Expected: FAIL, cannot find `web/world/text.js`.

- [ ] **Step 3: Write `web/world/text.js`**

```js
/* Words for the 3D world. Grade 2 pairs Filipino with English on labels; buttons are English on both grades. */
(function (root) {
  'use strict';

  var BUTTONS = {
    go: 'Go to {name}!', mirror: '🪞 Change my look', signpost: '⚡ Quick travel', close: 'Close', lobby: '🏠 Lobby',
    toLobby: '🗺️ Back to the lobby', settings: '⚙️', on: 'On', off: 'Off',
    qualityNames: { auto: 'Auto', high: 'High', low: 'Low' }
  };
  var MAKER_BUTTONS = {
    done: 'Done ✨',
    bodies: { girl: 'Girl', boy: 'Boy' },
    hairs: { pigtails: 'Pigtails', bob: 'Bob', short: 'Short' },
    pets: { chick: 'Chick', kitten: 'Kitten', puppy: 'Puppy' }
  };
  var PET_NAMES = { chick: 'Piyo', kitten: 'Muning', puppy: 'Bantay' };

  function words(labels, maker) {
    var out = Object.assign({}, BUTTONS, labels);
    out.maker = Object.assign({}, MAKER_BUTTONS, maker);
    out.petNames = PET_NAMES;
    return out;
  }

  var TEXT = {
    grade5: words({
      title: 'Campus', loading: 'Loading the world…', waking: '✨ Waking up…',
      resting: 'The world is resting 😴', restingLine: 'Here is the Campus map!',
      travelTitle: '⚡ Where to?', settingsTitle: 'Settings', music: '🎵 Music', sound: '🔊 Sound', quality: 'Quality',
      places: {
        gate: 'Gate', plaza: 'Plaza', boss: 'Boss Fort', garden: "Jesus' Garden", shop: 'Shop Plaza',
        park: 'Whispering Park', house: 'My Little House', playground: 'Playground'
      }
    }, {
      title: 'Make your character!', body: 'Body', skin: 'Skin', hair: 'Hair', hairColor: 'Hair color',
      outfit: 'Outfit', pet: 'Pet', petName: 'Pet name'
    }),
    grade2: words({
      title: 'Bayan · Village', loading: 'Inihahanda ang bayan… · Loading the village…', waking: '✨ Gumigising… · Waking up…',
      resting: 'Nagpapahinga ang bayan 😴 · The village is resting 😴', restingLine: 'Narito ang mapa ng bayan! · Here is the village map!',
      travelTitle: '⚡ Saan tayo pupunta? · Where to?', settingsTitle: 'Ayos · Settings', music: '🎵 Musika · Music',
      sound: '🔊 Tunog · Sound', quality: 'Linaw · Quality',
      places: {
        gate: 'Tarangkahan · Gate', plaza: 'Plasa · Plaza', boss: 'Kuta ng Boss · Boss Fort', garden: 'Hardin ni Jesus · Jesus\u2019 Garden',
        shop: 'Tindahan · Shop Plaza', park: 'Parke ng Bulong · Whispering Park', house: 'Munting Bahay Ko · My Little House',
        playground: 'Palaruan · Playground'
      }
    }, {
      title: 'Gawin ang iyong karakter! · Make your character!', body: 'Katawan · Body', skin: 'Kulay ng balat · Skin',
      hair: 'Buhok · Hair', hairColor: 'Kulay ng buhok · Hair color', outfit: 'Damit · Outfit', pet: 'Alaga · Pet',
      petName: 'Pangalan ng alaga · Pet name'
    })
  };

  var exported = { TEXT: TEXT };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.Text = exported;
})(this);
```

- [ ] **Step 4: Run the test**

Run: `node --test tests/world3d-text.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Stage**

```bash
git add web/world/text.js tests/world3d-text.test.js
```

---

### Task 3: Where everything stands (`layout.js`)

**Files:**
- Create: `web/world/layout.js`
- Test: `tests/world3d-layout.test.js`

Coordinates: x runs west (−) to east (+); z runs north (−, toward the Boss Fort) to south (+, toward the gate). A facing angle is `atan2(dx, dz)` of the direction she looks, so facing north is `Math.PI`.

- [ ] **Step 1: Write the failing test** `tests/world3d-layout.test.js`

```js
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
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/world3d-layout.test.js`
Expected: FAIL, cannot find `web/world/layout.js`.

- [ ] **Step 3: Write `web/world/layout.js`**

```js
/* Where everything stands in the 3D world, for each grade. Pure data and geometry with no Three.js, so the Node tests
   can walk it. x runs west (-) to east (+); z runs north (-, toward the Boss Fort) to south (+, toward the gate).
   A facing angle is atan2(dx, dz) of the direction she looks: facing north is Math.PI. */
(function (root) {
  'use strict';

  var PLAYER_R = 0.9;
  var STREET = { side: 15, half: 4.5, firstRow: -22, rowGap: 18 };
  var BUILDING = { hx: 4.75, hz: 5.75, doorOut: 6.6 };
  var DOOR_R = 2.6;

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
    playground: { x: 22, z: 74, r: 11, stand: [22, 74], face: Math.PI }
  };
  var PLACE_ORDER = ['gate', 'plaza', 'garden', 'shop', 'park', 'house', 'playground', 'boss'];
  var PLACE_EMOJI = { gate: '🏫', plaza: '⛲', garden: '💛', shop: '🛍️', park: '🌳', house: '🏡', playground: '🛝', boss: '⚔️' };

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
      signpost: { x: 7.5, z: 7.5, r: 0.5 },
      bench: { x: -70, z: 0, hx: 1, hz: 2.6 },
      shop: { x: 68, z: 0, hx: 6, hz: 6 },
      house: { x: 58, z: 54, hx: 4.5, hz: 5 },
      mirror: { x: 47, z: 52, r: 0.7 },
      pond: { x: -58, z: 54, r: 4 },
      slide: { x: 18, z: 71, hx: 1.2, hz: 3 },
      swings: { x: 26, z: 71, hx: 3, hz: 1 },
      seesaw: { x: 18, z: 79, hx: 3, hz: 0.6 },
      merry: { x: 26, z: 79, r: 2.2 },
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
    return [
      { from: [0, p.gate.z], to: [0, 0], w: 7 },
      { from: [0, 0], to: [0, p.boss.z + 10], w: STREET.half * 2 },
      { from: [0, 0], to: [-50, 0], w: 6 },
      { from: [0, 0], to: [54, 0], w: 6 },
      { from: [0, 0], to: [-44, 42], w: 5 },
      { from: [0, 0], to: [46, 44], w: 5 },
      { from: [0, 74], to: [16, 74], w: 5 }
    ];
  }

  function onPath(grade, x, z, margin) {
    return paths(grade).some(function (p) {
      var ax = p.from[0], az = p.from[1], dx = p.to[0] - ax, dz = p.to[1] - az;
      var len2 = dx * dx + dz * dz;
      var t = len2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / len2)) : 0;
      return Math.hypot(x - (ax + t * dx), z - (az + t * dz)) <= p.w / 2 + margin;
    });
  }

  // Border trees, a ring in the park and four in the garden. c indexes the tree colours in build.js.
  function trees(grade) {
    var b = GRADES[grade].bounds, out = [], i = 0;
    function push(x, z) { out.push({ x: x, z: z, s: 0.85 + (i % 3) * 0.2, c: i % 4 }); i++; }
    for (var x = b.minX + 4; x <= b.maxX - 4; x += 9) {
      if (Math.abs(x) > 14) { push(x, b.minZ + 4); push(x, b.maxZ - 4); }
    }
    for (var z = b.minZ + 13; z <= b.maxZ - 13; z += 9) { push(b.minX + 4, z); push(b.maxX - 4, z); }
    var park = PLACES.park, garden = PLACES.garden;
    for (var k = 0; k < 6; k++) push(park.x + 12 * Math.cos(k * Math.PI / 3), park.z + 12 * Math.sin(k * Math.PI / 3));
    for (k = 0; k < 4; k++) push(garden.x + 11 * Math.cos(Math.PI / 4 + k * Math.PI / 2), garden.z + 11 * Math.sin(Math.PI / 4 + k * Math.PI / 2));
    return out;
  }

  function obstacles(grade) {
    var pr = props(grade);
    var boxes = buildings(grade).map(function (b) { return { x: b.x, z: b.z, hx: BUILDING.hx, hz: BUILDING.hz }; })
      .concat([pr.bench, pr.shop, pr.house, pr.slide, pr.swings, pr.seesaw]);
    var circles = [pr.fort, pr.fountain, pr.signpost, pr.mirror, pr.pond, pr.merry].concat(pr.posts,
      trees(grade).map(function (t) { return { x: t.x, z: t.z, r: 1.1 * t.s }; }));
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
    var list = buildings(grade).map(function (b) {
      return { kind: 'door', id: b.app, app: b.app, folder: b.folder, emoji: b.emoji, sign: b.sign, x: b.door.x, z: b.door.z, r: DOOR_R };
    });
    list.push({ kind: 'mirror', id: 'mirror', x: 47, z: 49.6, r: 2.4 });
    list.push({ kind: 'signpost', id: 'signpost', x: 7.5, z: 7.5, r: 2.8 });
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

  function spawnFor(grade, ret) {
    var all = spots(grade);
    var hit = ret && ret.grade === grade ? all.filter(function (s) { return s.kind === 'door' && s.id === ret.app; })[0] : null;
    return hit || all[0];
  }

  function appUrl(grade, folder) {
    return '../subjects/grade-' + (grade === 'grade2' ? '2' : '5') + '/' + folder + '/index.html?reset=1';
  }

  var exported = {
    PLAYER_R: PLAYER_R, STREET: STREET, BUILDING: BUILDING, APPS: APPS, GRADES: GRADES, PLACE_ORDER: PLACE_ORDER, PLACE_EMOJI: PLACE_EMOJI,
    gradeOf: gradeOf, places: places, props: props, buildings: buildings, paths: paths, onPath: onPath, trees: trees,
    obstacles: obstacles, blocked: blocked, interactables: interactables, nearest: nearest, spots: spots, spawnFor: spawnFor, appUrl: appUrl
  };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.Layout = exported;
})(this);
```

- [ ] **Step 4: Run the test**

Run: `node --test tests/world3d-layout.test.js`
Expected: PASS. If the reach test fails for one item, the message names it: move that prop or stand point (keep `props`, `PLACES` and `interactables` in agreement) rather than loosening the test.

- [ ] **Step 5: Stage**

```bash
git add web/world/layout.js tests/world3d-layout.test.js
```

---

### Task 4: Her look (`look.js`)

**Files:**
- Create: `web/world/look.js`
- Test: `tests/world3d-look.test.js`

- [ ] **Step 1: Write the failing test** `tests/world3d-look.test.js`

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile } = require('./paths.js');
const Look = require(worldFile('look.js'));

function memory(initial) {
  const data = Object.assign({}, initial);
  return {
    data,
    getItem: (k) => (Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
  };
}

test('a fresh device has no character yet', () => {
  const r = Look.read(memory());
  assert.equal(r.made, false);
  assert.deepEqual(r.look, Look.DEFAULT);
  assert.equal(Look.KEY, 'avatar_v1');
});

test('unknown or broken values clean to the defaults; the pet name is trimmed and safe', () => {
  const raw = { v: 1, body: 'dragon', skin: 9, hair: 'bob', hairColor: -1, outfit: 1.5, pet: 'cat', petName: '<b>Bantay the Brave Dog</b>', t: 7 };
  const r = Look.read(memory({ avatar_v1: JSON.stringify(raw) }));
  assert.deepEqual(r.look, { v: 1, body: 'girl', skin: 0, hair: 'bob', hairColor: 0, outfit: 0, pet: 'chick', petName: 'bBantay the', t: 7 });
  assert.equal(r.made, true);
  assert.equal(Look.read(memory({ avatar_v1: '{nope' })).made, false);
  assert.equal(Look.read(memory({ avatar_v1: JSON.stringify(Object.assign({}, raw, { v: 2 })) })).made, false);
});

test('save stamps the time and keeps only clean values', () => {
  const s = memory();
  const out = Look.save(s, { body: 'boy', skin: 2, hair: 'short', hairColor: 3, outfit: 4, pet: 'puppy', petName: '  Max  ', t: 0 }, 1234);
  assert.deepEqual(out, { v: 1, body: 'boy', skin: 2, hair: 'short', hairColor: 3, outfit: 4, pet: 'puppy', petName: 'Max', t: 1234 });
  assert.deepEqual(JSON.parse(s.data.avatar_v1), out);
});

test('options are unique and colours are hex', () => {
  for (const [k, list] of Object.entries(Look.OPTIONS)) {
    assert.equal(new Set(list).size, list.length, k);
    if (['skin', 'hairColor', 'outfit'].includes(k)) list.forEach((c) => assert.match(c, /^#[0-9a-f]{6}$/, k));
  }
});

test('color and petName read through the options', () => {
  const look = Object.assign({}, Look.DEFAULT, { outfit: 2, pet: 'puppy' });
  assert.equal(Look.color(look, 'outfit'), Look.OPTIONS.outfit[2]);
  assert.equal(Look.petName(look, { puppy: 'Bantay' }), 'Bantay');
  assert.equal(Look.petName(Object.assign({}, look, { petName: 'Max' }), { puppy: 'Bantay' }), 'Max');
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/world3d-look.test.js`
Expected: FAIL, cannot find `web/world/look.js`.

- [ ] **Step 3: Write `web/world/look.js`**

```js
/* Her character's look, saved per learner as avatar_v1 and synced (replace merge), so her sister can see it later.
   Colours are stored as indexes into OPTIONS, so new colours are only ever appended. */
(function (root) {
  'use strict';

  var KEY = 'avatar_v1';
  var NAME_MAX = 12;
  var OPTIONS = {
    body: ['girl', 'boy'],
    skin: ['#ffe0c7', '#f6c9a0', '#e0a878', '#b97d52', '#8a5634'],
    hair: ['pigtails', 'bob', 'short'],
    hairColor: ['#5a3a2e', '#2b2140', '#a0522d', '#e8b04a', '#f4a6c8', '#7b5cff', '#4cb8e0', '#ff7f7f'],
    outfit: ['#ff8fc8', '#6aa9ff', '#5fcf9a', '#ffd166', '#a77bff', '#ff9e6b', '#4cc9a0', '#ff6f91'],
    pet: ['chick', 'kitten', 'puppy']
  };
  var INDEXED = { skin: true, hairColor: true, outfit: true };
  var DEFAULT = { v: 1, body: 'girl', skin: 0, hair: 'pigtails', hairColor: 0, outfit: 0, pet: 'chick', petName: '', t: 0 };

  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }

  function cleanName(s) {
    return typeof s === 'string' ? s.replace(/[\x00-\x1f<>&"]/g, '').trim().slice(0, NAME_MAX).trim() : '';
  }

  function clean(raw) {
    var d = isObj(raw) && raw.v === 1 ? raw : {};
    var out = { v: 1 };
    Object.keys(OPTIONS).forEach(function (k) {
      var ok = INDEXED[k] ? Number.isInteger(d[k]) && d[k] >= 0 && d[k] < OPTIONS[k].length : OPTIONS[k].indexOf(d[k]) >= 0;
      out[k] = ok ? d[k] : DEFAULT[k];
    });
    out.petName = cleanName(d.petName);
    out.t = typeof d.t === 'number' && d.t > 0 ? d.t : 0;
    return out;
  }

  function read(storage) {
    var raw = null;
    try { raw = JSON.parse(storage.getItem(KEY)); } catch (e) {}
    var look = clean(raw);
    return { look: look, made: look.t > 0 };
  }

  function save(storage, look, now) {
    var out = clean(Object.assign({}, look, { v: 1 }));
    out.t = now;
    try { storage.setItem(KEY, JSON.stringify(out)); } catch (e) {}
    return out;
  }

  function color(look, field) { return OPTIONS[field][look[field]]; }
  function petName(look, names) { return look.petName || names[look.pet]; }

  var exported = { KEY: KEY, OPTIONS: OPTIONS, DEFAULT: DEFAULT, clean: clean, read: read, save: save, color: color, petName: petName };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.Look = exported;
})(this);
```

- [ ] **Step 4: Run the test**

Run: `node --test tests/world3d-look.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Stage**

```bash
git add web/world/look.js tests/world3d-look.test.js
```

---

### Task 5: Device prefs, the return spot and the frame-rate watcher (`prefs.js`) + sync rule

**Files:**
- Create: `web/world/prefs.js`
- Modify: `web/engine/sync-core.js:8`
- Test: `tests/world3d-prefs.test.js`

- [ ] **Step 1: Write the failing test** `tests/world3d-prefs.test.js`

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile, engineFile } = require('./paths.js');
const P = require(worldFile('prefs.js'));
const { kindOf } = require(engineFile('sync-core.js'));

function memory(initial) {
  const data = Object.assign({}, initial);
  return {
    data,
    getItem: (k) => (Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: (k) => { delete data[k]; },
  };
}

test('device prefs default to auto quality with music on', () => {
  assert.deepEqual(P.readPrefs(memory()), { v: 1, quality: 'auto', music: true });
  assert.deepEqual(P.readPrefs(memory({ world3d_device_v1: '{"quality":"ultra","music":"no"}' })), { v: 1, quality: 'auto', music: true });
  const s = memory();
  P.savePrefs(s, { quality: 'low', music: false });
  assert.deepEqual(P.readPrefs(s), { v: 1, quality: 'low', music: false });
});

test('auto and high start on high; low starts on low', () => {
  assert.equal(P.startQuality({ quality: 'auto' }), 'high');
  assert.equal(P.startQuality({ quality: 'high' }), 'high');
  assert.equal(P.startQuality({ quality: 'low' }), 'low');
});

test('the return spot is kept for this tab only, and junk reads as none', () => {
  const s = memory();
  assert.equal(P.readReturn(s), null);
  P.setReturn(s, 'grade5', 'life-lab');
  assert.deepEqual(P.readReturn(s), { grade: 'grade5', app: 'life-lab' });
  P.clearReturn(s);
  assert.equal(P.readReturn(s), null);
  assert.equal(P.readReturn(memory({ world_return_v1: '[1]' })), null);
  assert.equal(P.readReturn(null), null);
});

test('three slow seconds in a row switch to low once', () => {
  const tick = P.fpsWatch(30, 3);
  const second = (fps) => { let hit = false; for (let i = 0; i < fps; i++) hit = tick(1 / fps) || hit; return hit; };
  assert.equal(second(20), false);
  assert.equal(second(20), false);
  assert.equal(second(60), false, 'a fast second starts the count again');
  assert.equal(second(20), false);
  assert.equal(second(20), false);
  assert.equal(second(20), true);
  assert.equal(second(20), false, 'only once');
});

test('device prefs never sync; her look syncs whole', () => {
  assert.equal(kindOf('world3d_device_v1'), null);
  assert.equal(kindOf('avatar_v1'), 'replace');
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/world3d-prefs.test.js`
Expected: FAIL, cannot find `web/world/prefs.js`.

- [ ] **Step 3: Write `web/world/prefs.js`**

```js
/* Small state for the 3D world: device-only prefs (quality, music), the door she left from (this tab only, so 🏠 in
   the game can bring her back), and a frame-rate watcher that asks for low quality on a slow device. */
(function (root) {
  'use strict';

  var DEVICE_KEY = 'world3d_device_v1';
  var RETURN_KEY = 'world_return_v1';
  var QUALITIES = ['auto', 'high', 'low'];

  function parse(storage, key) {
    try { return JSON.parse(storage.getItem(key)); } catch (e) { return null; }
  }

  function readPrefs(storage) {
    var d = parse(storage, DEVICE_KEY) || {};
    return { v: 1, quality: QUALITIES.indexOf(d.quality) >= 0 ? d.quality : 'auto', music: d.music !== false };
  }

  function savePrefs(storage, prefs) {
    var out = { v: 1, quality: QUALITIES.indexOf(prefs.quality) >= 0 ? prefs.quality : 'auto', music: prefs.music !== false };
    try { storage.setItem(DEVICE_KEY, JSON.stringify(out)); } catch (e) {}
    return out;
  }

  function startQuality(prefs) { return prefs.quality === 'low' ? 'low' : 'high'; }

  function setReturn(session, grade, app) {
    try { session.setItem(RETURN_KEY, JSON.stringify({ grade: grade, app: app })); } catch (e) {}
  }

  function readReturn(session) {
    if (!session) return null;
    var r = parse(session, RETURN_KEY);
    return r && typeof r === 'object' && typeof r.grade === 'string' && typeof r.app === 'string' ? { grade: r.grade, app: r.app } : null;
  }

  function clearReturn(session) {
    try { session.removeItem(RETURN_KEY); } catch (e) {}
  }

  // tick(dt) once per frame; true once, after `seconds` whole seconds in a row below `limit` frames per second.
  function fpsWatch(limit, seconds) {
    var frames = 0, time = 0, slow = 0, fired = false;
    return function tick(dt) {
      if (fired) return false;
      frames++;
      time += dt;
      if (time < 1 - 1e-9) return false;
      slow = frames / time < limit ? slow + 1 : 0;
      frames = 0;
      time = 0;
      if (slow < seconds) return false;
      fired = true;
      return true;
    };
  }

  var exported = {
    DEVICE_KEY: DEVICE_KEY, RETURN_KEY: RETURN_KEY, readPrefs: readPrefs, savePrefs: savePrefs, startQuality: startQuality,
    setReturn: setReturn, readReturn: readReturn, clearReturn: clearReturn, fpsWatch: fpsWatch
  };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.Prefs = exported;
})(this);
```

- [ ] **Step 4: Make `world3d_device_v1` device-only in `web/engine/sync-core.js`**

Replace line 8:

```js
  var LOCAL_ONLY = /^(sync_|last_backup_v1$|history_error_v1$|history_corrupt_v1_|family_peek_v1$|world3d_device_v1$)/;
```

- [ ] **Step 5: Run the tests**

Run: `node --test tests/world3d-prefs.test.js tests/sync.test.js`
Expected: PASS.

- [ ] **Step 6: Stage**

```bash
git add web/world/prefs.js web/engine/sync-core.js tests/world3d-prefs.test.js
```

---

### Task 6: Movement maths (`walk.js`)

**Files:**
- Create: `web/world/walk.js`
- Test: `tests/world3d-walk.test.js`

- [ ] **Step 1: Write the failing test** `tests/world3d-walk.test.js`

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile } = require('./paths.js');
const Walk = require(worldFile('walk.js'));

const close = (a, b) => Math.abs(a - b) < 1e-9;

test('pushing up walks away from the camera; right walks to the camera\'s right', () => {
  const up = Walk.moveVector(0, -1, 0);
  assert.ok(close(up.x, 0) && close(up.z, -1) && up.mag === 1);
  const right = Walk.moveVector(1, 0, 0);
  assert.ok(close(right.x, 1) && close(right.z, 0));
  const turned = Walk.moveVector(0, -1, Math.PI / 2);
  assert.ok(close(turned.x, -1) && close(turned.z, 0), 'camera turned: up follows it');
});

test('a tiny push does nothing; a half push walks at half speed', () => {
  assert.equal(Walk.moveVector(0.05, 0, 0), null);
  assert.ok(close(Walk.moveVector(0, -0.5, 0).mag, 0.5));
});

test('toward stops when she arrives', () => {
  const d = Walk.toward(0, 0, 3, 4);
  assert.ok(close(d.x, 0.6) && close(d.z, 0.8));
  assert.equal(Walk.toward(0, 0, 0.1, 0.1), null);
});

test('step slides along a wall instead of stopping', () => {
  const wall = (x) => x > 1;
  const next = Walk.step(1, 0, { x: Math.SQRT1_2, z: Math.SQRT1_2, mag: 1 }, 0.1, wall);
  assert.equal(next.x, 1, 'the wall stops x');
  assert.ok(next.z > 0, 'she still slides along z');
});

test('turn takes the short way round', () => {
  const t = Walk.turn(Math.PI - 0.1, -Math.PI + 0.1, 1);
  assert.ok(close(Math.cos(t), Math.cos(-Math.PI + 0.1)) && close(Math.sin(t), Math.sin(-Math.PI + 0.1)));
  assert.ok(close(Walk.turn(0, 1, 0.5), 0.5));
});

test('facing points along the direction', () => {
  assert.ok(close(Walk.facing({ x: 0, z: -1 }), Math.PI));
  assert.ok(close(Walk.facing({ x: 1, z: 0 }), Math.PI / 2));
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/world3d-walk.test.js`
Expected: FAIL, cannot find `web/world/walk.js`.

- [ ] **Step 3: Write `web/world/walk.js`**

```js
/* Movement maths for the 3D world, with no Three.js. Input is a stick position (x right, y down, -1..1) and the
   camera's yaw; the camera sits at (sin yaw, cos yaw) from her, so pushing up walks away from it. */
(function (root) {
  'use strict';

  var SPEED = 9;
  var DEAD = 0.08;
  var ARRIVE = 0.4;

  function moveVector(ix, iy, yaw) {
    var mag = Math.min(1, Math.hypot(ix, iy));
    if (mag < DEAD) return null;
    var fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
    var mx = fx * -iy + rx * ix, mz = fz * -iy + rz * ix, len = Math.hypot(mx, mz);
    return { x: mx / len, z: mz / len, mag: mag };
  }

  function toward(x, z, tx, tz) {
    var dx = tx - x, dz = tz - z, d = Math.hypot(dx, dz);
    return d < ARRIVE ? null : { x: dx / d, z: dz / d, mag: 1 };
  }

  // Moves x then z separately, so a wall in one direction still lets her slide along it.
  function step(x, z, dir, dt, blocked) {
    var sp = SPEED * dir.mag * dt, nx = x + dir.x * sp, nz = z + dir.z * sp, out = { x: x, z: z };
    if (!blocked(nx, z)) out.x = nx;
    if (!blocked(out.x, nz)) out.z = nz;
    return out;
  }

  function facing(dir) { return Math.atan2(dir.x, dir.z); }

  function turn(cur, target, k) {
    var d = (target - cur) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return cur + d * Math.min(1, k);
  }

  var exported = { SPEED: SPEED, moveVector: moveVector, toward: toward, step: step, facing: facing, turn: turn };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.Walk = exported;
})(this);
```

- [ ] **Step 4: Run the test**

Run: `node --test tests/world3d-walk.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Stage**

```bash
git add web/world/walk.js tests/world3d-walk.test.js
```

---

### Task 7: Music-box loop (`music.js`)

**Files:**
- Create: `web/world/music.js`
- Test: `tests/world3d-music.test.js`

- [ ] **Step 1: Write the failing test** `tests/world3d-music.test.js`

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile } = require('./paths.js');
const Music = require(worldFile('music.js'));

const PENTATONIC = [0, 2, 4, 7, 9];

test('the tune stays on the C major pentatonic scale, so it always sounds sweet', () => {
  for (const n of Music.MELODY.concat(Music.BASS)) {
    if (n === null) continue;
    assert.ok(Number.isInteger(n) && n >= 36 && n <= 84, String(n));
    assert.ok(PENTATONIC.includes(n % 12), String(n));
  }
});

test('with no Web Audio the music quietly does nothing', () => {
  const m = Music.create({});
  m.start();
  assert.equal(m.playing(), false);
  m.stop();
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/world3d-music.test.js`
Expected: FAIL, cannot find `web/world/music.js`.

- [ ] **Step 3: Write `web/world/music.js`**

```js
/* A soft music-box loop for the 3D world, synthesized with Web Audio so no audio file is needed. MIDI note numbers;
   null is a rest. */
(function (root) {
  'use strict';

  var MELODY = [72, 76, 79, 76, 74, 72, 69, 72, 74, 76, 74, 72, 67, 69, 72, null];
  var BASS = [48, 55, 45, 52];
  var BEAT = 0.42;

  function freq(n) { return 440 * Math.pow(2, (n - 69) / 12); }

  function create(win) {
    var ctx = null, timer = null, at = 0, i = 0;

    function note(n, t, vol, dur) {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = freq(n);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(t);
      o.stop(t + dur + 0.05);
    }

    function schedule() {
      while (at < ctx.currentTime + 1) {
        var n = MELODY[i % MELODY.length];
        if (n !== null) note(n, at, 0.05, 1.2);
        if (i % 4 === 0) note(BASS[Math.floor(i / 4) % BASS.length], at, 0.03, 1.8);
        at += BEAT;
        i++;
      }
    }

    return {
      start: function () {
        var AC = win.AudioContext || win.webkitAudioContext;
        if (!AC || timer) return;
        try {
          ctx = ctx || new AC();
          if (ctx.resume) ctx.resume();
          at = ctx.currentTime + 0.1;
          schedule();
          timer = win.setInterval(schedule, 250);
        } catch (e) { timer = null; }
      },
      stop: function () {
        if (timer) win.clearInterval(timer);
        timer = null;
      },
      playing: function () { return !!timer; }
    };
  }

  var exported = { MELODY: MELODY, BASS: BASS, create: create };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.Music = exported;
})(this);
```

- [ ] **Step 4: Run the test**

Run: `node --test tests/world3d-music.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Stage**

```bash
git add web/world/music.js tests/world3d-music.test.js
```

---

### Task 8: 🏠 goes back to the world (`nav.js`)

**Files:**
- Modify: `web/engine/nav.js` (lines 23–25, 27, 55–62, 106–112, 240–250, 264)
- Test: `tests/nav.test.js`

- [ ] **Step 1: Add the failing tests to `tests/nav.test.js`**

Change the require line to:

```js
const { controller, lobbyUrl, homeUrl, WORLD_RETURN, TEXT } = require(engineFile('nav.js'));
```

Append:

```js
test('🏠 goes back to the world when the game was opened from it', () => {
  assert.equal(homeUrl('grade5', { grade: 'grade5', app: 'life-lab' }), '../../../world/grade-5.html');
  assert.equal(homeUrl('grade2', { grade: 'grade2', app: 'block-bot' }), '../../../world/grade-2.html');
  assert.equal(homeUrl('grade5', null), '../../../lobby/grade-5.html');
  assert.equal(homeUrl('grade5', { grade: 'grade2', app: 'block-bot' }), '../../../lobby/grade-5.html');
});

test('with a world to go back to, ← and 🏠 go there and the shop still opens in the lobby', () => {
  const s = setup({ away: '../../../world/grade-5.html' });
  s.ctl.back();
  s.ctl.home();
  s.ctl.shop();
  assert.deepEqual(s.log, ['go:../../../world/grade-5.html', 'go:../../../world/grade-5.html', 'go:../../../lobby/grade-5.html#shop']);
});

test('nav reads the same return key the world writes', () => {
  const { RETURN_KEY } = require(require('./paths.js').worldFile('prefs.js'));
  assert.equal(WORLD_RETURN, RETURN_KEY);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/nav.test.js`
Expected: FAIL, `homeUrl is not a function`.

- [ ] **Step 3: Change `web/engine/nav.js`**

After `function lobbyUrl(grade) { ... }` add:

```js
  // The world page (web/world/) writes this in sessionStorage just before it opens a game.
  var WORLD_RETURN = 'world_return_v1';

  function homeUrl(grade, ret) {
    var g = grade === 'grade2' ? 'grade2' : 'grade5';
    return ret && ret.grade === g ? '../../../world/grade-' + g.slice(5) + '.html' : lobbyUrl(grade);
  }

  function worldReturn(win) {
    try { return JSON.parse(win.sessionStorage.getItem(WORLD_RETURN)); } catch (e) { return null; }
  }
```

Change the controller comment line to:

```js
  // The rules, with no DOM: o = { home, lobby, away?, goHome, back?, inRound, go(url), ask(proceed, stay), history }.
  // away: where ← and 🏠 leave the game to (the world when she came from it); the shop always opens in the lobby.
```

In `controller`, replace the `back` and `home` entries:

```js
      back: function () {
        if (onHome()) o.go(o.away || o.lobby);
        else guard(back);
      },
      home: function () { guard(function () { o.go(o.away || o.lobby); }); },
```

In `create`, change `api` to:

```js
    var api = {
      lobby: lobbyUrl(grade),
      away: homeUrl(grade, worldReturn(win)),
      go: function (url) { win.location.href = url; },
      start: start,
      screen: function (id) { if (ctl) ctl.screen(id); },
      current: function () { return ctl ? ctl.current() : null; }
    };
```

In `start`, add `away: api.away,` right after `lobby: api.lobby,`.

Change the exports line to:

```js
  var exported = { TEXT: TEXT, lobbyUrl: lobbyUrl, homeUrl: homeUrl, WORLD_RETURN: WORLD_RETURN, controller: controller };
```

- [ ] **Step 4: Run the tests**

Run: `node --test tests/nav.test.js tests/nav-wiring.test.js`
Expected: PASS.

- [ ] **Step 5: Stage**

```bash
git add web/engine/nav.js tests/nav.test.js
```

---

### Task 9: The 3D stage (`scene.js`)

**Files:**
- Create: `web/world/scene.js`

No unit test (needs WebGL); the e2e test in Task 15 covers it.

- [ ] **Step 1: Write `web/world/scene.js`**

```js
/* The 3D stage: renderer, sky, lights, toon materials and shared shapes. Everything the world draws goes through these
   helpers, so each shape and material is made once and reused. Needs THREE (r149) and THREE.RoundedBoxGeometry. */
(function (root) {
  'use strict';
  var W = root.World3D = root.World3D || {};

  function create(host, quality) {
    var THREE = root.THREE, doc = root.document;
    var renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.physicallyCorrectLights = true;
    if (THREE.ColorManagement) THREE.ColorManagement.legacyMode = false;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(renderer.domElement);

    var scene = new THREE.Scene();
    scene.background = gradient(['#9fd8ff', '#d6ecff', '#ffe3f1']);
    scene.fog = new THREE.Fog('#ffe9f4', 80, 190);
    var camera = new THREE.PerspectiveCamera(50, 1, 0.1, 400);
    scene.add(new THREE.HemisphereLight('#fff6fb', '#b8f0c0', 1.6));
    var sun = new THREE.DirectionalLight('#fff4e0', 1.9);
    sun.shadow.mapSize.set(2048, 2048);
    var sc = sun.shadow.camera;
    sc.left = -45; sc.right = 45; sc.top = 45; sc.bottom = -45; sc.far = 160;
    scene.add(sun);
    scene.add(sun.target);
    // Flowers, clouds and other extras: hidden on low quality.
    var detail = new THREE.Group();
    scene.add(detail);

    var ramp = new THREE.DataTexture(new Uint8Array([150, 150, 150, 255, 210, 210, 210, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
    ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
    ramp.needsUpdate = true;
    var mats = {}, geos = {};

    function canvasTexture(c) {
      var t = new THREE.CanvasTexture(c);
      t.encoding = THREE.sRGBEncoding;
      t.anisotropy = 4;
      return t;
    }

    function gradient(stops) {
      var c = doc.createElement('canvas');
      c.width = 2; c.height = 256;
      var x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 256);
      stops.forEach(function (s, i) { g.addColorStop(i / (stops.length - 1), s); });
      x.fillStyle = g;
      x.fillRect(0, 0, 2, 256);
      return canvasTexture(c);
    }

    // own: a material of its own (not shared), for things that change colour, like a door mat.
    function toon(color, opts, own) {
      var key = color + JSON.stringify(opts || {});
      if (!own && mats[key]) return mats[key];
      var m = new THREE.MeshToonMaterial(Object.assign({ color: color, gradientMap: ramp }, opts || {}));
      if (!own) mats[key] = m;
      return m;
    }

    function cached(key, make) { return geos[key] || (geos[key] = make()); }
    function rbox(w, h, d, r) { return cached('b' + [w, h, d, r], function () { return new THREE.RoundedBoxGeometry(w, h, d, 4, r); }); }
    function ball(r) { return cached('s' + r, function () { return new THREE.SphereGeometry(r, 20, 14); }); }
    function cyl(rt, rb, h, seg) { return cached('c' + [rt, rb, h, seg], function () { return new THREE.CylinderGeometry(rt, rb, h, seg); }); }
    function cone(r, h, seg) { return cached('k' + [r, h, seg], function () { return new THREE.ConeGeometry(r, h, seg); }); }

    function add(geo, mat, x, y, z, parent) {
      var o = new THREE.Mesh(geo, typeof mat === 'string' ? toon(mat) : mat);
      o.position.set(x || 0, y || 0, z || 0);
      o.castShadow = true;
      o.receiveShadow = true;
      (parent || scene).add(o);
      return o;
    }

    // A white pill with a coloured centre and the text in white; long text shrinks to fit.
    function label(text, bg) {
      var c = doc.createElement('canvas');
      c.width = 512; c.height = 180;
      var x = c.getContext('2d');
      function pill(l, t, w, h) {
        var r = h / 2;
        x.beginPath();
        x.moveTo(l + r, t);
        x.arcTo(l + w, t, l + w, t + h, r);
        x.arcTo(l + w, t + h, l, t + h, r);
        x.arcTo(l, t + h, l, t, r);
        x.arcTo(l, t, l + w, t, r);
        x.fill();
      }
      x.fillStyle = 'rgba(0,0,0,.12)'; pill(14, 22, 484, 148);
      x.fillStyle = '#ffffff'; pill(8, 8, 496, 152);
      x.fillStyle = bg; pill(20, 20, 472, 128);
      var size = 70;
      do { x.font = '800 ' + size + 'px "Baloo 2", sans-serif'; size -= 4; } while (x.measureText(text).width > 430 && size > 26);
      x.fillStyle = '#ffffff';
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.fillText(text, 256, 90);
      return canvasTexture(c);
    }

    function emoji(e) {
      var c = doc.createElement('canvas');
      c.width = c.height = 128;
      var x = c.getContext('2d');
      x.font = '96px serif';
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.fillText(e, 64, 72);
      return canvasTexture(c);
    }

    function sprite(tex, w, h) {
      var s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
      s.scale.set(w, h, 1);
      return s;
    }

    function resize() {
      var w = root.innerWidth, h = root.innerHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }

    function setQuality(q) {
      var high = q !== 'low';
      renderer.setPixelRatio(high ? Math.min(root.devicePixelRatio || 1, 2) : 1);
      renderer.shadowMap.enabled = high;
      sun.castShadow = high;
      detail.visible = high;
      scene.traverse(function (o) {
        if (o.material) [].concat(o.material).forEach(function (m) { m.needsUpdate = true; });
      });
      resize();
    }

    function follow(x, z) {
      sun.position.set(x + 25, 45, z + 25);
      sun.target.position.set(x, 0, z);
    }

    // After the browser gives the 3D graphics back, canvas pictures must be uploaded again.
    function refreshTextures() {
      scene.traverse(function (o) {
        if (o.material) [].concat(o.material).forEach(function (m) { if (m.map) m.map.needsUpdate = true; });
      });
      if (scene.background) scene.background.needsUpdate = true;
      ramp.needsUpdate = true;
    }

    root.addEventListener('resize', resize);
    setQuality(quality);

    return {
      THREE: THREE, renderer: renderer, scene: scene, camera: camera, sun: sun, detail: detail, ramp: ramp,
      toon: toon, add: add, rbox: rbox, ball: ball, cyl: cyl, cone: cone, label: label, emoji: emoji, sprite: sprite,
      canvasTexture: canvasTexture, setQuality: setQuality, resize: resize, follow: follow, refreshTextures: refreshTextures,
      render: function () { renderer.render(scene, camera); }
    };
  }

  W.Scene = { create: create };
})(this);
```

- [ ] **Step 2: Check the syntax**

Run: `node --check web/world/scene.js`
Expected: no output.

- [ ] **Step 3: Stage**

```bash
git add web/world/scene.js
```

---

### Task 10: The places (`build.js`)

**Files:**
- Create: `web/world/build.js`

- [ ] **Step 1: Write `web/world/build.js`**

```js
/* Draws the world from layout.js: ground and paths, School Street's buildings, the Boss Fort with its rainbow, the
   Plaza with the fountain and the quick-travel signpost, Jesus' Garden, Shop Plaza, Whispering Park, My Little House
   with the mirror, the Playground and the gate. Later phases put characters and markers into these places. */
(function (root) {
  'use strict';
  var W = root.World3D = root.World3D || {};
  var TREE_COLORS = ['#7fdc8b', '#ffb7d5', '#8ee0c0', '#b8e986'];
  var FLOWER_COLORS = ['#ff8fab', '#ffd166', '#ffffff', '#c77dff'];
  var RAINBOW = ['#ff9aa2', '#ffdac1', '#fff5ba', '#b5ead7', '#c7ceea'];

  function build(S, grade, T) {
    var THREE = S.THREE, L = W.Layout, add = S.add, rbox = S.rbox, ball = S.ball, toon = S.toon;
    var cfg = L.GRADES[grade], P = L.places(grade), pr = L.props(grade), obs = L.obstacles(grade);
    var doorMats = {}, signs = [], clouds = [], sparks = [];

    function flat(m) { m.castShadow = false; return m; }
    function group(x, z, rot) {
      var g = new THREE.Group();
      g.position.set(x, 0, z);
      g.rotation.y = rot || 0;
      S.scene.add(g);
      return g;
    }
    function floatSign(text, bg, x, y, z, w, parent) {
      var s = S.sprite(S.label(text, bg), w, w * 180 / 512);
      s.position.set(x, y, z);
      s.userData.y = y;
      s.userData.phase = signs.length;
      (parent || S.scene).add(s);
      signs.push(s);
      return s;
    }

    function ground() {
      var b = cfg.bounds;
      var g = flat(add(new THREE.PlaneGeometry(b.maxX - b.minX + 160, b.maxZ - b.minZ + 160), '#a8e6a1', (b.minX + b.maxX) / 2, 0, (b.minZ + b.maxZ) / 2));
      g.rotation.x = -Math.PI / 2;
      L.paths(grade).forEach(function (p) {
        var dx = p.to[0] - p.from[0], dz = p.to[1] - p.from[1];
        var m = flat(add(rbox(p.w, 0.2, Math.hypot(dx, dz) + p.w, 0.1), '#fff1d6', (p.from[0] + p.to[0]) / 2, 0, (p.from[1] + p.to[1]) / 2));
        m.rotation.y = Math.atan2(dx, dz);
      });
    }

    function porthole(g, x, y, z) {
      add(S.cyl(1.15, 1.15, 0.3, 28), '#ffffff', x, y, z, g).rotation.x = Math.PI / 2;
      add(S.cyl(0.9, 0.9, 0.35, 28), toon('#fffbe0', { emissive: '#fff3b0', emissiveIntensity: 0.5 }), x, y, z + 0.05, g).rotation.x = Math.PI / 2;
      add(rbox(2.6, 0.5, 0.8, 0.2), '#ffffff', x, y - 1.35, z + 0.25, g);
      for (var k = 0; k < 3; k++) add(ball(0.32), FLOWER_COLORS[k], x - 0.8 + k * 0.8, y - 0.95, z + 0.35, g);
    }

    // Local +z is the front, turned to face the street.
    function building(b) {
      var g = group(b.x, b.z, b.rot);
      add(rbox(11.5, 0.7, 9.5, 0.3), '#ffffff', 0, 0.35, 0, g);
      add(rbox(10, 6.4, 8, 1.2), b.wall, 0, 3.7, 0, g);
      if (b.shape === 'dome') {
        add(ball(5.4), b.roof, 0, 6.9, 0, g).scale.set(1, 0.62, 0.8);
        add(ball(0.6), '#fff6a8', 0, 10.5, 0, g);
      } else if (b.shape === 'cone') {
        add(S.cone(6.6, 4.6, 32), b.roof, 0, 9.3, 0, g).scale.z = 0.8;
        add(ball(0.55), '#fff6a8', 0, 11.8, 0, g);
      } else {
        add(rbox(10.6, 1.4, 8.6, 0.6), b.roof, 0, 7.4, 0, g);
        for (var d = -4; d <= 4; d += 1.6) add(ball(0.55), b.roof, d, 6.7, 4.2, g);
        add(rbox(3, 2.4, 3, 0.6), '#ffffff', 0, 9, 0, g);
        add(ball(0.7), '#ff6f91', 0, 10.7, 0, g);
      }
      add(rbox(2.6, 3.8, 0.5, 0.25), '#c98b6b', 0, 2.6, 4.05, g);
      add(ball(1.3), '#c98b6b', 0, 4.5, 4.05, g).scale.set(1, 0.6, 0.38);
      add(ball(0.2), '#ffd166', 0.8, 2.5, 4.35, g);
      porthole(g, -3.3, 4.3, 4.05);
      porthole(g, 3.3, 4.3, 4.05);
      floatSign(b.emoji + ' ' + b.sign, b.roof, 0, b.shape === 'cake' ? 12.2 : 11.8, 0, 6.4 * cfg.signScale, g);
      doorMats[b.app] = flat(add(S.cyl(2.1, 2.1, 0.12, 40), toon('#ffffff', { transparent: true, opacity: 0.85 }, true), 0, 0.1, L.BUILDING.doorOut, g));
    }

    function fort(p) {
      var g = group(p.x, p.z);
      add(S.cyl(9, 9.8, 6.5, 32), '#c9b6e4', 0, 3.25, 0, g);
      for (var c = 0; c < 12; c++) {
        var a = c / 12 * Math.PI * 2;
        add(rbox(1.7, 1.7, 1.7, 0.4), '#b39ddb', Math.cos(a) * 9, 7.3, Math.sin(a) * 9, g);
      }
      add(rbox(4, 4.4, 0.6, 0.6), '#8e7cc3', 0, 2.2, 9.7, g);
      add(S.cyl(0.15, 0.15, 6, 8), '#ffffff', 0, 9.5, 0, g);
      add(rbox(3, 1.8, 0.2, 0.2), '#ff6f91', 1.6, 11.5, 0, g);
      floatSign(L.PLACE_EMOJI.boss + ' ' + T.places.boss, '#ff6f91', 0, 14, 0, 7.5 * cfg.signScale, g);
      var bow = new THREE.Group();
      bow.position.set(0, 0, -10);
      g.add(bow);
      RAINBOW.forEach(function (rc, i) {
        flat(add(new THREE.TorusGeometry(24 - i * 1.6, 0.8, 12, 64, Math.PI), toon(rc, { transparent: true, opacity: 0.85 }), 0, 0, 0, bow));
      });
    }

    function plaza(p) {
      var g = group(p.x, p.z);
      flat(add(S.cyl(p.r, p.r, 0.16, 48), '#ffe3f1', 0, 0.06, 0, g));
      add(S.cyl(3.2, 3.4, 1, 32), '#ffffff', 0, 0.5, 0, g);
      flat(add(S.cyl(2.8, 2.8, 0.2, 32), '#9ed8ff', 0, 1.0, 0, g));
      add(S.cyl(0.5, 0.7, 2.4, 16), '#ffffff', 0, 1.6, 0, g);
      add(ball(1.0), '#9ed8ff', 0, 3.1, 0, g).scale.set(1, 0.6, 1);
      var post = pr.signpost;
      add(S.cyl(0.25, 0.25, 4, 10), '#c48a6a', post.x, 2, post.z);
      add(rbox(3.4, 1, 0.3, 0.2), '#ffd166', post.x, 3.6, post.z).rotation.y = Math.PI / 4;
      floatSign(T.signpost, '#ffb347', post.x, 5.8, post.z, 4.8 * cfg.signScale);
    }

    function garden(p) {
      var g = group(p.x, p.z);
      flat(add(S.cyl(p.r, p.r, 0.12, 48), '#fff1de', 0, 0.05, 0, g));
      var lx = pr.bench.x - p.x;
      add(rbox(1.6, 0.5, 5, 0.2), '#e7b58c', lx, 1.3, 0, g);
      add(rbox(0.4, 1.4, 5, 0.2), '#e7b58c', lx - 0.7, 2.2, 0, g);
      add(rbox(1.4, 1.1, 0.4, 0.15), '#c98f62', lx, 0.55, -2, g);
      add(rbox(1.4, 1.1, 0.4, 0.15), '#c98f62', lx, 0.55, 2, g);
      for (var f = 0; f < 40; f++) {
        var a = f / 40 * Math.PI * 2;
        flat(add(ball(0.3), FLOWER_COLORS[f % 4], Math.cos(a) * (p.r - 1.5), 0.35, Math.sin(a) * (p.r - 1.5), g));
      }
      floatSign(L.PLACE_EMOJI.garden + ' ' + T.places.garden, '#ffb347', 0, 7, 0, 7 * cfg.signScale, g);
    }

    // Front faces west, toward the plaza.
    function shop() {
      var s = pr.shop, g = group(s.x, s.z, -Math.PI / 2);
      add(rbox(s.hz * 2, 5.5, 10, 1), '#fff6c9', 0, 2.75, -1, g);
      for (var k = 0; k < 6; k++) add(rbox(2, 0.5, 1.6, 0.2), k % 2 ? '#ffffff' : '#ff8fab', -5 + k * 2, 5.4, 4.4, g);
      add(rbox(6, 1.2, 1.2, 0.4), '#ffd166', 0, 1.2, 5, g);
      floatSign(L.PLACE_EMOJI.shop + ' ' + T.places.shop, '#ffb347', 0, 8.5, 0, 7 * cfg.signScale, g);
    }

    function park(p) {
      var g = group(p.x, p.z), pond = pr.pond;
      flat(add(S.cyl(p.r, p.r, 0.1, 48), '#b8ecc8', 0, 0.04, 0, g));
      flat(add(S.cyl(pond.r, pond.r, 0.14, 36), '#9ed8ff', pond.x - p.x, 0.08, pond.z - p.z, g));
      for (var k = 0; k < 3; k++) flat(add(S.cyl(0.6, 0.6, 0.06, 16), '#7fdc8b', pond.x - p.x - 1.5 + k * 1.4, 0.18, pond.z - p.z + (k % 2 ? 1 : -0.8), g));
      floatSign(L.PLACE_EMOJI.park + ' ' + T.places.park, '#5fcf9a', 0, 8, 0, 7 * cfg.signScale, g);
    }

    function house() {
      var h = pr.house, g = group(h.x, h.z, -Math.PI / 2);
      add(rbox(h.hz * 2, 5, h.hx * 2, 1), '#ffd6e7', 0, 2.5, 0, g);
      add(S.cone(7.4, 4, 4), '#ff8fab', 0, 7, 0, g).rotation.y = Math.PI / 4;
      add(rbox(2.2, 3.4, 0.4, 0.2), '#c98b6b', 0, 1.7, h.hx + 0.05, g);
      add(S.cyl(0.9, 0.9, 0.3, 24), '#fffbe0', -2.8, 3, h.hx + 0.05, g).rotation.x = Math.PI / 2;
      add(S.cyl(0.9, 0.9, 0.3, 24), '#fffbe0', 2.8, 3, h.hx + 0.05, g).rotation.x = Math.PI / 2;
      floatSign(L.PLACE_EMOJI.house + ' ' + T.places.house, '#ff8fab', 0, 10.5, 0, 7 * cfg.signScale, g);
      // The mirror looks north, at her when she stands at the mirror spot.
      var m = pr.mirror, mg = group(m.x, m.z, Math.PI);
      add(rbox(2.4, 3.4, 0.4, 0.3), '#ffd166', 0, 2.2, 0, mg);
      add(rbox(1.9, 2.9, 0.1, 0.25), toon('#dff4ff', { emissive: '#bfe6ff', emissiveIntensity: 0.4 }), 0, 2.2, 0.22, mg);
      add(rbox(1.2, 0.3, 1, 0.1), '#ffd166', 0, 0.15, 0, mg);
      var spark = S.sprite(S.emoji('🪞'), 1.4, 1.4);
      spark.position.set(0, 4.6, 0);
      mg.add(spark);
    }

    function playground(p) {
      flat(add(S.cyl(p.r, p.r, 0.1, 48), '#ffe9b8', p.x, 0.04, p.z));
      var sl = pr.slide, sw = pr.swings, se = pr.seesaw, mr = pr.merry;
      add(rbox(1.6, 0.3, 5.6, 0.15), '#ff8fab', sl.x, 1.8, sl.z + 0.4, null).rotation.x = -0.55;
      add(rbox(1.6, 3.6, 1.4, 0.3), '#6aa9ff', sl.x, 1.8, sl.z - 2.4);
      add(S.cyl(0.18, 0.18, 4.4, 8), '#a77bff', sw.x - 2.8, 2.2, sw.z);
      add(S.cyl(0.18, 0.18, 4.4, 8), '#a77bff', sw.x + 2.8, 2.2, sw.z);
      add(S.cyl(0.18, 0.18, 6, 8), '#a77bff', sw.x, 4.4, sw.z).rotation.z = Math.PI / 2;
      add(rbox(1, 0.2, 0.7, 0.1), '#ffd166', sw.x - 1.2, 1.2, sw.z);
      add(rbox(1, 0.2, 0.7, 0.1), '#ffd166', sw.x + 1.2, 1.2, sw.z);
      add(rbox(6, 0.25, 0.7, 0.12), '#5fcf9a', se.x, 0.9, se.z).rotation.z = 0.15;
      add(S.cone(0.6, 0.8, 4), '#ffffff', se.x, 0.4, se.z);
      add(S.cyl(mr.r, mr.r, 0.4, 24), '#ff9e6b', mr.x, 0.5, mr.z);
      add(S.cyl(0.2, 0.2, 2, 8), '#ffffff', mr.x, 1.6, mr.z);
      floatSign(L.PLACE_EMOJI.playground + ' ' + T.places.playground, '#ff9e6b', p.x, 7.5, p.z, 7 * cfg.signScale);
    }

    function gate(p) {
      pr.posts.forEach(function (c) {
        add(S.cyl(0.7, 0.7, 7, 20), '#ffffff', c.x, 3.5, c.z);
        add(ball(1.1), '#ffb3d9', c.x, 7.4, c.z);
      });
      add(new THREE.TorusGeometry(6.5, 0.5, 16, 48, Math.PI), '#ffd166', p.x, 7, p.z);
      floatSign(L.PLACE_EMOJI.gate + ' ' + T.title, '#c77dff', p.x, 9.8, p.z, 9 * cfg.signScale);
    }

    function tree(t) {
      var s = t.s, c = TREE_COLORS[t.c];
      add(S.cyl(0.35 * s, 0.5 * s, 2.4 * s, 12), '#c48a6a', t.x, 1.2 * s, t.z);
      add(ball(1.8 * s), c, t.x, 3.6 * s, t.z);
      add(ball(1.3 * s), c, t.x - 1.2 * s, 3.1 * s, t.z + 0.3 * s);
      add(ball(1.2 * s), c, t.x + 1.1 * s, 3.3 * s, t.z - 0.2 * s);
    }

    function details() {
      var b = cfg.bounds, w = b.maxX - b.minX - 16, d = b.maxZ - b.minZ - 16;
      for (var f = 0; f < 160; f++) {
        var x = b.minX + 8 + (f * 53 % w), z = b.minZ + 8 + (f * 97 % d);
        if (L.blocked(obs, b, x, z, 0.4) || L.onPath(grade, x, z, 0.6)) continue;
        flat(add(ball(0.32), FLOWER_COLORS[f % 4], x, 0.45, z, S.detail));
      }
      for (var k = 0; k < 10; k++) {
        var cg = new THREE.Group();
        cg.position.set(-80 + k * 17, 30 + (k % 3) * 6, b.minZ + 20 + (k * 23 % (b.maxZ - b.minZ - 40)));
        [[0, 0, 2.6], [2.6, 0.6, 3], [5.2, 0, 2.4], [2.6, -0.6, 2.2]].forEach(function (p) { flat(add(ball(p[2]), '#ffffff', p[0], p[1], 0, cg)); });
        S.detail.add(cg);
        clouds.push(cg);
      }
    }

    function sparkle(x, z) {
      for (var i = 0; i < 12; i++) {
        var s = S.sprite(S.emoji(i % 2 ? '✨' : '💗'), 1, 1);
        s.position.set(x + (Math.random() - 0.5) * 3, 1 + Math.random() * 2, z + (Math.random() - 0.5) * 3);
        S.scene.add(s);
        sparks.push({ s: s, vy: 2 + Math.random() * 2, life: 1.4 });
      }
    }

    function animate(t, dt, nearDoor) {
      signs.forEach(function (s) { s.position.y = s.userData.y + Math.sin(t * 2 + s.userData.phase) * 0.25; });
      Object.keys(doorMats).forEach(function (app) {
        var on = app === nearDoor, m = doorMats[app], k = 1 + Math.sin(t * 3) * 0.06 + (on ? 0.2 : 0);
        m.material.color.set(on ? '#ffe066' : '#ffffff');
        m.scale.set(k, 1, k);
      });
      clouds.forEach(function (c, i) {
        c.position.x += dt * (0.6 + (i % 3) * 0.3);
        if (c.position.x > 95) c.position.x = -95;
      });
      sparks = sparks.filter(function (p) {
        p.life -= dt;
        p.s.position.y += p.vy * dt;
        p.s.material.opacity = Math.max(0, Math.min(1, p.life));
        if (p.life > 0) return true;
        S.scene.remove(p.s);
        p.s.material.map.dispose();
        p.s.material.dispose();
        return false;
      });
    }

    ground();
    L.buildings(grade).forEach(building);
    fort(P.boss);
    plaza(P.plaza);
    garden(P.garden);
    shop();
    park(P.park);
    house();
    playground(P.playground);
    gate(P.gate);
    L.trees(grade).forEach(tree);
    details();

    return { animate: animate, sparkle: sparkle };
  }

  W.Build = { build: build };
})(this);
```

- [ ] **Step 2: Check the syntax**

Run: `node --check web/world/build.js`
Expected: no output.

- [ ] **Step 3: Stage**

```bash
git add web/world/build.js
```

---

### Task 11: Her character and pet (`avatar.js`)

**Files:**
- Create: `web/world/avatar.js`

- [ ] **Step 1: Write `web/world/avatar.js`**

```js
/* Her chibi character, built from avatar_v1 parts (body, skin, hair style and colour, outfit colour), and her pet.
   Spec 2 adds more parts here. The character faces local +z. */
(function (root) {
  'use strict';
  var W = root.World3D = root.World3D || {};
  var SHOE = '#ffffff', SHORTS = '#4a5a8a', BOW = '#ff6f91', KNOT = '#ffd166', EYE = '#3a2a4f';

  function faceTexture(S, skin) {
    var c = root.document.createElement('canvas');
    c.width = c.height = 256;
    var x = c.getContext('2d');
    x.fillStyle = skin;
    x.fillRect(0, 0, 256, 256);
    [[86, 132], [170, 132]].forEach(function (e) {
      x.fillStyle = EYE; x.beginPath(); x.ellipse(e[0], e[1], 22, 30, 0, 0, 7); x.fill();
      x.fillStyle = '#7b5cff'; x.beginPath(); x.ellipse(e[0], e[1] + 8, 16, 18, 0, 0, 7); x.fill();
      x.fillStyle = '#ffffff'; x.beginPath(); x.arc(e[0] + 8, e[1] - 12, 9, 0, 7); x.fill();
      x.beginPath(); x.arc(e[0] - 8, e[1] + 10, 4, 0, 7); x.fill();
    });
    x.fillStyle = 'rgba(255,120,160,.55)';
    x.beginPath(); x.ellipse(52, 178, 22, 12, 0, 0, 7); x.fill();
    x.beginPath(); x.ellipse(204, 178, 22, 12, 0, 0, 7); x.fill();
    x.fillStyle = BOW;
    x.beginPath(); x.moveTo(114, 176); x.quadraticCurveTo(128, 200, 142, 176); x.closePath(); x.fill();
    return S.canvasTexture(c);
  }

  function character(S, look) {
    var THREE = S.THREE, L = W.Look, add = S.add, rbox = S.rbox, ball = S.ball;
    var skin = L.color(look, 'skin'), hair = L.color(look, 'hairColor'), cloth = L.color(look, 'outfit'), girl = look.body === 'girl';
    var group = new THREE.Group(), body = new THREE.Group();
    group.add(body);
    var head = new THREE.Group();
    head.position.y = 4.1;
    body.add(head);

    var skinMat = S.toon(skin);
    var face = new THREE.MeshToonMaterial({ map: faceTexture(S, skin), gradientMap: S.ramp });
    add(rbox(2.6, 2.4, 2.4, 0.9), [skinMat, skinMat, skinMat, skinMat, face, skinMat], 0, 0, 0, head);
    add(rbox(2.8, 1.1, 2.6, 0.5), hair, 0, 0.95, -0.1, head);
    add(rbox(0.9, 0.7, 0.6, 0.3), hair, -0.75, 0.55, 1.05, head).rotation.z = 0.3;
    if (look.hair !== 'short') add(rbox(2.8, 1.8, 0.9, 0.45), hair, 0, 0.1, -1.0, head);
    if (look.hair === 'pigtails') {
      [-1, 1].forEach(function (s) {
        add(ball(0.6), hair, s * 1.6, -0.3, -0.6, head).scale.set(0.8, 1.3, 0.8);
        add(ball(0.32), KNOT, s * 1.45, 0.25, -0.6, head);
      });
    }
    if (look.hair === 'bob') {
      [-1, 1].forEach(function (s) { add(rbox(0.5, 2, 2.2, 0.25), hair, s * 1.4, -0.2, -0.1, head); });
    }
    if (girl) {
      var bow = new THREE.Group();
      bow.position.set(0.9, 1.45, 0.3);
      bow.rotation.z = -0.3;
      head.add(bow);
      add(ball(0.5), BOW, -0.45, 0, 0, bow).scale.set(1, 0.7, 0.5);
      add(ball(0.5), BOW, 0.45, 0, 0, bow).scale.set(1, 0.7, 0.5);
      add(ball(0.22), KNOT, 0, 0, 0.1, bow);
      add(S.cyl(0.75, 1.15, 1.9, 24), cloth, 0, 2.05, 0, body);
      add(new THREE.TorusGeometry(1.05, 0.14, 8, 32), '#ffffff', 0, 1.2, 0, body).rotation.x = Math.PI / 2;
    } else {
      add(S.cyl(0.85, 0.95, 1.5, 24), cloth, 0, 2.3, 0, body);
      add(rbox(1.8, 0.7, 1.4, 0.3), SHORTS, 0, 1.4, 0, body);
    }
    add(ball(0.18), '#ffffff', 0, 2.5, 0.85, body);

    function limb(color, x, y, len, r) {
      var p = new THREE.Group();
      p.position.set(x, y, 0);
      body.add(p);
      add(rbox(r * 2, len, r * 2, r * 0.95), color, 0, -len / 2, 0, p);
      return p;
    }
    var armL = limb(girl ? skin : cloth, -0.95, 2.75, 1.2, 0.27), armR = limb(girl ? skin : cloth, 0.95, 2.75, 1.2, 0.27);
    var legL = limb(skin, -0.38, 1.15, 1.05, 0.3), legR = limb(skin, 0.38, 1.15, 1.05, 0.3);
    [legL, legR].forEach(function (l) { add(rbox(0.7, 0.4, 0.85, 0.18), SHOE, 0, -1.05, 0.1, l); });

    var blob = new THREE.Mesh(new THREE.CircleGeometry(1.2, 24), new THREE.MeshBasicMaterial({ color: '#7a3e8e', transparent: true, opacity: 0.15, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2;
    blob.position.y = 0.13;
    group.add(blob);

    function animate(t, walkT, mag) {
      var m = Math.min(1, mag), sw = Math.sin(walkT) * 0.7 * m, hop = Math.abs(Math.sin(walkT));
      legL.rotation.x = sw; legR.rotation.x = -sw;
      armL.rotation.x = -sw; armR.rotation.x = sw;
      armL.rotation.z = -0.25; armR.rotation.z = 0.25;
      body.position.y = hop * 0.25 * Math.min(1, m * 2);
      body.scale.set(1 + (1 - hop) * 0.04 * m, 1 - (1 - hop) * 0.05 * m, 1);
      head.rotation.z = Math.sin(t * 1.6) * 0.05;
      head.position.y = 4.1 + Math.sin(t * 2.2) * 0.05;
    }

    function dispose() {
      face.map.dispose();
      face.dispose();
    }

    return { group: group, animate: animate, dispose: dispose };
  }

  function pet(S, kind) {
    var THREE = S.THREE, add = S.add, ball = S.ball, rbox = S.rbox;
    var group = new THREE.Group(), body = new THREE.Group();
    group.add(body);
    if (kind === 'kitten') {
      add(ball(0.7), '#ffb86b', 0, 0.7, 0, body).scale.set(1, 0.9, 1.2);
      add(ball(0.62), '#ffb86b', 0, 1.45, 0.55, body);
      [-0.35, 0.35].forEach(function (x) {
        add(S.cone(0.2, 0.45, 4), '#ffb86b', x, 2.0, 0.5, body);
        add(ball(0.09), EYE, x * 0.7, 1.55, 1.1, body);
      });
      add(ball(0.08), '#ff8fab', 0, 1.38, 1.16, body);
      add(S.cyl(0.1, 0.12, 1.1, 8), '#ffb86b', 0, 1.2, -0.9, body).rotation.x = -0.6;
    } else if (kind === 'puppy') {
      add(ball(0.72), '#f2d1a8', 0, 0.72, 0, body).scale.set(1, 0.9, 1.25);
      add(ball(0.64), '#f2d1a8', 0, 1.5, 0.55, body);
      [-0.55, 0.55].forEach(function (x) {
        add(rbox(0.25, 0.7, 0.45, 0.12), '#a0522d', x, 1.4, 0.45, body);
        add(ball(0.09), EYE, x * 0.45, 1.62, 1.12, body);
      });
      add(ball(0.13), EYE, 0, 1.42, 1.18, body);
      add(S.cyl(0.08, 0.1, 0.7, 8), '#f2d1a8', 0, 1.0, -0.95, body).rotation.x = -1;
    } else {
      add(ball(0.75), '#ffe066', 0, 0.75, 0, body);
      add(S.cone(0.18, 0.35, 12), '#ffa94d', 0, 0.85, 0.78, body).rotation.x = Math.PI / 2;
      [-0.28, 0.28].forEach(function (x) { add(ball(0.1), EYE, x, 1.0, 0.65, body); });
      add(ball(0.22), '#ffd43b', 0, 1.55, -0.1, body).scale.set(0.5, 1, 1);
    }
    return { group: group, animate: function (t) { body.position.y = Math.abs(Math.sin(t * 7)) * 0.3; } };
  }

  W.Avatar = { character: character, pet: pet };
})(this);
```

- [ ] **Step 2: Check the syntax**

Run: `node --check web/world/avatar.js`
Expected: no output.

- [ ] **Step 3: Stage**

```bash
git add web/world/avatar.js
```

---

### Task 12: Moving and the camera (`move.js`)

**Files:**
- Create: `web/world/move.js`

- [ ] **Step 1: Write `web/world/move.js`**

```js
/* Input and camera for the 3D world: the paw joystick, WASD/arrow keys, dragging to turn the camera, and tap-to-walk
   (o.tapWalk). The maths is in walk.js; this file turns pointers and keys into it and moves the camera behind her. */
(function (root) {
  'use strict';
  var W = root.World3D = root.World3D || {};
  var TAP_MOVE = 8, TAP_MS = 350, CAM_DIST = 15;

  // o = { win, canvas, joy, knob, tapWalk, blocked(x, z) }
  function create(S, o) {
    var THREE = S.THREE, Walk = W.Walk, win = o.win;
    var st = { x: 0, z: 0, face: Math.PI, yaw: 0, pitch: 0.32, target: null, walkT: 0, mag: 0 };
    var frozen = false, keys = {}, joy = { x: 0, y: 0 }, joyId = null, lookId = null, last = null, down = null;
    var camPos = new THREE.Vector3(), ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), hit = new THREE.Vector3();
    var groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    function typing(e) { return e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName); }
    win.addEventListener('keydown', function (e) { if (!typing(e)) keys[String(e.key).toLowerCase()] = true; });
    win.addEventListener('keyup', function (e) { keys[String(e.key).toLowerCase()] = false; });
    win.addEventListener('blur', function () { keys = {}; });

    o.joy.addEventListener('pointerdown', function (e) {
      if (joyId !== null) return;
      joyId = e.pointerId;
      moveJoy(e);
      e.preventDefault();
    });
    o.canvas.addEventListener('pointerdown', function (e) {
      if (lookId !== null) return;
      lookId = e.pointerId;
      last = { x: e.clientX, y: e.clientY };
      down = { x: e.clientX, y: e.clientY, at: Date.now() };
    });
    win.addEventListener('pointermove', function (e) {
      if (e.pointerId === joyId) moveJoy(e);
      else if (e.pointerId === lookId && !frozen) {
        st.yaw -= (e.clientX - last.x) * 0.008;
        st.pitch = Math.max(0.12, Math.min(0.85, st.pitch + (e.clientY - last.y) * 0.004));
        last = { x: e.clientX, y: e.clientY };
      }
    });
    win.addEventListener('pointerup', end);
    win.addEventListener('pointercancel', end);

    function end(e) {
      if (e.pointerId === joyId) {
        joyId = null;
        joy.x = joy.y = 0;
        o.knob.style.transform = '';
      }
      if (e.pointerId === lookId) {
        lookId = null;
        var tap = down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < TAP_MOVE && Date.now() - down.at < TAP_MS;
        if (o.tapWalk && !frozen && tap) tapTo(e.clientX, e.clientY);
      }
    }

    function moveJoy(e) {
      var r = o.joy.getBoundingClientRect();
      var dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      var max = r.width * 0.34, d = Math.hypot(dx, dy);
      if (d > max) { dx *= max / d; dy *= max / d; }
      o.knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      joy.x = dx / max;
      joy.y = dy / max;
    }

    function tapTo(cx, cy) {
      var r = o.canvas.getBoundingClientRect();
      ndc.set((cx - r.left) / r.width * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, S.camera);
      if (ray.ray.intersectPlane(groundPlane, hit)) st.target = { x: hit.x, z: hit.z };
    }

    function update(dt) {
      if (frozen) { st.mag = 0; return st; }
      var ix = joy.x + (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0);
      var iy = joy.y + (keys.s || keys.arrowdown ? 1 : 0) - (keys.w || keys.arrowup ? 1 : 0);
      var dir = Walk.moveVector(ix, iy, st.yaw);
      if (dir) st.target = null;
      else if (st.target) {
        dir = Walk.toward(st.x, st.z, st.target.x, st.target.z);
        if (!dir) st.target = null;
      }
      if (!dir) { st.mag = 0; st.walkT *= 0.85; return st; }
      var next = Walk.step(st.x, st.z, dir, dt, o.blocked);
      if (st.target && next.x === st.x && next.z === st.z) st.target = null;
      st.x = next.x;
      st.z = next.z;
      st.face = Walk.turn(st.face, Walk.facing(dir), dt * 12);
      st.walkT += dt * 12 * dir.mag;
      st.mag = dir.mag;
      return st;
    }

    function camera(dt, snap) {
      camPos.set(st.x + Math.sin(st.yaw) * CAM_DIST * Math.cos(st.pitch), 2.5 + Math.sin(st.pitch) * CAM_DIST,
        st.z + Math.cos(st.yaw) * CAM_DIST * Math.cos(st.pitch));
      if (snap) S.camera.position.copy(camPos);
      else S.camera.position.lerp(camPos, Math.min(1, dt * 6));
      S.camera.lookAt(st.x, 3.4, st.z);
    }

    // The character maker's view: in front of her, looking a little low so she sits above the panel.
    function portrait() {
      S.camera.position.set(st.x + Math.sin(st.face) * 9, 4.6, st.z + Math.cos(st.face) * 9);
      S.camera.lookAt(st.x, 1.6, st.z);
    }

    function teleport(x, z, face) {
      st.x = x;
      st.z = z;
      st.face = face;
      st.yaw = face + Math.PI;
      st.target = null;
      camera(0, true);
    }

    function freeze(on) {
      frozen = on;
      joy.x = joy.y = 0;
      joyId = null;
      o.knob.style.transform = '';
      st.target = null;
    }

    return { state: st, update: update, camera: camera, portrait: portrait, teleport: teleport, freeze: freeze };
  }

  W.Move = { create: create };
})(this);
```

- [ ] **Step 2: Check the syntax**

Run: `node --check web/world/move.js`
Expected: no output.

- [ ] **Step 3: Stage**

```bash
git add web/world/move.js
```

---

### Task 13: The character maker (`maker.js`)

**Files:**
- Create: `web/world/maker.js`

- [ ] **Step 1: Write `web/world/maker.js`**

```js
/* The character maker panel: body, skin, hair, hair colour, outfit colour, pet and pet name. Every pick calls
   o.onChange so the 3D preview updates; Done calls o.onDone. Opens on her first visit and at the mirror. */
(function (root) {
  'use strict';
  var W = root.World3D = root.World3D || {};
  var PET_EMOJI = { chick: '🐥', kitten: '🐱', puppy: '🐶' };

  // o = { doc, T, look, onChange(look), onDone(look) }
  function open(o) {
    var doc = o.doc, t = o.T.maker, O = W.Look.OPTIONS, look = Object.assign({}, o.look), buttons = [];
    var box = doc.createElement('div');
    box.className = 'maker';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', t.title);
    var title = doc.createElement('div');
    title.className = 'maker-title';
    title.textContent = t.title;
    box.appendChild(title);

    function row(label, field, values, draw) {
      var r = doc.createElement('div');
      r.className = 'maker-row';
      var h = doc.createElement('div');
      h.className = 'maker-label';
      h.textContent = label;
      r.appendChild(h);
      var list = doc.createElement('div');
      list.className = 'maker-options';
      values.forEach(function (v) {
        var b = doc.createElement('button');
        b.type = 'button';
        b.className = 'maker-opt';
        b.setAttribute('data-field', field);
        b.setAttribute('data-value', String(v));
        draw(b, v);
        b.addEventListener('click', function () { pick(field, v); });
        list.appendChild(b);
        buttons.push(b);
      });
      r.appendChild(list);
      box.appendChild(r);
    }
    function swatches(field) {
      return function (b, i) {
        b.className += ' swatch';
        b.style.background = O[field][i];
        b.setAttribute('aria-label', t[field] + ' ' + (i + 1));
      };
    }
    function named(names) { return function (b, v) { b.textContent = names[v]; }; }
    function indexes(field) { return O[field].map(function (c, i) { return i; }); }

    row(t.body, 'body', O.body, named(t.bodies));
    row(t.skin, 'skin', indexes('skin'), swatches('skin'));
    row(t.hair, 'hair', O.hair, named(t.hairs));
    row(t.hairColor, 'hairColor', indexes('hairColor'), swatches('hairColor'));
    row(t.outfit, 'outfit', indexes('outfit'), swatches('outfit'));
    row(t.pet, 'pet', O.pet, function (b, v) { b.textContent = PET_EMOJI[v] + ' ' + t.pets[v]; });

    var nameRow = doc.createElement('label');
    nameRow.className = 'maker-row maker-label';
    nameRow.textContent = t.petName;
    var input = doc.createElement('input');
    input.className = 'maker-name';
    input.type = 'text';
    input.maxLength = 12;
    input.value = look.petName;
    input.addEventListener('input', function () { look.petName = input.value; });
    nameRow.appendChild(doc.createElement('br'));
    nameRow.appendChild(input);
    box.appendChild(nameRow);

    var done = doc.createElement('button');
    done.type = 'button';
    done.className = 'maker-done';
    done.textContent = t.done;
    done.addEventListener('click', finish);
    box.appendChild(done);

    function mark() {
      buttons.forEach(function (b) {
        var on = String(look[b.getAttribute('data-field')]) === b.getAttribute('data-value');
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      input.placeholder = o.T.petNames[look.pet];
    }
    function pick(field, v) {
      look[field] = v;
      mark();
      o.onChange(Object.assign({}, look));
    }
    function finish() {
      if (!box.parentNode) return;
      box.parentNode.removeChild(box);
      o.onDone(Object.assign({}, look));
    }

    doc.body.appendChild(box);
    mark();
    return { pick: pick, done: finish, el: box };
  }

  W.Maker = { open: open, PET_EMOJI: PET_EMOJI };
})(this);
```

- [ ] **Step 2: Check the syntax**

Run: `node --check web/world/maker.js`
Expected: no output.

- [ ] **Step 3: Stage**

```bash
git add web/world/maker.js
```

---

### Task 14: The pages, styles and boot (`world-main.js`, `world.css`, `grade-5.html`, `grade-2.html`)

**Files:**
- Create: `web/world/world-main.js`
- Create: `web/world/world.css`
- Create: `web/world/grade-5.html`, `web/world/grade-2.html`
- Test: `tests/world3d-wiring.test.js`

- [ ] **Step 1: Write the failing wiring test** `tests/world3d-wiring.test.js`

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { WEB, WORLDS, WORLD_FILES, VENDOR_FILES, web } = require('./paths.js');

const ORDER = ['../engine/storage.js', '../engine/learner.js', '../engine/fx.js']
  .concat(VENDOR_FILES.map((f) => '../' + f), WORLD_FILES);

for (const [n, page] of Object.entries(WORLDS)) {
  const grade = 'grade' + n;

  test('world grade ' + n + ' loads its scripts in order', () => {
    const html = fs.readFileSync(web(page), 'utf8');
    assert.match(html.slice(0, 1024), /<meta charset="utf-8">/i);
    assert.deepEqual([...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]), ORDER);
    for (const f of ['storage', 'learner', 'fx']) {
      assert.ok(html.includes('<script src="../engine/' + f + '.js" data-grade="' + grade + '"></script>'), f + ' has data-grade');
    }
    assert.ok(html.includes('<body data-grade="' + grade + '">'));
    assert.ok(html.includes('<link rel="stylesheet" href="world.css">'));
  });

  test('world grade ' + n + ' has a resting card and a last-resort check', () => {
    const html = fs.readFileSync(web(page), 'utf8');
    for (const id of ['stage', 'loading', 'resting', 'resting-title', 'resting-line', 'resting-go']) assert.ok(html.includes('id="' + id + '"'), id);
    assert.ok(html.includes('href="../lobby/grade-' + n + '.html"'), 'the resting card goes to this grade\'s lobby');
    const last = html.lastIndexOf('<script>');
    assert.ok(last > html.lastIndexOf('<script src='), 'the check runs after every script');
    assert.ok(html.slice(last).includes('World3D.Main'), 'shows the resting card if world-main.js never loaded');
  });

  test('world grade ' + n + ' script paths match real files, case included', () => {
    const html = fs.readFileSync(web(page), 'utf8');
    for (const m of html.matchAll(/<(?:script src|link rel="stylesheet" href)="([^"]+)"/g)) {
      if (/^https?:/.test(m[1])) continue;
      let dir = path.dirname(web(page));
      for (const part of m[1].split('/')) {
        if (part === '..') { dir = path.dirname(dir); continue; }
        assert.ok(fs.readdirSync(dir).includes(part), page + ': ' + m[1]);
        dir = path.join(dir, part);
      }
    }
  });
}

test('every world script is a file in web/world', () => {
  for (const f of WORLD_FILES) assert.ok(fs.existsSync(path.join(WEB, 'world', f)), f);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/world3d-wiring.test.js`
Expected: FAIL, `ENOENT ... world/grade-5.html`.

- [ ] **Step 3: Write `web/world/world.css`**

```css
/* The 3D world page: a full-screen canvas with a small HUD. Grade 2 gets a bigger joystick (.big). */
html, body { margin: 0; height: 100%; overflow: hidden; background: #ffe3f1; color: #6a2c70;
  font-family: 'Baloo 2', system-ui, sans-serif; touch-action: none; user-select: none; -webkit-user-select: none; }
[hidden] { display: none !important; }
/* fx.js adds a floating sound button on pages without Nav; the world has its own in Settings. */
#fx-mute { display: none !important; }
.stage, .stage canvas { position: fixed; inset: 0; display: block; }
.loading { position: fixed; inset: 0; display: grid; place-items: center; padding: 16px; text-align: center; font-size: 22px; font-weight: 800; }

.w-hud { position: fixed; left: 16px; right: 16px; top: max(14px, env(safe-area-inset-top)); display: flex;
  justify-content: space-between; align-items: center; gap: 8px; pointer-events: none; }
.w-hud-right { display: flex; gap: 8px; }
.w-pill { pointer-events: auto; background: rgba(255,255,255,.92); border: 0; border-radius: 999px; padding: 6px 16px;
  font: 800 18px 'Baloo 2', system-ui, sans-serif; color: #7a3e8e; box-shadow: 0 4px 0 #f3b6d6; text-decoration: none; cursor: pointer; }

.w-joy { position: fixed; left: 24px; bottom: max(24px, env(safe-area-inset-bottom)); width: 132px; height: 132px;
  border-radius: 50%; background: rgba(255,255,255,.45); border: 4px dashed rgba(255,255,255,.95); touch-action: none; }
.w-joy.big { width: 168px; height: 168px; }
.w-knob { position: absolute; left: 50%; top: 50%; width: 60px; height: 60px; margin: -30px 0 0 -30px; border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #fff, #ffc2e2); box-shadow: 0 5px 0 #f08cc0; display: grid; place-items: center;
  font-size: 26px; pointer-events: none; }
.w-joy.big .w-knob { width: 74px; height: 74px; margin: -37px 0 0 -37px; }

.w-act { position: fixed; left: 50%; bottom: 40px; transform: translateX(-50%) scale(.5); opacity: 0; pointer-events: none;
  transition: transform .3s cubic-bezier(.3,1.7,.5,1), opacity .2s; background: linear-gradient(#ffe066, #ffb3d9); color: #6a2c70;
  border: 4px solid #fff; border-radius: 999px; padding: 12px 30px; font: 800 24px 'Baloo 2', system-ui, sans-serif;
  box-shadow: 0 6px 0 #e58fbf, 0 12px 28px rgba(200,80,150,.3); max-width: calc(100% - 200px); cursor: pointer; }
.w-act.show { opacity: 1; transform: translateX(-50%) scale(1); pointer-events: auto; }
@media (max-width: 600px) {
  .w-act { left: auto; right: 16px; transform: scale(.5); max-width: calc(100% - 190px); font-size: 19px; padding: 10px 18px; }
  .w-act.show { transform: scale(1); }
}

.w-waking { position: fixed; inset: 0; display: grid; place-items: center; padding: 16px; text-align: center;
  background: rgba(255,227,241,.88); font-size: 26px; font-weight: 800; }
.w-overlay { position: fixed; inset: 0; background: rgba(106,44,112,.35); display: grid; place-items: center; padding: 16px; }
.w-card { background: #fff; border-radius: 28px; padding: 18px; width: min(560px, 100%); max-height: calc(100vh - 32px);
  overflow-y: auto; box-shadow: 0 8px 0 #f3b6d6; box-sizing: border-box; }
.w-card-title { margin: 0 0 12px; text-align: center; font-size: 24px; }
.w-travel { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
.w-travel-btn, .w-btn, .w-choice { font: 800 17px 'Baloo 2', system-ui, sans-serif; border: 0; border-radius: 16px; padding: 10px 12px;
  background: #fff0f7; color: #6a2c70; box-shadow: 0 3px 0 #f3b6d6; cursor: pointer; text-decoration: none; min-height: 44px; }
.w-close { display: block; margin: 14px auto 0; }
.w-setting { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 10px 0; font-weight: 800; flex-wrap: wrap; }
.w-setting-options { display: flex; gap: 6px; flex-wrap: wrap; }
.w-choice[aria-pressed="true"] { background: #ffd166; box-shadow: 0 3px 0 #e0a800; }

.maker { position: fixed; left: 0; right: 0; bottom: 0; max-height: 58%; overflow-y: auto; background: rgba(255,255,255,.96);
  border-radius: 28px 28px 0 0; padding: 14px 16px max(16px, env(safe-area-inset-bottom)); box-shadow: 0 -6px 24px rgba(200,80,150,.2);
  box-sizing: border-box; }
.maker-title { text-align: center; font-size: 24px; font-weight: 800; margin-bottom: 6px; }
.maker-row { display: block; margin: 8px 0; }
.maker-label { font-weight: 800; margin-bottom: 4px; }
.maker-options { display: flex; flex-wrap: wrap; gap: 8px; }
.maker-opt { font: 800 16px 'Baloo 2', system-ui, sans-serif; border: 3px solid transparent; border-radius: 14px; padding: 6px 12px;
  background: #fff0f7; color: #6a2c70; cursor: pointer; min-height: 44px; }
.maker-opt.swatch { width: 44px; padding: 0; }
.maker-opt[aria-pressed="true"] { border-color: #ff6f91; box-shadow: 0 0 0 3px #ffd6e7; }
.maker-name { font: 700 18px 'Baloo 2', system-ui, sans-serif; padding: 8px 12px; border-radius: 12px; border: 2px solid #f3b6d6;
  width: min(260px, 100%); box-sizing: border-box; margin-top: 4px; user-select: text; -webkit-user-select: text; }
.maker-done { display: block; margin: 14px auto 4px; font: 800 22px 'Baloo 2', system-ui, sans-serif; border: 4px solid #fff;
  border-radius: 999px; padding: 10px 34px; background: linear-gradient(#ffe066, #ffb3d9); color: #6a2c70; box-shadow: 0 6px 0 #e58fbf; cursor: pointer; }

.resting { position: fixed; inset: 0; display: grid; place-items: center; padding: 16px; background: #ffe3f1; }
.resting-card { background: #fff; border-radius: 28px; padding: 24px; text-align: center; max-width: 420px; box-shadow: 0 8px 0 #f3b6d6; }
.resting-emoji { font-size: 56px; }
.resting-card h1 { font-size: 26px; margin: 6px 0; }
.resting-card .w-btn { display: inline-block; margin-top: 10px; }
@media (prefers-reduced-motion: reduce) { .w-act { transition: none; } }
```

- [ ] **Step 4: Write `web/world/world-main.js`**

```js
/* Starts the 3D world page: checks that 3D can run, builds the world, her character and pet, and runs the frame loop,
   doors, the mirror (character maker), quick travel, settings and music. Shows the resting card if 3D cannot start, and
   a waking-up cover while the browser has taken the 3D graphics away. window.WorldDebug lets the e2e driver act like her. */
(function (root) {
  'use strict';
  var W = root.World3D = root.World3D || {};
  var doc = root.document;
  var grade = W.Layout.gradeOf(doc.body.getAttribute('data-grade'));
  var T = W.Text.TEXT[grade];
  var lobbyUrl = '../lobby/grade-' + (grade === 'grade2' ? '2' : '5') + '.html';
  var store = root.Learner ? root.Learner.storage : root.localStorage;
  var session = null;
  try { session = root.sessionStorage; } catch (e) {}
  var debug = root.WorldDebug = { ready: false, go: function (url) { root.location.href = url; } };

  function $(id) { return doc.getElementById(id); }
  function el(tag, cls, text) {
    var e = doc.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function button(cls, text, onClick) {
    var b = el('button', cls, text);
    b.type = 'button';
    b.addEventListener('click', onClick);
    return b;
  }
  function fire(name) { try { doc.dispatchEvent(new root.CustomEvent(name)); } catch (e) {} }
  function sound(name) { try { if (root.Fx && root.Fx[name]) root.Fx[name](); } catch (e) {} }
  // Grade 2 signs are "Filipino · English"; buttons use the English half.
  function english(sign) { return sign.split(' · ').pop(); }

  function resting() {
    $('loading').hidden = true;
    $('resting-title').textContent = T.resting;
    $('resting-line').textContent = T.restingLine;
    $('resting-go').textContent = T.toLobby;
    $('resting').hidden = false;
    fire('world-resting');
  }

  function canRun() {
    if (!root.THREE || !root.THREE.RoundedBoxGeometry) return false;
    try {
      var c = doc.createElement('canvas');
      return !!(c.getContext('webgl2') || c.getContext('webgl'));
    } catch (e) { return false; }
  }

  function start() {
    var L = W.Layout, prefs = W.Prefs.readPrefs(store), quality = W.Prefs.startQuality(prefs);
    var S = W.Scene.create($('stage'), quality);
    var world = W.Build.build(S, grade, T);
    var obs = L.obstacles(grade), bounds = L.GRADES[grade].bounds;
    var items = L.interactables(grade), allSpots = L.spots(grade);
    var mine = W.Look.read(store), look = mine.look;
    var me = null, pet = null, near = null, maker = null, overlay = null, lost = false;
    var music = W.Music.create(root), slow = W.Prefs.fpsWatch(30, 3), clock = new S.THREE.Clock(), t = 0;
    var hud = buildHud();

    var ctl = W.Move.create(S, {
      win: root, canvas: S.renderer.domElement, joy: hud.joy, knob: hud.knob, tapWalk: L.GRADES[grade].tapWalk,
      blocked: function (x, z) { return L.blocked(obs, bounds, x, z, L.PLAYER_R); }
    });

    function dress(l) {
      if (me) { S.scene.remove(me.group); me.dispose(); }
      if (pet) S.scene.remove(pet.group);
      me = W.Avatar.character(S, l);
      pet = W.Avatar.pet(S, l.pet);
      S.scene.add(me.group);
      S.scene.add(pet.group);
      putPet();
    }
    function putPet() { pet.group.position.set(ctl.state.x + 1.4, 0, ctl.state.z + 2); }

    function goTo(spot) {
      ctl.teleport(spot.x, spot.z, spot.face);
      putPet();
      tick(0);
    }

    function actLabel(it) {
      if (it.kind === 'door') return it.emoji + ' ' + T.go.replace('{name}', english(it.sign));
      return it.kind === 'mirror' ? T.mirror : T.signpost;
    }

    function act() {
      if (!near || maker || overlay) return;
      if (near.kind === 'door') {
        W.Prefs.setReturn(session, grade, near.app);
        debug.go(L.appUrl(grade, near.folder));
      } else if (near.kind === 'mirror') openMaker();
      else openTravel();
    }

    function openMaker() {
      ctl.freeze(true);
      hud.show(false);
      maker = W.Maker.open({
        doc: doc, T: T, look: look,
        onChange: dress,
        onDone: function (l) {
          look = W.Look.save(store, l, Date.now());
          mine.made = true;
          maker = null;
          dress(look);
          ctl.freeze(false);
          hud.show(true);
          ctl.teleport(ctl.state.x, ctl.state.z, ctl.state.face);
          world.sparkle(ctl.state.x, ctl.state.z);
          sound('allRead');
        }
      });
    }

    function openOverlay(title) {
      ctl.freeze(true);
      overlay = el('div', 'w-overlay');
      var card = el('div', 'w-card');
      card.setAttribute('role', 'dialog');
      card.setAttribute('aria-label', title);
      card.appendChild(el('h2', 'w-card-title', title));
      overlay.appendChild(card);
      doc.body.appendChild(overlay);
      return card;
    }
    function closeOverlay() {
      if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
      overlay = null;
      ctl.freeze(false);
    }

    function openTravel() {
      var card = openOverlay(T.travelTitle), grid = el('div', 'w-travel');
      allSpots.forEach(function (s) {
        var text = s.kind === 'door' ? s.emoji + ' ' + s.sign : L.PLACE_EMOJI[s.id] + ' ' + T.places[s.id];
        var b = button('w-travel-btn', text, function () {
          closeOverlay();
          goTo(s);
          world.sparkle(s.x, s.z);
          sound('allRead');
        });
        b.setAttribute('data-spot', s.id);
        grid.appendChild(b);
      });
      card.appendChild(grid);
      card.appendChild(button('w-btn w-close', T.close, closeOverlay));
    }

    function openSettings() {
      var card = openOverlay(T.settingsTitle);
      function setting(label, choices, current, pick) {
        var row = el('div', 'w-setting'), opts = el('div', 'w-setting-options');
        row.appendChild(el('span', '', label));
        choices.forEach(function (c) {
          var b = button('w-choice', c.text, function () {
            pick(c.value);
            [].forEach.call(opts.children, function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
          });
          b.setAttribute('aria-pressed', c.value === current ? 'true' : 'false');
          opts.appendChild(b);
        });
        row.appendChild(opts);
        card.appendChild(row);
      }
      setting(T.quality, ['auto', 'high', 'low'].map(function (q) { return { value: q, text: T.qualityNames[q] }; }), prefs.quality, function (q) {
        prefs = W.Prefs.savePrefs(store, Object.assign(prefs, { quality: q }));
        quality = W.Prefs.startQuality(prefs);
        S.setQuality(quality);
      });
      var onOff = [{ value: true, text: T.on }, { value: false, text: T.off }];
      setting(T.music, onOff, prefs.music, function (on) {
        prefs = W.Prefs.savePrefs(store, Object.assign(prefs, { music: on }));
        if (on && !(root.Fx && root.Fx.muted())) music.start();
        else music.stop();
      });
      setting(T.sound, onOff, !(root.Fx && root.Fx.muted()), function (on) {
        if (root.Fx) root.Fx.setMuted(!on);
        if (!on) music.stop();
        else if (prefs.music) music.start();
      });
      card.appendChild(button('w-btn w-close', T.close, closeOverlay));
    }

    function buildHud() {
      var top = el('div', 'w-hud'), right = el('div', 'w-hud-right');
      top.appendChild(el('div', 'w-pill', '🌸 ' + T.title));
      var home = el('a', 'w-pill', T.lobby);
      home.href = lobbyUrl;
      home.addEventListener('click', function () { W.Prefs.clearReturn(session); });
      var gear = button('w-pill', T.settings, function () { if (!maker && !overlay) openSettings(); });
      gear.setAttribute('aria-label', T.settingsTitle);
      right.appendChild(home);
      right.appendChild(gear);
      top.appendChild(right);
      var joy = el('div', 'w-joy' + (W.Layout.GRADES[grade].bigJoystick ? ' big' : ''));
      var knob = el('div', 'w-knob', '🐾');
      joy.appendChild(knob);
      var actBtn = button('w-act', '', function () { act(); });
      actBtn.id = 'act';
      var waking = el('div', 'w-waking', T.waking);
      waking.hidden = true;
      [top, joy, actBtn, waking].forEach(function (n) { doc.body.appendChild(n); });
      return {
        joy: joy, knob: knob, act: actBtn, waking: waking, actFor: null,
        show: function (on) { top.hidden = !on; joy.hidden = !on; actBtn.hidden = !on; }
      };
    }

    function showAct() {
      var id = near ? near.id : '';
      if (id === hud.actFor) return;
      hud.actFor = id;
      hud.act.textContent = near ? actLabel(near) : '';
      hud.act.classList.toggle('show', !!near);
      if (near) sound('cardRead');
    }

    function followPet(dt) {
      var st = ctl.state, p = pet.group.position;
      var bx = st.x - Math.sin(st.face) * 2.6 + 1.4, bz = st.z - Math.cos(st.face) * 2.6, k = Math.min(1, dt * 4);
      p.x += (bx - p.x) * k;
      p.z += (bz - p.z) * k;
      pet.group.lookAt(st.x, 0, st.z);
      pet.animate(t);
    }

    function tick(dt) {
      t += dt;
      var st = ctl.update(dt);
      me.group.position.set(st.x, 0, st.z);
      if (maker) {
        me.group.rotation.y += dt * 0.8;
        ctl.portrait();
      } else {
        me.group.rotation.y = st.face;
        ctl.camera(dt);
      }
      me.animate(t, st.walkT, st.mag);
      followPet(dt);
      near = maker || overlay ? null : L.nearest(items, st.x, st.z);
      showAct();
      world.animate(t, dt, near && near.kind === 'door' ? near.id : null);
      S.follow(st.x, st.z);
      if (prefs.quality === 'auto' && quality === 'high' && slow(dt)) {
        quality = 'low';
        S.setQuality('low');
      }
    }

    function frame() {
      tick(Math.min(clock.getDelta(), 0.05));
      if (!lost) S.render();
      root.requestAnimationFrame(frame);
    }

    var canvas = S.renderer.domElement;
    canvas.addEventListener('webglcontextlost', function (e) {
      e.preventDefault();
      lost = true;
      hud.waking.hidden = false;
    });
    canvas.addEventListener('webglcontextrestored', function () {
      S.refreshTextures();
      S.setQuality(quality);
      lost = false;
      hud.waking.hidden = true;
    });

    doc.addEventListener('pointerdown', function () {
      if (prefs.music && !(root.Fx && root.Fx.muted())) music.start();
    }, { once: true });

    dress(look);
    goTo(L.spawnFor(grade, W.Prefs.readReturn(session)));
    if (!mine.made) openMaker();

    debug.makerOpen = function () { return !!maker; };
    debug.maker = {
      pick: function (field, value) { if (maker) maker.pick(field, value); },
      done: function () { if (maker) maker.done(); }
    };
    debug.state = function () {
      var st = ctl.state;
      return { x: st.x, z: st.z, face: st.face, near: near ? near.id : null, made: mine.made, quality: quality };
    };
    debug.teleport = function (id) {
      var s = allSpots.filter(function (x) { return x.id === id; })[0];
      if (s) goTo(s);
    };
    debug.tick = function (dt) { tick(dt || 0.016); };
    debug.act = act;
    debug.openTravel = openTravel;
    debug.waking = function () { return !hud.waking.hidden; };
    debug.loseContext = function () {
      var ext = S.renderer.getContext().getExtension('WEBGL_lose_context');
      if (!ext) return false;
      ext.loseContext();
      root.setTimeout(function () { ext.restoreContext(); }, 300);
      return true;
    };
    debug.ready = true;

    $('loading').hidden = true;
    frame();
    fire('world-ready');
  }

  function boot() {
    if (!canRun()) return resting();
    try { start(); } catch (e) {
      if (root.console) root.console.error(e);
      resting();
    }
  }

  W.Main = true;
  $('loading').textContent = T.loading;
  var fonts = doc.fonts && doc.fonts.load ? doc.fonts.load('800 70px "Baloo 2"') : null;
  var wait = new Promise(function (r) { root.setTimeout(r, 1500); });
  (fonts ? Promise.race([fonts, wait]) : wait).then(boot, boot);
})(this);
```

- [ ] **Step 5: Write `web/world/grade-5.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#ffe3f1">
<title>Campus · Study Games</title>
<link rel="icon" type="image/png" href="../assets/icons/grade5-192.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="world.css">
</head>
<body data-grade="grade5">
<div class="stage" id="stage"></div>
<div class="loading" id="loading">Loading the world…</div>
<div class="resting" id="resting" hidden>
  <div class="resting-card">
    <div class="resting-emoji">😴</div>
    <h1 id="resting-title">The world is resting 😴</h1>
    <p id="resting-line">Here is the Campus map!</p>
    <a class="w-btn" id="resting-go" href="../lobby/grade-5.html">🗺️ Back to the lobby</a>
  </div>
</div>
<script src="../engine/storage.js" data-grade="grade5"></script>
<script src="../engine/learner.js" data-grade="grade5"></script>
<script src="../engine/fx.js" data-grade="grade5"></script>
<script src="../vendor/three/three.min.js"></script>
<script src="../vendor/three/rounded-box.js"></script>
<script src="text.js"></script>
<script src="layout.js"></script>
<script src="look.js"></script>
<script src="prefs.js"></script>
<script src="walk.js"></script>
<script src="music.js"></script>
<script src="scene.js"></script>
<script src="build.js"></script>
<script src="avatar.js"></script>
<script src="move.js"></script>
<script src="maker.js"></script>
<script src="world-main.js"></script>
<script>
if (!window.World3D || !World3D.Main) {
  document.getElementById('loading').hidden = true;
  document.getElementById('resting').hidden = false;
}
</script>
</body>
</html>
```

- [ ] **Step 6: Write `web/world/grade-2.html`**

Same as `grade-5.html` with these differences only:
- `<title>Bayan · Study Games</title>`
- icon `../assets/icons/grade2-192.png` (check the file name: `ls web/assets/icons`)
- `<body data-grade="grade2">` and `data-grade="grade2"` on the three engine scripts
- `<div class="loading" id="loading">Inihahanda ang bayan… · Loading the village…</div>`
- `<h1 id="resting-title">Nagpapahinga ang bayan 😴 · The village is resting 😴</h1>`
- `<p id="resting-line">Narito ang mapa ng bayan! · Here is the village map!</p>`
- `<a class="w-btn" id="resting-go" href="../lobby/grade-2.html">🗺️ Back to the lobby</a>`

- [ ] **Step 7: Run the wiring test and the precache**

Run: `node tools/update-precache.js && node --test tests/world3d-wiring.test.js tests/pwa.test.js`
Expected: PASS.

- [ ] **Step 8: Stage**

```bash
git add web/world tests/world3d-wiring.test.js web/sw.js
```

---

### Task 15: Browser test (`world-e2e.js`)

**Files:**
- Modify: `tests/e2e/chrome.js`
- Create: `tests/e2e/world-driver.page.js`
- Create: `tests/e2e/world-e2e.js`

- [ ] **Step 1: Let `dumpDom` take extra Chrome flags** (`tests/e2e/chrome.js`)

Change the `dumpDom` signature and args:

```js
// waitMs: drivers that step through timers need Chrome to run them before it dumps (it otherwise dumps right after load).
// extraArgs: more Chrome flags, e.g. WEBGL_ARGS for the 3D world.
function dumpDom(profileDir, file, suffix, waitMs, extraArgs) {
  if (!CHROME) throw new Error('Chrome or Edge not found');
  const url = pathToFileURL(file).href + (suffix || '');
  const wait = waitMs ? ['--virtual-time-budget=' + waitMs] : [];
  return execFileSync(CHROME, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--user-data-dir=' + profileDir, ...wait, ...(extraArgs || []), '--dump-dom', url,
  ], { encoding: 'utf8', timeout: 90000, stdio: ['ignore', 'pipe', 'ignore'] });
}

// Software WebGL in headless Chrome, for the 3D world.
const WEBGL_ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
```

Add `WEBGL_ARGS` to `module.exports`.

- [ ] **Step 2: Write `tests/e2e/world-driver.page.js`**

```js
// Drives the 3D world page for world-e2e.js. The mode comes from the URL hash: #e2e=fresh|back|lost|resting|grade2.
(function () {
  var mode = (location.hash.match(/e2e=(\w+)/) || [])[1];
  var sent = false;
  function out(o) {
    if (sent) return;
    sent = true;
    o.errors = window.__e2eErrors || [];
    var pre = document.createElement('pre');
    pre.id = 'e2e-out';
    pre.textContent = JSON.stringify(o);
    document.body.appendChild(pre);
  }
  function text(sel) { var e = document.querySelector(sel); return e ? e.textContent : null; }

  function run() {
    var D = window.WorldDebug;
    if (mode === 'resting') {
      return out({
        resting: !document.getElementById('resting').hidden, loadingHidden: document.getElementById('loading').hidden,
        href: document.getElementById('resting-go').getAttribute('href'), title: text('#resting-title')
      });
    }
    var o = { makerOpen: D.makerOpen(), makerTitle: text('.maker-title') };
    if (mode === 'fresh') {
      D.maker.pick('hair', 'bob');
      D.maker.pick('pet', 'puppy');
      D.maker.done();
      o.makerClosed = !D.makerOpen();
      o.saved = JSON.parse(Learner.storage.getItem('avatar_v1'));
      o.at = D.state();
      D.teleport('life-lab');
      o.near = D.state().near;
      o.act = text('#act');
      var went = null;
      D.go = function (u) { went = u; };
      D.act();
      o.went = went;
      o.ret = JSON.parse(sessionStorage.getItem('world_return_v1'));
      D.openTravel();
      document.querySelector('[data-spot="park"]').click();
      o.park = D.state();
      return out(o);
    }
    if (mode === 'back') { o.state = D.state(); return out(o); }
    if (mode === 'grade2') { o.bigJoystick = !!document.querySelector('.w-joy.big'); return out(o); }
    if (mode === 'lost') {
      o.hasExt = D.loseContext();
      setTimeout(function () { o.wakingShown = D.waking(); }, 150);
      setTimeout(function () { o.wakingHiddenAfter = !D.waking(); out(o); }, 2000);
    }
  }

  if (window.WorldDebug && WorldDebug.ready) run();
  else {
    document.addEventListener('world-ready', run);
    document.addEventListener('world-resting', run);
  }
})();
```

- [ ] **Step 3: Write `tests/e2e/world-e2e.js`**

```js
// The 3D world: first visit and the character maker, a door into a game and 🏠 back, quick travel, the waking-up
// cover when the browser takes the 3D graphics away, the resting card when 3D cannot start, and Grade 2.
// Run: node tests/e2e/world-e2e.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { stage, makeWorkDir, dumpDom, readOutput, appendDriver, injectDriver, WEBGL_ARGS } = require('./chrome.js');
const { WORLDS, VENDOR_FILES, ENGINE_FILES, web, app, appFile } = require('../paths.js');

const WAIT_MS = 8000;
const work = makeWorkDir('world-e2e');
const driver = fs.readFileSync(path.join(__dirname, 'world-driver.page.js'), 'utf8');
const RETURN = '{ grade: "grade5", app: "life-lab" }';

function stageWorld(name, grade, before) {
  let html = fs.readFileSync(web(WORLDS[grade]), 'utf8');
  if (before) {
    const tag = '<script src="../vendor/three/three.min.js"></script>';
    if (!html.includes(tag)) throw new Error('three.min.js tag not found');
    html = html.replace(tag, before + tag);
  }
  const site = path.join(work, name);
  const file = stage(site, WORLDS[grade], appendDriver(html, driver), ['storage.js', 'learner.js', 'fx.js']);
  for (const f of VENDOR_FILES) {
    const to = path.join(site, f);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(web(f), to);
  }
  fs.copyFileSync(web('world/world.css'), path.join(site, 'world', 'world.css'));
  return file;
}

function run(name, file, mode) {
  return readOutput(dumpDom(path.join(work, 'profile-' + name), file, '#e2e=' + mode, WAIT_MS, WEBGL_ARGS));
}

const SEEDED = '<script>Learner.storage.setItem("avatar_v1", JSON.stringify({ v: 1, body: "boy", skin: 1, hair: "short", hairColor: 2, outfit: 3, pet: "kitten", petName: "Tom", t: 5 }));'
  + 'sessionStorage.setItem("world_return_v1", JSON.stringify(' + RETURN + '));</script>';

try {
  const fresh = run('fresh', stageWorld('fresh', 5), 'fresh');
  assert.deepEqual(fresh.errors, [], 'fresh: page errors');
  assert.equal(fresh.makerOpen, true, 'the first visit opens the character maker');
  assert.equal(fresh.makerTitle, 'Make your character!');
  assert.equal(fresh.makerClosed, true);
  assert.equal(fresh.saved.hair, 'bob');
  assert.equal(fresh.saved.pet, 'puppy');
  assert.ok(fresh.saved.t > 0, 'saved with a time');
  assert.deepEqual([fresh.at.x, fresh.at.z], [0, 84], 'she starts at the gate');
  assert.equal(fresh.near, 'life-lab');
  assert.equal(fresh.act, '🔬 Go to Science!');
  assert.equal(fresh.went, '../subjects/grade-5/science/index.html?reset=1', 'the door opens the lobby card\'s page');
  assert.deepEqual(fresh.ret, { grade: 'grade5', app: 'life-lab' });
  assert.deepEqual([fresh.park.x, fresh.park.z], [-48, 44], 'quick travel lands in the park');
  console.log('ok first visit, door, quick travel');

  const back = run('back', stageWorld('back', 5, SEEDED), 'back');
  assert.deepEqual(back.errors, [], 'back: page errors');
  assert.equal(back.makerOpen, false, 'a made character skips the maker');
  assert.equal(back.state.near, 'life-lab', 'back from a game, she stands outside its door');
  console.log('ok back at the door');

  const lost = run('lost', stageWorld('lost', 5, SEEDED), 'lost');
  assert.deepEqual(lost.errors, [], 'lost: page errors');
  assert.equal(lost.hasExt, true, 'Chrome can lose the context on purpose');
  assert.equal(lost.wakingShown, true, 'the waking-up cover shows');
  assert.equal(lost.wakingHiddenAfter, true, 'and goes away when the graphics come back');
  console.log('ok waking up');

  const noGl = '<script>HTMLCanvasElement.prototype.getContext = function () { return null; };</script>';
  const rest = run('resting', stageWorld('resting', 5, noGl), 'resting');
  assert.equal(rest.resting, true, 'no 3D: the resting card shows');
  assert.equal(rest.loadingHidden, true);
  assert.equal(rest.href, '../lobby/grade-5.html');
  assert.equal(rest.title, 'The world is resting 😴');
  console.log('ok resting card');

  const g2 = run('grade2', stageWorld('grade2', 2), 'grade2');
  assert.deepEqual(g2.errors, [], 'grade 2: page errors');
  assert.equal(g2.makerOpen, true);
  assert.match(g2.makerTitle, / · /, 'Grade 2 labels are paired');
  assert.equal(g2.bigJoystick, true);
  console.log('ok grade 2');

  // 🏠 in a game opened from the world goes back to the world.
  const learnerTag = '<script src="../../../engine/learner.js"';
  let html = fs.readFileSync(appFile('life-lab'), 'utf8');
  if (!html.includes(learnerTag)) throw new Error('learner.js tag not found in life-lab');
  html = html.replace(learnerTag, '<script>sessionStorage.setItem("world_return_v1", JSON.stringify(' + RETURN + '));</script>' + learnerTag);
  const navDriver = 'var __went = null; Nav.go = function (u) { __went = u; }; document.getElementById("nav-home").click();'
    + '(function () { var pre = document.createElement("pre"); pre.id = "e2e-out"; pre.textContent = JSON.stringify({ went: __went, errors: window.__e2eErrors || [] }); document.body.appendChild(pre); })();';
  const gameFile = stage(path.join(work, 'game'), app('life-lab').page, injectDriver(html, navDriver), ENGINE_FILES);
  const g = readOutput(dumpDom(path.join(work, 'profile-game'), gameFile, ''));
  assert.deepEqual(g.errors, [], 'game: page errors');
  assert.equal(g.went, '../../../world/grade-5.html');
  console.log('ok 🏠 goes back to the world');
} finally {
  fs.rmSync(work, { recursive: true, force: true });
}
```

- [ ] **Step 4: Run it**

Run: `node tests/e2e/world-e2e.js`
Expected: six `ok` lines. If the `fresh` run reports the resting card instead (`makerOpen` undefined), Chrome has no software WebGL with these flags: run `"C:\Program Files\Google\Chrome\Application\chrome.exe" --headless=new --use-angle=swiftshader --enable-unsafe-swiftshader --dump-dom "data:text/html,<script>document.write(!!document.createElement('canvas').getContext('webgl'))</script>"`, and if it prints `false` without `--disable-gpu`, remove `--disable-gpu` for calls that pass `WEBGL_ARGS` in `dumpDom`.

- [ ] **Step 5: Make sure the older e2e tests still run** (`dumpDom` changed)

Run: `node tests/e2e/nav-e2e.js && node tests/e2e/file-check-e2e.js`
Expected: their usual `ok` lines.

- [ ] **Step 6: Stage**

```bash
git add tests/e2e/chrome.js tests/e2e/world-driver.page.js tests/e2e/world-e2e.js
```

---

### Task 16: 🌸 Play World in both lobbies

**Files:**
- Modify: `web/lobby/grade-5.html`, `web/lobby/grade-2.html`
- Test: `tests/world3d-wiring.test.js` (append)

- [ ] **Step 1: Append the failing lobby tests to `tests/world3d-wiring.test.js`**

Add `lobbyFile` to the require from `./paths.js`, then append:

```js
for (const n of Object.keys(WORLDS)) {
  test('grade ' + n + ' lobby has a Play World button in the hero', () => {
    const html = fs.readFileSync(lobbyFile(n), 'utf8');
    const tag = '<a class="world-open" id="world-open" href="../world/grade-' + n + '.html">🌸 Play World</a>';
    assert.equal(html.split(tag).length - 1, 1, 'one Play World button');
    assert.ok(html.indexOf(tag) > html.indexOf('id="campus-toggle"') && html.indexOf(tag) < html.indexOf('id="coin-row"'), 'right after the Campus toggle');
    assert.ok(html.includes('.world-open{'), 'styled');
  });

  test('grade ' + n + ' lobby forgets the world door, so 🏠 in a game opened from the lobby comes back here', () => {
    const html = fs.readFileSync(lobbyFile(n), 'utf8');
    const snippet = "<script data-world>try { sessionStorage.removeItem('world_return_v1'); } catch (e) {}</script>";
    assert.equal(html.split(snippet).length - 1, 1);
    assert.ok(html.indexOf(snippet) > html.indexOf('<script data-file-check>'), 'after the file check');
  });
}
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/world3d-wiring.test.js`
Expected: FAIL, `one Play World button`.

- [ ] **Step 3: Change both lobbies**

In each lobby, right after the line `<button class="campus-toggle" id="campus-toggle" type="button" hidden></button>` add (with `N` = 5 or 2):

```html
    <a class="world-open" id="world-open" href="../world/grade-N.html">🌸 Play World</a>
```

Just before `</style>` (the first `</style>` in the file) add:

```css
  .world-open{ display:inline-block; margin:10px 6px 0; padding:8px 18px; border-radius:999px; font-weight:800;
    text-decoration:none; color:#7a2550; background:linear-gradient(#ffd6e7,#ffb3d1); box-shadow:0 3px 0 #e58fb5; }
```

Right after the closing `</script>` of the `<script data-campus>` block add:

```html
<script data-world>try { sessionStorage.removeItem('world_return_v1'); } catch (e) {}</script>
```

- [ ] **Step 4: Run all unit tests and the lobby e2e**

Run: `node --test && node tests/e2e/lobby-e2e.js && node tests/e2e/lobby-e2e.js 5`
Expected: all pass. If `tests/copies.test.js` compares lobby sections, keep the new CSS and snippet identical in both lobbies.

- [ ] **Step 5: Stage**

```bash
git add web/lobby/grade-5.html web/lobby/grade-2.html tests/world3d-wiring.test.js
```

---

### Task 17: Look check, docs and the full run

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Screenshot both worlds and compare with the mockup**

Start a static server from `web/` (so Google Fonts and paths behave as online), then screenshot:

```bash
npx --yes http-server web -p 8765 -s &
"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --use-angle=swiftshader --enable-unsafe-swiftshader --window-size=1200,800 --virtual-time-budget=8000 --screenshot="$TEMP/world5.png" http://localhost:8765/world/grade-5.html
"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --use-angle=swiftshader --enable-unsafe-swiftshader --window-size=1200,800 --virtual-time-budget=8000 --screenshot="$TEMP/world2.png" http://localhost:8765/world/grade-2.html
```

Expected: a fresh profile shows the character maker over her spinning character (pigtails, pink dress, chick). Compare colours and softness with `docs/superpowers/mockups/2026-10-05-walkable-3d-world/cute-campus.html`. If the scene looks washed out or too dark compared with the mockup (r149 vs r160 lighting), adjust only the two light intensities in `scene.js` (`HemisphereLight` 1.6, `DirectionalLight` 1.9) and screenshot again. Stop the server afterwards.

- [ ] **Step 2: Update `README.md`**

In the run list under "Running locally", after the `guide-e2e.js` line add:

```
node tests/e2e/world-e2e.js          # 3D world: maker, doors, 🏠 back to the world, quick travel, waking up, resting card
```

In "A new subject or grade", after step 6 add a step and renumber the rest:

```
7. Give it a building in the 3D world: add an entry to `APPS.gradeN` in `web/world/layout.js` (app id, folder, emoji, sign with the subject name, colours, roof shape), in the lobby's order. `tests/world3d-layout.test.js` fails until it has one.
```

- [ ] **Step 3: Full run**

Run: `node tools/update-precache.js && node --test && node tests/e2e/world-e2e.js && node tests/e2e/lobby-e2e.js && node tests/e2e/lobby-e2e.js 5 && node tests/e2e/nav-e2e.js && node tests/e2e/file-check-e2e.js`
Expected: everything passes.

- [ ] **Step 4: Stage, and hand the commit to the user**

```bash
git add README.md web/sw.js
```

Suggested commit for the user (they run it):

```bash
git commit -m "Add the walkable 3D world, phase 1: a Play World button in each lobby opens a cute 3D Campus (Grade 5) or Bayan (Grade 2) with a free character maker and pet, School Street with a building per subject whose door opens the game, the Boss Fort, Plaza, Jesus' Garden, Shop Plaza, Whispering Park, My Little House with the mirror, the Playground and the gate; joystick, keys, drag to look and tap to walk for Grade 2; quick travel from the plaza signpost; music, sound and quality settings with an automatic low mode; a waking-up cover when the browser takes the 3D graphics away and a resting card when 3D cannot start; the game's Home button goes back to the world when she came from it; Three.js r149 vendored so it works offline and from file://"
```

---

## Self-review notes

- **Spec coverage (Phase 1):** character maker (Tasks 4, 11, 13, 14), moving + tap-to-walk Grade 2 + bigger joystick (6, 12, 3), collisions (3, 6), ⚡ quick travel (3, 14), doors + return spot + 🏠 back (3, 5, 8, 14, 15), all 8 places built (10), sound + music + 🔇 (7, 14), quality auto/high/low (5, 9, 14), resting card + context loss (14, 15), Play World button (16), `avatar_v1` synced and `world3d_device_v1` device-only (4, 5), offline (1, 14 precache), tests (all). Phase 2–4 items (medals, markers, Mimi, shop/boss doors, characters, Jesus, sister, nudge, `world3d_v1`, `engine/shop.js`, family peek) are deliberately not here.
- **Names used across tasks:** `World3D.{Text, Layout, Look, Prefs, Walk, Music, Scene, Build, Avatar, Move, Maker, Main}`; `Layout.{PLAYER_R, STREET, BUILDING, GRADES, PLACE_EMOJI, places, props, buildings, paths, onPath, trees, obstacles, blocked, interactables, nearest, spots, spawnFor, appUrl, gradeOf}`; `Prefs.{RETURN_KEY, readPrefs, savePrefs, startQuality, setReturn, readReturn, clearReturn, fpsWatch}`; `S.{toon(color, opts, own), add, rbox, ball, cyl, cone, label, emoji, sprite, canvasTexture, ramp, detail, setQuality, follow, refreshTextures, render}`; `Move.create(...).{state, update, camera, portrait, teleport, freeze}`; `WorldDebug.{ready, go, makerOpen, maker.pick, maker.done, state, teleport, tick, act, openTravel, waking, loseContext}`.
