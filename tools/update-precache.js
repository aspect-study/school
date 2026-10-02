// Rewrites PRECACHE in web/sw.js from the files in web/, so new pages and lessons work offline.
// Run after adding, renaming or removing a file under web/: node tools/update-precache.js
const fs = require('node:fs');
const path = require('node:path');

const WEB = path.join(__dirname, '..', 'web');
const SW = path.join(WEB, 'sw.js');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : [path.relative(WEB, path.join(dir, e.name)).split(path.sep).join('/')]);
}

const GROUPS = [/^index\.html$/, /^lobby\//, /^parent\//, /^engine\//, /^subjects\//, /^assets\//];
const group = (f) => {
  const i = GROUPS.findIndex((re) => re.test(f));
  return i < 0 ? GROUPS.length : i;
};

const files = walk(WEB).filter((f) => f !== 'sw.js').sort((a, b) => group(a) - group(b) || a.localeCompare(b));
const lines = files.map((f, i) => {
  const redirect = group(f) === GROUPS.length && (i === 0 || group(files[i - 1]) !== GROUPS.length);
  return (redirect ? '  // Redirect pages at the old URLs, so icons installed before 2026-10-02 still open offline.\n' : '') + "  '" + f + "',";
});

const sw = fs.readFileSync(SW, 'utf8');
const start = sw.indexOf('const PRECACHE = [');
const end = sw.indexOf('];', start) + 2;
fs.writeFileSync(SW, sw.slice(0, start) + 'const PRECACHE = [\n' + lines.join('\n') + '\n];' + sw.slice(end));
console.log('web/sw.js precaches ' + files.length + ' files');
