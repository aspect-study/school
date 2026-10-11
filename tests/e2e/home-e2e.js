// World as home: the lobby forwards to the world, the world shows coin and quest pills, the shop, parent area and
// coin guide open in the frame, the quests card opens a game, and ?stay=1 keeps the lobby page.
// Run: node tests/e2e/home-e2e.js
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { stage, makeWorkDir, dumpDom, readOutput, appendDriver, WEBGL_ARGS } = require('./chrome.js');
const { WORLDS, LOBBIES, VENDOR_FILES, ENGINE_FILES, web, app, appFile, lobbyFile } = require('../paths.js');

const work = makeWorkDir('home-e2e');
const root = path.join(work, 'root');
const main = path.join(root, 'main');
const stay = path.join(root, 'stay');
const SEED = '<script>(function () { var k = Guide.dayKey(Date.now());'
  + 'Learner.storage.setItem("world3d_v1", JSON.stringify({ v: 1, mimi: "", greeted: k, comforted: k, bossWin: Boss.weekKey(Date.now()), t: 1 }));'
  + 'Learner.storage.setItem("quests_v1", JSON.stringify({ v: 1, day: k, at: 1, days: [], paidDay: "", streakPaid: [], list: [{ id: "stars", kind: "stars", done: false }, { id: "right", kind: "right", done: false }, { id: "explore|life-lab", kind: "explore", app: "life-lab", title: "Science", done: false }] }));'
  + 'Learner.storage.setItem("avatar_v1", JSON.stringify({ v: 1, body: "girl", skin: 1, hair: "bob", hairColor: 2, outfit: 3, pet: "kitten", petName: "Tom", t: 5 })); })();</script>';
const COINS = '<script>Wallet.addBonus(25);</script>';

let world = fs.readFileSync(web(WORLDS[5]), 'utf8');
const three = '<script src="../vendor/three/three.min.js"></script>';
if (!world.includes(three)) throw new Error('three.min.js tag not found');
world = world.replace(three, SEED + COINS + three);
stage(main, WORLDS[5], appendDriver(world, fs.readFileSync(path.join(__dirname, 'home-world.page.js'), 'utf8')), ENGINE_FILES);
for (const f of VENDOR_FILES) {
  const to = path.join(main, f);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(web(f), to);
}
fs.copyFileSync(web('world/world.css'), path.join(main, 'world', 'world.css'));
stage(main, LOBBIES[5].page, fs.readFileSync(lobbyFile(5), 'utf8'), ENGINE_FILES);
stage(main, app('life-lab').page, fs.readFileSync(appFile('life-lab'), 'utf8'), ENGINE_FILES);

const stayDriver = '(function () { setTimeout(function () { var pre = document.createElement("pre"); pre.id = "e2e-out";'
  + 'pre.textContent = JSON.stringify({ path: location.pathname, errors: window.__e2eErrors || [] }); document.body.appendChild(pre); }, 1500); })();';
stage(stay, LOBBIES[5].page, appendDriver(fs.readFileSync(lobbyFile(5), 'utf8'), stayDriver), ENGINE_FILES);

const server = spawn(process.execPath, [path.join(__dirname, 'static-server.js'), root], { stdio: ['ignore', 'pipe', 'inherit'] });
let started = false;
function fail(message) {
  if (started) return;
  started = true;
  console.error('FAIL ' + message);
  process.exitCode = 1;
  server.kill();
}
const startTimer = setTimeout(() => fail('static-server.js did not print its port in 10 s'), 10000);
server.on('error', (err) => fail('static-server.js could not start: ' + err.message));
server.on('exit', (code) => fail('static-server.js exited before printing its port (code ' + code + ')'));
server.stdout.once('data', (chunk) => {
  if (started) return;
  started = true;
  clearTimeout(startTimer);
  const base = 'http://127.0.0.1:' + String(chunk).trim() + '/';
  let r, s;
  try {
    r = readOutput(dumpDom(path.join(work, 'profile'), base + 'main/' + LOBBIES[5].page, '', 60000, WEBGL_ARGS));
    s = readOutput(dumpDom(path.join(work, 'profile-stay'), base + 'stay/' + LOBBIES[5].page + '?stay=1', '', 10000, WEBGL_ARGS));
  } finally {
    server.kill();
  }
  check(r, s);
});

function check(r, s) {
  assert.equal(r.timeout, undefined, 'a wait ran out: ' + r.timeout);
  assert.deepEqual(r.errors, [], 'world page errors');
  assert.ok(r.path.endsWith('/world/grade-5.html'), 'the lobby forwarded to the world: ' + r.path);
  assert.equal(r.pills.coins, '🪙 ' + r.balance, 'the coin pill shows the balance');
  assert.ok(r.balance >= 25, 'the seeded coins are in the wallet: ' + r.balance);
  assert.match(r.pills.quests, /^🎯 \d\/3/, 'the quests pill: ' + r.pills.quests);
  assert.equal(r.shopWrapDisplay, 'none', 'the lobby page shows only the shop in the frame');
  assert.equal(r.pinShown, true, 'the parent PIN pad shows in the frame');
  assert.equal(r.openLobby, true, 'the parent area offers Open the lobby page');
  assert.equal(r.coinsShown, true, 'the coin guide shows in the frame');
  assert.equal(r.questItems, 3, 'the quests card lists 3 quests');
  assert.equal(r.questLink, true, 'a quest has a game link');
  assert.match(r.gameUrl, /\/subjects\//);
  assert.match(r.gameUrl, /embed=1/);
  assert.equal(r.closedAll, true, 'the game frame closed');
  assert.deepEqual(s.errors, [], 'stay page errors');
  assert.ok(s.path.endsWith('/lobby/grade-5.html'), '?stay=1 kept the lobby page: ' + s.path);
  console.log('ok home: lobby forwards, pills, shop / parent / coins in the frame, quests card, stay=1');
}
