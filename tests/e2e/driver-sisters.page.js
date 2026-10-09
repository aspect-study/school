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
  var me = Learner.current(), now = Date.now();
  function seed(peek) { __store.setItem('family_peek_v1', JSON.stringify(peek)); World.mount(campus, grid, toggle); }
  function family() { return JSON.parse(__store.getItem('family_v1') || 'null'); }
  function sis() { return campus.querySelector('[data-sister="mia"]'); }
  function tap(el) { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); }

  seed({});
  r.noPeekNoBuddy = !campus.querySelector('.f-sis');

  var peek = { mia: { profile: { name: '', emoji: '', grade: 2 }, world: { avatar: 'rabbit' }, total: 3, readAt: now,
    family: { v: 1, at: now - 60000, news: [{ id: 'n1', t: now - 120000, kind: 'medal', app: 'block-bot', tier: 1, title: 'Skip Counting' }],
      sent: [{ id: 's1', t: now - 30000, to: me.id, cheer: 'great' }] } } };
  seed(peek);
  r.buddy = !!sis();
  r.playing = sis().getAttribute('class');
  r.tag = sis().querySelector('.f-tag').textContent;
  r.mark = !!sis().querySelector('.f-mark');

  tap(sis());
  var card = campus.querySelector('.f-card');
  r.cardOpen = !!card;
  r.news = [].map.call(card.querySelectorAll('.f-news li'), function (li) { return li.textContent; });
  r.count = card.querySelector('.f-count').textContent;
  r.buttons = [].map.call(card.querySelectorAll('[data-cheer]'), function (b) { return b.textContent; });
  r.markAfterOpen = !!sis().querySelector('.f-mark');
  card.querySelector('[data-cheer="great"]').click();
  r.msg = card.querySelector('.f-msg').textContent;
  r.sent = family().sent.map(function (s) { return [s.to, s.cheer]; });
  r.total = __store.getItem('cheers_sent_total');
  card.querySelector('[data-cheer="great"]').click();
  r.sentAfterAgain = family().sent.length;
  card.querySelector('.f-close').click();
  r.cardClosed = !campus.querySelector('.f-card');

  Family.popCheers();
  r.pop = ((Fx.queued && Fx.queued()) || []).map(function (e) { return e.title + ' | ' + e.next; });
  r.seenCheers = JSON.parse(__store.getItem('family_seen_v1')).cheers === now - 30000;
  r.unseenAfter = Family.unseenCheers(me, Family.readPeek(__store), Family.readSeen(__store)).length;

  var fam = family();
  for (var i = 0; i < 9; i++) fam.sent.push({ id: 'x' + i, t: now - 1 - i, to: 'mia', cheer: 'go' });
  __store.setItem('family_v1', JSON.stringify(fam));
  tap(sis());
  card = campus.querySelector('.f-card');
  r.limitDisabled = [].every.call(card.querySelectorAll('[data-cheer]'), function (b) { return b.disabled; });
  r.limitMsg = card.querySelector('.f-msg').textContent;
  out();
})();
