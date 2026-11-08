// Builds web/world/lesson-files.js: each game's lesson scripts (in its page's order), title, points key and progress
// key, so the 3D world can load a subject's questions when she asks. update-precache.js writes it.
// It also builds web/world/term-lessons.js: each game's Term 2 lesson and exam counts.
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

const TERM_OUT = path.join(WEB, 'world', 'term-lessons.js');

// The top-level {...} objects of a page's inline ALL_LESSONS array (Math Mastery), skipping braces inside quotes and
// comments.
function inlineLessons(html) {
  const at = html.indexOf('ALL_LESSONS = [');
  if (at < 0) return [];
  const out = [];
  let brackets = 0, braces = 0, start = -1;
  for (let i = html.indexOf('[', at); i < html.length; i++) {
    const c = html[i];
    if (c === '"' || c === "'" || c === '`') {
      for (i++; i < html.length && html[i] !== c; i++) if (html[i] === '\\') i++;
    } else if (c === '/' && html[i + 1] === '/') {
      i = html.indexOf('\n', i);
      if (i < 0) break;
    } else if (c === '/' && html[i + 1] === '*') {
      i = html.indexOf('*/', i + 2) + 1;
      if (i < 1) break;
    } else if (c === '[') brackets++;
    else if (c === ']' && --brackets === 0) break;
    else if (c === '{' && braces++ === 0 && brackets === 1) start = i;
    else if (c === '}' && --braces === 0 && start >= 0) { out.push(html.slice(start, i + 1)); start = -1; }
  }
  return out;
}

const ENTITIES = { amp: '&', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', middot: '·', mdash: '—', ndash: '–', nbsp: ' ' };

function plainTitle(src) {
  const m = src.match(/^\s*title:\s*'((?:[^'\\]|\\.)*)'/m);
  if (!m) throw new Error('a Term 2 lesson needs an id or a title');
  return m[1].replace(/<[^>]*>/g, '').replace(/&(\w+);/g, (e, n) => (n in ENTITIES ? ENTITIES[n] : e));
}

// How many Term 2 lessons (and exam-only Term 2 lessons) each game has, and their ids, for the upper floors.
function termCounts(base = path.join(WEB, 'subjects')) {
  const out = {};
  for (const g of fs.readdirSync(base).sort()) {
    for (const s of fs.readdirSync(path.join(base, g)).sort()) {
      const dir = path.join(base, g, s);
      const json = path.join(dir, 'subject.json');
      if (!fs.existsSync(json)) continue;
      const id = JSON.parse(fs.readFileSync(json, 'utf8')).id;
      const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
      const files = [...html.matchAll(/<script src="(lessons\/[^"]+\.js)"><\/script>/g)].map((m) => m[1]);
      let lessons = 0, exams = 0;
      const ids = [];
      const take = (src, idRe) => {
        const m = src.match(idRe);
        if (m) ids.push(m[1]);
      };
      if (files.length) {
        for (const f of files) {
          const src = fs.readFileSync(path.join(dir, f), 'utf8');
          if (!/^\s*term:\s*2,?\s*$/m.test(src)) continue;
          if (/^\s*exam:\s*true,?\s*$/m.test(src)) exams++;
          else lessons++;
          // Grade 2 lessons have no id: their games key a lesson by its plain title (Recall.textOf).
          if (/^\s*id:/m.test(src)) take(src, /^\s*id:\s*['"]([^'"]+)['"]/m);
          else ids.push(plainTitle(src));
        }
      } else {
        for (const l of inlineLessons(html)) {
          if (!/\bterm:\s*2\s*[,}\n]/.test(l)) continue;
          if (/\bexam:\s*true\b/.test(l)) exams++;
          else lessons++;
          take(l, /\bid:\s*['"]([^'"]+)['"]/);
        }
      }
      out[id] = { lessons, exams, ids };
    }
  }
  return out;
}

function termSource() {
  return '/* Made by tools/update-precache.js; do not edit. Each game\'s Term 2 lessons: how many (exams = summative\n'
    + '   practice lessons) and their ids, which the upper floors use (upstairs.js). */\n'
    + '(function (root) {\n'
    + "  'use strict';\n"
    + '  var TERMS = ' + JSON.stringify(termCounts(), null, 2).replace(/\n/g, '\n  ') + ';\n'
    + "  if (typeof module !== 'undefined' && module.exports) {\n"
    + '    module.exports = TERMS;\n'
    + '    return;\n'
    + '  }\n'
    + '  root.World3D = root.World3D || {};\n'
    + '  root.World3D.TermLessons = TERMS;\n'
    + '})(this);\n';
}

module.exports = { collect, source, OUT, termCounts, termSource, TERM_OUT, inlineLessons };
