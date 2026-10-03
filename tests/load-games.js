// Reads every question and the TYPE_IT map out of a game's data files, for tests and tools.
const { lessons, content } = require('./content.js');

// Math Mastery is built differently and is not read by this loader.
const GRADE5 = ['craft-corner', 'history-explorers', 'life-lab', 'net-navigators', 'page-turners', 'rally-ready', 'rise-shine', 'wikaharian'];
const GRADE2 = ['batang-bayani', 'block-bot', 'byte-buddies', 'growing-good', 'kuwentista', 'science-detectives', 'word-train'];
const TF = /^(true|false|tama|mali)$/i;

// Every fixed quiz question as { lesson, q, answer, wrong, tf }.
function loadGame(app) {
  const questions = [];
  lessons(app).forEach((lesson, li) => {
    (lesson.quiz || []).forEach((item) => {
      if (item.type === 'tf') { questions.push({ lesson: li, q: item.q, answer: String(item.answer), wrong: [], tf: true, optionCount: 2 }); return; }
      const options = item.options.map((o) => (typeof o === 'string' ? o : o.text));
      const correct = typeof item.correct === 'number' ? item.correct : item.options.findIndex((o) => o.correct);
      const wrong = options.filter((o, i) => i !== correct);
      questions.push({ lesson: li, q: item.q, answer: options[correct], wrong, tf: options.length === 2 && options.every((o) => TF.test(o)), optionCount: options.length });
    });
  });
  return { questions, typeIt: content(app, 'typeIt') || null };
}

module.exports = { loadGame, GRADE5, GRADE2 };
