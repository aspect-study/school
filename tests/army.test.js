const test = require('node:test');
const assert = require('node:assert/strict');
const { engineFile } = require('./paths.js');
const { model, step } = require(engineFile('army.js'));

test('one minion per question; right pops it, wrong leaves it standing; the next one steps up', () => {
  const m = model(3);
  assert.deepEqual(m, { minions: ['up', 'up', 'up'], next: 0 });
  assert.equal(step(m, true), 0);
  assert.equal(step(m, false), 1);
  assert.equal(step(m, true), 2);
  assert.deepEqual(m.minions, ['popped', 'stayed', 'popped']);
  assert.equal(step(m, true), -1, 'no minions left: nothing happens');
});

test('the count follows the stage size', () => {
  assert.equal(model(9).minions.length, 9, 'a Math stage can be bigger');
  assert.equal(model(2).minions.length, 2, 'a short pool has fewer');
  assert.equal(model(0).minions.length, 0);
});
