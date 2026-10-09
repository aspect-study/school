/* Sound effects and streak call-outs for every game. Beeps and chimes are synthesized with the Web Audio API;
   the announcer voices are mp3 clips in assets/sounds/, with the device's speech voice as the fallback. */
(function (root) {
  'use strict';

  var MUTE_KEY = 'study_fx_muted_v1';
  var PACK_KEY = 'study_fx_pack_v1';
  var DEFAULT_PACK = 'kids';
  var PACK_IDS = ['kids', 'battle'];
  var POP_MS = { small: 4000, big: 6000 };
  var POP_CLOSE = 'Nice!';

  // speech: the device voice stands in for a clip that cannot play. clipsAreMusic: the clip is itself the jingle, so the
  // synthesized stinger plays only when the clip cannot.
  var PACKS = {
    kids: {
      label: 'Happy Chimes',
      speech: false,
      clipsAreMusic: true,
      tiers: [
        { at: 2, word: 'NICE!', clip: 'kids/nice.wav', color: '#38bdf8', glow: '#bae6fd', notes: 2 },
        { at: 3, word: 'GREAT!', clip: 'kids/great.wav', color: '#34d399', glow: '#a7f3d0', notes: 3 },
        { at: 4, word: 'SUPER!', clip: 'kids/super.wav', color: '#f472b6', glow: '#fbcfe8', notes: 4 },
        { at: 5, word: 'WOW!', clip: 'kids/wow.wav', color: '#a78bfa', glow: '#ddd6fe', notes: 5, big: true },
        { at: 6, word: 'AMAZING!', clip: 'kids/amazing.wav', color: '#fb923c', glow: '#fed7aa', notes: 5, big: true },
        { at: 7, word: 'FANTASTIC!', clip: 'kids/fantastic.wav', color: '#facc15', glow: '#fef08a', notes: 6, big: true },
        { at: 8, word: 'SUPERSTAR!', clip: 'kids/superstar.wav', color: '#f59e0b', glow: '#fef08a', notes: 7, big: true, rays: true }
      ],
      firstBlood: { word: 'YAY!', clip: 'kids/yay.wav', color: '#f472b6', glow: '#fbcfe8', notes: 1 },
      finishClips: ['kids/finish-0.wav', 'kids/finish-1.wav', 'kids/finish-2.wav', 'kids/finish-3.wav'],
      examClips: { 2: 'kids/exam-2.wav', 3: 'kids/exam-3.wav' },
      medalClips: { 1: 'kids/medal-1.wav', 2: 'kids/medal-2.wav', 3: 'kids/medal-3.wav' }
    },
    // Mobile Legends-style streak announcer, one tier per answer in a row.
    battle: {
      label: 'Battle announcer',
      speech: true,
      clipsAreMusic: false,
      tiers: [
        { at: 2, word: 'DOUBLE KILL!', say: 'Double kill!', clip: 'double-kill.mp3', color: '#3b82f6', glow: '#93c5fd', notes: 2 },
        { at: 3, word: 'TRIPLE KILL!', say: 'Triple kill!', clip: 'triple-kill.mp3', color: '#10b981', glow: '#6ee7b7', notes: 3 },
        { at: 4, word: 'MANIAC!', say: 'Maniac!', clip: 'maniac.mp3', color: '#a855f7', glow: '#d8b4fe', notes: 4 },
        { at: 5, word: 'SAVAGE!!!', say: 'Savage!', clip: 'savage.mp3', color: '#ef4444', glow: '#fca5a5', notes: 5, big: true },
        { at: 6, word: 'DOMINATING!', say: 'Dominating!', clip: 'dominating.mp3', color: '#f97316', glow: '#fdba74', notes: 5, big: true },
        { at: 7, word: 'UNSTOPPABLE!', say: 'Unstoppable!', clip: 'unstoppable.mp3', color: '#eab308', glow: '#fde047', notes: 6, big: true },
        { at: 8, word: 'LEGENDARY!', say: 'Legendary!', clip: 'legendary.mp3', color: '#f59e0b', glow: '#fef08a', notes: 7, big: true, rays: true }
      ],
      // The first unhelped right answer of each round.
      firstBlood: { word: 'FIRST BLOOD!', say: 'First blood!', clip: 'first-blood.mp3', color: '#dc2626', glow: '#fca5a5', notes: 1 },
      // The voice at the end of a round, by stars (3 = every answer right). A mock exam has its own top two.
      finishClips: ['valorant-1-kill.mp3', 'valorant-2-kills.mp3', 'valorant-3-kills.mp3', 'valorant-ace.mp3'],
      examClips: { 2: 'valorant-4-kills.mp3', 3: 'lol-legendary-kill.mp3' },
      // A popup's voice by its best medal: 1 Bronze, 2 Silver, 3 Gold (also an all-Bronze/Silver/Gold game).
      medalClips: { 1: 'lol-quadra-kill.mp3', 2: 'valorant-5-kills.mp3', 3: 'lol-penta-kill.mp3' }
    }
  };

  function known(id) { return Object.prototype.hasOwnProperty.call(PACKS, id); }
  function packOf(id) { return PACKS[known(id) ? id : DEFAULT_PACK]; }

  function finishClip(stars, exam, id) {
    var p = packOf(id);
    var n = Math.max(0, Math.min(3, stars | 0));
    return (exam && p.examClips[n]) || p.finishClips[n];
  }

  function medalClip(events, id) {
    var best = 0;
    (events || []).forEach(function (e) { if (e.medal > best) best = e.medal; });
    return packOf(id).medalClips[best] || null;
  }

  function allClips(id) {
    var p = packOf(id);
    var list = p.tiers.map(function (t) { return t.clip; }).concat(p.firstBlood.clip, p.finishClips);
    [p.examClips, p.medalClips].forEach(function (m) { Object.keys(m).forEach(function (k) { list.push(m[k]); }); });
    return list;
  }

  var SUBTITLE = {
    grade5: function (n) { return '🔥 ' + n + ' in a row!'; },
    grade2: function (n) { return root.Lang && !root.Lang.both() ? SUBTITLE.grade5(n) : '🔥 ' + n + ' sunod-sunod na tama! · ' + n + ' in a row!'; }
  };

  function tierFor(streak, id) {
    var tiers = packOf(id).tiers;
    var found = null;
    for (var i = 0; i < tiers.length; i++) if (streak >= tiers[i].at) found = tiers[i];
    return found;
  }

  // soundDir: the URL of assets/sounds/ (null when unknown: then the speech voice stands in).
  function create(win, grade, soundDir) {
    var doc = win.document;
    var clips = {}, playing = null, clipUntil = 0, blooded = false, examRound = false;
    var ctx = null;
    var layer = null;
    var hideTimer = null;
    var calloutUntil = 0, holdUntil = 0, queued = null, queuedAnchor = null, okButton = null, popTimer = null, closeTimer = null, pop = null, returnFocus = null;
    var subtitle = SUBTITLE[grade] || SUBTITLE.grade5;
    var memPack = null;

    function read(key) { try { return win.localStorage.getItem(key); } catch (e) { return null; } }
    function write(key, val) { try { win.localStorage.setItem(key, val); } catch (e) {} }

    function muted() { return read(MUTE_KEY) === '1'; }

    function packId() {
      var saved = read(PACK_KEY);
      if (known(saved)) return saved;
      return known(memPack) ? memPack : DEFAULT_PACK;
    }

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

    // Soft chimes for the reviewer: one card read, then every card read.
    function cardRead() {
      tone(1319, 0, 0.1, 'sine', 0.08);
      tone(1760, 0.07, 0.14, 'sine', 0.07);
    }
    function allRead() { arpeggio(4, 0.08, 'triangle', 0.14); }

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

    function clipAudio(name) {
      if (!clips[name]) {
        clips[name] = new win.Audio(soundDir + name);
        clips[name].preload = 'auto';
      }
      return clips[name];
    }

    // One voice at a time: a new clip cuts the old one. fallback runs when the clip cannot play (missing file, blocked).
    function clip(name, fallback) {
      if (muted()) return;
      if (!soundDir || !win.Audio) { if (fallback) fallback(); return; }
      try {
        var a = clipAudio(name);
        if (playing && playing !== a) playing.pause();
        playing = a;
        a.currentTime = 0;
        a.volume = 0.9;
        clipUntil = Date.now() + (a.duration > 0 && isFinite(a.duration) ? a.duration : 2.5) * 1000;
        var p = a.play();
        if (p && p.catch) p.catch(function () { if (playing === a) clipUntil = 0; if (fallback) fallback(); });
      } catch (e) { clipUntil = 0; if (fallback) fallback(); }
    }

    function stopClip() {
      if (playing) { try { playing.pause(); } catch (e) {} }
      playing = null;
      clipUntil = 0;
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
        '#fx-pop{position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(15,23,42,.55);overflow:hidden;}' +
        '#fx-pop .fx-pop-card{position:relative;max-width:340px;width:100%;max-height:calc(100vh - 32px);overflow-y:auto;padding:22px 20px 18px;border-radius:22px;background:#fff;color:#1f2937;' +
        'text-align:center;font-family:"Segoe UI",system-ui,sans-serif;box-shadow:0 12px 40px rgba(0,0,0,.3);}' +
        '#fx-pop .fx-pop-icon{font-size:68px;line-height:1.1;}' +
        '#fx-pop .fx-pop-art{width:96px;height:88px;margin:0 auto 4px}#fx-pop .fx-pop-art svg{width:100%;height:100%;display:block}' +
        '#fx-pop .fx-pop-who{font-size:.9rem;font-weight:800;opacity:.75;margin:0 0 2px}' +
        '#fx-pop .fx-pop-title{margin:6px 0 4px;font-size:1.35rem;font-weight:900;}' +
        '#fx-pop .fx-pop-line{font-size:1rem;font-weight:600;}' +
        '#fx-pop .fx-pop-next{margin-top:10px;padding:8px 10px;border-radius:12px;background:#EEF4FF;color:#23395B;font-size:.92rem;font-weight:700;}' +
        '#fx-pop .fx-pop-more{margin:10px 0 0;padding:0;list-style:none;font-size:.9rem;font-weight:700;}' +
        '#fx-pop .fx-pop-ok{margin-top:14px;padding:10px 26px;border:0;border-radius:999px;background:#2E9E5B;color:#fff;font:inherit;font-size:1rem;font-weight:800;cursor:pointer;}' +
        '#fx-pop .fx-pop-ok:focus-visible{outline:3px solid #23395B;outline-offset:2px;}' +
        '#fx-pop .fx-bit{position:absolute;width:10px;height:14px;border-radius:2px;animation:fx-fall var(--d) ease-in forwards;}' +
        '#fx-pop .fx-pop-card{animation:fx-drop .5s cubic-bezier(.2,1.4,.4,1);}' +
        '#fx-pop.fx-pop-big .fx-pop-icon{animation:fx-flip .9s ease-out;}' +
        '#fx-pop.fx-pop-calm .fx-pop-card,#fx-pop.fx-pop-calm .fx-pop-icon{animation:fx-in .3s ease-out;}' +
        '@keyframes fx-drop{0%{transform:translateY(-60px) scale(.8);opacity:0}100%{transform:none;opacity:1}}' +
        '@keyframes fx-flip{0%{transform:rotateY(0) scale(.4)}60%{transform:rotateY(540deg) scale(1.15)}100%{transform:rotateY(720deg) scale(1)}}' +
        '@keyframes fx-in{0%{opacity:0}100%{opacity:1}}' +
        '@media (prefers-reduced-motion:reduce){#fx-pop .fx-pop-card,#fx-pop .fx-pop-icon{animation:fx-in .3s ease-out}}' +
        '@media print{#fx-mute,#fx-layer,#fx-pop{display:none}}';
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
      calloutUntil = Date.now() + 1700;
    }

    // A new round: First Blood is ready again. study-kit.js calls this from startRound.
    function round() {
      blooded = false;
      examRound = false;
    }

    function stinger(tier, loud) {
      arpeggio(tier.notes, 0.07, loud && tier.big ? 'square' : 'triangle', loud && tier.big ? 0.07 : 0.12);
      if (loud && tier.big) tone(110, 0.05, 0.4, 'sawtooth', 0.08, 55);
    }

    function correct(streak, o) {
      var id = packId(), p = PACKS[id];
      if (o && o.exam) examRound = true;
      tone(880, 0, 0.12, 'sine', 0.18);
      tone(1319, 0.08, 0.2, 'sine', 0.18);
      var tier = tierFor(streak, id);
      if (!tier && streak === 1 && !blooded) tier = p.firstBlood;
      if (streak > 0) blooded = true;
      if (!tier) return;
      if (!p.clipsAreMusic) stinger(tier, true);
      clip(tier.clip, function () {
        if (p.speech) say(tier.say);
        if (p.clipsAreMusic) stinger(tier, false);
      });
      show(tier.word, subtitle(streak), tier);
    }

    function wrong() {
      tone(300, 0, 0.18, 'triangle', 0.16, 200);
      tone(200, 0.14, 0.26, 'triangle', 0.14, 150);
    }

    function popSound() {
      tone(520, 0, 0.09, 'sine', 0.16, 1040);
      tone(1568, 0.05, 0.1, 'triangle', 0.07);
      noise(0, 0.05, 0.1, 3000);
    }

    // Keeps the next celebration back for ms (the army's boss show), like a call-out does.
    function hold(ms) { holdUntil = Math.max(holdUntil, Date.now() + ms); }

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

    function jingle(stars) {
      if (stars >= 3) {
        [523, 659, 784, 1047].forEach(function (f, i) { tone(f, i * 0.12, 0.25, 'triangle', 0.16); });
        tone(1047, 0.5, 0.6, 'triangle', 0.14);
        tone(1319, 0.5, 0.6, 'sine', 0.1);
        tone(1568, 0.5, 0.6, 'sine', 0.08);
      } else if (stars >= 1) {
        [523, 659, 784].forEach(function (f, i) { tone(f, i * 0.12, 0.25, 'triangle', 0.15); });
        tone(1047, 0.38, 0.4, 'triangle', 0.13);
      } else {
        tone(523, 0, 0.25, 'triangle', 0.13);
        tone(784, 0.15, 0.35, 'triangle', 0.13);
      }
    }

    function finish(stars) {
      var id = packId(), musical = PACKS[id].clipsAreMusic;
      if (!musical) jingle(stars);
      clip(finishClip(stars, examRound, id), musical ? function () { jingle(stars); } : null);
      if (stars >= 3) show('PERFECT!', '⭐⭐⭐', { color: '#eab308', glow: '#fde047', big: true, rays: true });
    }

    function el(tag, cls, text) {
      var e = doc.createElement(tag);
      if (cls) e.className = cls;
      if (text !== undefined) e.textContent = text;
      return e;
    }

    function fanfare(big) {
      if (big) {
        [523, 659, 784, 1047].forEach(function (f, i) { tone(f, i * 0.12, 0.25, 'triangle', 0.16); });
        tone(1319, 0.5, 0.6, 'sine', 0.12);
      } else {
        tone(988, 0, 0.15, 'sine', 0.14);
        tone(1319, 0.1, 0.3, 'sine', 0.14);
      }
    }

    function onKey(ev) {
      if (ev.key === 'Escape') closePop();
      else if (ev.key === 'Tab') {
        ev.preventDefault();
        if (okButton) okButton.focus();
      }
    }

    function closePop() {
      clearTimeout(closeTimer);
      if (pop && pop.parentNode) pop.parentNode.removeChild(pop);
      if (pop) doc.removeEventListener('keydown', onKey);
      pop = null;
      okButton = null;
      if (returnFocus && returnFocus.focus) { try { returnFocus.focus(); } catch (e) {} }
      returnFocus = null;
    }

    // events: [{ big, icon, title, line, next }], biggest first. The first is the headline; up to 3 more are listed.
    function openPop() {
      clearTimeout(popTimer);
      var events = queued, anchor = queuedAnchor;
      queued = null;
      queuedAnchor = null;
      if (!events || !events.length || !doc.body) return;
      if (anchor && (!anchor.isConnected || !anchor.offsetParent)) return;
      addStyle();
      closePop();
      var head = events[0], calm = reducedMotion();
      var big = events.some(function (e) { return e.big; });
      returnFocus = doc.activeElement;
      pop = el('div', big ? 'fx-pop-big' : 'fx-pop-small');
      if (calm) pop.className += ' fx-pop-calm';
      pop.id = 'fx-pop';
      pop.setAttribute('role', 'dialog');
      pop.setAttribute('aria-modal', 'true');
      pop.setAttribute('aria-labelledby', 'fx-pop-title');
      var card = el('div', 'fx-pop-card');
      if (head.art) {
        var art = el('div', 'fx-pop-art');
        art.innerHTML = head.art;
        card.appendChild(art);
      } else card.appendChild(el('div', 'fx-pop-icon', head.icon));
      if (head.who) card.appendChild(el('div', 'fx-pop-who', head.who));
      var title = el('div', 'fx-pop-title', head.title);
      title.id = 'fx-pop-title';
      card.appendChild(title);
      if (head.line) card.appendChild(el('div', 'fx-pop-line', head.line));
      if (head.next) card.appendChild(el('div', 'fx-pop-next', head.next));
      if (events.length > 1) {
        var more = el('ul', 'fx-pop-more');
        events.slice(1, 4).forEach(function (e) { more.appendChild(el('li', '', e.icon + ' ' + e.title)); });
        card.appendChild(more);
      }
      var ok = el('button', 'fx-pop-ok', POP_CLOSE);
      ok.type = 'button';
      okButton = ok;
      card.appendChild(ok);
      pop.appendChild(card);
      if (big && !calm) confetti(pop, ['#eab308', '#fde047', '#22d3ee', '#a855f7', '#ffffff'], 40);
      pop.addEventListener('click', closePop);
      doc.addEventListener('keydown', onKey);
      doc.body.appendChild(pop);
      try { ok.focus(); } catch (e) {}
      var id = packId(), voice = medalClip(events, id);
      var musical = !!voice && PACKS[id].clipsAreMusic;
      if (!musical) fanfare(big);
      if (voice) clip(voice, musical ? function () { fanfare(big); } : null);
      closeTimer = setTimeout(closePop, big ? POP_MS.big : POP_MS.small);
    }

    // Waits for a call-out like PERFECT! to finish, so the two never overlap. If the anchor element is hidden by then, the player has moved on and nothing opens.
    function celebrate(events, anchor) {
      if (!events || !events.length) return;
      queued = order(events);
      queuedAnchor = anchor || null;
      clearTimeout(popTimer);
      popTimer = setTimeout(openPop, Math.max(0, calloutUntil - Date.now(), clipUntil - Date.now(), holdUntil - Date.now()));
    }

    function renderMute(btn) {
      var m = muted();
      btn.textContent = m ? '🔇' : '🔊';
      btn.setAttribute('aria-label', m ? 'Sound off. Tap to turn sound on' : 'Sound on. Tap to turn sound off');
      btn.setAttribute('aria-pressed', m ? 'true' : 'false');
    }

    function setMuted(on) {
      write(MUTE_KEY, on ? '1' : '0');
      if (on && win.speechSynthesis) win.speechSynthesis.cancel();
      if (on) stopClip();
      if (!on) tone(880, 0, 0.12, 'sine', 0.16);
      var btn = doc.getElementById('fx-mute');
      if (btn) renderMute(btn);
    }

    function setPack(id) {
      if (!known(id)) return;
      memPack = id;
      write(PACK_KEY, id);
      var sample = tierFor(2, id);
      clip(sample.clip, function () { if (PACKS[id].speech) say(sample.say); });
    }

    // Games switch sound from the Nav menu; only pages without Nav (the lobbies) get the floating button.
    function mountMute() {
      if (win.Nav || doc.getElementById('fx-mute')) return;
      var btn = doc.createElement('button');
      btn.id = 'fx-mute';
      btn.type = 'button';
      renderMute(btn);
      btn.addEventListener('click', function () { setMuted(!muted()); });
      doc.body.appendChild(btn);
    }

    function start() {
      addStyle();
      mountMute();
      // Games load the voices at the first tap, so the first call-out plays on time.
      if (win.Nav && soundDir && win.Audio) {
        doc.addEventListener('pointerdown', function () { allClips(packId()).forEach(clipAudio); }, { once: true });
      }
    }
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start);
    else start();

    return { pop: popSound, hold: hold, round: round, correct: correct, wrong: wrong, finish: finish, purchase: purchase, muted: muted, setMuted: setMuted,
      pack: packId, setPack: setPack, packs: function () { return PACK_IDS.slice(); }, packLabel: function (id) { return known(id) ? PACKS[id].label : ''; },
      celebrate: celebrate, celebrateNow: openPop, cardRead: cardRead, allRead: allRead, queued: function () { return queued; } };
  }

  // Big ones lead the card, then the ones with art (the boss's face); the original order breaks ties.
  function order(events) {
    return events.map(function (e, i) { return { e: e, i: i }; })
      .sort(function (x, y) {
        return (y.e.big ? 1 : 0) - (x.e.big ? 1 : 0) || (y.e.art ? 1 : 0) - (x.e.art ? 1 : 0) || x.i - y.i;
      })
      .map(function (x) { return x.e; });
  }

  var exported = { order: order, tierFor: tierFor, PACKS: PACKS, PACK_IDS: PACK_IDS, DEFAULT_PACK: DEFAULT_PACK, PACK_KEY: PACK_KEY, finishClip: finishClip, medalClip: medalClip, allClips: allClips, SUBTITLE: SUBTITLE, MUTE_KEY: MUTE_KEY, POP_MS: POP_MS, POP_CLOSE: POP_CLOSE };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  try {
    var script = root.document && root.document.currentScript;
    var dir = null;
    try { dir = new URL('../assets/sounds/', script.src).href; } catch (e) {}
    root.Fx = create(root, script ? script.getAttribute('data-grade') : null, dir);
  } catch (e) {}
})(this);
