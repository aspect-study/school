// Offline support for both lobbies. Network first, so a content update shows up
// the next time a tablet is online; the cache is only used when offline.
const CACHE = 'study-games-v1';
const FONT_CACHE = 'study-games-fonts-v1';
const NETWORK_TIMEOUT_MS = 4000;

const PRECACHE = [
  'lobby-grade5.html',
  'manifest-grade5.webmanifest',
  'craft-corner.html',
  'history-explorers.html',
  'life-lab.html',
  'math-mastery.html',
  'page-turners.html',
  'rally-ready.html',
  'rise-shine.html',
  'wikaharian.html',
  'fx.js',
  'powerups.js',
  'recall.js',
  'study-history.js',
  'wallet.js',
  'icons/grade5-180.png',
  'icons/grade5-192.png',
  'icons/grade5-512.png',
  'grade 2/lobby.html',
  'grade 2/manifest-grade2.webmanifest',
  'grade 2/batang-bayani.html',
  'grade 2/block-bot.html',
  'grade 2/byte-buddies.html',
  'grade 2/growing-good.html',
  'grade 2/kuwentista.html',
  'grade 2/science-detectives.html',
  'grade 2/word-train.html',
  'grade 2/fx-grade2.js',
  'grade 2/powerups-grade2.js',
  'grade 2/recall-grade2.js',
  'grade 2/study-history-grade2.js',
  'grade 2/wallet-grade2.js',
  'icons/grade2-180.png',
  'icons/grade2-192.png',
  'icons/grade2-512.png',
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
