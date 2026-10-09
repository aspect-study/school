/* The trophy shelf: one cup per subject, coloured by that subject's medals in mastery_v1 (0 grey, 1 bronze, 2 silver,
   3 gold), and the line its bubble shows. Reads entries the way Mastery.counts does, standalone so Node can test it. */
(function (root) {
  'use strict';

  var node = typeof module !== 'undefined' && module.exports;
  var Layout = node ? require('./layout.js') : root.World3D.Layout;
  var NAMES = { en: ['Grey', 'Bronze', 'Silver', 'Gold'], fil: ['Kulay-abo', 'Tanso', 'Pilak', 'Ginto'] };

  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function medal(v) { var n = Math.floor(Number(v)); return n >= 1 ? Math.min(n, 3) : 0; }

  function lessonsOf(entry) {
    if (!isObj(entry) || !isObj(entry.lessons)) return [];
    var order = Array.isArray(entry.order) ? entry.order : Object.keys(entry.lessons);
    return order.filter(function (id, i) { return order.indexOf(id) === i && has(entry.lessons, id) && isObj(entry.lessons[id]); })
      .map(function (id) { return entry.lessons[id]; });
  }

  // none: lessons with no medal yet (the bubble's "N to go").
  function counts(entry) {
    var c = { gold: 0, silver: 0, bronze: 0, total: 0, none: 0 };
    lessonsOf(entry).forEach(function (l) {
      var b = medal(l.best);
      c.total++;
      if (b === 3) c.gold++;
      else if (b === 2) c.silver++;
      else if (b === 1) c.bronze++;
      else c.none++;
    });
    return c;
  }

  // Gold: at least 80% of the lessons gold. Silver: at least half silver or better. Bronze: any medal.
  function level(entry) {
    var c = counts(entry);
    if (!c.total) return 0;
    if (c.gold * 5 >= c.total * 4) return 3;
    if ((c.gold + c.silver) * 2 >= c.total) return 2;
    return c.gold + c.silver + c.bronze > 0 ? 1 : 0;
  }

  // card: the subject's Layout.APPS entry. Grade 5 names the game ("Life Lab") when the card carries its title. Grade 2 names the
  // subject in English, or Filipino first (the first half of its sign) when the Filipino switch is on; Filipino and Makabansa
  // have one name.
  function subject(card, grade) {
    if (grade !== 'grade2') return card.title || card.sign;
    var parts = card.sign.split(' · ');
    return !root.Lang || root.Lang.both() ? parts[0] : parts[parts.length - 1];
  }
  function line(card, entry, grade, T) {
    var c = counts(entry), out = card.emoji + ' ' + subject(card, grade) + ': 🥇 ' + c.gold + ' · 🥈 ' + c.silver + ' · 🥉 ' + c.bronze;
    return c.none ? out + ' · ' + T.toGo.split('{n}').join(String(c.none)) : out;
  }

  function appsOf(mastery) { return isObj(mastery) && isObj(mastery.apps) ? mastery.apps : {}; }
  function entryOf(mastery, app) { var apps = appsOf(mastery); return has(apps, app) ? apps[app] : null; }

  function levels(grade, mastery) {
    var out = {};
    Layout.APPS[Layout.gradeOf(grade)].forEach(function (a) { out[a.app] = level(entryOf(mastery, a.app)); });
    return out;
  }
  // Lessons with any best medal over her grade's subjects: what the room's size counts.
  function medals(grade, mastery) {
    return Layout.APPS[Layout.gradeOf(grade)].reduce(function (n, a) {
      var c = counts(entryOf(mastery, a.app));
      return n + c.gold + c.silver + c.bronze;
    }, 0);
  }

  var exported = { NAMES: NAMES, counts: counts, level: level, subject: subject, line: line, levels: levels, medals: medals };
  if (node) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.Trophies = exported;
})(this);
