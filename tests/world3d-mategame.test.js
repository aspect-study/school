const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile } = require('./paths.js');
const G = require(worldFile('mategame.js'));

// Kids on an open field: move goes straight at speed; put sets fields.
function field(start) {
  const kids = {};
  Object.keys(start).forEach((id) => { kids[id] = Object.assign({ face: 0, hidden: false, cheer: false, stuck: 0 }, start[id]); });
  return {
    kids,
    move(id, x, z, speed, dt) {
      const k = kids[id], dx = x - k.x, dz = z - k.z, d = Math.hypot(dx, dz), s = speed * dt;
      if (d <= Math.max(s, 0.5)) { k.x = x; k.z = z; return true; }
      k.x += dx / d * s; k.z += dz / d * s; k.face = Math.atan2(dx, dz);
      return false;
    },
    where(id) { return kids[id]; },
    put(id, p) {
      const k = kids[id];
      ['x', 'z', 'face', 'hidden', 'cheer'].forEach((f) => { if (p[f] !== undefined) k[f] = p[f]; });
      return true;
    }
  };
}
let seed = 1;
const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const make = (f) => G.create({ rand, move: f.move, where: f.where, put: f.put });
const types = (ev) => ev.map((e) => e.type);
const props = (n, at = { x: 0, z: 0 }) => Array.from({ length: n }, (_, i) => ({ id: 'p' + i, kind: 'bush', x: at.x + 12 * Math.cos(i), z: at.z + 12 * Math.sin(i) + i * 3, r: 1.3 }));

test('hiding props: random every game, spaced, only where allowed, spread over the areas', () => {
  const areas = [{ x: 0, z: 0, r: 20 }, { x: 100, z: 0, r: 20 }, { x: 0, z: 0, hx: 3, hz: 40 }];
  const ok = (x, z) => Math.abs(x) > 2;
  const a = G.props(areas, 12, rand, ok), b = G.props(areas, 12, rand, ok);
  assert.equal(a.length, 12);
  assert.notDeepEqual(a.map((p) => [p.x, p.z]), b.map((p) => [p.x, p.z]), 'a new set every game');
  for (const p of a) {
    assert.ok(ok(p.x, p.z));
    assert.ok(G.KINDS.includes(p.kind));
    for (const q of a) if (p !== q) assert.ok(Math.hypot(p.x - q.x, p.z - q.z) >= G.PROP.gap);
  }
  assert.ok(a.some((p) => p.x > 50) && a.some((p) => p.x < 50), 'every area gets some');
  assert.deepEqual(G.props(areas, 5, rand, () => false), [], 'nowhere allowed: none');
});

test('tag: she starts as it, touching a kid tags them, the kid counts 3 and then chases her', () => {
  const f = field({ migo: { x: 1, z: 0 }, ella: { x: 20, z: 0 } }), g = make(f), her = { x: 0, z: 0 };
  assert.deepEqual(types(g.startTag(['migo', 'ella'], her)).slice(0, 1), ['start']);
  assert.equal(g.state().it, 'her');
  const ev = g.tick(0.1, her);
  assert.ok(ev.some((e) => e.type === 'tagged' && e.kid === 'migo'));
  assert.equal(g.state().it, 'migo');
  assert.equal(g.state().count, 3);
  const p0 = Object.assign({}, f.kids.migo);
  const counts = [];
  for (let i = 0; i < 30; i++) g.tick(0.1, { x: 30, z: 30 }).forEach((e) => { if (e.type === 'count') counts.push(e.n); });
  assert.deepEqual(counts, [3, 2, 1]);
  assert.deepEqual([f.kids.migo.x, f.kids.migo.z], [p0.x, p0.z], 'stands still while counting');
  g.tick(0.5, { x: 30, z: 30 });
  assert.ok(Math.hypot(f.kids.migo.x - 30, f.kids.migo.z - 30) < Math.hypot(p0.x - 30, p0.z - 30), 'then chases her');
});

test('tag: a kid catching her makes her it, and she cannot tag that kid straight back', () => {
  const f = field({ migo: { x: 0.5, z: 0 } }), g = make(f), her = { x: 0, z: 0 };
  g.startTag(['migo'], her);
  g.tick(0.1, her);
  assert.equal(g.state().it, 'migo');
  for (let i = 0; i < 31; i++) g.tick(0.1, { x: 10, z: 0 });
  let ev = [];
  for (let i = 0; i < 40 && g.state().it !== 'her'; i++) ev = ev.concat(g.tick(0.1, { x: 10, z: 0 }));
  assert.ok(ev.some((e) => e.type === 'gotYou' && e.kid === 'migo'));
  assert.equal(g.state().it, 'her');
  f.kids.migo.x = 10.5; f.kids.migo.z = 0;
  g.tick(0.1, { x: 10, z: 0 });
  assert.equal(g.state().it, 'her', 'no tag-backs');
  for (let i = 0; i < 35; i++) g.tick(0.1, { x: f.kids.migo.x, z: f.kids.migo.z });
  assert.equal(g.state().it, 'migo', 'after 3 s she can');
});

test('tag: a kid who cannot catch her for 20 s chases another kid instead and tags them', () => {
  const f = field({ migo: { x: 1, z: 0 }, ella: { x: 3, z: 3 } }), g = make(f);
  g.startTag(['migo', 'ella'], { x: 0, z: 0 });
  g.tick(0.1, { x: 0, z: 0 });
  assert.equal(g.state().it, 'migo');
  // She runs away faster than the kid forever.
  let gave = null, swapped = null;
  for (let i = 0; i < 700 && !swapped; i++) {
    const ev = g.tick(0.1, { x: 0, z: 1000 + i * 100 });
    ev.forEach((e) => { if (e.type === 'gaveUp') gave = e; if (e.type === 'kidTagged') swapped = e; });
  }
  assert.ok(gave && gave.chase === 'ella');
  assert.ok(swapped && swapped.kid === 'ella' && swapped.by === 'migo');
  assert.equal(g.state().escaped, 1);
});

test('tag ends after 2 minutes with what she did', () => {
  const f = field({ migo: { x: 50, z: 0 } }), g = make(f);
  g.startTag(['migo'], { x: 0, z: 0 });
  let end = null;
  for (let i = 0; i < 1300 && !end; i++) g.tick(0.1, { x: 0, z: 0 }).forEach((e) => { if (e.type === 'end') end = e; });
  assert.equal(end.result, 'tagEnd');
  assert.equal(g.playing(), false);
  assert.ok(G.TEXT.grade5.tagEnd(1, 2).includes('tagged 1 friend and got away 2 times'));
});

test('hide-and-seek, she seeks: count 10, kids hide at different props, she finds them by coming near', () => {
  const f = field({ migo: { x: 0, z: 0 }, ella: { x: 0, z: 1 }, jun: { x: 1, z: 0 } }), g = make(f), list = props(8);
  g.startSeek(['migo', 'ella', 'jun'], { x: 0, z: 0 }, list);
  const counts = [];
  let go = false;
  for (let i = 0; i < 110 && !go; i++) g.tick(0.1, { x: 0, z: 0 }).forEach((e) => { if (e.type === 'count') counts.push(e.n); if (e.type === 'go') go = true; });
  assert.deepEqual(counts, [10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
  for (let i = 0; i < 50; i++) g.tick(0.1, { x: 0, z: 0 });
  const st = g.state();
  assert.equal(st.hidden.length, 3, 'all hidden');
  const at = ['migo', 'ella', 'jun'].map((id) => list.find((p) => Math.hypot(p.x - f.kids[id].x, p.z - f.kids[id].z) < 2).id);
  assert.equal(new Set(at).size, 3, 'each behind a different prop');
  let found = [];
  for (const id of ['migo', 'ella', 'jun']) {
    const k = f.kids[id];
    g.tick(0.1, { x: k.x + 2, z: k.z }).forEach((e) => { if (e.type === 'found') found.push(e.kid); if (e.type === 'end') found.push('end:' + e.result); });
  }
  assert.ok(found.includes('migo') && found.includes('ella') && found.includes('jun'));
  assert.ok(found.includes('end:allFound') || g.state().found === 3);
});

test('hide-and-seek: no hints until time runs low, then giggles that name only the place; time up brings everyone out', () => {
  const f = field({ migo: { x: 0, z: 0 } }), g = make(f), list = props(4).map((p) => Object.assign(p, { area: 'garden' }));
  g.startSeek(['migo'], { x: 0, z: 0 }, list);
  const far = { x: 500, z: 500 };
  const hints = [];
  let end = null, t = 0;
  for (let i = 0; i < 3000 && !end; i++) {
    g.tick(0.1, far).forEach((e) => {
      if (e.type === 'giggle') assert.fail('no giggle at the exact prop');
      if (e.type === 'hint') hints.push({ left: G.SEEK.time + G.SEEK.count - t, e });
      if (e.type === 'end') end = e;
    });
    t += 0.1;
  }
  assert.equal(end.result, 'timeUp');
  assert.equal(hints.length, G.SEEK.hints.length);
  hints.forEach((h, n) => {
    assert.ok(Math.abs(h.left - G.SEEK.hints[n]) < 0.3, 'at ' + G.SEEK.hints[n] + ' s left: ' + h.left);
    assert.deepEqual(Object.keys(h.e).sort(), ['kid', 'place', 'type'], 'no x or z in a hint');
    assert.equal(h.e.place, 'garden');
  });
  assert.equal(f.kids.migo.hidden, false);
  assert.equal(G.TEXT.grade5.hint(G.TEXT.grade5.places.garden), "🤭 I hear a giggle near Jesus' Garden!");
  assert.equal(G.TEXT.grade2.hint(G.TEXT.grade2.places.park), '🤭 May humahagikgik malapit sa Parke ng Bulong! · I hear a giggle near Whispering Park!');
});

test('hide-and-seek: the kids hide far from her, each in a different place, and are hiding when her eyes open', () => {
  const areas = ['playground', 'gate', 'plaza', 'garden', 'shop', 'park'];
  // Two props per place: one 8 from her, one 40 + away.
  const list = [];
  areas.forEach((a, n) => {
    const ang = n / areas.length * Math.PI * 2;
    list.push({ id: a + '-near', kind: 'bush', area: a, x: Math.cos(ang) * 8, z: Math.sin(ang) * 8, r: 1.3 });
    list.push({ id: a + '-far', kind: 'bush', area: a, x: Math.cos(ang) * (40 + n * 10), z: Math.sin(ang) * (40 + n * 10), r: 1.3 });
  });
  const picks = {};
  for (let run = 0; run < 40; run++) {
    const f = field({ a: { x: 0, z: 0 }, b: { x: 0, z: 0 }, c: { x: 0, z: 0 }, d: { x: 0, z: 0 } }), g = make(f);
    g.startSeek(['a', 'b', 'c', 'd'], { x: 0, z: 0 }, list);
    let go = null;
    for (let i = 0; i < 101 && !go; i++) {
      const ev = g.tick(0.1, { x: 0, z: 0 });
      if (ev.some((e) => e.type === 'go')) go = true;
    }
    assert.ok(go);
    assert.equal(g.state().hidden.length, 4, 'everyone is hiding when the count ends, even kids with far to go');
    const at = ['a', 'b', 'c', 'd'].map((id) => list.find((p) => Math.hypot(p.x - f.kids[id].x, p.z - f.kids[id].z) < 2));
    at.forEach((p) => { assert.ok(p.id.endsWith('-far'), 'never next to her: ' + p.id); picks[p.id] = (picks[p.id] || 0) + 1; });
    assert.equal(new Set(at.map((p) => p.area)).size, 4, 'each in a different place');
  }
  assert.equal(Object.keys(picks).length, areas.length, 'every place gets used over a few games: ' + JSON.stringify(picks));
});

test('hiding props remember their place', () => {
  const p = G.props([{ id: 'garden', x: 0, z: 0, r: 20 }, { x: 100, z: 0, r: 20 }], 6, rand, () => true);
  assert.ok(p.some((q) => q.area === 'garden'));
  assert.ok(p.some((q) => q.area === 'area1'));
});

test('tag: the chaser is faster than her walk, lunges faster than her sprint up close, then puffs', () => {
  assert.ok(G.TAG.chase > 9, 'beats her walk (9)');
  assert.ok(G.TAG.lunge > 12.6, 'beats her sprint (12.6)');
  assert.ok(G.TAG.puffSpeed < 9, 'a puff lets her get away');
  // Walking away in a straight line at 9: she gets caught.
  const f = field({ migo: { x: 1, z: 0 } }), g = make(f);
  g.startTag(['migo'], { x: 0, z: 0 });
  g.tick(0.1, { x: 0, z: 0 });
  // She runs off while the kid counts.
  let her = { x: 0, z: 0 }, ev = [];
  for (let i = 0; i < 31; i++) { her = { x: 0, z: her.z + 0.4 }; g.tick(0.1, her); }
  for (let i = 0; i < 300 && g.state().it !== 'her'; i++) {
    her = { x: her.x, z: her.z + 0.9 };
    ev = ev.concat(g.tick(0.1, her));
  }
  assert.equal(g.state().it, 'her', 'caught her walking');
  const kinds = ev.map((e) => e.type);
  assert.ok(kinds.includes('lunge'));
  assert.ok(kinds.indexOf('danger') < kinds.indexOf('gotYou'));
  assert.ok(ev.some((e) => e.type === 'danger' && e.on === false), 'the danger ends with the catch');
});

test('tag: sprinting clear of a close chaser is a getaway', () => {
  const f = field({ migo: { x: 1, z: 0 } }), g = make(f);
  g.startTag(['migo'], { x: 0, z: 0 });
  g.tick(0.1, { x: 0, z: 0 });
  // She waits 5 away while the kid counts, then sprints.
  let her = { x: 0, z: 5 };
  const ev = [];
  for (let i = 0; i < 31; i++) g.tick(0.1, her).forEach((e) => ev.push(e));
  for (let i = 0; i < 400 && !ev.some((e) => e.escaped); i++) {
    her = { x: 0, z: her.z + 1.26 };
    g.tick(0.1, her).forEach((e) => ev.push(e));
  }
  assert.equal(g.state().it, 'migo', 'not caught');
  assert.ok(ev.some((e) => e.type === 'danger' && e.on), 'the chaser got close');
  assert.ok(ev.some((e) => e.type === 'danger' && !e.on && e.escaped), 'and she got clear');
  assert.ok(ev.some((e) => e.type === 'pop' && e.text === G.POPS.close));
  assert.equal(g.state().escaped, 1);
});

test('tag: a kid she is about to touch sidesteps once, then needs a rest', () => {
  const f = field({ migo: { x: 3, z: 0 } }), g = make(f);
  g.startTag(['migo'], { x: -10, z: 0 });
  const ev = g.tick(0.1, { x: 0, z: 0 });
  assert.ok(ev.some((e) => e.type === 'pop' && e.kid === 'migo' && e.text === G.POPS.juke));
  const p = { x: f.kids.migo.x, z: f.kids.migo.z };
  g.tick(0.1, { x: 0, z: 0 });
  assert.ok(Math.abs(f.kids.migo.z - p.z) > 0.5, 'a quick step to the side');
  const again = [];
  for (let i = 0; i < 10; i++) g.tick(0.1, { x: f.kids.migo.x - 3, z: f.kids.migo.z }).forEach((e) => again.push(e));
  assert.ok(!again.some((e) => e.text === G.POPS.juke), 'not again straight away');
});

test('the sneaky switch: at most once a game a kid she comes close to dashes to another prop', () => {
  let sneaks = 0;
  for (let run = 0; run < 30; run++) {
    const f = field({ a: { x: 0, z: 0 }, b: { x: 0, z: 0 }, c: { x: 0, z: 0 } }), g = make(f), list = props(10);
    g.startSeek(['a', 'b', 'c'], { x: 0, z: 0 }, list);
    for (let i = 0; i < 160; i++) g.tick(0.1, { x: 0, z: 0 });
    let here = 0;
    for (const id of ['a', 'b', 'c']) {
      const k = f.kids[id];
      const ev = g.tick(0.1, { x: k.x + 6, z: k.z });
      here += ev.filter((e) => e.type === 'sneak').length;
    }
    assert.ok(here <= 1);
    sneaks += here;
  }
  assert.ok(sneaks > 5, 'it does happen');
});

test('she hides: the seeker counts, then finds her when close unless she is disguised and still', () => {
  let missed = 0, caught = 0;
  for (let run = 0; run < 200; run++) {
    const f = field({ jun: { x: 0, z: 0 }, ella: { x: 0, z: 0 } }), g = make(f), list = props(6);
    g.startHide(['jun', 'ella'], { x: 0, z: 0 }, list, 'jun');
    for (let i = 0; i < 101; i++) g.tick(0.1, { x: 40, z: 40, still: true, disguised: true });
    assert.equal(g.state().phase, 'look');
    f.kids.jun.x = 41; f.kids.jun.z = 40;
    const ev = g.tick(0.1, { x: 40, z: 40, still: true, disguised: true });
    if (ev.some((e) => e.type === 'foundYou')) caught++; else missed++;
  }
  assert.ok(missed > 110 && missed < 170, 'missed about 7 in 10: ' + missed);
  const f = field({ jun: { x: 0, z: 0 } }), g = make(f);
  g.startHide(['jun'], { x: 0, z: 0 }, props(4), 'jun');
  for (let i = 0; i < 101; i++) g.tick(0.1, { x: 40, z: 40 });
  f.kids.jun.x = 41; f.kids.jun.z = 40;
  const ev = g.tick(0.1, { x: 40, z: 40, still: true, disguised: false });
  assert.ok(ev.some((e) => e.type === 'end' && e.result === 'foundYou'), 'not disguised: found');
});

test('Boo! only when the seeker is close and looking; it ends the round as her win', () => {
  const f = field({ jun: { x: 0, z: 0 } }), g = make(f);
  g.startHide(['jun'], { x: 0, z: 0 }, props(4), 'jun');
  assert.deepEqual(g.boo({ x: 0, z: 1 }), [], 'not while counting');
  for (let i = 0; i < 101; i++) g.tick(0.1, { x: 40, z: 40, still: true, disguised: true });
  assert.equal(g.booReady({ x: 40, z: 40 }), false, 'too far');
  f.kids.jun.x = 44; f.kids.jun.z = 40;
  assert.equal(g.booReady({ x: 40, z: 40 }), true);
  const ev = g.boo({ x: 40, z: 40 });
  assert.ok(ev.some((e) => e.type === 'boo' && e.kid === 'jun'));
  assert.equal(ev.find((e) => e.type === 'end').result, 'boo');
  assert.equal(g.playing(), false);
});

test('she hides: the seeker checks every prop, finds the other hiders, and she is the best hider if never found', () => {
  const f = field({ jun: { x: 0, z: 0 }, ella: { x: 0, z: 0 } }), g = make(f), list = props(5);
  g.startHide(['jun', 'ella'], { x: 0, z: 0 }, list, 'jun');
  let end = null, kidFound = 0;
  for (let i = 0; i < 2000 && !end; i++) g.tick(0.1, { x: 900, z: 900 }).forEach((e) => { if (e.type === 'end') end = e; if (e.type === 'kidFound') kidFound++; });
  assert.equal(end.result, 'bestHider');
  assert.equal(kidFound, 1, 'ella was found at her prop');
});

test('disguise: only while she hides, near a prop', () => {
  const f = field({ jun: { x: 0, z: 0 } }), g = make(f), list = props(4);
  g.startHide(['jun'], { x: 0, z: 0 }, list, 'jun');
  assert.equal(g.disguiseProp({ x: list[2].x + 1, z: list[2].z }), list[2]);
  assert.equal(g.disguiseProp({ x: 900, z: 900 }), null);
  g.startSeek(['jun'], { x: 0, z: 0 }, list);
  assert.equal(g.disguiseProp({ x: list[2].x, z: list[2].z }), null);
});

test('lines: Grade 2 pairs, the same words in both grades, buttons and pops in English', () => {
  const g2 = G.TEXT.grade2, g5 = G.TEXT.grade5;
  assert.deepEqual(Object.keys(g2).sort(), Object.keys(g5).sort());
  for (const k of Object.keys(g2)) {
    const v = g2[k];
    const all = k === 'hint' ? [v(g2.places.gate), v(null)] : typeof v === 'function' ? [v(2, 3)] : Array.isArray(v) ? v : k === 'places' || k === 'groups' ? Object.values(v) : [v];
    for (const s of all) assert.match(s, / · /, k);
  }
  assert.equal(g2.why.length, g5.why.length);
  assert.deepEqual(Object.keys(g2.places).sort(), Object.keys(g5.places).sort());
  assert.ok(g5.why.length >= 6);
  for (const b of Object.values(G.BUTTONS).concat(Object.values(G.POPS))) assert.ok(!b.includes(' · '), b);
  assert.equal(G.fill(g5.kidIt, { name: 'Migo' }), '🏷️ Migo is it! Run!');
});

test('games come in groups: Tag & Chase (tag, Patintero) and Hide & Seek (hide-and-seek)', () => {
  assert.deepEqual(G.GROUPS.map((g) => [g.id, g.games]), [['chase', ['tag', 'patintero']], ['hide', ['seek']]]);
  assert.deepEqual(G.GAMES, ['tag', 'patintero', 'seek'], 'every game once, in group order');
  assert.equal(G.BUTTONS.chase, '🏃 Tag & Chase');
  assert.equal(G.BUTTONS.hide, '🙈 Hide & Seek');
  assert.equal(G.BUTTONS.patintero, '🏃 Patintero!');
  assert.equal(G.BUTTONS.back, '⬅ Back');
  assert.equal(G.BUTTONS.play, "🎲 Let's play!");
  G.GAMES.forEach((id) => assert.ok(G.BUTTONS[id], id + ' has a button'));
});

test('group and Patintero texts in both grades; Grade 2 pairs Filipino · English', () => {
  for (const grade of ['grade5', 'grade2']) {
    const t = G.TEXT[grade];
    ['kinds', 'inviteRun', 'patRun', 'patGuard', 'patTagged', 'patTagger', 'patScore', 'patTheyScore'].forEach((k) => assert.equal(typeof t[k], 'string', grade + ' ' + k));
    ['chase', 'hide'].forEach((k) => assert.equal(typeof t.groups[k], 'string', grade + ' group ' + k));
    ['patWin', 'patLose', 'patTie'].forEach((k) => assert.match(t[k](2, 1), /2.*1/, grade + ' ' + k));
  }
  const g2 = G.TEXT.grade2;
  assert.equal(g2.groups.chase, 'Habulan at Takbuhan · Tag & Chase');
  assert.equal(g2.groups.hide, 'Taguan · Hide & Seek');
  assert.equal(g2.inviteRun, 'Gusto mo bang maglaro ng patintero? · Want to play Patintero?');
  assert.equal(g2.patTagged, '😲 Nataya! Magpapalit ang mga koponan! · Tagged! Teams swap!');
  assert.equal(g2.patWin(3, 1), 'Panalo ang koponan mo, 3 laban sa 1! · Your team won, 3 to 1!');
  ['kinds', 'inviteRun', 'patRun', 'patGuard', 'patTagged', 'patTagger', 'patScore', 'patTheyScore'].forEach((k) => assert.ok(g2[k].includes(' · '), k));
  assert.equal(G.TEXT.grade5.why.length, G.TEXT.grade2.why.length);
  assert.ok(G.TEXT.grade5.why.includes('Teamwork: watch your teammates and run when the guard looks away!'));
});
