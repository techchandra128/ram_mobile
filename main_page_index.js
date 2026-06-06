// main_page_index.js

// ===== STATE =====
let currentPath = [];
let fileSystem = {};
let currentSort = { by: 'name', dir: 'asc' };
let currentView = 'grid';
let currentEditItem = null;
let selectedMoveDestination = null;

// ===== INIT =====
document.addEventListener('DOMContentLoaded', async () => {
    await RAM_SYNC.syncOnOpen();
    // One-time migration: push all localStorage to Supabase if not done yet
    if (!localStorage.getItem('__ram_migrated')) {
        await RAM_SYNC.pushAll();
        localStorage.setItem('__ram_migrated', '1');
    }
    loadTheme();
    loadFileSystem();
    setupEventListeners();
    lucide.createIcons();
    document.getElementById('sidebar').classList.add('collapsed');
    // Load saved homepage
    const homepage = localStorage.getItem('ram_homepage') || 'diary';
    if (homepage === 'dashboard') showDashboard();
    else if (homepage === 'smartdesk') showSmartDesk();
    else if (homepage === 'allsections') showAllSections();
    else if (homepage === 'diary') showDiary();
    else if (homepage === 'playlists') showPlaylists();
    else if (homepage === 'allfiles') showAllFiles();
    else if (homepage === 'campaign') showCampaign();
    else showLibrary();
    // Ensure SD modals are direct children of body for correct z-index stacking
    ['sdAddModal','sdRemoveModal'].forEach(id => {
        const el = document.getElementById(id);
        if (el && el.parentElement !== document.body) document.body.appendChild(el);
    });
});

// ===== THEME =====
function loadTheme() {
    const saved = localStorage.getItem('ram_theme') || 'dark';
    applyTheme(saved);
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    RAM_SYNC.setItem('ram_theme', theme);


    const sFrame = document.getElementById('settingsFrame');
    if (sFrame && sFrame.contentWindow) {
        try { sFrame.contentWindow.postMessage({ type: 'themeChange', theme }, '*'); } catch(e) {}
    }

    const pvIframe = document.querySelector('.as-pv-iframe');
    if (pvIframe && pvIframe.contentWindow) {
        try { pvIframe.contentWindow.postMessage({ type: 'pvTheme', theme }, '*'); } catch(e) {}
    }

    const darkIcon = document.getElementById('themeIconDark');
    const lightIcon = document.getElementById('themeIconLight');
    const text = document.getElementById('themeText');
    if (theme === 'dark') {
        if (darkIcon) darkIcon.style.display = '';
        if (lightIcon) lightIcon.style.display = 'none';
        if (text) text.textContent = 'Dark Mode';
    } else {
        if (darkIcon) darkIcon.style.display = 'none';
        if (lightIcon) lightIcon.style.display = '';
        if (text) text.textContent = 'Light Mode';
    }
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    applyTheme(current === 'dark' ? 'light' : 'dark');
}

// ===== SIDEBAR =====
function setupEventListeners() {
    document.getElementById('sidebarToggle').addEventListener('click', toggleSidebar);

    window.addEventListener('message', (e) => {
        if (e.data === 'closeFile') closeFile();
        if (e.data?.type === 'themeChange') applyTheme(e.data.theme);
        if (e.data?.type === 'homepageChanged') RAM_SYNC.setItem('ram_homepage', e.data.value);
        if (e.data?.type === 'progressUpdate') {
            updateFileProgress(e.data.fileId, e.data.progress);
            recalculateAllFolders(fileSystem);
            saveFileSystem();
            renderContent();
            if (typeof renderHeatmap === 'function') renderHeatmap();
        }
    });


    // Close dropdowns on outside click
    document.addEventListener('mousedown', (e) => {
        if (!e.target.closest('#sortDropdown')) closeSortDropdown();
        const sdDrop = document.getElementById('sdSortDropdown');
        if (sdDrop && !e.target.closest('#sdSortDropdown')) sdDrop.classList.remove('active');
    });

    // Modal enter key
    document.getElementById('folderNameInput').addEventListener('keydown', e => { if (e.key === 'Enter') createFolder(); if (e.key === 'Escape') closeModal('addFolderModal'); });
    document.getElementById('fileNameInput').addEventListener('keydown', e => { if (e.key === 'Enter') createFile(); if (e.key === 'Escape') closeModal('addFileModal'); });
    document.getElementById('editNameInput').addEventListener('keydown', e => { if (e.key === 'Enter') saveItemChanges(); if (e.key === 'Escape') closeModal('editModal'); });

    // Close modal on overlay click
    ['addFolderModal','addFileModal','editModal'].forEach(id => {
        document.getElementById(id).addEventListener('click', e => { if (e.target.id === id) closeModal(id); });
    });
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('collapsed');
}

// ===== FILE SYSTEM =====
function loadFileSystem() {
    // Wipe old keys from previous version
    const oldKeys = ['c3_sectionData','c5_sectionStore','c4_allSectionNotes','c12_sections','c12_nextId','c12_newSectionLevel','ramFileSystem'];
    oldKeys.forEach(k => localStorage.removeItem(k));

    const saved = localStorage.getItem('ram_fileSystem');
    fileSystem = saved ? JSON.parse(saved) : {};
}

function saveFileSystem() {
    RAM_SYNC.setItem('ram_fileSystem', JSON.stringify(fileSystem));
}

function getCurrentLocation() {
    let cur = fileSystem;
    for (const p of currentPath) cur = cur[p].contents;
    return cur;
}

// ===== NAVIGATION =====
let dashCurrentView = 'heatmap';

function showSettings() {
    setActiveNav('navSettings');
    document.getElementById('dashboardLayer').classList.remove('active');
    document.getElementById('graphsLayer').classList.remove('active');
    document.getElementById('smartDeskLayer').classList.remove('active');
    document.getElementById('asLayer').classList.remove('active');
    document.getElementById('diaryLayer').classList.remove('active');
    document.getElementById('playlistsLayer').classList.remove('active');
    document.getElementById('allFilesLayer').classList.remove('active');
    document.getElementById('campaignLayer').classList.remove('active');
    document.getElementById('mainPage').classList.remove('active');
    document.getElementById('settingsLayer').classList.add('active');
    const frame = document.getElementById('settingsFrame');
    if (!frame.src || frame.src === window.location.href) {
        frame.src = 'settings.html';
    }
}

function showDashboard() {
    setActiveNav('navDashboard');
    document.getElementById('dashboardLayer').classList.add('active');
    document.getElementById('graphsLayer').classList.remove('active');
    document.getElementById('fileLayer').classList.remove('active');
    document.getElementById('smartDeskLayer').classList.remove('active');
    document.getElementById('settingsLayer').classList.remove('active');
    document.getElementById('asLayer').classList.remove('active');
    document.getElementById('diaryLayer').classList.remove('active');
    document.getElementById('playlistsLayer').classList.remove('active');
    document.getElementById('allFilesLayer').classList.remove('active');
    document.getElementById('campaignLayer').classList.remove('active');
    document.getElementById('mainPage').classList.remove('active');
    dashCurrentView = 'heatmap';
    document.querySelectorAll('[data-dash]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.dash === 'heatmap');
    });
    document.getElementById('hmBody').style.display = '';
    document.getElementById('hmViewToggle').style.display = '';
    initHeatmap();
}

function dashSetView(view) {
    dashCurrentView = view;

    // Pill toggle active state
    document.getElementById('dashPillHeatmap').classList.toggle('active', view === 'heatmap');
    document.getElementById('dashPillGraphs').classList.toggle('active', view === 'graphs');

    // Row2 panels
    document.getElementById('dashRow2Heatmap').style.display = view === 'heatmap' ? 'flex' : 'none';
    document.getElementById('dashRow2Graphs').style.display = view === 'graphs' ? 'flex' : 'none';

    if (view === 'heatmap') {
        document.getElementById('graphsLayer').classList.remove('active');
        initHeatmap();
    } else {
        document.getElementById('graphsLayer').classList.add('active');
        initGraphs();
        setTimeout(() => { renderGraph(); grSetupTooltip(); }, 50);
    }
}


function showLibrary() {
    currentPath = [];
    document.getElementById('dashboardLayer').classList.remove('active');
    document.getElementById('graphsLayer').classList.remove('active');
    document.getElementById('smartDeskLayer').classList.remove('active');
    document.getElementById('settingsLayer').classList.remove('active');
    document.getElementById('asLayer').classList.remove('active');
    document.getElementById('diaryLayer').classList.remove('active');
    document.getElementById('playlistsLayer').classList.remove('active');
    document.getElementById('allFilesLayer').classList.remove('active');
    document.getElementById('campaignLayer').classList.remove('active');
    document.getElementById('mainPage').classList.add('active');
    setActiveNav('navLibrary');
    renderBreadcrumb();
    renderContent();
}

function navigateToFolder(name) {
    currentPath.push(name);
    renderBreadcrumb();
    renderContent();
}

function navigateToBreadcrumb(index) {
    currentPath = currentPath.slice(0, index);
    renderBreadcrumb();
    renderContent();
}

function renderBreadcrumb() {
    const el = document.getElementById('breadcrumbPath');
    if (currentPath.length === 0) { el.innerHTML = 'Home'; return; }
    let html = '<span class="breadcrumb-item" onclick="navigateToBreadcrumb(0)">Home</span>';
    currentPath.forEach((p, i) => {
        if (i === currentPath.length - 1) {
            html += ` › ${p}`;
        } else {
            html += ` › <span class="breadcrumb-item" onclick="navigateToBreadcrumb(${i + 1})">${p}</span>`;
        }
    });
    el.innerHTML = html;
}

// ===== RENDER =====
function renderContent() {
    const cur = getCurrentLocation();
    const folders = [];
    const files = [];

    for (const [name, item] of Object.entries(cur)) {
        if (item.type === 'folder') folders.push({ name, ...item });
        else files.push({ name, ...item });
    }

    sortArray(folders);
    sortArray(files);

    if (currentView === 'grid') {
        document.getElementById('gridViewContainer').style.display = 'flex';
        document.getElementById('listViewContainer').style.display = 'none';
        renderGrid('foldersGrid', folders, 'folder');
        renderGrid('filesGrid', files, 'file');
    } else {
        document.getElementById('gridViewContainer').style.display = 'none';
        document.getElementById('listViewContainer').style.display = 'flex';
        renderList('foldersList', folders, 'folder');
        renderList('filesList', files, 'file');
    }
}

// ===== PROGRESS HELPERS =====
function getProgressClass(pct) {
    if (pct <= 25) return 'p-novice';
    if (pct <= 50) return 'p-ab';
    if (pct <= 75) return 'p-competent';
    return 'p-proficient';
}

function getProgressColor(pct) {
    if (pct <= 25) return '#94a3b8';
    if (pct <= 50) return '#f59e0b';
    if (pct <= 75) return '#f97316';
    return '#22c55e';
}

function degFromPct(pct) {
    return Math.round((pct / 100) * 360) + 'deg';
}

// ===== GRID RENDER =====
function renderGrid(containerId, items, type) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';

    if (items.length === 0) {
        container.innerHTML = '<div class="empty-state">Nothing here yet</div>';
        return;
    }

    items.forEach(item => {
        const pct = item.progress || 0;
        const pClass = getProgressClass(pct);
        const deg = degFromPct(pct);

        const wrapper = document.createElement('div');
        wrapper.className = 'grid-item';

        const editBtn = document.createElement('button');
        editBtn.className = 'grid-edit-btn';
        editBtn.textContent = '✎';
        editBtn.onclick = (e) => { e.stopPropagation(); showEditModal(item.name, type); };

        if (type === 'folder') {
            const circle = document.createElement('div');
            circle.className = `progress-circle ${pClass}`;
            circle.style.setProperty('--deg', deg);
            const inner = document.createElement('div');
            inner.className = 'progress-circle-inner';
            inner.textContent = pct + '%';
            circle.appendChild(inner);
            circle.appendChild(editBtn);
            circle.onclick = () => navigateToFolder(item.name);
            wrapper.appendChild(circle);
        } else {
            const rect = document.createElement('div');
            rect.className = `progress-rect ${pClass}`;
            rect.style.setProperty('--deg', deg);
            const inner = document.createElement('div');
            inner.className = 'progress-rect-inner';
            inner.textContent = pct + '%';
            rect.appendChild(inner);
            rect.appendChild(editBtn);
            
            // Debug the click handler
            rect.onclick = (e) => {
                console.log('File card clicked:', item.name, 'at path:', currentPath);
                if (e.target !== editBtn) {
                    openFile(item.name);
                }
            };
            wrapper.appendChild(rect);
        }

        const nameEl = document.createElement('div');
        nameEl.className = 'grid-item-name';
        nameEl.textContent = item.name;
        nameEl.title = item.name;
        wrapper.appendChild(nameEl);

        container.appendChild(wrapper);
    });
}

// ===== LIST RENDER =====
function renderList(containerId, items, type) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';

    if (items.length === 0) {
        container.innerHTML = '<div class="empty-state">Nothing here yet</div>';
        return;
    }

    items.forEach(item => {
        const pct = item.progress || 0;
        const pClass = getProgressClass(pct);
        const deg = degFromPct(pct);
        const color = getProgressColor(pct);

        const row = document.createElement('div');
        row.className = 'list-item';

        // Icon
        const iconWrap = document.createElement('div');
        iconWrap.className = 'list-icon-wrap';

        if (type === 'folder') {
            const circle = document.createElement('div');
            circle.className = `list-circle ${pClass}`;
            circle.style.setProperty('--deg', deg);
            const inner = document.createElement('div');
            inner.className = 'list-circle-inner';
            inner.textContent = pct + '%';
            inner.style.color = color;
            circle.appendChild(inner);
            iconWrap.appendChild(circle);
            row.onclick = () => navigateToFolder(item.name);
        } else {
            const rect = document.createElement('div');
            rect.className = `list-rect ${pClass}`;
            rect.style.setProperty('--deg', deg);
            const inner = document.createElement('div');
            inner.className = 'list-rect-inner';
            inner.textContent = pct + '%';
            inner.style.color = color;
            rect.appendChild(inner);
            iconWrap.appendChild(rect);
            
            // Debug the click handler for list view
            row.onclick = (e) => {
                console.log('File list item clicked:', item.name, 'at path:', currentPath);
                if (e.target.closest('.list-edit-btn')) return;
                openFile(item.name);
            };
        }

        // Name
        const nameEl = document.createElement('div');
        nameEl.className = 'list-item-name';
        nameEl.textContent = item.name;
        nameEl.title = item.name;

        // Progress bar
        const bar = document.createElement('div');
        bar.className = 'progress-bar';
        for (let i = 1; i <= 4; i++) {
            const seg = document.createElement('div');
            seg.className = `seg seg-${i}`;
            bar.appendChild(seg);
        }
        updateProgressBar(bar, pct);

        // Pct label
        const pctEl = document.createElement('div');
        pctEl.className = 'list-pct';
        pctEl.textContent = pct + '%';
        pctEl.style.color = color;

        // Edit btn
        const editBtn = document.createElement('button');
        editBtn.className = 'list-edit-btn';
        editBtn.textContent = '✎';
        editBtn.onclick = (e) => { e.stopPropagation(); showEditModal(item.name, type); };

        row.appendChild(iconWrap);
        row.appendChild(nameEl);
        row.appendChild(bar);
        row.appendChild(pctEl);
        row.appendChild(editBtn);

        container.appendChild(row);
    });
}

function updateProgressBar(bar, pct) {
    const segs = bar.querySelectorAll('.seg');
    // Each segment = 25%
    // seg1: 0-25, seg2: 26-50, seg3: 51-75, seg4: 76-100
    const levels = ['novice','ab','competent','proficient'];
    segs.forEach((seg, i) => {
        const segMin = i * 25;
        const segMax = (i + 1) * 25;
        if (pct >= segMax) {
            seg.className = `seg seg-${i+1} fill-${levels[i]}`;
        } else if (pct > segMin) {
            const fp = ((pct - segMin) / 25) * 100;
            seg.className = `seg seg-${i+1} partial-${levels[i]}`;
            seg.style.setProperty('--fp', fp + '%');
        }
    });
}

// ===== FILE OPEN =====
function openFile(name) {
    const cur = getCurrentLocation();
    const file = cur[name];
    
    // Debug logging
    console.log('openFile called with name:', name);
    console.log('currentPath:', currentPath);
    console.log('current location:', cur);
    console.log('file object:', file);
    
    if (!file) {
        console.error('File not found:', name);
        return;
    }
    if (!file.fileId) {
        console.error('File has no fileId:', name, file);
        return;
    }
    
    const fileLayer = document.getElementById('fileLayer');
    const frame = document.getElementById('fileFrame');
    const encodedName = encodeURIComponent(name);
    frame.src = `fileview.html?fileId=${file.fileId}&fileName=${encodedName}`;
    fileLayer.classList.add('active');
    
    console.log('File opened successfully:', name, 'with fileId:', file.fileId);
}

function closeFile() {
    // Read progress from iframe before closing
    try {
        const frame = document.getElementById('fileFrame');
        const frameWin = frame.contentWindow;
        const fileId = frameWin.c12FileId;
        if (fileId && frameWin.c5SectionStore) {
            const progress = frameWin.getOverallProgressForMain
                ? frameWin.getOverallProgressForMain()
                : 0;
            updateFileProgress(fileId, progress);
        }
    } catch(e) {}

    const fileLayer = document.getElementById('fileLayer');
    fileLayer.classList.remove('active');
    const frame = document.getElementById('fileFrame');
    setTimeout(() => { frame.src = ''; }, 300);
    renderContent();
    if (document.getElementById('smartDeskLayer').classList.contains('active')) {
        if (typeof sdRender === 'function') sdRender();
    }
}

function updateFileProgress(fileId, progress) {
    function searchAndUpdate(cur) {
        for (const item of Object.values(cur)) {
            if (item.type === 'file' && item.fileId === fileId) {
                item.progress = progress;
                return true;
            }
            if (item.type === 'folder' && item.contents) {
                if (searchAndUpdate(item.contents)) return true;
            }
        }
        return false;
    }
    searchAndUpdate(fileSystem);
    recalculateAllFolders(fileSystem);
    saveFileSystem();
}

// ===== VIEW =====
function switchView(view) {
    currentView = view;
    document.getElementById('viewBtnGrid').classList.toggle('active', view === 'grid');
    document.getElementById('viewBtnList').classList.toggle('active', view === 'list');
    renderContent();
}

function toggleViewDropdown() {}
function closeViewDropdown() {}

// ===== SORT =====
function sortItems(by, dir) {
    currentSort = { by, dir };
    closeSortDropdown();
    renderContent();
}

function sortArray(arr) {
    arr.sort((a, b) => {
        let va = currentSort.by === 'progress' ? (a.progress || 0) : a.name.toLowerCase();
        let vb = currentSort.by === 'progress' ? (b.progress || 0) : b.name.toLowerCase();
        const cmp = typeof va === 'string' ? va.localeCompare(vb) : va - vb;
        return currentSort.dir === 'asc' ? cmp : -cmp;
    });
}

function toggleSortDropdown() {
    document.getElementById('sortDropdown').classList.toggle('active');
    closeViewDropdown();
}

function closeSortDropdown() {
    document.getElementById('sortDropdown').classList.remove('active');
}

// ===== CREATE =====
function showAddFolderModal() {
    document.getElementById('folderNameInput').value = '';
    openModal('addFolderModal');
    setTimeout(() => document.getElementById('folderNameInput').focus(), 100);
    setActiveNav('navAddFolder');
}

function showAddFileModal() {
    document.getElementById('fileNameInput').value = '';
    openModal('addFileModal');
    setTimeout(() => document.getElementById('fileNameInput').focus(), 100);
    setActiveNav('navAddFile');
}

function createFolder() {
    const name = document.getElementById('folderNameInput').value.trim();
    if (!name) return;
    const cur = getCurrentLocation();
    if (cur[name] && cur[name].type === 'folder') { alert('A folder with this name already exists.'); return; }
    cur[name] = { type: 'folder', progress: 0, contents: {} };
    saveFileSystem();
    closeModal('addFolderModal');
    setActiveNav('navLibrary');
    renderContent();
}

function createFile() {
    const name = document.getElementById('fileNameInput').value.trim();
    if (!name) return;
    const cur = getCurrentLocation();
    if (cur[name] && cur[name].type === 'file') { alert('A file with this name already exists.'); return; }
    const fileId = 'f_' + Date.now();
    cur[name] = { type: 'file', progress: 0, fileId };
    saveFileSystem();
    closeModal('addFileModal');
    setActiveNav('navLibrary');
    renderContent();
}

// ===== EDIT =====
function showEditModal(name, type) {
    currentEditItem = { name, type, path: [...currentPath] };
    document.getElementById('editModalTitle').textContent = `Edit ${type === 'folder' ? 'Folder' : 'File'}`;
    document.getElementById('editNameInput').value = name;
    openModal('editModal');
    setTimeout(() => document.getElementById('editNameInput').focus(), 100);
}

function saveItemChanges() {
    if (!currentEditItem) return;
    const newName = document.getElementById('editNameInput').value.trim();
    if (!newName) return;

    let cur = fileSystem;
    for (const p of currentEditItem.path) cur = cur[p].contents;

    const oldName = currentEditItem.name;
    if (newName !== oldName) {
        if (cur[newName]) { alert('Already exists.'); return; }
        cur[newName] = cur[oldName];
        delete cur[oldName];
    }

    saveFileSystem();
    closeModal('editModal');
    currentEditItem = null;
    renderContent();
}

function collectFileIds(item) {
    const ids = [];
    if (item.type === 'file' && item.fileId) ids.push(item.fileId);
    if (item.type === 'folder' && item.contents) {
        Object.values(item.contents).forEach(child => ids.push(...collectFileIds(child)));
    }
    return ids;
}

function cleanupFileData(fileId) {
    const prefixes = ['c5_sectionStore_', 'c12_sections_', 'c12_nextId_', 'c12_newSectionLevel_', 'c3_sectionData_', 'c4_allSectionNotes_'];
    prefixes.forEach(p => localStorage.removeItem(p + fileId));
}

function deleteCurrentItem() {
    if (!currentEditItem) return;
    const type = currentEditItem.type === 'folder' ? 'folder' : 'file';
    if (!confirm(`Delete this ${type}?`)) return;

    let cur = fileSystem;
    for (const p of currentEditItem.path) cur = cur[p].contents;

    const fileIds = collectFileIds(cur[currentEditItem.name]);
    fileIds.forEach(cleanupFileData);

    delete cur[currentEditItem.name];

    saveFileSystem();
    closeModal('editModal');
    currentEditItem = null;
    renderContent();
}

// ===== MOVE =====
function showMoveModal() {
    selectedMoveDestination = null;
    const tree = document.getElementById('folderTree');
    tree.innerHTML = '';
    
    // Add "Root" option
    const rootItem = document.createElement('div');
    rootItem.className = 'folder-item';
    rootItem.dataset.path = '[]';
    rootItem.onclick = () => selectMoveDestination([]);
    rootItem.innerHTML = '<span class="folder-item-toggle">📁</span><span class="folder-item-name">Root</span>';
    tree.appendChild(rootItem);
    
    // Build tree
    buildFolderTree(fileSystem, [], tree, 0);
    openModal('moveModal');
}

function buildFolderTree(contents, path, parent, depth) {
    for (const [name, item] of Object.entries(contents)) {
        if (item.type === 'folder') {
            // Don't show the current item's path
            if (currentEditItem && path.length === currentEditItem.path.length && 
                path.every((p, i) => p === currentEditItem.path[i]) && 
                name === currentEditItem.name) {
                continue;
            }
            
            const folderItem = document.createElement('div');
            folderItem.className = 'folder-item';
            folderItem.style.paddingLeft = (12 + depth * 16) + 'px';
            folderItem.onclick = (e) => {
                e.stopPropagation();
                selectMoveDestination([...path, name]);
            };
            folderItem.dataset.path = JSON.stringify([...path, name]);
            folderItem.innerHTML = `<span class="folder-item-toggle">📁</span><span class="folder-item-name">${name}</span>`;
            parent.appendChild(folderItem);
            
            // Build subtree
            const subItems = item.contents || {};
            buildFolderTree(subItems, [...path, name], parent, depth + 1);
        }
    }
}

function selectMoveDestination(path) {
    selectedMoveDestination = path;
    document.querySelectorAll('.folder-item').forEach(el => {
        if (path.length === 0) {
            const elPath = el.dataset.path ? JSON.parse(el.dataset.path) : null;
            el.classList.toggle('selected', elPath && elPath.length === 0);
        } else {
            const elPath = el.dataset.path ? JSON.parse(el.dataset.path) : null;
            el.classList.toggle('selected', elPath && JSON.stringify(elPath) === JSON.stringify(path));
        }
    });
}

function confirmMove() {
    if (!currentEditItem) return;
    if (selectedMoveDestination === null || selectedMoveDestination === undefined) {
        alert('Please select a destination folder.');
        return;
    }
    
    // Get source location
    let srcCur = fileSystem;
    for (const p of currentEditItem.path) srcCur = srcCur[p].contents;
    const item = srcCur[currentEditItem.name];
    
    if (!item) {
        alert('Item not found.');
        return;
    }
    
    // Get destination location
    let destCur = fileSystem;
    for (const p of selectedMoveDestination) destCur = destCur[p].contents;
    
    // Check if item already exists at destination
    if (destCur[currentEditItem.name]) {
        alert('An item with this name already exists at the destination.');
        return;
    }
    
    // Move the item
    destCur[currentEditItem.name] = item;
    delete srcCur[currentEditItem.name];
    
    saveFileSystem();
    closeModal('moveModal');
    closeModal('editModal');
    currentEditItem = null;
    selectedMoveDestination = null;
    renderContent();
}

// ===== MODALS =====
function openModal(id) {
    document.getElementById(id).classList.add('active');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
    if (id === 'addFolderModal' || id === 'addFileModal') setActiveNav('navLibrary');
}

// ===== NAV ACTIVE =====
function setActiveNav(id) {
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
}

// ===== PROGRESS CALCULATION (for future integration) =====
function calculateFolderProgress(contents) {
    const items = Object.values(contents);
    if (items.length === 0) return 0;
    const total = items.reduce((sum, item) => sum + (item.progress || 0), 0);
    return Math.round(total / items.length);
}

function recalculateAllFolders(cur) {
    for (const item of Object.values(cur)) {
        if (item.type === 'folder' && item.contents) {
            recalculateAllFolders(item.contents);
            item.progress = calculateFolderProgress(item.contents);
        }
    }
}

// ===== SYNC TO SERVER =====
function pushSyncToServer() {
    try {
        const snapshot = { files: {}, fileSystem: null };
        snapshot.fileSystem = localStorage.getItem('ram_fileSystem');

        const allKeys = Object.keys(localStorage);
        allKeys.forEach(key => {
            const match = key.match(/^(c12_sections|c12_nextId|c12_newSectionLevel|c3_data|c4_allSectionNotes|c4_categories|c5_sectionStore)_(.+)$/);
            if (match) {
                const dataKey = match[1];
                const fileId = match[2];
                if (!snapshot.files[fileId]) snapshot.files[fileId] = {};
                snapshot.files[fileId][dataKey] = localStorage.getItem(key);
            }
        });

        fetch('http://localhost:3001/sync/push', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(snapshot)
        }).catch(() => {});
    } catch(e) {}
}

// Listen for save events from iframe
window.addEventListener('message', (e) => {
    if (e.data?.type === 'ramDataSaved') {
        pushSyncToServer();
    }
});