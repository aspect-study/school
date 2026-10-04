const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { stage, makeWorkDir, dumpDom, readOutput, injectDriver } = require('./chrome.js');
const { ENGINE_FILES, app, appFile } = require('../paths.js');

// One game per flashcard family. The driver runs a fake clock, so "60 seconds of reading" takes no real time.
const CASES = [
  { id: 'life-lab', open: 'openLesson(0)', cards: 'LESSONS[0].cards.length', idx: 'flashIdx',
    next: 'flashNext', start: 'flashStart', flip: 'flashCard', prev: '#flashScreen .flash-nav .btn' },
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
  assert.ok(r.total > 1, c.id + ': the lesson has cards');
  assert.equal(r.atOpen.next, true, c.id + ': Next is locked on a fresh card');
  assert.equal(r.atOpen.start, true, c.id + ': Start Quiz is locked when the lesson opens');
  assert.match(r.atOpen.note, new RegExp('Read every card.*\\(0 of ' + r.total), c.id + ': the note says how many cards are read');
  assert.equal(r.earlyNext, 0, c.id + ': Next right away does nothing');
  assert.equal(r.halfNext, 0, c.id + ': Next before the time is up does nothing');
  if (c.flip) {
    const fronts = r.steps.filter((s) => 'afterFrontOnly' in s);
    assert.ok(fronts.every((s) => s.afterFrontOnly === s.before), c.id + ': Next waits for the other side too');
    assert.match(fronts[0].note, /Tap the card to read the other side/, c.id + ': the note asks for the flip');
  }
  const moves = r.steps.filter((s) => 'after' in s);
  assert.equal(moves.length, last, c.id + ': a read card lets Next through');
  assert.ok(moves.every((s) => s.after === s.before + 1), c.id + ': Next moves one card');
  assert.equal(r.startOnArrivingLast, true, c.id + ': Start Quiz is still locked on arriving at the last card');
  assert.equal(r.allRead.start, false, c.id + ': every card read unlocks Start Quiz');
  assert.match(r.allRead.note, /^✅ You read every card/, c.id + ': the note says so');
  assert.equal(r.prevFree, last - 1, c.id + ': Prev is never locked');
  assert.equal(r.nextFree, last, c.id + ': a card read once needs no new wait');
  assert.match(r.afterStart, /quiz/, c.id + ': Start Quiz opens the quiz');
  assert.deepEqual(r.reopened, { next: true, start: true }, c.id + ': leaving the lesson locks it again');
  console.log('ok ' + c.id + ' (' + r.total + ' cards)');
}
