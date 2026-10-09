const test = require('node:test');
const assert = require('node:assert/strict');
const { engineFile } = require('./paths.js');
const { space } = require(engineFile('storage.js'));
const { create, MERGE, kindOf } = require(engineFile('sync-core.js'));

function raw() {
  const data = {};
  return {
    data,
    getItem(k) { return k in data ? data[k] : null; },
    setItem(k, v) { data[k] = String(v); },
    removeItem(k) { delete data[k]; },
    key(i) { return Object.keys(data)[i] ?? null; },
    get length() { return Object.keys(data).length; },
  };
}

// An in-memory Firestore: state docs, counters and history docs per learner, each stamped with a rising clock.
function fakeCloud() {
  let clock = 0;
  const db = {};
  const L = (id) => (db[id] = db[id] || { state: {}, counters: {}, history: {} });
  const copy = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
  const cloud = {
    db,
    offline: false,
    learners: async () => Object.keys(db).map((id) => ({ id, profile: copy(L(id).state.profile_v1?.value) })),
    olderCalls: 0,
    pull: async (id, since, historyMs) => {
      if (cloud.offline) throw new Error('offline');
      const l = L(id);
      const pick = (o, from, f) => Object.entries(o).filter(([, d]) => d.at >= from).map(([key, d]) => f(key, d));
      return {
        state: pick(l.state, since, (key, d) => ({ key, value: copy(d.value) })),
        counters: pick(l.counters, since, (key, d) => ({ key, total: d.total })),
        history: pick(l.history, Math.max(since, historyMs || 0), (key, d) => ({ id: key, entry: copy(d.entry) })),
        until: clock,
      };
    },
    pullOlder: async (id, before) => {
      if (cloud.offline) throw new Error('offline');
      cloud.olderCalls++;
      return { history: Object.entries(L(id).history).filter(([, d]) => d.at < before).map(([key, d]) => ({ id: key, entry: copy(d.entry) })) };
    },
    merge: async (id, key, local, fn) => {
      if (cloud.offline) throw new Error('offline');
      const doc = L(id).state[key];
      const merged = fn(copy(local), doc ? copy(doc.value) : null);
      L(id).state[key] = { value: copy(merged), at: ++clock };
      return merged;
    },
    add: async (id, key, delta) => {
      if (cloud.offline) throw new Error('offline');
      const doc = (L(id).counters[key] = L(id).counters[key] || { total: 0 });
      doc.total += delta;
      doc.at = ++clock;
      return doc.total;
    },
    putHistory: async (id, docs) => {
      if (cloud.offline) throw new Error('offline');
      for (const d of docs) L(id).history[d.id] = { entry: copy(d.entry), at: ++clock };
    },
    peek: async (id, keys, counters) => {
      if (cloud.offline) throw new Error('offline');
      const l = L(id);
      return {
        state: Object.fromEntries(keys.map((k) => [k, l.state[k] ? copy(l.state[k].value) : null])),
        counters: Object.fromEntries(counters.map((k) => [k, l.counters[k] ? l.counters[k].total : 0])),
      };
    },
  };
  return cloud;
}

let t = 1000;
const now = () => t++;
function device(cloud, id = 'ana') {
  const s = space(raw(), id, now);
  return { s, sync: () => create(s, cloud, id).sync() };
}
const pts = (d, k = 'riseshine_points_v1') => parseInt(d.s.getItem(k), 10) || 0;
const wallet = (d) => JSON.parse(d.s.getItem('wallet_v1'));
const history = (d) => JSON.parse(d.s.getItem('history_v1')).entries.map((e) => e.id);

function seedTablet(d) {
  d.s.setItem('profile_v1', JSON.stringify({ name: 'Ana', emoji: '🌻', grade: 5, at: 1 }));
  d.s.setItem('riseshine_points_v1', '420');
  d.s.setItem('wallet_v1', JSON.stringify({ v: 1, baselines: { riseshine_points_v1: 100 }, spent: 30, bonus: 50, purchases: [{ t: 5, item: 'ml', coins: 40 }], oldPointsCounted: true, rateFrom: { riseshine_points_v1: 100 } }));
  d.s.setItem('history_v1', JSON.stringify({ v: 1, entries: [{ id: 'h1', type: 'open', app: 'rise-shine', t: 10 }] }));
  d.s.setItem('recall_v1', JSON.stringify({ v: 1, rest: { q1: '2026-10-01' } }));
  d.s.setItem('riseshine_progress_v1', JSON.stringify({ myself: 9 }));
  d.s.setItem('riseshine_progress_v1_day', '2026-10-2');
  d.s.setItem('last_backup_v1', '123');
}

test('the first sync uploads her tablet, and a second device gets everything back', async () => {
  const cloud = fakeCloud();
  const a = device(cloud), b = device(cloud);
  seedTablet(a);
  await a.sync();
  assert.deepEqual(a.s.outbox(), {}, 'outbox cleared after a good sync');
  await b.sync();
  assert.equal(pts(b), 420);
  assert.deepEqual(wallet(b), wallet(a));
  assert.deepEqual(wallet(b).rateFrom, { riseshine_points_v1: 100 });
  assert.deepEqual(history(b), ['h1']);
  assert.deepEqual(JSON.parse(b.s.getItem('recall_v1')).rest, { q1: '2026-10-01' });
  assert.deepEqual(JSON.parse(b.s.getItem('riseshine_progress_v1')), { myself: 9 });
  assert.equal(JSON.parse(b.s.getItem('profile_v1')).name, 'Ana');
  assert.equal(b.s.getItem('last_backup_v1'), null, 'device-only keys never leave the tablet');
});

test('points earned offline on two devices add up', async () => {
  const cloud = fakeCloud();
  const a = device(cloud), b = device(cloud);
  seedTablet(a);
  await a.sync();
  await b.sync();
  a.s.setItem('riseshine_points_v1', String(pts(a) + 30));
  b.s.setItem('riseshine_points_v1', String(pts(b) + 20));
  b.s.setItem('lifelab_points_v1', '15');
  await a.sync();
  await b.sync();
  await a.sync();
  assert.equal(pts(a), 470);
  assert.equal(pts(b), 470);
  assert.equal(pts(a, 'lifelab_points_v1'), 15);
});

test('coins spent and bonuses on two devices add up, and both keep every purchase', async () => {
  const cloud = fakeCloud();
  const a = device(cloud), b = device(cloud);
  seedTablet(a);
  await a.sync();
  await b.sync();
  const spend = (d, coins, item, at) => {
    const w = wallet(d);
    w.spent += coins;
    w.purchases.push({ t: at, item, coins });
    d.s.setItem('wallet_v1', JSON.stringify(w));
  };
  spend(a, 40, 'ml', 100);
  spend(b, 60, 'dinner', 200);
  const w = wallet(b); w.bonus += 30; b.s.setItem('wallet_v1', JSON.stringify(w));
  await a.sync(); await b.sync(); await a.sync();
  for (const d of [a, b]) {
    assert.equal(wallet(d).spent, 130);
    assert.equal(wallet(d).bonus, 80);
    assert.deepEqual(wallet(d).purchases.map((p) => p.item), ['ml', 'ml', 'dinner']);
    assert.deepEqual(wallet(d).baselines, { riseshine_points_v1: 100 });
  }
});

test('points earned while a sync is sending stay on top of the new total', async () => {
  const cloud = fakeCloud();
  const a = device(cloud);
  seedTablet(a);
  const realAdd = cloud.add;
  cloud.add = async (id, key, delta) => {
    const total = await realAdd(id, key, delta);
    if (key === 'riseshine_points_v1') a.s.setItem(key, String(pts(a) + 15));
    return total;
  };
  await a.sync();
  assert.equal(pts(a), 435);
  cloud.add = realAdd;
  await a.sync();
  assert.equal(cloud.db.ana.counters.riseshine_points_v1.total, 435);
});

test('history from both devices merges, and a deletion reaches the other device', async () => {
  const cloud = fakeCloud();
  const a = device(cloud), b = device(cloud);
  seedTablet(a);
  await a.sync(); await b.sync();
  const add = (d, e) => { const h = JSON.parse(d.s.getItem('history_v1')); h.entries.push(e); d.s.setItem('history_v1', JSON.stringify(h)); };
  add(a, { id: 'a1', type: 'open', t: 20 });
  add(b, { id: 'b1', type: 'open', t: 15 });
  await a.sync(); await b.sync(); await a.sync();
  assert.deepEqual(history(a), ['h1', 'b1', 'a1'], 'sorted by time');
  assert.deepEqual(history(b), ['h1', 'b1', 'a1']);
  const h = JSON.parse(a.s.getItem('history_v1'));
  h.entries = h.entries.filter((e) => e.id !== 'h1');
  a.s.setItem('history_v1', JSON.stringify(h));
  await a.sync(); await b.sync();
  assert.deepEqual(history(b), ['b1', 'a1'], 'the parent deleted it on one device');
});

test('a quiz entry that keeps changing is sent again only when it changes', async () => {
  const cloud = fakeCloud();
  const a = device(cloud);
  seedTablet(a);
  await a.sync();
  const atBefore = cloud.db.ana.history.h1.at;
  await a.sync();
  assert.equal(cloud.db.ana.history.h1.at, atBefore, 'unchanged entry not resent');
  const h = JSON.parse(a.s.getItem('history_v1'));
  h.entries[0].answered = 3;
  a.s.setItem('history_v1', JSON.stringify(h));
  await a.sync();
  assert.equal(cloud.db.ana.history.h1.entry.answered, 3);
});

test('stars: the same day keeps the best per lesson, a newer day wins', () => {
  assert.deepEqual(MERGE.progress({ day: '2026-10-2', stars: { a: 3, b: 1 } }, { day: '2026-10-2', stars: { a: 2, b: 2, c: 1 } }),
    { day: '2026-10-2', stars: { a: 3, b: 2, c: 1 } });
  assert.deepEqual(MERGE.progress({ day: '2026-10-3', stars: { a: 1 } }, { day: '2026-10-2', stars: { a: 3 } }), { day: '2026-10-3', stars: { a: 1 } });
  assert.deepEqual(MERGE.progress({ day: '2026-9-30', stars: { a: 3 } }, { day: '2026-10-1', stars: {} }), { day: '2026-10-1', stars: {} });
});

test('rest-days keep the latest date per question', () => {
  assert.deepEqual(MERGE.recall({ v: 1, rest: { q1: '2026-10-01', q2: '2026-09-01' } }, { v: 1, rest: { q1: '2026-09-28', q3: '2026-10-02' } }).rest,
    { q1: '2026-10-01', q2: '2026-09-01', q3: '2026-10-02' });
});

test('her name: the latest change wins; her grade never goes back', () => {
  assert.deepEqual(MERGE.profile({ name: 'Ana', emoji: '🌻', grade: 5, at: 9 }, { name: 'Anna', emoji: '', grade: 6, at: 3 }),
    { name: 'Ana', emoji: '🌻', grade: 6, at: 9 });
});

test('boy: the newer copy decides, and a girl\'s merged profile has no boy key', () => {
  assert.deepEqual(MERGE.profile({ name: 'Ben', emoji: '', grade: 5, at: 9, boy: true }, { name: 'Ben', emoji: '', grade: 5, at: 3 }),
    { name: 'Ben', emoji: '', grade: 5, at: 9, boy: true });
  assert.deepEqual(MERGE.profile({ name: 'Ana', emoji: '', grade: 5, at: 9 }, { name: 'Ana', emoji: '', grade: 5, at: 3, boy: true }),
    { name: 'Ana', emoji: '', grade: 5, at: 9 });
});

test('a rename on one device reaches the other', async () => {
  const cloud = fakeCloud();
  const a = device(cloud), b = device(cloud);
  seedTablet(a);
  await a.sync(); await b.sync();
  b.s.setItem('profile_v1', JSON.stringify({ name: 'Ana B.', emoji: '🌻', grade: 5, at: 50 }));
  await b.sync(); await a.sync();
  assert.equal(JSON.parse(a.s.getItem('profile_v1')).name, 'Ana B.');
});

test('if the cloud cannot be reached, nothing is lost and the outbox waits for the next try', async () => {
  const cloud = fakeCloud();
  const a = device(cloud);
  seedTablet(a);
  cloud.offline = true;
  await assert.rejects(a.sync());
  assert.ok(Object.keys(a.s.outbox()).length > 0);
  assert.equal(pts(a), 420);
  cloud.offline = false;
  await a.sync();
  assert.deepEqual(a.s.outbox(), {});
  assert.equal(cloud.db.ana.counters.riseshine_points_v1.total, 420);
});

test('syncing twice in a row changes nothing', async () => {
  const cloud = fakeCloud();
  const a = device(cloud), b = device(cloud);
  seedTablet(a);
  await a.sync(); await b.sync(); await a.sync(); await b.sync();
  assert.equal(pts(a), 420);
  assert.equal(pts(b), 420);
  assert.equal(wallet(b).spent, 30);
  assert.deepEqual(history(b), ['h1']);
});

test('which keys sync, and how', () => {
  assert.equal(kindOf('riseshine_points_v1'), 'counter');
  assert.equal(kindOf('review_v1'), 'review');
  assert.equal(kindOf('kuwentista_progress_v2_day'), 'progress');
  assert.equal(kindOf('last_backup_v1'), null);
  assert.equal(kindOf('history_corrupt_v1_5'), null);
  assert.equal(kindOf('sync_state_v1'), null);
  assert.equal(kindOf('coin_guide_seen_v1'), 'flag');
});

const { plan } = require(engineFile('sync-core.js'));
const ANA = { id: 'ana', profile: { name: 'Ana', grade: 5 } };
const BEA = { id: 'bea', profile: { name: 'Bea', grade: 2 } };

test('first sign-in: her own tablet uploads itself when the cloud has no one of her grade', () => {
  assert.deepEqual(plan({ id: 'x', grade: 5 }, ['profile_v1', 'riseshine_points_v1'], [BEA]), { action: 'upload' });
  assert.deepEqual(plan({ id: 'x', grade: 5 }, ['profile_v1'], []), { action: 'upload' });
});

test('first sign-in: a device already in the cloud just carries on', () => {
  assert.deepEqual(plan({ id: 'ana', grade: 5 }, ['riseshine_points_v1'], [ANA, BEA]), { action: 'linked' });
});

test('first sign-in: a new or wiped device asks which child it is', () => {
  assert.deepEqual(plan({ id: 'new', grade: 5 }, ['profile_v1', 'sync_outbox_v1'], [ANA, BEA]), { action: 'choose', candidates: [ANA, BEA], keep: false });
});

test('first sign-in: a device with data of a grade already in the cloud asks "Is this Ana?"', () => {
  assert.deepEqual(plan({ id: 'x', grade: 5 }, ['riseshine_points_v1'], [ANA, BEA]), { action: 'choose', candidates: [ANA], keep: true });
});

test('the Firestore rules let the signed-in family read and write its own data, and the owner only read', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const rules = fs.readFileSync(path.join(__dirname, '..', 'firebase', 'firestore.rules'), 'utf8').replace(/\s+/g, ' ');
  assert.match(rules, /match \/families\/\{uid\}\/\{document=\*\*\} \{ allow read: if isOwner\(\); allow read, write: if request\.auth != null && request\.auth\.uid == uid; \}/);
  assert.equal((rules.match(/allow /g) || []).length, 4, 'no other allow rules');
  assert.equal((rules.match(/allow read, write:/g) || []).length, 2, 'only the family writes');
});

const DAY = 86400000;
const req = (status, at, t = 100) => ({ v: 1, list: { r1: { item: 'ml', name: 'Mobile Legends', emoji: '', coins: 40, t, status, at } } });

test('shop_requests_v1 syncs with its own merge rule', () => {
  assert.equal(kindOf('shop_requests_v1'), 'requests');
});

test('shop requests: the copy further along wins, in either order', () => {
  const cases = [
    ['waiting', 'approved', 'approved'],
    ['approved', 'done', 'done'],
    ['approved', 'cancelled', 'cancelled'],
    ['waiting', 'declined', 'declined'],
    ['approved', 'short', 'short'],
  ];
  for (const [a, b, want] of cases) {
    assert.equal(MERGE.requests(req(a, 1), req(b, 2)).list.r1.status, want, a + ' + ' + b);
    assert.equal(MERGE.requests(req(b, 2), req(a, 1)).list.r1.status, want, b + ' + ' + a);
  }
});

test('shop requests: at the same step, the later answer wins', () => {
  assert.equal(MERGE.requests(req('approved', 5), req('declined', 9)).list.r1.status, 'declined');
  assert.equal(MERGE.requests(req('declined', 9), req('approved', 5)).list.r1.status, 'declined');
});

test('shop requests: both devices\' requests are kept, and ones a week older than the newest are dropped', () => {
  const a = { v: 1, list: { old: { item: 'ml', coins: 40, t: 0, status: 'done', at: 1 } } };
  const b = { v: 1, list: { r2: { item: 'ml', coins: 40, t: 3 * DAY, status: 'waiting', at: 3 * DAY } } };
  assert.deepEqual(Object.keys(MERGE.requests(a, b).list).sort(), ['old', 'r2']);
  b.list.r3 = { item: 'ml', coins: 40, t: 8 * DAY, status: 'waiting', at: 8 * DAY };
  assert.deepEqual(Object.keys(MERGE.requests(a, b).list).sort(), ['r2', 'r3']);
  assert.deepEqual(MERGE.requests(null, b), MERGE.requests(b, null));
});

test('practice_v1 syncs with its own merge rule', () => {
  assert.equal(kindOf('practice_v1'), 'practice');
});

const WEEK8 = 56 * 86400000;
const sendOf = (t, app, keys) => ({ t, app, keys });
test('Practice these sends: a union by id, the same in either order and safe to repeat', () => {
  const a = { v: 1, sends: { s1: sendOf(100, 'x', ['x|1']), same: sendOf(300, 'x', ['x|2']) } };
  const b = { v: 1, sends: { s2: sendOf(200, 'y', ['y|1']), same: sendOf(300, 'x', ['x|2', 'x|3']) } };
  const ab = MERGE.practice(a, b), ba = MERGE.practice(b, a);
  assert.deepEqual(ab, ba);
  assert.deepEqual(Object.keys(ab.sends).sort(), ['s1', 's2', 'same']);
  assert.equal(ab.v, 1);
  assert.deepEqual(MERGE.practice(ab, b), ab);
  assert.deepEqual(MERGE.practice(ab, ab), ab);
  assert.deepEqual(MERGE.practice(a, null), MERGE.practice(null, a));
  assert.deepEqual(MERGE.practice(null, null), { v: 1, sends: {} });
});

test('Practice these sends: ones 8 weeks older than the newest are dropped, junk is ignored', () => {
  const now = 1000 * 86400000;
  const a = { v: 1, sends: { fresh: sendOf(now, 'x', []), edge: sendOf(now - WEEK8, 'x', []), old: sendOf(now - WEEK8 - 1, 'x', []) } };
  const b = { v: 1, sends: { noT: { app: 'x', keys: [] }, badT: sendOf('5', 'x', []), inf: sendOf(Infinity, 'x', []),
    noApp: sendOf(now, 1, []), noKeys: { t: now, app: 'x', keys: 'x|1' }, nul: null, arr: [] } };
  assert.deepEqual(Object.keys(MERGE.practice(a, b).sends).sort(), ['edge', 'fresh']);
  assert.deepEqual(MERGE.practice('junk', { sends: 5 }), { v: 1, sends: {} });
});

test('a Practice these send on the tablet and one on the phone both reach both', async () => {
  const cloud = fakeCloud();
  const tablet = device(cloud), phone = device(cloud);
  tablet.s.setItem('practice_v1', JSON.stringify({ v: 1, sends: { t1: sendOf(100, 'math-mastery', ['math-mastery|a']) } }));
  phone.s.setItem('practice_v1', JSON.stringify({ v: 1, sends: { p1: sendOf(200, 'life-lab', ['life-lab|b']) } }));
  await tablet.sync(); await phone.sync(); await tablet.sync();
  for (const d of [tablet, phone]) {
    assert.deepEqual(Object.keys(JSON.parse(d.s.getItem('practice_v1')).sends).sort(), ['p1', 't1']);
  }
});

const ShopRequests = require(engineFile('shop-requests.js'));
const WalletLib = require(engineFile('wallet.js'));
const HistoryLib = require(engineFile('study-history.js'));

test('the parent phone is one more device: a test score added there reaches the tablet', async () => {
  const cloud = fakeCloud();
  const tablet = device(cloud);
  seedTablet(tablet);
  await tablet.sync();
  const phone = device(cloud);
  await phone.sync();
  assert.equal(wallet(phone).bonus, 50);
  assert.equal(pts(phone), 420);

  assert.ok(WalletLib.create(phone.s, now, 'grade5').addBonus(40));
  HistoryLib.create(phone.s, now, 'grade5').testScore('rise-shine', 'GMRC', 'GMRC ST1', 19, 20, 40);
  await phone.sync();
  await tablet.sync();

  assert.equal(wallet(tablet).bonus, 90);
  const entries = JSON.parse(tablet.s.getItem('history_v1')).entries;
  assert.ok(entries.some((e) => e.type === 'test' && e.testName === 'GMRC ST1' && e.coins === 40));
});

test('a shop request asked on the tablet and approved on the phone is bought on the tablet', async () => {
  const cloud = fakeCloud();
  const tablet = device(cloud);
  seedTablet(tablet);
  await tablet.sync();
  const phone = device(cloud);
  await phone.sync();

  const id = ShopRequests.create(tablet.s, now).ask({ id: 'ml', name: 'Mobile Legends', emoji: '', coins: 40 });
  await tablet.sync();
  await phone.sync();
  const onPhone = ShopRequests.create(phone.s, now);
  assert.deepEqual(onPhone.waiting().map((r) => r.id), [id]);
  assert.ok(onPhone.answer(id, true));
  await phone.sync();
  await tablet.sync();

  const bought = [];
  const out = ShopRequests.create(tablet.s, now).settle((r) => { bought.push(r.item); return 'done'; });
  assert.deepEqual(bought, ['ml']);
  assert.deepEqual(out, [{ id, status: 'done' }]);
  await tablet.sync();
  await phone.sync();
  assert.equal(ShopRequests.create(phone.s, now).get(id).status, 'done');
});

test('cancelling on the tablet beats an approval from the phone', async () => {
  const cloud = fakeCloud();
  const tablet = device(cloud);
  seedTablet(tablet);
  await tablet.sync();
  const phone = device(cloud);
  await phone.sync();

  const id = ShopRequests.create(tablet.s, now).ask({ id: 'ml', name: 'Mobile Legends', emoji: '', coins: 40 });
  await tablet.sync();
  await phone.sync();
  ShopRequests.create(tablet.s, now).cancel(id);
  ShopRequests.create(phone.s, now).answer(id, true);
  await phone.sync();
  await tablet.sync();
  await phone.sync();

  assert.equal(ShopRequests.create(tablet.s, now).get(id).status, 'cancelled');
  assert.equal(ShopRequests.create(phone.s, now).get(id).status, 'cancelled');
  assert.deepEqual(ShopRequests.create(tablet.s, now).settle(() => 'done'), []);
});

test('an approved request is bought once even when the tablet syncs more than a week later', async () => {
  const cloud = fakeCloud();
  const tablet = device(cloud);
  seedTablet(tablet);
  await tablet.sync();
  const phone = device(cloud);
  await phone.sync();

  const id = ShopRequests.create(tablet.s, now).ask({ id: 'ml', name: 'Mobile Legends', emoji: '', coins: 40 });
  await tablet.sync();
  await phone.sync();
  ShopRequests.create(phone.s, now).answer(id, true);
  await phone.sync();

  t += 8 * DAY;
  await tablet.sync();
  let buys = 0;
  const buy = () => { buys++; return 'done'; };
  ShopRequests.create(tablet.s, now).settle(buy);
  await tablet.sync();
  ShopRequests.create(tablet.s, now).settle(buy);
  await tablet.sync();

  assert.equal(buys, 1);
  assert.equal(cloud.db.ana.state.shop_requests_v1.value.list[id].status, 'done');
});

test('shop requests: a further-along copy wins even with the earlier change time', () => {
  assert.equal(MERGE.requests(req('cancelled', 1), req('approved', 2)).list.r1.status, 'cancelled');
  assert.equal(MERGE.requests(req('approved', 2), req('cancelled', 1)).list.r1.status, 'cancelled');
});

test('a change made on the device during the cloud round trip is not overwritten', async () => {
  const cloud = fakeCloud();
  const tablet = device(cloud);
  seedTablet(tablet);
  await tablet.sync();
  const id = ShopRequests.create(tablet.s, now).ask({ id: 'ml', name: 'Mobile Legends', emoji: '', coins: 40 });
  const merge = cloud.merge;
  let hook = true;
  cloud.merge = async (cid, key, local, fn) => {
    const out = await merge(cid, key, local, fn);
    if (hook && key === 'shop_requests_v1') { hook = false; ShopRequests.create(tablet.s, now).cancel(id); }
    return out;
  };
  await tablet.sync();
  assert.equal(ShopRequests.create(tablet.s, now).get(id).status, 'cancelled');
  await tablet.sync();
  assert.equal(cloud.db.ana.state.shop_requests_v1.value.list[id].status, 'cancelled');
});

test('a purchase made during the cloud round trip stays in the wallet', async () => {
  const cloud = fakeCloud();
  const tablet = device(cloud);
  seedTablet(tablet);
  await tablet.sync();
  tablet.s.setItem('wallet_v1', JSON.stringify(Object.assign(wallet(tablet), { bonus: 51 })));
  const merge = cloud.merge;
  let hook = true;
  cloud.merge = async (cid, key, local, fn) => {
    const out = await merge(cid, key, local, fn);
    if (hook && key === 'wallet_v1') {
      hook = false;
      const w = wallet(tablet);
      w.purchases.push({ t: 99, item: 'late', coins: 10 });
      tablet.s.setItem('wallet_v1', JSON.stringify(w));
    }
    return out;
  };
  await tablet.sync();
  assert.ok(wallet(tablet).purchases.some((p) => p.item === 'late'));
  await tablet.sync();
  assert.ok(cloud.db.ana.state.wallet_v1.value.purchases.some((p) => p.item === 'late'));
});

test('review boxes: the later answer wins per question, in either order', () => {
  const a = { v: 1, items: { q1: { box: 3, due: '2026-10-09', t: 200 }, q2: { box: 1, due: '2026-10-03', t: 100 } } };
  const b = { v: 1, items: { q1: { box: 1, due: '2026-10-03', t: 150 }, q2: { box: 2, due: '2026-10-05', t: 300 }, q3: { box: 2, due: '2026-10-04', t: 1 } } };
  const want = { v: 1, items: { q1: a.items.q1, q2: b.items.q2, q3: b.items.q3 } };
  assert.deepEqual(MERGE.review(a, b), want);
  assert.deepEqual(MERGE.review(b, a), want);
  assert.deepEqual(MERGE.review(MERGE.review(a, b), b), want, 'safe to repeat');
});

test('review boxes: at the same time the higher box wins; junk is dropped', () => {
  const a = { v: 1, items: { q: { box: 2, due: '2026-10-05', t: 5 }, bad: 7 } };
  const b = { v: 1, items: { q: { box: 3, due: '2026-10-09', t: 5 } } };
  assert.deepEqual(MERGE.review(a, b).items, { q: b.items.q });
  assert.deepEqual(MERGE.review(b, a).items, { q: b.items.q });
  assert.deepEqual(MERGE.review(null, b), { v: 1, items: b.items });
});

test('review boxes: a pruned question stays gone whichever device syncs first', () => {
  const recall = require(engineFile('recall.js'));
  const store = (v) => ({ data: { review_v1: JSON.stringify(v) }, getItem(k) { return k in this.data ? this.data[k] : null; }, setItem(k, x) { this.data[k] = String(x); } });
  const now = () => new Date(2026, 9, 2, 10).getTime();
  const info = (q) => ({ q: q.q, answer: q.a, historyQ: q.q, historyAnswer: q.a });
  const kept = { q: 'kept', a: 'k' }, old = { q: 'old', a: 'o' };
  const k1 = recall.keyOf('a', info(kept)), k2 = recall.keyOf('a', info(old));
  const both = { v: 1, items: { [k1]: { box: 1, due: '2026-10-01', t: 1 }, [k2]: { box: 2, due: '2026-10-01', t: 1 } } };
  const deviceA = store(both);
  recall.create(deviceA, now, 'grade5').tidy('a', [kept], info, []);
  const pruned = JSON.parse(deviceA.data.review_v1);
  assert.equal(pruned.items[k2].gone, true, 'kept as a tombstone');
  for (const merged of [MERGE.review(pruned, both), MERGE.review(both, pruned)]) {
    assert.equal(merged.items[k2].gone, true);
    const r = recall.create(store(merged), now, 'grade5');
    assert.equal(r.dueCount('a'), 1);
    assert.deepEqual(r.pickDue('a', [kept, old], info).map((q) => q.q), ['kept']);
  }
});

test('review boxes: extra fields like started pass through the merge', () => {
  const a = { v: 1, items: { s: { box: 2, due: '2026-10-02', t: 5, started: '2026-10-02' } } };
  assert.deepEqual(MERGE.review(a, null).items, a.items);
  assert.deepEqual(MERGE.review(null, a).items, a.items);
});

test('review boxes: a stale start mark never beats a newer grade', () => {
  const stale = { v: 1, items: { s: { box: 2, due: '2026-10-01', t: 5, started: '2026-10-02' } } };
  const graded = { v: 1, items: { s: { box: 3, due: '2026-10-09', t: 9 } } };
  assert.deepEqual(MERGE.review(stale, graded).items, graded.items);
  assert.deepEqual(MERGE.review(graded, stale).items, graded.items);
});

test('review boxes: on a full tie gone wins, then started, in either order', () => {
  const plain = { v: 1, items: { s: { box: 2, due: '2026-10-01', t: 5 } } };
  const started = { v: 1, items: { s: { box: 2, due: '2026-10-01', t: 5, started: '2026-10-02' } } };
  const gone = { v: 1, items: { s: { box: 2, due: '2026-10-01', t: 5, gone: true } } };
  assert.deepEqual(MERGE.review(plain, started).items, started.items);
  assert.deepEqual(MERGE.review(started, plain).items, started.items);
  assert.deepEqual(MERGE.review(plain, gone).items, gone.items);
  assert.deepEqual(MERGE.review(gone, plain).items, gone.items);
  assert.deepEqual(MERGE.review(started, gone).items, gone.items);
  assert.deepEqual(MERGE.review(gone, started).items, gone.items);
});

test('review boxes: a malformed item never beats a valid one at the same time', () => {
  const good = { v: 1, items: { q: { box: 2, due: '2026-10-05', t: 5 } } };
  const junk = { v: 1, items: { q: { box: 'x', t: 5 } } };
  assert.deepEqual(MERGE.review(good, junk).items, good.items);
  assert.deepEqual(MERGE.review(junk, good).items, good.items);
});

test('medals: per app the newer write wins, best and paid never go down, in either order', () => {
  const a = { v: 1, apps: { 'life-lab': { t: 200, order: ['l1', 'l2'], lessons: {
    l1: { title: 'Plants', icon: '🌱', now: 1, best: 2, paid: 1 },
    l2: { title: 'Rocks', icon: '', now: 0, best: 0, paid: 0 } } } } };
  const b = { v: 1, apps: {
    'life-lab': { t: 100, order: ['l1'], lessons: { l1: { title: 'Old', icon: '🌱', now: 3, best: 3, paid: 3 } } },
    'word-train': { t: 5, order: [], lessons: {} } } };
  const want = { v: 1, apps: {
    'life-lab': { t: 200, order: ['l1', 'l2'], lessons: {
      l1: { title: 'Plants', icon: '🌱', now: 1, best: 3, paid: 3 },
      l2: { title: 'Rocks', icon: '', now: 0, best: 0, paid: 0 } } },
    'word-train': { t: 5, order: [], lessons: {} } } };
  assert.deepEqual(MERGE.mastery(a, b), want);
  assert.deepEqual(MERGE.mastery(b, a), want);
  assert.deepEqual(MERGE.mastery(MERGE.mastery(a, b), b), want, 'safe to repeat');
  assert.deepEqual(MERGE.mastery(null, b), MERGE.mastery(b, null));
  assert.equal(kindOf('mastery_v1'), 'mastery');
});

test('medals: at the same time either order agrees; junk apps are dropped', () => {
  const x = { v: 1, apps: { a: { t: 5, order: ['l'], lessons: { l: { title: 'X', icon: '', now: 2, best: 2, paid: 2 } } } } };
  const y = { v: 1, apps: { a: { t: 5, order: ['l'], lessons: { l: { title: 'Y', icon: '', now: 1, best: 3, paid: 1 } } } } };
  assert.deepEqual(MERGE.mastery(x, y), MERGE.mastery(y, x));
  assert.deepEqual(MERGE.mastery(MERGE.mastery(x, y), y), MERGE.mastery(x, y), 'safe to repeat');
  assert.deepEqual(MERGE.mastery({ v: 1, apps: { p: 'nope', q: { t: 'z', lessons: {} }, r: { t: 1 } } }, null), { v: 1, apps: {} });
});

test('medals travel to a second device and merge back', async () => {
  const cloud = fakeCloud();
  const a = device(cloud), b = device(cloud);
  const m = (best, t) => JSON.stringify({ v: 1, apps: { 'life-lab': { t, order: ['l1'], lessons: { l1: { title: 'Plants', icon: '', now: best, best, paid: best } } } } });
  a.s.setItem('mastery_v1', m(2, 10));
  await a.sync();
  await b.sync();
  assert.equal(JSON.parse(b.s.getItem('mastery_v1')).apps['life-lab'].lessons.l1.best, 2);
  b.s.setItem('mastery_v1', m(1, 20));
  await b.sync();
  await a.sync();
  const l1 = JSON.parse(a.s.getItem('mastery_v1')).apps['life-lab'].lessons.l1;
  assert.deepEqual({ now: l1.now, best: l1.best, paid: l1.paid }, { now: 1, best: 2, paid: 2 });
});

test('medals: a lesson only in the older copy survives, in either order and when repeated', () => {
  const a = { v: 1, apps: { g: { t: 200, order: ['l1'], lessons: { l1: { title: 'A', icon: '', now: 1, best: 1, paid: 1 } } } } };
  const b = { v: 1, apps: { g: { t: 100, order: ['l1', 'l2'], lessons: {
    l1: { title: 'A', icon: '', now: 1, best: 1, paid: 1 }, l2: { title: 'B', icon: '', now: 2, best: 2, paid: 2 } } } } };
  const ab = MERGE.mastery(a, b), ba = MERGE.mastery(b, a);
  assert.deepEqual(ab, ba);
  assert.deepEqual(ab.apps.g.order, ['l1']);
  assert.equal(ab.apps.g.lessons.l2.paid, 2);
  assert.deepEqual(MERGE.mastery(ab, b), ab);
  assert.deepEqual(MERGE.mastery(ab, a), ab);
});

test('medals: junk best and paid are clamped to 0..3', () => {
  const x = { v: 1, apps: { g: { t: 5, order: ['l'], lessons: { l: { title: 'X', icon: '', now: 1, best: 9, paid: -4 } } } } };
  const l = MERGE.mastery(x, null).apps.g.lessons.l;
  assert.deepEqual({ best: l.best, paid: l.paid }, { best: 3, paid: 0 });
});

test('quests: the later day wins; on the same day the first pick is kept and done marks add up', () => {
  const q = (id, done) => ({ id, kind: 'rounds', done });
  const a = { v: 1, day: '2026-10-02', at: 100, list: [q('x', true), q('y', false), q('z', false)], days: ['2026-10-01', '2026-10-02'], paidDay: '', streakPaid: ['2026-09-20|7'] };
  const b = { v: 1, day: '2026-10-02', at: 200, list: [q('p', true), q('y', true), q('r', false)], days: ['2026-09-30'], paidDay: '2026-10-02', streakPaid: [] };
  const want = { v: 1, day: '2026-10-02', at: 100, list: [q('x', true), q('y', true), q('z', false)],
    days: ['2026-09-30', '2026-10-01', '2026-10-02'], paidDay: '2026-10-02', streakPaid: ['2026-09-20|7'] };
  assert.deepEqual(MERGE.quests(a, b), want);
  assert.deepEqual(MERGE.quests(b, a), want);
  assert.deepEqual(MERGE.quests(MERGE.quests(a, b), b), want, 'safe to repeat');
  const older = Object.assign({}, b, { day: '2026-10-01', at: 1 });
  assert.equal(MERGE.quests(a, older).day, '2026-10-02');
  assert.equal(MERGE.quests(older, a).at, 100);
  assert.equal(kindOf('quests_v1'), 'quests');
});

test('quests: at the same pick time either order agrees; days keep a long history; junk is ignored', () => {
  const a = { v: 1, day: '2026-10-02', at: 5, list: [{ id: 'a', done: false }], days: [], paidDay: '', streakPaid: [] };
  const b = { v: 1, day: '2026-10-02', at: 5, list: [{ id: 'b', done: false }], days: [], paidDay: '', streakPaid: [] };
  assert.deepEqual(MERGE.quests(a, b), MERGE.quests(b, a));
  const many = [];
  for (let i = 1; i <= 70; i++) many.push('2026-07-' + String(i).padStart(2, '0'));
  assert.equal(MERGE.quests({ v: 1, day: '', at: 0, list: [], days: many.slice(0, 40), paidDay: '', streakPaid: [] }, { v: 1, day: '', at: 0, list: [], days: many.slice(30), paidDay: '', streakPaid: [] }).days.length, 70);
  assert.deepEqual(MERGE.quests('nope', null), null);
});

test('quests travel to a second device', async () => {
  const cloud = fakeCloud();
  const a = device(cloud), b = device(cloud);
  a.s.setItem('quests_v1', JSON.stringify({ v: 1, day: '2026-10-02', at: 5, list: [{ id: 'rounds', kind: 'rounds', done: true }], days: ['2026-10-02'], paidDay: '', streakPaid: [] }));
  await a.sync();
  await b.sync();
  assert.deepEqual(JSON.parse(b.s.getItem('quests_v1')).days, ['2026-10-02']);
});

test('quests: junk day values cannot make the merge order-dependent, and paidDay stays a string', () => {
  const a = { v: 1, day: 'junk', at: 1, list: [{ id: 'a', done: false }], days: [], paidDay: 5, streakPaid: [] };
  const b = { v: 1, day: 'x-y-z', at: 1, list: [{ id: 'a', done: false }], days: [], paidDay: null, streakPaid: [] };
  assert.deepEqual(MERGE.quests(a, b), MERGE.quests(b, a));
  assert.equal(MERGE.quests(a, b).paidDay, '');
});

test('quests: study days keep the last 400', () => {
  const many = [];
  for (let i = 0; i < 450; i++) { const d = new Date(Date.UTC(2025, 0, 1 + i)); many.push(d.toISOString().slice(0, 10)); }
  const x = { v: 1, day: '', at: 0, list: [], days: many.slice(0, 250), paidDay: '', streakPaid: [] };
  const y = { v: 1, day: '', at: 0, list: [], days: many.slice(200), paidDay: '', streakPaid: [] };
  assert.equal(MERGE.quests(x, y).days.length, 400);
});

const bossStage = (app, cleared) => ({ app, title: app.toUpperCase(), cleared });

test('boss: the later week wins; in one week a stage cleared anywhere is cleared and pay marks add up', () => {
  const a = { v: 1, week: '2026-10-05', stages: [bossStage('x', true), bossStage('y', false)], paid: ['2026-09-28|half'] };
  const b = { v: 1, week: '2026-10-05', stages: [bossStage('x', false), bossStage('y', true)], paid: ['2026-10-05|full'] };
  const want = { v: 1, week: '2026-10-05', stages: [bossStage('x', true), bossStage('y', true)], paid: ['2026-09-28|half', '2026-10-05|full'] };
  assert.deepEqual(MERGE.boss(a, b), want);
  assert.deepEqual(MERGE.boss(b, a), want);
  assert.deepEqual(MERGE.boss(MERGE.boss(a, b), b), want, 'safe to repeat');
  const old = { v: 1, week: '2026-09-28', stages: [bossStage('z', true)], paid: ['2026-09-21|full'] };
  assert.deepEqual(MERGE.boss(a, old).stages, a.stages);
  assert.deepEqual(MERGE.boss(old, a).stages, a.stages);
  assert.deepEqual(MERGE.boss(old, a).paid, ['2026-09-21|full', '2026-09-28|half']);
  assert.equal(kindOf('boss_v1'), 'boss');
  assert.equal(MERGE.boss('nope', null), null);
});

test('boss: two devices that picked different stages keep the list with more cleared, in either order', () => {
  const week = '2026-10-05';
  const a = { v: 1, week, stages: [bossStage('x', true), bossStage('y', false)], paid: [] };
  const b = { v: 1, week, stages: [bossStage('p', false), bossStage('q', false)], paid: [] };
  assert.deepEqual(MERGE.boss(a, b).stages, a.stages);
  assert.deepEqual(MERGE.boss(b, a).stages, a.stages);
  const c = { v: 1, week, stages: [bossStage('p', true), bossStage('q', false)], paid: [] };
  assert.deepEqual(MERGE.boss(a, c).stages, c.stages, 'a tie goes to the smaller app list');
  assert.deepEqual(MERGE.boss(c, a).stages, c.stages);
  const empty = { v: 1, week, stages: [], paid: [] };
  assert.deepEqual(MERGE.boss(empty, b).stages, b.stages, 'a picked list beats no list');
  assert.deepEqual(MERGE.boss(b, empty).stages, b.stages);
});

test('boss: a junk week or same-app titles that differ still merge the same in either order', () => {
  const junk = { v: 1, week: 7, stages: [bossStage('x', false)], paid: [] };
  const junk2 = { v: 1, week: 'soon', stages: [bossStage('x', false)], paid: [] };
  const good = { v: 1, week: '2026-10-05', stages: [bossStage('x', false)], paid: [] };
  assert.deepEqual(MERGE.boss(junk, junk2), MERGE.boss(junk2, junk));
  assert.deepEqual(MERGE.boss(junk, good), MERGE.boss(good, junk));
  assert.equal(MERGE.boss(junk, good).week, '2026-10-05');
  const t1 = { v: 1, week: '2026-10-05', stages: [{ app: 'x', title: 'A', cleared: false }], paid: [] };
  const t2 = { v: 1, week: '2026-10-05', stages: [{ app: 'x', title: 'B', cleared: false }], paid: [] };
  assert.deepEqual(MERGE.boss(t1, t2), MERGE.boss(t2, t1));
});

test('the boss travels to a second device', async () => {
  const cloud = fakeCloud();
  const a = device(cloud), b = device(cloud);
  a.s.setItem('boss_v1', JSON.stringify({ v: 1, week: '2026-10-05', stages: [bossStage('x', true), bossStage('y', false)], paid: [] }));
  await a.sync();
  await b.sync();
  assert.deepEqual(JSON.parse(b.s.getItem('boss_v1')).stages, [bossStage('x', true), bossStage('y', false)]);
});

test('wallet: the rate switch points merge to the higher number per key, in either order', () => {
  const a = { baselines: { x: 0 }, purchases: [], oldPointsCounted: true, rateFrom: { x: 400, y: 10 } };
  const b = { baselines: { x: 0 }, purchases: [], oldPointsCounted: true, rateFrom: { x: 420 } };
  assert.deepEqual(MERGE.wallet(a, b).rateFrom, { x: 420, y: 10 });
  assert.deepEqual(MERGE.wallet(b, a).rateFrom, { x: 420, y: 10 });
  assert.equal(MERGE.wallet({ baselines: {}, purchases: [] }, { baselines: {}, purchases: [] }).rateFrom, null, 'still missing when both lack it');
});

test('family keys: what kind each one is', () => {
  assert.equal(kindOf('family_v1'), 'family');
  assert.equal(kindOf('family_seen_v1'), 'familySeen');
  assert.equal(kindOf('cheers_sent_total'), 'counter');
  assert.equal(kindOf('family_peek_v1'), null, 'her sister\'s data never leaves the tablet');
});

test('family: news and sent cheers join by id, newest first, trimmed; at is the later one; either order agrees', () => {
  const day = 86400000;
  const a = { v: 1, at: 50, news: [{ id: 'n1', t: 10, kind: 'medal' }, { id: 'n2', t: 30, kind: 'boss' }], sent: [{ id: 's1', t: 8 * day, to: 'b', cheer: 'great' }] };
  const b = { v: 1, at: 70, news: [{ id: 'n2', t: 30, kind: 'boss' }, { id: 'n3', t: 20, kind: 'quests' }], sent: [{ id: 's0', t: 0, to: 'b', cheer: 'go' }, { id: 's2', t: 8 * day + 5, to: 'b', cheer: 'can' }] };
  const ab = MERGE.family(a, b);
  assert.deepEqual(ab, MERGE.family(b, a));
  assert.equal(ab.at, 70);
  assert.deepEqual(ab.news.map((n) => n.id), ['n2', 'n3', 'n1']);
  assert.deepEqual(ab.sent.map((s) => s.id), ['s2', 's1'], 'cheers a week older than the newest are dropped');
  const many = { v: 1, at: 0, news: Array.from({ length: 25 }, (_, i) => ({ id: 'x' + i, t: i, kind: 'quests' })), sent: [] };
  assert.equal(MERGE.family(many, null).news.length, 25, 'one side alone is kept as it is');
  assert.equal(MERGE.family(many, { v: 1, at: 0, news: [], sent: [] }).news.length, 20);
  assert.equal(MERGE.family(null, null), null);
  assert.deepEqual(MERGE.family({ v: 1, news: [{ id: 'j' }, 'junk'], sent: 'x' }, { v: 1 }), { v: 1, at: 0, news: [], sent: [] });
});

test('family seen marks only go forward, in either order', () => {
  const a = { cheers: 5, news: { x: 3, y: 9 } }, b = { cheers: 7, news: { x: 4 } };
  assert.deepEqual(MERGE.familySeen(a, b), { cheers: 7, news: { x: 4, y: 9 } });
  assert.deepEqual(MERGE.familySeen(b, a), MERGE.familySeen(a, b));
  assert.deepEqual(MERGE.familySeen(null, b), { cheers: 7, news: { x: 4 } });
  assert.equal(MERGE.familySeen(null, null), null);
});

test('cheers sent add up across devices like points', async () => {
  const cloud = fakeCloud();
  const a = device(cloud, 'ana'), b = device(cloud, 'ana');
  a.s.setItem('cheers_sent_total', '2');
  await a.sync();
  b.s.setItem('cheers_sent_total', '1');
  await b.sync();
  await a.sync();
  assert.equal(a.s.getItem('cheers_sent_total'), '3');
  assert.equal(b.s.getItem('cheers_sent_total'), '3');
  assert.equal(cloud.db.ana.counters.cheers_sent_total.total, 3);
});

test('family_v1 from two devices of one child joins in the cloud; the peek cache never leaves the tablet', async () => {
  const cloud = fakeCloud();
  const a = device(cloud, 'ana'), b = device(cloud, 'ana');
  a.s.setItem('family_v1', JSON.stringify({ v: 1, at: 5, news: [{ id: 'n1', t: 5, kind: 'quests' }], sent: [] }));
  a.s.setItem('family_peek_v1', JSON.stringify({ sis: { total: 1 } }));
  await a.sync();
  b.s.setItem('family_v1', JSON.stringify({ v: 1, at: 9, news: [{ id: 'n2', t: 9, kind: 'boss' }], sent: [] }));
  await b.sync();
  await a.sync();
  const fam = (d) => JSON.parse(d.s.getItem('family_v1'));
  assert.deepEqual(fam(a).news.map((n) => n.id), ['n2', 'n1']);
  assert.deepEqual(fam(b), fam(a));
  assert.equal(cloud.db.ana.state.family_peek_v1, undefined);
});

test('peek reads only the asked keys of another learner and changes nothing', async () => {
  const cloud = fakeCloud();
  const sis = device(cloud, 'mia');
  sis.s.setItem('profile_v1', JSON.stringify({ name: 'Mia', emoji: '', grade: 2, at: 1 }));
  sis.s.setItem('world_v1', JSON.stringify({ v: 1, avatar: 'owl', view: 'campus', at: null, t: 1 }));
  sis.s.setItem('blockbot_points_v1', '50');
  sis.s.setItem('cheers_sent_total', '4');
  await sis.sync();
  const before = JSON.stringify(cloud.db);
  const r = await cloud.peek('mia', ['profile_v1', 'world_v1', 'family_v1'], ['cheers_sent_total']);
  assert.deepEqual(r, {
    state: { profile_v1: { name: 'Mia', emoji: '', grade: 2, at: 1 }, world_v1: JSON.stringify({ v: 1, avatar: 'owl', view: 'campus', at: null, t: 1 }), family_v1: null },
    counters: { cheers_sent_total: 4 },
  });
  assert.equal(JSON.stringify(cloud.db), before);
});

const Fam = require(engineFile('family.js'));

test('two tablets: Bunso\'s medal reaches Ate, Ate\'s cheer reaches Bunso once, and the cheer back counts', async () => {
  const cloud = fakeCloud();
  const ate = device(cloud, 'ana'), bunso = device(cloud, 'mia');
  ate.s.setItem('profile_v1', JSON.stringify({ name: '', emoji: '', grade: 5, at: 1 }));
  bunso.s.setItem('profile_v1', JSON.stringify({ name: '', emoji: '', grade: 2, at: 1 }));
  let T = new Date(2026, 9, 4, 9).getTime();
  const clock = () => T;
  const ME_A = { id: 'ana', grade: 5 }, ME_B = { id: 'mia', grade: 2 };
  // What cloud.js does after a good round.
  async function peekFor(d, me) {
    const list = await cloud.learners();
    const got = await Promise.all(list.filter((l) => l.id !== me.id)
      .map(async (l) => Object.assign({ id: l.id }, await cloud.peek(l.id, Fam.PEEK_STATE, Fam.PEEK_COUNTERS))));
    Fam.store(d.s, clock, got);
    return Fam.readPeek(d.s);
  }

  const LOOK_B = { v: 1, body: 'girl', skin: 1, hair: 'pigtails', hairColor: 3, outfit: 2, pet: 'puppy', petName: 'Bantay', t: 7 };
  bunso.s.setItem('avatar_v1', JSON.stringify(LOOK_B));
  Fam.note(bunso.s, clock, Math.random, 'medal', { app: 'block-bot', tier: 1, title: 'Skip Counting' });
  await bunso.sync();
  await ate.sync();
  const seen = Fam.sisters(ME_A, await peekFor(ate, ME_A), clock(), Fam.readSeen(ate.s));
  assert.deepEqual(seen.map((s) => [s.id, s.rel, s.hasNews, s.news[0].kind]), [['mia', 'bunso', true, 'medal']]);
  assert.deepEqual(seen[0].look, LOOK_B, 'her 3D look comes through the peek, for the gate in the 3D world');

  assert.equal(Fam.send(ate.s, clock, Math.random, 'mia', 'great'), true);
  await ate.sync();
  await bunso.sync();
  const cheers = Fam.unseenCheers(ME_B, await peekFor(bunso, ME_B), Fam.readSeen(bunso.s));
  assert.deepEqual(cheers.map((c) => c.text), ["Galing mo, Bunso! · You're great! 💖"]);
  Fam.markCheers(bunso.s, cheers[0].t);
  assert.deepEqual(Fam.unseenCheers(ME_B, Fam.readPeek(bunso.s), Fam.readSeen(bunso.s)), [], 'shown once');

  T += 1000;
  assert.equal(Fam.send(bunso.s, clock, Math.random, 'ana', 'proud'), true);
  await bunso.sync();
  await ate.sync();
  const back = await peekFor(ate, ME_A);
  assert.equal(Fam.sisters(ME_A, back, clock(), null)[0].total, 1, 'Ate sees 1 cheer from Bunso');
  assert.deepEqual(Fam.unseenCheers(ME_A, back, null).map((c) => c.text), ["Idol kita, Ate! · You're my idol! 💖"]);
  assert.equal(cloud.db.ana.state.family_peek_v1, undefined, 'a peek never goes to the cloud');
  assert.equal(cloud.db.ana.state.family_v1.value.sent.length, 1, 'each tablet writes only its own learner');
  assert.equal(cloud.db.mia.state.family_v1.value.sent.length, 1);
});

// A device that keeps one core, so loadOlder() and historyFrom() persist between rounds (the parent phone).
function windowed(cloud, historyFrom, id = 'ana') {
  const s = space(raw(), id, now);
  const core = create(s, cloud, id, { historyFrom });
  return { s, core, sync: () => core.sync() };
}
const addEntry = (d, e) => { const h = JSON.parse(d.s.getItem('history_v1') || '{"v":1,"entries":[]}'); h.entries.push(e); d.s.setItem('history_v1', JSON.stringify(h)); };

// h1 and h2 reach the cloud before the window starts; h3 and h4 at or after it.
async function tabletWithOldAndNewHistory(cloud) {
  const tablet = device(cloud);
  seedTablet(tablet);
  await tablet.sync();
  addEntry(tablet, { id: 'h2', type: 'open', t: 11 });
  await tablet.sync();
  addEntry(tablet, { id: 'h3', type: 'open', t: 12 });
  addEntry(tablet, { id: 'h4', type: 'open', t: 13 });
  await tablet.sync();
  return { tablet, from: cloud.db.ana.history.h3.at };
}

test('a phone with a history window gets all points and coins but only the recent history', async () => {
  const cloud = fakeCloud();
  const { tablet, from } = await tabletWithOldAndNewHistory(cloud);
  assert.ok(cloud.db.ana.history.h2.at < from);
  const full = device(cloud);
  await full.sync();
  const phone = windowed(cloud, from);
  await phone.sync();
  assert.equal(pts(phone), pts(full));
  assert.deepEqual(wallet(phone), wallet(full));
  assert.deepEqual(history(full), ['h1', 'h2', 'h3', 'h4']);
  assert.deepEqual(history(phone), ['h3', 'h4']);
  assert.equal(phone.core.historyFrom(), from);
  assert.equal(pts(tablet), pts(phone));
});

test('load older brings in the rest of the history once', async () => {
  const cloud = fakeCloud();
  const { from } = await tabletWithOldAndNewHistory(cloud);
  const phone = windowed(cloud, from);
  await phone.sync();
  assert.equal(await phone.core.loadOlder(), 2);
  assert.deepEqual(history(phone), ['h1', 'h2', 'h3', 'h4']);
  assert.equal(phone.core.historyFrom(), 0);
  const calls = cloud.olderCalls;
  assert.equal(await phone.core.loadOlder(), 0);
  assert.equal(cloud.olderCalls, calls, 'no second trip to the cloud');
});

test('a device without a window never asks for older history', async () => {
  const cloud = fakeCloud();
  const tablet = device(cloud);
  seedTablet(tablet);
  const core = create(tablet.s, cloud, 'ana');
  await core.sync();
  assert.equal(core.historyFrom(), 0);
  assert.equal(await core.loadOlder(), 0);
  assert.equal(cloud.olderCalls, 0);
});

test('an entry added on a windowed phone reaches the cloud, and older entries are not deleted', async () => {
  const cloud = fakeCloud();
  const { tablet, from } = await tabletWithOldAndNewHistory(cloud);
  const before = { h1: cloud.db.ana.history.h1.at, h2: cloud.db.ana.history.h2.at };
  const phone = windowed(cloud, from);
  await phone.sync();
  HistoryLib.create(phone.s, now, 'grade5').testScore('rise-shine', 'GMRC', 'GMRC ST2', 18, 20, 30);
  await phone.sync();
  await phone.sync();
  for (const k of ['h1', 'h2']) {
    assert.equal(cloud.db.ana.history[k].at, before[k], k + ' untouched');
    assert.ok(cloud.db.ana.history[k].entry, k + ' not turned into a deletion');
  }
  const added = Object.values(cloud.db.ana.history).filter((d) => d.entry && d.entry.testName === 'GMRC ST2');
  assert.equal(added.length, 1);
  await tablet.sync();
  assert.deepEqual(history(tablet).slice(0, 4), ['h1', 'h2', 'h3', 'h4']);
  assert.equal(history(tablet).length, 5);
});

test('wardrobe_v1 syncs with its own merge rule', () => {
  assert.equal(kindOf('wardrobe_v1'), 'wardrobe');
});

test('wardrobe: a union of what she owns, the earliest buy kept, the same in either order and safe to repeat', () => {
  const a = { v: 1, owned: { cap: { t: 5, coins: 50 }, crown: { t: 9, coins: 700 } } };
  const b = { v: 1, owned: { crown: { t: 7, coins: 700 }, scarf: { t: 8, coins: 100 }, bad: 4 } };
  const ab = MERGE.wardrobe(a, b), ba = MERGE.wardrobe(b, a);
  assert.deepEqual(ab, { v: 1, owned: { cap: { t: 5, coins: 50 }, crown: { t: 7, coins: 700 }, scarf: { t: 8, coins: 100 } } });
  assert.equal(JSON.stringify(ab), JSON.stringify(ba), 'same text either way, so it is not sent again');
  assert.deepEqual(MERGE.wardrobe(ab, b), ab);
  assert.deepEqual(MERGE.wardrobe(a, null), MERGE.wardrobe(null, a));
  assert.equal(MERGE.wardrobe(null, null), null);
});

test('house_v1 syncs with its own merge rule', () => {
  assert.equal(kindOf('house_v1'), 'house');
});

test('house: owned and earned join keeping the first time, the larger desk count, the later room and seen; one text either way', () => {
  const room = (at, wall) => ({ at, placed: [{ id: 'home-bed', c: 0, r: 3, turn: 1 }], wall, floor: 'home-floor-wood', stars: false });
  const a = { v: 1, owned: { 'home-tent': { t: 9, coins: 400 }, 'home-plant': { t: 4, coins: 50 } }, earned: { 'home-gold-frame': 8, 'home-boss-rug': 3 },
    deskRight: 4, room: room(20, 'home-wall-blue'), seen: { at: 5, size: 4, trophies: {} } };
  const b = { v: 1, owned: { 'home-tent': { t: 7, coins: 400 }, bad: 2 }, earned: { 'home-gold-frame': 6, junk: 'x' },
    deskRight: 9, room: room(10, 'home-wall-pink'), seen: { at: 6, size: 5, trophies: { 'life-lab': 1 } } };
  const ab = MERGE.house(a, b), ba = MERGE.house(b, a);
  assert.deepEqual(ab, {
    v: 1,
    owned: { 'home-plant': { t: 4, coins: 50 }, 'home-tent': { t: 7, coins: 400 } },
    earned: { 'home-boss-rug': 3, 'home-gold-frame': 6 },
    deskRight: 9,
    room: room(20, 'home-wall-blue'),
    seen: { at: 6, size: 5, trophies: { 'life-lab': 1 } }
  });
  assert.equal(JSON.stringify(ab), JSON.stringify(ba), 'same text either way');
  assert.deepEqual(MERGE.house(ab, b), ab, 'safe to repeat');
  // A tie on the times: the larger text wins in both orders.
  const c = Object.assign({}, a, { room: room(10, 'home-wall-blue'), seen: { at: 6, size: 6, trophies: {} } });
  assert.equal(JSON.stringify(MERGE.house(c, b)), JSON.stringify(MERGE.house(b, c)));
  assert.equal(MERGE.house(c, b).room.wall, 'home-wall-pink');
  assert.equal(MERGE.house(c, b).seen.size, 6);
  assert.deepEqual(MERGE.house(a, null), MERGE.house(null, a));
  assert.deepEqual(MERGE.house({ v: 1 }, null), { v: 1, owned: {}, earned: {}, deskRight: 0, room: null, seen: null });
  assert.equal(MERGE.house(null, null), null);
});

test('a room decorated on one device and pieces bought on another end up on both', async () => {
  const cloud = fakeCloud();
  const tablet = device(cloud), phone = device(cloud);
  tablet.s.setItem('house_v1', JSON.stringify({ v: 1, owned: { 'home-tent': { t: 5, coins: 400 } }, room: { at: 9, placed: [], wall: 'home-wall-blue', floor: 'home-floor-wood', stars: false } }));
  phone.s.setItem('house_v1', JSON.stringify({ v: 1, owned: { 'home-plant': { t: 6, coins: 50 } }, deskRight: 2 }));
  await tablet.sync();
  await phone.sync();
  await tablet.sync();
  for (const d of [tablet, phone]) {
    const h = JSON.parse(d.s.getItem('house_v1'));
    assert.deepEqual(Object.keys(h.owned), ['home-plant', 'home-tent']);
    assert.equal(h.room.wall, 'home-wall-blue');
    assert.equal(h.deskRight, 2);
  }
});

test('items bought on two devices end up owned on both', async () => {
  const cloud = fakeCloud();
  const tablet = device(cloud), phone = device(cloud);
  tablet.s.setItem('wardrobe_v1', JSON.stringify({ v: 1, owned: { cap: { t: 5, coins: 50 } } }));
  phone.s.setItem('wardrobe_v1', JSON.stringify({ v: 1, owned: { crown: { t: 6, coins: 700 } } }));
  await tablet.sync();
  await phone.sync();
  await tablet.sync();
  for (const d of [tablet, phone]) assert.deepEqual(Object.keys(JSON.parse(d.s.getItem('wardrobe_v1')).owned), ['cap', 'crown']);
});
