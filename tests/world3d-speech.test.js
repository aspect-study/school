const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile } = require('./paths.js');
const Speech = require(worldFile('speech.js'));

const DATA = {
  pools: {
    'any-pet': [
      { id: 'a1', say: 'Hello there!' },
      { id: 'a2', when: ['time:evening'], say: 'Good evening!' },
      { id: 'a3', when: ['wearing:hat'], say: 'Nice {hat}!' }
    ],
    'species:fox': [{ id: 'f1', say: 'Sneaky me!' }],
    'pet:kidlat': [{ id: 'k1', say: 'Zoom!', replies: [{ text: 'Wow!', next: 'k2' }] }, { id: 'k2', follow: true, say: 'Faster than lightning!' }]
  }
};
const FOX = { id: 'pet:tomas', kind: 'pet', species: 'fox', name: 'Kidlat' };
const ctx = (tags, slots) => ({ tags: tags || [], slots: slots || {} });

test('poolIds gives a pet its own, its species and the shared pool, and a kid its own and the shared pool', () => {
  assert.deepEqual(Speech.poolIds(FOX), ['any-pet', 'species:fox', 'pet:kidlat']);
  assert.deepEqual(Speech.poolIds({ id: 'migo', kind: 'kid' }), ['any-kid', 'kid:migo']);
});

test('poolIds gives a town character its own pool and a buddy the shared pool and its own', () => {
  assert.deepEqual(Speech.poolIds({ id: 'mimi', kind: 'char' }), ['char:mimi']);
  assert.deepEqual(Speech.poolIds({ id: 'buddy:life-lab', kind: 'buddy', app: 'life-lab' }), ['any-buddy', 'buddy:life-lab']);
});

test('validTag and validSlot accept the known names only', () => {
  for (const t of ['time:evening', 'near:slide', 'wearing:hat', 'pet:fox', 'fav:color:1', 'streak:3', 'tired', 'after:ride']) assert.ok(Speech.validTag(t), t);
  for (const t of ['time:lunch', 'wearing:shoes', 'fav:color', 'Pet:fox', '']) assert.ok(!Speech.validTag(t), t);
  for (const s of ['hat', 'pet', 'streak', 'fav_color']) assert.ok(Speech.validSlot(s), s);
  assert.ok(!Speech.validSlot('nose'));
});

test('pick prefers the line with the most matching tags', () => {
  const line = Speech.pick(DATA, FOX, ctx(['time:evening']), Speech.newState(), () => 0);
  assert.equal(line.id, 'a2');
});

test('a line with a slot needs a value for that slot even when its tag holds', () => {
  assert.equal(Speech.pick(DATA, FOX, ctx(['wearing:hat']), Speech.newState(), () => 0).id !== 'a3', true);
  assert.equal(Speech.pick(DATA, FOX, ctx(['wearing:hat'], { hat: 'Red cap' }), Speech.newState(), () => 0).id, 'a3');
});

test('fill puts the slot values into the text', () => {
  assert.equal(Speech.fill('Nice {hat}, {pet}!', ctx([], { hat: 'Red cap', pet: 'Kidlat' })), 'Nice Red cap, Kidlat!');
});

test('pick never repeats a recent line and returns null when nothing fits', () => {
  const state = Speech.newState();
  const ids = [];
  for (let i = 0; i < 3; i++) {
    const line = Speech.pick(DATA, FOX, ctx(), state, () => 0);
    ids.push(line ? line.id : null);
  }
  assert.deepEqual(ids, ['a1', 'f1', null]);
});

test('ambient picks skip chat openers (lines with replies) and lines that only follow a reply', () => {
  const ids = new Set();
  for (let i = 0; i < 20; i++) {
    const line = Speech.pick(DATA, FOX, ctx(), Speech.newState(), () => Math.random());
    if (line) ids.add(line.id);
  }
  assert.ok(!ids.has('k1') && !ids.has('k2'));
});

test('the recent list keeps the last 20 lines per speaker', () => {
  const pool = [];
  for (let i = 0; i < 30; i++) pool.push({ id: 'l' + i, say: 'Line ' + i });
  const state = Speech.newState();
  for (let i = 0; i < 25; i++) Speech.pick({ pools: { 'any-pet': pool } }, FOX, ctx(), state, () => 0);
  assert.equal(state.recent[FOX.id].length, 20);
});

test('chatOnly keeps to lines with replies when one fits, and falls back to any line', () => {
  const chat = Speech.pick(DATA, FOX, ctx(), Speech.newState(), () => 0, true);
  assert.equal(chat.id, 'k1');
  const only = { pools: { 'any-pet': [{ id: 'z1', say: 'Just a line' }] } };
  assert.equal(Speech.pick(only, FOX, ctx(), Speech.newState(), () => 0, true).id, 'z1');
});

test('reply returns the line a reply button points to, or null at the end of a chat', () => {
  const k1 = DATA.pools['pet:kidlat'][0];
  assert.equal(Speech.reply(DATA, k1.replies[0]).id, 'k2');
  assert.equal(Speech.reply(DATA, { text: 'x', next: 'nope' }), null);
});

test('merge joins the pools of several data files', () => {
  const m = Speech.merge({ pools: { a: [{ id: '1' }] } }, { pools: { a: [{ id: '2' }], b: [{ id: '3' }] } });
  assert.deepEqual(Object.keys(m.pools).sort(), ['a', 'b']);
  assert.equal(m.pools.a.length, 2);
});
