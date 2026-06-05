// allfiles.js — All Files Layer

let afCurrentView = 'grid';
let afCurrentSort = { by: 'name', dir: 'asc' };

// ===== COLLECT ALL FILES =====
function afCollectAllFiles(cur, result) {
    if (!result) result = [];
    for (const [name, item] of Object.entries(cur)) {
        if (item.type === 'file' && item.fileId) {
            result.push({ name, fileId: item.fileId, progress: item.progress || 0 });
        } else if (item.type === 'folder' && item.contents) {
            afCollectAllFiles(item.contents, result);
        }
    }
    return result;
}

// ===== SORT =====
function afSortArray(arr) {
    arr.sort((a, b) => {
        let va = afCurrentSort.by === 'progress' ? (a.progress || 0) : a.name.toLowerCase();
        let vb = afCurrentSort.by === 'progress' ? (b.progress || 0) : b.name.toLowerCase();
        const cmp = typeof va === 'string' ? va.localeCompare(vb) : va - vb;
        return afCurrentSort.dir === 'asc' ? cmp : -cmp;
    });
}

function afSortItems(by, dir) {
    afCurrentSort = { by, dir };
    document.getElementById('afSortDropdown').classList.remove('active');
    afRender();
}

function afToggleSort() {
    document.getElementById('afSortDropdown').classList.toggle('active');
}

// ===== VIEW SWITCH =====
function afSwitchView(view) {
    afCurrentView = view;
    document.getElementById('afViewBtnGrid').classList.toggle('active', view === 'grid');
    document.getElementById('afViewBtnList').classList.toggle('active', view === 'list');
    afRender();
}

// ===== SHOW =====
function showAllFiles() {
    setActiveNav('navAllFiles');
    ['dashboardLayer','graphsLayer','smartDeskLayer','settingsLayer',
     'diaryLayer','asLayer','playlistsLayer','campaignLayer'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.remove('active');
    });
    document.getElementById('mainPage').classList.remove('active');
    document.getElementById('allFilesLayer').classList.add('active');
    afRender();
}

// ===== RENDER =====
function afRender() {
    const grid = document.getElementById('afFilesGrid');
    const list = document.getElementById('afFilesList');
    if (!grid || !list) return;

    if (afCurrentView === 'grid') {
        afRenderGrid();
        grid.style.cssText = 'display:flex !important; flex-wrap:wrap; gap:16px;';
        list.style.cssText = 'display:none !important;';
    } else {
        afRenderList();
        list.style.cssText = 'display:flex !important; flex-direction:column; gap:6px;';
        grid.style.cssText = 'display:none !important;';
    }
}

function afRenderGrid() {
    const container = document.getElementById('afFilesGrid');
    if (!container) return;
    container.innerHTML = '';

    const fsRaw = localStorage.getItem('ram_fileSystem');
    if (!fsRaw) { container.innerHTML = '<div class="empty-state">No files yet.</div>'; return; }
    let fs; try { fs = JSON.parse(fsRaw); } catch(e) { return; }

    const files = afCollectAllFiles(fs);
    afSortArray(files);

    if (files.length === 0) {
        container.innerHTML = '<div class="empty-state">No files yet.</div>';
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

        rect.onclick = () => afOpenFile(item.fileId, item.name);

        const nameEl = document.createElement('div');
        nameEl.className = 'grid-item-name';
        nameEl.textContent = item.name;
        nameEl.title = item.name;

        wrapper.appendChild(rect);
        wrapper.appendChild(nameEl);
        container.appendChild(wrapper);
    });
}

function afRenderList() {
    const container = document.getElementById('afFilesList');
    if (!container) return;
    container.innerHTML = '';

    const fsRaw = localStorage.getItem('ram_fileSystem');
    if (!fsRaw) { container.innerHTML = '<div class="empty-state">No files yet.</div>'; return; }
    let fs; try { fs = JSON.parse(fsRaw); } catch(e) { return; }

    const files = afCollectAllFiles(fs);
    afSortArray(files);

    if (files.length === 0) {
        container.innerHTML = '<div class="empty-state">No files yet.</div>';
        return;
    }

    files.forEach(item => {
        const pct = item.progress || 0;
        const pClass = getProgressClass(pct);
        const deg = degFromPct(pct);
        const color = getProgressColor(pct);

        const row = document.createElement('div');
        row.className = 'list-item';
        row.onclick = () => afOpenFile(item.fileId, item.name);

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

        row.appendChild(iconWrap);
        row.appendChild(nameEl);
        row.appendChild(bar);
        row.appendChild(pctEl);
        container.appendChild(row);
    });
}

// ===== OPEN FILE =====
function afOpenFile(fileId, name) {
    const fileLayer = document.getElementById('fileLayer');
    const frame = document.getElementById('fileFrame');
    frame.src = `fileview.html?fileId=${fileId}&fileName=${encodeURIComponent(name)}`;
    fileLayer.classList.add('active');
}
