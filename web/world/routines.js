/* The living world's engine (pure, no Three.js): every world character and pet is a small state machine. A character
   rests, picks one of its routines (lifedata.js), walks to the routine's spot inside its leash around home, acts for
   the step lengths, and walks home. tick(dt, her) with
   her = { x, z, cam ({ x, z }), sprint, talkingTo (an id), busy, waving, hold ({ id: true }), owners ({ id: { x, z,
   state, seat, hidden } }, the playmates, whom matemind.js moves) }
   returns { poses: { id: { x, y, z, face, action, mag, walkT, prop, hidden, held, pet } }, pops: [{ id, text }],
   sounds: [{ id, name, species }] }.
   Rules: a character talked to stops, faces her and resumes 2 s after; nobody starts a routine while busy; actors
   further than NEAR from her stand still; at most cap actors do a routine at once; a held actor (Mimi on her visit)
   waits at home and goes back to its spot when released. Walking asks blocked(x, z, r); a character may stand on its
   own home spot, which is a circle in the layout's obstacles. */
(function (root) {
  'use strict';
  var node = typeof module !== 'undefined' && module.exports;
  var Data = node ? require('./lifedata.js') : root.World3D.LifeData;

  var NEAR = 40, CAP = 12, R_CHAR = 0.5, R_PET = 0.35;
  var CHAR_SPEED = 1.8, FLY_SPEED = 3, FLY_H = 2.4, ARRIVE = 0.25, STUCK = 1.5;
  var REST = [1.5, 3.5], PET_REST = [0.8, 2], TALK_RESUME = 2, LANE_W = 2.6;
  var WAVE_R = 5, WAVE_COOL = 40;
  var FOLLOW_NEAR = 1.8, FOLLOW_FAR = 3.6, PET_WALK = 3.4, PET_RUN = 7, RUN_FROM = 9, JUMP = 25, SIDE = 2.4, LOOK_R = 7;
  var NAP_AFTER = 12, GREET_R = 4, WAVING_R = 9, GREET_COOL = 30, PLAY_R = 3.5, PLAY_COOL = 40;
  var STARTLE_R = 2.8, STARTLE_SPEED = 5, SPRINT_SPEED = 12, STARTLE_COOL = 5, STARTLE_TIME = 0.6, STARTLE_RUN = 5;

  // rand: Math.random unless a test passes its own.
  // o = { actors (lifedata.build), blocked(x, z, r), rand, cap }
  function create(o) {
    var rand = o.rand || Math.random, blocked = o.blocked || function () { return false; }, cap = o.cap || CAP;
    var t = 0, ctx = null, pops = [], sounds = [], sources = [], byId = {};
    var actors = o.actors.map(function (d) {
      var a = {
        def: d, x: d.home ? d.home.x : 0, z: d.home ? d.home.z : 0, y: 0, face: d.face || 0, state: 'rest', timer: 0.5 + rand() * 2,
        action: 'idle', prop: null, speed: 0, still: 0, walkT: 0, stuck: 0, target: null, route: [], homing: false, rt: null, last: null,
        stepI: 0, step: null, held: false, hidden: false, placed: !d.pet, loose: false, seen: false, own: null,
        greetAt: 0, playAt: 0, startleAt: 0, waveAt: 0, legX: 0, legZ: 0, sx: 0, sz: 0, gated: false
      };
      byId[d.id] = a;
      return a;
    });

    function between(range) { return range[0] + rand() * (range[1] - range[0]); }
    function dist(a, p) { return Math.hypot(a.x - p.x, a.z - p.z); }
    function toward(a, p) { return Math.atan2(p.x - a.x, p.z - a.z); }
    function far(a, p, r) { return dist(a, p) > (r === undefined ? 0.6 : r); }

    function busyCount() {
      var n = 0;
      actors.forEach(function (a) { if (!a.def.external && !a.held && (a.state === 'walk' || a.state === 'do') && gateDist(a) <= NEAR) n++; });
      return n;
    }

    // Keeps a point out of the lane between her and the camera, where a character would fill the view.
    function inLane(x, z) {
      var cam = ctx.cam;
      if (!cam) return false;
      var dx = cam.x - ctx.x, dz = cam.z - ctx.z, len2 = dx * dx + dz * dz;
      if (len2 < 1e-6) return false;
      var k = Math.max(0, Math.min(1, ((x - ctx.x) * dx + (z - ctx.z) * dz) / len2));
      return Math.hypot(x - (ctx.x + dx * k), z - (ctx.z + dz * k)) < LANE_W / 2;
    }

    function free(a, x, z) {
      var d = a.def;
      if (d.pet) return a.loose || !blocked(x, z, R_PET);
      var fromHome = Math.hypot(x - d.home.x, z - d.home.z);
      if (fromHome > d.leash + 0.3) return false;
      if (d.fly) return true;
      if (d.homeR && fromHome <= d.homeR + R_CHAR) return true;
      return !blocked(x, z, R_CHAR);
    }

    function anchor(a) { return a.def.pet ? a.own : a.def.home; }

    function pickPoint(a) {
      var c = anchor(a), lo = a.def.pet ? 1 : 0.8, hi = a.def.pet ? FOLLOW_FAR - 0.4 : a.def.leash;
      for (var i = 0; i < 10; i++) {
        var ang = rand() * Math.PI * 2, d = lo + rand() * (hi - lo), x = c.x + Math.sin(ang) * d, z = c.z + Math.cos(ang) * d;
        if (free(a, x, z) && !inLane(x, z)) return { x: x, z: z };
      }
      return null;
    }

    function setTarget(a, p) {
      a.target = p;
      a.legX = a.x;
      a.legZ = a.z;
      a.stuck = 0;
    }
    function goTo(a, p) {
      setTarget(a, p);
      a.state = 'walk';
      a.action = 'walk';
      a.prop = null;
    }

    // Steps toward (tx, tz), sliding round whatever is in the way; true when there.
    function walk(a, tx, tz, speed, dt) {
      var dx = tx - a.x, dz = tz - a.z, d = Math.hypot(dx, dz);
      if (d <= ARRIVE) {
        a.speed = 0;
        return true;
      }
      var len = Math.min(d, speed * dt), base = Math.atan2(dx, dz), turns = [0, 0.7, -0.7, 1.4, -1.4];
      for (var i = 0; i < turns.length; i++) {
        var ang = base + turns[i], nx = a.x + Math.sin(ang) * len, nz = a.z + Math.cos(ang) * len;
        if (free(a, nx, nz)) {
          a.speed = len / dt;
          a.x = nx;
          a.z = nz;
          a.face = ang;
          a.walkT += dt * speed * 0.5;
          a.stuck = 0;
          return false;
        }
      }
      a.speed = 0;
      a.stuck += dt;
      return false;
    }

    function rest(a) {
      a.state = 'rest';
      a.timer = between(a.def.pet ? PET_REST : REST);
      a.action = 'idle';
      a.prop = null;
      a.speed = 0;
      a.rt = null;
    }

    function enter(a) {
      var st = a.rt.steps[a.stepI];
      a.step = { t: 0, len: between(st.len) };
      a.state = 'do';
      a.action = st.action;
      a.prop = st.prop || null;
      a.speed = 0;
      if (st.pop) pops.push({ id: a.def.id, text: st.pop });
      if (st.voice) sounds.push({ id: a.def.id, name: 'voice', species: a.def.species });
    }
    function beginSteps(a) {
      a.stepI = 0;
      enter(a);
    }
    function nextStep(a) {
      a.stepI++;
      if (a.stepI < a.rt.steps.length) return enter(a);
      a.prop = null;
      if (!a.def.pet && far(a, a.def.home)) {
        a.homing = true;
        goTo(a, a.def.home);
        return;
      }
      rest(a);
    }

    function run(a, id) {
      var table = a.def.pet ? Data.PET_ROUTINES : Data.CHAR_ROUTINES, rt = table[id];
      a.last = id;
      a.rt = rt;
      a.route = [];
      a.homing = false;
      if (rt.move === 'home' && !a.def.pet && far(a, a.def.home)) return goTo(a, a.def.home);
      if (rt.move === 'wander') {
        var p = pickPoint(a);
        if (p) return goTo(a, p);
      }
      if (rt.move === 'route') {
        var pts = (a.def.route || []).filter(function (q) { return free(a, q.x, q.z); });
        if (pts.length) {
          a.route = pts.slice(1);
          return goTo(a, pts[0]);
        }
      }
      beginSteps(a);
    }

    function pickDifferent(list, last) {
      var pool = list.filter(function (id) { return id !== last; });
      pool = pool.length ? pool : list;
      return pool[Math.min(pool.length - 1, Math.floor(rand() * pool.length))];
    }

    function startNext(a) {
      if (busyCount() >= cap) {
        a.timer = 1;
        return;
      }
      if (a.def.pet) return startPet(a);
      if (far(a, a.def.home)) {
        a.homing = true;
        return goTo(a, a.def.home);
      }
      run(a, pickDifferent(a.def.routines, a.last));
    }

    function runStates(a, dt, speed) {
      if (a.state === 'rest') {
        a.speed = 0;
        a.action = 'idle';
        if (ctx.busy) return;
        a.timer -= dt;
        if (a.timer <= 0) startNext(a);
      } else if (a.state === 'walk') {
        a.action = 'walk';
        if (walk(a, a.target.x, a.target.z, speed, dt)) {
          if (a.route.length) setTarget(a, a.route.shift());
          else if (a.homing) {
            a.homing = false;
            rest(a);
          } else beginSteps(a);
        } else if (a.stuck > STUCK) {
          a.homing = false;
          a.route = [];
          rest(a);
        }
      } else if (a.state === 'do') {
        a.speed = 0;
        a.step.t += dt;
        if (a.step.t >= a.step.len) nextStep(a);
      }
    }

    function charTick(a, dt) {
      var d = a.def;
      if (ctx.talkingTo === d.id) {
        a.state = 'talk';
        a.action = 'idle';
        a.prop = null;
        a.speed = 0;
        a.rt = null;
        a.homing = false;
        a.face = toward(a, ctx);
        if (d.fly) a.y += (0 - a.y) * Math.min(1, dt * 6);
        return;
      }
      if (a.state === 'talk') {
        rest(a);
        a.timer = TALK_RESUME;
      }
      if (a.state === 'rest' && !ctx.busy && d.waves && t >= a.waveAt && Math.hypot(ctx.x - a.x, ctx.z - a.z) <= WAVE_R) {
        a.waveAt = t + WAVE_COOL;
        a.face = toward(a, ctx);
        run(a, 'wave');
        return;
      }
      runStates(a, dt, d.fly ? FLY_SPEED : CHAR_SPEED);
      if (d.fly) {
        var want = 0;
        if (a.state === 'walk') {
          want = FLY_H * Math.min(1, Math.hypot(a.x - a.legX, a.z - a.legZ) / 1.5, Math.hypot(a.target.x - a.x, a.target.z - a.z) / 1.5);
        } else if (a.state === 'do' && a.action === 'hover') want = FLY_H * 0.8;
        a.y += (want - a.y) * Math.min(1, dt * 6);
      }
    }

    function ownerOf(a) {
      var b = byId[a.def.owner];
      if (!b) return null;
      if (b.def.external) {
        var s = ctx.owners && ctx.owners[b.def.id];
        return s ? { x: s.x, z: s.z, state: s.state, seat: !!s.seat, hidden: !!s.hidden, still: b.still } : null;
      }
      return { x: b.def.fly ? b.def.home.x : b.x, z: b.def.fly ? b.def.home.z : b.z, state: 'idle', seat: false, hidden: b.hidden, still: b.still };
    }

    function spawn(a, own) {
      a.placed = true;
      a.loose = false;
      a.state = 'rest';
      a.timer = 0.5;
      a.action = 'idle';
      a.prop = null;
      a.rt = null;
      a.speed = 0;
      for (var i = 0; i < 20; i++) {
        var ang = rand() * Math.PI * 2, r = FOLLOW_NEAR + rand() * 1.4, x = own.x + Math.sin(ang) * r, z = own.z + Math.cos(ang) * r;
        if (!blocked(x, z, R_PET)) {
          a.x = x;
          a.z = z;
          return;
        }
      }
      a.x = own.x;
      a.z = own.z;
      a.loose = true;
    }

    // A pet of another owner, close and resting, who may play too.
    function playMate(a) {
      for (var i = 0; i < actors.length; i++) {
        var b = actors[i];
        if (b === a || !b.def.pet || b.def.owner === a.def.owner || !b.placed || b.hidden || b.state !== 'rest') continue;
        if (t >= a.playAt && t >= b.playAt && dist(a, b) <= PLAY_R) return b;
      }
      return null;
    }

    function startPet(a) {
      var d = a.def, herD = Math.hypot(ctx.x - a.x, ctx.z - a.z), mate = playMate(a);
      if (t >= a.greetAt && (herD <= GREET_R || (ctx.waving && herD <= WAVING_R))) {
        a.greetAt = t + GREET_COOL;
        a.face = toward(a, ctx);
        return run(a, 'greet');
      }
      if (mate) {
        a.playAt = mate.playAt = t + PLAY_COOL;
        a.face = toward(a, mate);
        mate.face = toward(mate, a);
        run(mate, 'play');
        return run(a, 'play');
      }
      if (a.own.still >= NAP_AFTER && rand() < 0.7) return run(a, 'nap');
      run(a, pickDifferent(Data.SPECIES[d.species].concat('sit'), a.last));
    }

    // Someone else running (or her sprinting) close by: a hop away, or a turtle's shell.
    function startled(a) {
      if (t < a.startleAt) return false;
      for (var i = 0; i < sources.length; i++) {
        var s = sources[i];
        if (s.id === a.def.owner || Math.hypot(s.x - a.x, s.z - a.z) > STARTLE_R) continue;
        a.startleAt = t + STARTLE_COOL;
        if (a.def.species === 'turtle') {
          run(a, 'shell');
          return true;
        }
        var dx = a.x - s.x, dz = a.z - s.z, dl = Math.hypot(dx, dz) || 1;
        a.sx = dx / dl;
        a.sz = dz / dl;
        a.state = 'startle';
        a.timer = STARTLE_TIME;
        a.prop = null;
        a.rt = null;
        pops.push({ id: a.def.id, text: '❗' });
        return true;
      }
      return false;
    }

    function petTick(a, dt) {
      var d = a.def, own = ownerOf(a);
      if (!own) {
        a.hidden = true;
        return;
      }
      a.own = own;
      a.hidden = own.hidden;
      if (!a.placed || far(a, own, JUMP)) spawn(a, own);
      var gap = Math.hypot(own.x - a.x, own.z - a.z), speed = PET_WALK * (Data.PET_SPEED[d.species] || 1);

      if (a.state === 'startle') {
        a.action = 'hop';
        a.timer -= dt;
        var nx = a.x + a.sx * STARTLE_RUN * dt, nz = a.z + a.sz * STARTLE_RUN * dt;
        if (free(a, nx, nz)) {
          a.x = nx;
          a.z = nz;
        }
        a.speed = STARTLE_RUN;
        if (a.timer <= 0) rest(a);
        return;
      }

      if (own.seat || own.state === 'ride' || own.state === 'join' || own.state === 'game') {
        if (a.state !== 'wait') {
          a.state = 'wait';
          a.speed = 0;
          a.prop = null;
          a.rt = null;
          if (own.state !== 'game') pops.push({ id: d.id, text: '🎉' });
        }
        a.action = 'sit';
        a.face = toward(a, own);
        return;
      }
      if (a.state === 'wait') rest(a);

      var talking = ctx.talkingTo === d.owner, stop = talking ? SIDE : FOLLOW_NEAR, limit = talking ? SIDE + 0.5 : FOLLOW_FAR;
      if (gap > limit && a.state !== 'follow') {
        a.state = 'follow';
        a.prop = null;
        a.rt = null;
        a.homing = false;
      }
      if (a.state === 'follow') {
        a.action = 'walk';
        var k = gap > 0 ? stop / gap : 0;
        if (gap <= stop + 0.3) {
          rest(a);
          a.timer = 0.3;
        } else if (walk(a, own.x + (a.x - own.x) * k, own.z + (a.z - own.z) * k, gap > RUN_FROM ? PET_RUN : speed, dt)) {
          rest(a);
          a.timer = 0.3;
        } else if (a.stuck > STUCK) spawn(a, own);
        return;
      }
      if (talking) {
        a.state = 'side';
        a.action = 'sit';
        a.speed = 0;
        a.face = toward(a, ctx);
        return;
      }
      if (a.state === 'side') rest(a);

      if (startled(a)) return;
      if (a.state === 'rest' && Math.hypot(ctx.x - a.x, ctx.z - a.z) <= LOOK_R) a.face = toward(a, ctx);
      runStates(a, dt, speed);
    }

    function track(a, dt) {
      var s = ctx.owners && ctx.owners[a.def.id];
      if (!s) {
        a.speed = 0;
        return;
      }
      a.speed = a.seen && dt > 0 ? Math.hypot(s.x - a.x, s.z - a.z) / dt : 0;
      a.still = a.speed < 0.3 ? a.still + dt : 0;
      a.x = s.x;
      a.z = s.z;
      a.seen = true;
    }

    function hold(a) {
      a.held = true;
      a.gated = false;
      a.state = 'rest';
      a.timer = 1;
      a.action = 'idle';
      a.prop = null;
      a.speed = 0;
      a.rt = null;
      a.homing = false;
      a.x = a.def.home.x;
      a.z = a.def.home.z;
      a.y = 0;
      a.face = a.def.face || 0;
    }
    function release(a) {
      a.held = false;
      a.x = a.def.home.x;
      a.z = a.def.home.z;
      a.face = a.def.face || 0;
      rest(a);
    }

    function gateDist(a) {
      var p = a;
      if (a.def.pet) p = byId[a.def.owner] || a;
      return Math.hypot(ctx.x - p.x, ctx.z - p.z);
    }

    function pose(a) {
      return { id: a.def.id, x: a.x, y: a.y, z: a.z, face: a.face, action: a.gated ? 'idle' : a.action, mag: !a.gated && a.speed > 0.1 ? 1 : 0,
        walkT: a.walkT, prop: a.prop, hidden: a.hidden || !a.placed, held: a.held, pet: !!a.def.pet, talk: a.state === 'talk' };
    }

    function tick(dt, c) {
      ctx = c;
      t += dt;
      pops = [];
      sounds = [];
      sources = [];
      if (c.sprint) sources.push({ id: 'her', x: c.x, z: c.z, speed: SPRINT_SPEED });
      actors.forEach(function (a) {
        if (!a.def.external) return;
        track(a, dt);
        if (a.speed > STARTLE_SPEED) sources.push({ id: a.def.id, x: a.x, z: a.z, speed: a.speed });
      });
      [false, true].forEach(function (pets) {
        actors.forEach(function (a) {
          if (a.def.external || !!a.def.pet !== pets) return;
          if (c.hold && c.hold[a.def.id]) {
            hold(a);
            return;
          }
          if (a.held) release(a);
          a.gated = gateDist(a) > NEAR;
          if (a.gated) {
            if (pets && !a.placed) {
              var own = ownerOf(a);
              if (own) spawn(a, own);
            }
            return;
          }
          if (pets) petTick(a, dt);
          else charTick(a, dt);
          a.still = a.speed < 0.3 ? a.still + dt : 0;
        });
      });
      var poses = {};
      actors.forEach(function (a) { if (!a.def.external) poses[a.def.id] = pose(a); });
      return { poses: poses, pops: pops, sounds: sounds };
    }

    function snapHome(id, fx, fz) {
      var a = byId[id];
      if (!a || a.def.pet || a.def.external || !a.def.home) return null;
      rest(a);
      a.x = a.def.home.x;
      a.z = a.def.home.z;
      a.y = 0;
      a.face = toward(a, { x: fx, z: fz });
      return pose(a);
    }

    return {
      tick: tick,
      snapHome: snapHome,
      list: function () {
        return actors.filter(function (a) { return !a.def.external; }).map(function (a) {
          return { id: a.def.id, x: a.x, z: a.z, state: a.state, action: a.action, owner: a.def.owner || null, pet: !!a.def.pet };
        });
      }
    };
  }

  var exported = { create: create, NEAR: NEAR, CAP: CAP };
  if (node) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.Routines = exported;
})(this);
