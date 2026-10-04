// Test-only driver. c.open/c.idx/c.cards are expressions written in read-gate-e2e.js; direct eval reaches the
// page's own variables, which in some games live inside the page's closure.
(function () {
  var c = __GATE;
  var out = { errors: window.__e2eErrors || [], steps: [] };
  var realNow = Date.now;
  var t = realNow();
  Date.now = function () { return t; };

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

    next();
    out.earlyNext = idx();
    t += 500;
    next();
    out.halfNext = idx();

    for (var k = 0; k < total; k++) {
      t += 60000;
      if (c.flip) {
        next();
        out.steps.push({ before: k, afterFrontOnly: idx(), note: note() });
        el(c.flip).click();
        t += 60000;
      }
      if (k < total - 1) {
        next();
        out.steps.push({ before: k, after: idx() });
        if (k === total - 2) out.startOnArrivingLast = locked(startId);
      }
    }
    document.querySelector(c.prev).click();
    out.prevFree = idx();
    out.allRead = { start: locked(startId), note: note() };
    next();
    out.nextFree = idx();

    el(startId).click();
    out.afterStart = Nav.current();

    goHome();
    eval(c.open);
    out.reopened = { next: locked(c.next), start: locked(startId) };
  } catch (e) {
    out.errors.push(String(e && e.stack || e));
  }
  Date.now = realNow;

  var pre = document.createElement('pre');
  pre.id = 'e2e-out';
  pre.textContent = JSON.stringify(out);
  document.body.appendChild(pre);
})();
