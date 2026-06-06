// mobile.js - RAM Mobile PWA

// ===== CONFIG =====
const SUPABASE_URL = 'https://jqruimtvezwdkmkqnspl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpxcnVpbXR2ZXp3ZGtta3Fuc3BsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwNzkzMTUsImV4cCI6MjA5NDY1NTMxNX0.m5rrXJYhHfl6tNYI7lkRrkfzPCG2My2T9ktCj23fM2o';
const SB_HEADERS = { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates,return=minimal' };
const GLOBAL_KEYS = ['ram_theme', 'ram_homepage', 'ram_smartDesk', 'ram_mobile_theme', 'hm_events'];

// ===== STATE =====
const mState = {
    syncData: null,
    activePage: 'Library',   // Library | SmartDesk | Dashboard

    // Library navigation stack: [{screen, title, extra}]
    libStack: [],

    // Shared detail state (used by both Library and SmartDesk)
    currentFileId: null,
    currentFileName: null,
    currentSectionId: null,
    currentSection: null,
    currentContext: 'lib',    // 'lib' | 'sd'

    libSort: 'default',
    sdSort: 'default',
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
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw_mobile.js').catch(() => {});
    }
    // Push initial history state so back button works
    history.pushState({ depth: 0 }, '');
});

// ===== HISTORY / BACK BUTTON =====
function bindBackButton() {
    window.addEventListener('popstate', (e) => {
        // If we are drilled in, go back within app and push state again
        const depth = getNavDepth();
        if (depth > 0) {
            history.pushState({ depth: depth - 1 }, '');
            navigateBack();
        } else {
            // At root — push state again so next back doesn't close app
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

    if (depth === 0) {
        backBtn.style.display = 'none';
        if (mState.activePage === 'Library') titleEl.textContent = 'My Library';
        else if (mState.activePage === 'SmartDesk') titleEl.textContent = 'Smart Desk';
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

    // Show/hide pages
    document.querySelectorAll('.m-page').forEach(p => p.classList.remove('active'));
    document.getElementById('pag' + page).classList.add('active');

    // Update nav btns
    document.querySelectorAll('.m-nav-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.page === page);
    });

    updateTopbar();

    // Init dashboard on first switch
    if (page === 'Dashboard' && !mState.dashInit) {
        mState.dashInit = true;
        renderDashboard('heatmap');
        bindDashTabs();
    }

    // Init SmartDesk on first switch
    if (page === 'SmartDesk' && !mState.sdInit) {
        mState.sdInit = true;
        renderSDFileList();
        bindSDSort();
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

        hideSyncBarAfter('Synced \u2713', 'success', 2000);
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
        if (item.type === 'folder') folders.push({ name: key, contents: item.contents || {} });
        else if (item.type === 'file') files.push({ id: item.fileId, name: key });
    });
    return { folders, files };
}

// ===== LIBRARY: ROOT =====
function renderLibraryRoot() {
    const container = document.getElementById('mLibraryList');
    const fs = getFileSystem();
    if (!fs) { container.innerHTML = '<div class="m-empty">No files found.</div>'; return; }

    const { folders, files } = collectFoldersAndFiles(fs);
    container.innerHTML = '';

    if (folders.length === 0 && files.length === 0) {
        container.innerHTML = '<div class="m-empty">No files yet. Create one in desktop app.</div>';
        return;
    }

    folders.forEach(folder => {
        const card = document.createElement('div');
        card.className = 'm-file-card m-folder-card';
        card.innerHTML = `
            <div class="m-file-icon">📁</div>
            <div class="m-file-info">
                <div class="m-file-name">${escHtml(folder.name)}</div>
                <div class="m-file-meta">${Object.keys(folder.contents).filter(k => folder.contents[k].type === 'file').length} files</div>
            </div>
            <div class="m-file-arrow"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg></div>
        `;
        card.addEventListener('click', () => {
            pushLibStack({ screen: 'screenLibraryFolder', title: folder.name, folder });
            renderFolderFiles(folder.name, folder.contents);
        });
        container.appendChild(card);
    });

    files.forEach(file => {
        container.appendChild(makeFileCard(file, 'lib'));
    });
}

// ===== LIBRARY: FOLDER FILES =====
function renderFolderFiles(folderName, contents) {
    const container = document.getElementById('mFolderFileList');
    container.innerHTML = '';
    const { files } = collectFoldersAndFiles(contents);
    if (files.length === 0) {
        container.innerHTML = '<div class="m-empty">No files in this folder.</div>';
        return;
    }
    files.forEach(file => container.appendChild(makeFileCard(file, 'lib')));
    showLibScreen('screenLibraryFolder');
}

// ===== LIBRARY STACK =====
function pushLibStack(entry) {
    mState.libStack.push(entry);
    updateTopbar();
}

function restoreLibStack() {
    if (mState.libStack.length === 0) {
        showLibScreen('screenLibraryRoot');
        updateTopbar();
        return;
    }
    const top = mState.libStack[mState.libStack.length - 1];
    showLibScreen(top.screen);
    updateTopbar();
}

function showLibScreen(screenId) {
    document.querySelectorAll('#pagLibrary .m-screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

// ===== SMART DESK =====
function getSDScreen() {
    let active = 'screenSDFiles';
    document.querySelectorAll('#pagSmartDesk .m-screen').forEach(s => {
        if (s.classList.contains('active')) active = s.id;
    });
    return active;
}

function showSDScreen(screenId) {
    document.querySelectorAll('#pagSmartDesk .m-screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

function renderSDFileList() {
    const container = document.getElementById('mSDFileList');
    const fs = getFileSystem();
    if (!fs) { container.innerHTML = '<div class="m-empty">No files found.</div>'; return; }
    const files = collectFiles(fs);
    if (files.length === 0) { container.innerHTML = '<div class="m-empty">No files yet.</div>'; return; }
    container.innerHTML = '';
    files.forEach(file => container.appendChild(makeFileCard(file, 'sd')));
}

function bindSDSort() {
    document.getElementById('mSDSortSelect').addEventListener('change', (e) => {
        mState.sdSort = e.target.value;
        const sections = mState._sdSections;
        const c5Store = mState._sdC5Store;
        if (sections && c5Store) {
            renderSectionItems(document.getElementById('mSDSectionList'), sections, c5Store, mState.sdSort, 'sd');
        }
    });
}

// ===== MAKE FILE CARD =====
function makeFileCard(file, context) {
    const fileData = getFileData(file.id);
    const sections = fileData?.c12_sections ? JSON.parse(fileData.c12_sections) : [];
    const sectionCount = sections.filter(s => s.type === 'real').length;

    const card = document.createElement('div');
    card.className = 'm-file-card';
    card.innerHTML = `
        <div class="m-file-icon">📖</div>
        <div class="m-file-info">
            <div class="m-file-name">${escHtml(file.name)}</div>
            <div class="m-file-meta">${sectionCount} section${sectionCount !== 1 ? 's' : ''}</div>
        </div>
        <div class="m-file-arrow"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg></div>
    `;
    card.addEventListener('click', () => {
        mState.currentFileId = file.id;
        mState.currentFileName = file.name;
        mState.currentContext = context;
        if (context === 'lib') {
            pushLibStack({ screen: 'screenSections', title: file.name });
            renderSectionList('lib');
            showLibScreen('screenSections');
            bindLibSort();
        } else {
            renderSectionList('sd');
            showSDScreen('screenSDSections');
            updateTopbar();
        }
    });
    return card;
}

// ===== SECTION LIST =====
function renderSectionList(context) {
    const listId = context === 'lib' ? 'mSectionList' : 'mSDSectionList';
    const container = document.getElementById(listId);
    const fileData = getFileData(mState.currentFileId);

    const sections = fileData?.c12_sections ? JSON.parse(fileData.c12_sections) : [];
    const c5Store = fileData?.c5_sectionStore ? JSON.parse(fileData.c5_sectionStore) : {};

    // Cache for sort re-use
    if (context === 'sd') { mState._sdSections = sections; mState._sdC5Store = c5Store; }

    container.innerHTML = '';

    // Navigation row
    const navItem = document.createElement('div');
    navItem.className = 'm-section-item';
    navItem.innerHTML = `
        <div class="m-sec-left"><span class="m-section-num">NAV</span></div>
        <div class="m-sec-right">
            <div class="m-section-title">Table of Contents</div>
        </div>
        <div class="m-file-arrow"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg></div>
    `;
    navItem.addEventListener('click', () => openSection('navigation', 'Table of Contents', context));
    container.appendChild(navItem);

    const sort = context === 'lib' ? mState.libSort : mState.sdSort;
    renderSectionItems(container, sections, c5Store, sort, context);
}

function renderSectionItems(container, sections, c5Store, sort, context) {
    // Remove existing section items (keep nav row)
    Array.from(container.querySelectorAll('.m-section-item:not(:first-child)')).forEach(el => el.remove());

    const realSections = sections.filter(s => s.type === 'real');
    if (realSections.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'm-empty';
        empty.textContent = 'No sections yet.';
        container.appendChild(empty);
        return;
    }

    const sorted = sortSections(realSections, c5Store, sort);

    sorted.forEach(section => {
        const c5 = c5Store[section.id];
        const item = document.createElement('div');
        item.className = 'm-section-item';

        const badges = [];
        if (c5?.isCompleted) badges.push('<span class="m-badge completed">✓</span>');
        if (c5 && isStudiedToday(c5)) badges.push('<span class="m-badge studied">Today</span>');

        item.innerHTML = `
            <div class="m-sec-left">
                <span class="m-section-num">${escHtml(section.number || '')}</span>
            </div>
            <div class="m-sec-right">
                <div class="m-section-title">${escHtml(section.title)}</div>
                ${badges.length ? `<div class="m-section-badges">${badges.join('')}</div>` : ''}
            </div>
            <div class="m-file-arrow"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg></div>
        `;
        item.addEventListener('click', () => openSection(section.id, section.title, context));
        container.appendChild(item);
    });
}

function sortSections(sections, c5Store, sort) {
    const arr = [...sections];
    switch(sort) {
        case 'alpha-asc': return arr.sort((a, b) => a.title.localeCompare(b.title));
        case 'alpha-desc': return arr.sort((a, b) => b.title.localeCompare(a.title));
        case 'studied-first': return arr.sort((a, b) => {
            const aS = c5Store[a.id] && isStudiedToday(c5Store[a.id]) ? 1 : 0;
            const bS = c5Store[b.id] && isStudiedToday(c5Store[b.id]) ? 1 : 0;
            return bS - aS;
        });
        case 'unstudied-first': return arr.sort((a, b) => {
            const aS = c5Store[a.id] && isStudiedToday(c5Store[a.id]) ? 1 : 0;
            const bS = c5Store[b.id] && isStudiedToday(c5Store[b.id]) ? 1 : 0;
            return aS - bS;
        });
        case 'completed-first': return arr.sort((a, b) => {
            return (c5Store[b.id]?.isCompleted ? 1 : 0) - (c5Store[a.id]?.isCompleted ? 1 : 0);
        });
        case 'incomplete-first': return arr.sort((a, b) => {
            return (c5Store[a.id]?.isCompleted ? 1 : 0) - (c5Store[b.id]?.isCompleted ? 1 : 0);
        });
        case 'proficiency-high': return arr.sort((a, b) => {
            return (c5Store[b.id]?.proficiency || 0) - (c5Store[a.id]?.proficiency || 0);
        });
        case 'proficiency-low': return arr.sort((a, b) => {
            return (c5Store[a.id]?.proficiency || 0) - (c5Store[b.id]?.proficiency || 0);
        });
        default: return arr;
    }
}

function bindLibSort() {
    const sel = document.getElementById('mSortSelect');
    sel.value = mState.libSort;
    sel.onchange = (e) => {
        mState.libSort = e.target.value;
        renderSectionList('lib');
    };
}

// ===== OPEN SECTION =====
function openSection(sectionId, title, context) {
    mState.currentSectionId = sectionId;
    mState.currentSection = { id: sectionId, title };
    mState.currentContext = context;

    if (context === 'lib') {
        pushLibStack({ screen: 'screenDetail', title });
        showLibScreen('screenDetail');
        bindTabBar('mTabBar', 'mTabContent');
        renderDetailTab('notes', 'mTabContent');
    } else {
        showSDScreen('screenSDDetail');
        updateTopbar();
        bindTabBar('mSDTabBar', 'mSDTabContent');
        renderDetailTab('notes', 'mSDTabContent');
    }
}

// ===== TAB BAR =====
function bindTabBar(barId, contentId) {
    const tabs = document.querySelectorAll(`#${barId} .m-tab`);
    tabs.forEach(tab => {
        tab.onclick = () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            renderDetailTab(tab.dataset.tab, contentId);
        };
    });
    tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === 'notes'));
}

function renderDetailTab(tab, contentId) {
    const content = document.getElementById(contentId);
    content.innerHTML = '';
    if (tab === 'notes') renderNotesTab(content);
    else if (tab === 'c5') renderC5Tab(content);
    else if (tab === 'c4') renderC4Tab(content);
}

// ===== NOTES TAB =====
function renderNotesTab(container) {
    const fileData = getFileData(mState.currentFileId);
    const c3Data = fileData?.c3_data ? JSON.parse(fileData.c3_data) : {};
    const sectionData = c3Data[mState.currentSectionId] || c3Data[String(mState.currentSectionId)] || c3Data[Number(mState.currentSectionId)];

    const c5Store = fileData?.c5_sectionStore ? JSON.parse(fileData.c5_sectionStore) : {};
    const c5 = c5Store[mState.currentSectionId];
    const studiedToday = c5 && isStudiedToday(c5);

    const LEVELS = [
        { id: 'crisp',       label: 'Crisp',       icon: '⚡', sub: 'Key points only' },
        { id: 'conceptual',  label: 'Conceptual',  icon: '💡', sub: 'Core concepts' },
        { id: 'detailed',    label: 'Detailed',    icon: '📚', sub: 'In depth' },
        { id: 'syntopical',  label: 'Syntopical',  icon: '🔗', sub: 'Cross-linked' },
    ];

    // ---- Notes selector dropdowns ----
    const notesWithContent = LEVELS.filter(l => {
        const ld = sectionData?.notes?.[l.id];
        return ld?.versions?.length;
    });

    if (notesWithContent.length > 0) {
        const controls = document.createElement('div');
        controls.className = 'm-notes-controls';

        // Note type dropdown (which level)
        const levelSelect = document.createElement('select');
        levelSelect.className = 'm-notes-select';
        levelSelect.id = 'mNoteLevelSelect';
        notesWithContent.forEach(l => {
            const opt = document.createElement('option');
            opt.value = l.id;
            opt.textContent = l.icon + ' ' + l.label;
            levelSelect.appendChild(opt);
        });

        // Version dropdown
        const versionSelect = document.createElement('select');
        versionSelect.className = 'm-notes-select';
        versionSelect.id = 'mNoteVersionSelect';

        controls.appendChild(levelSelect);
        controls.appendChild(versionSelect);
        container.appendChild(controls);

        // Note content area
        const noteContentArea = document.createElement('div');
        noteContentArea.className = 'm-notes-content';
        noteContentArea.id = 'mNoteContentArea';
        container.appendChild(noteContentArea);

        function populateVersions(levelId) {
            const ld = sectionData.notes[levelId];
            versionSelect.innerHTML = '';
            ld.versions.forEach((v, i) => {
                const opt = document.createElement('option');
                opt.value = i;
                opt.textContent = v.label || `Version ${i + 1}`;
                if (i === ld.currentVersion) opt.selected = true;
                versionSelect.appendChild(opt);
            });
            showNoteContent(levelId, ld.currentVersion || 0);
        }

        function showNoteContent(levelId, versionIdx) {
            const ld = sectionData.notes[levelId];
            const version = ld?.versions?.[versionIdx];
            noteContentArea.innerHTML = version ? renderNoteContent(version) : '<div class="m-notes-empty">No content.</div>';
        }

        levelSelect.addEventListener('change', () => {
            populateVersions(levelSelect.value);
        });
        versionSelect.addEventListener('change', () => {
            showNoteContent(levelSelect.value, parseInt(versionSelect.value));
        });

        populateVersions(notesWithContent[0].id);
    } else {
        const empty = document.createElement('div');
        empty.className = 'm-empty';
        empty.textContent = 'No notes yet.';
        container.appendChild(empty);
    }

    // ---- Get sections for prev/next ----
    const allSectionsData = getFileData(mState.currentFileId);
    const allSections = allSectionsData?.c12_sections ? JSON.parse(allSectionsData.c12_sections).filter(s => s.type === 'real') : [];
    const currentIdx = allSections.findIndex(s => String(s.id) === String(mState.currentSectionId));

    // ---- Bottom bar: Prev | Mark as Studied | Next ----
    const bottomBar = document.createElement('div');
    bottomBar.className = 'm-notes-bottom';

    const prevBtn = document.createElement('button');
    prevBtn.className = 'm-prev-next-btn';
    prevBtn.innerHTML = '&#8592; Prev';
    prevBtn.disabled = currentIdx <= 0;
    prevBtn.addEventListener('click', () => {
        if (currentIdx > 0) {
            const prev = allSections[currentIdx - 1];
            mState.currentSectionId = prev.id;
            mState.currentSection = { id: prev.id, title: prev.title };
            if (mState.currentContext === 'lib') {
                mState.libStack[mState.libStack.length - 1].title = prev.title;
                updateTopbar();
                renderDetailTab('notes', 'mTabContent');
            } else {
                updateTopbar();
                renderDetailTab('notes', 'mSDTabContent');
            }
        }
    });

    const studiedBtn = document.createElement('button');
    studiedBtn.className = 'm-studied-btn' + (studiedToday ? ' studied' : '');
    studiedBtn.textContent = studiedToday ? '✓ Studied' : 'Mark Studied';
    studiedBtn.addEventListener('click', () => markAsStudied());

    const nextBtn = document.createElement('button');
    nextBtn.className = 'm-prev-next-btn';
    nextBtn.innerHTML = 'Next &#8594;';
    nextBtn.disabled = currentIdx >= allSections.length - 1;
    nextBtn.addEventListener('click', () => {
        if (currentIdx < allSections.length - 1) {
            const next = allSections[currentIdx + 1];
            mState.currentSectionId = next.id;
            mState.currentSection = { id: next.id, title: next.title };
            if (mState.currentContext === 'lib') {
                mState.libStack[mState.libStack.length - 1].title = next.title;
                updateTopbar();
                renderDetailTab('notes', 'mTabContent');
            } else {
                updateTopbar();
                renderDetailTab('notes', 'mSDTabContent');
            }
        }
    });

    bottomBar.appendChild(prevBtn);
    bottomBar.appendChild(studiedBtn);
    bottomBar.appendChild(nextBtn);
    container.appendChild(bottomBar);
}

function renderNoteContent(version) {
    if (!version) return '';
    if (version.template === 'plain' && version.html) {
        const html = version.html;
        if (html.includes('<table')) {
            try {
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                const tables = Array.from(doc.querySelectorAll('table'));
                if (tables.length) return tables.map(table => renderTableElement(table)).join('');
            } catch(e) {}
        }
        return `<p>${escHtml(stripHtml(html))}</p>`;
    }
    if (!version?.cells) return `<p>${escHtml(version?.content || '')}</p>`;
    return version.cells.map(cell => {
        const type = cell.type;
        const rows = cell.rows || [];
        if (type === 'header') {
            return `<div class="m-note-header">${escHtml(rows[0]?.content || '')}</div>`;
        }
        if (type === 'code') {
            return `<pre class="m-note-code">${rows.map(r => escHtml(r.content || '')).join('\n')}</pre>`;
        }
        if (type === 'cornell' || type === 'header-cornell') {
            return rows.map(r => {
                const left = stripHtml(r.left || '');
                const right = stripHtml(r.right || '');
                if (!left && !right) return '';
                if (type === 'header-cornell') {
                    return `<div class="m-note-hcornell"><span class="m-note-hcornell-left">${escHtml(left)}</span><span class="m-note-hcornell-right">${escHtml(right)}</span></div>`;
                }
                return `<div class="m-note-cornell"><div class="m-note-cornell-left">${escHtml(left)}</div><div class="m-note-cornell-right">${escHtml(right)}</div></div>`;
            }).filter(Boolean).join('');
        }
        if (type === 'normal') {
            return rows.map(r => {
                const content = r.content || '';
                if (content.includes('<table')) return renderTableFromHtml(content);
                const text = stripHtml(content);
                return text ? `<p>${escHtml(text)}</p>` : '';
            }).filter(Boolean).join('');
        }
        return '';
    }).join('');
}

function stripHtml(html) {
    if (!html) return '';
    return html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<\/li>/gi, '\n')
        .replace(/<li>/gi, '• ')
        .replace(/<[^>]+>/g, '')
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function renderTableElement(table) {
    const rows = Array.from(table.querySelectorAll('tr'));
    if (!rows.length) return '';
    let out = '<div class="m-note-table">';
    rows.forEach((tr, i) => {
        const cells = Array.from(tr.querySelectorAll('td, th'));
        out += `<div class="m-note-table-row${i === 0 ? ' header' : ''}">`;
        cells.forEach(cell => { out += `<div class="m-note-table-cell">${escHtml(stripHtml(cell.innerHTML))}</div>`; });
        out += '</div>';
    });
    return out + '</div>';
}

function renderTableFromHtml(html) {
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const table = doc.querySelector('table');
        if (!table) return `<p>${escHtml(stripHtml(html))}</p>`;
        return renderTableElement(table);
    } catch(e) { return `<p>${escHtml(stripHtml(html))}</p>`; }
}

// ===== MARK AS STUDIED =====
async function markAsStudied() {
    const fileData = getFileData(mState.currentFileId);
    if (!fileData) return;
    const c5Store = fileData.c5_sectionStore ? JSON.parse(fileData.c5_sectionStore) : {};
    const sectionId = mState.currentSectionId;
    if (!c5Store[sectionId]) {
        c5Store[sectionId] = {
            isCompleted: false, difficulty: 'Easy', priority: 'Low',
            revisions: Array(12).fill(null).map(() => ({ date: null, year: null })),
            totalSlots: 12, activatedCount: 4, page: 0
        };
    }
    const c5 = c5Store[sectionId];
    const today = new Date();
    const dateStr = `${String(today.getDate()).padStart(2,'0')}/${String(today.getMonth()+1).padStart(2,'0')}`;
    const year = today.getFullYear();
    const alreadyStudied = c5.revisions.some(r => r.date === dateStr && r.year === year);
    if (alreadyStudied) {
        hideSyncBarAfter('Already studied today', 'success', 2000);
        return;
    }
    let filled = false;
    for (let i = 0; i < c5.activatedCount; i++) {
        if (!c5.revisions[i].date) { c5.revisions[i] = { date: dateStr, year }; filled = true; break; }
    }
    if (!filled) { hideSyncBarAfter('All revision slots filled', 'error', 2000); return; }
    showSyncBar('Saving...', 'default');
    const c5Key = `c5_sectionStore_${mState.currentFileId}`;
    localStorage.setItem(c5Key, JSON.stringify(c5Store));
    localStorage.setItem(`__ts_${c5Key}`, Date.now().toString());
    await pushToSupabase(c5Key, JSON.stringify(c5Store));
    hideSyncBarAfter('Saved \u2713', 'success', 2000);
    const contentId = mState.currentContext === 'lib' ? 'mTabContent' : 'mSDTabContent';
    renderDetailTab('notes', contentId);
}

// ===== C5 TAB =====
function renderC5Tab(container) {
    const fileData = getFileData(mState.currentFileId);
    const c5Store = fileData?.c5_sectionStore ? JSON.parse(fileData.c5_sectionStore) : {};
    const c5 = c5Store[mState.currentSectionId];
    if (!c5) { container.innerHTML = '<div class="m-empty">No progress data yet.</div>'; return; }

    const card = document.createElement('div');
    card.className = 'm-c5-card';
    card.innerHTML = `
        <div class="m-c5-row">
            <span class="m-c5-label">Status</span>
            <span class="m-c5-value" style="color:${c5.isCompleted ? 'var(--success)' : 'var(--text-muted)'}">
                ${c5.isCompleted ? '✓ Completed' : 'In Progress'}
            </span>
        </div>
        <div class="m-c5-row">
            <span class="m-c5-label">Difficulty</span>
            <select class="m-c5-select" id="mDiffSelect">
                ${['Easy','Moderate','Challenging','Hard'].map(d => `<option value="${d}" ${c5.difficulty===d?'selected':''}>${d}</option>`).join('')}
            </select>
        </div>
        <div class="m-c5-row">
            <span class="m-c5-label">Priority</span>
            <select class="m-c5-select" id="mPrioSelect">
                ${['Low','Medium','High','Critical'].map(p => `<option value="${p}" ${c5.priority===p?'selected':''}>${p}</option>`).join('')}
            </select>
        </div>
        <div class="m-c5-row">
            <span class="m-c5-label">Revisions</span>
            <span class="m-c5-value">${c5.revisions.filter(r=>r.date).length} / ${c5.activatedCount}</span>
        </div>
    `;
    container.appendChild(card);

    const gridTitle = document.createElement('div');
    gridTitle.style.cssText = 'font-size:13px;font-weight:600;color:var(--text-muted);margin:12px 0 8px;padding:0 2px';
    gridTitle.textContent = 'Revision Slots';
    container.appendChild(gridTitle);

    const grid = document.createElement('div');
    grid.className = 'm-revision-grid';
    for (let i = 0; i < c5.totalSlots; i++) {
        const slot = document.createElement('div');
        const rev = c5.revisions[i];
        const isActive = i < c5.activatedCount;
        const isFilled = rev?.date;
        slot.className = 'm-rev-slot' + (isFilled ? ' filled' : '') + (!isActive ? ' inactive' : '');
        slot.innerHTML = `<div class="m-rev-slot-num">#${i+1}</div><div class="m-rev-slot-date">${isFilled ? rev.date : (isActive ? '\u2014' : '\u00b7')}</div>`;
        grid.appendChild(slot);
    }
    container.appendChild(grid);

    const btns = document.createElement('div');
    btns.className = 'm-c5-btns';
    btns.innerHTML = `
        <button class="m-c5-btn primary" id="mMarkCompleteBtn">${c5.isCompleted ? 'Unmark' : 'Complete'}</button>
        <button class="m-c5-btn" id="mActivateMoreBtn">+4 Slots</button>
        <button class="m-c5-btn danger" id="mResetBtn">Reset</button>
    `;
    container.appendChild(btns);

    document.getElementById('mDiffSelect').addEventListener('change', async (e) => { c5.difficulty = e.target.value; await saveC5(c5Store); });
    document.getElementById('mPrioSelect').addEventListener('change', async (e) => { c5.priority = e.target.value; await saveC5(c5Store); });
    document.getElementById('mMarkCompleteBtn').addEventListener('click', async () => {
        c5.isCompleted = !c5.isCompleted;
        await saveC5(c5Store);
        const contentId = mState.currentContext === 'lib' ? 'mTabContent' : 'mSDTabContent';
        renderDetailTab('c5', contentId);
    });
    document.getElementById('mActivateMoreBtn').addEventListener('click', async () => {
        if (c5.activatedCount < c5.totalSlots) { c5.activatedCount = Math.min(c5.activatedCount + 4, c5.totalSlots); await saveC5(c5Store); const contentId = mState.currentContext === 'lib' ? 'mTabContent' : 'mSDTabContent'; renderDetailTab('c5', contentId); }
    });
    document.getElementById('mResetBtn').addEventListener('click', async () => {
        if (!confirm('Reset revision data?')) return;
        c5.revisions = Array(12).fill(null).map(() => ({ date: null, year: null }));
        c5.activatedCount = 4; c5.isCompleted = false;
        await saveC5(c5Store);
        const contentId = mState.currentContext === 'lib' ? 'mTabContent' : 'mSDTabContent';
        renderDetailTab('c5', contentId);
    });
}

async function saveC5(c5Store) {
    showSyncBar('Saving...', 'default');
    const c5Key = `c5_sectionStore_${mState.currentFileId}`;
    localStorage.setItem(c5Key, JSON.stringify(c5Store));
    localStorage.setItem(`__ts_${c5Key}`, Date.now().toString());
    await pushToSupabase(c5Key, JSON.stringify(c5Store));
    hideSyncBarAfter('Saved \u2713', 'success', 2000);
}

// ===== C4 TAB =====
function renderC4Tab(container) {
    const fileData = getFileData(mState.currentFileId);
    const allNotes = fileData?.c4_allSectionNotes ? JSON.parse(fileData.c4_allSectionNotes) : {};
    const notes = allNotes[mState.currentSectionId] || [];

    const addBtn = document.createElement('button');
    addBtn.className = 'm-add-note-btn';
    addBtn.textContent = '+ Add Note';
    addBtn.addEventListener('click', () => openAddNoteModal());
    container.appendChild(addBtn);

    if (notes.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'm-empty';
        empty.textContent = 'No notes yet.';
        container.appendChild(empty);
    } else {
        const starred = notes.filter(n => n.starred);
        const unchecked = notes.filter(n => !n.starred && !n.checked);
        const checked = notes.filter(n => !n.starred && n.checked);
        [...starred, ...unchecked, ...checked].forEach(note => {
            const card = document.createElement('div');
            card.className = 'm-c4-note';
            card.innerHTML = `
                <div class="m-c4-note-header">
                    <span class="m-c4-note-cat">${escHtml(note.category)}</span>
                    <div class="m-c4-note-actions">
                        ${note.starred ? '<span class="m-c4-starred">★</span>' : ''}
                        <input type="checkbox" class="m-c4-check" ${note.checked ? 'checked' : ''} data-id="${note.id}">
                    </div>
                </div>
                <div class="m-c4-note-title${note.checked ? ' checked' : ''}">${escHtml(note.title)}</div>
                <div class="m-c4-note-body${note.checked ? ' checked' : ''}">${escHtml(note.content)}</div>
                <div class="m-c4-note-ts">${formatTs(note)}</div>
            `;
            card.querySelector('.m-c4-check').addEventListener('change', async (e) => {
                note.checked = e.target.checked;
                note.updatedAt = new Date().toISOString();
                await saveC4Notes(allNotes);
                const contentId = mState.currentContext === 'lib' ? 'mTabContent' : 'mSDTabContent';
                renderDetailTab('c4', contentId);
            });
            container.appendChild(card);
        });
    }

    // Modal
    const modal = document.createElement('div');
    modal.className = 'm-modal-overlay';
    modal.id = 'mNoteModal';
    modal.innerHTML = `
        <div class="m-modal">
            <div class="m-modal-title">Add Note</div>
            <input class="m-modal-input" id="mNoteTitleInput" placeholder="Title" maxlength="80">
            <textarea class="m-modal-input m-modal-textarea" id="mNoteContentInput" placeholder="Content" maxlength="280"></textarea>
            <div class="m-modal-btns">
                <button class="m-modal-btn cancel" id="mNoteModalCancel">Cancel</button>
                <button class="m-modal-btn save" id="mNoteModalSave">Save</button>
            </div>
        </div>
    `;
    modal.addEventListener('click', (e) => { if (e.target === modal) closeNoteModal(); });
    container.appendChild(modal);
    document.getElementById('mNoteModalCancel').addEventListener('click', closeNoteModal);
    document.getElementById('mNoteModalSave').addEventListener('click', () => saveNewNote(allNotes));
}

function openAddNoteModal() {
    const modal = document.getElementById('mNoteModal');
    if (modal) { modal.classList.add('active'); document.getElementById('mNoteTitleInput').focus(); }
}

function closeNoteModal() {
    const modal = document.getElementById('mNoteModal');
    if (modal) modal.classList.remove('active');
}

async function saveNewNote(allNotes) {
    const title = document.getElementById('mNoteTitleInput').value.trim();
    const content = document.getElementById('mNoteContentInput').value.trim();
    if (!title || !content) { alert('Please fill in both fields.'); return; }
    const sectionId = mState.currentSectionId;
    if (!allNotes[sectionId]) allNotes[sectionId] = [];
    const maxId = allNotes[sectionId].reduce((m, n) => Math.max(m, n.id || 0), 0);
    allNotes[sectionId].unshift({ id: maxId + 1, title, content, category: 'General', starred: false, checked: false, createdAt: new Date().toISOString(), updatedAt: null });
    closeNoteModal();
    await saveC4Notes(allNotes);
    const contentId = mState.currentContext === 'lib' ? 'mTabContent' : 'mSDTabContent';
    renderDetailTab('c4', contentId);
}

async function saveC4Notes(allNotes) {
    showSyncBar('Saving...', 'default');
    const c4Key = `c4_allSectionNotes_${mState.currentFileId}`;
    localStorage.setItem(c4Key, JSON.stringify(allNotes));
    localStorage.setItem(`__ts_${c4Key}`, Date.now().toString());
    await pushToSupabase(c4Key, JSON.stringify(allNotes));
    hideSyncBarAfter('Saved \u2713', 'success', 2000);
}

// ===== DASHBOARD =====
function bindDashTabs() {
    document.querySelectorAll('.m-dash-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.m-dash-tab').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            mState.activeDash = btn.dataset.dash;
            renderDashboard(mState.activeDash);
        });
    });
}

function renderDashboard(view) {
    const container = document.getElementById('mDashContent');
    container.innerHTML = '';
    if (view === 'heatmap') renderMobileHeatmap(container);
    else renderMobileGraphs(container);
}

function renderMobileHeatmap(container) {
    const HM_CATEGORIES = [
        { id: 'red',    label: 'Holiday',   color: '#f47067' },
        { id: 'orange', label: 'Exam',      color: '#e8834a' },
        { id: 'yellow', label: 'Important', color: '#ddb56a' },
        { id: 'purple', label: 'Reminder',  color: '#a78bfa' },
    ];

    function hmGetEvents() {
        try { return JSON.parse(localStorage.getItem('hm_events')) || {}; } catch(e) { return {}; }
    }

    function toDateKey(date) {
        return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
    }

    function getStudyData() {
        const fs = getFileSystem();
        if (!fs) return {};
        const files = collectFiles(fs);
        const studyMap = {};
        files.forEach(file => {
            const fd = getFileData(file.id);
            const c5Store = fd?.c5_sectionStore ? JSON.parse(fd.c5_sectionStore) : {};
            Object.values(c5Store).forEach(c5 => {
                if (!c5?.revisions) return;
                c5.revisions.forEach(r => {
                    if (r.date && r.year) {
                        const parts = r.date.split('/');
                        if (parts.length === 2) {
                            const key = `${r.year}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
                            studyMap[key] = (studyMap[key] || 0) + 1;
                        }
                    }
                });
            });
        });
        return studyMap;
    }

    const events = hmGetEvents();
    const studyData = getStudyData();
    const today = new Date();

    // Build 8 weeks of calendar (scrollable)
    const wrapper = document.createElement('div');
    wrapper.className = 'm-heatmap-wrapper';

    // Legend
    const legend = document.createElement('div');
    legend.className = 'm-hm-legend';
    HM_CATEGORIES.forEach(cat => {
        legend.innerHTML += `<span class="m-hm-legend-item"><span class="m-hm-dot" style="background:${cat.color}"></span>${cat.label}</span>`;
    });
    wrapper.appendChild(legend);

    // Month label + grid: show 18 weeks (≈4 months visible via scroll)
    const totalWeeks = 18;
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - (startDate.getDay() === 0 ? 6 : startDate.getDay() - 1)); // Monday
    startDate.setDate(startDate.getDate() - (totalWeeks - 1) * 7);

    const gridWrap = document.createElement('div');
    gridWrap.className = 'm-hm-scroll';

    const dayLabels = document.createElement('div');
    dayLabels.className = 'm-hm-day-labels';
    ['M','T','W','T','F','S','S'].forEach(d => {
        dayLabels.innerHTML += `<div class="m-hm-day-label">${d}</div>`;
    });

    const grid = document.createElement('div');
    grid.className = 'm-hm-grid';

    let currentMonth = -1;
    for (let w = 0; w < totalWeeks; w++) {
        const col = document.createElement('div');
        col.className = 'm-hm-col';

        // Month label above column
        const weekStart = new Date(startDate);
        weekStart.setDate(weekStart.getDate() + w * 7);
        const monthLabel = document.createElement('div');
        monthLabel.className = 'm-hm-month-label';
        if (weekStart.getMonth() !== currentMonth) {
            currentMonth = weekStart.getMonth();
            monthLabel.textContent = weekStart.toLocaleString('default', { month: 'short' });
        }
        col.appendChild(monthLabel);

        for (let d = 0; d < 7; d++) {
            const cellDate = new Date(startDate);
            cellDate.setDate(cellDate.getDate() + w * 7 + d);
            const key = toDateKey(cellDate);
            const count = studyData[key] || 0;
            const event = events[key];
            const isToday = key === toDateKey(today);
            const isFuture = cellDate > today;

            const cell = document.createElement('div');
            cell.className = 'm-hm-cell';
            if (isToday) cell.classList.add('today');
            if (isFuture) cell.classList.add('future');

            if (event) {
                const cat = HM_CATEGORIES.find(c => c.id === event.categoryId);
                if (cat) cell.style.background = cat.color + '44';
                cell.style.borderColor = cat?.color || 'transparent';
                cell.title = event.text;
                cell.classList.add('has-event');
            } else if (!isFuture && count > 0) {
                const intensity = Math.min(count / 5, 1);
                const alpha = Math.round(40 + intensity * 180);
                cell.style.background = `rgba(59,130,246,${alpha/255})`;
            }

            cell.innerHTML = `<span class="m-hm-date">${cellDate.getDate()}</span>`;
            col.appendChild(cell);
        }
        grid.appendChild(col);
    }

    gridWrap.appendChild(dayLabels);
    gridWrap.appendChild(grid);
    wrapper.appendChild(gridWrap);

    // Stats summary
    const totalStudied = Object.keys(studyData).length;
    const thisMonth = Object.entries(studyData).filter(([k]) => k.startsWith(`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`)).reduce((s, [, v]) => s + v, 0);

    const stats = document.createElement('div');
    stats.className = 'm-hm-stats';
    stats.innerHTML = `
        <div class="m-hm-stat"><div class="m-hm-stat-val">${thisMonth}</div><div class="m-hm-stat-label">This Month</div></div>
        <div class="m-hm-stat"><div class="m-hm-stat-val">${studyData[toDateKey(today)] || 0}</div><div class="m-hm-stat-label">Today</div></div>
        <div class="m-hm-stat"><div class="m-hm-stat-val">${totalStudied}</div><div class="m-hm-stat-label">Active Days</div></div>
    `;
    wrapper.appendChild(stats);

    container.appendChild(wrapper);
}

function renderMobileGraphs(container) {
    const fs = getFileSystem();
    if (!fs) { container.innerHTML = '<div class="m-empty">No data.</div>'; return; }

    const files = collectFiles(fs);
    const dailyMap = {};

    files.forEach(file => {
        const fd = getFileData(file.id);
        const c5Store = fd?.c5_sectionStore ? JSON.parse(fd.c5_sectionStore) : {};
        Object.values(c5Store).forEach(c5 => {
            if (!c5?.revisions) return;
            c5.revisions.forEach(r => {
                if (r.date && r.year) {
                    const parts = r.date.split('/');
                    if (parts.length === 2) {
                        const key = `${r.year}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
                        dailyMap[key] = (dailyMap[key] || 0) + 1;
                    }
                }
            });
        });
    });

    // Last 30 days bar chart
    const days = [];
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        days.push({ key, label: d.getDate(), count: dailyMap[key] || 0 });
    }

    const maxCount = Math.max(...days.map(d => d.count), 1);

    const wrap = document.createElement('div');
    wrap.className = 'm-graph-wrap';

    const title = document.createElement('div');
    title.className = 'm-graph-title';
    title.textContent = 'Study Activity — Last 30 Days';
    wrap.appendChild(title);

    const chart = document.createElement('div');
    chart.className = 'm-bar-chart';

    days.forEach(day => {
        const barWrap = document.createElement('div');
        barWrap.className = 'm-bar-wrap';
        const h = day.count > 0 ? Math.max(4, Math.round((day.count / maxCount) * 80)) : 2;
        barWrap.innerHTML = `
            <div class="m-bar" style="height:${h}px${day.count > 0 ? '' : ';background:var(--border)'}"></div>
            <div class="m-bar-label">${day.label}</div>
        `;
        chart.appendChild(barWrap);
    });

    wrap.appendChild(chart);

    // Total this week
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - (weekStart.getDay() === 0 ? 6 : weekStart.getDay() - 1));
    const thisWeek = days.filter(d => new Date(d.key) >= weekStart).reduce((s, d) => s + d.count, 0);
    const thisMonth = days.reduce((s, d) => s + d.count, 0);

    const statsRow = document.createElement('div');
    statsRow.className = 'm-hm-stats';
    statsRow.innerHTML = `
        <div class="m-hm-stat"><div class="m-hm-stat-val">${studyStreak(dailyMap, today)}</div><div class="m-hm-stat-label">Day Streak</div></div>
        <div class="m-hm-stat"><div class="m-hm-stat-val">${thisWeek}</div><div class="m-hm-stat-label">This Week</div></div>
        <div class="m-hm-stat"><div class="m-hm-stat-val">${thisMonth}</div><div class="m-hm-stat-label">30 Days</div></div>
    `;
    wrap.appendChild(statsRow);
    container.appendChild(wrap);
}

function studyStreak(dailyMap, today) {
    let streak = 0;
    const d = new Date(today);
    while (true) {
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        if (dailyMap[key] > 0) { streak++; d.setDate(d.getDate() - 1); }
        else break;
    }
    return streak;
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
