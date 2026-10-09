/* What each playground kid does (playmates part 1): stand and wave, wander, walk or run to a ride, wait their turn,
   ride (mateboard.js says where they sit), come and ride with her, follow her when invited, stop to talk, cheer after
   a ride, and, given ways (Layout.walkways), go out along the paths to the other places (gate, plaza, street, garden,
   shop, park, house), hang out there and come back. Pure: steering asks blocked(x, z, r); without ways the kids stay
   inside the playground circle. tick(dt, her) with
   her = { x, z, now (play.js now()), cam ({ x, z } of the camera, optional) } returns { pops: [{ kid, text }],
   sounds: [name] }. Standing kids keep out of her way: they step back a little when closer than SPACE (staying in
   talking reach), and, when cam is given, out of the lane between her and the camera and away from the camera
   itself, where even a kid off to the side would fill the view. */
(function (root) {
  'use strict';
  var node = typeof module !== 'undefined' && module.exports;
  var Board = node ? require('./mateboard.js') : root.World3D.MateBoard;

  var WALK = 3, RUN = 5.5, NEAR = 0.5, KID_R = 0.7, JOIN_R = 16, GAP = 2.4, INVITE_TIME = 60, CHEER_TIME = 2.5;
  var WAIT_TIME = 8, STUCK_TIME = 2, WAVE_R = 5, POP_EVERY = 2.5, LEAVE_R = 4;
  var SPACE = 1.5, BACK = 2, LANE_W = 2.6, CAM_R = 7, HOME_R = 0.75, BESIDE = 3, HERS_R = 5;
  // Going out: how often a kid at the playground heads somewhere else, a kid elsewhere stays to wander (resting about
  // LINGER seconds at each spot), and an outing goes back to the playground. An outing goes to the place she is in
  // PULL of the time, while fewer than CROWD kids are there, so she meets kids wherever she plays. A follower further
  // than FOLLOW_JUMP (she sprinted or travelled) pops in beside her.
  var GO_OUT = 0.25, STAY = 0.75, GO_BACK = 0.4, FOLLOW_JUMP = 25, LINGER = 6, PULL = 0.4, CROWD = 4;
  var JOIN = { slide: 1, swings: 1, seesaw: 1, merry: 3 };
  var RIDES = ['slide', 'swings', 'seesaw', 'merry'];
  var POPS = ['😄', '🎉', '⭐'];
  var TURNS = [0.6, 1.2, 1.8, 2.4];

  // o = { pr, ends, boards (Layout.rideSpots), area { x, z, r }, kids [{ id, fav, racer }], blocked(x, z, r), rand,
  //       ways (Layout.walkways, optional) }
  function create(o) {
    var rand = o.rand, area = o.area, ways = o.ways || null, board = Board.create(o.pr, o.ends, rand), spots = {}, herNow = null, lineNow = null;
    o.boards.forEach(function (b) { spots[b.id] = b; });

    function index(n) { return Math.min(n - 1, Math.floor(rand() * n)); }
    function inside(x, z, margin) { return Math.hypot(x - area.x, z - area.z) <= area.r - margin; }
    // Where a kid may stand: anywhere free when they can go out, otherwise only inside the playground.
    function open(x, z) { return (ways || inside(x, z, 1)) && !o.blocked(x, z, KID_R); }

    // A free spot inside the playground about r from the middle, starting at angle a.
    function spotAt(a, r) {
      for (var i = 0; i < 12; i++) {
        var b = a + i * 0.5, x = area.x + Math.sin(b) * r, z = area.z + Math.cos(b) * r;
        if (inside(x, z, 1) && open(x, z)) return { x: x, z: z };
      }
      return { x: area.x, z: area.z };
    }

    // The hangout (x, z) is in, or null on the way between them.
    function hangoutAt(x, z) {
      if (inside(x, z, 0)) return ways ? ways.hangouts[0] : null;
      if (!ways) return null;
      for (var i = 1; i < ways.hangouts.length; i++) {
        var h = ways.hangouts[i];
        if (h.r ? Math.hypot(x - h.x, z - h.z) <= h.r + 2 : Math.abs(x - h.x) <= h.hx + 2 && Math.abs(z - h.z) <= h.hz + 2) return h;
      }
      return null;
    }

    // A free spot in hangout h, out of her way when it can be.
    function spotIn(h) {
      for (var i = 0; i < 12; i++) {
        var x, z;
        if (h.r) {
          var a = rand() * Math.PI * 2, d = h.r * Math.sqrt(rand());
          x = h.x + Math.sin(a) * d;
          z = h.z + Math.cos(a) * d;
        } else {
          x = h.x + (rand() * 2 - 1) * h.hx;
          z = h.z + (rand() * 2 - 1) * h.hz;
        }
        if (open(x, z) && !(herNow && inWay(x, z, herNow, lineNow))) return { x: x, z: z };
      }
      var n = ways.nodes[h.node];
      return { x: n.x, z: n.z };
    }

    function nearestNode(x, z) {
      var best = null, bestD = Infinity;
      Object.keys(ways.nodes).forEach(function (id) {
        var n = ways.nodes[id], d = Math.hypot(n.x - x, n.z - z);
        if (id !== ways.hub && d < bestD) { best = id; bestD = d; }
      });
      return best;
    }

    // The path points from node a to node b: up to the point they share, then down, skipping the hub.
    function route(a, b) {
      function chain(id) { for (var out = []; id; id = ways.nodes[id].up) out.push(id); return out; }
      var up = chain(a), down = chain(b);
      while (up.length > 1 && down.length > 1 && up[up.length - 2] === down[down.length - 2]) {
        up.pop();
        down.pop();
      }
      down.pop();
      return up.concat(down.reverse()).filter(function (id) { return id !== ways.hub; })
        .map(function (id) { return { x: ways.nodes[id].x, z: ways.nodes[id].z }; });
    }

    // Off along the paths to a spot in hangout h.
    function outing(k, h) {
      var pts = route(nearestNode(k.x, k.z), h.node).concat([spotIn(h)]), first = pts.shift();
      goTo(k, 'walk', first.x, first.z, null);
      k.path = pts;
      k.goal = h;
    }

    var kids = o.kids.map(function (k, n) {
      var a = n / o.kids.length * Math.PI * 2, home = spotAt(a, area.r * HOME_R);
      return {
        id: k.id, fav: k.fav, racer: !!k.racer, home: home, x: home.x, z: home.z, face: a + Math.PI,
        state: 'idle', timer: 0.5 + rand() * 2, target: null, path: [], ride: null, invite: null,
        walkT: 0, mag: 0, stuck: 0, side: 0, pop: rand() * POP_EVERY, wave: false
      };
    });
    var byId = {};
    kids.forEach(function (k) { byId[k.id] = k; });

    function idle(k, time) {
      k.state = 'idle';
      k.timer = time === undefined ? 1 + rand() * 3 : time;
      k.target = null;
      k.path = [];
      k.ride = null;
      k.mag = 0;
    }

    function goTo(k, state, x, z, ride) {
      k.state = state;
      k.hurry = false;
      k.path = [];
      k.target = { x: x, z: z };
      k.ride = ride || null;
      k.stuck = 0;
    }

    function goRide(k, id, state) {
      var s = spots[id];
      goTo(k, state || 'walk', s.x + (rand() - 0.5), s.z + (rand() - 0.5) * 0.6, id);
    }

    // What an idle kid does next: a ride (their favourite half the time), a partner for a kid waiting alone on the
    // see-saw, or a wander.
    // A ride she is on or standing at is hers: kids only come to it when she invites them or starts it. A ride whose
    // spot is in her way is left alone too, so nobody walks across her view to reach it.
    function hers(id) {
      if (board.herRide() === id || !herNow) return board.herRide() === id;
      return Math.hypot(spots[id].x - herNow.x, spots[id].z - herNow.z) < HERS_R || inWay(spots[id].x, spots[id].z, herNow, lineNow);
    }

    // Out of the playground: wander where they are, or go to another place (often back to the playground).
    function choose(k) {
      var here = hangoutAt(k.x, k.z);
      if (ways && (!here || here.node !== 'playground')) {
        if (here && rand() < STAY) {
          var p = spotIn(here);
          return goTo(k, 'walk', p.x, p.z, null);
        }
        var others = ways.hangouts.filter(function (h) { return h !== here && h.node !== 'playground'; });
        return outing(k, toHer(here) || (rand() < GO_BACK || !others.length ? ways.hangouts[0] : others[index(others.length)]));
      }
      if (ways) {
        var hers = toHer(ways.hangouts[0]);
        if (hers || rand() < GO_OUT) return outing(k, hers || ways.hangouts[1 + index(ways.hangouts.length - 1)]);
      }
      playground(k);
    }

    // The place she is in, when a kid from elsewhere (not from here) should come over; otherwise null.
    function toHer(here) {
      var h = herNow && hangoutAt(herNow.x, herNow.z);
      if (!h || h === here || rand() >= PULL) return null;
      var there = kids.filter(function (k) { return hangoutAt(k.x, k.z) === h || k.path.length && k.goal === h; }).length;
      return there < CROWD ? h : null;
    }

    function playground(k) {
      if (waitingAlone() && !hers('seesaw') && rand() < 0.7) return goRide(k, 'seesaw');
      if (rand() < 0.65) {
        var id = rand() < 0.5 ? k.fav : RIDES[index(RIDES.length)];
        if (!hers(id)) return goRide(k, id);
      }
      for (var i = 0; i < 6; i++) {
        var p = spotAt(rand() * Math.PI * 2, area.r * (0.3 + rand() * 0.5));
        if (!herNow || !inWay(p.x, p.z, herNow, lineNow)) return goTo(k, 'walk', p.x, p.z, null);
      }
      idle(k);
    }

    function waitingAlone() {
      return !board.herRide() && board.friends('seesaw') === 0 && kids.some(function (k) {
        var s = board.seatOf(k.id);
        return s && s.id === 'seesaw' && !board.moving(k.id);
      });
    }

    // The turns to try, straight on first: once a kid turns one way round a prop they keep to that side until the
    // straight step is free again, so they go round it instead of swinging back and forth.
    function turns(side) {
      if (side) return [0].concat(TURNS.map(function (t) { return t * side; }), TURNS.map(function (t) { return -t * side; }));
      var out = [0];
      TURNS.forEach(function (t) { out.push(t, -t); });
      return out;
    }

    // One step toward the target, round props; true on arrival.
    // avoid: never step into her way (the camera lane, her toes, the camera) from outside it.
    function step(k, dt, speed, avoid) {
      var guard = avoid && !!herNow && !inWay(k.x, k.z, herNow, lineNow);
      var dx = k.target.x - k.x, dz = k.target.z - k.z, d = Math.hypot(dx, dz);
      if (d <= NEAR) {
        k.mag = 0;
        return true;
      }
      var len = Math.min(d, speed * dt), base = Math.atan2(dx, dz), list = turns(k.side);
      for (var i = 0; i < list.length; i++) {
        var a = base + list[i], nx = k.x + Math.sin(a) * len, nz = k.z + Math.cos(a) * len;
        if (!o.blocked(nx, nz, KID_R) && !(guard && inWay(nx, nz, herNow, lineNow))) {
          k.side = list[i] === 0 ? 0 : k.side || (list[i] > 0 ? 1 : -1);
          k.x = nx;
          k.z = nz;
          k.face = a;
          k.mag = speed / RUN;
          k.walkT += len * 1.6;
          k.stuck = 0;
          return false;
        }
      }
      k.mag = 0;
      k.stuck += dt;
      return false;
    }

    // The timer counts how long a seated kid has waited for the ride to start.
    function seated(k) {
      k.state = 'ride';
      k.mag = 0;
      k.timer = 0;
    }

    // On to the next path point of an outing.
    function next(k) {
      k.target = k.path.shift();
      k.stuck = 0;
      k.side = 0;
    }

    // Out of the playground a kid lingers longer at each spot, so they are easy to meet there.
    function arrive(k) {
      if (!k.ride) return idle(k, ways && !inside(k.x, k.z, 0) ? LINGER * (0.5 + rand()) : undefined);
      if (board.claim(k.id, k.ride) >= 0) return seated(k);
      if (k.state === 'join' || k.ride === 'slide') {
        k.state = 'wait';
        k.timer = WAIT_TIME;
        return;
      }
      idle(k);
    }

    // She got on ride id: friends come, an invited one first, then kids who love that ride, then the nearest.
    function joiners(id, her) {
      var need = Math.max(0, JOIN[id] - board.friends(id));
      kids.filter(function (k) {
        return !board.seatOf(k.id) && k.state !== 'talk' && (k.invite || Math.hypot(k.x - her.x, k.z - her.z) <= JOIN_R);
      }).sort(function (a, b) {
        return (b.invite ? 2 : 0) + (b.fav === id ? 1 : 0) - (a.invite ? 2 : 0) - (a.fav === id ? 1 : 0)
          || Math.hypot(a.x - her.x, a.z - her.z) - Math.hypot(b.x - her.x, b.z - her.z);
      }).slice(0, need).forEach(function (k) { goRide(k, id, 'join'); });
    }

    function landed(k, end, out, said) {
      k.x = end.x;
      k.z = end.z;
      k.face = end.face || 0;
      k.state = 'cheer';
      k.timer = CHEER_TIME;
      k.invite = null;
      k.target = null;
      k.ride = null;
      if (said) out.pops.push({ kid: k.id, text: said });
    }

    // The camera's line to her: { fx, fz } from her toward the camera and its length, or null without a camera.
    function camLine(her) {
      if (!her.cam) return null;
      var cx = her.cam.x - her.x, cz = her.cam.z - her.z, len = Math.hypot(cx, cz);
      return len < 0.01 ? null : { fx: cx / len, fz: cz / len, len: len };
    }

    // True when a kid standing at (x, z) would be in the way: on top of her, between her and the camera, or close to
    // the camera.
    function inWay(x, z, her, line) {
      var dx = x - her.x, dz = z - her.z;
      if (Math.hypot(dx, dz) < SPACE) return true;
      if (!line) return false;
      var along = dx * line.fx + dz * line.fz, side = dx * line.fz - dz * line.fx;
      if (along > -1 && along < line.len && Math.abs(side) < LANE_W) return true;
      return Math.hypot(x - her.cam.x, z - her.cam.z) < CAM_R;
    }

    // Where a standing kid should step to so they are out of her way; null when they are fine where they are. Out of
    // the lane they keep their own side (the other side if theirs is blocked), nearer her than the camera.
    function aside(k, her) {
      var line = camLine(her);
      if (!inWay(k.x, k.z, her, line)) return null;
      var dx = k.x - her.x, dz = k.z - her.z, d = Math.hypot(dx, dz), ux = d > 0.01 ? dx / d : 1, uz = d > 0.01 ? dz / d : 0;
      // A kid who is only too close steps straight back, staying in talking reach.
      var tries = [{ x: her.x + ux * BACK, z: her.z + uz * BACK }];
      if (line) {
        var along = dx * line.fx + dz * line.fz, side = dx * line.fz - dz * line.fx, s = side < 0 ? -1 : 1, off = LANE_W + 1.5;
        [Math.min(Math.max(along, BACK), line.len - CAM_R - 2), BACK, 0].forEach(function (a) {
          [s, -s].forEach(function (q) { tries.push({ x: her.x + line.fx * a + line.fz * q * off, z: her.z + line.fz * a - line.fx * q * off }); });
        });
      }
      for (var i = 0; i < tries.length; i++) {
        if (open(tries[i].x, tries[i].z) && !inWay(tries[i].x, tries[i].z, her, line)) return tries[i];
      }
      return null;
    }

    function tick(dt, her) {
      herNow = her;
      lineNow = camLine(her);
      var out = { pops: [], sounds: [] };
      board.tick(dt, her.now).forEach(function (e) {
        if (e.type === 'land') landed(byId[e.kid], e.end, out, null);
        else if (e.type === 'start') {
          e.bumped.forEach(function (b) { landed(byId[b.kid], b.end, out, 'yourTurn'); });
          joiners(e.id, her);
        }
      });
      var gone = !ways && !inside(her.x, her.z, -LEAVE_R);
      kids.forEach(function (k) {
        // A kid in a game (mategame.js) is moved by the game, not here.
        if (k.state === 'game') return;
        var near = Math.hypot(k.x - her.x, k.z - her.z);
        k.wave = false;
        if (board.seatOf(k.id)) {
          k.state = 'ride';
          if (board.moving(k.id)) {
            k.pop -= dt;
            if (k.pop <= 0) {
              k.pop = POP_EVERY + rand() * 2;
              out.pops.push({ kid: k.id, text: POPS[index(POPS.length)] });
              if (rand() < 0.3) out.sounds.push('mate-giggle');
            }
          } else if ((k.timer -= dt) < -WAIT_TIME) {
            board.leave(k.id);
            idle(k);
          }
          return;
        }
        if (k.invite) {
          k.invite.t -= dt;
          if (k.invite.t <= 0 || gone) {
            k.invite = null;
            if (k.state === 'follow') {
              idle(k, 2);
              out.pops.push({ kid: k.id, text: '👋' });
            }
          }
        }
        var room = (k.state === 'idle' || k.state === 'cheer') ? aside(k, her) : null;
        if (room) {
          goTo(k, 'walk', room.x, room.z, null);
          k.hurry = true;
        }
        if (k.state === 'idle') {
          if (near <= WAVE_R) {
            k.face = Math.atan2(her.x - k.x, her.z - k.z);
            k.wave = true;
          }
          if ((k.timer -= dt) <= 0) choose(k);
        } else if (k.state === 'walk' || k.state === 'join') {
          var speed = k.state === 'join' || k.racer || k.hurry ? RUN : WALK;
          var around = k.state === 'walk' && !inWay(k.target.x, k.target.z, her, lineNow);
          if (step(k, dt, speed, around)) {
            if (k.path.length) next(k);
            else arrive(k);
          } else if (k.stuck > STUCK_TIME) {
            if (k.path.length) next(k);
            else idle(k);
          }
          if (k.state === 'join' && board.herRide() !== k.ride) idle(k);
        } else if (k.state === 'wait') {
          if (board.claim(k.id, k.ride) >= 0) seated(k);
          else if ((k.timer -= dt) <= 0 || (k.ride !== 'slide' && board.herRide() !== k.ride)) idle(k);
        } else if (k.state === 'follow') {
          // Beside her (on the side they are on) rather than behind her, where they would stand in front of the camera.
          var line = camLine(her), far = near > GAP;
          if (near > FOLLOW_JUMP) jump(k, her, line);
          var sd = line && (k.x - her.x) * line.fz - (k.z - her.z) * line.fx < 0 ? -1 : 1, spot = null;
          // Their own side first, the other side when a ride is in the way, or just close by when both are.
          if (line) [sd, -sd].forEach(function (q) {
            var t = { x: her.x + line.fz * q * BESIDE, z: her.z - line.fx * q * BESIDE };
            if (!spot && open(t.x, t.z)) spot = t;
          });
          if (spot) {
            k.target = spot;
            far = Math.hypot(spot.x - k.x, spot.z - k.z) > 1;
          } else k.target = { x: her.x, z: her.z };
          if (far) step(k, dt, RUN);
          else {
            k.mag = 0;
            k.face = Math.atan2(her.x - k.x, her.z - k.z);
          }
        } else if (k.state === 'talk') {
          k.mag = 0;
          k.face = Math.atan2(her.x - k.x, her.z - k.z);
        } else if (k.state === 'cheer') {
          k.mag = 0;
          if ((k.timer -= dt) <= 0) idle(k);
        }
      });
      return out;
    }

    // A follower left far behind (she sprinted or travelled) pops in a little behind her side, out of the camera lane.
    function jump(k, her, line) {
      var fx = line ? line.fx : 0, fz = line ? line.fz : 1;
      [1, -1].some(function (q) {
        var x = her.x + fz * q * BESIDE + fx * 2, z = her.z - fx * q * BESIDE + fz * 2;
        if (!open(x, z)) return false;
        k.x = x;
        k.z = z;
        return true;
      });
    }

    // Each kid's pose this frame, in o.kids order.
    function frames() {
      return kids.map(function (k) {
        var p = board.pose(k.id);
        if (p) return { id: k.id, x: p.x, y: p.y, z: p.z, face: p.face, ride: true, sit: p.sit, cheer: p.cheer, walkT: 0, mag: 0 };
        return {
          id: k.id, x: k.x, y: 0, z: k.z, face: k.face, ride: false, sit: false, cheer: k.state === 'cheer' || !!(k.state === 'game' && k.cheer),
          wave: k.wave, walkT: k.walkT, mag: k.mag, hidden: k.state === 'game' && !!k.hidden
        };
      });
    }

    function talk(id, on) {
      var k = byId[id];
      if (!k) return false;
      if (on) {
        if (board.seatOf(id) || k.state === 'join') return false;
        k.state = 'talk';
        k.target = null;
        k.mag = 0;
        return true;
      }
      if (k.state === 'talk') idle(k, 1);
      return true;
    }

    function invite(id, ride) {
      var k = byId[id];
      if (!k || board.seatOf(id)) return false;
      k.invite = { ride: ride, t: INVITE_TIME };
      k.state = 'follow';
      k.ride = null;
      return true;
    }

    // Playground games (mategame.js): on takes the kid off any ride and out of their plans, off sends them back to them.
    function game(id, on) {
      var k = byId[id];
      if (!k) return false;
      if (on) {
        if (board.seatOf(id)) board.leave(id);
        k.state = 'game';
        k.invite = null;
        k.target = null;
        k.path = [];
        k.ride = null;
        k.mag = 0;
        k.hidden = false;
        k.cheer = false;
        return true;
      }
      k.hidden = false;
      k.cheer = false;
      if (k.state === 'game') idle(k, 1 + rand() * 2);
      return true;
    }
    // A step toward (x, z) at speed for a kid in a game, round props like any walk; true on arrival.
    function move(id, x, z, speed, dt) {
      var k = byId[id];
      if (!k || k.state !== 'game') return false;
      if (!k.target || k.target.x !== x || k.target.z !== z) {
        k.target = { x: x, z: z };
        k.stuck = 0;
      }
      return step(k, dt, speed, false);
    }
    // Sets a kid in a game: where they are (teleport), facing, standing still, hidden or cheering.
    function put(id, p) {
      var k = byId[id];
      if (!k || k.state !== 'game') return false;
      if (p.x !== undefined) { k.x = p.x; k.z = p.z; }
      if (p.face !== undefined) k.face = p.face;
      if (p.still) k.mag = 0;
      if (p.hidden !== undefined) k.hidden = p.hidden;
      if (p.cheer !== undefined) k.cheer = p.cheer;
      return true;
    }
    function where(id) { var k = byId[id]; return k ? { x: k.x, z: k.z, face: k.face, stuck: k.stuck } : null; }

    // Everyone off the rides and standing at home; they stay put until she rides (the e2e uses this).
    function calm() {
      board.clear();
      kids.forEach(function (k) {
        k.x = k.home.x;
        k.z = k.home.z;
        k.invite = null;
        idle(k, 1e9);
      });
    }

    return {
      tick: tick, frames: frames, talk: talk, invite: invite, calm: calm, parts: board.parts, game: game, move: move, put: put, where: where,
      tappable: function () {
        return kids.filter(function (k) { return !board.seatOf(k.id) && k.state !== 'join' && k.state !== 'game'; }).map(function (k) { return { id: k.id, x: k.x, z: k.z }; });
      },
      list: function () {
        return kids.map(function (k) { return { id: k.id, x: k.x, z: k.z, state: k.state, ride: k.ride, seat: board.seatOf(k.id), invited: !!k.invite }; });
      }
    };
  }

  var exported = { create: create, INVITE_TIME: INVITE_TIME, SPACE: SPACE, LANE_W: LANE_W, CAM_R: CAM_R };
  if (node) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.MateMind = exported;
})(this);
