const V = 'sirena-v6';

const SHELL = [
  './',
  'index.html',
  'manifest.json',
  'css/styles.css',
  'js/main.js',
  'js/charts.js',
  'js/db-config.js',
  //'assets/data/exercise.txt',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'assets/images/fondo.jpg',
  'assets/images/fondo-vertical.jpg',
  'assets/images/fondo-bg.jpg'
];

self.addEventListener('install', e => e.waitUntil(
  caches.open(V)
    .then(c => Promise.all(SHELL.map(url => c.add(new Request(url, { cache: 'reload' })).catch(() => console.warn('No cacheado:', url)))))
    .then(() => self.skipWaiting())
));

self.addEventListener('activate', e => e.waitUntil(
  caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== V).map(k => caches.delete(k))))
    .then(() => clients.claim())
));

self.addEventListener('fetch', e => {
  const r = e.request;
  const u = new URL(r.url);
  const ok = u.origin === location.origin || /(jsdelivr\.net|gstatic\.com)$/.test(u.hostname);
  if (r.method !== 'GET' || !ok) return; // Firestore/Auth gestionan su propia caché

  // stale-while-revalidate
  e.respondWith((async () => {
    const cache = await caches.open(V);
    const hit = await cache.match(r, { ignoreSearch: r.mode === 'navigate' });
    const net = fetch(r)
      .then(res => {
        if (res.ok || res.type === 'opaque') cache.put(r, res.clone());
        return res;
      })
      .catch(() => null);

    if (hit) { e.waitUntil(net); return hit; }
    return (await net)
      || (r.mode === 'navigate' ? await cache.match('index.html') : null)
      || Response.error();
  })());
});