const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { worldFile } = require('./paths.js');
const { TEXT } = require(worldFile('text.js'));

const main = fs.readFileSync(worldFile('world-main.js'), 'utf8');

test('world-main wires the stairs, the balcony spots and the Term 1 ground door', () => {
  ["'stairs-up'", "'stairs-down'", "'up-door'", "'up-exam'"].forEach((k) => assert.ok(main.includes(k), k));
  ['Up.feet(', 'Up.solids(', 'Up.items(', 'Up.blocked(', 'Up.links(', 'Up.buddyHref(', 'Up.stepHref(', 'W.Upstairs3D.create(', 'ctl.lift(', 'pal.lift('].forEach((s) => assert.ok(main.includes(s), s));
  assert.ok(!/Loft|ladder-up|old-lessons/.test(main), 'no loft left');
});

test('upstairs words exist for both grades; Grade 2 sentences pair Filipino with English, buttons stay English', () => {
  const g5 = TEXT.grade5, g2 = TEXT.grade2;
  ['goUp', 'goDown', 'termDoor', 'examBoard', 'termOne', 'term1', 'term2', 'exam', 'soon', 'examNone'].forEach((k) => {
    assert.equal(typeof g5[k], 'string', 'grade5 ' + k);
    assert.equal(typeof g2[k], 'string', 'grade2 ' + k);
  });
  ['goUp', 'goDown', 'termDoor', 'examBoard', 'termOne'].forEach((k) => {
    assert.ok(!g2[k].includes(' · '), 'button ' + k + ' is English only');
    assert.equal(g2[k], g5[k], 'button ' + k + ' is the same on both grades');
  });
  ['term1', 'term2', 'exam', 'soon', 'examNone'].forEach((k) => assert.ok(g2[k].includes(' · '), 'grade2 ' + k + ' is a pair'));
  assert.ok(g5.soon.includes('{name}') && g2.soon.split(' · ').every((h) => h.includes('{name}')));
});
