/* What the 3D world shows from her progress: each building's medal level and markers, the shop sparkle, the Boss Fort,
   and the guide's next step with where its Go leads. Pure: town.js passes in World.status, World.liveDeps(window) and
   Guide.link, so the world reads progress exactly like the lobby's 2D map. */
(function (root) {
  'use strict';

  var MAX_MINIONS = 12;

  function safe(fn, fallback) {
    try {
      var v = fn();
      return v === undefined || v === null ? fallback : v;
    } catch (e) { return fallback; }
  }

  // The cards the guide and the map expect, in lobby order: { app, name (subject name), emoji, href (lobby card link) }.
  function cards(grade, Layout, subjects) {
    var n = grade === 'grade2' ? 2 : 5, titles = {};
    ((subjects && subjects[n]) || []).forEach(function (s) { titles[s.app] = s.title; });
    return Layout.buildings(grade).map(function (b) {
      return { app: b.app, name: titles[b.app] || b.sign, emoji: b.emoji, href: Layout.appUrl(grade, b.folder) };
    });
  }

  // o = { cards, status (World.status), deps (World.liveDeps), link (Guide.link), bossWin, stageSize, finaleText }
  function snapshot(o) {
    var apps = o.cards.map(function (c) { return c.app; });
    var st = o.status(apps, o.deps);
    var step = safe(function () { return o.deps.guide(o.cards); }, null);
    var boss = safe(function () { return o.deps.boss(); }, {});
    var stages = Array.isArray(boss.stages) ? boss.stages : [];
    var next = stages.filter(function (s) { return s && s.cleared !== true && apps.indexOf(s.app) >= 0; })[0];
    var week = typeof boss.week === 'string' ? boss.week : '';
    var open = stages.filter(function (s) { return s && s.cleared !== true; }).length;
    var finale = !!week && st.arena.total > 0 && st.arena.beaten && o.bossWin !== week;
    if (finale) step = { kind: 'bossWin', text: o.finaleText || '' };
    var due = safe(function () { return o.deps.due(); }, {}), quests = safe(function () { return o.deps.quests(); }, []);
    var info = {};
    apps.forEach(function (app) {
      info[app] = {
        boss: stages.some(function (s) { return s && s.app === app && s.cleared !== true; }),
        quest: Array.isArray(quests) && quests.some(function (q) { return q && q.app === app && q.done !== true; }),
        // Today's review quest only ticks from a review round in the game, so the world leaves its questions there.
        reviewQuest: Array.isArray(quests) && quests.some(function (q) { return q && q.kind === 'review' && q.app === app && q.done !== true; }),
        due: Math.max(0, Math.floor(Number(due[app])) || 0),
        tally: st.apps[app] ? st.apps[app].tally : null
      };
    });
    return {
      apps: st.apps,
      info: info,
      shop: st.shop,
      fort: {
        cleared: st.arena.cleared, total: st.arena.total, beaten: st.arena.beaten, next: next ? next.app : null,
        href: next ? safe(function () { return o.link({ kind: 'boss', app: next.app }, o.cards); }, null) : null,
        week: week, minions: Math.min(MAX_MINIONS, open * (o.stageSize || 3)), finale: finale
      },
      step: step,
      stepHref: step && !finale ? safe(function () { return o.link(step, o.cards); }, null) : null,
      target: finale ? 'boss' : step ? (step.shop === true ? 'shop' : step.app || null) : null
    };
  }

  // The door the guide points at opens the guide's link (?boss=1, ?review=1, ?lesson=); other doors open the plain page.
  function doorHref(snap, app, plain) {
    return snap && snap.step && snap.step.app === app && snap.stepHref ? snap.stepHref : plain;
  }

  function points(storage, keys) {
    var out = {};
    keys.forEach(function (k) { out[k] = safe(function () { return parseInt(storage.getItem(k), 10) || 0; }, 0); });
    return out;
  }

  // Like the lobby shop's canAfford, from each subject's stored points.
  function canAfford(wallet, storage, keys) {
    if (!wallet || !wallet.catalog || !wallet.canBuy) return false;
    var p = points(storage, keys);
    return wallet.catalog.some(function (item) { return safe(function () { return wallet.canBuy(item.id, p).ok === true; }, false); });
  }

  function fill(template, values) {
    return template.replace(/\{(\w+)\}/g, function (m, k) { return values[k] === undefined ? m : String(values[k]); });
  }

  var exported = { cards: cards, snapshot: snapshot, doorHref: doorHref, canAfford: canAfford, points: points, fill: fill };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.Progress = exported;
})(this);
