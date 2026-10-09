const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { web, VENDOR_FILES } = require('./paths.js');

function three() {
  const win = {};
  win.window = win;
  win.self = win;
  vm.createContext(win);
  for (const f of VENDOR_FILES) vm.runInContext(fs.readFileSync(web(f), 'utf8'), win);
  return win.THREE;
}

test('the vendored Three.js is r149 with a classic build', () => {
  assert.equal(three().REVISION, '149');
});

test('rounded-box.js adds a rounded box with the asked size', () => {
  const THREE = three();
  const g = new THREE.RoundedBoxGeometry(2, 1, 1, 2, 0.3);
  g.computeBoundingBox();
  const size = g.boundingBox.getSize(new THREE.Vector3());
  assert.ok(Math.abs(size.x - 2) < 1e-6 && Math.abs(size.y - 1) < 1e-6 && Math.abs(size.z - 1) < 1e-6, JSON.stringify(size));
  assert.equal(g.index, null);
  assert.ok(g.groups.length === 6, 'one group per face, so a face can have its own material');
});
