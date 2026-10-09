const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { worldFile, WORLD_FILES } = require('./paths.js');
const Teach = require(worldFile('teach.js'));

const view = (o) => Object.assign({ q: 'Q?', sub: '', options: [], answer: 'Mars', explain: '', good: '' }, o);
const first = () => 0;

test('the pet shows her pick, the right answer, the why, the explanation and a Remember step last', () => {
  const l = Teach.lesson('grade5', view({ explain: 'Mars looks red. Its dust has iron.' }), { text: 'Venus', why: 'Venus is yellow-white.' }, first);
  assert.equal(l.picked, 'Venus');
  assert.equal(l.answer, 'Mars');
  assert.deepEqual(l.steps, ['Venus is yellow-white.', 'Mars looks red.', 'Its dust has iron.', 'Remember: Mars']);
  assert.equal(l.hello, Teach.TEXT.grade5.hello[0]);
});

test('a Filipino line and its English line stay together in one step', () => {
  const l = Teach.lesson('grade2', view({ explain: 'Pula ang Mars. Dahil sa bakal.\nMars is red. Because of iron.' }), { text: 'Venus', why: '' }, first);
  assert.deepEqual(l.steps.slice(0, -1), ['Pula ang Mars. Dahil sa bakal.\nMars is red. Because of iron.']);
});

test('a long one-language explanation gives at most 4 steps, nothing lost', () => {
  const s = Teach.stepsOf('One. Two. Three. Four. Five. Six.');
  assert.equal(s.length, Teach.MAX_SPLIT);
  assert.equal(s.join(' '), 'One. Two. Three. Four. Five. Six.');
});

test('no why and no explanation: just the Remember step', () => {
  const l = Teach.lesson('grade5', view({}), { text: 'Venus' }, first);
  assert.deepEqual(l.steps, ['Remember: Mars']);
});

test('a why that repeats the explanation shows once', () => {
  const l = Teach.lesson('grade5', view({ explain: 'Mars is red.' }), { text: 'Venus', why: 'Mars is red.' }, first);
  assert.deepEqual(l.steps, ['Mars is red.', 'Remember: Mars']);
});

test('Grade 2 teacher lines are Filipino · English pairs; both grades have the same words', () => {
  const g2 = Teach.TEXT.grade2;
  assert.deepEqual(Object.keys(g2).sort(), Object.keys(Teach.TEXT.grade5).sort());
  for (const s of g2.hello.concat([g2.picked, g2.answer, g2.remember('X')])) assert.match(s, / · /, s);
  assert.equal(g2.hello.length, Teach.TEXT.grade5.hello.length);
});

// A tiny DOM, enough for talk.js.
function fakeDoc() {
  function node(tag) {
    return {
      tag, className: '', textContent: '', children: [], attrs: {}, listeners: {}, parentNode: null, id: '',
      appendChild(c) { c.parentNode = this; this.children.push(c); return c; },
      removeChild(c) { this.children = this.children.filter((x) => x !== c); c.parentNode = null; },
      setAttribute(k, v) { this.attrs[k] = v; },
      addEventListener(k, f) { this.listeners[k] = f; },
      focus() {},
      querySelector(sel) { return all(this).find((n) => n.tag === sel) || null; }
    };
  }
  function all(n) { return n.children.flatMap((c) => [c].concat(all(c))); }
  const body = node('body');
  body.contains = () => true;
  return { createElement: node, body, activeElement: null, addEventListener() {}, removeEventListener() {}, all };
}

test('talk.js draws the soft red pick, the green answer and numbered steps, and Got It! closes it', () => {
  global.World3D = undefined;
  const sandbox = {};
  new Function('root', fs.readFileSync(worldFile('talk.js'), 'utf8').replace(/\}\)\(this\);\s*$/, '})(root);'))(sandbox);
  const doc = fakeDoc();
  let closed = 0;
  const l = Teach.lesson('grade5', view({ explain: 'Mars looks red.' }), { text: 'Venus', why: 'Venus is yellow-white.' }, first);
  const t = sandbox.World3D.Talk.open({ doc, face: '🐥', who: 'Piyo', text: l.hello, teach: l, buttons: [{ text: 'Got It!', main: true }], onClose: () => closed++ });
  const nodes = doc.all(doc.body);
  const bad = nodes.find((n) => n.className === 'talk-chip bad'), good = nodes.find((n) => n.className === 'talk-chip good');
  assert.equal(bad.children[1].textContent, 'Venus');
  assert.equal(good.children[1].textContent, 'Mars');
  const ol = nodes.find((n) => n.tag === 'ol');
  assert.deepEqual(ol.children.map((li) => li.textContent), ['Venus is yellow-white.', 'Mars looks red.', 'Remember: Mars']);
  const btn = nodes.find((n) => n.tag === 'button');
  assert.equal(btn.textContent, 'Got It!');
  btn.listeners.click();
  assert.equal(closed, 1);
  assert.equal(doc.body.children.length, 0);
  assert.ok(t.close);
});

test('every wrong world answer goes to the pet teacher; right answers do not', () => {
  const folk = fs.readFileSync(worldFile('folk.js'), 'utf8'), mates = fs.readFileSync(worldFile('mates3d.js'), 'utf8');
  assert.match(folk, /if \(!r\.right && o\.teach\) return o\.teach\(/);
  assert.match(mates, /if \(!right && o\.teach\)/);
  const main = fs.readFileSync(worldFile('world-main.js'), 'utf8');
  assert.match(main, /changed: refresh, teach: teacher/);
  assert.match(main, /teach: teacher,/);
  assert.match(main, /pal\.teach\(true, ctl\.state\)/);
  assert.match(main, /pal\.teach\(false, ctl\.state\)/);
});

test('teach.js loads after quiz.js and before the files that use it', () => {
  const at = (f) => WORLD_FILES.indexOf(f);
  assert.ok(at('quiz.js') < at('teach.js'));
  assert.ok(at('teach.js') < at('world-main.js'));
});
