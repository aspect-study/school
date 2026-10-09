(function () {
  var r = {};
  function out() {
    r.errors = window.__e2eErrors || [];
    var pre = document.createElement('pre');
    pre.id = 'e2e-out';
    pre.textContent = JSON.stringify(r);
    document.body.appendChild(pre);
  }
  var campus = document.getElementById('campus'), grid = document.querySelector('.grid'), toggle = document.getElementById('campus-toggle');
  var went = [];
  World.navigate = function (href) { went.push(href); };
  World.walkMs = 0;
  function draw() { World.mount(campus, grid, toggle); }
  function slot() { return document.getElementById('campus-guide'); }
  function text() { var p = slot() && slot().querySelector('.g-text'); return p ? p.textContent : ''; }
  function go() { slot().querySelector('.g-go').click(); return went.pop(); }
  var apps = [].map.call(grid.querySelectorAll('.subject-card[data-app]'), function (c) { return c.getAttribute('data-app'); });

  __store.setItem('world_v1', JSON.stringify({ v: 1, avatar: 'owl', view: 'campus', at: null, t: 1 }));
  var q = Quests.state();
  q.list.forEach(function (x) { x.done = true; });
  __store.setItem(Quests.KEY, JSON.stringify(q));

  __store.setItem(Boss.KEY, JSON.stringify({ v: 1, week: Boss.weekKey(Date.now()), paid: [],
    stages: [{ app: 'life-lab', title: 'Life Lab', cleared: false }, { app: 'math-mastery', title: 'Math Mastery', cleared: false }] }));
  draw();
  r.slotBeforeMap = !!slot() && slot().nextElementSibling === campus;
  r.buddy = slot().querySelector('.g-buddy').textContent;
  r.bossText = text();
  r.target = campus.querySelector('[data-place="life-lab"]').getAttribute('class');
  r.board = campus.querySelector('[data-place="life-lab"] .w-name').textContent;
  r.boardLabel = campus.querySelector('[data-place="life-lab"]').getAttribute('aria-label');
  r.road = campus.querySelectorAll('.w-guide-road').length;
  r.bossHref = go();

  __store.setItem(Boss.KEY, JSON.stringify({ v: 1, week: Boss.weekKey(Date.now()), paid: [], stages: [] }));
  draw();
  r.visitText = text();
  r.visitApp = apps[0];

  __store.setItem('mastery_v1', JSON.stringify({ v: 1, apps: { 'life-lab': { order: ['a', 'b'], lessons: {
    a: { title: 'What Is Matter', icon: '', now: 1, best: 1, paid: 1 }, b: { title: 'Matter', icon: '', now: 0, best: 0, paid: 0 } } } } }));
  draw();
  r.lessonText = text();
  r.lessonHref = go();

  toggle.click();
  r.listHidesMap = campus.hidden && !grid.hidden;
  r.listText = text();
  r.listHref = go();
  toggle.click();

  var all = { v: 1, apps: {} };
  apps.forEach(function (a) { all.apps[a] = { order: ['x'], lessons: { x: { title: 'X', icon: '', now: 1, best: 1, paid: 1 } } }; });
  __store.setItem('mastery_v1', JSON.stringify(all));
  draw();
  r.doneShopText = text();
  // The 40-coin welcome gift buys something on a fresh profile; empty the wallet for the plain "done".
  Wallet.canAfford = function () { return false; };
  draw();
  r.doneText = text();
  r.doneGo = !!slot().querySelector('.g-go');
  r.doneTarget = campus.querySelectorAll('.w-target').length;
  out();
})();
