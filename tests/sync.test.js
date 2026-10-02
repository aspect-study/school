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
    pull: async (id, since) => {
      if (cloud.offline) throw new Error('offline');
      const l = L(id);
      const pick = (o, f) => Object.entries(o).filter(([, d]) => d.at >= since).map(([key, d]) => f(key, d));
      return {
        state: pick(l.state, (key, d) => ({ key, value: copy(d.value) })),
        counters: pick(l.counters, (key, d) => ({ key, total: d.total })),
        history: pick(l.history, (key, d) => ({ id: key, entry: copy(d.entry) })),
        until: clock,
      };
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
  d.s.setItem('wallet_v1', JSON.stringify({ v: 1, baselines: { riseshine_points_v1: 100 }, spent: 30, bonus: 50, purchases: [{ t: 5, item: 'ml', coins: 40 }], oldPointsCounted: true }));
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

test('the Firestore rules only let the signed-in family read or write its own data', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const rules = fs.readFileSync(path.join(__dirname, '..', 'firebase', 'firestore.rules'), 'utf8').replace(/\s+/g, ' ');
  assert.match(rules, /match \/families\/\{uid\}\/\{document=\*\*\} \{ allow read, write: if request\.auth != null && request\.auth\.uid == uid; \}/);
  assert.equal((rules.match(/allow /g) || []).length, 1, 'no other allow rules');
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
