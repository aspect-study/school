const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const zlib = require('node:zlib');
const { ROOT } = require('./paths.js');
const O = require(path.join(ROOT, 'tools', 'overlap-core.js'));
const { unzip } = require(path.join(ROOT, 'tools', 'unzip.js'));

const SOURCE = 'Matter is anything that has mass and takes up space. Plants need sunlight to grow.\n'
  + 'The Batas Pambansa is a law made by the Batasang Pambansa during that time.';
const index = O.buildIndex([{ name: 'deck.pdf', text: SOURCE }]);

test('normalize drops tags, entities, accents, case and punctuation', () => {
  assert.equal(O.normalize('Earth&rsquo;s <b>pull</b> of GRAVITY!'), 'earths pull of gravity');
  assert.equal(O.normalize('Paaralán — “tahanan”'), 'paaralan tahanan');
});

test('the thresholds are 7-word runs and 4-word sentences', () => {
  assert.equal(O.RUN, 7);
  assert.equal(O.SENTENCE, 4);
});

test('a copied run of 7 words inside a new sentence is a hit', () => {
  const hits = O.findHits('Kuya Pilo says matter is anything that has mass and takes up room.', index, []);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].kind, 'run');
  assert.equal(hits[0].words, 'matter is anything that has mass and takes up');
  assert.equal(hits[0].source, 'deck.pdf');
});

test('a shared run of 6 words is not a hit', () => {
  assert.deepEqual(O.findHits('Lola Lana knows anything that has mass and weight.', index, []), []);
});

test('a long copy is one hit, not one per window', () => {
  const hits = O.findHits('The Batas Pambansa is a law made by the Batasang Pambansa during that time.', index, []);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].words, 'the batas pambansa is a law made by the batasang pambansa during that time');
});

test('a whole sentence of 4 or more words copied is a hit; 3 words is not', () => {
  const hits = O.findHits('Yes. Plants need sunlight to grow!', index, []);
  assert.deepEqual(hits.map((h) => [h.kind, h.words]), [['sentence', 'plants need sunlight to grow']]);
  const short = O.buildIndex([{ name: 'x', text: 'Plants need sun.' }]);
  assert.deepEqual(O.findHits('Plants need sun.', short, []), []);
});

test('an allowed phrase is not a hit', () => {
  const allow = ['the batas pambansa is a law made by the batasang pambansa during that time'];
  assert.deepEqual(O.findHits('The Batas Pambansa is a law made by the Batasang Pambansa during that time.', index, allow), []);
});

test('a fresh rewrite with the same facts and terms has no hits', () => {
  const fresh = 'Mang Kiko says the chair, the air and the water are all matter: each has mass and fills a space. '
    + 'Sunlight helps plants grow, Tito Tasyo reminds us.';
  assert.deepEqual(O.findHits(fresh, index, []), []);
});

function makeZip(files) {
  const locals = [], centrals = [];
  let offset = 0;
  for (const f of files) {
    const name = Buffer.from(f.name), raw = Buffer.from(f.text);
    const data = f.deflate ? zlib.deflateRawSync(raw) : raw;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(f.deflate ? 8 : 0, 8);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0x800, 8);
    central.writeUInt16LE(f.deflate ? 8 : 0, 10);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, name, data);
    centrals.push(central, name);
    offset += 30 + name.length + data.length;
  }
  const dir = Buffer.concat(centrals), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(dir.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, dir, end]);
}

test('unzip reads stored and deflated entries', () => {
  const zip = makeZip([{ name: 'a/slide1.xml', text: 'hello' }, { name: 'b.md', text: 'deflated text here', deflate: true }]);
  const got = unzip(zip).map((e) => [e.name, e.data().toString('utf8')]);
  assert.deepEqual(got, [['a/slide1.xml', 'hello'], ['b.md', 'deflated text here']]);
});

test('unzip refuses a file that is not a zip', () => {
  assert.throws(() => unzip(Buffer.from('not a zip at all, just text')), /not a zip/);
});

const { scriptLiterals } = require(path.join(ROOT, 'tools', 'source-overlap.js'));

test('scriptLiterals lists the long string literals of a page\'s inline scripts, with their lines', () => {
  const html = '<p>A page</p>\n<script src="x.js"></script>\n<script>\n'
    + "const a = 'It\\'s a single quoted line here';\n"
    + 'const b = "Two words"; // "a comment with many words in it"\n'
    + 'const c = /["\']/g, d = "Double quoted text has five words";\n'
    + 'const e = `Template ${n + 1} apples in a ${"box"} basket`;\n'
    + '</script>';
  assert.deepEqual(scriptLiterals(html), [
    { line: 4, text: "It's a single quoted line here" },
    { line: 6, text: 'Double quoted text has five words' },
    { line: 7, text: 'Template   apples in a   basket' },
  ]);
});

const { docsOf, xmlText } = require(path.join(ROOT, 'tools', 'source-text.js'));

test('xmlText keeps words apart across line breaks and tabs', () => {
  assert.equal(xmlText('<a:p><a:r><a:t>one</a:t></a:r><a:br/><a:r><a:t>two</a:t></a:r></a:p>', 'a:p', 'a:t'), 'one two');
  assert.equal(xmlText('<w:p><w:r><w:t>left</w:t><w:tab/><w:t>right</w:t><w:br/><w:t>end</w:t></w:r></w:p>', 'w:p', 'w:t'),
    'left right end');
});

test('a pptx gives its slides, then speaker notes, then SmartArt text', () => {
  const t = (s) => '<a:p><a:r><a:t>' + s + '</a:t></a:r></a:p>';
  const pptx = makeZip([
    { name: 'ppt/diagrams/data1.xml', text: t('smart art') },
    { name: 'ppt/notesSlides/notesSlide1.xml', text: t('a note') },
    { name: 'ppt/slides/slide2.xml', text: t('second') },
    { name: 'ppt/slides/slide1.xml', text: t('first') },
  ]);
  assert.deepEqual(docsOf('deck.pptx', pptx), [{ name: 'deck.pptx', text: 'first\nsecond\na note\nsmart art' }]);
});

test('a zip keeps its readable files when one inside cannot be read', () => {
  const zip = makeZip([{ name: 'bad.pptx', text: 'not a zip' }, { name: 'notes.md', text: 'plain notes' }]);
  const docs = docsOf('pack.zip', zip);
  assert.equal(docs.length, 2);
  assert.deepEqual(docs[0], { name: 'pack.zip!bad.pptx', text: '', error: 'not a zip' });
  assert.deepEqual(docs[1], { name: 'pack.zip!notes.md', text: 'plain notes' });
});
