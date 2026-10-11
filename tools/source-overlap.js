// Lists lesson text that copies a source in sources/ (see docs/lesson-writing.md).
//   node tools/source-overlap.js                 every game
//   node tools/source-overlap.js <game dir>      one game
//   node tools/source-overlap.js <file> ...      only these data files
// Exit code 1 when anything is found, 2 when a directory holds no lesson files.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { buildIndex, findHits, normalize } = require('./overlap-core.js');
const { APPS, web } = require('../tests/paths.js');
const { dataFiles } = require('../tests/content.js');

const SKIP = new Set(['icon', 'id', 'emoji', 'pic', 'art', 'was']);

function fileData(file) {
  const lessons = [], content = {};
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), {
    StudyKit: { lesson: (l) => lessons.push(l), content: (n, v) => { if (v !== undefined) content[n] = v; return content[n]; } },
  }, { filename: file });
  return { lessons, content };
}

function strings(value, where, out) {
  if (typeof value === 'string') out.push({ where, text: value });
  else if (Array.isArray(value)) value.forEach((v, i) => strings(v, where + '[' + i + ']', out));
  else if (value && typeof value === 'object') {
    for (const k of Object.keys(value)) if (!SKIP.has(k)) strings(value[k], where ? where + '.' + k : k, out);
  }
  return out;
}

// The string literals of 4 or more words in a page's inline scripts (Math Mastery keeps its lessons there).
// A template's ${...} parts become a space. Comments and regex literals are skipped.
function scriptLiterals(html) {
  const out = [];
  const lineAt = (i) => html.slice(0, i).split('\n').length;
  for (const m of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)) {
    const code = m[1], base = m.index + m[0].indexOf('>') + 1;
    let i = 0;
    while (i < code.length) {
      const c = code[i];
      if (c === '/' && code[i + 1] === '/') i = code.indexOf('\n', i) < 0 ? code.length : code.indexOf('\n', i);
      else if (c === '/' && code[i + 1] === '*') i = code.indexOf('*/', i + 2) + 2 || code.length;
      else if (c === '/' && /[(,=:[!&|?{};]/.test(code.slice(0, i).trimEnd().slice(-1))) {
        let inClass = false;
        for (i++; i < code.length && (inClass || code[i] !== '/'); i++) {
          if (code[i] === '\\') i++;
          else if (code[i] === '[') inClass = true;
          else if (code[i] === ']') inClass = false;
        }
        i++;
      } else if (c === '\'' || c === '"' || c === '`') {
        const start = i;
        let text = '';
        for (i++; i < code.length && code[i] !== c; i++) {
          if (code[i] === '\\') text += code[++i];
          else if (c === '`' && code[i] === '$' && code[i + 1] === '{') {
            for (let depth = 0; i < code.length; i++) {
              if (code[i] === '{') depth++;
              else if (code[i] === '}' && --depth === 0) break;
            }
            text += ' ';
          } else text += code[i];
        }
        i++;
        if (text.trim().split(/\s+/).length >= 4) out.push({ line: lineAt(base + start), text });
      } else i++;
    }
  }
  return out;
}

const sameCase = (p) => (process.platform === 'win32' ? p.toLowerCase() : p);

function targets(args) {
  const all = APPS.flatMap((a) => {
    const dir = path.dirname(web(a.page)), rels = dataFiles(a.id);
    const files = rels.map((rel) => path.join(dir, rel));
    return rels.some((rel) => rel.startsWith('lessons/')) ? files : files.concat(web(a.page));
  });
  if (!args.length) return all;
  return args.flatMap((a) => {
    const abs = path.resolve(a);
    if (!fs.statSync(abs).isDirectory()) return [abs];
    const found = all.filter((f) => sameCase(f).startsWith(sameCase(abs + path.sep)));
    if (!found.length) {
      console.error(a + ' holds no lesson files (expected a game folder under web/subjects).');
      process.exit(2);
    }
    return found;
  });
}

function textsOf(file) {
  if (file.endsWith('.html')) {
    return scriptLiterals(fs.readFileSync(file, 'utf8')).map((s) => ({ where: 'index.html:' + s.line, text: s.text }));
  }
  const { lessons, content } = fileData(file);
  return strings(lessons.length === 1 ? lessons[0] : lessons, '', []).concat(strings(content, 'content', []));
}

function main(args) {
  const files = targets(args);
  const { docs, notChecked } = require('./source-text.js').loadSources();
  const index = buildIndex(docs);
  const allow = fs.readFileSync(path.join(__dirname, 'overlap-allow.txt'), 'utf8').split(/\r?\n/)
    .filter((l) => l.trim() && !l.trim().startsWith('#')).map(normalize);
  const perGame = new Map();
  let total = 0;
  for (const file of files) {
    const rel = path.relative(web(''), file).split(path.sep).join('/');
    const lines = [];
    for (const s of textsOf(file)) {
      for (const h of findHits(s.text, index, allow)) lines.push('  ' + s.where + '  [' + h.kind + '] "' + h.words + '"  ← ' + h.source);
    }
    if (!lines.length) continue;
    console.log(rel);
    lines.forEach((l) => console.log(l));
    const game = rel.split('/').slice(0, 3).join('/');
    perGame.set(game, (perGame.get(game) || 0) + lines.length);
    total += lines.length;
  }
  console.log('\nHits per game:');
  [...perGame].sort((a, b) => b[1] - a[1]).forEach(([g, n]) => console.log('  ' + n + '  ' + g));
  console.log('Total: ' + total);
  console.log('\nNot checked (' + notChecked.length + '):');
  notChecked.forEach((n) => console.log('  ' + n.name + ' (' + n.why + ')'));
  return total ? 1 : 0;
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));

module.exports = { scriptLiterals };
