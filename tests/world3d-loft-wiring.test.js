const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { worldFile } = require('./paths.js');
const { TEXT } = require(worldFile('text.js'));

const main = fs.readFileSync(worldFile('world-main.js'), 'utf8');

test('world-main wires the ladder, the loft desks, the Exam Corner and the Old lessons bookcase', () => {
  ['ladder-up', 'ladder-down', 'loft-desk', 'loft-exam', 'old-lessons'].forEach((k) => assert.ok(main.includes("'" + k + "'"), k));
  ['W.Loft3D.create(', 'Loft.items(', 'Loft.solid(', 'Loft.deskUrl(', 'Loft.examUrl(', 'Loft.oldUrl(', 'W.TermLessons'].forEach((s) => assert.ok(main.includes(s), s));
});

test('loft words exist for both grades; Grade 2 sentences pair Filipino with English, buttons stay English', () => {
  const g5 = TEXT.grade5, g2 = TEXT.grade2;
  ['climb', 'down', 'oldLessons', 'examCorner', 'loft', 'shelf', 'exam', 'oldPick', 'soon', 'examPick', 'examNone'].forEach((k) => {
    assert.equal(typeof g5[k], 'string', 'grade5 ' + k);
    assert.equal(typeof g2[k], 'string', 'grade2 ' + k);
  });
  ['climb', 'down', 'oldLessons', 'examCorner'].forEach((k) => {
    assert.ok(!g2[k].includes(' · '), 'button ' + k + ' is English only');
    assert.equal(g2[k], g5[k], 'button ' + k + ' is the same on both grades');
  });
  ['loft', 'shelf', 'exam', 'oldPick', 'soon', 'examPick', 'examNone'].forEach((k) => assert.ok(g2[k].includes(' · '), 'grade2 ' + k + ' is a pair'));
  ['soon'].forEach((k) => assert.ok(g5[k].includes('{name}') && g2[k].split(' · ').every((h) => h.includes('{name}')), k + ' has {name} in every half'));
});
