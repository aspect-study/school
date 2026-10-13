const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ROOT } = require('./paths.js');
const Sheet = require(path.join(ROOT, 'tools', 'line-sheet.js'));

test('render groups a pool by situation and shows replies and the Filipino half', () => {
  const md = Sheet.render('Test', { pools: { 'any-kid': [
    { id: 'a', say: 'Hi!' },
    { id: 'b', when: ['time:evening'], say: 'Good evening!' },
    { id: 'c', say: 'Joke?', fil: 'Biro?', replies: [{ text: 'Yes!', next: 'd' }] },
    { id: 'd', follow: true, say: 'Knock knock!', fil: 'Tok tok!' }
  ] } });
  assert.match(md, /# Test: lines to review/);
  assert.match(md, /## Any playmate \(4 lines\)/);
  assert.match(md, /### Anytime/);
  assert.match(md, /### time:evening/);
  assert.match(md, /Joke\? _\(Biro\?\)_/);
  assert.match(md, /\[Yes!\] → Knock knock!/);
});

test('render prints every step of a 3-step chat with Filipino, and an example for slot lines', () => {
  const md = Sheet.render('Test', { pools: { 'any-pet': [
    { id: 'a', say: 'Knock knock!', fil: 'Tok tok!', replies: [{ text: 'Who is there?', next: 'b' }] },
    { id: 'b', follow: true, say: 'Boo!', fil: 'Bu!', replies: [{ text: 'Boo who?', next: 'c' }] },
    { id: 'c', follow: true, say: 'Do not cry!', fil: 'Huwag umiyak!' },
    { id: 'd', when: ['wearing:hat'], say: 'Nice {hat}!' }
  ] } });
  assert.match(md, /- Knock knock! _\(Tok tok!\)_\n  - \[Who is there\?\] → Boo! _\(Bu!\)_\n    - \[Boo who\?\] → Do not cry! _\(Huwag umiyak!\)_/);
  assert.match(md, /- Nice \{hat\}!\n  e\.g\. Nice Sun hat!/);
});

test('the pages in docs/lines are up to date (run node tools/line-sheet.js)', () => {
  for (const s of Sheet.SHEETS) {
    const file = path.join(ROOT, 'docs', 'lines', s.out);
    assert.ok(fs.existsSync(file), s.out + ' is missing');
    assert.equal(fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n'), Sheet.sheet(s), s.out);
  }
});
