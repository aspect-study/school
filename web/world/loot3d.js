/* Gifts and monsters in 3D (loot.js is the pure part). Gift boxes appear at the hangout places now and then and open
   only on a right answer; monsters wander there and fight only when she taps them: a right answer pops the monster and
   drops a gift that is already earned, a wrong one brings a helper (who never calls another). Questions come through
   ask.js like ❓ Ask me! (scored like a review round, saved to her study history, never finished), due ones first, then
   ones she never answered; every wrong answer goes to the pet teacher. Coins: Easy 1, Medium 2, Hard 3, at most
   Loot.CAP a day; Hard also gives a found-only item. Each thing is drawn only within SHOW of her. */
(function (root) {
  'use strict';
  var W = root.World3D = root.World3D || {};
  var SHOW = 60, GIFT_R = 2.6, MONSTER_R = 3.2, TAP_REACH = 10, OPEN_TIME = 0.9, POP_TIME = 0.5;
  var MONSTER_SCALE = 0.75, HELPER_SCALE = 0.5;
  var WRAPS = [['#ff8fc8', '#ffe066'], ['#7fc8ff', '#ffffff'], ['#a8e6a0', '#ff6f91'], ['#c9a7ff', '#ffd166']];

  // o = { S, built, grade, T, store, today(), busy(on), teach(view, opt, then), sfx(name), sound(name), textOf(html),
  //       pay(n) → 'ok' | 'paused', found(id) → true when saved, owned() → closet, blocked(x, z, r), changed(), rand }
  function create(o) {
    var S = o.S, THREE = S.THREE, L = W.Layout, Loot = W.Loot, T = o.T, grade = o.grade, doc = root.document;
    var LT = Loot.TEXT[grade], B = Loot.BUTTONS, rand = o.rand || Math.random;
    var hangouts = L.walkways(grade).hangouts, apps = L.buildings(grade).map(function (b) { return b.app; });
    var asker = W.Ask.create({ win: root, files: W.LessonFiles, quiz: W.Quiz, load: W.Ask.loader(root, W.LessonFiles), textOf: o.textOf, title: LT.title });
    var giftTimer = Loot.timer(Loot.GIFT, rand), monsterTimer = Loot.timer(Loot.MONSTER, rand);
    var gifts = [], monsters = [], seq = 0, talk = null, token = 0, her = { x: 0, z: 0 }, asking = null;
    var ray = new THREE.Raycaster(), ndc = new THREE.Vector2();

    function blocked(x, z, r) { return o.blocked(x, z, r); }

    // --- models -------------------------------------------------------------------------------------------------
    function giftModel(wrap) {
      var g = new THREE.Group(), box = new THREE.Group(), lid = new THREE.Group();
      g.add(box);
      S.add(S.rbox(1.6, 1.3, 1.6, 0.12), wrap[0], 0, 0.65, 0, box);
      S.add(S.rbox(0.32, 1.32, 1.62, 0.04), wrap[1], 0, 0.65, 0, box);
      S.add(S.rbox(1.62, 1.32, 0.32, 0.04), wrap[1], 0, 0.65, 0, box);
      lid.position.y = 1.3;
      box.add(lid);
      S.add(S.rbox(1.75, 0.3, 1.75, 0.1), wrap[0], 0, 0.15, 0, lid);
      S.add(S.rbox(0.34, 0.32, 1.77, 0.04), wrap[1], 0, 0.15, 0, lid);
      [-1, 1].forEach(function (s) { S.add(S.ball(0.32), wrap[1], s * 0.3, 0.45, 0, lid).scale.set(1.2, 0.8, 0.7); });
      S.add(S.ball(0.18), wrap[1], 0, 0.42, 0, lid);
      return { group: g, box: box, lid: lid };
    }

    function monsterModel(kind, helper) {
      var g = new THREE.Group(), body = W.Cast.head(S, kind.color, { eyeColor: kind.eye, eye: 30 }, 3, 2.8, 2.6, 1.2);
      body.position.y = 1.9;
      g.add(body);
      [-1, 1].forEach(function (s) {
        S.add(S.cone(0.35, 0.9, 10), kind.accent, s * 0.9, 1.6, 0, body).rotation.z = -s * 0.35;
        S.add(S.ball(0.5), kind.accent, s * 0.8, -1.55, 0.3, body).scale.set(1, 0.6, 1.2);
        S.add(S.ball(0.42), kind.color, s * 1.65, -0.2, 0.2, body);
      });
      var tag = S.sprite(S.label(kind.face + ' ' + kind.name, kind.accent), 4.6, 4.6 * 180 / 512);
      tag.position.set(0, 4.6, 0);
      g.add(tag);
      g.scale.setScalar(helper ? HELPER_SCALE : MONSTER_SCALE);
      return { group: g, body: body, tag: tag };
    }

    function dispose(group) {
      group.traverse(function (obj) {
        if (obj.isSprite) { if (obj.material.map) obj.material.map.dispose(); obj.material.dispose(); }
      });
      if (group.parent) group.parent.remove(group);
    }

    // --- spawning -----------------------------------------------------------------------------------------------
    function addGift(x, z, earned) {
      var m = giftModel(WRAPS[Math.floor(rand() * WRAPS.length) % WRAPS.length]);
      m.group.position.set(x, 0, z);
      m.group.rotation.y = rand() * Math.PI * 2;
      S.scene.add(m.group);
      var gft = { id: 'gift:' + (++seq), x: x, z: z, m: m, earned: earned || null, open: -1, phase: rand() * 6 };
      gifts.push(gft);
      return gft;
    }

    function addMonster(x, z, area, kind, helper) {
      var m = monsterModel(kind, helper);
      m.group.position.set(x, 0, z);
      S.scene.add(m.group);
      var mon = { id: 'monster:' + (++seq), kind: kind, helper: !!helper, x: x, z: z, area: area, wait: 1 + rand() * 2, face: 0, m: m, pop: -1, phase: rand() * 6, walking: false };
      monsters.push(mon);
      return mon;
    }

    function spawnGift(her) {
      var p = Loot.spot(hangouts, her, Loot.GIFT.away, rand, blocked);
      return p ? addGift(p.x, p.z, null) : null;
    }
    function spawnMonster(her) {
      var p = Loot.spot(hangouts, her, Loot.MONSTER.away, rand, blocked);
      if (!p) return null;
      return addMonster(p.x, p.z, Loot.areaOf(hangouts, p.place), Loot.KINDS[Math.floor(rand() * Loot.KINDS.length) % Loot.KINDS.length], false);
    }

    function removeGift(g) { gifts = gifts.filter(function (x) { return x !== g; }); dispose(g.m.group); }
    function removeMonster(m) { monsters = monsters.filter(function (x) { return x !== m; }); dispose(m.m.group); }

    // --- talking ------------------------------------------------------------------------------------------------
    function say(face, who, text, buttons, sub, stack) {
      if (talk) talk.close();
      o.busy(true);
      var mine = talk = W.Talk.open({
        doc: doc, face: face, who: who, text: text, sub: sub || '', stack: !!stack, pair: grade === 'grade2' && !stack, buttons: buttons,
        onClose: function () {
          if (talk !== mine) return;
          talk = null;
          o.busy(false);
        }
      });
    }
    function bye() { return { text: T.bye }; }
    function english(s) { return String(s).split(' · ').pop(); }
    function giftWho() { return english(LT.gift); }
    function sayGift(text, buttons, sub, stack) { say('🎁', giftWho(), text, buttons, sub, stack); }
    function sayMonster(mon, text, buttons, sub, stack) { say(mon.kind.face, mon.kind.name, text, buttons, sub, stack); }

    function statusOf(app, it) {
      var R = root.Recall, info = W.Quiz.info(app, it, o.textOf), key = R.keyOf(app, info);
      return { key: key, tier: Loot.tierOf(R.status(key)) };
    }

    function candidates(app) {
      return W.Ask.loader(root, W.LessonFiles)(app).then(function (lessons) {
        var out = [];
        lessons.forEach(function (l) {
          (l.quiz || []).forEach(function (it) {
            if (!W.Quiz.askable(app, l, it)) return;
            var s = statusOf(app, it);
            if (s.tier) out.push({ app: app, item: it, key: s.key, tier: s.tier });
          });
        });
        return out;
      }, function () { return null; });
    }

    // Due questions first (every subject with some due, so Hard wins over Medium), then a fresh one from the other
    // subjects in a random order. Resolves a question { app, item, key, tier }, null when none is left, and rejects when
    // no subject's lesson files would load.
    function findQuestion(today) {
      var R = root.Recall, asked = Loot.read(o.store, today).asked;
      var ok = apps.filter(function (a) { return W.Quiz.supports(a) && !!W.LessonFiles[a]; });
      var due = R && R.dueByApp ? R.dueByApp() : {};
      var dueApps = ok.filter(function (a) { return due[a] > 0; }), rest = ok.filter(function (a) { return !(due[a] > 0); });
      for (var i = rest.length - 1; i > 0; i--) {
        var j = Math.floor(rand() * (i + 1)), t = rest[i];
        rest[i] = rest[j];
        rest[j] = t;
      }
      var pool = [], loaded = 0;
      return dueApps.reduce(function (p, app) {
        return p.then(function () { return candidates(app).then(function (c) { if (c) { loaded++; pool = pool.concat(c); } }); });
      }, Promise.resolve()).then(function () {
        var best = Loot.choose(pool.filter(function (c) { return c.tier !== 'easy'; }), asked, rand);
        if (best) return best;
        return rest.concat(dueApps).reduce(function (p, app) {
          return p.then(function (found) {
            if (found) return found;
            var have = dueApps.indexOf(app) >= 0 ? Promise.resolve(pool.filter(function (c) { return c.app === app; })) : candidates(app);
            return have.then(function (c) {
              if (c && dueApps.indexOf(app) < 0) loaded++;
              return c ? Loot.choose(c, asked, rand) : null;
            });
          });
        }, Promise.resolve(null));
      }).then(function (q) {
        if (!q && !loaded && ok.length) throw new Error('No lesson files loaded');
        return q;
      });
    }

    // Asks one question for a gift or a monster. show(text, buttons, sub, stack) speaks for it; done(right, q, opt, r).
    function ask(show, hello, none, done) {
      var my = ++token, today = o.today();
      show(LT.thinking, [bye()]);
      findQuestion(today).then(function (q) {
        if (my !== token || !talk) return;
        if (!q) return none(false);
        Loot.markAsked(o.store, today, q.key, Date.now());
        var v = asking = W.Quiz.view(q.app, q.item, o.textOf, rand), list = [{ app: q.app, item: q.item, view: v }];
        var buttons = v.options.map(function (opt, j) {
          return { text: opt.text, onClick: function () {
            var r = asker.answer(list, 0, j);
            if (!r) return;
            o.changed();
            done(r.right, q, v, opt, r);
          } };
        });
        show(v.q, buttons.concat([bye()]), [hello, LT.tiers[q.tier], v.sub].filter(Boolean).join('\n'), true);
      }, function () {
        if (my === token && talk) none(true);
      });
    }

    // Coins under today's cap, and a found item for a Hard one. Returns the lines to show.
    function reward(tier) {
      var lines = [], today = o.today(), n = Loot.room(o.store, today, tier);
      if (n > 0) {
        if (o.pay(n) === 'ok') {
          Loot.paid(o.store, today, n, Date.now());
          lines.push(LT.coins(n));
        } else lines.push(T.paused);
      } else lines.push(LT.capped);
      if (tier === 'hard') {
        var id = Loot.foundPick(W.Items.FOUND.map(function (it) { return it.id; }), o.owned(), rand);
        if (id && o.found(id)) lines.push(LT.found(W.Items.find(id)));
      }
      return lines;
    }

    function openGift(g, tier, first, pts) {
      g.open = 0;
      o.sfx('gift-open');
      o.built.cheer(g.x, 2.4, g.z);
      var lines = [LT.points(pts || 0)].concat(reward(tier)).filter(Boolean);
      sayGift(first, [bye()], lines.join('\n'));
    }

    function actGift(g) {
      if (g.open >= 0) return;
      if (g.earned) return openGift(g, g.earned, LT.earned, 0);
      ask(function (text, buttons, sub, stack) { sayGift(text, buttons, sub, stack); }, LT.giftAsk,
        function (failed) { sayGift(failed ? LT.fail : LT.none, [bye()]); },
        function (right, q, v, opt, r) {
          if (right) return openGift(g, q.tier, LT.opened, r.pts);
          o.teach(v, opt, function () { sayGift(LT.stillClosed, [{ text: B.again, main: true, onClick: function () { actGift(g); } }, bye()]); });
        });
    }

    function popMonster(mon) {
      mon.pop = 0;
      o.sfx('monster-pop');
      o.built.burst(mon.x, 2, mon.z, [mon.kind.face, '✨', '⭐', '💫'], 14);
    }

    function poof(mon) {
      o.built.sparkle(mon.x, mon.z);
      removeMonster(mon);
    }

    function actMonster(mon) {
      if (mon.pop >= 0) return;
      mon.m.group.lookAt(her.x, 0, her.z);
      o.sfx('monster-giggle');
      var hello = LT.hello[Math.floor(rand() * LT.hello.length) % LT.hello.length];
      ask(function (text, buttons, sub, stack) { sayMonster(mon, text, buttons, sub, stack); }, hello,
        function (failed) {
          sayMonster(mon, failed ? LT.fail : LT.monsterNone, [bye()]);
          if (!failed) poof(mon);
        },
        function (right, q, v, opt, r) {
          if (right) {
            popMonster(mon);
            addGift(mon.x, mon.z, q.tier);
            return sayMonster(mon, LT.defeated, [bye()], LT.points(r.pts));
          }
          o.teach(v, opt, function () {
            if (!mon.helper) {
              var h = Loot.helperSpot(mon, blocked), helper = addMonster(h.x, h.z, mon.area, mon.kind, true);
              o.built.sparkle(helper.x, helper.z);
              o.sfx('monster-giggle');
            }
            sayMonster(mon, mon.helper ? LT.helperBye : LT.called, [bye()]);
            poof(mon);
          });
        });
    }

    // --- each frame ---------------------------------------------------------------------------------------------
    // st: ctl.state; frozen: any bubble, card, the maker or a stall is open (nothing moves or appears).
    function tick(t, dt, st, frozen) {
      her = st;
      if (!frozen) {
        if (giftTimer.due(dt, gifts.filter(function (g) { return !g.earned; }).length)) spawnGift(her);
        if (monsterTimer.due(dt, monsters.filter(function (m) { return !m.helper; }).length)) spawnMonster(her);
      }
      gifts.slice().forEach(function (g) {
        var near = Math.hypot(g.x - her.x, g.z - her.z) <= SHOW;
        g.m.group.visible = near;
        if (g.open >= 0) {
          g.open += dt;
          var k = Math.min(1, g.open / OPEN_TIME);
          g.m.lid.position.y = 1.3 + k * 2.5;
          g.m.lid.rotation.x = -k * 1.6;
          g.m.box.scale.setScalar(1 - Math.max(0, k - 0.6) * 2.4);
          if (k >= 1) removeGift(g);
          return;
        }
        if (near) g.m.box.position.y = 0.15 + Math.abs(Math.sin(t * 2 + g.phase)) * 0.25;
      });
      monsters.slice().forEach(function (mon) {
        var near = Math.hypot(mon.x - her.x, mon.z - her.z) <= SHOW, g = mon.m.group;
        g.visible = near;
        if (mon.pop >= 0) {
          mon.pop += dt;
          var k = Math.min(1, mon.pop / POP_TIME), s = mon.helper ? HELPER_SCALE : MONSTER_SCALE;
          g.scale.setScalar(s * (1 + k * 0.6));
          mon.m.body.rotation.z = Math.sin(k * 30) * 0.3;
          if (k >= 1) removeMonster(mon);
          return;
        }
        if (!frozen) mon.walking = Loot.wander(mon, dt, rand, blocked);
        else mon.walking = false;
        g.position.set(mon.x, 0, mon.z);
        if (mon.walking) g.rotation.y = mon.face;
        if (near) {
          mon.m.body.position.y = 1.9 + Math.abs(Math.sin(t * (mon.walking ? 7 : 2.5) + mon.phase)) * (mon.walking ? 0.5 : 0.2);
          mon.m.body.rotation.z = mon.walking ? Math.sin(t * 7 + mon.phase) * 0.12 : 0;
        }
      });
    }

    function items() {
      var out = [];
      gifts.forEach(function (g) { if (g.open < 0 && g.m.group.visible) out.push({ kind: 'gift', id: g.id, x: g.x, z: g.z, r: GIFT_R }); });
      monsters.forEach(function (m) { if (m.pop < 0 && m.m.group.visible) out.push({ kind: 'monster', id: m.id, x: m.x, z: m.z, r: MONSTER_R * (m.helper ? 0.8 : 1) }); });
      return out;
    }
    function byId(id) {
      return gifts.filter(function (g) { return g.id === id; })[0] || monsters.filter(function (m) { return m.id === id; })[0] || null;
    }
    function label(it) {
      if (it.kind === 'gift') return B.open;
      var m = byId(it.id);
      return B.battle.replace('{name}', m ? m.kind.name : '');
    }
    function act(it) {
      if (talk) return;
      var x = byId(it.id);
      if (!x) return;
      if (it.kind === 'gift') actGift(x);
      else actMonster(x);
    }

    // A tap on the screen: true (and the gift opens or the fight starts) when it lands on one within TAP_REACH of her.
    function hit(cx, cy) {
      if (talk) return false;
      S.scene.updateMatrixWorld();
      S.camera.updateMatrixWorld();
      var r = S.renderer.domElement.getBoundingClientRect();
      ndc.set((cx - r.left) / r.width * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, S.camera);
      var all = gifts.filter(function (g) { return g.open < 0; }).map(function (g) { return { kind: 'gift', x: g, group: g.m.box }; })
        .concat(monsters.filter(function (m) { return m.pop < 0; }).map(function (m) { return { kind: 'monster', x: m, group: m.m.body }; }))
        .filter(function (c) { return c.group.parent && c.x.m.group.visible && Math.hypot(c.x.x - her.x, c.x.z - her.z) <= TAP_REACH; });
      var best = null, bestD = Infinity;
      all.forEach(function (c) {
        var h = ray.intersectObject(c.group, true)[0];
        if (h && h.distance < bestD) { best = c; bestD = h.distance; }
      });
      if (!best) return false;
      act({ kind: best.kind, id: best.x.id });
      return true;
    }

    return {
      tick: tick, items: items, label: label, act: act, hit: hit,
      handles: function (kind) { return kind === 'gift' || kind === 'monster'; },
      talking: function () { return !!talk; },
      closeTalk: function () { if (talk) talk.close(); },
      debug: {
        list: function () {
          return {
            gifts: gifts.map(function (g) { return { id: g.id, x: g.x, z: g.z, earned: g.earned, open: g.open >= 0 }; }),
            monsters: monsters.map(function (m) { return { id: m.id, kind: m.kind.id, helper: m.helper, x: m.x, z: m.z, pop: m.pop >= 0 }; })
          };
        },
        gift: function (x, z, earned) { return addGift(x, z, earned || null).id; },
        monster: function (x, z, helper) {
          var area = { id: 'test', x: x, z: z, r: 3 };
          return addMonster(x, z, area, Loot.KINDS[0], !!helper).id;
        },
        clear: function () { gifts.slice().forEach(removeGift); monsters.slice().forEach(removeMonster); },
        timers: function () { return { gift: giftTimer.left(), monster: monsterTimer.left() }; },
        // The e2e driver answers on purpose: the right or a wrong choice of the last question shown.
        right: function () { return asking ? asking.options.filter(function (x) { return x.right; })[0].text : null; },
        wrong: function () { return asking ? asking.options.filter(function (x) { return !x.right; })[0].text : null; }
      }
    };
  }

  W.Loot3D = { create: create };
})(this);
