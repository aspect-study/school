const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const { engineFile, web } = require('../paths.js');

// CHROME=/path/to/chrome overrides the Windows defaults (Linux, CI).
const CHROME = [
  process.env.CHROME,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].find((p) => p && fs.existsSync(p));

const ERROR_TRAP = '<script>window.__e2eErrors=[];addEventListener("error",function(e){__e2eErrors.push(String(e.message));});</script>';

// Writes a page into a temp site at its real relative path (e.g. subjects/grade-5/math/index.html),
// with the chosen engine files and the page's own data files (lessons/…), so its relative script paths resolve as on the live site.
function stage(siteDir, page, html, engineFiles) {
  const file = path.join(siteDir, page);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
  for (const m of html.matchAll(/<script src="([^"./][^"]*\.js)"><\/script>/g)) {
    const to = path.join(path.dirname(file), m[1]);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(path.join(path.dirname(web(page)), m[1]), to);
  }
  fs.mkdirSync(path.join(siteDir, 'engine'), { recursive: true });
  for (const name of engineFiles) fs.copyFileSync(engineFile(name), path.join(siteDir, 'engine', name));
  return file;
}

function makeWorkDir(name) {
  return fs.mkdtempSync(path.join(os.tmpdir(), name + '-'));
}

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
const WEBGL_ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=480,360'];

function readOutput(html) {
  const m = html.match(/<pre id="e2e-out">([\s\S]*?)<\/pre>/);
  if (!m) throw new Error('no e2e output in page (driver did not run): ' + html.slice(-300));
  const text = m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
  return JSON.parse(text);
}

function withErrorTrap(html) {
  const first = html.indexOf('<script');
  if (first < 0) throw new Error('no <script> in page');
  return html.slice(0, first) + ERROR_TRAP + html.slice(first);
}

function injectDriver(html, driver) {
  const marker = 'renderHome();';
  const last = html.lastIndexOf(marker);
  if (last < 0) throw new Error('renderHome(); not found');
  const cut = last + marker.length;
  return withErrorTrap(html.slice(0, cut) + '\n' + driver + '\n' + html.slice(cut));
}

function appendDriver(html, driver) {
  return withErrorTrap(html) + '\n<script>\n' + driver + '\n</script>\n';
}

module.exports = { stage, makeWorkDir, dumpDom, readOutput, injectDriver, appendDriver, WEBGL_ARGS };
