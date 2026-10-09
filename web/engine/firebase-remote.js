/* The Firebase side of cloud sync: loads the SDK from Google's CDN only when asked, signs in, and gives
   sync-core.js its remote on Firestore. Used by cloud.js (lobbies) and the parent page. Keep this file ASCII-only. */
(function (root) {
  'use strict';

  var SDK = 'https://www.gstatic.com/firebasejs/12.4.0/';
  var ROUND_TIMEOUT_MS = 30000;
  var fb = null, adminLoading = null;

  function open(name) {
    if (!root.FIREBASE_CONFIG) return Promise.reject(new Error('no Firebase config'));
    return Promise.all(['app', 'auth', 'firestore'].map(function (m) { return import(SDK + 'firebase-' + m + '.js'); }))
      .then(function (mods) {
        var app = mods[0].initializeApp(root.FIREBASE_CONFIG, name);
        return { A: mods[1], F: mods[2], auth: mods[1].getAuth(app), db: mods[2].getFirestore(app) };
      });
  }

  function load() {
    if (fb) return Promise.resolve(fb);
    return open().then(function (b) { fb = b; return fb; });
  }

  // The owner dashboard runs on its own named app, so its sign-in never replaces a family's login on the same browser.
  function loadAdmin() {
    if (!adminLoading) adminLoading = open('admin').catch(function (e) { adminLoading = null; throw e; });
    return adminLoading;
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
    function pinRef() { return F.doc(db, 'families', uid, 'settings', 'pin'); }

    return {
      learners: function () {
        return F.getDocs(F.collection(db, 'families', uid, 'learners')).then(function (snap) {
          return snap.docs.map(function (d) { return { id: d.id, profile: parse(d.data().json) }; });
        });
      },
      pull: function (id, ms, historyMs) {
        var historyFrom = Math.max(ms, historyMs || 0);
        return Promise.all([F.getDoc(learnerDoc(id)), since(id, 'state', ms), since(id, 'counters', ms), since(id, 'history', historyFrom)]).then(function (r) {
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
      pullOlder: function (id, beforeMs) {
        return F.getDocs(F.query(sub(id, 'history'), F.where('updatedAt', '<', F.Timestamp.fromMillis(beforeMs)))).then(function (snap) {
          return { history: snap.docs.map(function (d) { return { id: dec(d.id), entry: d.data().deleted ? null : parse(d.data().json) }; }) };
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
      // Reads a few state docs and counters of one learner (her sister's, for family.js). Missing docs read as null and 0.
      peek: function (id, keys, counters) {
        var reads = keys.map(function (k) { return F.getDoc(stateRef(id, k)); })
          .concat(counters.map(function (k) { return F.getDoc(F.doc(sub(id, 'counters'), enc(k))); }));
        return Promise.all(reads).then(function (snaps) {
          var out = { state: {}, counters: {} };
          keys.forEach(function (k, i) { out.state[k] = snaps[i].exists() ? parse(snaps[i].data().json) : null; });
          counters.forEach(function (k, i) {
            var s = snaps[keys.length + i];
            out.counters[k] = s.exists() ? Number(s.data().total) || 0 : 0;
          });
          return out;
        });
      },
      // Calls onChange whenever one state doc changes in the cloud (and once at the start). Returns a stop function.
      watch: function (id, key, onChange, onError) {
        return F.onSnapshot(stateRef(id, key), function () { onChange(); }, function () { if (onError) onError(); });
      },
      // The family's parent PIN (parent-pin.js): { pin, at } or null.
      getPin: function () {
        return F.getDoc(pinRef()).then(function (snap) {
          if (!snap.exists()) return null;
          var d = snap.data();
          return { pin: String(d.pin), at: Number(d.at) || 0 };
        });
      },
      putPin: function (rec) { return F.setDoc(pinRef(), { pin: rec.pin, at: rec.at, updatedAt: F.serverTimestamp() }); },
      // The family's summary doc, listed by the owner dashboard. createdAt is passed only when the account is made.
      putFamily: function (rec) {
        var data = { lastSeenAt: F.serverTimestamp(), updatedAt: F.serverTimestamp() };
        if (rec.email) data.email = rec.email;
        if (rec.createdAt) data.createdAt = rec.createdAt;
        return F.setDoc(F.doc(db, 'families', uid), data, { merge: true });
      }
    };
  }

  // Read-only reads for the owner dashboard, on the admin app's own connection.
  function adminRemote(b) {
    var F = b.F, db = b.db;
    function ms(t) { return t && t.toMillis ? t.toMillis() : null; }
    return {
      families: function () {
        return F.getDocs(F.collection(db, 'families')).then(function (snap) {
          return snap.docs.map(function (d) {
            var x = d.data();
            return { uid: d.id, email: x.email || '', createdAt: Number(x.createdAt) || null, lastSeenAt: ms(x.lastSeenAt) };
          });
        });
      },
      learners: function (uid) {
        return F.getDocs(F.collection(db, 'families', uid, 'learners')).then(function (snap) {
          return snap.docs.map(function (d) {
            var p = parse(d.data().json) || {};
            return { uid: uid, id: d.id, grade: Number(p.grade) || 0 };
          });
        });
      },
      history: function (uid, id, sinceMs) {
        var col = F.collection(db, 'families', uid, 'learners', id, 'history');
        return F.getDocs(F.query(col, F.where('updatedAt', '>=', F.Timestamp.fromMillis(sinceMs)))).then(function (snap) {
          return snap.docs.filter(function (d) { return !d.data().deleted; })
            .map(function (d) { return { uid: uid, learnerId: id, entry: parse(d.data().json) }; });
        });
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

  // context 'change': the password typed was the current one, so a wrong one is named that way.
  function accountError(e, context) {
    var code = (e && e.code) || '';
    if (/email-already-in-use/.test(code)) return 'This email already has an account. Sign in instead.';
    if (/weak-password/.test(code)) return 'The password needs at least 6 characters.';
    if (/invalid-email/.test(code)) return 'Type a real email address.';
    if (/requires-recent-login/.test(code)) return 'Sign out, sign in again, then change the password.';
    if (/invalid-credential|wrong-password/.test(code)) return context === 'change' ? 'The current password is wrong.' : 'Wrong email or password.';
    if (/user-not-found/.test(code)) return 'No account uses that email.';
    if (/network/.test(code)) return 'No internet. Try again when online.';
    if (/too-many-requests/.test(code)) return 'Too many tries. Wait a few minutes.';
    return 'Something went wrong (' + (code || 'unknown error') + '). Try again.';
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
    createAccount: function (email, password) {
      return load().then(function () { return fb.A.createUserWithEmailAndPassword(fb.auth, email, password); });
    },
    resetPassword: function (email) {
      return load().then(function () { return fb.A.sendPasswordResetEmail(fb.auth, email); });
    },
    // Firebase asks for the current password again before a password change.
    changePassword: function (current, next) {
      return load().then(function () {
        var u = fb.auth.currentUser;
        if (!u) { var e = new Error('signed out'); e.code = 'auth/requires-recent-login'; throw e; }
        return fb.A.reauthenticateWithCredential(u, fb.A.EmailAuthProvider.credential(u.email, current))
          .then(function () { return fb.A.updatePassword(u, next); });
      });
    },
    signOut: function () { return fb ? fb.A.signOut(fb.auth) : Promise.resolve(); },
    remote: remoteFor,
    adminRemote: function () { return loadAdmin().then(adminRemote); },
    admin: {
      onAuth: function (onUser) {
        return loadAdmin().then(function (b) { return b.auth.authStateReady().then(function () { b.A.onAuthStateChanged(b.auth, onUser); }); });
      },
      signIn: function (email, password) {
        return loadAdmin().then(function (b) { return b.A.signInWithEmailAndPassword(b.auth, email, password); });
      },
      signOut: function () { return adminLoading ? adminLoading.then(function (b) { return b.A.signOut(b.auth); }) : Promise.resolve(); }
    },
    signInError: signInError,
    accountError: accountError
  };
})(this);
