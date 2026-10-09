/* When Jesus comes to her, as plain maths with no Three.js: what kind of day she is having (from study history, the
   daily-quest streak and the boss), whether he greets or comforts her today, and which of his lines to say. */
(function (root) {
  'use strict';

  var HARD_WRONG = 5, HARD_RATE = 0.6, LONG_DAY = 30;

  // Today's quiz answers from StudyHistory.list(); dayKey(ms) gives the local day as YYYY-MM-DD.
  function tally(entries, today, dayKey) {
    var out = { answered: 0, correct: 0, wrong: 0 };
    (Array.isArray(entries) ? entries : []).forEach(function (e) {
      if (!e || e.type !== 'quiz' || typeof e.t !== 'number' || dayKey(e.t) !== today) return;
      var a = Number(e.answered) || 0;
      out.answered += a;
      out.correct += Math.min(a, Number(e.correct) || 0);
    });
    out.wrong = out.answered - out.correct;
    return out;
  }

  // Alive yesterday, gone today. streakOf is quests.js's.
  function streakBroke(days, today, yesterday, streakOf) {
    try { return streakOf(days, today).days === 0 && streakOf(days, yesterday).days > 0; } catch (e) { return false; }
  }

  // o = { tally, broke, bossMissed } → 'wrong' | 'streak' | 'boss' | null, in the spec's order.
  function hardDay(o) {
    var t = o.tally || { answered: 0, correct: 0, wrong: 0 };
    if (t.wrong >= HARD_WRONG && t.correct < t.answered * HARD_RATE) return 'wrong';
    if (o.broke) return 'streak';
    if (o.bossMissed) return 'boss';
    return null;
  }

  // daily = Prefs.readDaily(). Comfort wins over the greeting (and counts as it); each comes at most once a local day.
  function visit(daily, today, reason) {
    if (reason && daily.comforted !== today) return 'comfort';
    if (daily.greeted !== today) return 'greet';
    return null;
  }

  // The same line all day, another one tomorrow; k walks on from it (💬 More, a second hug).
  function pick(list, today, k) {
    var h = 0, s = String(today);
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return list[(h + (k || 0)) % list.length];
  }

  // His garden lines, starting with the line of the day; after a long study day "proud" comes first.
  function gardenLines(J, t, today) {
    var start = J.garden.indexOf(pick(J.garden, today, 0));
    var lines = J.garden.slice(start).concat(J.garden.slice(0, start));
    return t && t.answered >= LONG_DAY ? [J.proud].concat(lines) : lines;
  }

  var exported = { LONG_DAY: LONG_DAY, tally: tally, streakBroke: streakBroke, hardDay: hardDay, visit: visit, pick: pick, gardenLines: gardenLines };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.Care = exported;
})(this);
