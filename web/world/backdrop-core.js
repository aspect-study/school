/* The start page backdrop's pure helpers: which town, whether to draw at all, where the camera and the pets go, and
   when frames are too slow to keep going. Used by backdrop.js; kept apart so node --test can run it. */
(function (root) {
  'use strict';
  var node = typeof module !== 'undefined' && module.exports;

  var RADIUS = 22, HEIGHT = 17, ORBIT_SPEED = 0.12, LOOK_Y = 3;
  var PET_IDS = ['chick', 'kitten', 'puppy', 'kitten'];
  var PET_SPEED = 5, PET_STOP = 0.3, PET_JUMP = 30, PET_BEHIND = 2.4, PET_SIDE = 1.3;
  var SLOW_FRAME = 1 / 15, SLOW_SECONDS = 3;

  function pickGrade(rand) { return rand() < 0.5 ? 'grade5' : 'grade2'; }

  // env = { webgl, reduced }
  function mode(env) {
    if (!env.webgl) return 'off';
    return env.reduced ? 'still' : 'run';
  }

  function viewOf(focus, t) {
    var a = t * ORBIT_SPEED;
    return { x: focus.x + Math.sin(a) * RADIUS, y: HEIGHT, z: focus.z + Math.cos(a) * RADIUS, lookY: LOOK_Y };
  }

  function ease(cur, target, dt, rate) { return cur + (target - cur) * (1 - Math.exp(-rate * dt)); }

  // Behind the kid (who faces face, 0 = +z), on alternating sides by i.
  function petSpot(kid, i) {
    var side = i % 2 ? 1 : -1, s = Math.sin(kid.face), c = Math.cos(kid.face);
    return { x: kid.x - s * PET_BEHIND + c * PET_SIDE * side, z: kid.z - c * PET_BEHIND - s * PET_SIDE * side };
  }

  // Moves pet ({ x, z, face }) toward spot; one left far behind (a kid taking a long path) pops in beside it.
  function stepPet(pet, spot, dt) {
    var dx = spot.x - pet.x, dz = spot.z - pet.z, d = Math.hypot(dx, dz);
    if (d > PET_JUMP) {
      pet.x = spot.x;
      pet.z = spot.z;
      return { moving: false };
    }
    if (d <= PET_STOP) {
      pet.x = spot.x;
      pet.z = spot.z;
      return { moving: false };
    }
    var step = Math.min(d, PET_SPEED * dt);
    pet.x += dx / d * step;
    pet.z += dz / d * step;
    pet.face = Math.atan2(dx, dz);
    return { moving: true };
  }

  // push(frameSeconds) is true once the frames of the last SLOW_SECONDS were on average slower than SLOW_FRAME.
  function slowWatch() {
    var time = 0, frames = 0;
    return {
      push: function (dt) {
        time += dt;
        frames++;
        if (time < SLOW_SECONDS) return false;
        var slow = time / frames > SLOW_FRAME;
        time = 0;
        frames = 0;
        return slow;
      }
    };
  }

  var exported = {
    RADIUS: RADIUS, HEIGHT: HEIGHT, PET_IDS: PET_IDS, PET_SPEED: PET_SPEED, SLOW_SECONDS: SLOW_SECONDS,
    pickGrade: pickGrade, mode: mode, viewOf: viewOf, ease: ease, petSpot: petSpot, stepPet: stepPet, slowWatch: slowWatch
  };
  if (node) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.BackdropCore = exported;
})(this);
