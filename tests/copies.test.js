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
