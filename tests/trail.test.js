const test = require('node:test');
const assert = require('node:assert/strict');
const { engineFile } = require('./paths.js');
const { layout, height, buddySpot, pct, readView, saveView, lessonParam, indexOfId, medals, nextStop, pathHtml, cardHtml,
  lobbyUrl, TEXT, KEY, ROW, TOP } = require(engineFile('trail.js'));

function memory(initial) {
  const data = Object.assign({}, initial);
  return { data, getItem: (k) => (Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null), setItem: (k, v) => { data[k] = String(v); } };
}

test('stops zigzag middle, left, middle, right, one row apart', () => {
  assert.deepEqual(layout(1), [{ x: 0.5, y: TOP }]);
  assert.deepEqual(layout(5).map((p) => p.x), [0.5, 0.25, 0.5, 0.75, 0.5]);
  const many = layout(29);
  assert.equal(many.length, 29);
  many.forEach((p, i) => assert.equal(p.y, TOP + i * ROW));
  assert.equal(height(0), 0);
  assert.equal(height(1), 2 * TOP);
  assert.equal(height(7), 2 * TOP + 6 * ROW);
});

test('the buddy stands beside a stop, toward the middle', () => {
  assert.equal(pct(buddySpot({ x: 0.5, y: 10 }).x), 67);
  assert.equal(pct(buddySpot({ x: 0.25, y: 10 }).x), 42);
  assert.equal(pct(buddySpot({ x: 0.75, y: 10 }).x), 58);
  assert.equal(buddySpot({ x: 0.5, y: 10 }).y, 10);
});

test('Path is the default view and the choice is saved', () => {
  const s = memory();
  assert.equal(readView(s), 'path');
  assert.equal(saveView(s, () => 7, 'list'), true);
  assert.deepEqual(JSON.parse(s.data[KEY]), { v: 1, view: 'list', t: 7 });
  assert.equal(readView(s), 'list');
  saveView(s, () => 8, 'nonsense');
  assert.equal(readView(s), 'path');
  assert.equal(readView(memory({ [KEY]: '{broken' })), 'path');
});

test('?lesson= names the lesson to open', () => {
  assert.equal(lessonParam('?lesson=b'), 'b');
  assert.equal(lessonParam('?x=1&lesson=Ang%20Kuwento%20%231'), 'Ang Kuwento #1');
  assert.equal(lessonParam('?mylesson=b'), null);
  assert.equal(lessonParam('?lesson=%E0%A4%A'), null);
  assert.equal(lessonParam(''), null);
  assert.equal(indexOfId([{ id: 'a' }, { id: 'b' }], 'b'), 1);
  assert.equal(indexOfId([{ id: 'a' }], null), -1);
});

test('medals come from mastery_v1 and the next stop is the first without Bronze', () => {
  const lessons = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const ms = medals(lessons, { lessons: { a: { best: 2, now: 1 }, b: { best: 1, now: 1 } } });
  assert.deepEqual(ms, [{ best: 2, polish: true }, { best: 1, polish: false }, { best: 0, polish: false }]);
  assert.equal(nextStop(ms), 2);
  assert.equal(nextStop(ms.slice(0, 2)), -1);
  assert.deepEqual(medals(lessons, null), [{ best: 0, polish: false }, { best: 0, polish: false }, { best: 0, polish: false }]);
});

test('the path draws a button per stop, the next one glowing, with the buddy beside it', () => {
  const lessons = [{ id: 'a', title: 'What Is Matter', icon: '⚛️' }, { id: 'b', title: 'Matter <2>', icon: '<svg/>' }];
  const html = pathHtml(lessons, [{ best: 1, polish: false }, { best: 0, polish: false }], 1, '🦉', TEXT.grade5);
  assert.ok(html.includes('class="t-stop t-tier-1" data-stop="0" style="left:50%;top:' + TOP + 'px" aria-label="Lesson 1: What Is Matter, bronze"'));
  assert.ok(html.includes('class="t-stop t-tier-0 t-next" data-stop="1" style="left:25%;top:' + (TOP + ROW) + 'px" aria-label="Lesson 2: Matter &lt;2&gt;, next stop"'));
  assert.ok(html.includes('<span class="t-icon" aria-hidden="true">⚛️</span>'));
  assert.ok(html.includes('<span class="t-icon" aria-hidden="true">2</span>'), 'markup icons fall back to the number');
  assert.ok(html.includes('<span class="t-num" aria-hidden="true">1</span>'), 'an emoji stop keeps its number badge');
  assert.ok(!html.includes('<span class="t-num" aria-hidden="true">2</span>'), 'a number stop shows its number once');
  assert.equal((html.match(/🥉/g) || []).length, 1);
  assert.ok(html.includes('<span class="t-buddy" aria-hidden="true" style="left:42%;top:' + (TOP + ROW) + 'px">🦉</span>'));

  const done = pathHtml(lessons, [{ best: 1, polish: true }, { best: 3, polish: false }], -1, '🦉', TEXT.grade5);
  assert.ok(!done.includes('t-next'));
  assert.ok(done.includes('🥉🔧') && done.includes(', needs a polish'));
  assert.ok(done.includes('<span class="t-buddy" aria-hidden="true" style="left:42%;'), 'all Bronze: the buddy waits at the last stop');
  assert.ok(!pathHtml([], [], -1, '🦉', TEXT.grade5).includes('t-buddy'));
});

test('tapping a stop shows its name and Open; the last stop opens its card upward', () => {
  const lessons = [{ id: 'a', title: 'What Is Matter' }, { id: 'b', title: 'Matter' }];
  const ms = [{ best: 1, polish: false }, { best: 0, polish: false }];
  const first = cardHtml(lessons, ms, 0, TEXT.grade5);
  assert.ok(first.startsWith('<div class="t-card" role="dialog" aria-label="Lesson 1: What Is Matter" style="left:50%;top:' + (TOP + 46) + 'px">'));
  assert.ok(first.includes('<p class="t-card-title">1 · What Is Matter 🥉</p>'));
  assert.ok(first.includes('<button type="button" class="t-open" data-open="0">Open ▶</button>'));
  assert.ok(cardHtml(lessons, ms, 1, TEXT.grade5).startsWith('<div class="t-card t-card-up" role="dialog" aria-label="Lesson 2: Matter" style="left:25%;top:' + (TOP + ROW - 46) + 'px">'));
  assert.equal(cardHtml(lessons, ms, 5, TEXT.grade5), '');
});

test('Grade 2 stop names pair Filipino with English; buttons stay English', () => {
  assert.equal(TEXT.grade2.stop(3, 'Kuwento'), 'Aralin 3 · Lesson 3: Kuwento');
  assert.equal(TEXT.grade2.open, TEXT.grade5.open);
  assert.equal(TEXT.grade2.path, TEXT.grade5.path);
  assert.equal(TEXT.grade2.list, TEXT.grade5.list);
});

test('Grade 2 screen-reader labels pair every medal, polish and next-stop word, ending in the Grade 5 English', () => {
  const pairs = [['next', TEXT.grade2.next, TEXT.grade5.next], ['polish', TEXT.grade2.polish, TEXT.grade5.polish]];
  [1, 2, 3].forEach((l) => pairs.push(['tier ' + l, TEXT.grade2.tiers[l], TEXT.grade5.tiers[l]]));
  for (const [key, g2, g5] of pairs) {
    const cut = g2.lastIndexOf(' · ');
    assert.ok(cut > 0, key + ' has a Filipino word and an English word');
    assert.equal(g2.slice(cut + 3), g5, key + ': the English matches Grade 5');
  }
  const html = pathHtml([{ id: 'a', title: 'Kuwento' }, { id: 'b', title: 'Tula' }], [{ best: 2, polish: true }, { best: 0, polish: false }], 1, '🦉', TEXT.grade2);
  assert.ok(html.includes('aria-label="Aralin 1 · Lesson 1: Kuwento, pilak · silver, kailangang balikan · needs a polish"'));
  assert.ok(html.includes('aria-label="Aralin 2 · Lesson 2: Tula, susunod · next stop"'));
});

test('home goes to the grade lobby, like the 🏠 button', () => {
  assert.equal(lobbyUrl('grade2'), '../../../lobby/grade-2.html');
  assert.equal(lobbyUrl('grade5'), '../../../lobby/grade-5.html');
});
