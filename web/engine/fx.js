/* Sound effects and streak call-outs for every game. Sounds are synthesized with the
   Web Audio API, so there are no audio files to license or download. */
(function (root) {
  'use strict';

  var MUTE_KEY = 'study_fx_muted_v1';

  // Mobile Legends-style streak announcer, one tier per answer in a row.
  var TIERS = [
    { at: 2, word: 'DOUBLE KILL!', say: 'Double kill!', color: '#3b82f6', glow: '#93c5fd', notes: 2 },
    { at: 3, word: 'TRIPLE KILL!', say: 'Triple kill!', color: '#10b981', glow: '#6ee7b7', notes: 3 },
    { at: 4, word: 'MANIAC!', say: 'Maniac!', color: '#a855f7', glow: '#d8b4fe', notes: 4 },
    { at: 5, word: 'SAVAGE!!!', say: 'Savage!', color: '#ef4444', glow: '#fca5a5', notes: 5, big: true },
    { at: 6, word: 'UNSTOPPABLE!', say: 'Unstoppable!', color: '#f97316', glow: '#fdba74', notes: 5, big: true },
    { at: 7, word: 'GODLIKE!', say: 'Godlike!', color: '#eab308', glow: '#fde047', notes: 6, big: true },
    { at: 8, word: 'LEGENDARY!', say: 'Legendary!', color: '#f59e0b', glow: '#fef08a', notes: 7, big: true, rays: true }
  ];

  var SUBTITLE = {
    grade5: function (n) { return '🔥 ' + n + ' in a row!'; },
    grade2: function (n) { return '🔥 ' + n + ' sunod-sunod na tama! · ' + n + ' in a row!'; }
  };

  function tierFor(streak) {
    var found = null;
    for (var i = 0; i < TIERS.length; i++) if (streak >= TIERS[i].at) found = TIERS[i];
    return found;
  }

  function create(win, grade) {
    var doc = win.document;
    var ctx = null;
    var layer = null;
    var hideTimer = null;
    var subtitle = SUBTITLE[grade] || SUBTITLE.grade5;

    function read(key) { try { return win.localStorage.getItem(key); } catch (e) { return null; } }
    function write(key, val) { try { win.localStorage.setItem(key, val); } catch (e) {} }

    function muted() { return read(MUTE_KEY) === '1'; }

    function reducedMotion() {
      return !!(win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }

    function audio() {
      if (muted()) return null;
      var AC = win.AudioContext || win.webkitAudioContext;
      if (!AC) return null;
      try {
        if (!ctx) ctx = new AC();
        if (ctx.state === 'suspended') ctx.resume();
      } catch (e) { return null; }
      return ctx;
    }

    function tone(freq, start, dur, type, vol, slideTo) {
      var c = audio();
      if (!c) return;
      var t = c.currentTime + start;
      var osc = c.createOscillator();
      var gain = c.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(vol || 0.2, t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    }

    // C major pentatonic, so any run of notes sounds happy.
    var SCALE = [523, 587, 659, 784, 880, 1047, 1175, 1319, 1568, 1760];

    function arpeggio(count, step, type, vol) {
      for (var i = 0; i < count; i++) tone(SCALE[Math.min(i + 2, SCALE.length - 1)], 0.15 + i * step, 0.22, type, vol);
    }

    function say(text) {
      if (muted() || !win.speechSynthesis || !win.SpeechSynthesisUtterance) return;
      try {
        win.speechSynthesis.cancel();
        var u = new win.SpeechSynthesisUtterance(text);
        u.lang = 'en-US';
        u.rate = 1.05;
        u.pitch = 0.7;
        u.volume = 1;
        win.speechSynthesis.speak(u);
      } catch (e) {}
    }

    function addStyle() {
      if (doc.getElementById('fx-style')) return;
      var css =
        '#fx-layer{position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden;}' +
        '#fx-layer .fx-flash{position:absolute;inset:0;opacity:0;animation:fx-flash .5s ease-out;}' +
        '#fx-layer .fx-callout{position:absolute;left:0;right:0;top:22%;text-align:center;font-family:Impact,"Arial Black","Segoe UI",sans-serif;' +
        'animation:fx-slam 1.5s cubic-bezier(.2,1.4,.4,1) forwards;}' +
        '#fx-layer .fx-word{display:inline-block;font-size:clamp(44px,13vw,110px);font-weight:900;font-style:italic;letter-spacing:2px;line-height:1;' +
        'color:#fff;-webkit-text-stroke:3px var(--fx-color);paint-order:stroke fill;' +
        'text-shadow:0 0 18px var(--fx-glow),0 0 36px var(--fx-color),4px 6px 0 rgba(0,0,0,.35);}' +
        '#fx-layer .fx-big .fx-word{animation:fx-shake .35s .12s 2;}' +
        '#fx-layer .fx-sub{margin-top:8px;font:800 clamp(16px,4.5vw,26px)/1.2 "Segoe UI",system-ui,sans-serif;color:#fff;' +
        'text-shadow:0 2px 6px rgba(0,0,0,.55),0 0 12px var(--fx-color);}' +
        '#fx-layer .fx-rays{position:absolute;left:50%;top:calc(22% + 50px);width:900px;height:900px;margin:-450px 0 0 -450px;opacity:.55;' +
        'background:repeating-conic-gradient(from 0deg,var(--fx-glow) 0 8deg,transparent 8deg 22deg);' +
        '-webkit-mask:radial-gradient(circle,#000 0,transparent 60%);mask:radial-gradient(circle,#000 0,transparent 60%);' +
        'animation:fx-spin 1.6s linear forwards;}' +
        '#fx-layer .fx-bit{position:absolute;width:10px;height:14px;border-radius:2px;animation:fx-fall var(--d) ease-in forwards;}' +
        '@keyframes fx-flash{0%{opacity:.45}100%{opacity:0}}' +
        '@keyframes fx-slam{0%{transform:scale(2.8);opacity:0}14%{transform:scale(1);opacity:1}78%{transform:scale(1);opacity:1}100%{transform:translateY(-40px) scale(.9);opacity:0}}' +
        '@keyframes fx-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-9px) rotate(-2deg)}75%{transform:translateX(9px) rotate(2deg)}}' +
        '@keyframes fx-spin{0%{transform:rotate(0) scale(.4);opacity:0}20%{opacity:.55}100%{transform:rotate(60deg) scale(1.1);opacity:0}}' +
        '@keyframes fx-fall{0%{transform:translate(0,0) rotate(0);opacity:1}100%{transform:translate(var(--x),var(--y)) rotate(var(--r));opacity:0}}' +
        '@keyframes fx-fade{0%,100%{opacity:0}15%,80%{opacity:1}}' +
        '@media (prefers-reduced-motion:reduce){#fx-layer .fx-callout{animation:fx-fade 1.5s forwards}#fx-layer .fx-big .fx-word{animation:none}}' +
        '#fx-mute{position:fixed;left:12px;bottom:12px;z-index:9998;width:44px;height:44px;border-radius:50%;border:2px solid rgba(0,0,0,.12);' +
        'background:rgba(255,255,255,.88);font-size:20px;line-height:1;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.18);padding:0;}' +
        '#fx-mute:focus-visible{outline:3px solid #3b82f6;outline-offset:2px;}' +
        '@media print{#fx-mute,#fx-layer{display:none}}';
      var style = doc.createElement('style');
      style.id = 'fx-style';
      style.textContent = css;
      doc.head.appendChild(style);
    }

    function getLayer() {
      if (!layer) {
        layer = doc.createElement('div');
        layer.id = 'fx-layer';
        layer.setAttribute('aria-hidden', 'true');
        doc.body.appendChild(layer);
      }
      return layer;
    }

    function confetti(box, colors, count) {
      for (var i = 0; i < count; i++) {
        var bit = doc.createElement('span');
        bit.className = 'fx-bit';
        var angle = Math.random() * Math.PI * 2;
        var dist = 140 + Math.random() * 260;
        bit.style.left = '50%';
        bit.style.top = 'calc(22% + 50px)';
        bit.style.background = colors[i % colors.length];
        bit.style.setProperty('--x', Math.round(Math.cos(angle) * dist) + 'px');
        bit.style.setProperty('--y', Math.round(Math.sin(angle) * dist + 220) + 'px');
        bit.style.setProperty('--r', Math.round(Math.random() * 720 - 360) + 'deg');
        bit.style.setProperty('--d', (0.9 + Math.random() * 0.7).toFixed(2) + 's');
        box.appendChild(bit);
      }
    }

    function show(word, sub, tier) {
      var box = getLayer();
      box.innerHTML = '';
      box.style.setProperty('--fx-color', tier.color);
      box.style.setProperty('--fx-glow', tier.glow);
      var calm = reducedMotion();
      if (tier.big && !calm) {
        var flash = doc.createElement('div');
        flash.className = 'fx-flash';
        flash.style.background = 'radial-gradient(circle at 50% 30%,' + tier.glow + ',transparent 70%)';
        box.appendChild(flash);
      }
      if (tier.rays && !calm) {
        var rays = doc.createElement('div');
        rays.className = 'fx-rays';
        box.appendChild(rays);
      }
      var callout = doc.createElement('div');
      callout.className = 'fx-callout' + (tier.big ? ' fx-big' : '');
      var w = doc.createElement('div');
      w.className = 'fx-word';
      w.textContent = word;
      var s = doc.createElement('div');
      s.className = 'fx-sub';
      s.textContent = sub;
      callout.appendChild(w);
      callout.appendChild(s);
      box.appendChild(callout);
      if (tier.big && !calm) confetti(box, [tier.color, tier.glow, '#facc15', '#ffffff', '#22d3ee'], 36);
      clearTimeout(hideTimer);
      hideTimer = setTimeout(function () { box.innerHTML = ''; }, 1700);
    }

    function correct(streak) {
      tone(880, 0, 0.12, 'sine', 0.18);
      tone(1319, 0.08, 0.2, 'sine', 0.18);
      var tier = tierFor(streak);
      if (!tier) return;
      arpeggio(tier.notes, 0.07, tier.big ? 'square' : 'triangle', tier.big ? 0.07 : 0.12);
      if (tier.big) tone(110, 0.05, 0.4, 'sawtooth', 0.08, 55);
      say(tier.say);
      show(tier.word, subtitle(streak), tier);
    }

    function wrong() {
      tone(300, 0, 0.18, 'triangle', 0.16, 200);
      tone(200, 0.14, 0.26, 'triangle', 0.14, 150);
    }

    function noise(start, dur, vol, cutoff) {
      var c = audio();
      if (!c) return;
      var t = c.currentTime + start;
      var buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
      var data = buf.getChannelData(0);
      for (var i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      var src = c.createBufferSource();
      src.buffer = buf;
      var filter = c.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = cutoff;
      var gain = c.createGain();
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(c.destination);
      src.start(t);
    }

    // Cash register: a drawer "ka" click, then two bright bell "ching"s.
    function purchase() {
      noise(0, 0.06, 0.3, 1500);
      [2093, 2637, 3136, 4186].forEach(function (f) { tone(f, 0.07, 0.25, 'sine', 0.05); });
      noise(0.07, 0.04, 0.15, 5000);
      [2349, 2960, 3520, 4699].forEach(function (f) { tone(f, 0.2, 0.7, 'sine', 0.06); });
      noise(0.2, 0.05, 0.18, 5000);
    }

    function finish(stars) {
      if (stars >= 3) {
        [523, 659, 784, 1047].forEach(function (f, i) { tone(f, i * 0.12, 0.25, 'triangle', 0.16); });
        tone(1047, 0.5, 0.6, 'triangle', 0.14);
        tone(1319, 0.5, 0.6, 'sine', 0.1);
        tone(1568, 0.5, 0.6, 'sine', 0.08);
        show('PERFECT!', '⭐⭐⭐', { color: '#eab308', glow: '#fde047', big: true, rays: true });
      } else if (stars >= 1) {
        [523, 659, 784].forEach(function (f, i) { tone(f, i * 0.12, 0.25, 'triangle', 0.15); });
        tone(1047, 0.38, 0.4, 'triangle', 0.13);
      } else {
        tone(523, 0, 0.25, 'triangle', 0.13);
        tone(784, 0.15, 0.35, 'triangle', 0.13);
      }
    }

    function renderMute(btn) {
      var m = muted();
      btn.textContent = m ? '🔇' : '🔊';
      btn.setAttribute('aria-label', m ? 'Sound off. Tap to turn sound on' : 'Sound on. Tap to turn sound off');
      btn.setAttribute('aria-pressed', m ? 'true' : 'false');
    }

    function mountMute() {
      if (doc.getElementById('fx-mute')) return;
      var btn = doc.createElement('button');
      btn.id = 'fx-mute';
      btn.type = 'button';
      renderMute(btn);
      btn.addEventListener('click', function () {
        write(MUTE_KEY, muted() ? '0' : '1');
        if (muted() && win.speechSynthesis) win.speechSynthesis.cancel();
        renderMute(btn);
        if (!muted()) tone(880, 0, 0.12, 'sine', 0.16);
      });
      doc.body.appendChild(btn);
    }

    function start() {
      addStyle();
      mountMute();
    }
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start);
    else start();

    return { correct: correct, wrong: wrong, finish: finish, purchase: purchase, muted: muted };
  }

  var exported = { tierFor: tierFor, TIERS: TIERS, SUBTITLE: SUBTITLE, MUTE_KEY: MUTE_KEY };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  try {
    var script = root.document && root.document.currentScript;
    root.Fx = create(root, script ? script.getAttribute('data-grade') : null);
  } catch (e) {}
})(this);
