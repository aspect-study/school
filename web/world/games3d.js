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
   while she runs and on the middle line while she guards. Every tag plays the last seconds again in slow motion
   (replay.js) with the camera moved in on the tag, and Skip ⏭; the game waits meanwhile. The end bubble offers 🔁 Play again (roles swap in
   hide-and-seek, sides in Patintero) and says, in a kid's voice, one reason the game is good for her. */
(function (root) {
  'use strict';
  var W = root.World3D = root.World3D || {};
  var PLAYERS = 4, POP_IN = 40, BOARD_R = 2.8, INVITE_MIN = 240, INVITE_MAX = 360, INVITE_NEAR = 30, ASK_NEAR = 3, HINT_TIME = 7, NOISE_TIME = 1.4;
  // Patintero: 7 players besides her (her sister counts as one); RING: the team rings' colours.
  var COURT_AT = [-57, -63], PAT_KIDS = 7, RING = { blue: '#4a8cff', red: '#ff5a5a' };
  // The replay's speed (0.3: 2.5 s of play last about 8 s); KID_RUN: the speed at which a kid's legs swing fully.
  var REPLAY_SPEED = 0.3, KID_RUN = 5.5;

  // o = { S, built, grade, T, doc?, busy(on), freeze(on), sfx(name), mates (Mates3D api), staticBlocked(x, z, r),
  //       onPath(x, z, margin), free() → she can be asked to play, hideMe(on), rand, sister() → kin.js player() or null,
  //       place(x, z, face) → puts her there (Patintero's turns), herGroup() → her avatar's group,
  //       pose(x, z, face, walk, mag) → moves her for the replay, focus({ x, z } or null) → the camera on the tag }
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
      game: function (id, on) { return isSis(id) ? sis.game(on) : mind.game(id, on); },
      group: function (id) { return isSis(id) ? sis.group() : M.group(id); }
    };
    var game = G.create({ rand: rand, move: cast.move, where: cast.where, put: cast.put });
    var pat = W.Patintero.create({ rand: rand, move: cast.move, where: cast.where, put: cast.put });
    // Whichever game is on (or just ended, until release()).
    function playing() { return game.playing() || pat.playing(); }
    function state() { return pat.state() || game.state(); }
    var props = [], disguise = null, talk = null, last = null, inviteT = INVITE_MIN + rand() * (INVITE_MAX - INVITE_MIN), asking = null;
    var her = { x: 0, z: 0 }, hintT = 0, noiseT = 0, beatT = 0, rings = null, bibs = [];
    var rec = W.Replay.create(), replaying = null;

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
    var roster = el('div', 'g-roster'), rosterKey = '';
    roster.setAttribute('aria-label', 'Players');
    // The replay's bar sits where the hint does (the hint is hidden meanwhile); English on both grades.
    var replayBar = el('div', 'g-replay'), replaySkip = button('g-replay-skip', 'Skip ⏭', function () { if (replaying) replaying.player.skip(); });
    replayBar.appendChild(el('span', 'g-replay-text', '🎬 Replay'));
    replayBar.appendChild(replaySkip);
    [pill, hint, roster, count, danger, disBtn, booBtn, noise, replayBar].forEach(function (n) { n.hidden = true; doc.body.appendChild(n); });

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
        [pill, hint, roster, count, danger, disBtn, booBtn, noise].forEach(function (n) { show(n, false); });
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
      showRoster(s);
    }

    function chip(id, cls) {
      var c = el('span', 'g-chip' + (cls ? ' ' + cls : ''));
      c.appendChild(el('span', 'g-chip-face', id === 'her' ? '🙂' : faceOf(id)));
      c.appendChild(el('span', 'g-chip-name', id === 'her' ? 'You' : nameOf(id)));
      return c;
    }
    // Rebuilt only when the players or the one who is "it" change.
    function showRoster(s) {
      var rows = s.kind === 'patintero' ? [['blue', s.team.blue], ['red', s.team.red]] : [['', ['her'].concat(s.ids)]];
      var key = s.kind + '|' + (s.it || '') + '|' + (s.seeker || '') + '|' + rows.map(function (r) { return r[1].join(','); }).join('/');
      show(roster, true);
      if (key === rosterKey) return;
      rosterKey = key;
      roster.textContent = '';
      rows.forEach(function (r) {
        var row = el('div', 'g-roster-row' + (r[0] ? ' ' + r[0] : ''));
        r[1].forEach(function (id) {
          var chaser = (s.kind === 'tag' && s.it === id) || (s.kind === 'hide' && s.seeker === id) || (s.kind === 'seek' && id === 'her');
          row.appendChild(chip(id, chaser ? 'it' : isSis(id) ? 'sis' : ''));
        });
        roster.appendChild(row);
      });
    }

    // --- name tags over the other players -----------------------------------------------------------------------
    var tags = null, TAG_FAR = 40, TAG_Y = 6.4, TAG_CAM = 9;
    function makeTags(s) {
      clearTags();
      tags = { group: new THREE.Group(), of: {} };
      s.ids.forEach(function (id) {
        var sp = S.sprite(S.label(nameOf(id), '#8a5fd0'), 2.4, 2.4 * 180 / 512);
        tags.of[id] = sp;
        tags.group.add(sp);
      });
      S.scene.add(tags.group);
      moveTags(s);
    }
    // A kid hiding in hide-and-seek gets no tag: it would give the spot away. Nor does a kid right by the camera (the
    // Patintero replay's camera stands among the players), whose tag would fill the view.
    function moveTags(s) {
      if (!tags || !s) return;
      var cam = S.camera.position;
      Object.keys(tags.of).forEach(function (id) {
        var p = cast.where(id), sp = tags.of[id];
        var far = !p || Math.hypot(p.x - her.x, p.z - her.z) > TAG_FAR || (s.hidden && s.hidden.indexOf(id) >= 0) || Math.hypot(p.x - cam.x, p.z - cam.z) < TAG_CAM;
        sp.visible = !far;
        if (!far) sp.position.set(p.x, TAG_Y, p.z);
      });
    }
    function clearTags() {
      if (!tags) return;
      S.scene.remove(tags.group);
      Object.keys(tags.of).forEach(function (id) { tags.of[id].material.map.dispose(); tags.of[id].material.dispose(); });
      tags = null;
    }

    // Her job under the pill, unless a swap or a point is being announced.
    function patHud(s) {
      setText(pillText, '🏃 Patintero 🔵 ' + s.score.blue + ' – ' + s.score.red + ' 🔴' + ' · ⏱️ ' + clock(s.left));
      show(pill, true);
      if (!(hintT > 0)) setText(hint, W.Talk.shown(s.running ? LT.patRun : LT.patLane[s.herPost] || LT.patLane.mid));
      show(hint, true);
      [count, disBtn, booBtn].forEach(function (n) { show(n, false); });
      show(danger, !!s.danger);
      if (s.danger && s.chaseD !== null) setOpacity(danger, Math.max(0.35, Math.min(1, 1.3 - s.chaseD / P.RULES.danger)));
      showRoster(s);
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
    // A coloured bib over the outfit, a child of the character so it walks, turns and hides with them.
    function wearBibs(s) {
      removeBibs();
      ['blue', 'red'].forEach(function (team) {
        s.team[team].forEach(function (id) {
          var g = id === 'her' ? (o.herGroup && o.herGroup()) : cast.group(id);
          if (!g) return;
          var bib = new THREE.Group();
          S.add(S.cyl(0.98, 1.08, 0.9, 24), RING[team], 0, 2.4, 0, bib);
          g.add(bib);
          bibs.push({ g: g, bib: bib });
        });
      });
    }
    function removeBibs() {
      bibs.forEach(function (b) { b.g.remove(b.bib); });
      bibs = [];
    }
    // Everyone sparkles to their spots for a turn (her own spot sparkles as she is placed).
    function sparkleKids() {
      var s = pat.state();
      if (s) s.ids.forEach(function (id) { var p = cast.where(id); o.built.sparkle(p.x, p.z); });
    }

    // --- the slow-motion replay of a Patintero tag ---------------------------------------------------------------
    function snapshot(st) {
      var at = { her: { x: st.x, z: st.z, face: st.face } };
      pat.state().ids.forEach(function (id) {
        var p = cast.where(id);
        if (p) at[id] = { x: p.x, z: p.z, face: p.face || 0 };
      });
      return at;
    }
    // The tag's events wait: the swap has already lined everyone up for the next turn, so those spots are kept for
    // after, and her own new spot is in the events' 'place'.
    function startReplay(events) {
      var clip = rec.clip(), tag = events.filter(function (e) { return e.type === 'swap'; })[0];
      rec.clear();
      if (clip.length < 2) return handle(events);
      var after = {};
      pat.state().ids.forEach(function (id) {
        var p = cast.where(id);
        if (p) after[id] = { x: p.x, z: p.z, face: p.face };
      });
      var player = W.Replay.player(clip, REPLAY_SPEED);
      replaying = { player: player, events: events, after: after, was: player.tick(0), pair: [tag.by, tag.kid] };
      o.freeze(true);
      replayFocus(replaying.was);
      o.sfx('catch');
      [hint, danger].forEach(function (n) { show(n, false); });
      show(replayBar, true);
    }
    // The camera stays on the guard and the runner of the tag, so it ends on the spot where it happened.
    function replayFocus(at) {
      var a = at[replaying.pair[0]] || at.her, b = at[replaying.pair[1]] || at.her;
      o.focus({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 });
    }
    // Everyone where the clip has them, legs swinging at the speed they really went.
    function replayTick(dt) {
      var r = replaying, at = r.player.tick(dt), played = dt * REPLAY_SPEED;
      Object.keys(at).forEach(function (id) {
        var p = at[id], q = r.was[id] || p, walk = Math.hypot(p.x - q.x, p.z - q.z), speed = played > 0 ? walk / played : 0;
        if (id === 'her') {
          her.x = p.x;
          her.z = p.z;
          o.pose(p.x, p.z, p.face, walk, Math.min(1, speed / W.Walk.SPEED));
        } else cast.put(id, { x: p.x, z: p.z, face: p.face, walk: walk, mag: Math.min(1, speed / KID_RUN) });
      });
      r.was = at;
      replayFocus(at);
      moveRings();
      moveTags(pat.state());
      if (r.player.done()) endReplay();
    }
    function endReplay() {
      var r = replaying;
      replaying = null;
      show(replayBar, false);
      o.focus(null);
      Object.keys(r.after).forEach(function (id) {
        var p = r.after[id];
        cast.put(id, { x: p.x, z: p.z, face: p.face, still: true });
      });
      handle(r.events);
      moveRings();
      moveTags(pat.state());
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
        wearBibs(pat.state());
        makeTags(pat.state());
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
      makeTags(game.state());
      return true;
    }

    function release() {
      var s = state();
      if (replaying) {
        replaying = null;
        o.focus(null);
      }
      show(replayBar, false);
      rec.clear();
      if (s) s.ids.forEach(function (id) { cast.game(id, false); });
      hintT = 0;
      noiseT = 0;
      undisguise();
      clearProps();
      clearRings();
      removeBibs();
      clearTags();
      rosterKey = '';
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

    var HIDE_BEAT = 10;
    // Distance of the one chasing or seeking her, or null when nobody is: tag and Patintero use the danger flag, a hider hears the seeker.
    function chaserDistance(s) {
      if (s.kind === 'hide') {
        if (s.phase === 'count' || !s.seeker) return null;
        var p = cast.where(s.seeker);
        var d = p ? Math.hypot(p.x - her.x, p.z - her.z) : null;
        return d !== null && d <= HIDE_BEAT ? d : null;
      }
      return s.danger && s.chaseD !== null ? s.chaseD : null;
    }

    // The closer the chaser, the faster her heart beats.
    function heartbeat(dt) {
      var s = state();
      if (!s || s.done) return;
      var d = chaserDistance(s);
      if (d === null) return;
      if ((beatT -= dt) > 0) return;
      o.sfx('heartbeat');
      beatT = 0.35 + 0.05 * d;
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
      // The game waits while a tag plays again: no pat.tick, so its clock stands still too.
      if (replaying) return replayTick(dt);
      if (pat.playing()) {
        rec.push(dt, snapshot(st));
        var pev = pat.tick(dt, { x: st.x, z: st.z });
        if (pev.some(function (e) { return e.type === 'swap'; })) startReplay(pev);
        else if (pev.length) handle(pev);
        else hud();
        heartbeat(dt);
        moveRings();
        moveTags(pat.state());
      } else if (game.playing()) {
        var ev = game.tick(dt, { x: st.x, z: st.z, still: !(st.mag > 0), disguised: !!disguise });
        if (ev.length) handle(ev);
        else hud();
        heartbeat(dt);
        moveTags(game.state());
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
          var more = {
            props: s.props.length, roster: roster.hidden ? null : roster.textContent,
            chips: roster.hidden ? [] : [].map.call(roster.querySelectorAll('.g-chip'), function (c) { return { name: c.lastChild.textContent, cls: c.className.replace('g-chip', '').trim() }; }),
            rosterRows: roster.querySelectorAll('.g-roster-row').length,
            tags: tags ? Object.keys(tags.of).length : 0,
            tagsShown: tags ? Object.keys(tags.of).filter(function (id) { return tags.of[id].visible; }).length : 0
          };
          if (s.kind === 'patintero') {
            more.rings = rings ? Object.keys(rings.of).length : 0;
            var lane = s.herPost, onX = lane === 'mid' ? court.mid.x : court.cx, onZ = lane === 'mid' ? court.cz : court.cross[+String(lane).slice(1)];
            more.fenced = { side: pat.fence(court.maxX + 1, court.cz), off: pat.fence(lane === 'mid' ? onX + 1 : onX, lane === 'mid' ? onZ : onZ + 1.5), on: pat.fence(onX, onZ) };
            more.bibs = bibs.length;
            more.replay = !!replaying;
            more.replayBar = replayBar.hidden ? null : replayBar.textContent;
          }
          return Object.assign({
            disguised: !!disguise, pill: pill.hidden ? null : pillText.textContent, cover: count.hidden ? null : countN.textContent,
            hint: hint.hidden ? null : hint.textContent, glow: !danger.hidden, booShown: !booBtn.hidden, disguiseShown: !disBtn.hidden
          }, s, more);
        },
        court: function () { return court; },
        rings: function () { return rings ? Object.keys(rings.of).length : 0; },
        bibs: function () { return bibs.length; },
        props: function () { return props.map(function (q) { return { kind: q.p.kind, x: q.p.x, z: q.p.z }; }); },
        board: function () { return { x: board.x, z: board.z }; },
        boo: doBoo, disguise: toggleDisguise, end: function () { end(null); },
        // Like a tap on Skip ⏭: the replay ends on the next frame.
        skipReplay: function () { replaySkip.click(); },
        replayShown: function () { return !replayBar.hidden; },
        invite: function () { inviteT = 0; },
        asking: function () { return asking ? asking.id : null; },
        place: function (id, x, z) { return cast.put(id, { x: x, z: z }); },
        where: function (id) { return cast.where(id); }
      }
    };
  }

  W.Games3D = { create: create };
})(this);
