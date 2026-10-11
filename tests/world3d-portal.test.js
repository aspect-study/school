const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile } = require('./paths.js');
const P = require(worldFile('portal.js'));

const A = { pos: { x: 0, y: 10, z: 20 }, look: { x: 0, y: 3.4, z: 0 } };
const B = { pos: { x: 10, y: 4, z: 0 }, look: { x: 2, y: 4, z: -2 } };

test('ease starts at from, ends at to, and is halfway at the middle', () => {
  assert.deepEqual(P.ease(A, B, 0), A);
  assert.deepEqual(P.ease(A, B, 1), B);
  assert.deepEqual(P.ease(A, B, 0.5).pos, { x: 5, y: 7, z: 10 });
  assert.deepEqual(P.ease(A, B, -1), A, 'clamped below');
  assert.deepEqual(P.ease(A, B, 2), B, 'clamped above');
  assert.ok(P.ease(A, B, 0.1).pos.x < 1, 'starts slowly');
});

test('closer moves the camera most of the way to what it looks at, looking a little higher', () => {
  const c = P.closer(A);
  assert.deepEqual(c.pos, { x: 0, y: 10 + (3.4 - 10) * 0.6, z: 8 });
  assert.deepEqual(c.look, { x: 0, y: 3.4 + 0.6, z: 0 });
});

test('embedUrl adds embed=1 to the query, before any hash', () => {
  assert.equal(P.embedUrl('../subjects/grade-5/science/index.html?reset=1'), '../subjects/grade-5/science/index.html?reset=1&embed=1');
  assert.equal(P.embedUrl('page.html'), 'page.html?embed=1');
  assert.equal(P.embedUrl('page.html?a=1#x'), 'page.html?a=1&embed=1#x');
  assert.equal(P.embedUrl('page.html#x'), 'page.html?embed=1#x');
});

test('acceptMessage takes only a portal-close from the frame, same origin', () => {
  const frame = {};
  const good = { source: frame, origin: 'https://a.test', data: { type: 'portal-close' } };
  assert.equal(P.acceptMessage(good, frame, 'https://a.test'), true);
  assert.equal(P.acceptMessage(Object.assign({}, good, { source: {} }), frame, 'https://a.test'), false, 'another window');
  assert.equal(P.acceptMessage(Object.assign({}, good, { origin: 'https://b.test' }), frame, 'https://a.test'), false, 'another origin');
  assert.equal(P.acceptMessage(Object.assign({}, good, { data: { type: 'other' } }), frame, 'https://a.test'), false, 'another message');
  assert.equal(P.acceptMessage(Object.assign({}, good, { data: null }), frame, 'https://a.test'), false);
  assert.equal(P.acceptMessage(good, null, 'https://a.test'), false, 'no frame open');
  assert.equal(P.acceptMessage(Object.assign({}, good, { origin: 'null' }), frame, 'null'), true, 'file pages');
});

function rig(over = {}) {
  const log = [];
  const hold = { onLoad: null };
  const frames = [];
  const timers = [];
  let t = 0;
  let pose = { pos: { x: 0, y: 10, z: 20 }, look: { x: 0, y: 3.4, z: 0 } };
  const frameWin = { history: { state: null } };
  const history = {
    state: null,
    length: 1,
    pushState(s) { this.state = s; this.length += 1; log.push('push:' + s.portal); },
    back() { this.state = null; log.push('back'); },
    go(n) { this.state = null; log.push('go:' + n); },
  };
  const o = Object.assign({
    camera: { get: () => JSON.parse(JSON.stringify(pose)), set: (p) => { pose = p; } },
    render: () => {},
    freeze: (on) => log.push('freeze:' + on),
    pauseWorld: (on) => log.push('pause:' + on),
    view: {
      show: (url, color, title, onLoad) => { hold.onLoad = onLoad; log.push('show:' + url + '|' + color + '|' + title); },
      hide: () => log.push('hide'),
      win: () => frameWin,
    },
    history,
    origin: 'https://a.test',
    raf: (fn) => frames.push(fn),
    now: () => t,
    later: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    cancel: (id) => { timers[id - 1] = null; },
    instant: () => true,
    onClosed: (then) => log.push('closed:' + then),
    fallback: (href) => log.push('fallback:' + href),
  }, over);
  const portal = P.create(o);
  return {
    portal, log, hold, frameWin, timers, history,
    pose: () => pose,
    tick(ms) { t += ms; frames.splice(0).forEach((fn) => fn()); },
    msg(data, source = frameWin, origin = 'https://a.test') { portal.message({ data, source, origin }); },
  };
}
const HREF = '../subjects/grade-5/science/index.html?reset=1';
const URL1 = HREF + '&embed=1';

test('open freezes her, pauses the world, adds a history entry and shows the frame with embed=1', () => {
  const r = rig();
  assert.equal(r.portal.open('life-lab', HREF, '#7bd88f', 'Science'), true);
  assert.deepEqual(r.log, ['freeze:true', 'pause:true', 'push:life-lab', 'show:' + URL1 + '|#7bd88f|Science']);
  assert.equal(r.portal.state(), 'open');
  assert.equal(r.portal.isOpen(), true);
  assert.equal(r.portal.url(), URL1);
  assert.equal(r.timers[0].ms, 8000, 'a load timeout');
});

test('a second open while one is open does nothing', () => {
  const r = rig();
  r.portal.open('life-lab', HREF, '#7bd88f', 'Science');
  const n = r.log.length;
  assert.equal(r.portal.open('math-mastery', HREF, '#fff', 'Math'), false);
  assert.equal(r.log.length, n);
});

test('the game\'s close message closes the frame, takes back the history entry and restarts the world', () => {
  const r = rig();
  r.portal.open('life-lab', HREF, '#7bd88f', 'Science');
  r.hold.onLoad();
  r.msg({ type: 'portal-close' });
  assert.deepEqual(r.log.slice(4), ['hide', 'go:-1', 'pause:false', 'freeze:false', 'closed:undefined']);
  assert.equal(r.portal.isOpen(), false);
});

test('a close message asking for the shop passes it on', () => {
  const r = rig();
  r.portal.open('life-lab', HREF, '#7bd88f', 'Science');
  r.msg({ type: 'portal-close', then: 'shop' });
  assert.equal(r.log.at(-1), 'closed:shop');
  const s = rig();
  s.portal.open('life-lab', HREF, '#7bd88f', 'Science');
  s.msg({ type: 'portal-close', then: 'elsewhere' });
  assert.equal(s.log.at(-1), 'closed:undefined', 'only the shop is passed on');
});

test('messages from another window or origin, or while closed, are ignored', () => {
  const r = rig();
  r.msg({ type: 'portal-close' });
  assert.deepEqual(r.log, [], 'closed');
  r.portal.open('life-lab', HREF, '#7bd88f', 'Science');
  r.msg({ type: 'portal-close' }, {});
  r.msg({ type: 'portal-close' }, r.frameWin, 'https://evil.test');
  assert.equal(r.portal.isOpen(), true);
});

test('the back gesture on the game home closes without stepping back again', () => {
  const r = rig();
  r.portal.open('life-lab', HREF, '#7bd88f', 'Science');
  r.portal.popstate({ portal: 'life-lab' });
  assert.equal(r.portal.isOpen(), true, 'still on our entry: the game stepped back inside itself');
  r.portal.popstate(null);
  assert.equal(r.portal.isOpen(), false);
  assert.equal(r.log.some((l) => l.startsWith('go:')), false);
  r.portal.popstate(null);
  assert.equal(r.log.filter((l) => l.startsWith('closed')).length, 1, 'ignored once closed');
});

test('closing from the game home steps back once, even if the history grew', () => {
  const r = rig();
  r.portal.open('life-lab', HREF, '#7bd88f', 'Science');
  r.history.length += 1;
  r.portal.close();
  assert.ok(r.log.includes('go:-1'));
});

test('closing while the game shows an inner screen steps back twice', () => {
  const r = rig();
  r.portal.open('life-lab', HREF, '#7bd88f', 'Science');
  r.frameWin.history.state = { nav: 'quiz' };
  r.portal.close();
  assert.ok(r.log.includes('go:-2'));
});

test('✕ (close) works at any time and only once', () => {
  const r = rig();
  assert.equal(r.portal.close(), false, 'nothing open');
  r.portal.open('life-lab', HREF, '#7bd88f', 'Science');
  assert.equal(r.portal.close(), true);
  assert.equal(r.portal.close(), false);
});

test('a frame that never loads falls back to the plain page; a loaded one cancels the timeout', () => {
  const r = rig();
  r.portal.open('life-lab', HREF, '#7bd88f', 'Science');
  r.timers[0].fn();
  assert.deepEqual(r.log.slice(-4), ['hide', 'pause:false', 'freeze:false', 'fallback:' + HREF]);
  assert.equal(r.portal.isOpen(), false);
  const s = rig();
  s.portal.open('life-lab', HREF, '#7bd88f', 'Science');
  s.hold.onLoad();
  assert.equal(s.timers[0], null);
});

test('with motion the camera glides in over 600 ms before the frame shows, and back out on close', () => {
  const r = rig({ instant: () => false });
  const start = r.pose();
  r.portal.open('life-lab', HREF, '#7bd88f', 'Science');
  assert.equal(r.portal.state(), 'opening');
  assert.equal(r.log.some((l) => l.startsWith('show')), false);
  r.tick(300);
  assert.ok(r.pose().pos.z < start.pos.z && r.pose().pos.z > P.closer(start).pos.z, 'part way');
  r.tick(300);
  assert.equal(r.portal.state(), 'open');
  assert.deepEqual(r.pose(), P.closer(start));
  r.portal.close();
  assert.equal(r.portal.state(), 'closing');
  r.tick(400);
  assert.equal(r.portal.state(), 'closed');
  assert.deepEqual(r.pose(), start);
  assert.equal(r.log.at(-1), 'closed:undefined');
});

test('closing during the glide in never shows the frame', () => {
  const r = rig({ instant: () => false });
  r.portal.open('life-lab', HREF, '#7bd88f', 'Science');
  r.tick(100);
  r.portal.close();
  r.tick(1000);
  r.tick(1000);
  assert.equal(r.log.some((l) => l.startsWith('show')), false);
  assert.equal(r.portal.state(), 'closed');
});
