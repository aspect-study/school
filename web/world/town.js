/* Phase 2 of the world: her progress on the map. Reads the same engines as the lobby (medals, review, quests, boss,
   wallet, guide), dresses the buildings through decor.js, puts Mayor Mimi by the fountain with her sparkle trail, and
   handles Mimi and the Boss Fort gate (the 3D boss and his finale are fort-boss.js; Bunny's counter is folk.js's now). world-main.js asks it for button labels,
   actions and door links. If an engine is missing, the world stays plain. Phase 4: after 10 minutes without a game,
   Mimi pops up near her, walks over and points at the guide's next step. */
(function (root) {
  'use strict';
  var W = root.World3D = root.World3D || {};
  var ARRIVE = 3, GREET = 16, NUDGE_AWAY = 6, NUDGE_MEET = 2.8, NUDGE_SPEED = 5, NUDGE_GIVE_UP = 8;

  // o = { S, built, grade, T, store, session, leave(app) (optional), go(url), sound(name), busy(on), isBusy(), today(), quiet() }
  function create(o) {
    var L = W.Layout, P = W.Progress, S = o.S, T = o.T, grade = o.grade;
    var subjects = root.Subjects, n = grade === 'grade2' ? 2 : 5;
    var cards = P.cards(grade, L, subjects);
    var keys = ((subjects && subjects[n]) || []).map(function (s) { return s.pointsKey; });
    if (root.Wallet && root.Wallet.catalog && !root.Wallet.canAfford) {
      root.Wallet.canAfford = function () { return P.canAfford(root.Wallet, o.store, keys); };
    }
    var deps = root.World && root.World.liveDeps ? root.World.liveDeps(root) : null;
    var link = root.Guide && root.Guide.link ? root.Guide.link : function () { return null; };
    var decor = W.Decor.create(S, o.built, T);
    var fortBoss = W.FortBoss && root.Bosses ? W.FortBoss.create({ S: S, built: o.built, grade: grade }) : null;
    var pr = L.props(grade), plaza = L.places(grade).plaza, allSpots = L.spots(grade);

    var mimi = W.Cast.mimi(S);
    mimi.group.position.set(pr.mimi.x, 0, pr.mimi.z);
    S.scene.add(mimi.group);
    var plate = S.sprite(S.label('🐱 ' + T.mimi, '#7b5cff'), 4.4, 4.4 * 180 / 512);
    plate.position.set(pr.mimi.x, 6.4, pr.mimi.z);
    S.scene.add(plate);

    var snap = null, trailTo = null, talk = null, greeted = false, visit = null, mimiTalk = false;

    function talkedToday() { return W.Prefs.readDaily(o.store).mimi === o.today(); }
    function quiet() { return !!(o.quiet && o.quiet()); }

    function refresh() {
      try {
        snap = deps && root.World.status ? P.snapshot({ cards: cards, status: root.World.status, deps: deps, link: link,
          bossWin: W.Prefs.readDaily(o.store).bossWin, stageSize: root.Boss && root.Boss.STAGE_SIZE, finaleText: T.finaleStep }) : null;
      } catch (e) { snap = null; }
      if (snap) decor.apply(snap);
      if (snap && fortBoss) fortBoss.apply(snap.fort);
      mimi.wave(!!visit || (!greeted && !talkedToday()));
      return snap;
    }

    function say(face, who, text, buttons, after) {
      o.busy(true);
      talk = W.Talk.open({ doc: root.document, face: face, who: who, text: text, pair: grade === 'grade2', buttons: buttons,
        onClose: function () {
          talk = null;
          mimiTalk = false;
          o.busy(false);
          if (after) after();
        } });
    }

    function startTrail(id) {
      var pts = L.route(grade, id);
      if (!pts.length) return;
      decor.showTrail(pts);
      trailTo = allSpots.filter(function (s) { return s.id === id; })[0] || null;
      o.sound('allRead');
    }

    // first (optional): runs before the trail starts (her room's nudge takes her outdoors first).
    function stepButtons(first) {
      var target = snap && snap.target, buttons = [];
      if (target) buttons.push({ text: T.goTrail, main: true, onClick: function () { if (first) first(); startTrail(target); } });
      buttons.push({ text: T.later });
      return buttons;
    }

    function openMimi() {
      if (talk || visit) return;
      greeted = true;
      W.Prefs.markDaily(o.store, 'mimi', o.today(), Date.now());
      mimi.wave(false);
      var step = snap && snap.step, target = snap && snap.target;
      mimiTalk = true;
      say('🐱', T.mimi, step ? (target ? W.Chat.join(step.text, T.follow) : step.text) : T.mimiIdle, stepButtons());
    }

    // The 10-minute nudge: Mimi pops up with a sparkle a few steps from her and walks over. false when she cannot now.
    function nudge(st) {
      if (talk || visit) return false;
      var at = L.freeSpot(grade, st.x, st.z, st.face, NUDGE_AWAY);
      visit = { t: 0, talking: false };
      plate.visible = false;
      mimi.group.position.set(at.x, 0, at.z);
      mimi.wave(true);
      o.built.sparkle(at.x, at.z);
      return true;
    }

    function goHome() {
      var p = mimi.group.position;
      o.built.sparkle(p.x, p.z);
      p.set(pr.mimi.x, 0, pr.mimi.z);
      mimi.group.rotation.y = 0;
      plate.visible = true;
      mimi.wave(false);
      visit = null;
    }

    // The nudge counts as her hello for today, so the plaza greeting does not repeat the same step.
    function openNudge() {
      visit.talking = true;
      greeted = true;
      W.Prefs.markDaily(o.store, 'mimi', o.today(), Date.now());
      var step = snap && snap.step;
      mimiTalk = true;
      say('🐱', T.mimi, step ? W.Chat.join(T.nudge, step.text) : T.nudge, stepButtons(), goHome);
    }

    // The nudge inside her room: Mimi's words and Go ▶ in a bubble, while Mimi herself stays outdoors. goOut runs before
    // the trail starts. false when a bubble is already open.
    function nudgeHere(goOut) {
      if (talk || visit) return false;
      greeted = true;
      W.Prefs.markDaily(o.store, 'mimi', o.today(), Date.now());
      var step = snap && snap.step;
      mimiTalk = true;
      say('🐱', T.mimi, step ? W.Chat.join(T.nudge, step.text) : T.nudge, stepButtons(goOut));
      return true;
    }

    function enterFort(f) {
      if (o.leave) o.leave('boss'); else W.Prefs.setReturn(o.session, grade, 'boss');
      o.go(f.href);
    }

    // The coins line only when boss_v1 shows this week's full pay (coins can be paused by the date guard).
    function wonLine(b, week) {
      var paid = false;
      try { paid = root.Boss.read(o.store).paid.indexOf(week + '|full') >= 0; } catch (e) {}
      return P.fill(paid ? T.bossWin : T.bossWinPlain, { en: b.name.en, fil: b.name.fil, coins: (root.Boss && root.Boss.FULL_COINS) || 10 });
    }

    // All stages cleared: he pops, the chest drops, she opens it. bossWin is saved as the finale starts and the world
    // refreshes when his bubble closes, so the finale plays once even if she closes it without opening the chest.
    function playFinale(f) {
      var b = fortBoss.boss(), B = root.Bosses;
      W.Prefs.markDaily(o.store, 'bossWin', f.week, Date.now());
      o.busy(true);
      var started = fortBoss.finale(function () {
        o.busy(false);
        say(b.emoji, B.name(b, grade), B.text(b, 'beaten', grade), [{ text: T.openChest, main: true, onClick: function () {
          fortBoss.openChest();
          o.sound('allRead');
          say('🪙', B.name(b, grade), wonLine(b, f.week), [{ text: T.close }]);
        } }], refresh);
      });
      if (!started) o.busy(false);
    }

    function openFort() {
      var f = snap && snap.fort, b = fortBoss && fortBoss.boss();
      if (f && f.finale && b) return playFinale(f);
      // Without the 3D boss (a file failed to load) the finale is marked seen, so Mimi stops sending her here.
      if (f && f.finale) {
        W.Prefs.markDaily(o.store, 'bossWin', f.week, Date.now());
        say('🏰', T.places.boss, T.fortBeaten, [{ text: T.close }], refresh);
        return;
      }
      if (f && f.href) {
        if (!b) return enterFort(f);
        say(b.emoji, root.Bosses.name(b, grade), root.Bosses.text(b, 'hello', grade, f.minions),
          [{ text: T.fortGo, main: true, onClick: function () { enterFort(f); } }, { text: T.later }]);
        return;
      }
      say('🏰', T.places.boss, f && f.beaten ? T.fortBeaten : T.fortNone, [{ text: T.close }]);
    }

    function label(it) {
      if (it.kind === 'mimi') return T.mimiTalk;
      if (it.kind === 'fort') {
        var f = snap && snap.fort;
        return f && f.finale && fortBoss && fortBoss.boss() ? T.seeBoss : f && f.href ? T.fortGo : T.fortClosed;
      }
      return null;
    }

    function act(it) {
      if (it.kind === 'mimi') openMimi();
      else if (it.kind === 'fort') openFort();
    }

    // Each frame: Mimi greets her the first time today she comes into the plaza (not while Jesus visits); the trail goes
    // out when she arrives; a nudging Mimi walks to her, then talks.
    function tick(t, st, dt) {
      mimi.animate(t);
      decor.animate(t);
      if (fortBoss) fortBoss.animate(t, dt);
      if (!talk && !visit && !o.isBusy() && !quiet() && !greeted && Math.hypot(st.x - plaza.x, st.z - plaza.z) < GREET && !talkedToday()) openMimi();
      if (trailTo && Math.hypot(st.x - trailTo.x, st.z - trailTo.z) < ARRIVE) {
        decor.hideTrail();
        trailTo = null;
      }
      if (visit && !visit.talking) {
        visit.t += dt || 0;
        var p = mimi.group.position, d = Math.hypot(st.x - p.x, st.z - p.z);
        if (d > NUDGE_MEET && visit.t < NUDGE_GIVE_UP) {
          var q = W.Walk.advance(p.x, p.z, st.x, st.z, NUDGE_SPEED * (dt || 0));
          p.set(q.x, 0, q.z);
          mimi.group.rotation.y = Math.atan2(st.x - q.x, st.z - q.z);
        } else if (!o.isBusy()) openNudge();
      }
    }

    return {
      refresh: refresh, label: label, act: act, tick: tick, nudge: nudge, nudgeHere: nudgeHere,
      handles: function (kind) { return kind === 'mimi' || kind === 'fort'; },
      doorHref: function (app, plain) { return P.doorHref(snap, app, plain); },
      snapshot: function () { return snap; },
      fortDebug: function () { return fortBoss ? fortBoss.debug() : null; },
      visiting: function () { return !!visit; },
      mimiLife: function () {
        return {
          char: mimi,
          held: function () { return !!visit; },
          talking: function () { return mimiTalk; },
          place: function (x, z, face) {
            mimi.group.position.set(x, 0, z);
            mimi.group.rotation.y = face;
            plate.position.set(x, 6.4, z);
          }
        };
      },
      trailTo: startTrail,
      trail: function () { return { to: trailTo ? trailTo.id : null, count: decor.trailCount() }; },
      closeTalk: function () { if (talk) talk.close(); }
    };
  }

  W.Town = { create: create };
})(this);
