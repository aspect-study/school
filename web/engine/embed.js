/* Inside the 3D world's frame (web/world/portal.js) a page opens with ?embed=1. These tell a page it is there and let
   it ask the world to close the frame, with an optional next step (then) for the world. */
(function (root) {
  'use strict';

  function isEmbedded(win) {
    try { return /[?&]embed=1(&|$)/.test(win.location.search) && !!win.parent && win.parent !== win; } catch (e) { return false; }
  }

  function closeMessage(url) {
    return /#shop$/.test(url) ? { type: 'portal-close', then: 'shop' } : { type: 'portal-close' };
  }

  function targetOrigin(origin) { return origin && origin !== 'null' ? origin : '*'; }

  function close(win, then) {
    var msg = { type: 'portal-close' };
    if (then) msg.then = then;
    win.parent.postMessage(msg, targetOrigin(win.location.origin));
  }

  var exported = { isEmbedded: isEmbedded, closeMessage: closeMessage, targetOrigin: targetOrigin, close: close };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.Embed = exported;
})(this);
