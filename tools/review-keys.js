// Before an audit rewrites a game: `node tools/review-keys.js snapshot <game dir>` saves every question's review hash.
// After: `node tools/review-keys.js check <game dir>` lists each question whose key changed and the was line it needs.
// Questions are matched by lesson file and position, so a rewrite keeps every question where it is.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { dataFiles } = require('../tests/content.js');
const { gameKey, hashOf } = require('../tests/game-keys.js');

// Not in sources/.text, so clearing the text cache never loses a snapshot.
const AUDIT = path.join(__dirname, '..', 'sources', '.audit');

function game(dir) {
  const abs = path.resolve(dir);
  const meta = JSON.parse(fs.readFileSync(path.join(abs, 'subject.json'), 'utf8'));
  return { id: meta.id, dir: abs };
}

function questions(g) {
  const out = [];
  dataFiles(g.id).filter((rel) => rel.startsWith('lessons/')).forEach((rel) => {
    const found = [];
    vm.runInNewContext(fs.readFileSync(path.join(g.dir, rel), 'utf8'),
      { StudyKit: { lesson: (l) => found.push(l), content: () => undefined } }, { filename: rel });
    found.forEach((l, li) => {
      if (l.generate) return;
      (l.quiz || []).forEach((item, i) => out.push({ where: rel + '#' + li + '.' + i, item }));
    });
  });
  return out;
}

function snapshotFile(g) { return path.join(AUDIT, 'keys-' + g.id + '.json'); }

function snapshot(g, force) {
  const file = snapshotFile(g);
  if (fs.existsSync(file) && !force) {
    console.error(file + ' exists (taken before this audit started). Use --force only to start the audit over.');
    return 1;
  }
  const list = questions(g).map((x) => ({ where: x.where, q: x.item.q, hash: hashOf(gameKey(g.id, x.item)) }));
  fs.mkdirSync(AUDIT, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(list, null, 1));
  console.log('Saved ' + list.length + ' question keys to ' + file);
  return 0;
}

function check(g) {
  const file = snapshotFile(g);
  if (!fs.existsSync(file)) { console.error('No snapshot: run snapshot before rewriting.'); return 1; }
  const old = new Map(JSON.parse(fs.readFileSync(file, 'utf8')).map((e) => [e.where, e]));
  const now = questions(g);
  const stems = new Map();
  now.forEach(({ item }) => stems.set(item.q, (stems.get(item.q) || 0) + 1));
  let changed = 0, problems = 0;
  for (const { where, item } of now) {
    const before = old.get(where);
    old.delete(where);
    if (!before || hashOf(gameKey(g.id, item)) === before.hash) continue;
    changed++;
    if (stems.get(item.q) > 1) {
      problems++;
      console.log(where + '  stem shared with another question: make this stem unique, then add was: \'' + before.hash + '\'');
      continue;
    }
    if (item.was === before.hash) continue;
    problems++;
    console.log(where + '  add  was: \'' + before.hash + '\',   // ' + String(item.q).slice(0, 60));
  }
  for (const [where, e] of old) {
    problems++;
    console.log(where + '  removed: "' + String(e.q).slice(0, 60) + '" (an audit keeps every question in place)');
  }
  console.log(changed + ' reworded, ' + problems + ' to fix');
  return problems ? 1 : 0;
}

const [cmd, dir, flag] = process.argv.slice(2);
if (!dir || (cmd !== 'snapshot' && cmd !== 'check')) {
  console.error('Usage: node tools/review-keys.js snapshot|check <game dir> [--force]');
  process.exit(2);
}
process.exit(cmd === 'snapshot' ? snapshot(game(dir), flag === '--force') : check(game(dir)));
