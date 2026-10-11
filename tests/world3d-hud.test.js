const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile } = require('./paths.js');
const H = require(worldFile('hud.js'));

test('the coin pill shows the whole balance, never below zero', () => {
  assert.equal(H.pills({ coins: 125, done: 0, total: 3, streak: 0 }).coins, '🪙 125');
  assert.equal(H.pills({ coins: 12.7, done: 0, total: 3, streak: 0 }).coins, '🪙 12');
  assert.equal(H.pills({ coins: -4, done: 0, total: 3, streak: 0 }).coins, '🪙 0');
  assert.equal(H.pills({ coins: undefined, done: 0, total: 3, streak: 0 }).coins, '🪙 0');
});

test('the quests pill shows done of total and the streak, no flame at 0', () => {
  assert.equal(H.pills({ coins: 0, done: 2, total: 3, streak: 4 }).quests, '🎯 2/3 🔥4');
  assert.equal(H.pills({ coins: 0, done: 0, total: 3, streak: 0 }).quests, '🎯 0/3');
  assert.equal(H.pills({ coins: 0, done: 0, total: 0, streak: 2 }).quests, '🎯 🔥2', 'no quests yet');
});

test('the zoom box shows only when zooming is allowed and the device is not touch', () => {
  assert.equal(H.zoomShown(true, false), true);
  assert.equal(H.zoomShown(true, true), false, 'touch: she pinches');
  assert.equal(H.zoomShown(false, false), false, 'a card is open');
  assert.equal(H.zoomShown(false, true), false);
});
