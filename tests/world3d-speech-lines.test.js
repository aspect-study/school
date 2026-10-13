const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { worldFile } = require('./paths.js');
const Speech = require(worldFile('speech.js'));
const LifeData = require(worldFile('lifedata.js'));

const DIR = worldFile('speech');
const FILES = fs.readdirSync(DIR).filter((f) => f.endsWith('.js')).sort();
const SPECIES = Object.keys(LifeData.SPECIES);
const PET_NAMES = ['tagpi', 'lila', 'kidlat', 'pandesal', 'mingming', 'kwento', 'tagal', 'bituin', 'kawayan', 'hielo', 'pitik'];
const FRIENDS = ['migo', 'ella', 'tomas', 'bea', 'jun', 'luna'];

const ALL = {};
const BY_ID = {};
for (const f of FILES) {
  const data = require(path.join(DIR, f));
  for (const [pool, lines] of Object.entries(data.pools)) {
    ALL[pool] = (ALL[pool] || []).concat(lines);
    for (const l of lines) {
      assert.ok(!BY_ID[l.id], 'duplicate line id ' + l.id);
      BY_ID[l.id] = l;
    }
  }
}
const LINES = Object.values(ALL).flat();
const TARGETS = new Set(LINES.flatMap((l) => (l.replies || []).map((r) => r.next)));
const chatLike = (l) => Speech.isChat(l) || !!l.follow;

const SCOLD = /\b(wrong|stupid|dumb|lazy|hate|ugly|bad|should have|better than|worse than|slower than|loser)\b/i;
const PRONOUN = /\b(she|her|hers|he|him|his)\b/i;
const FIL_BAD = [/tunog tama/i, /\bbagay\b/i, /\bpwede\b/i, /natutunan/i];

test('every line that uses the {streak} slot is tagged streak:3 or streak:7', () => {
  for (const l of LINES.filter((x) => x.say.includes('{streak}'))) {
    assert.ok((l.when || []).some((w) => w === 'streak:3' || w === 'streak:7'), l.id);
  }
});

test('every pool belongs to a known speaker kind', () => {
  for (const pool of Object.keys(ALL)) {
    const ok = pool === 'any-pet' || pool === 'any-kid'
      || (pool.startsWith('species:') && SPECIES.includes(pool.slice(8)))
      || (pool.startsWith('pet:') && PET_NAMES.includes(pool.slice(4)))
      || (pool.startsWith('kid:') && FRIENDS.includes(pool.slice(4)));
    assert.ok(ok, 'unknown pool ' + pool);
  }
});

test('every line has an id, words and only known tags and slots', () => {
  for (const l of LINES) {
    assert.match(l.id, /^[a-z0-9-]+$/, 'id ' + l.id);
    assert.ok(typeof l.say === 'string' && l.say.trim() === l.say && l.say.length > 0, l.id + ' say');
    for (const t of l.when || []) assert.ok(Speech.validTag(t), l.id + ' tag ' + t);
    assert.equal(new Set(l.when || []).size, (l.when || []).length, l.id + ' repeats a tag');
    for (const s of Speech.slotsOf(l.say)) assert.ok(Speech.validSlot(s), l.id + ' slot ' + s);
    if (l.fil) assert.deepEqual(Speech.slotsOf(l.fil).sort(), Speech.slotsOf(l.say).sort(), l.id + ' fil slots');
  }
});

test('ambient lines are at most 60 characters and chat lines (openers and follow lines) at most 140', () => {
  for (const l of LINES) {
    const max = chatLike(l) ? 140 : 60;
    assert.ok(l.say.length <= max, l.id + ' is ' + l.say.length + ' characters');
  }
});

test('lines are kind: no scolding, no comparing, nothing about her as she or he', () => {
  for (const l of LINES) {
    assert.doesNotMatch(l.say, SCOLD, l.id + ' scolds');
    if (l.allow !== 'pronoun') assert.doesNotMatch(l.say, PRONOUN, l.id + ' uses she/her/he/him/his');
  }
});

test('Filipino halves follow the project wording rules', () => {
  for (const l of LINES) {
    if (!l.fil) continue;
    for (const bad of FIL_BAD) assert.doesNotMatch(l.fil, bad, l.id + ' ' + bad);
  }
});

test('follow lines are exactly the lines replies lead to', () => {
  for (const id of TARGETS) assert.ok(BY_ID[id] && BY_ID[id].follow === true, id + ' is a reply target and needs follow: true');
  for (const l of LINES) if (l.follow) assert.ok(TARGETS.has(l.id), l.id + ' is marked follow but no reply leads to it');
});

test('chat lines carry a Filipino half and replies lead to real lines, at most 3 steps, with no loop', () => {
  for (const l of LINES) {
    if (!chatLike(l)) continue;
    assert.ok(l.fil, l.id + ' needs a fil half');
    for (const r of l.replies || []) {
      assert.ok(r.text && r.text.length <= 24, l.id + ' reply text');
      assert.ok(BY_ID[r.next], l.id + ' replies to missing ' + r.next);
    }
    assert.ok((l.replies || []).length <= 3, l.id + ' has more than 3 replies');
  }
  function depth(id, seen) {
    assert.ok(!seen.includes(id), 'loop through ' + id);
    const l = BY_ID[id];
    const next = (l.replies || []).map((r) => depth(r.next, seen.concat(id)));
    return 1 + (next.length ? Math.max(...next) : 0);
  }
  for (const l of LINES) if (l.replies && l.replies.length) assert.ok(depth(l.id, []) <= 3, l.id + ' is a chat of more than 3 steps');
});

test('every pool can always say something: at least 3 lines with no condition or only a time of day', () => {
  for (const [pool, lines] of Object.entries(ALL)) {
    const open = lines.filter((l) => !chatLike(l) && (l.when || []).every((t) => t.startsWith('time:'))).length;
    assert.ok(open >= 3, pool + ' has only ' + open + ' open lines');
  }
});

test('A1 coverage: pets', () => {
  const need = (pool, n) => assert.ok((ALL[pool] || []).length >= n, pool + ' has ' + (ALL[pool] || []).length + ', needs ' + n);
  need('any-pet', 40);
  for (const s of SPECIES) need('species:' + s, 12);
  for (const n of PET_NAMES) need('pet:' + n, 8);
});

test('A1 coverage: playmates', () => {
  const need = (pool, n) => assert.ok((ALL[pool] || []).length >= n, pool + ' has ' + (ALL[pool] || []).length + ', needs ' + n);
  need('any-kid', 40);
  for (const f of FRIENDS) need('kid:' + f, 25);
  const trees = (pool) => (ALL[pool] || []).filter((l) => Speech.isChat(l) && !l.follow).length;
  assert.ok(trees('any-kid') >= 6, 'any-kid needs 6 chats that open with replies');
  for (const f of FRIENDS) assert.ok(trees('kid:' + f) >= 4, f + ' needs 4 chats that open with replies');
});
