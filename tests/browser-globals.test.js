const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { engineFile } = require('./paths.js');

// Runs engine files as a browser would (no `module`), on a page with no data-grade, like the parent page.
function browser(...files) {
  const data = {};
  const win = {
    localStorage: {
      getItem: (k) => (k in data ? data[k] : null),
      setItem: (k, v) => { data[k] = String(v); },
      removeItem: (k) => { delete data[k]; },
      key: (i) => Object.keys(data)[i] ?? null,
      get length() { return Object.keys(data).length; },
    },
  };
  win.window = win;
  vm.createContext(win);
  for (const f of files) vm.runInContext(fs.readFileSync(engineFile(f), 'utf8'), win);
  return win;
}

test('the parent page can build a wallet and a history on a child\'s in-memory space', () => {
  const win = browser('storage.js', 'study-history.js', 'wallet.js');
  const s = win.StudyStore.memorySpace('kid');
  const w = win.Wallet.create(s, () => 1000, 'grade5');
  assert.ok(w.addBonus(40));
  assert.equal(JSON.parse(s.getItem('wallet_v1')).bonus, 40);
  const h = win.StudyHistory.create(s, () => 1000, 'grade5');
  h.testScore('rise-shine', 'GMRC', 'ST1', 19, 20, 40);
  assert.equal(h.findTest('rise-shine', 'st1').score, 19);
});
