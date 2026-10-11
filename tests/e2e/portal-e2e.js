// A game inside the 3D world: the Science door glides in, the world stops and blurs, the real game runs in the frame
// in embed mode (light theme, Back to town), ← on the game home closes it, and ✕ closes it at once, also from a quiz.
// Run: node tests/e2e/portal-e2e.js
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { stage, makeWorkDir, dumpDom, readOutput, appendDriver, injectDriver, WEBGL_ARGS } = require('./chrome.js');
const { WORLDS, VENDOR_FILES, ENGINE_FILES, web, app, appFile } = require('../paths.js');

const work = makeWorkDir('portal-e2e');
const site = path.join(work, 'site');
const SEED = '<script>(function () { var k = Guide.dayKey(Date.now());'
  + 'Learner.storage.setItem("world3d_v1", JSON.stringify({ v: 1, mimi: "", greeted: k, comforted: k, bossWin: Boss.weekKey(Date.now()), t: 1 }));'
  + 'Learner.storage.setItem("avatar_v1", JSON.stringify({ v: 1, body: "girl", skin: 1, hair: "bob", hairColor: 2, outfit: 3, pet: "kitten", petName: "Tom", t: 5 })); })();</script>';

let world = fs.readFileSync(web(WORLDS[5]), 'utf8');
const three = '<script src="../vendor/three/three.min.js"></script>';
if (!world.includes(three)) throw new Error('three.min.js tag not found');
world = world.replace(three, SEED + three);
stage(site, WORLDS[5], appendDriver(world, fs.readFileSync(path.join(__dirname, 'portal-world.page.js'), 'utf8')), ENGINE_FILES);
for (const f of VENDOR_FILES) {
  const to = path.join(site, f);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(web(f), to);
}
fs.copyFileSync(web('world/world.css'), path.join(site, 'world', 'world.css'));

const game = injectDriver(fs.readFileSync(appFile('life-lab'), 'utf8'), fs.readFileSync(path.join(__dirname, 'portal-game.page.js'), 'utf8'));
stage(site, app('life-lab').page, game, ENGINE_FILES);

// The world checks that a message comes from its own origin, and file:// pages report "file://" for one and "null" for the other.
const server = spawn(process.execPath, [path.join(__dirname, 'static-server.js'), site], { stdio: ['ignore', 'pipe', 'inherit'] });
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
  let r;
  try {
    r = readOutput(dumpDom(path.join(work, 'profile'), 'http://127.0.0.1:' + String(chunk).trim() + '/' + WORLDS[5], '', 30000, WEBGL_ARGS));
  } finally {
    server.kill();
  }
  check(r);
});

function check(r) {
  assert.equal(r.timeout, undefined, 'a wait ran out: ' + r.timeout);
  assert.deepEqual(r.errors, [], 'world page errors');
  assert.equal(r.near, 'life-lab');
  assert.equal(r.first, 'opening', 'the camera glides in first');
  assert.equal(r.pausedWhileOpening, true, 'the world stops drawing during the glide');
  assert.equal(r.url, '../subjects/grade-5/science/index.html?reset=1&embed=1');
  assert.equal(r.entry, true, 'one history entry for the frame');
  assert.equal(r.opened, 'open');
  assert.equal(r.blurred, true, 'the frozen town is blurred');
  assert.equal(r.frameSrc, r.url);
  assert.match(r.color, /^#[0-9a-f]{6}$/i, 'the frame takes the building\'s roof colour');
  assert.equal(r.hudHidden, true, 'the HUD hides under the frame');
  assert.ok(r.game, 'the game ran inside the frame');
  assert.deepEqual(r.game.errors, [], 'game page errors');
  assert.equal(r.game.embedded, true, 'the game knows it is in the frame');
  assert.equal(r.game.theme, 'light', 'the game is locked to light inside the frame');
  assert.equal(r.game.lobbyItem, '🏠 Back to town');
  assert.equal(r.closed, true, '← on the game home closed the frame');
  assert.equal(r.frameGone, true);
  assert.equal(r.blurGone, true);
  assert.equal(r.pausedAfter, false, 'the world draws again');
  assert.equal(r.hudBack, true, 'the HUD is back');
  assert.equal(r.entryAfter, false, 'the frame\'s history entry is gone');
  assert.equal(r.xOpen, 'open');
  assert.equal(r.frames, 1, 'a second tap while open opens nothing');
  assert.equal(r.xClosed, true, '✕ closes at once');
  assert.equal(r.quizScreen, 'quizScreen', 'the game was on a quiz');
  assert.equal(r.innerBefore.portal, true, 'the frame has its own history entry while it is open');
  assert.equal(r.innerClosed, true, '✕ closes from a quiz');
  assert.equal(r.innerAfter.portal, false, '✕ from a quiz leaves no frame entry on top of the world history');
  assert.equal(r.innerLater.portal, false, 'and none appears later');
  assert.equal(r.innerStillWorld, true, 'the world page is still the current document');
  assert.equal(r.returnedHome, 'home', 'the game was back on its home screen before it closed the frame');
  assert.equal(r.returnAfter.portal, false, 'closing from the home after a quiz visit leaves no frame entry on the world history');
  assert.equal(r.returnStillWorld, true, 'closing after a quiz visit did not step back past the world page');
  assert.equal(r.returnLater.portal, false, 'the world history stays clean 1.5 s after closing from the home after a quiz visit');
  assert.equal(r.returnStillWorldLater, true, 'the world page is still the current document 1.5 s later');
  console.log('history after x from a quiz: ' + JSON.stringify({ before: r.innerBefore, after: r.innerAfter, later: r.innerLater }));
  console.log('ok game inside the world: glide, blur, embed mode, close from the game, ✕, ✕ from a quiz');
}
