/* Phase 4 of the world: family and comfort. Jesus sits on his garden bench with the lamb and talks with her (🤗 Hug,
   💬 More); once a local day he greets her where she starts, and on a hard day he comes to her in a soft golden glow.
   Her sister stands by the gate in her own look and takes one-tap cheers, and joins the playground games (player()).
   Nothing here quizzes, pays or compares. */
(function (root) {
  'use strict';
  var W = root.World3D = root.World3D || {};
  var SPEED = 4.5, MEET = 3.2, APPEAR = 7, GIVE_UP = 10, LEAVE = 1.5, SEAT_FACE = Math.PI / 2;
  // Her sister in a game: her size for bumping, how long a pop shows, how she walks back to the gate after.
  var SIS_R = 0.7, POP_TIME = 1.6, BACK_SPEED = 6, BACK_STUCK = 3, TURNS = [0, 0.6, -0.6, 1.2, -1.2, 1.8, -1.8, 2.4, -2.4];

  // o = { S, built, grade, T, store, today(), yesterday(), dayKey(ms), busy(on), isBusy(), sound(name), blocked(x, z, r) }
  function create(o) {
    var L = W.Layout, C = W.Care, S = o.S, T = o.T, grade = o.grade, doc = root.document;
    var J = W.Lines.JESUS[grade], pr = L.props(grade), seat = pr.jesus, spot = L.jesusSpot(grade);
    var F = root.Family && root.Family.sisters ? root.Family : null, FT = F && F.TEXT ? F.TEXT[grade] : null;
    var jesus = W.Cast.jesus(S), lamb = W.Cast.lamb(S);
    S.scene.add(jesus.group);
    S.scene.add(lamb.group);
    lamb.group.position.set(pr.lamb.x, 0, pr.lamb.z);
    lamb.group.rotation.y = -2.2;
    var jz = { mode: 'garden', kind: null, x: seat.x, z: seat.z, t: 0 };
    var pending = null, why = null, tally = null, talk = null, hugs = 0, sisters = [];

    function english(s) { return String(s).split(' · ').pop(); }
    function look(x, z) { return Math.atan2(x - jz.x, z - jz.z); }
    function put(x, z, face) {
      jz.x = x;
      jz.z = z;
      jesus.group.position.set(x, 0, z);
      jesus.group.rotation.y = face;
    }
    function sitDown() {
      jz.mode = 'garden';
      jesus.sit(true);
      jesus.walk(false);
      jesus.glow(false);
      put(seat.x, seat.z, SEAT_FACE);
    }

    function say(face, who, text, sub, buttons, stack) {
      if (talk) talk.close();
      o.busy(true);
      var mine = talk = W.Talk.open({
        doc: doc, face: face, who: who, text: text, sub: sub, stack: !!stack, pair: grade === 'grade2', buttons: buttons,
        onClose: function () { if (talk === mine) { talk = null; o.busy(false); } }
      });
    }

    // The verse and where it is, under his words; with the Filipino switch on, Grade 2 shows the Filipino and English verse on their own lines.
    function verse(line) { return W.Talk.shown(line.verse).split(' · ').concat(['📖 ' + W.Talk.shown(line.ref)]).join('\n'); }
    function sayJesus(line, buttons) { say('💛', T.jesus, line.say, verse(line), buttons); }

    function hug() {
      jesus.hug();
      o.built.hearts(jz.x, 5, jz.z);
      o.sound('allRead');
      sayJesus(C.pick(J.hug, o.today(), hugs++), [{ text: T.bye }]);
    }
    function hugButton() { return { text: T.hug, main: true, onClick: hug }; }

    function openGarden() {
      var lines = C.gardenLines(J, tally, o.today()), i = 0;
      function show() {
        sayJesus(lines[i], [hugButton(), { text: T.more, onClick: function () { i = (i + 1) % lines.length; show(); } }, { text: T.bye }]);
      }
      show();
    }

    // What kind of day she is having, from the same records the lobby keeps.
    function reasonNow() {
      var today = o.today(), entries = [], days = [], missed = false;
      try { entries = root.StudyHistory && root.StudyHistory.list ? root.StudyHistory.list() : []; } catch (e) {}
      try { days = root.Quests && root.Quests.read ? root.Quests.read(o.store).days : []; } catch (e) {}
      try { missed = !!(root.Boss && root.Boss.missedDay) && root.Boss.missedDay(o.store) === today; } catch (e) {}
      tally = C.tally(entries, today, o.dayKey);
      var broke = root.Quests && root.Quests.streakOf ? C.streakBroke(days, today, o.yesterday(), root.Quests.streakOf) : false;
      return C.hardDay({ tally: tally, broke: broke, bossMissed: missed });
    }

    // On world open and on coming back to it: does Jesus visit?
    function check() {
      if (jz.mode !== 'garden') return;
      why = reasonNow();
      pending = C.visit(W.Prefs.readDaily(o.store), o.today(), why);
    }

    function startVisit(st) {
      var at = L.freeSpot(grade, st.x, st.z, st.face, APPEAR);
      jz.kind = pending;
      pending = null;
      jz.mode = 'come';
      jz.t = 0;
      jesus.sit(false);
      jesus.glow(jz.kind === 'comfort');
      put(at.x, at.z, Math.atan2(st.x - at.x, st.z - at.z));
      o.built.sparkle(at.x, at.z);
    }

    function meet() {
      var today = o.today(), now = Date.now(), line;
      jz.mode = 'talk';
      jesus.walk(false);
      W.Prefs.markDaily(o.store, 'greeted', today, now);
      if (jz.kind === 'comfort') {
        W.Prefs.markDaily(o.store, 'comforted', today, now);
        line = C.pick(J.comfort[why] || J.comfort.wrong, today, 0);
      } else line = C.pick(J.greet, today, 0);
      sayJesus(line, [hugButton(), { text: T.bye }]);
    }

    function tickJesus(dt, st, free) {
      if (jz.mode === 'garden') {
        if (pending && free) startVisit(st);
        return;
      }
      if (jz.mode === 'come') {
        jz.t += dt;
        var d = Math.hypot(st.x - jz.x, st.z - jz.z);
        if (d > MEET && jz.t < GIVE_UP) {
          var p = W.Walk.advance(jz.x, jz.z, st.x, st.z, SPEED * dt);
          jesus.walk(true);
          put(p.x, p.z, look(st.x, st.z));
          return;
        }
        // She kept walking away: he comes to her side with a sparkle.
        if (d > MEET) {
          var near = L.freeSpot(grade, st.x, st.z, st.face, MEET - 0.4);
          o.built.sparkle(jz.x, jz.z);
          put(near.x, near.z, 0);
        }
        jesus.walk(false);
        put(jz.x, jz.z, look(st.x, st.z));
        if (!o.isBusy()) meet();
        return;
      }
      if (jz.mode === 'talk') {
        put(jz.x, jz.z, look(st.x, st.z));
        // Hug opens a new bubble in the same click, so the talk is over only when no bubble is left.
        if (!talk) {
          jz.mode = 'leave';
          jz.t = 0;
          jesus.walk(true);
        }
        return;
      }
      // Walking back: a few steps toward the garden, then a golden sparkle puts him on his bench.
      jz.t += dt;
      var q = W.Walk.advance(jz.x, jz.z, seat.x, seat.z, SPEED * dt);
      put(q.x, q.z, look(seat.x, seat.z));
      if (jz.t >= LEAVE || q.arrived) {
        o.built.sparkle(jz.x, jz.z);
        sitDown();
        o.built.sparkle(seat.x, seat.z);
      }
    }

    // Her sister's character by the gate, in her own look from the family peek (or the default while she chooses).
    function buildSisters() {
      if (!F || !FT) return;
      var me = null, list = [];
      try { me = root.Learner && root.Learner.current ? root.Learner.current() : null; } catch (e) {}
      try { list = F.sisters(me || { id: '', grade: 0 }, F.readPeek(o.store), Date.now(), F.readSeen(o.store)); } catch (e) {}
      var spots = L.sisterSpots(grade);
      sisters = list.slice(0, spots.length).map(function (s, i) {
        var sp = spots[i], lk = W.Pets.wearable(W.Items.wearable(W.Look.forKid(W.Look.clean(s.look), s.boy), null), null), made = lk.t > 0;
        var name = s.name || english(FT[s.rel] || FT.sister);
        var ch = W.Avatar.character(S, lk), pet = W.PetBody.build(S, lk);
        W.PetBody.tag(S, pet, W.Look.petName(lk));
        ch.group.scale.setScalar(W.Avatar.SCALE);
        ch.group.position.set(sp.x, 0, sp.z);
        ch.group.rotation.y = sp.face;
        S.scene.add(ch.group);
        var home = { x: sp.x + 1.4, z: sp.z + 1 };
        if (!W.PetBody.mount(pet, ch, lk.petSpot)) {
          pet.group.position.set(home.x, 0, home.z);
          S.scene.add(pet.group);
        }
        var tag = S.sprite(S.label('💖 ' + name + (s.playing ? ' 🎮' : ''), '#e46ba0'), 4.4, 4.4 * 180 / 512);
        tag.position.set(sp.x, 5.8, sp.z);
        S.scene.add(tag);
        var mark = !made ? '🎨' : s.playing ? '✨' : null, m = null;
        if (mark) {
          m = S.sprite(S.emoji(mark), 1.6, 1.6);
          m.position.set(sp.x, 7.2, sp.z);
          S.scene.add(m);
        }
        var pop = S.sprite(S.emoji('😆'), 1.4, 1.4);
        pop.visible = false;
        S.scene.add(pop);
        return {
          s: s, ch: ch, pet: pet, lk: lk, home: home, borrowed: false, x: sp.x, z: sp.z, name: name, made: made, myGrade: me ? Number(me.grade) || 0 : 0, cheered: 0,
          spot: sp, tag: tag, mark: m, pop: pop, popT: 0, face: sp.face, game: false, back: false, hidden: false, cheering: false,
          target: null, walkT: 0, mag: 0, stuck: 0, side: 0
        };
      });
    }

    // at (optional): { x, z } for the hearts of a cheer sent from her sister's room.
    var heartsAt = null;
    function openSister(k, at) {
      heartsAt = at || null;
      var x = sisters[k], s = x.s;
      if (!F.canSend(o.store, Date.now, null).ok) return say('💖', x.name, FT.limit, '', [{ text: T.bye }]);
      var choosing = s.boy ? T.sisterChoosingBoy : T.sisterChoosing;
      var line = (!x.made ? choosing : s.playing ? T.sisterPlaying : T.sisterHello).split('{name}').join(x.name);
      // A cheer she sent in the last minute waits, so the same words never come twice in a row.
      var buttons = F.cheersFor(F.voiceOf(F.relation(s.grade, x.myGrade)), s.boy).filter(function (c) {
        return F.canSend(o.store, Date.now, c.id).ok;
      }).map(function (c) {
        return { text: c.text, onClick: function () { cheer(k, c.id); } };
      });
      say('💖', x.name, line, '', buttons.concat([{ text: T.bye }]), true);
    }

    // The hearts float up over her sister, or where she stands in her sister's room (cheerTo).
    function cheer(k, id) {
      var x = sisters[k], ok = F.send(o.store, Date.now, Math.random, x.s.id, id), at = heartsAt || x;
      if (ok) {
        o.built.hearts(at.x, 5, at.z);
        o.sound('allRead');
        x.cheered = 3;
      }
      var buttons = ok ? [{ text: T.cheerAgain, main: true, onClick: function () { openSister(k, heartsAt); } }, { text: T.bye }] : [{ text: T.bye }];
      say('💖', x.name, ok ? FT.sent : FT.limit, '', buttons);
    }

    // How far the nearest sister stands from (x, z), or null when no sister is here (her pet shows 💖 near her).
    function sisterDistance(x, z) {
      var best = null;
      sisters.forEach(function (s) {
        var d = Math.hypot(s.x - x, s.z - z);
        if (best === null || d < best) best = d;
      });
      return best;
    }

    function sisterPets() {
      return sisters.map(function (x) { return { pet: x.lk.pet, hat: x.lk.petWear.hat, spot: x.lk.petSpot }; });
    }

    // Her pet plays with her sister's pet (companion.js): the nearest one within r of (x, z), lent as a handle. A pet
    // riding on her sister hops down beside her and climbs back on after.
    function petNear(x, z, r) {
      var best = null, bd = r;
      sisters.forEach(function (s) {
        var d = Math.hypot(s.home.x - x, s.home.z - z);
        if (!s.borrowed && d <= bd) {
          best = s;
          bd = d;
        }
      });
      return best ? lend(best) : null;
    }
    function lend(s) {
      var g = s.pet.group;
      return {
        pet: s.pet, type: s.lk.pet, x: s.home.x, z: s.home.z,
        borrow: function () {
          if (s.borrowed) return;
          s.borrowed = true;
          if (g.parent === S.scene) return;
          if (g.parent) g.parent.remove(g);
          g.scale.setScalar(W.PetBody.SCALE);
          g.rotation.set(0, 0, 0);
          g.position.set(s.home.x, 0, s.home.z);
          S.scene.add(g);
        },
        giveBack: function () {
          if (!s.borrowed) return;
          s.borrowed = false;
          if (W.PetBody.mount(s.pet, s.ch, s.lk.petSpot)) return;
          g.position.set(s.home.x, 0, s.home.z);
          g.rotation.set(0, 0, 0);
        }
      };
    }

    // --- her sister in a playground game ---------------------------------------------------------------------------
    // Puts her figure, name tag, mark and pop where she stands; hidden behind a prop, none of them show.
    function place(x) {
      x.ch.group.position.set(x.x, 0, x.z);
      x.ch.group.rotation.y = x.face;
      x.ch.group.visible = x.tag.visible = !x.hidden;
      x.tag.position.set(x.x, 5.8, x.z);
      if (x.mark) {
        x.mark.position.set(x.x, 7.2, x.z);
        x.mark.visible = !x.hidden && !x.game && !x.back;
      }
    }

    // One step toward (tx, tz) round anything in the way, like a playground kid; true on arrival.
    function step(x, tx, tz, speed, dt) {
      var dx = tx - x.x, dz = tz - x.z, d = Math.hypot(dx, dz);
      if (d <= 0.5) { x.mag = 0; return true; }
      var len = Math.min(d, speed * dt), base = Math.atan2(dx, dz);
      // Going round something, she keeps to the side she started on, so she gets past it instead of turning back.
      var list = TURNS.filter(function (t) { return !x.side || t * x.side >= 0; });
      for (var i = 0; i < list.length; i++) {
        var turn = list[i], a = base + turn, nx = x.x + Math.sin(a) * len, nz = x.z + Math.cos(a) * len;
        if (!o.blocked || !o.blocked(nx, nz, SIS_R)) {
          x.side = turn === 0 ? 0 : x.side || (turn > 0 ? 1 : -1);
          x.x = nx;
          x.z = nz;
          x.face = a;
          x.mag = speed / 5.5;
          x.walkT += len * 1.6;
          x.stuck = 0;
          return false;
        }
      }
      x.mag = 0;
      x.stuck += dt;
      if (x.stuck > 0.5) x.side = 0;
      return false;
    }

    var popTextures = {};
    function showPop(x, text) {
      var word = /[A-Za-z]/.test(text);
      if (!popTextures[text]) popTextures[text] = word ? S.label(text, '#e46ba0') : S.emoji(text);
      x.pop.material.map = popTextures[text];
      x.pop.material.needsUpdate = true;
      if (word) x.pop.scale.set(3.2, 3.2 * 180 / 512, 1);
      else x.pop.scale.set(1.4, 1.4, 1);
      x.popT = POP_TIME;
    }

    // Her (first) sister as a game player for games3d.js: the same move / where / put a playground kid has in a game,
    // plus game(on) and pop(text). null when no sister is here.
    function player() {
      var x = sisters[0];
      if (!x) return null;
      return {
        id: 'sister', name: x.name, face: '💖',
        game: function (on) {
          x.hidden = x.cheering = false;
          x.target = null;
          x.stuck = 0;
          x.mag = 0;
          if (on) {
            x.game = true;
            x.back = false;
          } else if (x.game) {
            x.game = false;
            x.back = true;
          }
          if (on && talk) talk.close();
          place(x);
          return true;
        },
        move: function (tx, tz, speed, dt) {
          if (!x.game) return false;
          if (!x.target || x.target.x !== tx || x.target.z !== tz) {
            x.target = { x: tx, z: tz };
            x.stuck = 0;
          }
          return step(x, tx, tz, speed, dt);
        },
        where: function () { return { x: x.x, z: x.z, face: x.face, stuck: x.stuck }; },
        put: function (p) {
          if (!x.game) return false;
          if (p.x !== undefined) { x.x = p.x; x.z = p.z; }
          if (p.face !== undefined) x.face = p.face;
          if (p.still) x.mag = 0;
          if (p.hidden !== undefined) x.hidden = p.hidden;
          if (p.cheer !== undefined) x.cheering = p.cheer;
          place(x);
          return true;
        },
        pop: function (text) { showPop(x, text); }
      };
    }

    // After a game she walks back to her spot by the gate (or pops back there when something is in the way).
    function walkBack(x, dt) {
      var sp = x.spot;
      if (step(x, sp.x, sp.z, BACK_SPEED, dt) || x.stuck > BACK_STUCK) {
        if (x.stuck > BACK_STUCK) o.built.sparkle(sp.x, sp.z);
        x.back = false;
        x.x = sp.x;
        x.z = sp.z;
        x.face = sp.face;
        x.mag = 0;
      }
      place(x);
    }

    // Moving and family characters, added to world-main's interactables each frame. Her sister in a game (or on her way
    // back from one) is not for talking to.
    function items() {
      var out = jz.mode === 'garden' ? [{ kind: 'jesus', id: 'jesus', x: spot.x, z: spot.z, r: 3 }] : [];
      sisters.forEach(function (x, k) {
        if (!x.game && !x.back) out.push({ kind: 'sister', id: 'sister:' + x.s.id, sister: k, x: x.x, z: x.z, r: 2.8 });
      });
      return out;
    }

    function label(it) {
      if (it.kind === 'jesus') return T.talkTo.replace('{name}', english(T.jesus));
      if (it.kind === 'sister') return T.talkTo.replace('{name}', sisters[it.sister].name);
      return null;
    }

    function act(it) {
      if (talk) return;
      if (it.kind === 'jesus') openGarden();
      else if (it.kind === 'sister') openSister(it.sister);
    }

    // The same cheer bubble as at the gate, for the sister with this id (from her room's 💛 Cheer); the hearts float up
    // at (x, z) where she stands. false when that sister is not here.
    function cheerTo(id, x, z) {
      if (talk) return false;
      for (var k = 0; k < sisters.length; k++) {
        if (sisters[k].s.id === id) {
          openSister(k, { x: x, z: z });
          return true;
        }
      }
      return false;
    }

    // free: she is not in the maker, a card, a bubble or a ride, so a visit may start.
    function tick(t, dt, st, free) {
      jesus.animate(t, dt);
      lamb.animate(t);
      sisters.forEach(function (x) {
        x.cheered = Math.max(0, x.cheered - dt);
        if (x.back) walkBack(x, dt);
        var playing = x.game || x.back;
        x.ch.animate(t, x.walkT, playing ? x.mag : 0, { wave: !playing && (x.s.playing || x.cheered > 0), cheer: x.cheering });
        if (x.popT > 0) {
          x.popT = Math.max(0, x.popT - dt);
          x.pop.visible = x.popT > 0 && !x.hidden;
          x.pop.position.set(x.x, 5.2 + (POP_TIME - x.popT) * 0.8, x.z);
        }
        if (!x.borrowed) x.pet.animate(t, 'sit');
      });
      tickJesus(dt, st, free);
    }

    sitDown();
    buildSisters();

    return {
      check: check, tick: tick, items: items, label: label, act: act, cheerTo: cheerTo,
      handles: function (kind) { return kind === 'jesus' || kind === 'sister'; },
      visiting: function () { return jz.mode === 'come' || jz.mode === 'talk'; },
      closeTalk: function () { if (talk) talk.close(); },
      debug: function () { return { mode: jz.mode, x: jz.x, z: jz.z, glow: jz.mode !== 'garden' && jz.kind === 'comfort' }; },
      sisterIds: function () { return sisters.map(function (x) { return x.s.id; }); },
      player: player,
      sisterAt: function () { return sisters.map(function (x) { return { x: x.x, z: x.z, game: x.game, back: x.back, hidden: x.hidden, visible: x.ch.group.visible }; }); },
      sisterDistance: sisterDistance, sisterPets: sisterPets, petNear: petNear
    };
  }

  W.Kin = { create: create };
})(this);
