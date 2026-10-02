/* Cloud backup and sync (phase 5b), loaded by the lobbies only. It fills the Parent panel's "Cloud backup" section,
   and syncs when the lobby opens, every 2 minutes, and when the device comes back online. firebase-remote.js loads
   the Firebase SDK only on devices where a parent has signed in, so the games stay light and offline play never
   waits on it. After each good sync it fires a "cloud-synced" event on document. */
(function (root) {
  'use strict';

  var EVERY_MS = 2 * 60 * 1000;
  var SIGNED_IN = 'sync_signed_in_v1';

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
    var run = round.then(function (wait) { return wait === 'wait' ? null : core.sync(); });
    return FR.whenSlow(run, function () { setStatus('☁️ Still syncing… the connection is slow. Everything is saved on this tablet.'); })
      .then(function (r) {
        if (r) {
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
      go.addEventListener('click', function () {
        typedEmail = email.value.trim();
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
