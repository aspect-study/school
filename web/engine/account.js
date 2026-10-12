/* The start page (index.html): a family signs in or creates its account, adds its children with their grade, and
   picks who uses this device; or plays without an account. index.html?account=1 is the Account view: change the
   family password or the parent PIN, add a child, sign out. Keep this file ASCII-only. */
(function (root) {
  'use strict';

  var GRADES = [5, 2];
  var UNLOCK_MS = 10 * 60 * 1000;
  var SOON_GRADES = [1, 3, 4, 6];
  var EMOJIS = ['\uD83C\uDF3B', '\uD83E\uDD8B', '\uD83D\uDC31', '\uD83D\uDC36', '\uD83E\uDD84', '\u2B50', '\uD83C\uDF08', '\uD83D\uDC3C'];
  var NAME_MAX = 30;

  function validEmail(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').trim()); }

  var PASSWORD_MIN = 8;

  function checkPassword(a, b) {
    if (!a || a.length < PASSWORD_MIN) return 'The password needs at least ' + PASSWORD_MIN + ' characters.';
    if (a !== b) return 'The two passwords are not the same.';
    return '';
  }

  function checkPin(current, next, again, real) {
    if (current !== real) return 'The current PIN is wrong.';
    if (!/^\d{4}$/.test(next)) return 'The new PIN must be 4 digits.';
    if (next !== again) return 'The two new PINs are not the same.';
    return '';
  }

  var CONSENT_VERSION = 1;

  function checkRegister(f) {
    if (!validEmail(f.email)) return 'Type a real email address.';
    var problem = checkPassword(f.pass, f.pass2);
    if (problem) return problem;
    if (!/^\d{4}$/.test(f.pin || '')) return 'The parent PIN must be 4 digits.';
    if (f.pin !== f.pin2) return 'The two PINs are not the same.';
    if (!f.consent) return 'Tick the box to agree to the privacy notice.';
    return '';
  }

  function checkDelete(password, typed) {
    if (!password) return 'Type the password.';
    if (String(typed || '').trim() !== 'DELETE') return 'Type DELETE to confirm.';
    return '';
  }

  function checkChild(c) {
    var name = String(c.name || '').trim().slice(0, NAME_MAX);
    if (!name) return { error: 'Type the name.' };
    var grade = Number(c.grade);
    if (GRADES.indexOf(grade) < 0) return { error: 'Pick the grade.' };
    if (typeof c.boy !== 'boolean') return { error: 'Pick girl or boy.' };
    return { error: '', child: { name: name, emoji: EMOJIS.indexOf(c.emoji) >= 0 ? c.emoji : EMOJIS[0], grade: grade, boy: c.boy } };
  }

  // Same shape as learner.js's ids.
  function newId(now) { return 'l' + now.toString(36) + Math.floor(Math.random() * 1296).toString(36); }

  // Only pages of this site, so the link cannot send a parent somewhere else.
  function backTarget(search) {
    var m = /[?&]back=([^&]*)/.exec(search || ''), to = '';
    try { to = m ? decodeURIComponent(m[1]) : ''; } catch (e) { return ''; }
    return /^(lobby\/grade-\d+\.html|parent\/)$/.test(to) ? to : '';
  }

  var exported = {
    GRADES: GRADES, EMOJIS: EMOJIS, CONSENT_VERSION: CONSENT_VERSION, validEmail: validEmail, checkPassword: checkPassword,
    checkPin: checkPin, checkRegister: checkRegister, checkDelete: checkDelete, checkChild: checkChild, newId: newId, backTarget: backTarget
  };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.Account = exported;

  var doc = root.document;
  if (!doc || !doc.getElementById('account-app')) return;

  var FR = root.FirebaseRemote, L = root.Learner, Pin = root.ParentPin, raw = root.StudyStore.raw;
  var SIGNED_IN = 'sync_signed_in_v1';
  var PIN_KEY = 'parent_pin_v1';
  var OFFLINE = 'No internet. Try again when online, or play without an account.';
  var VIEWS = ['welcome-view', 'signin-view', 'register-view', 'children-view', 'pick-view', 'play-view', 'lock-view', 'account-view', 'consent-view'];
  var $ = function (id) { return doc.getElementById(id); };
  var accountMode = /[?&]account=1(&|$)/.test(root.location.search);
  var user = null, kids = [], form = { emoji: EMOJIS[0], grade: 0, boy: null }, working = false, authKnown = false;
  var consentKnown = null, consentNext = null;
  var pinReady = Promise.resolve();

  // e2e tests replace this to stay on the page.
  exported.go = function (url) { root.location.replace(url); };

  function el(tag, cls, text) {
    var e = doc.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function say(text, error) { $('msg').textContent = text; $('msg').classList.toggle('error', !!error); }
  function show(view) { VIEWS.forEach(function (v) { $(v).hidden = v !== view; }); say(''); }
  function label(k) {
    var p = k.profile || {};
    return (p.emoji ? p.emoji + ' ' : '') + (p.name || 'No name yet') + ' \u00B7 Grade ' + p.grade + ' \u00B7 ' + (p.boy === true ? 'Boy' : 'Girl');
  }
  function remote() { return FR.remote(user.uid); }
  function settle(p) { return Promise.race([p, new Promise(function (r) { setTimeout(r, 5000); })]); }
  function markSignedIn(on) {
    try { if (on) raw.setItem(SIGNED_IN, '1'); else raw.removeItem(SIGNED_IN); } catch (e) {}
  }
  function forgetSignIn() {
    markSignedIn(false);
    root.StudyStore.spaces().forEach(function (id) { root.StudyStore.space(id).put(SIGNED_IN, null); });
  }

  // One cloud call at a time; the page is dimmed while it runs.
  function work(text, start, done, fail, anyNetwork) {
    if (working) return;
    if (!anyNetwork && root.navigator && root.navigator.onLine === false) { say(OFFLINE, true); return; }
    working = true;
    $('account-app').classList.add('busy');
    say(text);
    function stop() { working = false; $('account-app').classList.remove('busy'); }
    Promise.resolve().then(start)
      .then(function (v) { stop(); done(v); }, function (e) { stop(); say(fail(e), true); })
      .then(null, function () { stop(); say('Something went wrong. Reload the page and try again.', true); });
  }

  // ---- sign in, create account, forgot password ----
  function loadKids() {
    return remote().learners().then(function (list) {
      kids = list.filter(function (l) { return l.profile && GRADES.indexOf(Number(l.profile.grade)) >= 0; });
    });
  }
  function startSession(cred) {
    user = cred.user;
    authKnown = true;
    return Pin.sync(remote());
  }

  function readConsent() {
    return remote().getFamily().then(function (f) { consentKnown = !!f.consent; }, function () { consentKnown = null; });
  }
  function afterSignIn() {
    if (accountMode) { markSignedIn(true); renderAccount(); } else if (kids.length) renderPick(); else renderChildren();
  }

  $('signin-go').addEventListener('click', function () {
    var email = $('signin-email').value.trim(), pass = $('signin-pass').value;
    if (!validEmail(email) || !pass) { say('Type the family email and the password first.', true); return; }
    var signed = false;
    work('Signing in\u2026', function () {
      return FR.signIn(email, pass).then(function (cred) { signed = true; return startSession(cred); })
        .then(function () { return accountMode ? null : loadKids(); })
        .then(readConsent);
    }, function () {
      $('signin-pass').value = '';
      if (consentKnown === false) { consentNext = afterSignIn; show('consent-view'); } else afterSignIn();
    }, function (e) { return signed ? 'Could not load the children. ' + OFFLINE : FR.accountError(e); });
  });

  $('consent-go').addEventListener('click', function () {
    if (!$('consent-check').checked) { say('Tick the box to agree to the privacy notice.', true); return; }
    work('Saving\u2026', function () {
      return remote().putFamily({ consent: { at: Date.now(), version: CONSENT_VERSION } });
    }, function () {
      consentKnown = true;
      $('consent-check').checked = false;
      var next = consentNext;
      consentNext = null;
      if (next) next(); else renderAccount();
    }, function () { return 'Could not save. ' + OFFLINE; });
  });

  $('consent-no').addEventListener('click', function () {
    work('Signing out\u2026', FR.signOut, function () {
      user = null;
      consentNext = null;
      $('consent-check').checked = false;
      forgetSignIn();
      show('welcome-view');
    }, function () { return 'Could not sign out. Try again.'; }, true);
  });

  $('signin-forgot').addEventListener('click', function () {
    var email = $('signin-email').value.trim();
    if (!validEmail(email)) { say('Type the family email first, then tap Forgot password.', true); return; }
    work('Sending\u2026', function () { return FR.resetPassword(email); }, function () {
      say('Check your email for a link to set a new password.');
    }, function (e) { return FR.accountError(e); });
  });

  $('reg-consent').addEventListener('change', function () { $('reg-go').disabled = !$('reg-consent').checked; });

  $('reg-go').addEventListener('click', function () {
    var email = $('reg-email').value.trim(), pass = $('reg-pass').value, pin = $('reg-pin').value;
    var problem = checkRegister({ email: email, pass: pass, pass2: $('reg-pass2').value, pin: pin, pin2: $('reg-pin2').value, consent: $('reg-consent').checked });
    if (problem) { say(problem, true); return; }
    work('Creating the account\u2026', function () {
      return FR.createAccount(email, pass).then(function (cred) {
        Pin.set(pin);
        return startSession(cred);
      }).then(function () {
        FR.sendVerification().then(null, function () {});
        return settle(remote().putFamily({ email: email, createdAt: Date.now(), consent: { at: Date.now(), version: CONSENT_VERSION } }).then(null, function () {}));
      });
    }, function () {
      $('reg-pass').value = $('reg-pass2').value = $('reg-pin').value = $('reg-pin2').value = '';
      $('reg-consent').checked = false;
      $('reg-go').disabled = true;
      consentKnown = true;
      kids = [];
      if (accountMode) markSignedIn(true);
      // Her own progress uploads at the next lobby sync; adding her here too would make a same-grade twin.
      if (accountMode && L.current()) {
        renderAccount();
        say('Account created. ' + label({ profile: L.current() }) +
          ' on this tablet is backed up at the next sync. Add only brothers or sisters with Add a child.');
        return;
      }
      renderChildren();
    }, function (e) { return FR.accountError(e); });
  });

  // ---- add children ----
  EMOJIS.forEach(function (e) {
    var b = el('button', 'chip', e);
    b.type = 'button';
    b.setAttribute('data-emoji', e);
    $('kid-emojis').appendChild(b);
  });
  GRADES.concat(SOON_GRADES).sort(function (a, b) { return a - b; }).forEach(function (g) {
    var soon = SOON_GRADES.indexOf(g) >= 0;
    var b = el('button', 'chip', 'Grade ' + g + (soon ? ' \u00B7 soon' : ''));
    b.type = 'button';
    b.disabled = soon;
    b.setAttribute('data-grade', String(g));
    $('kid-grades').appendChild(b);
  });
  [['0', '\uD83D\uDC67 Girl'], ['1', '\uD83D\uDC66 Boy']].forEach(function (k) {
    var b = el('button', 'chip', k[1]);
    b.type = 'button';
    b.setAttribute('data-boy', k[0]);
    $('kid-kinds').appendChild(b);
  });
  function drawForm() {
    Array.prototype.forEach.call($('kid-emojis').children, function (b) {
      var on = b.getAttribute('data-emoji') === form.emoji;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
    });
    Array.prototype.forEach.call($('kid-grades').children, function (b) {
      var on = Number(b.getAttribute('data-grade')) === form.grade;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
    });
    Array.prototype.forEach.call($('kid-kinds').children, function (b) {
      var on = form.boy !== null && (b.getAttribute('data-boy') === '1') === form.boy;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
    });
  }
  $('kid-emojis').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-emoji]');
    if (b) { form.emoji = b.getAttribute('data-emoji'); drawForm(); }
  });
  $('kid-grades').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-grade]');
    if (b) { form.grade = Number(b.getAttribute('data-grade')); drawForm(); }
  });
  $('kid-kinds').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-boy]');
    if (b) { form.boy = b.getAttribute('data-boy') === '1'; drawForm(); }
  });

  function renderChildren() {
    show('children-view');
    var list = $('kid-list');
    list.textContent = '';
    kids.forEach(function (k) { list.appendChild(kidCard(k)); });
    var me = accountMode && L.current();
    var mine = me && !kids.some(function (k) { return k.id === me.id; });
    $('kid-note').hidden = !mine;
    $('kid-note').textContent = mine ? label({ profile: me }) + ' uses this tablet and is backed up at the next sync. Add only the other children here.' : '';
    $('kid-done').disabled = !kids.length;
    $('kid-name').value = '';
    form = { emoji: EMOJIS[0], grade: 0, boy: null };
    drawForm();
  }

  function kidCard(k) {
    var p = k.profile || {};
    var card = el('div', 'kid-card');
    var text = el('span', 'kc-text');
    text.appendChild(el('b', '', p.name || 'No name yet'));
    text.appendChild(el('small', '', 'Grade ' + p.grade + ' \u00B7 ' + (p.boy === true ? 'Boy' : 'Girl')));
    var del = el('button', 'kc-del', '\uD83D\uDDD1');
    del.type = 'button';
    del.setAttribute('data-delete', k.id);
    del.setAttribute('aria-label', 'Delete ' + (p.name || 'this child'));
    del.addEventListener('click', function () { askDelete(k, card); });
    card.appendChild(el('span', 'kc-emoji', p.emoji || '\uD83D\uDE42'));
    card.appendChild(text);
    card.appendChild(del);
    return card;
  }

  function askDelete(k, card) {
    card.textContent = '';
    card.classList.add('asking');
    card.appendChild(el('span', 'kc-ask', 'Delete ' + ((k.profile && k.profile.name) || 'this child') + ' and all progress?'));
    var btns = el('span', 'kc-btns');
    var cancel = el('button', '', 'Cancel');
    var yes = el('button', 'kc-confirm', 'Delete');
    cancel.type = yes.type = 'button';
    yes.setAttribute('data-confirm', k.id);
    cancel.addEventListener('click', renderChildren);
    yes.addEventListener('click', function () {
      work('Deleting\u2026', function () {
        return remote().deleteLearner(k.id).then(function () { removeLocal(k.id); });
      }, function () {
        kids = kids.filter(function (x) { return x.id !== k.id; });
        renderChildren();
        say('Deleted ' + label(k) + '.');
      }, function () { return 'Could not delete the child. ' + OFFLINE; });
    });
    btns.appendChild(cancel);
    btns.appendChild(yes);
    card.appendChild(btns);
  }
  function removeLocal(id) {
    var prefix = 'learner/' + id + '/', gone = [];
    try {
      for (var i = 0; i < raw.length; i++) if (raw.key(i).indexOf(prefix) === 0) gone.push(raw.key(i));
      gone.forEach(function (key) { raw.removeItem(key); });
      var device = JSON.parse(raw.getItem('learners_v1'));
      if (device && device.current === id) raw.setItem('learners_v1', JSON.stringify({ v: 1, current: null }));
    } catch (e) {}
  }

  $('kid-add').addEventListener('click', function () {
    var r = checkChild({ name: $('kid-name').value, emoji: form.emoji, grade: form.grade, boy: form.boy });
    if (r.error) { say(r.error, true); return; }
    var id = newId(Date.now());
    var profile = { name: r.child.name, emoji: r.child.emoji, grade: r.child.grade, at: Date.now() };
    if (r.child.boy) profile.boy = true;
    work('Saving\u2026', function () {
      return remote().merge(id, 'profile_v1', profile, function (local) { return local; });
    }, function () {
      var k = { id: id, profile: profile };
      kids.push(k);
      renderChildren();
      say('Saved ' + label(k) + '. Add another child, or tap Done.');
    }, function () { return 'Could not save the child. ' + OFFLINE; });
  });

  $('kid-done').addEventListener('click', function () {
    if ($('kid-name').value.trim()) { say('Tap Save this child first, or clear the name to skip.', true); return; }
    if (accountMode) renderAccount(); else renderPick();
  });

  // ---- who uses this tablet ----
  function renderPick() {
    show('pick-view');
    var box = $('pick-list');
    box.textContent = '';
    kids.forEach(function (k) {
      var b = el('button', 'big', label(k));
      b.type = 'button';
      b.setAttribute('data-learner', k.id);
      b.addEventListener('click', function () {
        L.adopt(k.id, k.profile);
        markSignedIn(true);
        exported.go(L.lobby(k.profile));
      });
      box.appendChild(b);
    });
  }

  // ---- the Account view ----
  function renderAccount() {
    show('account-view');
    $('acct-who').textContent = !authKnown ? 'Checking the sign-in\u2026' :
      user ? 'Signed in as ' + (user.email || 'the family login') + '.' :
      'Not signed in. A PIN change here stays on this device only.';
    $('acct-guest').hidden = !authKnown || !!user;
    $('acct-signed').hidden = !authKnown || !user;
    $('acct-back').setAttribute('href', backTarget(root.location.search) || (L.current() ? L.lobby() : 'index.html'));
    refreshStatus();
  }

  function refreshStatus() {
    if (!user) return;
    FR.status().then(function (s) {
      $('acct-verify').textContent = s.verified ? '\u2705 Email verified' : 'Email not verified yet. Check your inbox.';
      $('acct-resend').hidden = s.verified;
    }, function () {});
    readConsent().then(function () { $('acct-consent').hidden = consentKnown !== false; });
  }

  $('pw-go').addEventListener('click', function () {
    var cur = $('pw-cur').value, next = $('pw-new').value;
    var problem = cur ? checkPassword(next, $('pw-new2').value) : 'Type the current password.';
    if (problem) { say(problem, true); return; }
    work('Changing the password\u2026', function () { return FR.changePassword(cur, next); }, function () {
      $('pw-cur').value = $('pw-new').value = $('pw-new2').value = '';
      say('Password changed. Use the new one on every device next time it asks.');
    }, function (e) { return FR.accountError(e, 'change'); });
  });

  $('pin-go').addEventListener('click', function () {
    var cur = $('pin-cur').value, next = $('pin-new').value, again = $('pin-new2').value;
    pinReady.then(function () {
      var problem = checkPin(cur, next, again, Pin.get());
      if (problem) { say(problem, true); return; }
      if (!Pin.set(next)) { say('Could not save the PIN on this device.', true); return; }
      $('pin-cur').value = $('pin-new').value = $('pin-new2').value = '';
      if (!user) { say('PIN changed on this device.'); return; }
      Pin.sync(remote()).then(function () { say('PIN changed. Your other devices get it at their next sync.'); });
    });
  });

  $('acct-signin').addEventListener('click', function () { show('signin-view'); });
  $('acct-register').addEventListener('click', function () { show('register-view'); });
  $('acct-add').addEventListener('click', function () {
    work('Loading the children\u2026', loadKids, renderChildren, function () { return 'Could not load the children. ' + OFFLINE; });
  });
  $('acct-resend').addEventListener('click', function () {
    work('Sending\u2026', FR.sendVerification, function () {
      say('Verification email sent. Check your inbox.');
    }, function (e) { return FR.accountError(e); });
  });
  $('acct-consent-go').addEventListener('click', function () { consentNext = null; show('consent-view'); });

  $('acct-signout').addEventListener('click', function () {
    work('Signing out\u2026', FR.signOut, function () {
      user = null;
      forgetSignIn();
      renderAccount();
    }, function () { return 'Could not sign out. Try again.'; }, true);
  });

  // The Firebase user goes last: until then a failed step can simply be tried again.
  function wipeDevice(ids) {
    var mine = L.current();
    if (mine) ids.push(mine.id);
    ids.forEach(removeLocal);
    forgetSignIn();
    try { raw.removeItem(PIN_KEY); } catch (e) {}
  }

  $('del-open').addEventListener('click', function () { $('del-box').hidden = false; });
  $('del-cancel').addEventListener('click', function () {
    $('del-box').hidden = true;
    $('del-pass').value = $('del-word').value = '';
  });
  $('del-go').addEventListener('click', function () {
    var pass = $('del-pass').value;
    var problem = checkDelete(pass, $('del-word').value);
    if (problem) { say(problem, true); return; }
    var ids = [];
    work('Deleting the account\u2026', function () {
      return FR.reauthenticate(pass).then(function () { return remote().learners(); }).then(function (list) {
        ids = list.map(function (l) { return l.id; });
        return list.reduce(function (chain, l) {
          return chain.then(function () { return remote().deleteLearner(l.id); });
        }, Promise.resolve());
      }).then(function () { return remote().deleteFamily(); }).then(function () { return FR.deleteUser(); });
    }, function () {
      wipeDevice(ids);
      exported.go('index.html');
    }, function (e) { return FR.accountError(e, 'change'); });
  });

  // ---- navigation ----
  $('go-signin').addEventListener('click', function () { show('signin-view'); });
  $('go-register').addEventListener('click', function () { show('register-view'); });
  $('go-play').addEventListener('click', function () { show('play-view'); });
  Array.prototype.forEach.call(doc.querySelectorAll('[data-back]'), function (b) {
    b.addEventListener('click', function () { if (accountMode) renderAccount(); else show('welcome-view'); });
  });

  if (!accountMode) { show('welcome-view'); return; }

  // The Parent panel or parent page just took the PIN in this tab; asking again would be redundant.
  function recentlyUnlocked() {
    try { return Date.now() - Number(root.sessionStorage.getItem('parent_unlocked_v1')) < UNLOCK_MS; } catch (e) { return false; }
  }

  function unlock() {
    pinReady.then(function () {
      if (!Pin.check($('lock-pin').value)) { $('lock-pin').value = ''; say('That PIN is not right.', true); return; }
      $('lock-pin').value = '';
      renderAccount();
    });
  }
  $('lock-go').addEventListener('click', unlock);
  $('lock-pin').addEventListener('keydown', function (ev) { if (ev.key === 'Enter') unlock(); });
  $('lock-back').setAttribute('href', backTarget(root.location.search) || (L.current() ? L.lobby() : 'index.html'));
  if (recentlyUnlocked()) renderAccount(); else show('lock-view');
  // Only the first answer: later sign-ins from this page are handled by their own buttons.
  var heard = false;
  FR.onAuth(function (u) {
    if (heard) return;
    heard = true;
    authKnown = true;
    if (!user) user = u;
    if (u) { markSignedIn(true); pinReady = settle(Pin.sync(remote())); }
    if (!$('account-view').hidden) renderAccount();
  }).catch(function () {
    authKnown = true;
    if ($('account-view').hidden) return;
    renderAccount();
    say('No internet. You can still change the PIN on this device.', true);
  });
})(this);
