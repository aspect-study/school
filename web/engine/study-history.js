/* Keep this file ASCII-only: the pages that load it declare no charset. */
(function (root) {
  'use strict';

  // Saved in the learner's own space (learner.js), so the names carry no grade.
  var KEY = 'history_v1';
  var ERROR_KEY = 'history_error_v1';
  var CORRUPT_PREFIX = 'history_corrupt_v1_';
  var LAST_BACKUP_KEY = 'last_backup_v1';
  var TYPES = ['open', 'lesson', 'quiz', 'purchase', 'test'];
  var MAX_ENTRY_MS = 60 * 60000;
  var ENTITIES = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
    ldquo: '\u201C', rdquo: '\u201D', lsquo: '\u2018', rsquo: '\u2019',
    mdash: '\u2014', ndash: '\u2013', minus: '\u2212', middot: '\u00B7',
    rarr: '\u2192', larr: '\u2190', times: '\u00D7', divide: '\u00F7', hellip: '\u2026',
    frac12: '\u00BD', frac14: '\u00BC', frac34: '\u00BE'
  };

  function plain(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/<\/?[a-z][^<>]*>/gi, '')
      .replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z][a-z0-9]*);/gi, function (match, code) {
        if (code.charAt(0) === '#') {
          var hex = code.charAt(1) === 'x' || code.charAt(1) === 'X';
          var n = parseInt(code.slice(hex ? 2 : 1), hex ? 16 : 10);
          if (isNaN(n) || n <= 0 || n > 0x10FFFF || (n >= 0xD800 && n <= 0xDFFF)) return match;
          return String.fromCodePoint(n);
        }
        return Object.prototype.hasOwnProperty.call(ENTITIES, code) ? ENTITIES[code] : match;
      })
      .replace(/\s+/g, ' ')
      .trim();
  }

  var POWER_UP_NAMES = { hint: 'Hint', fifty: '50/50', second: 'Second Chance', shield: 'Streak Shield', later: 'Save for Later', ate: 'Ask Ate or Kuya', mommy: 'Ask Mommy', tatay: 'Ask Tatay' };

  function pad(n) { return n < 10 ? '0' + n : String(n); }

  function dateKey(ms) {
    var d = new Date(ms);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function dayStart(key, addDays) {
    var p = key.split('-');
    return new Date(+p[0], +p[1] - 1, +p[2] + (addDays || 0)).getTime();
  }

  function inRange(t, from, to) {
    return (!from || t >= dayStart(from)) && (!to || t < dayStart(to, 1));
  }

  var DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

  function idCmp(a, b) {
    var ai = (a && a.id) || '', bi = (b && b.id) || '';
    return ai < bi ? -1 : ai > bi ? 1 : 0;
  }

  // currentKey() gives the review_v1 key of the question being asked (Recall.lastKey), or null.
  function create(storage, now, grade, currentKey) {
    var prefix = /^[a-z0-9]+$/.test(grade || '') ? grade : 'grade2';
    var api = { plain: plain, dateKey: dateKey, grade: prefix };

    // Pure read, never writes: [] for a missing or corrupt value, null only if storage cannot be read at all.
    function read() {
      var raw;
      try { raw = storage.getItem(KEY); } catch (e) { return null; }
      if (!raw) return [];
      try {
        var data = JSON.parse(raw);
        if (data && data.v === 1 && Array.isArray(data.entries)) return data.entries;
      } catch (e) {}
      return [];
    }

    function markError() {
      try { storage.setItem(ERROR_KEY, String(now())); } catch (e) {}
    }

    function save(entries) {
      try {
        storage.setItem(KEY, JSON.stringify({ v: 1, entries: entries }));
        return true;
      } catch (e) {
        markError();
        return false;
      }
    }

    // Never throws: odd stored data (corrupt shapes, unexpected nulls) must not break a caller.
    // Corrupt data is copied aside here, right before a write would otherwise overwrite it.
    function mutate(fn) {
      try {
        var raw;
        try { raw = storage.getItem(KEY); } catch (e) { markError(); return false; }
        var entries;
        if (!raw) {
          entries = [];
        } else {
          entries = null;
          try {
            var data = JSON.parse(raw);
            if (data && data.v === 1 && Array.isArray(data.entries)) entries = data.entries;
          } catch (e) {}
          if (entries === null) {
            try { storage.setItem(CORRUPT_PREFIX + now(), raw); } catch (e) { markError(); return false; }
            entries = [];
          }
        }
        if (fn(entries) === false) return true;
        return save(entries);
      } catch (e) {
        markError();
        return false;
      }
    }

    function clearError() {
      try { storage.removeItem(ERROR_KEY); } catch (e) {}
    }

    function add(fields) {
      var t = now();
      fields.id = t + '-' + Math.random().toString(36).slice(2, 8);
      fields.t = t;
      if (fields.type !== 'open') fields.updatedAt = t;
      return mutate(function (entries) { entries.push(fields); }) ? fields.id : null;
    }

    function update(id, fn) {
      if (!id) return false;
      return mutate(function (entries) {
        for (var i = entries.length - 1; i >= 0; i--) {
          if (entries[i].id === id) { fn(entries[i]); entries[i].updatedAt = now(); return; }
        }
        return false;
      });
    }

    api.appOpened = function (app, appTitle) {
      return add({ type: 'open', app: app, appTitle: plain(appTitle) });
    };

    api.lessonOpened = function (app, appTitle, lessonId, lessonTitle, cardsTotal) {
      return add({
        type: 'lesson', app: app, appTitle: plain(appTitle),
        lessonId: String(lessonId), lessonTitle: plain(lessonTitle),
        cardsTotal: cardsTotal, cardsViewed: 0
      });
    };

    api.cardViewed = function (id, cardNumber) {
      update(id, function (e) {
        if (!Array.isArray(e.seen)) e.seen = [];
        if (e.seen.indexOf(cardNumber) < 0) e.seen.push(cardNumber);
        e.cardsViewed = e.seen.length;
      });
    };

    api.quizStarted = function (app, appTitle, lessonId, lessonTitle, isFinal, total, kind) {
      var fields = {
        type: 'quiz', app: app, appTitle: plain(appTitle),
        lessonId: String(lessonId), lessonTitle: plain(lessonTitle),
        final: !!isFinal, total: total, answered: 0, correct: 0, wrong: [],
        finished: false, stars: 0, points: 0, bestStreak: 0
      };
      if (kind === 'walkthrough' || kind === 'case' || kind === 'review') fields.kind = kind;
      return add(fields);
    };

    function keyNow() {
      try {
        var k = currentKey ? currentKey() : null;
        return typeof k === 'string' && k ? k : null;
      } catch (e) { return null; }
    }

    api.quizAnswered = function (id, isCorrect, q, picked, answer, typed) {
      var key = isCorrect ? null : keyNow();
      update(id, function (e) {
        e.answered++;
        if (isCorrect) e.correct++;
        else {
          var w = { q: plain(q), picked: plain(picked), answer: plain(answer), t: now() };
          if (key) w.key = key;
          e.wrong.push(w);
        }
        if (typed) e.typed = (e.typed || 0) + 1;
      });
    };

    api.powerUpUsed = function (id, kind, coins, q) {
      update(id, function (e) {
        if (!Array.isArray(e.powerUps)) e.powerUps = [];
        e.powerUps.push({ kind: String(kind), coins: coins, q: plain(q) });
      });
    };

    api.quizFinished = function (id, stars, points, bestStreak) {
      update(id, function (e) {
        e.finished = true;
        e.stars = stars;
        e.points = points;
        e.bestStreak = bestStreak;
      });
    };

    // via: 'pin' (typed on the tablet), 'phone' (approved on the parent page), 'wardrobe' (Lola Lana's Boutique), 'pets' (Mang Kiko's Pet Stall), 'toys' (Kuya Pilo's Toy Stall) or 'house' (Tito Tasyo's Workshop).
    api.purchased = function (item, itemName, coins, via) {
      var e = { type: 'purchase', app: 'shop', appTitle: 'Shop', item: String(item), itemName: plain(itemName), coins: coins };
      if (via === 'pin' || via === 'phone' || via === 'wardrobe' || via === 'pets' || via === 'toys' || via === 'house') e.via = via;
      return add(e);
    };

    api.testScore = function (app, appTitle, testName, score, total, coins) {
      return add({ type: 'test', app: String(app), appTitle: plain(appTitle), testName: plain(testName), score: score, total: total, coins: coins });
    };

    // The latest entry for this subject and test name (case-insensitive), or null.
    api.findTest = function (app, testName) {
      var want = plain(testName).toLowerCase(), found = null;
      (read() || []).forEach(function (e) {
        if (validEntry(e) && e.type === 'test' && e.app === app && String(e.testName).toLowerCase() === want && (!found || e.t > found.t)) found = e;
      });
      return found;
    };

    api.prunePurchases = function (days) {
      var cutoff = dayStart(dateKey(now()), -(days - 1));
      function old(e) { return e && e.type === 'purchase' && !(e.t >= cutoff); }
      // Runs on every lobby load, so check with the pure read first: mutate would copy corrupt data aside each time.
      if (!(read() || []).some(old)) return 0;
      var removed = 0;
      mutate(function (entries) {
        for (var i = entries.length - 1; i >= 0; i--) {
          if (old(entries[i])) { entries.splice(i, 1); removed++; }
        }
        if (!removed) return false;
      });
      return removed;
    };

    api.storageError = function () {
      try {
        var v = storage.getItem(ERROR_KEY);
        return v ? Number(v) : null;
      } catch (e) { return null; }
    };

    api.list = function (from, to, app) {
      return (read() || [])
        .filter(function (e) { return validEntry(e) && inRange(e.t, from, to) && (!app || e.app === app); })
        .sort(function (a, b) { return b.t - a.t || idCmp(a, b); });
    };

    api.summary = function (entries) {
      var studyMs = 0, quizzes = 0, finished = 0, pctSum = 0, missed = {}, top = null;
      entries.forEach(function (e) {
        var updatedAt = typeof e.updatedAt === 'number' ? e.updatedAt : e.t;
        if (e.type !== 'open') studyMs += Math.max(0, Math.min(updatedAt - e.t, MAX_ENTRY_MS));
        if (e.type !== 'quiz') return;
        quizzes++;
        var total = typeof e.total === 'number' ? e.total : 0;
        var correct = typeof e.correct === 'number' ? e.correct : 0;
        if (e.finished && total > 0) { finished++; pctSum += correct / total; }
        (Array.isArray(e.wrong) ? e.wrong : []).forEach(function (w) {
          if (!w) return;
          var k = e.app + '\n' + w.q;
          var m = missed[k] || (missed[k] = { app: e.app, appTitle: e.appTitle, q: w.q, count: 0 });
          m.count++;
          if (!top || m.count > top.count) top = m;
        });
      });
      return {
        studyMs: studyMs,
        quizzes: quizzes,
        averagePct: finished ? Math.round(pctSum / finished * 100) : null,
        mostMissed: top
      };
    };

    // Lessons with the lowest share of right answers first; a lesson needs MIN_ANSWERS to be judged.
    var MIN_ANSWERS = 5;
    api.weakSpots = function (entries, limit) {
      var groups = {}, list = [];
      entries.forEach(function (e) {
        if (e.type !== 'quiz' || !(e.answered > 0) || e.kind === 'review') return;
        var lesson = e.final ? 'Final Mock Exam' : e.kind === 'walkthrough' ? 'UPAC Walkthrough: ' + e.lessonTitle :
          e.kind === 'case' ? 'Case Study: ' + e.lessonTitle : e.lessonTitle;
        var k = e.app + '\n' + lesson;
        var g = groups[k];
        if (!g) list.push(g = groups[k] = { app: e.app, appTitle: e.appTitle, lesson: lesson, correct: 0, answered: 0, quizzes: 0 });
        g.correct += typeof e.correct === 'number' ? e.correct : 0;
        g.answered += e.answered;
        g.quizzes++;
      });
      return list.filter(function (g) { return g.answered >= MIN_ANSWERS; })
        .map(function (g) { g.pct = Math.round(g.correct / g.answered * 100); return g; })
        .sort(function (a, b) { return a.pct - b.pct || b.answered - a.answered; })
        .slice(0, limit || 5);
    };

    function validEntry(e) {
      return !!e && typeof e.id === 'string' && typeof e.t === 'number' &&
        typeof e.app === 'string' && TYPES.indexOf(e.type) >= 0;
    }

    api.deleteRange = function (from, to) {
      if (!DATE_RE.test(from) || !DATE_RE.test(to)) return 0;
      var removed = 0;
      var ok = mutate(function (entries) {
        for (var i = entries.length - 1; i >= 0; i--) {
          if (entries[i] && typeof entries[i].t === 'number' && inRange(entries[i].t, from, to)) {
            entries.splice(i, 1); removed++;
          }
        }
      });
      if (!ok) return 0;
      if (removed > 0) clearError();
      return removed;
    };

    api.deleteAll = function () {
      var entries = read();
      if (entries === null) return 0;
      var count = entries.length;
      try { storage.removeItem(KEY); } catch (e) { return 0; }
      clearError();
      return count;
    };

    // Points, coins and rest-days ride along with the history, so a wiped tablet can be fully restored.
    var STATE_KEY_RE = /^(?:[a-z0-9]+_points_v1|wallet_v1|recall_v1|review_v1|mastery_v1|quests_v1|boss_v1|practice_v1|wardrobe_v1|house_v1)$/;
    // Backups made before learners name the wallet and rest-days after the grade.
    var LEGACY_STATE_KEY = new RegExp('^' + prefix + '_(wallet_v1|recall_v1)$');

    function stateOnly(obj) {
      var out = {};
      Object.keys(obj).forEach(function (k) {
        var name = LEGACY_STATE_KEY.test(k) ? k.replace(LEGACY_STATE_KEY, '$1') : k;
        if (STATE_KEY_RE.test(name) && typeof obj[k] === 'string') out[name] = obj[k];
      });
      return out;
    }

    api.exportJson = function (state, learner) {
      var data = { v: 1, grade: prefix, exportedAt: now(), entries: (read() || []).filter(validEntry) };
      if (state) data.state = stateOnly(state);
      if (learner) data.learner = { name: learner.name || '', emoji: learner.emoji || '' };
      return JSON.stringify(data);
    };

    api.backupState = function (text) {
      var data = null;
      try { data = JSON.parse(text); } catch (e) {}
      if (!data || data.grade !== prefix || !data.state || typeof data.state !== 'object' || Array.isArray(data.state)) return null;
      var state = stateOnly(data.state);
      if (!Object.keys(state).length) return null;
      var learner = data.learner && typeof data.learner === 'object' ? { name: String(data.learner.name || ''), emoji: String(data.learner.emoji || '') } : null;
      return { exportedAt: typeof data.exportedAt === 'number' ? data.exportedAt : null, state: state, learner: learner };
    };

    api.markBackedUp = function () {
      try { storage.setItem(LAST_BACKUP_KEY, String(now())); } catch (e) {}
    };

    api.lastBackup = function () {
      var raw = null;
      try { raw = storage.getItem(LAST_BACKUP_KEY); } catch (e) {}
      var ms = parseInt(raw, 10);
      return isNaN(ms) ? null : ms;
    };

    function csvCell(value) {
      var s = value === null || value === undefined ? '' : String(value);
      return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }

    function timeKey(ms) {
      var d = new Date(ms);
      return pad(d.getHours()) + ':' + pad(d.getMinutes());
    }

    function numOr0(x) { return typeof x === 'number' ? x : 0; }

    api.powerUpsText = function (e) {
      var used = Array.isArray(e.powerUps) ? e.powerUps.filter(Boolean) : [];
      if (!used.length) return '';
      var coins = used.reduce(function (sum, p) { return sum + numOr0(p.coins); }, 0);
      return used.map(function (p) { return POWER_UP_NAMES[p.kind] || p.kind; }).join(', ') + ' (' + coins + ' coins)';
    };

    // "8 of 10" rather than "8/10": spreadsheets turn 8/10 into a date.
    function csvRow(e, nameOf) {
      var quiz = e.type === 'quiz';
      if (e.type === 'purchase') {
        return [dateKey(e.t), timeKey(e.t), nameOf ? nameOf(e.app, e.appTitle) : e.appTitle, 'Shop purchase',
          e.itemName + ' (' + numOr0(e.coins) + ' coins)', '', '', '', '', '', '', '', '', ''];
      }
      if (e.type === 'test') {
        return [dateKey(e.t), timeKey(e.t), nameOf ? nameOf(e.app, e.appTitle) : e.appTitle, 'Real test',
          e.testName + ' (+' + numOr0(e.coins) + ' coins)', numOr0(e.score) + ' of ' + numOr0(e.total), '', '', '', '', '', '', '', ''];
      }
      var type = e.type === 'open' ? 'Opened app' : e.type === 'lesson' ? 'Lesson' :
        e.kind === 'walkthrough' ? 'UPAC walkthrough' : e.kind === 'case' ? 'Case study' : e.kind === 'review' ? 'Review' :
        e.final ? 'Final exam' : 'Quiz';
      var wrong = Array.isArray(e.wrong) ? e.wrong.filter(Boolean) : [];
      var updatedAt = typeof e.updatedAt === 'number' ? e.updatedAt : e.t;
      return [
        dateKey(e.t), timeKey(e.t), nameOf ? nameOf(e.app, e.appTitle) : e.appTitle, type,
        e.type === 'open' ? '' : (e.final ? 'Final Mock Exam' : e.lessonTitle),
        quiz ? numOr0(e.correct) + ' of ' + numOr0(e.total) : '',
        quiz ? numOr0(e.answered) : '',
        quiz && e.finished && !e.kind ? numOr0(e.stars) : '',
        quiz && e.finished ? numOr0(e.points) : '',
        e.type === 'open' ? '' : Math.max(0, Math.round((updatedAt - e.t) / 60000)),
        e.type === 'lesson' ? numOr0(e.cardsViewed) + ' of ' + numOr0(e.cardsTotal) : '',
        quiz ? (e.finished ? 'Yes' : 'No') : '',
        quiz ? wrong.map(function (w) {
          return w.q + ' \u2192 ' + w.picked + ' (correct: ' + w.answer + ')';
        }).join(' | ') : '',
        quiz ? api.powerUpsText(e) : ''
      ];
    }

    api.exportCsv = function (nameOf) {
      var rows = [['Date', 'Time', 'Subject', 'Type', 'Lesson', 'Score', 'Answered', 'Stars', 'Points',
        'Minutes', 'Cards viewed', 'Finished', 'Wrong answers', 'Power-ups']];
      (read() || []).filter(validEntry).slice().sort(function (a, b) { return a.t - b.t || idCmp(a, b); }).forEach(function (e) {
        rows.push(csvRow(e, nameOf));
      });
      return '\uFEFF' + rows.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n') + '\r\n';
    };

    api.exportPurchasesCsv = function () {
      var rows = [['Date', 'Time', 'Item', 'Coins']];
      (read() || []).filter(function (e) { return validEntry(e) && e.type === 'purchase'; })
        .sort(function (a, b) { return a.t - b.t || idCmp(a, b); })
        .forEach(function (e) { rows.push([dateKey(e.t), timeKey(e.t), e.itemName, numOr0(e.coins)]); });
      return '\uFEFF' + rows.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n') + '\r\n';
    };

    api.importJson = function (text) {
      var data = null;
      try { data = JSON.parse(text); } catch (e) {}
      if (!data || data.v !== 1 || !Array.isArray(data.entries) || !data.entries.every(validEntry)) {
        throw new Error('This file is not a Study History backup.');
      }
      if (data.grade && data.grade !== prefix) {
        throw new Error('This backup is from a different grade (' + data.grade + ').');
      }
      var result = { added: 0, skipped: 0 };
      var ok = mutate(function (entries) {
        var seen = Object.create(null);
        entries.forEach(function (e) { if (validEntry(e)) seen[e.id] = true; });
        data.entries.forEach(function (e) {
          if (seen[e.id]) { result.skipped++; return; }
          seen[e.id] = true;
          entries.push(e);
          result.added++;
        });
        entries.sort(function (a, b) { return (a && a.t || 0) - (b && b.t || 0) || idCmp(a, b); });
      });
      if (!ok) throw new Error('Could not save: browser storage is full or unavailable.');
      clearError();
      return result;
    };

    return api;
  }

  var exported = { create: create, plain: plain, dateKey: dateKey, KEY: KEY };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  try {
    var script = root.document && root.document.currentScript;
    var grade = script ? script.getAttribute('data-grade') : null;
    var store = root.Learner ? root.Learner.storage : root.localStorage;
    var sh = create(store, Date.now, grade, function () { return root.Recall && root.Recall.lastKey ? root.Recall.lastKey() : null; });
    store.getItem(KEY);
    sh.create = create;
    sh.plain = plain;
    root.StudyHistory = sh;
  } catch (e) {}
})(this);
