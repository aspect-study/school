/* A lobby page inside the 3D world's frame (?embed=1) shows just one section: the reward shop, the coin guide or the
   parent area (home.js reads which from the hash). When that section closes, the frame closes. In the parent area,
   Account and Open the lobby page leave the frame for the world to open as full pages. */
(function (root) {
  'use strict';
  var E = root.Embed, H = root.Home, doc = root.document;
  if (!E || !H || !E.isEmbedded(root) || !H.section) return;

  function start() {
    var section = H.section, W = root.Wallet;
    function $(id) { return doc.getElementById(id); }
    var isOpen = {
      shop: function () { return !$('shop-overlay').hidden; },
      parent: function () { return !$('parent-overlay').hidden; },
      coins: function () { return !!(W && W.guideOpen && W.guideOpen()); }
    }[section];

    doc.documentElement.classList.add('lobby-embed');
    var style = doc.createElement('style');
    style.textContent =
      '.lobby-embed body{background:var(--bg);}' +
      '.lobby-embed body>*:not(#shop-overlay):not(#parent-overlay):not(.coin-guide){display:none !important;}';
    doc.head.appendChild(style);

    var guide = doc.querySelector('.coin-guide');
    if (guide && section !== 'coins') guide.hidden = true;
    if (section === 'shop' && !isOpen()) $('shop-open').click();
    if (section === 'parent') $('parent-open').click();
    if (section === 'coins' && W && W.showGuide) W.showGuide();

    var closed = false, wasOpen = isOpen();
    function done(then) {
      if (closed) return;
      closed = true;
      E.close(root, then);
    }
    if (!wasOpen) return done();
    new root.MutationObserver(function () { if (!isOpen()) done(); })
      .observe(doc.body, { attributes: true, attributeFilter: ['hidden'], subtree: true });

    if (section === 'parent') {
      var account = $('account-open');
      if (account) account.addEventListener('click', function (e) { e.preventDefault(); done('account'); });
      var lobby = doc.createElement('button');
      lobby.type = 'button';
      lobby.className = 'p-btn';
      lobby.id = 'open-lobby';
      lobby.textContent = '🏫 Open the lobby page';
      lobby.addEventListener('click', function () { done('lobby'); });
      $('parent-close').insertAdjacentElement('afterend', lobby);
    }
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start); else start();
})(this);
