/* Who stands by each subject door: a name, a face for the speech bubble, a hello line and the look cast.js builds.
   Grade 2 hello lines pair Filipino with English, but show English alone unless the Filipino switch is on (the Filipino and
   Makabansa buddies keep the pair: their questions are Filipino). A new game needs a buddy here (the test fails otherwise). */
(function (root) {
  'use strict';

  var KINDS = ['kitten', 'worm', 'frog', 'carabao', 'tarsier', 'panda', 'puppy', 'hedgehog', 'robot', 'bird', 'bear', 'mouse'];
  var PROPS = ['ruler', 'book', 'tube', 'pencil', 'heart', 'ball', 'needle', 'note', 'block', 'glass', 'mouse'];
  var HATS = ['salakot', 'cap'];

  var BUDDIES = {
    grade5: {
      'history-explorers': { name: 'Kiko', face: '🐃', hi: 'Mabuhay! I love our history!', look: { kind: 'carabao', fur: '#9a98ae', belly: '#d9d6e6', hat: 'salakot' } },
      'wikaharian': { name: 'Tarsi', face: '🐒', hi: 'Kumusta! Words are my treasure!', look: { kind: 'tarsier', fur: '#c9a27e', belly: '#f1dcc4', prop: 'pencil' } },
      'math-mastery': { name: 'Ruler Kit', face: '🐱', hi: 'Purr-fect timing!', look: { kind: 'kitten', fur: '#ffb38a', belly: '#fff4e6', prop: 'ruler' } },
      'page-turners': { name: 'Bookie', face: '🐛', hi: 'Hello, reader friend!', look: { kind: 'worm', fur: '#8ee07f', belly: '#d8f7cf', prop: 'book' } },
      'rise-shine': { name: 'Pandy', face: '🐼', hi: 'Hi! Your kind heart shines!', look: { kind: 'panda', fur: '#ffffff', belly: '#f2f2f2', prop: 'heart' } },
      'rally-ready': { name: 'Dash', face: '🐶', hi: 'Woof! Ready, set, go!', look: { kind: 'puppy', fur: '#e8b97a', belly: '#fff1dc', prop: 'ball' } },
      'craft-corner': { name: 'Stitch', face: '🦔', hi: "Hi! Let's make something lovely!", look: { kind: 'hedgehog', fur: '#f3d2b3', belly: '#fff4e6', spikes: '#a7744f', prop: 'needle' } },
      'life-lab': { name: 'Fizz', face: '🐸', hi: 'Ribbit! Science is so cool!', look: { kind: 'frog', fur: '#7fdc8b', belly: '#e3fbd9', prop: 'tube' } },
      'net-navigators': { name: 'Byte', face: '🤖', hi: 'Beep boop! Hello, friend!', look: { kind: 'robot', fur: '#a8ecf7', belly: '#e4fbff' } },
      'rhythm-hues': { name: 'Melody', face: '🐦', hi: 'Tweet tweet! La la la!', look: { kind: 'bird', fur: '#ffd166', belly: '#fff3c4', prop: 'note' } }
    },
    grade2: {
      'block-bot': { name: 'Bloxy', face: '🤖', hi: 'Beep! Kumusta, kaibigan? · Beep! Hello, friend!', look: { kind: 'robot', fur: '#ffb38a', belly: '#fff1e6', prop: 'block' } },
      'kuwentista': { name: 'Tarsi', face: '🐒', hi: 'May kuwento ako para sa iyo! · I have a story for you!', look: { kind: 'tarsier', fur: '#c9a27e', belly: '#f1dcc4', prop: 'book' } },
      'word-train': { name: 'Choo-Choo Bear', face: '🐻', hi: 'Tsuk-tsuk! Sakay na! · Choo choo! All aboard!', look: { kind: 'bear', fur: '#c48a6a', belly: '#f3dcc8', hat: 'cap' } },
      'batang-bayani': { name: 'Kiko', face: '🐃', hi: 'Mabuhay, batang bayani! · Hello, little hero!', look: { kind: 'carabao', fur: '#9a98ae', belly: '#d9d6e6', hat: 'salakot' } },
      'growing-good': { name: 'Pandy', face: '🐼', hi: 'Ang bait mo! · You are so kind!', look: { kind: 'panda', fur: '#ffffff', belly: '#f2f2f2', prop: 'heart' } },
      'byte-buddies': { name: 'Click', face: '🐭', hi: 'Click! Handa ka na ba? · Click! Are you ready?', look: { kind: 'mouse', fur: '#d9d6e6', belly: '#f7f5ff', prop: 'mouse' } },
      'science-detectives': { name: 'Detective Ribbit', face: '🐸', hi: 'Ribbit! Mag-imbestiga tayo! · Ribbit! Let us investigate!', look: { kind: 'frog', fur: '#7fdc8b', belly: '#e3fbd9', prop: 'glass' } }
    }
  };

  var FILIPINO_APPS = ['kuwentista', 'batang-bayani'];
  if (root.Lang && !root.Lang.both()) {
    Object.keys(BUDDIES.grade2).forEach(function (app) {
      var b = BUDDIES.grade2[app], cut = b.hi.lastIndexOf(' · ');
      if (FILIPINO_APPS.indexOf(app) < 0 && cut >= 0) b.hi = b.hi.slice(cut + 3);
    });
  }

  var exported = { BUDDIES: BUDDIES, KINDS: KINDS, PROPS: PROPS, HATS: HATS };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
    return;
  }
  root.World3D = root.World3D || {};
  root.World3D.Buddies = exported;
})(this);
