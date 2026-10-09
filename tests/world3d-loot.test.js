const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { worldFile, WORLD_FILES } = require('./paths.js');
const Loot = require(worldFile('loot.js'));
const Layout = require(worldFile('layout.js'));
const Items = require(worldFile('items.js'));

function memory(initial) {
  const data = Object.assign({}, initial);
  return { data, getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); } };
}
function seq(...xs) { let i = 0; return () => xs[i++ % xs.length]; }

test('coins: Easy 1, Medium 2, Hard 3, at most 15 world coins a day', () => {
  assert.deepEqual(Loot.COINS, { easy: 1, medium: 2, hard: 3 });
  assert.equal(Loot.CAP, 15);
  const s = memory();
  let paid = 0;
  for (let i = 0; i < 10; i++) {
    const n = Loot.room(s, 'd1', 'hard');
    Loot.paid(s, 'd1', n, 1);
    paid += n;
  }
  assert.equal(paid, 15);
  assert.equal(Loot.room(s, 'd1', 'easy'), 0, 'full for today');
  assert.equal(Loot.room(s, 'd2', 'hard'), 3, 'a new day starts again');
});

test('the cap leaves the last coins: 14 paid, a Hard one pays 1', () => {
  const s = memory();
  Loot.paid(s, 'd', 14, 1);
  assert.equal(Loot.room(s, 'd', 'hard'), 1);
});

test('asked today: kept for the day, cleared on a new day; bad loot_v1 reads empty', () => {
  const s = memory();
  Loot.markAsked(s, 'd1', 'a|1', 5);
  Loot.markAsked(s, 'd1', 'a|1', 6);
  assert.deepEqual(Loot.read(s, 'd1').asked, ['a|1']);
  assert.deepEqual(Loot.read(s, 'd2').asked, []);
  assert.deepEqual(Loot.read(memory({ loot_v1: '{nope' }), 'd1'), { v: 1, day: 'd1', coins: 0, asked: [], t: 0 });
  assert.equal(Loot.read(memory({ loot_v1: JSON.stringify({ v: 1, day: 'd1', coins: 99, asked: [3, 'k'] }) }), 'd1').coins, 15);
  assert.deepEqual(Loot.read(memory({ loot_v1: JSON.stringify({ v: 1, day: 'd1', coins: 2, asked: [3, 'k'] }) }), 'd1').asked, ['k']);
});

test('tiers from her review boxes: Hard = due in box 1, Medium = due higher, Easy = never answered, resting never', () => {
  assert.equal(Loot.tierOf({ status: 'due', box: 1 }), 'hard');
  assert.equal(Loot.tierOf({ status: 'due', box: 3 }), 'medium');
  assert.equal(Loot.tierOf({ status: 'new', box: 0 }), 'easy');
  assert.equal(Loot.tierOf({ status: 'rest', box: 2 }), null);
});

test('choose: Hard before Medium before Easy, never one asked today', () => {
  const c = [{ key: 'e', tier: 'easy' }, { key: 'm', tier: 'medium' }, { key: 'h', tier: 'hard' }];
  assert.equal(Loot.choose(c, [], () => 0).key, 'h');
  assert.equal(Loot.choose(c, ['h'], () => 0).key, 'm');
  assert.equal(Loot.choose(c, ['h', 'm'], () => 0).key, 'e');
  assert.equal(Loot.choose(c, ['h', 'm', 'e'], () => 0), null);
});

test('found items: one she does not own, none once she has them all', () => {
  const ids = Items.FOUND.map((i) => i.id);
  const owned = Object.fromEntries(ids.slice(1).map((id) => [id, { t: 1 }]));
  assert.equal(Loot.foundPick(ids, owned, () => 0.99), ids[0]);
  assert.equal(Loot.foundPick(ids, Object.fromEntries(ids.map((id) => [id, { t: 1 }])), () => 0), null);
});

test('timers: the first gift at 60 s then every 3-5 min, at most 3; monsters at 90 s then 2-4 min, at most 2', () => {
  const g = Loot.timer(Loot.GIFT, () => 0.5);
  assert.equal(g.due(59, 0), false);
  assert.equal(g.due(1, 0), true);
  assert.equal(g.left(), 240);
  assert.equal(g.due(240, 3), false, 'three on the map: none comes, the wait starts again');
  assert.equal(g.left(), 240);
  assert.equal(g.due(240, 2), true);
  assert.deepEqual([Loot.GIFT.first, Loot.GIFT.min, Loot.GIFT.max, Loot.GIFT.most], [60, 180, 300, 3]);
  assert.deepEqual([Loot.MONSTER.first, Loot.MONSTER.min, Loot.MONSTER.max, Loot.MONSTER.most], [90, 120, 240, 2]);
});

test('spots: a hangout place, never the playground, away from her and free', () => {
  for (const grade of ['grade5', 'grade2']) {
    const hangouts = Layout.walkways(grade).hangouts, obs = Layout.obstacles(grade), b = Layout.GRADES[grade].bounds;
    const blocked = (x, z, r) => Layout.blocked(obs, b, x, z, r);
    let r = 0.123;
    const rand = () => { r = (r * 9301 + 49297) % 233280 / 233280; return r; };
    for (let i = 0; i < 200; i++) {
      const her = { x: 0, z: 0 }, p = Loot.spot(hangouts, her, 20, rand, blocked);
      assert.ok(p, grade);
      assert.notEqual(p.place, 'playground');
      assert.ok(Loot.PLACES.includes(p.place));
      assert.ok(Math.hypot(p.x, p.z) >= 20, 'away from her');
      assert.equal(blocked(p.x, p.z, 1.2), false);
    }
  }
});

test('wander: walks to a point of its place, rests, and never walks into a wall', () => {
  const area = { id: 'park', x: 0, z: 0, r: 5 };
  const m = { x: 0, z: 0, area, wait: 0, face: 0 };
  let moved = 0;
  for (let i = 0; i < 2000; i++) {
    if (Loot.wander(m, 0.05, Math.random, () => false)) moved++;
    assert.ok(Math.hypot(m.x, m.z) <= 5.01, 'inside its place');
  }
  assert.ok(moved > 100, 'it walks');
  const stuck = { x: 0, z: 0, area, wait: 0 };
  for (let i = 0; i < 50; i++) Loot.wander(stuck, 0.05, Math.random, () => true);
  assert.deepEqual([stuck.x, stuck.z], [0, 0]);
});

test('a helper pops in a few steps away, on a free spot', () => {
  const h = Loot.helperSpot({ x: 0, z: 0, face: 0 }, () => false);
  assert.ok(Math.abs(Math.hypot(h.x, h.z) - 3) < 1e-9);
  const h2 = Loot.helperSpot({ x: 0, z: 0, face: 0 }, (x) => x > 0);
  assert.ok(h2.x <= 0);
});

test('Grade 2 lines are Filipino · English pairs; both grades have the same words; buttons stay English', () => {
  const g2 = Loot.TEXT.grade2, g5 = Loot.TEXT.grade5;
  assert.deepEqual(Object.keys(g2).sort(), Object.keys(g5).sort());
  const it = Items.FOUND[0];
  for (const s of [g2.title, g2.gift, g2.thinking, g2.giftAsk, g2.opened, g2.earned, g2.capped, g2.stillClosed, g2.none, g2.fail,
    g2.defeated, g2.called, g2.helperBye, g2.monsterNone, g2.points(5), g2.coins(2), g2.found(it)].concat(g2.hello, Object.values(g2.tiers))) {
    assert.match(s, / · /, s);
  }
  assert.equal(g5.coins(1), '🪙 You got 1 coin!');
  assert.equal(g5.points(0), '');
  for (const b of Object.values(Loot.BUTTONS)) assert.ok(!b.includes(' · '), b);
  assert.equal(g2.hello.length, g5.hello.length);
});

test('4 monster kinds with a name, a face and colours', () => {
  assert.deepEqual(Loot.KINDS.map((k) => k.id), ['grumble', 'sniffle', 'muddle', 'fizzle']);
  for (const k of Loot.KINDS) assert.ok(k.name && k.face && /^#/.test(k.color) && /^#/.test(k.accent) && /^#/.test(k.eye), k.id);
});

test('wiring: loot files load in order; world-main pays through the wallet and saves found items; wrong answers go to the pet', () => {
  const at = (f) => WORLD_FILES.indexOf(f);
  assert.ok(at('quiz.js') < at('loot.js') && at('items.js') < at('loot.js'));
  assert.ok(at('mates3d.js') < at('loot3d.js') && at('loot3d.js') < at('world-main.js'));
  for (const f of ['ask.js', 'talk.js', 'cast.js', 'teach.js']) assert.ok(at(f) < at('loot3d.js'), f);
  const main = fs.readFileSync(worldFile('world-main.js'), 'utf8'), l3 = fs.readFileSync(worldFile('loot3d.js'), 'utf8');
  assert.match(main, /W\.Loot3D\.create\(/);
  assert.match(main, /root\.Wallet\.addBonus\(n\)/);
  assert.match(main, /W\.Closet\.found\(store, id, Date\.now\(\)\)/);
  assert.match(main, /pal\.hit\(x, y\) \|\| loot\.hit\(x, y\)/);
  assert.match(main, /loot\.tick\(t, dt, st, !free \|\| !!pose\)/);
  assert.match(l3, /o\.teach\(v, opt, function \(\) \{ sayGift\(LT\.stillClosed/);
  assert.match(l3, /Loot\.markAsked\(o\.store, today, q\.key/);
  assert.match(l3, /asker\.answer\(list, 0, j\)/, 'scored like Ask me!');
  assert.ok(!/quizFinished/.test(l3), 'never finishes a quiz, so quests do not tick');
  assert.match(l3, /if \(!mon\.helper\)/, 'a helper never calls another');
});

test('Closet.found adds a found item with 0 coins, once', () => {
  const Closet = require(worldFile('closet.js'));
  const s = memory();
  assert.equal(Closet.found(s, 'moonsticker', 7), true);
  assert.deepEqual(Closet.read(s), { moonsticker: { t: 7, coins: 0 } });
  assert.equal(Closet.found(s, 'moonsticker', 9), true);
  assert.equal(Closet.read(s).moonsticker.t, 7);
});
