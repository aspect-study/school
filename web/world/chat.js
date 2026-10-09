/* Which line a character says. Pure: folk.js passes in what it knows about her, so Node can test every choice.
   A buddy's lines come in the spec's order (boss, review, quest, medal, missed her, fallback); 💬 More walks down them. */
(function (root) {
  'use strict';
  var DAY = 86400000, MISS_DAYS = 3;
  var node = typeof module !== 'undefined' && module.exports;
  var Lines = node ? require('./lines.js') : null;

  function lines() { return Lines || root.World3D.Lines; }

  // Two lines into one. Grade 2 lines are "Filipino · English": the halves go together.
  function join(a, b) {
    var sep = ' · ', i = a.lastIndexOf(sep), j = b.lastIndexOf(sep);
    if (i < 0 || j < 0) return a + ' ' + b;
    return a.slice(0, i) + ' ' + b.slice(0, j) + sep + a.slice(i + sep.length) + ' ' + b.slice(j + sep.length);
  }

  function medalLine(L, t) {
    if (!t || !(t.total > 0)) return null;
    var g = t.gold || 0, s = t.silver || 0, b = t.bronze || 0;
    if (g >= t.total) return L.allGold;
    if (g + s >= t.total) return L.toGold(t.total - g);
    if (g + s + b >= t.total) return L.toSilver(t.total - g - s);
    return L.toBronze(t.total - g - s - b);
  }

  // A hello that is still a pair belongs to a Filipino-language subject's buddy: its lines keep both languages.
  // s = { boss, due, quest, tally, lastT }; o = { now, subject, hi, inGame (review stays in the game) }
  function buddyLines(grade, s, o) {
    var pairHello = grade === 'grade2' && o.hi.indexOf(' · ') >= 0, L = lines().TEXT[pairHello ? 'grade2pair' : grade], out = [];
    if (s.boss) out.push(L.boss(o.subject));
    if (s.due > 0) out.push(o.inGame ? L.dueGame(s.due) : L.due(s.due));
    if (s.quest) out.push(L.quest(o.subject));
    var m = medalLine(L, s.tally);
    if (m) out.push(m);
    if (typeof s.lastT === 'number') {
      var days = Math.floor((o.now - s.lastT) / DAY);
      if (days >= MISS_DAYS) out.push(L.missed(days));
    }
    out.push(L.fallback);
    out[0] = join(o.hi, out[0]);
    return out;
  }

  function hash(text) {
    var h = 7;
    for (var i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
    return h;
  }

  // The same quote all day for a tree; k = how many times she pressed More.
  function quote(grade, tree, day, k) {
    var Q = lines().QUOTES, q = Q[(hash(String(day) + '|' + tree) + (k || 0)) % Q.length];
    return grade === 'grade2' && (!root.Lang || root.Lang.both()) ? q[0] + ' · ' + q[1] : q[1];
  }

  // shelf = Wallet.shelf(points): the cheapest reward she cannot afford yet, or a happy line when she can afford them all.
  function bunnyLine(grade, shelf) {
    var L = lines().TEXT[grade].bunny, best = null;
    (shelf || []).forEach(function (s) {
      if (s && s.item && !s.ok && !s.daily && s.need > 0 && (!best || s.need < best.need)) best = s;
    });
    return best ? L.save(best.need, best.item.emoji + ' ' + best.item.goal) : L.any;
  }

  var exported = { join: join, buddyLines: buddyLines, quote: quote, bunnyLine: bunnyLine };
  if (node) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.Chat = exported;
})(this);
