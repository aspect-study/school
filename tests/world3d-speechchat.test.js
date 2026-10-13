const test = require('node:test');
const assert = require('node:assert/strict');
const { worldFile } = require('./paths.js');
const Chat = require(worldFile('speechchat.js'));

const DATA = {
  pools: {
    'any-kid': [],
    'kid:migo': [
      { id: 'c1', say: 'Joke?', fil: 'Biro?', replies: [{ text: 'Yes!', next: 'c2' }, { text: 'Later', next: 'c3' }] },
      { id: 'c2', follow: true, say: 'Knock knock!', fil: 'Tok tok!' },
      { id: 'c3', follow: true, say: 'Okay!', fil: 'Sige!' }
    ]
  }
};

test('a step shows the English alone on Grade 5 and the pair on Grade 2', () => {
  const line = DATA.pools['kid:migo'][0];
  assert.equal(Chat.textOf(line, { tags: [], slots: {} }, 'grade5').text, 'Joke?');
  const g2 = Chat.textOf(line, { tags: [], slots: {} }, 'grade2');
  assert.equal(g2.text, 'Biro? · Joke?');
  assert.equal(g2.pair, true);
});

test('buttons are the replies, then Bye; a chat end has only Bye as the main button', () => {
  const open = Chat.buttons(DATA.pools['kid:migo'][0], 'Bye', () => {}, () => {});
  assert.deepEqual(open.map((b) => b.text), ['Yes!', 'Later', 'Bye']);
  assert.ok(!open[2].main);
  const end = Chat.buttons(DATA.pools['kid:migo'][1], 'Bye', () => {}, () => {});
  assert.deepEqual(end.map((b) => b.text), ['Bye']);
  assert.ok(end[0].main);
});
