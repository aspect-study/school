/* Sound effects for the 3D world (wardrobe 3b and 3c): her footsteps, her pet's voice and play, her props' ✨ Use,
   her emotes and the playground rides. The clips are small mp3s in assets/sounds/world/ (made by
   tools/world-sounds.js) played with Web Audio, so steps land on time and sounds can overlap; the baby dragon's voice
   and the tag heartbeat are drawn in code. A clip that is not loaded yet is skipped, never played late. No Three.js. */
(function (root) {
  'use strict';
  var MAX_LIVE = 6, WOBBLE = 0.06, PLANT = Math.PI;

  function clip(file, gain, more) { return Object.assign({ file: file, gain: gain, cool: 0.15 }, more || {}); }
  function voice(file) { return clip(file, 0.6, { cool: 0.6 }); }
  function play(file) { return clip(file, 0.5); }
  function act(file, more) { return clip(file, 0.6, more); }

  // gain: 0-1 against the music box; cool: shortest gap between two plays (s); delay: after the move starts (s).
  var SOUNDS = {
    'step-grass': clip('step-grass.mp3', 0.25, { cool: 0.1, wobble: true }),
    'step-stone': { files: ['step-stone-1.mp3', 'step-stone-2.mp3', 'step-stone-3.mp3', 'step-stone-4.mp3', 'step-stone-5.mp3'], gain: 0.25, cool: 0.1 },
    'pet-chick': voice('pet-chick.mp3'),
    'pet-kitten': voice('pet-kitten.mp3'),
    'pet-puppy': voice('pet-puppy.mp3'),
    'pet-hamster': voice('pet-hamster.mp3'),
    'pet-duckling': voice('pet-duckling.mp3'),
    'pet-bunny': voice('pet-bunny.mp3'),
    'pet-turtle': voice('pop.mp3'),
    'pet-piglet': voice('pet-piglet.mp3'),
    'pet-parrot': voice('pet-parrot.mp3'),
    'pet-carabao': voice('pet-carabao.mp3'),
    'pet-penguin': voice('pet-penguin.mp3'),
    'pet-fox': voice('pet-fox.mp3'),
    'pet-tarsier': voice('pet-tarsier.mp3'),
    'pet-panda': voice('pet-panda.mp3'),
    'pet-unicorn': voice('pet-unicorn.mp3'),
    rawr: { code: true, gain: 0.6, cool: 0.6 },
    // Tag (games3d.js): lub-dub while the chaser is close.
    heartbeat: { code: true, gain: 0.8, cool: 0.3 },
    treat: play('treat.mp3'),
    'throw': play('throw.mp3'),
    land: play('land.mp3'),
    'catch': play('pop.mp3'),
    dig: play('dig.mp3'),
    drop: play('drop.mp3'),
    trick: play('spin-whistle.mp3'),
    'trick-land': play('trick-land.mp3'),
    'use-balloon': act('use-balloon.mp3'),
    'use-bubblewand': act('use-bubblewand.mp3'),
    'use-pamaypay': act('use-pamaypay.mp3'),
    'use-teddy': act('use-teddy.mp3'),
    'use-bouquet': act('use-bouquet.mp3'),
    'use-umbrella': act('use-umbrella.mp3'),
    'use-ribbonwand': act('use-ribbonwand.mp3'),
    'use-drum': act('use-drum.mp3'),
    'use-parol': act('use-parol.mp3'),
    'use-ukulele': act('use-ukulele.mp3'),
    'use-magicwand': act('use-magicwand.mp3'),
    'use-trophy': clip('use-trophy.mp3', 0.45, { delay: 0.2 }),
    'emote-wave': act('emote-wave.mp3'),
    'emote-clap': act('emote-clap.mp3'),
    'emote-cheer': clip('emote-cheer.mp3', 0.45),
    'emote-bow': act('emote-bow.mp3'),
    'emote-heart': act('emote-heart.mp3'),
    'emote-giggle': act('emote-giggle.mp3'),
    'mate-giggle': clip('emote-giggle.mp3', 0.3, { cool: 2 }),
    // Gifts and monsters (loot3d.js), from clips the world already has.
    'gift-open': clip('use-magicwand.mp3', 0.5),
    'monster-pop': clip('pop.mp3', 0.6),
    'monster-giggle': clip('emote-giggle.mp3', 0.35, { cool: 1.5 }),
    'emote-spin': act('spin-whistle.mp3'),
    'emote-relax': act('emote-relax.mp3'),
    'emote-dance': act('emote-dance.mp3'),
    'emote-cartwheel': act('emote-cartwheel.mp3', { delay: 0.3 }),
    'emote-hero': act('emote-hero.mp3'),
    'ride-start': play('ride-start.mp3'),
    'slide-go': play('emote-cartwheel.mp3'),
    swing: clip('swing.mp3', 0.4),
    'seesaw-bump': play('seesaw-bump.mp3'),
    'merry-start': play('merry-start.mp3'),
    'merry-slow': play('merry-slow.mp3'),
    'ride-land': play('ride-land.mp3')
  };

  // pets.js id → its voice in SOUNDS.
  var VOICES = {
    chick: 'pet-chick', kitten: 'pet-kitten', puppy: 'pet-puppy', hamster: 'pet-hamster', duckling: 'pet-duckling',
    bunny: 'pet-bunny', turtle: 'pet-turtle', piglet: 'pet-piglet', parrot: 'pet-parrot', carabao: 'pet-carabao',
    penguin: 'pet-penguin', fox: 'pet-fox', tarsier: 'pet-tarsier', panda: 'pet-panda', unicorn: 'pet-unicorn',
    dragon: 'rawr'
  };

  function filesOf(key) {
    var d = SOUNDS[key];
    return d.code ? [] : d.files || [d.file];
  }
  var FILES = [];
  Object.keys(SOUNDS).forEach(function (k) {
    filesOf(k).forEach(function (f) { if (FILES.indexOf(f) < 0) FILES.push(f); });
  });

  // How many foot plants her leg swing (move.js walkT; avatar.js swings her legs with sin(walkT)) passed between two
  // frames. A plant is where sin(walkT) is ±1. Only forward: walkT shrinks back toward 0 when she stops.
  function stepsBetween(a, b) {
    if (!(b > a)) return 0;
    return Math.floor((b - PLANT / 2) / PLANT) - Math.floor((a - PLANT / 2) / PLANT);
  }

  // o: { base (folder of the clips), rand (tests pass their own) }
  function create(win, o) {
    o = o || {};
    var base = o.base === undefined ? '../assets/sounds/world/' : o.base, rand = o.rand || Math.random;
    var AC = win.AudioContext || win.webkitAudioContext;
    var ctx = null, master = null, on = true, steps = true, warmed = false;
    var bufs = {}, last = {}, live = [], stoneAt = 0, log = [];

    function note(key, did) {
      log.push({ key: key, did: did });
      if (log.length > 30) log.shift();
      return did === 'played';
    }

    function load(file) {
      if (bufs[file] || !ctx || !win.fetch) return;
      bufs[file] = 'loading';
      try {
        win.fetch(base + file).then(function (r) {
          if (!r.ok) throw new Error(file);
          return r.arrayBuffer();
        }).then(function (data) {
          return new Promise(function (ok, bad) {
            var p = ctx.decodeAudioData(data, ok, bad);
            if (p && p.then) p.then(ok, bad);
          });
        }).then(function (b) { bufs[file] = b; }, function () { bufs[file] = 'dead'; });
      } catch (e) { bufs[file] = 'dead'; }
    }

    function warm() {
      if (warmed || !ctx || !on) return;
      warmed = true;
      FILES.forEach(load);
    }

    // On her first tap (and when Sound is switched on in settings): browsers only start audio after a tap.
    function unlock() {
      if (!AC) return;
      try {
        if (!ctx) {
          ctx = new AC();
          master = ctx.createGain();
          master.connect(ctx.destination);
        }
        if (ctx.state !== 'running' && ctx.resume) {
          var p = ctx.resume();
          if (p && p.catch) p.catch(function () {});
        }
      } catch (e) {
        ctx = null;
        return;
      }
      warm();
    }

    function setOn(sound, footsteps) {
      on = !!sound;
      steps = !!footsteps;
      if (on) {
        if (!ctx) unlock();
        warm();
      } else stopAll(0.1);
    }

    // The cooldown is measured between start times, so a clip delayed on purpose (her sister's pet) is not dropped.
    function ready(key, delay) {
      if (!on) return note(key, 'off');
      if (!ctx) return note(key, 'locked');
      if (ctx.state && ctx.state !== 'running') return note(key, 'locked');
      var now = ctx.currentTime, at = now + delay;
      if (last[key] !== undefined && Math.abs(at - last[key]) < SOUNDS[key].cool) return note(key, 'cool');
      live = live.filter(function (l) { return l.end > now; });
      if (live.length >= MAX_LIVE) return note(key, 'full');
      return true;
    }

    function start(key, file, opts) {
      var d = SOUNDS[key], b = bufs[file];
      if (b === undefined) load(file);
      if (!b || typeof b === 'string') return note(key, b === 'dead' ? 'dead' : 'loading');
      var now = ctx.currentTime, at = now + (opts.delay !== undefined ? opts.delay : d.delay || 0);
      var src = ctx.createBufferSource(), g = ctx.createGain();
      src.buffer = b;
      if (opts.wobble || d.wobble) src.playbackRate.value = 1 + (rand() * 2 - 1) * WOBBLE;
      g.gain.value = d.gain * (opts.gain === undefined ? 1 : opts.gain);
      src.connect(g);
      g.connect(master);
      src.start(at);
      last[key] = at;
      live.push({ src: src, g: g, her: !!opts.her, end: at + b.duration / src.playbackRate.value });
      return note(key, 'played');
    }

    // o: { gain (0-1, times the sound's own), delay (s), wobble, her (her move: stopHer fades it) }
    function playKey(key, opts) {
      opts = opts || {};
      if (!SOUNDS[key] || SOUNDS[key].code || SOUNDS[key].files) return false;
      if (!ready(key, opts.delay !== undefined ? opts.delay : SOUNDS[key].delay || 0)) return false;
      try { return start(key, SOUNDS[key].file, opts); } catch (e) { return note(key, 'error'); }
    }

    function step(surface) {
      var key = surface === 'stone' ? 'step-stone' : 'step-grass', d = SOUNDS[key];
      if (on && !steps) return note(key, 'off');
      if (ctx && ctx.state !== 'running') unlock();
      if (!ready(key, 0)) return false;
      var file = d.files ? d.files[stoneAt++ % d.files.length] : d.file;
      try { return start(key, file, {}); } catch (e) { return note(key, 'error'); }
    }

    // The baby dragon's little rawr: a falling sawtooth with a puff of filtered noise.
    function rawr(opts) {
      if (!ready('rawr', opts.delay || 0)) return false;
      try {
        var now = ctx.currentTime, at = now + (opts.delay || 0);
        var out = ctx.createGain();
        out.gain.value = SOUNDS.rawr.gain * (opts.gain === undefined ? 1 : opts.gain);
        out.connect(master);
        var osc = ctx.createOscillator(), og = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(450, at);
        osc.frequency.exponentialRampToValueAtTime(300, at + 0.35);
        og.gain.setValueAtTime(0.0001, at);
        og.gain.exponentialRampToValueAtTime(0.13, at + 0.01);
        og.gain.exponentialRampToValueAtTime(0.0001, at + 0.35);
        osc.connect(og);
        og.connect(out);
        osc.start(at);
        osc.stop(at + 0.4);
        var n = Math.floor(ctx.sampleRate * 0.35), buf = ctx.createBuffer(1, n, ctx.sampleRate), ch = buf.getChannelData(0);
        for (var i = 0; i < n; i++) ch[i] = rand() * 2 - 1;
        var src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), ng = ctx.createGain();
        src.buffer = buf;
        f.type = 'bandpass';
        f.Q.value = 1.5;
        f.frequency.setValueAtTime(900, at);
        f.frequency.exponentialRampToValueAtTime(450, at + 0.35);
        ng.gain.setValueAtTime(0.0001, at);
        ng.gain.exponentialRampToValueAtTime(0.2, at + 0.07);
        ng.gain.exponentialRampToValueAtTime(0.0001, at + 0.35);
        src.connect(f);
        f.connect(ng);
        ng.connect(out);
        src.start(at);
        src.stop(at + 0.35);
        last.rawr = at;
        live.push({ src: osc, g: out, her: false, end: at + 0.4 });
        return note('rawr', 'played');
      } catch (e) { return note('rawr', 'error'); }
    }

    // Lub-dub: two low falling sine thumps.
    function heartbeat(opts) {
      if (!ready('heartbeat', 0)) return false;
      try {
        var at = ctx.currentTime, out = ctx.createGain();
        out.gain.value = SOUNDS.heartbeat.gain * (opts.gain === undefined ? 1 : opts.gain);
        out.connect(master);
        [[0, 0.5], [0.2, 0.35]].forEach(function (b) {
          var t = at + b[0], osc = ctx.createOscillator(), og = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(70, t);
          osc.frequency.exponentialRampToValueAtTime(42, t + 0.14);
          og.gain.setValueAtTime(0.0001, t);
          og.gain.exponentialRampToValueAtTime(b[1], t + 0.015);
          og.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
          osc.connect(og);
          og.connect(out);
          osc.start(t);
          osc.stop(t + 0.18);
        });
        last.heartbeat = at;
        live.push({ src: { stop: function () {} }, g: out, her: false, end: at + 0.4 });
        return note('heartbeat', 'played');
      } catch (e) { return note('heartbeat', 'error'); }
    }

    function playAny(key, opts) {
      return key === 'heartbeat' ? heartbeat(opts || {}) : playKey(key, opts);
    }

    function voiceOf(type, opts) {
      var key = VOICES[type];
      if (!key) return false;
      return key === 'rawr' ? rawr(opts || {}) : playKey(key, opts);
    }

    function fade(l, secs) {
      try {
        var now = ctx.currentTime;
        l.g.gain.cancelScheduledValues(now);
        l.g.gain.setValueAtTime(l.g.gain.value, now);
        l.g.gain.linearRampToValueAtTime(0, now + secs);
        l.src.stop(now + secs + 0.02);
      } catch (e) {}
    }
    function stopHer(secs) {
      if (!ctx) return;
      live = live.filter(function (l) {
        if (!l.her) return true;
        fade(l, secs || 0);
        return false;
      });
    }
    function stopAll(secs) {
      if (!ctx) return;
      live.forEach(function (l) { fade(l, secs || 0); });
      live = [];
    }

    return {
      unlock: unlock, setOn: setOn, play: playAny, step: step, voice: voiceOf, stopHer: stopHer, stopAll: stopAll,
      log: function () { return log.slice(); }
    };
  }

  var exported = { MAX_LIVE: MAX_LIVE, SOUNDS: SOUNDS, VOICES: VOICES, FILES: FILES, stepsBetween: stepsBetween, create: create };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.Sfx = exported;
})(this);
