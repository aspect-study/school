const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { APPS, appFile } = require('./paths.js');

for (const app of APPS) {
  test(app.id + ' locks the quiz until the reviewer is read', () => {
    const html = fs.readFileSync(appFile(app.id), 'utf8');
    const grade = 'grade' + app.grade;
    const order = new RegExp('engine/search\\.js" data-grade="' + grade + '"></script>\\r?\\n<script src="\\.\\./\\.\\./\\.\\./engine/read-gate\\.js" data-grade="' + grade + '"></script>');
    assert.match(html, order, 'read-gate.js loads right after search.js');

    const open = html.match(/window\.ReadGate && ReadGate\.open\(\{ cards: [\w.[\]]+\.length,(?: faces: 2,)? next: '([\w-]+)'(?:, start: '([\w-]+)')? \}\);/g) || [];
    assert.equal(open.length, 1, 'one ReadGate.open');
    const [, next, start] = open[0].match(/next: '([\w-]+)'(?:, start: '([\w-]+)')?/);
    assert.ok(html.includes('id="' + next + '"'), 'the Next button #' + next + ' is on the page');
    if (start) {
      assert.ok(new RegExp('id="' + start + '" onclick="startQuiz\\(\\)"').test(html), '#' + start + ' is the Start Quiz button');
      assert.equal((html.match(/onclick="startQuiz\(\)"/g) || []).length, 1, 'no other Start Quiz button');
    } else {
      assert.match(html, /else \{ startQuiz\(\); \}/, 'Next starts the quiz on the last card');
    }

    const shows = (html.match(/window\.ReadGate && ReadGate\.show\(/g) || []).length;
    assert.equal(shows, open[0].includes('faces: 2') ? 2 : 1, 'ReadGate.show on each card render (and on a flip)');
  });
}
