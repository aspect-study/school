const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { engineFile } = require('./paths.js');

const panel = fs.readFileSync(engineFile('parent-panel.js'), 'utf8');

test('the Parent panel backs up and restores what she owns from the wardrobe', () => {
  const keys = panel.match(/var keys = \[([^\]]+)\];/);
  assert.ok(keys && keys[1].includes("'wardrobe_v1'"), 'savedState() lists wardrobe_v1');
});

test('the Parent panel says where a wardrobe purchase came from', () => {
  assert.ok(panel.includes("e.via === 'wardrobe' ? ' · from the wardrobe boutique'"));
});

test('the Parent panel says when a purchase came from the pet stall', () => {
  assert.ok(panel.includes("e.via === 'pets' ? ' · from the pet stall'"));
});

test('the Parent panel says when a purchase came from the toy stall', () => {
  assert.ok(panel.includes("e.via === 'toys' ? ' · from the toy stall'"));
});

test('the Parent panel backs up My Little House and says when a purchase came from Tito Tasyo', () => {
  const keys = panel.match(/var keys = \[([^\]]+)\];/);
  assert.ok(keys && keys[1].includes("'house_v1'"), 'savedState() lists house_v1');
  assert.ok(panel.includes(`e.via === 'house' ? " · from Tito Tasyo's workshop"`));
});
