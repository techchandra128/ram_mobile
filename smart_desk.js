// smart_desk.js

// ===== STATE =====
let sdShortcuts = [];
let sdCurrentView = 'grid';
let sdCurrentSort = { by: 'name', dir: 'asc' };

// ===== LOAD / SAVE =====
function loadSmartDesk() {
    const saved = localStorage.getItem('ram_smartDesk');
    sdShortcuts = saved ? JSON.parse(saved) : [];
}

function saveSmartDesk() {
    localStorage.setItem('ram_smartDesk', JSON.stringify(sdShortcuts));
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
    document.getElementById('smartDeskLayer').classList.add('active');
    loadSmartDesk();
    sdRender();
}

// ===== RENDER =====
function sdRender() {
    const grid = document.getElementById('sdFilesGrid');
    const list = document.getElementById('sdFilesList');
    if (!grid || !list) return;

    if (sdCurrentView === 'grid') {
        sdRenderGrid();
        grid.style.cssText = 'display:flex !important; flex-wrap:wrap; gap:16px;';
        list.style.cssText = 'display:none !important;';
    } else {
        sdRenderList();
        list.style.cssText = 'display:flex !important; flex-direction:column; gap:6px;';
        grid.style.cssText = 'display:none !important;';
    }
}

function sdRenderGrid() {
    const container = document.getElementById('sdFilesGrid');
    if (!container) return;
    container.innerHTML = '';

    const files = sdShortcuts.map(fid => sdGetFileInfo(fid)).filter(Boolean);
    sdSortArray(files);

    if (files.length === 0) {
        container.innerHTML = '<div class="empty-state">No files added yet. Click + to add files from My Library.</div>';
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

function sdRenderList() {
    const container = document.getElementById('sdFilesList');
    if (!container) return;
    container.innerHTML = '';

    const files = sdShortcuts.map(fid => sdGetFileInfo(fid)).filter(Boolean);
    sdSortArray(files);

    if (files.length === 0) {
        container.innerHTML = '<div class="empty-state">No files added yet. Click + to add files from My Library.</div>';
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
            seg.className = 'seg seg-' + (i);
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

// ===== OPEN FILE FROM SMART DESK =====
function sdOpenFile(fileId, name) {
    const fileLayer = document.getElementById('fileLayer');
    const frame = document.getElementById('fileFrame');
    const encodedName = encodeURIComponent(name);
    frame.src = 'fileview.html?fileId=' + fileId + '&fileName=' + encodedName;
    fileLayer.classList.add('active');
}

// ===== ADD FILES MODAL =====
function sdShowAddModal() {
    const allFiles = sdCollectAllFiles(fileSystem);
    const body = document.getElementById('sdAddModalBody');
    body.innerHTML = '';

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

    document.getElementById('sdAddModal').classList.add('active');
}

function sdCloseAddModal() {
    document.getElementById('sdAddModal').classList.remove('active');
}

function sdConfirmAdd() {
    const checkboxes = document.querySelectorAll('#sdAddModalBody input[type="checkbox"]:checked:not(:disabled)');
    checkboxes.forEach(cb => {
        if (!sdShortcuts.includes(cb.value)) {
            sdShortcuts.push(cb.value);
        }
    });
    saveSmartDesk();
    sdCloseAddModal();
    sdRender();
}

// ===== REMOVE FILES MODAL =====
function sdShowRemoveModal() {
    const body = document.getElementById('sdRemoveModalBody');
    body.innerHTML = '';

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

    document.getElementById('sdRemoveModal').classList.add('active');
}

function sdCloseRemoveModal() {
    document.getElementById('sdRemoveModal').classList.remove('active');
}

function sdConfirmRemove() {
    const checkboxes = document.querySelectorAll('#sdRemoveModalBody input[type="checkbox"]:checked');
    const toRemove = Array.from(checkboxes).map(cb => cb.value);
    sdShortcuts = sdShortcuts.filter(fid => !toRemove.includes(fid));
    saveSmartDesk();
    sdCloseRemoveModal();
    sdRender();
}