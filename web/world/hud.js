/* The world HUD's two pills: her coins, and today's quests with her streak. */
(function (root) {
  'use strict';

  function pills(s) {
    var coins = '🪙 ' + Math.max(0, Math.floor(Number(s.coins) || 0));
    var quests = '🎯' + (s.total > 0 ? ' ' + s.done + '/' + s.total : '');
    if (s.streak > 0) quests += ' 🔥' + s.streak;
    return { coins: coins, quests: quests };
  }

  function zoomShown(canZoom, coarse) { return !!canZoom && !coarse; }

  var exported = { pills: pills, zoomShown: zoomShown };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.Hud = exported;
})(this);
