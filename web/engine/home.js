/* Home is the 3D world. A lobby page forwards there when 3D can run (not inside the world's frame, not with ?stay=1,
   not for a lobby section, not as a file). Inside the frame, the lobby shows one section, named by the hash. */
(function (root) {
  'use strict';

  var SECTIONS = ['shop', 'coins', 'parent'];

  function sectionOf(hash) {
    var h = String(hash || '').replace(/^#/, '');
    return SECTIONS.indexOf(h) >= 0 ? h : 'shop';
  }

  // loc = { protocol, search, hash }.
  function forwardTo(loc, grade, canRun, embedded) {
    if (!canRun || embedded || loc.protocol === 'file:') return null;
    if (/[?&]stay=1(&|$)/.test(loc.search || '')) return null;
    if (SECTIONS.indexOf(String(loc.hash || '').replace(/^#/, '')) >= 0) return null;
    return '../world/grade-' + (grade === 'grade2' ? '2' : '5') + '.html';
  }

  function canRun(doc) {
    try {
      var c = doc.createElement('canvas');
      return !!(c.getContext('webgl2') || c.getContext('webgl'));
    } catch (e) { return false; }
  }

  var FAILED_KEY = 'world_failed_v1';

  // Set by the world page (per tab) when it could not start, so lobby links stop bouncing back to it.
  function worldFailed(storage) {
    try { return !!storage && storage.getItem(FAILED_KEY) === '1'; } catch (e) { return false; }
  }

  var exported = {
    SECTIONS: SECTIONS, sectionOf: sectionOf, forwardTo: forwardTo, canRun: canRun,
    FAILED_KEY: FAILED_KEY, worldFailed: worldFailed
  };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.Home = exported;
  try {
    var script = root.document.currentScript, grade = script ? script.getAttribute('data-grade') : null;
    var embedded = !!(root.Embed && root.Embed.isEmbedded(root));
    // Read now: the shop script strips the hash before lobby-embed.js runs.
    exported.section = embedded ? sectionOf(root.location.hash) : null;
    var session = null;
    try { session = root.sessionStorage; } catch (e) {}
    var url = grade ? forwardTo(root.location, grade, canRun(root.document) && !worldFailed(session), embedded) : null;
    if (url) root.location.replace(url);
  } catch (e) {}
})(this);
