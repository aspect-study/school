// Review keys exactly as each game builds them: the game's own decode / historyQuestion / reviewInfo, cut out of its
// page and run in Node. Used by tests and by tools/review-keys.js.
const fs = require('node:fs');
const vm = require('node:vm');
const { appFile, engineFile } = require('./paths.js');
const { keyOf } = require(engineFile('recall.js'));

// Stands in for Recall.textOf (the browser's innerHTML → textContent). NAMED covers every entity the lessons use; an
// unknown one throws, since guessing would give a key the browser never makes.
const NAMED = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0',
  ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’', mdash: '—', ndash: '–', minus: '−', hellip: '…', middot: '·', bull: '•',
  rarr: '→', larr: '←', uarr: '↑', darr: '↓', harr: '↔', times: '×', divide: '÷', deg: '°', sup3: '³', ne: '≠',
  check: '✓', uuml: 'ü', ntilde: 'ñ', Ntilde: 'Ñ',
};
function decode(m, hex, dec, name) {
  if (hex) return String.fromCodePoint(parseInt(hex, 16));
  if (dec) return String.fromCodePoint(Number(dec));
  if (!Object.prototype.hasOwnProperty.call(NAMED, name)) throw new Error('textOf: unknown entity &' + name + '; (add it to NAMED)');
  return NAMED[name];
}
const textOf = (s) => String(s == null ? '' : s).replace(/<[^>]*>/g, '')
  .replace(/&(?:#x([0-9a-f]+)|#(\d+)|([a-z][a-z0-9]*));/gi, decode);

// Cuts `function name(...) { ... }` out of a page by counting braces.
function extract(html, name) {
  const start = html.indexOf('function ' + name + '(');
  let i = html.indexOf('{', start);
  for (let depth = 0; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}' && --depth === 0) break;
  }
  return html.slice(start, i + 1);
}

const cache = new Map();
function gameReviewInfo(id) {
  if (!cache.has(id)) {
    const html = fs.readFileSync(appFile(id), 'utf8');
    if (!html.includes('function reviewInfo(')) throw new Error(id + ' has no reviewInfo');
    const tf = html.match(/SH_TRUE = '([^']*)', SH_FALSE = '([^']*)'/);
    const names = ['decode', 'historyQuestion', 'reviewInfo'].filter((n) => html.includes('function ' + n + '('));
    names.forEach((n) => { if (html.split('function ' + n + '(').length !== 2) throw new Error(id + ' has more than one ' + n); });
    const src = names.map((n) => extract(html, n)).join('\n');
    const ctx = vm.createContext({ Recall: { textOf }, SH_TRUE: tf ? tf[1] : 'True', SH_FALSE: tf ? tf[2] : 'False' });
    cache.set(id, vm.runInContext(src + '\nreviewInfo', ctx));
  }
  return cache.get(id);
}

const gameKey = (id, item) => keyOf(id, gameReviewInfo(id)(item));
const hashOf = (key) => key.slice(key.indexOf('|') + 1);

module.exports = { textOf, extract, gameReviewInfo, gameKey, hashOf };
