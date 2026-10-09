/* Her pet in the 3D world: drawn from her look (petbody.js), walking beside her or riding on her (shoulder, head or
   arms), with its name above it and a mood bubble. petlife.js keeps its mood and runs one action at a time: a trick
   (pettricks.js), fetch, a toy shown at the stall, a celebration when she is back from a game, or play with her
   sister's pet (lent by kin.js). world-main.js calls set() whenever it dresses her, place() when she jumps somewhere
   and tick() each frame. What the pet does that makes a sound (petlife's heard list) goes to
   o.sfx(name, info, petType, sisterPetType). */
(function (root) {
  'use strict';
  var W = root.World3D = root.World3D || {};
  var SIDE = 1.4, BEHIND = 2.6, PET_R = 0.6, TOY_R = 0.4, ARRIVE = 0.9, CATCH = 2, RUN = 1.6, BUDDY = 0.8;
  var FAR_FETCH = 12, FAR_PLAY = 8, CIRCLE = 1.6, MEET = 1.5, TEACH_HOP = 0.6, TEACH_BUBBLE = '💡';
  // The camera sits right behind her, so a toy thrown straight ahead (and the pet chasing it) hides behind her body;
  // she throws a little to her pet's side instead.
  var THROW_TURN = 0.5;

  // o = { S, canvas, blocked(x, z, r), sparkle(x, z), hearts(x, y, z), cheer(x, y, z), sound(name),
  //       sister(x, z) → kin.petNear's handle on her sister's pet near (x, z), or null }
  function create(o) {
    var S = o.S, THREE = S.THREE, PB = W.PetBody, PT = W.PetTricks, PL = W.PetLife, Walk = W.Walk, Pets = W.Pets;
    var life = PL.create(), pet = null, petType = '', me = null, spot = 'walk', down = false, bubble = null, shown = '', mood = 'idle', tex = {};
    var toy = null, fetch = null, buddy = null, playing = null, now = 0, lastCheer = '', teaching = null, resting = null;
    var ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), v = new THREE.Vector3();

    function emoji(e) { return tex[e] || (tex[e] = S.emoji(e)); }

    function dropToy(sparkle) {
      if (!toy) return;
      if (sparkle) {
        toy.getWorldPosition(v);
        o.sparkle(v.x, v.z);
      }
      if (toy.parent) toy.parent.remove(toy);
      toy = null;
    }
    function freeBuddy() {
      if (buddy) {
        var bp = buddy.pet.group.position;
        if (Math.hypot(bp.x - buddy.x, bp.z - buddy.z) > 0.5) o.sparkle(buddy.x, buddy.z);
        buddy.giveBack();
      }
      buddy = null;
      playing = null;
    }
    function climb() {
      if (!down || !pet || resting) return;
      down = false;
      PB.mount(pet, me, spot);
    }
    // Ends whatever the pet is doing and puts everything back.
    function stop() {
      dropToy(!!fetch);
      freeBuddy();
      fetch = null;
      if (life.action) PL.cancel(life);
      climb();
    }

    // l: a look already through Pets.wearable(); ch: her character.
    function set(l, ch) {
      if (pet) {
        stop();
        if (pet.group.parent) pet.group.parent.remove(pet.group);
        pet.dispose();
        bubble.material.dispose();
      }
      me = ch;
      down = false;
      teaching = null;
      resting = null;
      pet = PB.build(S, l);
      petType = l.pet;
      PB.tag(S, pet, W.Look.petName(l));
      bubble = S.sprite(emoji('💤'), 1.1, 1.1);
      bubble.visible = false;
      bubble.position.set(0, pet.top + 2, 0);
      pet.group.add(bubble);
      shown = '';
      spot = PB.mount(pet, me, l.petSpot) ? l.petSpot : 'walk';
      if (spot === 'walk') S.scene.add(pet.group);
    }

    function beside(her) {
      return {
        x: her.x - Math.sin(her.face) * BEHIND + Math.cos(her.face) * SIDE,
        z: her.z - Math.cos(her.face) * BEHIND - Math.sin(her.face) * SIDE
      };
    }
    function blockedPet(x, z) { return o.blocked(x, z, PET_R); }
    // Beside her if there is room, else where she stands (she always fits there).
    function free(her) {
      var b = beside(her);
      return blockedPet(b.x, b.z) ? { x: her.x, z: her.z } : b;
    }
    function walking() { return spot === 'walk' || down; }

    // A riding pet hops down beside her for fetch.
    function hopDown(her) {
      if (spot === 'walk' || down) return;
      var f = free(her), g = pet.group;
      if (g.parent) g.parent.remove(g);
      g.scale.setScalar(PB.SCALE);
      g.rotation.set(0, 0, 0);
      g.position.set(f.x, 0, f.z);
      S.scene.add(g);
      down = true;
    }

    // pop: she jumped somewhere (quick travel, a door), so the pet pops in beside her with a sparkle.
    function place(her, pop) {
      if (!pet) return;
      if (life.action && life.action.kind !== 'trick') stop();
      if (spot !== 'walk') return;
      var f = free(her);
      pet.group.position.set(f.x, 0, f.z);
      if (pop) o.sparkle(f.x, f.z);
    }

    // At the mirror or a stall the camera looks at her face, so the pet sits in front of her, to one side, facing it.
    function show(her) {
      var p = pet.group.position;
      p.set(her.x + Math.sin(her.face) * 2.2 + Math.cos(her.face) * 2.4, 0, her.z + Math.cos(her.face) * 2.2 - Math.sin(her.face) * 2.4);
      pet.group.lookAt(her.x + Math.sin(her.face) * 18, 0, her.z + Math.cos(her.face) * 18);
    }

    // Moves group g toward (tx, tz) at speed (her walk speed × speed), sliding along walls. True when it moved.
    function run(g, tx, tz, speed, dt) {
      var p = g.position, dir = Walk.toward(p.x, p.z, tx, tz);
      if (!dir) return false;
      dir.mag = speed;
      var n = Walk.step(p.x, p.z, dir, dt, blockedPet), moved = n.x !== p.x || n.z !== p.z;
      p.x = n.x;
      p.z = n.z;
      g.lookAt(tx, 0, tz);
      return moved;
    }
    // Eases group g to (tx, tz) with no walls (play by the gate, an open spot).
    function ease(g, tx, tz, dt) {
      var p = g.position, k = Math.min(1, dt * 8), x = p.x + (tx - p.x) * k, z = p.z + (tz - p.z) * k;
      if (Math.hypot(x - p.x, z - p.z) > 0.01) g.lookAt(x + (x - p.x) * 10, 0, z + (z - p.z) * 10);
      p.x = x;
      p.z = z;
    }

    function follow(dt, her) {
      var p = pet.group.position, b = beside(her), moved = false;
      if (PL.far(Math.hypot(her.x - p.x, her.z - p.z))) {
        var f = free(her);
        p.set(f.x, 0, f.z);
        o.sparkle(f.x, f.z);
      } else {
        var dir = Walk.toward(p.x, p.z, b.x, b.z);
        if (dir) {
          dir.mag = Math.min(1.3, Math.hypot(b.x - p.x, b.z - p.z) / 1.5);
          var n = Walk.step(p.x, p.z, dir, dt, blockedPet);
          moved = n.x !== p.x || n.z !== p.z;
          p.x = n.x;
          p.z = n.z;
        }
      }
      if (Math.hypot(her.x - p.x, her.z - p.z) > 0.5) pet.group.lookAt(her.x, 0, her.z);
      return moved;
    }

    // A trick or a toy from her Play row (world-main checks she owns it). False when the pet is busy.
    function play(id, her) {
      var it = Pets.find(id);
      if (!pet || !it) return false;
      if (it.kind === 'trick') return PL.startTrick(life, it.id, it.len);
      if (it.kind !== 'toy' || !PL.startFetch(life, it)) return false;
      hopDown(her);
      fetch = {
        item: it, from: { x: her.x, z: her.z },
        land: PL.landing(her.x, her.z, her.face + THROW_TURN, it.range, function (x, z) { return o.blocked(x, z, TOY_R); })
      };
      toy = PT.toy(S, it.id);
      toy.position.set(her.x, 2.4, her.z);
      S.scene.add(toy);
      var p = pet.group.position, h = o.sister ? o.sister(p.x, p.z) : null;
      if (h) {
        h.borrow();
        buddy = h;
      }
      return true;
    }

    // Mang Kiko's stall: the pet in front of her shows a trick, or holds a toy and hops. Always plays.
    function demo(id) {
      var it = Pets.find(id);
      if (!pet || !it || (it.kind !== 'trick' && it.kind !== 'toy')) return false;
      stop();
      if (it.kind === 'trick') return PL.startTrick(life, it.id, it.len, true);
      PL.startHold(life, it, true);
      toy = PT.toy(S, it.id);
      PT.hold(pet, toy);
      return true;
    }

    // plan: cheer.js plan(); it starts 1.5 s from now.
    function celebrate(plan) { PL.celebrate(life, plan); }

    // She does a move: the pet watches; a pet in her arms hops down first and climbs back after (tick's stop()).
    // False when the pet is busy: it carries on where it is.
    function watch(her, len) {
      if (!pet || !PL.startWatch(life, len)) return false;
      if (spot === 'arms') hopDown(her);
      return true;
    }
    function unwatch() { if (life.action && life.action.kind === 'watch') stop(); }

    function fetchStep(dt, her, a) {
      var g = pet.group, p = g.position, f = fetch, moved = false;
      if (a.stage === 'throw') {
        var k = Math.min(1, a.t / f.item.flight), arc = f.item.id === 'toy-frisbee' ? 1.2 : 3;
        toy.position.set(f.from.x + (f.land.x - f.from.x) * k, 2.4 * (1 - k) + Math.sin(Math.PI * k) * arc, f.from.z + (f.land.z - f.from.z) * k);
        if (f.item.id === 'toy-frisbee') toy.rotation.y += dt * 12;
      } else if (a.stage === 'run') toy.position.set(f.land.x, 0, f.land.z);
      if (a.stage === 'throw' || a.stage === 'run') {
        moved = run(g, f.land.x, f.land.z, RUN, dt);
        var gap = Math.hypot(toy.position.x - p.x, toy.position.z - p.z);
        if (a.stage === 'run' ? gap < ARRIVE : f.item.id === 'toy-frisbee' && gap < CATCH) {
          PL.arrive(life);
          PT.hold(pet, toy);
        }
      } else if (a.stage === 'back') {
        var b = free(her);
        moved = run(g, b.x, b.z, RUN, dt);
        if (Math.hypot(b.x - p.x, b.z - p.z) < ARRIVE) PL.arrive(life);
      }
      if (buddy) {
        var bg = buddy.pet.group, chase = a.stage === 'throw' || a.stage === 'run';
        var bm = chase ? run(bg, f.land.x, f.land.z, RUN * BUDDY, dt) : run(bg, buddy.x, buddy.z, 1, dt);
        if (!chase && Math.hypot(bg.position.x - buddy.x, bg.position.z - buddy.z) < ARRIVE) freeBuddy();
        else buddy.pet.animate(now, bm ? 'walk' : 'idle');
      }
      return moved;
    }

    // Six seconds of play: both pets run small circles round the spot between them, then meet nose to nose.
    function playStep(dt, a) {
      var c = playing.mid, u = playing.u, g = pet.group, bg = buddy.pet.group;
      if (a.t < a.len - MEET) {
        var ang = a.t * 2.6, cx = Math.cos(ang) * CIRCLE, cz = Math.sin(ang) * CIRCLE;
        ease(g, c.x + cx, c.z + cz, dt);
        ease(bg, c.x - cx, c.z - cz, dt);
        buddy.pet.animate(now, 'walk');
        PT.trick(buddy.pet, 'trick-jump', (a.t % 1.5) / 1.5, false);
        return true;
      }
      ease(g, c.x + u.x * 0.8, c.z + u.z * 0.8, dt);
      ease(bg, c.x - u.x * 0.8, c.z - u.z * 0.8, dt);
      g.lookAt(bg.position.x, 0, bg.position.z);
      bg.lookAt(g.position.x, 0, g.position.z);
      buddy.pet.animate(now, 'idle');
      return false;
    }

    function startPlay(her) {
      if (!o.sister || her.hold || spot !== 'walk' || life.action || !PL.canPlay(life, 0)) return;
      var p = pet.group.position, h = o.sister(p.x, p.z);
      if (!h || !PL.canPlay(life, Math.hypot(h.x - p.x, h.z - p.z)) || !PL.startPlay(life)) return;
      h.borrow();
      buddy = h;
      var dx = p.x - h.x, dz = p.z - h.z, d = Math.hypot(dx, dz) || 1;
      playing = { mid: { x: (p.x + h.x) / 2, z: (p.z + h.z) / 2 }, u: { x: dx / d, z: dz / d } };
    }

    // The pet sits still at (at.x, at.y, at.z) looking toward (at.lookX, at.lookZ), at.scale its size (1 when left
    // out): at her desk, or while she decorates. A riding pet hops down for it. rest(null) ends it (a riding pet climbs
    // back); place() then puts it beside her.
    function rest(at, her) {
      if (!pet) return false;
      if (!at) {
        if (!resting) return true;
        resting = null;
        pet.group.scale.setScalar(PB.SCALE);
        stop();
        return true;
      }
      stop();
      hopDown(her);
      resting = at;
      pet.group.scale.setScalar((at.scale || 1) * PB.SCALE);
      pet.group.position.set(at.x, at.y, at.z);
      pet.group.lookAt(at.lookX, at.y, at.lookZ);
      return true;
    }
    function restStep(t) {
      mood = 'sit';
      pet.animate(t, mood);
      if (shown) {
        shown = '';
        bubble.visible = false;
      }
    }

    // The pet teacher (teach.js): the pet hops down, stands beside her on the camera side facing the camera, hops once and
    // shows 💡 until teach(false). False with no pet.
    function teach(on, her) {
      if (!pet) return false;
      if (on) {
        stop();
        hopDown(her);
        if (walking() && !resting) {
          var f = free(her);
          pet.group.position.set(f.x, 0, f.z);
        }
        teaching = { t: 0 };
      } else if (teaching) {
        teaching = null;
        stop();
      }
      return true;
    }

    function teachStep(dt, t, her) {
      teaching.t += dt;
      var g = pet.group, c = S.camera.position;
      if (resting) g.lookAt(c.x, g.position.y, c.z);
      else if (walking()) {
        var f = free(her);
        ease(g, f.x, f.z, dt);
        g.lookAt(c.x, 0, c.z);
      }
      pet.animate(t, 'idle');
      if (teaching.t < TEACH_HOP) PT.trick(pet, 'trick-jump', teaching.t / TEACH_HOP, !walking());
      if (shown !== TEACH_BUBBLE) {
        shown = TEACH_BUBBLE;
        bubble.visible = true;
        bubble.material.map = emoji(TEACH_BUBBLE);
        bubble.material.needsUpdate = true;
      }
    }

    // her = { x, z, face, moving, hold (a panel, chat or ride: the pet waits, awake), front (the mirror or a stall), sisterD,
    // quiet (she is doing a move: no chatter) }
    function tick(dt, t, her) {
      if (!pet) return;
      now = t;
      if (teaching) return teachStep(dt, t, her);
      if (resting) return restStep(t);
      var a = life.action;
      if (a && a.kind === 'fetch' && (her.hold || Math.hypot(her.x - pet.group.position.x, her.z - pet.group.position.z) > Math.max(FAR_FETCH, fetch.item.range + 3))) stop();
      if (a && a.kind === 'play' && (her.hold || Math.hypot(her.x - pet.group.position.x, her.z - pet.group.position.z) > FAR_PLAY)) stop();
      var pp = pet.group.position;
      PL.tick(life, dt, {
        moving: her.moving, quiet: her.hold || her.front || !!her.quiet,
        near: spot !== 'walk' || Math.hypot(her.x - pp.x, her.z - pp.z) <= PL.CHAT_NEAR
      });
      if (her.hold) life.still = 0;
      a = life.action;
      if (a && a.kind === 'fetch' && a.stuck) {
        stop();
        place(her, true);
        a = null;
      }
      if (!a && (fetch || toy || playing || down)) {
        if (playing) {
          o.hearts(playing.mid.x, 2.5, playing.mid.z);
        }
        stop();
      }
      if (!a) startPlay(her);
      a = life.action;
      var moved = false;
      if (a && a.kind === 'fetch') moved = fetchStep(dt, her, a);
      else if (a && a.kind === 'play') moved = playStep(dt, a);
      else if (a && a.kind === 'watch') { if (walking()) pet.group.lookAt(her.x, 0, her.z); }
      else if (spot === 'walk' && her.front) show(her);
      else if (spot === 'walk' && !her.hold) moved = follow(dt, her);
      if (life.fired) {
        var f = life.fired;
        life.fired = null;
        lastCheer = f.emoji;
        pet.group.getWorldPosition(v);
        if (f.burst && o.cheer) o.cheer(v.x, v.y + pet.top, v.z);
        o.sound(f.sound);
      }
      mood = PL.mood(life, moved);
      pet.animate(t, mood);
      if (a && a.kind === 'trick') PT.trick(pet, a.id, a.t / a.len, !walking());
      else if (a && a.kind === 'fetch' && a.stage === 'pick' && a.leap) PT.trick(pet, 'trick-jump', a.t / 0.5, false);
      else if (a && a.kind === 'play' && a.t < a.len - MEET) PT.trick(pet, 'trick-jump', (a.t % 1.5) / 1.5, false);
      var e = PL.bubble(life, her.sisterD);
      if (e !== shown) {
        shown = e;
        bubble.visible = !!e;
        if (e) {
          bubble.material.map = emoji(e);
          bubble.material.needsUpdate = true;
        }
      }
      if (life.heard.length) {
        var heard = life.heard;
        life.heard = [];
        if (o.sfx) heard.forEach(function (h) { o.sfx(h.name, h.info, petType, h.name === 'play-start' && buddy ? buddy.type : null); });
      }
    }

    function pat() {
      if (!pet) return;
      PL.pat(life);
      pet.group.getWorldPosition(v);
      o.hearts(v.x, v.y + 1.5, v.z);
    }

    // A tap on the screen at (cx, cy): true (and a pat) when it lands on her pet.
    function hit(cx, cy) {
      if (!pet) return false;
      S.scene.updateMatrixWorld();
      S.camera.updateMatrixWorld();
      var r = o.canvas.getBoundingClientRect();
      ndc.set((cx - r.left) / r.width * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, S.camera);
      if (!ray.intersectObject(pet.body, true).length) return false;
      pat();
      return true;
    }

    function treat() {
      if (!pet || !PL.treat(life)) return false;
      return true;
    }

    // For the e2e driver: tap the middle of her pet on the screen.
    function tapCenter() {
      if (!pet) return false;
      S.scene.updateMatrixWorld();
      S.camera.updateMatrixWorld();
      var r = o.canvas.getBoundingClientRect();
      pet.group.localToWorld(v.set(0, pet.top * 0.35, 0));
      v.project(S.camera);
      return hit(r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height);
    }

    function state() {
      var p = pet && walking() ? pet.group.position : null, a = life.action;
      return {
        mood: mood, bubble: shown, spot: spot, x: p ? p.x : null, z: p ? p.z : null,
        action: a ? a.kind : null, stage: a && a.kind === 'fetch' ? a.stage : null, trick: a && a.kind === 'trick' ? a.id : null,
        toy: !!toy, down: down, buddy: !!buddy, cheer: lastCheer, teaching: !!teaching, resting: !!resting,
        y: p ? p.y : null
      };
    }

    // Her pet's things that stand in the scene itself (the pet when it walks, a thrown toy), so her room keeps them shown.
    function groups() {
      return [pet && pet.group, toy].filter(function (g) { return !!g && g.parent === S.scene; });
    }

    return {
      set: set, place: place, tick: tick, hit: hit, pat: pat, treat: treat, tapCenter: tapCenter, state: state, groups: groups,
      play: play, demo: demo, celebrate: celebrate, watch: watch, unwatch: unwatch, teach: teach, rest: rest
    };
  }

  W.Companion = { create: create };
})(this);
