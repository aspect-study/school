// Reads every question and the TYPE_IT map out of a game file, for tests and tools.
const fs = require('node:fs');
const vm = require('node:vm');
const { appFile } = require('./paths.js');

// Math Mastery is built differently and is not read by this loader.
const GRADE5 = ['craft-corner', 'history-explorers', 'life-lab', 'page-turners', 'rally-ready', 'rise-shine', 'wikaharian'];
const GRADE2 = ['batang-bayani', 'block-bot', 'byte-buddies', 'growing-good', 'kuwentista', 'science-detectives', 'word-train'];
const FAMILY_B = ['batang-bayani', 'byte-buddies', 'growing-good', 'science-detectives', 'word-train'];
const TF = /^(true|false|tama|mali)$/i;

function sandbox() {
  return {
    window: {},
    localStorage: { getItem() { return null; }, setItem() {} },
    location: { search: '', pathname: '', hash: '' },
    history: {},
    genNumberlineSet() { return []; },
    StudyKit: { start() { return { progress() { return {}; } }; } },
  };
}

function loadLessons(app, html) {
  if (FAMILY_B.includes(app)) {
    const start = html.indexOf('  function shuffle(');
    const at = html.indexOf('  var lessons = [', start);
    const end = html.indexOf('\n  ];', at);
    return vm.runInNewContext(html.slice(start, end + 5) + '\nlessons', sandbox());
  }
  const at = html.indexOf('\nconst LESSONS = [');
  const helpers = html.indexOf('\nconst COIN_SPECS');
  const start = GRADE5.includes(app) ? html.lastIndexOf('<script>', at) + 8 : (helpers !== -1 && helpers < at ? helpers : at);
  const end = html.indexOf('\n];', at);
  return vm.runInNewContext(html.slice(start, end + 3) + '\nLESSONS', sandbox());
}

function loadTypeIt(app, html) {
  const at = html.indexOf('TYPE_IT = {');
  if (at < 0) return null;
  const open = html.indexOf('{', at);
  if (html.slice(open, open + 2) === '{}') return {};
  const end = html.indexOf(FAMILY_B.includes(app) ? '\n  };' : '\n};', open);
  return vm.runInNewContext('(' + html.slice(open, end + (FAMILY_B.includes(app) ? 4 : 2)) + ')');
}

// Every fixed quiz question as { lesson, q, answer, wrong, tf }.
function loadGame(app) {
  const html = fs.readFileSync(appFile(app), 'utf8');
  const questions = [];
  loadLessons(app, html).forEach((lesson, li) => {
    (lesson.quiz || []).forEach((item) => {
      if (item.type === 'tf') { questions.push({ lesson: li, q: item.q, answer: String(item.answer), wrong: [], tf: true, optionCount: 2 }); return; }
      const options = item.options.map((o) => (typeof o === 'string' ? o : o.text));
      const correct = typeof item.correct === 'number' ? item.correct : item.options.findIndex((o) => o.correct);
      const wrong = options.filter((o, i) => i !== correct);
      questions.push({ lesson: li, q: item.q, answer: options[correct], wrong, tf: options.length === 2 && options.every((o) => TF.test(o)), optionCount: options.length });
    });
  });
  return { questions, typeIt: loadTypeIt(app, html) };
}

module.exports = { loadGame, GRADE5, GRADE2 };
