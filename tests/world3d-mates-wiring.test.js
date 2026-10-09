const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { worldFile } = require('./paths.js');

const src = fs.readFileSync(worldFile('mates3d.js'), 'utf8');

test('playground study answers are saved to history but never scored or reviewed', () => {
  assert.match(src, /quizStarted\(/);
  assert.match(src, /quizAnswered\(/);
  for (const banned of ['Recall.', 'StudyKit', 'quizFinished', 'Wallet']) assert.ok(!src.includes(banned), banned);
});

test('every question asked is marked for today first, so none repeats', () => {
  assert.match(src, /markAsked\(o\.store, today, MQ\.studyKey\(/);
  assert.match(src, /markAsked\(o\.store, today, MQ\.funKey\(/);
});

const { WORLD_FILES } = require('./paths.js');
const Sfx = require(worldFile('sfx.js'));

test('the playmate files load after what they use', () => {
  const at = (f) => WORLD_FILES.indexOf(f);
  for (const f of ['mates.js', 'matelines.js', 'matequiz.js', 'mateboard.js', 'matemind.js', 'mates3d.js']) assert.ok(at(f) >= 0, f);
  assert.ok(at('look.js') < at('mates.js'));
  assert.ok(at('rides.js') < at('mateboard.js'));
  assert.ok(at('mateboard.js') < at('matemind.js'));
  for (const f of ['avatar.js', 'talk.js', 'ask.js', 'quiz.js', 'matemind.js']) assert.ok(at(f) < at('mates3d.js'), f);
  assert.ok(at('mates3d.js') < at('world-main.js'));
});

test('world-main wires the kids in, behind every other thing she can tap', () => {
  const main = fs.readFileSync(worldFile('world-main.js'), 'utf8');
  assert.match(main, /W\.Mates3D\.create\(/);
  assert.match(main, /\|\| L\.nearest\(mates\.items\(\), st\.x, st\.z\)/);
  assert.match(main, /mates\.tick\(t, dt, st, play\.now\(\), near\)/);
  assert.ok(Sfx.SOUNDS['mate-giggle'], 'the giggle is a sound');
  assert.equal(Sfx.FILES.length, 56, 'no new clip files');
});

test('a name tag shows only for the kid she can talk to or is talking to, and the kids know where the camera is', () => {
  assert.match(src, /tag\.visible = false;/);
  assert.match(src, /k\.tag\.visible = n === focus \|\| k === talking;/);
  assert.match(src, /cam: \{ x: S\.camera\.position\.x, z: S\.camera\.position\.z \}/);
});

test('a kid close to the camera fades, with materials of their own so no one else fades with them', () => {
  assert.match(src, /mats: ownMaterials\(ch\.group\)/);
  assert.match(src, /var c = m\.clone\(\);/);
  assert.match(src, /Math\.hypot\(S\.camera\.position\.x - f\.x, S\.camera\.position\.z - f\.z\)/);
});
