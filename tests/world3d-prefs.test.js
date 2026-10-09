const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile, engineFile } = require('./paths.js');
const P = require(worldFile('prefs.js'));
const { kindOf } = require(engineFile('sync-core.js'));

function memory(initial) {
  const data = Object.assign({}, initial);
  return {
    data,
    getItem: (k) => (Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: (k) => { delete data[k]; },
  };
}

test('device prefs default to auto quality with music and footsteps on', () => {
  assert.deepEqual(P.readPrefs(memory()), { v: 1, quality: 'auto', music: true, steps: true, zoom: 1 });
  assert.deepEqual(P.readPrefs(memory({ world3d_device_v1: '{"quality":"ultra","music":"no","steps":"no"}' })), { v: 1, quality: 'auto', music: true, steps: true, zoom: 1 });
  const s = memory();
  P.savePrefs(s, { quality: 'low', music: false, steps: false });
  assert.deepEqual(P.readPrefs(s), { v: 1, quality: 'low', music: false, steps: false, zoom: 1 });
  P.savePrefs(s, { quality: 'low', music: false });
  assert.equal(P.readPrefs(s).steps, true, 'footsteps stay on unless switched off');
});

test('auto and high start on high; low starts on low', () => {
  assert.equal(P.startQuality({ quality: 'auto' }), 'high');
  assert.equal(P.startQuality({ quality: 'high' }), 'high');
  assert.equal(P.startQuality({ quality: 'low' }), 'low');
});

test('the return spot is kept for this tab only, and junk reads as none', () => {
  const s = memory();
  assert.equal(P.readReturn(s), null);
  P.setReturn(s, 'grade5', 'life-lab');
  assert.deepEqual(P.readReturn(s), { grade: 'grade5', app: 'life-lab' });
  P.clearReturn(s);
  assert.equal(P.readReturn(s), null);
  assert.equal(P.readReturn(memory({ world_return_v1: '[1]' })), null);
  assert.equal(P.readReturn(null), null);
});

test('three slow seconds in a row switch to low once', () => {
  const tick = P.fpsWatch(30, 3);
  const second = (fps) => { let hit = false; for (let i = 0; i < fps; i++) hit = tick(1 / fps) || hit; return hit; };
  assert.equal(second(20), false);
  assert.equal(second(20), false);
  assert.equal(second(60), false, 'a fast second starts the count again');
  assert.equal(second(20), false);
  assert.equal(second(20), false);
  assert.equal(second(20), true);
  assert.equal(second(20), false, 'only once');
});

test('device prefs never sync; her look syncs whole', () => {
  assert.equal(kindOf('world3d_device_v1'), null);
  assert.equal(kindOf('avatar_v1'), 'replace');
});

test('daily marks remember the day Mimi talked to her, and sync whole', () => {
  const s = memory();
  assert.deepEqual(P.readDaily(s), { v: 1, mimi: '', greeted: '', comforted: '', bossWin: '', t: 0 });
  P.markDaily(s, 'mimi', '2026-10-05', 99);
  assert.deepEqual(P.readDaily(s), { v: 1, mimi: '2026-10-05', greeted: '', comforted: '', bossWin: '', t: 99 });
  assert.deepEqual(P.readDaily(memory({ world3d_v1: '{"mimi":5,"t":"x"}' })), { v: 1, mimi: '', greeted: '', comforted: '', bossWin: '', t: 0 });
  assert.equal(P.DAILY_KEY, 'world3d_v1');
  assert.equal(kindOf('world3d_v1'), 'replace');
});

test('daily marks also remember the days Jesus greeted and comforted her', () => {
  const s = memory();
  P.markDaily(s, 'greeted', '2026-10-06', 5);
  P.markDaily(s, 'comforted', '2026-10-06', 6);
  P.markDaily(s, 'mimi', '2026-10-06', 7);
  assert.deepEqual(P.readDaily(s), { v: 1, mimi: '2026-10-06', greeted: '2026-10-06', comforted: '2026-10-06', bossWin: '', t: 7 });
  assert.deepEqual(P.readDaily(memory({ world3d_v1: '{"greeted":1,"comforted":null}' })), { v: 1, mimi: '', greeted: '', comforted: '', bossWin: '', t: 0 });
  assert.deepEqual(P.readDaily(memory({ world3d_v1: '7' })), { v: 1, mimi: '', greeted: '', comforted: '', bossWin: '', t: 0 });
});

test('readDaily keeps the week she saw the boss finale', () => {
  const s = memory();
  P.markDaily(s, 'bossWin', '2026-10-05', 9);
  assert.equal(P.readDaily(s).bossWin, '2026-10-05');
  P.markDaily(s, 'mimi', '2026-10-06', 10);
  assert.equal(P.readDaily(s).bossWin, '2026-10-05', 'other marks keep it');
});

test('the return spot can carry what she had as she left, shown once', () => {
  const s = memory();
  const before = { at: 1000, week: 'w', cleared: 1, tally: { gold: 1, silver: 0, bronze: 0 } };
  P.setReturn(s, 'grade5', 'life-lab', before);
  assert.deepEqual(P.readReturn(s), { grade: 'grade5', app: 'life-lab', before });
  P.dropBefore(s);
  assert.deepEqual(P.readReturn(s), { grade: 'grade5', app: 'life-lab' }, 'a reload still comes back to the door');
  P.dropBefore(s);
  assert.deepEqual(P.readReturn(s), { grade: 'grade5', app: 'life-lab' });
  P.setReturn(s, 'grade5', 'life-lab', [1]);
  assert.deepEqual(P.readReturn(s), { grade: 'grade5', app: 'life-lab' }, 'junk is not kept');
  assert.deepEqual(P.readReturn(memory({ world_return_v1: '{"grade":"grade5","app":"x","before":"no"}' })), { grade: 'grade5', app: 'x' });
  P.dropBefore(memory());
  P.dropBefore(null);
});

test('zoom is kept on the device between 0.45 and 1.5; anything else reads as 1', () => {
  assert.deepEqual([P.ZOOM_MIN, P.ZOOM_MAX], [0.45, 1.5]);
  const s = memory();
  P.savePrefs(s, Object.assign(P.readPrefs(s), { zoom: 1.3 }));
  assert.equal(P.readPrefs(s).zoom, 1.3);
  assert.equal(P.readPrefs(s).quality, 'auto', 'the other prefs are kept');
  assert.equal(P.readPrefs(memory({ world3d_device_v1: '{"zoom":9}' })).zoom, 1.5);
  assert.equal(P.readPrefs(memory({ world3d_device_v1: '{"zoom":0.1}' })).zoom, 0.45);
  for (const bad of ['"1.2"', 'null', '[1]']) assert.equal(P.readPrefs(memory({ world3d_device_v1: '{"zoom":' + bad + '}' })).zoom, 1, bad);
  assert.equal(P.clampZoom(NaN), 1);
  assert.equal(P.clampZoom(Infinity), 1);
  assert.equal(P.clampZoom(undefined), 1);
});
