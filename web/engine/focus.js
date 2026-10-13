/* Calm focus music for a lesson. compose(seed) turns a string into a tune (a plain object, no audio), so each lesson has
   its own tune and the same lesson always gets the same one. MIDI note numbers; null is a rest. */
(function (root) {
  'use strict';

  var KEY = 'study_focus_v1';
  var SLOTS_PER_BAR = 8;
  var BARS = 4;
  var RESTS_PER_BAR = 3;
  var STEPS = [-2, -1, -1, 0, 1, 1, 2];

  var MODES = {
    pentatonic: [0, 2, 4, 7, 9],
    lydian: [0, 2, 4, 6, 7, 9, 11],
    dorian: [0, 2, 3, 5, 7, 9, 10],
    minor: [0, 2, 3, 5, 7, 8, 10]
  };
  var MODE_NAMES = ['pentatonic', 'lydian', 'dorian', 'minor'];
  var VOICE_NAMES = ['pad', 'chime', 'marimba', 'pluck'];

  // FNV-1a, written with shifts so it stays plain ES5.
  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return h >>> 0;
  }

  // xorshift32; the first outputs are dropped because similar seeds start out alike.
  function random(seed) {
    var s = seed || 1;
    function next() {
      s ^= s << 13;
      s ^= s >>> 17;
      s ^= s << 5;
      return (s >>> 0) / 4294967296;
    }
    for (var i = 0; i < 6; i++) next();
    return next;
  }

  function compose(seed) {
    var r = random(hash(String(seed)));
    function pick(list) { return list[Math.floor(r() * list.length)]; }

    var mode = pick(MODE_NAMES);
    var scale = MODES[mode];
    var n = scale.length;
    var root = 48 + Math.floor(r() * 12);
    var bpm = 52 + Math.floor(r() * 17);
    var voice = pick(VOICE_NAMES);

    function pitch(deg) { return root + 12 * Math.floor(deg / n) + scale[((deg % n) + n) % n]; }

    var chordDegs = [0];
    for (var c = 1; c < BARS; c++) chordDegs.push(Math.floor(r() * n));
    var chords = chordDegs.map(function (d) { return [pitch(d), pitch(d + 2), pitch(d + 4)]; });

    // The chord tone (a triad on chordDeg) nearest to a melody degree: never more than one degree away.
    function nearestChordTone(from, chordDeg) {
      var best = null;
      for (var oct = 0; oct <= 3; oct++) {
        [0, 2, 4].forEach(function (k) {
          var cand = oct * n + ((chordDeg + k) % n);
          if (best === null || Math.abs(cand - from) < Math.abs(best - from)) best = cand;
        });
      }
      return best;
    }

    // The melody only moves when a note is played, so two played notes are never more than 2 degrees apart.
    var melody = [];
    var deg = n;
    for (var bar = 0; bar < BARS; bar++) {
      var rests = {};
      var count = 0;
      while (count < RESTS_PER_BAR) {
        var spot = Math.floor(r() * SLOTS_PER_BAR);
        if (!rests[spot]) { rests[spot] = true; count++; }
      }
      deg = nearestChordTone(deg, chordDegs[bar]);
      var firstOfBar = true;
      for (var slot = 0; slot < SLOTS_PER_BAR; slot++) {
        if (rests[slot]) { melody.push(null); continue; }
        if (!firstOfBar) deg = Math.max(n, Math.min(2 * n, deg + pick(STEPS)));
        firstOfBar = false;
        melody.push(pitch(deg));
      }
    }

    var played = [];
    melody.forEach(function (note, i) { if (note !== null) played.push(i); });
    // Dropping a note joins its neighbours, so only drop one whose neighbours are no more than a fifth apart.
    var droppable = played.filter(function (idx, k) {
      return k === 0 || k === played.length - 1 || Math.abs(melody[played[k + 1]] - melody[played[k - 1]]) <= 7;
    });
    var alt = melody.slice();
    alt[pick(droppable)] = null;

    return { mode: mode, root: root, bpm: bpm, voice: voice, chords: chords, melody: melody, alt: alt };
  }

  var LEVEL = 0.12;
  var DUCKED = 0.3;
  var LESSON_SCREEN = /flash|cards|quiz/i;

  var VOICES = {
    pad: { type: 'sine', attack: 0.35, length: 2.6, partial: 0 },
    chime: { type: 'sine', attack: 0.01, length: 2.2, partial: 0.3 },
    marimba: { type: 'triangle', attack: 0.005, length: 0.7, partial: 0 },
    pluck: { type: 'triangle', attack: 0.004, length: 1.3, partial: 0.15 }
  };

  function freq(n) { return 440 * Math.pow(2, (n - 69) / 12); }

  function create(win) {
    var ctx = null, bus = null, duckGain = null, fade = null, timer = null;
    var plan = null, pending = null, wanted = null, playingSeed = null, at = 0, slot = 0, pass = 0;

    function read() { try { return win.localStorage.getItem(KEY); } catch (e) { return null; } }
    function write(v) { try { win.localStorage.setItem(KEY, v); } catch (e) {} }
    function setting() { return read() !== '0'; }
    function enabled() { return setting() && !(win.Fx && win.Fx.muted && win.Fx.muted()); }

    function impulse() {
      var len = Math.floor(ctx.sampleRate * 1.2);
      var buf = ctx.createBuffer(1, len, ctx.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
      return buf;
    }

    // voices -> low-pass -> (dry + short reverb) -> duck -> fade -> speakers
    function build(AC) {
      ctx = new AC();
      fade = ctx.createGain();
      duckGain = ctx.createGain();
      bus = ctx.createBiquadFilter();
      bus.type = 'lowpass';
      bus.frequency.value = 1800;
      var wet = ctx.createGain();
      wet.gain.value = 0.3;
      var verb = ctx.createConvolver();
      verb.buffer = impulse();
      bus.connect(duckGain);
      bus.connect(verb);
      verb.connect(wet);
      wet.connect(duckGain);
      duckGain.connect(fade);
      fade.connect(ctx.destination);
      if (win.document && win.document.addEventListener) {
        win.document.addEventListener('visibilitychange', function () {
          if (!ctx || !timer) return;
          if (win.document.hidden) { if (ctx.suspend) ctx.suspend(); } else if (ctx.resume) ctx.resume();
        });
        win.document.addEventListener('pointerdown', function () {
          if (timer && ctx.state === 'suspended' && ctx.resume) ctx.resume();
        }, true);
      }
    }

    function tone(hz, t, vol, type, attack, length) {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type;
      o.frequency.value = hz;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t + length);
      o.connect(g);
      g.connect(bus);
      o.start(t);
      o.stop(t + length + 0.05);
    }

    function note(n, t, voice) {
      var v = VOICES[voice];
      tone(freq(n), t, 0.5, v.type, v.attack, v.length);
      if (v.partial) tone(freq(n) * 2, t, 0.5 * v.partial, 'sine', v.attack, v.length * 0.7);
    }

    // A throttled timer can fall far behind: skip ahead instead of piling up the missed notes at once.
    function schedule() {
      if (at < ctx.currentTime) at = ctx.currentTime + 0.05;
      while (at < ctx.currentTime + 1) {
        if (slot % SLOTS_PER_BAR === 0 && pending) {
          plan = pending;
          pending = null;
          slot = 0;
          pass = 0;
        }
        var step = 30 / plan.bpm;
        if (slot % SLOTS_PER_BAR === 0) {
          var chord = plan.chords[(slot / SLOTS_PER_BAR) % BARS];
          for (var i = 0; i < chord.length; i++) tone(freq(chord[i]), at, 0.18, 'sine', 0.5, step * SLOTS_PER_BAR + 0.8);
        }
        var n = (pass % 2 ? plan.alt : plan.melody)[slot % (SLOTS_PER_BAR * BARS)];
        if (n !== null) note(n, at, plan.voice);
        at += step;
        slot++;
        if (slot % (SLOTS_PER_BAR * BARS) === 0) pass++;
      }
    }

    function begin() {
      var AC = win.AudioContext || win.webkitAudioContext;
      if (!AC) return;
      try {
        if (!ctx) build(AC);
        if (ctx.resume) ctx.resume();
        var t = ctx.currentTime;
        fade.gain.cancelScheduledValues(t);
        fade.gain.setValueAtTime(0.0001, t);
        fade.gain.linearRampToValueAtTime(LEVEL, t + 2);
        duckGain.gain.cancelScheduledValues(t);
        duckGain.gain.setValueAtTime(1, t);
        plan = compose(wanted);
        playingSeed = wanted;
        pending = null;
        slot = 0;
        pass = 0;
        at = t + 0.1;
        schedule();
        timer = win.setInterval(schedule, 250);
      } catch (e) { timer = null; }
    }

    function halt() {
      if (!timer) return;
      win.clearInterval(timer);
      timer = null;
      playingSeed = null;
      pending = null;
      var t = ctx.currentTime;
      fade.gain.cancelScheduledValues(t);
      fade.gain.setTargetAtTime(0, t, 0.25);
    }

    function start(seed) {
      wanted = String(seed);
      if (!enabled()) return;
      if (!timer) { begin(); return; }
      if (ctx.resume) ctx.resume();
      if (playingSeed !== wanted) {
        pending = compose(wanted);
        playingSeed = wanted;
      }
    }

    function sync() {
      if (!enabled()) halt();
      else if (wanted && !timer) begin();
    }

    return {
      start: start,
      stop: function () { wanted = null; halt(); },
      sync: sync,
      screen: function (id) { if (!LESSON_SCREEN.test(String(id))) { wanted = null; halt(); } },
      duck: function (ms) {
        if (!timer) return;
        var t = ctx.currentTime;
        duckGain.gain.cancelScheduledValues(t);
        duckGain.gain.setTargetAtTime(DUCKED, t, 0.08);
        duckGain.gain.setTargetAtTime(1, t + ms / 1000, 0.4);
      },
      playing: function () { return !!timer; },
      setting: setting,
      enabled: enabled,
      setEnabled: function (on) { write(on ? '1' : '0'); sync(); }
    };
  }

  var exported = {
    KEY: KEY, MODES: MODES, MODE_NAMES: MODE_NAMES, VOICE_NAMES: VOICE_NAMES,
    SLOTS_PER_BAR: SLOTS_PER_BAR, BARS: BARS, hash: hash, compose: compose, create: create
  };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.Focus = create(root);
})(this);
