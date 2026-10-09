const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { stage, makeWorkDir, dumpDom, readOutput, injectDriver } = require('./chrome.js');
const { ENGINE_FILES, app, appFile, engineFile } = require('../paths.js');
const { index, find } = require(engineFile('search.js'));
const content = require('../content.js');

// One game per home-screen family, plus History Explorers for the AP test topics.
const CASES = [
  { id: 'life-lab', list: 'homeList', home: 'home', query: 'atoms', enter: 'What Is Matter' },
  { id: 'history-explorers', list: 'homeList', home: 'home', query: 'timawa', enter: 'pakikipag-ugnayan sa tsina' },
  { id: 'math-mastery', list: 'lesson-grid', home: 'screen-home', query: 'divisible', enter: 'divisibility rules', expect: ['0', '1'] },
  { id: 'word-train', list: 'home-list', home: 'home', query: 'capital', enter: 'alphabet' },
  { id: 'kuwentista', list: 'lesson-grid', home: 'screen-home', query: 'patinig', enter: 'alpabetong pilipino' },
];

const work = makeWorkDir('search-e2e');
const driver = fs.readFileSync(path.join(__dirname, 'driver-search.page.js'), 'utf8');

for (const c of CASES) {
  const expect = c.expect || find(index(content.lessons(c.id)), c.query).map((f) => String(f.i));
  const html = injectDriver(fs.readFileSync(appFile(c.id), 'utf8'), 'var __SEARCH = ' + JSON.stringify(c) + ';\n' + driver);
  const file = stage(path.join(work, c.id), app(c.id).page, html, ENGINE_FILES);
  const r = readOutput(dumpDom(path.join(work, 'profile-' + c.id), file));
  assert.deepEqual(r.errors, [], c.id + ': page errors');
  assert.equal(r.boxBeforeList, true, c.id + ': the search box sits right above the lesson list');
  assert.ok(r.lessonCards > 0, c.id + ': lesson cards are marked');
  assert.equal(r.allAtStart, true, c.id + ': every card shows before a search');
  assert.ok(expect.length > 0, c.id + ': the query finds something');
  assert.deepEqual(r.found, expect, c.id + ': only the matching lesson cards show (exam, review and strategy cards hide)');
  assert.match(r.count, /^\d+ lessons? found/, c.id + ': the count line');
  assert.equal(r.noneShown, 0, c.id + ': no cards for a word that is in no lesson');
  assert.match(r.noneCount, /^No lesson found/, c.id + ': the nothing-found line');
  assert.deepEqual(r.afterRedraw, expect, c.id + ': the search stays on when the home screen redraws');
  assert.equal(r.afterClear, true, c.id + ': ✕ shows every card again');
  assert.notEqual(r.screenAfterEnter, c.home, c.id + ': Enter opens the first lesson found');
  console.log('ok ' + c.id + ' (' + c.query + ' → lessons ' + expect.map((i) => +i + 1).join(', ') + '; hits: ' + r.hits.join(' | ') + ')');
}
