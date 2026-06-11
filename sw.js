const CACHE = 'ram-v15.19';

const FILES = [
    '/',
    'index.html',
    'theme.css',
    'supabase_sync.js',
    'fileview.html',
    'preview.html',
    'settings.html',
    'settings.css',
    'settings.js',
    'allfiles.js',
    'allsections.css',
    'allsections.js',
    'campaign.css',
    'campaign.js',
    'column1-2.css',
    'column1-2.js',
    'column3.css',
    'column3.js',
    'column4.css',
    'column4.js',
    'column5.css',
    'column5.js',
    'diary.css',
    'diary.js',
    'editor.css',
    'editor.js',
    'fflate.js',
    'graphs.css',
    'graphs.js',
    'heatmap.css',
    'heatmap.js',
    'playlist.css',
    'playlist.js',
    'series_modal.css',
    'series_modal.js',
    'smart_desk.css',
    'smart_desk.js',
    'uploaddocx.js',
    'uploadpdf.css',
    'uploadpdf.js',
    'uploadtext.js',
    'uploadtextcontent.js',
    'libs/lucide.min.js',
    'libs/mammoth.browser.min.js',
    'libs/pdf.min.js',
    'libs/pdf.worker.min.js',
    'icon192.png',
    'icon512.png',
    'manifest.json'
];

// Install â€” download and cache all files
self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE).then(cache => cache.addAll(FILES))
    );
    self.skipWaiting();
});

// Activate â€” delete any old caches from previous versions
self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// Fetch â€” serve from cache instantly, update cache in background
self.addEventListener('fetch', e => {
    if (e.request.method !== 'GET') return;

    const url = new URL(e.request.url);

    // Don't cache Supabase API calls â€” always fetch live
    if (url.hostname.includes('supabase.co')) return;

    e.respondWith(
        caches.open(CACHE).then(cache =>
            cache.match(e.request).then(cached => {
                const network = fetch(e.request).then(res => {
                    if (res.ok) cache.put(e.request, res.clone());
                    return res;
                }).catch(() => cached);

                // Serve cache immediately, update in background
                return cached || network;
            })
        )
    );
});
