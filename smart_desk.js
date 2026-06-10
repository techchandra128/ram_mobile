// smart_desk.js

// ===== STATE =====
let sdShortcuts = [];
let sdPlaylistShortcuts = [];
let sdCurrentView = 'grid';
let sdCurrentSort = { by: 'name', dir: 'asc' };
let sdCurrentModalType = 'files';

// ===== LOAD / SAVE =====
function loadSmartDesk() {
    const saved = localStorage.getItem('ram_smartDesk');
    sdShortcuts = saved ? JSON.parse(saved) : [];
    const savedPl = localStorage.getItem('ram_smartDesk_playlists');
    sdPlaylistShortcuts = savedPl ? JSON.parse(savedPl) : [];
}

function saveSmartDesk() {
    RAM_SYNC.setItem('ram_smartDesk', JSON.stringify(sdShortcuts));
    RAM_SYNC.setItem('ram_smartDesk_playlists', JSON.stringify(sdPlaylistShortcuts));
}

// ===== COLLECT ALL FILES FROM FILESYSTEM (flat) =====
function sdCollectAllFiles(cur, result) {
    if (!result) result = [];
    for (const [name, item] of Object.entries(cur)) {
        if (item.type === 'file' && item.fileId) {
            result.push({ name, fileId: item.fileId, progress: item.progress || 0 });
        } else if (item.type === 'folder' && item.contents) {
            sdCollectAllFiles(item.contents, result);
        }
    }
    return result;
}

// ===== GET FILE INFO BY FILEID =====
function sdGetFileInfo(fileId) {
    const allFiles = sdCollectAllFiles(fileSystem);
    return allFiles.find(f => f.fileId === fileId) || null;
}

// ===== SORT =====
function sdSortArray(arr) {
    arr.sort((a, b) => {
        let va = sdCurrentSort.by === 'progress' ? (a.progress || 0) : a.name.toLowerCase();
        let vb = sdCurrentSort.by === 'progress' ? (b.progress || 0) : b.name.toLowerCase();
        const cmp = typeof va === 'string' ? va.localeCompare(vb) : va - vb;
        return sdCurrentSort.dir === 'asc' ? cmp : -cmp;
    });
}

function sdSortItems(by, dir) {
    sdCurrentSort = { by, dir };
    document.getElementById('sdSortDropdown').classList.remove('active');
    sdRender();
}

function sdToggleSort() {
    document.getElementById('sdSortDropdown').classList.toggle('active');
}

// ===== VIEW SWITCH =====
function sdSwitchView(view) {
    sdCurrentView = view;
    document.getElementById('sdViewBtnGrid').classList.toggle('active', view === 'grid');
    document.getElementById('sdViewBtnList').classList.toggle('active', view === 'list');
    sdRender();
}

// ===== SHOW SMART DESK =====
function showSmartDesk() {
    setActiveNav('navSmartDesk');
    document.getElementById('dashboardLayer').classList.remove('active');
    document.getElementById('graphsLayer').classList.remove('active');
    document.getElementById('mainPage').classList.remove('active');
    document.getElementById('asLayer').classList.remove('active');
    document.getElementById('diaryLayer').classList.remove('active');
    document.getElementById('playlistsLayer').classList.remove('active');
    document.getElementById('campaignLayer').classList.remove('active');
    document.getElementById('allFilesLayer').classList.remove('active');
    document.getElementById('settingsLayer').classList.remove('active');
    document.getElementById('smartDeskLayer').classList.add('active');
    loadSmartDesk();
    sdRender();
}

// ===== RENDER =====
function sdRender() {
    sdRenderFiles();
    sdRenderPlaylists();
}

function sdRenderFiles() {
    const grid = document.getElementById('sdFilesGrid');
    const list = document.getElementById('sdFilesList');
    if (!grid || !list) return;

    if (sdCurrentView === 'grid') {
        sdRenderFilesGrid();
        grid.style.cssText = 'display:flex !important; flex-wrap:wrap; gap:16px;';
        list.style.cssText = 'display:none !important;';
    } else {
        sdRenderFilesList();
        list.style.cssText = 'display:flex !important; flex-direction:column; gap:6px;';
        grid.style.cssText = 'display:none !important;';
    }
}

function sdRenderPlaylists() {
    const grid = document.getElementById('sdPlaylistsGrid');
    const list = document.getElementById('sdPlaylistsList');
    if (!grid || !list) return;

    if (sdCurrentView === 'grid') {
        sdRenderPlaylistsGrid();
        grid.style.cssText = 'display:flex !important; flex-wrap:wrap; gap:16px;';
        list.style.cssText = 'display:none !important;';
    } else {
        sdRenderPlaylistsList();
        list.style.cssText = 'display:flex !important; flex-direction:column; gap:6px;';
        grid.style.cssText = 'display:none !important;';
    }
}

// ===== RENDER FILES GRID =====
function sdRenderFilesGrid() {
    const container = document.getElementById('sdFilesGrid');
    if (!container) return;
    container.innerHTML = '';

    const files = sdShortcuts.map(fid => sdGetFileInfo(fid)).filter(Boolean);
    sdSortArray(files);

    if (files.length === 0) {
        container.innerHTML = '<div class="empty-state">No files added. Click + to add.</div>';
        return;
    }

    files.forEach(item => {
        const pct = item.progress || 0;
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
        editBtn.onclick = (e) => { e.stopPropagation(); showEditModal(item.name, 'file'); };
        rect.appendChild(editBtn);

        rect.onclick = (e) => {
            if (e.target !== editBtn) sdOpenFile(item.fileId, item.name);
        };

        wrapper.appendChild(rect);

        const nameEl = document.createElement('div');
        nameEl.className = 'grid-item-name';
        nameEl.textContent = item.name;
        nameEl.title = item.name;
        wrapper.appendChild(nameEl);

        container.appendChild(wrapper);
    });
}

// ===== RENDER FILES LIST =====
function sdRenderFilesList() {
    const container = document.getElementById('sdFilesList');
    if (!container) return;
    container.innerHTML = '';

    const files = sdShortcuts.map(fid => sdGetFileInfo(fid)).filter(Boolean);
    sdSortArray(files);

    if (files.length === 0) {
        container.innerHTML = '<div class="empty-state">No files added. Click + to add.</div>';
        return;
    }

    files.forEach(item => {
        const pct = item.progress || 0;
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

        row.onclick = (e) => {
            if (e.target.closest('.list-edit-btn')) return;
            sdOpenFile(item.fileId, item.name);
        };

        const nameEl = document.createElement('div');
        nameEl.className = 'list-item-name';
        nameEl.textContent = item.name;
        nameEl.title = item.name;

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
        editBtn.onclick = (e) => { e.stopPropagation(); showEditModal(item.name, 'file'); };

        row.appendChild(iconWrap);
        row.appendChild(nameEl);
        row.appendChild(bar);
        row.appendChild(pctEl);
        row.appendChild(editBtn);

        container.appendChild(row);
    });
}

// ===== RENDER PLAYLISTS GRID =====
function sdRenderPlaylistsGrid() {
    const container = document.getElementById('sdPlaylistsGrid');
    if (!container) return;
    container.innerHTML = '';

    const allPlaylists = JSON.parse(localStorage.getItem('ram_playlists') || '[]');
    const myPlaylists = sdPlaylistShortcuts.map(pid => allPlaylists.find(p => p.id === pid)).filter(Boolean);
    const withProgress = myPlaylists.map(pl => ({ ...pl, progress: plGetProgress(pl) }));
    sdSortArray(withProgress);

    if (withProgress.length === 0) {
        container.innerHTML = '<div class="empty-state">No playlists added. Click + to add.</div>';
        return;
    }

    withProgress.forEach(pl => {
        const pct = pl.progress || 0;
        const pClass = getProgressClass(pct);
        const deg = degFromPct(pct);

        const wrapper = document.createElement('div');
        wrapper.className = 'grid-item pl-card';

        const rect = document.createElement('div');
        rect.className = 'progress-rect ' + pClass;
        rect.style.setProperty('--deg', deg);

        const inner = document.createElement('div');
        inner.className = 'progress-rect-inner';
        inner.textContent = pct + '%';
        rect.appendChild(inner);

        rect.onclick = () => sdOpenPlaylist(pl.id, pl.name);

        wrapper.appendChild(rect);

        const nameEl = document.createElement('div');
        nameEl.className = 'grid-item-name';
        nameEl.textContent = pl.name;
        nameEl.title = pl.name;
        wrapper.appendChild(nameEl);

        container.appendChild(wrapper);
    });
}

// ===== RENDER PLAYLISTS LIST =====
function sdRenderPlaylistsList() {
    const container = document.getElementById('sdPlaylistsList');
    if (!container) return;
    container.innerHTML = '';

    const allPlaylists = JSON.parse(localStorage.getItem('ram_playlists') || '[]');
    const myPlaylists = sdPlaylistShortcuts.map(pid => allPlaylists.find(p => p.id === pid)).filter(Boolean);
    const withProgress = myPlaylists.map(pl => ({ ...pl, progress: plGetProgress(pl) }));
    sdSortArray(withProgress);

    if (withProgress.length === 0) {
        container.innerHTML = '<div class="empty-state">No playlists added. Click + to add.</div>';
        return;
    }

    withProgress.forEach(pl => {
        const pct = pl.progress || 0;
        const pClass = getProgressClass(pct);
        const deg = degFromPct(pct);
        const color = getProgressColor(pct);

        const row = document.createElement('div');
        row.className = 'list-item pl-card';

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

        row.onclick = () => sdOpenPlaylist(pl.id, pl.name);

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

        row.appendChild(iconWrap);
        row.appendChild(nameEl);
        row.appendChild(bar);
        row.appendChild(pctEl);

        container.appendChild(row);
    });
}

// ===== OPEN FILE FROM SMART DESK =====
function sdOpenFile(fileId, name) {
    const fileLayer = document.getElementById('fileLayer');
    const frame = document.getElementById('fileFrame');
    frame.src = 'fileview.html?fileId=' + fileId + '&fileName=' + encodeURIComponent(name);
    fileLayer.classList.add('active');
}

// ===== OPEN PLAYLIST FROM SMART DESK =====
function sdOpenPlaylist(playlistId, name) {
    const fileLayer = document.getElementById('fileLayer');
    const frame = document.getElementById('fileFrame');
    frame.src = 'fileview.html?playlistId=' + encodeURIComponent(playlistId) + '&fileName=' + encodeURIComponent(name);
    fileLayer.classList.add('active');
}

// ===== ADD MODAL =====
function sdShowAddModal(type) {
    sdCurrentModalType = type;
    const body = document.getElementById('sdAddModalBody');
    const title = document.getElementById('sdAddModalTitle');
    body.innerHTML = '';

    if (type === 'files') {
        title.textContent = 'Add Files to Smart Desk';
        const allFiles = sdCollectAllFiles(fileSystem);
        if (allFiles.length === 0) {
            body.innerHTML = '<div class="sd-modal-empty">No files in My Library yet.</div>';
        } else {
            allFiles.forEach(item => {
                const alreadyAdded = sdShortcuts.includes(item.fileId);
                const row = document.createElement('label');
                row.className = 'sd-modal-file-row';
                const cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.value = item.fileId;
                cb.checked = alreadyAdded;
                cb.disabled = alreadyAdded;
                const nameEl = document.createElement('span');
                nameEl.className = 'sd-modal-file-name';
                nameEl.textContent = item.name;
                if (alreadyAdded) nameEl.style.color = 'var(--text-muted)';
                row.appendChild(cb);
                row.appendChild(nameEl);
                body.appendChild(row);
            });
        }
    } else {
        title.textContent = 'Add Sets to Smart Desk';
        const allPlaylists = JSON.parse(localStorage.getItem('ram_playlists') || '[]');
        if (allPlaylists.length === 0) {
            body.innerHTML = '<div class="sd-modal-empty">No sets yet.</div>';
        } else {
            allPlaylists.forEach(pl => {
                const alreadyAdded = sdPlaylistShortcuts.includes(pl.id);
                const row = document.createElement('label');
                row.className = 'sd-modal-file-row';
                const cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.value = pl.id;
                cb.checked = alreadyAdded;
                cb.disabled = alreadyAdded;
                const nameEl = document.createElement('span');
                nameEl.className = 'sd-modal-file-name';
                nameEl.textContent = pl.name;
                if (alreadyAdded) nameEl.style.color = 'var(--text-muted)';
                row.appendChild(cb);
                row.appendChild(nameEl);
                body.appendChild(row);
            });
        }
    }

    document.getElementById('sdAddModal').classList.add('active');
}

function sdCloseAddModal() {
    document.getElementById('sdAddModal').classList.remove('active');
}

function sdConfirmAdd() {
    const checkboxes = document.querySelectorAll('#sdAddModalBody input[type="checkbox"]:checked:not(:disabled)');
    if (sdCurrentModalType === 'files') {
        checkboxes.forEach(cb => {
            if (!sdShortcuts.includes(cb.value)) sdShortcuts.push(cb.value);
        });
    } else {
        checkboxes.forEach(cb => {
            if (!sdPlaylistShortcuts.includes(cb.value)) sdPlaylistShortcuts.push(cb.value);
        });
    }
    saveSmartDesk();
    sdCloseAddModal();
    sdRender();
}

// ===== REMOVE MODAL =====
function sdShowRemoveModal(type) {
    sdCurrentModalType = type;
    const body = document.getElementById('sdRemoveModalBody');
    const title = document.getElementById('sdRemoveModalTitle');
    body.innerHTML = '';

    if (type === 'files') {
        title.textContent = 'Remove Files from Smart Desk';
        const files = sdShortcuts.map(fid => sdGetFileInfo(fid)).filter(Boolean);
        if (files.length === 0) {
            body.innerHTML = '<div class="sd-modal-empty">No files on Smart Desk yet.</div>';
        } else {
            files.forEach(item => {
                const row = document.createElement('label');
                row.className = 'sd-modal-file-row';
                const cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.value = item.fileId;
                const nameEl = document.createElement('span');
                nameEl.className = 'sd-modal-file-name';
                nameEl.textContent = item.name;
                row.appendChild(cb);
                row.appendChild(nameEl);
                body.appendChild(row);
            });
        }
    } else {
        title.textContent = 'Remove Sets from Smart Desk';
        const allPlaylists = JSON.parse(localStorage.getItem('ram_playlists') || '[]');
        const myPlaylists = sdPlaylistShortcuts.map(pid => allPlaylists.find(p => p.id === pid)).filter(Boolean);
        if (myPlaylists.length === 0) {
            body.innerHTML = '<div class="sd-modal-empty">No sets on Smart Desk yet.</div>';
        } else {
            myPlaylists.forEach(pl => {
                const row = document.createElement('label');
                row.className = 'sd-modal-file-row';
                const cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.value = pl.id;
                const nameEl = document.createElement('span');
                nameEl.className = 'sd-modal-file-name';
                nameEl.textContent = pl.name;
                row.appendChild(cb);
                row.appendChild(nameEl);
                body.appendChild(row);
            });
        }
    }

    document.getElementById('sdRemoveModal').classList.add('active');
}

function sdCloseRemoveModal() {
    document.getElementById('sdRemoveModal').classList.remove('active');
}

function sdConfirmRemove() {
    const checkboxes = document.querySelectorAll('#sdRemoveModalBody input[type="checkbox"]:checked');
    const toRemove = Array.from(checkboxes).map(cb => cb.value);
    if (sdCurrentModalType === 'files') {
        sdShortcuts = sdShortcuts.filter(fid => !toRemove.includes(fid));
    } else {
        sdPlaylistShortcuts = sdPlaylistShortcuts.filter(pid => !toRemove.includes(pid));
    }
    saveSmartDesk();
    sdCloseRemoveModal();
    sdRender();
}
