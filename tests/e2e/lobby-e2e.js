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
    shop: { goal: '160 more coins to 3 ML games with Tatay!', movieNeed: '260 more coins', tomorrow: 'Come back tomorrow', earned: '⭐ 6000 new points → 🪙 300 coins · 🎁 40 welcome · 🛒 80 spent' },
    apps: ['word-train', 'kuwentista'],
    subjects: ['English', 'Filipino'],
    subjectOptions: 8,
    campusLabel: '🗺️ Village',
  },
  5: {
    key: 'history_v1',
    wallet: 'wallet_v1',
    otherWallet: 'learner/her-sister/wallet_v1',
    shop: { goal: '160 more coins to 3 ML games with Tatay!', movieNeed: '260 more coins', tomorrow: 'Come back tomorrow', earned: '⭐ 6000 new points → 🪙 300 coins · 🎁 40 welcome · 🛒 80 spent' },
    apps: ['page-turners', 'math-mastery'],
    subjects: ['English', 'Math'],
    subjectOptions: 11,
    campusLabel: '🗺️ Campus',
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
  assert.equal(r.rows30, 5, 'the default Last 30 days shows 5 rows (a,b,c,e,f; d is 40 days ago)');
  assert.deepEqual(r.panelsAtOpen, ['focus'], 'opens on Focus');
  assert.match(r.summary30, /Study time20 min/);
  assert.match(r.summary30, /Quizzes3/);
  assert.match(r.summary30, /Right answers81%/);
  assert.match(r.summary30, /To fix3/);
  assert.deepEqual(r.focusHeads, [cfg.subjects[0] + '80% right · 2 to fix', cfg.subjects[1] + '83% right · 1 to fix'], 'most to fix first');
  assert.equal(r.focusFirstOpen, true, 'the subject needing the most help starts open');
  assert.equal(r.focusQuestions.length, 2);
  assert.match(r.focusQuestions[0], /Pick the noun❌ run✅ catNouns/);
  assert.equal(r.focusChips, 0, 'answers saved without a key show no chip');
  assert.equal(r.keptClosed, true, 'a subject the parent closed stays closed after a re-render');
  assert.equal(r.keptOpen, true, 'a subject the parent opened stays open after a re-render');
  assert.equal(r.detailsCount, 2, 'b and e each have wrong answers in the list');
  assert.match(r.detailsText, /2 wrong answers/);
  assert.match(r.detailsText, /❌ run/);
  assert.match(r.detailsText, /✅ cat/);
  assert.equal(r.rowsAll, 6, 'All shows every row');
  assert.equal(r.focusWeakAll, 0, 'no lesson under 80% with 5 answers yet');
  assert.deepEqual(r.weakList, ['Verbs40% (4 of 10)']);
  assert.deepEqual(r.fixedChip, ['Fixed', 'Still missing']);
  assert.equal(r.fixedFolded, 'Fixed (1)');
  assert.equal(r.practiceLabel, '📌 Practice these: 1 question', 'only the still-missing keyed question is practised');
  assert.equal(r.practiceDue.box, 1);
  assert.equal(r.practiceDue.due, r.todayKey, 'Practice these makes the question due today');
  assert.ok(!('started' in r.practiceDue));
  assert.equal(typeof r.practiceDue.t, 'number');
  assert.deepEqual(r.adjAfter, r.adjSeeded, 'a fixed question is left alone');
  assert.ok(r.practiceAfter.indexOf('📌 In the review now: 1 question.') === 0, 'the button turns into a note once they are due');
  assert.equal(r.practiceKeptOpen, true, 'the subject stays open after Practice these');
  assert.equal(r.practiceSends.length, 1, 'Practice these records one send');
  assert.deepEqual(r.practiceSends[0].keys, ['k-pro'], 'holding the keys it marked');
  assert.equal(r.practiceSends[0].app, cfg.apps[0]);
  assert.equal(r.weekFirst, 'focus', 'This week is the first block in Focus');
  assert.deepEqual(r.weekRows.map((w) => w.name).sort(), cfg.subjects.slice().sort(), 'one row per subject with answers in either week');
  const week0 = r.weekRows.find((w) => w.name === cfg.subjects[0]), week1 = r.weekRows.find((w) => w.name === cfg.subjects[1]);
  assert.match(week0.stat, /80% right/);
  assert.match(week0.stat, /last week 60%/);
  assert.match(week0.stat, /▲ 20/);
  assert.equal(week0.chip, 'w-up');
  assert.match(week1.stat, /No quiz yet this week/);
  assert.match(week1.stat, /last week 70%/);
  assert.equal(week1.chip, '', 'no change chip without answers this week');
  assert.equal(r.weekFixed, '✅ Fixed this week: 1 question');
  assert.equal(r.weekSends.length, 1);
  assert.match(r.weekSends[0], new RegExp(' · ' + cfg.subjects[0] + ': 2 questions → 1 fixed, 1 still to fix$'));
  assert.equal(r.weekEmpty, '📈 This weekNo quiz answers this week or last week yet.');
  assert.match(r.allText, new RegExp(cfg.subjects[1] + ' · Final Mock Exam — stopped at 4 of 21, 3 correct'));
  assert.match(r.allText, new RegExp(cfg.subjects[1] + ' · Pangngalan — viewed 6 of 8 cards'));
  assert.match(r.allText, new RegExp(cfg.subjects[0] + ' · Nouns quiz — 8/10 ⭐⭐ \\+95 pts · 4 min'));
  assert.match(r.allText, new RegExp(cfg.subjects[1] + ' · UPAC Walkthrough: Dough problem — 4/5 steps'));
  assert.match(r.allText, new RegExp(cfg.subjects[1] + ' · Case Study: Bibingka at the Fiesta — stopped at 1 of 3, 1 correct'));
  assert.ok(r.allText.includes('8/10 ⭐⭐ +95 pts · 4 min · ⚡ Hint, Ask Mommy (7 coins)'), 'power-ups on a finished quiz');
  assert.ok(r.allText.includes('stopped at 1 of 3, 1 correct · ⚡ Save for Later (2 coins)'), 'power-ups on a stopped quiz');
  assert.equal(r.rowsKuwentista, 4, 'subject filter');
  assert.equal(r.subjectOptions, cfg.subjectOptions, 'All subjects + apps');
  assert.deepEqual(r.panelsSubjects, ['subjects']);
  assert.equal(r.subjectsTabOn, 'true');
  assert.equal(r.subjectRows, cfg.subjectOptions - 1, 'one row per subject');
  assert.deepEqual(r.panelsAfterReopen, ['focus'], 'every open starts on Focus again');
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
  assert.equal(r.shopCoins, '🪙 340 coins', '6000 new points earn 300 coins at 20 a coin');
  assert.equal(r.shopGoal, cfg.shop.goal);
  assert.equal(r.movieNeed, cfg.shop.movieNeed);
  assert.equal(r.mlBuyable, true);
  assert.equal(r.mlHasNote, true, 'ML shows its rules');
  assert.ok(r.allItems > 20, 'the whole catalog shows');
  assert.deepEqual(r.tatayItems, ['piggy', 'hero', 'tatay1', 'vs', 'teach', 'duo', 'tatay2', 'tatay3'], 'search ignores case');
  assert.equal(r.noMatchShown, true, 'no match says so');
  assert.equal(r.allBack, r.allItems, 'clearing the search shows everything');
  assert.equal(r.pinShown, true, 'Buy asks for the parent PIN');
  assert.equal(r.wrongPinSpent, 0, 'a wrong PIN spends nothing');
  assert.equal(r.wrongPinStays, true);
  assert.match(r.doneText, /🎉/);
  assert.equal(r.badgeAfter, '🪙 260 coins');
  assert.equal(r.spentAfter, 80);
  assert.equal(r.pointsAfter, '6000', 'buying never changes points');
  assert.equal(r.mlAfter, cfg.shop.tomorrow);
  assert.equal(r.earnedText, cfg.shop.earned, 'the shop shows how points became coins');
  assert.equal(r.cancelSpent, 80, 'cancelling the PIN spends nothing');
  assert.equal(r.escClosed, true);
  assert.equal(r.otherWallet, 'untouched', 'the other grade\'s wallet is never touched');
  assert.deepEqual(r.purchaseLogged, [{ item: 'ml', coins: 80 }]);
  assert.equal(r.shopDownload, 'shop-history-grade' + grade + '-' + r.today + '.csv');
  assert.match(r.parentList, /🛒 Bought Rest: play 1 ML \(Mobile Legends\) game — 80 coins/);

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
  assert.match(t.shopEarned, /✨ 90 bonus/, 'the shop shows the bonus');
  const rv = readOutput(dumpDom(path.join(work, 'profile-review'), withJsLobby, '#e2e=review'));
  assert.deepEqual(rv.errors, [], 'review card: page errors');
  assert.equal(rv.newLearnerHidden, true, 'a new learner with no boxes sees no review card');
  assert.equal(rv.first.hidden, false, 'a due question shows the card');
  assert.equal(rv.first.chips, 1, 'one chip for the one subject with something due');
  assert.equal(rv.first.href, rv.cardHref + '&review=1', 'the chip opens that game in review mode');
  assert.match(rv.first.text, /1$/, 'the chip shows the due count');
  assert.equal(rv.caughtUp.hidden, false, 'nothing due but a future review still shows the card');
  assert.match(rv.caughtUp.text, /🎉.*\(1\)$/, 'caught up, with when the next review is and how many');
  assert.equal(rv.emptyHidden, true, 'no boxes at all hides the card');
  const mp = readOutput(dumpDom(path.join(work, 'profile-map'), withJsLobby, '#e2e=map'));
  assert.deepEqual(mp.errors, [], 'map: page errors');
  assert.equal(mp.buttonHidden, false, 'the Medals button shows');
  assert.equal(mp.viewHidden, false, 'tapping it opens the map');
  assert.equal(mp.expanded, 'true');
  assert.deepEqual(mp.tiles.map((t) => t.text), ['🥇Lesson X', '🥈🔧Lesson Y'], 'medal per lesson, polish mark when slipped');
  assert.ok(mp.tiles.every((t) => t.href === mp.cardHref), 'a tile opens the game like its card');
  assert.match(mp.count, /🥇 1 · 🥈 1 · 🥉 0/);
  assert.equal(mp.rows, mp.cards, 'one row per subject');
  assert.equal(mp.empty, mp.cards - 1, 'games never opened say so');
  assert.equal(mp.closed, true, 'tapping again closes it');
  const qs = readOutput(dumpDom(path.join(work, 'profile-quests'), withJsLobby, '#e2e=quests'));
  assert.deepEqual(qs.errors, [], 'quests: page errors');
  assert.equal(qs.hidden, false, 'the quest card shows');
  assert.equal(qs.items.length, 3, 'three quests');
  assert.match(qs.items[0], /🔁/, 'something is due, so slot 1 is a Review quest');
  assert.equal(qs.firstHref, qs.cardHref + '&review=1', 'it opens that game in Review mode');
  assert.match(qs.streakBefore, /Start a streak today!/);
  assert.equal(qs.events[0].big, true, 'all 3 done is the big one');
  assert.equal(qs.events.length, 4, 'all 3 done, then each quest');
  assert.equal(qs.again, 0, 'celebrated once');
  assert.equal(qs.bonusPaid, 3, 'all 3 quests pay 3 coins once');
  assert.equal(qs.doneCount, 3, 'all ticked');
  assert.match(qs.streakAfter, /🔥 .*1-day streak/, 'the streak line shows the fire and the English 1-day streak (Grade 2 adds Filipino before it)');
  assert.equal(qs.bonusAfterSync, 0, 'a cloud sync after all 3 are done pays nothing more');
  assert.equal(qs.queuedAfterSync, 0, 'and opens no new popup');
  const bs = readOutput(dumpDom(path.join(work, 'profile-boss'), withJsLobby, '#e2e=boss'));
  assert.deepEqual(bs.errors, [], 'boss: page errors');
  assert.equal(bs.hidden, false, 'the boss card shows');
  assert.deepEqual(bs.stages, bs.expect, 'the 2 games with review boxes, most due first');
  assert.equal(bs.rows, 2);
  assert.equal(bs.firstHref, bs.cardHref + '&boss=1', 'a stage opens its game in boss mode');
  assert.equal(bs.beat, 1, 'clearing both stages beats the boss');
  assert.equal(bs.beatArt, true, 'the boss popup shows his face');
  assert.ok(bs.beatWho.length > 3, 'and his name');
  assert.equal(bs.coins, 10);
  assert.match(bs.title, /Boss beaten! (New boss on|A new boss comes on) Monday/);
  assert.equal(bs.links, 0, 'cleared stages have no links');
  assert.equal(bs.coinsAfterSync, 10, 'a sync pays nothing more');
  const cp = readOutput(dumpDom(path.join(work, 'profile-campus'), withJsLobby, '#e2e=campus'));
  assert.deepEqual(cp.errors, [], 'campus: page errors');
  assert.equal(cp.campusShown, true, 'the lobby opens on the map');
  assert.equal(cp.gridHidden, true, 'the cards wait behind the List button');
  assert.equal(cp.toggleShown, true);
  assert.equal(cp.toggleText, '📋 List');
  assert.equal(cp.buildings, cp.cards, 'one building per card');
  assert.equal(cp.pickerOpen, true, 'a new player picks a buddy first');
  assert.equal(cp.avatar, 'owl');
  assert.equal(cp.buddy, '🦉');
  assert.equal(cp.pickerAfter, false, 'picking closes the picker');
  assert.deepEqual(cp.firstMarks, ['🔁3'], 'due review shows its count');
  assert.deepEqual(cp.secondMarks, ['⚔️', '❗'], 'the boss stage first, then the quest');
  assert.equal(cp.arenaSub, '1 / 2', 'the arena counts stages cleared');
  assert.match(cp.firstLabel, /, 3 review questions due$/);
  assert.ok(cp.went, 'tapping a building navigates');
  assert.equal(cp.went, cp.cardHref, 'tapping a building opens its game');
  assert.equal(cp.savedAt, cp.firstApp);
  assert.notEqual(cp.afterWalk, cp.atGate, 'the buddy walked to the building');
  assert.equal(cp.afterReturn, cp.afterWalk, 'coming back, the buddy waits at that building');
  assert.equal(cp.shopOpen, true, 'the shop building opens the shop');
  assert.equal(cp.listGridShown, true, 'List shows the cards');
  assert.equal(cp.listCampusHidden, true);
  assert.equal(cp.listToggle, cfg.campusLabel);
  assert.equal(cp.savedView, 'list');
  assert.equal(cp.listAfterReload, true, 'the lobby opens in List next time');
  const n = readOutput(dumpDom(path.join(work, 'profile-nojs'), noJsLobby, '#e2e=nojs'));
  assert.deepEqual(n.errors, [], 'no errors without study-history.js');
  assert.equal(n.missingShown, true, 'missing-file message shown');
  assert.equal(n.bodyHidden, true, 'history controls hidden');
  assert.equal(n.coinRowHidden, true, 'no wallet file: coins and Shop stay hidden');
  assert.equal(n.gridShownNoWorld, true, 'no world.js: the cards show as before');
  assert.equal(n.campusHiddenNoWorld, true);
  assert.equal(n.toggleHiddenNoWorld, true);
  console.log('Lobby passed');
} catch (err) {
  console.log('FAIL lobby: ' + err.message);
  process.exitCode = 1;
} finally {
  fs.rmSync(work, { recursive: true, force: true });
}
