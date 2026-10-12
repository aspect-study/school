// The start page and the Account view with a fake Firebase: create an account, add two children, pick one; change the
// password and the parent PIN (the lobby then wants the new PIN); play without an account; forgot password; sign in
// to a family with and without children.
// Run: node tests/e2e/account-e2e.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { stage, makeWorkDir, dumpDom, readOutput, appendDriver } = require('./chrome.js');
const { LOBBIES, ENGINE_FILES, lobbyFile, web } = require('../paths.js');

// Stands in for web/engine/firebase-remote.js. The "cloud" lives in localStorage so it survives page loads.
const FAKE = `(function (root) {
  var KEY = 'fake_cloud';
  function db() { try { return JSON.parse(localStorage.getItem(KEY)) || { users: {}, current: null, calls: 0 }; } catch (e) { return { users: {}, current: null, calls: 0 }; } }
  function save(d) { localStorage.setItem(KEY, JSON.stringify(d)); }
  function call() { var d = db(); d.calls++; save(d); return d; }
  function fail(code) { var e = new Error(code); e.code = code; return Promise.reject(e); }
  function userOf(d) { return d.current ? { uid: d.users[d.current].uid, email: d.current } : null; }
  root.FirebaseRemote = {
    onAuth: function (cb) { cb(userOf(call())); return Promise.resolve(); },
    signIn: function (email, pass) { var d = call(), u = d.users[email]; if (!u || u.pass !== pass) return fail('auth/invalid-credential'); d.current = email; save(d); return Promise.resolve({ user: userOf(d) }); },
    createAccount: function (email, pass) { var d = call(); if (d.users[email]) return fail('auth/email-already-in-use'); d.users[email] = { uid: 'u' + Object.keys(d.users).length, pass: pass, learners: {}, pin: null, resets: 0, verified: false, verifyMails: 0, family: null }; d.current = email; save(d); return Promise.resolve({ user: userOf(d) }); },
    sendVerification: function () { var d = call(); d.users[d.current].verifyMails++; save(d); return Promise.resolve(); },
    status: function () { var d = call(); return Promise.resolve({ verified: !!d.users[d.current].verified }); },
    reauthenticate: function (pass) { var d = call(); if (d.users[d.current].pass !== pass) return fail('auth/invalid-credential'); return Promise.resolve(); },
    deleteUser: function () { var d = call(); delete d.users[d.current]; d.current = null; save(d); return Promise.resolve(); },
    resetPassword: function (email) { var d = call(); if (d.users[email]) d.users[email].resets++; save(d); return Promise.resolve(); },
    changePassword: function (cur, next) { var d = call(), u = d.users[d.current]; if (u.pass !== cur) return fail('auth/invalid-credential'); u.pass = next; save(d); return Promise.resolve(); },
    signOut: function () { var d = call(); d.current = null; save(d); return Promise.resolve(); },
    signInError: function () { return 'Wrong email or password.'; },
    accountError: function (e, ctx) { return e.code === 'auth/invalid-credential' ? (ctx === 'change' ? 'The current password is wrong.' : 'Wrong email or password.') : 'error ' + e.code; },
    whenSlow: function (p) { return p; },
    remote: function (uid) {
      function me(d) { for (var k in d.users) if (d.users[k].uid === uid) return d.users[k]; return null; }
      return {
        learners: function () { var u = me(db()); return Promise.resolve(Object.keys(u.learners).map(function (id) { return { id: id, profile: u.learners[id] }; })); },
        merge: function (id, key, local, fn) { var d = db(), u = me(d); u.learners[id] = fn(local, u.learners[id] || null); save(d); return Promise.resolve(u.learners[id]); },
        deleteLearner: function (id) { var d = db(), u = me(d); delete u.learners[id]; save(d); return Promise.resolve(); },
        putFamily: function (rec) { var d = db(), u = me(d); u.family = Object.assign(u.family || {}, rec); save(d); return Promise.resolve(); },
        getFamily: function () { var f = me(db()).family || {}; return Promise.resolve({ consent: f.consent || null }); },
        deleteFamily: function () { var d = db(), u = me(d); u.family = null; u.pin = null; save(d); return Promise.resolve(); },
        getPin: function () { return Promise.resolve(me(db()).pin); },
        putPin: function (rec) { var d = db(); me(d).pin = rec; save(d); return Promise.resolve(); }
      };
    }
  };
})(this);`;

// Runs steps 60 ms apart (so the fake's promises settle), then prints what the steps logged.
const HELPERS = `
var log = {};
function q(id) { return document.getElementById(id); }
function type(id, v) { q(id).value = v; }
function click(id) { q(id).click(); }
function msg() { return q('msg').textContent; }
function view() { return ['welcome-view','signin-view','register-view','children-view','pick-view','play-view','lock-view','account-view','consent-view'].filter(function (v) { return q(v) && !q(v).hidden; })[0] || ''; }
function cloud() { return JSON.parse(localStorage.getItem('fake_cloud')); }
function run(steps) {
  var i = 0;
  (function next() {
    if (i < steps.length) {
      try { steps[i++](); } catch (e) { log.stepError = 'step ' + i + ': ' + e.message; i = steps.length; }
      setTimeout(next, 60);
      return;
    }
    var out = document.createElement('pre');
    out.id = 'e2e-out';
    out.textContent = JSON.stringify({ errors: window.__e2eErrors || [], log: log });
    document.body.appendChild(out);
  })();
}
if (window.Account) Account.go = function (u) { log.went = u; };
`;

const work = makeWorkDir('account-e2e');
const site = path.join(work, 'site');
const WAIT = 8000;

function page(name, driver, preScript) {
  const file = path.join(site, name);
  let html = fs.readFileSync(web('index.html'), 'utf8');
  if (preScript) {
    const first = html.indexOf('<script');
    html = html.slice(0, first) + '<script>' + preScript + '</script>\n' + html.slice(first);
  }
  fs.writeFileSync(file, appendDriver(html, HELPERS + driver));
  return file;
}

fs.mkdirSync(site, { recursive: true });
stage(site, 'index.html', fs.readFileSync(web('index.html'), 'utf8'), ENGINE_FILES);
const lobby = stage(site, LOBBIES[2].page, appendDriver(fs.readFileSync(lobbyFile(2), 'utf8'), HELPERS + `
function pin(d) { Array.prototype.filter.call(document.querySelectorAll('#pin-pad button'), function (b) { return b.textContent === d; })[0].click(); }
run([
  function () { log.learner = Learner.current(); click('parent-open'); },
  function () { '1234'.split('').forEach(pin); log.oldPinLocked = q('history-view').hidden; },
  function () { '4321'.split('').forEach(pin); log.newPinOpen = !q('history-view').hidden; }
]);`), ENGINE_FILES);
// After staging (which copies the real engine files), swap in the fake Firebase.
fs.writeFileSync(path.join(site, 'engine', 'firebase-remote.js'), FAKE);

const create = page('create.html', `
run([
  function () { log.start = view(); click('go-register'); },
  function () { log.regDisabled = q('reg-go').disabled; click('reg-consent'); },
  function () { log.regEnabled = !q('reg-go').disabled; type('reg-email', 'mom@family.test'); type('reg-pass', 'secret12'); type('reg-pass2', 'secret13'); type('reg-pin', '1234'); type('reg-pin2', '1234'); click('reg-go'); },
  function () { log.mismatch = msg(); type('reg-pass2', 'secret12'); type('reg-pin2', '9999'); click('reg-go'); },
  function () { log.pinMismatch = msg(); type('reg-pin2', '1234'); click('reg-go'); },
  function () { log.afterCreate = view(); log.doneDisabled = q('kid-done').disabled; click('kid-add'); },
  function () { log.noName = msg(); type('kid-name', 'Ana'); click('kid-add'); },
  function () { log.noGrade = msg(); document.querySelector('#kid-grades [data-grade="5"]').click(); document.querySelector('#kid-emojis [data-emoji="' + Account.EMOJIS[1] + '"]').click(); click('kid-add'); },
  function () { log.noKind = msg(); document.querySelector('#kid-kinds [data-boy="0"]').click(); click('kid-add'); },
  function () { log.added = msg(); type('kid-name', 'Bea'); document.querySelector('#kid-grades [data-grade="2"]').click(); document.querySelector('#kid-kinds [data-boy="0"]').click(); click('kid-add'); },
  function () { log.addedBea = msg(); type('kid-name', 'Ben'); document.querySelector('#kid-grades [data-grade="2"]').click(); document.querySelector('#kid-kinds [data-boy="1"]').click(); click('kid-add'); },
  function () {
    log.listed = q('kid-list').children.length;
    log.benRow = Array.prototype.filter.call(q('kid-list').children, function (li) { return li.textContent.indexOf('Ben') >= 0; })[0];
    log.benRow.querySelector('[data-delete]').click();
  },
  function () { log.asked = log.benRow.querySelector('.kc-ask').textContent; log.benRow.querySelector('[data-confirm]').click(); },
  function () { log.afterDelete = q('kid-list').children.length; log.deletedMsg = msg(); click('kid-done'); },
  function () {
    log.pick = view();
    var buttons = Array.prototype.slice.call(document.querySelectorAll('#pick-list [data-learner]'));
    log.pickLabels = buttons.map(function (b) { return b.textContent; });
    buttons.filter(function (b) { return b.textContent.indexOf('Bea') >= 0; })[0].click();
  },
  function () {
    log.device = JSON.parse(localStorage.getItem('learners_v1'));
    log.flag = localStorage.getItem('sync_signed_in_v1');
    log.cloud = cloud();
  }
]);`);

const account = page('account.html', `
run([
  function () { log.locked = view(); type('lock-pin', '9999'); click('lock-go'); },
  function () { log.wrongLock = msg(); log.stillLocked = view(); type('lock-pin', '1234'); click('lock-go'); },
  function () { log.view = view(); log.who = q('acct-who').textContent; log.back = q('acct-back').getAttribute('href'); },
  function () { log.verify = q('acct-verify').textContent; log.resendShown = !q('acct-resend').hidden; log.consentBannerHidden = q('acct-consent').hidden; },
  function () { type('pw-cur', 'wrong11'); type('pw-new', 'newpass1'); type('pw-new2', 'newpass1'); click('pw-go'); },
  function () { log.wrongPass = msg(); type('pw-cur', 'secret12'); type('pw-new', 'newpass1'); type('pw-new2', 'newpass1'); click('pw-go'); },
  function () { log.passOk = msg(); log.pass = cloud().users['mom@family.test'].pass; },
  function () { type('pin-cur', '1234'); type('pin-new', '4321'); type('pin-new2', '4322'); click('pin-go'); },
  function () { log.pinMismatch = msg(); type('pin-cur', '1234'); type('pin-new', '4321'); type('pin-new2', '4321'); click('pin-go'); },
  function () { log.pinOk = msg(); log.pin = ParentPin.get(); log.cloudPin = cloud().users['mom@family.test'].pin; }
]);`);

const CONSENT = { consent: { at: 1, version: 1 } };
const FAMILY = {
  calls: 0, current: null,
  users: {
    'dad@family.test': { uid: 'u0', pass: 'secret1', resets: 0, pin: { pin: '2468', at: 5 }, family: CONSENT, learners: { lk1: { name: 'Ana', emoji: '🌻', grade: 5, at: 1 } } },
    'new@family.test': { uid: 'u1', pass: 'secret1', resets: 0, pin: null, family: CONSENT, learners: {} },
    'old@family.test': { uid: 'u2', pass: 'secret1', resets: 0, pin: null, family: null, learners: { lo1: { name: 'Cy', emoji: '🌻', grade: 5, at: 1 } } },
    'gone@family.test': { uid: 'u3', pass: 'secret1', resets: 0, pin: null, family: CONSENT, learners: { lg1: { name: 'Dee', emoji: '🌻', grade: 2, at: 1 } } },
  },
};

// Profile two starts empty; the drivers seed the fake cloud before any click.
const SEED = `if (!localStorage.getItem('fake_cloud')) localStorage.setItem('fake_cloud', ${JSON.stringify(JSON.stringify(FAMILY))});`;

const guest = page('guest.html', `
${SEED}
run([
  function () { click('go-play'); },
  function () {
    log.play = view();
    log.links = Array.prototype.map.call(document.querySelectorAll('#play-view a'), function (a) { return a.getAttribute('href'); });
    log.callsAfterPlay = cloud().calls;
    document.querySelector('#play-view [data-back]').click();
  },
  function () { log.backTo = view(); click('go-signin'); },
  function () { click('signin-forgot'); },
  function () { log.forgotEmpty = msg(); type('signin-email', 'dad@family.test'); click('signin-forgot'); },
  function () { log.forgot = msg(); log.resets = cloud().users['dad@family.test'].resets; type('signin-pass', 'nope'); click('signin-go'); },
  function () { log.wrong = msg(); type('signin-email', 'new@family.test'); type('signin-pass', 'secret1'); click('signin-go'); },
  function () { log.noKids = view(); }
]);`);

const dad = page('dad.html', `
${SEED}
run([
  function () { click('go-signin'); type('signin-email', 'dad@family.test'); type('signin-pass', 'secret1'); click('signin-go'); },
  function () {
    log.pick = view();
    var b = document.querySelectorAll('#pick-list [data-learner]');
    log.count = b.length;
    b[0].click();
  },
  function () { log.pin = ParentPin.get(); log.current = JSON.parse(localStorage.getItem('learners_v1')).current; }
]);`);

const old = page('old.html', `
${SEED}
run([
  function () { click('go-signin'); type('signin-email', 'old@family.test'); type('signin-pass', 'secret1'); click('signin-go'); },
  function () { log.consentView = view(); click('consent-no'); },
  function () { log.afterDecline = view(); log.stillSignedIn = cloud().current; click('go-signin'); type('signin-email', 'old@family.test'); type('signin-pass', 'secret1'); click('signin-go'); },
  function () { log.consentAgain = view(); click('consent-go'); },
  function () { log.needTick = msg(); click('consent-check'); click('consent-go'); },
  function () { log.afterConsent = view(); log.consent = cloud().users['old@family.test'].family.consent; }
]);`);

const SEED_GONE = `if (!localStorage.getItem('fake_cloud')) localStorage.setItem('fake_cloud', ${JSON.stringify(JSON.stringify({ ...FAMILY, current: 'gone@family.test' }))});`;
const gone = page('gone.html', `
run([
  function () { type('lock-pin', '0108'); click('lock-go'); },
  function () { log.view = view(); click('del-open'); },
  function () { log.boxShown = !q('del-box').hidden; type('del-pass', 'wrong99'); type('del-word', 'DELETE'); click('del-go'); },
  function () { log.wrongPass = msg(); log.stillThere = !!cloud().users['gone@family.test']; type('del-pass', 'secret1'); type('del-word', 'delete me'); click('del-go'); },
  function () { log.noWord = msg(); type('del-word', 'DELETE'); click('del-go'); },
  function () { log.users = Object.keys(cloud().users); log.current = cloud().current; }
]);`, SEED_GONE);


try {
  const one = path.join(work, 'one');
  const a = readOutput(dumpDom(one, create, '', WAIT));
  assert.deepEqual(a.errors, [], 'create errors');
  assert.equal(a.log.stepError, undefined, a.log.stepError);
  assert.equal(a.log.start, 'welcome-view');
  assert.equal(a.log.regDisabled, true, 'Create account starts disabled');
  assert.equal(a.log.regEnabled, true, 'ticking the consent box enables it');
  assert.equal(a.log.mismatch, 'The two passwords are not the same.');
  assert.equal(a.log.pinMismatch, 'The two PINs are not the same.');
  assert.equal(a.log.afterCreate, 'children-view');
  assert.equal(a.log.doneDisabled, true);
  assert.equal(a.log.noName, 'Type the name.');
  assert.equal(a.log.noGrade, 'Pick the grade.');
  assert.equal(a.log.noKind, 'Pick girl or boy.');
  assert.match(a.log.added, /^Saved .*Ana · Grade 5 · Girl. Add another child, or tap Done.$/);
  assert.ok(a.log.addedBea.includes('Bea'));
  assert.equal(a.log.listed, 3);
  assert.equal(a.log.pick, 'pick-view');
  assert.equal(a.log.asked, "Delete Ben and all progress?");
  assert.equal(a.log.afterDelete, 2, 'Ben is gone from the list');
  assert.match(a.log.deletedMsg, /^Deleted .*Ben/);
  assert.equal(a.log.pickLabels.length, 2);
  assert.equal(a.log.went, 'lobby/grade-2.html');
  assert.equal(a.log.flag, '1');
  const learners = a.log.cloud.users['mom@family.test'].learners;
  const bea = Object.keys(learners).find((id) => learners[id].name === 'Bea');
  assert.equal(learners[bea].grade, 2);
  assert.equal(Object.keys(learners).find((id) => learners[id].name === 'Ben'), undefined, 'Ben is deleted from the cloud');
  assert.equal('boy' in learners[bea], false, 'a girl\'s profile has no boy key');
  assert.equal(Object.values(learners).find((p) => p.name === 'Ana').grade, 5);
  assert.equal(a.log.device.current, bea, 'this tablet is Bea');
  const mom = a.log.cloud.users['mom@family.test'];
  assert.equal(mom.pin.pin, '1234', 'the PIN chosen at registration is the family PIN');
  assert.equal(mom.family.consent.version, 1, 'consent is recorded');
  assert.equal(mom.verifyMails, 1, 'a verification email was sent');

  const b = readOutput(dumpDom(one, account, '?account=1&back=lobby/grade-2.html', WAIT));
  assert.deepEqual(b.errors, [], 'account errors');
  assert.equal(b.log.stepError, undefined, b.log.stepError);
  assert.equal(b.log.locked, 'lock-view', 'the Account view starts behind the PIN');
  assert.equal(b.log.wrongLock, 'That PIN is not right.');
  assert.equal(b.log.stillLocked, 'lock-view');
  assert.equal(b.log.view, 'account-view');
  assert.equal(b.log.who, 'Signed in as mom@family.test.');
  assert.equal(b.log.back, 'lobby/grade-2.html');
  assert.equal(b.log.verify, 'Email not verified yet. Check your inbox.');
  assert.equal(b.log.resendShown, true);
  assert.equal(b.log.consentBannerHidden, true, 'a family that agreed sees no consent banner');
  assert.equal(b.log.wrongPass, 'The current password is wrong.');
  assert.equal(b.log.passOk, 'Password changed. Use the new one on every device next time it asks.');
  assert.equal(b.log.pass, 'newpass1');
  assert.equal(b.log.pinMismatch, 'The two new PINs are not the same.');
  assert.equal(b.log.pinOk, 'PIN changed. Your other devices get it at their next sync.');
  assert.equal(b.log.pin, '4321');
  assert.equal(b.log.cloudPin.pin, '4321');

  const c = readOutput(dumpDom(one, lobby, '', WAIT));
  assert.deepEqual(c.errors, [], 'lobby errors');
  assert.equal(c.log.stepError, undefined, c.log.stepError);
  assert.equal(c.log.learner.id, bea);
  assert.equal(c.log.learner.grade, 2);
  assert.equal(c.log.oldPinLocked, true, 'the old PIN no longer opens the Parent panel');
  assert.equal(c.log.newPinOpen, true, 'the new PIN opens it');

  const two = path.join(work, 'two');
  const d = readOutput(dumpDom(two, guest, '', WAIT));
  assert.deepEqual(d.errors, [], 'guest errors');
  assert.equal(d.log.stepError, undefined, d.log.stepError);
  assert.equal(d.log.play, 'play-view');
  assert.deepEqual(d.log.links, ['world/grade-2.html', 'world/grade-5.html']);
  assert.equal(d.log.callsAfterPlay, 0, 'playing without an account calls nothing');
  assert.equal(d.log.backTo, 'welcome-view');
  assert.equal(d.log.forgotEmpty, 'Type the family email first, then tap Forgot password.');
  assert.equal(d.log.forgot, 'Check your email for a link to set a new password.');
  assert.equal(d.log.resets, 1);
  assert.equal(d.log.wrong, 'Wrong email or password.');
  assert.equal(d.log.noKids, 'children-view', 'a family with no children goes to Add children');

  const e = readOutput(dumpDom(two, dad, '', WAIT));
  assert.deepEqual(e.errors, [], 'sign-in errors');
  assert.equal(e.log.stepError, undefined, e.log.stepError);
  assert.equal(e.log.pick, 'pick-view');
  assert.equal(e.log.count, 1);
  assert.equal(e.log.went, 'lobby/grade-5.html');
  assert.equal(e.log.current, 'lk1');
  assert.equal(e.log.pin, '2468', 'a new tablet learns the family PIN');
  const four = path.join(work, 'four');
  const f = readOutput(dumpDom(four, old, '', WAIT));
  assert.deepEqual(f.errors, [], 'consent errors');
  assert.equal(f.log.stepError, undefined, f.log.stepError);
  assert.equal(f.log.consentView, 'consent-view', 'an account without consent sees the consent view');
  assert.equal(f.log.afterDecline, 'welcome-view', 'declining signs out');
  assert.equal(f.log.stillSignedIn, null);
  assert.equal(f.log.consentAgain, 'consent-view');
  assert.equal(f.log.needTick, 'Tick the box to agree to the privacy notice.');
  assert.equal(f.log.afterConsent, 'pick-view', 'agreeing continues to Who uses this tablet?');
  assert.equal(f.log.consent.version, 1);

  const five = path.join(work, 'five');
  const g = readOutput(dumpDom(five, gone, '?account=1', WAIT));
  assert.deepEqual(g.errors, [], 'delete errors');
  assert.equal(g.log.stepError, undefined, g.log.stepError);
  assert.equal(g.log.view, 'account-view');
  assert.equal(g.log.boxShown, true);
  assert.equal(g.log.wrongPass, 'The current password is wrong.');
  assert.equal(g.log.stillThere, true, 'a wrong password deletes nothing');
  assert.equal(g.log.noWord, 'Type DELETE to confirm.');
  assert.ok(!g.log.users.includes('gone@family.test'), 'the family is gone from the cloud');
  assert.ok(g.log.users.includes('dad@family.test'), 'other families are untouched');
  assert.equal(g.log.went, 'index.html', 'the page returns to the start page');
  console.log('Account e2e passed');
} catch (err) {
  console.error('FAIL account:', err.message);
  process.exitCode = 1;
} finally {
  fs.rmSync(work, { recursive: true, force: true });
}
