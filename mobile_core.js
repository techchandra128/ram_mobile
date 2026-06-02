// mobile_core.js — init, state, theme, sync, topbar, bottom nav, back button, utils

// ===== CONFIG =====
const SUPABASE_URL = 'https://jqruimtvezwdkmkqnspl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpxcnVpbXR2ZXp3ZGtta3Fuc3BsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwNzkzMTUsImV4cCI6MjA5NDY1NTMxNX0.m5rrXJYhHfl6tNYI7lkRrkfzPCG2My2T9ktCj23fM2o';
const SB_HEADERS = { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates,return=minimal' };
const GLOBAL_KEYS = ['ram_theme', 'ram_homepage', 'ram_smartDesk', 'ram_mobile_theme', 'hm_events'];

// ===== STATE =====
const mState = {
    syncData: null,
    activePage: 'Library',   // Library | SmartDesk | Diary | Dashboard

    // Library navigation stack: [{screen, title, extra}]
    libStack: [],

    // Shared detail state (used by both Library and SmartDesk)
    currentFileId: null,
    currentFileName: null,
    currentSectionId: null,
    currentSection: null,
    currentContext: 'lib',    // 'lib' | 'sd'

    libSort: 'outline',
    sdSort: 'outline',
    libRootSort: 'name-asc',
    activeDash: 'heatmap',

    theme: localStorage.getItem('ram_mobile_theme') || 'dark',
};

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
    applyTheme(mState.theme);
    bindTopbar();
    bindBottomNav();
    bindBackButton();
    loadSyncData();
    bindLibRootToolbar();
    updateTopbar();
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw_mobile.js').catch(() => {});
    }
    history.pushState({ depth: 0 }, '');
});

// ===== HISTORY / BACK BUTTON =====
function bindBackButton() {
    window.addEventListener('popstate', (e) => {
        const depth = getNavDepth();
        if (depth > 0) {
            history.pushState({ depth: depth - 1 }, '');
            navigateBack();
        } else {
            history.pushState({ depth: 0 }, '');
        }
    });

    document.getElementById('mBackBtn').addEventListener('click', () => {
        navigateBack();
    });
}

function getNavDepth() {
    if (mState.activePage === 'Library') return mState.libStack.length;
    if (mState.activePage === 'SmartDesk') {
        const sd = getSDScreen();
        if (sd === 'screenSDDetail') return 2;
        if (sd === 'screenSDSections') return 1;
        return 0;
    }
    return 0;
}

function navigateBack() {
    if (mState.activePage === 'Library') {
        if (mState.libStack.length > 0) {
            mState.libStack.pop();
            if (mState.libStack.length === 0 && mState.diaryReturn) {
                mState.diaryReturn = false;
                switchPage('Diary');
                return;
            }
            restoreLibStack();
        }
    } else if (mState.activePage === 'SmartDesk') {
        const sd = getSDScreen();
        if (sd === 'screenSDDetail') showSDScreen('screenSDSections');
        else if (sd === 'screenSDSections') showSDScreen('screenSDFiles');
    }
    updateTopbar();
}

// ===== THEME =====
function applyTheme(theme) {
    mState.theme = theme;
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('ram_mobile_theme', theme);
    const icon = document.getElementById('mThemeIcon');
    if (theme === 'dark') {
        icon.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
    } else {
        icon.innerHTML = '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>';
    }
}

// ===== TOPBAR =====
function bindTopbar() {
    document.getElementById('mThemeBtn').addEventListener('click', () => {
        applyTheme(mState.theme === 'dark' ? 'light' : 'dark');
    });
    document.getElementById('mSyncBtn').addEventListener('click', () => {
        loadSyncData(true);
    });
}

function updateTopbar() {
    const backBtn = document.getElementById('mBackBtn');
    const titleEl = document.getElementById('mTopbarTitle');
    const depth = getNavDepth();

    // Show sort button on root, folder, and sections screens
    const libTop = mState.libStack[mState.libStack.length - 1];
    const showLibCtrl = (mState.activePage === 'Library' &&
        (mState.libStack.length === 0 || libTop?.screen === 'screenLibraryFolder' || libTop?.screen === 'screenSections'))
        || (mState.activePage === 'SmartDesk' && getSDScreen() === 'screenSDSections');
    document.querySelectorAll('.m-lib-ctrl').forEach(el => {
        el.style.display = showLibCtrl ? 'flex' : 'none';
    });

    if (depth === 0) {
        backBtn.style.display = 'none';
        if (mState.activePage === 'Library') titleEl.textContent = 'My Library';
        else if (mState.activePage === 'SmartDesk') titleEl.textContent = 'Smart Desk';
        else if (mState.activePage === 'Diary') titleEl.textContent = 'Diary';
        else titleEl.textContent = 'Dashboard';
    } else {
        backBtn.style.display = 'flex';
        if (mState.activePage === 'Library') {
            const top = mState.libStack[mState.libStack.length - 1];
            titleEl.textContent = top?.title || 'RAM';
        } else if (mState.activePage === 'SmartDesk') {
            const sd = getSDScreen();
            if (sd === 'screenSDDetail') titleEl.textContent = mState.currentSection?.title || 'Section';
            else titleEl.textContent = mState.currentFileName || 'Sections';
        }
    }
    const libTopForDetail = mState.libStack[mState.libStack.length - 1];
    const onDetail = (mState.activePage === 'Library' && libTopForDetail?.screen === 'screenDetail')
        || (mState.activePage === 'SmartDesk' && getSDScreen() === 'screenSDDetail');
    document.querySelector('.m-bottom-nav').style.display = onDetail ? 'none' : '';
    const detailFooter = document.getElementById('mDetailFooter');
    if (detailFooter) detailFooter.style.display = onDetail ? 'flex' : 'none';

    window.scrollTo(0, 0);
}

// ===== BOTTOM NAV =====
function bindBottomNav() {
    document.querySelectorAll('.m-nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const page = btn.dataset.page;
            switchPage(page);
        });
    });
}

function switchPage(page) {
    mState.activePage = page;

    document.querySelectorAll('.m-page').forEach(p => p.classList.remove('active'));
    document.getElementById('pag' + page).classList.add('active');

    document.querySelectorAll('.m-nav-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.page === page);
    });

    updateTopbar();

    if (page === 'Dashboard' && !mState.dashInit) {
        mState.dashInit = true;
        renderDashboard('heatmap');
        bindDashTabs();
    }

    if (page === 'SmartDesk' && !mState.sdInit) {
        mState.sdInit = true;
        renderSDFileList();
    }

    if (page === 'Diary') {
        mdDiaryInit();
    }
}

// ===== SYNC =====
async function loadSyncData(manual = false) {
    showSyncBar('Syncing...', 'default');
    try {
        const [syncRes, globalRes] = await Promise.all([
            fetch(`${SUPABASE_URL}/rest/v1/sync_data?select=key,value,updated_at`, { headers: SB_HEADERS }),
            fetch(`${SUPABASE_URL}/rest/v1/global_settings?select=key,value,updated_at`, { headers: SB_HEADERS })
        ]);
        if (!syncRes.ok && !globalRes.ok) throw new Error('Supabase error');
        const syncRows = syncRes.ok ? await syncRes.json() : [];
        const globalRows = globalRes.ok ? await globalRes.json() : [];
        const allRows = [...syncRows, ...globalRows];

        if (!mState.syncData) mState.syncData = {};
        for (const row of allRows) {
            const cloudTime = new Date(row.updated_at).getTime();
            const localTs = parseInt(localStorage.getItem(`__ts_${row.key}`) || '0');
            if (cloudTime > localTs) {
                const valStr = typeof row.value === 'string' ? row.value : JSON.stringify(row.value);
                localStorage.setItem(row.key, valStr);
                localStorage.setItem(`__ts_${row.key}`, cloudTime.toString());
            }
            mState.syncData[row.key] = row.value;
        }

        const fsRow = allRows.find(r => r.key === 'ram_fileSystem');
        mState.syncData.fileSystem = fsRow ? (typeof fsRow.value === 'string' ? fsRow.value : JSON.stringify(fsRow.value)) : localStorage.getItem('ram_fileSystem');
        mState.syncData.files = {};

        hideSyncBarAfter('Synced ✓', 'success', 2000);
        renderLibraryRoot();
        renderSDFileList();
        hideLoading();
    } catch(e) {
        hideSyncBarAfter('Sync failed.', 'error', 3000);
        hideLoading();
        if (!mState.syncData) {
            const cached = localStorage.getItem('ram_fileSystem');
            if (cached) {
                mState.syncData = { fileSystem: cached, files: {} };
                renderLibraryRoot();
                renderSDFileList();
            } else {
                document.getElementById('mLibraryList').innerHTML = '<div class="m-empty">No cached data. Please sync when online.</div>';
            }
        }
    }
}

async function pushToSupabase(key, value) {
    try {
        const table = GLOBAL_KEYS.includes(key) ? 'global_settings' : 'sync_data';
        let parsed; try { parsed = typeof value === 'string' ? JSON.parse(value) : value; } catch(e) { parsed = value; }
        const payload = { key, value: parsed, updated_at: new Date().toISOString() };
        await fetch(`${SUPABASE_URL}/rest/v1/${table}`, { method: 'POST', headers: SB_HEADERS, body: JSON.stringify(payload) });
        localStorage.setItem(`__ts_${key}`, Date.now().toString());
    } catch(e) {
        console.warn('[Mobile Sync] Push failed:', e.message);
    }
}

// ===== SYNC BAR =====
function showSyncBar(msg, type = 'default') {
    const bar = document.getElementById('mSyncBar');
    bar.className = 'm-sync-bar' + (type !== 'default' ? ' ' + type : '');
    document.getElementById('mSyncMsg').textContent = msg;
    bar.style.display = 'flex';
    document.querySelector('.m-content').style.marginTop = 'calc(var(--topbar-h) + var(--syncbar-h))';
}

function hideSyncBarAfter(msg, type, delay) {
    showSyncBar(msg, type);
    setTimeout(() => {
        document.getElementById('mSyncBar').style.display = 'none';
        document.querySelector('.m-content').style.marginTop = '';
    }, delay);
}

// ===== LOADING =====
function hideLoading() {
    document.getElementById('mLoading').classList.add('hidden');
}

// ===== FILE SYSTEM HELPERS =====
function getFileSystem() {
    const fs = mState.syncData?.fileSystem;
    if (!fs) return null;
    try { return typeof fs === 'string' ? JSON.parse(fs) : fs; } catch(e) { return null; }
}

function collectFiles(node, result = []) {
    if (!node || typeof node !== 'object') return result;
    Object.entries(node).forEach(([key, item]) => {
        if (item.type === 'file') result.push({ id: item.fileId, name: key });
        else if (item.type === 'folder' && item.contents) collectFiles(item.contents, result);
    });
    return result;
}

function collectFoldersAndFiles(node) {
    const folders = [];
    const files = [];
    if (!node || typeof node !== 'object') return { folders, files };
    Object.entries(node).forEach(([key, item]) => {
        if (item.type === 'folder') folders.push({ name: key, contents: item.contents || {}, progress: item.progress || 0 });
        else if (item.type === 'file') files.push({ id: item.fileId, name: key, progress: item.progress || 0 });
    });
    return { folders, files };
}

// ===== UTILS =====
function getFileData(fileId) {
    if (!fileId) return {};
    const id = fileId.startsWith('f_') ? fileId : `f_${fileId}`;
    const keys = ['c5_sectionStore', 'c3_data', 'c4_allSectionNotes', 'c4_categories', 'c12_sections'];
    const result = {};
    for (const k of keys) {
        const fullKey = `${k}_${id}`;
        const local = localStorage.getItem(fullKey);
        if (local) { result[k] = local; }
        else if (mState.syncData?.[fullKey]) {
            const v = mState.syncData[fullKey];
            result[k] = typeof v === 'string' ? v : JSON.stringify(v);
        }
    }
    return result;
}

function isStudiedToday(c5) {
    if (!c5?.revisions) return false;
    const today = new Date();
    const todayStr = `${String(today.getDate()).padStart(2,'0')}/${String(today.getMonth()+1).padStart(2,'0')}`;
    const todayYear = today.getFullYear();
    return c5.revisions.some(r => r.date === todayStr && r.year === todayYear);
}

function escHtml(text) {
    if (!text) return '';
    return String(text).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function formatTs(note) {
    const ref = note.updatedAt ? new Date(note.updatedAt) : new Date(note.createdAt);
    const diff = Math.floor((Date.now() - ref) / 86400000);
    if (diff === 0) return 'Today';
    if (diff < 30) return `${diff} day${diff===1?'':'s'} ago`;
    return ref.toLocaleDateString();
}
