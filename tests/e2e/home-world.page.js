// Drives the world for home-e2e.js: the lobby forwarded here, then the pills, the shop / parent area / coin guide in
// the frame, and the quests card.
(function () {
  var sent = false, seen = {};
  function out(o) {
    if (sent) return;
    sent = true;
    if (window.WorldDebug && WorldDebug.pause) WorldDebug.pause();
    o.errors = window.__e2eErrors || [];
    var pre = document.createElement('pre');
    pre.id = 'e2e-out';
    pre.textContent = JSON.stringify(o);
    document.body.appendChild(pre);
  }
  function waitFor(name, check, then, tries) {
    tries = tries === undefined ? 300 : tries;
    var ok = false;
    try { ok = check(); } catch (e) {}
    if (ok) return then();
    if (tries <= 0) {
      seen.timeout = name;
      return out(seen);
    }
    setTimeout(function () { waitFor(name, check, then, tries - 1); }, 50);
  }
  function timerFrames() {
    var nativeCancel = window.cancelAnimationFrame, timers = {}, last = 1000000;
    window.requestAnimationFrame = function (fn) {
      var id = ++last;
      timers[id] = setTimeout(function () { delete timers[id]; fn(performance.now()); }, 16);
      return id;
    };
    window.cancelAnimationFrame = function (id) {
      if (timers[id] === undefined) return nativeCancel.call(window, id);
      clearTimeout(timers[id]);
      delete timers[id];
    };
  }
  function inFrame(sel) {
    var f = document.querySelector('.w-portal-frame'), d = f && f.contentDocument;
    return d ? d.querySelector(sel) : null;
  }
  // lobby-embed.js adds its class once it has set the section up; before that the lobby's own script may have the section open.
  function shown(sel) {
    var e = inFrame(sel);
    return !!e && !e.hidden && e.ownerDocument.documentElement.classList.contains('lobby-embed');
  }

  waitFor('ready', function () { return window.WorldDebug && WorldDebug.ready; }, function () {
    var D = window.WorldDebug, o = seen;
    function closed() { return !D.portal.isOpen(); }
    timerFrames();
    o.path = location.pathname;
    o.pills = D.pills();
    o.balance = Math.floor(Wallet.balanceStored());
    D.portal.instant(true);
    D.section('shop');
    waitFor('shop open', function () { return D.portal.state() === 'open' && shown('#shop-overlay'); }, function () {
      var wrap = inFrame('.wrap');
      o.shopWrapDisplay = wrap ? getComputedStyle(wrap).display : 'missing';
      inFrame('#shop-close').click();
      waitFor('shop closed', closed, function () {
        D.section('parent');
        waitFor('parent open', function () { return D.portal.state() === 'open' && shown('#pin-view') && inFrame('#open-lobby'); }, function () {
          o.pinShown = true;
          o.openLobby = !!inFrame('#open-lobby');
          inFrame('#parent-close').click();
          waitFor('parent closed', closed, function () {
            D.section('coins');
            waitFor('coins open', function () { return D.portal.state() === 'open' && shown('.coin-guide'); }, function () {
              o.coinsShown = true;
              inFrame('.coin-guide .cg-close').click();
              waitFor('coins closed', closed, function () {
                D.openQuests();
                o.questItems = document.querySelectorAll('.w-quests li').length;
                var a = document.querySelector('.w-quests a');
                o.questLink = !!a;
                if (!a) return out(o);
                a.click();
                waitFor('quest game open', function () { return D.portal.state() === 'open'; }, function () {
                  o.gameUrl = D.portal.url();
                  D.portal.close();
                  waitFor('quest game closed', closed, function () {
                    o.closedAll = true;
                    out(o);
                  });
                });
              });
            });
          });
        });
      });
    });
  });
})();
