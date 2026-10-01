const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const GRADE2 = path.join(__dirname, '..', '..', 'grade 2');

const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].find((p) => fs.existsSync(p));

const ERROR_TRAP = '<script>window.__e2eErrors=[];addEventListener("error",function(e){__e2eErrors.push(String(e.message));});</script>';

function makeWorkDir(name) {
  return fs.mkdtempSync(path.join(os.tmpdir(), name + '-'));
}

function dumpDom(profileDir, file, suffix) {
  if (!CHROME) throw new Error('Chrome or Edge not found');
  const url = pathToFileURL(file).href + (suffix || '');
  return execFileSync(CHROME, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--user-data-dir=' + profileDir, '--dump-dom', url,
  ], { encoding: 'utf8', timeout: 90000, stdio: ['ignore', 'pipe', 'ignore'] });
}

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

module.exports = { GRADE2, makeWorkDir, dumpDom, readOutput, injectDriver, appendDriver };
