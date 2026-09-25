// Offline cache: everything the app needs is precached on install.
// Bump VERSION whenever any file changes so phones pick up the update.
const VERSION = 'hhp-sim-v1';
const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'data/ranges.json',
  'config/villains.js',
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

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
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
