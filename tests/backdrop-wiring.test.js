const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { WEB, BACKDROP_PAGE, BACKDROP_FILES, VENDOR_FILES, web } = require('./paths.js');

const ORDER = VENDOR_FILES.map((f) => '../' + f).concat(BACKDROP_FILES);

test('backdrop page loads its scripts in order, with no learner or storage code', () => {
  const html = fs.readFileSync(web(BACKDROP_PAGE), 'utf8');
  assert.match(html.slice(0, 1024), /<meta charset="utf-8">/i);
  assert.deepEqual([...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]), ORDER);
  assert.ok(!/engine\//.test(html), 'no engine files: the backdrop reads and writes nothing');
  assert.ok(html.includes('id="stage"'));
});

test('every backdrop script is a file in web/world, case included', () => {
  for (const f of BACKDROP_FILES) assert.ok(fs.readdirSync(path.join(WEB, 'world')).includes(f), f);
});

test('the backdrop never touches saved data', () => {
  for (const f of ['backdrop.js', 'backdrop-core.js']) {
    const src = fs.readFileSync(path.join(WEB, 'world', f), 'utf8');
    assert.ok(!/localStorage|sessionStorage|Learner|Wallet|StudyHistory/.test(src), f);
  }
});

test('the start page shows the backdrop in a click-through, hidden-from-readers iframe that loads late', () => {
  const html = fs.readFileSync(web('index.html'), 'utf8');
  assert.ok(html.includes('id="backdrop"'));
  assert.ok(/<iframe[^>]*id="backdrop"[^>]*aria-hidden="true"[^>]*tabindex="-1"/.test(html), 'hidden from readers and the tab order');
  assert.ok(!/<iframe[^>]*id="backdrop"[^>]*\ssrc=/.test(html), 'no src in the markup: it is set after load');
  assert.ok(/#backdrop\s*\{[^}]*pointer-events:\s*none/.test(html), 'taps pass through');
  assert.ok(html.includes("'load'") && html.includes('world/backdrop.html'), 'the src is set from a load handler');
  assert.ok(html.includes("'backdrop-ready'") && html.includes("'backdrop-failed'"), 'listens for ready and failed');
});

test('the start page lets the backdrop fail quietly and keeps its buttons first', () => {
  const html = fs.readFileSync(web('index.html'), 'utf8');
  assert.ok(html.includes('.remove()') && html.includes('e.source'), 'removes the iframe when it fails, only for its own messages');
  assert.ok(html.indexOf('<iframe') < html.indexOf('<main'), 'the iframe is behind the content');
});
