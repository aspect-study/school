const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile } = require('./paths.js');
const Bubbles = require(worldFile('bubbles.js'));

const measure = (s) => s.length * 10;

test('wrap keeps short words on one line', () => {
  assert.deepEqual(Bubbles.wrap(measure, 'Hello there!', 200, 2), ['Hello there!']);
});

test('wrap breaks at spaces and never makes more than the allowed lines', () => {
  const lines = Bubbles.wrap(measure, 'one two three four five six seven eight', 100, 2);
  assert.equal(lines.length, 2);
  assert.equal(Bubbles.fits(measure, 'one two three four five six seven eight', 100, 2), false);
});

test('wrap reports when the text does not fit', () => {
  assert.equal(Bubbles.fits(measure, 'one two three four five six seven eight', 100, 2), false);
  assert.equal(Bubbles.fits(measure, 'one two three four', 100, 2), true);
});
