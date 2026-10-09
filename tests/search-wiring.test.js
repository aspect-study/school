const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { APPS, appFile } = require('./paths.js');

for (const app of APPS) {
  test(app.id + ' has the lesson search', () => {
    const html = fs.readFileSync(appFile(app.id), 'utf8');
    const grade = 'grade' + app.grade;
    const order = new RegExp('engine/nav\\.js" data-grade="' + grade + '"></script>\\r?\\n<script src="\\.\\./\\.\\./\\.\\./engine/search\\.js" data-grade="' + grade + '"></script>');
    assert.match(html, order, 'search.js loads right after nav.js');
    const start = html.match(/window\.Search && Search\.start\(\{ list: '([\w-]+)', lessons: (\w+) \}\);/g) || [];
    assert.equal(start.length, 1, 'one Search.start');
    const list = start[0].match(/list: '([\w-]+)'/)[1];
    assert.ok(html.includes('id="' + list + '"'), 'the list #' + list + ' is on the page');
    assert.ok(html.indexOf('Search.start(') < html.lastIndexOf('renderHome();'), 'Search.start comes before the last renderHome();');
    const marked = (html.match(/data-search-lesson=|dataset\.searchLesson = i;/g) || []).length;
    assert.equal(marked, 1, 'lesson cards carry their lesson number, in one place');
  });
}
