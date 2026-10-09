/* The playground kids in 3D (playmates part 1): builds the nine kids with the character maker's body, lets them roam
   the whole map (matemind.js with Layout.walkways), shows each kid only while they are within SHOW of her, poses them
   each frame, shows emoji and word pops over their heads,
   shows a friend's name tag only while she can talk to them (the one her button would talk to, or the one talking),
   fades a kid who comes close to the camera (riders can't step aside, so the view never fills with one kid),
   and talks with her in the speech bubble: a hello, then one question (a study question from any of her subjects or a
   fun one), then 🎠 Let's play! to invite a friend along on a ride and 🎲 Let's play! for a game (games3d.js). Study
   answers go to her study history with no points; review boxes, quests and the 3-day rest are never touched. */
(function (root) {
  'use strict';
  var W = root.World3D = root.World3D || {};
  var SHOW = 50, POP_TIME = 1.4, TAG_Y = 7.2, SCALE = 0.92, FADE_NEAR = 3.5, FADE_FAR = 9, FADE_MIN = 0.12;

  // o = { S, built, grade, T, store, today(), busy(on), sound(name), sfx(name), textOf(html), facts(), rand,
  //       teach(view, opt, then) → her pet explains a wrong study answer, then() after Got It!,
  //       choose(id) → offers that kid's games, group then game (games3d.js), blocked(x, z, r) → the games' props block }
  function create(o) {
    var L = W.Layout, S = o.S, T = o.T, grade = o.grade, doc = root.document, rand = o.rand || Math.random;
    var ML = W.MateLines, MQ = W.MateQuiz, LT = ML.TEXT[grade], bank = ML.fun(grade);
    var pg = L.places(grade).playground, ends = {}, obs = L.obstacles(grade), bounds = L.GRADES[grade].bounds;
    L.rideSpots(grade).forEach(function (s) { ends[s.id] = s.end; });
    var list = W.Mates.all(rand);
    var mind = W.MateMind.create({
      pr: L.props(grade), ends: ends, boards: L.rideSpots(grade), area: pg, rand: rand,
      kids: list.map(function (m) { return { id: m.id, fav: m.fav, racer: m.id === 'tomas' }; }), ways: L.walkways(grade),
      blocked: function (x, z, r) { return L.blocked(obs, bounds, x, z, r) || !!(o.blocked && o.blocked(x, z, r)); }
    });
    var load = W.Ask.loader(root, W.LessonFiles), apps = L.buildings(grade).map(function (b) { return b.app; });
    var still = false, textures = {}, talk = null, token = 0, talking = null;
    try { still = !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) {}

    // Each kid gets their own copies of its (shared, cached) materials, so it can fade alone.
    function ownMaterials(group) {
      var mats = [];
      function own(m) {
        var c = m.clone();
        c.userData.base = m.transparent ? m.opacity : 1;
        c.transparent = true;
        mats.push(c);
        return c;
      }
      group.traverse(function (obj) {
        if (!obj.isMesh || !obj.material) return;
        obj.material = Array.isArray(obj.material) ? obj.material.map(own) : own(obj.material);
      });
      return mats;
    }

    function fade(k, a) {
      if (Math.abs(a - k.fade) < 0.02) return;
      k.fade = a;
      k.mats.forEach(function (m) { m.opacity = m.userData.base * a; });
    }

    var kids = list.map(function (m) {
      var ch = W.Avatar.character(S, W.Pets.wearable(W.Items.wearable(m.look, null), null));
      ch.group.scale.setScalar(SCALE * W.Avatar.SCALE);
      var tag = null;
      if (m.name) {
        tag = S.sprite(S.label(m.face + ' ' + m.name, '#6aa9ff'), 3.6, 3.6 * 180 / 512);
        tag.position.set(0, TAG_Y, 0);
        tag.visible = false;
        ch.group.add(tag);
      }
      var pop = S.sprite(S.emoji('😄'), 1.4, 1.4);
      pop.visible = false;
      ch.group.visible = false;
      S.scene.add(ch.group);
      S.scene.add(pop);
      return { m: m, ch: ch, pop: pop, tag: tag, mats: ownMaterials(ch.group), fade: 1, popT: 0, x: 0, y: 0, z: 0 };
    });
    var byId = {};
    kids.forEach(function (k) { byId[k.m.id] = k; });

    function english(s) { return String(s).split(' · ').pop(); }
    function pick(lines) { return lines[Math.min(lines.length - 1, Math.floor(rand() * lines.length))]; }
    function nameOf(k) { return k.m.name || LT.newFriend; }

    // An emoji pops as a picture; words (Tara!, Your turn!) as a small sign.
    function showPop(k, text) {
      if (text === 'yourTurn') text = LT.yourTurn;
      var word = /[A-Za-z]/.test(text);
      if (!textures[text]) textures[text] = word ? S.label(text, '#ff9e6b') : S.emoji(text);
      k.pop.material.map = textures[text];
      k.pop.material.needsUpdate = true;
      if (word) k.pop.scale.set(3.2, 3.2 * 180 / 512, 1);
      else k.pop.scale.set(1.4, 1.4, 1);
      k.popT = POP_TIME;
    }

    // near: what her button would act on (world-main.js), so the kid it would talk to shows their name.
    // The kids live on everywhere; only the ones near her are drawn and animated.
    function tick(t, dt, st, now, near) {
      var out = mind.tick(dt, { x: st.x, z: st.z, now: now, cam: { x: S.camera.position.x, z: S.camera.position.z } });
      var focus = near && near.kind === 'mate' ? near.mate : -1;
      out.pops.forEach(function (p) { showPop(byId[p.kid], p.text); });
      out.sounds.forEach(function (s) { o.sfx(s); });
      var parts = mind.parts();
      Object.keys(parts).forEach(function (p) { o.built.ride(p, parts[p]); });
      mind.frames().forEach(function (f, n) {
        var k = kids[n], g = k.ch.group;
        k.x = f.x;
        k.y = f.y;
        k.z = f.z;
        // A kid hiding in hide-and-seek is behind a prop: not drawn.
        g.visible = !f.hidden && Math.hypot(f.x - st.x, f.z - st.z) <= SHOW;
        if (!g.visible) {
          k.pop.visible = false;
          k.popT = 0;
          return;
        }
        g.position.set(f.x, f.y, f.z);
        g.rotation.y = f.face;
        if (k.tag) k.tag.visible = n === focus || k === talking;
        // Along the ground: the camera rides several units up, so a kid at its feet is still in the way.
        var camD = Math.hypot(S.camera.position.x - f.x, S.camera.position.z - f.z);
        fade(k, camD >= FADE_FAR ? 1 : Math.max(FADE_MIN, (camD - FADE_NEAR) / (FADE_FAR - FADE_NEAR)));
        k.ch.animate(t, f.walkT, f.mag, f.ride ? { ride: true, sit: f.sit, cheer: f.cheer } : { wave: f.wave, cheer: f.cheer });
        if (k.popT > 0) {
          k.popT = Math.max(0, k.popT - dt);
          k.pop.visible = k.popT > 0;
          k.pop.position.set(f.x, f.y + 5.2 + (still ? 0 : (POP_TIME - k.popT) * 0.8), f.z);
        }
      });
    }

    function say(k, text, sub, buttons) {
      if (talk) talk.close();
      mind.talk(k.m.id, true);
      talking = k;
      o.busy(true);
      var mine = talk = W.Talk.open({
        doc: doc, face: k.m.face, who: nameOf(k), text: text, sub: sub, stack: true, pair: grade === 'grade2', buttons: buttons,
        onClose: function () {
          if (talk !== mine) return;
          talk = null;
          talking = null;
          o.busy(false);
          mind.talk(k.m.id, false);
        }
      });
    }

    function tail(k) {
      var GB = W.MateGame ? W.MateGame.BUTTONS : null, out = [{ text: LT.play, onClick: function () { pickRide(k); } }];
      if (o.choose && GB) out.push({ text: GB.play, onClick: function () { o.choose(k.m.id); } });
      return out.concat([{ text: T.bye }]);
    }

    function pickRide(k) {
      var buttons = ['slide', 'swings', 'seesaw', 'merry'].map(function (id) {
        return { text: T.rides[id], onClick: function () { if (mind.invite(k.m.id, id)) showPop(k, LT.tara); } };
      });
      say(k, LT.pickRide, '', buttons.concat([{ text: T.bye }]));
    }

    function hello(k, today) {
      if (k.m.isNew) return pick(LT.newHello);
      var r = rand();
      if (r < 0.3) {
        var mem = MQ.remembered(bank, MQ.read(o.store, today).fun, rand);
        if (mem) return LT.remember(mem.q, mem.q.choices[mem.choice]);
      }
      if (r < 0.65) {
        var lines = [];
        try { lines = ML.progress(grade, o.facts()); } catch (e) {}
        if (lines.length) return pick(lines);
      }
      return pick(LT.hello[k.m.id]);
    }

    function fun(k, line, today) {
      var q = MQ.pickFun(bank, MQ.read(o.store, today).asked, rand);
      if (!q) return say(k, line, '', tail(k));
      MQ.markAsked(o.store, today, MQ.funKey(q.id), Date.now());
      var buttons = q.choices.map(function (c, j) { return { text: c, onClick: function () { funAnswered(k, q, j, today); } }; });
      say(k, line, q.sub, buttons.concat(tail(k)));
    }

    function funAnswered(k, q, j, today) {
      MQ.saveFun(o.store, today, q.id, j, Date.now());
      var fav = MQ.favourite(k.m.id, q);
      if (fav === j) o.built.hearts(k.x, 5, k.z);
      say(k, fav === j ? LT.same : LT.other(q.choices[fav]), '', tail(k));
    }

    // A question from her own subjects not asked today: each subject's lesson files load in a random order until one
    // has a question left; null when none does.
    function findStudy(today) {
      var asked = MQ.read(o.store, today).asked;
      var mineApps = MQ.shuffle(apps.filter(function (a) { return W.Quiz.supports(a) && !!W.LessonFiles[a]; }), rand);
      return mineApps.reduce(function (p, app) {
        return p.then(function (found) {
          if (found) return found;
          return load(app).then(function (lessons) {
            var cands = [];
            lessons.forEach(function (l) {
              (l.quiz || []).forEach(function (it) { if (W.Quiz.askable(app, l, it)) cands.push({ app: app, item: it }); });
            });
            return MQ.pickStudy(cands, asked, rand);
          }, function () { return null; });
        });
      }, Promise.resolve(null));
    }

    // my: this talk's token; a later talk (with any kid) makes the slow lesson load give up.
    function study(k, line, today, my) {
      say(k, line, LT.thinking, [{ text: T.bye }]);
      findStudy(today).then(function (q) {
        if (my !== token || !talk) return;
        if (!q) return fun(k, line, today);
        MQ.markAsked(o.store, today, MQ.studyKey(q.app, q.item.q), Date.now());
        var v = W.Quiz.view(q.app, q.item, o.textOf, rand);
        var buttons = v.options.map(function (opt) { return { text: opt.text, onClick: function () { studied(k, q, v, opt); } }; });
        say(k, line, [v.q, v.sub].filter(Boolean).join('\n'), buttons.concat(tail(k)));
      }, function () {
        if (my === token && talk) fun(k, line, today);
      });
    }

    // Saved like a world Ask me! answer (a review quiz that never finishes), but with no points and no review box.
    function studied(k, q, v, opt) {
      var right = !!opt.right, SH = root.StudyHistory, f = W.LessonFiles[q.app];
      try {
        if (SH && SH.quizStarted) {
          var info = W.Quiz.info(q.app, q.item, o.textOf);
          var id = SH.quizStarted(q.app, f.title, 'review', english(LT.title), false, 1, 'review');
          SH.quizAnswered(id, right, info.historyQ, opt.history, info.historyAnswer, false);
        }
      } catch (e) {}
      if (right) {
        o.built.cheer(k.x, 4.5, k.z);
        o.sound('allRead');
      }
      if (!right && o.teach) {
        // The kid waits beside her while her pet explains.
        mind.talk(k.m.id, true);
        return o.teach(v, opt, function () { say(k, LT.answerIs(v.answer), '', tail(k)); });
      }
      var sub = (right ? [v.good, v.explain] : [opt.why, v.explain]).filter(Boolean).join('\n');
      say(k, right ? pick(LT.right) : LT.answerIs(v.answer), sub, tail(k));
    }

    function openTalk(n) {
      var k = kids[n];
      if (!mind.talk(k.m.id, true)) return;
      var my = ++token, today = o.today(), line = hello(k, today);
      if (k.m.asks === 'study') study(k, line, today, my);
      else fun(k, line, today);
    }

    function items() {
      return mind.tappable().filter(function (t) { return byId[t.id].ch.group.visible; }).map(function (t) {
        var n = kids.indexOf(byId[t.id]);
        return { kind: 'mate', id: 'mate:' + t.id, mate: n, x: t.x, z: t.z, r: 2.4 };
      });
    }

    // For games3d.js: the kids' brain and a few things about each kid.
    var api = {
      mind: mind,
      ids: function () { return kids.map(function (k) { return k.m.id; }); },
      nameOf: function (id) { return nameOf(byId[id]); },
      face: function (id) { return byId[id].m.face; },
      pop: function (id, text) { if (byId[id]) showPop(byId[id], text); },
      // Named friends free to come and ask her to play (not riding, talking or following her).
      friends: function () {
        return mind.list().filter(function (k) { return byId[k.id].m.name && (k.state === 'idle' || k.state === 'walk'); }).map(function (k) { return k.id; });
      },
      nearest: function (her) {
        var best = null, bestD = Infinity;
        mind.list().forEach(function (k) {
          var d = Math.hypot(k.x - her.x, k.z - her.z);
          if (!k.seat && d < bestD) { best = k.id; bestD = d; }
        });
        return best;
      }
    };

    return {
      api: api,
      tick: tick, items: items,
      handles: function (kind) { return kind === 'mate'; },
      label: function (it) { return T.talkTo.replace('{name}', english(nameOf(kids[it.mate]))); },
      act: function (it) { if (!talk) openTalk(it.mate); },
      closeTalk: function () { if (talk) talk.close(); },
      debug: {
        list: function () { return mind.list().map(function (k) { return Object.assign({ visible: byId[k.id].ch.group.visible }, k); }); },
        calm: mind.calm,
        invite: mind.invite,
        talk: function (id) { var n = kids.indexOf(byId[id]); if (n >= 0) openTalk(n); }
      }
    };
  }

  W.Mates3D = { create: create };
})(this);
