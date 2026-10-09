const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Install = require(require('./paths.js').engineFile('install.js'));
const { web } = require('./paths.js');

const UA = {
  ipad: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1',
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1',
  android: 'Mozilla/5.0 (Linux; Android 14; SM-X200) AppleWebKit/537.36 Chrome/120.0 Safari/537.36',
  windows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36',
};

test('the device kind picks the right steps', () => {
  assert.equal(Install.detect({ ua: UA.iphone }).kind, 'ios');
  assert.equal(Install.detect({ ua: UA.ipad }).kind, 'ios');
  assert.equal(Install.detect({ ua: UA.windows.replace('Windows NT 10.0; Win64; x64', 'Macintosh; Intel Mac OS X 10_15_7'), platform: 'MacIntel', touchPoints: 5 }).kind, 'ios', 'iPadOS in desktop mode');
  assert.equal(Install.detect({ ua: UA.android }).kind, 'android');
  assert.equal(Install.detect({ ua: UA.windows, platform: 'Win32', touchPoints: 0 }).kind, 'desktop');
});

test('an installed app is never reminded', () => {
  assert.equal(Install.detect({ ua: UA.android, standalone: true }).installed, true);
  assert.equal(Install.detect({ ua: UA.ipad, standalone: true }).installed, true);
});

test('Later hides the reminder for a week; bad or missing data shows it', () => {
  const now = 1_000_000;
  assert.equal(Install.due(null, now), true);
  assert.equal(Install.due('not json', now), true);
  assert.equal(Install.due(JSON.stringify({ until: now + Install.LATER_MS }), now), false);
  assert.equal(Install.due(JSON.stringify({ until: now + Install.LATER_MS }), now + Install.LATER_MS), true);
});

test('the words are English-only buttons and every step is spelled out', () => {
  const t = Install.words(null);
  assert.equal(t.install, 'Install');
  assert.equal(t.later, 'Later');
  assert.match(t.ios, /Add to Home Screen/);
  assert.match(t.android, /Install app/);
  assert.doesNotMatch(JSON.stringify(t), /ang |tapos|sa /, 'Grade 5 shows no Filipino');
});

test('both lobbies load the reminder after the language script', () => {
  for (const [page, grade] of [['lobby/grade-2.html', 'grade2'], ['lobby/grade-5.html', 'grade5']]) {
    const html = fs.readFileSync(web(page), 'utf8');
    assert.ok(html.includes('<script src="../engine/install.js" data-grade="' + grade + '"></script>'), page);
    assert.ok(html.indexOf('engine/lang.js') < html.indexOf('engine/install.js'), page + ': lang.js first');
  }
});
