const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile } = require('./paths.js');
const { fakeS } = require('./fake-stage.js');
const Up = require(worldFile('upstairs.js'));
const U3 = require(worldFile('upstairs3d.js'));

test('stairs and a balcony per building for both grades, dimmed where Term 2 is not ready, disposed cleanly', () => {
  ['grade5', 'grade2'].forEach((g) => {
    const S = fakeS();
    const list = Up.all(g, { 'history-explorers': { lessons: 9, exams: 0, ids: [] } });
    const v = U3.create(S, { floors: list, term1: '📘 Term 1', term2: '🌟 Term 2' });
    assert.equal(S.scene.children.length, 1, 'one group in the scene');
    assert.equal(v.count(), list.length);
    assert.deepEqual(v.dimmed().sort(), list.filter((i) => !i.ready).map((i) => i.app).sort());
    v.dispose();
    assert.equal(S.scene.children.length, 0, 'removed on dispose');
  });
});
