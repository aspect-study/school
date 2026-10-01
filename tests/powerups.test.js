const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pickOut, createCore, TEXT, MAX_PER_QUIZ } = require(path.join(__dirname, '..', 'grade 2', 'powerups-grade2.js'));
const { POWER_UPS } = require(path.join(__dirname, '..', 'grade 2', 'wallet-grade2.js'));

function fakeWallet(balance) {
  return {
    balance,
    balanceStored() { return this.balance; },
    spend(n) { if (this.balance < n) return false; this.balance -= n; return true; },
  };
}

function fakeHistory() {
  const log = [];
  return { log, powerUpUsed: (id, kind, coins, q) => log.push({ id, kind, coins, q }) };
}

function question(over) {
  return Object.assign({ quiz: [], exam: false, tip: 'A tip', optionCount: 4, historyId: 'h1', q: 'Q?' }, over);
}

test('the prices: Hint 3, 50/50 5, Second Chance 5, Streak Shield 4, Save for Later 2, Ask Ate 2, Mommy 4, Tatay 4', () => {
  assert.deepEqual(POWER_UPS, { hint: 3, fifty: 5, second: 5, shield: 4, later: 2, ate: 2, mommy: 4, tatay: 4 });
  assert.equal(MAX_PER_QUIZ, 2);
});

test('50/50 crosses out half the options and never the right one', () => {
  for (let trial = 0; trial < 200; trial++) {
    for (const count of [3, 4, 5]) {
      const correct = trial % count;
      const out = pickOut(count, correct, Math.random);
      assert.equal(out.length, Math.floor(count / 2));
      assert.ok(!out.includes(correct));
      assert.equal(new Set(out).size, out.length);
    }
  }
});

test('a power-up costs coins, is logged, and makes the answer helped', () => {
  const wallet = fakeWallet(20), history = fakeHistory();
  const core = createCore(wallet, history, POWER_UPS);
  core.question(question());
  assert.equal(core.status('hint'), 'ok');
  assert.equal(core.use('hint'), true);
  assert.equal(wallet.balance, 17);
  assert.equal(core.status('hint'), 'used', 'one hint per question');
  assert.deepEqual(history.log, [{ id: 'h1', kind: 'hint', coins: 3, q: 'Q?' }]);
  assert.equal(core.answered(), true);
  assert.equal(core.status('fifty'), 'na', 'nothing after answering');
});

test('an unhelped answer is not helped', () => {
  const core = createCore(fakeWallet(20), null, POWER_UPS);
  core.question(question());
  assert.equal(core.answered(), false);
});

test('at most 2 power-ups per quiz; a new quiz starts the count over', () => {
  const wallet = fakeWallet(100);
  const core = createCore(wallet, null, POWER_UPS);
  const quiz = [];
  core.question(question({ quiz }));
  assert.equal(core.use('hint'), true);
  core.answered();
  core.question(question({ quiz }));
  assert.equal(core.use('fifty'), true);
  core.answered();
  core.question(question({ quiz }));
  assert.equal(core.status('hint'), 'max');
  assert.equal(core.use('hint'), false);
  assert.equal(wallet.balance, 92);
  core.question(question({ quiz: [] }));
  assert.equal(core.status('hint'), 'ok');
});

test('no power-ups in the mock exam', () => {
  const core = createCore(fakeWallet(100), null, POWER_UPS);
  core.question(question({ exam: true }));
  assert.equal(core.status('hint'), 'exam');
  assert.equal(core.use('fifty'), false);
});

test('no 50/50 on True/False or typed answers, no hint without a tip', () => {
  const core = createCore(fakeWallet(100), null, POWER_UPS);
  core.question(question({ optionCount: 2, tip: '' }));
  assert.equal(core.status('fifty'), 'na');
  assert.equal(core.status('hint'), 'na');
  core.question(question({ optionCount: 0 }));
  assert.equal(core.status('fifty'), 'na');
  assert.equal(core.status('hint'), 'ok');
});

test('not enough coins: nothing is spent', () => {
  const wallet = fakeWallet(4);
  const core = createCore(wallet, null, POWER_UPS);
  core.question(question());
  assert.equal(core.status('fifty'), 'poor');
  assert.equal(core.use('fifty'), false);
  assert.equal(core.status('hint'), 'ok');
  assert.equal(wallet.balance, 4);
});

test('both grades have the same power-up messages', () => {
  assert.deepEqual(Object.keys(TEXT.grade2).sort(), Object.keys(TEXT.grade5).sort());
});

test('Second Chance only makes the answer helped when the first pick missed', () => {
  const core = createCore(fakeWallet(100), null, POWER_UPS);
  core.question(question());
  assert.equal(core.use('second'), true);
  assert.equal(core.answered(), false, 'right first time: full points');
  core.question(question());
  assert.equal(core.use('second'), true);
  assert.equal(core.secondChance(), true, 'first miss: pick again');
  assert.equal(core.secondChance(), false, 'only one extra try');
  assert.equal(core.answered(), true);
});

test('Second Chance needs 3 or more options', () => {
  const core = createCore(fakeWallet(100), null, POWER_UPS);
  core.question(question({ optionCount: 2 }));
  assert.equal(core.status('second'), 'na');
});

test('Streak Shield needs a streak, saves the next miss once, and ends with the quiz', () => {
  const core = createCore(fakeWallet(100), null, POWER_UPS);
  const quiz = [];
  core.question(question({ quiz, streak: 1 }));
  assert.equal(core.status('shield'), 'na', 'nothing to protect yet');
  core.question(question({ quiz, streak: 2 }));
  assert.equal(core.use('shield'), true);
  assert.equal(core.status('shield'), 'na', 'one shield at a time');
  assert.equal(core.answered(), false, 'a shield does not help the answer');
  assert.equal(core.shield(), true);
  assert.equal(core.shield(), false, 'used up');
  core.question(question({ quiz, streak: 3 }));
  assert.equal(core.use('shield'), true);
  core.question(question({ quiz: [], streak: 3 }));
  assert.equal(core.shield(), false, 'a new quiz drops an unused shield');
});

test('Save for Later is not offered on the last question and never halves points', () => {
  const core = createCore(fakeWallet(100), null, POWER_UPS);
  core.question(question({ canSkip: false }));
  assert.equal(core.status('later'), 'na');
  core.question(question({ canSkip: true }));
  assert.equal(core.use('later'), true);
  assert.equal(core.answered(), false);
});

test('Ask Family: Ate is only for Grade 2, one helper per question, and it helps the answer', () => {
  const wallet = fakeWallet(100), history = fakeHistory();
  const core = createCore(wallet, history, POWER_UPS);
  core.question(question({ helpers: TEXT.grade5.helpers }));
  assert.equal(core.status('ate'), 'na', 'no Ate in Grade 5');
  assert.equal(core.status('family'), 'ok');
  assert.equal(core.use('family'), false, 'the Ask Family button only opens the picker');
  assert.equal(core.use('mommy'), true);
  assert.equal(core.helperAsked(), 'mommy');
  assert.equal(core.status('tatay'), 'used', 'one helper per question');
  assert.equal(core.status('later'), 'na', 'cannot skip a question someone is explaining');
  assert.equal(wallet.balance, 96);
  assert.equal(core.answered(), true);
  core.question(question({ helpers: TEXT.grade2.helpers }));
  assert.equal(core.status('ate'), 'ok');
});

test('Ask Family is final once paid: no cancel, no refund', () => {
  const wallet = fakeWallet(100), history = fakeHistory();
  const core = createCore(wallet, history, POWER_UPS);
  core.question(question({ helpers: TEXT.grade2.helpers }));
  core.use('tatay');
  assert.equal(core.cancelFamily, undefined);
  assert.equal(wallet.balance, 96);
  assert.equal(core.left(), 1);
  assert.deepEqual(history.log.map((e) => e.kind), ['tatay']);
});

test('Ask Family needs coins for the cheapest helper', () => {
  const core = createCore(fakeWallet(3), null, POWER_UPS);
  core.question(question({ helpers: TEXT.grade5.helpers }));
  assert.equal(core.status('family'), 'poor');
  core.question(question({ helpers: TEXT.grade2.helpers }));
  assert.equal(core.status('family'), 'ok');
  assert.equal(core.status('mommy'), 'poor');
});

test('Save for Later is off once any help was used on the question, so help cannot be carried to a full-points retry', () => {
  for (const kind of ['hint', 'fifty', 'second']) {
    const core = createCore(fakeWallet(100), null, POWER_UPS);
    core.question(question({ canSkip: true }));
    assert.equal(core.use(kind), true);
    assert.equal(core.status('later'), 'na', kind + ' then Later');
  }
});

const fs = require('node:fs');
const root = path.join(__dirname, '..');
const GRADE5 = ['craft-corner', 'history-explorers', 'life-lab', 'math-mastery', 'page-turners', 'rally-ready', 'rise-shine', 'wikaharian'];
const GRADE2 = ['batang-bayani', 'block-bot', 'byte-buddies', 'growing-good', 'kuwentista', 'science-detectives', 'word-train'];
const games = GRADE5.map((a) => ({ a, file: path.join(root, a + '.html'), tag: '<script src="powerups.js" data-grade="grade5"></script>' }))
  .concat(GRADE2.map((a) => ({ a, file: path.join(root, 'grade 2', a + '.html'), tag: '<script src="powerups-grade2.js" data-grade="grade2"></script>' })));

for (const g of games) {
  test(g.a + ' offers power-ups on every question and halves points for a helped answer', () => {
    const html = fs.readFileSync(g.file, 'utf8');
    assert.ok(html.indexOf(g.tag) > html.indexOf('<script src="' + (g.tag.includes('grade2') ? 'wallet-grade2.js' : 'wallet.js')), 'after the wallet file');
    const answers = html.split('PowerUps.answered()').length - 1;
    assert.ok(answers > 0);
    const offers = html.split('PowerUps.offer({').length - 1 + html.split('offerQuestion({').length - 1;
    assert.ok(offers >= answers, 'every answered question was offered');
    assert.equal(html.split('if(!helped) streak++;').length + html.split('if (!helped) streak++;').length - 2, html.split('streak++;').length - 1, 'a helped answer never grows the streak');
    assert.equal(html.split(/helped \? ptsBase \/ 2 :/).length - 1, html.split('streak++;').length - 1, 'a helped answer earns half points');
    assert.match(html, /exam: ?currentQuizMeta\.id === 'final'/, 'no power-ups in the mock exam');
    assert.equal(html.split('PowerUps.shield()').length - 1, html.split('window.Fx && Fx.wrong();').length - 1, 'every wrong answer checks for a Streak Shield');
    assert.equal(html.split('rerender:').length - 1, offers, 'every question can be saved for later');
  });
}

test('power-ups can be skipped for a question (resting or waiting for a typed answer)', () => {
  const src = fs.readFileSync(path.join(root, 'grade 2', 'powerups-grade2.js'), 'utf8');
  assert.match(src, /skip: function \(\) \{\n\s+disarm\(\);\n\s+info = null;\n\s+if \(bar && bar\.parentNode\) bar\.parentNode\.removeChild\(bar\);/);
});
