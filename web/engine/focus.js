/* Cheerful focus music for a lesson. compose(seed) turns a string into a tune (a plain object, no audio), so each lesson
   has its own tune and the same lesson always gets the same one. MIDI note numbers; null is a rest. */
(function (root) {
  'use strict';

  var KEY = 'study_focus_v1';
  var SLOTS_PER_BAR = 8;
  var BARS = 4;
  var RESTS_PER_BAR = 2;
  var STEPS = [-2, -1, -1, 1, 1, 2];
  var ARPEGGIO = [0, 1, 2, 1];

  // Major only: the melody may use the pentatonic subset, the chords always come from the full major scale.
  var MODES = {
    major: [0, 2, 4, 5, 7, 9, 11],
    pentatonic: [0, 2, 4, 7, 9]
  };
  var MODE_NAMES = ['major', 'pentatonic'];
  // Chord degrees of the major scale; each progression ends on I or IV so the loop restarts smoothly.
  var PROGRESSIONS = [[0, 4, 5, 3], [0, 3, 4, 0], [0, 5, 3, 0], [0, 3, 0, 3]];
  var VOICE_NAMES = ['musicbox', 'bell', 'ukulele', 'marimba'];

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
    var major = MODES.major;
    var root = 48 + Math.floor(r() * 12);
    var bpm = 80 + Math.floor(r() * 21);
    var voice = pick(VOICE_NAMES);

    function pitch(deg) { return root + 12 * Math.floor(deg / n) + scale[((deg % n) + n) % n]; }
    function majorPitch(deg) { return root + 12 * Math.floor(deg / 7) + major[deg % 7]; }

    var chordDegs = pick(PROGRESSIONS);
    var chords = chordDegs.map(function (d) { return [majorPitch(d), majorPitch(d + 2), majorPitch(d + 4)]; });

    // The melody degree nearest to a chord tone of this bar's chord: never more than 2 degrees away.
    function nearestChordTone(from, chordDeg) {
      var tones = [0, 2, 4].map(function (k) { return major[(chordDeg + k) % 7]; });
      var best = null;
      for (var cand = 0; cand < 3 * n; cand++) {
        if (tones.indexOf(scale[cand % n]) === -1) continue;
        if (best === null || Math.abs(cand - from) < Math.abs(best - from)) best = cand;
      }
      return best;
    }

    // Bars 3 and 4 repeat the rhythm and contour of bars 1 and 2, so the tune has a shape a child can hum.
    function barPattern() {
      var rests = {};
      var count = 0;
      while (count < RESTS_PER_BAR) {
        var spot = 1 + Math.floor(r() * (SLOTS_PER_BAR - 1));
        if (!rests[spot]) { rests[spot] = true; count++; }
      }
      var steps = [];
      for (var s = 0; s < SLOTS_PER_BAR; s++) steps.push(pick(STEPS));
      return { rests: rests, steps: steps };
    }
    var patterns = [barPattern(), barPattern()];

    // The melody only moves when a note is played, so two played notes are never more than 2 degrees apart.
    var melody = [];
    var deg = n;
    for (var bar = 0; bar < BARS; bar++) {
      var pattern = patterns[bar % 2];
      deg = nearestChordTone(deg, chordDegs[bar]);
      var firstOfBar = true;
      var left = SLOTS_PER_BAR - RESTS_PER_BAR;
      var home = null;
      for (var slot = 0; slot < SLOTS_PER_BAR; slot++) {
        if (pattern.rests[slot]) { melody.push(null); continue; }
        if (!firstOfBar) {
          var move = pattern.steps[slot];
          // The last three notes of the tune walk home to the tonic, two degrees at a time.
          if (bar === BARS - 1 && left <= 3) {
            if (home === null) home = Math.abs(n - deg) <= Math.abs(2 * n - deg) ? n : 2 * n;
            move = Math.max(-2, Math.min(2, home - deg));
          }
          deg = Math.max(n, Math.min(2 * n, deg + move));
        }
        firstOfBar = false;
        left--;
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

  // partial: a quiet overtone at ratio times the note's pitch, which gives the bell and music-box shine.
  var VOICES = {
    musicbox: { type: 'sine', attack: 0.004, length: 1.1, partial: 0.4, ratio: 3 },
    bell: { type: 'sine', attack: 0.004, length: 1.5, partial: 0.3, ratio: 2.76 },
    ukulele: { type: 'triangle', attack: 0.004, length: 0.45, partial: 0.2, ratio: 2 },
    marimba: { type: 'triangle', attack: 0.005, length: 0.6, partial: 0, ratio: 2 }
  };

  function freq(n) { return 440 * Math.pow(2, (n - 69) / 12); }

  function create(win) {
    var ctx = null, bus = null, duckGain = null, fade = null, timer = null;
    var plan = null, pending = null, wanted = null, playingSeed = null, homeSeed = null, at = 0, slot = 0, pass = 0;

    function read() { try { return win.localStorage.getItem(KEY); } catch (e) { return null; } }
    function write(v) { try { win.localStorage.setItem(KEY, v); } catch (e) {} }
    function setting() { return read() !== '0'; }
    function enabled() { return setting() && !(win.Fx && win.Fx.muted && win.Fx.muted()); }

    function impulse() {
      var len = Math.floor(ctx.sampleRate * 0.5);
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
      bus.frequency.value = 3500;
      var wet = ctx.createGain();
      wet.gain.value = 0.15;
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
      if (v.partial) tone(freq(n) * v.ratio, t, 0.5 * v.partial, 'sine', v.attack, v.length * 0.7);
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
        if (slot % 2 === 0) {
          var chord = plan.chords[Math.floor(slot / SLOTS_PER_BAR) % BARS];
          tone(freq(chord[ARPEGGIO[(slot % SLOTS_PER_BAR) / 2]]), at, 0.2, 'triangle', 0.005, 0.5);
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
      // The game's own theme plays whenever no lesson is open (the lesson list, the results), so no screen is silent.
      home: function (key) { homeSeed = String(key) + ':home'; start(homeSeed); },
      screen: function (id) {
        if (LESSON_SCREEN.test(String(id))) return;
        if (homeSeed) start(homeSeed);
        else { wanted = null; halt(); }
      },
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
