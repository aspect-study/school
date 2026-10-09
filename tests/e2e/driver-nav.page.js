(function () {
  var went = [];
  Nav.go = function (url) { went.push(url); };
  var $ = function (id) { return document.getElementById(id); };
  var out = { errors: window.__e2eErrors || [] };

  out.barFirst = document.body.firstElementChild && document.body.firstElementChild.id === 'nav-bar';
  out.noFloatingMute = !$('fx-mute');

  $('nav-back').click();
  out.backFromHome = went.pop();

  __NAV_QUIZ();
  out.quizScreen = Nav.current();
  $('nav-back').click();
  out.askShown = !$('nav-confirm').hidden;
  $('nav-keep').click();
  out.keptScreen = Nav.current();
  out.askHiddenAfterKeep = $('nav-confirm').hidden;

  $('nav-back').click();
  $('nav-leave').click();
  out.afterLeave = Nav.current();

  $('nav-menu').click();
  out.menuOpen = !$('nav-sheet').hidden;
  var before = window.Fx.muted();
  $('nav-sound').click();
  out.soundToggled = window.Fx.muted() !== before;
  $('nav-sound').click();
  var packBefore = window.Fx.pack();
  out.packLabel = $('nav-pack').textContent;
  $('nav-pack').click();
  out.packChanged = window.Fx.pack() !== packBefore;
  out.packLabelAfter = $('nav-pack').textContent;
  $('nav-pack').click();
  out.packBack = window.Fx.pack() === packBefore;
  out.menuStillOpen = !$('nav-sheet').hidden;
  $('nav-shop').click();
  out.shop = went.pop();
  out.menuClosed = $('nav-sheet').hidden;

  var pre = document.createElement('pre');
  pre.id = 'e2e-out';
  pre.textContent = JSON.stringify(out);
  document.body.appendChild(pre);
})();
