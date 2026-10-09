// Drives the 3D world page for world-e2e.js. The mode comes from the URL hash:
// #e2e=fresh|back|lost|resting|grade2|progress|fort|finale|talk|kin|comfort|family|wardrobe|pets|tricks|cheer|toys|sounds|controls|zoomed|mates|teach|loot|games|patintero|house|grow|visit.
(function () {
  var mode = (location.hash.match(/e2e=(\w+)/) || [])[1];
  var sent = false;
  function out(o) {
    if (sent) return;
    sent = true;
    if (window.WorldDebug && WorldDebug.pause) WorldDebug.pause();
    o.errors = window.__e2eErrors || [];
    var pre = document.createElement('pre');
    pre.id = 'e2e-out';
    pre.textContent = JSON.stringify(o);
    document.body.appendChild(pre);
  }
  function text(sel) { var e = document.querySelector(sel); return e ? e.textContent : null; }
  function visibleSpots() {
    return [].filter.call(document.querySelectorAll('.maker-opt[data-field="petSpot"]'), function (b) { return !b.hidden; })
      .map(function (b) { return b.getAttribute('data-value'); });
  }
  // Into her room and onto the mirror's square (by the door, on the south wall).
  function atMirror() {
    var D = window.WorldDebug, m = World3D.Room.center(2, 0);
    D.goIn();
    D.closeTalk();
    D.stand(m.x, m.z);
  }
  // Polls until check() is true (or about 5 s pass), then runs then().
  function waitFor(check, then, tries) {
    tries = tries === undefined ? 100 : tries;
    if (check() || tries <= 0) return then();
    setTimeout(function () { waitFor(check, then, tries - 1); }, 50);
  }

  // My Room's 🛠️ Decorate view, from her own room: open, place, select and move through taps on the room, turn, a
  // refused move, put away, buy with Yes, a No, blue walls, ✅ Done. The saved room (house_v1) after each step.
  function decorate(o) {
    var D = window.WorldDebug, DD = D.decorate;
    function saved() { return JSON.parse(Learner.storage.getItem('house_v1')).room; }
    function ids() { return saved().placed.map(function (p) { return p.id; }); }
    function walk() {
      var a = D.state();
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 's' }));
      D.tick(0.1);
      D.tick(0.1);
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 's' }));
      var b = D.state();
      return Math.hypot(b.x - a.x, b.z - a.z);
    }
    var pill = document.getElementById('room-decorate');
    D.tick(0.05);
    o.decoPill = !pill.hidden;
    o.decoPillText = pill.textContent;
    pill.click();
    o.decoOpen = DD.isOpen();
    D.tick(1);
    o.decoPet = D.pet.state();
    o.decoPetShown = D.pet.groupsShown();
    o.decoDist = D.view().dist;
    o.decoSee = DD.seeThrough();
    o.decoHud = [document.querySelector('.w-joy').hidden, pill.hidden, document.querySelector('.w-hud').hidden];
    o.decoTabs = [].map.call(document.querySelectorAll('.deco .maker-tab'), function (b) { return b.textContent; });
    o.decoHello = DD.message();
    o.decoCards = DD.cards().slice(0, 4);
    o.decoWalk = walk();
    DD.place('home-lamp');
    o.lampRoom = saved().placed;
    o.bedTap = DD.tapAt(0.5, 3, 1.2);
    o.bedSel = DD.selected();
    o.bedMsg = DD.message();
    DD.tapAt(0, 2, 0.1);
    o.bedMoved = saved().placed[0];
    DD.turn();
    o.bedTurned = saved().placed[0];
    var shook = DD.shakes();
    DD.tapSquare(1, 0);
    o.refused = { shakes: DD.shakes() - shook, bed: saved().placed[0], sel: DD.selected() };
    DD.select(2);
    DD.putAway();
    o.lampAway = ids();
    o.awaySel = DD.selected();
    var coins = Wallet.balanceStored();
    DD.place('home-plant');
    o.plantAsk = document.querySelector('.deco-ask-text').textContent;
    o.plantGhost = DD.ghost();
    DD.yes();
    o.plantRoom = saved().placed;
    o.plantCoins = coins - Wallet.balanceStored();
    o.plantMsg = DD.message();
    o.plantHistory = StudyHistory.list().filter(function (e) { return e.type === 'purchase'; }).map(function (e) { return [e.item, e.coins, e.via]; });
    DD.tab('fun');
    DD.place('home-tent');
    o.tentAsk = [DD.asking(), DD.ghost()];
    DD.no();
    o.tentNo = { asking: DD.asking(), ghost: DD.ghost(), placed: ids(), coins: coins - Wallet.balanceStored(), owned: Object.keys(JSON.parse(Learner.storage.getItem('house_v1')).owned) };
    DD.tab('room');
    DD.place('home-wall-blue');
    o.blue = [saved().wall, D.room().wall];
    DD.done();
    o.decoClosed = !DD.isOpen();
    o.decoPetAfter = D.pet.state();
    D.tick(1);
    o.doneDist = D.view().dist;
    o.doneNominal = 15 / D.view().zoom;
    o.doneSee = DD.seeThrough();
    o.doneHud = [document.querySelector('.w-joy').hidden, pill.hidden];
    o.doneWalk = walk();
  }

  function run() {
    var D = window.WorldDebug;
    if (mode === 'resting') {
      return out({
        resting: !document.getElementById('resting').hidden, loadingHidden: document.getElementById('loading').hidden,
        href: document.getElementById('resting-go').getAttribute('href'), title: text('#resting-title')
      });
    }
    var o = { makerOpen: D.makerOpen(), makerTitle: text('.maker-title') };
    if (mode === 'fresh') {
      D.maker.pick('hair', 'bob');
      D.maker.pick('pet', 'puppy');
      D.maker.done();
      o.makerClosed = !D.makerOpen();
      o.saved = JSON.parse(Learner.storage.getItem('avatar_v1'));
      o.at = D.state();
      D.teleport('life-lab');
      o.near = D.state().near;
      o.act = text('#act');
      var went = null;
      D.go = function (u) { went = u; };
      D.act();
      o.went = went;
      o.ret = JSON.parse(sessionStorage.getItem('world_return_v1'));
      D.openTravel();
      document.querySelector('[data-spot="park"]').click();
      o.park = D.state();
      return out(o);
    }
    if (mode === 'progress') {
      var s = D.snapshot();
      o.lifeLevel = s.apps['life-lab'].level;
      o.lifeMarkers = s.apps['life-lab'].markers.map(function (m) { return m.kind; });
      o.fort = s.fort;
      o.target = s.target;
      D.teleport('plaza');
      o.greeted = D.talking();
      o.mimiText = D.talkText();
      document.querySelector('.talk-btn.main').click();
      o.trail = D.trail();
      var went = null;
      D.go = function (u) { went = u; };
      D.teleport('life-lab');
      o.trailAfterArrive = D.trail();
      D.act();
      o.doorWent = went;
      o.fortHref = D.snapshot().fort.href;
      return out(o);
    }
    if (mode === 'back') {
      D.pause();
      for (var bt = 0; bt < 30; bt++) D.tick(0.1);
      o.state = D.state();
      o.view = D.view();
      return out(o);
    }
    var fortSpot = function () { return World3D.Layout.interactables('grade5').filter(function (x) { return x.id === 'fort'; })[0]; };
    if (mode === 'fort') {
      D.pause();
      o.fort = D.snapshot().fort;
      o.boss = D.fortBoss();
      o.onPath = World3D.Layout.onPath('grade5', o.boss.x, o.boss.z, 4);
      var fi = fortSpot();
      D.stand(fi.x, fi.z);
      o.act = D.actText();
      D.act();
      o.text = D.talkText();
      o.buttons = D.talkButtons();
      return out(o);
    }
    if (mode === 'finale') {
      D.pause();
      var s1 = D.snapshot();
      o.finale = s1.fort.finale;
      o.target = s1.target;
      o.step = s1.step && s1.step.text;
      o.before = D.fortBoss();
      var ff = fortSpot();
      D.stand(ff.x, ff.z);
      o.act = D.actText();
      D.act();
      o.during = D.fortBoss();
      for (var k = 0; k < 40 && !D.talking(); k++) D.tick(0.1);
      o.beatenText = D.talkText();
      o.chestButtons = D.talkButtons();
      o.chestClosed = D.fortBoss().chest;
      D.pressTalk('🎁 Open!');
      o.winText = D.talkText();
      o.chestOpen = D.fortBoss().chest;
      o.daily = JSON.parse(Learner.storage.getItem('world3d_v1'));
      D.pressTalk('Close');
      D.tick(0.01);
      o.after = D.snapshot().fort.finale;
      o.afterBoss = D.fortBoss();
      o.afterAct = D.actText();
      return out(o);
    }
    if (mode === 'grade2') {
      D.pause();
      o.bigJoystick = !!document.querySelector('.w-joy.big');
      o.play = text('.w-play');
      D.maker.done();
      // Grade 2 taps to walk: a plain tap sets a target, but lifting the fingers after a pinch does not.
      var cv = document.querySelector('canvas');
      var pe2 = function (type, id, x, target) {
        (target || window).dispatchEvent(new PointerEvent(type, { pointerId: id, clientX: x, clientY: 300, bubbles: true }));
      };
      pe2('pointerdown', 21, 300, cv);
      pe2('pointerup', 21, 300);
      o.plainTap = D.view().target;
      D.stand(D.state().x, D.state().z);
      pe2('pointerdown', 22, 300, cv);
      pe2('pointerdown', 23, 400, cv);
      pe2('pointerup', 23, 400);
      pe2('pointerup', 22, 300);
      o.pinchTap = D.view().target;
      var b2 = World3D.Layout.buddies('grade2')[0];
      D.stand(b2.x, b2.z + 2);
      D.act();
      o.buddyText = D.talkText();
      return out(o);
    }
    if (mode === 'talk') {
      D.pause();
      var LY = World3D.Layout;
      var buddy = function (app) { return LY.buddies('grade5').filter(function (b) { return b.app === app; })[0]; };
      var spot = function (id) { return LY.interactables('grade5').filter(function (i) { return i.id === id; })[0]; };
      var b = buddy('life-lab');
      D.stand(b.x, b.z + 2);
      o.near = D.state().near;
      o.act = D.actText();
      D.act();
      o.buddyText = D.talkText();
      o.buddyButtons = D.talkButtons();
      D.pressTalk('❓ Ask me!');
      return waitFor(function () { return document.querySelector('.talk-row.stack'); }, function () {
        o.options = D.talkButtons();
        D.pressTalk(window.__answer);
        o.after = D.talkText();
        o.box = JSON.parse(Learner.storage.getItem('review_v1')).items[window.__key].box;
        o.points = Learner.storage.getItem('lifelab_points_v1');
        o.history = StudyHistory.list().filter(function (e) { return e.app === 'life-lab'; })
          .map(function (e) { return { kind: e.kind, correct: e.correct, finished: e.finished }; });
        D.pressTalk('👋 Bye');
        var p = buddy('page-turners');
        D.stand(p.x, p.z + 2);
        D.act();
        D.pressTalk('❓ Ask me!');
        waitFor(function () { var t = D.talkText(); return t && t.indexOf('🤔') !== 0; }, function () {
          o.failText = D.talkText();
          o.failButtons = D.talkButtons();
          D.pressTalk('👋 Bye');
          var h = spot('hoot');
          D.stand(h.x, h.z);
          o.hootNear = D.state().near;
          D.act();
          o.hootText = D.talkText();
          D.pressTalk('👋 Bye');
          var c = spot('counter');
          D.stand(c.x, c.z);
          D.act();
          o.bunnyText = D.talkText();
          o.bunnyButtons = D.talkButtons();
          D.pressTalk('👋 Bye');
          var t = spot('tree:0'), park = LY.places('grade5').park, d = Math.hypot(park.x - t.x, park.z - t.z);
          D.stand(t.x + (park.x - t.x) / d * (t.r - 1), t.z + (park.z - t.z) / d * (t.r - 1));
          o.treeNear = D.state().near;
          D.act();
          o.treeText = D.talkText();
          o.treeWant = World3D.Chat.quote('grade5', 0, Guide.dayKey(Date.now()), 0);
          out(o);
        });
      });
    }
    if (mode === 'teach') {
      D.pause();
      var fz = World3D.Layout.buddies('grade5').filter(function (x) { return x.app === 'life-lab'; })[0];
      D.stand(fz.x, fz.z + 2);
      D.act();
      D.pressTalk('❓ Ask me!');
      return waitFor(function () { return document.querySelector('.talk-row.stack'); }, function () {
        var wrong = D.talkButtons().filter(function (t) { return t !== window.__answer && t !== '👋 Bye'; })[0];
        o.wrong = wrong;
        D.pressTalk(wrong);
        D.tick(0.1);
        o.teach = D.teach();
        o.teachButtons = D.talkButtons();
        o.petTeaching = D.pet.state().teaching;
        o.petBubble = D.pet.state().bubble;
        o.box = JSON.parse(Learner.storage.getItem('review_v1')).items[window.__key].box;
        D.pressTalk('Got It!');
        D.tick(0.1);
        o.afterText = D.talkText();
        o.afterButtons = D.talkButtons();
        o.petAfter = D.pet.state().teaching;
        out(o);
      });
    }
    if (mode === 'loot') {
      D.pause();
      var LD = D.loot, Wl = window.Wallet, start = Wl.balanceStored();
      var sub = function () { var e = document.querySelector('.talk .talk-sub'); return e ? e.textContent : ''; };
      var near = function (x, z) { D.stand(x, z); D.tick(0.05); return D.state().near; };
      var asked = function () { return document.querySelector('.talk-row.stack'); };
      D.teleport('plaza');
      D.tick(0.05);
      D.closeTalk();
      var me = D.state(), gx = me.x + 8, gz = me.z;
      // Gift A: her due box-1 question, a Hard one: 3 coins and a found item.
      LD.gift(gx, gz);
      o.giftNear = near(gx - 1.5, gz);
      o.giftAct = D.actText();
      D.act();
      return waitFor(asked, function () {
        o.hardSub = sub();
        D.pressTalk(LD.right());
        o.hardText = D.talkText();
        o.hardSub2 = sub();
        o.wardrobe = JSON.parse(Learner.storage.getItem('wardrobe_v1') || '{}');
        D.pressTalk('👋 Bye');
        for (var i = 0; i < 30; i++) D.tick(0.05);
        o.afterOpen = LD.list().gifts.length;
        // Gift B: a fresh question (Easy); wrong first, the pet teaches, then Try again and right.
        LD.gift(gx, gz);
        near(gx - 1.5, gz);
        D.act();
        waitFor(asked, function () {
          o.easySub = sub();
          D.pressTalk(LD.wrong());
          o.teach = D.teach();
          D.pressTalk('Got It!');
          o.closedText = D.talkText();
          o.closedButtons = D.talkButtons();
          D.pressTalk('🔁 Try again');
          waitFor(asked, function () {
            D.pressTalk(LD.right());
            o.easyText = D.talkText();
            D.pressTalk('👋 Bye');
            for (var i = 0; i < 30; i++) D.tick(0.05);
            // A monster: wrong, it calls a helper and goes; right on the helper, it pops and drops an earned gift.
            LD.monster(gx, gz);
            o.monsterNear = near(gx - 2, gz);
            o.monsterAct = D.actText();
            D.act();
            waitFor(asked, function () {
              D.pressTalk(LD.wrong());
              D.pressTalk('Got It!');
              o.calledText = D.talkText();
              D.pressTalk('👋 Bye');
              var l = LD.list();
              o.afterWrong = l.monsters.map(function (m) { return m.helper; });
              var h = l.monsters[0];
              near(h.x - 1.5, h.z);
              D.act();
              waitFor(asked, function () {
                D.pressTalk(LD.right());
                o.defeatText = D.talkText();
                D.pressTalk('👋 Bye');
                for (var i = 0; i < 20; i++) D.tick(0.05);
                var after = LD.list();
                o.monstersLeft = after.monsters.length;
                o.dropped = after.gifts.map(function (g) { return g.earned; });
                var g = after.gifts[0];
                near(g.x - 1.5, g.z);
                D.act();
                o.earnedText = D.talkText();
                o.earnedSub = sub();
                D.pressTalk('👋 Bye');
                o.coins = Wl.balanceStored() - start;
                o.loot = JSON.parse(Learner.storage.getItem('loot_v1'));
                o.history = StudyHistory.list().filter(function (e) { return e.app === 'life-lab'; })
                  .map(function (e) { return { kind: e.kind, finished: e.finished, title: e.title }; });
                out(o);
              });
            });
          });
        });
      });
    }
    if (mode === 'games') {
      D.pause();
      var GD = D.games, MD = D.mates, pgz = World3D.Layout.places('grade5').playground;
      var kid = function (id) { return MD.list().filter(function (k) { return k.id === id; })[0]; };
      var run = function (s) { for (var i = 0; i < s * 20; i++) D.tick(0.05); };
      MD.calm();
      var m = kid('migo');
      D.stand(m.x + 2, m.z);
      MD.talk('migo');
      o.talkButtons = D.talkButtons();
      D.pressTalk("🎲 Let's play!");
      o.kindButtons = D.talkButtons();
      D.pressTalk('🏃 Tag & Chase');
      o.chaseButtons = D.talkButtons();
      D.pressTalk('🏷️ Tag!');
      D.tick(0.05);
      var s = GD.state();
      o.tag = { kind: s.kind, it: s.it, props: s.props, players: s.ids.length, pill: s.pill };
      // She touches a kid: that kid is it and counts.
      var t = kid(s.ids[1]);
      D.stand(t.x + 0.6, t.z);
      D.tick(0.05);
      s = GD.state();
      o.tagged = { it: s.it, want: t.id, pill: s.pill };
      // She steps 5 away while the kid counts; the kid lunges, the screen's edge glows red, and she is caught.
      D.stand(t.x + 5, t.z);
      var glow = false;
      for (var gi = 0; gi < 120 && GD.state().it !== 'her'; gi++) {
        D.tick(0.05);
        glow = glow || GD.state().glow;
      }
      o.chase = { glow: glow, caught: GD.state().it === 'her', glowAfter: GD.state().glow, beats: D.sfxLog().filter(function (l) { return l.key === 'heartbeat'; }).length };
      GD.end();
      o.afterEnd = { playing: !!(GD.state() && !GD.state().done), talking: D.talking(), props: GD.props().length };
      // The board: the Hide & Seek group has one game, so it starts straight away and she seeks.
      var b = GD.board();
      D.stand(b.x + 1.5, b.z);
      o.boardAct = D.actText();
      D.act();
      o.boardButtons = D.talkButtons();
      D.pressTalk('🙈 Hide & Seek');
      D.tick(0.05);
      s = GD.state();
      o.seekStart = { kind: s.kind, phase: s.phase, count: s.count, pill: s.pill, props: s.props, cover: s.cover };
      var before = D.state();
      run(11);
      var after = D.state();
      s = GD.state();
      o.afterCount = { cover: s.cover, hidden: s.hidden.length, hint: s.hint };
      o.frozenCount = before.x === after.x && before.z === after.z;
      run(20);
      s = GD.state();
      o.hidden = s.hidden.length;
      o.hiddenDrawn = MD.list().filter(function (k) { return s.hidden.indexOf(k.id) >= 0 && k.visible; }).length;
      s.ids.forEach(function (id) {
        var k = kid(id);
        D.stand(k.x + 2.2, k.z);
        D.tick(0.05);
        D.stand(k.x + 2.2, k.z);
        D.tick(0.05);
      });
      o.endText = D.talkText();
      o.endButtons = D.talkButtons();
      o.endSub = (document.querySelector('.talk .talk-sub') || {}).textContent || '';
      // Play again: she hides; she disguises by a prop and Boo!s the seeker.
      D.pressTalk('🔁 Play again');
      D.tick(0.05);
      s = GD.state();
      o.hide = { kind: s.kind, phase: s.phase, seeker: !!s.seeker, pill: s.pill };
      // While the seeker counts she goes to the prop farthest away.
      var at = D.state(), p = GD.props().sort(function (a, c) { return Math.hypot(c.x - at.x, c.z - at.z) - Math.hypot(a.x - at.x, a.z - at.z); })[0];
      D.stand(p.x + 2.2, p.z);
      run(10.5);
      s = GD.state();
      D.stand(p.x + 2.2, p.z);
      D.tick(0.05);
      o.disguiseShown = GD.state().disguiseShown;
      GD.disguise();
      D.tick(0.05);
      o.disguised = GD.state().disguised;
      var me = D.state();
      GD.place(s.seeker, me.x + 4.4, me.z);
      D.tick(0.05);
      o.booShown = GD.state().booShown;
      GD.boo();
      o.booText = D.talkText();
      D.pressTalk('👋 Bye');
      o.afterBoo = { disguised: GD.state() ? GD.state().disguised : false, playing: !!(GD.state() && !GD.state().done) };
      // A friend runs up and asks her to play.
      MD.calm();
      var e = kid('ella');
      D.stand(e.x + 6, e.z);
      GD.invite();
      for (var i = 0; i < 300 && !D.talking(); i++) D.tick(0.05);
      o.inviteText = D.talkText();
      o.inviteButtons = D.talkButtons();
      D.pressTalk('No thanks');
      o.afterNo = !!(GD.state() && !GD.state().done);
      out(o);
      return;
    }
    if (mode === 'patintero') {
      D.pause();
      var PD = D.games, PM = D.mates;
      var go = function (s) { for (var i = 0; i < s * 20; i++) D.tick(0.05); };
      var key = function (type, k) { window.dispatchEvent(new KeyboardEvent(type, { key: k })); };
      PM.calm();
      D.startGame('patintero', PM.list()[0].id);
      D.tick(0.05);
      var c = PD.court(), ps = PD.state(), me = D.state();
      o.start = {
        kind: ps.kind, phase: ps.phase, pill: ps.pill, hint: ps.hint, rings: ps.rings,
        teams: [ps.team.blue.length, ps.team.red.length], behindHome: me.z > c.home
      };
      // She holds forward for a second while the ready count runs: she stays on her spot.
      key('keydown', 'w');
      go(1);
      key('keyup', 'w');
      var moved = D.state();
      o.start.movedWhileReady = moved.x !== me.x || moved.z !== me.z;
      go(3);
      o.play = { phase: PD.state().phase };
      // The guard on the first cross line touches her: her team is tagged and she guards the middle line.
      ps = PD.state();
      var g = Object.keys(ps.posts).filter(function (id) { return ps.posts[id] === 'c0'; })[0];
      me = D.state();
      PD.place(g, me.x, c.cross[0]);
      D.stand(me.x, c.cross[0] + 0.5);
      D.tick(0.05);
      ps = PD.state();
      o.tagged = {
        guarding: ps.guarding, post: ps.posts.her, onMid: Math.abs(D.state().x - c.mid.x) < 0.01,
        fenced: ps.fenced, hint: ps.hint
      };
      // After the ready count a runner comes onto her: she tags them and her team runs.
      go(3.5);
      ps = PD.state();
      me = D.state();
      PD.place(ps.team.red[0], me.x, me.z);
      D.tick(0.05);
      ps = PD.state();
      o.tagger = { running: ps.running, hint: ps.hint };
      PD.end();
      // debug.state() is null once the game is over, so the rings and her fence are read straight.
      o.afterEnd = { playing: !!(PD.state() && !PD.state().done), rings: PD.rings() };
      // She walks from a spot beside the court that her fence would block: the fence is off.
      D.stand(c.maxX + 1, c.cz);
      var from = D.state();
      key('keydown', 'w');
      go(0.3);
      key('keyup', 'w');
      var to = D.state();
      o.afterEnd.walks = Math.hypot(to.x - from.x, to.z - from.z) > 0.5;
      // The board: Tag & Chase, then Patintero!, starts it too.
      var b = PD.board();
      D.stand(b.x + 1.5, b.z);
      D.act();
      D.pressTalk('🏃 Tag & Chase');
      D.pressTalk('🏃 Patintero!');
      D.tick(0.05);
      o.fromBoard = PD.state() ? PD.state().kind : null;
      PD.end();
      out(o);
      return;
    }
    if (mode === 'kin') {
      D.pause();
      var i;
      for (i = 0; i < 80 && !D.talking(); i++) D.tick(0.1);
      o.today = Guide.dayKey(Date.now());
      o.greetText = D.talkText();
      o.greetButtons = D.talkButtons();
      o.came = D.jesus();
      D.pressTalk('🤗 Hug');
      o.hugText = D.talkText();
      D.pressTalk('👋 Bye');
      for (i = 0; i < 60 && D.jesus().mode !== 'garden'; i++) D.tick(0.1);
      o.back = D.jesus();
      o.daily = JSON.parse(Learner.storage.getItem('world3d_v1'));
      D.refresh();
      for (i = 0; i < 20; i++) D.tick(0.1);
      o.again = D.talking() || D.jesus().mode !== 'garden';
      var js = World3D.Layout.jesusSpot('grade5');
      D.stand(js.x, js.z);
      o.gardenNear = D.state().near;
      o.gardenAct = D.actText();
      D.act();
      o.gardenText = D.talkText();
      o.gardenButtons = D.talkButtons();
      return out(o);
    }
    if (mode === 'comfort') {
      D.pause();
      for (var c = 0; c < 80 && !D.talking(); c++) D.tick(0.1);
      o.today = Guide.dayKey(Date.now());
      o.text = D.talkText();
      o.glow = D.jesus().glow;
      o.daily = JSON.parse(Learner.storage.getItem('world3d_v1'));
      return out(o);
    }
    if (mode === 'family') {
      D.pause();
      var LF = World3D.Layout;
      o.sisters = D.sisters();
      var sp = LF.sisterSpots('grade5')[0];
      D.stand(sp.x, sp.z + 1);
      o.petNearSister = D.pet.state().bubble;
      o.sisterPets = D.sisterPets();
      // She spawns by the gate, so play may already have begun before the driver; stand() cut it short, and play cut
      // short starts again after the 1 s rest.
      for (var gp = 0; gp < 30 && D.pet.state().action !== 'play'; gp++) D.tick(0.1);
      o.play = D.pet.state();
      for (gp = 0; gp < 70 && D.pet.state().action === 'play'; gp++) D.tick(0.1);
      o.played = D.pet.state();
      o.sisterPetsAfter = D.sisterPets();
      D.stand(sp.x, sp.z + 1);
      for (gp = 0; gp < 20; gp++) D.tick(0.1);
      o.replay = D.pet.state().action;
      o.near = D.state().near;
      o.act = D.actText();
      D.act();
      o.text = D.talkText();
      o.buttons = D.talkButtons();
      D.pressTalk(o.buttons[0]);
      o.sent = Family.read(Learner.storage).sent.length;
      o.sentText = D.talkText();
      D.pressTalk('👋 Bye');
      var ride = function (id) { return LF.interactables('grade5').filter(function (x) { return x.id === 'ride:' + id; })[0]; };
      var stopShown = function () { return !document.getElementById('stop-ride').hidden; };
      var sw = ride('swings');
      D.stand(sw.x, sw.z);
      o.rideAct = D.actText();
      D.act();
      o.riding = D.riding();
      for (var r = 0; r < 55; r++) D.tick(0.1);
      o.stillRiding = D.riding();
      o.stopShown = stopShown();
      document.querySelector('canvas').dispatchEvent(new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true }));
      o.rideZoom = D.view().zoom;
      D.stopRide();
      o.stopAfterTap = stopShown();
      for (r = 0; r < 60 && D.riding(); r++) D.tick(0.1);
      o.rodeDone = D.riding();
      o.rideSounds = D.sfxLog().map(function (l) { return l.key; })
        .filter(function (k) { return /^(ride-|swing$)/.test(k); });
      o.after = D.state();
      o.end = LF.rideSpots('grade5').filter(function (x) { return x.id === 'swings'; })[0].end;
      var sl = ride('slide');
      D.stand(sl.x, sl.z);
      D.act();
      D.tick(0.1);
      o.slideRiding = D.riding();
      o.slideStop = stopShown();
      for (r = 0; r < 40 && D.riding(); r++) D.tick(0.1);
      o.slideDone = D.riding();
      var mg = ride('merry');
      D.stand(mg.x, mg.z);
      D.act();
      for (r = 0; r < 20; r++) D.tick(0.1);
      o.merryRiding = D.riding();
      D.nudgeNow();
      for (var n = 0; n < 150 && !D.talking(); n++) D.tick(0.1);
      o.nudgeRiding = D.riding();
      o.nudgeText = D.talkText();
      D.closeTalk();
      // Her sister joins tag like the kids, and walks back to the gate after.
      var GF = D.games;
      D.mates.calm();
      D.startGame('tag', D.mates.list()[0].id);
      D.tick(0.05);
      var gs = GF.state();
      o.sisGame = { ids: gs.ids.slice(), visible: D.sisterAt()[0].visible, near: D.state().near };
      var sw0 = GF.where('sister');
      D.stand(sw0.x + 0.6, sw0.z);
      D.tick(0.05);
      o.sisIt = { it: GF.state().it, pill: GF.state().pill };
      D.stand(sw0.x + 5, sw0.z);
      var sisGlow = false;
      for (var si = 0; si < 120 && GF.state().it !== 'her'; si++) {
        D.tick(0.05);
        sisGlow = sisGlow || GF.state().glow;
      }
      var sw1 = GF.where('sister');
      o.sisChase = { glow: sisGlow, caught: GF.state().it === 'her', moved: Math.hypot(sw1.x - sw0.x, sw1.z - sw0.z) > 1 };
      GF.end();
      o.sisBack = D.sisterAt()[0].back;
      for (si = 0; si < 600 && D.sisterAt()[0].back; si++) D.tick(0.05);
      o.sisHome = D.sisterAt()[0];
      o.sisSpot = sp;
      return out(o);
    }
    if (mode === 'tricks') {
      D.pause();
      var kq = World3D.Layout.props('grade5').kiko;
      D.teleport('shop');
      D.stand(kq.x - 2.2, kq.z);
      D.act();
      D.petshop.tab('tricks');
      o.trickCards = [].map.call(document.querySelectorAll('.bt-card'), function (c) { return c.getAttribute('data-item'); });
      o.bowFree = text('.bt-card[data-item="trick-bow"] .bt-owned');
      D.petshop.tryOn('trick-dance');
      D.tick(0.1);
      o.demo = D.pet.state();
      D.petshop.tab('toys');
      D.petshop.tryOn('toy-bone');
      D.tick(0.1);
      o.demoToy = D.pet.state();
      D.petshop.tab('tricks');
      D.petshop.buy('trick-spin');
      o.confirm = text('.bt-confirm-text');
      D.petshop.yes();
      o.owned = Object.keys(JSON.parse(Learner.storage.getItem('wardrobe_v1')).owned);
      D.petshop.close();
      D.teleport('gate');
      for (var w = 0; w < 20; w++) D.tick(0.1);
      D.playBar.open();
      o.items = D.playBar.items();
      D.playBar.press('trick-spin');
      o.rowClosed = !D.playBar.isOpen();
      D.tick(0.1);
      o.spin = D.pet.state();
      o.busy = D.pet.play('trick-bow');
      for (w = 0; w < 14; w++) D.tick(0.1);
      o.afterSpin = D.pet.state();
      for (w = 0; w < 12; w++) D.tick(0.1);
      D.playBar.open();
      D.playBar.press('toy-ball');
      o.thrown = D.pet.state();
      var stages = [];
      for (w = 0; w < 120 && D.pet.state().action === 'fetch'; w++) {
        D.tick(0.05);
        var sg = D.pet.state().stage;
        if (sg && stages[stages.length - 1] !== sg) stages.push(sg);
      }
      o.stages = stages;
      o.fetched = D.pet.state();
      o.her = D.state();
      return out(o);
    }
    if (mode === 'toys') {
      D.pause();
      var pq = World3D.Layout.props('grade5').pilo;
      D.teleport('shop');
      D.stand(pq.x - 2.2, pq.z);
      o.near = D.state().near;
      o.act = text('#act');
      D.act();
      o.open = D.toyshopOpen();
      o.title = text('.maker-title');
      o.propCards = [].map.call(document.querySelectorAll('.bt-card'), function (c) { return c.getAttribute('data-item'); });
      o.balloonFree = text('.bt-card[data-item="balloon"] .bt-owned');
      D.toyshop.tryOn('magicwand');
      o.trying = D.wearing().prop;
      D.toyshop.tab('emotes');
      o.emoteCards = document.querySelectorAll('.bt-card').length;
      D.toyshop.tryOn('emote-dance');
      D.tick(0.1);
      o.demo = D.move();
      D.toyshop.tab('props');
      D.toyshop.buy('ukulele');
      o.confirm = text('.bt-confirm-text');
      D.toyshop.yes();
      D.toyshop.tab('emotes');
      D.toyshop.buy('emote-spin');
      D.toyshop.yes();
      o.owned = Object.keys(JSON.parse(Learner.storage.getItem('wardrobe_v1')).owned).sort();
      o.bought = StudyHistory.list().filter(function (e) { return e.type === 'purchase'; }).map(function (e) { return [e.item, e.coins, e.via]; })
        .sort(function (x, y) { return x[0] < y[0] ? -1 : 1; });
      D.toyshop.close();
      o.afterClose = { holding: D.holding(), move: D.move(), saved: JSON.parse(Learner.storage.getItem('avatar_v1')).wear.prop };
      D.teleport('gate');
      for (var w = 0; w < 20; w++) D.tick(0.1);
      o.useShown = D.useBar.useShown();
      D.useBar.use();
      D.tick(0.1);
      o.using = D.move();
      o.petWatch = D.pet.state();
      for (w = 0; w < 30; w++) D.tick(0.1);
      o.afterUse = { move: D.move(), pet: D.pet.state() };
      o.fx = D.fxLive();
      D.useBar.open();
      o.emotes = D.useBar.items();
      D.useBar.press('emote-spin');
      o.rowClosed = !D.useBar.isOpen();
      D.tick(0.1);
      o.spin = D.move();
      // Not the plaza: Mayor Mimi's daily greeting opens a talk there, and a talk holds off idles.
      D.teleport('park');
      o.cancelled = D.move();
      for (w = 0; w < 90; w++) D.tick(0.1);
      o.idle = D.move();
      atMirror();
      D.act();
      D.maker.tab('props');
      o.mirrorProps = [].map.call(document.querySelectorAll('.maker-opt[data-field="wear.prop"]'), function (b) { return b.getAttribute('data-value'); });
      D.maker.pick('wear.prop', 'balloon');
      D.maker.done();
      o.mirrorSaved = JSON.parse(Learner.storage.getItem('avatar_v1')).wear.prop;
      o.holdingAfter = D.holding();
      return out(o);
    }
    if (mode === 'sounds') {
      D.useBar.open();
      D.useBar.press('emote-wave');
      D.tick(0.1);
      D.pet.tapCenter();
      D.tick(0.1);
      o.heard = D.sfxLog().map(function (l) { return l.key; });
      D.openSettings();
      var row = [].filter.call(document.querySelectorAll('.w-setting'), function (r) { return r.textContent.indexOf('👣') >= 0; })[0];
      o.stepsLabel = row ? row.firstChild.textContent : null;
      var packRow = [].filter.call(document.querySelectorAll('.w-setting'), function (r) { return r.textContent.indexOf('🎵') >= 0 && r.textContent.indexOf('Battle') >= 0; })[0];
      o.packLabel = packRow ? packRow.firstChild.textContent : null;
      o.packBefore = Fx.pack();
      var battle = packRow ? [].filter.call(packRow.querySelectorAll('button'), function (b) { return b.textContent === 'Battle announcer'; })[0] : null;
      if (battle) battle.click();
      o.packAfter = Fx.pack();
      o.packPressed = battle ? battle.getAttribute('aria-pressed') : null;
      var off = row ? [].filter.call(row.querySelectorAll('button'), function (b) { return b.textContent === 'Off'; })[0] : null;
      if (off) off.click();
      o.prefs = JSON.parse(Learner.storage.getItem('world3d_device_v1') || 'null');
      return out(o);
    }
    if (mode === 'cheer') {
      D.pause();
      o.at = D.state();
      o.ret = JSON.parse(sessionStorage.getItem('world_return_v1'));
      // The frame loop ran before the driver, so the celebration may already have fired; state().cheer keeps it.
      for (var c2 = 0; c2 < 30 && !D.pet.state().cheer; c2++) D.tick(0.1);
      o.cheer = D.pet.state().cheer;
      return out(o);
    }
    if (mode === 'pets') {
      var kk = World3D.Layout.props('grade5').kiko;
      D.teleport('shop');
      D.stand(kk.x - 2.2, kk.z);
      o.near = D.state().near;
      o.act = text('#act');
      D.act();
      o.open = D.petshopOpen();
      o.title = text('.maker-title');
      o.cards = [].map.call(document.querySelectorAll('.bt-card'), function (c) { return c.getAttribute('data-item'); });
      D.petshop.tryOn('panda');
      o.trying = D.pet.look().pet;
      D.petshop.tab('gear');
      D.petshop.tryOn('pet-crown');
      o.tryingHat = D.pet.look().wear.hat;
      D.petshop.close();
      o.afterClose = D.pet.look();
      D.tick();
      D.act();
      D.petshop.buy('hamster');
      o.confirm = text('.bt-confirm-text');
      D.petshop.yes();
      D.petshop.tab('gear');
      D.petshop.buy('pet-partyhat');
      D.petshop.yes();
      o.owned = Object.keys(JSON.parse(Learner.storage.getItem('wardrobe_v1')).owned).sort();
      var saved = JSON.parse(Learner.storage.getItem('avatar_v1'));
      o.saved = { pet: saved.pet, hat: saved.petWear.hat };
      o.balance = Wallet.balanceStored();
      // list() is newest first, and two buys in the same millisecond tie, so sort by item.
      o.bought = StudyHistory.list().filter(function (e) { return e.type === 'purchase'; }).map(function (e) { return [e.item, e.coins, e.via]; })
        .sort(function (x, y) { return x[0] < y[0] ? -1 : 1; });
      D.petshop.close();
      o.afterBuy = D.pet.look();
      D.tick();
      o.tapped = D.pet.tapCenter();
      D.tick();
      o.happy = D.pet.state();
      for (var i = 0; i < 3; i++) D.tick(0.5);
      o.treat = D.pet.treat();
      o.treatAgain = D.pet.treat();
      D.tick();
      o.munch = D.pet.state();
      for (i = 0; i < 4; i++) D.tick(1);
      o.sit = D.pet.state().mood;
      for (i = 0; i < 8; i++) D.tick(1);
      o.sleep = D.pet.state();
      atMirror();
      D.act();
      o.makerOpen = D.makerOpen();
      D.maker.tab('pet');
      o.spotsHamster = visibleSpots();
      D.maker.pick('petSpot', 'shoulder');
      D.maker.pick('petColor', 2);
      o.riding = D.pet.state().spot;
      D.maker.pick('pet', 'kitten');
      o.spotsKitten = visibleSpots();
      o.kittenSpot = D.pet.look().spot;
      D.maker.pick('pet', 'hamster');
      D.maker.pick('petSpot', 'shoulder');
      D.maker.done();
      var m = JSON.parse(Learner.storage.getItem('avatar_v1'));
      o.mirror = { pet: m.pet, spot: m.petSpot, color: m.petColor, hat: m.petWear.hat };
      o.rides = D.pet.state().spot;
      return out(o);
    }
    if (mode === 'wardrobe') {
      D.teleport('shop');
      D.stand(55.6, -9.5);
      o.near = D.state().near;
      o.act = text('#act');
      D.act();
      o.open = D.boutiqueOpen();
      o.have = text('.bt-have');
      D.boutique.tab('hats');
      D.boutique.tryOn('crown');
      D.boutique.tab('clothes');
      D.boutique.tryOn('princess');
      o.trying = D.wearing();
      D.boutique.close();
      o.afterClose = D.wearing();
      o.closed = !D.boutiqueOpen();
      // While a panel is open nothing is "near"; one frame finds Lola Lana again.
      D.tick();
      D.act();
      D.boutique.tab('hats');
      D.boutique.buy('cap');
      o.confirm = text('.bt-confirm-text');
      D.boutique.yes();
      o.msg = text('.bt-msg');
      o.owned = Object.keys(JSON.parse(Learner.storage.getItem('wardrobe_v1')).owned);
      o.savedHat = JSON.parse(Learner.storage.getItem('avatar_v1')).wear.hat;
      o.savedBack = JSON.parse(Learner.storage.getItem('avatar_v1')).wear.back;
      o.balance = Wallet.balanceStored();
      o.bought = StudyHistory.list().filter(function (e) { return e.type === 'purchase'; }).map(function (e) { return [e.item, e.coins, e.via]; });
      var crown = document.querySelector('.bt-card[data-item="crown"] .bt-buy');
      o.crownBuy = crown ? { text: crown.textContent, disabled: crown.disabled } : null;
      D.boutique.close();
      o.afterBuy = D.wearing();
      atMirror();
      D.act();
      o.makerOpen = D.makerOpen();
      D.maker.tab('hats');
      D.maker.pick('wear.hat', '');
      o.noHat = D.wearing().hat;
      D.maker.pick('wear.hat', 'cap');
      D.maker.done();
      o.mirrorHat = JSON.parse(Learner.storage.getItem('avatar_v1')).wear.hat;
      o.mirrorBack = JSON.parse(Learner.storage.getItem('avatar_v1')).wear.back;
      return out(o);
    }
    if (mode === 'controls') {
      D.pause();
      var canvas = document.querySelector('canvas'), sprintBtn = document.getElementById('sprint');
      var key = function (type, k) { window.dispatchEvent(new KeyboardEvent(type, { key: k })); };
      // Half a second walking up the street from the gate (quick travel faces her into the campus).
      var walkFor = function () {
        D.teleport('gate');
        D.closeTalk();
        var a = D.state();
        key('keydown', 'w');
        for (var i = 0; i < 5; i++) D.tick(0.1);
        key('keyup', 'w');
        var b = D.state();
        return Math.hypot(b.x - a.x, b.z - a.z);
      };
      o.startZoom = D.view().zoom;
      o.walked = walkFor();
      D.tick(0.1);
      D.closeTalk();
      sprintBtn.click();
      o.pressed = sprintBtn.getAttribute('aria-pressed');
      D.tick(0.1);
      o.armed = D.view().sprint;
      o.ran = walkFor();
      o.speedOn = document.querySelector('.w-speed').classList.contains('on');
      D.tick(0.1);
      o.pressedBrief = sprintBtn.getAttribute('aria-pressed');
      D.tick(0.1);
      D.tick(0.1);
      o.pressedAfter = sprintBtn.getAttribute('aria-pressed');
      o.speedAfter = document.querySelector('.w-speed').classList.contains('on');
      for (var w = 0; w < 20; w++) canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true }));
      o.wheelZoom = D.view().zoom;
      for (var c = 0; c < 40; c++) D.tick(0.1);
      o.dist = D.view().dist;
      var yaw = D.view().yaw;
      var pe = function (type, id, x, target) {
        (target || window).dispatchEvent(new PointerEvent(type, { pointerId: id, clientX: x, clientY: 300, bubbles: true }));
      };
      pe('pointerdown', 11, 300, canvas);
      pe('pointerdown', 12, 500, canvas);
      pe('pointermove', 12, 460);
      o.pinchZoom = D.view().zoom;
      o.pinchYaw = D.view().yaw === yaw;
      pe('pointerup', 12, 460);
      pe('pointerup', 11, 300);
      D.tick(0.1);
      var fill = document.querySelector('.w-zoom-track span');
      o.gauge = fill.style.height;
      document.querySelectorAll('.w-zoom-btn')[1].click();
      o.afterOut = D.view().zoom;
      document.querySelectorAll('.w-zoom-btn')[0].click();
      o.afterIn = D.view().zoom;
      out(o);
      return;
    }
    if (mode === 'zoomed') {
      D.pause();
      for (var zt = 0; zt < 40; zt++) D.tick(0.1);
      o.view = D.view();
      return out(o);
    }
    if (mode === 'mates') {
      D.pause();
      var MLY = World3D.Layout, rs = function (id) { return MLY.rideSpots('grade5').filter(function (s) { return s.id === id; })[0]; };
      D.teleport('playground');
      D.tick(0.1);
      o.visible = D.mates.list().filter(function (k) { return k.visible; }).length;
      D.mates.calm();
      var se = rs('seesaw');
      D.stand(se.x, se.z);
      o.seesawAct = D.actText();
      D.act();
      var r;
      for (r = 0; r < 100 && !D.mates.list().some(function (k) { return k.seat && k.seat.id === 'seesaw'; }); r++) D.tick(0.1);
      o.partner = D.mates.list().filter(function (k) { return k.seat && k.seat.id === 'seesaw'; }).map(function (k) { return k.seat.i; });
      D.stopRide();
      for (r = 0; r < 80 && D.riding(); r++) D.tick(0.1);
      D.tick(0.1);
      o.landed = D.mates.list().filter(function (k) { return k.seat; }).length;
      D.mates.calm();
      D.mates.talk('ella');
      return waitFor(function () { return document.querySelector('.talk-row.stack') && D.talkButtons().length > 3; }, function () {
        o.ellaText = D.talkText();
        o.ellaButtons = D.talkButtons();
        var reviewBefore = Learner.storage.getItem('review_v1');
        D.pressTalk(o.ellaButtons[0]);
        // A wrong answer: her pet explains it first, then Ella speaks again.
        o.ellaTaught = !!D.teach();
        if (o.ellaTaught) D.pressTalk('Got It!');
        o.ellaAfter = D.talkText();
        o.history = StudyHistory.list().filter(function (e) { return e.app === 'life-lab'; })
          .map(function (e) { return { kind: e.kind, answered: e.answered, finished: e.finished, points: e.points }; });
        o.points = Learner.storage.getItem('lifelab_points_v1');
        o.reviewSame = Learner.storage.getItem('review_v1') === reviewBefore;
        o.asked = JSON.parse(Learner.storage.getItem('mates_v1')).asked.length;
        D.pressTalk("🎠 Let's play!");
        D.pressTalk('🌈 Ride the swing!');
        o.ellaState = D.mates.list().filter(function (k) { return k.id === 'ella'; })[0].state;
        var sw = rs('swings');
        D.stand(sw.x, sw.z);
        for (r = 0; r < 30; r++) D.tick(0.1);
        D.act();
        for (r = 0; r < 60 && !D.mates.list().some(function (k) { return k.id === 'ella' && k.seat; }); r++) D.tick(0.1);
        o.ellaSeat = D.mates.list().filter(function (k) { return k.id === 'ella'; })[0].seat;
        D.stopRide();
        for (r = 0; r < 80 && D.riding(); r++) D.tick(0.1);
        D.tick(0.1);
        D.mates.talk('migo');
        o.migoButtons = D.talkButtons();
        D.pressTalk(o.migoButtons[0]);
        o.migoAfter = D.talkText();
        o.fun = JSON.parse(Learner.storage.getItem('mates_v1')).fun;
        D.pressTalk('👋 Bye');
        // The gate is close enough to see the kids; the plaza is not.
        D.teleport('plaza');
        D.tick(0.1);
        o.farVisible = D.mates.list().filter(function (k) { return k.visible; }).length;
        out(o);
      });
    }
    if (mode === 'house') {
      D.pause();
      var LH = World3D.Layout, RH = World3D.Room;
      var spotH = function (id) { return LH.interactables('grade5').filter(function (i) { return i.id === id; })[0]; };
      var hin = spotH('house-in'), hvis = spotH('house-visit');
      D.teleport('house');
      D.stand(hvis.x, hvis.z);
      o.visitNear = D.state().near;
      D.stand(hin.x, hin.z);
      o.doorNear = D.state().near;
      o.doorAct = D.actText();
      o.shownOut = D.sceneShown();
      D.act();
      o.inside = D.inside();
      o.room = D.room();
      o.shownIn = D.sceneShown();
      o.landed = D.state();
      o.popup = D.talking();
      var mq = RH.center(2, 0);
      D.stand(mq.x, mq.z);
      o.mirrorNear = D.state().near;
      o.mirrorAct = D.actText();
      D.act();
      o.makerOpen = D.makerOpen();
      D.maker.done();
      o.makerClosed = !D.makerOpen();
      var dq = RH.center(0, 0);
      D.stand(dq.x + 1.1, dq.z);
      o.deskNear = D.state().near;
      o.deskAct = D.actText();
      D.act();
      o.seat = D.seat();
      D.tick(0.05);
      o.deskPet = D.pet.state();
      return waitFor(function () { return document.querySelector('.talk-row.stack'); }, function () {
        o.deskWho = text('.talk .talk-who');
        o.deskOptions = D.talkButtons();
        D.pressTalk(window.__answer);
        o.deskAfter = D.talkText();
        o.deskRight = JSON.parse(Learner.storage.getItem('house_v1')).deskRight;
        o.answers = D.room().answers;
        D.pressTalk('👋 Bye');
        D.tick(0.05);
        o.donePill = !document.getElementById('room-done').hidden;
        o.doneText = text('#room-done');
        document.getElementById('room-done').click();
        o.seatAfter = D.seat();
        o.deskPetAfter = D.pet.state();
        // She faces the trophy shelf on the west wall, so the camera looks at it from the east.
        var sh = RH.center(1, 1.5);
        D.stand(sh.x, sh.z, -Math.PI / 2);
        o.tapped = D.tapTrophy('life-lab');
        o.trophyText = D.talkText();
        D.closeTalk();
        decorate(o);
        var dr = RH.center(1, 0);
        D.stand(dr.x, dr.z);
        o.outAct = D.actText();
        D.act();
        o.out = D.state();
        o.insideAfter = D.inside();
        o.shownAfter = D.sceneShown();
        var ts = spotH('carpenter');
        D.teleport('shop');
        D.stand(ts.x, ts.z);
        o.tasyoNear = D.state().near;
        o.tasyoAct = D.actText();
        D.act();
        o.carpenterOpen = D.carpenterOpen();
        o.tasyoTitle = text('.maker-title');
        o.tabs = [].map.call(document.querySelectorAll('.maker-tab'), function (b) { return b.textContent; });
        D.carpenter.tab('fun');
        o.funCards = [].map.call(document.querySelectorAll('.bt-card'), function (c) { return c.getAttribute('data-item'); });
        D.carpenter.tryOn('home-globe');
        o.preview = D.carpenterPreview();
        D.carpenter.tab('earned');
        o.locked = text('.bt-card[data-item="home-streak-lamp"] .bt-earn');
        o.lockedBuy = !!document.querySelector('.bt-card[data-item="home-streak-lamp"] .bt-buy');
        D.carpenter.tab('fun');
        var before = Wallet.balanceStored();
        D.carpenter.buy('home-globe');
        o.confirm = text('.bt-confirm-text');
        D.carpenter.yes();
        o.msg = text('.bt-msg');
        o.coinsDown = before - Wallet.balanceStored();
        o.owned = Object.keys(JSON.parse(Learner.storage.getItem('house_v1')).owned);
        o.bought = StudyHistory.list().filter(function (e) { return e.type === 'purchase'; }).map(function (e) { return [e.item, e.coins, e.via]; });
        D.carpenter.close();
        o.previewAfter = D.carpenterPreview();
        o.carpenterClosed = !D.carpenterOpen();
        D.goIn();
        D.closeTalk();
        o.placedAfter = D.room().placed.map(function (p) { return p.id; });
        o.answersAgain = D.room().answers;
        D.stand(mq.x, mq.z);
        D.act();
        document.querySelector('.maker-shop').click();
        o.shopInside = D.inside();
        o.shopTrail = D.trail().to;
        out(o);
      });
    }
    if (mode === 'grow') {
      D.pause();
      D.goIn();
      o.room = D.room();
      o.text = D.talkText();
      o.buttons = D.talkButtons();
      var hg = JSON.parse(Learner.storage.getItem('house_v1'));
      o.seen = hg.seen;
      o.earned = Object.keys(hg.earned).sort();
      D.closeTalk();
      D.goOut();
      D.goIn();
      o.again = D.talking();
      out(o);
    }
    if (mode === 'visit') {
      D.pause();
      var LV = World3D.Layout;
      var vis = LV.interactables('grade5').filter(function (i) { return i.id === 'house-visit'; })[0];
      D.teleport('house');
      D.stand(vis.x, vis.z);
      o.near = D.state().near;
      o.act = D.actText();
      D.act();
      o.room = D.room();
      o.popup = D.talking();
      var vsh = World3D.Room.center(1, 1.5);
      D.stand(vsh.x, vsh.z, -Math.PI / 2);
      o.tapped = D.tapTrophy('science-detectives');
      o.trophyText = D.talkText();
      o.trophyWho = text('.talk .talk-who');
      D.closeTalk();
      D.tick(0.05);
      o.cheerShown = !document.getElementById('room-cheer').hidden;
      o.cheerText = text('#room-cheer');
      document.getElementById('room-cheer').click();
      o.cheerBubble = D.talkText();
      o.cheerButtons = D.talkButtons();
      D.pressTalk(o.cheerButtons[0]);
      o.sent = Family.read(Learner.storage).sent.length;
      o.sentText = D.talkText();
      D.closeTalk();
      o.house = Learner.storage.getItem('house_v1');
      D.goOut();
      o.out = D.state();
      out(o);
    }
    if (mode === 'lost') {
      D.pause();
      o.hasExt = D.loseContext();
      setTimeout(function () { o.wakingShown = D.waking(); }, 150);
      setTimeout(function () { o.wakingHiddenAfter = !D.waking(); out(o); }, 2000);
    }
  }

  if (window.WorldDebug && WorldDebug.ready) run();
  else {
    document.addEventListener('world-ready', run);
    document.addEventListener('world-resting', run);
  }
})();
