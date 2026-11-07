// Reports Life Lab's home list for term-e2e.js: the lesson cards, the term headings and the card under each, and the
// quiz that opened (the final exam with &exam=1).
(function () {
  setTimeout(function () {
    var list = document.getElementById('homeList');
    var out = { errors: window.__e2eErrors || [] };
    out.cards = list.querySelectorAll(':scope > [data-search-lesson]').length;
    out.heads = [].slice.call(list.querySelectorAll('.lterm')).map(function (h) {
      return [h.textContent, h.nextElementSibling ? h.nextElementSibling.getAttribute('data-search-lesson') : null];
    });
    out.headsHidden = list.querySelectorAll('.lterm[data-trail-hidden]').length;
    out.quiz = currentQuizMeta ? currentQuizMeta.id : null;
    out.questions = currentQuizSet.length;
    var pre = document.createElement('pre');
    pre.id = 'e2e-out';
    pre.textContent = JSON.stringify(out);
    document.body.appendChild(pre);
  }, 200);
})();
