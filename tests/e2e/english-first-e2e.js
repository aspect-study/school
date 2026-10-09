const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { stage, makeWorkDir, dumpDom, readOutput, appendDriver } = require('./chrome.js');
const { ENGINE_FILES, lobbyFile, appFile, LOBBIES, app } = require('../paths.js');

const ENGLISH_GAMES = ['block-bot', 'byte-buddies', 'word-train', 'growing-good', 'science-detectives'];
const FILIPINO_GAMES = ['kuwentista', 'batang-bayani'];
const STOP_WORDS = new Set(('ang mga sa ng ka mo na ay ito ako para kung hindi may ba po tayo ikaw kayo siya sila natin ' +
  'pindutin piliin subukan sagot tanong aralin puntos barya tindahan pumili kapag').split(' '));
const HELPER_KEY = 'study_fil_helper_v1';

const DRIVER = `
(function () {
  var shopWanted = __SHOP__;
  function out(obj) {
    obj.errors = window.__e2eErrors || [];
    var pre = document.createElement('pre');
    pre.id = 'e2e-out';
    pre.textContent = JSON.stringify(obj);
    document.body.appendChild(pre);
  }
  function visible(node) { return node ? node.innerText : ''; }
  setTimeout(function () {
    var r = { home: visible(document.body), helperButton: null, shop: '' };
    var b = document.querySelector('.fil-helper');
    if (b) r.helperButton = b.textContent;
    if (shopWanted) {
      document.getElementById('shop-open').click();
      r.shop = visible(document.getElementById('shop-overlay'));
    }
    out(r);
  }, 1500);
})();
`;

const work = makeWorkDir('english-first');
let counter = 0;

function open(file, page, helperOn, shop) {
  const prelude = '<script>try{localStorage.setItem(' + JSON.stringify(HELPER_KEY) + ',' + JSON.stringify(helperOn ? 'on' : 'off') + ');}catch(e){}</script>';
  let html = fs.readFileSync(file, 'utf8');
  const first = html.indexOf('<script');
  html = html.slice(0, first) + prelude + html.slice(first);
  html = appendDriver(html, DRIVER.replace('__SHOP__', shop ? 'true' : 'false'));
  const dir = path.join(work, 'site' + counter++);
  const staged = stage(dir, page, html, ENGINE_FILES);
  const r = readOutput(dumpDom(path.join(work, 'profile'), staged, '', 4000));
  assert.deepEqual(r.errors, [], page + ': page errors');
  return r;
}

function stopWordsIn(text) {
  return (text.toLowerCase().match(/[a-zñ']+/g) || []).filter((w) => STOP_WORDS.has(w));
}

try {
  const lobbyPage = LOBBIES[2].page;
  const off = open(lobbyFile(2), lobbyPage, false, true);
  assert.deepEqual(stopWordsIn(off.shop), [], 'shop shows English only: ' + off.shop.slice(0, 400));
  assert.ok(off.shop.length > 100, 'the shop overlay opened');
  assert.match(off.helperButton || '', /🇵🇭 Filipino: Off/, 'the lobby has the Filipino switch, off');

  const lobbyOnly = off.home.split('\n').filter((l) => !/^(Filipino|Kuwentista|Makabansa|Batang Bayani|Alpabeto|Komunidad)/.test(l)).join('\n');
  assert.deepEqual(stopWordsIn(lobbyOnly), [], 'lobby shows English only (Filipino and Makabansa cards keep their own words): ' + lobbyOnly.slice(0, 400));

  const on = open(lobbyFile(2), lobbyPage, true, true);
  assert.match(on.helperButton || '', /🇵🇭 Filipino: On/, 'the switch reads On');
  assert.ok(stopWordsIn(on.shop).length > 0, 'with the switch on, the shop shows Filipino again');
  assert.ok(stopWordsIn(on.home).length > 0, 'with the switch on, the lobby shows Filipino again');

  ENGLISH_GAMES.forEach((id) => {
    const r = open(appFile(id), app(id).page, false, false);
    assert.deepEqual(stopWordsIn(r.home), [], id + ' home shows English only: ' + stopWordsIn(r.home).join(','));
    assert.ok(r.home.length > 50, id + ' home rendered');
  });

  FILIPINO_GAMES.forEach((id) => {
    const r = open(appFile(id), app(id).page, false, false);
    assert.ok(stopWordsIn(r.home).length > 0, id + ' keeps its Filipino with the switch off');
  });

  console.log('english-first e2e: ok');
} finally {
  fs.rmSync(work, { recursive: true, force: true });
}
