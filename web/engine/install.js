/* Install reminder: a banner on the lobby that asks the family to install the app (PWA) and shows the right steps for the
   device. Chrome and Edge (Android and desktop) get a real Install button; iPhone, iPad, Safari and Firefox get steps.
   Nothing shows once the app is installed, and "Later" hides it for a week. Grade 2 shows English; the 🇵🇭 Filipino switch
   brings the Filipino back, as in the rest of the lobby. Device-only: it never syncs. */
(function (root) {
  'use strict';

  var KEY = 'install_reminder_v1';
  var LATER_MS = 7 * 24 * 3600 * 1000;
  var FOREVER = 8640000000000000;
  var FALLBACK_MS = 4000;
  var script = root.document && root.document.currentScript;
  var grade = script && script.getAttribute('data-grade');

  var TEXT = {
    title: 'I-install ang app · Install this app',
    why: 'Ilagay ito sa device para mabuksan na parang app at puwedeng laruin kahit walang internet. · Add it to your device to open it like an app and play even without internet.',
    ios: 'Pindutin ang Share (ang parisukat na may arrow), tapos piliin ang Add to Home Screen. · Tap Share (the square with an arrow), then Add to Home Screen.',
    android: 'Pindutin ang ⋮ menu, tapos piliin ang Install app (o Add to Home screen). · Tap the ⋮ menu, then Install app (or Add to Home screen).',
    desktop: 'Pindutin ang install icon sa address bar, o buksan ang menu ng browser at piliin ang Install. · Click the install icon in the address bar, or open the browser menu and choose Install.',
    install: 'Install',
    later: 'Later'
  };

  function detect(env) {
    var ua = env.ua || '';
    if (env.standalone) return { installed: true };
    if (/iPad|iPhone|iPod/.test(ua) || (env.platform === 'MacIntel' && env.touchPoints > 1)) return { installed: false, kind: 'ios' };
    if (/Android/.test(ua)) return { installed: false, kind: 'android' };
    return { installed: false, kind: 'desktop' };
  }

  function due(raw, now) {
    var until = 0;
    try { until = Number(JSON.parse(raw).until) || 0; } catch (e) {}
    return now >= until;
  }

  function words(lang) {
    var out = {};
    Object.keys(TEXT).forEach(function (k) { out[k] = TEXT[k]; });
    if (grade === 'grade2') return lang ? lang.localize(out) : out;
    Object.keys(out).forEach(function (k) {
      var cut = out[k].lastIndexOf(' · ');
      if (cut >= 0) out[k] = out[k].slice(cut + 3);
    });
    return out;
  }

  function el(doc, tag, cls, text) {
    var n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }

  function addStyle(doc) {
    var s = el(doc, 'style');
    s.textContent = '.install-bar{position:fixed;left:12px;right:12px;bottom:max(12px,env(safe-area-inset-bottom));z-index:50;' +
      'max-width:520px;margin:0 auto;padding:14px 16px;border-radius:18px;background:var(--card,#fff);color:var(--ink,#2B2A22);' +
      'border:2px solid var(--header-accent,#1B7A79);box-shadow:0 10px 30px rgba(0,0,0,.25);font:600 15px/1.35 Nunito,system-ui,sans-serif}' +
      '.install-bar[hidden]{display:none}.install-bar h2{margin:0 0 4px;font:800 18px Baloo 2,system-ui,sans-serif}' +
      '.install-bar p{margin:0 0 10px}.install-bar .install-steps{padding:8px 10px;border-radius:12px;background:var(--bg-alt,#EBE6D6);margin-bottom:10px}' +
      '.install-bar .install-row{display:flex;gap:10px;justify-content:flex-end}.install-bar button{font:800 15px Nunito,system-ui,sans-serif;' +
      'min-height:44px;padding:0 18px;border-radius:12px;border:2px solid var(--header-accent,#1B7A79);cursor:pointer;background:transparent;color:inherit}' +
      '.install-bar .install-go{background:var(--header-accent,#1B7A79);color:#fff}';
    doc.head.appendChild(s);
  }

  // The banner for one visit. prompt() is the browser's own install dialog when it offered one, otherwise null.
  function banner(doc, kind, t, prompt, onLater) {
    var bar = el(doc, 'section', 'install-bar'), row = el(doc, 'div', 'install-row');
    bar.setAttribute('aria-label', t.title);
    bar.appendChild(el(doc, 'h2', '', '📲 ' + t.title));
    bar.appendChild(el(doc, 'p', '', t.why));
    if (!prompt) bar.appendChild(el(doc, 'div', 'install-steps', t[kind]));
    var later = el(doc, 'button', '', t.later);
    later.type = 'button';
    later.addEventListener('click', onLater);
    row.appendChild(later);
    if (prompt) {
      var go = el(doc, 'button', 'install-go', t.install);
      go.type = 'button';
      go.addEventListener('click', prompt);
      row.appendChild(go);
    }
    bar.appendChild(row);
    return bar;
  }

  function start() {
    var doc = root.document, nav = root.navigator || {};
    if (!doc || (root.location && root.location.protocol === 'file:')) return;
    var store = null;
    try { store = root.localStorage; } catch (e) {}
    var standalone = !!nav.standalone || !!(root.matchMedia && root.matchMedia('(display-mode: standalone)').matches);
    var where = detect({ ua: nav.userAgent, platform: nav.platform, touchPoints: nav.maxTouchPoints, standalone: standalone });
    var seen = null;
    try { seen = store && store.getItem(KEY); } catch (e) {}
    if (where.installed || (seen && !due(seen, Date.now()))) return;

    var t = words(root.Lang), deferred = null, shown = null, timer = null;
    function remember(until) { try { if (store) store.setItem(KEY, JSON.stringify({ until: until })); } catch (e) {} }
    function hide() {
      if (timer) root.clearTimeout(timer);
      if (shown) shown.remove();
      shown = null;
    }
    function show() {
      if (shown) return;
      addStyle(doc);
      shown = banner(doc, where.kind, t, deferred ? function () {
        var ask = deferred;
        deferred = null;
        hide();
        ask.prompt();
      } : null, function () { remember(Date.now() + LATER_MS); hide(); });
      doc.body.appendChild(shown);
    }

    root.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      deferred = e;
      if (shown) { shown.remove(); shown = null; }
      show();
    });
    root.addEventListener('appinstalled', function () { remember(FOREVER); hide(); });
    timer = root.setTimeout(show, where.kind === 'ios' ? 1500 : FALLBACK_MS);
  }

  var api = { detect: detect, due: due, words: words, KEY: KEY, LATER_MS: LATER_MS };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
    return;
  }
  root.Install = api;
  if (root.document) start();
})(this);
