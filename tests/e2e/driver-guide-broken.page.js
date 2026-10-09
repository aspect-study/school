setTimeout(function () {
  var C = __GUIDE, list = document.getElementById(C.list);
  var cards = [].filter.call(list.children, function (c) { return c.hasAttribute('data-search-lesson'); });
  var r = {
    errors: window.__e2eErrors || [],
    home: Nav.current() === C.home,
    leftovers: document.querySelectorAll('#trail-style, .trail-top, .trail-path, [data-trail-hidden]').length,
    cardsShown: cards.length > 0 && cards.every(function (c) { return getComputedStyle(c).display !== 'none'; })
  };
  // A redraw of the home cards must not bring a half-built path back.
  renderHome();
  setTimeout(function () {
    r.stillGone = document.querySelectorAll('.trail-top, .trail-path, [data-trail-hidden]').length === 0;
    var pre = document.createElement('pre');
    pre.id = 'e2e-out';
    pre.textContent = JSON.stringify(r);
    document.body.appendChild(pre);
  }, 40);
}, 40);
