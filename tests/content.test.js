const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { APPS, appFile } = require('./paths.js');
const { dataFiles, lessons } = require('./content.js');

const CONTENT_FILES = { 'strategy.js': 'strategy', 'type-it.js': 'typeIt', 'cases.js': 'cases', 'walkthroughs.js': 'walkthroughs' };

for (const app of APPS) {
  const dir = path.dirname(appFile(app.id));
  const html = fs.readFileSync(appFile(app.id), 'utf8');

  test(app.id + ': subject.json matches the page', () => {
    assert.equal(path.basename(dir), app.subject);
    assert.equal(path.basename(path.dirname(dir)), 'grade-' + app.grade);
    assert.ok(html.includes("SH_APP = '" + app.id + "', SH_TITLE = '" + app.title + "'"), 'SH_APP / SH_TITLE');
    assert.ok(html.includes("pointsKey: '" + app.pointsKey + "', progressKey: STORAGE_KEY"), 'pointsKey');
    assert.match(html, new RegExp("(const|var) STORAGE_KEY = '" + app.progressKey + "';"), 'progressKey');
  });

  test(app.id + ': every data file is loaded once, lessons in numbered order', () => {
    const loaded = dataFiles(app.id);
    assert.equal(new Set(loaded).size, loaded.length, 'a file is loaded twice');
    for (const rel of loaded) assert.ok(fs.existsSync(path.join(dir, rel)), rel + ' is loaded but missing');
    const lessonDir = path.join(dir, 'lessons');
    const onDisk = fs.existsSync(lessonDir) ? fs.readdirSync(lessonDir).sort() : [];
    const tagged = loaded.filter((f) => f.startsWith('lessons/')).map((f) => f.slice('lessons/'.length));
    assert.deepEqual(tagged, onDisk, 'lesson script tags must list every file in lessons/, in order');
    onDisk.forEach((f, i) => assert.match(f, new RegExp('^' + String(i + 1).padStart(2, '0') + '-[a-z0-9-]+\\.js$'), 'lesson files are numbered 01, 02, … with no gaps'));
    for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.js'))) {
      assert.ok(CONTENT_FILES[f], f + ' is not a known content file');
      assert.ok(loaded.includes(f), f + ' is not loaded by the page');
    }
    const lastData = Math.max(...loaded.map((f) => html.indexOf('<script src="' + f + '">')));
    assert.ok(lastData < html.indexOf('<script data-file-check>'), 'data files load before the file check');
    assert.ok(html.indexOf('<script src="' + loaded[0] + '">') > html.indexOf('/engine/study-kit.js'), 'data files load after study-kit.js');
  });

  test(app.id + ': each data file is plain data registered once through StudyKit', () => {
    for (const rel of dataFiles(app.id)) {
      const calls = { lesson: 0, content: [] };
      const sandbox = { StudyKit: { lesson() { calls.lesson++; }, content(name) { calls.content.push(name); } } };
      vm.runInNewContext(fs.readFileSync(path.join(dir, rel), 'utf8'), sandbox, { filename: rel });
      if (rel.startsWith('lessons/')) assert.deepEqual(calls, { lesson: 1, content: [] }, rel);
      else assert.deepEqual(calls, { lesson: 0, content: [CONTENT_FILES[rel]] }, rel);
    }
  });

  test(app.id + ': lesson ids are unique', () => {
    const ids = lessons(app.id).map((l) => l.id).filter(Boolean);
    assert.equal(new Set(ids).size, ids.length);
  });
}
