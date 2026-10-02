/* In-quiz power-ups, paid with coins. Loaded by every game after the wallet file.
   Each game calls PowerUps.offer({...}) when it shows a question (or PowerUps.skip() if it cannot use power-ups), PowerUps.answered()
   when the child answers (it says whether the answer was helped), and PowerUps.shield()
   on a wrong answer (it says whether a Streak Shield kept the streak).
   Ask Family runs on trust: the app cannot tell whether anyone helped. Paying is final (parent's choice). */
(function (root) {
  'use strict';

  var MAX_PER_QUIZ = 2;
  var KINDS = ['hint', 'fifty', 'second', 'shield', 'later', 'family'];
  var HELPERS = ['ate', 'mommy', 'tatay'];

  // Which wrong options 50/50 crosses out: half of all options, never the right one.
  function pickOut(count, correct, random) {
    var wrong = [];
    for (var i = 0; i < count; i++) if (i !== correct) wrong.push(i);
    for (var j = wrong.length - 1; j > 0; j--) {
      var k = Math.floor(random() * (j + 1));
      var t = wrong[j]; wrong[j] = wrong[k]; wrong[k] = t;
    }
    return wrong.slice(0, Math.floor(count / 2)).sort(function (a, b) { return a - b; });
  }

  // The rules, without any page: what can be used now, and paying for it.
  function createCore(wallet, history, prices) {
    var quiz = null, usedInQuiz = 0, shieldOn = false, current = null;

    // "family" is the Ask Family button; each helper ("ate", "mommy", "tatay") has its own price.
    function cost(kind) {
      if (kind !== 'family') return prices[kind];
      return Math.min.apply(null, current.info.helpers.map(function (h) { return prices[h]; }));
    }

    function helpedSoFar() {
      return !!(current.used.hint || current.used.fifty || current.used.second || current.used.family);
    }

    function status(kind) {
      if (!current) return 'na';
      var info = current.info;
      if (info.exam) return 'exam';
      if (current.done) return 'na';
      var helper = HELPERS.indexOf(kind) >= 0;
      if (kind === 'hint' && !info.tip) return 'na';
      if ((kind === 'fifty' || kind === 'second') && !(info.optionCount >= 3)) return 'na';
      if (kind === 'shield' && (shieldOn || !(info.streak >= 2))) return 'na';
      // Skipping after help would carry that help into a full-points answer later.
      if (kind === 'later' && (!info.canSkip || helpedSoFar())) return 'na';
      if (kind === 'family' && !info.helpers.length) return 'na';
      if (helper && info.helpers.indexOf(kind) < 0) return 'na';
      if (current.used[helper ? 'family' : kind]) return 'used';
      if (usedInQuiz >= MAX_PER_QUIZ) return 'max';
      if (wallet.balanceStored() < cost(kind)) return 'poor';
      return 'ok';
    }

    return {
      // A new quiz array means a new round: the per-quiz limit and any shield start over.
      question: function (info) {
        if (info.quiz !== quiz) { quiz = info.quiz; usedInQuiz = 0; shieldOn = false; }
        if (!info.helpers) info.helpers = [];
        current = { info: info, used: {}, done: false, secondSpent: false };
      },
      status: status,
      use: function (kind) {
        if (kind === 'family' || status(kind) !== 'ok' || !wallet.spend(prices[kind])) return false;
        if (kind === 'shield') shieldOn = true;
        else if (HELPERS.indexOf(kind) >= 0) current.used.family = kind;
        else current.used[kind] = true;
        usedInQuiz++;
        if (history) history.powerUpUsed(current.info.historyId, kind, prices[kind], current.info.q || '');
        return true;
      },
      helperAsked: function () { return current && current.used.family || ''; },
      // A wrong first pick with Second Chance on: true means pick again instead of answering.
      secondChance: function () {
        if (!current || current.done || !current.used.second || current.secondSpent) return false;
        current.secondSpent = true;
        return true;
      },
      // Helped = hint, 50/50 or family used, or a Second Chance actually needed. Shield and Later help no answer.
      answered: function () {
        if (!current || current.done) return false;
        current.done = true;
        return !!(current.used.hint || current.used.fifty || current.used.family || current.secondSpent);
      },
      shield: function () {
        if (!shieldOn) return false;
        shieldOn = false;
        return true;
      },
      shieldOn: function () { return shieldOn; },
      left: function () { return MAX_PER_QUIZ - usedInQuiz; }
    };
  }

  var HELPER_LABEL = { ate: ['👧', 'Ate'], mommy: ['👩', 'Mommy'], tatay: ['👨', 'Tatay'] };

  var TEXT = {
    grade5: {
      hint: '💡 Hint',
      fifty: '✂️ 50/50',
      second: '🔁 2nd Chance',
      shield: '🛡️ Shield',
      later: '⏭️ Later',
      confirm: function (n) { return 'Tap again to pay ' + n + ' 🪙'; },
      left: function (n) { return '⚡ Power-ups left in this quiz: ' + n; },
      max: '⚡ You used both power-ups for this quiz.',
      poor: 'Not enough coins for that one yet.',
      exam: '🚫 No power-ups in the Mock Exam. Show what you know!',
      helped: '🤝 With help, a right answer gets half points and your 🔥 streak waits.',
      secondOn: '🔁 Second Chance is on: if you miss, you can try again.',
      tryAgain: '🔁 Not that one. Try again!',
      shieldOn: '🛡️ Shield is on: your next miss keeps your 🔥 streak.',
      shieldSaved: '🛡️ Your shield saved your 🔥 streak!',
      saved: '⏭️ Saved for later. It comes back at the end.',
      family: '👨‍👩‍👧 Ask Family',
      helpers: ['mommy', 'tatay'],
      askTitle: function (name) { return '🙋 Go ask ' + name + '!'; },
      askBody: function (name) { return 'Show ' + name + ' this question. ' + name + ' explains the idea but does not say the answer. Then you choose.'; },
      askEn: function () { return ''; }
    },
    grade2: {
      hint: '💡 Hint',
      fifty: '✂️ 50/50',
      second: '🔁 2nd Chance',
      shield: '🛡️ Shield',
      later: '⏭️ Later',
      confirm: function (n) { return 'Tap again to pay ' + n + ' 🪙'; },
      left: function (n) { return ['⚡ Power-ups na natitira: ' + n, 'Power-ups left in this quiz: ' + n]; },
      max: ['⚡ Nagamit mo na ang 2 power-ups sa quiz na ito.', 'You used both power-ups for this quiz.'],
      poor: ['Kulang pa ang coins mo para diyan.', 'Not enough coins for that one yet.'],
      exam: ['🚫 Walang power-ups sa Mock Exam. Kaya mo yan!', 'No power-ups in the Mock Exam. You can do it!'],
      helped: ['🤝 May tulong: kalahati lang ang points kapag tama, at hindi tataas ang 🔥 streak.', 'With help, a right answer gets half points and your streak does not grow.'],
      secondOn: ['🔁 2nd Chance: kapag mali, puwede kang sumubok ulit.', 'If you miss, you can try again.'],
      tryAgain: ['🔁 Hindi iyan. Subukan ulit!', 'Not that one. Try again!'],
      shieldOn: ['🛡️ Shield: hindi mawawala ang 🔥 streak mo sa susunod na mali.', 'Your next miss keeps your streak.'],
      shieldSaved: ['🛡️ Niligtas ng shield ang 🔥 streak mo!', 'Your shield saved your streak!'],
      saved: ['⏭️ Mamaya na: babalik ito sa dulo.', 'Saved for later. It comes back at the end.'],
      family: '👨‍👩‍👧 Ask Family',
      helpers: ['ate', 'mommy', 'tatay'],
      askTitle: function (name) { return '🙋 Tanungin si ' + name + '! · Go ask ' + name + '!'; },
      askBody: function (name) { return 'Ipakita kay ' + name + ' ang tanong. Ipapaliwanag ni ' + name + ' ang aralin, pero hindi sasabihin ang sagot. Ikaw pa rin ang pipili.'; },
      askEn: function (name) { return 'Show ' + name + ' this question. ' + name + ' explains the lesson but does not say the answer. You still choose.'; }
    }
  };

  var UI_CSS =
    '.pu-bar{margin:10px 0;padding:8px 10px;border:2px dashed #F2C94C;border-radius:14px;background:#FFFBEA;color:#6B4A00;font-size:.88rem;}' +
    '.pu-bar[hidden],.pu-bar [hidden]{display:none;}' +
    '.pu-row{display:flex;flex-wrap:wrap;gap:8px;}' +
    '.pu-btn{flex:1 1 auto;white-space:nowrap;min-height:44px;padding:8px 12px;border:2px solid #F2C94C;border-radius:999px;background:#FFF6D8;color:#6B4A00;' +
      'font:inherit;font-weight:800;cursor:pointer;}' +
    '.pu-btn:disabled{opacity:.45;cursor:default;}' +
    '.pu-btn.pu-armed{background:#F2C94C;color:#3D2A00;}' +
    '.pu-btn:focus-visible{outline:3px solid #6B4A00;outline-offset:2px;}' +
    '.pu-note{margin-top:6px;font-weight:700;}' +
    '.pu-note div+div{margin-top:3px;}' +
    '.pu-note .pu-en{margin-top:1px;font-weight:600;font-size:.82rem;color:#6B5E57;}' +
    '.pu-tip{margin-top:8px;padding:8px 10px;border-left:5px solid #F2C94C;border-radius:8px;background:#fff;color:#2B2320;line-height:1.5;}' +
    '.pu-tip .pu-en{margin-top:4px;font-size:.85rem;color:#6B5E57;}' +
    '.pu-out{opacity:.35;text-decoration:line-through;}' +
    '.pu-tried{border-color:#D9534F !important;}' +
    '.pu-pick{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;}' +
    '.pu-ask{margin-top:8px;padding:10px 12px;border-left:5px solid #2E9E5B;border-radius:8px;background:#fff;color:#2B2320;line-height:1.5;}' +
    '.pu-ask b{display:block;font-size:1rem;}' +
    '.pu-ask .pu-en{margin-top:4px;font-size:.85rem;color:#6B5E57;}';

  function mountUi(win, core, T, prices) {
    var doc = win.document, bar = null, info = null, armed = null, armTimer = null, styled = false, nextFlash = '';

    function el(tag, cls, text) {
      var e = doc.createElement(tag);
      if (cls) e.className = cls;
      if (text !== undefined) e.textContent = text;
      return e;
    }

    function disarm() {
      armed = null;
      clearTimeout(armTimer);
    }

    function build() {
      if (!styled) { doc.head.appendChild(el('style', '', UI_CSS)); styled = true; }
      bar = el('div', 'pu-bar');
      var row = el('div', 'pu-row');
      KINDS.forEach(function (kind) {
        var b = el('button', 'pu-btn');
        b.type = 'button';
        b.setAttribute('data-pu', kind);
        b.addEventListener('click', function () { tap(kind); });
        row.appendChild(b);
      });
      bar.appendChild(row);
      var pick = el('div', 'pu-pick');
      HELPERS.forEach(function (helper) {
        var b = el('button', 'pu-btn');
        b.type = 'button';
        b.setAttribute('data-pu', helper);
        b.addEventListener('click', function () { tap(helper); });
        pick.appendChild(b);
      });
      bar.appendChild(pick);
      var ask = el('div', 'pu-ask');
      ask.appendChild(el('b'));
      ask.appendChild(el('div', 'pu-ask-body'));
      ask.appendChild(el('div', 'pu-en'));
      bar.appendChild(ask);
      bar.appendChild(el('div', 'pu-note'));
      bar.appendChild(el('div', 'pu-tip'));
      // Capture phase runs before the game's own click handler, so a Second Chance miss never reaches the game.
      doc.addEventListener('click', secondChanceClick, true);
    }

    // A note is a string, or [Filipino, English] for Grade 2: the English goes on its own smaller line.
    function addLine(line) {
      var note = bar.querySelector('.pu-note');
      var div = el('div', '', Array.isArray(line) ? line[0] : line);
      if (Array.isArray(line)) div.appendChild(el('div', 'pu-en', line[1]));
      note.appendChild(div);
    }

    function noteLines() {
      if (info.answered) return [info.helped ? T.helped : '', info.flash];
      var poor = KINDS.some(function (k) { return core.status(k) === 'poor'; });
      return [
        core.left() > 0 ? T.left(core.left()) : T.max,
        poor ? T.poor : '',
        info.usedNow.second && !info.secondSpent ? T.secondOn : '',
        info.secondSpent ? T.tryAgain : '',
        core.shieldOn() ? T.shieldOn : '',
        info.flash
      ];
    }

    function render() {
      var row = bar.querySelector('.pu-row'), note = bar.querySelector('.pu-note');
      var pick = bar.querySelector('.pu-pick'), ask = bar.querySelector('.pu-ask');
      note.textContent = '';
      if (core.status('hint') === 'exam') {
        row.hidden = true;
        pick.hidden = true;
        ask.hidden = true;
        addLine(T.exam);
        note.hidden = false;
        bar.hidden = false;
        return;
      }
      var shown = false;
      Array.prototype.forEach.call(row.children, function (b) {
        var kind = b.getAttribute('data-pu'), s = core.status(kind);
        b.hidden = s === 'na' && !info.usedNow[kind];
        b.disabled = s !== 'ok';
        b.classList.toggle('pu-armed', armed === kind || (kind === 'family' && info.picking));
        b.textContent = armed === kind ? T.confirm(prices[kind]) : kind === 'family' ? T.family : T[kind] + ' · ' + prices[kind] + ' 🪙';
        if (!b.hidden) shown = true;
      });
      row.hidden = info.answered || core.left() === 0;
      pick.hidden = row.hidden || !info.picking;
      Array.prototype.forEach.call(pick.children, function (b) {
        var helper = b.getAttribute('data-pu'), s = core.status(helper);
        b.hidden = s === 'na';
        b.disabled = s !== 'ok';
        b.classList.toggle('pu-armed', armed === helper);
        b.textContent = armed === helper ? T.confirm(prices[helper]) : HELPER_LABEL[helper].join(' ') + ' · ' + prices[helper] + ' 🪙';
      });
      var asked = core.helperAsked();
      ask.hidden = !asked || info.answered;
      if (asked) {
        var name = HELPER_LABEL[asked][1];
        ask.querySelector('b').textContent = T.askTitle(name);
        ask.querySelector('.pu-ask-body').textContent = T.askBody(name);
        ask.querySelector('.pu-en').textContent = T.askEn(name);
        ask.querySelector('.pu-en').hidden = !T.askEn(name);
        shown = true;
      }
      var lines = noteLines().filter(Boolean);
      lines.forEach(addLine);
      note.hidden = !lines.length;
      bar.hidden = info.answered ? !lines.length && bar.querySelector('.pu-tip').hidden : !shown;
    }

    function refreshCoins() {
      var w = win.Wallet;
      if (w.renderCoins) w.renderCoins();
      var n = w.balanceStored();
      Array.prototype.forEach.call(doc.querySelectorAll('.coins-live'), function (s) { s.textContent = '🪙 ' + n; });
    }

    function tap(kind) {
      if (!info || core.status(kind) !== 'ok') return;
      if (kind === 'family') {
        disarm();
        info.picking = !info.picking;
        render();
        return;
      }
      if (armed !== kind) {
        disarm();
        armed = kind;
        armTimer = setTimeout(function () { armed = null; render(); }, 4000);
        render();
        return;
      }
      disarm();
      if (!core.use(kind)) { render(); return; }
      info.usedNow[HELPERS.indexOf(kind) >= 0 ? 'family' : kind] = true;
      info.picking = false;
      refreshCoins();
      if (kind === 'hint') showTip();
      if (kind === 'fifty') crossOut();
      if (kind === 'later') return saveForLater();
      render();
    }

    function showTip() {
      var box = bar.querySelector('.pu-tip');
      // Tip text is author-written lesson content from the same page, never user input.
      box.innerHTML = '<b>' + T.hint + ':</b> ' + info.tip +
        (info.tipEn ? '<div class="pu-en"><b>Sa English:</b> ' + info.tipEn + '</div>' : '');
      box.hidden = false;
    }

    function disable(b, cls) {
      b.classList.add('pu-out');
      if (cls) b.classList.add(cls);
      b.disabled = true;
      info.out.push(b);
    }

    function crossOut() {
      pickOut(info.buttons.length, info.correct, Math.random).forEach(function (i) { disable(info.buttons[i]); });
    }

    // The question moves to the end of this round and the next one shows in its place.
    function saveForLater() {
      info.quiz.push(info.quiz.splice(info.index, 1)[0]);
      nextFlash = T.saved;
      info.rerender();
    }

    function secondChanceClick(ev) {
      if (!info || info.answered || !info.usedNow.second || info.secondSpent) return;
      var target = ev.target && ev.target.closest ? ev.target.closest('button') : null;
      var i = info.buttons.indexOf(target);
      if (i < 0 || i === info.correct || target.disabled) return;
      ev.stopImmediatePropagation();
      ev.preventDefault();
      if (!core.secondChance()) return;
      info.secondSpent = true;
      disable(target, 'pu-tried');
      if (win.Fx) win.Fx.wrong();
      render();
    }

    return {
      offer: function (opts) {
        if (!opts.before || !opts.before.parentNode) return;
        if (!bar) build();
        disarm();
        var buttons = Array.prototype.slice.call(opts.options || []);
        info = {
          tip: opts.tip || '', tipEn: opts.tipEn || '', buttons: buttons, correct: opts.correct,
          quiz: opts.quiz, index: opts.index, rerender: opts.rerender,
          out: [], usedNow: {}, picking: false, answered: false, helped: false, secondSpent: false, flash: nextFlash
        };
        nextFlash = '';
        core.question({
          quiz: opts.quiz, exam: !!opts.exam, tip: info.tip, optionCount: buttons.length, streak: opts.streak,
          canSkip: typeof opts.rerender === 'function' && opts.index >= 0 && opts.index < opts.quiz.length - 1,
          historyId: opts.historyId, q: opts.q, helpers: T.helpers.slice()
        });
        var tipBox = bar.querySelector('.pu-tip');
        tipBox.hidden = true;
        tipBox.textContent = '';
        opts.before.parentNode.insertBefore(bar, opts.before);
        render();
      },
      // No bar and no state for a question that cannot use power-ups.
      skip: function () {
        disarm();
        info = null;
        if (bar && bar.parentNode) bar.parentNode.removeChild(bar);
      },
      answered: function () {
        if (!info || info.answered) return false;
        disarm();
        info.answered = true;
        info.helped = core.answered();
        info.flash = '';
        // Crossed-out answers come back after answering, so they can still be tapped to see why.
        info.out.forEach(function (b) { b.disabled = false; });
        render();
        return info.helped;
      },
      shield: function () {
        if (!core.shield()) return false;
        if (info) { info.flash = T.shieldSaved; render(); }
        return true;
      }
    };
  }

  var exported = { pickOut: pickOut, createCore: createCore, TEXT: TEXT, MAX_PER_QUIZ: MAX_PER_QUIZ, KINDS: KINDS, HELPERS: HELPERS };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  try {
    var script = root.document && root.document.currentScript;
    var grade = script ? script.getAttribute('data-grade') : null;
    var wallet = root.Wallet;
    if (!wallet || !wallet.spend || !TEXT[grade]) return;
    var core = createCore(wallet, root.StudyHistory || null, wallet.powerUps);
    root.PowerUps = mountUi(root, core, TEXT[grade], wallet.powerUps);
  } catch (e) {}
})(this);
