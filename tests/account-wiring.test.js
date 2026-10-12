const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { web, engineFile } = require('./paths.js');

const html = fs.readFileSync(web('index.html'), 'utf8');
const account = fs.readFileSync(engineFile('account.js'), 'utf8');

test('the register view asks for a PIN and consent, and starts disabled', () => {
  for (const id of ['reg-pin', 'reg-pin2', 'reg-consent']) assert.ok(html.includes('id="' + id + '"'), id);
  assert.match(html, /<button class="big" type="button" id="reg-go" disabled>/);
  assert.match(account, /checkRegister\(\{/);
  assert.match(account, /Pin\.set\(pin\)/);
  assert.match(account, /FR\.sendVerification\(\)/);
});

test('creating an account stores the consent record', () => {
  assert.match(account, /putFamily\(\{ email: email, createdAt: Date\.now\(\), consent: \{ at: Date\.now\(\), version: CONSENT_VERSION \} \}\)/);
});

test('existing accounts see the consent view once, and the Account view shows the status', () => {
  for (const id of ['consent-check', 'consent-go', 'consent-no', 'acct-verify', 'acct-resend', 'acct-consent', 'acct-consent-go']) {
    assert.ok(html.includes('id="' + id + '"'), id);
  }
  assert.match(account, /function readConsent\(\)/);
  assert.match(account, /consentKnown === false/);
  assert.match(account, /function refreshStatus\(\)/);
  assert.match(account, /FR\.status\(\)/);
});

test('Delete family account runs in the safe order and wipes this device', () => {
  for (const id of ['del-open', 'del-box', 'del-pass', 'del-word', 'del-go', 'del-cancel']) {
    assert.ok(html.includes('id="' + id + '"'), id);
  }
  const handler = account.slice(account.indexOf("$('del-go')"));
  const at = ['FR.reauthenticate(', 'remote().learners()', 'deleteLearner(', 'remote().deleteFamily()', 'FR.deleteUser()', 'wipeDevice('].map((s) => handler.indexOf(s));
  assert.ok(at.every((i) => i >= 0), 'a step is missing: ' + at);
  assert.deepEqual([...at].sort((a, b) => a - b), at, 'steps are out of order: the Firebase user must be deleted last');
});
