const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { web, lobbyFile, worldFile, PARENT } = require('./paths.js');

// The owner's credit line, English only on every page (Grade 2 too).
const CREDIT = 'Made with ❤️ by Tatay Oliver for his daughters';

const PAGES = {
  'start page': web('index.html'),
  'Grade 5 lobby': lobbyFile(5),
  'Grade 2 lobby': lobbyFile(2),
  'parent page': web(PARENT.page),
};

for (const [name, file] of Object.entries(PAGES)) {
  test('the ' + name + ' shows the credit line', () => {
    const html = fs.readFileSync(file, 'utf8');
    assert.ok(html.includes('<p class="credit">' + CREDIT + '</p>'), name + ' needs: ' + CREDIT);
  });
}

test('the 3D world settings show the same credit line on both grades', () => {
  const { TEXT, localized } = require(worldFile('text.js'));
  assert.equal(TEXT.grade5.credit, CREDIT);
  assert.equal(TEXT.grade2.credit, CREDIT);
  assert.equal(localized('grade2', false).credit, CREDIT);
  assert.match(fs.readFileSync(worldFile('world-main.js'), 'utf8'), /'w-credit', T\.credit/);
});
