const test = require('node:test');
const assert = require('node:assert/strict');
const { engineFile } = require('./paths.js');
const { controller, TEXT } = require(engineFile('read-gate.js'));

test('a card counts as read the moment it is shown, with no wait', () => {
  const g = controller(3);
  g.show(0);
  assert.deepEqual([g.status().read, g.status().allRead], [1, false]);
  g.show(1);
  assert.equal(g.status().read, 2);
});

test('going back to a card does not count it twice, and the quiz opens once every card was shown', () => {
  const g = controller(2);
  g.show(0);
  g.show(0);
  assert.equal(g.status().read, 1);
  g.show(1);
  assert.deepEqual([g.status().allRead, g.status().last], [true, true]);
});

test('jumping to the last card does not skip the cards in between', () => {
  const g = controller(3);
  g.show(2);
  assert.deepEqual([g.status().last, g.status().allRead], [true, false]);
});

test('Grade 2 lines carry English and Filipino', () => {
  assert.match(TEXT.grade2.locked(2, 6), /^📖 Read every card first \(2 of 6\) · Basahin/);
  assert.match(TEXT.grade2.done, / · Nabasa/);
  assert.equal(TEXT.grade5.locked(0, 8), '📖 Read every card to unlock the quiz (0 of 8 read)');
});

test('the note cheers more the closer she gets', () => {
  assert.match(TEXT.grade5.locked(1, 8), /Nice!/);
  assert.match(TEXT.grade5.locked(4, 8), /Over halfway!/);
  assert.match(TEXT.grade5.locked(7, 8), /Last one!/);
  assert.match(TEXT.grade2.locked(7, 8), /Last one! Huling card na!/);
});
