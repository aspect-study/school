const { before, after, beforeEach, test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, setDoc, getDoc, getDocs, deleteDoc, collection, serverTimestamp } = require('firebase/firestore');

const OWNER_UID = '8DAk3YrIYTUEtP52VLWdC29ykb23';
const OWNER_EMAIL = 'aspectjump.java@gmail.com';
const PROFILE_CAP = 4000;
const STATE_CAP = 500000;
const HISTORY_CAP = 100000;

let env;
before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-school',
    firestore: { rules: fs.readFileSync(path.join(__dirname, '..', '..', 'firebase', 'firestore.rules'), 'utf8') },
  });
});
after(async () => { await env.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });

const family = (uid) => env.authenticatedContext(uid, { email: uid + '@family.test' }).firestore();
const stranger = () => env.unauthenticatedContext().firestore();
const owner = () => env.authenticatedContext(OWNER_UID, { email: OWNER_EMAIL }).firestore();
const seed = (fn) => env.withSecurityRulesDisabled((ctx) => fn(ctx.firestore()));
const stamp = serverTimestamp;

const familyRef = (db, uid) => doc(db, 'families', uid);
const learnerRef = (db, uid) => doc(db, 'families', uid, 'learners', 'l1');
const stateRef = (db, uid) => doc(db, 'families', uid, 'learners', 'l1', 'state', 'wallet_v1');
const counterRef = (db, uid) => doc(db, 'families', uid, 'learners', 'l1', 'counters', 'coins');
const historyRef = (db, uid) => doc(db, 'families', uid, 'learners', 'l1', 'history', 'h1');
const pinRef = (db, uid) => doc(db, 'families', uid, 'settings', 'pin');

test('a family writes every document shape the app writes', async () => {
  const db = family('a');
  await assertSucceeds(setDoc(familyRef(db, 'a'), { email: 'a@x.y', createdAt: 1700000000000, lastSeenAt: stamp(), updatedAt: stamp(), consent: { at: 1700000000000, version: 1 } }, { merge: true }));
  await assertSucceeds(setDoc(familyRef(db, 'a'), { lastSeenAt: stamp(), updatedAt: stamp() }, { merge: true }));
  await assertSucceeds(setDoc(familyRef(db, 'a'), { consent: { at: 1, version: 1 }, lastSeenAt: stamp(), updatedAt: stamp() }, { merge: true }));
  await assertSucceeds(setDoc(learnerRef(db, 'a'), { json: '{"name":"Ana"}', updatedAt: stamp() }));
  await assertSucceeds(setDoc(stateRef(db, 'a'), { json: '{}', updatedAt: stamp() }));
  await assertSucceeds(setDoc(counterRef(db, 'a'), { total: 12, updatedAt: stamp() }));
  await assertSucceeds(setDoc(historyRef(db, 'a'), { json: '{}', updatedAt: stamp() }));
  await assertSucceeds(setDoc(historyRef(db, 'a'), { deleted: true, updatedAt: stamp() }));
  await assertSucceeds(setDoc(pinRef(db, 'a'), { pin: '4321', at: 1700000000000, updatedAt: stamp() }));
});

test('a family reads and deletes its own documents', async () => {
  const db = family('a');
  await assertSucceeds(setDoc(learnerRef(db, 'a'), { json: '{}', updatedAt: stamp() }));
  await assertSucceeds(getDoc(learnerRef(db, 'a')));
  await assertSucceeds(getDocs(collection(db, 'families', 'a', 'learners')));
  await assertSucceeds(deleteDoc(learnerRef(db, 'a')));
  await assertSucceeds(deleteDoc(pinRef(db, 'a')));
  await assertSucceeds(deleteDoc(familyRef(db, 'a')));
});

test('one family cannot read, write or delete another family', async () => {
  await seed(async (db) => {
    await setDoc(learnerRef(db, 'a'), { json: '{}', updatedAt: new Date() });
    await setDoc(pinRef(db, 'a'), { pin: '1111', at: 1, updatedAt: new Date() });
  });
  const b = family('b');
  await assertFails(getDoc(learnerRef(b, 'a')));
  await assertFails(getDocs(collection(b, 'families', 'a', 'learners')));
  await assertFails(getDoc(pinRef(b, 'a')));
  await assertFails(setDoc(learnerRef(b, 'a'), { json: '{}', updatedAt: stamp() }));
  await assertFails(setDoc(stateRef(b, 'a'), { json: '{}', updatedAt: stamp() }));
  await assertFails(deleteDoc(learnerRef(b, 'a')));
  await assertFails(deleteDoc(pinRef(b, 'a')));
});

test('a signed-out visitor can do nothing', async () => {
  await seed((db) => setDoc(learnerRef(db, 'a'), { json: '{}', updatedAt: new Date() }));
  const db = stranger();
  await assertFails(getDoc(learnerRef(db, 'a')));
  await assertFails(getDocs(collection(db, 'families')));
  await assertFails(setDoc(learnerRef(db, 'a'), { json: '{}', updatedAt: stamp() }));
  await assertFails(setDoc(familyRef(db, 'a'), { updatedAt: stamp() }, { merge: true }));
});

test('paths the app does not use are denied', async () => {
  const db = family('a');
  await assertFails(setDoc(doc(db, 'families', 'a', 'notes', 'n1'), { json: '{}', updatedAt: stamp() }));
  await assertFails(setDoc(doc(db, 'families', 'a', 'settings', 'other'), { pin: '1234', at: 1, updatedAt: stamp() }));
  await assertFails(setDoc(doc(db, 'families', 'a', 'learners', 'l1', 'extras', 'x'), { json: '{}', updatedAt: stamp() }));
  await assertFails(setDoc(doc(db, 'elsewhere', 'a'), { json: '{}', updatedAt: stamp() }));
});

test('extra fields, wrong types and client clocks are denied', async () => {
  const db = family('a');
  await assertFails(setDoc(stateRef(db, 'a'), { json: '{}', updatedAt: stamp(), admin: true }));
  await assertFails(setDoc(stateRef(db, 'a'), { json: 5, updatedAt: stamp() }));
  await assertFails(setDoc(stateRef(db, 'a'), { json: '{}' }));
  await assertFails(setDoc(stateRef(db, 'a'), { json: '{}', updatedAt: new Date() }));
  await assertFails(setDoc(counterRef(db, 'a'), { total: '12', updatedAt: stamp() }));
  await assertFails(setDoc(historyRef(db, 'a'), { json: '{}', deleted: true, updatedAt: stamp() }));
  await assertFails(setDoc(historyRef(db, 'a'), { deleted: false, updatedAt: stamp() }));
  await assertFails(setDoc(familyRef(db, 'a'), { role: 'owner', updatedAt: stamp() }, { merge: true }));
  await assertFails(setDoc(familyRef(db, 'a'), { email: 5, updatedAt: stamp() }, { merge: true }));
});

test('oversized documents are denied', async () => {
  const db = family('a');
  await assertFails(setDoc(learnerRef(db, 'a'), { json: 'x'.repeat(PROFILE_CAP + 1), updatedAt: stamp() }));
  await assertFails(setDoc(stateRef(db, 'a'), { json: 'x'.repeat(STATE_CAP + 1), updatedAt: stamp() }));
  await assertFails(setDoc(historyRef(db, 'a'), { json: 'x'.repeat(HISTORY_CAP + 1), updatedAt: stamp() }));
  await assertSucceeds(setDoc(historyRef(db, 'a'), { json: 'x'.repeat(HISTORY_CAP), updatedAt: stamp() }));
});

test('the parent PIN document must be four digits', async () => {
  const db = family('a');
  await assertFails(setDoc(pinRef(db, 'a'), { pin: '123', at: 1, updatedAt: stamp() }));
  await assertFails(setDoc(pinRef(db, 'a'), { pin: 'abcd', at: 1, updatedAt: stamp() }));
  await assertFails(setDoc(pinRef(db, 'a'), { pin: '12345', at: 1, updatedAt: stamp() }));
  await assertFails(setDoc(pinRef(db, 'a'), { pin: '1234', at: '1', updatedAt: stamp() }));
});

test('the consent record must have the right shape', async () => {
  const db = family('a');
  await assertFails(setDoc(familyRef(db, 'a'), { consent: { at: 'now', version: 1 }, updatedAt: stamp() }, { merge: true }));
  await assertFails(setDoc(familyRef(db, 'a'), { consent: { at: 1, version: 1, extra: 1 }, updatedAt: stamp() }, { merge: true }));
  await assertFails(setDoc(familyRef(db, 'a'), { consent: { at: 1 }, updatedAt: stamp() }, { merge: true }));
});

test('the owner reads every family and cannot write', async () => {
  await seed(async (db) => {
    await setDoc(familyRef(db, 'a'), { email: 'a@x.y', updatedAt: new Date() });
    await setDoc(learnerRef(db, 'a'), { json: '{}', updatedAt: new Date() });
    await setDoc(historyRef(db, 'a'), { json: '{}', updatedAt: new Date() });
  });
  const db = owner();
  await assertSucceeds(getDocs(collection(db, 'families')));
  await assertSucceeds(getDoc(learnerRef(db, 'a')));
  await assertSucceeds(getDoc(historyRef(db, 'a')));
  await assertFails(setDoc(learnerRef(db, 'a'), { json: '{}', updatedAt: stamp() }));
  await assertFails(deleteDoc(learnerRef(db, 'a')));
  await assertFails(setDoc(familyRef(db, 'a'), { updatedAt: stamp() }, { merge: true }));
});

test('the owner UID with a different email gets nothing', async () => {
  await seed((db) => setDoc(learnerRef(db, 'a'), { json: '{}', updatedAt: new Date() }));
  const db = env.authenticatedContext(OWNER_UID, { email: 'someone@else.test' }).firestore();
  await assertFails(getDoc(learnerRef(db, 'a')));
});
