setTimeout(function () {
  var pre = document.createElement('pre');
  pre.id = 'e2e-out';
  pre.textContent = JSON.stringify({ errors: window.__e2eErrors || [], opened: Nav.current() !== __GUIDE.home });
  document.body.appendChild(pre);
}, 80);
