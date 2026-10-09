/* Cloud backup and sync (phase 5b), loaded by the lobbies only. It fills the Parent panel's "Cloud backup" section,
   and syncs when the lobby opens, every 2 minutes, and when the device comes back online. firebase-remote.js loads
   the Firebase SDK only on devices where a parent has signed in, so the games stay light and offline play never
   waits on it. After each good sync it fires a "cloud-synced" event on document. */
(function (root) {
  'use strict';

  var EVERY_MS = 2 * 60 * 1000;
  var SEEN_EVERY_MS = 60 * 60 * 1000;
  var SIGNED_IN = 'sync_signed_in_v1';
  var SEEN = 'family_seen_';

  // Defined even when sync is off (opened as a file, no learner), so the missing-file check and the shop see it.
  root.Cloud = {
    sync: function () { return Promise.resolve(); },
    signedIn: function () { return false; },
    watch: function () { return function () {}; }
  };
  var L = root.Learner, Core = root.SyncCore, FR = root.FirebaseRemote;
  if (!L || !Core || !FR || !root.FIREBASE_CONFIG || !L.current() || root.location.protocol === 'file:') return;

  var me = L.current();
  var space = L.storage;
  var device = root.StudyStore.raw;
  var connected = false, user = null, busy = false, again = false, choice = null, timer = null, typedEmail = '', signingIn = false;
  var status = { text: '', error: false };

  // The Firebase login belongs to the whole device, so one sign-in covers both lobbies.
  // Before 2026-10-02 the flag was saved in a child's own space, so any child's copy still counts.
  function wasSignedIn() {
    return device.getItem(SIGNED_IN) === '1' || root.StudyStore.spaces().some(function (id) {
      return root.StudyStore.space(id).getItem(SIGNED_IN) === '1';
    });
  }
  function markSignedIn(on) {
    try { if (on) device.setItem(SIGNED_IN, '1'); else device.removeItem(SIGNED_IN); } catch (e) {}
    root.StudyStore.spaces().forEach(function (id) { root.StudyStore.space(id).put(SIGNED_IN, null); });
  }

  function ago(ms) {
    var min = Math.round((Date.now() - ms) / 60000);
    return min < 1 ? 'just now' : min === 1 ? '1 min ago' : min < 60 ? min + ' min ago' : Math.round(min / 60) + ' h ago';
  }

  // After a good round: read each other learner's profile, buddy, family news and cheer total for family.js.
  // A failed peek never fails the round; the card keeps the last one.
  function peekFamily(remote) {
    var F = root.Family;
    if (!F || !F.store || !remote.peek) return Promise.resolve();
    return remote.learners().then(function (list) {
      return Promise.all(list.filter(function (l) { return l.id !== me.id; }).map(function (l) {
        return remote.peek(l.id, F.PEEK_STATE, F.PEEK_COUNTERS).then(function (r) { r.id = l.id; return r; });
      }));
    }).then(F.store, function () {});
  }

  // Keeps the family's summary doc fresh for the owner dashboard without a write on every 2-minute round.
  function touchFamily(remote) {
    var key = SEEN + user.uid, last = 0;
    try { last = Number(device.getItem(key)) || 0; } catch (e) {}
    if (Date.now() - last < SEEN_EVERY_MS) return;
    remote.putFamily({ email: user.email }).then(function () {
      try { device.setItem(key, String(Date.now())); } catch (e) {}
    }, function () {});
  }

  function runSync() {
    if (!user || choice) return Promise.resolve();
    // A sync asked for during a round (for example a shop request) runs right after it.
    if (busy) { again = true; return Promise.resolve(); }
    if (root.navigator && root.navigator.onLine === false) { setStatus('☁️ Waiting for internet. Everything is saved on this tablet.'); return Promise.resolve(); }
    busy = true;
    var remote = FR.remote(user.uid), core = Core.create(space, remote, me.id);
    var round = core.linked() ? Promise.resolve() : remote.learners().then(function (list) {
      var p = Core.plan(me, space.keys(), list);
      if (p.action === 'choose') { choice = p; return 'wait'; }
      core.link();
      return null;
    });
    var run = round.then(function (wait) {
      if (wait === 'wait') return null;
      if (root.Family && root.Family.touch) root.Family.touch();
      return core.sync().then(function (r) { return peekFamily(remote).then(function () { return r; }); });
    });
    return FR.whenSlow(run, function () { setStatus('☁️ Still syncing… the connection is slow. Everything is saved on this tablet.'); })
      .then(function (r) {
        if (r) {
          if (root.ParentPin) root.ParentPin.sync(remote);
          touchFamily(remote);
          setStatus('☁️ Synced ' + ago(r.at) + '.');
          document.dispatchEvent(new CustomEvent('cloud-synced'));
        } else render();
      }, function () {
        setStatus('☁️ Could not reach the cloud. Everything is saved on this tablet; it will try again.', true);
      })
      .then(function () {
        busy = false;
        if (again) { again = false; runSync(); }
      });
  }

  function start(u) {
    var changed = (u && u.uid) !== (user && user.uid);
    user = u;
    if (u) {
      markSignedIn(true);
      if (!timer) timer = setInterval(runSync, EVERY_MS);
      runSync();
    } else {
      markSignedIn(false);
      if (root.Family && root.Family.store) root.Family.store([]);
      if (timer) { clearInterval(timer); timer = null; }
    }
    if (changed) { status = { text: '', error: false }; render(); }
  }

  function connect() {
    if (connected) return Promise.resolve();
    connected = true;
    return FR.onAuth(start).catch(function (e) { connected = false; throw e; });
  }

  // ---- the Parent panel section ----
  function el(tag, attrs, text) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function setStatus(text, error) { status = { text: text, error: !!error }; render(); }

  function render() {
    var box = document.getElementById('cloud-section');
    if (!box) return;
    box.hidden = false;
    box.textContent = '';
    box.appendChild(el('h3', {}, '☁️ Cloud backup'));
    if (!user) {
      box.appendChild(el('p', { class: 'p-note' }, 'Sign in with the family login. This tablet then backs up on its own and stays in sync with her other devices.'));
      var row = el('div', { class: 'p-row' });
      var email = el('input', { type: 'email', id: 'cloud-email', autocomplete: 'username', placeholder: 'Family email' });
      email.value = typedEmail;
      email.addEventListener('input', function () { typedEmail = email.value; });
      var pass = el('input', { type: 'password', id: 'cloud-pass', autocomplete: 'current-password', placeholder: 'Password' });
      var go = el('button', { class: 'p-btn', type: 'button', id: 'cloud-signin' }, 'Sign in');
      row.appendChild(email); row.appendChild(pass); row.appendChild(go);
      box.appendChild(row);
      go.disabled = signingIn;
      box.appendChild(el('p', { class: 'p-note', id: 'cloud-msg' }, status.text));
      var make = el('p', { class: 'p-note' }, 'No family account yet? ');
      make.appendChild(el('a', { href: '../index.html?account=1&back=lobby/grade-' + me.grade + '.html' }, 'Create one'));
      box.appendChild(make);
      go.addEventListener('click', function () {
        typedEmail = email.value.trim();
        if (!typedEmail || !pass.value) { setStatus('Type the family email and the password first.', true); return; }
        signingIn = true;
        setStatus('Signing in…');
        connect()
          .then(function () { return FR.signIn(typedEmail, pass.value); })
          .then(function () { signingIn = false; }, function (e) { signingIn = false; setStatus(FR.signInError(e), true); });
      });
      return;
    }
    box.appendChild(el('p', { class: 'p-note' }, 'Signed in as ' + (user.email || 'the family login') + '.'));
    if (choice) return renderChoice(box);
    box.appendChild(el('p', { class: 'p-note', id: 'cloud-status' }, status.text || '☁️ Syncing…'));
    var actions = el('div', { class: 'p-row' });
    var now = el('button', { class: 'p-btn', type: 'button', id: 'cloud-sync' }, 'Sync now');
    var out = el('button', { class: 'p-btn', type: 'button', id: 'cloud-signout' }, 'Sign out');
    actions.appendChild(now); actions.appendChild(out);
    box.appendChild(actions);
    box.appendChild(el('p', { class: 'p-note' }, 'Signing out stops syncing. It does not delete anything on this tablet or in the cloud.'));
    var page = new URL('../parent/', root.location.href).href;
    var tip = el('p', { class: 'p-note' }, '📱 Parent page for your phone: ');
    tip.appendChild(el('a', { href: page }, page));
    box.appendChild(tip);
    now.addEventListener('click', function () { setStatus('☁️ Syncing…'); runSync(); });
    out.addEventListener('click', function () { FR.signOut(); });
  }

  function label(c) {
    var p = c.profile || {};
    return (p.emoji ? p.emoji + ' ' : '') + (p.name || 'No name yet') + ' · Grade ' + (p.grade || '?');
  }

  function renderChoice(box) {
    box.appendChild(el('p', {}, choice.keep ? 'The cloud already has a child in this grade. Is this tablet hers?' : 'Which child uses this tablet?'));
    var row = el('div', { class: 'p-row' });
    choice.candidates.forEach(function (c) {
      var b = el('button', { class: 'p-btn', type: 'button' }, (choice.keep ? 'Yes, this is ' : 'This is ') + label(c));
      b.addEventListener('click', function () {
        if (choice.keep && !confirm('This tablet will switch to ' + label(c) + ' from the cloud. Points and coins saved only on this tablet will not be added. Continue?')) return;
        L.adopt(c.id, c.profile || {});
        root.location.reload();
      });
      row.appendChild(b);
    });
    if (choice.keep) {
      var keep = el('button', { class: 'p-btn', type: 'button' }, 'No, keep this tablet as a different child');
      keep.addEventListener('click', function () {
        Core.create(space, null, me.id).link();
        choice = null;
        runSync();
      });
      row.appendChild(keep);
    }
    box.appendChild(row);
  }

  root.Cloud.sync = runSync;
  root.Cloud.signedIn = function () { return !!user && !choice; };
  root.Cloud.watch = function (key, onChange) { return user ? FR.remote(user.uid).watch(me.id, key, onChange) : function () {}; };

  function init() {
    render();
    if (wasSignedIn()) connect().catch(function () { setStatus('☁️ Waiting for internet. Everything is saved on this tablet.'); });
    root.addEventListener('online', function () { if (user) runSync(); else if (wasSignedIn()) connect().catch(function () {}); });
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') runSync(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(this);
