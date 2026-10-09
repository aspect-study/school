const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { engineFile } = require('./paths.js');

function remoteModule() {
  const win = {};
  vm.createContext(win);
  vm.runInContext(fs.readFileSync(engineFile('firebase-remote.js'), 'utf8'), win);
  return win.FirebaseRemote;
}
const err = (code) => ({ code });

test('account errors are in words', () => {
  const FR = remoteModule();
  assert.equal(FR.accountError(err('auth/email-already-in-use')), 'This email already has an account. Sign in instead.');
  assert.equal(FR.accountError(err('auth/weak-password')), 'The password needs at least 6 characters.');
  assert.equal(FR.accountError(err('auth/invalid-email')), 'Type a real email address.');
  assert.equal(FR.accountError(err('auth/requires-recent-login')), 'Sign out, sign in again, then change the password.');
  assert.equal(FR.accountError(err('auth/invalid-credential'), 'change'), 'The current password is wrong.');
  assert.equal(FR.accountError(err('auth/wrong-password'), 'change'), 'The current password is wrong.');
  assert.equal(FR.accountError(err('auth/invalid-credential')), 'Wrong email or password.');
  assert.equal(FR.accountError(err('auth/user-not-found')), 'No account uses that email.');
  assert.equal(FR.accountError(err('auth/network-request-failed')), 'No internet. Try again when online.');
  assert.equal(FR.accountError(err('auth/too-many-requests')), 'Too many tries. Wait a few minutes.');
  assert.equal(FR.accountError(err('auth/odd')), 'Something went wrong (auth/odd). Try again.');
  assert.equal(FR.accountError(null), 'Something went wrong (unknown error). Try again.');
});

test('the account calls exist', () => {
  const FR = remoteModule();
  for (const name of ['createAccount', 'resetPassword', 'changePassword', 'accountError', 'signIn', 'signOut', 'onAuth', 'remote']) {
    assert.equal(typeof FR[name], 'function', name);
  }
});
