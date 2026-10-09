const test = require('node:test');
const assert = require('node:assert/strict');
const { engineFile } = require('./paths.js');
const W = require(engineFile('world.js'));
const { readState, saveState, status, levelOf, KEY, AVATARS, AVATAR_ORDER, DEFAULT_AVATAR, MAX_MARKERS,
  SPINE_HALF, LAYOUT, TEXT, rects, radius, stand, route, pointAt, resolveAt, places } = W;

function memory(initial) {
  const data = Object.assign({}, initial);
  return {
    data,
    getItem: (k) => (Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
  };
}

const FRESH = { v: 1, avatar: null, view: 'campus', at: null, t: 0 };

test('eight buddies, cat by default', () => {
  assert.equal(AVATAR_ORDER.length, 8);
  AVATAR_ORDER.forEach((id) => assert.ok(AVATARS[id], id));
  assert.equal(DEFAULT_AVATAR, 'cat');
});

test('a fresh or broken world_v1 reads as defaults', () => {
  assert.deepEqual(readState(memory()), FRESH);
  assert.deepEqual(readState(memory({ [KEY]: '{not json' })), FRESH);
  assert.deepEqual(readState(memory({ [KEY]: JSON.stringify({ v: 2, avatar: 'owl' }) })), FRESH);
  assert.deepEqual(readState(memory({ [KEY]: JSON.stringify({ v: 1, avatar: 'dragon', view: 'grid', at: 5, t: 'x' }) })), FRESH);
  assert.deepEqual(readState(memory({ [KEY]: JSON.stringify({ v: 1, at: '' }) })), FRESH);
  assert.deepEqual(readState(memory({ [KEY]: JSON.stringify({ v: 1, avatar: 'toString' }) })), FRESH);
});

test('saveState merges into what is saved and stamps the time', () => {
  const s = memory();
  assert.equal(saveState(s, () => 42, { avatar: 'owl' }), true);
  saveState(s, () => 43, { view: 'list', at: 'life-lab' });
  assert.deepEqual(JSON.parse(s.data[KEY]), { v: 1, avatar: 'owl', view: 'list', at: 'life-lab', t: 43 });
  assert.deepEqual(readState(s), { v: 1, avatar: 'owl', view: 'list', at: 'life-lab', t: 43 });
});

test('saveState drops bad patch values field by field', () => {
  const s = memory();
  saveState(s, () => 1, { avatar: 'owl', view: 'list', at: 'life-lab' });
  assert.equal(saveState(s, () => 2, { avatar: 'dragon', view: 'grid' }), true);
  const expected = { v: 1, avatar: null, view: 'campus', at: 'life-lab', t: 2 };
  assert.deepEqual(JSON.parse(s.data[KEY]), expected);
  assert.deepEqual(readState(s), expected);
});

test('saveState says false when storage is full', () => {
  const s = { getItem: () => null, setItem: () => { throw new Error('full'); } };
  assert.equal(saveState(s, () => 1, { view: 'list' }), false);
});

test('a game levels up only when every lesson has the medal', () => {
  assert.equal(levelOf({ gold: 0, silver: 0, bronze: 0, total: 0 }), 0);
  assert.equal(levelOf({ gold: 2, silver: 1, bronze: 0, total: 4 }), 0);
  assert.equal(levelOf({ gold: 2, silver: 1, bronze: 1, total: 4 }), 1);
  assert.equal(levelOf({ gold: 2, silver: 2, bronze: 0, total: 4 }), 2);
  assert.equal(levelOf({ gold: 4, silver: 0, bronze: 0, total: 4 }), 3);
});

test('status: markers come boss, quest, due, two at most', () => {
  const st = status(['a', 'b', 'c'], {
    tally: (app) => (app === 'a' ? { gold: 3, silver: 0, bronze: 0, total: 3 } : null),
    due: () => ({ a: 3, b: 0, c: 2 }),
    quests: () => [{ app: 'a', done: false }, { app: 'b', done: true }, { kind: 'stars' }],
    boss: () => ({ stages: [{ app: 'a', cleared: false }, { app: 'c', cleared: true }] }),
    canAfford: () => true,
  });
  assert.equal(MAX_MARKERS, 2);
  assert.deepEqual(st.apps.a.markers, [{ kind: 'boss' }, { kind: 'quest' }], 'due is dropped past two');
  assert.equal(st.apps.a.level, 3);
  assert.deepEqual(st.apps.a.tally, { gold: 3, silver: 0, bronze: 0, total: 3 });
  assert.deepEqual(st.apps.b.markers, [], 'a done quest and 0 due show nothing');
  assert.deepEqual(st.apps.c.markers, [{ kind: 'due', count: 2 }], 'a cleared stage shows nothing');
  assert.deepEqual(st.arena, { cleared: 1, total: 2, beaten: false });
  assert.equal(st.shop.sparkle, true);
});

test('status: missing, throwing or odd engines give no markers and never throw', () => {
  const boom = () => { throw new Error('x'); };
  const cases = [undefined, {}, { tally: boom, due: boom, quests: boom, boss: boom, canAfford: boom },
    { due: () => 'x', quests: () => 'x', boss: () => ({ stages: 'x' }) }];
  for (const deps of cases) {
    const st = status(['a'], deps);
    assert.deepEqual(st.apps.a, { level: 0, tally: { gold: 0, silver: 0, bronze: 0, total: 0 }, markers: [] });
    assert.deepEqual(st.arena, { cleared: 0, total: 0, beaten: false });
    assert.equal(st.shop.sparkle, false);
  }
});

test('status: the arena is beaten when every stage is cleared', () => {
  const st = status([], { boss: () => ({ stages: [{ app: 'a', cleared: true }, { app: 'b', cleared: true }] }) });
  assert.deepEqual(st.arena, { cleared: 2, total: 2, beaten: true });
});

test('status: the shop sparkles only on a real true', () => {
  assert.equal(status([], { canAfford: () => false }).shop.sparkle, false);
  assert.equal(status([], { canAfford: () => 'yes' }).shop.sparkle, false);
  assert.equal(status([], { canAfford: () => true }).shop.sparkle, true);
});

const CARDS5 = Object.keys(LAYOUT.grade5.apps).map((app) => ({ app, name: app + ' game', emoji: '📘', accent: '#123456', href: app + '/index.html?reset=1' }));

for (const grade of ['grade5', 'grade2']) {
  test(grade + ' layout: places fit the map, stay off the main road and never overlap', () => {
    const L = LAYOUT[grade], list = rects(grade);
    for (const a of list) {
      assert.ok(a.x0 >= 0 && a.y0 >= 0 && a.x1 <= L.w && a.y1 <= L.h, a.id + ' is inside the map');
      if (a.id !== 'arena') assert.ok(a.x1 <= L.spine - SPINE_HALF || a.x0 >= L.spine + SPINE_HALF, a.id + ' stays off the main road');
    }
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        assert.ok(a.x1 <= b.x0 || b.x1 <= a.x0 || a.y1 <= b.y0 || b.y1 <= a.y0, a.id + ' overlaps ' + b.id);
      }
    }
  });

  test(grade + ' layout: the buddy stands between each building and the main road', () => {
    const L = LAYOUT[grade], r = radius(L);
    for (const p of rects(grade).filter((x) => x.id !== 'arena')) {
      const [x, y] = stand(L, { x: (p.x0 + p.x1) / 2, y: (p.y0 + p.y1) / 2, w: p.x1 - p.x0, h: p.y1 - p.y0 });
      assert.ok(x - r >= p.x1 || x + r <= p.x0, p.id + ': not on the building');
      assert.ok(y > p.y0 && y <= p.y1, p.id + ': level with the building');
      assert.ok(x + r <= L.spine - SPINE_HALF || x - r >= L.spine + SPINE_HALF, p.id + ': not on the main road');
    }
  });
}

test('route goes to the main road, along it, then to the building', () => {
  const L = LAYOUT.grade5;
  assert.deepEqual(route(L, [413, 1252], [587, 892]), [[413, 1252], [500, 1252], [500, 892], [587, 892]]);
  assert.deepEqual(route(L, [500, 1350], [413, 892]), [[500, 1350], [500, 892], [413, 892]], 'the gate is on the road already');
});

test('pointAt walks the path by distance', () => {
  const pts = [[0, 0], [10, 0], [10, 10]];
  assert.deepEqual(pointAt(pts, 0), [0, 0]);
  assert.deepEqual(pointAt(pts, 0.25), [5, 0]);
  assert.deepEqual(pointAt(pts, 0.75), [10, 5]);
  assert.deepEqual(pointAt(pts, 1), [10, 10]);
  assert.deepEqual(pointAt([[3, 4]], 0.5), [3, 4]);
});

test('resolveAt falls back to the gate for a place that is gone', () => {
  const list = [{ id: 'a' }, { id: 'shop' }];
  assert.equal(resolveAt('a', list), 'a');
  assert.equal(resolveAt('removed-game', list), 'gate');
  assert.equal(resolveAt(null, list), 'gate');
});

test('places: cards in order, then shop and arena; an unknown card takes the spare lot, a second one is left out', () => {
  const extra = (n) => ({ app: 'new-' + n, name: 'New ' + n, emoji: '🆕', accent: '', href: 'n' + n });
  const cards = CARDS5.slice(0, 2).concat([extra(1), extra(2)]);
  const st = status(cards.map((c) => c.app), {});
  const list = places('grade5', cards, st, TEXT.grade5);
  assert.deepEqual(list.map((p) => p.id), [CARDS5[0].app, CARDS5[1].app, 'new-1', 'shop', 'arena']);
  assert.deepEqual([list[2].x, list[2].y], [LAYOUT.grade5.lot.x, LAYOUT.grade5.lot.y]);
  assert.equal(list[0].href, CARDS5[0].href);
  assert.equal(list[3].name, TEXT.grade5.shop);
  assert.deepEqual(list[4].arena, { cleared: 0, total: 0, beaten: false });
});

test('draw: one group per place, tiers, markers, escaped labels and one buddy', () => {
  const cards = CARDS5.slice(0, 2).map((c) => ({ ...c }));
  cards[0].name = 'Math <Mastery>';
  const st = status(cards.map((c) => c.app), {
    tally: (app) => (app === cards[0].app ? { gold: 4, silver: 0, bronze: 0, total: 4 } : { gold: 0, silver: 1, bronze: 2, total: 3 }),
    due: () => ({ [cards[1].app]: 3 }),
    quests: () => [{ app: cards[0].app }],
    boss: () => ({ stages: [{ app: cards[1].app, cleared: false }, { app: cards[0].app, cleared: true }] }),
    canAfford: () => true,
  });
  const svg = W.draw('grade5', places('grade5', cards, st, TEXT.grade5), 'owl', cards[0].app, TEXT.grade5);
  assert.equal((svg.match(/class="w-place /g) || []).length, 4, '2 games, the shop and the arena');
  assert.ok(svg.includes('data-place="' + cards[0].app + '"'));
  assert.ok(svg.includes('w-tier-3') && svg.includes('w-tier-1'));
  assert.ok(svg.includes('Math &lt;Mastery&gt;') && !svg.includes('<Mastery>'), 'names are escaped');
  assert.ok(svg.includes('aria-label="Math &lt;Mastery&gt;, gold, quest today"'));
  assert.ok(svg.includes('aria-label="' + cards[1].app + ' game, bronze, boss stage this week, 3 review questions due"'));
  assert.ok(svg.includes('aria-label="Shop, you can buy a reward"'));
  assert.ok(svg.includes('aria-label="Boss Arena, 1 of 2 stages cleared"'));
  for (const mark of ['>🔁3<', '>⚔️<', '>❗<', '>✨<']) assert.ok(svg.includes(mark), mark);
  assert.ok(svg.includes('>🥇4 🥈0 🥉0 / 4<'), 'tally strip');
  assert.ok(svg.includes('>1 / 2<'), 'arena count');
  assert.equal((svg.match(/class="w-avatar"/g) || []).length, 1);
  assert.ok(svg.includes('>' + AVATARS.owl + '<'));
  assert.ok(svg.startsWith('<svg class="w-map" viewBox="0 0 1000 1400"'));
});

test('draw: the buddy waits at the gate when its place is gone, and an unknown buddy is the cat', () => {
  const list = places('grade5', CARDS5.slice(0, 1), status([CARDS5[0].app], {}), TEXT.grade5);
  const svg = W.draw('grade5', list, 'dragon', 'removed-game', TEXT.grade5);
  assert.ok(svg.includes('class="w-avatar" data-avatar="" tabindex="0" role="button" aria-label="Your buddy. Tap to change." transform="translate(500 1350)"'));
  assert.ok(svg.includes('>' + AVATARS.cat + '<'));
});

test('draw: the tier flag stays clear of the markers, Silver adds a banner, Gold a glow', () => {
  const cards = CARDS5.slice(0, 3);
  const tallies = [{ gold: 0, silver: 0, bronze: 2, total: 2 }, { gold: 0, silver: 2, bronze: 0, total: 2 }, { gold: 2, silver: 0, bronze: 0, total: 2 }];
  const st = status(cards.map((c) => c.app), {
    tally: (app) => tallies[cards.findIndex((c) => c.app === app)],
    due: () => ({ [cards[0].app]: 1, [cards[1].app]: 1, [cards[2].app]: 1 }),
  });
  const svg = W.draw('grade5', places('grade5', cards, st, TEXT.grade5), 'cat', null, TEXT.grade5);
  const groups = svg.split('<g class="w-place ').slice(1);
  cards.forEach((c, i) => {
    const g = groups.find((x) => x.includes('data-place="' + c.app + '"'));
    assert.equal((g.match(/class="w-flag"/g) || []).length, 1, c.app + ' flag');
    const flagX = Number(/class="w-flag" d="M(-?[\d.]+) /.exec(g)[1]);
    const m = /<g class="w-marker[^>]*><rect x="(-?[\d.]+)" y="[^"]*" width="([\d.]+)"/.exec(g);
    const mx = Number(m[1]), mw = Number(m[2]);
    assert.ok(flagX < mx || flagX > mx + mw, c.app + ' flag x ' + flagX + ' vs marker ' + mx + '-' + (mx + mw));
    assert.equal(g.includes('class="w-banner"'), i >= 1, c.app + ' banner');
    assert.equal(g.includes('class="w-glow"'), i === 2, c.app + ' glow');
    assert.equal(g.includes('class="w-roof w-gold"'), i === 2, c.app + ' gold roof');
  });
});

test('in a browser page without data-grade, World has the helpers but no map', () => {
  const fs = require('node:fs');
  const vm = require('node:vm');
  const win = {};
  win.window = win;
  vm.createContext(win);
  vm.runInContext(fs.readFileSync(engineFile('world.js'), 'utf8'), win);
  assert.equal(typeof win.World.status, 'function');
  assert.ok(win.World.LAYOUT.grade5);
  assert.equal(win.World.mount, undefined);
});

test('world.js shares its SVG text helpers with family.js', () => {
  assert.equal(W.esc('<a&"\'>'), '&lt;a&amp;&quot;&#39;&gt;');
  assert.equal(W.svgText('x', 1, 2, 10, 'Hi', 100), '<text class="x" x="1" y="2" font-size="10">Hi</text>');
});

test('a building shows the subject name; its label also names the game', () => {
  const cards = [{ app: 'life-lab', name: 'Science', game: 'Life Lab', emoji: '🧪', accent: '', href: 'x' },
    { app: 'math-mastery', name: 'Math', game: 'Math', emoji: '🧮', accent: '', href: 'y' }];
  const svg = W.draw('grade5', places('grade5', cards, status(['life-lab', 'math-mastery'], {}), TEXT.grade5), 'cat', null, TEXT.grade5);
  assert.ok(svg.includes('>Science</text>') && !svg.includes('>Life Lab</text>'));
  assert.ok(svg.includes('aria-label="Science (Life Lab)'));
  assert.ok(svg.includes('aria-label="Math,') || svg.includes('aria-label="Math"'), 'no repeat when the game is named like the subject');
});

test('the guide target gets a ring and a lit road from the buddy', () => {
  const cards = [{ app: 'life-lab', name: 'Life Lab', emoji: '🧪', accent: '', href: 'x' }];
  const list = places('grade5', cards, status(['life-lab'], {}), TEXT.grade5);
  const svg = W.draw('grade5', list, 'cat', null, TEXT.grade5, 'life-lab');
  assert.ok(svg.includes('class="w-place w-game w-tier-0 w-target"'));
  assert.equal((svg.match(/class="w-ring"/g) || []).length, 1);
  const road = svg.match(/<path class="w-guide-road" d="([^"]+)"\/>/);
  const L = LAYOUT.grade5, to = stand(L, list.find((p) => p.id === 'life-lab'));
  assert.equal(road[1], 'M' + route(L, L.gate, to).map((p) => p[0] + ' ' + p[1]).join('L'));
  assert.ok(svg.indexOf('w-guide-road') < svg.indexOf('data-place="life-lab"'), 'the road runs under the buildings');
  const plain = W.draw('grade5', list, 'cat', null, TEXT.grade5);
  assert.ok(!plain.includes('w-target') && !plain.includes('w-guide-road') && !plain.includes('w-ring'));
  assert.ok(!W.draw('grade5', list, 'cat', null, TEXT.grade5, 'nowhere').includes('w-guide-road'));
});

test('liveDeps reads the live engines, and a page without them reads nothing', () => {
  const empty = W.liveDeps({});
  assert.deepEqual(empty.due(), {});
  assert.deepEqual(empty.quests(), []);
  assert.deepEqual(empty.boss(), {});
  assert.equal(empty.canAfford(), false);
  assert.equal(empty.tally('x'), null);
  assert.equal(empty.guide([]), null);

  const win = {
    Recall: { dueByApp: () => ({ a: 2 }) },
    Boss: { current: () => ({ stages: [{ app: 'a', cleared: false }] }) },
    Wallet: { canAfford: () => true },
    Mastery: { summary: () => ({ apps: { a: 'E' } }), counts: (e) => (e === 'E' ? { gold: 1, silver: 0, bronze: 0, total: 1 } : null) },
    Quests: { state: () => ({ list: [{ app: 'a', done: false }] }) },
    Guide: { step: (cards, o) => ({ kind: 'boss', app: cards[0].app, afford: o.canAfford }) },
  };
  const st = W.status(['a'], W.liveDeps(win));
  assert.equal(st.apps.a.level, 3);
  assert.deepEqual(st.apps.a.markers.map((m) => m.kind), ['boss', 'quest']);
  assert.equal(st.shop.sparkle, true);
  assert.deepEqual(W.liveDeps(win).guide([{ app: 'a' }]), { kind: 'boss', app: 'a', afford: true });
  win.Guide.todayQuests = () => [];
  assert.deepEqual(W.liveDeps(win).quests(), []);
});
