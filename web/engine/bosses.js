/* The weekly boss's looks and words. Six bosses take turns, one per week, the same on every device (the week key is
   enough). Pure: army.js draws them in the games, boss.js puts their faces in the boss popups, and the 3D world's
   Boss Fort builds them from the same palette. Lines are silly and kind: minions pop, nobody gets hurt. */
(function (root) {
  'use strict';

  var FIRST_WEEK = '2026-10-05';
  var WEEK_MS = 7 * 86400000;

  function L(en, fil) { return { en: en, fil: fil }; }

  var ROSTER = [
    {
      id: 'cloud', emoji: '🌧️', name: L('King Grumble Cloud', 'Haring Ulap-Simangot'),
      minion: { en: 'raindrops', fil: 'patak ng ulan', one: { en: 'raindrop', fil: 'patak ng ulan' }, color: '#8ec5ff' },
      palette: { body: '#c9d6ea', accent: '#7d8fb3', cheek: '#ff9fb2', eye: '#3a2a4f' },
      pieces: ['🌈', '💧', '✨'],
      lines: {
        hello: L('Hmph! My {n} {m} will rain on your parade!', 'Hmp! Uulanan ka ng aking {n} {m}!'),
        tease: L('Drip drop! Missed me!', 'Drip drop! Hindi mo ako natamaan!'),
        ouch: L('Thunder and blunder! Only {n} more to go!', 'Kulog at kidlat! {n} na lang ang natitira!'),
        home: L('My raindrops float home to the fort. Try again?', 'Lulutang pauwi sa kuta ang aking mga patak. Subukan ulit?'),
        beaten: L('Okay, okay, you win! Here comes a rainbow! See you next Monday!', 'Sige na nga, panalo ka! Heto ang bahaghari! Kita tayo sa Lunes!'),
        dizzy: L('Whoa, so dizzy! I will float away now.', 'Hilong-hilo ako! Lulutang na lang ako palayo.')
      }
    },
    {
      id: 'jelly', emoji: '🍮', name: L('Jelly Jiggles', 'Jelly Jiggles'),
      minion: { en: 'gummy bears', fil: 'gummy bear', one: { en: 'gummy bear', fil: 'gummy bear' }, color: '#ff7eb6' },
      palette: { body: '#ff9fd0', accent: '#ff5fa2', cheek: '#ff6f91', eye: '#3a2a4f' },
      pieces: ['🍬', '🍭', '🍫'],
      lines: {
        hello: L('Wiggle wobble! My {n} {m} are ready to bounce!', 'Boing-boing! Handa nang tumalbog ang aking {n} {m}!'),
        tease: L('Boing! Bounced right off!', 'Boing! Tumalbog lang!'),
        ouch: L('Wobble wobble! Only {n} more to go!', 'Uga-uga! {n} na lang ang natitira!'),
        home: L('My gummy bears bounce home to the fort. Try again?', 'Tatalbog pauwi sa kuta ang aking mga gummy bear. Subukan ulit?'),
        beaten: L('Squish! You win! Candy for everyone! See you next Monday!', 'Plok! Panalo ka! Kendi para sa lahat! Kita tayo sa Lunes!'),
        dizzy: L('Too much jiggle! I am wobbling home.', 'Sobra ang uga ko! Uuwi na ako nang pauga-uga.')
      }
    },
    {
      id: 'snooze', emoji: '😴', name: L('Captain Snooze', 'Kapitan Antok'),
      minion: { en: 'little pillows', fil: 'maliliit na unan', one: { en: 'little pillow', fil: 'maliit na unan' }, color: '#f4f1ff' },
      palette: { body: '#a9c1ff', accent: '#ffd166', cheek: '#ff9fb2', eye: '#2b2140' },
      pieces: ['💤', '☁️', '✨'],
      lines: {
        hello: L('Yaaawn... My {n} {m} will make you sleepy!', 'Haaay... Aantukin ka sa aking {n} {m}!'),
        tease: L('Zzz... Ha! Missed me!', 'Zzz... Ha! Hindi mo ako natamaan!'),
        ouch: L('Wide awake now! Only {n} more to go!', 'Gising na gising na ako! {n} na lang ang natitira!'),
        home: L('My pillows fluff home to the fort. Try again?', 'Uuwi sa kuta ang aking mga unan. Subukan ulit?'),
        beaten: L('Poof! Feathers everywhere! You win! See you next Monday!', 'Puf! Balahibo kahit saan! Panalo ka! Kita tayo sa Lunes!'),
        dizzy: L('So sleepy... I will nap somewhere else.', 'Antok na antok na ako... Sa iba na lang ako iidlip.')
      }
    },
    {
      id: 'mess', emoji: '🗞️', name: L('Mr. Mess', 'G. Kalat'),
      minion: { en: 'paper balls', fil: 'bolang papel', one: { en: 'paper ball', fil: 'bolang papel' }, color: '#fdfbf5' },
      palette: { body: '#f1ead9', accent: '#b8a98f', cheek: '#ff9fb2', eye: '#3a2a4f' },
      pieces: ['📄', '⭐', '🎊'],
      lines: {
        hello: L('Heh heh! My {n} {m} made a big mess!', 'Hehe! Nagkalat ang aking {n} {m}!'),
        tease: L('Crumple crumple! Missed me!', 'Lukot-lukot! Hindi mo ako natamaan!'),
        ouch: L('Hey, no tidying! Only {n} more to go!', 'Hoy, huwag mong ligpitin! {n} na lang ang natitira!'),
        home: L('My paper balls roll home to the fort. Try again?', 'Gugulong pauwi sa kuta ang aking mga bolang papel. Subukan ulit?'),
        beaten: L('All tidy! You win! I will fold you a paper star! See you next Monday!', 'Malinis na lahat! Panalo ka! Igagawa kita ng bituing papel! Kita tayo sa Lunes!'),
        dizzy: L('Whoa, all crumpled up! I am rolling away.', 'Naku, lukot na lukot ako! Gugulong na ako palayo.')
      }
    },
    {
      id: 'fuzz', emoji: '🧶', name: L('Count Fuzzball', 'Konde Himulmol'),
      minion: { en: 'dust bunnies', fil: 'bilog na alikabok', one: { en: 'dust bunny', fil: 'bilog na alikabok' }, color: '#c9bdd6' },
      palette: { body: '#b9a7c9', accent: '#7e6a92', cheek: '#ff9fb2', eye: '#2b2140' },
      pieces: ['✨', '💫', '⭐'],
      lines: {
        hello: L('Ah-choo! My {n} {m} are hiding everywhere!', 'Ha-tsing! Nagtatago kahit saan ang aking {n} {m}!'),
        tease: L('Fluff! Too fuzzy to catch!', 'Pluf! Masyado akong malambot para mahuli!'),
        ouch: L('Ah-choo! Only {n} more to go!', 'Ha-tsing! {n} na lang ang natitira!'),
        home: L('My dust bunnies drift home to the fort. Try again?', 'Lilipad pauwi sa kuta ang aking mga bilog na alikabok. Subukan ulit?'),
        beaten: L('Sparkle puff! So shiny and clean! You win! See you next Monday!', 'Kislap-puf! Napakalinis at makintab! Panalo ka! Kita tayo sa Lunes!'),
        dizzy: L('All swept up! I am floating off.', 'Nawalis na ako! Lilipad na ako palayo.')
      }
    },
    {
      id: 'spud', emoji: '🥔', name: L('Queen Spud', 'Reyna Patatas'),
      minion: { en: 'tater tots', fil: 'maliliit na patatas', one: { en: 'tater tot', fil: 'maliit na patatas' }, color: '#e0a85a' },
      palette: { body: '#d9a066', accent: '#ffd54a', cheek: '#ff8f8f', eye: '#3a2a4f' },
      pieces: ['🍿', '⭐', '✨'],
      lines: {
        hello: L('Hmph! My {n} {m} are royal guards!', 'Hmp! Mga bantay ng reyna ang aking {n} {m}!'),
        tease: L('Ha! You cannot mash me!', 'Ha! Hindi mo ako madudurog!'),
        ouch: L('Royal ouch! Only {n} more to go!', 'Aray ng reyna! {n} na lang ang natitira!'),
        home: L('My tater tots roll home to the fort. Try again?', 'Gugulong pauwi sa kuta ang aking maliliit na patatas. Subukan ulit?'),
        beaten: L('Pop pop pop! Popcorn party! You win! See you next Monday!', 'Pak pak pak! Handaan ng popcorn! Panalo ka! Kita tayo sa Lunes!'),
        dizzy: L('My crown is spinning! I will roll away now.', 'Umiikot ang korona ko! Gugulong na ako palayo.')
      }
    }
  ];

  function utc(key) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key || '');
    return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN;
  }

  function ofWeek(weekKey) {
    var weeks = Math.round((utc(weekKey) - utc(FIRST_WEEK)) / WEEK_MS);
    if (!isFinite(weeks)) return ROSTER[0];
    return ROSTER[((weeks % ROSTER.length) + ROSTER.length) % ROSTER.length];
  }

  function bilingual() { return !root.Lang || root.Lang.both(); }

  function fill(s, n, m) { return s.replace(/\{n\}/g, String(n)).replace(/\{m\}/g, m); }

  // key: hello | tease | ouch | home | beaten | dizzy; n fills {n} (hello: minions, ouch: stages left).
  function text(boss, key, grade, n) {
    var l = boss.lines[key], one = n === 1, m = boss.minion;
    var en = fill(l.en, n, one ? m.one.en : m.en);
    return grade === 'grade2' && bilingual() ? fill(l.fil, n, one ? m.one.fil : m.fil) + ' · ' + en : en;
  }

  function name(boss, grade) {
    var n = boss.name;
    return grade === 'grade2' && bilingual() && n.fil !== n.en ? n.fil + ' · ' + n.en : n.en;
  }

  var BODY = {
    cloud: function (p) {
      return '<circle cx="34" cy="50" r="24" fill="' + p.body + '"/><circle cx="86" cy="50" r="24" fill="' + p.body + '"/>' +
        '<circle cx="60" cy="40" r="30" fill="' + p.body + '"/><ellipse cx="60" cy="68" rx="46" ry="28" fill="' + p.body + '"/>' +
        '<path d="M40 100 l-4 8 M60 100 l-4 8 M80 100 l-4 8" stroke="' + p.accent + '" stroke-width="4" stroke-linecap="round"/>';
    },
    jelly: function (p) {
      return '<path d="M16 94 Q16 20 60 20 Q104 20 104 94 Q90 102 76 94 Q60 102 44 94 Q30 102 16 94Z" fill="' + p.body + '"/>' +
        '<ellipse cx="38" cy="38" rx="9" ry="6" fill="#ffffff" opacity=".6"/><circle cx="60" cy="16" r="7" fill="' + p.accent + '"/>';
    },
    snooze: function (p) {
      return '<ellipse cx="60" cy="64" rx="44" ry="40" fill="' + p.body + '"/>' +
        '<path d="M22 40 Q60 -6 98 40 Z" fill="' + p.accent + '"/><circle cx="102" cy="22" r="8" fill="#ffffff"/>';
    },
    mess: function (p) {
      return '<circle cx="60" cy="60" r="44" fill="' + p.body + '"/>' +
        '<path d="M28 38 l12 8 M80 26 l10 10 M92 82 l-12 -6 M26 80 l10 -4" stroke="' + p.accent + '" stroke-width="4" stroke-linecap="round"/>';
    },
    fuzz: function (p) {
      var out = '';
      for (var i = 0; i < 12; i++) {
        var a = i / 12 * Math.PI * 2;
        out += '<circle cx="' + (60 + Math.cos(a) * 40).toFixed(1) + '" cy="' + (60 + Math.sin(a) * 40).toFixed(1) + '" r="11" fill="' + p.body + '"/>';
      }
      return out + '<circle cx="60" cy="60" r="42" fill="' + p.body + '"/>';
    },
    spud: function (p) {
      return '<ellipse cx="60" cy="64" rx="42" ry="42" fill="' + p.body + '"/>' +
        '<ellipse cx="34" cy="86" rx="4" ry="3" fill="' + p.accent + '" opacity=".5"/><ellipse cx="88" cy="40" rx="3" ry="2" fill="#a86f3c"/>' +
        '<path d="M38 26 l8 -16 l8 12 l6 -16 l6 16 l8 -12 l8 16 z" fill="' + p.accent + '"/>';
    }
  };

  function face(p, mood) {
    var e = p.eye, eyes, mouth;
    if (mood === 'ouch') {
      eyes = '<path d="M34 46 l10 6 l-10 6 M86 46 l-10 6 l10 6" stroke="' + e + '" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>';
      mouth = '<ellipse cx="60" cy="74" rx="7" ry="6" fill="' + e + '"/>';
    } else if (mood === 'dizzy') {
      eyes = '<circle cx="40" cy="52" r="8" stroke="' + e + '" stroke-width="3" fill="none"/><circle cx="40" cy="52" r="3" fill="' + e + '"/>' +
        '<circle cx="80" cy="52" r="8" stroke="' + e + '" stroke-width="3" fill="none"/><circle cx="80" cy="52" r="3" fill="' + e + '"/>';
      mouth = '<path d="M48 74 q6 -6 12 0 q6 6 12 0" stroke="' + e + '" stroke-width="4" fill="none" stroke-linecap="round"/>';
    } else {
      eyes = '<ellipse cx="40" cy="52" rx="6" ry="8" fill="' + e + '"/><ellipse cx="80" cy="52" rx="6" ry="8" fill="' + e + '"/>' +
        '<circle cx="42" cy="49" r="2.4" fill="#ffffff"/><circle cx="82" cy="49" r="2.4" fill="#ffffff"/>';
      mouth = '<path d="M50 70 Q60 80 70 70" stroke="' + e + '" stroke-width="4" fill="none" stroke-linecap="round"/>';
    }
    return eyes + mouth + '<ellipse cx="28" cy="66" rx="8" ry="5" fill="' + p.cheek + '" opacity=".7"/>' +
      '<ellipse cx="92" cy="66" rx="8" ry="5" fill="' + p.cheek + '" opacity=".7"/>';
  }

  // mood: normal | ouch | dizzy
  function svg(boss, mood) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 110" aria-hidden="true">' +
      BODY[boss.id](boss.palette) + face(boss.palette, mood) + '</svg>';
  }

  var MINION = {
    cloud: function (c) { return '<path d="M20 4 Q34 22 30 30 A10 10 0 0 1 10 30 Q6 22 20 4Z" fill="' + c + '"/>'; },
    jelly: function (c) {
      return '<circle cx="12" cy="12" r="4" fill="' + c + '"/><circle cx="28" cy="12" r="4" fill="' + c + '"/>' +
        '<circle cx="20" cy="20" r="10" fill="' + c + '"/><ellipse cx="20" cy="32" rx="9" ry="6" fill="' + c + '"/>';
    },
    snooze: function (c) { return '<rect x="4" y="10" width="32" height="22" rx="9" fill="' + c + '" stroke="#a9c1ff" stroke-width="2"/>'; },
    mess: function (c) {
      return '<circle cx="20" cy="21" r="15" fill="' + c + '" stroke="#b8a98f" stroke-width="2"/>' +
        '<path d="M10 14 l6 4 M26 10 l4 6 M28 30 l-6 -2" stroke="#b8a98f" stroke-width="2" stroke-linecap="round"/>';
    },
    fuzz: function (c) {
      return '<ellipse cx="14" cy="9" rx="3" ry="7" fill="' + c + '"/><ellipse cx="26" cy="9" rx="3" ry="7" fill="' + c + '"/>' +
        '<circle cx="20" cy="24" r="13" fill="' + c + '"/>';
    },
    spud: function (c) { return '<rect x="6" y="10" width="28" height="22" rx="8" fill="' + c + '"/>'; }
  };

  function minionSvg(boss) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" aria-hidden="true">' + MINION[boss.id](boss.minion.color) +
      '<circle cx="16" cy="22" r="2" fill="#3a2a4f"/><circle cx="24" cy="22" r="2" fill="#3a2a4f"/>' +
      '<path d="M17 26 q3 3 6 0" stroke="#3a2a4f" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>';
  }

  var exported = { ROSTER: ROSTER, FIRST_WEEK: FIRST_WEEK, ofWeek: ofWeek, text: text, name: name, svg: svg, minionSvg: minionSvg };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.Bosses = exported;
})(this);
