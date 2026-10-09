const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { worldFile } = require('./paths.js');
const L = require(worldFile('layout.js'));
const P = require(worldFile('patintero.js'));

const games = fs.readFileSync(worldFile('games3d.js'), 'utf8');

test('the Patintero court and its run-offs are clear of everything in both grades', () => {
  const m = games.match(/COURT_AT = \[(-?[\d.]+), (-?[\d.]+)\]/);
  assert.ok(m, 'games3d.js names the court spot');
  const c = P.court(+m[1], +m[2]);
  for (const grade of ['grade5', 'grade2']) {
    const obs = L.obstacles(grade), b = L.GRADES[grade].bounds;
    for (let x = c.minX; x <= c.maxX; x += 0.5) {
      for (let z = c.far - P.COURT.end; z <= c.home + P.COURT.end; z += 0.5) {
        assert.ok(!L.blocked(obs, b, x, z, 0.5), grade + ' blocked at ' + x + ',' + z);
        assert.ok(!L.onPath(grade, x, z, 0.5), grade + ' path at ' + x + ',' + z);
      }
    }
  }
});

test('hiding props never land on the court', () => {
  assert.match(games, /function okSpot\(x, z\) \{[^}]*!onCourt\(x, z, 3\)/);
});

const mates = fs.readFileSync(worldFile('mates3d.js'), 'utf8');
const main = fs.readFileSync(worldFile('world-main.js'), 'utf8');

test('a kid offers one 🎲 Let\'s play! that opens the group picker', () => {
  assert.match(mates, /GB\.play, onClick: function \(\) \{ o\.choose\(k\.m\.id\); \}/);
  assert.ok(!/GB\.tag|GB\.seek/.test(mates), 'no single-game buttons left in the kid bubble');
  assert.match(main, /choose: function \(id\) \{ if \(games\) games\.choose\(id\); \}/);
});

test('a friend asks for any game, each equally likely', () => {
  assert.match(games, /G\.GAMES\[Math\.floor\(rand\(\) \* G\.GAMES\.length\) % G\.GAMES\.length\]/);
});

test('her fence and her place come from the game', () => {
  assert.match(main, /blocked: function \(x, z\) \{ (if \(home\) return roomBlocked\(x, z, L\.PLAYER_R\); )?return L\.blocked\(obs, bounds, x, z, L\.PLAYER_R\) \|\| \(!!games && \(games\.blocked\(x, z, L\.PLAYER_R\) \|\| games\.fence\(x, z\)\)\); \}/);
  assert.match(main, /place: function \(x, z, face\) \{ ctl\.teleport\(x, z, face\); pal\.place\(ctl\.state, true\); \}/);
  assert.match(games, /fence: function \(x, z\) \{ return pat\.fence\(x, z\); \}/);
});
