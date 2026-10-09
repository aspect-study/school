const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile } = require('./paths.js');
const F = require(worldFile('furniture.js'));
const Room = require(worldFile('room.js'));
const D = require(worldFile('decorate.js'));

const starter = (id) => { const it = F.find(id); return !!it && !it.earned && it.coins === 0; };
const owning = (...ids) => (id) => starter(id) || ids.includes(id);

test('a tab lists her pieces first (placed or not), then the ones for sale in catalog order', () => {
  const room = Room.start(F, 4);
  const list = D.cards('furniture', owning('home-bookcase'), room);
  assert.deepEqual(list.slice(0, 4), [
    { id: 'home-bed', state: 'on' }, { id: 'home-rug-round', state: 'on' }, { id: 'home-lamp', state: 'mine' },
    { id: 'home-bookcase', state: 'mine' },
  ]);
  const sale = list.slice(4);
  assert.ok(sale.every((c) => c.state === 'sale'));
  assert.deepEqual(sale.map((c) => c.id), F.inTab('furniture').filter((it) => it.coins > 0 && it.id !== 'home-bookcase').map((it) => it.id));
});

test('the ⭐ tab shows the earned pieces she has, then the locked ones; nothing there is ever for sale', () => {
  const room = Room.place(F, Room.start(F, 4), 'home-lamp');
  const list = D.cards('earned', owning('home-gold-frame'), room);
  assert.deepEqual(list[0], { id: 'home-gold-frame', state: 'mine' });
  assert.ok(list.slice(1).every((c) => c.state === 'locked'));
  assert.equal(list.length, F.inTab('earned').length);
  for (const tab of F.TABS.filter((t) => t !== 'earned')) {
    assert.ok(D.cards(tab, owning(), room).every((c) => c.state !== 'locked'), tab + ' has no locked cards');
  }
});

test('the 🎨 tab marks the walls and floor in the room, and lists the star ceiling once she has earned it', () => {
  const room = Object.assign(Room.start(F, 4), { wall: 'home-wall-blue' });
  const list = D.cards('room', owning(), room);
  assert.deepEqual(list.slice(0, 4), [
    { id: 'home-wall-pink', state: 'mine' }, { id: 'home-wall-blue', state: 'on' },
    { id: 'home-floor-wood', state: 'on' }, { id: 'home-floor-tile', state: 'mine' },
  ]);
  assert.ok(!list.some((c) => c.id === 'home-star-ceiling'));
  const earned = D.cards('room', owning('home-star-ceiling'), Object.assign({}, room, { stars: true }));
  assert.deepEqual(earned.find((c) => c.id === 'home-star-ceiling'), { id: 'home-star-ceiling', state: 'on' });
  assert.ok(earned.findIndex((c) => c.id === 'home-star-ceiling') < earned.findIndex((c) => c.state === 'sale'), 'hers, before the ones for sale');
});

test('inRoom: placed pieces and the room picks in use', () => {
  const room = Room.start(F, 4);
  assert.equal(D.inRoom(F.find('home-bed'), room), true);
  assert.equal(D.inRoom(F.find('home-lamp'), room), false);
  assert.equal(D.inRoom(F.find('home-wall-pink'), room), true);
  assert.equal(D.inRoom(F.find('home-star-ceiling'), room), false);
});
