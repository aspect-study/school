/* The start page (index.html): a family signs in or creates its account, adds its children with their grade, and
   picks who uses this device; or plays without an account. index.html?account=1 is the Account view: change the
   family password or the parent PIN, add a child, sign out. Keep this file ASCII-only. */
(function (root) {
  'use strict';

  var GRADES = [5, 2];
  var EMOJIS = ['\uD83C\uDF3B', '\uD83E\uDD8B', '\uD83D\uDC31', '\uD83D\uDC36', '\uD83E\uDD84', '\u2B50', '\uD83C\uDF08', '\uD83D\uDC3C'];
  var NAME_MAX = 30;

  function validEmail(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').trim()); }

  function checkPassword(a, b) {
    if (!a || a.length < 6) return 'The password needs at least 6 characters.';
    if (a !== b) return 'The two passwords are not the same.';
    return '';
  }

  function checkPin(current, next, again, real) {
    if (current !== real) return 'The current PIN is wrong.';
    if (!/^\d{4}$/.test(next)) return 'The new PIN must be 4 digits.';
    if (next !== again) return 'The two new PINs are not the same.';
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

  var exported = { GRADES: GRADES, EMOJIS: EMOJIS, validEmail: validEmail, checkPassword: checkPassword, checkPin: checkPin, checkChild: checkChild, newId: newId, backTarget: backTarget };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.Account = exported;

  var doc = root.document;
  if (!doc || !doc.getElementById('account-app')) return;

  var FR = root.FirebaseRemote, L = root.Learner, Pin = root.ParentPin, raw = root.StudyStore.raw;
  var SIGNED_IN = 'sync_signed_in_v1';
  var OFFLINE = 'No internet. Try again when online, or play without an account.';
  var VIEWS = ['welcome-view', 'signin-view', 'register-view', 'children-view', 'pick-view', 'play-view', 'account-view'];
  var $ = function (id) { return doc.getElementById(id); };
  var accountMode = /[?&]account=1(&|$)/.test(root.location.search);
  var user = null, kids = [], form = { emoji: EMOJIS[0], grade: 0, boy: null }, working = false, authKnown = false;
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

  $('signin-go').addEventListener('click', function () {
    var email = $('signin-email').value.trim(), pass = $('signin-pass').value;
    if (!validEmail(email) || !pass) { say('Type the family email and the password first.', true); return; }
    var signed = false;
    work('Signing in\u2026', function () {
      return FR.signIn(email, pass).then(function (cred) { signed = true; return startSession(cred); })
        .then(function () { return accountMode ? null : loadKids(); });
    }, function () {
      $('signin-pass').value = '';
      if (accountMode) { markSignedIn(true); renderAccount(); } else if (kids.length) renderPick(); else renderChildren();
    }, function (e) { return signed ? 'Could not load the children. ' + OFFLINE : FR.accountError(e); });
  });

  $('signin-forgot').addEventListener('click', function () {
    var email = $('signin-email').value.trim();
    if (!validEmail(email)) { say('Type the family email first, then tap Forgot password.', true); return; }
    work('Sending\u2026', function () { return FR.resetPassword(email); }, function () {
      say('Check your email for a link to set a new password.');
    }, function (e) { return FR.accountError(e); });
  });

  $('reg-go').addEventListener('click', function () {
    var email = $('reg-email').value.trim(), pass = $('reg-pass').value;
    var problem = validEmail(email) ? checkPassword(pass, $('reg-pass2').value) : 'Type a real email address.';
    if (problem) { say(problem, true); return; }
    work('Creating the account\u2026', function () {
      return FR.createAccount(email, pass).then(startSession).then(function () {
        return settle(remote().putFamily({ email: email, createdAt: Date.now() }).then(null, function () {}));
      });
    }, function () {
      $('reg-pass').value = '';
      $('reg-pass2').value = '';
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
  GRADES.forEach(function (g) {
    var b = el('button', 'chip', 'Grade ' + g);
    b.type = 'button';
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
    kids.forEach(function (k) { list.appendChild(el('li', '', label(k))); });
    var me = accountMode && L.current();
    var mine = me && !kids.some(function (k) { return k.id === me.id; });
    $('kid-note').hidden = !mine;
    $('kid-note').textContent = mine ? label({ profile: me }) + ' uses this tablet and is backed up at the next sync. Add only the other children here.' : '';
    $('kid-done').disabled = !kids.length;
    $('kid-name').value = '';
    form = { emoji: EMOJIS[0], grade: 0, boy: null };
    drawForm();
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
      say('Added ' + label(k) + '.');
    }, function () { return 'Could not save the child. ' + OFFLINE; });
  });

  $('kid-done').addEventListener('click', function () { if (accountMode) renderAccount(); else renderPick(); });

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
  $('acct-signout').addEventListener('click', function () {
    work('Signing out\u2026', FR.signOut, function () {
      user = null;
      markSignedIn(false);
      root.StudyStore.spaces().forEach(function (id) { root.StudyStore.space(id).put(SIGNED_IN, null); });
      renderAccount();
    }, function () { return 'Could not sign out. Try again.'; }, true);
  });

  // ---- navigation ----
  $('go-signin').addEventListener('click', function () { show('signin-view'); });
  $('go-register').addEventListener('click', function () { show('register-view'); });
  $('go-play').addEventListener('click', function () { show('play-view'); });
  Array.prototype.forEach.call(doc.querySelectorAll('[data-back]'), function (b) {
    b.addEventListener('click', function () { if (accountMode) renderAccount(); else show('welcome-view'); });
  });

  if (!accountMode) { show('welcome-view'); return; }
  renderAccount();
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
