// Offline cache: everything the app needs is precached on install.
// Bump VERSION whenever any file changes so phones pick up the update (CI does it per commit).
// The brain (brain/*, config/brain-files.json) is network-first: fresh when online, the cached
// copy when offline, so brain uploads show up without waiting for an app update.
const VERSION = 'hhp-sim-v1';
const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'config/table-settings.js',
  'brain-compiled/behavior.json',
  'config/outside-source.js',
  'config/brain-files.json',
  'brain/preflop-ranges.csv',
  'brain/playbook-preflop.md',
  'brain/playbook-postflop.md',
  'brain/playbook-postflop-weakness-and-position.md',
  'brain/playbook-postflop-bluffs-and-rivers.md',
  'brain/playbook-villains.md',
  'brain/playbook-villains-oldest-videos.md',
  'brain/playbook-deep-stacks.md',
  'brain/playbook-game-mindset.md',
  'brain/project-instructions.md',
  'js/brain/parse.js',
  'js/brain/loader.js',
  'js/brain/compiled.js',
  'js/villains/model.js',
  'js/engine/policy.js',
  'js/range/tracker.js',
  'js/range/whatif.js',
  'js/predict/predict.js',
  'js/feedback/engine.js',
  'js/feedback/render.js',
  'js/feedback/equity.js',
  'js/feedback/spot.js',
  'js/feedback/match.js',
  'js/feedback/replay.js',
  'js/ui/grid.js',
  'js/app.js',
  'js/vendor/pokersolver.js',
  'js/engine/ai.js',
  'js/engine/cards.js',
  'js/engine/coach.js',
  'js/engine/dealer.js',
  'js/engine/eval.js',
  'js/engine/game.js',
  'js/engine/scenario.js',
  'js/engine/showdown.js',
  'js/engine/strength.js',
  'js/grading/grade.js',
  'js/storage/csv.js',
  'js/storage/history.js',
  'js/ui/sizing.js',
  'js/ui/layout.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const isBrain = (url) => /\/brain(-compiled)?\/[^/]+$/.test(url.pathname) || url.pathname.endsWith('/config/brain-files.json');

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (isBrain(url)) {
    e.respondWith(fetch(e.request, { cache: 'no-cache' }).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(e.request, copy));
      }
      return res.ok ? res : caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || res);
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || Response.error())));
    return;
  }
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match('index.html'))),
  );
});
