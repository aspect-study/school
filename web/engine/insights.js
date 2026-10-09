/* Keep this file ASCII-only: the pages that load it declare no charset.
   The Parent view's Focus and Subjects tabs: quiz answers grouped by subject, lesson and question, the subjects
   that need the most help first. Pure: it reads only what it is given. */
(function (root) {
  'use strict';

  var MIN_ANSWERS = 5;
  var WEAK_BELOW = 80;

  function pct(correct, answered) { return answered > 0 ? Math.round(correct / answered * 100) : null; }
  function num(x) { return typeof x === 'number' && x > 0 ? x : 0; }
  function timeOf(e) { return typeof e.updatedAt === 'number' ? e.updatedAt : typeof e.t === 'number' ? e.t : 0; }
  function level(v) { var n = Math.floor(Number(v)); return n >= 1 ? Math.min(n, 3) : 0; }
  function norm(t) { return String(t == null ? '' : t).replace(/\s+/g, ' ').trim().toLowerCase(); }
  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }

  function lessonName(e) {
    if (e.final) return 'Final Mock Exam';
    var title = String(e.lessonTitle == null ? '' : e.lessonTitle);
    if (e.kind === 'walkthrough') return 'UPAC Walkthrough: ' + title;
    if (e.kind === 'case') return 'Case Study: ' + title;
    return title;
  }

  // 'fixed' once she answers it right without help after her last miss; 'missing' until then. '' when nothing
  // says: answers saved before keys were kept, review: false questions, and Grade 5 Math (its boxes are per lesson).
  function status(key, missedAt, items) {
    var it = key && isObj(items) ? items[key] : null;
    if (!isObj(it) || it.gone || !(it.box >= 1)) return '';
    return it.box >= 2 && typeof it.t === 'number' && it.t > missedAt ? 'fixed' : 'missing';
  }

  function topPick(picks) {
    var best = '', n = 0;
    Object.keys(picks).forEach(function (p) { if (picks[p] > n) { best = p; n = picks[p]; } });
    return { text: best, count: n };
  }

  // entries: study history entries. o: { subjects: [{ app, title }] in game order, items: review_v1 items }.
  function build(entries, o) {
    o = o || {};
    var items = isObj(o.items) ? o.items : {}, list = [], byApp = Object.create(null);

    function subject(app, title) {
      var s = byApp[app];
      if (!s) {
        s = byApp[app] = { app: app, title: String(title || app), answered: 0, correct: 0, quizzes: 0, lessons: [], questions: [],
          lessonOf: Object.create(null), questionOf: Object.create(null) };
        list.push(s);
      }
      return s;
    }

    function addMiss(s, e, w, at) {
      var when = typeof w.t === 'number' ? w.t : at, textKey = 'text:' + w.q;
      var q = w.key && s.questionOf[w.key], byText = s.questionOf[textKey];
      if (!q && byText && (!w.key || !byText.key)) q = byText;
      if (!q) {
        q = { q: String(w.q), answer: '', lastPick: '', lesson: '', key: '', count: 0, last: -1, picks: Object.create(null) };
        s.questions.push(q);
      }
      if (!byText) s.questionOf[textKey] = q;
      if (w.key) { s.questionOf[w.key] = q; if (!q.key) q.key = w.key; }
      q.count++;
      var picked = String(w.picked == null ? '' : w.picked);
      q.picks[picked] = (q.picks[picked] || 0) + 1;
      if (when >= q.last) { q.last = when; q.answer = String(w.answer == null ? '' : w.answer); q.lastPick = picked; }
      if (!q.lesson && e.kind !== 'review') q.lesson = lessonName(e);
    }

    (o.subjects || []).forEach(function (s) { subject(s.app, s.title); });
    (entries || []).forEach(function (e) {
      if (!e || e.type !== 'quiz' || !num(e.answered) || typeof e.app !== 'string') return;
      var s = subject(e.app, e.appTitle), at = timeOf(e), right = Math.min(num(e.correct), num(e.answered));
      s.answered += num(e.answered);
      s.correct += right;
      s.quizzes++;
      if (e.kind !== 'review') {
        var name = lessonName(e), l = s.lessonOf[name];
        if (!l) s.lessons.push(l = s.lessonOf[name] = { title: name, lessonId: '', answered: 0, correct: 0, quizzes: 0, last: 0 });
        if (!l.lessonId && e.lessonId != null && e.lessonId !== '') l.lessonId = String(e.lessonId);
        l.answered += num(e.answered);
        l.correct += right;
        l.quizzes++;
        l.last = Math.max(l.last, at);
      }
      (Array.isArray(e.wrong) ? e.wrong : []).forEach(function (w) {
        if (isObj(w) && w.q) addMiss(s, e, w, at);
      });
    });

    var out = { answered: 0, correct: 0, pct: null, toFix: 0, fixed: 0, subjects: list };
    list.forEach(function (s) {
      s.pct = pct(s.correct, s.answered);
      s.toFix = 0;
      s.fixed = 0;
      s.lessons.forEach(function (l) {
        l.pct = pct(l.correct, l.answered);
        l.weak = l.answered >= MIN_ANSWERS && l.pct < WEAK_BELOW;
      });
      s.lessons.sort(function (a, b) { return a.pct - b.pct || b.answered - a.answered; });
      s.questions.forEach(function (q) {
        q.status = status(q.key, q.last, items);
        var top = topPick(q.picks);
        q.repeatedPick = top.count >= 2 ? top.text : '';
        delete q.picks;
        if (q.status === 'fixed') s.fixed++;
        else s.toFix++;
      });
      s.questions.sort(function (a, b) {
        return (a.status === 'fixed') - (b.status === 'fixed') || b.count - a.count || b.last - a.last;
      });
      delete s.lessonOf;
      delete s.questionOf;
      out.answered += s.answered;
      out.correct += s.correct;
      out.toFix += s.toFix;
      out.fixed += s.fixed;
    });
    out.pct = pct(out.correct, out.answered);
    list.sort(function (a, b) {
      return (b.answered > 0) - (a.answered > 0) || b.toFix - a.toFix || (a.pct || 0) - (b.pct || 0) || a.title.localeCompare(b.title);
    });
    return out;
  }

  // The Subjects tab's rows for one subject from build(): every lesson the medals know, in game order, with her
  // answers in the range, then any other lesson she answered (the mock exam, walkthroughs).
  // entry: Mastery.read(storage).apps[app], or undefined. Titles are matched ignoring case and spaces.
  function lessonRows(s, entry) {
    var byTitle = Object.create(null), used = Object.create(null), rows = [];
    s.lessons.forEach(function (l) { byTitle[norm(l.title)] = l; });
    var lessons = isObj(entry) && isObj(entry.lessons) ? entry.lessons : {};
    var order = isObj(entry) && Array.isArray(entry.order) ? entry.order : Object.keys(lessons);
    var seenId = Object.create(null);
    order.forEach(function (id) {
      var m = lessons[id];
      if (!isObj(m) || seenId[id]) return;
      seenId[id] = true;
      var l = byTitle[norm(m.title)];
      if (l) used[norm(l.title)] = true;
      rows.push({ title: String(m.title == null ? '' : m.title).trim(), medal: level(m.best), polish: level(m.now) < level(m.best),
        answered: l ? l.answered : 0, pct: l ? l.pct : null });
    });
    s.lessons.forEach(function (l) {
      if (!used[norm(l.title)]) rows.push({ title: l.title, medal: 0, polish: false, answered: l.answered, pct: l.pct });
    });
    return rows;
  }

  function validItem(items, k) {
    var it = isObj(items) && Object.prototype.hasOwnProperty.call(items, k) ? items[k] : null;
    return isObj(it) && !it.gone && it.box >= 1 && it.box <= 5 && typeof it.due === 'string';
  }

  function dueNow(it, today) { return it.due <= today && it.started !== today; }

  // The review_v1 keys behind a subject's "Practice these": its questions still missing, and for games whose
  // review is per lesson (Grade 5 Math: app|skill:lessonId) its weak lessons. Only keys that already have a box.
  function practiceKeys(s, items) {
    var keys = [], seen = Object.create(null);
    function add(k) { if (k && !seen[k] && validItem(items, k)) { seen[k] = true; keys.push(k); } }
    s.questions.forEach(function (q) { if (q.status === 'missing') add(q.key); });
    s.lessons.forEach(function (l) { if (l.weak && l.lessonId) add(s.app + '|skill:' + l.lessonId); });
    return keys;
  }

  // How many of these keys are not due now (0 means the button has nothing left to do).
  function practicePending(keys, items, today) {
    return keys.filter(function (k) { return validItem(items, k) && !dueNow(items[k], today); }).length;
  }

  // Makes the keys due today so they lead her next review round. A question goes back to box 1; a lesson skill
  // keeps its box so its medal does not drop. Returns how many changed.
  function markDue(items, keys, today, now) {
    var n = 0;
    keys.forEach(function (k) {
      if (!validItem(items, k) || dueNow(items[k], today)) return;
      var it = items[k];
      items[k] = { box: k.indexOf('|skill:') >= 0 ? it.box : 1, due: it.due < today ? it.due : today, t: now };
      n++;
    });
    return n;
  }

  var PRACTICE_KEEP_MS = 56 * 86400000;

  // Local Monday 00:00 of that day's week, the same weeks as the weekly boss.
  function weekStart(ms) {
    var d = new Date(ms);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() - (d.getDay() + 6) % 7).getTime();
  }

  function validSend(it) {
    return isObj(it) && typeof it.t === 'number' && isFinite(it.t) && typeof it.app === 'string' && Array.isArray(it.keys);
  }

  function liveItem(items, k) {
    var it = Object.prototype.hasOwnProperty.call(items, k) ? items[k] : null;
    return isObj(it) && !it.gone && typeof it.t === 'number' ? it : null;
  }

  // The Focus tab's "This week": % right per subject this week (Monday to now) against last week, the questions
  // fixed this week, and what happened to this and last week's Practice these sends.
  // o: { subjects: [{ app, title }], items: review_v1 items, sends: practice_v1 sends, now: ms }.
  function weekly(entries, o) {
    o = o || {};
    var now = typeof o.now === 'number' ? o.now : Date.now(), items = isObj(o.items) ? o.items : {};
    var start = weekStart(now), m = new Date(start);
    var prevStart = new Date(m.getFullYear(), m.getMonth(), m.getDate() - 7).getTime();
    var titleOf = Object.create(null), order = [], byApp = Object.create(null);

    (o.subjects || []).forEach(function (s) {
      if (!isObj(s) || typeof s.app !== 'string') return;
      if (!(s.app in titleOf)) { titleOf[s.app] = String(s.title || s.app); order.push(s.app); }
    });
    function row(app, appTitle) {
      if (!byApp[app]) {
        byApp[app] = { app: app, title: app in titleOf ? titleOf[app] : String(appTitle || app),
          now: { answered: 0, correct: 0, pct: null }, before: { answered: 0, correct: 0, pct: null }, change: null };
        if (!(app in titleOf)) order.push(app);
      }
      return byApp[app];
    }
    (entries || []).forEach(function (e) {
      if (!e || e.type !== 'quiz' || !num(e.answered) || typeof e.app !== 'string' || typeof e.t !== 'number') return;
      var week = e.t >= start && e.t <= now ? 'now' : e.t >= prevStart && e.t < start ? 'before' : '';
      if (!week) return;
      var w = row(e.app, e.appTitle)[week];
      w.answered += num(e.answered);
      w.correct += Math.min(num(e.correct), num(e.answered));
    });
    var subjects = [];
    order.forEach(function (app) {
      var r = byApp[app];
      if (!r) return;
      r.now.pct = pct(r.now.correct, r.now.answered);
      r.before.pct = pct(r.before.correct, r.before.answered);
      r.change = r.now.pct !== null && r.before.pct !== null ? r.now.pct - r.before.pct : null;
      subjects.push(r);
    });

    var fixed = 0;
    build(entries, { subjects: o.subjects, items: items }).subjects.forEach(function (s) {
      s.questions.forEach(function (q) {
        var it = q.status === 'fixed' ? liveItem(items, q.key) : null;
        if (it && it.t >= start) fixed++;
      });
    });

    var sends = [], src = isObj(o.sends) ? o.sends : {};
    Object.keys(src).forEach(function (id) {
      var x = src[id];
      if (!validSend(x) || x.t < prevStart) return;
      var out = { id: id, t: x.t, app: x.app, title: x.app in titleOf ? titleOf[x.app] : x.app,
        questions: { total: 0, fixed: 0 }, lessons: { total: 0, practised: 0 } };
      x.keys.forEach(function (k) {
        if (typeof k !== 'string') return;
        var it = liveItem(items, k), done = !!it && it.t > x.t;
        if (k.indexOf('|skill:') >= 0) {
          out.lessons.total++;
          if (done) out.lessons.practised++;
        } else {
          out.questions.total++;
          if (done && it.box >= 2) out.questions.fixed++;
        }
      });
      sends.push(out);
    });
    sends.sort(function (a, b) { return b.t - a.t || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0); });

    return { start: start, prevStart: prevStart, subjects: subjects, fixed: fixed, sends: sends };
  }

  // Records one Practice these tap. Pure: returns a new practice_v1 object; rand is Math.random in the page.
  function addSend(state, app, keys, now, rand) {
    var sends = {}, old = isObj(state) && isObj(state.sends) ? state.sends : {};
    Object.keys(old).forEach(function (id) {
      if (id !== '__proto__' && validSend(old[id]) && old[id].t >= now - PRACTICE_KEEP_MS) sends[id] = old[id];
    });
    sends[now + '-' + Math.floor(rand() * 1e9).toString(36)] = { t: now, app: app, keys: keys.slice() };
    return { v: 1, sends: sends };
  }

  var api = { build: build, lessonRows: lessonRows, status: status, practiceKeys: practiceKeys, practicePending: practicePending, markDue: markDue, weekStart: weekStart, weekly: weekly, addSend: addSend, MIN_ANSWERS: MIN_ANSWERS, WEAK_BELOW: WEAK_BELOW };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
    return;
  }
  root.Insights = api;
})(this);
