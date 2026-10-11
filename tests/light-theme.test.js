const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { APPS, LOBBIES, web } = require('./paths.js');

const KID_PAGES = APPS.map((a) => a.page).concat(Object.values(LOBBIES).map((l) => l.page));

test('the kid pages are the 17 games and the 2 lobbies', () => {
  assert.equal(KID_PAGES.length, 19);
});

for (const page of KID_PAGES) {
  test(page + ' is always light', () => {
    const html = fs.readFileSync(web(page), 'utf8');
    assert.ok(!html.includes('prefers-color-scheme'), 'no dark-mode media query');
    assert.ok(!html.includes('data-theme'), 'no theme-switch selectors');
    assert.ok(html.includes('<meta name="color-scheme" content="light">'), 'tells the browser it is light-only');
    assert.match(html, /:root\s*\{[^}]*color-scheme:\s*light/, 'color-scheme: light in :root');
  });
}

test('the adult pages keep following the phone\'s dark mode', () => {
  assert.match(fs.readFileSync(web('parent/parent.css'), 'utf8'), /prefers-color-scheme:\s*dark/);
  assert.match(fs.readFileSync(web('admin/admin.css'), 'utf8'), /prefers-color-scheme:\s*dark/);
});

const POLISH = 'subjects/grade-5/polish.css';
const LINK = '<link rel="stylesheet" href="../polish.css">';

for (const a of APPS) {
  test(a.page + (a.grade === 5 ? ' links' : ' does not link') + ' the Grade 5 polish', () => {
    const html = fs.readFileSync(web(a.page), 'utf8');
    if (a.grade !== 5) {
      assert.ok(!html.includes('polish.css'));
      return;
    }
    assert.equal(html.split(LINK).length - 1, 1, 'linked once');
    assert.ok(html.includes('</style>\n' + LINK + '\n'), 'right after the page\'s own styles, so it wins without !important');
  });
}

test('the polish covers lesson rows and answers, keeps special rows, and respects reduced motion', () => {
  const css = fs.readFileSync(web(POLISH), 'utf8');
  for (const sel of ['.item-card', '.lesson-card', '.option', '.final-card', '.strategy-card', '.walk-card', '.review-empty']) {
    assert.ok(css.includes(sel), sel);
  }
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.ok(!css.includes('!important'));
  const outsideMixes = css.replace(/color-mix\((?:[^()]|\([^()]*\))*\)/g, '');
  assert.ok(!/#[0-9a-f]{3,6}\b/i.test(outsideMixes), 'colours come from the page variables');
});
