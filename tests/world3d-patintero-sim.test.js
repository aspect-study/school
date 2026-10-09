const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile } = require('./paths.js');
const P = require(worldFile('patintero.js'));

// Whole kid games on an open field, 20 seeds: she stands still behind the home line while her team runs and in the
// middle of her line while it guards, so only the kids play. The kids' play must keep the game moving.
function play(seed0) {
  let seed = seed0;
  const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const kids = {};
  ['a', 'b', 'c', 'd', 'e', 'f', 'g'].forEach((id, i) => { kids[id] = { x: i, z: 0 }; });
  const f = {
    move(id, x, z, speed, dt) {
      const k = kids[id], dx = x - k.x, dz = z - k.z, d = Math.hypot(dx, dz), s = speed * dt;
      if (d <= Math.max(s, 0.3)) { k.x = x; k.z = z; return true; }
      k.x += dx / d * s; k.z += dz / d * s;
      return false;
    },
    where: (id) => kids[id],
    put(id, p) { if (p.x !== undefined) { kids[id].x = p.x; kids[id].z = p.z; } return true; }
  };
  const g = P.create({ rand, move: f.move, where: f.where, put: f.put }), c = P.court(39, 74);
  const her = { x: 39, z: 90 }, out = { scores: 0, swaps: 0 };
  const take = (ev) => ev.forEach((e) => {
    if (e.type === 'place') { her.x = e.x; her.z = e.z; }
    if (e.type === 'score') out.scores++;
    if (e.type === 'swap') out.swaps++;
  });
  take(g.start(Object.keys(kids), her, c, null, seed0 % 2 === 1));
  for (let t = 0; t < 300 && g.playing(); t += 0.05) take(g.tick(0.05, her));
  out.ended = !g.playing();
  out.time = P.RULES.time - g.state().left;
  return out;
}

test('kid play keeps the game moving: points get scored, turns are neither instant nor endless, games last', () => {
  const games = Array.from({ length: 20 }, (_, i) => play(i + 1));
  assert.ok(games.every((g) => g.ended), 'every game ends');
  const scored = games.filter((g) => g.scores > 0).length;
  const turns = games.reduce((n, g) => n + g.swaps + 1, 0), mean = games.reduce((t, g) => t + g.time, 0) / turns;
  assert.ok(scored >= 10, 'kids score in at least half the games: ' + scored + '/20');
  assert.ok(mean >= 8 && mean <= 45, 'a turn lasts 8 to 45 s on average: ' + mean.toFixed(1));
  const game = games.reduce((t, g) => t + g.time, 0) / 20;
  assert.ok(game >= 90, 'a game is not over in a flash: ' + game.toFixed(0) + ' s on average');
});
