/* The living world in 3D: runs routines.js for the characters and pets, moves each character to its pose (Hoot's body
   only, because his bench is part of his group), builds the unique pets (petbody.js), shows a prop emoji beside whoever
   is using one and a pop over their head, plays a pet's voice when it is close, and shows a pet's name only when she
   is near. Cosmetic: nothing is saved, no coins or points. */
(function (root) {
  'use strict';
  var W = root.World3D = root.World3D || {};
  var SHOW = 50, TAG_R = 7, VOICE_R = 14, POP_TIME = 1.4, POOLS = 8, PROP_SIDE = 1.1;
  var CHAR_HEAD = 4.4, PET_HEAD = 2.4, CHAR_PROP_Y = 2.3, PET_PROP_Y = 1.1;

  // o = { S, grade, rand, blocked(x, z, r), kids: ids from mates.api.ids(), chars() (folk.chars), owners() (mates.api.owners),
  //       mimi() (town.mimiLife), talkingId() → id | null, busy() → bool, waving() → bool, sfx(name) }
  function create(o) {
    var S = o.S, L = W.Layout, defs = W.LifeData.build(o.grade, L, o.kids);
    var obs = L.obstacles(o.grade), bounds = L.GRADES[o.grade].bounds;
    var engine = W.Routines.create({
      actors: defs, rand: o.rand,
      blocked: function (x, z, r) { return L.blocked(obs, bounds, x, z, r) || !!(o.blocked && o.blocked(x, z, r)); }
    });
    var chars = o.chars(), mimi = o.mimi(), textures = {}, pets = {}, props = {}, pool = [], forced;
    chars.mimi = mimi.char;

    function texture(e) {
      if (!textures[e]) textures[e] = S.emoji(e);
      return textures[e];
    }
    function sprite(e, size) {
      var sp = S.sprite(texture(e), size, size);
      sp.visible = false;
      S.scene.add(sp);
      return sp;
    }

    defs.forEach(function (d) {
      if (!d.pet) return;
      var body = W.PetBody.build(S, { pet: d.species, petColor: d.color, petWear: {} });
      body.group.visible = false;
      S.scene.add(body.group);
      pets[d.id] = { def: d, body: body, tag: W.PetBody.tag(S, body, d.name) };
      pets[d.id].tag.visible = false;
    });
    for (var i = 0; i < POOLS; i++) pool.push({ sp: null, e: '', t: 0, x: 0, y: 0, z: 0 });

    function pop(x, y, z, text) {
      var slot = pool.filter(function (p) { return p.t <= 0; })[0];
      if (!slot) return;
      if (!slot.sp || slot.e !== text) {
        if (slot.sp) S.scene.remove(slot.sp);
        slot.sp = sprite(text, 1.4);
        slot.e = text;
      }
      slot.t = POP_TIME;
      slot.x = x;
      slot.y = y;
      slot.z = z;
    }

    // The emoji of what someone is using, floating beside them while they use it.
    function showProp(id, e, x, y, z, face) {
      var p = props[id];
      if (!e) {
        if (p) p.sp.visible = false;
        return;
      }
      if (!p || p.e !== e) {
        if (p) S.scene.remove(p.sp);
        p = props[id] = { e: e, sp: sprite(e, 1.1) };
      }
      p.sp.visible = true;
      p.sp.position.set(x + Math.sin(face + Math.PI / 2) * PROP_SIDE, y, z + Math.cos(face + Math.PI / 2) * PROP_SIDE);
    }

    function applyChar(def, p, t, st) {
      var c = chars[def.id];
      if (!c) return;
      var near = Math.hypot(p.x - st.x, p.z - st.z) <= SHOW;
      if (def.id === 'mimi') {
        if (!p.held) mimi.place(p.x, p.z, p.face);
      } else if (def.fly) {
        // Hoot's bench belongs to his group, so only his body moves, in the group's own axes.
        var f = c.group.rotation.y, dx = p.x - def.home.x, dz = p.z - def.home.z;
        c.body.position.x = dx * Math.cos(f) - dz * Math.sin(f);
        c.body.position.z = dx * Math.sin(f) + dz * Math.cos(f);
      } else {
        c.group.position.set(p.x, 0, p.z);
        c.group.rotation.y = p.face;
      }
      if (c.setAction && !p.held) c.setAction(p.action, def.fly ? p.y : 0);
      showProp(def.id, near && !p.held ? p.prop : null, p.x, CHAR_PROP_Y + (def.fly ? p.y : 0), p.z, p.face);
    }

    function applyPet(pet, p, t, st) {
      var g = pet.body.group, d = Math.hypot(p.x - st.x, p.z - st.z);
      g.visible = !p.hidden && d <= SHOW;
      pet.tag.visible = g.visible && d <= TAG_R;
      if (!g.visible) {
        showProp(pet.def.id, null);
        return;
      }
      g.position.set(p.x, p.y, p.z);
      g.rotation.y = p.face;
      pet.body.animate(t, p.action);
      showProp(pet.def.id, p.prop, p.x, PET_PROP_Y, p.z, p.face);
    }

    function tick(t, dt, st) {
      var out = engine.tick(dt, {
        x: st.x, z: st.z, sprint: !!st.sprint, cam: { x: S.camera.position.x, z: S.camera.position.z },
        talkingTo: forced !== undefined ? forced : (o.talkingId() || (mimi.talking() ? 'mimi' : null)),
        busy: !!(o.busy && o.busy()), waving: !!(o.waving && o.waving()),
        hold: mimi.held() ? { mimi: true } : null, owners: o.owners()
      });
      defs.forEach(function (d) {
        if (d.external) return;
        var p = out.poses[d.id];
        if (d.pet) applyPet(pets[d.id], p, t, st);
        else applyChar(d, p, t, st);
      });
      out.pops.forEach(function (q) {
        var p = out.poses[q.id], d = Math.hypot(p.x - st.x, p.z - st.z);
        if (d <= SHOW && !p.hidden) pop(p.x, (p.pet ? PET_HEAD : CHAR_HEAD) + p.y, p.z, q.text);
      });
      out.sounds.forEach(function (q) {
        var p = out.poses[q.id];
        if (o.sfx && Math.hypot(p.x - st.x, p.z - st.z) <= VOICE_R) o.sfx(q.species === 'dragon' ? 'rawr' : 'pet-' + q.species);
      });
      pool.forEach(function (p) {
        if (p.t <= 0) {
          if (p.sp) p.sp.visible = false;
          return;
        }
        p.t -= dt;
        p.sp.visible = p.t > 0;
        p.sp.position.set(p.x, p.y + (POP_TIME - p.t) * 0.8, p.z);
      });
    }

    return {
      tick: tick,
      debug: {
        list: engine.list,
        pets: function () { return Object.keys(pets); },
        talk: function (id) { forced = id === null ? undefined : id; }
      }
    };
  }

  W.Life = { create: create };
})(this);
