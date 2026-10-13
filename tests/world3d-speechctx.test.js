const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile } = require('./paths.js');
const Ctx = require(worldFile('speechctx.js'));
const Speech = require(worldFile('speech.js'));

const BASE = { hour: 9, her: { x: 0, z: 0 }, spots: [], wear: {}, itemName: (id) => id.toUpperCase(), petSpecies: '', petName: '', streak: 0, fav: [] };

test('time of day follows the hour', () => {
  const at = (h) => Ctx.build(Object.assign({}, BASE, { hour: h })).tags.filter((t) => t.startsWith('time:'))[0];
  assert.equal(at(5), 'time:morning');
  assert.equal(at(11), 'time:morning');
  assert.equal(at(12), 'time:afternoon');
  assert.equal(at(17), 'time:evening');
  assert.equal(at(21), 'time:night');
  assert.equal(at(3), 'time:night');
});

test('near: a spot counts when she is inside its radius', () => {
  const spots = [{ tag: 'near:slide', x: 10, z: 0, r: 8 }, { tag: 'near:fort', x: 100, z: 0, r: 8 }];
  const c = Ctx.build(Object.assign({}, BASE, { spots, her: { x: 5, z: 0 } }));
  assert.ok(c.tags.includes('near:slide'));
  assert.ok(!c.tags.includes('near:fort'));
});

test('wearing: each worn slot gives a tag and a slot with the item name', () => {
  const c = Ctx.build(Object.assign({}, BASE, { wear: { hat: 'cap', glasses: '' } }));
  assert.ok(c.tags.includes('wearing:hat'));
  assert.ok(!c.tags.includes('wearing:glasses'));
  assert.equal(c.slots.hat, 'CAP');
});

test('pet, streak and favourites', () => {
  const c = Ctx.build(Object.assign({}, BASE, { petSpecies: 'fox', petName: 'Kidlat', streak: 4, fav: [{ q: 'color', choice: 1, label: '💙 Blue' }] }));
  assert.ok(c.tags.includes('pet:fox'));
  assert.equal(c.slots.pet, 'Kidlat');
  assert.ok(c.tags.includes('streak:3'));
  assert.ok(!c.tags.includes('streak:7'));
  assert.equal(c.slots.streak, '4');
  assert.ok(c.tags.includes('fav:color:1'));
  assert.equal(c.slots.fav_color, 'Blue');
});

test('every tag and slot it builds is one the picker knows', () => {
  const c = Ctx.build(Object.assign({}, BASE, {
    wear: { hat: 'a', glasses: 'b', neck: 'c', back: 'd' }, petSpecies: 'fox', petName: 'K', streak: 9, afterRide: true, tired: true,
    spots: [{ tag: 'near:slide', x: 0, z: 0, r: 1 }], fav: [{ q: 'fruit', choice: 0, label: 'Mango' }]
  }));
  c.tags.forEach((t) => assert.ok(Speech.validTag(t), t));
  Object.keys(c.slots).forEach((s) => assert.ok(Speech.validSlot(s), s));
});
