/* Movement maths for the 3D world, with no Three.js. Input is a stick position (x right, y down, -1..1) and the
   camera's yaw; the camera sits at (sin yaw, cos yaw) from her, so pushing up walks away from it. */
(function (root) {
  'use strict';

  var SPEED = 9;
  var SPRINT = 1.4;
  var DEAD = 0.08;
  var ARRIVE = 0.4;

  function moveVector(ix, iy, yaw) {
    var mag = Math.min(1, Math.hypot(ix, iy));
    if (mag < DEAD) return null;
    var fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
    var mx = fx * -iy + rx * ix, mz = fz * -iy + rz * ix, len = Math.hypot(mx, mz);
    return { x: mx / len, z: mz / len, mag: mag };
  }

  function toward(x, z, tx, tz) {
    var dx = tx - x, dz = tz - z, d = Math.hypot(dx, dz);
    return d < ARRIVE ? null : { x: dx / d, z: dz / d, mag: 1 };
  }

  // Moves x then z separately, so a wall in one direction still lets her slide along it. fast: SPRINT while she runs.
  function step(x, z, dir, dt, blocked, fast) {
    var sp = SPEED * (fast || 1) * dir.mag * dt, nx = x + dir.x * sp, nz = z + dir.z * sp, out = { x: x, z: z };
    if (!blocked(nx, z)) out.x = nx;
    if (!blocked(out.x, nz)) out.z = nz;
    return out;
  }

  function facing(dir) { return Math.atan2(dir.x, dir.z); }

  // Moves (x, z) up to dist toward (tx, tz), for characters who walk to her; arrived once it gets there.
  function advance(x, z, tx, tz, dist) {
    var dx = tx - x, dz = tz - z, d = Math.hypot(dx, dz);
    if (d <= dist) return { x: tx, z: tz, arrived: true };
    return { x: x + dx / d * dist, z: z + dz / d * dist, arrived: false };
  }

  function turn(cur, target, k) {
    var d = (target - cur) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return cur + d * Math.min(1, k);
  }

  var exported = { SPEED: SPEED, SPRINT: SPRINT, moveVector: moveVector, toward: toward, step: step, facing: facing, turn: turn, advance: advance };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.Walk = exported;
})(this);
