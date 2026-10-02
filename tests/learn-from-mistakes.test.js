const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const { appFile } = require('./paths.js');
const { lessons: lessonsOf, content } = require('./content.js');
const FAMILY_B = ['word-train', 'batang-bayani', 'growing-good', 'byte-buddies', 'science-detectives'];
const FAMILY_A = ['block-bot', 'kuwentista'];

const filled = s => typeof s === 'string' && s.trim().length > 0;

for (const app of FAMILY_B) {
  test(`${app}: every wrong choice explains itself and every question has a tip`, () => {
    const lessons = lessonsOf(app);
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
    const lessons = lessonsOf(app);
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

const G5_FIXED = ['rise-shine', 'rally-ready', 'craft-corner', 'life-lab', 'history-explorers', 'page-turners', 'wikaharian'];
const G5_WITH_ENGLISH = ['history-explorers', 'wikaharian'];

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
    for (const lesson of lessonsOf(app)) {
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

function sandbox() {
  return { window: {}, localStorage: { getItem() { return null; }, setItem() {} }, location: { search: '', pathname: '', hash: '' }, history: {} };
}

// The generators and walkthrough stages are code in the page; the case studies and walkthroughs are data files.
function loadMath() {
  const html = fs.readFileSync(appFile('math-mastery'), 'utf8');
  const lessonsAt = html.indexOf('\nconst LESSONS = [');
  const start = html.lastIndexOf('<script>', lessonsAt) + 8;
  const code = html.slice(start, html.indexOf('\n];', lessonsAt) + 3);
  const stagesAt = html.indexOf('\nconst WT_STAGES = [');
  const stages = html.slice(stagesAt, html.indexOf('\n];', stagesAt) + 3);
  return {
    LESSONS: vm.runInNewContext(code + '\nLESSONS', sandbox()),
    WT_STAGES: vm.runInNewContext(stages + '\nWT_STAGES', sandbox()),
    CASES: content('math-mastery', 'cases'),
    WALKTHROUGH: content('math-mastery', 'walkthroughs'),
  };
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
