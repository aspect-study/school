// Turns the line files in web/world/speech/ into readable review pages in docs/lines/. Run: node tools/line-sheet.js
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const SHEETS = [
  { file: 'pets.js', out: 'pets.md', title: 'Pets' },
  { file: 'kids.js', out: 'kids.md', title: 'Playmates' },
  { file: 'town.js', out: 'town.md', title: 'Town characters' },
  { file: 'buddies.js', out: 'buddies.md', title: 'Subject buddies' }
];

function poolTitle(id) {
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  if (id === 'any-pet') return 'Any pet';
  if (id === 'any-kid') return 'Any playmate';
  if (id === 'any-buddy') return 'Any subject buddy';
  if (id.startsWith('char:')) return 'Character: ' + cap(id.slice(5));
  if (id.startsWith('buddy:')) return 'Buddy: ' + id.slice(6);
  if (id.startsWith('species:')) return 'Species: ' + id.slice(8);
  if (id.startsWith('pet:')) return 'Pet: ' + cap(id.slice(4));
  if (id.startsWith('kid:')) return 'Playmate: ' + cap(id.slice(4));
  return id;
}

const EXAMPLES = { hat: 'Sun hat', glasses: 'Round glasses', neck: 'Red scarf', back: 'Backpack', pet: 'Kidlat', streak: '4', fav_color: 'Blue', fav_fruit: 'Mango' };

function example(say) {
  return say.replace(/\{(\w+)\}/g, (m, name) => EXAMPLES[name] || (name.startsWith('fav_') ? 'Sunflower' : m));
}

function withFil(line) {
  return line.say + (line.fil ? ' _(' + line.fil + ')_' : '');
}

function pushLine(out, line, indent) {
  out.push(indent + '- ' + withFil(line));
  if (/\{\w+\}/.test(line.say)) out.push(indent + '  e.g. ' + example(line.say));
}

function pushReplies(out, line, depth, byId, seen) {
  (line.replies || []).forEach((r) => {
    const indent = '  '.repeat(depth);
    const next = byId[r.next];
    if (!next) {
      out.push(indent + '- [' + r.text + '] → (missing ' + r.next + ')');
      return;
    }
    out.push(indent + '- [' + r.text + '] → ' + withFil(next));
    if (/\{\w+\}/.test(next.say)) out.push(indent + '  e.g. ' + example(next.say));
    if (seen.has(next.id)) return;
    pushReplies(out, next, depth + 1, byId, new Set(seen).add(next.id));
  });
}

function render(title, data) {
  const byId = {};
  Object.values(data.pools).forEach((lines) => lines.forEach((l) => { byId[l.id] = l; }));
  const out = ['# ' + title + ': lines to review', '',
    'Made by `node tools/line-sheet.js` from the line files in `web/world/speech/`. Do not edit this page: tell Claude what to change.', ''];
  Object.keys(data.pools).sort().forEach((pool) => {
    const lines = data.pools[pool];
    out.push('## ' + poolTitle(pool) + ' (' + lines.length + ' lines)', '');
    const groups = {};
    lines.filter((l) => !l.follow).forEach((l) => {
      const key = l.when && l.when.length ? l.when.join(' + ') : 'Anytime';
      (groups[key] = groups[key] || []).push(l);
    });
    Object.keys(groups).sort((a, b) => (a === 'Anytime' ? -1 : b === 'Anytime' ? 1 : a.localeCompare(b))).forEach((key) => {
      out.push('### ' + key, '');
      groups[key].forEach((l) => {
        pushLine(out, l, '');
        pushReplies(out, l, 1, byId, new Set([l.id]));
      });
      out.push('');
    });
  });
  return out.join('\n') + '\n';
}

function sheet(s) {
  return render(s.title, require(path.join(ROOT, 'web', 'world', 'speech', s.file)));
}

function writeAll() {
  const dir = path.join(ROOT, 'docs', 'lines');
  fs.mkdirSync(dir, { recursive: true });
  SHEETS.forEach((s) => fs.writeFileSync(path.join(dir, s.out), sheet(s)));
  console.log('wrote ' + SHEETS.map((s) => 'docs/lines/' + s.out).join(', '));
}

module.exports = { SHEETS, render, sheet };
if (require.main === module) writeAll();
