/* Turns the raw family, learner and history docs into the owner dashboard's numbers. Pure: no DOM, no Firebase.
   data = { families: [{ uid, email, lastSeenAt }], learners: [{ uid, id, grade }], history: [{ uid, learnerId, entry }] }.
   Keep this file ASCII-only. */
(function (root) {
  'use strict';

  var DAYS = 30;
  var STALE_MS = 7 * 86400000;

  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function dayKey(ms) {
    var d = new Date(ms);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function compute(data, now) {
    var families = (data && data.families) || [], learners = (data && data.learners) || [], history = (data && data.history) || [];
    // Calendar arithmetic, not 86400000 steps, so a daylight-saving change cannot shift a day.
    function dayStart(back) { var d = new Date(now); return new Date(d.getFullYear(), d.getMonth(), d.getDate() - back).getTime(); }
    var weekStart = dayStart(6), todayStart = dayStart(0), from = dayStart(DAYS - 1);

    var daily = [], slot = {};
    for (var i = DAYS - 1; i >= 0; i--) {
      var key = dayKey(dayStart(i));
      slot[key] = daily.length;
      daily.push({ day: key, answered: 0 });
    }

    var seen = { fToday: Object.create(null), f7: Object.create(null), cToday: Object.create(null), c7: Object.create(null) };
    // A family writes these entries, so the maps have no prototype: an app named "__proto__" must stay a plain key.
    var subjects = Object.create(null);
    history.forEach(function (h) {
      var e = h && h.entry;
      if (!e || typeof e.t !== 'number' || e.t < from || e.t > now) return;
      var child = h.uid + '/' + h.learnerId;
      if (e.t >= weekStart) { seen.f7[h.uid] = true; seen.c7[child] = true; }
      if (e.t >= todayStart) { seen.fToday[h.uid] = true; seen.cToday[child] = true; }
      var n = e.type === 'quiz' && typeof e.answered === 'number' && isFinite(e.answered) ? e.answered : 0;
      if (n <= 0) return;
      daily[slot[dayKey(e.t)]].answered += n;
      var app = String(e.app);
      var s = subjects[app] || (subjects[app] = { app: app, title: String(e.appTitle || app), answered: 0 });
      s.answered += n;
    });

    var rows = families.map(function (f) {
      var seenAt = typeof f.lastSeenAt === 'number' ? f.lastSeenAt : null;
      return {
        uid: f.uid,
        email: f.email || '',
        children: learners.filter(function (l) { return l.uid === f.uid; }).length,
        lastSeenAt: seenAt,
        stale: seenAt !== null && now - seenAt > STALE_MS
      };
    }).sort(function (a, b) { return (b.lastSeenAt || 0) - (a.lastSeenAt || 0); });

    function count(o) { return Object.keys(o).length; }
    return {
      at: now,
      totals: {
        families: families.length,
        children: learners.length,
        grade2: learners.filter(function (l) { return l.grade === 2; }).length,
        grade5: learners.filter(function (l) { return l.grade === 5; }).length
      },
      active: { familiesToday: count(seen.fToday), families7: count(seen.f7), childrenToday: count(seen.cToday), children7: count(seen.c7) },
      questionsToday: daily[DAYS - 1].answered,
      daily: daily,
      subjects: Object.keys(subjects).map(function (k) { return subjects[k]; }).sort(function (a, b) { return b.answered - a.answered; }),
      families: rows
    };
  }

  var exported = { compute: compute, DAYS: DAYS };
  if (typeof module !== 'undefined' && module.exports) module.exports = exported;
  else root.AdminStats = exported;
})(this);
