const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { WEB, LOBBIES, PARENT } = require('./paths.js');

const count = (html, s) => html.split(s).length - 1;
const PAGES = [
  [LOBBIES[5].page, '<script src="../engine/insights.js" data-grade="grade5"></script>'],
  [LOBBIES[2].page, '<script src="../engine/insights.js" data-grade="grade2"></script>'],
  [PARENT.page, '<script src="../engine/insights.js"></script>'],
];

for (const [page, tag] of PAGES) {
  test(page + ' loads insights.js once, before parent-panel.js', () => {
    const html = fs.readFileSync(path.join(WEB, page), 'utf8');
    assert.equal(count(html, tag), 1);
    assert.ok(html.indexOf(tag) < html.indexOf('/engine/parent-panel.js"'), 'before the panel that uses it');
  });
}

test('the offline cache keeps insights.js', () => {
  assert.equal(count(fs.readFileSync(path.join(WEB, 'sw.js'), 'utf8'), "'engine/insights.js',"), 1);
});
