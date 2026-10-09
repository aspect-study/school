// Rewrites PRECACHE in web/sw.js from the files in web/, so new pages and lessons work offline.
// Run after adding, renaming or removing a file under web/: node tools/update-precache.js
// It also rewrites web/world/lesson-files.js (tools/lesson-files.js).
const fs = require('node:fs');
const path = require('node:path');

const lessonFiles = require('./lesson-files.js');

const WEB = path.join(__dirname, '..', 'web');
const SW = path.join(WEB, 'sw.js');

// The world's list of lesson files is written first, so it is precached too.
fs.writeFileSync(lessonFiles.OUT, lessonFiles.source());

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : [path.relative(WEB, path.join(dir, e.name)).split(path.sep).join('/')]);
}

const GROUPS = [/^index\.html$/, /^lobby\//, /^parent\//, /^engine\//, /^world\//, /^vendor\//, /^subjects\//, /^assets\//];
const group = (f) => {
  const i = GROUPS.findIndex((re) => re.test(f));
  return i < 0 ? GROUPS.length : i;
};

// The owner dashboard (web/admin) is for the owner's phone or PC only, never for the kids' tablets.
const files = walk(WEB).filter((f) => f !== 'sw.js' && !f.startsWith('admin/')).sort((a, b) => group(a) - group(b) || a.localeCompare(b));
const lines = files.map((f, i) => {
  const redirect = group(f) === GROUPS.length && (i === 0 || group(files[i - 1]) !== GROUPS.length);
  return (redirect ? '  // Redirect pages at the old URLs, so icons installed before 2026-10-02 still open offline.\n' : '') + "  '" + f + "',";
});

const sw = fs.readFileSync(SW, 'utf8');
const start = sw.indexOf('const PRECACHE = [');
const end = sw.indexOf('];', start) + 2;
fs.writeFileSync(SW, sw.slice(0, start) + 'const PRECACHE = [\n' + lines.join('\n') + '\n];' + sw.slice(end));
console.log('web/sw.js precaches ' + files.length + ' files');
