/* The Firebase side of cloud sync: loads the SDK from Google's CDN only when asked, signs in, and gives
   sync-core.js its remote on Firestore. Used by cloud.js (lobbies) and the parent page. Keep this file ASCII-only. */
(function (root) {
  'use strict';

  var SDK = 'https://www.gstatic.com/firebasejs/12.4.0/';
  var ROUND_TIMEOUT_MS = 30000;
  var fb = null;

  function load() {
    if (fb) return Promise.resolve(fb);
    if (!root.FIREBASE_CONFIG) return Promise.reject(new Error('no Firebase config'));
    return Promise.all(['app', 'auth', 'firestore'].map(function (m) { return import(SDK + 'firebase-' + m + '.js'); }))
      .then(function (mods) {
        var app = mods[0].initializeApp(root.FIREBASE_CONFIG);
        fb = { A: mods[1], F: mods[2], auth: mods[1].getAuth(app), db: mods[2].getFirestore(app) };
        return fb;
      });
  }

  function parse(text) { try { return JSON.parse(text); } catch (e) { return null; } }
  var enc = encodeURIComponent, dec = decodeURIComponent;

  // The remote interface sync-core.js expects, on Firestore: families/{uid}/learners/{id}/{state|counters|history}/{key}.
  // Call it only after load() has finished.
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
      },
      // Calls onChange whenever one state doc changes in the cloud (and once at the start). Returns a stop function.
      watch: function (id, key, onChange, onError) {
        return F.onSnapshot(stateRef(id, key), function () { onChange(); }, function () { if (onError) onError(); });
      }
    };
  }

  function signInError(e) {
    var code = (e && e.code) || '';
    if (/invalid-credential|wrong-password|user-not-found|invalid-email/.test(code)) return 'Wrong email or password.';
    if (/network/.test(code)) return 'No internet. Try again when online.';
    if (/too-many-requests/.test(code)) return 'Too many tries. Wait a few minutes.';
    return 'Could not sign in (' + (code || 'unknown error') + ').';
  }

  // Calls onSlow if p is still running after 30 s. It never cuts p short: a round that kept running after a
  // timeout could send the same counter change twice when the next round starts.
  function whenSlow(p, onSlow) {
    var t = setTimeout(onSlow, ROUND_TIMEOUT_MS);
    function stop() { clearTimeout(t); }
    p.then(stop, stop);
    return p;
  }

  root.FirebaseRemote = {
    whenSlow: whenSlow,
    // onUser(user or null) runs once the saved login is known, and again on every sign-in or sign-out.
    onAuth: function (onUser) {
      return load().then(function () { return fb.auth.authStateReady(); }).then(function () { fb.A.onAuthStateChanged(fb.auth, onUser); });
    },
    signIn: function (email, password) {
      return load().then(function () { return fb.A.signInWithEmailAndPassword(fb.auth, email, password); });
    },
    signOut: function () { return fb ? fb.A.signOut(fb.auth) : Promise.resolve(); },
    remote: remoteFor,
    signInError: signInError
  };
})(this);
