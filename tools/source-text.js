// The text of every file in sources/: pdf (pdftotext), pptx and docx (their XML), zip (the files inside), md, txt and
// saved Google Forms pages. Cached per file in sources/.text/, rebuilt when the file's size or time or VERSION changes.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { unzip } = require('./unzip.js');
const { normalize } = require('./overlap-core.js');

const SOURCES = path.join(__dirname, '..', 'sources');
const CACHE = path.join(SOURCES, '.text');
const MAX_BYTES = 1.5e9;
const LITTLE = 20;
// Bump whenever extraction changes, so every cached entry is read again.
const VERSION = 2;
const NO_PDFTOTEXT = 'pdftotext not found';

let pdftotext;
function findPdftotext() {
  if (pdftotext !== undefined) return pdftotext;
  pdftotext = null;
  for (const c of ['pdftotext', 'C:\\Program Files\\Git\\mingw64\\bin\\pdftotext.exe']) {
    try { execFileSync(c, ['-v'], { stdio: 'ignore' }); pdftotext = c; break; }
    catch (e) { if (e.code !== 'ENOENT') { pdftotext = c; break; } }
  }
  return pdftotext;
}

// Reading order runs side-by-side boxes together and -layout keeps them apart; each finds copies the other misses.
function pdfText(buf) {
  const exe = findPdftotext();
  if (!exe) throw new Error(NO_PDFTOTEXT + ' (it comes with Git for Windows)');
  const tmp = path.join(os.tmpdir(), 'overlap-' + process.pid + '.pdf');
  fs.writeFileSync(tmp, buf);
  const run = (mode) => {
    try {
      return execFileSync(exe, mode.concat(['-enc', 'UTF-8', tmp, '-']),
        { maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }).toString('utf8');
    } catch (e) {
      throw new Error(String(e.stderr || e.message).trim().split(/\r?\n/)[0]);
    }
  };
  try { return run([]) + '\n\n' + run(['-layout']); }
  finally { fs.rmSync(tmp, { force: true }); }
}

// Line breaks and tabs become a space, so the words on either side stay apart.
function xmlText(xml, para, run) {
  const spaced = xml.replace(/<[aw]:(br|tab|cr)\b[^>]*?(\/>|>[\s\S]*?<\/[aw]:\1>)/g, '<' + run + '> </' + run + '>');
  const runRe = new RegExp('<' + run + '(?:\\s[^>]*)?>([^<]*)</' + run + '>', 'g');
  return spaced.split('</' + para + '>').map((p) => [...p.matchAll(runRe)].map((m) => m[1]).join('')).filter(Boolean).join('\n');
}

// Slides, then speaker notes, then SmartArt text.
function slides(buf) {
  const entries = unzip(buf);
  const number = (e) => Number(e.name.match(/(\d+)\.xml$/)[1]);
  const part = (re) => entries.filter((e) => re.test(e.name)).sort((a, b) => number(a) - number(b))
    .map((e) => xmlText(e.data().toString('utf8'), 'a:p', 'a:t'));
  return [/^ppt\/slides\/slide\d+\.xml$/, /^ppt\/notesSlides\/notesSlide\d+\.xml$/, /^ppt\/diagrams\/data\d+\.xml$/]
    .flatMap(part).join('\n');
}

function docx(buf) {
  const doc = unzip(buf).find((e) => e.name === 'word/document.xml');
  return doc ? xmlText(doc.data().toString('utf8'), 'w:p', 'w:t') : '';
}

// Google Forms keep their questions in a script as JSON strings; decode the escapes and keep the script text.
function html(text) {
  return text.replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/\\u([0-9a-f]{4})/gi, (m, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\n/g, '\n').replace(/\\"/g, '"');
}

// [{ name, text }] for one file; a zip gives one entry per text file inside it, with `error` set on one that could not
// be read. null: not a text format.
function docsOf(name, buf) {
  const ext = path.extname(name).toLowerCase();
  if (ext === '.pdf') return [{ name, text: pdfText(buf) }];
  if (ext === '.pptx') return [{ name, text: slides(buf) }];
  if (ext === '.docx') return [{ name, text: docx(buf) }];
  if (ext === '.md' || ext === '.txt') return [{ name, text: buf.toString('utf8') }];
  if (ext === '.html' || ext === '.htm') return [{ name, text: html(buf.toString('utf8')) }];
  if (ext === '.zip') {
    const out = [];
    for (const e of unzip(buf)) {
      const inner = name + '!' + e.name;
      try { out.push(...(docsOf(inner, e.data()) || [])); }
      catch (err) { out.push({ name: inner, text: '', error: err.message }); }
    }
    return out;
  }
  return null;
}

function walk(dir, out) {
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, d.name);
    if (d.isDirectory()) { if (!d.name.startsWith('.') && !d.name.endsWith('_files')) walk(full, out); }
    else out.push(full);
  }
  return out;
}

// { docs: [{ name, text }], notChecked: [{ name, why }] }, names relative to sources/.
function loadSources() {
  if (!fs.existsSync(SOURCES)) throw new Error('No sources/ folder: this tool runs on the owner\'s PC only.');
  fs.mkdirSync(CACHE, { recursive: true });
  const docs = [], notChecked = [];
  for (const full of walk(SOURCES, [])) {
    const rel = path.relative(SOURCES, full).split(path.sep).join('/');
    const stat = fs.statSync(full);
    const cacheFile = path.join(CACHE, crypto.createHash('sha1').update(rel).digest('hex') + '.json');
    let entry = null;
    try { entry = JSON.parse(fs.readFileSync(cacheFile, 'utf8')); } catch (e) {}
    if (!entry || entry.version !== VERSION || entry.size !== stat.size || entry.mtimeMs !== stat.mtimeMs) {
      entry = { version: VERSION, rel, size: stat.size, mtimeMs: stat.mtimeMs, docs: null, why: null };
      if (stat.size > MAX_BYTES) entry.why = 'too big to read';
      else {
        try { entry.docs = docsOf(rel, fs.readFileSync(full)); if (!entry.docs) entry.why = 'not a text format'; }
        catch (e) { entry.why = 'could not read: ' + e.message; }
      }
      // A damaged file stays cached with its reason; a missing pdftotext is tried again next run.
      const noTool = (msg) => String(msg).includes(NO_PDFTOTEXT);
      const retry = entry.docs ? entry.docs.some((d) => d.error && noTool(d.error)) : noTool(entry.why);
      if (retry) fs.rmSync(cacheFile, { force: true });
      else fs.writeFileSync(cacheFile, JSON.stringify(entry));
    }
    if (!entry.docs) { notChecked.push({ name: rel, why: entry.why }); continue; }
    for (const d of entry.docs) {
      if (d.error) { notChecked.push({ name: d.name, why: 'could not read: ' + d.error }); continue; }
      docs.push(d);
      if (normalize(d.text).split(' ').length < LITTLE) notChecked.push({ name: d.name, why: 'little or no text (pictures?)' });
    }
  }
  return { docs, notChecked };
}

module.exports = { loadSources, docsOf, xmlText };
