# Light theme everywhere Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Repo rules that override the skill defaults:** never run `git commit` (the owner does); never add `Co-Authored-By` or any AI attribution anywhere. Each task ends with a suggested commit command in a code block for the owner. Browser JS in `web/` is ES5 in an IIFE; tests and `tools/` are modern Node. Comments only for non-obvious code. Never use fully-qualified names inline.

**Goal:** The 17 game pages and both lobbies always show their light look, even on a dark-mode tablet, and the Grade 5 games get a gentle, playful finish on lesson rows and answers.

**Architecture:** A one-off Node script (kept in the scratchpad, not committed) removes every dark-mode CSS block from the 19 kid pages by brace matching and marks them light-only (`<meta name="color-scheme" content="light">` plus `color-scheme: light` in `:root`). A new shared stylesheet `web/subjects/grade-5/polish.css`, linked right after each Grade 5 page's own `</style>`, restyles `.item-card` / Math `.lesson-card` and `.option` from each page's `--accent`. A new `tests/light-theme.test.js` guards both.

**Tech Stack:** HTML/CSS (`color-mix`, already used by the pages), Node 22 (`node --test`), headless-Chrome e2e scripts.

Spec: `docs/superpowers/specs/2026-10-11-light-theme-design.md`.

## File map

- Create `tests/light-theme.test.js`: kid pages light-only, adult pages keep dark, Grade 5 polish linked.
- Modify (script) the 19 kid pages: `web/subjects/grade-2/*/index.html`, `web/subjects/grade-5/*/index.html`, `web/lobby/grade-2.html`, `web/lobby/grade-5.html`.
- Modify `web/engine/nav.js`: drop the embed-mode `data-theme` line.
- Modify `tests/e2e/portal-game.page.js`, `tests/e2e/portal-e2e.js`: check the page background instead of `data-theme`.
- Create `web/subjects/grade-5/polish.css`; link it from the 10 Grade 5 pages.
- Modify `web/sw.js` via `node tools/update-precache.js`.
- Modify `docs/HANDOFF.md`.

---

### Task 1: Kid pages always light

**Files:**
- Create: `tests/light-theme.test.js`
- Modify: the 19 kid pages (by script), `web/engine/nav.js`, `tests/e2e/portal-game.page.js`, `tests/e2e/portal-e2e.js`

- [ ] **Step 1: Write the failing test**

Create `tests/light-theme.test.js`:

```js
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
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test tests/light-theme.test.js`
Expected: the count and adult tests pass; the 19 "is always light" tests FAIL ("no dark-mode media query").

- [ ] **Step 3: Write the one-off strip script (scratchpad, not the repo)**

Write this to `strip-dark.js` in your scratchpad directory (not under the repo):

```js
// Usage: node strip-dark.js <page.html>...  Removes dark-mode CSS from each page and marks it light-only.
const fs = require('fs');

function blockEnd(text, open) {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}' && --depth === 0) return i + 1;
  }
  throw new Error('unbalanced braces');
}

// Removes whole lines from the line holding `at` to the line holding `end`, plus a /* … */ comment that sits right
// above and mentions dark mode (the Grade 5 hero note).
function cut(text, at, end) {
  let from = text.lastIndexOf('\n', at - 1) + 1;
  const note = text.slice(0, from).match(/(^|\n)([ \t]*\/\*(?:(?!\*\/)[^])*\*\/[ \t]*\n)$/);
  if (note && /dark/i.test(note[2])) from -= note[2].length;
  let to = text.indexOf('\n', end);
  to = to < 0 ? text.length : to + 1;
  return text.slice(0, from) + text.slice(to);
}

for (const file of process.argv.slice(2)) {
  let t = fs.readFileSync(file, 'utf8');
  let m;
  while ((m = /@media\s*\(prefers-color-scheme:\s*dark\)\s*\{/.exec(t))) t = cut(t, m.index, blockEnd(t, m.index + m[0].length - 1));
  while ((m = /:root\[data-theme="dark"\][^{]*\{/.exec(t))) t = cut(t, m.index, blockEnd(t, m.index + m[0].length - 1));
  if (!t.includes('<meta name="color-scheme"')) {
    const before = t;
    t = t.replace(/(<meta name="viewport"[^>]*>\n)/, '$1<meta name="color-scheme" content="light">\n');
    if (t === before) throw new Error(file + ': no viewport meta to put the color-scheme meta after');
  }
  if (!/color-scheme:\s*light/.test(t)) {
    const before = t;
    t = t.replace(/:root\s*\{\n/, (s) => s + '  color-scheme:light;\n');
    if (t === before) throw new Error(file + ': no :root block');
  }
  if (/prefers-color-scheme|data-theme/.test(t)) throw new Error(file + ': dark CSS left');
  fs.writeFileSync(file, t);
  console.log('ok ' + file);
}
```

- [ ] **Step 4: Run it on the 19 kid pages**

Run from the repo root (replace `<scratchpad>` with your scratchpad path):

```bash
node <scratchpad>/strip-dark.js web/subjects/grade-2/*/index.html web/subjects/grade-5/*/index.html web/lobby/grade-2.html web/lobby/grade-5.html
```

Expected: 19 `ok` lines. Then inspect the diff of two pages by eye (`git diff -- web/subjects/grade-5/science/index.html web/lobby/grade-5.html`): only dark blocks (the `@media (prefers-color-scheme: dark)` block, the `:root[data-theme="dark"]` block, the hero darkening rules and their comment) are removed, plus the two light-only lines added. Nothing light is lost, and each `<style>` still ends with `</style>`.

- [ ] **Step 5: Drop the embed-mode theme line in `nav.js`**

In `web/engine/nav.js`, `create()`, delete the line:

```js
    if (embedded) doc.documentElement.setAttribute('data-theme', 'light');
```

Keep the `data-embed` line after it. In the comment just above (`// Read at load: …`), nothing changes.

- [ ] **Step 6: The portal e2e checks the page background instead**

In `tests/e2e/portal-game.page.js`, replace

```js
    theme: document.documentElement.getAttribute('data-theme'),
```

with

```js
    background: getComputedStyle(document.body).backgroundColor,
```

In `tests/e2e/portal-e2e.js`, replace the `r.game.theme` assertion with:

```js
const bg = (r.game.background.match(/\d+/g) || []).slice(0, 3).map(Number);
assert.ok(bg.length === 3 && bg.every((c) => c > 200), 'the game inside the frame is light: ' + r.game.background);
```

and in the file's header comment change "(light theme, Back to town)" to "(Back to town)".

- [ ] **Step 7: Run the tests**

Run: `node --test`
Expected: all PASS, including the 19 "is always light" tests.

Run: `node tests/e2e/portal-e2e.js`, `node tests/e2e/nav-e2e.js`
Expected: both print their `ok` lines.

- [ ] **Step 8: Suggested commit (owner runs it)**

```bash
git add tests/light-theme.test.js web/subjects web/lobby/grade-2.html web/lobby/grade-5.html web/engine/nav.js tests/e2e/portal-game.page.js tests/e2e/portal-e2e.js && git commit -m 'Kid pages always light: drop dark-mode CSS from the 17 games and both lobbies (parent page and admin keep it)' -- tests/light-theme.test.js web/subjects web/lobby/grade-2.html web/lobby/grade-5.html web/engine/nav.js tests/e2e/portal-game.page.js tests/e2e/portal-e2e.js
```

---

### Task 2: Gentle Grade 5 polish

**Files:**
- Create: `web/subjects/grade-5/polish.css`
- Modify: the 10 Grade 5 game pages, `tests/light-theme.test.js`, `web/sw.js` (generated)

- [ ] **Step 1: Write the failing tests**

Append to `tests/light-theme.test.js`:

```js
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
  for (const sel of ['.item-card', '.lesson-card', '.option', '.final-card', '.strategy-card', '.review-empty']) {
    assert.ok(css.includes(sel), sel);
  }
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.ok(!css.includes('!important'));
  const outsideMixes = css.replace(/color-mix\((?:[^()]|\([^()]*\))*\)/g, '');
  assert.ok(!/#[0-9a-f]{3,6}\b/i.test(outsideMixes), 'colours come from the page variables');
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test tests/light-theme.test.js`
Expected: the 10 Grade 5 "links" tests and the polish test FAIL (no link, no file); the 7 Grade 2 "does not link" tests pass.

- [ ] **Step 3: Create the stylesheet**

Create `web/subjects/grade-5/polish.css`:

```css
/* Grade 5 games: a gentle, playful finish for lesson rows and answers. Loaded after each page's own styles; every
   colour comes from the page's --accent (and --gold, --coral, --good, --bad), so each game keeps its own colour.
   The bottom edge is a solid shadow, like the pages' .btn, so a pressed row never moves the rows below it. */
.item-card,
.lesson-card {
  border: 3px solid color-mix(in srgb, var(--accent) 28%, #fff);
  border-radius: 20px;
  box-shadow: 0 5px 0 color-mix(in srgb, var(--accent) 45%, #fff);
  transition: transform .08s ease, box-shadow .08s ease, border-color .15s ease;
}
.item-card:hover,
.lesson-card:hover {
  transform: none;
  border-color: color-mix(in srgb, var(--accent) 55%, #fff);
}
.item-card:active,
.lesson-card:active {
  transform: translateY(3px);
  box-shadow: 0 2px 0 color-mix(in srgb, var(--accent) 45%, #fff);
}
.item-card.final-card,
.lesson-card.final-card {
  border-color: var(--gold);
  box-shadow: 0 5px 0 color-mix(in srgb, var(--gold) 60%, #fff);
}
.item-card.strategy-card {
  border-color: var(--coral);
  box-shadow: 0 5px 0 color-mix(in srgb, var(--coral) 50%, #fff);
}
.item-card.review-empty:active,
.lesson-card.review-empty:active {
  transform: none;
  box-shadow: 0 5px 0 color-mix(in srgb, var(--accent) 45%, #fff);
}
.item-card .icon,
.lesson-emoji {
  background: color-mix(in srgb, var(--accent) 14%, #fff);
  border-radius: 14px;
}
.item-card .info h3,
.lesson-info h3 {
  color: color-mix(in srgb, var(--accent) 70%, #000);
}

.option {
  border: 3px solid color-mix(in srgb, var(--accent) 22%, #fff);
  border-radius: 16px;
  box-shadow: 0 4px 0 color-mix(in srgb, var(--accent) 38%, #fff);
  font-weight: 700;
  transition: transform .08s ease, box-shadow .08s ease;
}
.option:not(:disabled):active {
  transform: translateY(3px);
  box-shadow: 0 1px 0 color-mix(in srgb, var(--accent) 38%, #fff);
}
.option.correct:not(.explored) {
  box-shadow: 0 4px 0 var(--good);
}
.option.wrong:not(.explored),
.option.incorrect:not(.explored) {
  box-shadow: 0 4px 0 var(--bad);
}

@media (prefers-reduced-motion: reduce) {
  .item-card,
  .lesson-card,
  .option { transition: none; }
  .item-card:active,
  .lesson-card:active,
  .option:not(:disabled):active { transform: none; }
}
```

Note: the colour test strips each `color-mix(…)` (including the `var(…)` inside it) before looking for hex colours, because the only hex allowed is the `#fff` / `#000` mixed into a page variable.

- [ ] **Step 4: Link it from the 10 Grade 5 pages**

In each `web/subjects/grade-5/*/index.html`, the page's single `</style>` line is followed by the markup. Insert the link on the next line, so it reads:

```html
</style>
<link rel="stylesheet" href="../polish.css">
```

A safe way from the repo root:

```bash
node -e "for (const f of process.argv.slice(1)) { const fs = require('fs'); let t = fs.readFileSync(f, 'utf8'); if (t.split('</style>\n').length !== 2) throw new Error(f + ': expected one </style>'); t = t.replace('</style>\n', '</style>\n<link rel=\"stylesheet\" href=\"../polish.css\">\n'); fs.writeFileSync(f, t); console.log('ok ' + f); }" web/subjects/grade-5/*/index.html
```

Expected: 10 `ok` lines.

- [ ] **Step 5: Precache and tests**

Run: `node tools/update-precache.js`, then `node --test`
Expected: all PASS (`tests/pwa.test.js` sees `subjects/grade-5/polish.css`).

- [ ] **Step 6: Play every game**

Run: `node tests/e2e/apps-e2e.js 5` and `node tests/e2e/apps-e2e.js`
Expected: `All 10 apps passed` and `All 7 apps passed`.

- [ ] **Step 7: Suggested commit (owner runs it)**

```bash
git add web/subjects/grade-5 tests/light-theme.test.js web/sw.js && git commit -m 'Grade 5 games: gentle playful polish on lesson rows and answers (shared polish.css, each game keeps its colour)' -- web/subjects/grade-5 tests/light-theme.test.js web/sw.js
```

---

### Task 3: Check, screenshots and docs

**Files:**
- Modify: `docs/HANDOFF.md`

- [ ] **Step 1: Lobby e2e**

Run: `node tests/e2e/lobby-e2e.js 5` and `node tests/e2e/lobby-e2e.js`
Expected: both pass.

- [ ] **Step 2: Screenshots for the owner (forced dark mode)**

From the repo root, with the scratchpad path for output, take shots with the browser forced into dark mode (they must still look light). For each of `subjects/grade-5/science/index.html`, `subjects/grade-5/math/index.html`, `subjects/grade-2/science/index.html`, `lobby/grade-5.html`, `lobby/grade-2.html`:

```bash
"C:/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --disable-gpu --hide-scrollbars --force-dark-mode --blink-settings=preferredColorScheme=0 --user-data-dir=<scratchpad>/prof-<name> --window-size=820,1180 --virtual-time-budget=3000 --screenshot=<scratchpad>/<name>-dark.png "file:///C:/Users/ADMIN/IdeaProjects/school/web/<page>"
```

Look at each image: the page is light (cream or pastel), the Grade 5 lesson rows show the thick tinted border and bottom edge, the mock exam row is gold, and nothing is unreadable. Report the image paths for the controller to send to the owner.

- [ ] **Step 3: HANDOFF**

In `docs/HANDOFF.md`, under **Study games and lobby**, add:

```markdown
- Light theme everywhere (2026-10-11): the 17 games and both lobbies are always light (no dark-mode CSS;
  `color-scheme: light`), so a dark-mode tablet no longer turns them into dark dashboards; the phone parent page and
  `/admin/` still follow the phone's dark mode. Grade 5 games share `web/subjects/grade-5/polish.css`: lesson rows and
  answers have a thick border tinted with the game's colour and a press-down edge. `tests/light-theme.test.js` guards
  both. Spec and plan: `docs/superpowers/specs/2026-10-11-light-theme-design.md`,
  `docs/superpowers/plans/2026-10-11-light-theme.md`.
```

In **Next**, in the "App inside the world, sub-projects A, C, D" bullet, remove the A part so it reads sub-projects C and D only.

- [ ] **Step 4: Suggested commit (owner runs it)**

```bash
git add docs/HANDOFF.md docs/superpowers/plans/2026-10-11-light-theme.md && git commit -m 'Light theme: docs and plan' -- docs/HANDOFF.md docs/superpowers/plans/2026-10-11-light-theme.md
```
