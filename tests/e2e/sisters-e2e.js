// Her sister by the gate on the Grade 5 lobby: the buddy, the card, cheers and the cheer popup.
// The cloud never runs on file://, so the sister's peek is seeded the way cloud.js would save it.
// Run: node tests/e2e/sisters-e2e.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { stage, makeWorkDir, dumpDom, readOutput, appendDriver } = require('./chrome.js');
const { LOBBIES, lobbyFile, ENGINE_FILES } = require('../paths.js');

const work = makeWorkDir('sisters-e2e');
const driver = 'var __store = Learner.storage;\n' + fs.readFileSync(path.join(__dirname, 'driver-sisters.page.js'), 'utf8');
const file = stage(path.join(work, 'site'), LOBBIES[5].page, appendDriver(fs.readFileSync(lobbyFile(5), 'utf8'), driver), ENGINE_FILES);

try {
  const r = readOutput(dumpDom(path.join(work, 'profile'), file, ''));
  assert.deepEqual(r.errors, [], 'page errors');
  assert.equal(r.noPeekNoBuddy, true, 'no sister data: no buddy');
  assert.equal(r.buddy, true, 'her buddy stands by the gate');
  assert.match(r.playing, /f-on/, 'she was here a minute ago: playing now');
  assert.equal(r.tag, 'Bunso 🎮');
  assert.equal(r.mark, true, '💌 for news she has not seen');
  assert.equal(r.cardOpen, true);
  assert.deepEqual(r.news, ['🥉 Bronze in Math: Skip Counting']);
  assert.equal(r.count, '💖 3 cheers from Bunso');
  assert.deepEqual(r.buttons, ["Galing mo, Bunso! · You're great! 💖", 'So proud of you! 🌟', 'You can do it! 💪', "Ang talino mo! · You're so smart! 🧠", 'Love you, Bunso! 🤗', 'Keep going! 🚀']);
  assert.equal(r.markAfterOpen, false, 'opening the card marks the news seen');
  assert.equal(r.msg, 'Sent! 💌');
  assert.deepEqual(r.sent, [['mia', 'great']]);
  assert.equal(r.total, '1');
  assert.equal(r.sentAfterAgain, 1, 'the same cheer twice in a minute is not sent');
  assert.equal(r.cardClosed, true);
  assert.deepEqual(r.pop, ["Bunso: Galing mo, Ate! · You're great! 🌟 | Tap Bunso's buddy to cheer back!"]);
  assert.equal(r.seenCheers, true);
  assert.equal(r.unseenAfter, 0, 'a cheer pops once');
  assert.equal(r.limitDisabled, true, '10 a day');
  assert.equal(r.limitMsg, 'More cheers tomorrow!');
  console.log('Sisters passed');
} catch (err) {
  console.log('FAIL sisters: ' + err.message);
  process.exitCode = 1;
} finally {
  fs.rmSync(work, { recursive: true, force: true });
}
