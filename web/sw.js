// Offline support for both lobbies. Network first, so a content update shows up
// the next time a tablet is online; the cache is only used when offline.
const CACHE = 'study-games-v2';
const FONT_CACHE = 'study-games-fonts-v1';
const NETWORK_TIMEOUT_MS = 4000;

const PRECACHE = [
  'index.html',
  'lobby/grade-2.html',
  'lobby/grade-2.webmanifest',
  'lobby/grade-5.html',
  'lobby/grade-5.webmanifest',
  'engine/fx.js',
  'engine/powerups.js',
  'engine/recall.js',
  'engine/study-history.js',
  'engine/wallet.js',
  'subjects/grade-2/computer/index.html',
  'subjects/grade-2/english/index.html',
  'subjects/grade-2/filipino/index.html',
  'subjects/grade-2/gmrc/index.html',
  'subjects/grade-2/makabansa/index.html',
  'subjects/grade-2/math/index.html',
  'subjects/grade-2/science/index.html',
  'subjects/grade-5/araling-panlipunan/index.html',
  'subjects/grade-5/english/index.html',
  'subjects/grade-5/filipino/index.html',
  'subjects/grade-5/gmrc/index.html',
  'subjects/grade-5/math/index.html',
  'subjects/grade-5/pe-health/index.html',
  'subjects/grade-5/science/index.html',
  'subjects/grade-5/tle/index.html',
  'assets/icons/grade2-180.png',
  'assets/icons/grade2-192.png',
  'assets/icons/grade2-512.png',
  'assets/icons/grade5-180.png',
  'assets/icons/grade5-192.png',
  'assets/icons/grade5-512.png',
  // Redirect pages at the old URLs, so icons installed before 2026-10-02 still open offline.
  'craft-corner.html',
  'grade 2/batang-bayani.html',
  'grade 2/block-bot.html',
  'grade 2/byte-buddies.html',
  'grade 2/growing-good.html',
  'grade 2/kuwentista.html',
  'grade 2/lobby.html',
  'grade 2/science-detectives.html',
  'grade 2/word-train.html',
  'history-explorers.html',
  'life-lab.html',
  'lobby-grade5.html',
  'math-mastery.html',
  'page-turners.html',
  'rally-ready.html',
  'rise-shine.html',
  'wikaharian.html',
];

self.addEventListener('install', (event) => {
  // One file at a time, so a single missing file cannot fail the whole install.
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => Promise.all(PRECACHE.map((file) => cache.add(file).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== FONT_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Lobby links end in ?reset=1, so pages are cached under their bare URL.
function withoutSearch(url) {
  const u = new URL(url);
  u.search = '';
  return u.href;
}

function fromNetwork(request) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(reject, NETWORK_TIMEOUT_MS);
    fetch(request).then((response) => {
      clearTimeout(timer);
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(withoutSearch(request.url), copy));
      }
      resolve(response);
    }, (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

function networkFirst(request) {
  const cached = () => caches.match(request, { ignoreSearch: true });
  return fromNetwork(request).then(
    (response) => (response.ok ? response : cached().then((hit) => hit || response)),
    () => cached().then((hit) => hit || fetch(request))
  );
}

function fontsCacheFirst(request) {
  return caches.open(FONT_CACHE).then((cache) =>
    cache.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
      return response;
    }))
  );
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(request));
  } else if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(fontsCacheFirst(request));
  }
});
