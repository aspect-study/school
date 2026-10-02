// Reads a subject's data files the way the browser does: through StudyKit, in the order the page's script tags load them.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { appFile, engineFile } = require('./paths.js');
const { library } = require(engineFile('study-kit.js'));

// The page's own (non-engine) script files, e.g. lessons/01-myself.js, strategy.js.
function dataFiles(id) {
  const html = fs.readFileSync(appFile(id), 'utf8');
  return [...html.matchAll(/<script src="([^"./][^"]*\.js)"><\/script>/g)].map((m) => m[1]);
}

const loaded = new Map();
function load(id) {
  if (!loaded.has(id)) {
    const lib = library();
    const dir = path.dirname(appFile(id));
    for (const rel of dataFiles(id)) {
      const file = path.join(dir, rel);
      vm.runInNewContext(fs.readFileSync(file, 'utf8'), { StudyKit: { lesson: lib.lesson, content: lib.content } }, { filename: file });
    }
    loaded.set(id, lib);
  }
  return loaded.get(id);
}

module.exports = {
  dataFiles,
  lessons: (id) => load(id).lessons(),
  content: (id, key) => load(id).content(key),
};
