const test = require('node:test');
const assert = require('node:assert/strict');
const { engineFile } = require('./paths.js');
const B = require(engineFile('bosses.js'));

const KEYS = ['hello', 'tease', 'ouch', 'home', 'beaten', 'dizzy'];

test('6 bosses take turns, one per week, starting the week of 2026-10-05', () => {
  assert.deepEqual(B.ROSTER.map((b) => b.id), ['cloud', 'jelly', 'snooze', 'mess', 'fuzz', 'spud']);
  assert.equal(B.ofWeek('2026-10-05').id, 'cloud');
  assert.equal(B.ofWeek('2026-10-12').id, 'jelly');
  assert.equal(B.ofWeek('2026-11-09').id, 'spud');
  assert.equal(B.ofWeek('2026-11-16').id, 'cloud', 'back to the first after 6 weeks');
  assert.equal(B.ofWeek('2026-09-28').id, 'spud', 'weeks before the first one still work');
  const dec = B.ROSTER.indexOf(B.ofWeek('2026-12-28'));
  assert.equal(B.ROSTER.indexOf(B.ofWeek('2027-01-04')), (dec + 1) % 6, 'the year boundary moves on by one');
  assert.equal(B.ofWeek('junk').id, 'cloud', 'an unreadable week falls back to the first boss');
});

test('every boss has every line for both grades; Grade 2 pairs Filipino · English; never "mali" or "wrong"', () => {
  for (const b of B.ROSTER) {
    for (const k of KEYS) {
      const g5 = B.text(b, k, 'grade5', 3);
      const g2 = B.text(b, k, 'grade2', 3);
      assert.ok(g5.length > 5, b.id + ' ' + k);
      assert.equal(g5.indexOf(' · '), -1, 'Grade 5 is English only');
      assert.equal(g2.split(' · ').length, 2, b.id + ' ' + k + ' is one Filipino · English pair');
      assert.ok(g2.endsWith(g5), 'the English half is the Grade 5 line');
      assert.ok(!/\bmali\b|wrong/i.test(g5 + g2), b.id + ' ' + k + ' is never mean');
      assert.ok(!/\{\w+\}/.test(g5 + g2), 'every placeholder is filled');
    }
  }
});

test('hello and ouch say the real number', () => {
  const cloud = B.ROSTER[0];
  assert.equal(B.text(cloud, 'hello', 'grade5', 7), 'Hmph! My 7 raindrops will rain on your parade!');
  assert.match(B.text(cloud, 'ouch', 'grade2', 2), /^Kulog at kidlat! 2 na lang ang natitira! · .*Only 2 more to go!$/);
});

test('names: Grade 2 pairs them unless both halves match', () => {
  assert.equal(B.name(B.ROSTER[0], 'grade5'), 'King Grumble Cloud');
  assert.equal(B.name(B.ROSTER[0], 'grade2'), 'Haring Ulap-Simangot · King Grumble Cloud');
  assert.equal(B.name(B.ROSTER[1], 'grade2'), 'Jelly Jiggles');
});

test('drawings come from the palette, for every mood', () => {
  for (const b of B.ROSTER) {
    for (const mood of ['normal', 'ouch', 'dizzy']) {
      const svg = B.svg(b, mood);
      assert.match(svg, /^<svg [^>]*viewBox="0 0 120 110"/);
      assert.ok(svg.includes(b.palette.body), b.id + ' uses its body colour');
    }
    assert.match(B.minionSvg(b), /^<svg [^>]*viewBox="0 0 40 40"/);
    assert.ok(Array.isArray(b.pieces) && b.pieces.length >= 3, b.id + ' has burst pieces');
    assert.match(b.minion.color, /^#[0-9a-f]{6}$/i);
    assert.ok(b.emoji, b.id + ' has an emoji for the 3D speech bubble');
  }
});

test('one minion reads in the singular, and snooze plural is maliliit', () => {
  for (const b of B.ROSTER) {
    const g5 = B.text(b, 'hello', 'grade5', 1);
    const g2 = B.text(b, 'hello', 'grade2', 1);
    assert.ok(g5.indexOf('My 1 ' + b.minion.one.en) >= 0 || g5.indexOf('1 ' + b.minion.one.en) >= 0, b.id + ' ' + g5);
    assert.ok(g2.indexOf('1 ' + b.minion.one.fil) >= 0, b.id + ' ' + g2);
    assert.ok(B.text(b, 'hello', 'grade5', 3).indexOf('3 ' + b.minion.en) >= 0, 'plural for 3');
  }
  assert.equal(B.ROSTER[2].minion.fil, 'maliliit na unan');
  assert.match(B.text(B.ROSTER[0], 'hello', 'grade5', 1), /My 1 raindrop will/);
});
