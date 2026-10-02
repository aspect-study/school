/* The parent page on the phone. Sign in once, type the PIN on every open, pick a child, then see and act on her
   data. The phone is one more synced device: the child is pulled into memory, changed with the same engine
   files as the tablets, and synced back. Nothing is kept on the phone. */
(function () {
  'use strict';

  var FR = window.FirebaseRemote, Core = window.SyncCore, P = window.ParentPanel;
  var LOCK_AFTER_MS = 5 * 60 * 1000;
  var VIEWS = ['signin-view', 'pin-view', 'pick-view', 'child-view'];
  var STATUS_TEXT = {
    approved: 'Approved · waiting for the tablet to buy it',
    done: '✅ Bought on the tablet',
    short: '⚠️ Not enough coins, nothing was bought',
    declined: 'You said no',
    cancelled: 'Cancelled on the tablet',
    expired: 'Too old, nobody answered that day'
  };
  var $ = function (id) { return document.getElementById(id); };
  var user = null, unlocked = false, hiddenAt = 0, child = null, syncing = null, again = false, openGen = 0, opening = false;
  var authHeard = false, authStarting = false;

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function show(view) { VIEWS.forEach(function (id) { $(id).hidden = id !== view; }); }
  function setStatus(text, error) {
    $('status').textContent = text;
    $('status').classList.toggle('error', !!error);
  }
  function time(ms) { return new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }); }
  function label(l) {
    var p = l.profile || {};
    return (p.emoji ? p.emoji + ' ' : '') + (p.name || 'No name yet') + ' · Grade ' + (p.grade || '?');
  }
  function offline() { setStatus('No internet, or the cloud could not be reached. Try again when online.', true); }

  function chime() {
    try {
      var a = new (window.AudioContext || window.webkitAudioContext)(), o = a.createOscillator(), g = a.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.15, a.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.6);
      o.connect(g);
      g.connect(a.destination);
      o.start();
      o.stop(a.currentTime + 0.6);
    } catch (e) {}
  }

  // ---- sign in, PIN, child picker ----
  function route() {
    if (!user) { closeChild(); show('signin-view'); setStatus(''); $('signout').hidden = true; return; }
    $('signout').hidden = false;
    if (!unlocked) { closeChild(); gate.reset(); show('pin-view'); setStatus('Signed in as ' + (user.email || 'the family login') + '.'); return; }
    if (!child) pick();
  }

  var gate = P.pinGate({ dots: $('pin-dots'), pad: $('pin-pad'), hint: $('pin-hint'), hintText: 'Enter the parent PIN', onUnlock: function () { unlocked = true; route(); } });

  function pick() {
    var gen = ++openGen;
    show('pick-view');
    setStatus('Loading the children…');
    FR.remote(user.uid).learners().then(function (list) {
      if (gen !== openGen || !user || !unlocked) return;
      var kids = list.filter(function (l) { return l.profile && Number(l.profile.grade); })
        .sort(function (a, b) { return Number(b.profile.grade) - Number(a.profile.grade); });
      var box = $('kids');
      box.textContent = '';
      if (!kids.length) { setStatus('No child has synced yet. Sign in on a tablet first (Parent, then Cloud backup).'); return; }
      setStatus('');
      if (kids.length === 1) { openChild(kids[0]); return; }
      kids.forEach(function (l) {
        var b = el('button', 'p-btn kid-btn', label(l));
        b.type = 'button';
        b.addEventListener('click', function () {
          Array.prototype.forEach.call(box.children, function (k) { k.disabled = true; });
          openChild(l);
        });
        box.appendChild(b);
      });
    }, offline);
  }

  // ---- one child ----
  function openChild(l) {
    closeChild();
    var gen = ++openGen;
    var grade = Number(l.profile.grade), g = 'grade' + grade;
    var remote = FR.remote(user.uid), space = StudyStore.memorySpace(l.id), core = Core.create(space, remote, l.id);
    setStatus('Loading ' + label(l) + '…');
    opening = true;
    FR.whenSlow(core.sync(), function () { if (gen === openGen) setStatus('Still loading… the connection is slow.'); }).then(function () {
      if (gen === openGen) opening = false;
      if (gen !== openGen || !user || !unlocked) return;
      var c = {
        learner: l, grade: grade, space: space, core: core, seen: {}, loaded: false,
        subjects: window.Subjects[grade] || [],
        history: StudyHistory.create(space, Date.now, g),
        wallet: Wallet.create(space, Date.now, g),
        requests: ShopRequests.create(space, Date.now)
      };
      child = c;
      var box = $('child');
      box.textContent = '';
      box.appendChild($('child-template').content.cloneNode(true));
      c.panel = P.mount({ history: c.history, wallet: c.wallet, store: space, subjects: c.subjects, lobby: false, onChange: sync });
      c.unwatch = remote.watch(l.id, ShopRequests.KEY, function () { sync(); }, function () {
        if (child === c) setStatus('Live updates stopped. Tap Refresh.', true);
      });
      show('child-view');
      render();
      setStatus('Synced at ' + time(Date.now()) + '.');
    }, function () {
      if (gen === openGen) {
        opening = false;
        offline();
        Array.prototype.forEach.call($('kids').children, function (k) { k.disabled = false; });
      }
    });
  }
  function closeChild() {
    openGen++;
    opening = false;
    if (child && child.unwatch) child.unwatch();
    child = null;
    $('child').textContent = '';
  }

  function sync() {
    if (!child) return Promise.resolve();
    if (syncing) { again = true; return syncing; }
    var c = child;
    syncing = FR.whenSlow(c.core.sync(), function () {
      if (child === c) setStatus('Still syncing… the connection is slow. Keep this page open.', true);
    }).then(function () {
      if (child === c) { render(); setStatus('Synced at ' + time(Date.now()) + '.'); }
    }, function () {
      if (Object.keys(c.space.outbox()).length) setStatus('Not sent yet: keep this page open and tap Refresh when online.', true);
      else setStatus('Could not reach the cloud. What you see may be out of date; tap Refresh to try again.', true);
    }).then(function () {
      syncing = null;
      if (again) { again = false; sync(); }
    });
    return syncing;
  }

  function render() {
    renderRequests();
    renderRecent();
    renderCoins();
    renderMedals();
    child.panel.render();
  }

  function renderRequests() {
    var box = $('requests'), list = child.requests.waiting(), fresh = false;
    box.textContent = '';
    box.hidden = !list.length;
    if (list.length) box.appendChild(el('h3', '', '🛒 Waiting for you'));
    list.forEach(function (r) {
      if (!child.seen[r.id]) { child.seen[r.id] = true; fresh = true; }
      var row = el('div', 'req');
      row.appendChild(el('div', 'req-text', (r.emoji ? r.emoji + ' ' : '') + r.name + ' · ' + r.coins + ' coins · asked ' + time(r.t)));
      var yes = el('button', 'p-btn on', 'Approve'), no = el('button', 'p-btn', 'No');
      yes.type = 'button';
      no.type = 'button';
      yes.addEventListener('click', function () { answer(r.id, true); });
      no.addEventListener('click', function () { answer(r.id, false); });
      row.appendChild(yes);
      row.appendChild(no);
      box.appendChild(row);
    });
    if (fresh && child.loaded) chime();
    child.loaded = true;
  }

  function renderRecent() {
    var today = new Date().toDateString();
    var list = child.requests.list().filter(function (r) { return r.status !== 'waiting' && new Date(r.t).toDateString() === today; });
    var box = $('recent');
    box.textContent = '';
    box.hidden = !list.length;
    if (!list.length) return;
    box.appendChild(el('h3', '', 'Today\'s shop requests'));
    list.forEach(function (r) {
      box.appendChild(el('div', 'req', time(r.t) + ' · ' + (r.emoji ? r.emoji + ' ' : '') + r.name + ' — ' + (STATUS_TEXT[r.status] || r.status)));
    });
  }

  function answer(id, yes) {
    if (!child.requests.answer(id, yes)) { setStatus('That request was already answered or is too old.', true); render(); return; }
    render();
    sync();
  }

  function renderCoins() {
    var points = {}, total = 0, list = $('kid-points');
    list.textContent = '';
    child.subjects.forEach(function (s) {
      var n = parseInt(child.space.getItem(s.pointsKey), 10) || 0;
      points[s.pointsKey] = n;
      total += n;
      list.appendChild(el('div', '', s.title + ' ⭐ ' + n));
    });
    var coins = child.wallet.balance(points);
    $('kid-name').textContent = label(child.learner);
    $('kid-coins').textContent = '🪙 ' + coins + (coins === 1 ? ' coin' : ' coins') + ' · ⭐ ' + total + ' points';
    $('kid-streak').textContent = window.Quests ? Quests.parentLine(Quests.read(child.space), Date.now()) : '';
    renderShop(points);
  }

  function renderMedals() {
    var box = $('medals'), polish = [];
    box.textContent = '';
    box.hidden = !window.Mastery;
    if (!window.Mastery) return;
    var apps = Mastery.read(child.space).apps;
    box.appendChild(el('h3', '', '🏅 Medals'));
    child.subjects.forEach(function (s) {
      var e = apps[s.app];
      if (!e) { box.appendChild(el('div', 'p-note', s.title + ' · not opened since medals were added')); return; }
      var c = Mastery.counts(e);
      box.appendChild(el('div', '', s.title + ' · 🥇 ' + c.gold + ' · 🥈 ' + c.silver + ' · 🥉 ' + c.bronze + ' of ' + c.total));
      Mastery.polishList(e).forEach(function (t) { polish.push(s.title + ': ' + t); });
    });
    if (!polish.length) return;
    box.appendChild(el('h3', '', '🔧 Needs a polish'));
    polish.forEach(function (t) { box.appendChild(el('div', '', t)); });
  }

  function renderShop(points) {
    var box = $('shop-list');
    box.textContent = '';
    child.wallet.shelf(points).forEach(function (r) {
      var row = el('div', 'shop-row' + (r.ok ? ' can' : ''));
      var name = el('div', 'shop-name', r.item.emoji + ' ' + r.item.name);
      if (r.item.perDay) name.appendChild(el('span', 'shop-limit', ' · ' + r.item.perDay + ' a day'));
      row.appendChild(name);
      row.appendChild(el('div', 'shop-price', '🪙 ' + r.item.coins));
      row.appendChild(el('div', 'shop-state', r.daily ? 'Done for today' : r.ok ? '✓ Can buy' : r.need + ' more'));
      box.appendChild(row);
    });
  }

  // ---- buttons and lifecycle ----
  $('signin-go').addEventListener('click', function () {
    var email = $('signin-email').value.trim(), pass = $('signin-pass').value;
    if (!email || !pass) { $('signin-msg').textContent = 'Type the family email and the password first.'; return; }
    $('signin-msg').textContent = 'Signing in…';
    FR.signIn(email, pass).then(function () { $('signin-msg').textContent = ''; }, function (e) { $('signin-msg').textContent = FR.signInError(e); });
  });
  $('signout').addEventListener('click', function () { unlocked = false; FR.signOut(); });
  $('switch-child').addEventListener('click', function () { closeChild(); pick(); });
  $('refresh').addEventListener('click', function () { setStatus('Syncing…'); sync(); });
  document.addEventListener('keydown', function (ev) {
    if ($('pin-view').hidden) return;
    if (/^[0-9]$/.test(ev.key)) gate.press(ev.key);
    else if (ev.key === 'Backspace') gate.press('clear');
  });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { hiddenAt = Date.now(); return; }
    if (unlocked && Date.now() - hiddenAt > LOCK_AFTER_MS) { unlocked = false; route(); return; }
    if (child) sync();
  });
  window.addEventListener('online', function () {
    if (!authHeard) startAuth();
    else if (child) sync();
    else if (user && unlocked && !opening) pick();
  });

  if (location.protocol === 'file:') { setStatus('Open this page from the website, not as a file.', true); return; }
  function startAuth() {
    if (authStarting) return;
    authStarting = true;
    FR.onAuth(function (u) { authHeard = true; user = u; route(); }).then(function () { authStarting = false; }, function () {
      authStarting = false;
      offline();
    });
  }
  startAuth();
})();
