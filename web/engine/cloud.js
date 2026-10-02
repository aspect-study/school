/* Cloud backup and sync (phase 5b), loaded by the lobbies only. It fills the Parent panel's "Cloud backup" section,
   and syncs when the lobby opens, every 2 minutes, and when the device comes back online. The Firebase SDK is
   loaded from Google's CDN only on devices where a parent has signed in, so the games stay light and offline play
   never waits on it. */
(function (root) {
  'use strict';

  var SDK = 'https://www.gstatic.com/firebasejs/12.4.0/';
  var EVERY_MS = 2 * 60 * 1000;
  var ROUND_TIMEOUT_MS = 30000;
  var SIGNED_IN = 'sync_signed_in_v1';

  // Defined even when sync is off (opened as a file, no learner), so the missing-file check sees it loaded.
  root.Cloud = { sync: function () { return Promise.resolve(); } };
  var L = root.Learner, Core = root.SyncCore, config = root.FIREBASE_CONFIG;
  if (!L || !Core || !config || !L.current() || root.location.protocol === 'file:') return;

  var me = L.current();
  var space = L.storage;
  var fb = null, user = null, busy = false, choice = null, timer = null, typedEmail = '', signingIn = false;
  var status = { text: '', error: false };

  function load() {
    if (fb) return Promise.resolve(fb);
    return Promise.all(['app', 'auth', 'firestore'].map(function (m) { return import(SDK + 'firebase-' + m + '.js'); }))
      .then(function (mods) {
        var app = mods[0].initializeApp(config);
        fb = { A: mods[1], F: mods[2], auth: mods[1].getAuth(app), db: mods[2].getFirestore(app) };
        return fb;
      });
  }

  function parse(text) { try { return JSON.parse(text); } catch (e) { return null; } }
  var enc = encodeURIComponent, dec = decodeURIComponent;

  // The remote interface sync-core.js expects, on Firestore: families/{uid}/learners/{id}/{state|counters|history}/{key}.
  function remoteFor(uid) {
    var F = fb.F, db = fb.db;
    function learnerDoc(id) { return F.doc(db, 'families', uid, 'learners', id); }
    function sub(id, name) { return F.collection(db, 'families', uid, 'learners', id, name); }
    function since(id, name, ms) { return F.getDocs(F.query(sub(id, name), F.where('updatedAt', '>=', F.Timestamp.fromMillis(ms)))); }
    function at(d) { var t = d.data().updatedAt; return t && t.toMillis ? t.toMillis() : 0; }
    function stateRef(id, key) { return key === 'profile_v1' ? learnerDoc(id) : F.doc(sub(id, 'state'), enc(key)); }

    return {
      learners: function () {
        return F.getDocs(F.collection(db, 'families', uid, 'learners')).then(function (snap) {
          return snap.docs.map(function (d) { return { id: d.id, profile: parse(d.data().json) }; });
        });
      },
      pull: function (id, ms) {
        return Promise.all([F.getDoc(learnerDoc(id)), since(id, 'state', ms), since(id, 'counters', ms), since(id, 'history', ms)]).then(function (r) {
          var until = ms, out = { state: [], counters: [], history: [] };
          function seen(d) { until = Math.max(until, at(d)); }
          if (r[0].exists() && at(r[0]) >= ms) { seen(r[0]); out.state.push({ key: 'profile_v1', value: parse(r[0].data().json) }); }
          r[1].docs.forEach(function (d) { seen(d); out.state.push({ key: dec(d.id), value: parse(d.data().json) }); });
          r[2].docs.forEach(function (d) { seen(d); out.counters.push({ key: dec(d.id), total: Number(d.data().total) || 0 }); });
          r[3].docs.forEach(function (d) { seen(d); out.history.push({ id: dec(d.id), entry: d.data().deleted ? null : parse(d.data().json) }); });
          out.until = until;
          return out;
        });
      },
      merge: function (id, key, local, fn) {
        var ref = stateRef(id, key);
        return F.runTransaction(db, function (tx) {
          return tx.get(ref).then(function (snap) {
            var merged = fn(local, snap.exists() ? parse(snap.data().json) : null);
            tx.set(ref, { json: JSON.stringify(merged), updatedAt: F.serverTimestamp() });
            return merged;
          });
        });
      },
      add: function (id, key, delta) {
        var ref = F.doc(sub(id, 'counters'), enc(key));
        return F.runTransaction(db, function (tx) {
          return tx.get(ref).then(function (snap) {
            var total = (snap.exists() ? Number(snap.data().total) || 0 : 0) + delta;
            tx.set(ref, { total: total, updatedAt: F.serverTimestamp() });
            return total;
          });
        });
      },
      putHistory: function (id, docs) {
        var chunks = [];
        for (var i = 0; i < docs.length; i += 400) chunks.push(docs.slice(i, i + 400));
        return chunks.reduce(function (chain, chunk) {
          return chain.then(function () {
            var batch = F.writeBatch(db);
            chunk.forEach(function (d) {
              batch.set(F.doc(sub(id, 'history'), enc(d.id)), d.entry
                ? { json: JSON.stringify(d.entry), updatedAt: F.serverTimestamp() }
                : { deleted: true, updatedAt: F.serverTimestamp() });
            });
            return batch.commit();
          });
        }, Promise.resolve());
      }
    };
  }

  function withTimeout(p) {
    return Promise.race([p, new Promise(function (_, reject) { setTimeout(function () { reject(new Error('timeout')); }, ROUND_TIMEOUT_MS); })]);
  }

  function ago(ms) {
    var min = Math.round((Date.now() - ms) / 60000);
    return min < 1 ? 'just now' : min === 1 ? '1 min ago' : min < 60 ? min + ' min ago' : Math.round(min / 60) + ' h ago';
  }

  function runSync() {
    if (!user || busy || choice) return Promise.resolve();
    if (root.navigator && root.navigator.onLine === false) { setStatus('☁️ Waiting for internet. Everything is saved on this tablet.'); return Promise.resolve(); }
    busy = true;
    var remote = remoteFor(user.uid), core = Core.create(space, remote, me.id);
    var round = core.linked() ? Promise.resolve() : remote.learners().then(function (list) {
      var p = Core.plan(me, space.keys(), list);
      if (p.action === 'choose') { choice = p; return 'wait'; }
      core.link();
      return null;
    });
    return withTimeout(round.then(function (wait) { return wait === 'wait' ? null : core.sync(); }))
      .then(function (r) {
        if (r) setStatus('☁️ Synced ' + ago(r.at) + '.');
        else render();
      }, function () {
        setStatus('☁️ Could not reach the cloud. Everything is saved on this tablet; it will try again.', true);
      })
      .then(function () { busy = false; });
  }

  function start(u) {
    // Firebase first reports "signed out" while it loads; redraw only when who is signed in really changes.
    var changed = (u && u.uid) !== (user && user.uid);
    user = u;
    if (u) {
      space.put(SIGNED_IN, '1');
      if (!timer) timer = setInterval(runSync, EVERY_MS);
      runSync();
    } else {
      space.put(SIGNED_IN, null);
      if (timer) { clearInterval(timer); timer = null; }
    }
    if (changed) { status = { text: '', error: false }; render(); }
  }

  function connect() {
    return load().then(function () {
      fb.A.onAuthStateChanged(fb.auth, start);
    });
  }

  // ---- the Parent panel section ----
  function el(tag, attrs, text) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function setStatus(text, error) { status = { text: text, error: !!error }; render(); }

  function signInError(e) {
    var code = (e && e.code) || '';
    if (/invalid-credential|wrong-password|user-not-found|invalid-email/.test(code)) return 'Wrong email or password.';
    if (/network/.test(code)) return 'No internet. Try again when online.';
    if (/too-many-requests/.test(code)) return 'Too many tries. Wait a few minutes.';
    return 'Could not sign in (' + (code || 'unknown error') + ').';
  }

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
          .then(function () { return fb.A.signInWithEmailAndPassword(fb.auth, typedEmail, pass.value); })
          .then(function () { signingIn = false; }, function (e) { signingIn = false; setStatus(signInError(e), true); });
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
    out.addEventListener('click', function () { fb.A.signOut(fb.auth); });
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
  function init() {
    render();
    if (space.getItem(SIGNED_IN) === '1') connect().catch(function () { setStatus('☁️ Waiting for internet. Everything is saved on this tablet.'); });
    root.addEventListener('online', function () { if (user) runSync(); else if (space.getItem(SIGNED_IN) === '1' && !fb) connect().catch(function () {}); });
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') runSync(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(this);
