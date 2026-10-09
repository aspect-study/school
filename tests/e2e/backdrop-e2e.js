// The start page's animated backdrop: the backdrop page draws a town with kids and pets (both towns), the start page
// shows it behind click-through buttons, and with 3D unavailable the page stays as it was.
// Run: node tests/e2e/backdrop-e2e.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { stage, makeWorkDir, dumpDom, readOutput, appendDriver, WEBGL_ARGS } = require('./chrome.js');
const { BACKDROP_PAGE, BACKDROP_FILES, VENDOR_FILES, ENGINE_FILES, web } = require('../paths.js');

const WAIT_MS = 20000;
const work = makeWorkDir('backdrop-e2e');
const THREE_TAG = '<script src="../vendor/three/three.min.js"></script>';
const NO_GL = '<script>HTMLCanvasElement.prototype.getContext = function () { return null; };</script>';

// Polls done() every 100 ms (about 15 s at most), then prints report() with the page errors.
function driver(done, report) {
  return `
(function () {
  function out() {
    var o = (${report})();
    o.errors = window.__e2eErrors || [];
    var pre = document.createElement('pre');
    pre.id = 'e2e-out';
    pre.textContent = JSON.stringify(o);
    document.body.appendChild(pre);
  }
  var tries = 150;
  (function poll() {
    if ((${done})() || --tries <= 0) return out();
    setTimeout(poll, 100);
  })();
})();`;
}

function copyVendor(site) {
  for (const f of VENDOR_FILES) {
    const to = path.join(site, f);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(web(f), to);
  }
}

// Software WebGL can draw a frame a second or slower, which the backdrop's slow-frame watch rightly gives up on; the
// staged copy turns that watch off so the checks are about drawing, not the test machine's speed.
function neuterSlowWatch(site) {
  const file = path.join(site, 'world', 'backdrop-core.js');
  const text = fs.readFileSync(file, 'utf8');
  const tag = 'SLOW_FRAME = 1 / 15';
  if (!text.includes(tag)) throw new Error(tag + ' not found in backdrop-core.js');
  fs.writeFileSync(file, text.replace(tag, 'SLOW_FRAME = Infinity'));
}

// Under --virtual-time-budget headless Chrome hands the page only a few animation frames (3 to 5) before time races
// ahead without drawing, so "kept drawing" means a second frame after the first (the one that says ready).
const MIN_FRAMES = 2;

// seed runs before the backdrop's own scripts: it forces the town (Math.random) or turns 3D off (getContext).
function backdropHtml(seed) {
  const html = fs.readFileSync(web(BACKDROP_PAGE), 'utf8');
  if (!html.includes(THREE_TAG)) throw new Error('three.min.js tag not found');
  return html.replace(THREE_TAG, seed + THREE_TAG);
}

function runPage(name, file) {
  return readOutput(dumpDom(path.join(work, 'profile-' + name), file, '', WAIT_MS, WEBGL_ARGS));
}

function backdropSite(name, seed) {
  const site = path.join(work, name);
  const html = appendDriver(backdropHtml(seed), driver(
    'function () { return __backdrop.state === "failed" || (__backdrop.state === "ready" && __backdrop.frames >= ' + MIN_FRAMES + '); }',
    'function () { return { state: __backdrop.state, frames: __backdrop.frames, grade: __backdrop.grade }; }'));
  const file = stage(site, BACKDROP_PAGE, html, []);
  copyVendor(site);
  neuterSlowWatch(site);
  return file;
}

// The start page, with the backdrop staged beside it at world/backdrop.html.
function startSite(name, seed) {
  const site = path.join(work, name);
  const html = appendDriver(fs.readFileSync(web('index.html'), 'utf8'), driver(
    'function () { var f = document.getElementById("backdrop"); return !f || f.classList.contains("on"); }',
    `function () {
      var f = document.getElementById('backdrop');
      var buttons = Array.prototype.slice.call(document.querySelectorAll('#welcome-view button, #welcome-view a'));
      var reached = buttons.filter(function (b) {
        b.scrollIntoView({ block: 'center' });
        var r = b.getBoundingClientRect(), hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return hit === b || b.contains(hit);
      });
      return {
        frame: !!f, on: !!(f && f.classList.contains('on')), src: f ? f.getAttribute('src') : null,
        welcome: !document.getElementById('welcome-view').hidden, buttons: buttons.length, reached: reached.length
      };
    }`));
  const file = stage(site, 'index.html', html, ENGINE_FILES);
  for (const f of BACKDROP_FILES) {
    const to = path.join(site, 'world', f);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(web('world/' + f), to);
  }
  fs.writeFileSync(path.join(site, BACKDROP_PAGE), backdropHtml(seed));
  copyVendor(site);
  neuterSlowWatch(site);
  return file;
}

for (const [name, random, grade] of [['campus', 0.1, 'grade5'], ['bayan', 0.9, 'grade2']]) {
  const out = runPage(name, backdropSite(name, '<script>Math.random = function () { return ' + random + '; };</script>'));
  assert.deepEqual(out.errors, [], name + ': page errors');
  assert.equal(out.state, 'ready', name);
  assert.equal(out.grade, grade, name + ' town');
  assert.ok(out.frames >= MIN_FRAMES, name + ' drew frames: ' + out.frames);
  console.log('ok backdrop draws ' + name + ' (' + out.frames + ' frames)');
}

{
  const out = runPage('nogl', backdropSite('nogl', NO_GL));
  assert.deepEqual(out.errors, [], 'no 3D: page errors');
  assert.equal(out.state, 'failed', 'no 3D: the backdrop says it cannot');
  assert.equal(out.frames, 0);
  console.log('ok backdrop reports failure without 3D');
}

{
  const out = runPage('start', startSite('start', ''));
  assert.deepEqual(out.errors, [], 'start page: page errors');
  assert.equal(out.src, 'world/backdrop.html', 'loaded after the page');
  assert.equal(out.on, true, 'faded in once the backdrop was ready');
  assert.equal(out.welcome, true, 'the welcome view shows');
  assert.equal(out.buttons, 4, 'three start buttons and the Parent link');
  assert.equal(out.reached, 4, 'a tap on each reaches it through the iframe');
  console.log('ok start page shows the backdrop behind working buttons');
}

{
  const out = runPage('start-nogl', startSite('start-nogl', NO_GL));
  assert.deepEqual(out.errors, [], 'no 3D: page errors');
  assert.equal(out.frame, false, 'the iframe is removed when 3D cannot run');
  assert.equal(out.welcome, true);
  assert.equal(out.buttons, 4);
  assert.equal(out.reached, 4);
  console.log('ok start page is unchanged without 3D');
}
