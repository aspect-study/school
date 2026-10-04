// The one map of where the site's files live. Tests read paths from here, never hard-code them.
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const WEB = path.join(ROOT, 'web');
const ENGINE = path.join(WEB, 'engine');
const ENGINE_FILES = ['storage.js', 'learner.js', 'nav.js', 'search.js', 'read-gate.js', 'study-history.js', 'wallet.js', 'fx.js', 'powerups.js', 'recall.js', 'mastery.js', 'quests.js', 'study-kit.js', 'sync-core.js', 'firebase-config.js', 'firebase-remote.js', 'cloud.js', 'shop-requests.js', 'subjects.js', 'parent-panel.js'];

const LOBBIES = {
  5: { page: 'lobby/grade-5.html', manifest: 'lobby/grade-5.webmanifest' },
  2: { page: 'lobby/grade-2.html', manifest: 'lobby/grade-2.webmanifest' },
};

// The parent page on the phone (phase 5c): not a lobby, but installable the same way.
const PARENT = { page: 'parent/index.html', manifest: 'parent/parent.webmanifest' };

// Every game folder has a subject.json: { id, title, grade, subject, pointsKey, progressKey }.
// id is the app's study-history ID and must never change; subject is its folder.
const APPS = fs.readdirSync(path.join(WEB, 'subjects')).flatMap((g) =>
  fs.readdirSync(path.join(WEB, 'subjects', g))
    .filter((s) => fs.existsSync(path.join(WEB, 'subjects', g, s, 'subject.json')))
    .map((s) => JSON.parse(fs.readFileSync(path.join(WEB, 'subjects', g, s, 'subject.json'), 'utf8'))))
  .sort((x, y) => y.grade - x.grade || x.subject.localeCompare(y.subject))
  .map((app) => ({ ...app, page: 'subjects/grade-' + app.grade + '/' + app.subject + '/index.html' }));

// The addresses pages had before 2026-10-02, kept so installed home-screen icons and bookmarks still open.
const REDIRECTS = [
  ['lobby-grade5.html', LOBBIES[5].page],
  ['grade 2/lobby.html', LOBBIES[2].page],
  ['math-mastery.html', 'subjects/grade-5/math/index.html'],
  ['page-turners.html', 'subjects/grade-5/english/index.html'],
  ['wikaharian.html', 'subjects/grade-5/filipino/index.html'],
  ['history-explorers.html', 'subjects/grade-5/araling-panlipunan/index.html'],
  ['life-lab.html', 'subjects/grade-5/science/index.html'],
  ['rise-shine.html', 'subjects/grade-5/gmrc/index.html'],
  ['rally-ready.html', 'subjects/grade-5/pe-health/index.html'],
  ['craft-corner.html', 'subjects/grade-5/tle/index.html'],
  ['grade 2/block-bot.html', 'subjects/grade-2/math/index.html'],
  ['grade 2/word-train.html', 'subjects/grade-2/english/index.html'],
  ['grade 2/kuwentista.html', 'subjects/grade-2/filipino/index.html'],
  ['grade 2/batang-bayani.html', 'subjects/grade-2/makabansa/index.html'],
  ['grade 2/science-detectives.html', 'subjects/grade-2/science/index.html'],
  ['grade 2/growing-good.html', 'subjects/grade-2/gmrc/index.html'],
  ['grade 2/byte-buddies.html', 'subjects/grade-2/computer/index.html'],
].map(([from, to]) => ({ from, to }));

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

module.exports = { ROOT, WEB, ENGINE, ENGINE_FILES, LOBBIES, PARENT, APPS, REDIRECTS, app, web, appFile, lobbyFile, engineFile, appsOf };
