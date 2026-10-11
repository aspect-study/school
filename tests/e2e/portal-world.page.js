// Drives the world for portal-e2e.js: open the Science door with the real glide, wait for the frame, let the game
// close it, then check ✕, a second tap while open, and ✕ pressed while the game is on a quiz.
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
  // A wait that runs out reports its name at once, so the runner can say which step never happened.
  function waitFor(name, check, then, tries) {
    tries = tries === undefined ? 200 : tries;
    if (check()) return then();
    if (tries <= 0) {
      seen.timeout = name;
      return out(seen);
    }
    setTimeout(function () { waitFor(name, check, then, tries - 1); }, 50);
  }
  function blurred() {
    var c = document.querySelector('#stage canvas');
    return document.documentElement.classList.contains('w-portal-on') && !!c && getComputedStyle(c).filter.indexOf('blur') >= 0;
  }
  function inner(D, o) {
    localStorage.setItem('e2e_portal_inner', '1');
    localStorage.removeItem('e2e_portal_quiz');
    D.teleport('life-lab');
    D.act();
    waitFor('open', function () { return D.portal.state() === 'open'; }, function () {
      waitFor('quiz', function () { return localStorage.getItem('e2e_portal_quiz') !== null; }, function () {
        o.quizScreen = localStorage.getItem('e2e_portal_quiz');
        o.innerBefore = { portal: !!(history.state && history.state.portal), length: history.length };
        document.querySelector('.w-portal-x').click();
        D.pause();
        setTimeout(function () {
          o.innerClosed = !D.portal.isOpen();
          D.pause();
          o.innerAfter = { portal: !!(history.state && history.state.portal), state: history.state, length: history.length };
          setTimeout(function () {
            o.innerLater = { portal: !!(history.state && history.state.portal), state: history.state, length: history.length };
            o.innerStillWorld = location.pathname.indexOf('/world/grade-5.html') >= 0;
            returned(D, o);
          }, 1500);
        }, 300);
      });
    });
  }
  // The game visits a quiz, comes back home through its own nav, then closes the frame from the home screen.
  function returned(D, o) {
    localStorage.removeItem('e2e_portal_inner');
    localStorage.removeItem('e2e_portal_returned');
    localStorage.setItem('e2e_portal_return', '1');
    D.teleport('life-lab');
    D.act();
    waitFor('open', function () { return D.portal.state() === 'open'; }, function () {
      waitFor('closed', function () { return !D.portal.isOpen(); }, function () {
        D.pause();
        o.returnedHome = localStorage.getItem('e2e_portal_returned');
        setTimeout(function () {
          o.returnAfter = { portal: !!(history.state && history.state.portal), state: history.state, length: history.length };
          o.returnStillWorld = location.pathname.indexOf('/world/grade-5.html') >= 0;
          setTimeout(function () {
            o.returnLater = { portal: !!(history.state && history.state.portal), state: history.state };
            o.returnStillWorldLater = location.pathname.indexOf('/world/grade-5.html') >= 0;
            out(o);
          }, 1500);
        }, 300);
      });
    });
  }
  // Headless Chrome's virtual time does not move on animation frames alone, so a camera glide would spin without
  // ending. Frames come from 16 ms timers here, which advance it.
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
  waitFor('ready', function () { return window.WorldDebug && WorldDebug.ready; }, function () {
    var D = window.WorldDebug, o = seen;
    timerFrames();
    localStorage.removeItem('e2e_portal_game');
    localStorage.removeItem('e2e_portal_inner');
    D.teleport('life-lab');
    o.near = D.state().near;
    D.act();
    o.first = D.portal.state();
    o.pausedWhileOpening = D.paused();
    o.url = D.portal.url();
    o.entry = !!(history.state && history.state.portal);
    waitFor('open', function () { return D.portal.state() === 'open'; }, function () {
      o.opened = D.portal.state();
      o.blurred = blurred();
      o.frameSrc = document.querySelector('.w-portal-frame').getAttribute('src');
      o.color = document.querySelector('.w-portal').style.getPropertyValue('--portal-color');
      o.hudHidden = document.querySelector('.w-hud').hidden;
      waitFor('closed', function () { return !D.portal.isOpen(); }, function () {
        o.game = JSON.parse(localStorage.getItem('e2e_portal_game'));
        o.closed = !D.portal.isOpen();
        o.frameGone = !document.querySelector('.w-portal');
        o.blurGone = !blurred();
        o.pausedAfter = D.paused();
        D.pause();
        o.hudBack = !document.querySelector('.w-hud').hidden;
        o.entryAfter = !!(history.state && history.state.portal);
        D.portal.instant(true);
        D.teleport('life-lab');
        D.act();
        o.xOpen = D.portal.state();
        D.act();
        o.frames = document.querySelectorAll('.w-portal').length;
        document.querySelector('.w-portal-x').click();
        o.xClosed = !D.portal.isOpen() && !document.querySelector('.w-portal');
        D.pause();
        setTimeout(function () { inner(D, o); }, 300);
      });
    });
  });
})();
