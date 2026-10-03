(function () {
  var out = { errors: window.__e2eErrors || [] };
  var input = document.getElementById('lesson-search');
  var box = document.querySelector('.lsearch');
  var list = box && box.nextElementSibling;
  out.boxBeforeList = !!list && list.id === __SEARCH.list;
  if (!out.boxBeforeList) return finish();

  function shown() { return [].slice.call(list.children).filter(function (c) { return !c.hasAttribute('data-search-hidden'); }); }
  function lessonsShown() { return shown().map(function (c) { return c.getAttribute('data-search-lesson'); }); }
  function type(q) { input.value = q; input.dispatchEvent(new Event('input')); }
  function count() { return document.querySelector('.lsearch-count').textContent; }

  out.lessonCards = list.querySelectorAll(':scope > [data-search-lesson]').length;
  out.allAtStart = shown().length === list.children.length;

  type(__SEARCH.query);
  out.found = lessonsShown();
  out.count = count();
  out.hits = [].slice.call(list.querySelectorAll('.lsearch-hit')).map(function (h) { return h.textContent; });

  type('zzqqxxkk');
  out.noneShown = shown().length;
  out.noneCount = count();

  type(__SEARCH.query);
  renderHome();
  Promise.resolve().then(function () {
    out.afterRedraw = lessonsShown();
    document.querySelector('.lsearch-clear').click();
    out.afterClear = shown().length === list.children.length && !list.querySelector('.lsearch-hit') && count() === '';
    type(__SEARCH.enter);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    out.screenAfterEnter = Nav.current();
    finish();
  });

  function finish() {
    var pre = document.createElement('pre');
    pre.id = 'e2e-out';
    pre.textContent = JSON.stringify(out);
    document.body.appendChild(pre);
  }
})();
