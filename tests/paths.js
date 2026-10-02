// The one map of where the site's files live. Tests read paths from here, never hard-code them.
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const WEB = path.join(ROOT, 'web');
const ENGINE = path.join(WEB, 'engine');
const ENGINE_FILES = ['study-history.js', 'wallet.js', 'fx.js', 'powerups.js', 'recall.js'];

const LOBBIES = {
  5: { page: 'lobby/grade-5.html', manifest: 'lobby/grade-5.webmanifest' },
  2: { page: 'lobby/grade-2.html', manifest: 'lobby/grade-2.webmanifest' },
};

// id is the app's study-history ID and must never change; subject is its folder.
const APPS = [
  { id: 'math-mastery', grade: 5, subject: 'math', title: 'Math Mastery' },
  { id: 'page-turners', grade: 5, subject: 'english', title: 'Page Turners' },
  { id: 'wikaharian', grade: 5, subject: 'filipino', title: 'Wikaharian' },
  { id: 'history-explorers', grade: 5, subject: 'araling-panlipunan', title: 'History Explorers' },
  { id: 'life-lab', grade: 5, subject: 'science', title: 'Life Lab' },
  { id: 'rise-shine', grade: 5, subject: 'gmrc', title: 'Rise & Shine' },
  { id: 'rally-ready', grade: 5, subject: 'pe-health', title: 'Rally Ready' },
  { id: 'craft-corner', grade: 5, subject: 'tle', title: 'Craft Corner' },
  { id: 'block-bot', grade: 2, subject: 'math', title: 'Block Bot' },
  { id: 'word-train', grade: 2, subject: 'english', title: 'Word Train' },
  { id: 'kuwentista', grade: 2, subject: 'filipino', title: 'Kuwentista' },
  { id: 'batang-bayani', grade: 2, subject: 'makabansa', title: 'Batang Bayani' },
  { id: 'science-detectives', grade: 2, subject: 'science', title: 'Science Detectives' },
  { id: 'growing-good', grade: 2, subject: 'gmrc', title: 'Growing Good' },
  { id: 'byte-buddies', grade: 2, subject: 'computer', title: 'Byte Buddies' },
].map((app) => ({ ...app, page: 'subjects/grade-' + app.grade + '/' + app.subject + '/index.html' }));

// Old URLs (before 2026-10-02) that installed home-screen icons and bookmarks may still open.
const REDIRECTS = [
  { from: 'lobby-grade5.html', to: LOBBIES[5].page },
  { from: 'grade 2/lobby.html', to: LOBBIES[2].page },
  ...APPS.map((a) => ({ from: (a.grade === 2 ? 'grade 2/' : '') + a.id + '.html', to: a.page })),
];

function app(id) {
  const found = APPS.find((a) => a.id === id);
  if (!found) throw new Error('unknown app ' + id);
  return found;
}

const web = (rel) => path.join(WEB, rel);
const appFile = (id) => web(app(id).page);
const lobbyFile = (grade) => web(LOBBIES[grade].page);
const engineFile = (name) => path.join(ENGINE, name);
const appsOf = (grade) => APPS.filter((a) => a.grade === grade);

module.exports = { ROOT, WEB, ENGINE, ENGINE_FILES, LOBBIES, APPS, REDIRECTS, app, web, appFile, lobbyFile, engineFile, appsOf };
