// network first (always get the newest build), cache as offline fallback
const CACHE = 'grave-tamer-v4';
const FILES = ['./', './index.html', './game.js', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-180.png',
  ...['mage', 'sk_minion', 'sk_warrior', 'sk_rogue', 'sk_mage', 'anims', 'weapons', 'dungeon', 'graveyard', 'forest', 'gen_props'].map(n => `./assets/${n}.glb`)];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', e => { if (e.request.method !== 'GET') return;
  // revalidate with the server every time (a cheap 304 when nothing changed), so a new build shows up on the next load
  const req = e.request.mode === 'navigate' ? e.request.url : new Request(e.request, { cache: 'no-cache' });
  e.respondWith(fetch(req, e.request.mode === 'navigate' ? { cache: 'no-cache' } : undefined).then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); return r; }).catch(() => caches.match(e.request))); });
