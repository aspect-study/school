/* What she owns from Lola Lana's Boutique (wardrobe_v1: synced as a union, kept in backups) and buying it with her
   coins. Coins go first: owned only ever grows when it syncs, so an item must never be saved before it is paid for. */
(function (root) {
  'use strict';

  var KEY = 'wardrobe_v1';
  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function own(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

  function read(storage) {
    var raw = null, owned = {};
    try { raw = JSON.parse(storage.getItem(KEY)); } catch (e) {}
    if (isObj(raw) && isObj(raw.owned)) {
      Object.keys(raw.owned).forEach(function (id) {
        var e = raw.owned[id];
        if (isObj(e) && Number(e.t) > 0) owned[id] = { t: Number(e.t), coins: Number(e.coins) || 0 };
      });
    }
    return owned;
  }

  // o = { storage, wallet, history, paused(), now(), item, via? ('wardrobe' by default, 'pets' at the pet stall) }. Returns { ok: true } or { ok: false, why, need? }.
  function buy(o) {
    var it = o.item, owned = read(o.storage);
    if (o.paused()) return { ok: false, why: 'paused' };
    if (own(owned, it.id)) return { ok: false, why: 'owned' };
    var have = o.wallet.balanceStored();
    if (have < it.coins) return { ok: false, why: 'short', need: it.coins - have };
    if (!o.wallet.spend(it.coins)) return { ok: false, why: 'short', need: 0 };
    owned[it.id] = { t: o.now(), coins: it.coins };
    var saved = false;
    try {
      o.storage.setItem(KEY, JSON.stringify({ v: 1, owned: owned }));
      saved = own(read(o.storage), it.id);
    } catch (e) {}
    if (!saved) {
      o.wallet.addBonus(it.coins);
      return { ok: false, why: 'failed' };
    }
    try { if (o.history) o.history.purchased(it.id, it.en, it.coins, o.via || 'wardrobe'); } catch (e) {}
    return { ok: true };
  }

  // A found item (loot.js gifts): hers with 0 coins. True when it is saved (or was already hers).
  function found(storage, id, now) {
    var owned = read(storage);
    if (own(owned, id)) return true;
    owned[id] = { t: now, coins: 0 };
    try {
      storage.setItem(KEY, JSON.stringify({ v: 1, owned: owned }));
      return own(read(storage), id);
    } catch (e) { return false; }
  }

  var exported = { KEY: KEY, read: read, buy: buy, found: found };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.Closet = exported;
})(this);
