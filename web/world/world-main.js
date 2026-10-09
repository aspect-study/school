/* Starts the 3D world page: checks that 3D can run, builds the world, her character and pet, and runs the frame loop,
   doors, the mirror (character maker), quick travel, settings and music, and hands Mimi and the fort to town.js and the
   talking characters to folk.js. My Room: the sparkle hop into My Little House (her room or her sister's, drawn by
   room3d.js off the edge of the map while the outdoors hides), the 🛠️ Decorate view (decorate.js) with its camera
   above the room, the study desk, the trophy shelf, the window seat, the celebrations as she comes in, and Tito Tasyo's
   workshop. Shows the resting card if 3D cannot start, and a waking-up
   cover while the browser has taken the 3D graphics away. window.WorldDebug lets the e2e driver act like her. */
(function (root) {
  'use strict';
  var W = root.World3D = root.World3D || {};
  var doc = root.document;
  var grade = W.Layout.gradeOf(doc.body.getAttribute('data-grade'));
  var T = W.Text.localized(grade, !root.Lang || root.Lang.both());
  var lobbyUrl = '../lobby/grade-' + (grade === 'grade2' ? '2' : '5') + '.html';
  var store = root.Learner ? root.Learner.storage : root.localStorage;
  var session = null;
  try { session = root.sessionStorage; } catch (e) {}
  var debug = root.WorldDebug = { ready: false, go: function (url) { root.location.href = url; } };

  function $(id) { return doc.getElementById(id); }
  function el(tag, cls, text) {
    var e = doc.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function button(cls, text, onClick) {
    var b = el('button', cls, text);
    b.type = 'button';
    b.addEventListener('click', onClick);
    return b;
  }
  function fire(name) { try { doc.dispatchEvent(new root.CustomEvent(name)); } catch (e) {} }
  function sound(name) { try { if (root.Fx && root.Fx[name]) root.Fx[name](); } catch (e) {} }
  // Grade 2 signs are "Filipino · English"; buttons use the English half.
  function english(sign) { return sign.split(' · ').pop(); }

  function resting() {
    $('loading').hidden = true;
    $('stage').hidden = true;
    $('resting-title').textContent = T.resting;
    $('resting-line').textContent = T.restingLine;
    $('resting-go').textContent = T.toLobby;
    $('resting').hidden = false;
    fire('world-resting');
  }

  function canRun() {
    if (!root.THREE || !root.THREE.RoundedBoxGeometry) return false;
    try {
      var c = doc.createElement('canvas');
      return !!(c.getContext('webgl2') || c.getContext('webgl'));
    } catch (e) { return false; }
  }

  function start() {
    var ZOOM_STEP = 1.2;
    var L = W.Layout, prefs = W.Prefs.readPrefs(store), quality = W.Prefs.startQuality(prefs);
    var S = W.Scene.create($('stage'), quality);
    var world = W.Build.build(S, grade, T);
    var obs = L.obstacles(grade), bounds = L.GRADES[grade].bounds;
    var items = L.interactables(grade), allSpots = L.spots(grade);
    var meL = null;
    try { meL = root.Learner && root.Learner.current ? root.Learner.current() : null; } catch (e) {}
    var myBoy = !!(meL && meL.boy);
    var mine = W.Look.read(store, myBoy), look = mine.look;
    var me = null, near = null, maker = null, stall = null, stallKind = null, overlay = null, lost = false, before = null, talking = false, shown = null, riding = false;
    var music = W.Music.create(root), slow = W.Prefs.fpsWatch(30, 3), clock = new S.THREE.Clock(), t = 0;
    var sfx = W.Sfx.create(root), stepT = 0, wasMoving = false, plaza = L.places(grade).plaza;
    sfx.setOn(!(root.Fx && root.Fx.muted()), prefs.steps);
    // Her pet's events (companion.js, from petlife's heard list) as sounds.
    function petSound(name, info, type, sisterType) {
      if (name === 'pat' || name === 'chatter') sfx.voice(type, { wobble: name === 'chatter' });
      else if (name === 'treat') {
        sfx.play('treat');
        sfx.voice(type, { delay: 0.4 });
      } else if (name === 'trick-start') {
        if (info.id !== 'trick-bow') sfx.play('trick');
      } else if (name === 'trick-land' || name === 'drop') {
        sfx.play(name);
        sfx.voice(type);
      } else if (name === 'celebrate') sfx.voice(type);
      else if (name === 'play-start') {
        sfx.voice(type);
        if (sisterType) sfx.voice(sisterType, { delay: 0.7, gain: 0.5 });
      } else sfx.play(name);
    }
    function onStone(x, z) { return L.onPath(grade, x, z, 0) || Math.hypot(x - plaza.x, z - plaza.z) <= plaza.r; }
    var hud = buildHud(), paused = false;

    // Inside My Little House: { visit (her sister's room) or null, view (room3d.js), room, size, trophies, apps, grade,
    // box, solid, items, hidden (the outdoor things it hid), answers (desk answers this visit), pending (popup lines) }.
    // deco: the Decorate view while it is open (decoPanel: its panel, for the camera to look above).
    var home = null, seat = null, preview = null, deco = null, decoPanel = null;
    var ctl = W.Move.create(S, {
      win: root, canvas: S.renderer.domElement, joy: hud.joy, knob: hud.knob, tapWalk: L.GRADES[grade].tapWalk,
      blocked: function (x, z) { if (home) return roomBlocked(x, z, L.PLAYER_R); return L.blocked(obs, bounds, x, z, L.PLAYER_R) || (!!games && (games.blocked(x, z, L.PLAYER_R) || games.fence(x, z))); },
      tapHit: function (x, y) {
        if (home && deco) return decoTap(x, y);
        if (home) return !maker && !stall && !overlay && !talking && (pal.hit(x, y) || roomTap(x, y));
        return !maker && !stall && !overlay && !talking && (pal.hit(x, y) || loot.hit(x, y));
      },
      wall: function (x, z) { return L.wallAt(obs, x, z); },
      zoom: W.Prefs.ZOOM_MIN,
      canZoom: canZoom
    });
    function canZoom() { return !maker && !stall && !overlay && !deco && (!talking || !!play.riding()); }
    var pal = W.Companion.create({
      S: S, canvas: S.renderer.domElement, sound: sound, sfx: petSound,
      blocked: function (x, z, r) { return home ? roomBlocked(x, z, r) : L.blocked(obs, bounds, x, z, r) || (!!games && games.blocked(x, z, r)); },
      sparkle: function (x, z) { world.sparkle(x, z); },
      hearts: function (x, y, z) { world.hearts(x, y, z); },
      cheer: function (x, y, z) { world.cheer(x, y, z); },
      sister: function (x, z) { return kin.petNear(x, z, W.PetLife.PLAY_NEAR); }
    });
    var bar = W.PlayBar.create({
      doc: doc, T: T,
      owned: function () { return W.Closet.read(store); },
      pick: function (id) {
        if (!maker && !stall && !overlay && !talking && !riding && W.Pets.owns(W.Closet.read(store), id)) pal.play(id, ctl.state);
      },
      onOpen: function () { useBar.close(); }
    });
    var runner = W.MoveRun.create(), fxAt = new S.THREE.Vector3();
    // She does a move herself (an emote or her prop's ✨ Use); her pet watches.
    function startMove(id) {
      if (maker || stall || overlay || talking || riding || ctl.state.mag > 0 || !runner.start(id)) return false;
      pal.watch(ctl.state, W.Moves.find(id).len);
      herMove = true;
      sfx.play(id, { her: true });
      return true;
    }
    // A move ended early (a teleport, a closed stall) fades its sound; an idle has none.
    function stopMove() {
      var was = runner.stop();
      if (was && was.indexOf('idle-') !== 0) sfx.stopHer(0.2);
    }
    var useBar = W.UseBar.create({
      doc: doc, T: T,
      owned: function () { return W.Closet.read(store); },
      held: function () { return me ? me.prop : ''; },
      use: function () { if (me && me.prop) startMove(W.Moves.forProp(me.prop)); },
      pick: function (id) { if (W.Emotes.owns(W.Closet.read(store), id)) startMove(id); },
      onOpen: function () { bar.close(); }
    });
    var cheerDeps = {
      tally: function (app) { return root.World.liveDeps(root).tally(app); },
      boss: function () { return root.Boss && root.Boss.current ? root.Boss.current() : {}; },
      list: function (app) { return root.StudyHistory ? root.StudyHistory.list(null, null, app) : []; }
    };
    // As she goes into a game: the door to bring her back to, and what she had, so her pet can celebrate what she did.
    function leaving(app) {
      if (games) games.stop();
      var snap = null;
      try { snap = W.Cheer.before(app, cheerDeps, Date.now()); } catch (e) {}
      W.Prefs.setReturn(session, grade, app, snap);
    }
    function welcome(ret) {
      if (!ret || !ret.before || ret.grade !== grade) return;
      W.Prefs.dropBefore(session);
      var result = { level: 'hello' };
      try { result = W.Cheer.pick(ret.before, W.Cheer.after(ret.app, ret.before, cheerDeps)); } catch (e) {}
      pal.celebrate(W.Cheer.plan(result, W.Closet.read(store)));
    }

    // A bubble freezes her; so does counting in hide-and-seek (gameFreeze), and closing a bubble then keeps her frozen.
    var gameFreeze = false, hiddenMe = false, games = null;
    function busy(on) { talking = on; ctl.freeze(on || gameFreeze); }
    // The pet teacher (teach.js): after a wrong answer her pet shows her pick, the right answer and the lesson's steps;
    // then() runs after Got It! (or Escape).
    var teachTalk = null;
    function teacher(view, opt, then) {
      var l = W.Teach.lesson(grade, view, opt), kind = shown ? W.Pets.find(shown.pet) : null;
      if (teachTalk) teachTalk.close();
      busy(true);
      pal.teach(true, ctl.state);
      var mine = teachTalk = W.Talk.open({
        doc: doc, face: kind ? kind.icon : '🐾', who: shown ? W.Look.petName(shown) : '', text: l.hello, pair: grade === 'grade2',
        teach: l, buttons: [{ text: T.gotIt, main: true }],
        onClose: function () {
          if (teachTalk === mine) teachTalk = null;
          pal.teach(false, ctl.state);
          busy(false);
          if (then) then();
        }
      });
    }
    // A bubble, a card or the character maker is open: visitors wait instead of talking over it.
    function occupied() { return talking || !!overlay || !!maker || !!stall || !!deco; }
    function dayKeyOf(ms) { return root.Guide && root.Guide.dayKey ? root.Guide.dayKey(ms) : new Date(ms).toDateString(); }
    function today() { return dayKeyOf(Date.now()); }
    var town = W.Town.create({
      S: S, built: world, grade: grade, T: T, store: store, session: session,
      leave: leaving,
      go: function (url) { debug.go(url); }, sound: sound, busy: busy, today: today,
      isBusy: occupied,
      quiet: function () { return kin.visiting(); }
    });
    var folk = W.Folk.create({
      S: S, grade: grade, T: T, store: store, today: today, busy: busy,
      textOf: function (html) { return root.Recall && root.Recall.textOf ? root.Recall.textOf(html) : String(html == null ? '' : html); },
      door: function (app, kind) {
        var b = L.buildings(grade).filter(function (x) { return x.app === app; })[0], plain = L.appUrl(grade, b.folder);
        return kind === 'review' ? plain + '&review=1' : town.doorHref(app, plain);
      },
      open: function (app, href) { leaving(app); debug.go(href); },
      shop: function () { debug.go(lobbyUrl + '#shop-world'); },
      stall: function (kind) { openStall(kind); },
      cheer: function (x, z) { world.cheer(x, 4.5, z); },
      changed: refresh, teach: teacher
    });
    var kin = W.Kin.create({
      S: S, built: world, grade: grade, T: T, store: store, today: today, busy: busy, sound: sound, dayKey: dayKeyOf,
      yesterday: function () { return dayKeyOf(Date.now() - 86400000); },
      isBusy: occupied,
      blocked: function (x, z, r) { return L.blocked(obs, bounds, x, z, r) || (!!games && games.blocked(x, z, r)); }
    });
    var play = W.Play.create({
      grade: grade, built: world, ctl: ctl, busy: busy, cue: function (name) { sfx.play(name); }
    });
    var subjectNames = {};
    W.Progress.cards(grade, L, root.Subjects).forEach(function (c) { subjectNames[c.app] = english(c.name); });
    var mates = W.Mates3D.create({
      choose: function (id) { if (games) games.choose(id); },
      blocked: function (x, z, r) { return !!games && games.blocked(x, z, r); },
      S: S, built: world, grade: grade, T: T, store: store, today: today, busy: busy, sound: sound,
      sfx: function (name) { sfx.play(name); }, teach: teacher,
      textOf: function (html) { return root.Recall && root.Recall.textOf ? root.Recall.textOf(html) : String(html == null ? '' : html); },
      facts: function () {
        var streak = 0;
        try { streak = root.Quests.streakOf(root.Quests.read(store).days, today()); } catch (e) {}
        return W.MateLines.facts(town.snapshot(), subjectNames, streak);
      }
    });
    var herMove = false;
    var life = W.Life.create({
      S: S, grade: grade, rand: Math.random, kids: mates.api.ids(),
      blocked: function (x, z, r) { return !!games && games.blocked(x, z, r); },
      chars: folk.chars, owners: mates.api.owners, mimi: town.mimiLife,
      talkingId: function () { return folk.talkingId() || mates.api.talking(); }, busy: function () { return talking || !!overlay; }, waving: function () { return herMove; },
      sfx: function (name) { sfx.play(name); }
    });
    var loot = W.Loot3D.create({
      S: S, built: world, grade: grade, T: T, store: store, today: today, busy: busy, sound: sound, teach: teacher,
      sfx: function (name) { sfx.play(name); },
      textOf: function (html) { return root.Recall && root.Recall.textOf ? root.Recall.textOf(html) : String(html == null ? '' : html); },
      blocked: function (x, z, r) { return L.blocked(obs, bounds, x, z, r) || (!!games && games.blocked(x, z, r)); },
      // Gift coins go through the wallet like every other bonus; the date guard makes it refuse.
      pay: function (n) {
        if (root.Clock && root.Clock.paused && root.Clock.paused()) return 'paused';
        return root.Wallet && root.Wallet.addBonus && root.Wallet.addBonus(n) ? 'ok' : 'paused';
      },
      found: function (id) { return W.Closet.found(store, id, Date.now()); },
      owned: function () { return W.Closet.read(store); },
      changed: refresh
    });
    // Questions come from each game's lesson files: fetch them in the background (subjects with due questions first) so
    // a monster, gift or friend finds one at once instead of making her wait.
    root.setTimeout(function () {
      var due = root.Recall && root.Recall.dueByApp ? root.Recall.dueByApp() : {};
      var all = L.buildings(grade).map(function (b) { return b.app; });
      all.sort(function (a, b) { return (due[b] || 0) - (due[a] || 0); });
      W.Ask.loader(root, W.LessonFiles).warm(all);
    }, 1500);
    games = W.Games3D.create({
      S: S, built: world, grade: grade, T: T, busy: busy, mates: mates.api,
      sfx: function (name, opts) { sfx.play(name, opts); },
      freeze: function (on) { gameFreeze = on; ctl.freeze(on || talking); },
      staticBlocked: function (x, z, r) { return L.blocked(obs, bounds, x, z, r); },
      onPath: function (x, z, m) { return L.onPath(grade, x, z, m) || Math.hypot(x - plaza.x, z - plaza.z) <= plaza.r + m; },
      free: function () { return !maker && !stall && !overlay && !talking && !riding; },
      hideMe: function (on) { hiddenMe = on; },
      place: function (x, z, face) { ctl.teleport(x, z, face); pal.place(ctl.state, true); },
      sister: kin.player
    });
    var nudge = W.Nudge.create(), nudgeDue = false;
    function refresh() {
      sister = sisterHouse();
      town.refresh();
      folk.refresh(town.snapshot());
      kin.check();
    }

    function worn(l) {
      var owned = W.Closet.read(store);
      return W.Pets.wearable(W.Items.wearable(l, owned), owned);
    }
    // A try-on may hold a pet she does not own; only its spot and colour are cleaned here.
    function dress(l) {
      var d = W.Pets.wearable(l, null);
      shown = d;
      if (me) { S.scene.remove(me.group); me.dispose(); }
      me = W.Avatar.character(S, d);
      S.scene.add(me.group);
      pal.set(d, me);
      pal.place(ctl.state);
    }

    function goTo(spot) {
      if (home) goOut();
      if (games) games.stop();
      stopMove();
      ctl.teleport(spot.x, spot.z, spot.face);
      pal.place(ctl.state, true);
      tick(0);
    }

    function actLabel(it) {
      if (it.kind === 'door') return it.emoji + ' ' + T.go.replace('{name}', english(it.sign));
      if (it.kind === 'ride') return T.rides[it.ride];
      if (it.kind === 'house-in') return T.goIn;
      if (it.kind === 'house-visit') return T[W.Text.visitKey(sister ? sister.rel : 'sister')];
      if (it.kind === 'room-out') return T.goOut;
      if (it.kind === 'desk') return T.study;
      if (it.kind === 'room-sit') return T.sit;
      if (games.handles(it.kind)) return games.label(it);
      if (loot.handles(it.kind)) return loot.label(it);
      if (mates.handles(it.kind)) return mates.label(it);
      if (kin.handles(it.kind)) return kin.label(it);
      if (folk.handles(it.kind)) return folk.label(it);
      if (town.handles(it.kind)) return town.label(it);
      return it.kind === 'mirror' ? T.mirror : T.signpost;
    }

    function act() {
      if (!near || maker || overlay || talking || stall || deco) return;
      if (near.kind === 'door') {
        leaving(near.app);
        debug.go(town.doorHref(near.app, L.appUrl(grade, near.folder)));
      } else if (near.kind === 'mirror') openMaker();
      else if (near.kind === 'house-in') goIn(null);
      else if (near.kind === 'house-visit') { if (sister) goIn(sister); }
      else if (near.kind === 'room-out') goOut();
      else if (near.kind === 'desk') study();
      else if (near.kind === 'room-sit') sit('nook');
      else if (near.kind === 'signpost') openTravel();
      else if (near.kind === 'ride') play.start(near.ride);
      else if (games.handles(near.kind)) games.act(near);
      else if (loot.handles(near.kind)) loot.act(near);
      else if (mates.handles(near.kind)) mates.act(near);
      else if (kin.handles(near.kind)) kin.act(near);
      else if (folk.handles(near.kind)) folk.act(near);
      else town.act(near);
    }

    function openStall(kind) {
      if (stall || maker) return;
      ctl.freeze(true);
      hud.show(false);
      var coinsPaused = function () { return !!(root.Clock && root.Clock.paused()); };
      stallKind = kind;
      var home3 = kind === 'carpenter';
      // At every shop she turns her back to the keeper, so the camera sees her, the display stand and the keeper behind
      // instead of looking through the stalls.
      var keeperId = { boutique: 'lana', petshop: 'kiko', toyshop: 'pilo', carpenter: 'tasyo' }[kind], keeper = L.props(grade)[keeperId];
      if (keeper) {
        life.snapHome(keeperId, ctl.state.x, ctl.state.z);
        ctl.teleport(ctl.state.x, ctl.state.z, Math.atan2(ctl.state.x - keeper.x, ctl.state.z - keeper.z));
      }
      stall = (kind === 'petshop' ? W.PetShop : kind === 'toyshop' ? W.ToyShop : home3 ? W.Carpenter : W.Boutique).open({
        doc: doc, T: T, grade: grade, look: worn(look),
        owned: function () { return home3 ? houseOwned() : W.Closet.read(store); },
        balance: function () { try { return root.Wallet ? root.Wallet.balanceStored() : 0; } catch (e) { return 0; } },
        paused: coinsPaused,
        demo: function (id) {
          if (!W.Emotes.find(id)) return pal.demo(id);
          if (!runner.start(id, true)) return;
          sfx.stopHer(0.1);
          sfx.play(id, { her: true });
        },
        buy: function (it) {
          if (!root.Wallet) return { ok: false, why: 'failed' };
          if (home3) {
            return W.House.buy({ storage: store, wallet: root.Wallet, history: root.StudyHistory, paused: coinsPaused, now: Date.now, item: it });
          }
          return W.Closet.buy({
            storage: store, wallet: root.Wallet, history: root.StudyHistory, paused: coinsPaused, now: Date.now, item: it,
            via: kind === 'petshop' ? 'pets' : kind === 'toyshop' ? 'toys' : 'wardrobe'
          });
        },
        onTry: function (l) {
          if (home3) return showPreview(l.homeTry);
          var was = shown ? shown.pet : null;
          dress(l);
          if (kind === 'petshop' && shown && shown.pet !== was) sfx.voice(shown.pet);
        },
        onBought: function (it, trying, keep) {
          if (!home3 && it.kind !== 'trick' && it.kind !== 'toy' && it.kind !== 'emote') {
            look = W.Look.save(store, keep(look), Date.now());
            dress(trying);
          }
          world.sparkle(ctl.state.x, ctl.state.z);
          sound('purchase');
        },
        onClose: function () {
          stopMove();
          dropPreview();
          stall = null;
          stallKind = null;
          dress(worn(look));
          ctl.freeze(false);
          hud.show(true);
          ctl.teleport(ctl.state.x, ctl.state.z, ctl.state.face);
        }
      });
    }

    // Tito Tasyo's pieces she has: what she bought there, what she earned, and the free starters.
    function houseOwned() {
      var data = W.House.read(store), out = {};
      W.Furniture.ITEMS.forEach(function (it) { if (W.House.owns(data, it.id)) out[it.id] = true; });
      return out;
    }

    // The piece she taps at Tito Tasyo's turns slowly on a little round stand in front of her, between her and the
    // camera, a little to the side her pet does not sit on. Wallpapers and floors show as a sample board.
    function dropPreview() {
      if (!preview) return;
      S.scene.remove(preview.group);
      preview.dispose.forEach(function (m) { m.dispose(); });
      preview = null;
    }
    function showPreview(id) {
      dropPreview();
      var it = W.Furniture.find(id);
      if (!it) return;
      var THREE = S.THREE, st = ctl.state, g = new THREE.Group(), spin = new THREE.Group(), mine = [], pc = null;
      var fx = Math.sin(st.face), fz = Math.cos(st.face);
      g.position.set(st.x + fx * 5 - fz * 2.3, 0, st.z + fz * 5 + fx * 2.3);
      S.scene.add(g);
      S.add(S.cyl(0.5, 0.75, 2.0, 24), '#ffffff', 0, 1.0, 0, g);
      S.add(S.cyl(1.5, 1.4, 0.24, 32), '#e8c9a0', 0, 2.1, 0, g);
      S.add(S.torus(1.5, 0.08, 8, 32), '#ff8fab', 0, 2.2, 0, g).rotation.x = Math.PI / 2;
      spin.position.y = 2.22;
      g.add(spin);
      if (it.kind === 'room') {
        var c = doc.createElement('canvas'), pattern = it.pattern || (it.part === 'stars' ? 'stars' : null);
        c.width = c.height = 256;
        var x = c.getContext('2d');
        x.scale(pattern === 'stars' ? 1 : 2, pattern === 'stars' ? 1 : 2);
        if (pattern) W.Room3D.PATTERNS[pattern](x, it.part === 'stars' ? '#3a4a8a' : it.color);
        else { x.fillStyle = it.color; x.fillRect(0, 0, 256, 256); }
        var tex = S.canvasTexture(c), m = new THREE.MeshToonMaterial({ map: tex, gradientMap: S.ramp });
        mine.push(tex, m);
        var board = S.add(S.rbox(2.4, 2.4, 0.16, 0.06), m, 0, it.part === 'floor' ? 0.1 : 1.3, 0, spin);
        if (it.part === 'floor') board.rotation.x = -Math.PI / 2;
      } else {
        pc = W.Room3D.piece(S, id);
        var holder = new THREE.Group();
        holder.add(pc.group);
        var b = new THREE.Box3().setFromObject(pc.group), size = new THREE.Vector3(), mid = new THREE.Vector3();
        b.getSize(size);
        b.getCenter(mid);
        var k = Math.min(1, 2.8 / Math.max(size.x, size.y, size.z, 0.01));
        pc.group.position.set(-mid.x, -b.min.y, -mid.z);
        holder.scale.setScalar(k);
        spin.add(holder);
        mine = mine.concat(pc.mats);
      }
      preview = { id: id, group: g, spin: spin, pc: pc, dispose: mine };
    }

    function openMaker() {
      if (home) {
        // In her room the maker's camera looks from inside the room: she turns to face into it.
        ctl.teleport(ctl.state.x, ctl.state.z, Math.PI);
        pal.place(ctl.state);
      }
      ctl.freeze(true);
      hud.show(false);
      function saveLook(l) {
        var owned = W.Closet.read(store);
        look = W.Look.save(store, W.Pets.keepUnowned(look, W.Items.keepUnowned(look, l, owned), owned), Date.now());
        mine.made = true;
        maker = null;
        dress(worn(look));
        ctl.freeze(false);
        hud.show(true);
        ctl.teleport(ctl.state.x, ctl.state.z, ctl.state.face);
      }
      maker = W.Maker.open({
        doc: doc, T: T, look: worn(look), owned: W.Closet.read(store),
        onChange: function (l) { dress(worn(l)); },
        onDone: function (l) {
          saveLook(l);
          world.sparkle(ctl.state.x, ctl.state.z);
          sound('allRead');
        },
        onShop: function (l) {
          saveLook(l);
          if (home) goOut();
          town.trailTo('shop');
        }
      });
    }

    // --- My Room -----------------------------------------------------------------------------------------------------
    var R = W.Room, F = W.Furniture, H = W.House, Tr = W.Trophies, DESK_LIMIT = 3, roomTalk = null;
    var tapRay = new S.THREE.Raycaster(), tapNdc = new S.THREE.Vector2(), tapV = new S.THREE.Vector3();

    function readMastery() {
      try { return root.Mastery && root.Mastery.read ? root.Mastery.read(store) : JSON.parse(store.getItem('mastery_v1')); } catch (e) { return null; }
    }

    // The shelf's subjects for a grade, in lobby order, each with its game's title ("Life Lab") for the bubble.
    function shelfApps(g) {
      return L.APPS[g].map(function (a) {
        var f = W.LessonFiles && W.LessonFiles[a.app];
        return f && f.title ? Object.assign({ title: f.title }, a) : Object.assign({}, a);
      });
    }

    // The first sister (family order) whose peek carries her house_v1: { id, name, grade, data }, or null.
    function sisterHouse() {
      var Fam = root.Family;
      if (!Fam || !Fam.sisters) return null;
      var meNow = null, list = [];
      try { meNow = root.Learner && root.Learner.current ? root.Learner.current() : null; } catch (e) {}
      try { list = Fam.sisters(meNow || { id: '', grade: 0 }, Fam.readPeek(store), Date.now(), Fam.readSeen(store)); } catch (e) {}
      var s = list.filter(function (x) { return x.house && typeof x.house === 'object'; })[0];
      if (!s) return null;
      var FT = Fam.TEXT ? Fam.TEXT[grade] : null;
      return {
        id: s.id, name: s.name || (FT ? english(FT[s.rel] || FT.sister) : ''), rel: s.rel, boy: s.boy,
        grade: s.grade === 2 ? 'grade2' : s.grade === 5 ? 'grade5' : grade === 'grade2' ? 'grade5' : 'grade2',
        data: H.clean(s.house)
      };
    }
    var sister = sisterHouse();

    // Outdoors: the house door (not during a playground game) and, with her sister's room at hand, the visit spot.
    function outdoorItems() {
      return items.filter(function (it) {
        if (it.kind === 'house-in') return !games.playing();
        if (it.kind === 'house-visit') return !!sister && !games.playing();
        return true;
      });
    }

    // Inside: the door and the walkway lead out; her own room adds the mirror and the desk; at 6x6 the window seat.
    function roomItems() {
      var out = [], door = R.center(R.DOOR[0], R.DOOR[1]), walk = R.center(R.WALK[0], R.WALK[1]);
      // The door square's reach stops short of the desk's stool, so Study shows beside the desk.
      out.push({ kind: 'room-out', id: 'room-out', x: door.x, z: door.z, r: 0.9 });
      out.push({ kind: 'room-out', id: 'room-out:walk', x: walk.x, z: walk.z, r: 1.1 });
      if (!home.visit) {
        var m = R.center(R.MIRROR[0], R.MIRROR[1]), d = R.center(R.DESK[0], R.DESK[1]);
        out.push({ kind: 'mirror', id: 'mirror', x: m.x, z: m.z, r: 1.1 });
        out.push({ kind: 'desk', id: 'desk', x: d.x, z: d.z, r: 2.6 });
      }
      if (home.size >= 6) {
        var n = R.center(R.SEAT[0], R.SEAT[1]);
        out.push({ kind: 'room-sit', id: 'room-sit', x: n.x, z: n.z, r: 1.6 });
      }
      return out;
    }

    // What she bumps into inside: the desk (she stands by its stool), the space under the trophy shelf, and the
    // standing pieces.
    function roomSolid() {
      var O = R.ORIGIN, d = R.center(R.DESK[0], R.DESK[1]);
      return R.solid(F, home.room).concat([
        { x: O.x + 0.65, z: d.z, hx: 0.55, hz: 1.05 },
        { x: O.x + 0.375, z: O.z - (R.WALK[1] + 1) * R.SQ, hx: 0.375, hz: R.SQ }
      ]);
    }
    function roomBlocked(x, z, r) {
      var b = home.box;
      if (x - r < b.minX || x + r > b.maxX || z - r < b.minZ || z + r > b.maxZ) return true;
      return home.solid.some(function (q) { return Math.abs(x - q.x) < q.hx + r && Math.abs(z - q.z) < q.hz + r; });
    }

    function roomState() { return Object.assign({}, home.room, { trophies: home.trophies }); }
    // Her room changed (the Decorate view): draw it, save it, and walk round the new pieces.
    function saveRoom(room) {
      if (!home || home.visit) return false;
      home.room = room;
      home.solid = roomSolid();
      home.view.show(roomState());
      return H.saveRoom(store, room, Date.now());
    }

    // Everything outdoors is hidden while she is inside (the lights, the room, her and her pet stay), and the outdoor
    // characters stop ticking, so the frame draws the room alone.
    function hideOutdoors() {
      var keep = [home.view.group, me.group, S.sun.target].concat(pal.groups());
      S.scene.children.forEach(function (c) {
        if (!c.visible || c.isLight || keep.indexOf(c) >= 0) return;
        c.visible = false;
        home.hidden.push(c);
      });
    }
    function showOutdoors() {
      home.hidden.forEach(function (c) { c.visible = true; });
      S.detail.visible = quality !== 'low';
    }
    function applyQuality(q) {
      S.setQuality(q);
      if (home) S.detail.visible = false;
    }

    // whole: the text is one line, not a Filipino · English pair (a trophy's "🥇 0 · 🥈 0 · 🥉 0").
    function roomSay(face, who, text, buttons, whole) {
      if (roomTalk) roomTalk.close();
      busy(true);
      var mine = roomTalk = W.Talk.open({
        doc: doc, face: face, who: who, text: text, pair: grade === 'grade2' && !whole && text.indexOf('\n') < 0, buttons: buttons,
        onClose: function () {
          if (roomTalk === mine) { roomTalk = null; busy(false); }
        }
      });
    }

    // Goes into My Little House with the sparkle hop: her own room, or her sister's (sis from sisterHouse()), view only.
    function goIn(sis) {
      if (home || !me || maker || stall || overlay || talking || riding || games.playing()) return false;
      games.stop();
      stopMove();
      world.sparkle(ctl.state.x, ctl.state.z);
      sound('allRead');
      var g = sis ? sis.grade : grade, mastery = sis ? null : readMastery(), data = sis ? sis.data : H.read(store);
      var size = sis ? (data.seen ? data.seen.size : 4) : R.sizeFor(grade, Tr.medals(grade, mastery));
      var trophies = sis ? (data.seen ? data.seen.trophies : {}) : Tr.levels(grade, mastery);
      var apps = shelfApps(g), O = R.ORIGIN, side = size * R.SQ;
      home = {
        visit: sis || null, room: H.roomOf(data, size, sis ? sis.boy : myBoy), size: size, trophies: trophies, apps: apps, grade: g,
        box: { minX: O.x, maxX: O.x + side, minZ: O.z - side, maxZ: O.z }, hidden: [], answers: 0, pending: null
      };
      home.view = W.Room3D.create(S, { grade: g, apps: apps });
      home.view.show(roomState());
      home.solid = roomSolid();
      home.items = roomItems();
      hideOutdoors();
      ctl.box(home.box);
      var door = R.center(R.DOOR[0], R.DOOR[1]);
      ctl.teleport(door.x, door.z, Math.PI);
      pal.place(ctl.state, true);
      world.sparkle(door.x, door.z);
      if (!sis) celebrate(mastery);
      tick(0);
      return true;
    }

    // Back out to the doorstep with the sparkle hop, facing away from the house.
    function goOut() {
      if (!home) return false;
      if (deco) deco.close();
      if (seat) standUp();
      if (roomTalk) roomTalk.close();
      showOutdoors();
      home.view.dispose();
      home = null;
      ctl.box(null);
      var d = L.ROOM_DOORSTEP;
      ctl.teleport(d.x, d.z, d.face);
      pal.place(ctl.state, true);
      world.sparkle(d.x, d.z);
      sound('allRead');
      tick(0);
      return true;
    }

    function fill(text, values) {
      return text.replace(/\{(\w+)\}/g, function (m, k) { return values[k] === undefined ? m : String(values[k]); });
    }
    // A subject's name for her: Grade 2 says the Filipino subject name, Grade 5 the game ("Life Lab").
    function subjectOf(card, g) { return grade === 'grade2' && g === 'grade2' ? Tr.subject(card, 'grade2') : card.title || english(card.sign); }
    function earnedLine(id) { var it = F.find(id); return fill(T.earnedPop, { en: it.en, fil: it.fil }); }
    // Grade 5 names the game ("Net Navigators' trophy"), Grade 2 the subject in both halves.
    function trophyLine(card, l) {
      var en = grade === 'grade2' ? english(card.sign) : card.title || card.sign;
      var line = fill(T.trophyUp, { en: en, lvl: Tr.NAMES.en[l], fil: Tr.NAMES.fil[l], name: Tr.subject(card, 'grade2') });
      return /s$/.test(en) ? line.split(en + "'s ").join(en + "' ") : line;
    }

    // Coming into her own room: the room grew, pieces she earned, trophies that went up since last time; then what
    // she saw is saved for next time.
    function celebrate(mastery) {
      var data = H.read(store), seen = data.seen, now = Date.now(), lines = [], streak = 0, boss = null;
      try { streak = root.Quests.streakOf(root.Quests.read(store).days, today()); } catch (e) {}
      try { boss = root.Boss.read(store); } catch (e) {}
      if (seen && home.size > seen.size) lines.push(T.grew);
      var ids = H.unlocks(data, H.facts({ mastery: mastery, grade: grade, streak: streak, boss: boss, deskRight: data.deskRight }), grade);
      if (ids.length && H.earn(store, ids, now)) ids.forEach(function (id) { lines.push(earnedLine(id)); });
      if (seen) {
        home.apps.forEach(function (a) {
          var l = home.trophies[a.app] || 0, was = seen.trophies[a.app] || 0;
          if (l > was) lines.push(trophyLine(a, l));
        });
      }
      H.snapshot(store, home.size, home.trophies, now);
      if (lines.length) popup(lines);
    }
    function popup(lines) {
      world.cheer(ctl.state.x, 4.5, ctl.state.z);
      sound('allRead');
      roomSay('🏡', T.myRoom, lines.join('\n'), [{ text: T.yay, main: true }]);
    }

    // A tap on her room: a trophy opens its bubble (on a visit, only the subject's name).
    function roomTap(cx, cy) {
      var r = S.renderer.domElement.getBoundingClientRect();
      tapNdc.set((cx - r.left) / r.width * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
      S.scene.updateMatrixWorld();
      tapRay.setFromCamera(tapNdc, S.camera);
      var h = home.view.hit(tapRay);
      if (!h || h.kind !== 'trophy') return false;
      trophyBubble(h.app);
      return true;
    }
    function trophyBubble(app) {
      var card = home.apps.filter(function (a) { return a.app === app; })[0];
      if (!card) return;
      var text = card.emoji + ' ' + subjectOf(card, home.grade), who = home.visit ? home.visit.name : T.myRoom;
      if (!home.visit) {
        var m = readMastery(), entry = m && m.apps && Object.prototype.hasOwnProperty.call(m.apps, app) ? m.apps[app] : null;
        text = Tr.line(card, entry, grade, T);
      }
      sound('cardRead');
      roomSay('🏆', who, text, [{ text: T.close }], true);
    }

    // Sitting: at the desk (on the stool, facing the desk) or on the window seat. Her spot stays where she sat, and
    // ✅ Done or a push of the joystick stands her up where she was.
    function sit(kind) {
      var st = ctl.state, O = R.ORIGIN, d = R.center(R.DESK[0], R.DESK[1]), at;
      if (kind === 'desk') at = { x: d.x + 0.6, y: 0.3, z: d.z, face: -Math.PI / 2 };
      else at = { x: O.x + 5.5 * R.SQ, y: 0.45, z: O.z - home.size * R.SQ - 0.75, face: 0 };
      stopMove();
      seat = { kind: kind, back: { x: st.x, z: st.z, face: st.face }, pose: { x: at.x, y: at.y, z: at.z, face: at.face, sit: true } };
      ctl.teleport(at.x, at.z, at.face);
      // The camera looks from inside the room: from the north-east past the trophy shelf at her and her desk, at her
      // face on the window seat.
      st.yaw = kind === 'desk' ? at.face + Math.PI * 1.5 - 0.5 : at.face;
      ctl.camera(0, true);
      if (kind === 'desk') pal.rest(deskPetSpot(), ctl.state);
      else pal.place(seat.back);
    }
    // At the desk a small pet hops onto the desk top's front corner by the lamp, at its shoulder size so it fits among
    // the books and the lamp; a bigger pet sits east of the stool on the door square, which no standing piece can take.
    function deskPetSpot() {
      var d = R.center(R.DESK[0], R.DESK[1]), p = shown ? W.Pets.find(shown.pet) : null;
      if (p && p.size === 'small') return { x: d.x - 0.3, y: 2.07, z: d.z - 0.75, lookX: d.x + 0.6, lookZ: d.z, scale: 0.5 };
      return { x: R.ORIGIN.x + 2.9, y: 0, z: d.z + 0.45, lookX: d.x + 0.6, lookZ: d.z };
    }
    function standUp() {
      if (!seat) return;
      var b = seat.back;
      seat = null;
      ctl.teleport(b.x, b.z, b.face);
      pal.rest(null);
      pal.place(ctl.state);
    }

    // ✏️ Study: Hoot's ❓ Ask me! at her desk, at most 3 answers each time she comes in.
    function study() {
      if (!home || home.visit) return;
      if (!seat || seat.kind !== 'desk') sit('desk');
      var d = R.center(R.DESK[0], R.DESK[1]), left = DESK_LIMIT - home.answers;
      if (left <= 0) return roomSay('✏️', T.desk, T.deskDone, [{ text: T.bye }]);
      folk.study({ face: '✏️', name: T.desk, x: d.x, z: d.z }, left, function (right) {
        if (!home) return;
        home.answers++;
        if (!right) return;
        H.addDeskRight(store);
        var data = H.read(store), ids = H.unlocks(data, H.facts({ mastery: readMastery(), grade: grade, deskRight: data.deskRight }), grade)
          .filter(function (id) { return id === 'home-hoot-plush'; });
        if (ids.length && H.earn(store, ids, Date.now())) home.pending = (home.pending || []).concat(ids.map(earnedLine));
      });
    }

    // 🛠️ Decorate: the camera goes up above the south-east corner, the panel opens, and taps on the room go to it. She
    // steps out of the picture (from above she would hide half the room) and her pet sits on the walkway, which always
    // stays clear, facing the camera; both come back beside each other on ✅ Done.
    function openDecorate() {
      if (!home || home.visit || deco || seat || maker || stall || overlay || talking) return false;
      stopMove();
      hud.show(false);
      var w = R.center(R.WALK[0], R.WALK[1]);
      pal.rest({ x: w.x, y: 0, z: w.z, lookX: w.x + 10, lookZ: w.z + 10 }, ctl.state);
      var coinsPaused = function () { return !!(root.Clock && root.Clock.paused()); };
      deco = W.Decorate.open({
        doc: doc, T: T, grade: grade, view: home.view,
        room: function () { return home.room; },
        save: saveRoom,
        owns: function (id) { return H.owns(H.read(store), id); },
        balance: function () { try { return root.Wallet ? root.Wallet.balanceStored() : 0; } catch (e) { return 0; } },
        paused: coinsPaused,
        buy: function (it) {
          if (!root.Wallet) return { ok: false, why: 'failed' };
          var r = H.buy({ storage: store, wallet: root.Wallet, history: root.StudyHistory, paused: coinsPaused, now: Date.now, item: it });
          if (r.ok) sound('purchase');
          return r;
        },
        camera: decoCamera,
        onClose: function () {
          deco = null;
          hud.show(true);
          pal.rest(null);
          // A piece moved onto her spot: she steps onto the walkway, which always stays clear.
          var st = ctl.state;
          if (home && roomBlocked(st.x, st.z, L.PLAYER_R)) ctl.teleport(w.x, w.z, st.face);
          pal.place(ctl.state);
        }
      });
      return true;
    }
    // The Decorate camera: from above the south-east at 55°, far enough to frame the whole room in the space above the
    // panel (the picture's middle moves up by setViewOffset). off: back behind her.
    // The panel can change height (a longer message, the Yes/No), so the camera fits again whenever it does.
    var decoWatch = null;
    function decoCamera(on, panel) {
      if (decoWatch) decoWatch.disconnect();
      decoWatch = null;
      root.removeEventListener('resize', decoFit);
      if (!on) {
        decoPanel = null;
        ctl.fixed(null);
        S.camera.clearViewOffset();
        return;
      }
      decoPanel = panel;
      decoFit();
      root.addEventListener('resize', decoFit);
      if (root.ResizeObserver) {
        decoWatch = new root.ResizeObserver(decoFit);
        decoWatch.observe(panel);
      }
    }
    function decoFit() {
      if (!home || !decoPanel) return;
      var cv = S.renderer.domElement, cw = cv.clientWidth || 1, ch = cv.clientHeight || 1;
      var bottom = Math.min(ch, decoPanel.getBoundingClientRect().top), band = Math.max(60, bottom - 8);
      var side = home.size * R.SQ, O = R.ORIGIN, at = { x: O.x + side / 2, y: R.WALL_H / 2, z: O.z - side / 2 };
      var up = 55 * Math.PI / 180, yaw = Math.PI / 4, tan = Math.tan(S.camera.fov * Math.PI / 360);
      // The room seen from its corner: the floor's diagonal across, and the floor's depth plus the far walls up.
      var halfW = side * Math.SQRT1_2 + 1, halfH = (side * Math.SQRT2 * Math.sin(up) + R.WALL_H * Math.cos(up)) / 2 + 0.6;
      var d = Math.max(halfW / (tan * cw / ch), halfH / (tan * band / ch)) + side * 0.2;
      S.camera.setViewOffset(cw, ch, 0, ch / 2 - (4 + band / 2), cw, ch);
      ctl.fixed({ x: at.x + Math.sin(yaw) * Math.cos(up) * d, y: at.y + Math.sin(up) * d, z: at.z + Math.cos(yaw) * Math.cos(up) * d, at: at });
    }
    // The maker and the shops: her whole self (and what she tries on) is centred in the screen above their panel.
    var fitPanel = null, fitWatch = null, fitDist = 0;
    function portraitFit() {
      var cv = S.renderer.domElement, cw = cv.clientWidth || 1, ch = cv.clientHeight || 1;
      var band = Math.max(60, Math.min(ch, fitPanel.getBoundingClientRect().top) - 8), tan = Math.tan(S.camera.fov * Math.PI / 360);
      fitDist = Math.max(4.4 / (tan * band / ch), 4 / (tan * cw / ch), 18);
      S.camera.setViewOffset(cw, ch, 0, ch / 2 - (4 + band / 2), cw, ch);
    }
    function portraitCamera() {
      var panel = (maker || stall) && !deco ? doc.querySelector('.maker') : null;
      if (panel === fitPanel) return fitPanel ? fitDist : 0;
      if (fitWatch) fitWatch.disconnect();
      fitWatch = null;
      root.removeEventListener('resize', portraitFit);
      fitPanel = panel;
      if (!panel) {
        S.camera.clearViewOffset();
        return 0;
      }
      portraitFit();
      root.addEventListener('resize', portraitFit);
      if (root.ResizeObserver) {
        fitWatch = new root.ResizeObserver(portraitFit);
        fitWatch.observe(panel);
      }
      return fitDist;
    }
    // A tap while decorating: what it meets in the room goes to the Decorate view (never tap-to-walk or her pet).
    function decoTap(cx, cy) {
      var r = S.renderer.domElement.getBoundingClientRect();
      tapNdc.set((cx - r.left) / r.width * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
      S.scene.updateMatrixWorld();
      tapRay.setFromCamera(tapNdc, S.camera);
      deco.tap(home.view.hit(tapRay));
      return true;
    }

    function openOverlay(title) {
      ctl.freeze(true);
      before = doc.activeElement;
      overlay = el('div', 'w-overlay');
      var card = el('div', 'w-card');
      card.setAttribute('role', 'dialog');
      card.setAttribute('aria-modal', 'true');
      card.setAttribute('aria-label', title);
      card.appendChild(el('h2', 'w-card-title', title));
      overlay.appendChild(card);
      doc.body.appendChild(overlay);
      return card;
    }
    function focusFirst(card) {
      var b = card.querySelector('button');
      if (b) b.focus();
    }
    function closeOverlay() {
      if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
      overlay = null;
      ctl.freeze(false);
      if (before && doc.body.contains(before)) before.focus();
      before = null;
    }

    function openTravel() {
      var card = openOverlay(T.travelTitle), grid = el('div', 'w-travel');
      allSpots.forEach(function (s) {
        var full = s.kind === 'door' ? s.emoji + ' ' + s.sign : L.PLACE_EMOJI[s.id] + ' ' + T.places[s.id];
        var short = s.kind === 'door' ? s.emoji + ' ' + english(s.sign) : L.PLACE_EMOJI[s.id] + ' ' + english(T.places[s.id]);
        var b = button('w-travel-btn', short, function () {
          closeOverlay();
          goTo(s);
          world.sparkle(s.x, s.z);
          sound('allRead');
        });
        b.setAttribute('aria-label', full);
        b.setAttribute('data-spot', s.id);
        grid.appendChild(b);
      });
      card.appendChild(grid);
      card.appendChild(button('w-btn w-close', T.close, closeOverlay));
      focusFirst(card);
    }

    function openSettings() {
      var card = openOverlay(T.settingsTitle);
      function setting(label, choices, current, pick) {
        var row = el('div', 'w-setting'), opts = el('div', 'w-setting-options');
        row.appendChild(el('span', '', label));
        choices.forEach(function (c) {
          var b = button('w-choice', c.text, function () {
            pick(c.value);
            [].forEach.call(opts.children, function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
          });
          b.setAttribute('aria-pressed', c.value === current ? 'true' : 'false');
          opts.appendChild(b);
        });
        row.appendChild(opts);
        card.appendChild(row);
      }
      setting(T.quality, ['auto', 'high', 'low'].map(function (q) { return { value: q, text: T.qualityNames[q] }; }), prefs.quality, function (q) {
        prefs = W.Prefs.savePrefs(store, Object.assign(prefs, { quality: q }));
        quality = W.Prefs.startQuality(prefs);
        slow = W.Prefs.fpsWatch(30, 3);
        applyQuality(quality);
      });
      var onOff = [{ value: true, text: T.on }, { value: false, text: T.off }];
      setting(T.music, onOff, prefs.music, function (on) {
        prefs = W.Prefs.savePrefs(store, Object.assign(prefs, { music: on }));
        if (on && !(root.Fx && root.Fx.muted())) music.start();
        else music.stop();
      });
      setting(T.sound, onOff, !(root.Fx && root.Fx.muted()), function (on) {
        if (root.Fx) root.Fx.setMuted(!on);
        sfx.setOn(on, prefs.steps);
        if (on) sfx.unlock();
        if (!on) music.stop();
        else if (prefs.music) music.start();
      });
      if (root.Fx && root.Fx.setPack) {
        var packs = root.Fx.packs().map(function (id) { return { value: id, text: root.Fx.packLabel(id) }; });
        setting(T.soundPack, packs, root.Fx.pack(), function (id) { root.Fx.setPack(id); });
      }
      setting(T.steps, onOff, prefs.steps, function (on) {
        prefs = W.Prefs.savePrefs(store, Object.assign(prefs, { steps: on }));
        sfx.setOn(!(root.Fx && root.Fx.muted()), prefs.steps);
      });
      if (grade === 'grade2' && root.Lang) {
        var row = el('div', 'w-setting'), helper = root.Lang.button(doc);
        helper.className += ' w-choice';
        row.appendChild(helper);
        card.appendChild(row);
      }
      card.appendChild(el('p', 'w-credit', T.credit));
      card.appendChild(button('w-btn w-close', T.close, closeOverlay));
      focusFirst(card);
    }

    function buildHud() {
      var top = el('div', 'w-hud'), right = el('div', 'w-hud-right');
      top.appendChild(el('div', 'w-pill', '🌍 ' + T.title));
      var lobbyLink = el('a', 'w-pill', T.lobby);
      lobbyLink.href = lobbyUrl;
      lobbyLink.addEventListener('click', function () { W.Prefs.clearReturn(session); });
      var gear = button('w-pill', T.settings, function () { if (!maker && !overlay && !talking && !stall) openSettings(); });
      gear.setAttribute('aria-label', T.settingsTitle);
      right.appendChild(lobbyLink);
      right.appendChild(gear);
      top.appendChild(right);
      var joy = el('div', 'w-joy' + (W.Layout.GRADES[grade].bigJoystick ? ' big' : ''));
      var knob = el('div', 'w-knob', '🐾');
      joy.appendChild(knob);
      var actBtn = button('w-act', '', function () { act(); });
      actBtn.id = 'act';
      actBtn.tabIndex = -1;
      actBtn.setAttribute('aria-hidden', 'true');
      var treat = button('w-pill w-treat', T.treat, function () { if (!maker && !stall && !overlay && !talking && !riding) pal.treat(); });
      var sprint = button('w-sprint', '🏃', function () {
        if (!maker && !stall && !overlay && !talking) ctl.sprint(!ctl.state.sprint);
        sprint.setAttribute('aria-pressed', ctl.state.sprint ? 'true' : 'false');
      });
      sprint.id = 'sprint';
      sprint.setAttribute('aria-label', T.sprint);
      sprint.setAttribute('aria-pressed', 'false');
      var stop = button('w-pill w-stop', T.stop, function () {
        play.stop();
        stop.hidden = true;
      });
      stop.id = 'stop-ride';
      stop.hidden = true;
      var speed = el('div', 'w-speed');
      speed.setAttribute('aria-hidden', 'true');
      var waking = el('div', 'w-waking', T.waking);
      waking.hidden = true;
      // My Room's pills: ✅ Done stands her up from the desk or the window seat; 💛 Cheer on a visit to her sister's room.
      var roomBar = el('div', 'w-roombar');
      var decoPill = button('w-pill w-deco', T.decorate, function () { openDecorate(); });
      decoPill.id = 'room-decorate';
      decoPill.hidden = true;
      roomBar.appendChild(decoPill);
      var done = button('w-pill w-done', T.done, function () { if (!talking) standUp(); });
      done.id = 'room-done';
      done.hidden = true;
      var cheerPill = button('w-pill w-cheer', T.cheerPill, function () {
        if (home && home.visit && !talking) kin.cheerTo(home.visit.id, ctl.state.x, ctl.state.z);
      });
      cheerPill.id = 'room-cheer';
      cheerPill.hidden = true;
      roomBar.appendChild(done);
      roomBar.appendChild(cheerPill);
      var zoomBox = el('div', 'w-zoom'), zoomFill = el('span'), zoomTrack = el('div', 'w-zoom-track', '');
      zoomBox.setAttribute('role', 'group');
      zoomTrack.appendChild(zoomFill);
      var zoomIn = button('w-zoom-btn', '+', function () { if (canZoom()) ctl.zoom(ctl.state.zoom * ZOOM_STEP); });
      var zoomOut = button('w-zoom-btn', '−', function () { if (canZoom()) ctl.zoom(ctl.state.zoom / ZOOM_STEP); });
      zoomIn.setAttribute('aria-label', T.zoomIn);
      zoomOut.setAttribute('aria-label', T.zoomOut);
      [zoomIn, zoomTrack, zoomOut].forEach(function (n) { zoomBox.appendChild(n); });
      var rail = el('div', 'w-rail');
      rail.id = 'w-rail';
      rail.appendChild(sprint);
      rail.appendChild(treat);
      [speed, top, joy, actBtn, rail, stop, roomBar, waking, zoomBox].forEach(function (n) { doc.body.appendChild(n); });
      return {
        joy: joy, knob: knob, act: actBtn, waking: waking, actFor: null,
        treat: treat, sprint: sprint, stop: stop, speed: speed, zoomBox: zoomBox, zoomFill: zoomFill, zoomShown: -1, done: done, cheer: cheerPill, deco: decoPill,
        show: function (on) {
          top.hidden = !on; joy.hidden = !on; actBtn.hidden = !on; treat.hidden = !on; sprint.hidden = !on;
          if (!on) { stop.hidden = true; done.hidden = true; cheerPill.hidden = true; decoPill.hidden = true; speed.classList.remove('on'); }
        }
      };
    }

    function showAct() {
      var id = near ? near.id : '';
      if (id === hud.actFor) return;
      hud.actFor = id;
      hud.act.textContent = near ? actLabel(near) : '';
      hud.act.classList.toggle('show', !!near);
      if (near) { hud.act.removeAttribute('tabindex'); hud.act.removeAttribute('aria-hidden'); }
      else { hud.act.tabIndex = -1; hud.act.setAttribute('aria-hidden', 'true'); }
      if (near) sound('cardRead');
    }

    function showZoom(z) {
      var pct = Math.round((z - W.Prefs.ZOOM_MIN) / (W.Prefs.ZOOM_MAX - W.Prefs.ZOOM_MIN) * 100);
      if (pct === hud.zoomShown) return;
      hud.zoomShown = pct;
      hud.zoomFill.style.height = pct + '%';
    }

    function tick(dt) {
      t += dt;
      var st = ctl.update(dt);
      // A push of the joystick stands her up from a seat.
      if (seat && st.mag > 0) standUp();
      var pose = play.tick(dt) || (seat ? seat.pose : null), free = !maker && !stall && !overlay && !talking && !deco;
      var plants = W.Sfx.stepsBetween(stepT, st.walkT);
      stepT = st.walkT;
      var setOff = st.mag > 0 && !wasMoving;
      wasMoving = st.mag > 0;
      if ((plants || setOff) && !pose && st.mag > 0) sfx.step(onStone(st.x, st.z) ? 'stone' : 'grass');
      var was = runner.state();
      var mv = pose ? (runner.stop(), null) : runner.tick(dt, { moving: st.mag > 0, free: free, clothes: shown ? shown.wear.clothes : '' });
      if (was && !was.idle && !mv) sfx.stopHer(0.2);
      if (!mv) pal.unwatch();
      if (!mv) herMove = false;
      var mp = mv ? { move: mv.move, k: mv.k } : undefined;
      me.group.scale.setScalar(maker || stall ? 1 : W.Avatar.SCALE);
      if (pose) {
        me.group.position.set(pose.x, pose.y, pose.z);
        me.group.rotation.y = pose.face;
        ctl.camera(dt);
        me.animate(t, 0, 0, Object.assign({ ride: true }, pose));
      } else {
        me.group.position.set(st.x, 0, st.z);
        me.group.visible = !hiddenMe && !deco;
        if (maker || stall) {
          me.group.rotation.y += dt * 0.8;
          ctl.portrait(portraitCamera());
        } else {
          portraitCamera();
          me.group.rotation.y = st.face;
          ctl.camera(dt);
        }
        me.animate(t, st.walkT, st.mag, mp);
      }
      if (mv) mv.fx.forEach(function (kind) {
        if (mv.move.indexOf('use-') === 0) me.mounts.hand.getWorldPosition(fxAt);
        else fxAt.set(me.group.position.x, 4.5, me.group.position.z);
        world.fx(fxAt.x, fxAt.y + 0.8, fxAt.z, kind);
      });
      pal.tick(dt, t, {
        x: st.x, z: st.z, face: st.face, moving: st.mag > 0 || !!pose,
        hold: !!pose || !!maker || !!stall || !!overlay || talking || !!deco, front: !!maker || !!stall, sisterD: home ? null : kin.sisterDistance(st.x, st.z),
        quiet: !!(mv && !mv.idle)
      });
      riding = !!pose;
      // Every frame: only changed values are written, as each write makes the browser restyle the page.
      var hideTreat = !free || !!pose, pressed = st.sprint ? 'true' : 'false';
      if (hud.treat.hidden !== hideTreat) hud.treat.hidden = hud.sprint.hidden = hideTreat;
      if (hud.sprint.getAttribute('aria-pressed') !== pressed) hud.sprint.setAttribute('aria-pressed', pressed);
      if (hud.speed.classList.contains('on') !== (!!st.sprint && st.mag > 0)) hud.speed.classList.toggle('on');
      var zoomOn = canZoom();
      if (hud.zoomBox.hidden === zoomOn) hud.zoomBox.hidden = !zoomOn;
      showZoom(st.zoom);
      if (hud.stop.hidden === play.stoppable()) hud.stop.hidden = !play.stoppable();
      var showDone = !!seat && free, showCheer = !!(home && home.visit) && free, showDeco = !!(home && !home.visit) && free && !seat;
      if (hud.done.hidden === showDone) hud.done.hidden = !showDone;
      if (hud.deco.hidden === showDeco) hud.deco.hidden = !showDeco;
      if (hud.cheer.hidden === showCheer) hud.cheer.hidden = !showCheer;
      bar.show(free && !pose);
      useBar.show(free && !pose);
      // A kid is only the thing to tap when no door, ride or other character is in reach.
      if (home) near = free ? L.nearest(home.items, st.x, st.z) : null;
      else near = free ? L.nearest(outdoorItems().concat(kin.items(), loot.items(), games.items()), st.x, st.z) || L.nearest(mates.items(), st.x, st.z) : null;
      showAct();
      world.animate(t, dt, near && near.kind === 'door' ? near.id : null);
      if (home) {
        home.view.see(S.camera.position.x, S.camera.position.z);
        home.view.animate(t, dt);
      }
      if (preview) {
        preview.spin.rotation.y += dt * 0.8;
        if (preview.pc && preview.pc.animate) preview.pc.animate(t);
      }
      // Inside My Little House the outdoor characters, gifts and games wait (they are hidden too).
      if (!maker && !stall && !home) {
        town.tick(t, st, dt);
        folk.tick(t);
        kin.tick(t, dt, st, free && !town.visiting());
        if (!overlay) mates.tick(t, dt, st, play.now(), near);
        if (!overlay) life.tick(t, dt, st);
      }
      if (!home) {
        loot.tick(t, dt, st, !free || !!pose);
        games.tick(t, dt, st, !!maker || !!stall || !!overlay);
      }
      if (home && home.pending && free) {
        var lines = home.pending;
        home.pending = null;
        popup(lines);
      }
      if (nudge.tick(dt, !doc.hidden && !maker && !stall)) nudgeDue = true;
      // A looping ride would keep her busy for ever, so the nudge stops it; Mimi comes once she lands.
      if (nudgeDue && play.stoppable()) play.stop();
      // Time to learn: the nudge ends a game too.
      if (nudgeDue && games.playing()) games.stop();
      // In her room Mimi's words come as a bubble; her Go ▶ takes her out first.
      if (nudgeDue && free && (home ? town.nudgeHere(goOut) : !kin.visiting() && town.nudge(st))) nudgeDue = false;
      S.follow(st.x, st.z);
      if (prefs.quality === 'auto' && quality === 'high' && slow(dt)) {
        quality = 'low';
        applyQuality('low');
      }
    }

    // The next frame is asked for first, so one failing frame cannot freeze the world. The first failure is still
    // thrown (outside the loop) so it shows up as a page error.
    var frameFailed = false;
    function frame() {
      if (paused) return;
      root.requestAnimationFrame(frame);
      try {
        tick(Math.min(clock.getDelta(), 0.05));
        if (!lost) S.render();
      } catch (e) {
        if (frameFailed) return;
        frameFailed = true;
        root.setTimeout(function () { throw e; }, 0);
      }
    }

    var canvas = S.renderer.domElement;
    canvas.addEventListener('webglcontextlost', function (e) {
      e.preventDefault();
      lost = true;
      hud.waking.hidden = false;
    });
    canvas.addEventListener('webglcontextrestored', function () {
      S.refreshTextures();
      applyQuality(quality);
      lost = false;
      hud.waking.hidden = true;
    });

    function wantMusic() { return prefs.music && !(root.Fx && root.Fx.muted()); }
    function unlockMusic() {
      if (wantMusic()) music.start();
      if (music.running()) {
        ['pointerdown', 'pointerup', 'keydown'].forEach(function (ev) { doc.removeEventListener(ev, unlockMusic); });
      }
    }
    // The first touch-down of a joystick drag counts, so her very first step has its sound. pointerup stays for iOS,
    // which only unlocks audio when a touch ends.
    ['pointerdown', 'pointerup', 'keydown'].forEach(function (ev) { doc.addEventListener(ev, unlockMusic); });
    // Every tap wakes the sound effects: iOS can pause them again after she switches apps.
    ['pointerdown', 'pointerup', 'keydown'].forEach(function (ev) { doc.addEventListener(ev, function () { sfx.unlock(); }); });
    // Coming back from a door: the page may be restored, or open fresh; try to start the sounds without waiting for a tap.
    root.addEventListener('pageshow', function () {
      sfx.unlock();
      unlockMusic();
    });
    unlockMusic();
    doc.addEventListener('visibilitychange', function () {
      if (doc.hidden) {
        music.stop();
        sfx.stopAll(0);
      }
      else {
        if (wantMusic()) music.start();
        refresh();
      }
    });
    root.addEventListener('pageshow', function (e) {
      if (e.persisted) {
        refresh();
        welcome(W.Prefs.readReturn(session));
      }
    });
    doc.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && useBar.isOpen()) { useBar.close(); return; }
      if (e.key === 'Escape' && bar.isOpen()) { bar.close(); return; }
      if (e.key === 'Escape' && stall) {
        if (stall.asking()) stall.no();
        else stall.close();
        return;
      }
      if (e.key === 'Escape' && overlay) { closeOverlay(); return; }
      if (e.key === 'Escape' && deco) {
        if (deco.asking()) deco.no();
        else deco.close();
        return;
      }
      if ((e.key === 'Enter' || String(e.key).toLowerCase() === 'e') && near && !maker && !stall && !overlay && !talking) {
        if (/^(INPUT|TEXTAREA|BUTTON|A)$/.test(e.target && e.target.tagName)) return;
        e.preventDefault();
        act();
      }
    });

    refresh();
    dress(worn(look));
    var ret = W.Prefs.readReturn(session);
    if (!mine.made) openMaker();
    goTo(L.spawnFor(grade, ret));
    welcome(ret);

    debug.makerOpen = function () { return !!maker; };
    debug.maker = {
      pick: function (field, value) { if (maker) maker.pick(field, value); },
      tab: function (id) { if (maker) maker.tab(id); },
      done: function () { if (maker) maker.done(); }
    };
    debug.boutiqueOpen = function () { return stallKind === 'boutique'; };
    debug.carpenterOpen = function () { return stallKind === 'carpenter'; };
    debug.carpenterPreview = function () { return preview ? preview.id : null; };
    debug.petshopOpen = function () { return stallKind === 'petshop'; };
    debug.toyshopOpen = function () { return stallKind === 'toyshop'; };
    debug.boutique = debug.petshop = debug.toyshop = debug.carpenter = {
      tab: function (id) { if (stall) stall.tab(id); },
      tryOn: function (id) { if (stall) stall.tryOn(id); },
      buy: function (id) { if (stall) stall.buy(id); },
      yes: function () { if (stall) stall.yes(); },
      no: function () { if (stall) stall.no(); },
      close: function () { if (stall) stall.close(); }
    };
    debug.wearing = function () { return shown ? Object.assign({}, shown.wear) : null; };
    debug.pet = {
      look: function () { return shown ? { pet: shown.pet, color: shown.petColor, spot: shown.petSpot, wear: Object.assign({}, shown.petWear) } : null; },
      state: function () { return pal.state(); },
      groupsShown: function () { return pal.groups().some(function (g) { return g.visible; }); },
      tapCenter: function () { return pal.tapCenter(); },
      treat: function () { return pal.treat(); },
      play: function (id) { return pal.play(id, ctl.state); },
      celebrate: pal.celebrate
    };
    debug.playBar = { open: bar.open, items: bar.items, press: bar.press, isOpen: bar.isOpen };
    debug.useBar = { open: useBar.open, items: useBar.items, press: useBar.press, isOpen: useBar.isOpen, use: useBar.use, useShown: useBar.useShown };
    debug.sfxLog = function () { return sfx.log(); };
    debug.openSettings = function () { openSettings(); };
    debug.move = function () { return runner.state(); };
    debug.holding = function () { return me ? me.prop : ''; };
    debug.fxLive = function () { return world.fxLive(); };
    debug.sisterPets = function () { return kin.sisterPets(); };
    debug.state = function () {
      var st = ctl.state;
      return { x: st.x, z: st.z, face: st.face, near: near ? near.id : null, made: mine.made, quality: quality };
    };
    debug.teleport = function (id) {
      var s = allSpots.filter(function (x) { return x.id === id; })[0];
      if (s) goTo(s);
    };
    debug.tick = function (dt) { tick(dt || 0.016); };
    debug.act = act;
    debug.openTravel = openTravel;
    debug.snapshot = town.snapshot;
    debug.fortBoss = town.fortDebug;
    debug.trail = town.trail;
    debug.talking = function () { return !!doc.querySelector('.talk'); };
    // The whole line as the character says it; a Grade 2 bubble shows the English half on its own line.
    debug.talkText = function () {
      var e = doc.querySelector('.talk .talk-say'), en = doc.querySelector('.talk .talk-en');
      return e ? e.textContent + (en ? ' · ' + en.textContent : '') : null;
    };
    debug.talkButtons = function () { return [].map.call(doc.querySelectorAll('.talk .talk-btn'), function (b) { return b.textContent; }); };
    debug.pressTalk = function (text) {
      var b = [].filter.call(doc.querySelectorAll('.talk .talk-btn'), function (x) { return x.textContent === text; })[0];
      if (b) b.click();
      return !!b;
    };
    debug.loot = loot.debug;
    debug.games = games.debug;
    debug.startGame = function (kind, id) { return games.start(kind, id); };
    debug.closeTalk = function () { if (teachTalk) teachTalk.close(); if (roomTalk) roomTalk.close(); loot.closeTalk(); games.closeTalk(); town.closeTalk(); folk.closeTalk(); kin.closeTalk(); mates.closeTalk(); };
    // The pet teacher's bubble: { who, picked, answer, steps } while it shows, else null.
    debug.teach = function () {
      var b = doc.querySelector('.talk .talk-teach');
      if (!b) return null;
      function txt(sel) { var e = b.querySelector(sel); return e ? e.textContent : ''; }
      return {
        who: doc.querySelector('.talk .talk-who').textContent, picked: txt('.talk-chip.bad .talk-chip-text'), answer: txt('.talk-chip.good .talk-chip-text'),
        steps: [].map.call(b.querySelectorAll('.talk-steps li'), function (li) { return li.textContent; })
      };
    };
    debug.mates = mates.debug;
    debug.life = life.debug;
    debug.jesus = kin.debug;
    debug.sisters = kin.sisterIds;
    debug.sisterAt = kin.sisterAt;
    debug.riding = play.riding;
    debug.stoppable = play.stoppable;
    debug.stopRide = function () { hud.stop.click(); };
    debug.view = function () {
      var st = ctl.state, c = S.camera.position;
      return { zoom: st.zoom, yaw: st.yaw, sprint: st.sprint, target: !!st.target, dist: Math.hypot(c.x - st.x, c.y - 2.5, c.z - st.z) };
    };
    debug.nudgeNow = nudge.force;
    debug.refresh = refresh;
    debug.stand = function (x, z, face) { ctl.teleport(x, z, face === undefined ? ctl.state.face : face); pal.place(ctl.state); tick(0); };
    debug.actText = function () { return hud.act.textContent; };
    debug.waking = function () { return !hud.waking.hidden; };
    debug.loseContext = function () {
      var ext = S.renderer.getContext().getExtension('WEBGL_lose_context');
      if (!ext) return false;
      ext.loseContext();
      root.setTimeout(function () { ext.restoreContext(); }, 300);
      return true;
    };
    // My Room: in and out, what the room holds, her sister's room, a trophy tap, the desk and the window seat.
    debug.goIn = function () { return goIn(null); };
    debug.goOut = goOut;
    debug.inside = function () { return !!home; };
    debug.visit = function () { return sister ? goIn(sister) : false; };
    debug.room = function () {
      if (!home) return null;
      var r = home.room;
      return {
        size: home.size, placed: r.placed.map(function (p) { return Object.assign({}, p); }), wall: r.wall, floor: r.floor, stars: r.stars,
        visit: home.visit ? home.visit.id : null, trophies: Object.assign({}, home.trophies), answers: home.answers,
        items: home.items.map(function (it) { return it.id; }), hidden: home.hidden.length
      };
    };
    // How many groups and meshes stand shown in the scene itself (not sprites or lights): a few inside, hundreds outdoors.
    debug.sceneShown = function () {
      return S.scene.children.filter(function (c) { return c.visible && !c.isLight && !c.isSprite && c !== S.sun.target; }).length;
    };
    debug.tapTrophy = function (app) {
      var p = home && home.view.trophyAt(app);
      if (!p) return false;
      S.scene.updateMatrixWorld();
      S.camera.updateMatrixWorld();
      var r = S.renderer.domElement.getBoundingClientRect();
      tapV.set(p.x, p.y, p.z).project(S.camera);
      return roomTap(r.left + (tapV.x + 1) / 2 * r.width, r.top + (1 - tapV.y) / 2 * r.height);
    };
    // The Decorate view: tapSquare / tapWall / tapItem hand a tap to it as the room would; tapAt(c, r, y) taps the screen
    // where the middle of square (c, r) at height y shows, through the camera, as her finger would.
    function decoDo(name) { return function (a, b) { return deco ? deco[name](a, b) : null; }; }
    debug.decorate = {
      open: openDecorate, isOpen: function () { return !!deco; },
      place: decoDo('place'), select: decoDo('select'), turn: decoDo('turn'), putAway: decoDo('putAway'), yes: decoDo('yes'),
      no: decoDo('no'), tab: decoDo('tab'), done: decoDo('close'), message: decoDo('message'), selected: decoDo('selected'),
      cards: decoDo('cards'), ghost: decoDo('ghost'), shakes: decoDo('shakes'), asking: decoDo('asking'),
      tapSquare: function (c, r) { if (deco) deco.tap({ kind: 'floor', c: c, r: r }); },
      tapWall: function (side, i) { if (deco) deco.tap({ kind: 'wall', side: side, i: i }); },
      tapItem: function (k) { if (deco) deco.tap({ kind: 'item', k: k }); },
      tapAt: function (c, r, y) {
        if (!deco) return false;
        var p = R.center(c, r), cv = S.renderer.domElement.getBoundingClientRect();
        S.scene.updateMatrixWorld();
        S.camera.updateMatrixWorld();
        tapV.set(p.x, y || 0.1, p.z).project(S.camera);
        return decoTap(cv.left + (tapV.x + 1) / 2 * cv.width, cv.top + (1 - tapV.y) / 2 * cv.height);
      },
      seeThrough: function () { return home ? home.view.seeThrough() : []; }
    };
    debug.seat = function () { return seat ? { kind: seat.kind, x: seat.pose.x, y: seat.pose.y, z: seat.pose.z } : null; };
    debug.sit = function (kind) { if (home) sit(kind === 'nook' ? 'nook' : 'desk'); };
    debug.standUp = standUp;

    // The e2e driver stops the frame loop once it has its answer, so software rendering does not eat the time budget.
    debug.pause = function () { paused = true; };
    debug.ready = true;

    $('loading').hidden = true;
    frame();
    fire('world-ready');
  }

  function boot() {
    if (!canRun()) return resting();
    try { start(); } catch (e) {
      if (root.console) root.console.error(e);
      resting();
    }
  }

  W.Main = true;
  $('loading').textContent = T.loading;
  var fonts = doc.fonts && doc.fonts.load ? doc.fonts.load('800 70px "Baloo 2"') : null;
  var wait = new Promise(function (r) { root.setTimeout(r, 1500); });
  (fonts ? Promise.race([fonts, wait]) : wait).then(boot, boot);
})(this);
