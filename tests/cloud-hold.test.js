const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { engineFile } = require('./paths.js');

function signedInCloud() {
  const syncs = { count: 0 };
  const store = { getItem: () => '1', setItem() {}, removeItem() {} };
  const win = {
    Learner: { current: () => ({ id: 'kid' }), storage: { keys: () => [] } },
    SyncCore: { create: () => ({ linked: () => true, sync: () => { syncs.count++; return Promise.resolve({ at: 1 }); } }) },
    FirebaseRemote: {
      onAuth: (cb) => { cb({ uid: 'u1' }); return Promise.resolve(); },
      remote: () => ({ putFamily: () => Promise.resolve() }),
      whenSlow: (p) => p,
    },
    FIREBASE_CONFIG: {},
    StudyStore: { raw: store, spaces: () => [], space: () => ({ getItem: () => null, put() {} }) },
    location: { protocol: 'https:' },
    navigator: { onLine: true },
    CustomEvent: function () {},
    setInterval: () => 1,
    clearInterval() {},
    addEventListener() {},
    document: {
      readyState: 'complete',
      addEventListener() {},
      dispatchEvent() {},
      getElementById: () => null,
    },
  };
  win.window = win;
  vm.createContext(win);
  vm.runInContext(fs.readFileSync(engineFile('cloud.js'), 'utf8'), win);
  return { win, syncs };
}

const settle = () => new Promise((r) => setTimeout(r, 20));

test('Cloud.hold skips syncs while held and catches up once on release', async () => {
  const { win, syncs } = signedInCloud();
  await settle();
  const base = syncs.count;
  assert.ok(base >= 1, 'signing in syncs once');
  win.Cloud.hold(true);
  await win.Cloud.sync();
  await win.Cloud.sync();
  await settle();
  assert.equal(syncs.count, base, 'no sync while held');
  win.Cloud.hold(false);
  await settle();
  assert.equal(syncs.count, base + 1, 'one catch-up on release');
  win.Cloud.hold(true);
  win.Cloud.hold(false);
  await settle();
  assert.equal(syncs.count, base + 1, 'nothing missed, nothing to catch up');
});
