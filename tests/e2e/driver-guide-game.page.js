setTimeout(function () {
  var r = { errors: window.__e2eErrors || [] };
  function out() {
    var pre = document.createElement('pre');
    pre.id = 'e2e-out';
    pre.textContent = JSON.stringify(r);
    document.body.appendChild(pre);
  }
  var C = __GUIDE, store = Learner.storage;
  var list = document.getElementById(C.list), path = document.querySelector('.trail-path'), top = document.querySelector('.trail-top');
  var lessons = medalLessons(), T = C.grade === 'grade2' && !Lang.both() ? Guide.TEXT.grade5 : Guide.TEXT[C.grade];
  r.thirdId = lessons[2].id;
  function shown() {
    return [].filter.call(list.children, function (c) { return c.hasAttribute('data-search-lesson') && getComputedStyle(c).display !== 'none'; }).length;
  }
  function next() { return [].map.call(path.querySelectorAll('.t-next'), function (s) { return s.getAttribute('data-stop'); }); }
  function guideText() { return document.querySelector('.trail-guide .g-text').textContent; }
  function later(f) { setTimeout(f, 40); }

  r.order = !!top && top.nextElementSibling.classList.contains('lsearch') && list.nextElementSibling === path;
  r.startScreen = Nav.current() === C.home;
  r.stops = path.querySelectorAll('.t-stop').length === lessons.length;
  r.cardsHidden = shown() === 0;
  r.next = next();
  r.text = guideText() === T.lessonHere(lessons[0].title);
  r.buddy = !!path.querySelector('.t-buddy');

  var ms = JSON.parse(store.getItem('mastery_v1')), e = ms.apps[SH_APP];
  e.lessons[e.order[0]].best = 1;
  e.lessons[e.order[0]].now = 1;
  store.setItem('mastery_v1', JSON.stringify(ms));
  renderHome();
  later(function () {
    r.nextAfter = next();
    r.hop = path.querySelector('.t-buddy').classList.contains('t-hop');
    r.textAfter = guideText() === T.lessonHere(lessons[1].title);

    var toggle = document.querySelector('.trail-toggle');
    toggle.click();
    r.listView = path.hidden && shown() === lessons.length && toggle.textContent === '🗺️ Path';
    toggle.click();
    r.pathAgain = !path.hidden && shown() === 0 && toggle.textContent === '📋 List';

    var input = document.getElementById('lesson-search');
    input.value = C.query;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    later(function () {
      r.searchShowsCards = path.hidden && shown() > 0 && getComputedStyle(toggle).display === 'none';
      document.querySelector('.lsearch-clear').click();
      later(function () {
        r.clearShowsPath = !path.hidden && shown() === 0 && getComputedStyle(toggle).display !== 'none';

        document.querySelector('.trail-guide .g-go').click();
        r.goOpens = Nav.current() !== C.home;
        goHome();
        later(function () {
          path.querySelector('[data-stop="2"]').click();
          var card = path.querySelector('.t-card');
          r.card = card ? card.querySelector('.t-card-title').textContent.indexOf('3 · ' + lessons[2].title) === 0 : false;
          card.querySelector('.t-open').click();
          r.openOpens = Nav.current() !== C.home;
          out();
        });
      });
    });
  });
}, 40);
