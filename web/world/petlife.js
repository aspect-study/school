/* Her pet's mood, with no Three.js: it sits 3 s after she stops and sleeps after 10 s, wakes with a stretch when she
   moves, hops after a pat and munches a treat (free, at most one every 2 s). What it does that makes a sound goes in
   heard (companion.js plays it), and now and then it chatters on its own. It does one action at a time: a trick, a
   toy held at the stall, fetch (throw → run → pick → back → drop), play with her sister's pet or watching her do a
   move, each followed by a 1 s rest; a celebration starts 1.5 s after she is back. Nothing is saved; it never gets
   hungry. */
(function (root) {
  'use strict';

  var SIT = 3, SLEEP = 10, FAR = 12, TREAT_WAIT = 2, SISTER = 6, HAPPY = 1.2, MUNCH = 1.6, STRETCH = 0.6;
  var REST = 1, HOLD = 2, PICK = 0.5, DIG = 1.2, DROP = 0.4, STUCK = 4, PLAY = 6, PLAY_WAIT = 60, PLAY_NEAR = 6;
  var CHEER_WAIT = 1.5, CHEER_STAY = 1.6;
  var CHAT_MIN = 45, CHAT_MAX = 75, CHAT_NEAR = 6;

  // rand: Math.random unless a test passes its own, so chatter times are known.
  function create(rand) {
    rand = rand || Math.random;
    return { t: 0, still: 0, happy: 0, munch: 0, stretch: 0, treatAt: -Infinity, action: null, restUntil: 0, playNext: 0, plan: null, cheer: null, fired: null,
      heard: [], rand: rand, chatAt: CHAT_MIN + rand() * (CHAT_MAX - CHAT_MIN) };
  }

  // What the pet did that makes a sound ({ name, info }); companion.js empties the list every frame.
  function hear(s, name, info) {
    s.heard.push({ name: name, info: info || null });
    return true;
  }

  function busy(s) { return !!s.action || s.t < s.restUntil; }
  function begin(s, a, force) {
    if (!force && busy(s)) return false;
    a.t = 0;
    s.action = a;
    s.still = 0;
    return true;
  }
  function startTrick(s, id, len, force) { return begin(s, { kind: 'trick', id: id, len: len }, force) && hear(s, 'trick-start', { id: id }); }
  function startHold(s, toy, force) { return begin(s, { kind: 'hold', toy: toy, len: HOLD }, force) && hear(s, 'catch'); }
  // toy: a Pets.TOYS entry.
  function startFetch(s, toy) { return begin(s, { kind: 'fetch', toy: toy, stage: 'throw' }) && hear(s, 'throw'); }
  function canPlay(s, d) { return !busy(s) && !s.plan && s.t >= s.playNext && d !== null && d !== undefined && d <= PLAY_NEAR; }
  function startPlay(s) { return begin(s, { kind: 'play', len: PLAY }) && hear(s, 'play-start'); }
  // She does a move (moves.js); the pet watches her for its length.
  function startWatch(s, len) { return begin(s, { kind: 'watch', len: len }); }

  // Only play that ran its 6 s waits a minute; play cut short (she walked off, a teleport) may start again.
  function end(s, happy) {
    var a = s.action;
    if (happy && a && a.kind === 'play') s.playNext = s.t + PLAY_WAIT;
    if (happy && a && a.kind === 'trick') hear(s, 'trick-land', { id: a.id });
    s.action = null;
    s.restUntil = s.t + REST;
    if (happy) s.happy = HAPPY;
  }
  function cancel(s) { end(s, false); }
  function next(a, stage) {
    a.stage = stage;
    a.t = 0;
  }
  // The pet reached the toy (on the ground, or a frisbee still in the air) or got back to her.
  function arrive(s) {
    var a = s.action;
    if (!a || a.kind !== 'fetch') return;
    if (a.stage === 'throw' || a.stage === 'run') {
      a.leap = a.stage === 'throw';
      next(a, 'pick');
      if (a.leap) hear(s, 'catch');
      else if (a.toy.dig) hear(s, 'dig');
    } else if (a.stage === 'back') {
      next(a, 'drop');
      hear(s, 'drop');
    }
  }

  // plan = { trick (null: a pat), len, emoji } from cheer.js.
  function celebrate(s, plan) { s.plan = { at: s.t + CHEER_WAIT, p: plan }; }

  // her = { moving, near (the pet is close to her), quiet (a panel, talk, stall or move is open) }
  function tick(s, dt, her) {
    s.t += dt;
    s.happy = Math.max(0, s.happy - dt);
    s.munch = Math.max(0, s.munch - dt);
    s.stretch = Math.max(0, s.stretch - dt);
    if (s.cheer) {
      s.cheer.left -= dt;
      if (s.cheer.left <= 0) s.cheer = null;
    }
    if (her.moving) {
      if (s.still >= SLEEP) s.stretch = STRETCH;
      s.still = 0;
    } else s.still += dt;
    var a = s.action;
    if (a) {
      a.t += dt;
      s.still = 0;
      if (a.kind === 'fetch') {
        if (a.stage === 'throw' && a.t >= a.toy.flight) {
          next(a, 'run');
          hear(s, 'land');
        }
        else if (a.stage === 'pick' && a.t >= (a.toy.dig ? DIG : PICK)) next(a, 'back');
        else if (a.stage === 'drop' && a.t >= DROP) end(s, true);
        else if ((a.stage === 'run' || a.stage === 'back') && a.t >= STUCK) a.stuck = true;
      } else if (a.t >= a.len) end(s, true);
    }
    if (s.plan && s.t >= s.plan.at && !a) {
      var p = s.plan.p;
      s.plan = null;
      hear(s, 'celebrate');
      if (p.trick) startTrick(s, p.trick, p.len, true);
      else cheerUp(s);
      s.cheer = { emoji: p.emoji, left: (p.trick ? p.len : 0) + CHEER_STAY };
      s.fired = p;
    }
    if (s.t >= s.chatAt && !busy(s) && !s.plan && s.still < SLEEP && !her.quiet && her.near && !s.cheer) {
      hear(s, 'chatter');
      s.chatAt = s.t + CHAT_MIN + s.rand() * (CHAT_MAX - CHAT_MIN);
    }
    return s;
  }

  function cheerUp(s) {
    s.happy = HAPPY;
    s.still = 0;
  }
  function pat(s) {
    cheerUp(s);
    hear(s, 'pat');
  }

  function treat(s) {
    if (s.action) return false;
    if (s.t - s.treatAt < TREAT_WAIT) return false;
    s.treatAt = s.t;
    s.munch = MUNCH;
    s.still = 0;
    return hear(s, 'treat');
  }

  // moved: the pet itself moved this frame.
  function mood(s, moved) {
    var a = s.action;
    if (a && a.kind === 'trick') return 'trick';
    if (a && a.kind === 'hold') return 'happy';
    if (a && a.kind === 'fetch' && !moved) return a.stage === 'pick' && a.toy.dig ? 'munch' : 'idle';
    if (a) return moved ? 'walk' : 'idle';
    if (s.happy > 0) return 'happy';
    if (s.munch > 0) return 'munch';
    if (s.stretch > 0) return 'stretch';
    if (s.still >= SLEEP) return 'sleep';
    if (s.still >= SIT) return 'sit';
    return moved ? 'walk' : 'idle';
  }

  // sisterD: how far her sister stands, or null when she is not here.
  function bubble(s, sisterD) {
    if (s.cheer) return s.cheer.emoji;
    if (s.action) return s.action.kind === 'play' ? '💖' : '';
    if (s.still >= SLEEP && s.happy <= 0 && s.munch <= 0) return '💤';
    if (s.munch > 0) return '🍪';
    if (s.happy > 0) return '💖';
    return sisterD !== null && sisterD !== undefined && sisterD <= SISTER ? '💖' : '';
  }

  function far(d) { return d >= FAR; }

  // Where a toy thrown from (x, z) facing `face` lands: up to range units ahead, short of the first blocked spot; her
  // own spot when even 2 units ahead is blocked. blocked(x, z) is true for a wall or a building.
  function landing(x, z, face, range, blocked) {
    var out = null;
    for (var d = 2; d <= range; d++) {
      var lx = x + Math.sin(face) * d, lz = z + Math.cos(face) * d;
      if (blocked(lx, lz)) break;
      out = { x: lx, z: lz };
    }
    return out || { x: x, z: z };
  }

  var exported = {
    CHAT_NEAR: CHAT_NEAR, CHAT_MIN: CHAT_MIN, CHAT_MAX: CHAT_MAX,
    SIT: SIT, SLEEP: SLEEP, FAR: FAR, TREAT_WAIT: TREAT_WAIT, SISTER: SISTER, PLAY_NEAR: PLAY_NEAR,
    create: create, tick: tick, pat: pat, treat: treat, mood: mood, bubble: bubble, far: far,
    busy: busy, startTrick: startTrick, startHold: startHold, startFetch: startFetch, arrive: arrive, cancel: cancel,
    canPlay: canPlay, startPlay: startPlay, startWatch: startWatch, celebrate: celebrate, landing: landing
  };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.PetLife = exported;
})(this);
