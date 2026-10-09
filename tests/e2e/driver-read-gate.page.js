// Test-only driver. c.open/c.idx/c.cards are expressions written in read-gate-e2e.js; direct eval reaches the
// page's own variables, which in some games live inside the page's closure.
(function () {
  var c = __GATE;
  var out = { errors: window.__e2eErrors || [], steps: [] };

  function el(id) { return document.getElementById(id); }
  function locked(id) { return el(id).hasAttribute('data-read-lock'); }
  function idx() { return eval(c.idx); }
  function note() { var n = document.querySelector('.read-gate-note'); return n ? n.textContent : null; }
  function next() { el(c.next).click(); }
  var startId = c.start || c.next;

  try {
    eval(c.open);
    var total = eval(c.cards);
    out.total = total;
    out.atOpen = { next: locked(c.next), start: locked(startId), note: note() };
    if (c.back) out.backShown = !!el(c.back).offsetParent && el(c.back).textContent.trim() !== '';

    for (var k = 0; k < total - 1; k++) {
      next();
      out.steps.push({ before: k, after: idx() });
      if (k === total - 3) out.startBeforeLast = locked(startId);
    }
    out.allRead = { start: locked(startId), note: note() };
    document.querySelector(c.prev).click();
    out.prevFree = idx();

    next();
    out.backToLast = idx();
    el(startId).click();
    out.afterStart = Nav.current();

    goHome();
    eval(c.open);
    out.reopened = { next: locked(c.next), start: locked(startId) };
  } catch (e) {
    out.errors.push(String(e && e.stack || e));
  }

  var pre = document.createElement('pre');
  pre.id = 'e2e-out';
  pre.textContent = JSON.stringify(out);
  document.body.appendChild(pre);
})();
