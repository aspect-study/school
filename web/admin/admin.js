/* The owner dashboard page: sign in, check the owner, load the numbers (10-minute cache) and draw them.
   All text goes in with textContent. Keep this file ASCII-only. */
(function (root) {
  'use strict';

  var FR = root.FirebaseRemote, Stats = root.AdminStats, OWNER = root.OWNER_UID, OWNER_EMAIL = root.OWNER_EMAIL;
  var doc = root.document;
  var CACHE = 'admin_cache_v1', FRESH_MS = 10 * 60 * 1000, WINDOW_MS = Stats.DAYS * 86400000;
  var VIEWS = ['signin-view', 'denied-view', 'dash-view'];
  var $ = function (id) { return doc.getElementById(id); };

  function el(tag, cls, text) {
    var e = doc.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function say(text, error) { $('status').textContent = text; $('status').classList.toggle('error', !!error); }
  function show(view) { VIEWS.forEach(function (v) { $(v).hidden = v !== view; }); }

  function ago(ms) {
    if (!ms) return 'Not yet';
    var min = Math.round((Date.now() - ms) / 60000);
    if (min < 1) return 'just now';
    if (min < 60) return min + ' min ago';
    if (min < 1440) return Math.round(min / 60) + ' h ago';
    return Math.round(min / 1440) + ' d ago';
  }

  function readCache() {
    try {
      var c = JSON.parse(root.localStorage.getItem(CACHE));
      if (c && c.stats && Date.now() - c.at < FRESH_MS) return c.stats;
    } catch (e) {}
    return null;
  }
  function writeCache(stats) { try { root.localStorage.setItem(CACHE, JSON.stringify({ at: Date.now(), stats: stats })); } catch (e) {} }
  function clearCache() { try { root.localStorage.removeItem(CACHE); } catch (e) {} }

  function load(force) {
    var cached = force ? null : readCache();
    if (cached) return Promise.resolve(cached);
    var data = { families: [], learners: [], history: [] };
    return FR.adminRemote().then(function (admin) {
      return admin.families().then(function (families) {
        data.families = families;
        return Promise.all(families.map(function (f) { return admin.learners(f.uid); }));
      }).then(function (lists) {
        lists.forEach(function (l) { data.learners = data.learners.concat(l); });
        var since = Date.now() - WINDOW_MS;
        return Promise.all(data.learners.map(function (l) { return admin.history(l.uid, l.id, since); }));
      });
    }).then(function (parts) {
      parts.forEach(function (h) { data.history = data.history.concat(h); });
      var stats = Stats.compute(data, Date.now());
      writeCache(stats);
      return stats;
    });
  }

  function tile(value, label) {
    var t = el('div', 'tile');
    t.appendChild(el('b', '', String(value)));
    t.appendChild(el('span', '', label));
    return t;
  }

  function render(s) {
    var tiles = $('tiles');
    tiles.textContent = '';
    tiles.appendChild(tile(s.totals.families, 'families'));
    tiles.appendChild(tile(s.totals.children, 'children (G2 ' + s.totals.grade2 + ' / G5 ' + s.totals.grade5 + ')'));
    tiles.appendChild(tile(s.active.families7 + ' / ' + s.active.children7, 'active 7 days (families / children)'));
    tiles.appendChild(tile(s.questionsToday, 'questions today'));

    var max = Math.max(1, Math.max.apply(null, s.daily.map(function (d) { return d.answered; })));
    var chart = $('chart');
    chart.textContent = '';
    s.daily.forEach(function (d) {
      var bar = el('div', 'bar');
      bar.style.height = Math.round(d.answered / max * 100) + '%';
      bar.title = d.day + ': ' + d.answered;
      chart.appendChild(bar);
    });
    chart.setAttribute('aria-label', 'Questions answered per day, ' + s.daily[0].day + ' to ' + s.daily[s.daily.length - 1].day);
    $('axis').textContent = '';
    $('axis').appendChild(el('span', '', s.daily[0].day));
    $('axis').appendChild(el('span', '', 'max ' + max));
    $('axis').appendChild(el('span', '', s.daily[s.daily.length - 1].day));

    var subjects = $('subjects');
    subjects.textContent = '';
    if (!s.subjects.length) subjects.appendChild(el('p', 'note', 'No questions answered yet.'));
    var top = s.subjects.length ? s.subjects[0].answered : 1;
    s.subjects.forEach(function (x) {
      var row = el('div', 'sub');
      row.appendChild(el('span', '', x.title));
      row.appendChild(el('span', '', String(x.answered)));
      var bar = el('i');
      bar.style.width = Math.round(x.answered / top * 100) + '%';
      row.appendChild(bar);
      subjects.appendChild(row);
    });

    var fams = $('families');
    fams.textContent = '';
    if (!s.families.length) fams.appendChild(el('p', 'note', 'No families yet.'));
    s.families.forEach(function (f) {
      var r = el('div', 'r');
      r.appendChild(el('span', '', f.email || f.uid));
      r.appendChild(el('span', '', f.children + (f.children === 1 ? ' child' : ' children')));
      r.appendChild(el('span', f.stale ? 'stale' : '', ago(f.lastSeenAt)));
      fams.appendChild(r);
    });
    $('updated').textContent = 'Updated ' + ago(s.at) + '.';
  }

  function refresh(force) {
    say('Loading...');
    load(force).then(function (s) { say(''); render(s); }, function () { say('Could not load. Check the internet and tap Refresh.', true); });
  }

  function onUser(u) {
    $('signout').hidden = !u;
    if (!u) { clearCache(); show('signin-view'); say(''); return; }
    var owner = OWNER && OWNER !== 'OWNER_UID' && u.uid === OWNER && String(u.email).toLowerCase() === OWNER_EMAIL;
    if (!owner) {
      show('denied-view');
      $('denied-note').textContent = 'Signed in as ' + (u.email || 'this account') + '. Your UID is ' + u.uid +
        '. To make it the owner, paste it into web/admin/admin-config.js and firebase/firestore.rules, then publish both.';
      say('');
      return;
    }
    show('dash-view');
    refresh(false);
  }

  $('signin-go').addEventListener('click', function () {
    var email = $('signin-email').value.trim(), pass = $('signin-pass').value;
    if (!email || !pass) { say('Type the email and the password first.', true); return; }
    say('Signing in...');
    FR.admin.signIn(email, pass).then(function () { $('signin-pass').value = ''; }, function (e) { say(FR.signInError(e), true); });
  });
  $('signout').addEventListener('click', function () { FR.admin.signOut(); });
  $('refresh').addEventListener('click', function () { refresh(true); });

  show('signin-view');
  FR.admin.onAuth(onUser).catch(function () { say('Could not reach Firebase. Check the internet and reload.', true); });
})(this);
