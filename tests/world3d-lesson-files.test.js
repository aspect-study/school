const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ROOT, app, appFile, worldFile } = require('./paths.js');
const { dataFiles } = require('./content.js');
const Q = require(worldFile('quiz.js'));
const gen = require(path.join(ROOT, 'tools', 'lesson-files.js'));

test('web/world/lesson-files.js is up to date (run node tools/update-precache.js)', () => {
  assert.equal(fs.readFileSync(worldFile('lesson-files.js'), 'utf8').replace(/\r\n/g, '\n'), gen.source());
});

test('every game the world asks from lists its lesson files in page order, with its own keys', () => {
  const FILES = require(worldFile('lesson-files.js'));
  for (const id of Object.keys(Q.SHAPES)) {
    const f = FILES[id];
    const a = app(id);
    assert.ok(f, id);
    assert.equal(f.dir, '../' + path.posix.dirname(a.page) + '/', id + ' dir');
    assert.deepEqual(f.files, dataFiles(id).filter((x) => x.startsWith('lessons/')), id + ' files');
    assert.deepEqual([f.title, f.pointsKey, f.progressKey], [a.title, a.pointsKey, a.progressKey], id + ' keys');
    for (const file of f.files) assert.ok(fs.existsSync(path.join(path.dirname(appFile(id)), file)), file);
  }
});
