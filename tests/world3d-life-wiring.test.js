const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { worldFile } = require('./paths.js');
const Data = require(worldFile('lifedata.js'));
const PetBody = require(worldFile('petbody.js'));

test('every pet action is a mood the pet body can show', () => {
  const actions = new Set(['idle', 'walk', 'sit', 'hop']);
  for (const rt of Object.values(Data.PET_ROUTINES)) for (const s of rt.steps) actions.add(s.action);
  for (const a of actions) assert.ok(PetBody.MOODS_ALL.includes(a), 'petbody has no mood ' + a);
});

test('every character action is a pose cast.js knows', () => {
  const src = fs.readFileSync(worldFile('cast.js'), 'utf8');
  const actions = new Set(['walk']);
  for (const rt of Object.values(Data.CHAR_ROUTINES)) for (const s of rt.steps) actions.add(s.action);
  for (const a of actions) assert.match(src, new RegExp('\\b' + a + ': function'), 'cast.js has no action ' + a);
});

test('folk, mates3d and town give the living world what it needs', () => {
  const folk = fs.readFileSync(worldFile('folk.js'), 'utf8');
  assert.match(folk, /chars: function/);
  assert.match(folk, /talkingId: function/);
  assert.match(fs.readFileSync(worldFile('mates3d.js'), 'utf8'), /owners: function/);
  const town = fs.readFileSync(worldFile('town.js'), 'utf8');
  assert.match(town, /mimiLife: function/);
});

test('life.js builds pets from lifedata and never touches coins, points or storage', () => {
  const src = fs.readFileSync(worldFile('life.js'), 'utf8');
  assert.match(src, /PetBody\.build\(/);
  assert.match(src, /Routines\.create\(/);
  for (const banned of ['Wallet', 'Recall.', 'StudyKit', 'Learner', 'localStorage', 'store']) assert.ok(!src.includes(banned), banned);
});

test('the world creates and ticks the living world, only outside rooms and menus', () => {
  const src = fs.readFileSync(worldFile('world-main.js'), 'utf8');
  assert.match(src, /W\.Life\.create\(/);
  assert.match(src, /life\.tick\(/);
  assert.match(src, /debug\.life = life\.debug/);
});

test('she only startles pets while she is actually moving', () => {
  const src = fs.readFileSync(worldFile('life.js'), 'utf8');
  assert.match(src, /sprint: !!st\.sprint && st\.mag > 0/);
});

test('a shop keeper is snapped home before the stall opens, and sprites reuse their material', () => {
  assert.match(fs.readFileSync(worldFile('world-main.js'), 'utf8'), /life\.snapHome\(keeperId/);
  const src = fs.readFileSync(worldFile('life.js'), 'utf8');
  assert.match(src, /material\.map = texture\(/);
  assert.ok(!/S\.scene\.remove\(/.test(src), 'no sprite is dropped without disposing');
});
