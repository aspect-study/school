const test = require('node:test');
const assert = require('node:assert/strict');
const { LOBBIES, engineFile } = require('./paths.js');
const A = require(engineFile('account.js'));

test('validEmail', () => {
  assert.ok(A.validEmail('mom@family.test'));
  assert.ok(A.validEmail('  mom@family.test '));
  assert.ok(!A.validEmail('mom@'));
  assert.ok(!A.validEmail('mom family@x.y'));
  assert.ok(!A.validEmail(''));
  assert.ok(!A.validEmail(null));
});

test('checkPassword', () => {
  assert.equal(A.checkPassword('1234567', '1234567'), 'The password needs at least 8 characters.');
  assert.equal(A.checkPassword('', ''), 'The password needs at least 8 characters.');
  assert.equal(A.checkPassword('secret12', 'secret13'), 'The two passwords are not the same.');
  assert.equal(A.checkPassword('secret12', 'secret12'), '');
});

test('checkPin', () => {
  assert.equal(A.checkPin('0000', '1234', '1234', '0108'), 'The current PIN is wrong.');
  assert.equal(A.checkPin('0108', '12a4', '12a4', '0108'), 'The new PIN must be 4 digits.');
  assert.equal(A.checkPin('0108', '123', '123', '0108'), 'The new PIN must be 4 digits.');
  assert.equal(A.checkPin('0108', '1234', '1235', '0108'), 'The two new PINs are not the same.');
  assert.equal(A.checkPin('0108', '1234', '1234', '0108'), '');
});

test('checkChild', () => {
  assert.equal(A.checkChild({ name: '  ', grade: 5, boy: false }).error, 'Type the name.');
  assert.equal(A.checkChild({ name: 'Ana', grade: 0, boy: false }).error, 'Pick the grade.');
  assert.equal(A.checkChild({ name: 'Ana', grade: 3, boy: false }).error, 'Pick the grade.');
  assert.equal(A.checkChild({ name: 'Ana', grade: 5 }).error, 'Pick girl or boy.');
  assert.deepEqual(A.checkChild({ name: ' Ana ', emoji: A.EMOJIS[1], grade: '2', boy: false }), { error: '', child: { name: 'Ana', emoji: A.EMOJIS[1], grade: 2, boy: false } });
  assert.equal(A.checkChild({ name: 'Ben', grade: 5, boy: true }).child.boy, true);
  assert.equal(A.checkChild({ name: 'x'.repeat(40), grade: 5, boy: false }).child.name.length, 30);
  assert.equal(A.checkChild({ name: 'Ana', emoji: 'x', grade: 5, boy: false }).child.emoji, A.EMOJIS[0]);
});

test('GRADES are the lobbies that exist, oldest first', () => {
  assert.deepEqual(A.GRADES, Object.keys(LOBBIES).map(Number).sort((a, b) => b - a));
  assert.equal(A.EMOJIS.length, 8);
});

test('newId looks like a learner id', () => {
  const id = A.newId(1700000000000);
  assert.match(id, /^l[0-9a-z]+$/);
  assert.ok(id.startsWith('l' + (1700000000000).toString(36)));
});

test('backTarget only allows the lobbies and the parent page', () => {
  assert.equal(A.backTarget('?account=1&back=lobby%2Fgrade-2.html'), 'lobby/grade-2.html');
  assert.equal(A.backTarget('?account=1&back=lobby/grade-5.html'), 'lobby/grade-5.html');
  assert.equal(A.backTarget('?back=parent/'), 'parent/');
  assert.equal(A.backTarget('?back=https://evil.example'), '');
  assert.equal(A.backTarget('?back=%E0%A4%A'), '');
  assert.equal(A.backTarget(''), '');
});

test('checkRegister asks for each thing in turn', () => {
  const ok = { email: 'mom@family.test', pass: 'secret12', pass2: 'secret12', pin: '4321', pin2: '4321', consent: true };
  assert.equal(A.checkRegister(ok), '');
  assert.equal(A.checkRegister({ ...ok, email: 'mom@' }), 'Type a real email address.');
  assert.equal(A.checkRegister({ ...ok, pass: 'short', pass2: 'short' }), 'The password needs at least 8 characters.');
  assert.equal(A.checkRegister({ ...ok, pass2: 'secret13' }), 'The two passwords are not the same.');
  assert.equal(A.checkRegister({ ...ok, pin: '12', pin2: '12' }), 'The parent PIN must be 4 digits.');
  assert.equal(A.checkRegister({ ...ok, pin: 'abcd', pin2: 'abcd' }), 'The parent PIN must be 4 digits.');
  assert.equal(A.checkRegister({ ...ok, pin2: '4322' }), 'The two PINs are not the same.');
  assert.equal(A.checkRegister({ ...ok, consent: false }), 'Tick the box to agree to the privacy notice.');
});

test('checkDelete wants the password and the word DELETE', () => {
  assert.equal(A.checkDelete('', 'DELETE'), 'Type the password.');
  assert.equal(A.checkDelete('secret12', 'delete'), 'Type DELETE to confirm.');
  assert.equal(A.checkDelete('secret12', ''), 'Type DELETE to confirm.');
  assert.equal(A.checkDelete('secret12', ' DELETE '), '');
});

test('the consent version is 1', () => {
  assert.equal(A.CONSENT_VERSION, 1);
});
