/* Patintero with the kids, the pure part (playground games part 3; the 3D side is games3d.js). Two teams of up to 4 on a
   court of cross lines: the runners go from behind the home line past every line to beyond the far line and back, and
   each one who gets home scores a point; the guards stay on their lines (a cross-line guard moves only across the
   court, the middle guard only along the middle line) and tag a runner by touching them. One tag swaps the teams. The
   first team to WIN points, or the team ahead after TIME seconds, wins.
   She is on the blue team. While her team runs she moves freely (the shell keeps her inside the court with fence());
   while it guards she is the middle guard and the shell keeps her on the middle line. Kid runners wait out of reach of
   the next line, feint along it away from its guard (across the middle line only when its guard is far along it), and
   dash beside the middle line when no guard is near where they would cross (the longer they wait, the nearer to the
   middle guard they dare cross it, and the other team also takes smaller gaps). Kid guards watch one runner near their
   line at a time, react a moment late (so a feint works), and lunge when that runner is close.
   o = { rand, move(id, x, z, speed, dt) → arrived, where(id) → { x, z }, put(id, p) }; her = { x, z } each tick. */
(function (root) {
  'use strict';

  // w, len: court size; gap: between lines (3 cross lines at gap, 2 gap, 3 gap from home); end: run-off behind the
  // home and far lines; edge: how close to a sideline anyone goes.
  var COURT = { w: 30, len: 60, gap: 15, end: 8, edge: 0.6 };
  // Her walk is 9 and her sprint 12.6 (walk.js): a guard is slower than her walk, a lunge slower than her sprint.
  var RULES = {
    win: 5, time: 240, ready: 3, reach: 1.6,
    guard: 8.5, lunge: 11, lungeR: 3, lungeT: 0.6, rest: 1.2, restSpeed: 4,
    run: 11, dash: 11, past: 2.5, off: 2, side: 2.5, wait: 1.4,
    // A kid crosses when no guard is nearer than this to where they would cross: her teammates are careful (safe),
    // the other team bolder (bold, smaller the longer it waits), so she gets to tag them when she guards. midSafe: how
    // far the middle guard must be before a kid crosses the middle line; it also shrinks with waiting, for both teams.
    safe: 4, bold: 3.5, impatient: 0.3, midSafe: 4.5, keep: 1.5, react: 0.3, danger: 4
  };
  // Word pops are English on both grades.
  var POPS = { got: 'Got you!', home: 'Home! 🎉', tagged: '😲', ready: 'Ready…', set: 'Set…', go: 'Go!' };
  // The guard posts, in the order a team fills them: hers puts her in the middle.
  var POSTS = ['c0', 'c1', 'c2', 'mid'];

  function dist(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  // The court around (cx, cz), long side along z, home at the +z end.
  function court(cx, cz) {
    var home = cz + COURT.len / 2, far = cz - COURT.len / 2, cross = [];
    for (var i = 1; i * COURT.gap < COURT.len; i++) cross.push(home - i * COURT.gap);
    return {
      cx: cx, cz: cz, w: COURT.w, len: COURT.len, minX: cx - COURT.w / 2, maxX: cx + COURT.w / 2, home: home, far: far, cross: cross,
      mid: { x: cx, from: cross[0], to: far }
    };
  }

  // Where she may stand: running, anywhere on the court and its run-offs; guarding, only on the middle line.
  function fence(c, guarding, x, z) {
    if (guarding) return Math.abs(x - c.mid.x) > 0.01 || z > c.mid.from || z < c.mid.to;
    return x < c.minX + COURT.edge || x > c.maxX - COURT.edge || z > c.home + COURT.end || z < c.far - COURT.end;
  }

  function create(o) {
    var rand = o.rand, st = null;

    // blue: her team (her first, then the kid who asked and her sister), red: the rest. ids: the kids, first one asked.
    function teams(ids, sister) {
      var mine = ids.slice(0, 1);
      if (sister && ids.indexOf(sister) > 0) mine.push(sister);
      var rest = ids.filter(function (id) { return mine.indexOf(id) < 0; });
      var size = Math.min(3, Math.ceil((ids.length + 1) / 2) - 1);
      while (mine.length < size && rest.length) mine.push(rest.shift());
      return { blue: ['her'].concat(mine), red: rest.slice(0, 4) };
    }

    function u(z) { return st.court.home - z; }
    function onCourt(p) { var k = u(p.z); return k >= 0 && k <= COURT.len; }

    // Everyone to their spots for a turn: runners spread behind the home line, guards on their posts.
    function lineUp(ev) {
      var c = st.court, run = st.team[st.runners], guard = st.team[st.runners === 'blue' ? 'red' : 'blue'];
      st.posts = {};
      st.legs = {};
      guard.forEach(function (id, n) {
        var post = (guard[0] === 'her' ? ['mid', 'c0', 'c1', 'c2'] : POSTS)[n];
        st.posts[id] = post;
        var p = postSpot(post, c.cx + (n % 2 ? 2 : -2));
        if (id === 'her') ev.push({ type: 'place', x: p.x, z: p.z, face: Math.PI });
        else o.put(id, { x: p.x, z: p.z, face: 0, still: true });
      });
      run.forEach(function (id, n) {
        var x = c.minX + (n + 0.5) * c.w / run.length, z = c.home + 2;
        st.legs[id] = { back: false, plan: null, dash: null, wait: rand() * RULES.wait, waited: 0 };
        if (id === 'her') ev.push({ type: 'place', x: x, z: z, face: Math.PI });
        else o.put(id, { x: x, z: z, face: Math.PI, still: true });
      });
      st.guards = {};
      guard.forEach(function (id) { st.guards[id] = { lunge: 0, rest: 0, watch: null, keep: 0 }; });
      st.phase = 'ready';
      st.ready = RULES.ready;
      st.shown = 0;
      st.her = { back: false };
    }

    function postSpot(post, x) {
      var c = st.court;
      if (post === 'mid') return { x: c.mid.x, z: (c.mid.from + c.mid.to) / 2 };
      return { x: clamp(x, c.minX + COURT.edge, c.maxX - COURT.edge), z: c.cross[+post.slice(1)] };
    }

    // ids: the kids (the one who asked first); sister: her sister's id when she plays; herRuns: her team runs first.
    function start(ids, her, c, sister, herRuns) {
      var t = teams(ids, sister);
      st = {
        court: c, team: t, ids: t.blue.concat(t.red).filter(function (id) { return id !== 'her'; }), runners: herRuns === false ? 'red' : 'blue',
        score: { blue: 0, red: 0 }, t: 0, done: false, result: null, danger: false, chaseD: null, swaps: 0, herRuns: herRuns !== false
      };
      var ev = [{ type: 'start', kind: 'patintero' }];
      lineUp(ev);
      return ev;
    }

    function guarding() { return !!st && !st.done && st.runners === 'red'; }
    function where(id, her) { return id === 'her' ? her : o.where(id); }

    // The z a runner heads for next: just past the next line on their leg, or behind the far / home line.
    function nextZ(z, back) {
      var c = st.court, lines = [c.home].concat(c.cross, [c.far]), k;
      if (!back) {
        for (k = 0; k < lines.length; k++) if (lines[k] < z - 0.01) return lines[k] - RULES.past;
        return c.far - RULES.past;
      }
      for (k = lines.length - 1; k >= 0; k--) if (lines[k] > z + 0.01) return lines[k] + RULES.past;
      return c.home + RULES.past;
    }

    // How far the guards who could reach a runner crossing the line at lineZ at x are from that spot: the line's own
    // guard, and the middle guard only when x is on the middle line.
    function threat(x, lineZ, her) {
      var best = Infinity;
      Object.keys(st.posts).forEach(function (id) {
        var g = where(id, her), post = st.posts[id];
        if (post === 'mid' && Math.abs(x - st.court.mid.x) > RULES.reach + 0.4) return;
        if (post !== 'mid' && Math.abs(g.z - lineZ) > 0.01) return;
        best = Math.min(best, dist(g, { x: x, z: lineZ }));
      });
      return best;
    }

    function midGuard(her) {
      var id = Object.keys(st.posts).filter(function (g) { return st.posts[g] === 'mid'; })[0];
      return id ? where(id, her) : null;
    }

    function lineGuard(lineZ, her) {
      var id = Object.keys(st.posts).filter(function (g) { return st.posts[g] !== 'mid' && Math.abs(where(g, her).z - lineZ) < 0.01; })[0];
      return id ? where(id, her) : null;
    }

    function runKid(id, dt, her) {
      var c = st.court, leg = st.legs[id], p = o.where(id), goal = nextZ(p.z, leg.back);
      var lineZ = leg.back ? goal - RULES.past : goal + RULES.past;
      // A dash goes to just past the one line it started at (leg.dash holds that z).
      if (leg.dash !== null) {
        if (o.move(id, p.x, leg.dash, RULES.dash, dt)) { leg.dash = null; leg.wait = rand() * RULES.wait; leg.waited = 0; }
        return;
      }
      leg.wait -= dt;
      leg.waited += dt;
      // Her teammates only take a clear gap; the other team takes smaller gaps the longer they wait at a line. Both
      // risk crossing the middle line nearer its guard the longer they wait, so a guard standing still cannot hold
      // them forever.
      var safe = st.runners === 'blue' ? RULES.safe : Math.max(RULES.reach + 1, RULES.bold - leg.waited * RULES.impatient);
      var midSafe = Math.max(0, RULES.midSafe - leg.waited * RULES.impatient);
      var wz = leg.back ? lineZ - RULES.off : lineZ + RULES.off;
      // A dash starts only from the waiting spot, so a guard far away now is still far away at the line, and never
      // along the middle line, where its guard is.
      var dx = p.x - c.cx, outside = Math.abs(dx) > RULES.reach + 0.4;
      if (leg.wait <= 0 && outside && Math.abs(p.z - wz) < 0.5 && threat(p.x, lineZ, her) >= safe) { leg.dash = goal; leg.plan = null; return; }
      // Feint: wait out of reach of the line, sliding along it on one side of the middle line; switching sides crosses
      // the middle line, so only when its guard is not near, checked again just before stepping onto it.
      var mid = midGuard(her);
      var midNear = !!mid && p.z <= c.mid.from + RULES.reach && p.z >= c.mid.to - RULES.reach && Math.abs(mid.z - p.z) < midSafe;
      if (leg.plan && outside && (leg.plan.x - c.cx) * dx < 0 && midNear) leg.plan = null;
      if (!leg.plan || o.move(id, leg.plan.x, leg.plan.z, RULES.run, dt)) {
        var side = dx < 0 ? -1 : 1, g = lineGuard(lineZ, her);
        var want = g ? (g.x < c.cx ? 1 : -1) : side;
        if (rand() < 0.3) want = -want;
        if (want !== side && !midNear) side = want;
        leg.plan = { x: c.cx + side * (RULES.side + rand() * (c.w / 2 - RULES.side - COURT.edge)), z: wz };
      }
    }

    // A runner past the far line turns for home; one back behind the home line scores and goes again.
    function legs(id, p, ev) {
      var c = st.court, leg = id === 'her' ? st.her : st.legs[id];
      if (!leg.back && p.z < c.far) {
        leg.back = true;
        if (id !== 'her') { leg.plan = null; leg.dash = null; }
      } else if (leg.back && p.z > c.home) {
        leg.back = false;
        if (id !== 'her') { leg.plan = null; leg.dash = null; }
        st.score[st.runners]++;
        ev.push({ type: 'score', team: st.runners, kid: id });
        if (id !== 'her') ev.push({ type: 'pop', kid: id, text: POPS.home });
      }
    }

    function guardKid(id, dt, her) {
      var c = st.court, g = st.guards[id], post = st.posts[id], me = o.where(id), runners = st.team[st.runners];
      var lineZ = post === 'mid' ? null : c.cross[+post.slice(1)];
      // How far a runner is from this guard's line: across for the middle line (only beside it), along for a cross line.
      function off(p) {
        if (post !== 'mid') return Math.abs(p.z - lineZ);
        return p.z > c.mid.from + RULES.off || p.z < c.mid.to - RULES.off ? Infinity : Math.abs(p.x - c.mid.x);
      }
      // A guard watches one runner near the line for a while, picked at random, so the others sometimes get a gap.
      g.keep -= dt;
      if (!g.watch || g.keep <= 0 || runners.indexOf(g.watch) < 0 || off(where(g.watch, her)) > COURT.gap / 2) {
        var near = runners.filter(function (r) { return off(where(r, her)) <= COURT.gap / 2; });
        if (!near.length) near = runners.slice().sort(function (a, b) { return off(where(a, her)) - off(where(b, her)); }).slice(0, 1);
        g.watch = near[Math.floor(rand() * near.length) % near.length];
        g.keep = RULES.keep;
      }
      // Guards react a moment late: they go where the runner they watch was a moment ago, so a feint works.
      var now = where(g.watch, her), k = Math.min(1, dt / RULES.react);
      if (!g.seen || g.seenId !== g.watch) { g.seen = { x: now.x, z: now.z }; g.seenId = g.watch; }
      g.seen = { x: g.seen.x + (now.x - g.seen.x) * k, z: g.seen.z + (now.z - g.seen.z) * k };
      var best = g.seen;
      g.rest = Math.max(0, g.rest - dt);
      var speed = RULES.guard;
      if (g.lunge > 0) {
        g.lunge -= dt;
        speed = RULES.lunge;
        if (g.lunge <= 0) g.rest = RULES.rest;
      } else if (g.rest > 0) speed = RULES.restSpeed;
      else if (dist(me, now) <= RULES.lungeR) { g.lunge = RULES.lungeT; speed = RULES.lunge; }
      var tx = post === 'mid' ? c.mid.x : clamp(best ? best.x : c.cx, c.minX + COURT.edge, c.maxX - COURT.edge);
      var tz = post === 'mid' ? clamp(best ? best.z : (c.mid.from + c.mid.to) / 2, c.mid.to, c.mid.from) : lineZ;
      o.move(id, tx, tz, speed, dt);
      // Guards never leave their line.
      var at = o.where(id);
      if (post === 'mid') o.put(id, { x: c.mid.x, z: clamp(at.z, c.mid.to, c.mid.from) });
      else o.put(id, { x: clamp(at.x, c.minX + COURT.edge, c.maxX - COURT.edge), z: lineZ });
    }

    function swap(ev, by, kid) {
      st.swaps++;
      ev.push({ type: 'swap', by: by, kid: kid, herTeam: st.runners === 'blue' ? 'tagged' : 'tagger' }, { type: 'pop', kid: by === 'her' ? kid : by, text: by === 'her' ? POPS.tagged : POPS.got });
      st.runners = st.runners === 'blue' ? 'red' : 'blue';
      calm(ev);
      lineUp(ev);
    }

    function calm(ev) {
      st.chaseD = null;
      if (!st.danger) return;
      st.danger = false;
      ev.push({ type: 'danger', on: false });
    }

    function finish(ev) {
      st.done = true;
      var a = st.score.blue, b = st.score.red;
      st.result = a > b ? 'win' : a < b ? 'lose' : 'tie';
      calm(ev);
      st.ids.forEach(function (id) { o.put(id, { cheer: true, still: true }); });
      return ev.concat([{ type: 'end', kind: 'patintero', result: st.result }]);
    }

    function tick(dt, her) {
      if (!st || st.done) return [];
      var ev = [];
      // The 4 minutes run through the ready counts too.
      st.t += dt;
      if (st.phase === 'ready') {
        st.ready -= dt;
        var n = Math.max(1, Math.ceil(st.ready));
        if (st.ready > 0 && n !== st.shown) { st.shown = n; ev.push({ type: 'count', n: n }); }
        if (st.ready <= 0) { st.phase = 'play'; ev.push({ type: 'go' }); }
        return st.t >= RULES.time ? finish(ev) : ev;
      }
      var runners = st.team[st.runners], guards = Object.keys(st.posts);
      runners.forEach(function (id) { if (id !== 'her') runKid(id, dt, her); });
      guards.forEach(function (id) { if (id !== 'her') guardKid(id, dt, her); });
      // Tags: a guard touching a runner on the court swaps the teams.
      for (var i = 0; i < guards.length; i++) {
        for (var j = 0; j < runners.length; j++) {
          var g = where(guards[i], her), r = where(runners[j], her);
          if (onCourt(r) && dist(g, r) <= RULES.reach) {
            swap(ev, guards[i], runners[j]);
            return ev;
          }
        }
      }
      runners.forEach(function (id) { legs(id, where(id, her), ev); });
      if (st.score.blue >= RULES.win || st.score.red >= RULES.win || st.t >= RULES.time) return finish(ev);
      // Danger: a guard lunging close to her while she runs.
      if (st.runners === 'blue') {
        var near = null;
        guards.forEach(function (id) {
          var d = dist(o.where(id), her);
          if (st.guards[id].lunge > 0 && d <= RULES.danger && (near === null || d < near)) near = d;
        });
        st.chaseD = near;
        if (near !== null && !st.danger) { st.danger = true; ev.push({ type: 'danger', on: true }); }
        else if (near === null && st.danger) { st.danger = false; ev.push({ type: 'danger', on: false }); }
      }
      return ev;
    }

    function state() {
      if (!st) return null;
      return {
        kind: 'patintero', phase: st.phase, done: st.done, result: st.result, running: st.runners === 'blue', guarding: guarding(),
        score: { blue: st.score.blue, red: st.score.red }, left: Math.max(0, RULES.time - st.t),
        count: st.phase === 'ready' ? Math.max(1, Math.ceil(st.ready)) : 0, team: { blue: st.team.blue.slice(), red: st.team.red.slice() },
        posts: Object.assign({}, st.posts), ids: st.ids.slice(), danger: st.danger, chaseD: st.chaseD, swaps: st.swaps, herRuns: st.herRuns,
        props: []
      };
    }

    return {
      start: start, tick: tick, state: state, guarding: guarding,
      fence: function (x, z) { return !!st && !st.done && fence(st.court, guarding(), x, z); },
      playing: function () { return !!st && !st.done; },
      stop: function () { st = null; }
    };
  }

  var exported = { COURT: COURT, RULES: RULES, POPS: POPS, court: court, fence: fence, create: create };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.Patintero = exported;
})(this);
