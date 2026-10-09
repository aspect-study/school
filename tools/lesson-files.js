// Builds web/world/lesson-files.js: each game's lesson scripts (in its page's order), title, points key and progress
// key, so the 3D world can load a subject's questions when she asks. update-precache.js writes it.
const fs = require('node:fs');
const path = require('node:path');

const WEB = path.join(__dirname, '..', 'web');
const OUT = path.join(WEB, 'world', 'lesson-files.js');

function collect() {
  const out = {};
  const base = path.join(WEB, 'subjects');
  for (const g of fs.readdirSync(base).sort()) {
    for (const s of fs.readdirSync(path.join(base, g)).sort()) {
      const dir = path.join(base, g, s);
      const json = path.join(dir, 'subject.json');
      if (!fs.existsSync(json)) continue;
      const meta = JSON.parse(fs.readFileSync(json, 'utf8'));
      const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
      const files = [...html.matchAll(/<script src="(lessons\/[^"]+\.js)"><\/script>/g)].map((m) => m[1]);
      if (!files.length) continue;
      out[meta.id] = { title: meta.title, pointsKey: meta.pointsKey, progressKey: meta.progressKey, dir: '../subjects/' + g + '/' + s + '/', files };
    }
  }
  return out;
}

function source() {
  return '/* Made by tools/update-precache.js; do not edit. Each game\'s lesson files, which the 3D world loads when she asks\n'
    + '   for review questions (ask.js). */\n'
    + '(function (root) {\n'
    + "  'use strict';\n"
    + '  var FILES = ' + JSON.stringify(collect(), null, 2).replace(/\n/g, '\n  ') + ';\n'
    + "  if (typeof module !== 'undefined' && module.exports) {\n"
    + '    module.exports = FILES;\n'
    + '    return;\n'
    + '  }\n'
    + '  root.World3D = root.World3D || {};\n'
    + '  root.World3D.LessonFiles = FILES;\n'
    + '})(this);\n';
}

module.exports = { collect, source, OUT };
