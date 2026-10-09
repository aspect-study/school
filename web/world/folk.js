/* Phase 3 of the world: the characters who talk. A buddy by every subject door, Professor Hoot on his park bench, Bunny
   by the shop counter and the talking trees of Whispering Park. What they say comes from her progress (chat.js);
   ❓ Ask me! asks her due review questions through ask.js, scored like a review round in the game; the study desk in her
   room asks the same way (study()). Tito Tasyo stands at his workshop. */
(function (root) {
  'use strict';
  var W = root.World3D = root.World3D || {};

  // o = { S, grade, T, store, today(), busy(on), door(app, kind) → href, open(app, href), shop(), stall(kind), cheer(x, z), changed(), textOf(html),
  //       teach(view, opt, then) → her pet explains a wrong answer, then() after Got It! }
  var FIL_APPS = { kuwentista: true, 'batang-bayani': true };

  function create(o) {
    var L = W.Layout, P = W.Progress, C = W.Chat, S = o.S, T = o.T, grade = o.grade, doc = root.document;
    var LT = W.Lines.TEXT[grade], who = W.Buddies.BUDDIES[grade];
    var subjects = root.Subjects, n = grade === 'grade2' ? 2 : 5, names = {};
    P.cards(grade, L, subjects).forEach(function (c) { names[c.app] = c.name; });
    var keys = ((subjects && subjects[n]) || []).map(function (s) { return s.pointsKey; });
    var pr = L.props(grade), park = L.places(grade).park;
    var asker = W.Ask.create({
      win: root, files: W.LessonFiles, quiz: W.Quiz, load: W.Ask.loader(root, W.LessonFiles), textOf: o.textOf, title: T.askTitle
    });

    function place(c, x, z, face) {
      c.group.position.set(x, 0, z);
      c.group.rotation.y = face;
      S.scene.add(c.group);
      return c;
    }

    var buddies = {};
    L.buddies(grade).forEach(function (b) {
      var w = who[b.app];
      buddies[b.app] = { fil: !!FIL_APPS[b.app], face: w.face, name: w.name, char: place(W.Cast.buddy(S, w.look), b.x, b.z, b.face), x: b.x, z: b.z };
    });
    var hoot = { face: '🦉', name: T.hoot, char: place(W.Cast.hoot(S), pr.hoot.x, pr.hoot.z, Math.PI), x: pr.hoot.x, z: pr.hoot.z };
    var bunny = { face: '🐰', name: T.bunny, char: place(W.Cast.bunny(S), pr.bunny.x, pr.bunny.z, -Math.PI / 2), x: pr.bunny.x, z: pr.bunny.z };
    var lana = place(W.Cast.lana(S), pr.lana.x, pr.lana.z, -Math.PI / 2);
    var kiko = place(W.Cast.kiko(S), pr.kiko.x, pr.kiko.z, -Math.PI / 2);
    var pilo = place(W.Cast.pilo(S), pr.pilo.x, pr.pilo.z, -Math.PI / 2);
    var tasyo = place(W.Cast.tasyo(S), pr.tasyo.x, pr.tasyo.z, -Math.PI / 2);
    var tree = { face: '🌳', name: T.tree };
    var faces = L.talkTrees(grade).map(function (t) {
      var f = W.Cast.treeFace(S, t, park);
      S.scene.add(f.mesh);
      return f;
    });

    var snap = null, talk = null, conv = 0;

    function english(s) { return String(s).split(' · ').pop(); }
    // The Filipino and Makabansa buddies keep the Filipino-first lines whatever the Filipino switch says.
    function lt(ch) { return ch && ch.fil && W.Lines.TEXT.grade2pair ? W.Lines.TEXT.grade2pair : LT; }
    function dueOf(app) { return root.Recall && root.Recall.dueCount ? root.Recall.dueCount(app) : 0; }

    function say(ch, text, buttons, sub, stack, onClose) {
      if (talk) talk.close();
      o.busy(true);
      var mine = talk = W.Talk.open({
        doc: doc, face: ch.face, who: ch.name, text: text, sub: sub, stack: stack, pair: grade === 'grade2' && !stack, keepFil: !!ch.fil, buttons: buttons,
        onClose: function () {
          if (talk === mine) { talk = null; o.busy(false); }
          if (onClose) onClose();
        }
      });
    }

    // Lines she can walk through with 💬 More, then the character's own buttons, then 👋 Bye.
    function chat(ch, lines, extra) {
      var i = 0;
      function show() {
        var buttons = lines.length > 1 ? [{ text: T.more, onClick: function () { i = (i + 1) % lines.length; show(); } }] : [];
        say(ch, lines[i], buttons.concat(extra, [{ text: T.bye }]));
      }
      show();
    }

    function lastPlayed(app) {
      var last = null;
      try {
        var SH = root.StudyHistory;
        (SH && SH.list ? SH.list() : []).forEach(function (e) {
          if (e && e.app === app && typeof e.t === 'number' && (last === null || e.t > last)) last = e.t;
        });
      } catch (e) {}
      return last;
    }

    function doorButton(app) {
      return { text: '📖 ' + T.go.replace('{name}', english(names[app])), main: true, onClick: function () { o.open(app, o.door(app)); } };
    }

    function infoOf(app) { return (snap && snap.info && snap.info[app]) || {}; }

    // All caught up with Hoot: Go ▶ to the guide's next step when there is one.
    function stepButtons() {
      var s = snap;
      var go = s && s.stepHref ? [{ text: T.goTrail, main: true, onClick: function () { o.open(s.step.app || null, s.stepHref); } }] : [];
      return go.concat([{ text: T.bye }]);
    }

    function openBuddy(app) {
      var ch = buddies[app], info = infoOf(app), inGame = !asker.supported(app) || (info.reviewQuest && info.due > 0);
      var lines = C.buddyLines(grade, { boss: info.boss, quest: info.quest, due: info.due || 0, tally: info.tally, lastT: lastPlayed(app) },
        { now: Date.now(), subject: english(names[app]), hi: who[app].hi, inGame: inGame });
      var extra = [];
      if (!inGame) extra.push({ text: T.ask, main: true, onClick: function () { ask([app], ch, app); } });
      else if (info.due > 0) extra.push({ text: T.reviewGame, main: true, onClick: function () { o.open(app, o.door(app, 'review')); } });
      chat(ch, lines, extra);
    }

    function allDue() {
      try {
        var d = root.Recall && root.Recall.dueByApp ? root.Recall.dueByApp() : {};
        return Object.keys(d).reduce(function (s, a) { return s + (Number(d[a]) || 0); }, 0);
      } catch (e) { return 0; }
    }

    // Due questions only the games can ask (Math Mastery skills, or ones today's review quest keeps for the game) send
    // her to the game, not "nothing to review".
    function openHoot() {
      var apps = asker.dueApps().filter(function (a) { return !infoOf(a).reviewQuest; }), due = apps.reduce(function (s, a) { return s + dueOf(a); }, 0);
      var first = due ? LT.hoot.hello(due) : allDue() > 0 ? LT.askGame : LT.hoot.none;
      chat(hoot, [first].concat(LT.hoot.wise),
        due ? [{ text: T.ask, main: true, onClick: function () { ask(apps, hoot, null); } }] : []);
    }

    function openBunny() {
      var first = LT.bunny.tips[0];
      try { if (root.Wallet && root.Wallet.shelf) first = C.bunnyLine(grade, root.Wallet.shelf(P.points(o.store, keys))); } catch (e) {}
      chat(bunny, [first].concat(LT.bunny.tips), [{ text: T.counter, main: true, onClick: o.shop }]);
    }

    function openTree(id) {
      var k = 0;
      function show() { say(tree, C.quote(grade, id, o.today(), k), [{ text: T.more, onClick: function () { k++; show(); } }, { text: T.bye }]); }
      show();
    }

    // The study desk in her room: Hoot's ❓ Ask me! (his due questions, all subjects) with at most limit questions.
    // ch = { face, name, x, z } (the desk); onAnswer(right) runs after each answer.
    function study(ch, limit, onAnswer) {
      var apps = asker.dueApps().filter(function (a) { return !infoOf(a).reviewQuest; });
      if (!apps.length && allDue() > 0) return say(ch, lt(ch).askGame, [{ text: T.bye }]);
      ask(apps, ch, null, { limit: limit, onAnswer: onAnswer });
    }

    // app: the buddy's subject (its door is offered when the questions stay in the game); null for Hoot.
    // desk (optional): { limit, onAnswer(right) } from study().
    function ask(apps, ch, app, desk) {
      var token = ++conv;
      asker.end();
      say(ch, lt(ch).thinking, [{ text: T.bye }], '', false, function () { if (token === conv) conv++; });
      asker.pick(apps, desk ? desk.limit : undefined).then(function (list) {
        if (token !== conv) return;
        if (list.length) return question(list, 0, ch, app, desk);
        var due = apps.reduce(function (s, a) { return s + dueOf(a); }, 0);
        if (due > 0) return say(ch, lt(ch).askGame, app ? [doorButton(app), { text: T.bye }] : [{ text: T.bye }]);
        say(ch, lt(ch).askNone, app ? [doorButton(app), { text: T.bye }] : stepButtons());
      }, function () {
        if (token === conv) say(ch, lt(ch).askFail, app ? [doorButton(app), { text: T.bye }] : [{ text: T.bye }]);
      });
    }

    function question(list, i, ch, app, desk) {
      var v = list[i].view;
      var buttons = v.options.map(function (opt, j) { return { text: opt.text, onClick: function () { answered(list, i, j, ch, app, desk); } }; });
      buttons.push({ text: T.bye });
      say(ch, v.q, buttons, v.sub, true);
    }

    function answered(list, i, j, ch, app, desk) {
      var r = asker.answer(list, i, j);
      if (!r) return;
      var more = i + 1 < list.length;
      if (r.right) {
        if (ch.char) ch.char.dance();
        o.cheer(ch.x, ch.z);
      }
      o.changed();
      if (desk && desk.onAnswer) desk.onAnswer(r.right);
      var buttons = more ? [{ text: T.next, main: true, onClick: function () { question(list, i + 1, ch, app, desk); } }] : [];
      buttons.push({ text: T.bye });
      if (!r.right && o.teach) return o.teach(list[i].view, list[i].view.options[j], function () { say(ch, lt(ch).answerIs(r.answer), buttons); });
      var sub = (r.right ? [r.good, r.explain] : [r.why, r.explain]).filter(Boolean).join('\n');
      say(ch, r.right ? lt(ch).right(r.pts) : lt(ch).answerIs(r.answer), buttons, sub);
    }

    function label(it) {
      if (it.kind === 'buddy') return T.talkTo.replace('{name}', buddies[it.app].name);
      if (it.kind === 'hoot') return T.talkTo.replace('{name}', english(T.hoot));
      if (it.kind === 'counter') return T.talkTo.replace('{name}', T.bunny);
      if (it.kind === 'tree') return T.listen;
      if (it.kind === 'boutique') return T.boutiqueGo;
      if (it.kind === 'petshop') return T.petshopGo;
      if (it.kind === 'toyshop') return T.toyshopGo;
      if (it.kind === 'carpenter') return T.tasyoGo;
      return null;
    }

    var talkWho = null;
    function whoOf(it) {
      if (it.kind === 'buddy') return 'buddy:' + it.app;
      if (it.kind === 'hoot') return 'hoot';
      if (it.kind === 'counter') return 'bunny';
      if (it.kind === 'boutique') return 'lana';
      if (it.kind === 'petshop') return 'kiko';
      if (it.kind === 'toyshop') return 'pilo';
      if (it.kind === 'carpenter') return 'tasyo';
      return null;
    }

    function act(it) {
      if (talk) return;
      talkWho = whoOf(it);
      if (it.kind === 'buddy') openBuddy(it.app);
      else if (it.kind === 'hoot') openHoot();
      else if (it.kind === 'counter') openBunny();
      else if (it.kind === 'boutique' || it.kind === 'petshop' || it.kind === 'toyshop' || it.kind === 'carpenter') o.stall(it.kind);
      else if (it.kind === 'tree') openTree(it.tree);
    }

    function tick(t) {
      Object.keys(buddies).forEach(function (a) { buddies[a].char.animate(t); });
      hoot.char.animate(t);
      bunny.char.animate(t);
      lana.animate(t);
      kiko.animate(t);
      pilo.animate(t);
      tasyo.animate(t);
      faces.forEach(function (f) { f.animate(t); });
    }

    return {
      refresh: function (s) { snap = s; },
      label: label, act: act, tick: tick, study: study,
      // Every character with a body, by the id routines.js uses, for the living world (life.js).
      chars: function () {
        var out = { hoot: hoot.char, bunny: bunny.char, lana: lana, kiko: kiko, pilo: pilo, tasyo: tasyo };
        Object.keys(buddies).forEach(function (a) { out['buddy:' + a] = buddies[a].char; });
        return out;
      },
      talkingId: function () { return talk ? talkWho : null; },
      handles: function (kind) { return kind === 'buddy' || kind === 'hoot' || kind === 'counter' || kind === 'tree' || kind === 'boutique' || kind === 'petshop' || kind === 'toyshop' || kind === 'carpenter'; },
      talking: function () { return !!talk; },
      closeTalk: function () { if (talk) talk.close(); }
    };
  }

  W.Folk = { create: create };
})(this);
