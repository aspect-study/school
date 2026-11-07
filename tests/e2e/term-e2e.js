// A game's term views, with Life Lab's last lesson marked Term 2: ?term=2 shows only it, ?term=1 every other lesson,
// no term shows both under 📘 Term 1 and 🌟 Term 2 · New headings (hidden with the cards in the path view), and
// ?term=2&exam=1 opens the final exam drawn from the Term 2 lesson. Then Byte Buddies (stars keyed by position).
// Run: node tests/e2e/term-e2e.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { stage, makeWorkDir, dumpDom, readOutput, injectDriver } = require('./chrome.js');
const { ENGINE_FILES, app, appFile } = require('../paths.js');

const work = makeWorkDir('term-e2e');
try {
  const driver = fs.readFileSync(path.join(__dirname, 'driver-term.page.js'), 'utf8');
  const html = injectDriver(fs.readFileSync(appFile('life-lab'), 'utf8'), driver);
  const file = stage(path.join(work, 'site'), app('life-lab').page, html, ENGINE_FILES);
  const last = path.join(path.dirname(file), 'lessons', '18-adapt.js');
  const source = fs.readFileSync(last, 'utf8');
  if (!source.includes('StudyKit.lesson({\n')) throw new Error('18-adapt.js does not start with StudyKit.lesson({');
  fs.writeFileSync(last, source.replace('StudyKit.lesson({\n', 'StudyKit.lesson({\n  term: 2,\n'));
  const total = (html.match(/<script src="lessons\//g) || []).length;

  function view(name, suffix) {
    const r = readOutput(dumpDom(path.join(work, 'profile-' + name), file, suffix, 3000));
    assert.deepEqual(r.errors, [], name + ': page errors');
    return r;
  }

  const t2 = view('t2', '?term=2');
  assert.equal(t2.cards, 1, '?term=2: the one Term 2 lesson');
  assert.deepEqual(t2.heads, [], '?term=2: no headings');

  const t1 = view('t1', '?term=1');
  assert.equal(t1.cards, total - 1, '?term=1: every other lesson');
  assert.deepEqual(t1.heads, [], '?term=1: no headings');

  const both = view('both', '');
  assert.equal(both.cards, total, 'no term: every lesson');
  assert.deepEqual(both.heads, [['📘 Term 1', '0'], ['🌟 Term 2 · New', String(total - 1)]]);
  assert.equal(both.headsHidden, 2, 'the path view (the default) hides the headings with the cards');

  const ex = view('exam', '?term=2&exam=1');
  assert.equal(ex.quiz, 'final', '&exam=1 opens the final exam');
  assert.equal(ex.questions, 2, 'drawn from the one Term 2 lesson (2 a lesson)');
  console.log('ok term views: Term 2 only, Term 1 only, both with headings, Term 2 exam');
} finally {
  fs.rmSync(work, { recursive: true, force: true });
}

// Byte Buddies keys stars by lesson position: with its last lesson marked Term 2, finishing it in ?term=2 must put the
// stars on that lesson's card, not on lesson 1's.
const work2 = makeWorkDir('term-e2e-g2');
try {
  const driver = fs.readFileSync(path.join(__dirname, 'driver-term-g2.page.js'), 'utf8');
  const html = injectDriver(fs.readFileSync(appFile('byte-buddies'), 'utf8'), driver);
  const file = stage(path.join(work2, 'site'), app('byte-buddies').page, html, ENGINE_FILES);
  const last = path.join(path.dirname(file), 'lessons', '10-connecting-to-the-internet.js');
  const source = fs.readFileSync(last, 'utf8');
  if (!source.includes('StudyKit.lesson({\n')) throw new Error('10-connecting-to-the-internet.js does not start with StudyKit.lesson({');
  fs.writeFileSync(last, source.replace('StudyKit.lesson({\n', 'StudyKit.lesson({\n  term: 2,\n'));
  const total = (html.match(/<script src="lessons\//g) || []).length;
  const profile = path.join(work2, 'profile');

  const t2 = readOutput(dumpDom(profile, file, '?term=2', 3000));
  assert.deepEqual(t2.errors, [], 'Term 2: page errors');
  assert.deepEqual(t2.saved, [String(total - 1)], 'Term 2 lesson saved under its full-list position');
  assert.deepEqual(t2.stars, [3], 'Term 2 view: its one card shows 3 stars');

  const all = readOutput(dumpDom(profile, file, '', 3000));
  assert.deepEqual(all.errors, [], 'full view: page errors');
  assert.equal(all.stars.length, total);
  assert.deepEqual(all.stars, Array.from({ length: total }, (_, i) => (i === total - 1 ? 3 : 0)), 'stars on the last card only');
  console.log('ok Grade 2 term view: stars saved on the Term 2 lesson, not lesson 1');
} finally {
  fs.rmSync(work2, { recursive: true, force: true });
}
