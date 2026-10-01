// A page with a shared file missing shows a red bar naming it; a complete folder shows nothing.
// Run: node tests/e2e/file-check-e2e.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { GRADE2, makeWorkDir, dumpDom } = require('./chrome.js');

const GRADE5 = path.join(__dirname, '..', '..');
const SHARED5 = ['study-history.js', 'wallet.js', 'fx.js', 'powerups.js', 'recall.js'];
const SHARED2 = ['study-history-grade2.js', 'wallet-grade2.js', 'fx-grade2.js', 'powerups-grade2.js', 'recall-grade2.js'];

function barText(dir, page, shared, leaveOut) {
  const work = makeWorkDir('file-check');
  fs.copyFileSync(path.join(dir, page), path.join(work, page));
  for (const f of shared) if (!leaveOut.includes(f)) fs.copyFileSync(path.join(dir, f), path.join(work, f));
  const html = dumpDom(path.join(work, 'profile'), path.join(work, page), '');
  const m = html.match(/<div id="file-check"[^>]*>([\s\S]*?)<\/div>/);
  return m ? m[1] : null;
}

const cases = [
  [GRADE5, 'rise-shine.html', SHARED5, [], null],
  [GRADE5, 'rise-shine.html', SHARED5, ['recall.js'], '⚠️ Missing or broken file: recall.js. Copy it into the same folder as this page.'],
  [GRADE5, 'lobby-grade5.html', SHARED5, ['wallet.js'], '⚠️ Missing or broken file: wallet.js. Copy it into the same folder as this page.'],
  [GRADE2, 'kuwentista.html', SHARED2, [], null],
  [GRADE2, 'kuwentista.html', SHARED2, ['fx-grade2.js', 'study-history-grade2.js'], '⚠️ Missing or broken file: study-history-grade2.js, fx-grade2.js. Copy it into the same folder as this page.'],
];

let failed = false;
for (const [dir, page, shared, leaveOut, want] of cases) {
  try {
    assert.equal(barText(dir, page, shared, leaveOut), want);
  } catch (e) {
    failed = true;
    console.error('FAIL file check:', page, 'without', leaveOut.join(', ') || 'nothing', '\n', e.message);
  }
}
if (failed) process.exitCode = 1;
else console.log('File check passed');
