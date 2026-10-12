const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rules = fs.readFileSync(path.join(__dirname, '..', 'firebase', 'firestore.rules'), 'utf8');

test('the owner may read every family, and only read', () => {
  assert.match(rules, /function isOwner\(\)/);
  const lines = rules.split('\n').filter((l) => l.includes('isOwner()') && l.includes('allow'));
  assert.ok(lines.length >= 2, 'owner clause missing on the family doc or its subcollections');
  for (const l of lines) assert.match(l.trim(), /^allow read:/, 'the owner must not get write access: ' + l);
});

test('the owner is one UID with one email', () => {
  assert.match(rules, /request\.auth\.uid == '[A-Za-z0-9]{20,}'/);
  assert.match(rules, /request\.auth\.token\.email == 'aspectjump\.java@gmail\.com'/);
});

test('a family reaches only its own paths, and nothing is a catch-all', () => {
  assert.match(rules, /function isFamily\(uid\) \{\s*return request\.auth != null && request\.auth\.uid == uid;/);
  assert.ok(!rules.includes('{document=**}'), 'no recursive wildcard: list every path');
  for (const p of ['match /settings/pin', 'match /learners/{lid}', 'match /state/{key}', 'match /counters/{key}', 'match /history/{key}']) {
    assert.ok(rules.includes(p), 'missing ' + p);
  }
  const writes = rules.split('\n').filter((l) => /allow (create|update)/.test(l));
  assert.ok(writes.length >= 6);
  for (const l of writes) {
    assert.ok(l.includes('isFamily(uid)') && !l.includes('isOwner()'), 'only the family writes: ' + l);
  }
});
