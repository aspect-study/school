const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { worldFile } = require('./paths.js');

const main = fs.readFileSync(worldFile('world-main.js'), 'utf8');

test('the world creates the chatter, draws bubbles and silences them while she is busy', () => {
  assert.match(main, /W\.Chatter\.create\(/);
  assert.match(main, /W\.Bubbles\.create\(/);
  assert.match(main, /chatter\.step\(/);
  assert.match(main, /bubbles\.show\(/);
  assert.match(main, /function chatSilent/);
});

test('Settings has a Chatter row for Quiet, Calm and Chatty', () => {
  assert.match(main, /setting\(T\.chatter,/);
  assert.match(main, /W\.Prefs\.CHATTERS/);
});

test('chatter never touches coins, points or storage', () => {
  for (const f of ['speech.js', 'speechctx.js', 'chatter.js', 'bubbles.js']) {
    const src = fs.readFileSync(worldFile(f), 'utf8');
    for (const banned of ['Wallet', 'Recall.', 'StudyKit', 'localStorage', 'store.']) assert.ok(!src.includes(banned), f + ' ' + banned);
  }
});

test('life.js lists the pets as speakers', () => {
  assert.match(fs.readFileSync(worldFile('life.js'), 'utf8'), /speakers: speakers/);
});

test('a playmate offers a Chat button that runs a tap chat with the world speech lines', () => {
  const mates = fs.readFileSync(worldFile('mates3d.js'), 'utf8');
  assert.match(mates, /W\.SpeechChat\.open\(/);
  assert.match(mates, /T\.chat/);
  assert.match(main, /chatData:/);
  assert.match(main, /chatContext:/);
  assert.ok(main.indexOf('var speechData') < main.indexOf('W.Mates3D.create('), 'speech data exists before the kids are made');
});
