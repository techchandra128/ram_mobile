// sw_mobile.js - RAM Mobile Service Worker

const CACHE = 'ram-mobile-v15.9';
const STATIC = [
    '/ram_mobile/mobile.html',
    '/ram_mobile/mobile_core.css',
    '/ram_mobile/mobile_library.css',
    '/ram_mobile/mobile_smartdesk.css',
    '/ram_mobile/mobile_dashboard.css',
    '/ram_mobile/mobile_diary.css',
    '/ram_mobile/mobile_core.js',
    '/ram_mobile/mobile_library.js',
    '/ram_mobile/mobile_smartdesk.js',
    '/ram_mobile/mobile_dashboard.js',
    '/ram_mobile/mobile_diary.js',
    '/ram_mobile/sw_mobile.js',
    '/ram_mobile/mobile_manifest.json',
    '/ram_mobile/icon192.png',
    '/ram_mobile/icon512.png',
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

    // Never cache Supabase API calls
    if (url.hostname.includes('supabase.co')) {
        e.respondWith(fetch(e.request));
        return;
    }

    // Network-first for HTML â€” always get the latest version from server
    if (url.pathname === '/ram_mobile/' || url.pathname === '/ram_mobile/mobile.html') {
        e.respondWith(
            fetch(e.request)
                .then(res => {
                    const copy = res.clone();
                    caches.open(CACHE).then(cache => cache.put(e.request, copy));
                    return res;
                })
                .catch(() => caches.match(e.request))
        );
        return;
    }

    // Cache-first for all other static assets (CSS, JS, images)
    e.respondWith(
        caches.match(e.request).then(cached => cached || fetch(e.request))
    );
});
