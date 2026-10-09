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
    createAccount: function (email, pass) { var d = call(); if (d.users[email]) return fail('auth/email-already-in-use'); d.users[email] = { uid: 'u' + Object.keys(d.users).length, pass: pass, learners: {}, pin: null, resets: 0 }; d.current = email; save(d); return Promise.resolve({ user: userOf(d) }); },
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
function view() { return ['welcome-view','signin-view','register-view','children-view','pick-view','play-view','account-view'].filter(function (v) { return q(v) && !q(v).hidden; })[0] || ''; }
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

function page(name, driver) {
  const file = path.join(site, name);
  fs.writeFileSync(file, appendDriver(fs.readFileSync(web('index.html'), 'utf8'), HELPERS + driver));
  return file;
}

fs.mkdirSync(site, { recursive: true });
stage(site, 'index.html', fs.readFileSync(web('index.html'), 'utf8'), ENGINE_FILES);
const lobby = stage(site, LOBBIES[2].page, appendDriver(fs.readFileSync(lobbyFile(2), 'utf8'), HELPERS + `
function pin(d) { Array.prototype.filter.call(document.querySelectorAll('#pin-pad button'), function (b) { return b.textContent === d; })[0].click(); }
run([
  function () { log.learner = Learner.current(); click('parent-open'); },
  function () { '0108'.split('').forEach(pin); log.oldPinLocked = q('history-view').hidden; },
  function () { '4321'.split('').forEach(pin); log.newPinOpen = !q('history-view').hidden; }
]);`), ENGINE_FILES);
// After staging (which copies the real engine files), swap in the fake Firebase.
fs.writeFileSync(path.join(site, 'engine', 'firebase-remote.js'), FAKE);

const create = page('create.html', `
run([
  function () { log.start = view(); click('go-register'); },
  function () { type('reg-email', 'mom@family.test'); type('reg-pass', 'secret1'); type('reg-pass2', 'secret2'); click('reg-go'); },
  function () { log.mismatch = msg(); type('reg-pass2', 'secret1'); click('reg-go'); },
  function () { log.afterCreate = view(); log.doneDisabled = q('kid-done').disabled; click('kid-add'); },
  function () { log.noName = msg(); type('kid-name', 'Ana'); click('kid-add'); },
  function () { log.noGrade = msg(); document.querySelector('#kid-grades [data-grade="5"]').click(); document.querySelector('#kid-emojis [data-emoji="' + Account.EMOJIS[1] + '"]').click(); click('kid-add'); },
  function () { log.noKind = msg(); document.querySelector('#kid-kinds [data-boy="0"]').click(); click('kid-add'); },
  function () { log.added = msg(); type('kid-name', 'Bea'); document.querySelector('#kid-grades [data-grade="2"]').click(); document.querySelector('#kid-kinds [data-boy="0"]').click(); click('kid-add'); },
  function () { log.addedBea = msg(); type('kid-name', 'Ben'); document.querySelector('#kid-grades [data-grade="2"]').click(); document.querySelector('#kid-kinds [data-boy="1"]').click(); click('kid-add'); },
  function () { log.listed = q('kid-list').children.length; click('kid-done'); },
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
  function () { log.view = view(); log.who = q('acct-who').textContent; log.back = q('acct-back').getAttribute('href'); },
  function () { type('pw-cur', 'wrong11'); type('pw-new', 'newpass1'); type('pw-new2', 'newpass1'); click('pw-go'); },
  function () { log.wrongPass = msg(); type('pw-cur', 'secret1'); type('pw-new', 'newpass1'); type('pw-new2', 'newpass1'); click('pw-go'); },
  function () { log.passOk = msg(); log.pass = cloud().users['mom@family.test'].pass; },
  function () { type('pin-cur', '0108'); type('pin-new', '4321'); type('pin-new2', '4322'); click('pin-go'); },
  function () { log.pinMismatch = msg(); type('pin-cur', '0108'); type('pin-new', '4321'); type('pin-new2', '4321'); click('pin-go'); },
  function () { log.pinOk = msg(); log.pin = ParentPin.get(); log.cloudPin = cloud().users['mom@family.test'].pin; }
]);`);

const FAMILY = {
  calls: 0, current: null,
  users: {
    'dad@family.test': { uid: 'u0', pass: 'secret1', resets: 0, pin: { pin: '2468', at: 5 }, learners: { lk1: { name: 'Ana', emoji: '🌻', grade: 5, at: 1 } } },
    'new@family.test': { uid: 'u1', pass: 'secret1', resets: 0, pin: null, learners: {} },
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


try {
  const one = path.join(work, 'one');
  const a = readOutput(dumpDom(one, create, '', WAIT));
  assert.deepEqual(a.errors, [], 'create errors');
  assert.equal(a.log.stepError, undefined, a.log.stepError);
  assert.equal(a.log.start, 'welcome-view');
  assert.equal(a.log.mismatch, 'The two passwords are not the same.');
  assert.equal(a.log.afterCreate, 'children-view');
  assert.equal(a.log.doneDisabled, true);
  assert.equal(a.log.noName, 'Type the name.');
  assert.equal(a.log.noGrade, 'Pick the grade.');
  assert.equal(a.log.noKind, 'Pick girl or boy.');
  assert.match(a.log.added, /^Added .*Ana · Grade 5 · Girl\.$/);
  assert.ok(a.log.addedBea.includes('Bea'));
  assert.equal(a.log.listed, 3);
  assert.equal(a.log.pick, 'pick-view');
  assert.equal(a.log.pickLabels.length, 3);
  assert.equal(a.log.went, 'lobby/grade-2.html');
  assert.equal(a.log.flag, '1');
  const learners = a.log.cloud.users['mom@family.test'].learners;
  const bea = Object.keys(learners).find((id) => learners[id].name === 'Bea');
  assert.equal(learners[bea].grade, 2);
  const ben = Object.keys(learners).find((id) => learners[id].name === 'Ben');
  assert.equal(learners[ben].boy, true, 'Ben is saved as a boy');
  assert.equal('boy' in learners[bea], false, 'a girl\'s profile has no boy key');
  assert.equal(Object.values(learners).find((p) => p.name === 'Ana').grade, 5);
  assert.equal(a.log.device.current, bea, 'this tablet is Bea');

  const b = readOutput(dumpDom(one, account, '?account=1&back=lobby/grade-2.html', WAIT));
  assert.deepEqual(b.errors, [], 'account errors');
  assert.equal(b.log.stepError, undefined, b.log.stepError);
  assert.equal(b.log.view, 'account-view');
  assert.equal(b.log.who, 'Signed in as mom@family.test.');
  assert.equal(b.log.back, 'lobby/grade-2.html');
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
  assert.equal(c.log.oldPinLocked, true, '0108 no longer opens the Parent panel');
  assert.equal(c.log.newPinOpen, true, 'the new PIN opens it');

  const two = path.join(work, 'two');
  const d = readOutput(dumpDom(two, guest, '', WAIT));
  assert.deepEqual(d.errors, [], 'guest errors');
  assert.equal(d.log.stepError, undefined, d.log.stepError);
  assert.equal(d.log.play, 'play-view');
  assert.deepEqual(d.log.links, ['world/grade-5.html', 'world/grade-2.html']);
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
  console.log('Account e2e passed');
} catch (err) {
  console.error('FAIL account:', err.message);
  process.exitCode = 1;
} finally {
  fs.rmSync(work, { recursive: true, force: true });
}
