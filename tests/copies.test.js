const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

test('the Grade 2 and Grade 5 study-history files are identical', () => {
  const g2 = fs.readFileSync(path.join(root, 'grade 2', 'study-history-grade2.js'));
  const g5 = fs.readFileSync(path.join(root, 'study-history.js'));
  assert.ok(g2.equals(g5), 'edit grade 2/study-history-grade2.js, then copy it over the root study-history.js');
});

function lastScript(file) {
  const html = fs.readFileSync(file, 'utf8');
  return html.slice(html.lastIndexOf('<script>'), html.lastIndexOf('</script>'));
}
test('both lobbies run the identical Parent panel script', () => {
  assert.equal(lastScript(path.join(root, 'lobby-grade5.html')), lastScript(path.join(root, 'grade 2', 'lobby.html')));
});

test('the Grade 2 and Grade 5 wallet files are identical', () => {
  const g2 = fs.readFileSync(path.join(root, 'grade 2', 'wallet-grade2.js'));
  const g5 = fs.readFileSync(path.join(root, 'wallet.js'));
  assert.ok(g2.equals(g5), 'edit grade 2/wallet-grade2.js, then copy it over the root wallet.js');
});

function shopScript(file) {
  const html = fs.readFileSync(file, 'utf8');
  const start = html.indexOf('<script data-shop>');
  assert.ok(start >= 0, 'no <script data-shop> in ' + file);
  assert.ok(start < html.lastIndexOf('<script>'), 'the shop script must come before the Parent panel script');
  return html.slice(start, html.indexOf('</script>', start));
}
test('both lobbies run the identical shop script', () => {
  assert.equal(shopScript(path.join(root, 'lobby-grade5.html')), shopScript(path.join(root, 'grade 2', 'lobby.html')));
});

test('the Grade 2 and Grade 5 sound-effect files are identical', () => {
  const g2 = fs.readFileSync(path.join(root, 'grade 2', 'fx-grade2.js'));
  const g5 = fs.readFileSync(path.join(root, 'fx.js'));
  assert.ok(g2.equals(g5), 'edit grade 2/fx-grade2.js, then copy it over the root fx.js');
});

test('the Grade 2 and Grade 5 power-up files are identical', () => {
  const g2 = fs.readFileSync(path.join(root, 'grade 2', 'powerups-grade2.js'));
  const g5 = fs.readFileSync(path.join(root, 'powerups.js'));
  assert.ok(g2.equals(g5), 'edit grade 2/powerups-grade2.js, then copy it over the root powerups.js');
});

test('the Grade 2 and Grade 5 recall files are identical', () => {
  const g2 = fs.readFileSync(path.join(root, 'grade 2', 'recall-grade2.js'));
  const g5 = fs.readFileSync(path.join(root, 'recall.js'));
  assert.ok(g2.equals(g5), 'edit grade 2/recall-grade2.js, then copy it over the root recall.js');
});
