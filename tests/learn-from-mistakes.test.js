const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const dir = path.join(__dirname, '..', 'grade 2');
const FAMILY_B = ['word-train', 'batang-bayani', 'growing-good', 'byte-buddies', 'science-detectives'];
const FAMILY_A = ['block-bot', 'kuwentista'];

function read(app) {
  return fs.readFileSync(path.join(dir, app + '.html'), 'utf8');
}

function sandbox() {
  return {
    window: {},
    localStorage: { getItem() { return null; }, setItem() {} },
    location: { search: '', pathname: '', hash: '' },
    history: {},
    genNumberlineSet() { return []; },
  };
}

function loadFamilyB(app) {
  const html = read(app);
  const start = html.indexOf('  function shuffle(');
  const lessonsAt = html.indexOf('  var lessons = [', start);
  const end = html.indexOf('\n  ];', lessonsAt);
  assert.ok(start !== -1 && lessonsAt !== -1 && end !== -1, `${app}: lessons block not found`);
  return vm.runInNewContext(html.slice(start, end + 5) + '\nlessons', sandbox());
}

function loadFamilyA(app) {
  const html = read(app);
  const lessonsAt = html.indexOf('\nconst LESSONS = [');
  const helpersAt = html.indexOf('\nconst COIN_SPECS');
  const start = helpersAt !== -1 && helpersAt < lessonsAt ? helpersAt : lessonsAt;
  const end = html.indexOf('\n];', lessonsAt);
  assert.ok(lessonsAt !== -1 && end !== -1, `${app}: LESSONS not found`);
  return vm.runInNewContext(html.slice(start, end + 3) + '\nLESSONS', sandbox());
}

const filled = s => typeof s === 'string' && s.trim().length > 0;

for (const app of FAMILY_B) {
  test(`${app}: every wrong choice explains itself and every question has a tip`, () => {
    const lessons = loadFamilyB(app);
    assert.ok(lessons.length > 0);
    for (const lesson of lessons) {
      for (const item of lesson.quiz) {
        const where = `${app} / ${lesson.title} / "${item.q}"`;
        assert.ok(filled(item.tip), `${where}: missing tip`);
        assert.notEqual(item.tip, item.bad, `${where}: tip just repeats the explanation`);
        if (item.type === 'tf') {
          assert.ok(filled(item.why), `${where}: missing why`);
          assert.notEqual(item.why, item.bad, `${where}: why just repeats the explanation`);
        } else {
          for (const opt of item.options) {
            if (opt.correct) assert.ok(!opt.why, `${where}: the correct option "${opt.text}" should have no why`);
            else assert.ok(filled(opt.why), `${where}: wrong option "${opt.text}" has no why`);
          }
        }
      }
    }
  });
}

for (const app of FAMILY_A) {
  test(`${app}: every wrong choice explains itself and every question has a tip`, () => {
    const lessons = loadFamilyA(app);
    const fields = app === 'kuwentista' ? [['why', 'tip'], ['whyEn', 'tipEn']] : [['why', 'tip']];
    for (const lesson of lessons) {
      if (!lesson.quiz) continue;
      for (const q of lesson.quiz) {
        const where = `${app} / ${lesson.title} / "${q.q}"`;
        for (const [whyKey, tipKey] of fields) {
          assert.ok(filled(q[tipKey]), `${where}: missing ${tipKey}`);
          assert.ok(Array.isArray(q[whyKey]) && q[whyKey].length === q.options.length,
            `${where}: ${whyKey} must have one entry per option`);
          q.options.forEach((opt, i) => {
            if (i === q.correct) assert.ok(!q[whyKey][i], `${where}: ${whyKey} for the correct option should be empty`);
            else assert.ok(filled(q[whyKey][i]), `${where}: wrong option "${opt}" has no ${whyKey}`);
          });
        }
      }
    }
  });
}

const g5 = path.join(__dirname, '..');
const G5_FIXED = ['rise-shine', 'rally-ready', 'craft-corner', 'life-lab', 'history-explorers', 'page-turners', 'wikaharian'];
const G5_WITH_ENGLISH = ['history-explorers', 'wikaharian'];

function loadGrade5(app) {
  const html = fs.readFileSync(path.join(g5, app + '.html'), 'utf8');
  const lessonsAt = html.indexOf('\nconst LESSONS = [');
  const start = html.lastIndexOf('<script>', lessonsAt) + 8;
  const end = html.indexOf('\n];', lessonsAt);
  assert.ok(lessonsAt !== -1 && end !== -1, `${app}: LESSONS not found`);
  return vm.runInNewContext(html.slice(start, end + 3) + '\nLESSONS', sandbox());
}

function checkOptionWhys(where, q, whyKey) {
  assert.ok(Array.isArray(q[whyKey]) && q[whyKey].length === q.options.length,
    `${where}: ${whyKey} must have one entry per option`);
  q.options.forEach((opt, i) => {
    if (i === q.correct) assert.ok(!q[whyKey][i], `${where}: ${whyKey} for the correct option should be empty`);
    else assert.ok(filled(q[whyKey][i]), `${where}: wrong option "${opt}" has no ${whyKey}`);
  });
}

for (const app of G5_FIXED) {
  test(`${app}: every wrong choice explains itself and every question has a tip`, () => {
    const fields = G5_WITH_ENGLISH.includes(app) ? [['why', 'tip'], ['whyEn', 'tipEn']] : [['why', 'tip']];
    for (const lesson of loadGrade5(app)) {
      for (const q of lesson.quiz) {
        const where = `${app} / ${lesson.title} / "${q.q}"`;
        for (const [whyKey, tipKey] of fields) {
          assert.ok(filled(q[tipKey]), `${where}: missing ${tipKey}`);
          checkOptionWhys(where, q, whyKey);
        }
      }
    }
  });
}

function loadMath() {
  const html = fs.readFileSync(path.join(g5, 'math-mastery.html'), 'utf8');
  const lessonsAt = html.indexOf('\nconst LESSONS = [');
  const start = html.lastIndexOf('<script>', lessonsAt) + 8;
  const code = html.slice(start, html.indexOf('\n];', lessonsAt) + 3);
  const casesAt = html.indexOf('\nconst CASES = [');
  const cases = html.slice(casesAt, html.indexOf('\n];', casesAt) + 3);
  const wtAt = html.indexOf('\nconst WALKTHROUGH = [');
  const walkthrough = html.slice(wtAt, html.indexOf('\n];', html.indexOf('\nconst WT_STAGES = [')) + 3);
  return vm.runInNewContext(code + cases + walkthrough + '\n({ LESSONS, CASES, WALKTHROUGH, WT_STAGES })', sandbox());
}

test('math-mastery: every generated wrong choice explains itself and every question has a tip', () => {
  const { LESSONS } = loadMath();
  for (const lesson of LESSONS) {
    for (let round = 0; round < 25; round++) {
      for (const q of lesson.generate(8)) {
        const where = `math-mastery / ${lesson.title} / "${q.q}"`;
        assert.ok(filled(q.tip), `${where}: missing tip`);
        checkOptionWhys(where, q, 'why');
      }
    }
  }
});

test('math-mastery: every case-study choice explains itself and has a tip', () => {
  const { CASES } = loadMath();
  for (const cs of CASES) {
    for (const q of cs.questions.filter(x => x.type === 'choice')) {
      const where = `math-mastery / ${cs.title} / "${q.q}"`;
      assert.ok(filled(q.tip), `${where}: missing tip`);
      for (const o of q.options) {
        if (o.c) assert.ok(!o.w, `${where}: the correct option should have no w`);
        else assert.ok(filled(o.w), `${where}: wrong option "${o.t.slice(0, 40)}" has no w`);
      }
    }
  }
});

test('math-mastery: every UPAC walkthrough fact and choice explains itself and every step but Act has a tip', () => {
  const { WALKTHROUGH, WT_STAGES } = loadMath();
  [0, 1, 2, 4].forEach(i => assert.ok(filled(WT_STAGES[i].tip), `walkthrough stage ${i} (${WT_STAGES[i].title}): missing tip`));
  for (const p of WALKTHROUGH) {
    for (const g of p.givens) {
      assert.ok(filled(g.w), `math-mastery / ${p.id} / givens: "${g.t.slice(0, 40)}" has no w`);
    }
    for (const key of ['asked', 'plan', 'check']) {
      assert.equal(p[key].filter(o => o.c).length, 1, `math-mastery / ${p.id} / ${key}: exactly one right choice`);
      for (const o of p[key]) {
        assert.ok(filled(o.w), `math-mastery / ${p.id} / ${key}: "${o.t.slice(0, 40)}" has no w`);
      }
    }
  }
});
