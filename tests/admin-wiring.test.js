const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { engineFile } = require('./paths.js');

const read = (name) => fs.readFileSync(engineFile(name), 'utf8');

test('creating an account writes the family summary doc with createdAt', () => {
  assert.match(read('account.js'), /putFamily\(\{ email: email, createdAt: Date\.now\(\) \}\)/);
});

test('a good sync refreshes the family summary doc at most once an hour per device', () => {
  const src = read('cloud.js');
  assert.match(src, /putFamily\(\{ email: user\.email \}\)/);
  assert.match(src, /SEEN_EVERY_MS = 60 \* 60 \* 1000/);
  assert.match(src, /touchFamily\(remote\)/);
});

const { web, LOBBIES } = require('./paths.js');

test('the admin page loads its scripts in order and is not linked from the site', () => {
  const html = fs.readFileSync(web('admin/index.html'), 'utf8');
  const order = ['../engine/firebase-config.js', '../engine/firebase-remote.js', 'admin-config.js', 'admin-stats.js', 'admin.js'];
  const at = order.map((s) => html.indexOf('src="' + s + '"'));
  assert.ok(at.every((i) => i >= 0), 'a script is missing: ' + at);
  assert.deepEqual([...at].sort((a, b) => a - b), at, 'scripts out of order');
  assert.match(html, /<meta name="robots" content="noindex">/);
  for (const page of ['index.html', LOBBIES[5].page, LOBBIES[2].page, 'parent/index.html']) {
    assert.ok(!fs.readFileSync(web(page), 'utf8').includes('admin/'), page + ' links to the admin page');
  }
});

test('admin.js builds its text with textContent, never innerHTML', () => {
  assert.ok(!/innerHTML/.test(fs.readFileSync(web('admin/admin.js'), 'utf8')));
});
