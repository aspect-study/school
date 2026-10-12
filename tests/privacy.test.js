const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { web } = require('./paths.js');

const html = fs.readFileSync(web('privacy.html'), 'utf8');

test('the privacy notice covers what parents are agreeing to', () => {
  for (const topic of ['Google Firebase', 'RA 10173', 'nickname', 'No ads', 'delete']) {
    assert.ok(html.toLowerCase().includes(topic.toLowerCase()), 'the notice does not mention: ' + topic);
  }
});

test('the privacy notice names a real contact address', { skip: 'set the contact email in web/privacy.html before other families use the app' }, () => {
  assert.match(html, /href="mailto:[^"@\s]+@[^"@\s]+\.[^"@\s]+"/);
  assert.ok(!html.includes('CONTACT_EMAIL'), 'CONTACT_EMAIL was not replaced');
});

test('the start page links to the notice', () => {
  const index = fs.readFileSync(web('index.html'), 'utf8');
  assert.ok((index.match(/href="privacy\.html"/g) || []).length >= 2, 'register and consent views should both link to privacy.html');
});
