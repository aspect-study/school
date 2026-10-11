// Runs inside the Science game when the world opens it in its frame: notes what embed mode changed, then either presses
// ← on the game home (which should close the frame) or, when the world asks for it, starts a quiz and stays there
// (e2e_portal_inner) or starts a quiz, comes back home through the game's own nav and then presses ← (e2e_portal_return).
(function () {
  var r = {
    embedded: !!(window.Nav && Nav.embedded),
    background: getComputedStyle(document.body).backgroundColor,
    lobbyItem: document.getElementById('nav-lobby') ? document.getElementById('nav-lobby').textContent : null,
    errors: window.__e2eErrors || []
  };
  localStorage.setItem('e2e_portal_game', JSON.stringify(r));
  if (!r.embedded) return;
  if (localStorage.getItem('e2e_portal_return')) {
    setTimeout(function () { currentLessonIdx = 0; startQuiz(); }, 100);
    setTimeout(function () {
      document.getElementById('nav-back').click();
      var leave = document.getElementById('nav-leave');
      if (leave && !document.getElementById('nav-confirm').hidden) leave.click();
    }, 400);
    setTimeout(function () {
      localStorage.setItem('e2e_portal_returned', String(Nav.current()));
      document.getElementById('nav-back').click();
    }, 900);
    return;
  }
  if (localStorage.getItem('e2e_portal_inner')) {
    setTimeout(function () {
      currentLessonIdx = 0;
      startQuiz();
      localStorage.setItem('e2e_portal_quiz', String(Nav.current()));
    }, 100);
    return;
  }
  setTimeout(function () { document.getElementById('nav-back').click(); }, 100);
})();
