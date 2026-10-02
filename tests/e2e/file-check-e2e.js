// A page with an engine file missing shows a red bar naming it; a complete engine folder shows nothing.
// Run: node tests/e2e/file-check-e2e.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { stage, makeWorkDir, dumpDom } = require('./chrome.js');
const { ENGINE_FILES, app, appFile, LOBBIES, lobbyFile } = require('../paths.js');

function barText(page, file, leaveOut) {
  const work = makeWorkDir('file-check');
  const staged = stage(path.join(work, 'site'), page, fs.readFileSync(file, 'utf8'), ENGINE_FILES.filter((f) => !leaveOut.includes(f)));
  const html = dumpDom(path.join(work, 'profile'), staged, '');
  const m = html.match(/<div id="file-check"[^>]*>([\s\S]*?)<\/div>/);
  return m ? m[1] : null;
}

const missing = (files) => '⚠️ Missing or broken file: ' + files + '. Check that the engine folder is complete.';
const cases = [
  [app('rise-shine').page, appFile('rise-shine'), [], null],
  [app('rise-shine').page, appFile('rise-shine'), ['recall.js'], missing('recall.js')],
  [app('math-mastery').page, appFile('math-mastery'), ['study-kit.js'], missing('study-kit.js')],
  [LOBBIES[5].page, lobbyFile(5), ['wallet.js'], missing('wallet.js')],
  [app('kuwentista').page, appFile('kuwentista'), [], null],
  [app('kuwentista').page, appFile('kuwentista'), ['fx.js', 'study-history.js'], missing('study-history.js, fx.js')],
];

let failed = false;
for (const [page, file, leaveOut, want] of cases) {
  try {
    assert.equal(barText(page, file, leaveOut), want);
  } catch (e) {
    failed = true;
    console.error('FAIL file check:', page, 'without', leaveOut.join(', ') || 'nothing', '\n', e.message);
  }
}
if (failed) process.exitCode = 1;
else console.log('File check passed');
