// Reports Byte Buddies' home stars for term-e2e.js. With ?term=2 it first finishes the Term 2 lesson's quiz with every
// answer right, so the next load (no term) shows where those stars were saved.
(function () {
  setTimeout(function () {
    var out = { errors: window.__e2eErrors || [] };
    if (/term=2/.test(location.search)) {
      currentLesson = 0;
      startQuiz();
      score = currentQuizSet.length;
      finishQuiz();
      out.saved = Object.keys(progress).filter(function (k) { return k !== 'final'; });
      goHome();
    }
    var list = document.getElementById('home-list');
    out.stars = [].slice.call(list.querySelectorAll('[data-search-lesson]')).map(function (card) {
      return card.querySelectorAll('.mini-stars svg[fill="var(--amber)"]').length;
    });
    var pre = document.createElement('pre');
    pre.id = 'e2e-out';
    pre.textContent = JSON.stringify(out);
    document.body.appendChild(pre);
  }, 200);
})();
