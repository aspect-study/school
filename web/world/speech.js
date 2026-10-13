/* Which line a character says on its own or in a chat. Pure: the world passes in the speaker, the facts about her (see
   speechctx.js) and what each speaker said lately, so Node can test every choice. A line is { id, when: [tags], say, fil?,
   replies?: [{ text, next }] } in a pool; a speaker draws on its own pools and the shared pool of its kind. */
(function (root) {
  'use strict';
  var node = typeof module !== 'undefined' && module.exports;
  var RECENT = 20;

  var FIXED_TAGS = [
    'time:morning', 'time:afternoon', 'time:evening', 'time:night',
    'near:slide', 'near:swings', 'near:seesaw', 'near:merry', 'near:plaza', 'near:fort', 'near:garden', 'near:pond', 'near:shop',
    'wearing:hat', 'wearing:glasses', 'wearing:neck', 'wearing:back', 'streak:3', 'streak:7', 'after:ride', 'tired'
  ];
  var SLOTS = ['hat', 'glasses', 'neck', 'back', 'pet', 'streak'];

  function validTag(tag) {
    return FIXED_TAGS.indexOf(tag) >= 0 || /^pet:[a-z]+$/.test(tag) || /^fav:[a-z]+:[0-9]+$/.test(tag);
  }
  function validSlot(name) { return SLOTS.indexOf(name) >= 0 || /^fav_[a-z]+$/.test(name); }

  function slotsOf(text) {
    var out = [], re = /\{([a-z_]+)\}/g, m;
    while ((m = re.exec(text))) out.push(m[1]);
    return out;
  }

  function newState() { return { recent: {} }; }

  function poolIds(sp) {
    if (sp.kind === 'pet') return ['any-pet', 'species:' + sp.species, 'pet:' + String(sp.name || '').toLowerCase()];
    if (sp.kind === 'kid') return ['any-kid', 'kid:' + sp.id];
    if (sp.kind === 'char') return ['char:' + sp.id];
    if (sp.kind === 'buddy') return ['any-buddy', 'buddy:' + sp.app];
    return [sp.kind + ':' + sp.id];
  }

  function holds(line, ctx) {
    var ok = (line.when || []).every(function (t) { return ctx.tags.indexOf(t) >= 0; });
    return ok && slotsOf(line.say).every(function (s) { return !!ctx.slots[s]; });
  }

  // The same facts without one slot: her own pet must not talk about "your pet {pet}".
  function without(ctx, slot) {
    var slots = {};
    Object.keys(ctx.slots).forEach(function (k) { if (k !== slot) slots[k] = ctx.slots[k]; });
    return { tags: ctx.tags, slots: slots };
  }

  function fill(text, ctx) {
    return String(text).replace(/\{([a-z_]+)\}/g, function (m, k) { return ctx.slots[k] || ''; });
  }

  // A chat opener has replies. A follow line (follow: true) is only ever reached through a reply, never picked.
  function isChat(line) { return !!(line.replies && line.replies.length); }

  function remember(state, id, lineId) {
    var list = state.recent[id] || (state.recent[id] = []);
    list.push(lineId);
    if (list.length > RECENT) list.shift();
  }

  function eligible(data, speaker, ctx, state) {
    var recent = state.recent[speaker.id] || [], out = [];
    poolIds(speaker).forEach(function (p) {
      (data.pools[p] || []).forEach(function (line) {
        if (!line.follow && recent.indexOf(line.id) < 0 && holds(line, ctx)) out.push(line);
      });
    });
    return out;
  }

  // Ambient picks are plain lines. chatOnly: a tap chat wants an opener with replies, and falls back to a plain line
  // when no opener fits. The most specific lines win; ties are random.
  function pick(data, speaker, ctx, state, rand, chatOnly) {
    var all = eligible(data, speaker, ctx, state), chats = all.filter(isChat), plain = all.filter(function (l) { return !isChat(l); });
    var from = chatOnly && chats.length ? chats : plain;
    if (!from.length) return null;
    var top = Math.max.apply(null, from.map(function (l) { return (l.when || []).length; }));
    var best = from.filter(function (l) { return (l.when || []).length === top; });
    var line = best[Math.min(best.length - 1, Math.floor(rand() * best.length))];
    remember(state, speaker.id, line.id);
    return line;
  }

  function reply(data, r) {
    var found = null;
    Object.keys(data.pools).forEach(function (p) {
      data.pools[p].forEach(function (l) { if (l.id === r.next) found = l; });
    });
    return found;
  }

  function merge() {
    var out = { pools: {} };
    [].forEach.call(arguments, function (d) {
      if (!d) return;
      Object.keys(d.pools).forEach(function (p) { out.pools[p] = (out.pools[p] || []).concat(d.pools[p]); });
    });
    return out;
  }

  var exported = {
    RECENT: RECENT, FIXED_TAGS: FIXED_TAGS, SLOTS: SLOTS, validTag: validTag, validSlot: validSlot, slotsOf: slotsOf, without: without,
    newState: newState, poolIds: poolIds, holds: holds, fill: fill, isChat: isChat, eligible: eligible, pick: pick, reply: reply, merge: merge
  };
  if (node) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.Speech = exported;
})(this);
