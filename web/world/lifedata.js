/* Living world data (pure, so the Node tests can read it): what each world character and each pet does. A routine is
   { move, steps }: move 'here' acts where they stand, 'home' walks back first, 'wander' walks to a free point inside
   the leash (a pet's: around its owner), 'route' walks the actor's route; steps run one after another, each
   { action, len: [min, max], prop?, pop?, voice? }. Characters' actions are poses in cast.js, pets' actions are moods
   in petbody.js. build() turns the layout into the actor list routines.js runs. */
(function (root) {
  'use strict';
  var node = typeof module !== 'undefined' && module.exports;

  function r(move, steps) { return { move: move, steps: steps }; }
  function s(action, min, max, extra) { return Object.assign({ action: action, len: [min, max] }, extra); }

  var CHAR_ROUTINES = {
    sweep: r('wander', [s('sweep', 4, 6, { prop: '🧹' })]),
    read: r('here', [s('read', 5, 8, { prop: '📖' })]),
    water: r('wander', [s('water', 3, 5, { prop: '💧' })]),
    gaze: r('here', [s('gaze', 3, 5, { pop: '☁️' })]),
    stretch: r('here', [s('stretch', 2, 3)]),
    hum: r('here', [s('hum', 3, 5, { pop: '🎵' })]),
    arrange: r('wander', [s('arrange', 3, 5, { prop: '📦' })]),
    serve: r('home', [s('serve', 3, 5, { pop: '🛍️' })]),
    sip: r('home', [s('sip', 2, 3, { prop: '🥤' })]),
    hammer: r('home', [s('hammer', 4, 6, { pop: '🔨' })]),
    nibble: r('wander', [s('nibble', 3, 4, { prop: '🥕' })]),
    hop: r('wander', [s('hop', 2, 3)]),
    flap: r('here', [s('flap', 1.5, 2.5)]),
    fly: r('wander', [s('hover', 1, 1.5)]),
    stroll: r('route', [s('wave', 1.5, 2.5, { pop: '👋' })]),
    wave: r('here', [s('wave', 2, 3, { pop: '👋' })])
  };

  var PET_ROUTINES = {
    sit: r('here', [s('sit', 3, 6)]),
    nap: r('here', [s('sleep', 5, 9, { pop: '💤' })]),
    sniff: r('wander', [s('graze', 2, 4)]),
    hop: r('wander', [s('hop', 2, 3)]),
    say: r('here', [s('hop', 1.2, 1.6, { pop: '💬', voice: true })]),
    preen: r('here', [s('preen', 2, 3)]),
    pounce: r('wander', [s('crouch', 1, 1.5), s('pounce', 0.6, 0.6, { voice: true })]),
    shell: r('here', [s('shell', 2.5, 3.5, { pop: '🐢' })]),
    breathe: r('here', [s('rear', 0.8, 0.8), s('breathe', 1.2, 1.2, { pop: '✨', voice: true })]),
    butterfly: r('wander', [s('chase', 3, 4, { prop: '🦋' })]),
    fetch: r('wander', [s('carry', 3, 4, { prop: '🦴' })]),
    wheel: r('here', [s('run', 3, 4)]),
    roll: r('here', [s('roll', 2, 3)]),
    slide: r('wander', [s('belly', 2, 3, { pop: '❄️' })]),
    graze: r('wander', [s('graze', 4, 6, { prop: '🌾' })]),
    bamboo: r('here', [s('munch', 4, 6, { prop: '🎋' })]),
    carrot: r('here', [s('munch', 3, 4, { prop: '🥕' })]),
    prance: r('wander', [s('prance', 3, 4, { pop: '✨' })]),
    stare: r('here', [s('stare', 3, 4, { pop: '👀' })]),
    paddle: r('here', [s('paddle', 3, 4, { prop: '💧' })]),
    peck: r('wander', [s('peck', 3, 4)]),
    greet: r('here', [s('hop', 1.2, 1.4, { pop: '💕', voice: true })]),
    play: r('here', [s('chase', 4, 4, { pop: '🎵' })])
  };

  // What each species does when it is free; the engine adds 'sit', and 'nap' when its owner has been still a while.
  var SPECIES = {
    chick: ['peck', 'hop'], kitten: ['butterfly', 'preen'], puppy: ['fetch', 'sniff'], hamster: ['wheel', 'preen'],
    duckling: ['paddle', 'peck'], bunny: ['hop', 'carrot'], turtle: ['shell', 'sniff'], piglet: ['roll', 'sniff'],
    parrot: ['say', 'preen'], carabao: ['graze', 'sit'], penguin: ['slide', 'preen'], fox: ['pounce', 'sniff'],
    tarsier: ['stare', 'preen'], panda: ['bamboo', 'roll'], unicorn: ['prance', 'preen'], dragon: ['breathe', 'hop']
  };

  // Walking speed relative to the engine's pet walk.
  var PET_SPEED = { turtle: 0.4, carabao: 0.7, panda: 0.7, piglet: 0.85, fox: 1.2, puppy: 1.1, hamster: 1.2, chick: 1.1 };

  var KID_PETS = [
    { owner: 'migo', species: 'puppy', color: 2, name: 'Tagpi' },
    { owner: 'ella', species: 'bunny', color: 3, name: 'Lila' },
    { owner: 'tomas', species: 'fox', color: 0, name: 'Kidlat' },
    { owner: 'bea', species: 'hamster', color: 2, name: 'Pandesal' },
    { owner: 'luna', species: 'kitten', color: 4, name: 'Mingming' }
  ];
  var CHAR_PETS = [
    { owner: 'hoot', species: 'parrot', color: 1, name: 'Kwento' },
    { owner: 'bunny', species: 'turtle', color: 1, name: 'Tagal' },
    { owner: 'mimi', species: 'unicorn', color: 1, name: 'Bituin' }
  ];
  // By position in Layout.buddies, so both grades get them.
  var BUDDY_PETS = [
    { index: 1, species: 'panda', color: 1, name: 'Kawayan' },
    { index: 4, species: 'penguin', color: 2, name: 'Hielo' },
    { index: 6, species: 'duckling', color: 3, name: 'Pitik' }
  ];

  var BUDDY_SETS = [['sweep', 'read', 'gaze'], ['water', 'stretch', 'hum'], ['read', 'hum', 'arrange'], ['sweep', 'water', 'gaze']];
  var OWNER_SETS = {
    lana: ['arrange', 'serve', 'hum', 'stretch'], kiko: ['arrange', 'serve', 'sip', 'stretch'],
    pilo: ['serve', 'hum', 'sip', 'stretch'], tasyo: ['hammer', 'stretch', 'sip', 'serve']
  };

  function pet(owner, p) {
    return { id: 'pet:' + owner, pet: true, owner: owner, species: p.species, color: p.color, name: p.name };
  }

  // kidIds: the playmates' ids; each becomes an external actor ('mate:<id>') whose position the world feeds in.
  function build(grade, L, kidIds) {
    var pr = L.props(grade), buddies = L.buddies(grade), out = [];
    buddies.forEach(function (b, i) {
      out.push({ id: 'buddy:' + b.app, kind: 'buddy', home: { x: b.x, z: b.z }, face: b.face, leash: 2, homeR: 0.8, waves: true, routines: BUDDY_SETS[i % BUDDY_SETS.length] });
    });
    out.push({ id: 'hoot', kind: 'hoot', home: { x: pr.hoot.x, z: pr.hoot.z }, face: Math.PI, leash: 3, homeR: 0, fly: true, waves: false, routines: ['read', 'flap', 'fly', 'gaze'] });
    out.push({ id: 'bunny', kind: 'bunny', home: { x: pr.bunny.x, z: pr.bunny.z }, face: -Math.PI / 2, leash: 3, homeR: 0.1, waves: true, routines: ['hop', 'nibble', 'stretch', 'gaze'] });
    Object.keys(OWNER_SETS).forEach(function (id) {
      out.push({ id: id, kind: 'owner', home: { x: pr[id].x, z: pr[id].z }, face: -Math.PI / 2, leash: 2, homeR: pr[id].r, waves: true, routines: OWNER_SETS[id] });
    });
    var ring = [];
    for (var i = 0; i < 6; i++) ring.push({ x: pr.mimi.x + Math.sin(i / 6 * Math.PI * 2) * 2.5, z: pr.mimi.z + Math.cos(i / 6 * Math.PI * 2) * 2.5 });
    out.push({ id: 'mimi', kind: 'mimi', home: { x: pr.mimi.x, z: pr.mimi.z }, face: 0, leash: 3, homeR: pr.mimi.r, waves: true, route: ring, routines: ['stroll', 'gaze', 'wave', 'stretch'] });

    (kidIds || []).forEach(function (id) { out.push({ id: 'mate:' + id, external: true }); });
    KID_PETS.forEach(function (p) { if ((kidIds || []).indexOf(p.owner) >= 0) out.push(pet('mate:' + p.owner, p)); });
    CHAR_PETS.forEach(function (p) { out.push(pet(p.owner, p)); });
    BUDDY_PETS.forEach(function (p) { if (buddies[p.index]) out.push(pet('buddy:' + buddies[p.index].app, p)); });
    return out;
  }

  var exported = { CHAR_ROUTINES: CHAR_ROUTINES, PET_ROUTINES: PET_ROUTINES, SPECIES: SPECIES, PET_SPEED: PET_SPEED, build: build };
  if (node) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.LifeData = exported;
})(this);
