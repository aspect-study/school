const test = require('node:test');
const assert = require('node:assert/strict');
const { engineFile } = require('./paths.js');
const { controller, readMs, wordCount, TEXT, PACE } = require(engineFile('read-gate.js'));

test('reading time grows with the words, between a floor and a ceiling', () => {
  assert.equal(wordCount('Ang <b>datu</b> — ang pinuno, 2 beses.'), 6);
  assert.equal(readMs('Datu', 'grade5'), PACE.grade5.min);
  assert.equal(readMs('word '.repeat(30), 'grade5'), 30 * PACE.grade5.perWord);
  assert.equal(readMs('word '.repeat(500), 'grade5'), PACE.grade5.max);
  assert.ok(readMs('word '.repeat(20), 'grade2') > readMs('word '.repeat(20), 'grade5'), 'Grade 2 gets more time per word');
});

test('Next stays locked until the card was up long enough', () => {
  const g = controller(3, 1);
  g.show(0, 0, 5000, 0);
  assert.equal(g.status().nextLocked, true);
  g.tick(2500, true);
  assert.equal(g.status().progress, 0.5);
  g.tick(5000, true);
  assert.equal(g.status().nextLocked, false);
  assert.equal(g.status().read, 1);
});

test('time while the page is hidden does not count', () => {
  const g = controller(1, 1);
  g.show(0, 0, 3000, 0);
  g.tick(60000, false);
  assert.equal(g.status().nextLocked, true);
  g.tick(63000, true);
  assert.equal(g.status().nextLocked, false);
});

test('a flip card needs both sides read, and asks for the flip', () => {
  const g = controller(2, 2);
  g.show(0, 0, 2000, 0);
  g.tick(2000, true);
  assert.deepEqual([g.status().nextLocked, g.status().flip], [true, true]);
  assert.equal(g.status().progress, 0.5, 'the bar shows the card half read');
  g.show(0, 1, 4000, 2000);
  assert.equal(g.status().flip, false);
  g.tick(6000, true);
  assert.deepEqual([g.status().nextLocked, g.status().read], [false, 1]);
});

test('time on a side adds up across flips', () => {
  const g = controller(1, 2);
  g.show(0, 1, 4000, 0);
  g.tick(3000, true);
  g.show(0, 0, 2000, 3000);
  g.tick(5000, true);
  g.show(0, 1, 4000, 5000);
  g.tick(6000, true);
  assert.equal(g.status().allRead, true);
});

test('going back to a read card is free, and the quiz opens only when every card is read', () => {
  const g = controller(2, 1);
  g.show(0, 0, 2000, 0);
  g.tick(2000, true);
  g.show(1, 0, 2000, 2000);
  assert.equal(g.status().allRead, false);
  g.show(0, 0, 2000, 2000);
  assert.deepEqual([g.status().nextLocked, g.status().progress], [false, 1]);
  g.show(1, 0, 2000, 2000);
  g.tick(4000, true);
  assert.deepEqual([g.status().allRead, g.status().last], [true, true]);
});

test('Grade 2 lines carry English and Filipino', () => {
  assert.match(TEXT.grade2.locked(2, 6), /^📖 Read every card first \(2 of 6\) · Basahin/);
  assert.match(TEXT.grade2.done, / · Nabasa/);
  assert.match(TEXT.grade2.flip, / · Pindutin/);
  assert.equal(TEXT.grade5.locked(1, 8), '📖 Read every card to unlock the quiz (1 of 8 read)');
});
