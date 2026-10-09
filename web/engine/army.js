/* The weekly boss's army in a boss stage (loaded by every game after bosses.js). A strip above the question shows this
   week's boss and one minion for each question. A right answer pops the next minion in a little burst; a wrong one
   makes it giggle and stay. When the stage ends, boss.js calls end(): the boss says "ouch" (cleared), sends his army
   home (missed), or pops in a full-screen burst (the last stage), and Fx.hold keeps the popup back until that is done.
   A show only: points, coins and review boxes never change here. */
(function (root) {
  'use strict';

  var CARD_MS = 1300, DOWN_MS = 1600, POP_AT = 700;

  function model(n) {
    var m = [];
    for (var i = 0; i < n; i++) m.push('up');
    return { minions: m, next: 0 };
  }

  // The minion this answer reaches, or -1 when none are left.
  function step(m, correct) {
    if (m.next >= m.minions.length) return -1;
    var i = m.next++;
    m.minions[i] = correct ? 'popped' : 'stayed';
    return i;
  }

  var CSS =
    '.army{display:flex;align-items:center;gap:10px;height:90px;margin:0 0 10px;padding:6px 10px;border-radius:18px;' +
      'background:linear-gradient(90deg,#f3ecff,#ffe9f3);overflow:hidden;box-sizing:border-box}' +
    '.army-boss{flex:0 0 78px;height:78px;animation:army-bob 2.4s ease-in-out infinite}' +
    '.army-boss svg{width:100%;height:100%;display:block}' +
    '.army-say{flex:1 1 auto;min-width:0;margin:0;font-weight:700;font-size:.85rem;line-height:1.25;color:#3b2363;overflow:hidden;' +
      'display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical}' +
    '.army-row{flex:0 1 auto;display:flex;align-items:flex-end;gap:4px;min-width:0}' +
    '.army-minion{position:relative;flex:0 1 44px;min-width:16px;max-width:44px;aspect-ratio:1/1;transition:transform .2s}' +
    '.army-minion svg{width:100%;height:100%;display:block}' +
    '.army-minion.next{transform:translateY(-6px) scale(1.12)}' +
    '.army-minion.popped{animation:army-pop .6s forwards}' +
    '.army-minion.stayed,.army-boss.tease{animation:army-giggle .6s}' +
    '.army-piece{position:absolute;left:40%;top:40%;font-size:18px;pointer-events:none;animation:army-fly .8s ease-out forwards}' +
    '.army-star{position:absolute;left:0;right:0;top:20%;text-align:center}' +
    '.army-card{position:fixed;left:50%;top:70px;transform:translateX(-50%);z-index:2147483000;display:flex;align-items:center;gap:10px;' +
      'width:max-content;max-width:min(92vw,520px);padding:10px 14px;border-radius:18px;background:#fff;color:#3b2363;' +
      'box-shadow:0 8px 24px rgba(59,35,99,.25);pointer-events:none;box-sizing:border-box}' +
    '.army-card .army-boss{flex-basis:64px;height:64px}' +
    '.army-card p{margin:0;font-weight:800}' +
    '.army-boss.shake{animation:army-shake .5s 2}' +
    '.army-burst{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;pointer-events:none}' +
    '.army-burst .army-boss{position:relative;flex:0 0 180px;height:180px}' +
    '.army-boss.puff{animation:army-puff .7s ease-in forwards}' +
    '.army-boss.gone svg{visibility:hidden}' +
    '.army-burst .army-piece{font-size:34px}' +
    '@keyframes army-bob{50%{transform:translateY(-4px)}}' +
    '@keyframes army-pop{40%{transform:scale(1.4)}100%{transform:scale(0);opacity:0}}' +
    '@keyframes army-giggle{25%{transform:rotate(-12deg)}75%{transform:rotate(12deg)}}' +
    '@keyframes army-shake{25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}' +
    '@keyframes army-puff{100%{transform:scale(1.5)}}' +
    '@keyframes army-fly{to{transform:translate(var(--dx),var(--dy)) rotate(var(--r));opacity:0}}' +
    '@keyframes army-fade{to{opacity:.25}}' +
    '@media (max-width:600px){.army{height:64px;gap:6px}.army .army-boss{flex-basis:54px;height:54px}.army-minion{flex-basis:30px;max-width:30px}}' +
    '@media (max-width:420px){.army-say{display:none}.army-row{margin-left:auto}}' +
    '@media (prefers-reduced-motion:reduce){.army-boss,.army-minion.stayed,.army-boss.tease,.army-boss.shake,.army-boss.puff{animation:none}' +
      '.army-minion.next{transform:none}.army-minion.popped{animation:army-fade .4s forwards}}';

  function create(win, grade) {
    var doc = win.document, run = null, strip = null;

    function el(tag, cls, text) {
      var e = doc.createElement(tag);
      e.className = cls;
      if (text !== undefined) e.textContent = text;
      return e;
    }
    function addStyle() {
      if (doc.getElementById('army-style')) return;
      var s = doc.createElement('style');
      s.id = 'army-style';
      s.textContent = CSS;
      (doc.head || doc.documentElement).appendChild(s);
    }
    function reduced() {
      try { return win.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
    }
    function line(key, n) { return win.Bosses.text(run.boss, key, grade, n); }
    function face(mood, cls) {
      var f = el('div', 'army-boss' + (cls ? ' ' + cls : ''));
      f.innerHTML = win.Bosses.svg(run.boss, mood);
      return f;
    }
    function shown() { return !!strip && strip.isConnected && strip.offsetParent !== null; }
    function later(fn, ms) { win.setTimeout(fn, ms); }
    function remove(node) { if (node && node.parentNode) node.parentNode.removeChild(node); }

    // Pieces fly out of host in every direction, then go.
    function burst(host, count) {
      var pieces = run.boss.pieces, far = host === strip ? 40 : 160;
      for (var i = 0; i < count; i++) {
        var a = i / count * Math.PI * 2, p = el('span', 'army-piece', pieces[i % pieces.length]);
        p.style.setProperty('--dx', Math.round(Math.cos(a) * far * (0.6 + Math.random() * 0.4)) + 'px');
        p.style.setProperty('--dy', Math.round(Math.sin(a) * far * (0.6 + Math.random() * 0.4)) + 'px');
        p.style.setProperty('--r', Math.round(Math.random() * 360) + 'deg');
        host.appendChild(p);
        later(remove.bind(null, p), 900);
      }
    }

    function stop() {
      run = null;
      remove(strip);
      strip = null;
    }

    // n = the stage's real question count; screen = the game's quiz screen (the strip goes first inside it).
    function start(n, screen) {
      stop();
      if (!screen || !(n > 0) || !win.Bosses) return;
      addStyle();
      var week = win.Boss && win.Boss.current ? win.Boss.current().week : '';
      run = { boss: win.Bosses.ofWeek(week), m: model(n), live: true };
      strip = el('div', 'army');
      strip.setAttribute('role', 'group');
      strip.setAttribute('aria-label', win.Bosses.name(run.boss, grade));
      var say = el('p', 'army-say', line('hello', n)), row = el('div', 'army-row');
      say.setAttribute('aria-live', 'polite');
      for (var i = 0; i < n; i++) {
        var mi = el('span', 'army-minion' + (i === 0 ? ' next' : ''));
        mi.innerHTML = win.Bosses.minionSvg(run.boss);
        row.appendChild(mi);
      }
      strip.appendChild(face('normal'));
      strip.appendChild(say);
      strip.appendChild(row);
      screen.insertBefore(strip, screen.firstChild);
    }

    function hit(correct) {
      if (!run || !run.live || !shown()) return;
      var i = step(run.m, correct);
      if (i < 0) return;
      var all = strip.querySelectorAll('.army-minion'), mi = all[i];
      mi.classList.remove('next');
      if (all[i + 1]) all[i + 1].classList.add('next');
      if (correct) {
        mi.classList.add('popped');
        if (reduced()) mi.appendChild(el('span', 'army-star', '⭐'));
        else burst(mi, 6);
        if (win.Fx && win.Fx.pop) win.Fx.pop();
        return;
      }
      mi.classList.add('stayed');
      var boss = strip.querySelector('.army-boss');
      boss.classList.remove('tease');
      void boss.offsetWidth;
      boss.classList.add('tease');
      strip.querySelector('.army-say').textContent = line('tease');
    }

    // The results screen is up by now, so the line shows in a small card at the top that nobody has to tap.
    function card(mood, text) {
      var c = el('div', 'army-card');
      c.setAttribute('role', 'status');
      c.appendChild(face(mood, mood === 'ouch' ? 'shake' : ''));
      c.appendChild(el('p', '', text));
      doc.body.appendChild(c);
      later(remove.bind(null, c), CARD_MS);
    }

    function down() {
      var o = el('div', 'army-burst'), f = face('ouch', reduced() ? '' : 'puff');
      o.setAttribute('aria-hidden', 'true');
      o.appendChild(f);
      doc.body.appendChild(o);
      later(function () {
        if (!run) return;
        f.classList.add('gone');
        if (reduced()) f.appendChild(el('span', 'army-star', '⭐'));
        else burst(f, 28);
        if (win.Fx && win.Fx.pop) win.Fx.pop();
      }, POP_AT);
      later(remove.bind(null, o), DOWN_MS);
    }

    function hold(ms) { if (win.Fx && win.Fx.hold) win.Fx.hold(ms); }

    // result: 'none' | 'miss' | 'hit' | 'down'; left = stages still open.
    function end(result, left) {
      if (!run) return;
      if (result === 'none') { stop(); return; }
      run.live = false;
      if (result === 'miss') { card('normal', line('home')); hold(CARD_MS); }
      else if (result === 'hit') { card('ouch', line('ouch', left)); hold(CARD_MS); }
      else if (result === 'down') { down(); hold(DOWN_MS); }
    }

    return { start: start, hit: hit, end: end, stop: stop, running: function () { return !!(run && run.live); } };
  }

  var exported = { model: model, step: step, CARD_MS: CARD_MS, DOWN_MS: DOWN_MS };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  try {
    var script = root.document && root.document.currentScript;
    root.Army = create(root, script ? script.getAttribute('data-grade') : 'grade5');
  } catch (e) {}
})(this);
