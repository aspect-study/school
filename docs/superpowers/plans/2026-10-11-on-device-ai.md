# On-device AI helper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run Gemma 4 E2B in the tablet's browser and use it for an "Explain it another way" button after a wrong answer in the 13 English-language games, switched on by a parent.

**Architecture:** A small pure prompt/filter module (`ai-prompt.js`), a state machine with injected dependencies (`ai.js`), a browser-only worker runtime (`ai-runtime.js` + `ai-worker.js`, Transformers.js with WebGPU), a UI module the games call (`ai-explain.js`), and a parent-panel switch. Every dependency is injected, so Node tests and the headless-Chrome e2e run with a fake model.

**Tech Stack:** Plain ES5 IIFE browser JS (the worker is an ES module), `@huggingface/transformers@4.3.1` from jsDelivr, model `onnx-community/gemma-4-E2B-it-ONNX` (`dtype: q4f16`, `device: webgpu`), `node --test`, headless Chrome e2e.

Spec: `docs/superpowers/specs/2026-10-11-on-device-ai-design.md`.

**Commit rule (this repo):** the agent never runs `git commit`. Every "Commit" step ends by giving the owner the exact command as one code block (`git add <files> && git commit -m '...' -- <files>`), with no `Co-Authored-By` or any AI line. Before any push: `git log origin/main..HEAD --grep='Co-Authored-By\|Claude-Session'` must print nothing.

**Code rules:** browser JS is ES5 in an IIFE `(function (root) {...})(this)`, comments only where non-obvious, short class names with imports (never fully-qualified names inline). Engine files end with the `module.exports` / `root.X = api` pattern used by `web/engine/lang.js`.

---

## File structure

| File | Responsibility |
|---|---|
| `web/ai-spike/index.html` (temporary) | Task 1: measure the model on the girls' tablets. Deleted in Task 9. |
| `web/engine/ai-prompt.js` (new) | Pure: `strip`, `canAsk`, `build`, `filter`. |
| `web/engine/ai.js` (new) | State machine, storage key `study_ai_v1`, `explain`. Exports `create(deps)`; browser global `Ai`. |
| `web/engine/ai-runtime.js` (new) | Browser only: wraps the Web Worker. Global `AiRuntime`. |
| `web/engine/ai-worker.js` (new) | Module worker: loads Transformers.js and the model, generates text. |
| `web/engine/ai-explain.js` (new) | The button and answer card. Global `AiExplain.offer(miss, panel)`. |
| `web/engine/parent-panel.js` (modify) | `mountAi()` for the Settings tab row. |
| `web/lobby/grade-2.html`, `grade-5.html` (modify) | `#ai-section` markup and the AI script tags. |
| 13 game pages (modify) | 4 script tags and one `AiExplain.offer` line each. |
| `tests/ai-prompt.test.js`, `tests/ai.test.js`, `tests/ai-wiring.test.js` (new) | Node tests. |
| `tests/e2e/ai-e2e.js`, `tests/e2e/driver-ai.page.js` (new) | Headless-Chrome check with a fake model. |
| `tests/paths.js` (modify) | Add the new engine files to `ENGINE_FILES`. |

The 13 games: Grade 5 `computer`, `english`, `gmrc`, `math`, `music-arts`, `pe-health`, `science`, `tle`; Grade 2 `computer`, `english`, `gmrc`, `math`, `science`. The four Filipino games (`filipino` and `araling-panlipunan` in Grade 5, `filipino` and `makabansa` in Grade 2) get nothing.

---

### Task 1: The spike (decides the numbers; can stop the project)

**Files:**
- Create: `web/ai-spike/index.html` (temporary)

- [ ] **Step 1: Write the spike page**

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AI spike</title>
<style>
body { font: 16px system-ui, sans-serif; margin: 16px; max-width: 680px; }
button { font: inherit; padding: 10px 16px; margin: 4px 6px 4px 0; }
pre { white-space: pre-wrap; background: #eee; padding: 10px; border-radius: 8px; }
</style>
</head>
<body>
<h1>Gemma 4 E2B spike</h1>
<p>Use home Wi-Fi. The first run downloads more than 1 GB.</p>
<button id="go">Start</button><button id="copy">Copy results</button>
<pre id="log"></pre>
<script type="module">
const LIB = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.1/dist/transformers.min.js';
const MODEL = 'onnx-community/gemma-4-E2B-it-ONNX';
const SAMPLES = [
  { grade: 2, q: 'Which word names a person?', picked: 'run', answer: 'teacher', why: '"Run" tells what someone does. It does not name a person.', explain: 'A noun names a person, place or thing. "Teacher" names a person.', tip: 'Ask: can I see or touch it, or is it a person? Then it is a noun.' },
  { grade: 2, q: 'What is 14 - 5?', picked: '10', answer: '9', why: '10 is too big. Count back 5 from 14.', explain: 'Start at 14 and count back 5: 13, 12, 11, 10, 9. You land on 9.', tip: 'Put your finger on 14. Do not count it. Say 1 as you hop back.' },
  { grade: 2, q: 'Which is a living thing?', picked: 'rock', answer: 'a plant', why: 'A rock does not grow, eat or make babies.', explain: 'Living things grow, need food and water, and make more of their kind. A plant does all of these.', tip: 'Living things grow and need food and water.' },
  { grade: 5, q: 'What is the theme of a story?', picked: 'what happens first', answer: 'the lesson or message', why: 'What happens first is part of the plot.', explain: 'The theme is the lesson or message the story teaches.', tip: 'Plot = what happens. Theme = what the story teaches.' },
  { grade: 5, q: 'Which fraction is equal to 2/4?', picked: '1/4', answer: '1/2', why: '1/4 is only half as big as 2/4.', explain: 'Divide the top and bottom of 2/4 by 2. You get 1/2.', tip: 'Divide the top and bottom by the same number.' },
  { grade: 5, q: 'Which device is an input device?', picked: 'monitor', answer: 'keyboard', why: 'A monitor shows information. It is an output device.', explain: 'An input device sends information into the computer. A keyboard does this.', tip: 'Input = in to the computer. Output = out from the computer.' }
];
const out = [];
const log = (s) => { out.push(s); document.getElementById('log').textContent = out.join('\n'); };
const prompt = (f) => ['You are a kind teacher for a child in Grade ' + f.grade + '. The child answered a question wrongly.',
  'Explain in 2 or 3 short, simple English sentences why the right answer is right.',
  'Use only the facts below. Do not add other facts. Do not ask a question. Do not use lists, links or emoji.', '',
  'Question: ' + f.q, "The child's answer: " + f.picked, 'The right answer: ' + f.answer,
  "Why the child's answer is not right: " + f.why, 'Why the right answer is right: ' + f.explain, 'Tip: ' + f.tip].join('\n');

document.getElementById('copy').onclick = () => navigator.clipboard.writeText(out.join('\n'));
document.getElementById('go').onclick = async () => {
  try {
    log('userAgent: ' + navigator.userAgent);
    log('deviceMemory (GB, Chrome only): ' + navigator.deviceMemory);
    if (!navigator.gpu) { log('NO WebGPU'); return; }
    const adapter = await navigator.gpu.requestAdapter();
    log('adapter: ' + JSON.stringify(adapter && adapter.info ? { vendor: adapter.info.vendor, architecture: adapter.info.architecture } : null));
    const est = await navigator.storage.estimate();
    log('storage quota MB: ' + Math.round(est.quota / 1048576) + ', used MB: ' + Math.round(est.usage / 1048576));
    const t0 = performance.now();
    const lib = await import(LIB);
    const files = {};
    let lastLogged = 0;
    const progress = (i) => {
      if (i.status !== 'progress' || !i.file) return;
      files[i.file] = { loaded: i.loaded, total: i.total };
      const loaded = Object.values(files).reduce((a, f) => a + f.loaded, 0);
      const total = Object.values(files).reduce((a, f) => a + f.total, 0);
      if (performance.now() - lastLogged > 5000) { lastLogged = performance.now(); log('downloaded ' + Math.round(loaded / 1048576) + ' of ' + Math.round(total / 1048576) + ' MB'); }
    };
    const processor = await lib.AutoProcessor.from_pretrained(MODEL);
    const model = await lib.Gemma4ForConditionalGeneration.from_pretrained(MODEL, { dtype: 'q4f16', device: 'webgpu', progress_callback: progress });
    const total = Object.values(files).reduce((a, f) => a + f.total, 0);
    log('download + init ms: ' + Math.round(performance.now() - t0) + ', total MB: ' + Math.round(total / 1048576));
    for (const [n, f] of SAMPLES.entries()) {
      const t1 = performance.now();
      const messages = [{ role: 'user', content: [{ type: 'text', text: prompt(f) }] }];
      const text = processor.apply_chat_template(messages, { enable_thinking: false, add_generation_prompt: true });
      const inputs = await processor(text, null, null, { add_special_tokens: false });
      const outIds = await model.generate({ ...inputs, max_new_tokens: 120, do_sample: false });
      const start = inputs.input_ids.dims.at(-1);
      const answer = processor.batch_decode(outIds.slice(null, [start, null]), { skip_special_tokens: true })[0];
      log('--- sample ' + (n + 1) + ' (grade ' + f.grade + ') took ' + Math.round(performance.now() - t1) + ' ms\n' + answer);
    }
    if (performance.memory) log('JS heap MB: ' + Math.round(performance.memory.usedJSHeapSize / 1048576));
    log('DONE');
  } catch (e) { log('ERROR: ' + (e && e.stack || e)); }
};
</script>
</body>
</html>
```

- [ ] **Step 2: Run the page on this PC first**

Run: `node tests/e2e/static-server.js` is not needed; just serve the folder over `localhost` (a secure context, so WebGPU works): `npx --yes http-server web -p 8080`, then open `http://localhost:8080/ai-spike/` in Chrome and press Start.
Expected: the log ends with `DONE` and six answers. If the text-only call `processor(text, null, null, { add_special_tokens: false })` throws, try `processor(text, { add_special_tokens: false })`; whichever works is the call `ai-worker.js` will use in Task 4 (write the working form into the Task 4 step before building).

- [ ] **Step 3: Give the owner the commit command, then ask them to push and run it on each tablet**

```bash
git add web/ai-spike/index.html && git commit -m 'Spike page: measure Gemma 4 E2B in the tablet browser' -- web/ai-spike/index.html
```

After the owner pushes, ask them to open `<the GitHub Pages address>/ai-spike/` on each tablet, tap Start on home Wi-Fi, wait for `DONE`, tap Copy results and paste the text back.

- [ ] **Step 4: Decide, then record**

Read the pasted results. Pass criteria: WebGPU is present, download + init finishes, each sample takes 20 s or less, the answers are 2-3 plain sentences that use only the given facts, and none contain wrong facts. Then:
- If a tablet fails, stop here and tell the owner (smaller model, one tablet only, or the laptop route). Do not continue.
- If all pass, set `warmupMaxMs` to 2 x the slowest sample time (at least 15000) and note the download total in MB.
- Add a `## Spike results` section to the spec with the table of tablets, download MB, init time, per-sample times, quality verdict, and the chosen `warmupMaxMs`. Fix `CONFIG` in Task 3 to those numbers.

- [ ] **Step 5: Commit the recorded results**

```bash
git add docs/superpowers/specs/2026-10-11-on-device-ai-design.md && git commit -m 'Spec: record the AI spike results and thresholds' -- docs/superpowers/specs/2026-10-11-on-device-ai-design.md
```

---

### Task 2: `ai-prompt.js` (pure prompt and answer filter)

**Files:**
- Create: `web/engine/ai-prompt.js`
- Test: `tests/ai-prompt.test.js`

- [ ] **Step 1: Write the failing tests**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const AiPrompt = require('../web/engine/ai-prompt.js');

const FACTS = {
  q: 'What is 3 + 4?', picked: '6', answer: '7',
  why: 'You counted the 3 as a jump.', explain: 'Start at 3 and take 4 jumps: you land on 7.', tip: 'Do not count the start number.'
};

test('strip removes tags, decodes entities and keeps comparison signs', () => {
  assert.equal(AiPrompt.strip('<b>Plot</b> &ldquo;is&rdquo; what happens<br>3 < 5 &amp; 7 > 2'), 'Plot "is" what happens 3 < 5 & 7 > 2');
  assert.equal(AiPrompt.strip(null), '');
});

test('canAsk needs a question, the right answer and at least one explanation', () => {
  assert.equal(AiPrompt.canAsk(FACTS), true);
  assert.equal(AiPrompt.canAsk({ q: 'Q', answer: 'A', tip: 'T' }), true);
  assert.equal(AiPrompt.canAsk({ q: 'Q', answer: 'A' }), false);
  assert.equal(AiPrompt.canAsk({ answer: 'A', why: 'W' }), false);
  assert.equal(AiPrompt.canAsk(null), false);
});

test('build puts the grade and only the given facts in the prompt', () => {
  const text = AiPrompt.build({ q: 'Q?', picked: 'x', answer: 'y', tip: 'T' }, 2);
  assert.match(text, /Grade 2/);
  assert.match(text, /Question: Q\?/);
  assert.match(text, /The right answer: y/);
  assert.match(text, /Tip: T/);
  assert.doesNotMatch(text, /not right:/);
  assert.doesNotMatch(text, /Why the right answer is right:/);
});

test('filter strips markdown and keeps a good answer', () => {
  assert.equal(AiPrompt.filter('**You land on 7** because you take 4 jumps.', FACTS), 'You land on 7 because you take 4 jumps.');
});

test('filter rejects empty text, links, rude words and numbers the lesson does not contain', () => {
  assert.equal(AiPrompt.filter('', FACTS), '');
  assert.equal(AiPrompt.filter('???', FACTS), '');
  assert.equal(AiPrompt.filter('See https://example.com for more.', FACTS), '');
  assert.equal(AiPrompt.filter('That was a stupid answer.', FACTS), '');
  assert.equal(AiPrompt.filter('The answer is 8.', FACTS), '');
  assert.equal(AiPrompt.filter('The answer is 7.', FACTS), 'The answer is 7.');
});

test('filter cuts a long answer to 60 words at a sentence end', () => {
  const long = new Array(30).fill('Cats purr softly.').join(' ');
  const out = AiPrompt.filter(long, FACTS);
  assert.ok(out.split(' ').length <= 60);
  assert.ok(out.endsWith('.'));
});
```

- [ ] **Step 2: Run and see it fail**

Run: `node --test tests/ai-prompt.test.js`
Expected: FAIL, "Cannot find module '../web/engine/ai-prompt.js'".

- [ ] **Step 3: Write the module**

```js
/* The words the AI helper is given and the words it may say back. Pure: no browser, no storage. Facts are the fields a game
   already has for a missed question: q, picked, answer, why, explain, tip (HTML allowed). */
(function (root) {
  'use strict';

  var MAX_WORDS = 60;
  var MAX_FIELD = 400;
  var FIELDS = ['q', 'picked', 'answer', 'why', 'explain', 'tip'];
  var BLOCK = /\b(shit|fuck|damn|crap|stupid|dumb|idiot)\b/i;
  var ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ldquo: '"', rdquo: '"', lsquo: "'", rsquo: "'", mdash: '-', ndash: '-', hellip: '...' };

  function strip(html) {
    return String(html == null ? '' : html)
      .replace(/<br\s*\/?>|<\/(p|div|li|tr)>/gi, ' ')
      .replace(/<\/?[a-z][^>]*>/gi, '')
      .replace(/&#(\d+);/g, function (m, n) { return String.fromCharCode(Number(n)); })
      .replace(/&([a-z]+);/gi, function (m, name) { var v = ENTITIES[name.toLowerCase()]; return v === undefined ? m : v; })
      .replace(/\s+/g, ' ')
      .trim();
  }

  function field(facts, key) { return strip(facts && facts[key]).slice(0, MAX_FIELD); }

  function canAsk(facts) {
    return !!(field(facts, 'q') && field(facts, 'answer') && (field(facts, 'why') || field(facts, 'explain') || field(facts, 'tip')));
  }

  function build(facts, grade) {
    var lines = [
      'You are a kind teacher for a child in Grade ' + grade + '. The child answered a question wrongly.',
      'Explain in 2 or 3 short, simple English sentences why the right answer is right.',
      'Use only the facts below. Do not add other facts. Do not ask a question. Do not use lists, links or emoji.',
      '',
      'Question: ' + field(facts, 'q')
    ];
    if (field(facts, 'picked')) lines.push("The child's answer: " + field(facts, 'picked'));
    lines.push('The right answer: ' + field(facts, 'answer'));
    if (field(facts, 'why')) lines.push("Why the child's answer is not right: " + field(facts, 'why'));
    if (field(facts, 'explain')) lines.push('Why the right answer is right: ' + field(facts, 'explain'));
    if (field(facts, 'tip')) lines.push('Tip: ' + field(facts, 'tip'));
    return lines.join('\n');
  }

  function numbersIn(s) { return s.match(/\d+(?:[.,]\d+)*/g) || []; }

  function factsText(facts) { return FIELDS.map(function (k) { return field(facts, k); }).join(' '); }

  function cut(text) {
    var words = text.split(' ');
    if (words.length <= MAX_WORDS) return text;
    var head = words.slice(0, MAX_WORDS).join(' ');
    var sentence = /^[\s\S]*[.!?]/.exec(head);
    return sentence ? sentence[0] : head + '.';
  }

  // Returns the cleaned answer, or '' when it must not be shown.
  function filter(text, facts) {
    var s = String(text == null ? '' : text)
      .replace(/[*_`#>]+/g, '')
      .replace(/^\s*[-\u2022]\s+/gm, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!/[a-z]/i.test(s)) return '';
    if (/https?:|www\.|@/i.test(s) || BLOCK.test(s)) return '';
    var known = numbersIn(factsText(facts));
    var unknown = numbersIn(s).some(function (n) { return known.indexOf(n) < 0; });
    return unknown ? '' : cut(s);
  }

  var api = { strip: strip, canAsk: canAsk, build: build, filter: filter, MAX_WORDS: MAX_WORDS };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
    return;
  }
  root.AiPrompt = api;
})(this);
```

- [ ] **Step 4: Run and see it pass**

Run: `node --test tests/ai-prompt.test.js`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit command for the owner**

```bash
git add web/engine/ai-prompt.js tests/ai-prompt.test.js && git commit -m 'AI helper: prompt builder and answer filter' -- web/engine/ai-prompt.js tests/ai-prompt.test.js
```

---

### Task 3: `ai.js` (state machine)

**Files:**
- Create: `web/engine/ai.js`
- Test: `tests/ai.test.js`

- [ ] **Step 1: Write the failing tests**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const AiPrompt = require('../web/engine/ai-prompt.js');
const Ai = require('../web/engine/ai.js');

const FACTS = { q: 'What is 3 + 4?', picked: '6', answer: '7', why: 'You counted the 3.', explain: 'You land on 7.', tip: 'Do not count the start.' };
const flush = async () => { for (let i = 0; i < 10; i++) await new Promise((r) => setImmediate(r)); };

function setup(opts = {}) {
  const data = {};
  const storage = { getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); } };
  const log = [];
  const timers = [];
  let t = 0;
  let calls = 0;
  const runtime = {
    available: () => opts.available !== false,
    load: (config, onProgress) => {
      log.push('load');
      onProgress(0.5);
      return opts.loadFails ? Promise.reject(Object.assign(new Error('load failed'), { unsupported: !!opts.unsupported })) : Promise.resolve();
    },
    generate: (text) => {
      log.push('generate');
      calls++;
      if (calls === 1 && opts.warmMs) t += opts.warmMs;
      if (opts.hang && calls > 1) return new Promise(() => {});
      if (opts.reject && calls > 1) return Promise.reject(new Error('boom'));
      return Promise.resolve(opts.answer || 'You land on 7 because you take 4 jumps.');
    },
    cancel: () => log.push('cancel'),
    dispose: () => log.push('dispose')
  };
  const ai = Ai.create({
    storage, runtime: () => runtime, nav: opts.nav || { gpu: {}, onLine: true }, prompt: AiPrompt, now: () => t,
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length - 1; },
    clearTimeout: (i) => { timers[i] = null; }
  });
  return { ai, data, log, timers, Ai, storage, runtime };
}

test('the AI is off by default and not ready', () => {
  const { ai } = setup();
  assert.equal(ai.state().state, 'off');
  assert.equal(ai.ready('a'), false);
});

test('a device without WebGPU is unsupported', () => {
  const { ai } = setup({ nav: { onLine: true } });
  assert.equal(ai.state().state, 'unsupported');
  ai.enable();
  assert.equal(ai.state().state, 'unsupported');
});

test('enable downloads, warms up, frees memory and becomes ready for a child the parent allowed', async () => {
  const { ai, log } = setup();
  ai.enable();
  assert.equal(ai.state().state, 'downloading');
  await flush();
  assert.deepEqual(log, ['load', 'generate', 'dispose']);
  assert.equal(ai.state().state, 'ready');
  assert.equal(ai.ready('kid1'), false);
  ai.setChild('kid1', true);
  assert.equal(ai.ready('kid1'), true);
  assert.equal(ai.ready('kid2'), false);
});

test('a slow warm-up marks the device unsupported for good', async () => {
  const { ai, Ai: mod, storage } = setup({ warmMs: 999999 });
  ai.enable();
  await flush();
  assert.equal(ai.state().state, 'unsupported');
  const again = mod.create({ storage, runtime: () => ({ available: () => true }), nav: { gpu: {}, onLine: true }, prompt: AiPrompt, now: () => 0, setTimeout: () => 0, clearTimeout: () => {} });
  assert.equal(again.state().state, 'unsupported');
});

test('a failed download shows failed, and turning it on again retries', async () => {
  const s = setup({ loadFails: true });
  s.ai.enable();
  await flush();
  assert.equal(s.ai.state().state, 'failed');
  s.ai.enable();
  assert.equal(s.log.filter((x) => x === 'load').length, 2);
});

test('mobile data waits for Wi-Fi, then resume downloads', async () => {
  const nav = { gpu: {}, onLine: true, connection: { type: 'cellular' } };
  const { ai, log } = setup({ nav });
  ai.enable();
  assert.equal(ai.state().state, 'waiting');
  assert.deepEqual(log, []);
  nav.connection.type = 'wifi';
  ai.resume();
  await flush();
  assert.equal(ai.state().state, 'ready');
});

test('explain returns the filtered answer', async () => {
  const { ai } = setup();
  ai.enable();
  await flush();
  ai.setChild('k', true);
  let result;
  ai.explain(FACTS, 2, (err, text) => { result = { err, text }; });
  await flush();
  assert.equal(result.err, null);
  assert.equal(result.text, 'You land on 7 because you take 4 jumps.');
});

test('explain answers with an empty string when the filter rejects the text', async () => {
  const { ai } = setup({ answer: 'The answer is 99.' });
  ai.enable();
  await flush();
  let result;
  ai.explain(FACTS, 2, (err, text) => { result = { err, text }; });
  await flush();
  assert.equal(result.text, '');
});

test('a timeout cancels the request, and two failures hide the helper for the session', async () => {
  const s = setup({ hang: true });
  s.ai.enable();
  await flush();
  s.ai.setChild('k', true);
  const errors = [];
  for (let i = 0; i < 2; i++) {
    s.ai.explain(FACTS, 2, (err) => errors.push(err && err.message));
    s.timers[s.timers.length - 1].fn();
  }
  assert.deepEqual(errors, ['timeout', 'timeout']);
  assert.ok(s.log.includes('cancel'));
  assert.equal(s.ai.ready('k'), false);
});

test('a rejected generation counts as a failure', async () => {
  const s = setup({ reject: true });
  s.ai.enable();
  await flush();
  let result;
  s.ai.explain(FACTS, 2, (err) => { result = err; });
  await flush();
  assert.equal(result.message, 'boom');
});

test('a new request cancels the previous one so its callback never fires', async () => {
  const s = setup({ hang: true });
  s.ai.enable();
  await flush();
  let first = 0;
  s.ai.explain(FACTS, 2, () => { first++; });
  s.ai.explain(FACTS, 2, () => {});
  await flush();
  assert.equal(first, 0);
});

test('disable turns it off, and the child switch is remembered', async () => {
  const s = setup();
  s.ai.enable();
  await flush();
  s.ai.setChild('k', true);
  s.ai.disable();
  assert.equal(s.ai.state().state, 'off');
  assert.equal(s.ai.childOn('k'), true);
  s.ai.enable();
  assert.equal(s.ai.state().state, 'ready');
});
```

- [ ] **Step 2: Run and see it fail**

Run: `node --test tests/ai.test.js`
Expected: FAIL, "Cannot find module '../web/engine/ai.js'".

- [ ] **Step 3: Write the module** (replace the CONFIG numbers with the spike's results from Task 1 Step 4)

```js
/* The on-device AI helper's state: is it switched on, downloaded and fast enough, and may this child see it.
   Games and the parent panel only talk to this file. Everything it needs comes in through create(deps), so tests
   run it with a fake runtime. The device-level key study_ai_v1 is { on, child: { <learnerId>: true }, status }. */
(function (root) {
  'use strict';

  var KEY = 'study_ai_v1';
  var CONFIG = {
    lib: 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.1/dist/transformers.min.js',
    model: 'onnx-community/gemma-4-E2B-it-ONNX',
    dtype: 'q4f16',
    minFreeBytes: 3 * 1024 * 1024 * 1024,
    warmupMaxMs: 25000,
    firstTimeoutMs: 90000,
    timeoutMs: 20000,
    failuresToHide: 2,
    maxTokens: 120
  };
  var WARMUP = 'Say hello in three words.';
  var SETTLED = ['ready', 'unsupported', 'failed'];

  function create(deps) {
    var storage = deps.storage;
    var nav = deps.nav || {};
    var prompt = deps.prompt;
    var now = deps.now;
    var listeners = [];
    var progress = 0;
    var downloading = false;
    var waiting = false;
    var failures = 0;
    var warm = false;
    var current = null;

    function runtime() { return deps.runtime(); }

    function read() {
      var v = null;
      try { v = JSON.parse(storage.getItem(KEY)); } catch (e) {}
      if (!v || typeof v !== 'object') v = {};
      return {
        on: v.on === true,
        child: v.child && typeof v.child === 'object' ? v.child : {},
        status: SETTLED.indexOf(v.status) >= 0 ? v.status : 'idle'
      };
    }

    function changed() {
      listeners.slice().forEach(function (fn) { try { fn(); } catch (e) {} });
    }

    function write(c) {
      try { storage.setItem(KEY, JSON.stringify(c)); } catch (e) {}
      changed();
    }

    function supported() {
      var rt = runtime();
      return !!(nav.gpu && rt && rt.available());
    }

    function state() {
      var c = read();
      if (!supported() || c.status === 'unsupported') return { state: 'unsupported', progress: 0 };
      if (!c.on) return { state: 'off', progress: 0 };
      if (c.status === 'ready') return { state: 'ready', progress: 1 };
      if (c.status === 'failed') return { state: 'failed', progress: 0 };
      return { state: waiting ? 'waiting' : 'downloading', progress: progress };
    }

    function childOn(id) { return read().child[id] === true; }

    function ready(id) {
      return failures < CONFIG.failuresToHide && state().state === 'ready' && childOn(id);
    }

    function setChild(id, on) {
      var c = read();
      if (on) c.child[id] = true; else delete c.child[id];
      write(c);
    }

    function wifiOk() {
      var c = nav.connection;
      return nav.onLine !== false && !(c && (c.type === 'cellular' || c.saveData === true));
    }

    function roomOk() {
      if (!nav.storage || !nav.storage.estimate) return Promise.resolve(true);
      return nav.storage.estimate().then(function (e) {
        return !e || !e.quota || e.quota - (e.usage || 0) >= CONFIG.minFreeBytes;
      });
    }

    function finish(status) {
      downloading = false;
      var c = read();
      c.status = status;
      write(c);
      var rt = runtime();
      if (rt && rt.dispose) rt.dispose();
    }

    function resume() {
      var c = read();
      if (!c.on || SETTLED.indexOf(c.status) >= 0 || downloading || !supported()) return;
      if (!wifiOk()) {
        waiting = true;
        changed();
        return;
      }
      waiting = false;
      downloading = true;
      progress = 0;
      changed();
      var timer = 0;
      roomOk().then(function (ok) {
        if (!ok) { var e = new Error('no room'); e.unsupported = true; throw e; }
        return runtime().load(CONFIG, function (p) { progress = p; changed(); });
      }).then(function () {
        timer = now();
        return runtime().generate(WARMUP, { maxTokens: 8, config: CONFIG });
      }).then(function () {
        finish(now() - timer <= CONFIG.warmupMaxMs ? 'ready' : 'unsupported');
      }).catch(function (e) {
        finish(e && e.unsupported ? 'unsupported' : 'failed');
      });
    }

    function enable() {
      var c = read();
      c.on = true;
      if (c.status === 'failed') c.status = 'idle';
      write(c);
      resume();
    }

    function disable() {
      var c = read();
      c.on = false;
      if (c.status === 'failed') c.status = 'idle';
      write(c);
    }

    function explain(facts, grade, done) {
      if (current) current.cancel();
      var finished = false;
      var timer = null;
      var handle = { cancel: function () {
        if (finished) return;
        finished = true;
        deps.clearTimeout(timer);
        runtime().cancel();
      } };
      function end(err, text) {
        if (finished) return;
        finished = true;
        deps.clearTimeout(timer);
        if (current === handle) current = null;
        done(err, text);
      }
      function fail(err) {
        failures++;
        changed();
        end(err);
      }
      current = handle;
      timer = deps.setTimeout(function () {
        runtime().cancel();
        fail(new Error('timeout'));
      }, warm ? CONFIG.timeoutMs : CONFIG.firstTimeoutMs);
      runtime().generate(prompt.build(facts, grade), { maxTokens: CONFIG.maxTokens, config: CONFIG }).then(function (text) {
        warm = true;
        end(null, prompt.filter(text, facts));
      }, function (e) { fail(e || new Error('failed')); });
      return handle;
    }

    return {
      state: state, ready: ready, childOn: childOn, setChild: setChild, enable: enable, disable: disable,
      resume: resume, explain: explain, create: create,
      onChange: function (fn) { listeners.push(fn); }
    };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { create: create, CONFIG: CONFIG, KEY: KEY };
    return;
  }
  if (!root.AiPrompt) return;
  var safe = {
    getItem: function (k) { try { return root.localStorage.getItem(k); } catch (e) { return null; } },
    setItem: function (k, v) { try { root.localStorage.setItem(k, v); } catch (e) {} }
  };
  var ai = create({
    storage: safe, nav: root.navigator, prompt: root.AiPrompt, now: Date.now,
    runtime: function () { return root.AiRuntime; },
    setTimeout: function (fn, ms) { return root.setTimeout(fn, ms); },
    clearTimeout: function (t) { root.clearTimeout(t); }
  });
  root.Ai = ai;
  var script = root.document && root.document.currentScript;
  if (script && script.getAttribute('data-resume') === '1') root.setTimeout(function () { ai.resume(); }, 3000);
})(this);
```

- [ ] **Step 4: Run and see it pass**

Run: `node --test tests/ai.test.js`
Expected: PASS, 12 tests. If the timeout test fails on `s.timers[...]` being `null`, the request already finished: the fake `hang` only hangs from the second `generate`, and the warm-up is call 1, so the explain calls are calls 2 and 3.

- [ ] **Step 5: Commit command for the owner**

```bash
git add web/engine/ai.js tests/ai.test.js && git commit -m 'AI helper: state machine with download, warm-up check, timeouts and per-child switch' -- web/engine/ai.js tests/ai.test.js
```

---

### Task 4: Worker runtime (browser only, no unit tests)

**Files:**
- Create: `web/engine/ai-runtime.js`
- Create: `web/engine/ai-worker.js`

These two files only run in a browser with WebGPU; they are proven by the Task 1 spike (same calls) and by the manual tablet check in Task 9. If the spike needed the other `processor(...)` form, use that form in `ai-worker.js`.

- [ ] **Step 1: Write the runtime wrapper**

```js
/* Runs the AI model in a Web Worker so a game never freezes. Browser only; Ai (ai.js) is its only caller.
   load(config, onProgress) fetches and initialises the model, generate() asks it for text, cancel() drops waiting
   answers, dispose() frees the model's memory by ending the worker. */
(function (root) {
  'use strict';

  var script = root.document && root.document.currentScript;
  var base = script && script.src ? script.src.replace(/[^\/]*$/, '') : '';

  function create(spawn) {
    var worker = null;
    var nextId = 1;
    var jobs = {};
    var onProgress = null;

    function failJob(id, err) {
      var job = jobs[id];
      if (!job) return;
      delete jobs[id];
      job.reject(err);
    }
    function failAll(err) { Object.keys(jobs).forEach(function (id) { failJob(id, err); }); }
    function stop() {
      if (worker) worker.terminate();
      worker = null;
    }

    function open() {
      if (worker) return worker;
      worker = spawn();
      worker.onmessage = function (e) {
        var m = e.data;
        if (m.type === 'progress') {
          if (onProgress) onProgress(m.value);
          return;
        }
        var job = jobs[m.id];
        if (!job) return;
        delete jobs[m.id];
        if (m.type === 'error') {
          var err = new Error(m.message);
          err.unsupported = !!m.unsupported;
          job.reject(err);
        } else {
          job.resolve(m.text);
        }
      };
      worker.onerror = function (e) {
        failAll(new Error((e && e.message) || 'worker error'));
        stop();
      };
      return worker;
    }

    function send(message, progress) {
      return new Promise(function (resolve, reject) {
        var id = nextId++;
        jobs[id] = { resolve: resolve, reject: reject };
        if (progress) onProgress = progress;
        message.id = id;
        open().postMessage(message);
      });
    }

    return {
      available: function () { return typeof root.Worker === 'function'; },
      load: function (config, progress) { return send({ type: 'load', config: config }, progress); },
      generate: function (text, opts) { return send({ type: 'generate', prompt: text, maxTokens: opts.maxTokens, config: opts.config }); },
      cancel: function () { failAll(new Error('cancelled')); },
      dispose: function () {
        failAll(new Error('disposed'));
        stop();
      }
    };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { create: create };
    return;
  }
  root.AiRuntime = create(function () { return new root.Worker(base + 'ai-worker.js', { type: 'module' }); });
})(this);
```

- [ ] **Step 2: Write the worker** (an ES module, so modern syntax is fine here; the library is a module too)

```js
/* Module worker for the AI helper (see ai-runtime.js). Loads Transformers.js and Gemma 4 E2B on demand, one request
   at a time. The text-only call form is the one the spike (web/ai-spike) proved on the tablets. */
let lib = null;
let model = null;
let processor = null;
let queue = Promise.resolve();
const files = {};

function progress(info) {
  if (info.status !== 'progress' || !info.file) return;
  files[info.file] = { loaded: info.loaded, total: info.total };
  let loaded = 0;
  let total = 0;
  for (const name in files) {
    loaded += files[name].loaded;
    total += files[name].total;
  }
  if (total) postMessage({ type: 'progress', value: Math.min(loaded / total, 0.99) });
}

async function ensure(config) {
  if (model) return;
  lib = await import(config.lib);
  processor = await lib.AutoProcessor.from_pretrained(config.model);
  model = await lib.Gemma4ForConditionalGeneration.from_pretrained(config.model, { dtype: config.dtype, device: 'webgpu', progress_callback: progress });
}

async function generate(prompt, maxTokens) {
  const messages = [{ role: 'user', content: [{ type: 'text', text: prompt }] }];
  const text = processor.apply_chat_template(messages, { enable_thinking: false, add_generation_prompt: true });
  const inputs = await processor(text, null, null, { add_special_tokens: false });
  const out = await model.generate({ ...inputs, max_new_tokens: maxTokens, do_sample: false });
  const start = inputs.input_ids.dims.at(-1);
  return processor.batch_decode(out.slice(null, [start, null]), { skip_special_tokens: true })[0];
}

onmessage = (e) => {
  const m = e.data;
  queue = queue.then(async () => {
    try {
      await ensure(m.config);
      if (m.type === 'load') postMessage({ type: 'result', id: m.id, text: '' });
      else postMessage({ type: 'result', id: m.id, text: await generate(m.prompt, m.maxTokens) });
    } catch (err) {
      const message = String((err && err.message) || err);
      postMessage({ type: 'error', id: m.id, message, unsupported: /webgpu|adapter/i.test(message) });
    }
  });
};
```

- [ ] **Step 3: Check the files parse**

Run: `node --check web/engine/ai-runtime.js && node --check --input-type=module < web/engine/ai-worker.js`
Expected: no output (no syntax errors).

- [ ] **Step 4: Commit command for the owner**

```bash
git add web/engine/ai-runtime.js web/engine/ai-worker.js && git commit -m 'AI helper: Web Worker runtime for Gemma 4 E2B' -- web/engine/ai-runtime.js web/engine/ai-worker.js
```

---

### Task 5: `ai-explain.js` (button and answer card)

**Files:**
- Create: `web/engine/ai-explain.js`

It is covered by the headless-Chrome check in Task 8; there is no Node test because it is all DOM.

- [ ] **Step 1: Write the module**

```js
/* The "Explain it another way" button under a wrong-answer panel. A game calls AiExplain.offer(miss, panel) right after it
   fills the panel; miss is the fields the game already has (q, picked, answer, why, explain, tip). Nothing is drawn unless
   Ai says it is ready for this child. The answer is the helper's words, never the lesson's, and never changes points. */
(function (root) {
  'use strict';

  var MAX_RETRIES = 2;
  var TEXT = {
    button: 'Explain it another way',
    thinking: 'Thinking\u2026',
    head: "Helper's answer",
    thanks: 'Thanks, got it',
    again: 'Try again',
    fallback: "Try the lesson's explanation above."
  };
  var CSS = '.ai-box{margin-top:10px;}' +
    '.ai-btn{font:inherit;font-weight:800;cursor:pointer;padding:9px 14px;border-radius:12px;border:2px solid var(--border,#cfd6e4);background:var(--card,#fff);color:var(--ink,#1f2937);}' +
    '.ai-card{background:var(--card,#fff);border:2px solid var(--border,#cfd6e4);border-left:5px solid #7c5cff;border-radius:12px;padding:9px 12px;line-height:1.5;}' +
    '.ai-card b{display:block;font-size:.78rem;text-transform:uppercase;letter-spacing:.04em;color:var(--muted,#6b7280);}' +
    '.ai-wait{margin:0;font-weight:700;color:var(--muted,#6b7280);}' +
    '.ai-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;}';
  var handle = null;

  function make(doc, tag, cls, text) {
    var node = doc.createElement(tag);
    if (cls) node.className = cls;
    if (text) node.textContent = text;
    return node;
  }

  function addStyle(doc) {
    if (doc.getElementById('ai-explain-css')) return;
    var style = make(doc, 'style');
    style.id = 'ai-explain-css';
    style.textContent = CSS;
    doc.head.appendChild(style);
  }

  function offer(miss, panel) {
    if (handle) {
      handle.cancel();
      handle = null;
    }
    var ai = root.Ai;
    var learner = root.Learner && root.Learner.current && root.Learner.current();
    if (!ai || !panel || !learner || !root.AiPrompt || !ai.ready(learner.id) || !root.AiPrompt.canAsk(miss)) return;
    var doc = panel.ownerDocument;
    addStyle(doc);
    var box = make(doc, 'div', 'ai-box');
    box.setAttribute('aria-live', 'polite');
    panel.appendChild(box);
    var tries = 0;

    function button(label, cls, onClick) {
      var b = make(doc, 'button', cls, label);
      b.type = 'button';
      b.addEventListener('click', onClick);
      return b;
    }

    function showButton() {
      box.textContent = '';
      box.appendChild(button('\u2728 ' + TEXT.button, 'ai-btn', ask));
    }

    function showAnswer(text) {
      box.textContent = '';
      var card = make(doc, 'div', 'ai-card');
      card.appendChild(make(doc, 'b', '', TEXT.head));
      card.appendChild(make(doc, 'span', 'ai-answer', text || TEXT.fallback));
      var row = make(doc, 'div', 'ai-row');
      row.appendChild(button(TEXT.thanks, 'ai-btn ai-thanks', function () { box.textContent = ''; }));
      if (text && tries <= MAX_RETRIES && ai.ready(learner.id)) row.appendChild(button(TEXT.again, 'ai-btn ai-again', ask));
      card.appendChild(row);
      box.appendChild(card);
    }

    function ask() {
      tries++;
      box.textContent = '';
      box.appendChild(make(doc, 'p', 'ai-wait', TEXT.thinking));
      handle = ai.explain(miss, learner.grade, function (err, text) {
        handle = null;
        showAnswer(err ? '' : text);
      });
    }

    showButton();
  }

  root.AiExplain = { offer: offer };
})(this);
```

- [ ] **Step 2: Check the file parses**

Run: `node --check web/engine/ai-explain.js`
Expected: no output.

- [ ] **Step 3: Commit command for the owner**

```bash
git add web/engine/ai-explain.js && git commit -m 'AI helper: Explain it another way button and answer card' -- web/engine/ai-explain.js
```

---

### Task 6: Parent switch in the lobbies

**Files:**
- Modify: `web/engine/parent-panel.js` (after `showClockFix();`, around line 612)
- Modify: `web/lobby/grade-2.html`, `web/lobby/grade-5.html` (a new `#ai-section` after `#cloud-section`, and script tags before `parent-panel.js`)

- [ ] **Step 1: Write the failing wiring test** in `tests/ai-wiring.test.js`

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { APPS, LOBBIES, ENGINE_FILES, appFile, lobbyFile, engineFile } = require('./paths.js');

const count = (html, s) => html.split(s).length - 1;
const FILIPINO = ['kuwentista', 'batang-bayani', 'history-explorers', 'wikaharian'];
const NEW_FILES = ['ai-prompt.js', 'ai-runtime.js', 'ai-worker.js', 'ai.js', 'ai-explain.js'];

test('the AI engine files are listed in ENGINE_FILES', () => {
  for (const f of NEW_FILES) assert.ok(ENGINE_FILES.includes(f), f + ' in ENGINE_FILES');
});

for (const grade of Object.keys(LOBBIES)) {
  test('grade ' + grade + ' lobby has the AI helper row and loads the AI files before the parent panel', () => {
    const html = fs.readFileSync(lobbyFile(grade), 'utf8');
    assert.equal(count(html, 'id="ai-section"'), 1);
    for (const id of ['ai-device', 'ai-child', 'ai-name', 'ai-status']) assert.equal(count(html, 'id="' + id + '"'), 1, id);
    const tags = '<script src="../engine/ai-prompt.js"></script>\n<script src="../engine/ai-runtime.js"></script>\n<script src="../engine/ai.js" data-resume="1"></script>\n<script src="../engine/parent-panel.js" data-grade="grade' + grade + '"></script>';
    assert.equal(count(html, tags), 1);
  });
}

test('the parent panel wires the AI helper switches', () => {
  const js = fs.readFileSync(engineFile('parent-panel.js'), 'utf8');
  assert.equal(count(js, 'mountAi();'), 1);
  assert.equal(count(js, 'ai.enable();'), 1);
  assert.equal(count(js, 'ai.setChild(me.id,'), 1);
});
```

- [ ] **Step 2: Run and see it fail**

Run: `node --test tests/ai-wiring.test.js`
Expected: FAIL (`ai-prompt.js` not in ENGINE_FILES).

- [ ] **Step 3: Add the engine files to `tests/paths.js`**

In `ENGINE_FILES` add `'ai-prompt.js', 'ai-runtime.js', 'ai-worker.js', 'ai.js', 'ai-explain.js'` after `'trail.js'`.

- [ ] **Step 4: Add the section markup to both lobbies**

Right after the line `<div class="p-section" id="cloud-section" hidden></div>` in `web/lobby/grade-2.html` and `web/lobby/grade-5.html`:

```html
          <div class="p-section" id="ai-section" hidden>
            <h3>✨ AI helper</h3>
            <p class="p-note">Adds an "Explain it another way" button after a wrong answer. It runs on this tablet and needs a one-time download of more than 1 GB, so start it on home Wi-Fi.</p>
            <div class="p-row">
              <label><input type="checkbox" id="ai-device"> Turn on for this tablet</label>
              <label><input type="checkbox" id="ai-child"> Show it to <span id="ai-name">this child</span></label>
            </div>
            <p class="p-note" id="ai-status"></p>
          </div>
```

- [ ] **Step 5: Add the script tags before `parent-panel.js` in both lobbies**

Replace the one `parent-panel.js` line (`grade-2.html:687`, `grade-5.html:719`) with (use `grade2` / `grade5` to match the file):

```html
<script src="../engine/ai-prompt.js"></script>
<script src="../engine/ai-runtime.js"></script>
<script src="../engine/ai.js" data-resume="1"></script>
<script src="../engine/parent-panel.js" data-grade="grade5"></script>
```

- [ ] **Step 6: Add `mountAi()` to `parent-panel.js`**

Directly after the line `showClockFix();`:

```js
    var AI_STATUS = {
      off: 'Off.',
      unsupported: 'Not supported on this tablet.',
      waiting: 'Waiting for Wi-Fi\u2026',
      ready: 'Ready.',
      failed: 'The download did not finish. Turn it off and on to try again.'
    };
    function mountAi() {
      var ai = root.Ai;
      if (!$('ai-section') || !ai) return;
      var me = root.Learner && root.Learner.current && root.Learner.current();
      $('ai-section').hidden = false;
      if (me && me.name) $('ai-name').textContent = me.name;
      function paint() {
        var s = ai.state();
        $('ai-device').checked = s.state !== 'off' && s.state !== 'unsupported';
        $('ai-device').disabled = s.state === 'unsupported';
        $('ai-child').checked = !!(me && ai.childOn(me.id));
        $('ai-child').disabled = !me || s.state === 'unsupported';
        $('ai-status').textContent = s.state === 'downloading' ? 'Downloading\u2026 ' + Math.round(s.progress * 100) + '%' : AI_STATUS[s.state];
      }
      $('ai-device').addEventListener('change', function () {
        if ($('ai-device').checked) ai.enable(); else ai.disable();
      });
      $('ai-child').addEventListener('change', function () {
        if (me) ai.setChild(me.id, $('ai-child').checked);
      });
      ai.onChange(paint);
      root.addEventListener('online', function () { ai.resume(); });
      paint();
    }
    mountAi();
```

- [ ] **Step 7: Run and see it pass**

Run: `node --test tests/ai-wiring.test.js tests/nav-wiring.test.js tests/parent-pin-wiring.test.js`
Expected: PASS. (The nav and PIN tests are a quick check that the lobby pages still match their existing script-order assertions.)

- [ ] **Step 8: Commit command for the owner**

```bash
git add tests/paths.js tests/ai-wiring.test.js web/engine/parent-panel.js web/lobby/grade-2.html web/lobby/grade-5.html && git commit -m 'AI helper: parent switch in the lobby Settings tab' -- tests/paths.js tests/ai-wiring.test.js web/engine/parent-panel.js web/lobby/grade-2.html web/lobby/grade-5.html
```

---

### Task 7: Wire the 13 games

**Files:** the 13 game pages listed in the file structure section (`web/subjects/grade-N/<game>/index.html`).

Each game gets the same four script tags right before its `study-kit.js` tag, and one `AiExplain.offer` line right after the line that fills the wrong-answer panel.

- [ ] **Step 1: Extend the wiring test** (append to `tests/ai-wiring.test.js`)

```js
for (const app of APPS) {
  const wired = !FILIPINO.includes(app.id);
  test(app.id + (wired ? ' has' : ' does not have') + ' the Explain it another way button', () => {
    const html = fs.readFileSync(appFile(app.id), 'utf8');
    if (!wired) {
      assert.equal(count(html, 'AiExplain'), 0);
      assert.equal(count(html, 'engine/ai'), 0);
      return;
    }
    const tags = '<script src="../../../engine/ai-prompt.js"></script>\n<script src="../../../engine/ai-runtime.js"></script>\n<script src="../../../engine/ai.js" data-grade="grade' + app.grade + '"></script>\n<script src="../../../engine/ai-explain.js"></script>\n<script src="../../../engine/study-kit.js"';
    assert.equal(count(html, tags), 1, 'four AI scripts right before study-kit.js');
    assert.equal(count(html, 'AiExplain.offer('), 1, 'one offer call');
    assert.ok(html.lastIndexOf('AiExplain.offer(') > html.lastIndexOf('learnHtml('), 'the offer comes after the panel is filled');
  });
}
```

- [ ] **Step 2: Run and see it fail**

Run: `node --test tests/ai-wiring.test.js`
Expected: FAIL for the 13 games.

- [ ] **Step 3: Insert the script tags in the 13 games with a one-off script**

Save this as `C:\Users\ADMIN\AppData\Local\Temp\claude\C--Users-ADMIN-IdeaProjects-school\fe9f2242-864f-4fe4-b097-d8ab3fb312da\scratchpad\add-ai-tags.js` (scratchpad, not the repo) and run it from the repo root:

```js
const fs = require('node:fs');
const path = require('node:path');
const GAMES = ['grade-5/computer', 'grade-5/english', 'grade-5/gmrc', 'grade-5/math', 'grade-5/music-arts', 'grade-5/pe-health', 'grade-5/science', 'grade-5/tle',
  'grade-2/computer', 'grade-2/english', 'grade-2/gmrc', 'grade-2/math', 'grade-2/science'];
for (const g of GAMES) {
  const file = path.join('web', 'subjects', g, 'index.html');
  const html = fs.readFileSync(file, 'utf8');
  const grade = g.startsWith('grade-5') ? 'grade5' : 'grade2';
  const eol = html.includes('\r\n') ? '\r\n' : '\n';
  const anchor = '<script src="../../../engine/study-kit.js"';
  if (!html.includes(anchor)) throw new Error(g + ': no study-kit.js tag');
  const tags = ['<script src="../../../engine/ai-prompt.js"></script>', '<script src="../../../engine/ai-runtime.js"></script>',
    '<script src="../../../engine/ai.js" data-grade="' + grade + '"></script>', '<script src="../../../engine/ai-explain.js"></script>'].join(eol) + eol;
  fs.writeFileSync(file, html.replace(anchor, tags + anchor));
  console.log('tags added: ' + g);
}
```

Run: `node C:\Users\ADMIN\AppData\Local\Temp\claude\C--Users-ADMIN-IdeaProjects-school\fe9f2242-864f-4fe4-b097-d8ab3fb312da\scratchpad\add-ai-tags.js`
Expected: 13 lines `tags added: ...`.

- [ ] **Step 4: Add the offer line in the 7 Grade 5 "Page Turners family" games** (`computer`, `english`, `gmrc`, `music-arts`, `pe-health`, `science`, `tle`)

Find the line (about 704-719 in each):

```js
  document.getElementById('explainBox').innerHTML = miss ? learnHtml(miss) : explainHtml;
```

Add directly after it:

```js
  if (miss && window.AiExplain) AiExplain.offer(miss, document.getElementById('explainBox'));
```

- [ ] **Step 5: Add the offer line in the 4 Grade 2 games** (`computer`, `english`, `gmrc`, `science`)

Find the line (about 773-822 in each):

```js
    fb.innerHTML = isCorrect ? CHECK_ICON + '<span>' + decode(item.good) + '</span>' : X_ICON + learnHtml(miss);
```

Add directly after it:

```js
    if (!isCorrect && window.AiExplain) AiExplain.offer(miss, fb);
```

- [ ] **Step 6: Add the offer line in the two math games**

Grade 2 math (`web/subjects/grade-2/math/index.html`, the multiple-choice handler, about line 819): after the `fb.innerHTML = correct ? ... : ...${learnHtml(miss)}...;` statement that is followed by `document.getElementById('q-next-btn').classList.remove('hidden');`, add:

```js
  if (!correct && window.AiExplain) AiExplain.offer(miss, fb);
```

Grade 5 math (`web/subjects/grade-5/math/index.html`, about line 2880): same place, after the `fb.innerHTML = correct ? ... learnHtml(missedQuestions[missedQuestions.length-1]) ...;` statement, add:

```js
  if (!correct && window.AiExplain) AiExplain.offer(missedQuestions[missedQuestions.length - 1], fb);
```

The number-line, word-problem and other special question types in the math games keep no button (accepted gap).

- [ ] **Step 7: Run and see it pass**

Run: `node --test tests/ai-wiring.test.js`
Expected: PASS for the 13 games and the 4 Filipino games.

- [ ] **Step 8: Commit command for the owner**

```bash
git add tests/ai-wiring.test.js web/subjects/grade-2/computer/index.html web/subjects/grade-2/english/index.html web/subjects/grade-2/gmrc/index.html web/subjects/grade-2/math/index.html web/subjects/grade-2/science/index.html web/subjects/grade-5/computer/index.html web/subjects/grade-5/english/index.html web/subjects/grade-5/gmrc/index.html web/subjects/grade-5/math/index.html web/subjects/grade-5/music-arts/index.html web/subjects/grade-5/pe-health/index.html web/subjects/grade-5/science/index.html web/subjects/grade-5/tle/index.html && git commit -m 'AI helper: Explain it another way in the 13 English-language games' -- tests/ai-wiring.test.js web/subjects/grade-2/computer/index.html web/subjects/grade-2/english/index.html web/subjects/grade-2/gmrc/index.html web/subjects/grade-2/math/index.html web/subjects/grade-2/science/index.html web/subjects/grade-5/computer/index.html web/subjects/grade-5/english/index.html web/subjects/grade-5/gmrc/index.html web/subjects/grade-5/math/index.html web/subjects/grade-5/music-arts/index.html web/subjects/grade-5/pe-health/index.html web/subjects/grade-5/science/index.html web/subjects/grade-5/tle/index.html
```

(Note for the agent: several of these files already have uncommitted edits from the world-as-home work. Tell the owner to review `git diff` for them, or commit this change after theirs.)

---

### Task 8: Headless-Chrome check with a fake model

**Files:**
- Create: `tests/e2e/driver-ai.page.js`
- Create: `tests/e2e/ai-e2e.js`

- [ ] **Step 1: Write the driver** (a test-only page script; `__AI` holds the case)

```js
(function () {
  var c = __AI;
  var out = { errors: window.__e2eErrors || [] };
  var me = Learner.current();

  function install(opts) {
    var data = {};
    if (opts.on) {
      var child = {};
      child[me.id] = true;
      data.study_ai_v1 = JSON.stringify({ on: true, status: 'ready', child: child });
    }
    var runtime = {
      available: function () { return true; },
      load: function () { return Promise.resolve(); },
      generate: function () { return opts.fail ? Promise.reject(new Error('boom')) : Promise.resolve('You land on 7 because you take 4 jumps.'); },
      cancel: function () {},
      dispose: function () {}
    };
    window.Ai = Ai.create({
      storage: { getItem: function (k) { return k in data ? data[k] : null; }, setItem: function (k, v) { data[k] = String(v); } },
      runtime: function () { return runtime; }, nav: { gpu: {}, onLine: true }, prompt: AiPrompt, now: Date.now,
      setTimeout: function (f, ms) { return setTimeout(f, ms); }, clearTimeout: function (t) { clearTimeout(t); }
    });
  }
  function wrongAnswer() {
    eval(c.start);
    eval(c.wrong);
  }
  function box() { return document.getElementById(c.panel).querySelector('.ai-box'); }
  function done() {
    var pre = document.createElement('pre');
    pre.id = 'e2e-out';
    pre.textContent = JSON.stringify(out);
    document.body.appendChild(pre);
  }

  try {
    install({ on: false });
    wrongAnswer();
    out.offHasBox = !!box();

    install({ on: true });
    wrongAnswer();
    out.onHasButton = !!(box() && box().querySelector('.ai-btn'));
    box().querySelector('.ai-btn').click();
    out.thinking = box().textContent;
    setTimeout(function () {
      out.answer = box().querySelector('.ai-answer').textContent;
      out.hasAgain = !!box().querySelector('.ai-again');
      box().querySelector('.ai-thanks').click();
      out.closed = box().textContent === '';

      install({ on: true, fail: true });
      wrongAnswer();
      box().querySelector('.ai-btn').click();
      setTimeout(function () {
        out.failAnswer = box().querySelector('.ai-answer').textContent;
        out.failHasAgain = !!box().querySelector('.ai-again');
        done();
      }, 50);
    }, 50);
  } catch (e) {
    out.errors.push(String(e && e.stack || e));
    done();
  }
})();
```

- [ ] **Step 2: Write the runner**

```js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { stage, makeWorkDir, dumpDom, readOutput, injectDriver } = require('./chrome.js');
const { ENGINE_FILES, app, appFile } = require('../paths.js');

// One game per wrong-answer family. wrong() picks the first option that is not the right one.
const CASES = [
  { id: 'page-turners', start: 'currentLessonIdx = 0; startQuiz()', wrong: 'selectOption((currentQuizSet[quizIdx].correct + 1) % currentQuizSet[quizIdx].options.length)', panel: 'explainBox' },
  { id: 'block-bot', start: 'currentLessonIdx = 0; startQuiz()', wrong: 'selectOption((currentQuizSet[quizIdx].correct + 1) % currentQuizSet[quizIdx].options.length)', panel: 'q-feedback' },
];

const work = makeWorkDir('ai-e2e');
const driver = fs.readFileSync(path.join(__dirname, 'driver-ai.page.js'), 'utf8');

for (const c of CASES) {
  const html = injectDriver(fs.readFileSync(appFile(c.id), 'utf8'), 'var __AI = ' + JSON.stringify(c) + ';\n' + driver);
  const file = stage(path.join(work, c.id), app(c.id).page, html, ENGINE_FILES);
  const r = readOutput(dumpDom(path.join(work, 'profile-' + c.id), file, '', 5000));
  assert.deepEqual(r.errors, [], c.id + ': page errors');
  assert.equal(r.offHasBox, false, c.id + ': no button while the AI is off');
  assert.equal(r.onHasButton, true, c.id + ': the button shows when the AI is ready for this child');
  assert.match(r.thinking, /Thinking/, c.id + ': the card shows Thinking while it waits');
  assert.equal(r.answer, 'You land on 7 because you take 4 jumps.', c.id + ': the helper\'s answer shows');
  assert.equal(r.hasAgain, true, c.id + ': Try again is offered after an answer');
  assert.equal(r.closed, true, c.id + ': Thanks, got it closes the card');
  assert.equal(r.failAnswer, "Try the lesson's explanation above.", c.id + ': a failed request falls back to the lesson text');
  assert.equal(r.failHasAgain, false, c.id + ': no Try again after a failure');
  console.log('ok ' + c.id);
}
```

- [ ] **Step 3: Run it**

Run: `node tests/e2e/ai-e2e.js`
Expected: `ok page-turners`, `ok block-bot`. If `startQuiz()` needs a lesson flow for a game, mirror how `tests/e2e/driver-family-a.page.js` starts it. If the answer text check fails only because the fake text is not allowed through the number filter, the facts in the game have no `7`: change the fake answer in `driver-ai.page.js` to `'You can see why the right answer fits the lesson.'` and the same text in the runner.

- [ ] **Step 4: Commit command for the owner**

```bash
git add tests/e2e/driver-ai.page.js tests/e2e/ai-e2e.js && git commit -m 'AI helper: headless Chrome check with a fake model' -- tests/e2e/driver-ai.page.js tests/e2e/ai-e2e.js
```

---

### Task 9: Cleanup, precache, docs, full run

**Files:**
- Delete: `web/ai-spike/index.html` (and its folder)
- Modify: `web/sw.js` (generated), `README.md`, `docs/HANDOFF.md`

- [ ] **Step 1: Remove the spike page**

Run: `rm -r web/ai-spike`
Expected: the folder is gone.

- [ ] **Step 2: Regenerate the offline file list**

Run: `node tools/update-precache.js`
Expected: `web/sw.js` PRECACHE now lists the five new engine files and no `ai-spike`.

- [ ] **Step 3: Run the whole test suite**

Run: `node --test`
Expected: all pass. If a test rejects `ai-worker.js` for modern syntax (arrow functions, `async`), exempt that one file in that test with a one-line comment saying it is a module worker.

- [ ] **Step 4: Run the browser checks**

Run: `node tests/e2e/ai-e2e.js && node tests/e2e/nav-e2e.js && node tests/e2e/lobby-e2e.js`
Expected: all print `ok` lines with no assertion errors.

- [ ] **Step 5: Document it**

In `docs/HANDOFF.md`, under "Built", add a bullet:

```markdown
- On-device AI helper (2026-10-11): Gemma 4 E2B runs in the tablet's browser (WebGPU, Transformers.js in a module worker,
  files fetched from Hugging Face and cached by the browser). A parent switches it on in the lobby's Settings tab (per
  tablet and per child; the download then runs on Wi-Fi only). After a wrong answer in the 13 English-language games an
  "Explain it another way" button asks the model to restate that question's own facts in 2-3 simple sentences; English
  only, never changes points, and the games behave as before when it is off or unsupported. `web/engine/ai-prompt.js`,
  `ai.js` (state, key `study_ai_v1`), `ai-runtime.js` + `ai-worker.js`, `ai-explain.js`. Spec and plan:
  `docs/superpowers/specs/2026-10-11-on-device-ai-design.md`, `docs/superpowers/plans/2026-10-11-on-device-ai.md`.
  Sub-project 2 (pet teacher chat in the 3D world) is next. Tablet check pending (real download, speed, battery,
  answer wording).
```

In `README.md`, in the features list, add one line: `- **AI helper (optional):** a parent can switch on an on-device AI that re-explains a missed question in simpler words; it needs a one-time download of more than 1 GB.`

- [ ] **Step 6: Manual tablet check (owner)**

On each tablet, on home Wi-Fi: open the lobby, Settings, turn on AI helper and "Show it to ..."; wait for Ready; open a game, answer wrong, tap Explain it another way. Check: the first answer arrives (it can take up to a minute the first time), the wording is simple and correct, Try again works, the game plays normally with the AI off, and the battery and tablet temperature stay reasonable. Report anything odd.

- [ ] **Step 7: Commit command for the owner**

```bash
git add -A web/ai-spike web/sw.js README.md docs/HANDOFF.md && git commit -m 'AI helper: remove the spike page, refresh the offline file list, document it' -- web/ai-spike web/sw.js README.md docs/HANDOFF.md
```

---

## Self-review (done)

- **Spec coverage:** goal and decisions (Tasks 1-8); engine, worker, prompt, cleaning (2-4); parent switch and states (3, 6); button and card with 2 retries (5); safety and failure rules (2, 3); games wiring (7); node unit tests, e2e with a fake runtime, manual tablet check (2, 3, 8, 9); spike first with a stop rule (1); precache (9). The `waiting` state and the lobby `data-resume` are additions the spec did not name (the spec's Wi-Fi-only rule needed them). The flashcards-in-the-prompt idea was dropped: the facts already come from the question's own fields.
- **Type consistency:** `Ai.create(deps)` with `runtime()` as a function, `state()/ready(id)/childOn/setChild/enable/disable/resume/explain/onChange`; `AiPrompt.strip/canAsk/build/filter`; `AiRuntime.available/load/generate/cancel/dispose`; `AiExplain.offer(miss, panel)`; the e2e driver uses the same names.
- **Placeholders:** none; the one number that is genuinely unknown (`warmupMaxMs`) has a starting value and a rule for setting it from the spike.
