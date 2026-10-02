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
  'parent/index.html',
  'parent/parent.css',
  'parent/parent.webmanifest',
  'parent/phone.js',
  'engine/cloud.js',
  'engine/firebase-config.js',
  'engine/firebase-remote.js',
  'engine/fx.js',
  'engine/learner.js',
  'engine/mastery.js',
  'engine/parent-panel.js',
  'engine/powerups.js',
  'engine/recall.js',
  'engine/shop-requests.js',
  'engine/storage.js',
  'engine/study-history.js',
  'engine/study-kit.js',
  'engine/subjects.js',
  'engine/sync-core.js',
  'engine/wallet.js',
  'subjects/grade-2/computer/index.html',
  'subjects/grade-2/computer/lessons/01-taking-care-of-myself-and-my-computer.js',
  'subjects/grade-2/computer/lessons/02-computer-laboratory-rules.js',
  'subjects/grade-2/computer/lessons/03-elements-of-a-computer-system.js',
  'subjects/grade-2/computer/lessons/04-parts-of-the-desktop.js',
  'subjects/grade-2/computer/lessons/05-common-desktop-icons.js',
  'subjects/grade-2/computer/lessons/06-changing-the-desktop-wallpaper.js',
  'subjects/grade-2/computer/lessons/07-quick-launch-bar-and-notification-area.js',
  'subjects/grade-2/computer/lessons/08-understanding-the-internet.js',
  'subjects/grade-2/computer/lessons/09-exploring-the-places-on-the-internet.js',
  'subjects/grade-2/computer/lessons/10-connecting-to-the-internet.js',
  'subjects/grade-2/computer/subject.json',
  'subjects/grade-2/computer/type-it.js',
  'subjects/grade-2/english/index.html',
  'subjects/grade-2/english/lessons/01-review-of-the-alphabet.js',
  'subjects/grade-2/english/lessons/02-onset-and-rime.js',
  'subjects/grade-2/english/lessons/03-cvc-words.js',
  'subjects/grade-2/english/lessons/04-high-frequency-and-math-words.js',
  'subjects/grade-2/english/lessons/05-common-and-proper-nouns.js',
  'subjects/grade-2/english/lessons/06-gender-nouns.js',
  'subjects/grade-2/english/lessons/07-action-verbs.js',
  'subjects/grade-2/english/lessons/08-adjectives.js',
  'subjects/grade-2/english/lessons/09-personal-pronouns.js',
  'subjects/grade-2/english/lessons/10-demonstrative-pronouns.js',
  'subjects/grade-2/english/lessons/11-sentences-and-predicate.js',
  'subjects/grade-2/english/lessons/12-intonation.js',
  'subjects/grade-2/english/lessons/13-sequence-of-events.js',
  'subjects/grade-2/english/subject.json',
  'subjects/grade-2/english/type-it.js',
  'subjects/grade-2/filipino/index.html',
  'subjects/grade-2/filipino/lessons/01-alpabeto.js',
  'subjects/grade-2/filipino/lessons/02-pangngalan.js',
  'subjects/grade-2/filipino/lessons/03-panghalip.js',
  'subjects/grade-2/filipino/lessons/04-magkatugma.js',
  'subjects/grade-2/filipino/lessons/05-panguri.js',
  'subjects/grade-2/filipino/lessons/06-pandiwa.js',
  'subjects/grade-2/filipino/lessons/07-intonasyon.js',
  'subjects/grade-2/filipino/lessons/08-kwento.js',
  'subjects/grade-2/filipino/lessons/09-kayarian.js',
  'subjects/grade-2/filipino/lessons/10-reaksyon.js',
  'subjects/grade-2/filipino/lessons/11-antas.js',
  'subjects/grade-2/filipino/lessons/12-sightwords.js',
  'subjects/grade-2/filipino/lessons/13-kongkreto.js',
  'subjects/grade-2/filipino/lessons/14-parirala.js',
  'subjects/grade-2/filipino/subject.json',
  'subjects/grade-2/filipino/type-it.js',
  'subjects/grade-2/gmrc/index.html',
  'subjects/grade-2/gmrc/lessons/01-i-know-who-i-am.js',
  'subjects/grade-2/gmrc/lessons/02-i-got-this-feeling.js',
  'subjects/grade-2/gmrc/lessons/03-i-pray.js',
  'subjects/grade-2/gmrc/lessons/04-i-take-care-of-myself.js',
  'subjects/grade-2/gmrc/lessons/05-i-spend-wisely.js',
  'subjects/grade-2/gmrc/lessons/06-thrifty-ways.js',
  'subjects/grade-2/gmrc/lessons/07-i-obey.js',
  'subjects/grade-2/gmrc/lessons/08-i-can.js',
  'subjects/grade-2/gmrc/subject.json',
  'subjects/grade-2/gmrc/type-it.js',
  'subjects/grade-2/makabansa/index.html',
  'subjects/grade-2/makabansa/lessons/01-ano-ang-komunidad.js',
  'subjects/grade-2/makabansa/lessons/02-batayang-impormasyon-ng-komunidad.js',
  'subjects/grade-2/makabansa/lessons/03-kahalagahan-ng-komunidad.js',
  'subjects/grade-2/makabansa/lessons/04-klima-at-panahon.js',
  'subjects/grade-2/makabansa/lessons/05-lokasyon-ng-komunidad-ayon-sa-kapaligira.js',
  'subjects/grade-2/makabansa/lessons/06-lawak-at-populasyon-ng-komunidad.js',
  'subjects/grade-2/makabansa/lessons/07-anyong-lupa.js',
  'subjects/grade-2/makabansa/lessons/08-anyong-tubig.js',
  'subjects/grade-2/makabansa/lessons/09-mga-simbolo-sa-mapa.js',
  'subjects/grade-2/makabansa/lessons/10-pangalawang-direksiyon.js',
  'subjects/grade-2/makabansa/lessons/11-mga-taong-naninirahan-sa-komunidad.js',
  'subjects/grade-2/makabansa/lessons/12-mga-institusyong-panlipunan.js',
  'subjects/grade-2/makabansa/lessons/13-gawain-at-tungkulin-ng-mga-bumubuo-sa-ko.js',
  'subjects/grade-2/makabansa/lessons/14-gawain-at-tungkulin-ng-bata-sa-komunidad.js',
  'subjects/grade-2/makabansa/subject.json',
  'subjects/grade-2/makabansa/type-it.js',
  'subjects/grade-2/math/index.html',
  'subjects/grade-2/math/lessons/01-blocks.js',
  'subjects/grade-2/math/lessons/02-readwrite.js',
  'subjects/grade-2/math/lessons/03-skip.js',
  'subjects/grade-2/math/lessons/04-compare.js',
  'subjects/grade-2/math/lessons/05-order.js',
  'subjects/grade-2/math/lessons/06-ordinal.js',
  'subjects/grade-2/math/lessons/07-placevalue.js',
  'subjects/grade-2/math/lessons/08-numberline.js',
  'subjects/grade-2/math/lessons/09-expanded.js',
  'subjects/grade-2/math/lessons/10-addnoregroup.js',
  'subjects/grade-2/math/lessons/11-addregroup.js',
  'subjects/grade-2/math/lessons/12-money.js',
  'subjects/grade-2/math/subject.json',
  'subjects/grade-2/math/type-it.js',
  'subjects/grade-2/science/index.html',
  'subjects/grade-2/science/lessons/01-my-body-parts.js',
  'subjects/grade-2/science/lessons/02-my-five-senses.js',
  'subjects/grade-2/science/lessons/03-what-is-matter.js',
  'subjects/grade-2/science/lessons/04-animals-and-their-babies.js',
  'subjects/grade-2/science/lessons/05-each-animal-has-its-own-home.js',
  'subjects/grade-2/science/lessons/06-how-do-animals-survive.js',
  'subjects/grade-2/science/subject.json',
  'subjects/grade-2/science/type-it.js',
  'subjects/grade-5/araling-panlipunan/index.html',
  'subjects/grade-5/araling-panlipunan/lessons/01-barangay.js',
  'subjects/grade-5/araling-panlipunan/lessons/02-pinuno.js',
  'subjects/grade-5/araling-panlipunan/lessons/03-antas.js',
  'subjects/grade-5/araling-panlipunan/lessons/04-hanapbuhay.js',
  'subjects/grade-5/araling-panlipunan/lessons/05-teknolohiya.js',
  'subjects/grade-5/araling-panlipunan/lessons/06-kalinangan.js',
  'subjects/grade-5/araling-panlipunan/lessons/07-materyal.js',
  'subjects/grade-5/araling-panlipunan/lessons/08-paniniwala.js',
  'subjects/grade-5/araling-panlipunan/lessons/09-babaylan.js',
  'subjects/grade-5/araling-panlipunan/lessons/10-pangitain.js',
  'subjects/grade-5/araling-panlipunan/lessons/11-paglilibing.js',
  'subjects/grade-5/araling-panlipunan/lessons/12-kasal.js',
  'subjects/grade-5/araling-panlipunan/lessons/13-pinagmulan.js',
  'subjects/grade-5/araling-panlipunan/lessons/14-kasaysayan.js',
  'subjects/grade-5/araling-panlipunan/strategy.js',
  'subjects/grade-5/araling-panlipunan/subject.json',
  'subjects/grade-5/araling-panlipunan/type-it.js',
  'subjects/grade-5/english/index.html',
  'subjects/grade-5/english/lessons/01-elements.js',
  'subjects/grade-5/english/lessons/02-plot.js',
  'subjects/grade-5/english/lessons/03-sequence.js',
  'subjects/grade-5/english/lessons/04-spelling.js',
  'subjects/grade-5/english/lessons/05-traits.js',
  'subjects/grade-5/english/lessons/06-conclusions.js',
  'subjects/grade-5/english/lessons/07-figurative.js',
  'subjects/grade-5/english/lessons/08-sound.js',
  'subjects/grade-5/english/lessons/09-predicting.js',
  'subjects/grade-5/english/lessons/10-mainidea.js',
  'subjects/grade-5/english/lessons/11-summary.js',
  'subjects/grade-5/english/lessons/12-outline.js',
  'subjects/grade-5/english/lessons/13-purpose.js',
  'subjects/grade-5/english/lessons/14-tone.js',
  'subjects/grade-5/english/lessons/15-generalize.js',
  'subjects/grade-5/english/lessons/16-connotation.js',
  'subjects/grade-5/english/lessons/17-dictionary.js',
  'subjects/grade-5/english/lessons/18-nouns.js',
  'subjects/grade-5/english/lessons/19-complement.js',
  'subjects/grade-5/english/lessons/20-pronouns.js',
  'subjects/grade-5/english/lessons/21-pronouns2.js',
  'subjects/grade-5/english/lessons/22-factopinion.js',
  'subjects/grade-5/english/lessons/23-visual.js',
  'subjects/grade-5/english/strategy.js',
  'subjects/grade-5/english/subject.json',
  'subjects/grade-5/english/type-it.js',
  'subjects/grade-5/filipino/index.html',
  'subjects/grade-5/filipino/lessons/01-tula.js',
  'subjects/grade-5/filipino/lessons/02-kathangisip.js',
  'subjects/grade-5/filipino/lessons/03-teksto.js',
  'subjects/grade-5/filipino/lessons/04-pokus.js',
  'subjects/grade-5/filipino/lessons/05-pangangkop.js',
  'subjects/grade-5/filipino/strategy.js',
  'subjects/grade-5/filipino/subject.json',
  'subjects/grade-5/filipino/type-it.js',
  'subjects/grade-5/gmrc/index.html',
  'subjects/grade-5/gmrc/lessons/01-myself.js',
  'subjects/grade-5/gmrc/lessons/02-saving.js',
  'subjects/grade-5/gmrc/lessons/03-dignity.js',
  'subjects/grade-5/gmrc/lessons/04-faith.js',
  'subjects/grade-5/gmrc/lessons/05-strengthsave.js',
  'subjects/grade-5/gmrc/lessons/06-dignitywords.js',
  'subjects/grade-5/gmrc/lessons/07-signs.js',
  'subjects/grade-5/gmrc/lessons/08-trafficrules.js',
  'subjects/grade-5/gmrc/lessons/09-manners.js',
  'subjects/grade-5/gmrc/lessons/10-sacred.js',
  'subjects/grade-5/gmrc/lessons/11-gratitude.js',
  'subjects/grade-5/gmrc/lessons/12-ewaste.js',
  'subjects/grade-5/gmrc/lessons/13-devices.js',
  'subjects/grade-5/gmrc/strategy.js',
  'subjects/grade-5/gmrc/subject.json',
  'subjects/grade-5/gmrc/type-it.js',
  'subjects/grade-5/math/cases.js',
  'subjects/grade-5/math/index.html',
  'subjects/grade-5/math/subject.json',
  'subjects/grade-5/math/walkthroughs.js',
  'subjects/grade-5/pe-health/index.html',
  'subjects/grade-5/pe-health/lessons/01-netwall.js',
  'subjects/grade-5/pe-health/lessons/02-abc.js',
  'subjects/grade-5/pe-health/lessons/03-gameon.js',
  'subjects/grade-5/pe-health/lessons/04-kitchen.js',
  'subjects/grade-5/pe-health/lessons/05-stress.js',
  'subjects/grade-5/pe-health/lessons/06-movestress.js',
  'subjects/grade-5/pe-health/lessons/07-stresswords.js',
  'subjects/grade-5/pe-health/strategy.js',
  'subjects/grade-5/pe-health/subject.json',
  'subjects/grade-5/pe-health/type-it.js',
  'subjects/grade-5/science/index.html',
  'subjects/grade-5/science/lessons/01-whatmatter.js',
  'subjects/grade-5/science/lessons/02-matter.js',
  'subjects/grade-5/science/lessons/03-measure.js',
  'subjects/grade-5/science/lessons/04-volume.js',
  'subjects/grade-5/science/lessons/05-changes.js',
  'subjects/grade-5/science/lessons/06-physchem.js',
  'subjects/grade-5/science/lessons/07-scimethod.js',
  'subjects/grade-5/science/lessons/08-investigate.js',
  'subjects/grade-5/science/lessons/09-bacteria.js',
  'subjects/grade-5/science/lessons/10-fungi.js',
  'subjects/grade-5/science/lessons/11-plantgroups.js',
  'subjects/grade-5/science/lessons/12-vertebrates.js',
  'subjects/grade-5/science/lessons/13-invertebrates.js',
  'subjects/grade-5/science/lessons/14-rootsystem.js',
  'subjects/grade-5/science/lessons/15-shootsystem.js',
  'subjects/grade-5/science/lessons/16-specialized.js',
  'subjects/grade-5/science/lessons/17-classify.js',
  'subjects/grade-5/science/lessons/18-adapt.js',
  'subjects/grade-5/science/strategy.js',
  'subjects/grade-5/science/subject.json',
  'subjects/grade-5/science/type-it.js',
  'subjects/grade-5/tle/index.html',
  'subjects/grade-5/tle/lessons/01-furnishing.js',
  'subjects/grade-5/tle/lessons/02-embtools.js',
  'subjects/grade-5/tle/lessons/03-embdesign.js',
  'subjects/grade-5/tle/lessons/04-crochettools.js',
  'subjects/grade-5/tle/lessons/05-crochetstitches.js',
  'subjects/grade-5/tle/lessons/06-embstitches.js',
  'subjects/grade-5/tle/lessons/07-crochetabbr.js',
  'subjects/grade-5/tle/lessons/08-handsewing.js',
  'subjects/grade-5/tle/lessons/09-machinesewing.js',
  'subjects/grade-5/tle/strategy.js',
  'subjects/grade-5/tle/subject.json',
  'subjects/grade-5/tle/type-it.js',
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
    // no-cache: check with the server every time, so an update shows at once instead of after the browser's 10 minutes.
    fetch(request, { cache: 'no-cache' }).then((response) => {
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
