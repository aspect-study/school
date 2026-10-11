const test = require('node:test');
const assert = require('node:assert/strict');
const { engineFile } = require('./paths.js');
const { isEmbedded, closeMessage, targetOrigin, close } = require(engineFile('embed.js'));

test('a page is embedded only with ?embed=1 and inside another window', () => {
  const top = { location: { search: '?embed=1' } };
  top.parent = top;
  assert.equal(isEmbedded(top), false, 'opened on its own, even with the flag');
  assert.equal(isEmbedded({ location: { search: '?reset=1&embed=1' }, parent: {} }), true);
  assert.equal(isEmbedded({ location: { search: '?embed=10' }, parent: {} }), false);
  assert.equal(isEmbedded({ location: { search: '' }, parent: {} }), false);
  assert.equal(isEmbedded({ get location() { throw new Error('blocked'); } }), false);
});

test('leaving an embedded game asks the world to close the frame; the shop asks for the shop after', () => {
  assert.deepEqual(closeMessage('../../../world/grade-5.html'), { type: 'portal-close' });
  assert.deepEqual(closeMessage('../../../lobby/grade-5.html#shop'), { type: 'portal-close', then: 'shop' });
});

test('the close message goes to the page\'s own origin; file pages (origin "null") use *', () => {
  assert.equal(targetOrigin('https://study-game.example'), 'https://study-game.example');
  assert.equal(targetOrigin('null'), '*');
  assert.equal(targetOrigin(undefined), '*');
});

test('close posts portal-close to the parent, with then only when given', () => {
  const sent = [];
  const win = { location: { origin: 'https://a.test' }, parent: { postMessage: (m, o) => sent.push([m, o]) } };
  close(win);
  close(win, 'account');
  assert.deepEqual(sent, [[{ type: 'portal-close' }, 'https://a.test'], [{ type: 'portal-close', then: 'account' }, 'https://a.test']]);
});
