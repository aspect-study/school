/* Playground games with the kids in 3D (playmates part 2; the rules are in mategame.js). A game starts from a kid's
   bubble (🎲 Let's play!) or the 🎲 Games board by the playground, picking a group and then its game (G.GROUPS), or
   when a friend runs up and asks.
   Up to 4 kids play (far ones pop in near her); each game puts down a new random set of hiding props that block
   walking like any prop. Her sister (kin.js player()) joins every game when she is in the world. A pill at the top
   shows the game and the time with ✖ End game; while she counts in hide-and-seek her eyes are covered (the screen is
   too) with a big number; a hint line under the pill says where a giggle came from; in tag the screen's edge glows red
   and a heartbeat thumps while the chaser is close. 🌳 Disguise turns her into a prop while she hides and 👻 Boo!
   surprises the seeker. Patintero (patintero.js, 4 against 4, no props) is played on a big court on the open lawn west
   of the school street, where everyone has room to run: a blue or red ring at each player's feet, her job (run or guard) under the pill, and fence() keeps her on the court
   while she runs and on the middle line while she guards. The end bubble offers 🔁 Play again (roles swap in
   hide-and-seek, sides in Patintero) and says, in a kid's voice, one reason the game is good for her. */
(function (root) {
  'use strict';
  var W = root.World3D = root.World3D || {};
  var PLAYERS = 4, POP_IN = 40, BOARD_R = 2.8, INVITE_MIN = 240, INVITE_MAX = 360, INVITE_NEAR = 30, ASK_NEAR = 3, HINT_TIME = 7, NOISE_TIME = 1.4;
  // Patintero: 7 players besides her (her sister counts as one); RING: the team rings' colours.
  var COURT_AT = [-57, -63], PAT_KIDS = 7, RING = { blue: '#4a8cff', red: '#ff5a5a' };

  // o = { S, built, grade, T, doc?, busy(on), freeze(on), sfx(name), mates (Mates3D api), staticBlocked(x, z, r),
  //       onPath(x, z, margin), free() → she can be asked to play, hideMe(on), rand, sister() → kin.js player() or null,
  //       place(x, z, face) → puts her there (Patintero's turns) }
  function create(o) {
    var S = o.S, THREE = S.THREE, L = W.Layout, G = W.MateGame, grade = o.grade, T = o.T, doc = root.document;
    var LT = G.TEXT[grade], B = G.BUTTONS, rand = o.rand || Math.random, M = o.mates, mind = M.mind;
    var hangouts = L.walkways(grade).hangouts, pg = L.places(grade).playground;
    // The players: the playground kids (matemind) and her sister (kin.js), moved the same way.
    var sis = o.sister ? o.sister() : null;
    function isSis(id) { return !!sis && id === sis.id; }
    var cast = {
      move: function (id, x, z, speed, dt) { return isSis(id) ? sis.move(x, z, speed, dt) : mind.move(id, x, z, speed, dt); },
      where: function (id) { return isSis(id) ? sis.where() : mind.where(id); },
      put: function (id, p) { return isSis(id) ? sis.put(p) : mind.put(id, p); },
      game: function (id, on) { return isSis(id) ? sis.game(on) : mind.game(id, on); }
    };
    var game = G.create({ rand: rand, move: cast.move, where: cast.where, put: cast.put });
    var pat = W.Patintero.create({ rand: rand, move: cast.move, where: cast.where, put: cast.put });
    // Whichever game is on (or just ended, until release()).
    function playing() { return game.playing() || pat.playing(); }
    function state() { return pat.state() || game.state(); }
    var props = [], disguise = null, talk = null, last = null, inviteT = INVITE_MIN + rand() * (INVITE_MAX - INVITE_MIN), asking = null;
    var her = { x: 0, z: 0 }, hintT = 0, noiseT = 0, beatT = 0, rings = null;

    // --- the board by the playground's entrance -----------------------------------------------------------------
    var board = (function () {
      var spot = null;
      [[-pg.r - 1.5, -5], [-pg.r - 1.5, 5], [-pg.r - 3, -6], [-pg.r - 3, 6], [0, -pg.r - 2]].some(function (d) {
        var x = pg.x + d[0], z = pg.z + d[1];
        if (o.staticBlocked(x, z, 1.4) || o.onPath(x, z, 0.5)) return false;
        spot = { x: x, z: z };
        return true;
      });
      spot = spot || { x: pg.x - pg.r - 3, z: pg.z - 6 };
      var g = new THREE.Group();
      [-0.9, 0.9].forEach(function (x) { S.add(S.cyl(0.12, 0.12, 2.6, 8), '#a0703c', x, 1.3, 0, g); });
      S.add(S.rbox(2.6, 1.6, 0.2, 0.08), '#fff6e0', 0, 2.5, 0, g);
      var dice = new THREE.MeshBasicMaterial({ map: S.emoji('🎲'), transparent: true });
      [0, Math.PI].forEach(function (turn) {
        var paint = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.3), dice);
        paint.position.set(0, 2.5, turn ? -0.11 : 0.11);
        paint.rotation.y = turn;
        g.add(paint);
      });
      // A sprite always faces the camera, so the name floats above the panel where it can never clip into it.
      var name = S.sprite(S.label('🎲 Games', '#ff9e6b'), 2.8, 2.8 * 180 / 512);
      name.position.set(0, 3.85, 0);
      g.add(name);
      // Its face (+z) turned away from the playground, toward her as she comes along the path.
      g.position.set(spot.x, 0, spot.z);
      g.lookAt(spot.x + (spot.x - pg.x), 0, spot.z + (spot.z - pg.z));
      S.scene.add(g);
      return { x: spot.x, z: spot.z, group: g };
    })();

    // --- the Patintero court on the open lawn west of the street (always there; it blocks nothing) -------------
    var P = W.Patintero, court = P.court(COURT_AT[0], COURT_AT[1]);
    (function () {
      var g = new THREE.Group(), c = court, end = P.COURT.end, chalk = '#fbfaf2';
      S.add(S.rbox(c.w + 1, 0.04, c.len + 2 * end, 0.02), '#d9b98a', c.cx, 0.02, c.cz, g);
      [c.home].concat(c.cross, [c.far]).forEach(function (z) { S.add(S.rbox(c.w, 0.05, 0.22, 0.01), chalk, c.cx, 0.05, z, g); });
      [c.minX, c.maxX].forEach(function (x) { S.add(S.rbox(0.22, 0.05, c.len, 0.01), chalk, x, 0.05, c.cz, g); });
      S.add(S.rbox(0.22, 0.05, c.mid.from - c.mid.to, 0.01), chalk, c.mid.x, 0.05, (c.mid.from + c.mid.to) / 2, g);
      S.add(S.cyl(0.12, 0.12, 2.4, 8), '#a0703c', c.minX - 0.8, 1.2, c.home + end - 0.6, g);
      var name = S.sprite(S.label('🏃 Patintero', '#6bb8ff'), 3.2, 3.2 * 180 / 512);
      name.position.set(c.minX - 0.8, 2.9, c.home + end - 0.6);
      g.add(name);
      S.scene.add(g);
    })();
    function onCourt(x, z, m) {
      return x > court.minX - m && x < court.maxX + m && z > court.far - P.COURT.end - m && z < court.home + P.COURT.end + m;
    }

    // --- props --------------------------------------------------------------------------------------------------
    function model(kind) {
      var g = new THREE.Group();
      if (kind === 'bush' || kind === 'flowers') {
        [[0, 1.2, 0, 1.4], [-1, 0.9, 0.3, 1.05], [1, 0.95, -0.2, 1.1], [0.2, 2, 0.1, 0.95]].forEach(function (b) { S.add(S.ball(b[3]), '#5fbf6a', b[0], b[1], b[2], g); });
        if (kind === 'flowers') [[-0.6, 2.3, 0.7], [0.8, 1.9, 0.8], [0.1, 2.8, 0.4], [-1.2, 1.5, 0.9], [1.3, 1.4, 0.5]].forEach(function (f) { S.add(S.ball(0.26), '#ff8fc8', f[0], f[1], f[2], g); });
      } else if (kind === 'crates') {
        S.add(S.rbox(2, 1.6, 2, 0.08), '#c8925a', -0.5, 0.8, 0, g);
        S.add(S.rbox(1.6, 1.4, 1.6, 0.08), '#b07a45', 0.6, 0.7, 0.2, g).rotation.y = 0.4;
        S.add(S.rbox(1.5, 1.3, 1.5, 0.08), '#d6a26a', -0.2, 2.25, 0, g).rotation.y = -0.3;
      } else if (kind === 'barrel') {
        S.add(S.cyl(1.1, 1.1, 2.8, 16), '#9a6236', 0, 1.4, 0, g);
        [0.5, 2.3].forEach(function (y) { S.add(S.cyl(1.14, 1.14, 0.18, 16), '#5a5a62', 0, y, 0, g); });
      } else if (kind === 'hay') {
        S.add(S.rbox(2.6, 1.4, 1.6, 0.25), '#f2cf6b', 0, 0.7, 0, g);
        S.add(S.rbox(1.8, 1.3, 1.5, 0.25), '#e8c35a', 0.2, 2, 0, g);
      } else {
        S.add(S.rbox(2.4, 2.4, 2.4, 0.06), '#d9b48a', 0, 1.2, 0, g);
        S.add(S.rbox(2.42, 0.3, 0.6, 0.02), '#c79a6a', 0, 2.4, 0, g);
      }
      return g;
    }

    function putProps(list) {
      clearProps();
      props = list.map(function (p) {
        var g = model(p.kind);
        g.position.set(p.x, 0, p.z);
        g.rotation.y = rand() * Math.PI * 2;
        S.scene.add(g);
        return { p: p, group: g };
      });
    }
    function clearProps() {
      props.forEach(function (q) { S.scene.remove(q.group); });
      props = [];
    }

    // Props and the board block walking (her, the kids, her pet, the gifts and monsters).
    function blocked(x, z, r) {
      if (Math.hypot(board.x - x, board.z - z) < 1.2 + r) return true;
      for (var i = 0; i < props.length; i++) if (Math.hypot(props[i].p.x - x, props[i].p.z - z) < props[i].p.r + r) return true;
      return false;
    }

    function okSpot(x, z) {
      return !o.staticBlocked(x, z, 2.4) && !o.onPath(x, z, 1.5) && Math.hypot(x - her.x, z - her.z) > 4 && Math.hypot(x - board.x, z - board.z) > 4 && !onCourt(x, z, 3);
    }

    // --- HUD ----------------------------------------------------------------------------------------------------
    function el(tag, cls, text) {
      var e = doc.createElement(tag);
      e.className = cls;
      if (text !== undefined) e.textContent = text;
      return e;
    }
    function button(cls, text, onClick) {
      var b = el('button', cls, text);
      b.type = 'button';
      b.addEventListener('click', function (e) { e.stopPropagation(); onClick(); });
      return b;
    }
    var pill = el('div', 'g-pill'), pillText = el('span', 'g-pill-text'), hint = el('div', 'g-hint');
    // Her eyes are covered while she counts: the cover hides the whole view, so she never sees where anyone hides.
    var count = el('div', 'g-count'), countEyes = el('div', 'g-count-eyes', '🙈'), countN = el('div', 'g-count-n');
    var danger = el('div', 'g-danger'), noise = el('div', 'g-noise');
    noise.setAttribute('aria-hidden', 'true');
    count.appendChild(countEyes);
    count.appendChild(countN);
    var endBtn = button('g-end', B.end, function () { end(null); });
    var disBtn = button('g-act g-disguise', B.disguise, function () { toggleDisguise(); });
    var booBtn = button('g-act g-boo', B.boo, function () { doBoo(); });
    pill.appendChild(pillText);
    pill.appendChild(endBtn);
    count.setAttribute('aria-live', 'assertive');
    hint.setAttribute('aria-live', 'polite');
    [pill, hint, count, danger, disBtn, booBtn, noise].forEach(function (n) { n.hidden = true; doc.body.appendChild(n); });

    function nameOf(id) { return isSis(id) ? sis.name : String(M.nameOf(id)).split(' · ').pop(); }
    function faceOf(id) { return isSis(id) ? sis.face : M.face(id); }
    function popOf(id, text) { if (isSis(id)) sis.pop(text); else M.pop(id, text); }
    function clock(s) { s = Math.ceil(s); return Math.floor(s / 60) + ':' + (s % 60 < 10 ? '0' : '') + (s % 60); }
    // The HUD is refreshed every frame: writing an unchanged value still makes the browser restyle the page.
    function show(n, on) { if (n.hidden === on) n.hidden = !on; }
    function setText(n, text) { if (n.textContent !== text) n.textContent = text; }
    function setOpacity(n, v) { v = String(Math.round(v * 20) / 20); if (n.style.opacity !== v) n.style.opacity = v; }

    function hud() {
      var s = state();
      if (!s || s.done) {
        [pill, hint, count, danger, disBtn, booBtn, noise].forEach(function (n) { show(n, false); });
        return;
      }
      if (s.kind === 'patintero') return patHud(s);
      var line;
      if (s.kind === 'tag') line = s.it === 'her' ? LT.youreIt : G.fill(s.freeze ? LT.kidCount : LT.kidIt, { name: nameOf(s.it), n: s.count });
      else if (s.kind === 'seek') line = s.phase === 'count' ? G.fill(LT.seekCount, { n: s.count }) : G.fill(LT.found, { f: s.found, n: s.total });
      else line = s.phase === 'count' ? G.fill(LT.hideCount, { name: nameOf(s.seeker), n: s.count }) : G.fill(LT.seeking, { name: nameOf(s.seeker) });
      setText(pillText, W.Talk.shown(line) + (s.left !== null ? ' · ⏱️ ' + clock(s.left) : ''));
      show(pill, true);
      var big = s.kind === 'seek' && s.phase === 'count' ? s.count : 0;
      show(count, !!big);
      if (big) setText(countN, String(big));
      show(hint, hintT > 0);
      show(noise, noiseT > 0);
      show(danger, !!s.danger);
      if (s.danger && s.chaseD !== null) setOpacity(danger, Math.max(0.35, Math.min(1, 1.3 - s.chaseD / G.TAG.safe)));
      show(disBtn, !disguise && !!game.disguiseProp(her));
      show(booBtn, !!game.booReady(her));
    }

    // Her job under the pill, unless a swap or a point is being announced.
    function patHud(s) {
      setText(pillText, '🏃 Patintero 🔵 ' + s.score.blue + ' – ' + s.score.red + ' 🔴' + ' · ⏱️ ' + clock(s.left));
      show(pill, true);
      if (!(hintT > 0)) setText(hint, W.Talk.shown(s.running ? LT.patRun : LT.patGuard));
      show(hint, true);
      [count, disBtn, booBtn].forEach(function (n) { show(n, false); });
      show(danger, !!s.danger);
      if (s.danger && s.chaseD !== null) setOpacity(danger, Math.max(0.35, Math.min(1, 1.3 - s.chaseD / P.RULES.danger)));
    }

    // --- the team rings at Patintero players' feet -------------------------------------------------------------
    function makeRings(s) {
      clearRings();
      rings = { group: new THREE.Group(), of: {} };
      ['blue', 'red'].forEach(function (team) {
        s.team[team].forEach(function (id) { rings.of[id] = S.add(S.cyl(0.95, 0.95, 0.05, 24), RING[team], 0, 0.06, 0, rings.group); });
      });
      S.scene.add(rings.group);
      moveRings();
    }
    function moveRings() {
      if (!rings) return;
      Object.keys(rings.of).forEach(function (id) {
        var p = id === 'her' ? her : cast.where(id);
        if (p) rings.of[id].position.set(p.x, 0.06, p.z);
      });
    }
    function clearRings() {
      if (rings) S.scene.remove(rings.group);
      rings = null;
    }
    // Everyone sparkles to their spots for a turn (her own spot sparkles as she is placed).
    function sparkleKids() {
      var s = pat.state();
      if (s) s.ids.forEach(function (id) { var p = cast.where(id); o.built.sparkle(p.x, p.z); });
    }

    // --- her disguise -------------------------------------------------------------------------------------------
    function toggleDisguise() {
      if (disguise) return undisguise();
      var p = game.disguiseProp(her);
      if (!p) return;
      var kind = G.DISGUISES.indexOf(p.kind) >= 0 ? p.kind : G.DISGUISES[Math.floor(rand() * G.DISGUISES.length) % G.DISGUISES.length];
      disguise = { group: model(kind), at: { x: her.x, z: her.z } };
      disguise.group.position.set(her.x, 0, her.z);
      S.scene.add(disguise.group);
      o.built.sparkle(her.x, her.z);
      o.hideMe(true);
      o.sfx('emote-giggle');
      hud();
    }
    function undisguise() {
      if (!disguise) return;
      S.scene.remove(disguise.group);
      disguise = null;
      o.hideMe(false);
    }

    function doBoo() {
      handle(game.boo(her));
    }

    // --- talking ------------------------------------------------------------------------------------------------
    function say(face, who, text, buttons, sub) {
      if (talk) talk.close();
      o.busy(true);
      var mine = talk = W.Talk.open({
        doc: doc, face: face, who: who, text: text, sub: sub || '', pair: grade === 'grade2', buttons: buttons,
        onClose: function () { if (talk === mine) { talk = null; o.busy(false); } }
      });
    }

    // --- starting and ending ------------------------------------------------------------------------------------
    // kind: 'tag', 'seek' (she seeks), 'hide' (she hides) or 'patintero'; first: the kid who asked or was asked.
    function start(kind, first) {
      if (playing()) return false;
      var all = M.ids(), others = all.filter(function (id) { return id !== first; });
      others.sort(function (a, b) {
        var pa = mind.where(a), pb = mind.where(b);
        return Math.hypot(pa.x - her.x, pa.z - her.z) - Math.hypot(pb.x - her.x, pb.z - her.z);
      });
      // PLAYERS kids, and her sister on top when she is here; Patintero takes PAT_KIDS players in all.
      var want = kind === 'patintero' ? PAT_KIDS - (sis ? 1 : 0) : PLAYERS;
      var ids = [first].concat(others).filter(Boolean).slice(0, isSis(first) ? want + 1 : want);
      if (sis && ids.indexOf(sis.id) < 0) ids.push(sis.id);
      ids.forEach(function (id, n) {
        cast.game(id, true);
        var p = cast.where(id);
        // Patintero puts everyone on the court anyway.
        if (kind !== 'patintero' && Math.hypot(p.x - her.x, p.z - her.z) > POP_IN) {
          var spot = L.freeSpot(grade, her.x, her.z, n * 1.4 + 0.7, 5 + n);
          cast.put(id, { x: spot.x, z: spot.z });
          o.built.sparkle(spot.x, spot.z);
        }
      });
      if (kind === 'patintero') {
        // Play again starts the other way round.
        var herRuns = !(last && last.kind === 'patintero' && last.herRuns);
        last = { kind: kind, first: first, ids: ids, herRuns: herRuns };
        var pev = pat.start(ids, her, court, sis ? sis.id : null, herRuns);
        o.sfx('ride-start');
        handle(pev);
        makeRings(pat.state());
        sparkleKids();
        return true;
      }
      if (kind === 'tag') putProps(G.props([{ x: her.x, z: her.z, r: G.TAG.area * 0.8 }], G.TAG.props, rand, okSpot));
      else putProps(G.props(hangouts, G.SEEK.props, rand, okSpot));
      var list = props.map(function (q) { return q.p; }), ev;
      if (kind === 'tag') ev = game.startTag(ids, her, list);
      else if (kind === 'seek') ev = game.startSeek(ids, her, list);
      else ev = game.startHide(ids, her, list, last && last.seeker && ids.indexOf(last.seeker) >= 0 ? last.seeker : ids[0]);
      last = { kind: kind, first: first, ids: ids };
      if (kind === 'seek') o.freeze(true);
      o.sfx('ride-start');
      handle(ev);
      return true;
    }

    function release() {
      var s = state();
      if (s) s.ids.forEach(function (id) { cast.game(id, false); });
      hintT = 0;
      noiseT = 0;
      undisguise();
      clearProps();
      clearRings();
      o.freeze(false);
      game.stop();
      pat.stop();
      hud();
    }

    // result null: she ended it (✖, a door, quick travel, the nudge): no bubble.
    function end(result, kid) {
      var s = state();
      if (!s) return;
      var speaker = kid || (last && last.first) || s.ids[0];
      if (s.kind === 'hide') last.seeker = s.seeker;
      else if (s.kind === 'seek') last.seeker = s.ids[s.ids.length - 1];
      else if (s.kind === 'patintero') last.herRuns = s.herRuns;
      release();
      if (!result) return;
      var a = s.score ? s.score.blue : 0, b = s.score ? s.score.red : 0, line;
      if (s.kind === 'patintero') line = result === 'win' ? LT.patWin(a, b) : result === 'lose' ? LT.patLose(a, b) : LT.patTie(a, b);
      else {
        line = result === 'tagEnd' ? LT.tagEnd(s.tagged, s.escaped)
          : result === 'allFound' ? LT.allFound : result === 'timeUp' ? LT.timeUp : result === 'foundYou' ? G.fill(LT.foundYou, { name: nameOf(kid) })
            : result === 'boo' ? G.fill(LT.boo, { name: nameOf(kid) }) : LT.bestHider;
      }
      var next = s.kind === 'tag' ? 'tag' : s.kind === 'patintero' ? 'patintero' : s.kind === 'seek' ? 'hide' : 'seek';
      var why = LT.why[Math.floor(rand() * LT.why.length) % LT.why.length];
      o.sfx('emote-cheer');
      o.built.cheer(her.x, 4.5, her.z);
      say(faceOf(speaker), nameOf(speaker), line, [
        { text: B.again, main: true, onClick: function () { start(next, speaker); } },
        { text: T.bye }
      ], why);
    }

    function handle(ev) {
      ev.forEach(function (e) {
        if (e.type === 'pop') popOf(e.kid, e.text);
        else if (e.type === 'tagged' || e.type === 'gotYou' || e.type === 'kidTagged') o.sfx('catch');
        else if (e.type === 'found' || e.type === 'kidFound') o.sfx('mate-giggle');
        else if (e.type === 'sneak') o.sfx('emote-giggle');
        else if (e.type === 'noise') {
          o.sfx('mate-giggle', { gain: 0.5 + e.near * 1.5 });
          noise.textContent = e.near > 0.66 ? '🔊' : e.near > 0.33 ? '🔉' : '🔈';
          noiseT = NOISE_TIME;
        }
        else if (e.type === 'hint') {
          // Only the place, never the spot: no marker over the prop.
          o.sfx('emote-giggle');
          hint.textContent = W.Talk.shown(LT.hint(LT.places[e.place] || null));
          hintT = HINT_TIME;
        } else if (e.type === 'lunge') o.sfx('emote-spin');
        else if (e.type === 'danger') {
          beatT = 0;
          if (e.escaped) o.sfx('emote-clap');
        } else if (e.type === 'go') {
          o.freeze(false);
          o.sfx('ride-start');
          if (pat.playing() && pat.state().team.blue[1]) popOf(pat.state().team.blue[1], P.POPS.go);
        } else if (e.type === 'place') {
          her.x = e.x;
          her.z = e.z;
          o.place(e.x, e.z, e.face);
          o.freeze(true);
          o.built.sparkle(e.x, e.z);
        } else if (e.type === 'count' && pat.playing()) {
          var who = pat.state().team.blue[1];
          if (who && (e.n === 3 || e.n === 2)) popOf(who, e.n === 3 ? P.POPS.ready : P.POPS.set);
        } else if (e.type === 'swap') {
          o.sfx('catch');
          hint.textContent = W.Talk.shown(e.herTeam === 'tagged' ? LT.patTagged : LT.patTagger);
          hintT = HINT_TIME;
          sparkleKids();
        } else if (e.type === 'score') {
          o.sfx(e.team === 'blue' ? 'emote-cheer' : 'emote-clap');
          hint.textContent = W.Talk.shown(e.team === 'blue' ? LT.patScore : LT.patTheyScore);
          hintT = HINT_TIME;
        } else if (e.type === 'boo') o.sfx('emote-giggle');
        else if (e.type === 'end') end(e.result, e.kid);
      });
      hud();
    }

    // --- a friend asks her to play ------------------------------------------------------------------------------
    function invite(dt) {
      if (asking) {
        var p = mind.where(asking.id);
        if (Math.hypot(p.x - her.x, p.z - her.z) <= ASK_NEAR || (asking.t += dt) > 12) {
          var id = asking.id, kind = asking.kind;
          asking = null;
          mind.put(id, { still: true, face: Math.atan2(her.x - p.x, her.z - p.z) });
          if (!o.free()) return mind.game(id, false);
          say(M.face(id), nameOf(id), kind === 'tag' ? LT.inviteTag : kind === 'patintero' ? LT.inviteRun : LT.inviteSeek, [
            { text: B.yes, main: true, onClick: function () { mind.game(id, false); start(kind, id); } },
            { text: B.no, onClick: function () { mind.game(id, false); M.pop(id, '👋'); } }
          ]);
          return;
        }
        mind.move(asking.id, her.x, her.z, 5.5, dt);
        return;
      }
      if (!o.free() || playing()) return;
      if ((inviteT -= dt) > 0) return;
      inviteT = INVITE_MIN + rand() * (INVITE_MAX - INVITE_MIN);
      var near = M.friends().filter(function (id) {
        var q = mind.where(id);
        return Math.hypot(q.x - her.x, q.z - her.z) <= INVITE_NEAR;
      });
      if (!near.length) return;
      var who = near[Math.floor(rand() * near.length) % near.length];
      if (!mind.game(who, true)) return;
      asking = { id: who, kind: G.GAMES[Math.floor(rand() * G.GAMES.length) % G.GAMES.length], t: 0 };
    }

    // The closer the chaser, the faster her heart beats.
    function heartbeat(dt) {
      var s = state();
      if (!s || s.done || !s.danger || s.chaseD === null) return;
      if ((beatT -= dt) > 0) return;
      o.sfx('heartbeat');
      beatT = 0.35 + 0.05 * s.chaseD;
    }

    // --- each frame ---------------------------------------------------------------------------------------------
    // st: ctl.state; frozen: a card, the maker or a stall is open.
    function tick(t, dt, st, frozen) {
      her.x = st.x;
      her.z = st.z;
      if (disguise && (Math.hypot(st.x - disguise.at.x, st.z - disguise.at.z) > 0.3 || st.mag > 0)) undisguise();
      if (hintT > 0) hintT -= dt;
      if (noiseT > 0) noiseT -= dt;
      if (frozen || talk) return;
      if (pat.playing()) {
        var pev = pat.tick(dt, { x: st.x, z: st.z });
        if (pev.length) handle(pev);
        else hud();
        heartbeat(dt);
        moveRings();
      } else if (game.playing()) {
        var ev = game.tick(dt, { x: st.x, z: st.z, still: !(st.mag > 0), disguised: !!disguise });
        if (ev.length) handle(ev);
        else hud();
        heartbeat(dt);
      } else invite(dt);
    }

    function items() {
      return playing() ? [] : [{ kind: 'gameboard', id: 'gameboard', x: board.x, z: board.z, r: BOARD_R }];
    }
    // The two-step pick: a group, then its game. first: the kid who asked or was asked, or null at the board (the
    // nearest kid plays first then).
    function choose(first) {
      if (talk || playing()) return;
      var who = first || M.nearest(her);
      say(first ? faceOf(first) : '🎲', first ? nameOf(first) : String(LT.boardName).split(' · ').pop(), LT.kinds,
        G.GROUPS.map(function (g) {
          return { text: B[g.id], main: g.id === 'chase', onClick: function () { pickGame(g, who, first); } };
        }).concat([{ text: T.bye }]));
    }
    // A group with one game starts it straight away.
    function pickGame(g, who, first) {
      if (g.games.length === 1) return start(g.games[0], who);
      say(first ? faceOf(first) : '🎲', first ? nameOf(first) : String(LT.boardName).split(' · ').pop(), LT.groups[g.id],
        g.games.map(function (id, n) { return { text: B[id], main: n === 0, onClick: function () { start(id, who); } }; })
          .concat([{ text: B.back, onClick: function () { choose(first); } }, { text: T.bye }]));
    }
    function act(it) {
      if (it.kind !== 'gameboard') return;
      choose(null);
    }

    return {
      start: start, choose: choose, tick: tick, items: items, act: act, blocked: blocked,
      label: function () { return B.board; },
      handles: function (kind) { return kind === 'gameboard'; },
      playing: playing,
      stop: function () { if (playing()) end(null); if (asking) { mind.game(asking.id, false); asking = null; } },
      fence: function (x, z) { return pat.fence(x, z); },
      disguised: function () { return !!disguise; },
      closeTalk: function () { if (talk) talk.close(); },
      debug: {
        state: function () {
          var s = state();
          if (!s) return null;
          var more = { props: s.props.length };
          if (s.kind === 'patintero') {
            more.rings = rings ? Object.keys(rings.of).length : 0;
            more.fenced = { side: pat.fence(court.maxX + 1, court.cz), mid: pat.fence(court.mid.x + 1, court.cz) };
          }
          return Object.assign({
            disguised: !!disguise, pill: pill.hidden ? null : pillText.textContent, cover: count.hidden ? null : countN.textContent,
            hint: hint.hidden ? null : hint.textContent, glow: !danger.hidden, booShown: !booBtn.hidden, disguiseShown: !disBtn.hidden
          }, s, more);
        },
        court: function () { return court; },
        rings: function () { return rings ? Object.keys(rings.of).length : 0; },
        props: function () { return props.map(function (q) { return { kind: q.p.kind, x: q.p.x, z: q.p.z }; }); },
        board: function () { return { x: board.x, z: board.z }; },
        boo: doBoo, disguise: toggleDisguise, end: function () { end(null); },
        invite: function () { inviteT = 0; },
        asking: function () { return asking ? asking.id : null; },
        place: function (id, x, z) { return cast.put(id, { x: x, z: z }); },
        where: function (id) { return cast.where(id); }
      }
    };
  }

  W.Games3D = { create: create };
})(this);
