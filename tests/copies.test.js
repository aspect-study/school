const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { lobbyFile } = require('./paths.js');

function lastScript(file) {
  const html = fs.readFileSync(file, 'utf8');
  return html.slice(html.lastIndexOf('<script>'), html.lastIndexOf('</script>'));
}
test('both lobbies run the identical Parent panel script', () => {
  assert.equal(lastScript(lobbyFile(5)), lastScript(lobbyFile(2)));
});

function shopScript(file) {
  const html = fs.readFileSync(file, 'utf8');
  const start = html.indexOf('<script data-shop>');
  assert.ok(start >= 0, 'no <script data-shop> in ' + file);
  assert.ok(start < html.lastIndexOf('<script>'), 'the shop script must come before the Parent panel script');
  return html.slice(start, html.indexOf('</script>', start));
}
test('both lobbies run the identical shop script', () => {
  assert.equal(shopScript(lobbyFile(5)), shopScript(lobbyFile(2)));
});

test('the Parent panel lives in engine/parent-panel.js, not inline in the lobbies', () => {
  for (const grade of [5, 2]) {
    const html = fs.readFileSync(lobbyFile(grade), 'utf8');
    assert.ok(html.includes('<script src="../engine/parent-panel.js"'), 'grade ' + grade + ' lobby does not load parent-panel.js');
    assert.ok(!html.includes('function renderWeakSpots'), 'grade ' + grade + ' lobby still has the panel script inline');
  }
});

test('the parent page loads the shared panel and its engine files', () => {
  const { web, PARENT } = require('./paths.js');
  const html = fs.readFileSync(web(PARENT.page), 'utf8');
  for (const f of ['storage', 'study-history', 'wallet', 'sync-core', 'firebase-config', 'firebase-remote', 'shop-requests', 'subjects', 'mastery', 'quests', 'parent-panel']) {
    assert.ok(html.includes('<script src="../engine/' + f + '.js"></script>'), 'parent page does not load ' + f + '.js');
  }
  assert.ok(!html.includes('learner.js'), 'the parent page must not create a learner on the phone');
  assert.ok(html.includes('<script src="phone.js"></script>'));
});
