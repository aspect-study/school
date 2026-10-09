/* ❓ Ask me! in the world. pick() finds her due review questions in a subject's own lesson files (loaded when she asks);
   answer() scores through the game's engines: StudyKit.start with the game's keys, then Recall moves the box and
   StudyKit pays points, the gap bonus and the streak, exactly like a review round in the game. Each conversation is
   one review quiz in her study history, never finished, so quests do not tick from the world. */
(function (root) {
  'use strict';
  var LIMIT = 3;

  // o = { win, files (LessonFiles), quiz (World3D.Quiz), load(app) → Promise<lessons>, textOf, title, rand }
  function create(o) {
    var win = o.win, Q = o.quiz, sessions = {};

    function supported(app) { return Q.supports(app) && !!o.files[app]; }
    function dueOf(app) { return win.Recall && win.Recall.dueCount ? win.Recall.dueCount(app) : 0; }

    // Subjects with due questions the world can ask, most due first.
    function dueApps() {
      var due = win.Recall && win.Recall.dueByApp ? win.Recall.dueByApp() : {};
      return Object.keys(due).filter(function (a) { return due[a] > 0 && supported(a); })
        .sort(function (a, b) { return due[b] - due[a] || (a < b ? -1 : 1); });
    }

    function pickFrom(app, lessons, limit) {
      var items = [];
      lessons.forEach(function (l) {
        (l.quiz || []).forEach(function (it) { if (Q.askable(app, l, it)) items.push(it); });
      });
      return win.Recall.pickDue(app, items, function (it) { return Q.info(app, it, o.textOf); }, limit)
        .map(function (it) { return { app: app, item: it, view: Q.view(app, it, o.textOf, o.rand) }; });
    }

    // Resolves [] when nothing is due; rejects when no subject's lesson files would load.
    function pick(apps, limit) {
      limit = limit || LIMIT;
      apps = apps.filter(function (a) { return supported(a) && dueOf(a) > 0; });
      if (!apps.length) return Promise.resolve([]);
      var lists = [], failed = 0;
      return apps.reduce(function (p, app) {
        return p.then(function () {
          return o.load(app).then(function (lessons) {
            try { lists.push(pickFrom(app, lessons, limit)); } catch (e) { failed++; }
          }, function () { failed++; });
        });
      }, Promise.resolve()).then(function () {
        if (failed === apps.length) throw new Error('No lesson files loaded');
        var out = [];
        for (var i = 0; out.length < limit && lists.some(function (l) { return l.length > i; }); i++) {
          lists.forEach(function (l) { if (l[i] && out.length < limit) out.push(l[i]); });
        }
        return out;
      });
    }

    function session(app, list) {
      if (!sessions[app]) {
        var f = o.files[app], SH = win.StudyHistory;
        var n = list.filter(function (q) { return q.app === app; }).length;
        var kit = win.StudyKit.start({ app: app, title: f.title, pointsKey: f.pointsKey, progressKey: f.progressKey });
        kit.startRound();
        sessions[app] = { kit: kit, hist: SH && SH.quizStarted ? SH.quizStarted(app, f.title, 'review', o.title, false, n, 'review') : null };
      }
      return sessions[app];
    }

    // j indexes list[i].view.options.
    function answer(list, i, j) {
      var q = list[i];
      if (q.done) return null;
      q.done = true;
      var opt = q.view.options[j], R = win.Recall, SH = win.StudyHistory;
      var s = session(q.app, list), info = Q.info(q.app, q.item, o.textOf), right = !!opt.right;
      R.begin(list, R.keyOf(q.app, info));
      if (SH && s.hist) SH.quizAnswered(s.hist, right, info.historyQ, opt.history, info.historyAnswer, false);
      var pts = s.kit.answer(right, { helped: false, shield: false });
      R.clear();
      return { right: right, pts: pts, answer: q.view.answer, why: opt.why || '', explain: q.view.explain, good: q.view.good };
    }

    return { pick: pick, answer: answer, dueApps: dueApps, supported: supported, end: function () { sessions = {}; } };
  }

  // Loads a game's lesson scripts once, one game at a time, catching what they hand to StudyKit.lesson. Everyone asking
  // for the same window and files gets the same loader (Hoot's Ask me! and the playground kids), so two loads never
  // swap StudyKit.lesson at once and no lesson script runs twice.
  var loaders = [];
  function loader(win, files) {
    for (var n = 0; n < loaders.length; n++) if (loaders[n].win === win && loaders[n].files === files) return loaders[n].load;
    var doc = win.document, cache = {}, queue = Promise.resolve();
    function script(src) {
      return new Promise(function (ok, fail) {
        var s = doc.createElement('script');
        s.src = src;
        s.async = false;
        var timer = setTimeout(function () { fail(new Error('timeout ' + src)); }, 15000);
        s.onload = function () { clearTimeout(timer); ok(); };
        s.onerror = function (e) { clearTimeout(timer); fail(e); };
        doc.head.appendChild(s);
      });
    }
    function load(app) {
      if (cache[app]) return cache[app];
      var f = files[app];
      if (!f) return Promise.reject(new Error('No lesson files for ' + app));
      var job = queue.then(function () {
        var got = [], kit = win.StudyKit, keep = kit.lesson;
        kit.lesson = function (l) { got.push(l); };
        return Promise.all(f.files.map(function (file) { return script(f.dir + file); }))
          .then(function () { kit.lesson = keep; return got; }, function (e) { kit.lesson = keep; throw e; });
      });
      queue = job.catch(function () {});
      cache[app] = job.catch(function (e) { delete cache[app]; throw e; });
      return cache[app];
    }
    // Fetches the games one after another in the background, so a question is found from files already in hand.
    load.warm = function (apps) {
      return apps.filter(function (a) { return files[a]; }).reduce(function (p, app) {
        return p.then(function () { return load(app).catch(function () {}); });
      }, Promise.resolve());
    };
    loaders.push({ win: win, files: files, load: load });
    return load;
  }

  var exported = { create: create, loader: loader, LIMIT: LIMIT };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.Ask = exported;
})(this);
