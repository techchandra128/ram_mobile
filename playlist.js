// playlist.js — Playlists Layer

// ===== STATE =====
let plCurrentView = 'grid';
let plCurrentSort = { by: 'name', dir: 'asc' };

// ===== LOAD / SAVE =====
function plLoadPlaylists() {
    try { return JSON.parse(localStorage.getItem('ram_playlists') || '[]'); }
    catch(e) { return []; }
}

function plSavePlaylists(playlists) {
    RAM_SYNC.setItem('ram_playlists', JSON.stringify(playlists));
}

// ===== PROGRESS =====
function plGetProgress(pl) {
    if (!pl.sections || pl.sections.length === 0) return 0;
    let total = 0, count = 0;
    pl.sections.forEach(ref => {
        try {
            const store = JSON.parse(localStorage.getItem(`c5_sectionStore_${ref.fileId}`) || '{}');
            const data = store[String(ref.sectionId)] || store[ref.sectionId];
            if (!data) { count++; return; }
            if (data.isCompleted) { total += 100; count++; return; }
            const activated = data.activatedCount || 4;
            const filled = data.revisions.slice(0, activated).filter(r => r.date !== null).length;
            total += Math.round((filled / activated) * 100);
            count++;
        } catch(e) { count++; }
    });
    return count === 0 ? 0 : Math.round(total / count);
}

// ===== SORT =====
function plSortArray(arr) {
    arr.sort((a, b) => {
        let va = plCurrentSort.by === 'progress' ? (a.progress || 0) : a.name.toLowerCase();
        let vb = plCurrentSort.by === 'progress' ? (b.progress || 0) : b.name.toLowerCase();
        const cmp = typeof va === 'string' ? va.localeCompare(vb) : va - vb;
        return plCurrentSort.dir === 'asc' ? cmp : -cmp;
    });
}

function plSortItems(by, dir) {
    plCurrentSort = { by, dir };
    document.getElementById('plSortDropdown').classList.remove('active');
    plRender();
}

function plToggleSort() {
    document.getElementById('plSortDropdown').classList.toggle('active');
}

// ===== VIEW SWITCH =====
function plSwitchView(view) {
    plCurrentView = view;
    document.getElementById('plViewBtnGrid').classList.toggle('active', view === 'grid');
    document.getElementById('plViewBtnList').classList.toggle('active', view === 'list');
    plRender();
}

// ===== SHOW =====
function showPlaylists() {
    setActiveNav('navPlaylists');
    ['dashboardLayer','graphsLayer','smartDeskLayer','settingsLayer','diaryLayer','asLayer','campaignLayer'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.remove('active');
    });
    document.getElementById('mainPage').classList.remove('active');
    document.getElementById('playlistsLayer').classList.add('active');
    plRender();
}

// ===== RENDER =====
function plRender() {
    const grid = document.getElementById('plFilesGrid');
    const list = document.getElementById('plFilesList');
    if (!grid || !list) return;

    if (plCurrentView === 'grid') {
        plRenderGrid();
        grid.style.cssText = 'display:flex !important; flex-wrap:wrap; gap:16px;';
        list.style.cssText = 'display:none !important;';
    } else {
        plRenderList();
        list.style.cssText = 'display:flex !important; flex-direction:column; gap:6px;';
        grid.style.cssText = 'display:none !important;';
    }
}

function plRenderGrid() {
    const container = document.getElementById('plFilesGrid');
    if (!container) return;
    container.innerHTML = '';

    const playlists = plLoadPlaylists().map(pl => ({ ...pl, progress: plGetProgress(pl) }));
    plSortArray(playlists);

    if (playlists.length === 0) {
        container.innerHTML = '<div class="empty-state">No playlists yet. Go to All Sections, check sections, and create a playlist.</div>';
        return;
    }

    playlists.forEach(pl => {
        const pct = pl.progress || 0;
        const pClass = getProgressClass(pct);
        const deg = degFromPct(pct);

        const wrapper = document.createElement('div');
        wrapper.className = 'grid-item';

        const rect = document.createElement('div');
        rect.className = 'progress-rect ' + pClass;
        rect.style.setProperty('--deg', deg);

        const inner = document.createElement('div');
        inner.className = 'progress-rect-inner';
        inner.textContent = pct + '%';
        rect.appendChild(inner);

        const editBtn = document.createElement('button');
        editBtn.className = 'grid-edit-btn';
        editBtn.textContent = '✎';
        editBtn.onclick = (e) => { e.stopPropagation(); plShowEditModal(pl); };
        rect.appendChild(editBtn);

        rect.onclick = (e) => {
            if (e.target !== editBtn) plOpenPlaylist(pl);
        };

        const nameEl = document.createElement('div');
        nameEl.className = 'grid-item-name';
        nameEl.textContent = pl.name;
        nameEl.title = pl.name;

        wrapper.appendChild(rect);
        wrapper.appendChild(nameEl);
        container.appendChild(wrapper);
    });
}

function plRenderList() {
    const container = document.getElementById('plFilesList');
    if (!container) return;
    container.innerHTML = '';

    const playlists = plLoadPlaylists().map(pl => ({ ...pl, progress: plGetProgress(pl) }));
    plSortArray(playlists);

    if (playlists.length === 0) {
        container.innerHTML = '<div class="empty-state">No playlists yet. Go to All Sections, check sections, and create a playlist.</div>';
        return;
    }

    playlists.forEach(pl => {
        const pct = pl.progress || 0;
        const pClass = getProgressClass(pct);
        const deg = degFromPct(pct);
        const color = getProgressColor(pct);

        const row = document.createElement('div');
        row.className = 'list-item';

        const iconWrap = document.createElement('div');
        iconWrap.className = 'list-icon-wrap';

        const rect = document.createElement('div');
        rect.className = 'list-rect ' + pClass;
        rect.style.setProperty('--deg', deg);
        const inner = document.createElement('div');
        inner.className = 'list-rect-inner';
        inner.textContent = pct + '%';
        inner.style.color = color;
        rect.appendChild(inner);
        iconWrap.appendChild(rect);

        const nameEl = document.createElement('div');
        nameEl.className = 'list-item-name';
        nameEl.textContent = pl.name;
        nameEl.title = pl.name;

        const bar = document.createElement('div');
        bar.className = 'progress-bar';
        for (let i = 1; i <= 4; i++) {
            const seg = document.createElement('div');
            seg.className = 'seg seg-' + i;
            bar.appendChild(seg);
        }
        updateProgressBar(bar, pct);

        const pctEl = document.createElement('div');
        pctEl.className = 'list-pct';
        pctEl.textContent = pct + '%';
        pctEl.style.color = color;

        const editBtn = document.createElement('button');
        editBtn.className = 'list-edit-btn';
        editBtn.textContent = '✎';
        editBtn.onclick = (e) => { e.stopPropagation(); plShowEditModal(pl); };

        row.onclick = (e) => {
            if (e.target.closest('.list-edit-btn')) return;
            plOpenPlaylist(pl);
        };

        row.appendChild(iconWrap);
        row.appendChild(nameEl);
        row.appendChild(bar);
        row.appendChild(pctEl);
        row.appendChild(editBtn);
        container.appendChild(row);
    });
}

// ===== OPEN PLAYLIST =====
function plOpenPlaylist(pl) {
    const frame = document.getElementById('fileFrame');
    const fileLayer = document.getElementById('fileLayer');
    const url = `fileview.html?playlistId=${encodeURIComponent(pl.id)}&fileName=${encodeURIComponent(pl.name)}`;
    frame.src = url;
    fileLayer.classList.add('active');
    const theme = document.documentElement.getAttribute('data-theme') || 'dark';
    frame.onload = () => {
        frame.contentWindow.postMessage({ type: 'setTheme', theme }, '*');
    };
}

// ===== EDIT / DELETE =====
function plShowEditModal(pl) {
    const newName = prompt('Rename playlist (leave empty to delete):', pl.name);
    if (newName === null) return;
    if (newName.trim() === '') {
        if (!confirm(`Delete playlist "${pl.name}"? This won't affect original sections.`)) return;
        const playlists = plLoadPlaylists().filter(p => p.id !== pl.id);
        plSavePlaylists(playlists);
        plRender();
        return;
    }
    const playlists = plLoadPlaylists();
    const idx = playlists.findIndex(p => p.id === pl.id);
    if (idx !== -1) {
        playlists[idx].name = newName.trim();
        plSavePlaylists(playlists);
        plRender();
    }
}
