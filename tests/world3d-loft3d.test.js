const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile } = require('./paths.js');
const { fakeS } = require('./fake-stage.js');
const Layout = require(worldFile('layout.js'));
const Lo = require(worldFile('loft.js'));
const L3 = require(worldFile('loft3d.js'));

test('the loft builds for both grades, with a desk group per subject, and disposes cleanly', () => {
  ['grade5', 'grade2'].forEach((g) => {
    const S = fakeS();
    const desks = Lo.desks(Layout.APPS[g], { 'life-lab': { lessons: 1, exams: 0 } });
    const v = L3.create(S, { grade: g, desks });
    assert.equal(S.scene.children.length, 1, 'one group in the scene');
    assert.equal(v.deskCount(), desks.length);
    assert.equal(typeof v.see, 'function');
    assert.equal(typeof v.animate, 'function');
    assert.equal(v.hit({}), null);
    v.dispose();
    assert.equal(S.scene.children.length, 0, 'removed on dispose');
  });
});
