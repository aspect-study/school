const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { stage, makeWorkDir, dumpDom, readOutput, injectDriver } = require('./chrome.js');
const { ENGINE_FILES, app, appFile } = require('../paths.js');

// One game per flashcard family.
const CASES = [
  { id: 'life-lab', open: 'openLesson(0)', cards: 'LESSONS[0].cards.length', idx: 'flashIdx',
    next: 'flashNext', start: 'flashStart', back: 'flashBack', prev: '#flashScreen .flash-nav .btn' },
  { id: 'word-train', open: "document.querySelector('button[data-lesson=\"0\"]').click()", cards: 'lessons[0].flashcards.length', idx: 'flashIdx',
    next: 'btn-flash-next', prev: '#btn-flash-prev' },
  { id: 'kuwentista', open: 'openLesson(0)', cards: 'LESSONS[0].flashcards.length', idx: 'cardIdx',
    next: 'card-next', start: 'cards-start', prev: '#card-prev' },
  { id: 'math-mastery', open: 'openLesson(0)', cards: 'LESSONS[0].flashcards.length', idx: 'cardIdx',
    next: 'card-next', start: 'cards-start', prev: '#card-prev' },
];

const work = makeWorkDir('read-gate-e2e');
const driver = fs.readFileSync(path.join(__dirname, 'driver-read-gate.page.js'), 'utf8');

for (const c of CASES) {
  const html = injectDriver(fs.readFileSync(appFile(c.id), 'utf8'), 'var __GATE = ' + JSON.stringify(c) + ';\n' + driver);
  const file = stage(path.join(work, c.id), app(c.id).page, html, ENGINE_FILES);
  const r = readOutput(dumpDom(path.join(work, 'profile-' + c.id), file));
  const last = r.total - 1;
  assert.deepEqual(r.errors, [], c.id + ': page errors');
  assert.ok(r.total > 2, c.id + ': the lesson has cards');
  assert.equal(r.atOpen.next, false, c.id + ': Next is never locked');
  if (c.start) assert.equal(r.atOpen.start, true, c.id + ': Start Quiz is locked when the lesson opens');
  assert.match(r.atOpen.note, new RegExp('Read every card.*\\(1 of ' + r.total), c.id + ': the first card counts as read right away');
  if (c.back) assert.equal(r.backShown, true, c.id + ': the meaning shows under the term, no flip needed');
  assert.ok(r.steps.every((s) => s.after === s.before + 1), c.id + ': each Next moves one card at once');
  if (c.start) assert.equal(r.startBeforeLast, true, c.id + ': Start Quiz stays locked until the last card is shown');
  assert.equal(r.allRead.start, false, c.id + ': every card shown unlocks Start Quiz');
  assert.match(r.allRead.note, /^✅ You read every card/, c.id + ': the note says so');
  assert.equal(r.prevFree, last - 1, c.id + ': Prev is never locked');
  assert.equal(r.backToLast, last, c.id + ': Next goes back to the last card');
  assert.match(r.afterStart, /quiz/, c.id + ': Start Quiz opens the quiz');
  assert.deepEqual(r.reopened, { next: false, start: !!c.start }, c.id + ': leaving the lesson locks the quiz again');
  console.log('ok ' + c.id + ' (' + r.total + ' cards)');
}
