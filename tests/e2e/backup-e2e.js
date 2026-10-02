// Full backup: export from a used tablet, wipe it, import, confirm, and the points and coins come back.
// Run: node tests/e2e/backup-e2e.js [2|5]
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { stage, makeWorkDir, dumpDom, readOutput, appendDriver } = require('./chrome.js');
const { LOBBIES, lobbyFile } = require('../paths.js');

const grade = process.argv[2] === '5' ? 5 : 2;
const cfg = { grade: 'grade' + grade };

// Synchronous stand-ins for Blob/FileReader, because --dump-dom reads the page right after load.
const driver = `
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var G = ${JSON.stringify(cfg.grade)};
  var r = {};
  function press(digits) {
    digits.split('').forEach(function (ch) {
      Array.prototype.filter.call($('pin-pad').querySelectorAll('button'), function (b) { return b.textContent === ch; })[0].click();
    });
  }
  function unlock() { $('parent-open').click(); press('0108'); }

  var keys = Array.prototype.map.call(document.querySelectorAll('[data-points-key]'), function (c) { return c.getAttribute('data-points-key'); });
  localStorage.clear();
  localStorage.setItem(keys[0], '500');
  localStorage.setItem(keys[1], '120');
  var baselines = {}; baselines[keys[0]] = 0; baselines[keys[1]] = 0;
  localStorage.setItem(G + '_wallet_v1', JSON.stringify({ v: 1, baselines: baselines, spent: 30, bonus: 50, purchases: [], oldPointsCounted: true }));
  localStorage.setItem(G + '_recall_v1', JSON.stringify({ v: 1, rest: { 'x|quiz|1': StudyHistory.dateKey(Date.now()) } }));
  StudyHistory.appOpened(keys[0].replace('_points_v1', ''), 'Some App');
  location.reload = function () {};

  r.coinsBefore = Wallet.balanceStored();
  unlock();
  r.dueBefore = $('parent-open').textContent;
  r.ageBefore = $('backup-age').textContent;

  var exported = null;
  var RealBlob = window.Blob;
  window.Blob = function (parts) { exported = parts.join(''); };
  var realUrl = URL.createObjectURL;
  URL.createObjectURL = function () { return 'blob:e2e'; };
  var realClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () { r.fileName = this.download; };
  $('export-json').click();
  window.Blob = RealBlob; URL.createObjectURL = realUrl; HTMLAnchorElement.prototype.click = realClick;
  r.exportedKeys = Object.keys(JSON.parse(exported).state).sort();
  r.ageAfter = $('backup-age').textContent;
  r.dueAfter = $('parent-open').textContent;
  $('parent-close').click();

  var lastBackup = localStorage.getItem(G + '_last_backup_v1');
  localStorage.clear();
  localStorage.setItem(G + '_last_backup_v1', lastBackup);

  function importFile(answer) {
    window.FileReader = function () {};
    window.FileReader.prototype.readAsText = function () { this.result = exported; this.onload(); };
    var asked = null;
    window.confirm = function (msg) { asked = msg; return answer; };
    var shown = null;
    window.alert = function (msg) { shown = msg; };
    var realTimeout = window.setTimeout, reloads = 0;
    window.setTimeout = function () { reloads++; };
    var dt = new DataTransfer();
    dt.items.add(new File(['x'], 'backup.json', { type: 'application/json' }));
    $('import-file').files = dt.files;
    $('import-file').dispatchEvent(new Event('change'));
    window.setTimeout = realTimeout;
    return { asked: asked, msg: $('backup-msg').textContent, shown: shown, reloads: reloads };
  }

  unlock();
  r.declined = importFile(false);
  r.pointsAfterDecline = localStorage.getItem(keys[0]);
  r.restored = importFile(true);
  r.pointsRestored = [localStorage.getItem(keys[0]), localStorage.getItem(keys[1])];
  r.coinsRestored = Wallet.balanceStored();
  r.recallRestored = !!localStorage.getItem(G + '_recall_v1');
  r.historyRestored = StudyHistory.list(null, null).length;
  r.again = importFile(true);
  r.keys = keys.slice(0, 2);

  var copied = null, lastAlert = null;
  window.alert = function (msg) { lastAlert = msg; };
  document.execCommand = function () {
    var t = document.querySelector('body > textarea[readonly]');
    copied = t ? t.value : null;
    return true;
  };
  $('copy-backup').click();
  r.copiedKeys = Object.keys(JSON.parse(copied).state).sort();
  r.copyAlert = lastAlert;
  localStorage.clear();
  $('paste-btn').click();
  r.pasteBoxShown = !$('paste-box').hidden;
  $('paste-text').value = '  ' + copied + '  ';
  window.confirm = function () { return true; };
  var realTimeout = window.setTimeout;
  window.setTimeout = function () {};
  $('paste-import').click();
  window.setTimeout = realTimeout;
  r.pasteAlert = lastAlert;
  r.pastedPoints = localStorage.getItem(keys[0]);
  r.pastedCoins = Wallet.balanceStored();
  $('paste-text').value = '';
  $('paste-import').click();
  r.emptyPasteAlert = lastAlert;
  document.execCommand = function () { return false; };
  $('copy-backup').click();
  r.manualCopyText = $('paste-text').value;
  r.manualCopyHint = $('paste-hint').textContent;
  var empty = JSON.parse(copied);
  empty.state = {};
  $('paste-text').value = JSON.stringify(empty);
  $('paste-import').click();
  r.emptyStateAlert = lastAlert;

  r.errors = window.__e2eErrors || [];
  var pre = document.createElement('pre');
  pre.id = 'e2e-out';
  pre.textContent = JSON.stringify(r);
  document.body.appendChild(pre);
})();
`;

const work = makeWorkDir('backup-e2e');
const lobby = stage(path.join(work, 'site'), LOBBIES[grade].page, appendDriver(fs.readFileSync(lobbyFile(grade), 'utf8'), driver), ['study-history.js', 'wallet.js', 'fx.js']);

try {
  const r = readOutput(dumpDom(path.join(work, 'profile'), lobby, ''));
  const coins = 40 + 62 + 50 - 30;
  assert.deepEqual(r.errors, [], 'page errors');
  assert.equal(r.coinsBefore, coins);
  assert.equal(r.dueBefore, '🔒 Parent · 💾 backup due', 'a tablet with points and no backup is due');
  assert.equal(r.ageBefore, '⚠️ No full backup from this device yet.');
  assert.match(r.fileName, new RegExp('^study-backup-grade' + grade + '-\\d{4}-\\d\\d-\\d\\d\\.json$'));
  assert.deepEqual(r.exportedKeys, [r.keys[0], r.keys[1], 'grade' + grade + '_recall_v1', 'grade' + grade + '_wallet_v1'].sort());
  assert.equal(r.ageAfter, '✅ Last full backup: today.');
  assert.equal(r.dueAfter, '🔒 Parent');

  assert.match(r.declined.asked, new RegExp('has ⭐ 620 points and 🪙 ' + coins + ' coins'));
  assert.match(r.declined.asked, /This device has ⭐ 0 points and 🪙 40 coins/);
  assert.match(r.declined.msg, /Points and coins were left as they are\.$/);
  assert.equal(r.declined.reloads, 0);
  assert.equal(r.pointsAfterDecline, null, 'declining writes nothing');

  assert.match(r.restored.msg, /Restored points and coins\. Reloading…$/);
  assert.equal(r.restored.reloads, 1);
  assert.deepEqual(r.pointsRestored, ['500', '120']);
  assert.equal(r.coinsRestored, coins);
  assert.equal(r.recallRestored, true);
  assert.equal(r.historyRestored, 1);

  assert.equal(r.again.asked, null, 'no question when the tablet already matches');
  assert.match(r.again.msg, /Points and coins already match this backup\.$/);
  for (const k of ['declined', 'restored', 'again']) assert.equal(r[k].shown, r[k].msg, k + ' result pops up');
  assert.match(r.declined.shown, /^Study history: added 1 entry, skipped 0 duplicates\. /);
  assert.match(r.restored.shown, /^Study history: added 0 entries, skipped 1 duplicate\. /);
  assert.deepEqual(r.copiedKeys, r.exportedKeys, 'copy holds the same keys as the file export');
  assert.match(r.copyAlert, new RegExp('^Full backup copied: ⭐ 620 points and 🪙 ' + coins + ' coins\\. '));
  assert.match(r.emptyStateAlert, /This backup has 0 points and no coins: the page it was copied from had nothing saved\./);
  assert.equal(r.pasteBoxShown, true);
  assert.match(r.pasteAlert, /Restored points and coins/);
  assert.equal(r.pastedPoints, '500');
  assert.equal(r.pastedCoins, coins);
  assert.equal(r.emptyPasteAlert, 'Paste the backup text first.');
  assert.equal(JSON.parse(r.manualCopyText).grade, 'grade' + grade, 'when copying fails the text is shown to copy by hand');
  assert.match(r.manualCopyHint, /^Copying did not work here/);
  console.log('Backup passed');
} catch (e) {
  console.error('FAIL backup:', e.message);
  process.exitCode = 1;
}
