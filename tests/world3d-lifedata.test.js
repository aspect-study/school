const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile } = require('./paths.js');
const L = require(worldFile('layout.js'));
const Pets = require(worldFile('pets.js'));
const Data = require(worldFile('lifedata.js'));

const KIDS = ['migo', 'ella', 'tomas', 'bea', 'jun', 'luna', 'new1', 'new2', 'new3'];

test('every species has routines and all of them exist', () => {
  assert.deepEqual(Object.keys(Data.SPECIES).sort(), Pets.PETS.map((p) => p.id).sort());
  for (const [species, list] of Object.entries(Data.SPECIES)) {
    assert.ok(list.length >= 2, species);
    for (const id of list) assert.ok(Data.PET_ROUTINES[id], species + ' → ' + id);
  }
});

test('routines are well formed', () => {
  for (const table of [Data.CHAR_ROUTINES, Data.PET_ROUTINES]) {
    for (const [id, rt] of Object.entries(table)) {
      assert.ok(['here', 'home', 'wander', 'route'].includes(rt.move), id);
      assert.ok(rt.steps.length >= 1, id);
      for (const s of rt.steps) {
        assert.ok(s.action, id);
        assert.ok(s.len[0] > 0 && s.len[1] >= s.len[0], id);
      }
    }
  }
});

test('every grade builds the same cast: 17 or 14 characters, 11 pets, all different', () => {
  for (const grade of ['grade5', 'grade2']) {
    const defs = Data.build(grade, L, KIDS), chars = defs.filter((d) => !d.pet && !d.external), pets = defs.filter((d) => d.pet);
    assert.equal(chars.length, L.buddies(grade).length + 7, grade);
    assert.equal(pets.length, 11, grade);
    assert.equal(new Set(pets.map((p) => p.species)).size, 11, 'species are unique');
    assert.equal(new Set(pets.map((p) => p.name)).size, 11, 'names are unique');
    const defaults = Pets.PETS.map((p) => p.name);
    for (const p of pets) assert.ok(!defaults.includes(p.name), p.name + ' is a stall default name');
    const ids = new Set(defs.map((d) => d.id));
    for (const p of pets) assert.ok(ids.has(p.owner), p.id + ' owner ' + p.owner);
    for (const c of chars) for (const id of c.routines) assert.ok(Data.CHAR_ROUTINES[id], c.id + ' → ' + id);
  }
});

test('characters start where the world puts them and wander only a little', () => {
  const defs = Data.build('grade5', L, KIDS), pr = L.props('grade5');
  const lana = defs.find((d) => d.id === 'lana'), mimi = defs.find((d) => d.id === 'mimi'), hoot = defs.find((d) => d.id === 'hoot');
  assert.deepEqual(lana.home, { x: pr.lana.x, z: pr.lana.z });
  assert.deepEqual(mimi.home, { x: pr.mimi.x, z: pr.mimi.z });
  assert.equal(hoot.fly, true);
  for (const d of defs.filter((x) => !x.pet && !x.external)) assert.ok(d.leash >= 1.5 && d.leash <= 6, d.id);
  assert.ok(mimi.route.length >= 4);
});

test('the six playmate pets belong to named friends and the kids in the list', () => {
  const defs = Data.build('grade5', L, KIDS);
  const kidPets = defs.filter((d) => d.pet && d.owner.startsWith('mate:'));
  assert.equal(kidPets.length, 5);
  for (const p of kidPets) assert.ok(KIDS.includes(p.owner.slice(5)), p.owner);
  assert.ok(defs.filter((d) => d.external).length === KIDS.length);
});
