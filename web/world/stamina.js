/* Her heart while she runs: it fills while she sprints and calms while she walks or stands. At 1 she is tired and
   must walk until it is at or below CALM. Runs in free roaming and in the playground games. No DOM, no Three.js. */
(function (root) {
  'use strict';

  var RISE = 1 / 8, WALK = 1 / 6, STILL = 1 / 3, CALM = 0.3, BEAT_FROM = 0.66;

  function clamp(v) { return Math.max(0, Math.min(1, v)); }

  // input = { running, still, paused }: neither running nor still means walking.
  function create() {
    var heart = 0, tired = false;
    function state() { return { heart: heart, tired: tired }; }
    function tick(dt, input) {
      if (input.paused) {
        heart = 0;
        tired = false;
        return state();
      }
      if (!(dt > 0)) return state();
      heart = clamp(heart + (input.running ? RISE : input.still ? -STILL : -WALK) * dt);
      if (heart >= 1) tired = true;
      else if (tired && heart <= CALM) tired = false;
      return state();
    }
    return { tick: tick, state: state };
  }

  function pulseSeconds(heart) { return 1.2 - 0.85 * clamp(heart); }

  // null until the last third of the heart: the beat is a warning, not constant noise.
  function beatGap(heart) {
    if (heart <= BEAT_FROM) return null;
    return 0.9 - 0.55 * ((clamp(heart) - BEAT_FROM) / (1 - BEAT_FROM));
  }

  // s = { sprinting, moving, tired }: the next sprint value for a tap on the run button, or null to ignore the tap.
  function sprintTap(s) {
    if (s.sprinting) return false;
    return s.tired ? null : true;
  }

  var exported = { create: create, pulseSeconds: pulseSeconds, beatGap: beatGap, sprintTap: sprintTap, CALM: CALM, BEAT_FROM: BEAT_FROM };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.Stamina = exported;
})(this);
