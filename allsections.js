// allsections.js

const AS_BATCH_SIZE = 100;

// ===== STATE =====
const asState = {
    allRows: [],       // all loaded rows
    filteredRows: [],  // after filters
    sortCol: null,
    sortDir: null,
    filterDiff: [],    // [] = all
    filterPrio: [],
    filterFile: 'all',
    checkedSections: new Set(), // { fileId|sectionId }
    searchQuery: '',
    renderOffset: 0,
};

// ===== PLAYLIST HELPERS =====
function asGetCheckedKey(row) {
    return `${row.fileId}|${row.sectionId}`;
}

function asToggleCheck(key, checked) {
    if (checked) asState.checkedSections.add(key);
    else asState.checkedSections.delete(key);
    asUpdatePlaylistBtn();
}

function asUpdatePlaylistBtn() {
    const btn = document.getElementById('asCreatePlaylistBtn');
    if (!btn) return;
    const count = asState.checkedSections.size;
    btn.disabled = count === 0;
    btn.title = count > 0 ? `Create playlist from ${count} section(s)` : 'Select sections first';
}

function asCreatePlaylist() {
    if (asState.checkedSections.size === 0) return;
    const name = prompt('Playlist name:');
    if (!name || !name.trim()) return;

    const sections = [];
    asState.checkedSections.forEach(key => {
        const [fileId, sectionIdStr] = key.split('|');
        const sectionId = isNaN(sectionIdStr) ? sectionIdStr : Number(sectionIdStr);
        sections.push({ fileId, sectionId });
    });

    const playlists = JSON.parse(localStorage.getItem('ram_playlists') || '[]');
    playlists.push({
        id: 'pl_' + Date.now(),
        name: name.trim(),
        createdAt: new Date().toISOString(),
        sections
    });
    RAM_SYNC.setItem('ram_playlists', JSON.stringify(playlists));

    asState.checkedSections.clear();
    asUpdatePlaylistBtn();
    asRenderTable();
    alert(`Playlist "${name.trim()}" created with ${sections.length} section(s).`);
    // Notify playlist layer to refresh if open
    if (typeof plRender === 'function') plRender();
}

// ===== SEARCH =====
function asOnSearch(e) {
    asState.searchQuery = e.target.value.toLowerCase();
    asRender();
}

// ===== COLORS =====
const AS_DIFF_COLORS = { Easy: '#22c55e', Moderate: '#f59e0b', Challenging: '#f97316', Hard: '#ef4444' };
const AS_PRIO_COLORS = { Low: '#94a3b8', Medium: '#3b82f6', High: '#f97316', Critical: '#ef4444' };
const AS_PROF_LABELS = ['Novice', 'Apprentice', 'Competent', 'Proficient'];

// ===== COLLECT DATA =====
function asCollectAllFiles(cur, result, path) {
    if (!result) result = [];
    if (!path) path = [];
    for (const [name, item] of Object.entries(cur)) {
        if (item.type === 'file' && item.fileId) {
            result.push({ name, fileId: item.fileId });
        } else if (item.type === 'folder' && item.contents) {
            asCollectAllFiles(item.contents, result, [...path, name]);
        }
    }
    return result;
}

function asLoadAllRows() {
    asState.allRows = [];

    const fsRaw = localStorage.getItem('ram_fileSystem');
    if (!fsRaw) return;
    let fs;
    try { fs = JSON.parse(fsRaw); } catch(e) { return; }

    const files = asCollectAllFiles(fs);

    files.forEach(file => {
        const sectionsRaw = localStorage.getItem(`c12_sections_${file.fileId}`);
        const storeRaw    = localStorage.getItem(`c5_sectionStore_${file.fileId}`);
        if (!sectionsRaw || !storeRaw) return;

        let sections, store;
        try { sections = JSON.parse(sectionsRaw); } catch(e) { return; }
        try { store    = JSON.parse(storeRaw);    } catch(e) { return; }

        // Only real sections that have a c5 store entry (meaning content was added)
        sections.forEach(sec => {
            if (sec.type !== 'real') return;
            const sid = String(sec.id);
            const data = store[sid] || store[sec.id];
            if (!data) return; // no content yet

            const pct = asCalcProgress(data);

            const lastRevEntry = asGetLastRevDate(data.revisions);

            asState.allRows.push({
                sectionId: sec.id,
                sectionTitle: sec.title,
                fileId: file.fileId,
                fileName: file.name,
                difficulty: data.difficulty || 'Easy',
                priority: data.priority || 'Low',
                progress: pct,
                isCompleted: data.isCompleted || false,
                revFilled: data.revisions.filter(r => r.date !== null).length,
                revTotal: data.activatedCount || 4,
                lastRevDaysAgo: asCalcDaysAgo(lastRevEntry),
            });
        });
    });
}

function asCalcProgress(data) {
    if (data.isCompleted) return 100;
    const activated = data.activatedCount || 4;
    const filled = data.revisions.slice(0, activated).filter(r => r.date !== null).length;
    return Math.round((filled / activated) * 100);
}

function asGetLastRevDate(revisions) {
    // format: { date: "17/05", year: 2026 }
    let last = null;
    revisions.forEach(r => { if (r.date) last = r; });
    if (!last) return null;
    return { date: last.date, year: last.year };
}

function asCalcDaysAgo(revEntry) {
    if (!revEntry) return null;
    try {
        const [day, month] = revEntry.date.split('/').map(Number);
        const year = revEntry.year;
        const d = new Date(year, month - 1, day);
        d.setHours(0, 0, 0, 0);
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        return Math.floor((now - d) / (1000 * 60 * 60 * 24));
    } catch(e) { return null; }
}

function asProficiency(pct) {
    if (pct <= 25) return 'Novice';
    if (pct <= 50) return 'Apprentice';
    if (pct <= 75) return 'Competent';
    return 'Proficient';
}

// ===== FILTER =====
function asApplyFilters() {
    asState.filteredRows = asState.allRows.filter(row => {
        if (asState.filterDiff.length && !asState.filterDiff.includes(row.difficulty)) return false;
        if (asState.filterPrio.length && !asState.filterPrio.includes(row.priority)) return false;
        if (asState.filterFile !== 'all' && row.fileId !== asState.filterFile) return false;
        if (asState.searchQuery) {
            const q = asState.searchQuery;
            if (!row.sectionTitle.toLowerCase().includes(q) && !row.fileName.toLowerCase().includes(q)) return false;
        }
        return true;
    });
}

// ===== SORT =====
function asApplySort() {
    if (!asState.sortCol) return; // keep original order
    const col = asState.sortCol;
    const dir = asState.sortDir === 'asc' ? 1 : -1;
    asState.filteredRows.sort((a, b) => {
        let va, vb;
        switch(col) {
            case 'section':  va = a.sectionTitle.toLowerCase(); vb = b.sectionTitle.toLowerCase(); break;
            case 'file':     va = a.fileName.toLowerCase();     vb = b.fileName.toLowerCase();     break;
            case 'diff':     va = ['Easy','Moderate','Challenging','Hard'].indexOf(a.difficulty); vb = ['Easy','Moderate','Challenging','Hard'].indexOf(b.difficulty); break;
            case 'prio':     va = ['Low','Medium','High','Critical'].indexOf(a.priority); vb = ['Low','Medium','High','Critical'].indexOf(b.priority); break;
            case 'prof':     va = a.progress; vb = b.progress; break;
            case 'progress': va = a.progress; vb = b.progress; break;
            case 'rev':      va = a.revFilled; vb = b.revFilled; break;
            case 'last':
                va = a.lastRevDaysAgo === null ? 9999 : a.lastRevDaysAgo;
                vb = b.lastRevDaysAgo === null ? 9999 : b.lastRevDaysAgo;
                break;
            default:         va = 0; vb = 0;
        }
        if (typeof va === 'string') return va.localeCompare(vb) * dir;
        return (va - vb) * dir;
    });
}

// ===== RENDER TABLE =====
function asRender() {
    asApplyFilters();
    asApplySort();
    asState.renderOffset = 0;
    asRenderTable();
    asUpdateCount();
}

function asRenderTable() {
    const tbody = document.getElementById('asTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (asState.filteredRows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="as-empty">No sections found.</td></tr>`;
        return;
    }

    const batch = asState.filteredRows.slice(0, AS_BATCH_SIZE);
    asState.renderOffset = batch.length;
    batch.forEach(row => asRenderRow(tbody, row));
    asAppendLoadMore(tbody);
}

function asRenderRow(tbody, row) {
    const tr = document.createElement('tr');
    const key = asGetCheckedKey(row);
    const isChecked = asState.checkedSections.has(key);

    const diffColor = AS_DIFF_COLORS[row.difficulty] || '#94a3b8';
    const prioColor = AS_PRIO_COLORS[row.priority] || '#94a3b8';
    const profColor = row.progress <= 25 ? '#94a3b8' : row.progress <= 50 ? '#f59e0b' : row.progress <= 75 ? '#f97316' : '#22c55e';
    const barColor  = row.progress === 100 ? '#22c55e' : row.progress >= 50 ? '#f97316' : '#3b82f6';
    const prof      = asProficiency(row.progress);

    let lastRevHtml;
    if (row.isCompleted) {
        lastRevHtml = `<span class="as-done">Done ✓</span>`;
    } else if (row.lastRevDaysAgo === null) {
        lastRevHtml = `<span class="as-overdue">Never</span>`;
    } else if (row.lastRevDaysAgo === 0) {
        lastRevHtml = `<span class="as-done">Today</span>`;
    } else if (row.lastRevDaysAgo === 1) {
        lastRevHtml = `1 day ago`;
    } else if (row.lastRevDaysAgo > 30) {
        lastRevHtml = `<span class="as-overdue">${row.lastRevDaysAgo} days ago</span>`;
    } else {
        lastRevHtml = `${row.lastRevDaysAgo} days ago`;
    }

    tr.innerHTML = `
        <td class="as-td-check" onclick="event.stopPropagation()"><input type="checkbox" class="as-row-check" ${isChecked ? 'checked' : ''}></td>
        <td><div class="as-td-name" title="${escAs(row.sectionTitle)}">${escAs(row.sectionTitle)}</div></td>
        <td><div class="as-td-file" title="${escAs(row.fileName)}">${escAs(row.fileName)}</div></td>
        <td class="as-td-editable"></td>
        <td class="as-td-editable"></td>
        <td><span class="as-pill" style="background:${profColor}18;color:${profColor};border:1px solid ${profColor}44;min-width:96px;justify-content:center;">${prof}</span></td>
        <td>
            <div style="display:inline-flex;align-items:center;gap:4px;vertical-align:middle;">
                <div class="as-prog-pill">
                    <div class="as-prog-cell" data-seg="1"></div>
                    <div class="as-prog-cell" data-seg="2"></div>
                    <div class="as-prog-cell" data-seg="3"></div>
                    <div class="as-prog-cell" data-seg="4"></div>
                </div>
                <span style="display:inline-flex;align-items:center;height:26px;padding:0 8px;border:1px solid ${barColor}44;background:${barColor}18;color:${barColor};border-radius:5px;font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:700;vertical-align:middle;">${row.progress}%</span>
            </div>
        </td>
        <td style="text-align:center"><span class="as-pill" style="border:1px solid var(--text-secondary);color:var(--text-secondary)">${row.revFilled}/${row.revTotal}</span></td>
        <td><span class="as-pill" style="border:1px solid var(--text-secondary);color:var(--text-secondary)">${lastRevHtml}</span></td>
    `;

    // Build diff dropdown
    const diffTd = tr.querySelectorAll('.as-td-editable')[0];
    diffTd.appendChild(asInlineDropdown(row, 'difficulty', ['Easy','Moderate','Challenging','Hard'], AS_DIFF_COLORS, tr));

    // Build prio dropdown
    const prioTd = tr.querySelectorAll('.as-td-editable')[1];
    prioTd.appendChild(asInlineDropdown(row, 'priority', ['Low','Medium','High','Critical'], AS_PRIO_COLORS, tr));

    // Checkbox handler
    const cb = tr.querySelector('.as-row-check');
    cb.addEventListener('change', (e) => { asToggleCheck(key, e.target.checked); });

    // Progress pill
    const progPill = tr.querySelector('.as-prog-pill');
    if (progPill) {
        const pct = row.progress;
        const colors = ['#3b82f6','#f59e0b','#f97316','#22c55e'];
        const filled = pct >= 100 ? 4 : pct >= 75 ? 3 : pct >= 50 ? 2 : pct >= 25 ? 1 : 0;
        const color = colors[filled > 0 ? filled - 1 : 0];
        progPill.querySelectorAll('.as-prog-cell').forEach((cell, i) => {
            cell.style.background = i < filled ? color : '';
        });
    }

    tr.addEventListener('click', () => {
        document.querySelectorAll('.as-table tbody tr').forEach(r => r.classList.remove('as-selected'));
        tr.classList.add('as-selected');
        asOpenPreview(row);
    });
    tbody.appendChild(tr);
}

function asAppendLoadMore(tbody) {
    if (asState.renderOffset >= asState.filteredRows.length) return;
    const remaining = asState.filteredRows.length - asState.renderOffset;
    const next = Math.min(AS_BATCH_SIZE, remaining);
    const tr = document.createElement('tr');
    tr.id = 'asLoadMoreRow';
    tr.innerHTML = `<td colspan="9" style="text-align:center;padding:14px;">
        <button onclick="asLoadMore()" style="padding:7px 22px;border-radius:6px;border:1px solid var(--border);background:var(--bg-secondary);color:var(--text-primary);cursor:pointer;font-size:13px;">
            Load ${next} more &nbsp;(${remaining} remaining)
        </button>
    </td>`;
    tbody.appendChild(tr);
}

function asLoadMore() {
    const tbody = document.getElementById('asTableBody');
    if (!tbody) return;
    const existing = document.getElementById('asLoadMoreRow');
    if (existing) existing.remove();
    const batch = asState.filteredRows.slice(asState.renderOffset, asState.renderOffset + AS_BATCH_SIZE);
    asState.renderOffset += batch.length;
    batch.forEach(row => asRenderRow(tbody, row));
    asAppendLoadMore(tbody);
}

function asUpdateCount() {
    const el = document.getElementById('asCount');
    if (el) el.textContent = `${asState.filteredRows.length} section${asState.filteredRows.length !== 1 ? 's' : ''}`;
}

function escAs(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ===== INLINE DROPDOWN FOR DIFF/PRIO =====
function asInlineDropdown(row, field, options, colorMap, tr) {
    const wrap = document.createElement('div');
    wrap.className = 'as-inline-dd-wrap';

    const val = row[field];
    const color = colorMap[val] || '#94a3b8';

    const pill = document.createElement('span');
    pill.className = 'as-pill as-pill-btn';
    pill.style.cssText = `background:${color}18;color:${color};border:1px solid ${color}44;cursor:pointer;user-select:none;min-width:96px;justify-content:center;`;
    pill.innerHTML = `${escAs(val)} <span style="font-size:8px">▼</span>`;

    const menu = document.createElement('div');
    menu.className = 'as-inline-dd-menu';
    options.forEach(opt => {
        const c = colorMap[opt] || '#94a3b8';
        const item = document.createElement('div');
        item.className = 'as-inline-dd-item' + (opt === val ? ' selected' : '');
        item.style.cssText = `color:${c}`;
        item.innerHTML = opt;
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            wrap.classList.remove('active');
            if (opt !== row[field]) {
                asSaveDiffPrio(row, field, opt);
                row[field] = opt;
                // Re-render just this row
                const idx = asState.filteredRows.indexOf(row);
                const trs = document.querySelectorAll('.as-table tbody tr');
                if (trs[idx]) {
                    const wasSelected = trs[idx].classList.contains('as-selected');
                    // Re-render row by removing and re-appending
                    asRenderTable();
                    if (wasSelected && asPvState.row === row) {
                        document.querySelectorAll('.as-table tbody tr')[idx]?.classList.add('as-selected');
                    }
                }
            }
        });
        menu.appendChild(item);
    });

    pill.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.as-inline-dd-wrap.active').forEach(w => { if (w !== wrap) w.classList.remove('active'); });
        if (!wrap.classList.contains('active')) {
            const rect = pill.getBoundingClientRect();
            menu.style.top = (rect.bottom + 4) + 'px';
            menu.style.left = rect.left + 'px';
        }
        wrap.classList.toggle('active');
    });

    wrap.appendChild(pill);
    wrap.appendChild(menu);
    return wrap;
}

function asSaveDiffPrio(row, field, value) {
    try {
        const storeRaw = localStorage.getItem(`c5_sectionStore_${row.fileId}`);
        if (!storeRaw) return;
        const store = JSON.parse(storeRaw);
        const data = store[String(row.sectionId)] || store[row.sectionId];
        if (!data) return;
        data[field] = value;
        store[String(row.sectionId)] = data;
        localStorage.setItem(`c5_sectionStore_${row.fileId}`, JSON.stringify(store));
    } catch(e) {}
}

// Close inline dropdowns on outside click
document.addEventListener('click', () => {
    document.querySelectorAll('.as-inline-dd-wrap.active').forEach(w => w.classList.remove('active'));
});

// ===== PREVIEW PANEL =====
const AS_TABS = ['notes','memorize','visualize','analyze','test','reference'];
const AS_LEVELS = [
    { id: 'crisp',      label: 'Crisp',      icon: '⚡' },
    { id: 'conceptual', label: 'Conceptual', icon: '💡' },
    { id: 'detailed',   label: 'Detailed',   icon: '📚' },
    { id: 'syntopical', label: 'Syntopical', icon: '🔗' },
];

const asPvState = {
    row: null,
    c3Data: null,
    tab: 'notes',
    levelId: 'crisp',
    versionIdx: 0,
};

function asGetC5Data(row) {
    try {
        const store = JSON.parse(localStorage.getItem(`c5_sectionStore_${row.fileId}`) || '{}');
        return store[String(row.sectionId)] || store[row.sectionId] || null;
    } catch(e) { return null; }
}

function asSaveC5Data(row, data) {
    try {
        const store = JSON.parse(localStorage.getItem(`c5_sectionStore_${row.fileId}`) || '{}');
        store[String(row.sectionId)] = data;
        localStorage.setItem(`c5_sectionStore_${row.fileId}`, JSON.stringify(store));
    } catch(e) {}
}

function asIsStudied(row) {
    const data = asGetC5Data(row);
    if (!data) return false;
    if (data.isCompleted) return true;
    const today = new Date(); today.setHours(0,0,0,0);
    return data.revisions?.some(r => {
        if (!r.date || !r.year) return false;
        const [day, month] = r.date.split('/').map(Number);
        const d = new Date(r.year, month-1, day); d.setHours(0,0,0,0);
        return d.getTime() === today.getTime();
    }) || false;
}

function asMarkStudied(row) {
    const data = asGetC5Data(row);
    if (!data) return;

    const today = new Date(); today.setHours(0,0,0,0);

    const todayIndex = data.revisions.findIndex(r => {
        if (!r.date || !r.year) return false;
        const [day, month] = r.date.split('/').map(Number);
        const d = new Date(r.year, month-1, day); d.setHours(0,0,0,0);
        return d.getTime() === today.getTime();
    });

    const alreadyHasToday = todayIndex !== -1;

    if (!alreadyHasToday) {
        // === MARK AS STUDIED — fill next revision slot ===
        const lastFilledIndex = data.revisions.reduce((last, r, i) => r.date !== null ? i : last, -1);
        const nextIndex = lastFilledIndex + 1;
        if (nextIndex < data.revisions.length) {
            const day   = String(today.getDate()).padStart(2,'0');
            const month = String(today.getMonth()+1).padStart(2,'0');
            const year  = today.getFullYear();
            data.revisions[nextIndex] = { date: `${day}/${month}`, year };
        }
    } else {
        // === UNMARK — remove today's date ===
        data.revisions[todayIndex] = { date: null, year: null };
    }

    asSaveC5Data(row, data);

    // Update row in allRows
    const allRow = asState.allRows.find(r => r.fileId === row.fileId && r.sectionId === row.sectionId);
    if (allRow) {
        allRow.revFilled = data.revisions.filter(r => r.date !== null).length;
        allRow.progress = asCalcProgress(data);
        allRow.lastRevDaysAgo = asCalcDaysAgo(asGetLastRevDate(data.revisions));
    }

    const nowStudied = !alreadyHasToday;
    const iframe = document.querySelector('.as-pv-iframe');
    if (iframe) iframe.contentWindow.postMessage({ type: 'pvStudiedUpdate', isStudied: nowStudied }, '*');

    asRender();

    // Re-select the row
    const idx = asState.filteredRows.findIndex(r => r.fileId === row.fileId && r.sectionId === row.sectionId);
    if (idx !== -1) {
        const trs = document.querySelectorAll('.as-table tbody tr');
        if (trs[idx]) trs[idx].classList.add('as-selected');
        asPvState.row = asState.filteredRows[idx];
    }
}

function asNavPreview(dir) {
    const rows = asState.filteredRows;
    const cur = asPvState.row;
    const idx = rows.indexOf(cur);
    const newIdx = dir === 'prev' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= rows.length) return;
    const newRow = rows[newIdx];

    // Update table highlight
    document.querySelectorAll('.as-table tbody tr').forEach(tr => tr.classList.remove('as-selected'));
    const trs = document.querySelectorAll('.as-table tbody tr');
    if (trs[newIdx]) trs[newIdx].classList.add('as-selected');

    asOpenPreview(newRow);
}

function asOpenPreview(row) {
    const panel = document.getElementById('asPreview');
    if (!panel) return;

    asPvState.row = row;
    panel.style.display = 'flex';

    const theme = document.documentElement.getAttribute('data-theme') || 'dark';
    const idx = asState.filteredRows.indexOf(row);
    const isStudied = asIsStudied(row);
    const isFirst = idx === 0;
    const isLast = idx === asState.filteredRows.length - 1;

    const sendLoad = (iframe) => {
        iframe.contentWindow.postMessage({
            type: 'pvLoad',
            fileId: row.fileId,
            sectionId: row.sectionId,
            sectionTitle: row.sectionTitle,
            theme, isStudied, isFirst, isLast
        }, '*');
    };

    let iframe = panel.querySelector('iframe.as-pv-iframe');

    if (!iframe) {
        panel.innerHTML = '';
        iframe = document.createElement('iframe');
        iframe.className = 'as-pv-iframe';
        iframe.style.cssText = 'width:100%;height:100%;border:none;border-radius:12px;';
        panel.appendChild(iframe);

        const onMsg = (e) => {
            if (e.data?.type === 'pvReady' && e.source === iframe.contentWindow) {
                window.removeEventListener('message', onMsg);
                sendLoad(iframe);
            }
        };
        window.addEventListener('message', onMsg);
        iframe.src = 'preview.html';
    } else {
        sendLoad(iframe);
    }
}

function asClosePreview() {
    const panel = document.getElementById('asPreview');
    if (panel) panel.style.display = 'none';
    document.querySelectorAll('.as-table tbody tr').forEach(tr => tr.classList.remove('as-selected'));
    asPvState.row = null;
}

// Handle messages from preview iframe
window.addEventListener('message', (e) => {
    const asLayer = document.getElementById('asLayer');
    if (!asLayer || !asLayer.classList.contains('active')) return;
    if (e.data?.type === 'pvNav') {
        asNavPreview(e.data.dir);
    } else if (e.data?.type === 'pvStudied') {
        if (asPvState.row) asMarkStudied(asPvState.row);
    } else if (e.data?.type === 'pvClose') {
        asClosePreview();
    }
});




// ===== SORT CLICK (three-state) =====
function asSortBy(col) {
    if (asState.sortCol === col) {
        if (asState.sortDir === 'asc') {
            asState.sortDir = 'desc';
        } else if (asState.sortDir === 'desc') {
            asState.sortCol = null;
            asState.sortDir = null;
        }
    } else {
        asState.sortCol = col;
        asState.sortDir = 'asc';
    }
    asRenderHeaders();
    asRender();
}

function asRenderHeaders() {
    const colDefs = {
        section: 'Section', file: 'File', diff: 'Difficulty', prio: 'Priority',
        prof: 'Proficiency', progress: 'Progress', rev: 'Rev Count', last: 'Last Revised'
    };
    Object.entries(colDefs).forEach(([col, label]) => {
        const th = document.getElementById(`asTh_${col}`);
        if (!th) return;
        const isSorted = asState.sortCol === col;
        th.classList.toggle('sorted', isSorted);
        if (isSorted) {
            th.innerHTML = `<span class="as-th-label">${label} <span class="as-sort-arrow">${asState.sortDir === 'asc' ? '▲' : '▼'}</span></span>`;
        } else {
            th.innerHTML = label;
        }
    });
}

// ===== FILTER CHIPS =====
function asToggleDiff(val) {
    const idx = asState.filterDiff.indexOf(val);
    if (idx === -1) asState.filterDiff.push(val);
    else asState.filterDiff.splice(idx, 1);
    asRenderFilterChips();
    asRender();
}

function asTogglePrio(val) {
    const idx = asState.filterPrio.indexOf(val);
    if (idx === -1) asState.filterPrio.push(val);
    else asState.filterPrio.splice(idx, 1);
    asRenderFilterChips();
    asRender();
}

function asRenderFilterChips() {
    ['Easy','Moderate','Challenging','Hard'].forEach(d => {
        const el = document.getElementById(`asChipDiff_${d}`);
        if (el) el.classList.toggle('active', asState.filterDiff.includes(d));
    });
    ['Low','Medium','High','Critical'].forEach(p => {
        const el = document.getElementById(`asChipPrio_${p}`);
        if (el) el.classList.toggle('active', asState.filterPrio.includes(p));
    });
}

function asOnFileFilter(e) {
    asState.filterFile = e.target.value;
    asRender();
}

function asPopulateFileSelect() {
    const sel = document.getElementById('asFileSelect');
    if (!sel) return;
    sel.innerHTML = '<option value="all">All Files</option>';
    const seen = new Set();
    asState.allRows.forEach(row => {
        if (!seen.has(row.fileId)) {
            seen.add(row.fileId);
            const opt = document.createElement('option');
            opt.value = row.fileId;
            opt.textContent = row.fileName;
            sel.appendChild(opt);
        }
    });
}

// ===== PROGRESS DISPLAY =====
function asRenderProgress() {
    const el = document.getElementById('asProgressDisplay');
    if (!el) return;
    if (typeof getGlobalRevisionProgress !== 'function') return;
    const { total, filled, pct } = getGlobalRevisionProgress();
    const remaining = total - filled;
    el.innerHTML = `
        <span class="hm-prog-label">Completed</span>
        <span class="hm-prog-nums">${filled}/${total}</span>
        <span class="hm-prog-pct">${pct}%</span>
        <div class="hm-row2-divider"></div>
        <span class="hm-prog-label">Remaining</span>
        <span class="hm-prog-pct">${remaining}</span>
    `;
}

// ===== AUTO REFRESH =====
let asRefreshBound = false;
function asSetupRefresh() {
    if (asRefreshBound) return;
    asRefreshBound = true;

    // Refresh from same-window messages (e.g. iframe saves)
    window.addEventListener('message', (e) => {
        if (e.data?.type === 'ramDataSaved') {
            const layer = document.getElementById('asLayer');
            if (layer && layer.classList.contains('active')) {
                asLoadAllRows();
                asApplyFilters();
                asApplySort();
                asRenderTable();
                asUpdateCount();
            }
        }
    });

    // Refresh from other tabs (fileview, column3, column5 writing to localStorage)
    window.addEventListener('storage', (e) => {
        if (!e.key || !e.key.startsWith('c5_sectionStore_')) return;
        const layer = document.getElementById('asLayer');
        if (!layer || !layer.classList.contains('active')) return;

        // Re-read the changed file's data into allRows
        const fileId = e.key.replace('c5_sectionStore_', '');
        let newStore;
        try { newStore = JSON.parse(e.newValue || '{}'); } catch(err) { return; }

        asState.allRows.forEach(row => {
            if (row.fileId !== fileId) return;
            const data = newStore[String(row.sectionId)] || newStore[row.sectionId];
            if (!data) return;
            row.isCompleted = data.isCompleted || false;
            row.revFilled = data.revisions.filter(r => r.date !== null).length;
            row.progress = asCalcProgress(data);
            row.lastRevDaysAgo = asCalcDaysAgo(asGetLastRevDate(data.revisions));
        });

        asApplyFilters();
        asApplySort();
        asRenderTable();
        asUpdateCount();

        // Update preview button if the changed section is currently open
        if (asPvState.row && asPvState.row.fileId === fileId) {
            const sid = asPvState.row.sectionId;
            const data = newStore[String(sid)] || newStore[sid];
            if (data) {
                const today = new Date(); today.setHours(0,0,0,0);
                const studiedToday = data.revisions?.some(r => {
                    if (!r.date || !r.year) return false;
                    const [day, month] = r.date.split('/').map(Number);
                    const d = new Date(r.year, month-1, day); d.setHours(0,0,0,0);
                    return d.getTime() === today.getTime();
                }) || false;
                const isStudied = data.isCompleted || studiedToday;
                const iframe = document.querySelector('.as-pv-iframe');
                if (iframe) iframe.contentWindow.postMessage({ type: 'pvStudiedUpdate', isStudied }, '*');
            }
        }
    });
}

// ===== SHOW / INIT =====
function showAllSections() {
    setActiveNav('navAllSections');
    ['dashboardLayer','graphsLayer','smartDeskLayer','settingsLayer','diaryLayer','playlistsLayer','campaignLayer','allFilesLayer'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.remove('active');
    });
    document.getElementById('mainPage').classList.remove('active');
    document.getElementById('asLayer').classList.add('active');

    // Reload data each time page is shown
    asLoadAllRows();

    // If preview is open, refresh its studied button with fresh data
    if (asPvState.row) {
        const isStudied = asIsStudied(asPvState.row);
        const iframe = document.querySelector('.as-pv-iframe');
        if (iframe) iframe.contentWindow.postMessage({ type: 'pvStudiedUpdate', isStudied }, '*');
    }

    asState.filterDiff = [];
    asState.filterPrio = [];
    asState.filterFile = 'all';
    asState.sortCol = null;
    asState.sortDir = null;
    asState.searchQuery = '';
    asState.checkedSections.clear();

    asRenderProgress();
    asPopulateFileSelect();
    const sel = document.getElementById('asFileSelect');
    if (sel) sel.value = 'all';
    asRenderFilterChips();
    asRenderHeaders();
    asRender();
    asUpdatePlaylistBtn();

    // Bind search input
    const searchInput = document.getElementById('asSearchInput');
    if (searchInput) {
        searchInput.value = '';
        searchInput.oninput = asOnSearch;
    }

    asSetupRefresh();

    // Close preview dropdowns on outside click
    document.addEventListener('mousedown', (e) => {
        if (!e.target.closest('.as-preview .c3-version-dropdown-wrap')) {
            document.querySelectorAll('.as-preview .c3-version-dropdown-wrap.active')
                .forEach(w => w.classList.remove('active'));
        }
    }, { capture: true });
}