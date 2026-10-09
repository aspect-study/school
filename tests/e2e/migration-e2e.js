// A tablet saved before learners (every key global) opens the new code: her points, coins, stars and history
// come through unchanged, and the old keys stay as a safety net.
// Run: node tests/e2e/migration-e2e.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { stage, makeWorkDir, dumpDom, readOutput, appendDriver } = require('./chrome.js');
const { LOBBIES, lobbyFile, app, appFile, engineFile, ENGINE_FILES } = require('../paths.js');
const { create: createWallet } = require(engineFile('wallet.js'));

const today = new Date();
const dayKey = today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + today.getDate();
const OLD = {
  grade5_wallet_v1: JSON.stringify({ v: 1, baselines: { riseshine_points_v1: 100, lifelab_points_v1: 0 }, spent: 30, bonus: 50, purchases: [], oldPointsCounted: true }),
  grade5_recall_v1: JSON.stringify({ v: 1, rest: {} }),
  grade5_history_v1: JSON.stringify({ v: 1, entries: [
    { id: 'old-1', type: 'open', app: 'rise-shine', appTitle: 'Rise & Shine', t: today.getTime() - 3600000 },
    { id: 'old-2', type: 'open', app: 'life-lab', appTitle: 'Life Lab', t: today.getTime() - 1800000 },
  ] }),
  grade5_coin_guide_seen_v1: '1',
  riseshine_points_v1: '420',
  lifelab_points_v1: '60',
  riseshine_progress_v1: JSON.stringify({ myself: 9 }),
  riseshine_progress_v1_day: dayKey,
};

// What the old code would have shown: the same wallet, read from the old keys.
const oldGet = (k) => (k === 'wallet_v1' ? OLD.grade5_wallet_v1 : k in OLD ? OLD[k] : null);
const expectedCoins = createWallet({ getItem: oldGet, setItem() {} }, Date.now, 'grade5').balanceStored();

const work = makeWorkDir('migration-e2e');
const site = path.join(work, 'site');
const profile = path.join(work, 'profile');

fs.mkdirSync(site, { recursive: true });
fs.writeFileSync(path.join(site, 'seed.html'), '<!DOCTYPE html><meta charset="utf-8"><script>' +
  'localStorage.clear();var OLD=' + JSON.stringify(OLD) + ';Object.keys(OLD).forEach(function(k){localStorage.setItem(k,OLD[k]);});' +
  'var p=document.createElement("pre");p.id="e2e-out";p.textContent="{}";document.documentElement.appendChild(p);</script>');

const lobbyDriver = `
(function () {
  var me = Learner.current();
  var titleBefore = document.getElementById('hero-title').textContent;
  document.getElementById('learner-name').value = 'Ana';
  document.getElementById('learner-emoji').value = '🌻';
  document.getElementById('learner-save').click();
  var old = {};
  ${JSON.stringify(Object.keys(OLD))}.forEach(function (k) { old[k] = localStorage.getItem(k); });
  var out = document.createElement('pre');
  out.id = 'e2e-out';
  out.textContent = JSON.stringify({
    errors: window.__e2eErrors || [],
    learner: me, learners: Learner.list().length,
    combined: document.getElementById('points-combined-badge').textContent,
    coins: Wallet.balanceStored(),
    history: StudyHistory.list().map(function (e) { return e.id; }),
    guideSeen: Learner.storage.getItem('coin_guide_seen_v1'),
    titleBefore: titleBefore, title: document.getElementById('hero-title').textContent, saved: Learner.current(),
    old: old
  });
  document.body.appendChild(out);
})();`;
const lobby = stage(site, LOBBIES[5].page, appendDriver(fs.readFileSync(lobbyFile(5), 'utf8'), lobbyDriver), ENGINE_FILES);

const gameDriver = `
(function () {
  var out = document.createElement('pre');
  out.id = 'e2e-out';
  out.textContent = JSON.stringify({ errors: window.__e2eErrors || [], total: kit.totalPoints(), stars: progress.myself || 0, learner: Learner.current().id });
  document.body.appendChild(out);
})();`;
const game = stage(site, app('rise-shine').page, appendDriver(fs.readFileSync(appFile('rise-shine'), 'utf8'), gameDriver), ENGINE_FILES);

try {
  dumpDom(profile, path.join(site, 'seed.html'), '');
  const r = readOutput(dumpDom(profile, lobby, ''));
  assert.deepEqual(r.errors, [], 'lobby errors');
  assert.equal(r.learners, 1, 'one learner for a one-grade tablet');
  assert.equal(r.learner.grade, 5);
  assert.equal(r.combined, '⭐ 480 points earned across all subjects', 'points unchanged');
  assert.equal(r.coins, expectedCoins, 'coins unchanged');
  assert.deepEqual([...r.history].sort(), ['old-1', 'old-2'], 'history unchanged');
  assert.equal(r.guideSeen, '1', 'the coin guide is not shown again');
  assert.equal(r.titleBefore, 'Study Games', 'no greeting until a parent sets her name');
  assert.equal(r.title, '🌻 Hi, Ana!');
  assert.equal(r.saved.name, 'Ana');
  assert.deepEqual(r.old, OLD, 'old keys kept as a safety net');

  const g = readOutput(dumpDom(profile, game, ''));
  assert.deepEqual(g.errors, [], 'game errors');
  assert.equal(g.learner, r.learner.id, 'the game uses the same learner');
  assert.equal(g.total, 420, 'Rise & Shine points unchanged');
  assert.equal(g.stars, 9, "today's stars unchanged");

  const again = readOutput(dumpDom(profile, lobby, ''));
  assert.equal(again.learner.id, r.learner.id, 'migration runs once');
  assert.equal(again.learners, 1);
  assert.equal(again.titleBefore, '🌻 Hi, Ana!', 'her name is remembered');
  console.log('Migration passed (' + expectedCoins + ' coins, 480 points)');
} catch (e) {
  console.error('FAIL migration:', e.message);
  process.exitCode = 1;
} finally {
  fs.rmSync(work, { recursive: true, force: true });
}
