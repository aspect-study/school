const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { stage, makeWorkDir, dumpDom, readOutput, appendDriver } = require('./chrome.js');
const { LOBBIES, lobbyFile, ENGINE_FILES } = require('../paths.js');

const CONFIGS = {
  2: {
    key: 'history_v1',
    wallet: 'wallet_v1',
    otherWallet: 'learner/her-sister/wallet_v1',
    shop: { goal: '160 coins pa para sa Movie night!\n160 more coins to Movie night!', movieNeed: '160 more coins', tomorrow: 'Come back tomorrow', earned: '⭐ 1000 new points → 🪙 100 coins · 🎁 40 welcome · 🛒 40 spent' },
    apps: ['word-train', 'kuwentista'],
    subjects: ['English', 'Filipino'],
    subjectOptions: 8,
  },
  5: {
    key: 'history_v1',
    wallet: 'wallet_v1',
    otherWallet: 'learner/her-sister/wallet_v1',
    shop: { goal: '160 more coins to Movie night!', movieNeed: '160 more coins', tomorrow: 'Come back tomorrow', earned: '⭐ 1000 new points → 🪙 100 coins · 🎁 40 welcome · 🛒 40 spent' },
    apps: ['page-turners', 'math-mastery'],
    subjects: ['English', 'Math'],
    subjectOptions: 9,
  },
};

const grade = process.argv[2] === '5' ? 5 : 2;
const cfg = CONFIGS[grade];

const work = makeWorkDir('study-history-lobby');
const withJs = path.join(work, 'with-js');
const noJs = path.join(work, 'no-js');

const driverSource = 'var __store = window.Learner ? Learner.storage : localStorage;\nvar __E2E_KEY = ' + JSON.stringify(cfg.key) + ', __E2E_APPS = ' + JSON.stringify(cfg.apps) +
  ', __E2E_WALLET = ' + JSON.stringify(cfg.wallet) + ', __E2E_OTHER_WALLET = ' + JSON.stringify(cfg.otherWallet) + ';\n' +
  fs.readFileSync(path.join(__dirname, 'lobby-driver.page.js'), 'utf8');
const html = appendDriver(fs.readFileSync(lobbyFile(grade), 'utf8'), driverSource);
const withJsLobby = stage(withJs, LOBBIES[grade].page, html, ENGINE_FILES);
const noJsLobby = stage(noJs, LOBBIES[grade].page, html, []);

try {
  const r = readOutput(dumpDom(path.join(work, 'profile'), withJsLobby, '#e2e=lobby'));
  assert.deepEqual(r.errors, [], 'page errors');
  assert.equal(r.overlayOpen, true, 'Parent link opens the panel');
  assert.equal(r.wrongPinLocked, true, 'wrong PIN stays locked');
  assert.equal(r.unlocked, true, '0108 unlocks');
  assert.equal(r.hiddenRelocked, true, 'tab hide relocks the panel');
  assert.equal(r.reunlocked, true, 'reopening after relock needs the PIN and then works');
  assert.equal(r.missingHidden, true);
  assert.equal(r.rows7, 5, 'last 7 days shows 5 rows (a,b,c,e,f; d is 40 days ago)');
  assert.match(r.summary7, /Study time: 20 min/);
  assert.match(r.summary7, /Quizzes: 3/);
  assert.match(r.summary7, /Average: 80%/);
  assert.match(r.summary7, new RegExp('Most missed: ' + cfg.subjects[0] + ' · “Pick the noun”'));
  assert.equal(r.detailsCount, 2, 'b and e each have wrong answers in the 7-day list');
  assert.match(r.detailsText, /2 wrong answers/);
  assert.match(r.detailsText, /❌ run/);
  assert.match(r.detailsText, /✅ cat/);
  assert.equal(r.rowsAll, 6, 'All shows every row');
  assert.equal(r.weakAll, '📉 Needs practiceEvery lesson is at 80% or more in this range. 🎉');
  assert.deepEqual(r.weakList, [cfg.subjects[0] + ' · Verbs — 40% right (4 of 10, 1 quiz)']);
  assert.match(r.allText, new RegExp(cfg.subjects[1] + ' · Final Mock Exam — stopped at 4 of 21, 3 correct'));
  assert.match(r.allText, new RegExp(cfg.subjects[1] + ' · Pangngalan — viewed 6 of 8 cards'));
  assert.match(r.allText, new RegExp(cfg.subjects[0] + ' · Nouns quiz — 8/10 ⭐⭐ \\+95 pts · 4 min'));
  assert.match(r.allText, new RegExp(cfg.subjects[1] + ' · UPAC Walkthrough: Dough problem — 4/5 steps'));
  assert.match(r.allText, new RegExp(cfg.subjects[1] + ' · Case Study: Bibingka at the Fiesta — stopped at 1 of 3, 1 correct'));
  assert.ok(r.allText.includes('8/10 ⭐⭐ +95 pts · 4 min · ⚡ Hint, Ask Mommy (7 coins)'), 'power-ups on a finished quiz');
  assert.ok(r.allText.includes('stopped at 1 of 3, 1 correct · ⚡ Save for Later (2 coins)'), 'power-ups on a stopped quiz');
  assert.equal(r.rowsKuwentista, 4, 'subject filter');
  assert.equal(r.subjectOptions, cfg.subjectOptions, 'All subjects + apps');
  assert.equal(r.afterRange, 'a,b,d,e,f', 'range delete removes only that day');
  assert.match(r.deleteMsg, /Deleted 1 entry\./);
  assert.equal(r.afterAll, null, 'delete everything');
  assert.equal(r.closed, true);
  assert.equal(r.relocked, true, 'reopening asks for the PIN again');

  const pointsKeys = [...fs.readFileSync(lobbyFile(grade), 'utf8').matchAll(/data-points-key="([^"]+)"/g)].map((m) => m[1]).sort();
  assert.equal(r.coinRowShown, true, 'coin badge and Shop button show when the wallet loads');
  assert.equal(r.coinBadge0, '🪙 40 coins', 'first load: welcome gift only');
  assert.deepEqual(r.baselineKeys, pointsKeys, 'first load baselines exactly this lobby\'s points keys');
  assert.equal(r.guideAutoShown, true, 'the coin guide opens by itself the first time');
  assert.equal(r.guideSeen, '1', 'and remembers it was shown');
  assert.equal(r.guideClosed, true);
  assert.match(r.guideButton, /^❓ /);
  assert.equal(r.shopOpen, true);
  assert.equal(r.shopCoins, '🪙 140 coins', '1000 new points earn 100 coins');
  assert.equal(r.shopGoal, cfg.shop.goal);
  assert.equal(r.movieNeed, cfg.shop.movieNeed);
  assert.equal(r.mlBuyable, true);
  assert.equal(r.mlHasNote, true, 'ML shows its rules');
  assert.equal(r.pinShown, true, 'Buy asks for the parent PIN');
  assert.equal(r.wrongPinSpent, 0, 'a wrong PIN spends nothing');
  assert.equal(r.wrongPinStays, true);
  assert.match(r.doneText, /🎉/);
  assert.equal(r.badgeAfter, '🪙 100 coins');
  assert.equal(r.spentAfter, 40);
  assert.equal(r.pointsAfter, '1000', 'buying never changes points');
  assert.equal(r.mlAfter, cfg.shop.tomorrow);
  assert.equal(r.earnedText, cfg.shop.earned, 'the shop shows how points became coins');
  assert.equal(r.cancelSpent, 40, 'cancelling the PIN spends nothing');
  assert.equal(r.escClosed, true);
  assert.equal(r.otherWallet, 'untouched', 'the other grade\'s wallet is never touched');
  assert.deepEqual(r.purchaseLogged, [{ item: 'ml', coins: 40 }]);
  assert.equal(r.shopDownload, 'shop-history-grade' + grade + '-' + r.today + '.csv');
  assert.match(r.parentList, /🛒 Bought Rest: play 1 ML \(Mobile Legends\) game — 40 coins/);

  const t = readOutput(dumpDom(path.join(work, 'profile-testscore'), withJsLobby, '#e2e=testscore'));
  assert.deepEqual(t.errors, [], 'test score: page errors');
  assert.equal(t.shown, true, 'the test score form shows when the wallet is there');
  assert.ok(t.subjects > 0, 'subjects come from the lobby cards');
  assert.equal(t.preview, 'Add 40 coins', '14/15 previews 40 coins');
  assert.equal(t.bonusAfterFirst, 40);
  assert.equal(t.listed, true, 'the Parent panel lists the test');
  assert.match(t.dupWarning, /Already added on .*Tap Add again/);
  assert.equal(t.bonusAfterWarn, 40, 'the warning tap adds nothing');
  assert.equal(t.bonusAfterSecond, 90, 'the second tap adds 50 for a perfect score');
  assert.equal(t.badDisabled, true, 'a score above the total cannot be added');
  assert.equal(t.entries, 2);
  assert.match(t.shopEarned, /📝 90 test bonus/, 'the shop shows the bonus');
  const n = readOutput(dumpDom(path.join(work, 'profile-nojs'), noJsLobby, '#e2e=nojs'));
  assert.deepEqual(n.errors, [], 'no errors without study-history.js');
  assert.equal(n.missingShown, true, 'missing-file message shown');
  assert.equal(n.bodyHidden, true, 'history controls hidden');
  assert.equal(n.coinRowHidden, true, 'no wallet file: coins and Shop stay hidden');
  console.log('Lobby passed');
} catch (err) {
  console.log('FAIL lobby: ' + err.message);
  process.exitCode = 1;
} finally {
  fs.rmSync(work, { recursive: true, force: true });
}
