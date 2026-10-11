// Finds lesson text that copies a source: a shared run of RUN words, or a whole sentence of SENTENCE or more words.
const RUN = 7;
const SENTENCE = 4;

const NAMED = { ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’', mdash: '—', ndash: '–', minus: '−', hellip: '…', middot: '·', lt: '<', gt: '>', quot: '"', apos: "'", rarr: '→', nbsp: ' ', amp: '&', times: '×', divide: '÷', deg: '°', ntilde: 'ñ', Ntilde: 'Ñ', eacute: 'é', aacute: 'á', iacute: 'í', oacute: 'ó', uacute: 'ú' };

function plainText(s) {
  return String(s == null ? '' : s)
    .replace(/<br\s*\/?>|<\/(p|div|li|h\d|tr)>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (m, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z0-9]+);/gi, (m, n) => (n in NAMED ? NAMED[n] : ' '));
}

function normalize(s) {
  return plainText(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/['’‘`]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

const words = (s) => normalize(s).split(' ').filter(Boolean);

function sentencesOf(s) {
  return plainText(s).split(/[.!?;:]+(?=\s|$)|\n+/).map(normalize).filter((x) => x.split(' ').length >= SENTENCE);
}

// Two 32-bit FNV-style hashes folded into one exact JS number (53 bits), so millions of runs fit in memory.
function h53(str) {
  let a = 0x811c9dc5, b = 0x9747b28c;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b ^ c, 0x5bd1e995) >>> 0;
  }
  return (b & 0x1fffff) * 4294967296 + a;
}

function buildIndex(sources) {
  const runs = new Map(), sentences = new Map(), names = [];
  sources.forEach((s, n) => {
    names.push(s.name);
    const w = words(s.text);
    for (let i = 0; i + RUN <= w.length; i++) {
      const k = h53(w.slice(i, i + RUN).join(' '));
      if (!runs.has(k)) runs.set(k, n);
    }
    for (const x of sentencesOf(s.text)) {
      const k = h53(x);
      if (!sentences.has(k)) sentences.set(k, n);
    }
  });
  return { runs, sentences, names };
}

function findHits(text, index, allow) {
  const allowed = (w) => allow.some((a) => (' ' + a + ' ').includes(' ' + w + ' '));
  const w = words(text), spans = [];
  let span = null;
  for (let i = 0; i + RUN <= w.length; i++) {
    const src = index.runs.get(h53(w.slice(i, i + RUN).join(' ')));
    if (src === undefined) continue;
    if (span && i <= span.end) { span.end = i + RUN; continue; }
    if (span) spans.push(span);
    span = { start: i, end: i + RUN, source: src };
  }
  if (span) spans.push(span);
  const hits = spans.map((s) => ({ kind: 'run', words: w.slice(s.start, s.end).join(' '), source: index.names[s.source] }));
  for (const x of sentencesOf(text)) {
    const src = index.sentences.get(h53(x));
    if (src === undefined || hits.some((h) => (' ' + h.words + ' ').includes(' ' + x + ' '))) continue;
    hits.push({ kind: 'sentence', words: x, source: index.names[src] });
  }
  return hits.filter((h) => !allowed(h.words));
}

module.exports = { RUN, SENTENCE, plainText, normalize, sentencesOf, h53, buildIndex, findHits };
