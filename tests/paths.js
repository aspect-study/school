// The one map of where the site's files live. Tests read paths from here, never hard-code them.
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const WEB = path.join(ROOT, 'web');
const ENGINE = path.join(WEB, 'engine');
const ENGINE_FILES = ['lang.js', 'storage.js', 'learner.js', 'clock.js', 'nav.js', 'search.js', 'read-gate.js', 'study-history.js', 'wallet.js', 'fx.js', 'powerups.js', 'recall.js', 'mastery.js', 'quests.js', 'boss.js', 'bosses.js', 'army.js', 'world.js', 'family.js', 'guide.js', 'trail.js', 'study-kit.js', 'sync-core.js', 'firebase-config.js', 'firebase-remote.js', 'cloud.js', 'shop-requests.js', 'subjects.js', 'insights.js', 'parent-pin.js', 'parent-panel.js', 'account.js'];
const WORLD = path.join(WEB, 'world');
// The 3D world pages and the scripts they load from web/world/, in load order.
const WORLDS = { 5: 'world/grade-5.html', 2: 'world/grade-2.html' };
const WORLD_FILES = ['text.js', 'layout.js', 'items.js', 'pets.js', 'emotes.js', 'furniture.js', 'room.js', 'trophies.js', 'house.js', 'moves.js', 'moverun.js', 'look.js', 'closet.js', 'prefs.js', 'walk.js', 'music.js', 'sfx.js', 'progress.js', 'buddies.js', 'lines.js', 'care.js', 'nudge.js', 'rides.js', 'mates.js', 'matelines.js', 'matequiz.js', 'mateboard.js', 'matemind.js', 'mategame.js', 'patintero.js', 'petlife.js', 'cheer.js', 'chat.js', 'quiz.js', 'teach.js', 'loot.js', 'lesson-files.js', 'scene.js', 'build.js', 'decor.js', 'cast.js', 'fort-boss.js', 'talk.js', 'ask.js', 'wear.js', 'room3d.js', 'petbody.js', 'pettricks.js', 'avatar.js', 'companion.js', 'move.js', 'maker.js', 'stall.js', 'boutique.js', 'petshop.js', 'toyshop.js', 'carpenter.js', 'decorate.js', 'playbar.js', 'usebar.js', 'town.js', 'folk.js', 'kin.js', 'play.js', 'mates3d.js', 'games3d.js', 'loot3d.js', 'world-main.js'];
// The engine files a world page loads, in order; world.js and subjects.js load without data-grade (pure helpers only).
// study-kit scores ❓ Ask me! answers the way the games do (and catches the lesson files ask.js loads). family.js brings
// her sister and the cheers; with no #campus on the page it shows no lobby card.
const WORLD_ENGINES = ['lang', 'storage', 'learner', 'clock', 'study-history', 'recall', 'mastery', 'wallet', 'quests', 'boss', 'bosses', 'guide', 'world', 'subjects', 'family', 'fx', 'study-kit'];
// The start page's animated backdrop (a standalone page in web/world, loaded in an iframe by web/index.html).
const BACKDROP_PAGE = 'world/backdrop.html';
const BACKDROP_FILES = ['text.js', 'layout.js', 'items.js', 'pets.js', 'moves.js', 'look.js', 'rides.js', 'wear.js', 'mates.js', 'mateboard.js', 'matemind.js', 'scene.js', 'build.js', 'petbody.js', 'avatar.js', 'backdrop-core.js', 'backdrop.js'];
const VENDOR_FILES = ['vendor/three/three.min.js', 'vendor/three/rounded-box.js'];

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
const worldFile = (name) => path.join(WORLD, name);
const appsOf = (grade) => APPS.filter((a) => a.grade === grade);

module.exports = { ROOT, WEB, ENGINE, ENGINE_FILES, LOBBIES, PARENT, APPS, REDIRECTS, app, web, appFile, lobbyFile, engineFile, appsOf, WORLD, WORLDS, WORLD_FILES, WORLD_ENGINES, VENDOR_FILES, worldFile, BACKDROP_PAGE, BACKDROP_FILES };
