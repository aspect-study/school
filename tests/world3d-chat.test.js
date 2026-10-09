const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile } = require('./paths.js');
const C = require(worldFile('chat.js'));
const { TEXT, QUOTES } = require(worldFile('lines.js'));

const DAY = 86400000;
const NOW = new Date(2026, 9, 6, 10).getTime();
const O = { now: NOW, subject: 'Science', hi: 'Ribbit!', inGame: false };
const E = TEXT.grade5;

test('a buddy says the most important thing first: boss, review, quest, medal, missed, then the fallback', () => {
  const all = C.buddyLines('grade5', { boss: true, due: 2, quest: true, tally: { gold: 1, silver: 1, bronze: 0, total: 2 }, lastT: NOW - 4 * DAY }, O);
  assert.deepEqual(all, ['Ribbit! ' + E.boss('Science'), E.due(2), E.quest('Science'), E.toGold(1), E.missed(4), E.fallback]);
  assert.deepEqual(C.buddyLines('grade5', {}, O), ['Ribbit! ' + E.fallback], 'nothing known: the hello and the fallback');
});

test('a game whose review stays inside says so', () => {
  assert.equal(C.buddyLines('grade5', { due: 1 }, Object.assign({}, O, { inGame: true }))[0], 'Ribbit! ' + E.dueGame(1));
});

test('medal lines follow the weakest medal', () => {
  const m = (t) => C.buddyLines('grade5', { tally: t }, O)[0].slice('Ribbit! '.length);
  assert.equal(m({ gold: 3, silver: 0, bronze: 0, total: 3 }), E.allGold);
  assert.equal(m({ gold: 1, silver: 2, bronze: 0, total: 3 }), E.toGold(2));
  assert.equal(m({ gold: 1, silver: 0, bronze: 2, total: 3 }), E.toSilver(2));
  assert.equal(m({ gold: 0, silver: 0, bronze: 1, total: 3 }), E.toBronze(2));
  assert.equal(m({ gold: 0, silver: 0, bronze: 0, total: 0 }), E.fallback, 'no lessons tracked yet');
});

test('she is missed only after 3 days away', () => {
  assert.equal(C.buddyLines('grade5', { lastT: NOW - 2 * DAY }, O).length, 1);
  assert.equal(C.buddyLines('grade5', { lastT: NOW - 3 * DAY }, O)[0], 'Ribbit! ' + E.missed(3));
});

test('Grade 2 joins the hello and the line half by half', () => {
  const out = C.buddyLines('grade2', {}, Object.assign({}, O, { hi: 'Ang bait mo! · You are so kind!' }));
  assert.equal(out[0], 'Ang bait mo! Gusto mo bang matuto ng bago ngayong araw? · You are so kind! Want to learn something new today?');
  assert.equal(C.join('a', 'b'), 'a b');
});

test('a tree has one quote all day, and More walks through every quote', () => {
  assert.equal(C.quote('grade5', 3, '2026-10-6', 0), C.quote('grade5', 3, '2026-10-6', 0));
  const trees = new Set([0, 1, 2, 3, 4, 5, 6, 7].map((t) => C.quote('grade5', t, '2026-10-6', 0)));
  assert.ok(trees.size >= 5, 'the trees mostly say different things');
  const seen = new Set();
  for (let k = 0; k < QUOTES.length; k++) seen.add(C.quote('grade5', 3, '2026-10-6', k));
  assert.equal(seen.size, QUOTES.length);
  assert.match(C.quote('grade2', 3, '2026-10-6', 0), / · /);
});

test('Bunny cheers the cheapest reward still out of reach, and never pushes spending', () => {
  const shelf = [
    { item: { emoji: '🎵', goal: 'Car music pick' }, ok: true, need: 0, daily: false },
    { item: { emoji: '🎮', goal: 'ML game' }, ok: false, need: 0, daily: true },
    { item: { emoji: '🐴', goal: 'Piggyback' }, ok: false, need: 12, daily: false },
    { item: { emoji: '👨', goal: '1 ML game with Tatay' }, ok: false, need: 40, daily: false },
  ];
  assert.equal(C.bunnyLine('grade5', shelf), E.bunny.save(12, '🐴 Piggyback'));
  assert.equal(C.bunnyLine('grade5', [shelf[0]]), E.bunny.any);
  assert.equal(C.bunnyLine('grade5', []), E.bunny.any);
});
