const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile } = require('./paths.js');
const PL = require(worldFile('petlife.js'));

const still = { moving: false }, walking = { moving: true };
function run(s, seconds, her, step = 0.1) {
  for (let t = 0; t < seconds - 1e-9; t += step) PL.tick(s, step, her);
  return s;
}

test('she walks: the pet walks; she stops: it stands, sits after 3 s and sleeps after 10 s', () => {
  const s = PL.create();
  PL.tick(s, 0.1, walking);
  assert.equal(PL.mood(s, true), 'walk');
  assert.equal(PL.mood(s, false), 'idle', 'arrived beside her');
  run(s, 2.8, still);
  assert.equal(PL.mood(s, false), 'idle');
  run(s, 0.3, still);
  assert.equal(PL.mood(s, false), 'sit');
  assert.equal(PL.bubble(s, null), '');
  run(s, 7, still);
  assert.equal(PL.mood(s, false), 'sleep');
  assert.equal(PL.bubble(s, null), '💤');
});

test('she moves again: it wakes with a stretch, then follows', () => {
  const s = run(PL.create(), 11, still);
  PL.tick(s, 0.1, walking);
  assert.equal(PL.mood(s, true), 'stretch');
  run(s, 0.7, walking);
  assert.equal(PL.mood(s, true), 'walk');
});

test('a pat makes it hop with a heart and wakes it', () => {
  const s = run(PL.create(), 11, still);
  PL.pat(s);
  PL.tick(s, 0.1, still);
  assert.equal(PL.mood(s, false), 'happy');
  assert.equal(PL.bubble(s, null), '💖');
  run(s, 1.2, still);
  assert.equal(PL.mood(s, false), 'idle', 'awake again, the sleep timer starts over');
});

test('a treat makes it munch; another treat within 2 s does nothing', () => {
  const s = PL.create();
  assert.equal(PL.treat(s), true);
  assert.equal(PL.treat(s), false);
  PL.tick(s, 0.1, still);
  assert.equal(PL.mood(s, false), 'munch');
  assert.equal(PL.bubble(s, null), '🍪');
  run(s, 2, still);
  assert.equal(PL.treat(s), true, 'free and never runs out');
});

test('hearts near her sister; sleeping and munching show first', () => {
  const s = PL.create();
  PL.tick(s, 0.1, still);
  assert.equal(PL.bubble(s, 5), '💖');
  assert.equal(PL.bubble(s, 7), '');
  run(s, 11, still);
  assert.equal(PL.bubble(s, 5), '💤');
});

test('12 units or more from her, it pops back', () => {
  assert.equal(PL.far(11.9), false);
  assert.equal(PL.far(12), true);
  assert.deepEqual([PL.SIT, PL.SLEEP, PL.FAR, PL.TREAT_WAIT, PL.SISTER], [3, 10, 12, 2, 6]);
});

const Pets = require(worldFile('pets.js'));
const ball = Pets.find('toy-ball'), bone = Pets.find('toy-bone'), frisbee = Pets.find('toy-frisbee');

test('a trick runs for its length, then a heart, then 1 s before the next action', () => {
  const s = PL.create();
  assert.equal(PL.startTrick(s, 'trick-spin', 1.2), true);
  assert.equal(PL.startTrick(s, 'trick-jump', 1.2), false, 'one action at a time');
  PL.tick(s, 0.1, still);
  assert.equal(PL.mood(s, false), 'trick');
  run(s, 1.2, still);
  assert.equal(s.action, null);
  assert.equal(PL.mood(s, false), 'happy');
  assert.equal(PL.bubble(s, null), '💖');
  assert.equal(PL.busy(s), true, 'a short rest');
  assert.equal(PL.startTrick(s, 'trick-spin', 1.2), false);
  run(s, 1.1, still);
  assert.equal(PL.startTrick(s, 'trick-spin', 1.2), true);
});

test('force skips the rest and replaces what it was doing (the stall, a celebration)', () => {
  const s = PL.create();
  PL.startTrick(s, 'trick-spin', 1.2);
  assert.equal(PL.startHold(s, ball, true), true);
  assert.equal(s.action.kind, 'hold');
  PL.tick(s, 0.1, still);
  assert.equal(PL.mood(s, false), 'happy', 'a happy hop with the toy');
  run(s, 2, still);
  assert.equal(s.action, null);
});

test('fetch: throw, run, pick, back, drop, then a heart', () => {
  const s = PL.create();
  assert.equal(PL.startFetch(s, ball), true);
  assert.equal(s.action.stage, 'throw');
  run(s, 0.7, still);
  assert.equal(s.action.stage, 'run');
  assert.equal(PL.mood(s, true), 'walk');
  PL.arrive(s);
  assert.equal(s.action.stage, 'pick');
  run(s, 0.6, still);
  assert.equal(s.action.stage, 'back');
  PL.arrive(s);
  assert.equal(s.action.stage, 'drop');
  run(s, 0.5, still);
  assert.equal(s.action, null);
  assert.equal(PL.bubble(s, null), '💖');
});

test('the bone is dug up first; a frisbee reached in the air is a leap; 4 s without arriving is stuck', () => {
  const s = PL.create();
  PL.startFetch(s, bone);
  run(s, 0.7, still);
  PL.arrive(s);
  run(s, 0.6, still);
  assert.equal(s.action.stage, 'pick', 'still digging');
  assert.equal(PL.mood(s, false), 'munch');
  run(s, 0.7, still);
  assert.equal(s.action.stage, 'back');

  const f = PL.create();
  PL.startFetch(f, frisbee);
  PL.tick(f, 0.3, still);
  PL.arrive(f);
  assert.equal(f.action.stage, 'pick');
  assert.equal(f.action.leap, true);

  const k = PL.create();
  PL.startFetch(k, ball);
  run(k, 0.7, still);
  assert.equal(k.action.stuck, undefined);
  run(k, 4.1, still);
  assert.equal(k.action.stuck, true);
});

test('cancel ends an action with no heart and a 1 s rest; an action keeps the pet awake', () => {
  const s = run(PL.create(), 11, still);
  assert.equal(PL.mood(s, false), 'sleep');
  PL.startTrick(s, 'trick-bow', 1.2);
  PL.tick(s, 0.1, still);
  assert.equal(PL.mood(s, false), 'trick');
  assert.equal(PL.bubble(s, null), '');
  PL.cancel(s);
  assert.equal(s.action, null);
  assert.equal(PL.mood(s, false), 'idle');
  assert.equal(PL.busy(s), true);
});

test('play with her sister\'s pet: within 6, for 6 s, then not again for 60 s', () => {
  const s = PL.create();
  assert.equal(PL.canPlay(s, 7), false);
  assert.equal(PL.canPlay(s, null), false);
  assert.equal(PL.canPlay(s, 6), true);
  assert.equal(PL.startPlay(s), true);
  PL.tick(s, 0.1, still);
  assert.equal(PL.mood(s, true), 'walk');
  assert.equal(PL.bubble(s, null), '💖', 'hearts while they play');
  run(s, 6, still);
  assert.equal(s.action, null);
  assert.equal(PL.mood(s, false), 'happy');
  run(s, 2, still);
  assert.equal(PL.canPlay(s, 3), false, 'once a minute');
  run(s, 58.5, still);
  assert.equal(PL.canPlay(s, 3), true);

  const c = PL.create();
  PL.startPlay(c);
  PL.cancel(c);
  run(c, 1.1, still);
  assert.equal(PL.canPlay(c, 3), true, 'play cut short may start again after the rest');
});

test('celebrate waits 1.5 s, then does its trick with its bubble; a pat when there is no trick', () => {
  const s = PL.create();
  PL.startTrick(s, 'trick-spin', 1.2);
  PL.cancel(s);
  PL.celebrate(s, { trick: 'trick-twirl', len: 1.2, emoji: '⚔️' });
  run(s, 1.4, still);
  assert.equal(s.action, null);
  assert.equal(PL.bubble(s, null), '');
  run(s, 0.2, still);
  assert.deepEqual([s.action.kind, s.action.id], ['trick', 'trick-twirl'], 'the rest does not hold it back');
  assert.equal(PL.bubble(s, null), '⚔️');
  assert.equal(s.fired.emoji, '⚔️');
  run(s, 2, still);
  assert.equal(PL.bubble(s, null), '⚔️', 'the bubble stays a moment after the trick');
  run(s, 1, still);
  assert.equal(PL.bubble(s, null), '');

  const h = PL.create();
  PL.celebrate(h, { trick: null, len: 0, emoji: '💖' });
  run(h, 1.6, still);
  assert.equal(PL.mood(h, false), 'happy');
  assert.equal(PL.bubble(h, null), '💖');
});

test('landing: the throw\'s range ahead, short of the first wall, at her feet when blocked right away', () => {
  const open = () => false;
  const a = PL.landing(0, 0, 0, 8, open);
  assert.deepEqual([a.x, a.z], [0, 8]);
  const b = PL.landing(0, 0, Math.PI / 2, 6, open);
  assert.ok(Math.abs(b.x - 6) < 1e-9 && Math.abs(b.z) < 1e-9);
  assert.deepEqual(PL.landing(0, 0, 0, 12, (x, z) => z >= 5), { x: 0, z: 4 });
  assert.deepEqual(PL.landing(0, 0, 0, 12, (x, z) => z >= 9 && z < 11), { x: 0, z: 8 }, 'never over a wall');
  assert.deepEqual(PL.landing(3, 4, 0, 8, () => true), { x: 3, z: 4 });
});

test('a celebration due while fetch ends waits one frame, so the runtime can clean up', () => {
  const s = PL.create();
  PL.startFetch(s, ball);
  PL.celebrate(s, { trick: 'trick-jump', len: 1.2, emoji: '⭐' });
  run(s, 0.7, still);
  PL.arrive(s);
  run(s, 0.6, still);
  PL.arrive(s);
  for (let i = 0; i < 20 && s.action; i++) PL.tick(s, 0.1, still);
  assert.equal(s.action, null, 'the frame the fetch ended has no action');
  PL.tick(s, 0.1, still);
  assert.equal(s.action.id, 'trick-jump');
});

test('a treat during a trick is refused, so it is not used up unseen', () => {
  const s = PL.create();
  PL.startTrick(s, 'trick-spin', 1.2);
  PL.tick(s, 0.1, still);
  assert.equal(PL.treat(s), false);
  run(s, 1.2, still);
  assert.equal(s.action, null);
  assert.equal(PL.treat(s), true);
});

test('auto play waits while a celebration is waiting', () => {
  const s = PL.create();
  PL.celebrate(s, { trick: null, len: 0, emoji: '💖' });
  assert.equal(PL.canPlay(s, 3), false);
  run(s, 1.6, still);
  assert.equal(PL.canPlay(s, 3), true);
});

test('watch: the pet watches her move for its length, one action at a time, then rests', () => {
  const s = PL.create();
  assert.equal(PL.startWatch(s, 2), true);
  assert.equal(s.action.kind, 'watch');
  assert.equal(PL.startTrick(s, 'trick-spin', 1.2), false, 'busy while watching');
  assert.equal(PL.startWatch(s, 2), false);
  PL.tick(s, 2.1, { moving: false });
  assert.equal(s.action, null);
  assert.equal(PL.busy(s), true, '1 s rest after');
  assert.equal(PL.mood(s, false), 'happy', 'happy after watching');
  const t = PL.create();
  PL.startTrick(t, 'trick-spin', 1.2);
  assert.equal(PL.startWatch(t, 2), false, 'a busy pet carries on');
});

const names = (s) => s.heard.splice(0).map((h) => h.name);

test('fetch reports its sounds once each, in order', () => {
  const b = PL.create();
  PL.startFetch(b, ball);
  run(b, 0.7, still);
  PL.arrive(b);
  run(b, 0.6, still);
  PL.arrive(b);
  run(b, 0.5, still);
  assert.deepEqual(names(b), ['throw', 'land', 'drop']);

  const d = PL.create();
  PL.startFetch(d, bone);
  run(d, 0.7, still);
  PL.arrive(d);
  run(d, 1.3, still);
  PL.arrive(d);
  run(d, 0.5, still);
  assert.deepEqual(names(d), ['throw', 'land', 'dig', 'drop']);

  const f = PL.create();
  PL.startFetch(f, frisbee);
  PL.tick(f, 0.3, still);
  PL.arrive(f);
  run(f, 0.6, still);
  PL.arrive(f);
  run(f, 0.5, still);
  assert.deepEqual(names(f), ['throw', 'catch', 'drop'], 'a frisbee caught in the air pops, it never lands');
});

test('pat, an accepted treat, a trick that lands, a held toy and play each report once', () => {
  const s = PL.create();
  PL.pat(s);
  assert.equal(PL.treat(s), true);
  assert.equal(PL.treat(s), false);
  assert.deepEqual(names(s), ['pat', 'treat'], 'a refused treat makes no sound');
  PL.startTrick(s, 'trick-spin', 1);
  run(s, 1.1, still);
  assert.deepEqual(s.heard.splice(0), [{ name: 'trick-start', info: { id: 'trick-spin' } }, { name: 'trick-land', info: { id: 'trick-spin' } }]);
  run(s, 1.1, still);
  PL.startTrick(s, 'trick-spin', 1);
  PL.cancel(s);
  assert.deepEqual(names(s), ['trick-start'], 'a trick cut short does not land');
  PL.startHold(s, ball, true);
  assert.deepEqual(names(s), ['catch'], 'a toy hops into its mouth at the stall');
  const p = PL.create();
  PL.startPlay(p);
  assert.deepEqual(names(p), ['play-start']);
});

test('a celebration reports once, then its trick; a hello is one voice, not two', () => {
  const s = PL.create();
  PL.celebrate(s, { trick: 'trick-jump', len: 1, emoji: '⭐' });
  run(s, 1.6, still);
  assert.deepEqual(names(s), ['celebrate', 'trick-start']);
  const h = PL.create();
  PL.celebrate(h, { trick: null, len: 0, emoji: '💖' });
  run(h, 1.6, still);
  assert.deepEqual(names(h), ['celebrate']);
  assert.ok(h.happy > 0, 'the hello still makes it happy');
});

test('chatter: on its own at most every 45-75 s, only when near, awake, free and not quiet', () => {
  const near = { moving: true, near: true };
  const s = PL.create(() => 0);
  run(s, 44.9, near);
  assert.deepEqual(names(s), []);
  run(s, 0.3, near);
  assert.deepEqual(names(s), ['chatter']);
  run(s, 44.5, near);
  assert.deepEqual(names(s), [], 'the next one waits another 45 s');
  run(s, 0.6, near);
  assert.deepEqual(names(s), ['chatter']);

  const asleep = PL.create(() => 0);
  run(asleep, 46, { moving: false, near: true });
  assert.deepEqual(names(asleep), [], 'a sleeping pet is quiet');
  const quiet = PL.create(() => 0);
  run(quiet, 46, { moving: true, near: true, quiet: true });
  assert.deepEqual(names(quiet), [], 'not while a panel, talk or move is open');
  const far = PL.create(() => 0);
  run(far, 46, { moving: true, near: false });
  assert.deepEqual(names(far), [], 'not when it is far from her');
  const busy = PL.create(() => 0);
  run(busy, 44, near);
  PL.startWatch(busy, 10);
  run(busy, 2, near);
  assert.deepEqual(names(busy), [], 'not during an action');
  run(busy, 9.5, near);
  assert.deepEqual(names(busy), ['chatter'], 'it waits until the pet is free, then speaks');

  const late = PL.create(() => 1);
  run(late, 74.9, near);
  assert.deepEqual(names(late), []);
  run(late, 0.2, near);
  assert.deepEqual(names(late), ['chatter']);
});
