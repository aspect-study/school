/* Small state for the 3D world: device-only prefs (quality, music, footsteps, zoom), the door she left from (this tab
   only, so 🏠 in the game can bring her back), and a frame-rate watcher that asks for low quality on a slow device. */
(function (root) {
  'use strict';

  var DEVICE_KEY = 'world3d_device_v1';
  var RETURN_KEY = 'world_return_v1';
  var QUALITIES = ['auto', 'high', 'low'];
  var ZOOM_MIN = 0.45, ZOOM_MAX = 1.5;
  var DAILY_KEY = 'world3d_v1';

  function parse(storage, key) {
    try { return JSON.parse(storage.getItem(key)); } catch (e) { return null; }
  }

  function clampZoom(z) { return typeof z === 'number' && isFinite(z) ? Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z)) : 1; }

  function readPrefs(storage) {
    var d = parse(storage, DEVICE_KEY) || {};
    return { v: 1, quality: QUALITIES.indexOf(d.quality) >= 0 ? d.quality : 'auto', music: d.music !== false, steps: d.steps !== false, zoom: clampZoom(d.zoom) };
  }

  function savePrefs(storage, prefs) {
    var out = { v: 1, quality: QUALITIES.indexOf(prefs.quality) >= 0 ? prefs.quality : 'auto', music: prefs.music !== false, steps: prefs.steps !== false, zoom: clampZoom(prefs.zoom) };
    try { storage.setItem(DEVICE_KEY, JSON.stringify(out)); } catch (e) {}
    return out;
  }

  function startQuality(prefs) { return prefs.quality === 'low' ? 'low' : 'high'; }

  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }

  // before: cheer.js's snapshot as she goes in, so her pet can celebrate what she did when she is back.
  function setReturn(session, grade, app, before) {
    var r = { grade: grade, app: app };
    if (isObj(before)) r.before = before;
    try { session.setItem(RETURN_KEY, JSON.stringify(r)); } catch (e) {}
  }

  function readReturn(session) {
    if (!session) return null;
    var r = parse(session, RETURN_KEY);
    if (!isObj(r) || typeof r.grade !== 'string' || typeof r.app !== 'string') return null;
    var out = { grade: r.grade, app: r.app };
    if (isObj(r.before)) out.before = r.before;
    return out;
  }

  // The celebration shows once; a reload still brings her back to the same door.
  function dropBefore(session) {
    var r = readReturn(session);
    if (r && r.before) setReturn(session, r.grade, r.app);
  }

  function clearReturn(session) {
    try { session.removeItem(RETURN_KEY); } catch (e) {}
  }

  // Once-a-day moments, synced so a second device does not repeat them: the day she last talked to Mayor Mimi, and the
  // days Jesus last greeted and comforted her; bossWin is the week (Monday key) she saw the boss finale.
  function readDaily(storage) {
    var d = parse(storage, DAILY_KEY) || {};
    function day(k) { return typeof d[k] === 'string' ? d[k] : ''; }
    return { v: 1, mimi: day('mimi'), greeted: day('greeted'), comforted: day('comforted'), bossWin: day('bossWin'), t: typeof d.t === 'number' ? d.t : 0 };
  }

  function markDaily(storage, field, day, now) {
    var d = readDaily(storage);
    d[field] = day;
    d.t = now;
    try { storage.setItem(DAILY_KEY, JSON.stringify(d)); } catch (e) {}
    return d;
  }

  // tick(dt) once per frame; true once, after `seconds` whole seconds in a row below `limit` frames per second.
  function fpsWatch(limit, seconds) {
    var frames = 0, time = 0, slow = 0, fired = false;
    return function tick(dt) {
      if (fired) return false;
      frames++;
      time += dt;
      if (time < 1 - 1e-9) return false;
      slow = frames / time < limit ? slow + 1 : 0;
      frames = 0;
      time = 0;
      if (slow < seconds) return false;
      fired = true;
      return true;
    };
  }

  var exported = {
    DAILY_KEY: DAILY_KEY, readDaily: readDaily, markDaily: markDaily,
    DEVICE_KEY: DEVICE_KEY, RETURN_KEY: RETURN_KEY, readPrefs: readPrefs, savePrefs: savePrefs, startQuality: startQuality,
    ZOOM_MIN: ZOOM_MIN, ZOOM_MAX: ZOOM_MAX, clampZoom: clampZoom,
    setReturn: setReturn, readReturn: readReturn, clearReturn: clearReturn, dropBefore: dropBefore, fpsWatch: fpsWatch
  };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.Prefs = exported;
})(this);
