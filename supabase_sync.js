// supabase-sync.js — RAM Cloud Sync Module
// Handles all Supabase read/write with localStorage as cache

const SUPABASE_URL = 'https://jqruimtvezwdkmkqnspl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpxcnVpbXR2ZXp3ZGtta3Fuc3BsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwNzkzMTUsImV4cCI6MjA5NDY1NTMxNX0.m5rrXJYhHfl6tNYI7lkRrkfzPCG2My2T9ktCj23fM2o';

const HEADERS = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Prefer': 'resolution=merge-duplicates'
};

// Global keys that go to global_settings table
const GLOBAL_KEYS = ['ram_theme', 'ram_homepage', 'ram_smartDesk', 'ram_mobile_theme', 'hm_events'];

function getTable(key) {
    return GLOBAL_KEYS.includes(key) ? 'global_settings' : 'sync_data';
}

// ===== PUSH — write one key to Supabase =====
async function ramPush(key, value) {
    try {
        const table = getTable(key);
        let parsed;
        try { parsed = typeof value === 'string' ? JSON.parse(value) : value; }
        catch(e) { parsed = value; } // plain string like "dark"
        const payload = {
            key,
            value: parsed,
            updated_at: new Date().toISOString()
        };
        const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
            method: 'POST',
            headers: { ...HEADERS, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) {
            const err = await res.text();
            console.warn(`[RAM Sync] Push failed for ${key}:`, err);
        }
    } catch (e) {
        console.warn(`[RAM Sync] Push error for ${key}:`, e.message);
    }
}

// ===== PULL — get one key from Supabase =====
async function ramPull(key) {
    try {
        const table = getTable(key);
        const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?key=eq.${encodeURIComponent(key)}&select=key,value,updated_at`, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        if (!res.ok) return null;
        const data = await res.json();
        if (!data || data.length === 0) return null;
        return data[0]; // { key, value, updated_at }
    } catch (e) {
        console.warn(`[RAM Sync] Pull error for ${key}:`, e.message);
        return null;
    }
}

// ===== PULL ALL — get all rows from both tables =====
async function ramPullAll() {
    try {
        const [syncRes, globalRes] = await Promise.all([
            fetch(`${SUPABASE_URL}/rest/v1/sync_data?select=key,value,updated_at`, {
                headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
            }),
            fetch(`${SUPABASE_URL}/rest/v1/global_settings?select=key,value,updated_at`, {
                headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
            })
        ]);
        const syncData = syncRes.ok ? await syncRes.json() : [];
        const globalData = globalRes.ok ? await globalRes.json() : [];
        return [...syncData, ...globalData]; // array of { key, value, updated_at }
    } catch (e) {
        console.warn('[RAM Sync] PullAll error:', e.message);
        return [];
    }
}

// ===== SYNC ON OPEN — pull from Supabase, merge into localStorage =====
// Conflict rule: Supabase wins if its updated_at is newer than local
async function ramSyncOnOpen() {
    console.log('[RAM Sync] Syncing from cloud...');
    const rows = await ramPullAll();
    if (!rows.length) {
        console.log('[RAM Sync] No cloud data yet.');
        return;
    }
    let updated = 0;
    for (const row of rows) {
        const localRaw = localStorage.getItem(row.key);
        const cloudTime = new Date(row.updated_at).getTime();
        // Get local timestamp if stored
        const localTimestampRaw = localStorage.getItem(`__ts_${row.key}`);
        const localTime = localTimestampRaw ? parseInt(localTimestampRaw) : 0;

        if (cloudTime > localTime) {
            // Cloud is newer — update localStorage
            const valueStr = typeof row.value === 'string' ? row.value : JSON.stringify(row.value);
            localStorage.setItem(row.key, valueStr);
            localStorage.setItem(`__ts_${row.key}`, cloudTime.toString());
            updated++;
        }
    }
    console.log(`[RAM Sync] Sync complete. ${updated} keys updated from cloud.`);
    return updated;
}

// ===== PUSH ALL — push all localStorage keys to Supabase (initial migration) =====
async function ramPushAll() {
    const allKeys = [...GLOBAL_KEYS];
    // Also push all file-specific keys
    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && !k.startsWith('__ts_') && !allKeys.includes(k)) {
            allKeys.push(k);
        }
    }
    console.log(`[RAM Sync] Pushing ${allKeys.length} keys to cloud...`);
    for (const key of allKeys) {
        const val = localStorage.getItem(key);
        if (val !== null) {
            await ramPush(key, val);
            localStorage.setItem(`__ts_${key}`, Date.now().toString());
        }
    }
    console.log('[RAM Sync] Full push complete.');
}

// ===== WRAPPED setItem — saves to localStorage + pushes to Supabase =====
function ramSetItem(key, value) {
    localStorage.setItem(key, value);
    localStorage.setItem(`__ts_${key}`, Date.now().toString());
    ramPush(key, value); // async, fire and forget
}

// ===== EXPOSE globally =====
window.RAM_SYNC = {
    push: ramPush,
    pull: ramPull,
    pullAll: ramPullAll,
    syncOnOpen: ramSyncOnOpen,
    pushAll: ramPushAll,
    setItem: ramSetItem
};
