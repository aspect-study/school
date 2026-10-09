process.env.TZ = 'Asia/Manila';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { engineFile } = require('./paths.js');
const { read, note, touch, canSend, send, store, readPeek, readSeen, markCheers, markNews, sisters, unseenCheers, relation, voiceOf,
  cheersFor, olderIsBoy, newsLine, ago, CHEERS, TEXT, KEY, SEEN, PEEK, TOTAL, PEEK_STATE, PEEK_COUNTERS, DAY_LIMIT, NEWS_KEEP } = require(engineFile('family.js'));

function memory(initial) {
  const data = Object.assign({}, initial);
  return {
    data,
    getItem: (k) => (Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
  };
}

function clock(y, m, d, h) {
  let t = new Date(y, m - 1, d, h || 9, 0).getTime();
  const now = () => t;
  now.days = (n) => { const x = new Date(t); x.setDate(x.getDate() + n); t = x.getTime(); };
  now.mins = (n) => { t += n * 60000; };
  now.secs = (n) => { t += n * 1000; };
  return now;
}

const rnd = () => 0.5;
const saved = (s) => JSON.parse(s.data[KEY]);
const EMPTY = { v: 1, at: 0, news: [], sent: [] };
const ME = { id: 'ana', grade: 5 };
const peekOf = (now, family, extra) => Object.assign({
  mia: { profile: { name: '', emoji: '', grade: 2 }, world: { avatar: 'rabbit' }, family, total: 3, readAt: now() },
}, extra);

test('keys and limits', () => {
  assert.deepEqual([KEY, SEEN, PEEK, TOTAL], ['family_v1', 'family_seen_v1', 'family_peek_v1', 'cheers_sent_total']);
  assert.deepEqual(PEEK_STATE, ['profile_v1', 'world_v1', 'family_v1', 'avatar_v1', 'house_v1']);
  assert.deepEqual(PEEK_COUNTERS, ['cheers_sent_total']);
  assert.equal(DAY_LIMIT, 10);
  assert.equal(NEWS_KEEP, 20);
});

test('junk reads as an empty family state', () => {
  assert.deepEqual(read(memory()), EMPTY);
  assert.deepEqual(read(memory({ family_v1: '{nope' })), EMPTY);
  assert.deepEqual(read(memory({ family_v1: JSON.stringify({ v: 2, at: 5 }) })), EMPTY);
});

test('note keeps only the four big moments, newest first, at most 20', () => {
  const s = memory(), now = clock(2026, 10, 4);
  assert.equal(note(s, now, rnd, 'medal', { app: 'block-bot', tier: 1, title: 'Skip Counting', coins: 3 }), true);
  now.mins(1);
  note(s, now, rnd, 'streak', { n: 7 });
  assert.equal(note(s, now, rnd, 'score', { n: 90 }), false, 'never scores');
  assert.equal(note(s, now, rnd, 'constructor'), false);
  const news = saved(s).news;
  assert.deepEqual(news.map((n) => n.kind), ['streak', 'medal']);
  assert.deepEqual(Object.keys(news[1]).sort(), ['app', 'id', 'kind', 't', 'tier', 'title'], 'coins are never kept');
  assert.equal(news[0].n, 7);
  for (let i = 0; i < 25; i++) { now.mins(1); note(s, now, rnd, 'quests'); }
  assert.equal(saved(s).news.length, 20);
});

test('touch saves when she was last in the lobby', () => {
  const s = memory(), now = clock(2026, 10, 4);
  assert.equal(touch(s, now), true);
  assert.equal(saved(s).at, now());
});

test('a cheer: 10 a day, not the same one twice in a minute, a new day starts fresh', () => {
  const s = memory(), now = clock(2026, 10, 4, 20);
  assert.equal(send(s, now, rnd, 'mia', 'great'), true);
  assert.equal(s.data[TOTAL], '1');
  assert.deepEqual(saved(s).sent.map(({ to, cheer }) => ({ to, cheer })), [{ to: 'mia', cheer: 'great' }]);
  now.secs(30);
  assert.deepEqual(canSend(s, now, 'great'), { ok: false, reason: 'again', left: 9 });
  assert.equal(send(s, now, rnd, 'mia', 'great'), false);
  assert.equal(send(s, now, rnd, 'mia', 'love'), true, 'another cheer is fine');
  now.secs(31);
  assert.equal(send(s, now, rnd, 'mia', 'great'), true, 'after a minute');
  for (const id of ['proud', 'can', 'smart', 'go', 'love', 'proud', 'can']) { now.mins(2); assert.equal(send(s, now, rnd, 'mia', id), true, id); }
  assert.deepEqual(canSend(s, now, 'go'), { ok: false, reason: 'limit', left: 0 });
  assert.equal(send(s, now, rnd, 'mia', 'go'), false);
  assert.equal(s.data[TOTAL], '10');
  now.mins(4 * 60);
  assert.equal(canSend(s, now, 'go').ok, true, 'a new day');
  const back = memory(), then = clock(2026, 10, 4, 20);
  for (const id of ['great', 'proud', 'can', 'smart', 'love', 'go', 'great', 'proud', 'can', 'smart']) { then.mins(2); send(back, then, rnd, 'mia', id); }
  const earlier = clock(2026, 10, 3, 9);
  assert.equal(canSend(back, earlier, 'go').ok, false, 'a clock moved back gives no extra cheers');
  assert.equal(send(s, now, rnd, 'mia', 'hug'), false, 'unknown cheer');
  assert.equal(send(s, now, rnd, '', 'go'), false, 'no sister');
});

test('sent cheers older than a week are dropped when saving', () => {
  const s = memory(), now = clock(2026, 10, 1);
  send(s, now, rnd, 'mia', 'go');
  now.days(8);
  send(s, now, rnd, 'mia', 'can');
  assert.deepEqual(saved(s).sent.map((x) => x.cheer), ['can']);
});

test('who is Ate: the higher grade; the sender picks the cheer words', () => {
  assert.equal(relation(5, 2), 'bunso');
  assert.equal(relation(5, 2, true), 'bunso');
  assert.equal(relation(2, 5), 'ate');
  assert.equal(relation(2, 5, true), 'kuya');
  assert.equal(relation(5, 5), 'sister');
  assert.equal(relation(5, 5, true), 'brother');
  assert.equal(voiceOf('ate'), 'fromAte');
  assert.equal(voiceOf('bunso'), 'fromBunso');
  assert.equal(voiceOf('sister'), 'fromAte');
  assert.deepEqual(CHEERS.fromAte.map((c) => c.id), ['great', 'proud', 'can', 'smart', 'love', 'go']);
  assert.deepEqual(CHEERS.fromBunso.map((c) => c.id), CHEERS.fromAte.map((c) => c.id));
  assert.equal(CHEERS.fromAte[0].text, "Galing mo, Bunso! · You're great! 💖");
  assert.equal(CHEERS.fromBunso[0].text, "Galing mo, Ate! · You're great! 🌟");
});

test('store keeps each sister\'s profile, buddy, family and cheer total; an empty list clears it', () => {
  const s = memory(), now = clock(2026, 10, 4);
  // world_v1 is a plain synced key, so the cloud holds the saved JSON text; profile_v1 and family_v1 come as objects.
  store(s, now, [{ id: 'mia', state: { profile_v1: { name: 'Mia', grade: 2 }, world_v1: JSON.stringify({ v: 1, avatar: 'owl' }), family_v1: { v: 1, at: 5, news: [], sent: [] } }, counters: { cheers_sent_total: 4 } }, { nope: 1 }]);
  assert.deepEqual(readPeek(s), { mia: { profile: { name: 'Mia', grade: 2 }, world: { v: 1, avatar: 'owl' }, look: null, family: { v: 1, at: 5, news: [], sent: [] }, house: null, total: 4, readAt: now() } });
  store(s, now, []);
  assert.deepEqual(readPeek(s), {});
  assert.deepEqual(readPeek(memory({ family_peek_v1: '[1]' })), {});
});

test('store writes nothing for an empty list on a fresh tablet', () => {
  const s = memory();
  store(s, clock(2026, 10, 4), []);
  assert.equal(s.data[PEEK], undefined);
});

test('Grade 2 last seen pairs Filipino with English', () => {
  assert.equal(TEXT.grade2.seen('2 h ago'), 'huling nakita 2 h ago · last seen 2 h ago');
  assert.equal(TEXT.grade5.seen('2 h ago'), 'last seen 2 h ago');
});

test('sisters: label, buddy, playing now, the last 5 news and the 💌 mark', () => {
  const now = clock(2026, 10, 4);
  const news = Array.from({ length: 7 }, (_, i) => ({ id: 'n' + i, t: now() - (7 - i) * 60000, kind: 'quests' }));
  const fam = { v: 1, at: now() - 4 * 60000, news, sent: [] };
  const list = sisters(ME, peekOf(now, fam, { ana: { profile: { grade: 5 } } }), now(), null);
  assert.equal(list.length, 1, 'never myself');
  const m = list[0];
  assert.deepEqual([m.id, m.rel, m.name, m.grade, m.avatar, m.playing, m.total, m.hasNews], ['mia', 'bunso', '', 2, 'rabbit', true, 3, true]);
  assert.deepEqual(m.news.map((n) => n.id), ['n6', 'n5', 'n4', 'n3', 'n2']);
  now.mins(2);
  assert.equal(sisters(ME, peekOf(now, fam), now(), null)[0].playing, false, '5 minutes after her last visit');
  assert.equal(sisters(ME, peekOf(now, Object.assign({}, fam, { at: now() + 3600000 })), now(), null)[0].playing, false, 'her clock is ahead');
  assert.equal(sisters(ME, peekOf(now, fam), now(), { news: { mia: news[6].t } })[0].hasNews, false, 'seen');
  assert.equal(sisters(ME, peekOf(now, null), now(), null)[0].hasNews, false, 'no family data yet');
});

test('unseen cheers to me, in her words, oldest first; unknown ids and cheers to others are skipped', () => {
  const now = clock(2026, 10, 4);
  const fam = { v: 1, at: 0, news: [], sent: [
    { id: 'c3', t: 300, to: 'ana', cheer: 'love' },
    { id: 'c2', t: 200, to: 'ana', cheer: 'hug' },
    { id: 'c1', t: 100, to: 'ana', cheer: 'great' },
    { id: 'c0', t: 50, to: 'leo', cheer: 'great' }] };
  const got = unseenCheers(ME, peekOf(now, fam), null);
  assert.deepEqual(got.map((c) => [c.from, c.rel, c.t, c.text]),
    [['mia', 'bunso', 100, "Galing mo, Ate! · You're great! 🌟"], ['mia', 'bunso', 300, 'Love kita, Ate! · Love you! 🤗']]);
  assert.deepEqual(unseenCheers(ME, peekOf(now, fam), { cheers: 100 }).map((c) => c.t), [300]);
  const fromAte = { ana: { profile: { grade: 5 }, family: { v: 1, sent: [{ id: 'x', t: 9, to: 'mia', cheer: 'great' }] } } };
  assert.deepEqual(unseenCheers({ id: 'mia', grade: 2 }, fromAte, null).map((c) => c.text), ["Galing mo, Bunso! · You're great! 💖"]);
});

test('seen marks only go forward', () => {
  const s = memory();
  markCheers(s, 300);
  markCheers(s, 100);
  markNews(s, 'mia', 50);
  markNews(s, 'mia', 20);
  assert.deepEqual(readSeen(s), { cheers: 300, news: { mia: 50 } });
  assert.deepEqual(readSeen(memory({ family_seen_v1: 'x' })), { cheers: 0, news: {} });
});

test('news lines name the subject and never show scores', () => {
  const SUBJ = { 5: [{ app: 'life-lab', title: 'Science' }], 2: [{ app: 'block-bot', title: 'Math' }] };
  const t5 = TEXT.grade5, t2 = TEXT.grade2;
  assert.equal(newsLine(t5, { kind: 'medal', app: 'block-bot', tier: 1, title: 'Skip Counting' }, SUBJ), '🥉 Bronze in Math: Skip Counting');
  assert.equal(newsLine(t5, { kind: 'medal', app: 'gone-app', tier: 3 }, SUBJ), '🥇 Gold in gone-app');
  assert.equal(newsLine(t5, { kind: 'boss', app: 'life-lab' }, SUBJ), '⚔️ Cleared a boss stage in Science');
  assert.equal(newsLine(t5, { kind: 'quests' }, SUBJ), '✅ Did all 3 quests today');
  assert.equal(newsLine(t5, { kind: 'streak', n: 14 }, SUBJ), '🔥 14-day streak');
  assert.equal(newsLine(t2, { kind: 'medal', app: 'life-lab', tier: 2, title: 'Plants' }, SUBJ), '🥈 Silver sa Science · Silver in Science: Plants');
  assert.equal(newsLine(t2, { kind: 'streak', n: 7 }, null), '🔥 7 araw na sunod-sunod · a 7-day streak');
  assert.equal(ago(1000, 1000 + 30000), 'just now');
  assert.equal(ago(0, 5 * 60000), '5 min ago');
  assert.equal(ago(0, 2 * 3600000), '2 h ago');
  assert.equal(ago(0, 24 * 3600000), '1 day ago');
  assert.equal(ago(0, 3 * 24 * 3600000), '3 days ago');
  const junk = newsLine(t5, { kind: 'medal', app: {}, tier: 1.5, title: 5 }, SUBJ);
  assert.equal(junk, '🥉 Bronze in ');
  assert.ok(!/undefined|object/i.test(junk + newsLine(t5, { kind: 'streak', n: 'x' }, SUBJ) + newsLine(t5, { kind: 'boss', app: [] }, SUBJ)));
  assert.equal(newsLine(t5, { kind: 'streak', n: 'x' }, SUBJ), '🔥 0-day streak');
  assert.equal(t5.count(1, 'Bunso'), '💖 1 cheer from Bunso');
  assert.equal(t5.count(12, 'Bunso'), '💖 12 cheers from Bunso');
});

// A game page: Family has note and touch, and nothing is drawn.
function page(opts) {
  const s = memory();
  const win = {
    document: {
      currentScript: { getAttribute: (k) => (k === 'data-grade' ? 'grade5' : null) },
      visibilityState: opts.hidden ? 'hidden' : 'visible',
      getElementById: () => null,
      addEventListener() {},
    },
    Learner: { storage: s, current: () => ({ id: 'ana', grade: 5 }) },
    Clock: { paused: () => !!opts.paused },
    setTimeout,
    clearTimeout,
  };
  win.window = win;
  vm.createContext(win);
  vm.runInContext(fs.readFileSync(engineFile('family.js'), 'utf8'), win);
  return { win, s };
}

test('in a game, Family.note writes news unless the date guard is on; touch skips a hidden page', () => {
  const p = page({});
  assert.equal(p.win.Family.note('quests'), true);
  assert.equal(JSON.parse(p.s.data.family_v1).news.length, 1);
  assert.equal(page({ paused: true }).win.Family.note('quests'), false);
  assert.equal(page({ hidden: true }).win.Family.touch(), false);
  assert.equal(p.win.Family.touch(), true);
});

test('without data-grade, Family has the helpers only', () => {
  const win = {};
  win.window = win;
  vm.createContext(win);
  vm.runInContext(fs.readFileSync(engineFile('family.js'), 'utf8'), win);
  assert.equal(typeof win.Family.sisters, 'function');
  assert.equal(win.Family.note, undefined);
});

test('store keeps her 3D look (avatar_v1 arrives as saved JSON text); sisters hand it on', () => {
  const s = memory(), now = clock(2026, 10, 6);
  const look = { v: 1, body: 'girl', skin: 1, hair: 'bob', hairColor: 2, outfit: 3, pet: 'puppy', petName: '', t: 9 };
  store(s, now, [{ id: 'mia', state: { profile_v1: { grade: 2 }, avatar_v1: JSON.stringify(look) }, counters: {} }]);
  assert.deepEqual(readPeek(s).mia.look, look);
  assert.deepEqual(sisters(ME, readPeek(s), now(), null)[0].look, look);
  store(s, now, [{ id: 'mia', state: { profile_v1: { grade: 2 }, avatar_v1: '[1]' }, counters: {} }]);
  assert.equal(sisters(ME, readPeek(s), now(), null)[0].look, null, 'junk reads as no look yet');
  assert.equal(sisters(ME, peekOf(now, null), now(), null)[0].look, null, 'an older peek has no look');
});

test('store keeps her sister\'s house (house_v1 comes as an object, or as text from an older copy); sisters hand it on', () => {
  const s = memory(), now = clock(2026, 10, 8);
  const house = { v: 1, owned: {}, earned: {}, deskRight: 0, room: { at: 3, placed: [], wall: 'home-wall-blue', floor: 'home-floor-wood', stars: false }, seen: { at: 3, size: 5, trophies: {} } };
  store(s, now, [{ id: 'mia', state: { profile_v1: { grade: 2 }, house_v1: house }, counters: {} }]);
  assert.deepEqual(readPeek(s).mia.house, house);
  assert.deepEqual(sisters(ME, readPeek(s), now(), null)[0].house, house);
  store(s, now, [{ id: 'mia', state: { profile_v1: { grade: 2 }, house_v1: JSON.stringify(house) }, counters: {} }]);
  assert.deepEqual(readPeek(s).mia.house, house);
  store(s, now, [{ id: 'mia', state: { profile_v1: { grade: 2 }, house_v1: '[1]' }, counters: {} }]);
  assert.equal(sisters(ME, readPeek(s), now(), null)[0].house, null, 'junk reads as no house yet');
  assert.equal(sisters(ME, peekOf(now, null), now(), null)[0].house, null, 'an older peek has no house');
});

test('cheers to a boy say Kuya; ids and the Ate side stay the same', () => {
  const toKuya = cheersFor('fromBunso', true);
  assert.deepEqual(toKuya.map((c) => c.id), CHEERS.fromBunso.map((c) => c.id));
  assert.equal(toKuya[0].text, 'Galing mo, Kuya! · You\'re great! 🌟');
  assert.ok(toKuya.every((c) => !/\bAte\b/.test(c.text)));
  assert.deepEqual(cheersFor('fromBunso', false), CHEERS.fromBunso);
  assert.deepEqual(cheersFor('fromAte', true), CHEERS.fromAte, 'Bunso is the same word for a boy');
});

test('a boy sibling: rel, boy, and the his/him words', () => {
  const peek = { ben: { profile: { name: 'Ben', grade: 5, boy: true } }, mia: { profile: { name: 'Mia', grade: 5 } } };
  const list = sisters({ id: 'me', grade: 2 }, peek, 0, {});
  assert.deepEqual(list.map((s) => [s.id, s.rel, s.boy]), [['ben', 'kuya', true], ['mia', 'ate', false]]);
  assert.equal(TEXT.grade5.kuya, 'Kuya');
  assert.equal(TEXT.grade5.brother, 'Brother');
  assert.equal(TEXT.grade2.brother, 'Kapatid · Brother');
  assert.match(TEXT.grade5.buddy('Ben', true), /his big moments/);
  assert.match(TEXT.grade5.buddy('Mia', false), /her big moments/);
  assert.equal(TEXT.grade5.noNewsBoy, 'No big moments yet. Cheer him on!');
  assert.equal(TEXT.grade2.noNewsBoy, 'Wala pa. I-cheer mo siya! · No big moments yet. Go and cheer him on!');
});

test('olderIsBoy: only when every older sibling is a boy', () => {
  const me = { id: 'me', grade: 2 };
  assert.equal(olderIsBoy(me, {}), false);
  assert.equal(olderIsBoy(me, { ben: { profile: { grade: 5, boy: true } } }), true);
  assert.equal(olderIsBoy(me, { ben: { profile: { grade: 5, boy: true } }, mia: { profile: { grade: 5 } } }), false);
  assert.equal(olderIsBoy(me, { tom: { profile: { grade: 2, boy: true } } }), false, 'same grade is not older');
});

test('unseen cheers from a younger sibling to a boy say Kuya', () => {
  const peek = { mia: { profile: { grade: 2 }, family: { v: 1, sent: [{ id: 'x', t: 9, to: 'ben', cheer: 'great' }] } } };
  assert.deepEqual(unseenCheers({ id: 'ben', grade: 5, boy: true }, peek, null).map((c) => c.text), ['Galing mo, Kuya! · You\'re great! 🌟']);
  assert.deepEqual(unseenCheers({ id: 'ben', grade: 5 }, peek, null).map((c) => c.text), ['Galing mo, Ate! · You\'re great! 🌟']);
});
