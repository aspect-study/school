const test = require('node:test');
const assert = require('node:assert/strict');
const { APPS, engineFile } = require('./paths.js');
const { create, legacyKey, LEGACY_APPS } = require(engineFile('learner.js'));

function storage(initial) {
  const data = Object.assign({}, initial);
  return {
    data,
    getItem(k) { return k in data ? data[k] : null; },
    setItem(k, v) { data[k] = String(v); },
    removeItem(k) { delete data[k]; },
    key(i) { return Object.keys(data)[i] ?? null; },
    get length() { return Object.keys(data).length; },
  };
}
let clock = 1700000000000;
const now = () => clock++;

const GRADE5_DEVICE = {
  grade5_wallet_v1: '{"v":1,"spent":40}',
  grade5_recall_v1: '{"v":1,"rest":{}}',
  grade5_history_v1: '{"v":1,"entries":[]}',
  grade5_history_corrupt_v1_123: 'broken',
  grade5_last_backup_v1: '1699999999999',
  grade5_coin_guide_seen_v1: '1',
  riseshine_points_v1: '420',
  riseshine_progress_v1: '{"myself":10}',
  riseshine_progress_v1_day: '2026-10-1',
  mathmastery_points_v1: '90',
  study_fx_muted_v1: '1',
};

// Games added after 2026-10-02 have no old global keys to migrate.
const ADDED_AFTER_LEARNERS = ['net-navigators', 'rhythm-hues'];

test('the legacy table names exactly the 15 games that existed before learners', () => {
  const byGrade = { grade5: [], grade2: [] };
  for (const a of APPS.filter((a) => !ADDED_AFTER_LEARNERS.includes(a.id))) byGrade['grade' + a.grade].push(a.pointsKey.replace(/_points_v1$/, ''));
  assert.deepEqual(Object.fromEntries(Object.entries(LEGACY_APPS).map(([g, l]) => [g, [...l].sort()])),
    { grade5: byGrade.grade5.sort(), grade2: byGrade.grade2.sort() });
});

test('legacy keys map to a grade and a name inside the learner space', () => {
  assert.deepEqual(legacyKey('grade5_wallet_v1'), { grade: 5, key: 'wallet_v1' });
  assert.deepEqual(legacyKey('grade2_history_corrupt_v1_99'), { grade: 2, key: 'history_corrupt_v1_99' });
  assert.deepEqual(legacyKey('kuwentista_progress_v2_day'), { grade: 2, key: 'kuwentista_progress_v2_day' });
  assert.deepEqual(legacyKey('riseshine_points_v1'), { grade: 5, key: 'riseshine_points_v1' });
  assert.equal(legacyKey('study_fx_muted_v1'), null, 'device settings stay global');
  assert.equal(legacyKey('learner/abc/wallet_v1'), null);
  assert.equal(legacyKey('newgame_points_v1'), null, 'only games that existed before learners');
});

test('the first visit copies every old key into one learner, and keeps the originals', () => {
  const s = storage(GRADE5_DEVICE);
  const L = create(s, now, 5);
  const me = L.current();
  assert.equal(me.grade, 5);
  for (const [oldKey, value] of Object.entries(GRADE5_DEVICE)) {
    const mapped = legacyKey(oldKey);
    if (mapped) assert.equal(L.storage.getItem(mapped.key), value, oldKey);
    assert.equal(s.data[oldKey], value, 'original kept: ' + oldKey);
  }
  assert.equal(L.storage.getItem('study_fx_muted_v1'), null, 'device settings are not copied');
  assert.equal(L.list().length, 1);
});

test('scoped storage keeps each learner apart', () => {
  const s = storage(GRADE5_DEVICE);
  const L = create(s, now, 5);
  L.storage.setItem('wallet_v1', 'x');
  assert.equal(s.data['learner/' + L.current().id + '/wallet_v1'], 'x');
  L.storage.removeItem('wallet_v1');
  assert.equal(L.storage.getItem('wallet_v1'), null);
});

test('migration runs once: later visits never copy over newer data', () => {
  const s = storage(GRADE5_DEVICE);
  const first = create(s, now, 5);
  first.storage.setItem('riseshine_points_v1', '500');
  const again = create(s, now, 5);
  assert.equal(again.current().id, first.current().id);
  assert.equal(again.storage.getItem('riseshine_points_v1'), '500');
});

test('a device with both grades gets one learner each, and each lobby picks its own', () => {
  const s = storage({ ...GRADE5_DEVICE, grade2_wallet_v1: '{"v":1,"spent":10}', blockbot_points_v1: '30' });
  const five = create(s, now, 5);
  assert.equal(five.list().length, 2);
  assert.equal(five.storage.getItem('blockbot_points_v1'), null);
  const two = create(s, now, 2);
  assert.equal(two.current().grade, 2);
  assert.equal(two.storage.getItem('blockbot_points_v1'), '30');
  assert.equal(two.storage.getItem('wallet_v1'), '{"v":1,"spent":10}');
  assert.equal(create(s, now).current().grade, 2, 'the device remembers who studied last');
});

test('a brand-new device creates a learner for the grade she opens', () => {
  const s = storage({});
  const L = create(s, now, 2);
  assert.equal(L.current().grade, 2);
  assert.equal(L.list().length, 1);
  assert.equal(create(s, now, 2).current().id, L.current().id);
});

test('a learner reviewing an earlier grade keeps her own space', () => {
  const s = storage({});
  const six = create(s, now, 6);
  const review = create(s, now, 5);
  assert.equal(review.current().id, six.current().id);
  assert.equal(review.list().length, 1);
});

test('opening the picker page without a grade creates no one', () => {
  const s = storage({});
  const L = create(s, now);
  assert.equal(L.current(), null);
  assert.equal(L.list().length, 0);
});

test('name and emoji are saved on the device', () => {
  const s = storage({});
  const L = create(s, now, 5);
  L.update({ name: '  Ana ', emoji: '🌻' });
  const again = create(s, now, 5).current();
  assert.equal(again.name, 'Ana');
  assert.equal(again.emoji, '🌻');
  L.update({ name: 'x'.repeat(80) });
  assert.equal(create(s, now, 5).current().name.length, 30);
});

test('a broken learner list never loses her data: it is rebuilt from the saved spaces', () => {
  const s = storage(GRADE5_DEVICE);
  const id = create(s, now, 5).current().id;
  s.setItem('learners_v1', '{not json');
  const L = create(s, now, 5);
  assert.equal(L.current().id, id);
  assert.equal(L.storage.getItem('riseshine_points_v1'), '420');
});

test('blocked storage still gives an empty learner, and save errors reach the caller like localStorage', () => {
  const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() {}, key() { return null; }, length: 0 };
  const L = create(broken, now, 5);
  assert.equal(L.storage.getItem('wallet_v1'), null);
  assert.throws(() => L.storage.setItem('wallet_v1', 'x'), /blocked/, 'history and wallet report "storage is full" from this');
});

test('migrated keys and her profile wait in the outbox, so the first cloud sync uploads everything', () => {
  const s = storage(GRADE5_DEVICE);
  const L = create(s, now, 5);
  const waiting = Object.keys(L.storage.outbox()).sort();
  const expected = Object.keys(GRADE5_DEVICE).map(legacyKey).filter(Boolean).map((m) => m.key).concat('profile_v1').sort();
  assert.deepEqual(waiting, expected);
});

test('renaming her is noted for sync too', () => {
  const s = storage({});
  const L = create(s, now, 5);
  L.storage.done(L.storage.outbox());
  L.update({ name: 'Ana' });
  assert.deepEqual(Object.keys(L.storage.outbox()), ['profile_v1']);
});

test('adopt() makes this device a learner from the cloud, and she stays current', () => {
  const s = storage({});
  const L = create(s, now, 5);
  L.adopt('cloud1', { name: 'Ana', emoji: '🌻', grade: 5 });
  const again = create(s, now, 5);
  assert.equal(again.current().id, 'cloud1');
  assert.equal(again.current().name, 'Ana');
});
