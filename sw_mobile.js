// sw_mobile.js - RAM Mobile Service Worker

const CACHE = 'ram-mobile-v2';
const STATIC = [
    '/mobile.html',
    '/mobile.css',
    '/mobile.js',
    '/mobile_manifest.json',
    '/icon192.png',
    '/icon512.png',
];

self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE).then(cache => cache.addAll(STATIC))
    );
    self.skipWaiting();
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', e => {
    const url = new URL(e.request.url);

    // Never cache sync API calls
    if (url.pathname === '/sync' || url.pathname === '/sync/push') {
        e.respondWith(fetch(e.request).catch(() => new Response(JSON.stringify({ error: 'offline' }), { headers: { 'Content-Type': 'application/json' } })));
        return;
    }

    // Cache-first for static assets
    e.respondWith(
        caches.match(e.request).then(cached => cached || fetch(e.request))
    );
});
