/* Playground games with the kids (playmates part 2), the pure part: tag and hide-and-seek, played anywhere on the map
   among random hiding props that each game puts down (props()). The kids are moved through o.move (matemind's own
   steering) and set through o.put; she is moved by her own controls and passed in each tick as
   her = { x, z, still, disguised }. tick() returns events for games3d.js to show and sound; state() is for the pill.

   Tag: she starts as it; touching a kid tags them; the new it counts FREEZE seconds and chases her; no tag-backs for
   NO_BACK seconds; a kid who cannot catch her for GIVE_UP seconds chases another kid instead. A chaser runs a little
   faster than her walk, aims where she is heading, and close up lunges faster than her sprint for a moment and then
   puffs; a kid she chases sidesteps once when she is about to touch them. Danger on/off events say when the chaser is
   close, and getting clear of one counts as a getaway.
   Hide-and-seek, she seeks: she counts (eyes covered), the kids hide behind distinct props far from her, each in a
   different place when they can, and anyone still on the way when the count ends is already hiding; she finds a kid by
   coming near; near the end a hidden kid giggles and the hint names only the place; once a game a kid she comes close
   to may dash to another prop (Sneaky!).
   Hide-and-seek, she hides: a kid counts and then checks the props one by one, finding her when close unless she is
   disguised and still (then they miss MISS of the time); Boo! when the seeker is close surprises them and she wins. */
(function (root) {
  'use strict';

  // Her walk is 9 and her sprint 12.6 (walk.js): chase beats her walk, lunge beats her sprint for lungeT seconds.
  var TAG = {
    time: 120, r: 1.8, freeze: 3, noBack: 3, giveUp: 20, area: 30, fleeR: 14, flee: 8.5, jog: 3.5, chase: 9.6, props: 8,
    lunge: 14, lungeR: 7, lungeT: 1, puff: 1.5, puffSpeed: 7, lead: 0.5, danger: 6, safe: 10, juke: 11, jukeR: 3.5, jukeT: 0.5, jukeRest: 2.5
  };
  // hints: seconds left when a hidden kid giggles; near: no hiding prop closer than this to where she counts;
  // noiseR: a hidden kid within this of her makes a small noise now and then, every noiseNear s up close to noiseFar s at the edge.
  var SEEK = {
    count: 10, time: 240, findR: 3.2, hints: [90, 60, 30], sneakR: 9, sneak: 0.5, run: 7, late: 20, props: 24, near: 20,
    noiseR: 28, noiseNear: 2.2, noiseFar: 7
  };
  var HIDE = { count: 10, time: 120, seeR: 3.5, miss: 0.7, booR: 5, look: 1.2, walk: 5.5, disguiseR: 3 };
  var PROP = { gap: 6, r: 1.3, off: 1.7 };
  var KINDS = ['bush', 'crates', 'barrel', 'hay', 'box', 'flowers'];
  var DISGUISES = ['bush', 'crates', 'barrel'];
  // The Games board, a kid's bubble and a friend's invite all offer games through these groups; a new game is one
  // more id here plus its button and start.
  var GROUPS = [
    { id: 'chase', games: ['tag', 'patintero'] },
    { id: 'hide', games: ['seek'] }
  ];
  var GAMES = GROUPS.reduce(function (all, g) { return all.concat(g.games); }, []);

  var L = root.Lang ? root.Lang.localize : function (t) { return t; };
  function pair(fil, en) { return fil + ' · ' + en; }
  function fill(s, o) { return s.replace(/\{(\w+)\}/g, function (m, k) { return o[k] === undefined ? m : String(o[k]); }); }
  function times(n) { return n === 1 ? 'time' : 'times'; }
  function friends(n) { return n === 1 ? 'friend' : 'friends'; }

  var TEXT = {
    grade5: {
      youreIt: "🏷️ You're it! Tag a friend!", kidIt: '🏷️ {name} is it! Run!', kidCount: '🏷️ {name} is counting… {n}',
      seekCount: '🙈 Cover your eyes and count… {n}', found: '🔎 Found {f} of {n}',
      hideCount: '🙈 Hide! {name} is counting… {n}', seeking: '👀 {name} is looking for you!',
      tagEnd: function (t, e) { return 'Great game! You tagged ' + t + ' ' + friends(t) + ' and got away ' + e + ' ' + times(e) + '!'; },
      allFound: "You found everyone! You're a great finder! 🔎", timeUp: "Time's up! The hiders come out!",
      foundYou: '{name} found you! That was a good hiding spot!', boo: 'You surprised {name}! 😆 You win!',
      bestHider: "Nobody found you! You're the best hider! 🏆",
      why: [
        'Taking turns makes the game fair for everyone!', 'Running makes our bodies and brains strong!',
        "You think like a detective: where can't they see me?", 'Waiting for the count is practice for patience!',
        'You remembered the spots you already checked. Great memory!', 'Win or lose, playing together is the fun part!',
        'Teamwork: watch your teammates and run when the guard looks away!', 'Waiting for the right moment is a superpower!'
      ],
      inviteTag: 'Want to play tag?', inviteSeek: 'Want to play hide-and-seek?',
      boardName: 'Games board',
      kinds: 'What kind of game?', groups: { chase: '🏃 Tag & Chase', hide: '🙈 Hide & Seek' },
      inviteRun: 'Want to play Patintero?',
      patRun: 'Cross every line and come back!', patGuard: '🛡️ Guard the middle line! Tag a runner!',
      patTagged: '😲 Tagged! Teams swap!', patTagger: '🎉 Got one! Teams swap!',
      patScore: '🎉 A point for your team!', patTheyScore: 'They scored! Guard closer!',
      patWin: function (a, b) { return 'Your team won, ' + a + ' to ' + b + '!'; },
      patLose: function (a, b) { return 'The other team won this time, ' + a + ' to ' + b + ". Let's play again!"; },
      patTie: function (a, b) { return 'A tie, ' + a + ' to ' + b + '! Everyone played great!'; },
      hint: function (place) { return place ? '🤭 I hear a giggle near ' + place + '!' : '🤭 I hear a giggle somewhere!'; },
      places: {
        playground: 'the playground', gate: 'the gate', plaza: 'the plaza', street: 'the school street', garden: "Jesus' Garden",
        shop: 'the Shop Plaza', park: 'Whispering Park', house: 'My Little House'
      }
    },
    grade2: L({
      youreIt: pair('🏷️ Ikaw ang taya! Habulin ang isang kaibigan!', "You're it! Tag a friend!"),
      kidIt: pair('🏷️ Si {name} ang taya! Takbo!', '{name} is it! Run!'),
      kidCount: pair('🏷️ Nagbibilang si {name}… {n}', '{name} is counting… {n}'),
      seekCount: pair('🙈 Takpan ang mata at magbilang… {n}', 'Cover your eyes and count… {n}'),
      found: pair('🔎 Nahanap: {f} sa {n}', 'Found {f} of {n}'),
      hideCount: pair('🙈 Magtago ka! Nagbibilang si {name}… {n}', 'Hide! {name} is counting… {n}'),
      seeking: pair('👀 Hinahanap ka ni {name}!', '{name} is looking for you!'),
      tagEnd: function (t, e) {
        return pair('Ang saya! Nataya mo ang ' + t + ' kaibigan at nakatakas ka nang ' + e + ' beses!',
          'Great game! You tagged ' + t + ' ' + friends(t) + ' and got away ' + e + ' ' + times(e) + '!');
      },
      allFound: pair('Nahanap mo silang lahat! Ang galing mong maghanap! 🔎', "You found everyone! You're a great finder! 🔎"),
      timeUp: pair('Tapos na ang oras! Lalabas na ang mga nagtatago!', "Time's up! The hiders come out!"),
      foundYou: pair('Nahanap ka ni {name}! Magaling ang taguan mo!', '{name} found you! That was a good hiding spot!'),
      boo: pair('Nagulat mo si {name}! 😆 Panalo ka!', 'You surprised {name}! 😆 You win!'),
      bestHider: pair('Walang nakahanap sa iyo! Ikaw ang pinakamagaling magtago! 🏆', "Nobody found you! You're the best hider! 🏆"),
      why: [
        pair('Ang pagpapalitan ay patas para sa lahat!', 'Taking turns makes the game fair for everyone!'),
        pair('Ang pagtakbo ay nagpapalakas ng katawan at isip!', 'Running makes our bodies and brains strong!'),
        pair('Para kang detektib: saan kaya ako hindi makikita?', "You think like a detective: where can't they see me?"),
        pair('Ang paghihintay sa bilang ay pagsasanay ng pasensya!', 'Waiting for the count is practice for patience!'),
        pair('Naalala mo ang mga lugar na tiningnan mo na. Ang galing ng memorya mo!', 'You remembered the spots you already checked. Great memory!'),
        pair('Panalo man o talo, masaya kapag magkakasama!', 'Win or lose, playing together is the fun part!'),
        pair('Pagtutulungan: bantayan ang mga kakampi at tumakbo kapag iba ang tinitingnan ng bantay!', 'Teamwork: watch your teammates and run when the guard looks away!'),
        pair('Ang paghihintay sa tamang sandali ay isang superpower!', 'Waiting for the right moment is a superpower!')
      ],
      inviteTag: pair('Gusto mo bang maglaro ng habulan?', 'Want to play tag?'),
      inviteSeek: pair('Gusto mo bang maglaro ng taguan?', 'Want to play hide-and-seek?'),
      boardName: pair('Pisara ng mga laro', 'Games board'),
      kinds: pair('Anong klaseng laro?', 'What kind of game?'),
      groups: { chase: pair('Habulan at Takbuhan', 'Tag & Chase'), hide: pair('Taguan', 'Hide & Seek') },
      inviteRun: pair('Gusto mo bang maglaro ng patintero?', 'Want to play Patintero?'),
      patRun: pair('Tumawid sa lahat ng guhit at bumalik!', 'Cross every line and come back!'),
      patGuard: pair('🛡️ Bantayan ang gitnang guhit! Tayain ang tatakbo!', 'Guard the middle line! Tag a runner!'),
      patTagged: pair('😲 Nataya! Magpapalit ang mga koponan!', 'Tagged! Teams swap!'),
      patTagger: pair('🎉 Nakataya! Magpapalit ang mga koponan!', 'Got one! Teams swap!'),
      patScore: pair('🎉 Isang puntos para sa koponan mo!', 'A point for your team!'),
      patTheyScore: pair('Nakapuntos sila! Bantayan nang mabuti!', 'They scored! Guard closer!'),
      patWin: function (a, b) { return pair('Panalo ang koponan mo, ' + a + ' laban sa ' + b + '!', 'Your team won, ' + a + ' to ' + b + '!'); },
      patLose: function (a, b) {
        return pair('Panalo ang kabila ngayon, ' + a + ' laban sa ' + b + '. Maglaro ulit tayo!', 'The other team won this time, ' + a + ' to ' + b + ". Let's play again!");
      },
      patTie: function (a, b) { return pair('Tabla, ' + a + ' laban sa ' + b + '! Ang galing ng lahat!', 'A tie, ' + a + ' to ' + b + '! Everyone played great!'); },
      hint: function (place) {
        if (!place) return pair('🤭 May humahagikgik sa kung saan!', 'I hear a giggle somewhere!');
        var two = place.split(' · ');
        return pair('🤭 May humahagikgik malapit sa ' + two[0] + '!', 'I hear a giggle near ' + (two[1] || two[0]) + '!');
      },
      places: {
        playground: 'palaruan · the playground', gate: 'tarangkahan · the gate', plaza: 'plasa · the plaza',
        street: 'kalye ng paaralan · the school street', garden: "Hardin ni Jesus · Jesus' Garden", shop: 'Tindahan · the Shop Plaza',
        park: 'Parke ng Bulong · Whispering Park', house: 'Munting Bahay Ko · My Little House'
      }
    })
  };
  // Buttons and word pops are English on both grades.
  var BUTTONS = {
    tag: '🏷️ Tag!', seek: '🙈 Hide and seek!', again: '🔁 Play again', end: '✖ End game', disguise: '🌳 Disguise',
    boo: '👻 Boo!', yes: 'Yes!', no: 'No thanks', board: '🎲 Games board', patintero: '🏃 Patintero!', chase: '🏃 Tag & Chase',
    hide: '🙈 Hide & Seek', back: '⬅ Back', play: "🎲 Let's play!"
  };
  var POPS = {
    run: 'Run!', sneaky: '🤭 Sneaky!', waah: '😱 Waaah!', found: 'Found!', here: 'Here I am!', tagged: '😲', giggle: '😆', cheer: '🎉',
    lunge: 'Here I come!', close: 'So close!', juke: '😜'
  };

  function shuffle(list, rand) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rand() * (i + 1)), t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }
  function inArea(h, rand) {
    if (h.hx) return { x: h.x + (rand() * 2 - 1) * h.hx, z: h.z + (rand() * 2 - 1) * h.hz };
    var a = rand() * Math.PI * 2, d = Math.sqrt(rand()) * h.r;
    return { x: h.x + Math.cos(a) * d, z: h.z + Math.sin(a) * d };
  }
  function dist(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }

  // n random hiding props spread over areas (round robin, so every area gets some), at least PROP.gap apart, where
  // ok(x, z) allows (free ground, off the paths, away from her). New every game.
  function props(areas, n, rand, ok) {
    var out = [], order = shuffle(areas, rand), tries = 0;
    while (out.length < n && tries < n * 40 && order.length) {
      var area = order[tries % order.length], p = inArea(area, rand);
      tries++;
      if (!ok(p.x, p.z) || out.some(function (q) { return dist(p, q) < PROP.gap; })) continue;
      out.push({
        id: 'prop' + out.length, kind: KINDS[Math.floor(rand() * KINDS.length) % KINDS.length], x: p.x, z: p.z, r: PROP.r,
        area: area.id || 'area' + areas.indexOf(area)
      });
    }
    return out;
  }

  // Where a kid hides behind prop p: on its far side from (fx, fz).
  function behind(p, fx, fz) {
    var dx = p.x - fx, dz = p.z - fz, d = Math.hypot(dx, dz) || 1;
    return { x: p.x + dx / d * PROP.off, z: p.z + dz / d * PROP.off };
  }

  // o = { rand, move(id, x, z, speed, dt) → arrived, where(id) → { x, z }, put(id, p) }
  function create(o) {
    var rand = o.rand, st = null;

    function face(id, to) { var p = o.where(id); o.put(id, { face: Math.atan2(to.x - p.x, to.z - p.z), still: true }); }

    function base(kind, ids, her, list) {
      st = {
        kind: kind, ids: ids.slice(), start: { x: her.x, z: her.z }, props: list, t: 0, done: false, result: null, plans: {},
        kids: {}
      };
      ids.forEach(function (id) { st.kids[id] = {}; });
      return st;
    }

    // --- tag ----------------------------------------------------------------------------------------------------
    function startTag(ids, her, list) {
      base('tag', ids, her, list || []);
      st.it = 'her';
      st.freeze = 0;
      st.noBack = {};
      st.herSafe = 0;
      st.chaseT = 0;
      st.target = 'her';
      st.tagged = 0;
      st.escaped = 0;
      st.shown = 0;
      st.lunge = 0;
      st.puff = 0;
      st.danger = false;
      st.chaseD = null;
      st.herAt = { x: her.x, z: her.z };
      st.herV = { x: 0, z: 0 };
      return [{ type: 'start', kind: 'tag' }].concat(ids.map(function (id) { return { type: 'pop', kid: id, text: POPS.run }; }));
    }

    function clampArea(p) {
      var c = st.start, d = dist(p, c), max = TAG.area * 0.9;
      return d <= max ? p : { x: c.x + (p.x - c.x) / d * max, z: c.z + (p.z - c.z) / d * max };
    }
    // Runs away from chaser c when close, otherwise jogs round the area. A kid another kid chases runs slower, so that
    // chase ends soon and the game comes back to her. With her as the chaser (herChases), a kid she is about to touch
    // sidesteps once, then needs a rest before the next one.
    function roam(id, c, dt, slow, herChases, ev) {
      var me = o.where(id), k = st.kids[id];
      k.jukeRest = Math.max(0, (k.jukeRest || 0) - dt);
      if (c && dist(me, c) < TAG.fleeR) {
        var dx = me.x - c.x, dz = me.z - c.z, d = Math.hypot(dx, dz) || 1, side = (k.side = k.side || (rand() < 0.5 ? -1 : 1));
        if (herChases && !(k.juke > 0) && !k.jukeRest && d <= TAG.jukeR) {
          k.juke = TAG.jukeT;
          k.jukeRest = TAG.jukeRest;
          side = k.side = rand() < 0.5 ? -1 : 1;
          ev.push({ type: 'pop', kid: id, text: POPS.juke });
        }
        if (k.juke > 0) {
          k.juke -= dt;
          var j = clampArea({ x: me.x + (dz / d) * side * 5 + (dx / d) * 2, z: me.z - (dx / d) * side * 5 + (dz / d) * 2 });
          o.move(id, j.x, j.z, TAG.juke, dt);
          k.plan = null;
          return;
        }
        var t = clampArea({ x: me.x + (dx / d) * 6 + (dz / d) * side * 3, z: me.z + (dz / d) * 6 - (dx / d) * side * 3 });
        o.move(id, t.x, t.z, slow ? TAG.flee * 0.7 : TAG.flee, dt);
        k.plan = null;
        return;
      }
      if (k.wait > 0) { k.wait -= dt; o.put(id, { still: true }); return; }
      if (!k.plan) k.plan = clampArea(inArea({ x: st.start.x, z: st.start.z, r: TAG.area * 0.8 }, rand));
      if (o.move(id, k.plan.x, k.plan.z, TAG.jog, dt) || (o.where(id).stuck || 0) > 1.5) {
        k.plan = null;
        k.wait = 0.5 + rand() * 1.5;
      }
    }

    // The chaser is no longer after her (caught her, gave up, she is it): the danger is over, with no getaway counted.
    function calm(ev) {
      st.lunge = st.puff = 0;
      st.chaseD = null;
      if (!st.danger) return;
      st.danger = false;
      ev.push({ type: 'danger', on: false });
    }

    // How fast the chaser runs at her this step: a lunge when close (then a puff), otherwise the chase speed.
    function chaseSpeed(d, dt, ev) {
      if (st.puff > 0) { st.puff -= dt; return TAG.puffSpeed; }
      if (st.lunge > 0) {
        st.lunge -= dt;
        if (st.lunge <= 0) st.puff = TAG.puff;
        return TAG.lunge;
      }
      if (d <= TAG.lungeR) {
        st.lunge = TAG.lungeT;
        ev.push({ type: 'lunge', kid: st.it }, { type: 'pop', kid: st.it, text: POPS.lunge });
        return TAG.lunge;
      }
      return TAG.chase;
    }

    function tickTag(dt, her) {
      var ev = [];
      if (dt > 0) {
        var vx = (her.x - st.herAt.x) / dt, vz = (her.z - st.herAt.z) / dt;
        // A jump (a pop-in, quick travel) is not running.
        if (Math.hypot(vx, vz) > 30) vx = vz = 0;
        st.herV = { x: st.herV.x * 0.7 + vx * 0.3, z: st.herV.z * 0.7 + vz * 0.3 };
      }
      st.herAt = { x: her.x, z: her.z };
      Object.keys(st.noBack).forEach(function (id) { st.noBack[id] -= dt; });
      st.herSafe -= dt;
      if (st.it === 'her') {
        st.ids.forEach(function (id) {
          var p = o.where(id);
          if (st.it === 'her' && dist(p, her) <= TAG.r && !(st.noBack[id] > 0)) {
            st.it = id;
            st.freeze = TAG.freeze;
            st.shown = 0;
            st.herSafe = TAG.noBack;
            st.target = 'her';
            st.chaseT = 0;
            st.tagged++;
            ev.push({ type: 'tagged', kid: id }, { type: 'pop', kid: id, text: POPS.tagged });
            return;
          }
          if (st.it === 'her') roam(id, her, dt, false, true, ev);
        });
        return ev;
      }
      var it = st.it, at = o.where(it);
      if (st.freeze > 0) {
        st.freeze -= dt;
        var n = Math.max(1, Math.ceil(st.freeze));
        if (st.freeze > 0 && n !== st.shown) { st.shown = n; ev.push({ type: 'count', kid: it, n: n }); }
        face(it, her);
      } else {
        st.chaseT += dt;
        if (st.target === 'her') {
          var d0 = dist(at, her), speed = chaseSpeed(d0, dt, ev), ahead = Math.min(TAG.lead, d0 / speed);
          o.move(it, her.x + st.herV.x * ahead, her.z + st.herV.z * ahead, speed, dt);
        } else {
          var prey = o.where(st.target);
          o.move(it, prey.x, prey.z, TAG.chase, dt);
        }
        at = o.where(it);
        var goal = st.target === 'her' ? her : o.where(st.target);
        if (st.target === 'her' && dist(at, her) <= TAG.r && !(st.herSafe > 0)) {
          st.noBack[it] = TAG.noBack;
          st.it = 'her';
          st.chaseT = 0;
          calm(ev);
          ev.push({ type: 'gotYou', kid: it }, { type: 'pop', kid: it, text: POPS.cheer });
          return ev;
        }
        if (st.target !== 'her' && dist(at, goal) <= TAG.r) {
          var was = it;
          st.noBack[was] = TAG.noBack;
          st.it = st.target;
          st.target = 'her';
          st.freeze = TAG.freeze;
          st.shown = 0;
          st.chaseT = 0;
          ev.push({ type: 'kidTagged', kid: st.it, by: was }, { type: 'pop', kid: st.it, text: POPS.tagged });
          return ev;
        }
        if (st.target === 'her') {
          var d = st.chaseD = dist(at, her);
          if (!st.danger && d <= TAG.danger) {
            st.danger = true;
            ev.push({ type: 'danger', on: true });
          } else if (st.danger && d > TAG.safe) {
            st.danger = false;
            st.escaped++;
            ev.push({ type: 'danger', on: false, escaped: true }, { type: 'pop', kid: it, text: POPS.close });
          }
        }
        if (st.target === 'her' && st.chaseT > TAG.giveUp && st.ids.length > 1) {
          var others = st.ids.filter(function (id) { return id !== it; });
          others.sort(function (a, b) { return dist(o.where(a), at) - dist(o.where(b), at); });
          st.target = others[0];
          st.chaseT = 0;
          st.escaped++;
          calm(ev);
          ev.push({ type: 'gaveUp', kid: it, chase: st.target });
        }
      }
      st.ids.forEach(function (id) {
        if (id === st.it) return;
        roam(id, st.freeze > 0 ? null : o.where(st.it), dt, st.target === id, false, ev);
      });
      return ev;
    }

    // --- hide-and-seek: she seeks ---------------------------------------------------------------------------------
    // Each kid gets a different prop, at least SEEK.near from where the counting is (the farthest ones when too few are
    // that far), each in a different place while there are places left, picked at random so no spot is a favourite.
    function assign(ids, from) {
      var far = shuffle(st.props.filter(function (p) { return dist(p, from) >= SEEK.near; }), rand);
      if (far.length < ids.length) far = st.props.slice().sort(function (a, b) { return dist(b, from) - dist(a, from); });
      var used = [], places = [];
      ids.forEach(function (id, n) {
        var left = far.filter(function (p) { return used.indexOf(p) < 0; });
        var p = left.filter(function (q) { return places.indexOf(q.area) < 0; })[0] || left[0] || far[n % far.length], k = st.kids[id];
        used.push(p);
        places.push(p.area);
        k.prop = p;
        k.spot = behind(p, from.x, from.z);
      });
    }

    function startSeek(ids, her, list) {
      base('seek', ids, her, list);
      st.phase = 'count';
      st.count = SEEK.count;
      st.shown = 0;
      st.hints = 0;
      st.sneaked = false;
      st.found = [];
      assign(ids, st.start);
      return [{ type: 'start', kind: 'seek' }];
    }

    // A kid runs to their spot and hides there; one still on the way after SEEK.late seconds pops in.
    function hideStep(id, dt, speed) {
      var k = st.kids[id];
      if (k.hidden || k.found || k.sneak) return;
      k.late = (k.late || 0) + dt;
      var there = o.move(id, k.spot.x, k.spot.z, speed, dt);
      if (!there && k.late < SEEK.late) return;
      if (!there) o.put(id, { x: k.spot.x, z: k.spot.z });
      k.hidden = true;
      o.put(id, { hidden: true, still: true });
    }

    function backHome(id, dt) {
      var k = st.kids[id];
      if (!k.home) {
        var a = st.found.length * 1.3;
        k.home = { x: st.start.x + Math.sin(a) * 3, z: st.start.z + Math.cos(a) * 3 };
      }
      if (o.move(id, k.home.x, k.home.z, SEEK.run * 0.7, dt)) o.put(id, { cheer: true, still: true });
    }

    function tickSeek(dt, her) {
      var ev = [];
      if (st.phase === 'count') {
        st.count -= dt;
        var n = Math.max(1, Math.ceil(st.count));
        if (st.count > 0 && n !== st.shown) { st.shown = n; ev.push({ type: 'count', n: n }); }
        if (st.count <= 0) {
          st.phase = 'look';
          st.t = 0;
          // Her eyes open on hidden kids only: anyone still on the way is already at their spot.
          st.ids.forEach(function (id) {
            var k = st.kids[id];
            if (k.hidden) return;
            o.put(id, { x: k.spot.x, z: k.spot.z });
            k.hidden = true;
            o.put(id, { hidden: true, still: true });
          });
          ev.push({ type: 'go' });
        }
      } else st.t += dt;
      st.ids.forEach(function (id) {
        var k = st.kids[id];
        if (k.found) return backHome(id, dt);
        if (k.sneak) {
          if (o.move(id, k.spot.x, k.spot.z, SEEK.run, dt)) { k.sneak = false; k.hidden = true; o.put(id, { hidden: true, still: true }); }
        } else hideStep(id, dt, SEEK.run);
        if (st.phase !== 'look') return;
        var p = o.where(id), d = dist(p, her);
        if (d <= SEEK.findR) {
          k.found = true;
          k.hidden = false;
          var sneaky = !!k.sneak;
          k.sneak = false;
          o.put(id, { hidden: false, cheer: true, still: true, face: Math.atan2(her.x - p.x, her.z - p.z) });
          st.found.push(id);
          ev.push({ type: 'found', kid: id, sneaky: sneaky }, { type: 'pop', kid: id, text: sneaky ? POPS.sneaky : POPS.giggle });
          return;
        }
        if (k.hidden) {
          k.noiseT = (k.noiseT === undefined ? 1 + rand() * 2 : k.noiseT) - dt;
          if (k.noiseT <= 0) {
            var near = Math.max(0, 1 - d / SEEK.noiseR);
            if (near > 0) {
              ev.push({ type: 'noise', kid: id, near: near });
              k.noiseT = SEEK.noiseFar - (SEEK.noiseFar - SEEK.noiseNear) * near + rand();
            } else k.noiseT = 1;
          }
        }
        // The kids' twist: once a game, a kid she comes close to may dash to another prop.
        if (k.hidden && !st.sneaked && !k.tested && d <= SEEK.sneakR) {
          k.tested = true;
          if (rand() < SEEK.sneak) {
            var taken = st.ids.map(function (j) { return st.kids[j].prop; });
            var next = st.props.filter(function (q) { return taken.indexOf(q) < 0 && dist(q, her) > 10 && dist(q, p) < 30; })[0];
            if (next) {
              st.sneaked = true;
              k.hidden = false;
              k.sneak = true;
              k.prop = next;
              k.spot = behind(next, her.x, her.z);
              o.put(id, { hidden: false });
              ev.push({ type: 'sneak', kid: id }, { type: 'pop', kid: id, text: POPS.sneaky });
            }
          }
        }
      });
      if (st.phase !== 'look') return ev;
      if (st.found.length === st.ids.length) return finish(ev, 'allFound');
      // Running out of time: a hidden kid giggles, and the hint names only the place they are in.
      if (st.hints < SEEK.hints.length && SEEK.time - st.t <= SEEK.hints[st.hints]) {
        st.hints++;
        var hid = st.ids.filter(function (id) { return st.kids[id].hidden; });
        if (hid.length) {
          var g = hid[Math.floor(rand() * hid.length) % hid.length];
          ev.push({ type: 'hint', kid: g, place: st.kids[g].prop.area });
        }
      }
      if (st.t >= SEEK.time) {
        st.ids.forEach(function (id) {
          var k = st.kids[id];
          if (k.found) return;
          k.hidden = false;
          k.sneak = false;
          o.put(id, { hidden: false, cheer: true });
          ev.push({ type: 'pop', kid: id, text: POPS.here });
        });
        return finish(ev, 'timeUp');
      }
      return ev;
    }

    // --- hide-and-seek: she hides -------------------------------------------------------------------------------
    function startHide(ids, her, list, seeker) {
      base('hide', ids, her, list);
      st.phase = 'count';
      st.count = HIDE.count;
      st.shown = 0;
      st.seeker = seeker;
      st.hiders = ids.filter(function (id) { return id !== seeker; });
      st.visited = [];
      st.cur = null;
      st.look = 0;
      st.decided = false;
      st.found = [];
      assign(st.hiders, st.start);
      o.put(seeker, { x: st.start.x, z: st.start.z, still: true });
      return [{ type: 'start', kind: 'hide' }];
    }

    function nextProp(her) {
      var left = st.props.filter(function (p) { return st.visited.indexOf(p) < 0; });
      if (!left.length) return null;
      var at = o.where(st.seeker);
      // Later on, now and then they go straight to the prop nearest her: a good guess.
      if (st.t > 10 && rand() < 0.5) left.sort(function (a, b) { return dist(a, her) - dist(b, her); });
      else left.sort(function (a, b) { return dist(a, at) * (0.6 + rand() * 0.8) - dist(b, at) * (0.6 + rand() * 0.8); });
      return left[0];
    }

    function tickHide(dt, her) {
      var ev = [], sk = st.seeker;
      st.hiders.forEach(function (id) {
        var k = st.kids[id];
        if (k.found) backHome(id, dt);
        else hideStep(id, dt, SEEK.run);
      });
      if (st.phase === 'count') {
        st.count -= dt;
        var n = Math.max(1, Math.ceil(st.count));
        if (st.count > 0 && n !== st.shown) { st.shown = n; ev.push({ type: 'count', kid: sk, n: n }); }
        o.put(sk, { still: true, face: Math.atan2(st.start.x - her.x, st.start.z - her.z) });
        if (st.count <= 0) { st.phase = 'look'; st.t = 0; ev.push({ type: 'go', kid: sk }); }
        return ev;
      }
      st.t += dt;
      var at = o.where(sk), d = dist(at, her);
      if (d <= HIDE.seeR) {
        if (!(her.disguised && her.still)) return finish(ev.concat([{ type: 'foundYou', kid: sk }, { type: 'pop', kid: sk, text: POPS.found }]), 'foundYou');
        if (!st.decided) {
          st.decided = true;
          if (rand() >= HIDE.miss) return finish(ev.concat([{ type: 'foundYou', kid: sk }, { type: 'pop', kid: sk, text: POPS.found }]), 'foundYou');
        }
      } else if (d > HIDE.seeR + 2) st.decided = false;
      if (st.look > 0) {
        st.look -= dt;
        o.put(sk, { still: true, face: (at.face || 0) + dt * 3 });
        if (st.look <= 0) st.cur = null;
      } else {
        if (!st.cur) {
          st.cur = nextProp(her);
          if (!st.cur) return finish(ev, 'bestHider');
          st.lookAt = behind(st.cur, at.x, at.z);
        }
        if (o.move(sk, st.lookAt.x, st.lookAt.z, HIDE.walk, dt) || (o.where(sk).stuck || 0) > 2) {
          st.visited.push(st.cur);
          st.look = HIDE.look;
          // Checking the very prop she is on: she is found, however well she is disguised.
          if (dist(st.cur, her) <= HIDE.disguiseR) return finish(ev.concat([{ type: 'foundYou', kid: sk }, { type: 'pop', kid: sk, text: POPS.found }]), 'foundYou');
          st.hiders.forEach(function (id) {
            var k = st.kids[id];
            if (k.hidden && k.prop === st.cur) {
              k.hidden = false;
              k.found = true;
              st.found.push(id);
              o.put(id, { hidden: false, cheer: true });
              ev.push({ type: 'kidFound', kid: id, by: sk }, { type: 'pop', kid: id, text: POPS.giggle });
            }
          });
        }
      }
      if (st.t >= HIDE.time) return finish(ev, 'bestHider');
      return ev;
    }

    // --- shared -------------------------------------------------------------------------------------------------
    function finish(ev, result) {
      st.done = true;
      st.result = result;
      st.ids.forEach(function (id) { o.put(id, { hidden: false, cheer: true, still: true }); });
      return ev.concat([{ type: 'end', kind: st.kind, result: result, kid: st.seeker || null }]);
    }

    // her = { x, z, still, disguised }
    function tick(dt, her) {
      if (!st || st.done) return [];
      if (st.kind === 'tag') {
        st.t += dt;
        var ev = tickTag(dt, her);
        if (!st.done && st.t >= TAG.time) return finish(ev, 'tagEnd');
        return ev;
      }
      return st.kind === 'seek' ? tickSeek(dt, her) : tickHide(dt, her);
    }

    // Boo! when the seeker is close and has not found her: she wins by surprise.
    function booReady(her) {
      return !!st && !st.done && st.kind === 'hide' && st.phase === 'look' && dist(o.where(st.seeker), her) <= HIDE.booR;
    }
    function boo(her) {
      if (!booReady(her)) return [];
      return finish([{ type: 'boo', kid: st.seeker }, { type: 'pop', kid: st.seeker, text: POPS.waah }], 'boo');
    }
    // The prop she can disguise as: the nearest within reach while she hides (after the count too), or null.
    function disguiseProp(her) {
      if (!st || st.done || st.kind !== 'hide') return null;
      var best = null;
      st.props.forEach(function (p) { if (dist(p, her) <= HIDE.disguiseR && (!best || dist(p, her) < dist(best, her))) best = p; });
      return best;
    }

    function state() {
      if (!st) return null;
      var left = st.kind === 'tag' ? TAG.time - st.t : st.phase === 'count' ? null : (st.kind === 'seek' ? SEEK.time : HIDE.time) - st.t;
      return {
        kind: st.kind, phase: st.phase || 'play', it: st.it || null, freeze: st.freeze > 0, seeker: st.seeker || null, done: st.done, result: st.result,
        count: st.phase === 'count' ? Math.max(1, Math.ceil(st.count)) : st.freeze > 0 ? Math.max(1, Math.ceil(st.freeze)) : 0,
        left: left === null ? null : Math.max(0, left), found: st.found ? st.found.length : 0, total: st.kind === 'hide' ? st.hiders.length : st.ids.length,
        tagged: st.tagged || 0, escaped: st.escaped || 0, danger: !!st.danger, chaseD: st.chaseD === undefined ? null : st.chaseD,
        ids: st.ids.slice(), props: st.props,
        hidden: st.ids.filter(function (id) { return st.kids[id].hidden; })
      };
    }

    return {
      startTag: startTag, startSeek: startSeek, startHide: startHide, tick: tick, boo: boo, booReady: booReady,
      disguiseProp: disguiseProp, state: state,
      playing: function () { return !!st && !st.done; },
      stop: function () { st = null; }
    };
  }

  var exported = {
    TAG: TAG, SEEK: SEEK, HIDE: HIDE, PROP: PROP, KINDS: KINDS, DISGUISES: DISGUISES, GROUPS: GROUPS, GAMES: GAMES, TEXT: TEXT,
    BUTTONS: BUTTONS, POPS: POPS,
    props: props, behind: behind, fill: fill, create: create
  };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.MateGame = exported;
})(this);
