// mobile.js - RAM Mobile PWA

// ===== CONFIG =====
const SUPABASE_URL = 'https://jqruimtvezwdkmkqnspl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpxcnVpbXR2ZXp3ZGtta3Fuc3BsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwNzkzMTUsImV4cCI6MjA5NDY1NTMxNX0.m5rrXJYhHfl6tNYI7lkRrkfzPCG2My2T9ktCj23fM2o';
const SB_HEADERS = { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates,return=minimal' };
const GLOBAL_KEYS = ['ram_theme', 'ram_homepage', 'ram_smartDesk', 'ram_mobile_theme', 'hm_events'];

// ===== STATE =====
const mState = {
    syncData: null,
    currentFileId: null,
    currentFileName: null,
    currentSectionId: null,
    currentSection: null,
    screen: 'files', // files | sections | detail
    activeTab: 'notes',
    theme: localStorage.getItem('ram_mobile_theme') || 'dark',
};

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
    applyTheme(mState.theme);
    bindTopbar();
    loadSyncData();
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw_mobile.js').catch(() => {});
    }
});

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

    document.getElementById('mBackBtn').addEventListener('click', () => {
        if (mState.screen === 'detail') goToScreen('sections');
        else if (mState.screen === 'sections') goToScreen('files');
    });
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

        // Merge into mState.syncData and localStorage
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

        // Build legacy syncData shape for existing render functions
        const fsRow = allRows.find(r => r.key === 'ram_fileSystem');
        mState.syncData.fileSystem = fsRow ? (typeof fsRow.value === 'string' ? fsRow.value : JSON.stringify(fsRow.value)) : localStorage.getItem('ram_fileSystem');
        mState.syncData.files = {};

        hideSyncBarAfter('Synced ✓', 'success', 2000);
        renderFileList();
        hideLoading();
        if (mState.screen === 'sections' && mState.currentFileId) {
            renderSectionList(mState.currentFileId, mState.currentFileName);
        }
        if (mState.screen === 'detail' && mState.currentSectionId) {
            renderDetailTab(mState.activeTab);
        }
    } catch(e) {
        hideSyncBarAfter('Sync failed. Check connection.', 'error', 3000);
        hideLoading();
        // Fall back to cached localStorage data
        if (!mState.syncData) {
            const cached = localStorage.getItem('ram_fileSystem');
            if (cached) {
                mState.syncData = { fileSystem: cached, files: {} };
                renderFileList();
                hideLoading();
            } else {
                document.getElementById('mFileList').innerHTML = '<div class="m-empty">No cached data available.<br>Please sync when online.</div>';
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
    const msgEl = document.getElementById('mSyncMsg');
    bar.className = 'm-sync-bar' + (type !== 'default' ? ' ' + type : '');
    msgEl.textContent = msg;
    bar.style.display = 'flex';
    // Adjust content margin
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

// ===== SCREEN NAV =====
function goToScreen(name) {
    mState.screen = name;
    document.querySelectorAll('.m-screen').forEach(s => s.classList.remove('active'));
    document.getElementById('screen' + name.charAt(0).toUpperCase() + name.slice(1)).classList.add('active');

    const backBtn = document.getElementById('mBackBtn');
    const titleEl = document.getElementById('mTopbarTitle');

    if (name === 'files') {
        backBtn.style.display = 'none';
        titleEl.textContent = 'RAM';
    } else if (name === 'sections') {
        backBtn.style.display = 'flex';
        titleEl.textContent = mState.currentFileName || 'Sections';
    } else if (name === 'detail') {
        backBtn.style.display = 'flex';
        titleEl.textContent = mState.currentSection?.title || 'Section';
    }

    window.scrollTo(0, 0);
}

// ===== FILE LIST =====
function renderFileList() {
    const container = document.getElementById('mFileList');
    const fs = mState.syncData?.fileSystem;
    if (!fs) {
        container.innerHTML = '<div class="m-empty">No files found.</div>';
        return;
    }

    let fileSystem;
    try { fileSystem = typeof fs === 'string' ? JSON.parse(fs) : fs; }
    catch(e) { container.innerHTML = '<div class="m-empty">Error reading data.</div>'; return; }

    const files = collectFiles(fileSystem);
    if (files.length === 0) {
        container.innerHTML = '<div class="m-empty">No files yet. Create one in desktop app.</div>';
        return;
    }

    container.innerHTML = '';
    files.forEach(file => {
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
            <div class="m-file-arrow">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
        `;
        card.addEventListener('click', () => {
            mState.currentFileId = file.id;
            mState.currentFileName = file.name;
            renderSectionList(file.id, file.name);
            goToScreen('sections');
        });
        container.appendChild(card);
    });
}

function collectFiles(fs, result = []) {
    if (!fs || typeof fs !== 'object') return result;
    Object.entries(fs).forEach(([key, item]) => {
        if (item.type === 'file') result.push({ id: item.fileId, name: key });
        else if (item.type === 'folder' && item.contents) collectFiles(item.contents, result);
    });
    return result;
}

// ===== SECTION LIST =====
function renderSectionList(fileId, fileName) {
    const container = document.getElementById('mSectionList');
    const fileData = getFileData(fileId);
    if (!fileData.c12_sections && !fileData.c5_sectionStore) {
        container.innerHTML = '<div class="m-empty">No data for this file.</div>';
        return;
    }

    const sections = fileData.c12_sections ? JSON.parse(fileData.c12_sections) : [];
    const c5Store = fileData.c5_sectionStore ? JSON.parse(fileData.c5_sectionStore) : {};

    container.innerHTML = '';

    // Navigation item
    const navItem = document.createElement('div');
    navItem.className = 'm-section-item';
    navItem.innerHTML = `
        <div class="m-section-num">NAV</div>
        <div class="m-section-title">Table of Contents</div>
        <div class="m-file-arrow"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg></div>
    `;
    navItem.addEventListener('click', () => openSection('navigation', 'Table of Contents', fileId));
    container.appendChild(navItem);

    const realSections = sections.filter(s => s.type === 'real');
    if (realSections.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'm-empty';
        empty.textContent = 'No sections yet.';
        container.appendChild(empty);
        return;
    }

    realSections.forEach(section => {
        const c5 = c5Store[section.id];
        const item = document.createElement('div');
        item.className = `m-section-item level-${section.level}`;

        const badges = [];
        if (c5?.isCompleted) badges.push('<span class="m-badge completed">✓</span>');

        // Check studied today
        if (c5 && isStudiedToday(c5)) badges.push('<span class="m-badge studied">Today</span>');

        const numEl = section.number ? `<div class="m-section-num">${section.number}</div>` : '<div class="m-section-num"></div>';

        item.innerHTML = `
            ${numEl}
            <div class="m-section-title">${escHtml(section.title)}</div>
            <div class="m-section-badges">${badges.join('')}</div>
            <div class="m-file-arrow"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg></div>
        `;
        item.addEventListener('click', () => openSection(section.id, section.title, fileId));
        container.appendChild(item);
    });
}

function isStudiedToday(c5) {
    if (!c5?.revisions) return false;
    const today = new Date();
    const todayStr = `${String(today.getDate()).padStart(2,'0')}/${String(today.getMonth()+1).padStart(2,'0')}`;
    const todayYear = today.getFullYear();
    return c5.revisions.some(r => r.date === todayStr && r.year === todayYear);
}

// ===== OPEN SECTION =====
function openSection(sectionId, title, fileId) {
    mState.currentSectionId = sectionId;
    mState.currentSection = { id: sectionId, title };
    mState.activeTab = 'notes';
    goToScreen('detail');
    bindTabBar();
    renderDetailTab('notes');
}

// ===== TAB BAR =====
function bindTabBar() {
    const tabs = document.querySelectorAll('.m-tab');
    tabs.forEach(tab => {
        tab.onclick = () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            mState.activeTab = tab.dataset.tab;
            renderDetailTab(tab.dataset.tab);
        };
    });
    // Reset active tab UI
    tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === 'notes'));
}

function renderDetailTab(tab) {
    const content = document.getElementById('mTabContent');
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

    // Mark as Studied button
    const c5Store = fileData?.c5_sectionStore ? JSON.parse(fileData.c5_sectionStore) : {};
    const c5 = c5Store[mState.currentSectionId];
    const studiedToday = c5 && isStudiedToday(c5);

    const studiedBtn = document.createElement('button');
    studiedBtn.className = 'm-studied-btn' + (studiedToday ? ' studied' : '');
    studiedBtn.textContent = studiedToday ? '✓ Studied Today' : 'Mark as Studied';
    studiedBtn.addEventListener('click', () => markAsStudied());
    container.appendChild(studiedBtn);

    if (!sectionData?.notes) {
        const empty = document.createElement('div');
        empty.className = 'm-empty';
        empty.textContent = 'No notes yet.';
        container.appendChild(empty);
        return;
    }

    const LEVELS = [
        { id: 'crisp', label: 'Crisp', icon: '⚡', sub: 'Key points only' },
        { id: 'conceptual', label: 'Conceptual', icon: '💡', sub: 'Core concepts' },
        { id: 'detailed', label: 'Detailed', icon: '📚', sub: 'In depth' },
        { id: 'syntopical', label: 'Syntopical', icon: '🔗', sub: 'Cross-linked' },
    ];

    LEVELS.forEach(level => {
        const levelData = sectionData.notes[level.id];
        if (!levelData?.versions?.length) return;

        const current = levelData.versions[levelData.currentVersion] || levelData.versions[0];
        if (!current) return;

        const wrap = document.createElement('div');
        wrap.className = 'm-notes-level';
        wrap.innerHTML = `
            <div class="m-notes-level-header">
                <span class="m-notes-level-icon">${level.icon}</span>
                <span class="m-notes-level-label">${level.label}</span>
                <span class="m-notes-level-sub">${level.sub}</span>
            </div>
            <div class="m-notes-content">${renderNoteContent(current)}</div>
        `;
        container.appendChild(wrap);
    });
}

function renderNoteContent(version) {
    if (!version) return '';

    // Plain template — raw HTML stored directly
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
            const text = rows[0]?.content || '';
            return `<div class="m-note-header">${escHtml(text)}</div>`;
        }

        if (type === 'code') {
            const text = rows.map(r => escHtml(r.content || '')).join('\n');
            return `<pre class="m-note-code">${text}</pre>`;
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
                // Check if it's a table
                if (content.includes('<table')) {
                    return renderTableFromHtml(content);
                }
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
        cells.forEach(cell => {
            out += `<div class="m-note-table-cell">${escHtml(stripHtml(cell.innerHTML))}</div>`;
        });
        out += '</div>';
    });
    out += '</div>';
    return out;
}

function renderTableFromHtml(html) {
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const table = doc.querySelector('table');
        if (!table) return `<p>${escHtml(stripHtml(html))}</p>`;
        return renderTableElement(table);
    } catch(e) {
        return `<p>${escHtml(stripHtml(html))}</p>`;
    }
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

    // Find next empty slot
    const today = new Date();
    const dateStr = `${String(today.getDate()).padStart(2,'0')}/${String(today.getMonth()+1).padStart(2,'0')}`;
    const year = today.getFullYear();

    // Check already studied today
    const alreadyStudied = c5.revisions.some(r => r.date === dateStr && r.year === year);
    if (alreadyStudied) { showSyncBar('Already marked as studied today', 'success'); setTimeout(() => { document.getElementById('mSyncBar').style.display='none'; document.querySelector('.m-content').style.marginTop=''; }, 2000); return; }

    // Find next empty slot within activated
    let filled = false;
    for (let i = 0; i < c5.activatedCount; i++) {
        if (!c5.revisions[i].date) {
            c5.revisions[i] = { date: dateStr, year };
            filled = true;
            break;
        }
    }

    if (!filled) {
        showSyncBar('All revision slots filled', 'error');
        setTimeout(() => { document.getElementById('mSyncBar').style.display='none'; document.querySelector('.m-content').style.marginTop=''; }, 2000);
        return;
    }

    // Update local state
    fileData.c5_sectionStore = JSON.stringify(c5Store);

    // Push to desktop
    showSyncBar('Saving...', 'default');
    const c5Key = `c5_sectionStore_${mState.currentFileId}`; localStorage.setItem(c5Key, JSON.stringify(c5Store)); localStorage.setItem(`__ts_${c5Key}`, Date.now().toString()); await pushToSupabase(c5Key, JSON.stringify(c5Store));
    hideSyncBarAfter('Saved ✓', 'success', 2000);

    // Re-render
    renderDetailTab('notes');
}

// ===== C5 TAB =====
function renderC5Tab(container) {
    const fileData = getFileData(mState.currentFileId);
    const c5Store = fileData?.c5_sectionStore ? JSON.parse(fileData.c5_sectionStore) : {};
    const c5 = c5Store[mState.currentSectionId];

    if (!c5) {
        container.innerHTML = '<div class="m-empty">No progress data yet.</div>';
        return;
    }

    // Info card
    const card = document.createElement('div');
    card.className = 'm-c5-card';

    const diffColors = { Easy:'#22c55e', Moderate:'#f59e0b', Challenging:'#f97316', Hard:'#ef4444' };
    const prioColors = { Low:'#94a3b8', Medium:'#3b82f6', High:'#f97316', Critical:'#ef4444' };

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

    // Revision grid
    const gridTitle = document.createElement('div');
    gridTitle.style.cssText = 'font-size:13px;font-weight:600;color:var(--text-muted);margin:12px 0 8px';
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
        slot.innerHTML = `
            <div class="m-rev-slot-num">#${i+1}</div>
            <div class="m-rev-slot-date">${isFilled ? rev.date : (isActive ? '—' : '·')}</div>
        `;
        grid.appendChild(slot);
    }
    container.appendChild(grid);

    // Action buttons
    const btns = document.createElement('div');
    btns.className = 'm-c5-btns';
    btns.innerHTML = `
        <button class="m-c5-btn primary" id="mMarkCompleteBtn">${c5.isCompleted ? 'Unmark Completed' : 'Mark Completed'}</button>
        <button class="m-c5-btn" id="mActivateMoreBtn">Activate More</button>
        <button class="m-c5-btn danger" id="mResetBtn">Reset</button>
    `;
    container.appendChild(btns);

    // Bind selects
    document.getElementById('mDiffSelect').addEventListener('change', async (e) => {
        c5.difficulty = e.target.value;
        await saveC5(c5Store);
    });
    document.getElementById('mPrioSelect').addEventListener('change', async (e) => {
        c5.priority = e.target.value;
        await saveC5(c5Store);
    });

    document.getElementById('mMarkCompleteBtn').addEventListener('click', async () => {
        c5.isCompleted = !c5.isCompleted;
        await saveC5(c5Store);
        renderDetailTab('c5');
    });

    document.getElementById('mActivateMoreBtn').addEventListener('click', async () => {
        if (c5.activatedCount < c5.totalSlots) {
            c5.activatedCount = Math.min(c5.activatedCount + 4, c5.totalSlots);
            await saveC5(c5Store);
            renderDetailTab('c5');
        }
    });

    document.getElementById('mResetBtn').addEventListener('click', async () => {
        if (!confirm('Reset all revision data for this section?')) return;
        c5.revisions = Array(12).fill(null).map(() => ({ date: null, year: null }));
        c5.activatedCount = 4;
        c5.isCompleted = false;
        await saveC5(c5Store);
        renderDetailTab('c5');
    });
}

async function saveC5(c5Store) {
    const fileData = getFileData(mState.currentFileId);
    fileData.c5_sectionStore = JSON.stringify(c5Store);
    showSyncBar('Saving...', 'default');
    const c5Key = `c5_sectionStore_${mState.currentFileId}`; localStorage.setItem(c5Key, JSON.stringify(c5Store)); localStorage.setItem(`__ts_${c5Key}`, Date.now().toString()); await pushToSupabase(c5Key, JSON.stringify(c5Store));
    hideSyncBarAfter('Saved ✓', 'success', 2000);
}

// ===== C4 TAB =====
function renderC4Tab(container) {
    const fileData = getFileData(mState.currentFileId);
    const allNotes = fileData?.c4_allSectionNotes ? JSON.parse(fileData.c4_allSectionNotes) : {};
    const notes = allNotes[mState.currentSectionId] || [];

    // Add note button
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
        return;
    }

    // Sort: starred first, then unchecked, then checked
    const starred = notes.filter(n => n.starred);
    const unchecked = notes.filter(n => !n.starred && !n.checked);
    const checked = notes.filter(n => !n.starred && n.checked);
    const sorted = [...starred, ...unchecked, ...checked];

    sorted.forEach(note => {
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

        // Checkbox toggle
        card.querySelector('.m-c4-check').addEventListener('change', async (e) => {
            note.checked = e.target.checked;
            note.updatedAt = new Date().toISOString();
            await saveC4Notes(allNotes);
            renderDetailTab('c4');
        });

        container.appendChild(card);
    });

    // Modal
    const modal = document.createElement('div');
    modal.className = 'm-modal-overlay';
    modal.id = 'mNoteModal';
    modal.innerHTML = `
        <div class="m-modal">
            <div class="m-modal-title" id="mNoteModalTitle">Add Note</div>
            <input class="m-modal-input" id="mNoteTitleInput" placeholder="Title (max 80 chars)" maxlength="80">
            <textarea class="m-modal-input m-modal-textarea" id="mNoteContentInput" placeholder="Content (max 280 chars)" maxlength="280"></textarea>
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
    allNotes[sectionId].unshift({
        id: maxId + 1,
        title, content,
        category: 'General',
        starred: false,
        checked: false,
        createdAt: new Date().toISOString(),
        updatedAt: null
    });

    closeNoteModal();
    await saveC4Notes(allNotes);
    renderDetailTab('c4');
}

async function saveC4Notes(allNotes) {
    const fileData = getFileData(mState.currentFileId);
    fileData.c4_allSectionNotes = JSON.stringify(allNotes);
    showSyncBar('Saving...', 'default');
    const c4Key = `c4_allSectionNotes_${mState.currentFileId}`; localStorage.setItem(c4Key, JSON.stringify(allNotes)); localStorage.setItem(`__ts_${c4Key}`, Date.now().toString()); await pushToSupabase(c4Key, JSON.stringify(allNotes));
    hideSyncBarAfter('Saved ✓', 'success', 2000);
}

// ===== UTILS =====
function getFileData(fileId) {
    if (!fileId) return {};
    const id = fileId.startsWith('f_') ? fileId : `f_${fileId}`;
    const keys = ['c5_sectionStore', 'c3_data', 'c4_allSectionNotes', 'c4_categories', 'c12_sections'];
    const result = {};
    for (const k of keys) {
        const fullKey = `${k}_${id}`;
        // Try localStorage first, then mState.syncData
        const local = localStorage.getItem(fullKey);
        if (local) {
            result[k] = local;
        } else if (mState.syncData?.[fullKey]) {
            const v = mState.syncData[fullKey];
            result[k] = typeof v === 'string' ? v : JSON.stringify(v);
        }
    }
    return result;
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