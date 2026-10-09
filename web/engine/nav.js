/* The top bar in every game: ← Back, 🏠 Home (the lobby) and ☰ Menu, the "Leave the quiz?" check
   and the Android back gesture. A game calls Nav.start once and Nav.screen whenever it switches screens. */
(function (root) {
  'use strict';

  var L = root.Lang ? root.Lang.localize : function (t) { return t; };
  function forGrade(grade, table) { return grade === 'grade2' ? L(table) : table; }

  var TEXT = {
    grade5: {
      back: 'Back', home: 'Go to the lobby', menu: 'Menu',
      lessons: '📚 Lessons', lobby: '🏠 Lobby', soundOn: '🔊 Sound on', soundOff: '🔇 Sound off', soundPack: '🎵 Sounds', shop: '🪙 Shop',
      leaveTitle: 'Leave the quiz?', leaveBody: 'Points you earned are kept.',
      keep: 'Keep playing', leave: 'Leave'
    },
    grade2: {
      back: 'Back', home: 'Go to the lobby', menu: 'Menu',
      lessons: '📚 Lessons · Mga Aralin', lobby: '🏠 Lobby', soundOn: '🔊 Sound on · May tunog',
      soundOff: '🔇 Sound off · Walang tunog', soundPack: '🎵 Sounds · Mga tunog', shop: '🪙 Shop · Tindahan',
      leaveTitle: 'Leave the quiz? · Aalis ka na ba sa pagsusulit?',
      leaveBody: 'Points you earned are kept. · Hindi mawawala ang puntos mo.',
      keep: 'Keep playing', leave: 'Leave'
    }
  };

  function lobbyUrl(grade) {
    return '../../../lobby/grade-' + (grade === 'grade2' ? '2' : '5') + '.html';
  }

  // The world page (web/world/) writes this in sessionStorage just before it opens a game.
  var WORLD_RETURN = 'world_return_v1';

  function homeUrl(grade, ret) {
    var g = grade === 'grade2' ? 'grade2' : 'grade5';
    return ret && ret.grade === g ? '../../../world/grade-' + g.slice(5) + '.html' : lobbyUrl(grade);
  }

  function worldReturn(win) {
    try { return JSON.parse(win.sessionStorage.getItem(WORLD_RETURN)); } catch (e) { return null; }
  }

  // The rules, with no DOM: o = { home, lobby, away?, goHome, back?, inRound, go(url), ask(proceed, stay), history }.
  // away: where ← and 🏠 leave the game to (the world when she came from it); the shop always opens in the lobby.
  // History holds at most two entries per game: the game home, plus one {nav: id} entry for whatever inner screen is showing.
  function controller(o) {
    var current = o.home;
    // entry: our {nav} history entry is on top. pendingBacks: popstates still to come from our own h.back() calls.
    var entry = false;
    var pendingBacks = 0;
    var back = o.back || o.goHome;
    var h = o.history;

    function onHome() { return current === o.home; }
    function guard(proceed, stay) {
      if (o.inRound()) o.ask(proceed, stay || function () {});
      else proceed();
    }

    return {
      current: function () { return current; },
      screen: function (id) {
        current = String(id);
        if (onHome()) {
          if (entry) { entry = false; pendingBacks++; h.back(); }
        } else if (entry) {
          h.replaceState({ nav: current }, '');
        } else {
          h.pushState({ nav: current }, '');
          entry = true;
        }
      },
      back: function () {
        if (onHome()) o.go(o.away || o.lobby);
        else guard(back);
      },
      home: function () { guard(function () { o.go(o.away || o.lobby); }); },
      lessons: function () { if (!onHome()) guard(o.goHome); },
      shop: function () { guard(function () { o.go(o.lobby + '#shop'); }); },
      // The browser has already stepped back to the game-home entry when this runs.
      popstate: function () {
        if (pendingBacks > 0) { pendingBacks--; return; }
        entry = false;
        if (onHome()) return;
        guard(back, function () { h.pushState({ nav: current }, ''); entry = true; });
      }
    };
  }

  var CSS =
    '#nav-bar{align-self:stretch;width:100%;position:sticky;top:0;z-index:9000;display:flex;align-items:center;gap:6px;min-height:52px;box-sizing:border-box;' +
      'padding:4px 8px;padding-top:max(4px,env(safe-area-inset-top));background:var(--card,var(--surface,#fff));color:var(--ink,#1d1d1f);' +
      'border-bottom:3px solid var(--accent,#2E6F9E);box-shadow:0 2px 8px rgba(0,0,0,.08);}' +
    '.gnav-btn{min-width:44px;height:44px;border-radius:12px;border:none;background:transparent;color:inherit;font:inherit;font-size:1.4rem;' +
      'line-height:1;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;}' +
    '.gnav-btn:hover,.gnav-item:hover{background:rgba(127,127,127,.14);}' +
    '.gnav-btn:focus-visible,.gnav-item:focus-visible,.gnav-keep:focus-visible,.gnav-leave:focus-visible{outline:3px solid var(--accent,#2E6F9E);outline-offset:2px;}' +
    '.gnav-title{flex:1;min-width:0;font-weight:800;font-size:1.05rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
    '#nav-sheet,#nav-confirm{position:fixed;inset:0;z-index:9500;background:rgba(0,0,0,.35);}' +
    '#nav-confirm{display:flex;align-items:center;justify-content:center;padding:16px;}' +
    '#nav-sheet[hidden],#nav-confirm[hidden]{display:none;}' +
    '.gnav-panel,.gnav-box{background:var(--card,var(--surface,#fff));color:var(--ink,#1d1d1f);box-shadow:0 12px 32px rgba(0,0,0,.25);}' +
    '.gnav-panel{position:absolute;top:58px;right:8px;min-width:220px;max-width:calc(100vw - 16px);border-radius:16px;padding:8px;' +
      'display:flex;flex-direction:column;gap:4px;}' +
    '.gnav-item{min-height:48px;text-align:left;padding:10px 14px;border:none;border-radius:12px;background:transparent;color:inherit;' +
      'font:inherit;font-weight:700;font-size:1rem;cursor:pointer;}' +
    '.gnav-box{width:100%;max-width:360px;border-radius:20px;padding:22px 20px;text-align:center;}' +
    '.gnav-box h2{margin:0 0 6px;font-size:1.3rem;}' +
    '.gnav-box p{margin:0 0 18px;}' +
    '.gnav-sub{display:block;font-size:.85em;font-weight:600;opacity:.8;margin-top:2px;}' +
    '.gnav-keep{display:block;width:100%;min-height:52px;border:none;border-radius:14px;background:var(--ink,#1d1d1f);' +
      'color:var(--card,var(--surface,#fff));font:inherit;font-weight:800;font-size:1.1rem;cursor:pointer;}' +
    '.gnav-leave{display:block;margin:10px auto 0;min-height:44px;padding:8px 18px;border:none;background:transparent;color:inherit;' +
      'font:inherit;font-weight:700;text-decoration:underline;cursor:pointer;}' +
    '@media print{#nav-bar,#nav-sheet,#nav-confirm{display:none !important;}}';

  function create(win, grade) {
    var doc = win.document;
    var t = forGrade(grade, TEXT[grade] || TEXT.grade5);
    var ctl = null, sheet = null, dialog = null, menuBtn = null, soundBtn = null, packBtn = null, keepBtn = null;
    var pending = null, returnFocus = null;

    var api = {
      lobby: lobbyUrl(grade),
      away: homeUrl(grade, worldReturn(win)),
      go: function (url) { win.location.href = url; },
      start: start,
      screen: function (id) { if (ctl) ctl.screen(id); },
      current: function () { return ctl ? ctl.current() : null; }
    };

    function button(id, cls, text, label, onClick) {
      var b = doc.createElement('button');
      b.type = 'button';
      b.id = id;
      b.className = cls;
      b.textContent = text;
      if (label) b.setAttribute('aria-label', label);
      b.addEventListener('click', onClick);
      return b;
    }

    // "English · Filipino" becomes the English line with the Filipino under it.
    function lines(node, text) {
      var parts = text.split(' · ');
      node.textContent = parts[0];
      for (var i = 1; i < parts.length; i++) {
        var sub = doc.createElement('span');
        sub.className = 'gnav-sub';
        sub.textContent = parts[i];
        node.appendChild(sub);
      }
    }

    function renderSound() {
      if (packBtn) packBtn.textContent = t.soundPack + ': ' + win.Fx.packLabel(win.Fx.pack());
      if (!soundBtn) return;
      var m = win.Fx.muted();
      soundBtn.textContent = m ? t.soundOff : t.soundOn;
      soundBtn.setAttribute('aria-checked', m ? 'false' : 'true');
    }

    function nextPack() {
      var ids = win.Fx.packs();
      win.Fx.setPack(ids[(ids.indexOf(win.Fx.pack()) + 1) % ids.length]);
    }

    function openSheet() {
      renderSound();
      sheet.hidden = false;
      menuBtn.setAttribute('aria-expanded', 'true');
      sheet.querySelector('.gnav-item').focus();
    }
    function closeSheet(restoreFocus) {
      if (!sheet || sheet.hidden) return;
      sheet.hidden = true;
      menuBtn.setAttribute('aria-expanded', 'false');
      if (restoreFocus) menuBtn.focus();
    }
    function pick(fn) { return function () { closeSheet(); fn(); }; }

    function ask(proceed, stay) {
      pending = { proceed: proceed, stay: stay };
      if (dialog.hidden) returnFocus = doc.activeElement;
      dialog.hidden = false;
      keepBtn.focus();
    }
    function answer(leave) {
      var p = pending;
      pending = null;
      dialog.hidden = true;
      if (!p) return;
      if (leave) { p.proceed(); return; }
      p.stay();
      if (returnFocus && returnFocus.focus) returnFocus.focus();
    }

    function build(title) {
      var style = doc.createElement('style');
      style.id = 'nav-style';
      style.textContent = CSS;
      doc.head.appendChild(style);

      var bar = doc.createElement('nav');
      bar.id = 'nav-bar';
      bar.setAttribute('aria-label', t.menu);
      var name = doc.createElement('span');
      name.className = 'gnav-title';
      name.textContent = title || doc.title;
      menuBtn = button('nav-menu', 'gnav-btn', '☰', t.menu, function () { if (sheet.hidden) openSheet(); else closeSheet(true); });
      menuBtn.setAttribute('aria-expanded', 'false');
      menuBtn.setAttribute('aria-controls', 'nav-sheet');
      bar.appendChild(button('nav-back', 'gnav-btn', '←', t.back, function () { ctl.back(); }));
      bar.appendChild(name);
      bar.appendChild(button('nav-home', 'gnav-btn', '🏠', t.home, function () { ctl.home(); }));
      bar.appendChild(menuBtn);

      sheet = doc.createElement('div');
      sheet.id = 'nav-sheet';
      sheet.hidden = true;
      var panel = doc.createElement('div');
      panel.className = 'gnav-panel';
      panel.setAttribute('role', 'menu');
      var items = [
        button('nav-lessons', 'gnav-item', t.lessons, null, pick(function () { ctl.lessons(); })),
        button('nav-lobby', 'gnav-item', t.lobby, null, pick(function () { ctl.home(); }))
      ];
      if (win.Fx && win.Fx.setMuted) {
        soundBtn = button('nav-sound', 'gnav-item', '', null, function () { win.Fx.setMuted(!win.Fx.muted()); renderSound(); });
        items.push(soundBtn);
      }
      if (win.Fx && win.Fx.setPack) {
        packBtn = button('nav-pack', 'gnav-item', '', null, function () { nextPack(); renderSound(); });
        items.push(packBtn);
      }
      items.push(button('nav-shop', 'gnav-item', t.shop, null, pick(function () { ctl.shop(); })));
      if (grade === 'grade2' && win.Lang && !win.Lang.filipinoGame()) {
        var fil = win.Lang.button(doc);
        fil.id = 'nav-fil';
        fil.className += ' gnav-item';
        items.push(fil);
      }
      items.forEach(function (b) { b.setAttribute('role', b === soundBtn ? 'menuitemcheckbox' : 'menuitem'); panel.appendChild(b); });
      sheet.appendChild(panel);
      sheet.addEventListener('click', function (e) { if (e.target === sheet) closeSheet(true); });

      dialog = doc.createElement('div');
      dialog.id = 'nav-confirm';
      dialog.hidden = true;
      var box = doc.createElement('div');
      box.className = 'gnav-box';
      box.setAttribute('role', 'alertdialog');
      box.setAttribute('aria-modal', 'true');
      box.setAttribute('aria-labelledby', 'nav-confirm-title');
      var h = doc.createElement('h2');
      h.id = 'nav-confirm-title';
      lines(h, t.leaveTitle);
      var p = doc.createElement('p');
      lines(p, t.leaveBody);
      keepBtn = button('nav-keep', 'gnav-keep', t.keep, null, function () { answer(false); });
      box.appendChild(h);
      box.appendChild(p);
      box.appendChild(keepBtn);
      box.appendChild(button('nav-leave', 'gnav-leave', t.leave, null, function () { answer(true); }));
      dialog.appendChild(box);
      dialog.addEventListener('click', function (e) { if (e.target === dialog) answer(false); });

      doc.body.insertBefore(bar, doc.body.firstChild);
      doc.body.appendChild(sheet);
      doc.body.appendChild(dialog);
    }

    function start(opts) {
      if (ctl) return;
      if (win.history.state && win.history.state.nav) win.history.replaceState(null, '');
      ctl = controller({
        home: opts.home,
        lobby: api.lobby,
        away: api.away,
        goHome: opts.goHome,
        back: opts.back,
        inRound: opts.inRound || function () { return false; },
        go: function (url) { api.go(url); },
        ask: ask,
        history: win.history
      });
      build(opts.title);
      win.addEventListener('popstate', function () { closeSheet(); ctl.popstate(); });
      doc.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape') return;
        if (!dialog.hidden) answer(false);
        else closeSheet(true);
      });
    }

    return api;
  }

  var exported = { TEXT: TEXT, lobbyUrl: lobbyUrl, homeUrl: homeUrl, WORLD_RETURN: WORLD_RETURN, controller: controller };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  try {
    var script = root.document && root.document.currentScript;
    root.Nav = create(root, script ? script.getAttribute('data-grade') : null);
  } catch (e) {}
})(this);
