// mobile_library.js — library rendering, section list, section detail, notes, tasks, progress

// ===== SECTION NUMBERING =====
function generateNumbers(sections) {
    const counters = [0, 0, 0, 0, 0];
    return sections.map(section => {
        const level = section.level || 1;
        counters[level]++;
        for (let l = level + 1; l <= 4; l++) counters[l] = 0;
        let num = '';
        for (let l = 1; l <= level; l++) num += (l === 1 ? '' : '.') + counters[l];
        return num;
    });
}

// ===== LIBRARY: PROGRESS HELPERS =====
function getLibProgressClass(pct) {
    if (pct <= 25) return 'p-novice';
    if (pct <= 50) return 'p-ab';
    if (pct <= 75) return 'p-competent';
    return 'p-proficient';
}
function getLibProgressColor(pct) {
    if (pct <= 25) return '#94a3b8';
    if (pct <= 50) return '#f59e0b';
    if (pct <= 75) return '#f97316';
    return '#22c55e';
}
function getLibDeg(pct) { return Math.round((pct / 100) * 360) + 'deg'; }

// ===== LIBRARY: SORT =====
function sortLibItems(items) {
    const s = mState.libRootSort;
    return [...items].sort((a, b) => {
        if (s === 'name-asc')      return a.name.localeCompare(b.name);
        if (s === 'name-desc')     return b.name.localeCompare(a.name);
        if (s === 'progress-desc') return (b.progress || 0) - (a.progress || 0);
        if (s === 'progress-asc')  return (a.progress || 0) - (b.progress || 0);
        return 0;
    });
}

// ===== LIBRARY: SORT SHEET =====
function openLibSortSheet() {
    const libTop = mState.libStack[mState.libStack.length - 1];
    const onSections = mState.activePage === 'Library' && libTop?.screen === 'screenSections';
    const onSDSections = mState.activePage === 'SmartDesk' && getSDScreen() === 'screenSDSections';
    if (onSections || onSDSections) {
        openSecSortSheet();
    } else {
        document.querySelectorAll('#mLibSortSheet .m-sort-option').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.sort === mState.libRootSort);
        });
        document.getElementById('mLibSortSheet').classList.add('active');
    }
}

function closeLibSortSheet() {
    document.getElementById('mLibSortSheet').classList.remove('active');
}

function openSecSortSheet() {
    const isSD = mState.activePage === 'SmartDesk';
    const currentSort = isSD ? mState.sdSort : mState.libSort;
    document.querySelectorAll('#mSecSortSheet .m-sort-option').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.sort === currentSort);
    });
    document.getElementById('mSecSortSheet').classList.add('active');
}

function closeSecSortSheet() {
    document.getElementById('mSecSortSheet').classList.remove('active');
}

// ===== LIBRARY: TOOLBAR BIND =====
function bindLibRootToolbar() {
    document.getElementById('mLibSortBtn').addEventListener('click', openLibSortSheet);
    document.getElementById('mLibViewBtn')?.addEventListener('click', toggleLibView);
    updateViewBtn();

    document.querySelector('#mLibSortSheet .m-sort-backdrop').addEventListener('click', closeLibSortSheet);
    document.querySelectorAll('#mLibSortSheet .m-sort-option').forEach(btn => {
        btn.addEventListener('click', () => {
            mState.libRootSort = btn.dataset.sort;
            closeLibSortSheet();
            const active = document.querySelector('#pagLibrary .m-screen.active');
            if (active?.id === 'screenLibraryRoot') renderLibraryRoot();
            else if (active?.id === 'screenLibraryFolder') {
                const top = mState.libStack[mState.libStack.length - 1];
                if (top?.folder) renderFolderFiles(top.title, top.folder.contents);
            }
        });
    });

    document.querySelector('#mSecSortSheet .m-sort-backdrop').addEventListener('click', closeSecSortSheet);
    document.querySelectorAll('#mSecSortSheet .m-sort-option').forEach(btn => {
        btn.addEventListener('click', () => {
            const isSD = mState.activePage === 'SmartDesk';
            if (isSD) {
                mState.sdSort = btn.dataset.sort;
                const sections = mState._sdSections;
                const c5Store = mState._sdC5Store;
                if (sections && c5Store) {
                    renderSectionItems(document.getElementById('mSDSectionList'), sections, c5Store, mState.sdSort, 'sd');
                }
            } else {
                mState.libSort = btn.dataset.sort;
                renderSectionList('lib');
            }
            closeSecSortSheet();
        });
    });
}

// ===== CARD HELPERS =====
function getLibProficiencyLabel(pct) {
    if (pct === 0) return 'Not started';
    if (pct <= 25) return 'Novice';
    if (pct <= 50) return 'Apprentice';
    if (pct <= 75) return 'Competent';
    return 'Proficient';
}
function getLibDisplayColor(pct) {
    if (pct === 0) return '#475569';
    return getLibProgressColor(pct);
}
function getGridGradient(pct) {
    const dark = [['#0c1524','#334155'],['#1e1b4b','#94a3b840'],['#451a03','#f59e0b40'],['#431407','#f9731640'],['#064e3b','#22c55e40']];
    const light = [['#f1f5f9','#e2e8f0'],['#f1f5f9','#e2e8f0'],['#fef9ec','#fef3c7'],['#fff7ed','#ffedd5'],['#f0fdf4','#dcfce7']];
    const idx = pct === 0 ? 0 : pct <= 25 ? 1 : pct <= 50 ? 2 : pct <= 75 ? 3 : 4;
    return (mState.theme === 'dark' ? dark : light)[idx];
}
function getCardBorderColor() {
    return mState.theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'var(--card-border)';
}

const SC_DIFF_COLOR = { 'Easy': '#22c55e', 'Moderate': '#f59e0b', 'Challenging': '#f97316', 'Hard': '#ef4444' };
const SC_PRIO_COLOR = { 'Low': '#94a3b8', 'Medium': '#3b82f6', 'High': '#f97316', 'Critical': '#ef4444' };

function getSectionGradient(pct) {
    const dark = [['#1a2035','#1e2a3d'],['#221c0e','#2e2410'],['#221508','#2e1c08'],['#0e2018','#122818']];
    const light = [['#f1f5f9','#e2e8f0'],['#fef9ec','#fef3c7'],['#fff7ed','#ffedd5'],['#f0fdf4','#dcfce7']];
    const idx = pct <= 25 ? 0 : pct <= 50 ? 1 : pct <= 75 ? 2 : 3;
    return (mState.theme === 'dark' ? dark : light)[idx];
}
function getSectionBadgeColor(type) {
    const dark  = { green: '#4ec994', red: '#f47067', amber: '#ddb56a', orange: '#e8834a', blue: '#4d9fec', muted: '#475569' };
    const light = { green: '#22c55e', red: '#ef4444', amber: '#f59e0b', orange: '#f97316', blue: '#3b82f6', muted: '#94a3b8' };
    const c = mState.theme === 'dark' ? dark : light;
    if (type === 'done' || type === 'cleared' || type === 'early') return c.green;
    if (type === 'missed' || type === 'partial') return c.red;
    if (type === 'in-progress') return c.amber;
    if (type === 'not-done' || type === 'grace' || type === 'off-schedule') return c.orange;
    if (['scheduled','hunting-current','defending-current','hunted','defended','defending'].includes(type)) return c.blue;
    return c.muted;
}

// ===== SECTION LIST CARD =====
// thirdPill: 'prof' (default) = proficiency label, 'badge' = current week badge status
function makeSectionListCard(title, c5, showFile, fileName, thirdPill = 'prof') {
    const pct = c5?.proficiency || 0;
    const diff = c5?.difficulty;
    const prio = c5?.priority;
    const rc = getLibProgressColor(pct);
    const [g1, g2] = getSectionGradient(pct);
    const isDark = mState.theme === 'dark';
    const titleColor = isDark ? '#e2e8f0' : '#1e293b';
    const fileColor = isDark ? '#94a3b8' : '#64748b';
    const trackColor = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)';
    const borderColor = isDark ? 'rgba(255,255,255,0.06)' : 'var(--card-border)';
    const r = 14, circ = +(2 * Math.PI * r).toFixed(2);
    const offset = +(circ - (pct / 100) * circ).toFixed(2);

    const pills = [];
    if (diff) { const dc = SC_DIFF_COLOR[diff] || '#94a3b8'; pills.push(`<span class="sc-pill" style="color:${dc};border-color:${dc}44;background:${dc}12">${diff}</span>`); }
    if (prio) { const pc = SC_PRIO_COLOR[prio] || '#94a3b8'; pills.push(`<span class="sc-pill" style="color:${pc};border-color:${pc}44;background:${pc}12">${prio}</span>`); }
    if (thirdPill === 'badge') {
        const badge = (typeof smGetCurrentWeekBadge === 'function') ? smGetCurrentWeekBadge(c5) : null;
        if (badge) { const bc = getSectionBadgeColor(badge.type); pills.push(`<span class="sc-pill" style="color:${bc};border-color:${bc}44;background:${bc}12">${badge.label}</span>`); }
    } else {
        const profLabel = getLibProficiencyLabel(pct);
        pills.push(`<span class="sc-pill" style="color:${rc};border-color:${rc}44;background:${rc}12">${profLabel}</span>`);
    }

    const card = document.createElement('div');
    card.className = 'sc-list';
    card.style.borderColor = borderColor;
    card.innerHTML = `
        <div class="sc-top-row" style="background:linear-gradient(135deg,${g1},${g2})">
            <div class="sc-top-text">
                <div class="sc-title" style="color:${titleColor}">${escHtml(title)}</div>
                ${showFile && fileName ? `<div class="sc-filename" style="color:${fileColor}">${escHtml(fileName)}</div>` : ''}
            </div>
            <div class="sc-ring-wrap">
                <div class="sc-ring">
                    <svg viewBox="0 0 38 38" width="38" height="38">
                        <circle cx="19" cy="19" r="${r}" fill="none" stroke="${trackColor}" stroke-width="2.5"/>
                        ${pct > 0 ? `<circle cx="19" cy="19" r="${r}" fill="none" stroke="${rc}" stroke-width="2.5"
                            stroke-linecap="round" stroke-dasharray="${circ}" stroke-dashoffset="${offset}"
                            transform="rotate(-90 19 19)"/>` : ''}
                    </svg>
                    <div class="sc-ring-num" style="color:${pct > 0 ? rc : 'var(--text-muted)'}">${pct}%</div>
                </div>
            </div>
        </div>
        <div class="sc-bottom-row">
            <div class="sc-pills">${pills.length ? pills.join('') : ''}</div>
        </div>
    `;
    return card;
}

// ===== SECTION GRID CARD =====
// thirdPill: 'prof' (default) = proficiency label, 'badge' = current week badge status
function makeSectionGridCard(title, c5, showFile, fileName, thirdPill = 'prof') {
    const pct = c5?.proficiency || 0;
    const diff = c5?.difficulty;
    const prio = c5?.priority;
    const rc = getLibProgressColor(pct);
    const profLabel = getLibProficiencyLabel(pct);
    const [g1, g2] = getSectionGradient(pct);
    const isDark = mState.theme === 'dark';
    const titleColor = isDark ? '#e2e8f0' : '#1e293b';
    const fileColor = isDark ? '#94a3b8' : '#64748b';

    const topPills = [];
    if (diff) { const dc = SC_DIFF_COLOR[diff] || '#94a3b8'; topPills.push(`<span class="sc-grid-pill" style="color:${dc};border-color:${dc}44;background:${dc}15">${diff}</span>`); }
    if (prio) { const pc = SC_PRIO_COLOR[prio] || '#94a3b8'; topPills.push(`<span class="sc-grid-pill" style="color:${pc};border-color:${pc}44;background:${pc}15">${prio}</span>`); }
    let profPill = '';
    if (thirdPill === 'badge') {
        const badge = (typeof smGetCurrentWeekBadge === 'function') ? smGetCurrentWeekBadge(c5) : null;
        if (badge) { const bc = getSectionBadgeColor(badge.type); profPill = `<span class="sc-grid-pill" style="color:${bc};border-color:${bc}44;background:${bc}15">${badge.label}</span>`; }
    } else {
        profPill = `<span class="sc-grid-pill" style="color:${rc};border-color:${rc}44;background:${rc}15">${profLabel}</span>`;
    }

    const card = document.createElement('div');
    card.className = 'sc-grid';
    card.innerHTML = `
        <div class="sc-grid-top" style="background:linear-gradient(135deg,${g1},${g2})">
            <div class="sc-grid-title" style="color:${titleColor}">${escHtml(title)}</div>
            ${showFile && fileName ? `<div class="sc-grid-file" style="color:${fileColor}">${escHtml(fileName)}</div>` : ''}
        </div>
        <div class="sc-grid-middle">${topPills.length ? `<div class="sc-grid-pill-row">${topPills.join('')}</div>` : ''}${profPill ? `<div class="sc-grid-pill-row">${profPill}</div>` : ''}</div>
        <div class="sc-grid-bottom">
            <div class="sc-grid-row">
                <span class="sc-grid-prof" style="color:${rc}">${profLabel}</span>
                <span class="sc-grid-pct" style="color:${rc}">${pct}%</span>
            </div>
            <div class="sc-grid-bar-track">
                <div class="sc-grid-bar" style="width:${pct}%;background:${rc}"></div>
            </div>
        </div>
    `;
    return card;
}

// ===== LIST VIEW: FOLDER CARD =====
function makeListFolderCard(folder) {
    const pct = folder.progress || 0;
    const color = getLibDisplayColor(pct);
    const [g1, g2] = getGridGradient(pct);
    const profLabel = getLibProficiencyLabel(pct);
    const bookCount = Object.keys(folder.contents).filter(k => folder.contents[k].type === 'file').length;
    const dashOffset = (94.25 * (1 - pct / 100)).toFixed(2);
    const card = document.createElement('div');
    card.className = 'oa-card oa-card-grad';
    card.style.background = `linear-gradient(135deg,${g1},${g2})`;
    card.style.borderColor = getCardBorderColor();
    card.innerHTML = `
        <div class="oa-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
        </div>
        <div class="oa-info">
            <div class="oa-name">${escHtml(folder.name)}</div>
            <div class="oa-meta">
                <span>${bookCount} book${bookCount !== 1 ? 's' : ''}</span>
                ${pct > 0 ? `<span class="oa-dot"></span><span style="color:${color};font-weight:600">${profLabel}</span>` : ''}
            </div>
        </div>
        <div class="oa-ring">
            <svg viewBox="0 0 38 38" width="38" height="38">
                <circle cx="19" cy="19" r="15" fill="none" style="stroke:rgba(255,255,255,0.15)" stroke-width="3"/>
                ${pct > 0 ? `<circle cx="19" cy="19" r="15" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-dasharray="94.25" stroke-dashoffset="${dashOffset}"/>` : ''}
            </svg>
            <div class="oa-ring-num" style="color:${color}">${pct}%</div>
        </div>
    `;
    card.addEventListener('click', () => {
        pushLibStack({ screen: 'screenLibraryFolder', title: folder.name, folder });
        renderFolderFiles(folder.name, folder.contents);
    });
    return card;
}

// ===== LIST VIEW: FILE CARD =====
function makeListFileCard(file) {
    const fileData = getFileData(file.id);
    const sections = fileData?.c12_sections ? JSON.parse(fileData.c12_sections) : [];
    const sectionCount = sections.filter(s => s.type === 'real').length;
    const pct = file.progress || 0;
    const color = getLibDisplayColor(pct);
    const [g1, g2] = getGridGradient(pct);
    const profLabel = getLibProficiencyLabel(pct);
    const dashOffset = (94.25 * (1 - pct / 100)).toFixed(2);
    const card = document.createElement('div');
    card.className = 'oa-card oa-card-grad';
    card.style.background = `linear-gradient(135deg,${g1},${g2})`;
    card.style.borderColor = getCardBorderColor();
    card.innerHTML = `
        <div class="oa-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
            </svg>
        </div>
        <div class="oa-info">
            <div class="oa-name">${escHtml(file.name)}</div>
            <div class="oa-meta">
                <span>${sectionCount} section${sectionCount !== 1 ? 's' : ''}</span>
                ${pct > 0 ? `<span class="oa-dot"></span><span style="color:${color};font-weight:600">${profLabel}</span>` : ''}
            </div>
        </div>
        <div class="oa-ring">
            <svg viewBox="0 0 38 38" width="38" height="38">
                <circle cx="19" cy="19" r="15" fill="none" style="stroke:rgba(255,255,255,0.15)" stroke-width="3"/>
                ${pct > 0 ? `<circle cx="19" cy="19" r="15" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-dasharray="94.25" stroke-dashoffset="${dashOffset}"/>` : ''}
            </svg>
            <div class="oa-ring-num" style="color:${color}">${pct}%</div>
        </div>
    `;
    card.addEventListener('click', () => {
        mState.currentFileId = file.id;
        mState.currentFileName = file.name;
        mState.currentContext = 'lib';
        pushLibStack({ screen: 'screenSections', title: file.name });
        renderSectionList('lib');
        showLibScreen('screenSections');
        updateTopbar();
    });
    return card;
}

// ===== GRID VIEW: FOLDER CARD =====
function makeGridFolderCard(folder) {
    const pct = folder.progress || 0;
    const color = getLibDisplayColor(pct);
    const bookCount = Object.keys(folder.contents).filter(k => folder.contents[k].type === 'file').length;
    const [g1, g2] = getGridGradient(pct);
    const card = document.createElement('div');
    card.className = 'gc-card';
    card.innerHTML = `
        <div class="gc-top" style="background:linear-gradient(135deg,${g1},${g2})">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
            <div class="gc-name">${escHtml(folder.name)}</div>
            <div class="gc-meta">${bookCount} book${bookCount !== 1 ? 's' : ''}</div>
        </div>
        <div class="gc-bottom">
            <div class="gc-bar-track"><div class="gc-bar" style="width:${pct}%;background:${color}"></div></div>
            <span class="gc-pct" style="color:${color}">${pct}%</span>
        </div>
    `;
    card.addEventListener('click', () => {
        pushLibStack({ screen: 'screenLibraryFolder', title: folder.name, folder });
        renderFolderFiles(folder.name, folder.contents);
    });
    return card;
}

// ===== GRID VIEW: FILE CARD =====
function makeGridFileCard(file, context = 'lib') {
    const fileData = getFileData(file.id);
    const sections = fileData?.c12_sections ? JSON.parse(fileData.c12_sections) : [];
    const sectionCount = sections.filter(s => s.type === 'real').length;
    const pct = file.progress || 0;
    const color = getLibDisplayColor(pct);
    const [g1, g2] = getGridGradient(pct);
    const card = document.createElement('div');
    card.className = 'gc-card';
    card.innerHTML = `
        <div class="gc-top" style="background:linear-gradient(135deg,${g1},${g2})">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
            </svg>
            <div class="gc-name">${escHtml(file.name)}</div>
            <div class="gc-meta">${sectionCount} section${sectionCount !== 1 ? 's' : ''}</div>
        </div>
        <div class="gc-bottom">
            <div class="gc-bar-track"><div class="gc-bar" style="width:${pct}%;background:${color}"></div></div>
            <span class="gc-pct" style="color:${color}">${pct}%</span>
        </div>
    `;
    card.addEventListener('click', () => {
        mState.currentFileId = file.id;
        mState.currentFileName = file.name;
        mState.currentContext = context;
        if (context === 'lib') {
            pushLibStack({ screen: 'screenSections', title: file.name });
            renderSectionList('lib');
            showLibScreen('screenSections');
            updateTopbar();
        } else {
            renderSectionList('sd');
            showSDScreen('screenSDSections');
            updateTopbar();
        }
    });
    return card;
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

    const sortedFolders = sortLibItems(folders);
    const sortedFiles = sortLibItems(files);

    if (mState.libView === 'grid') {
        const grid = document.createElement('div');
        grid.className = 'lib-grid';
        sortedFolders.forEach(folder => grid.appendChild(makeGridFolderCard(folder)));
        sortedFiles.forEach(file => grid.appendChild(makeGridFileCard(file, 'lib')));
        container.appendChild(grid);
    } else {
        sortedFolders.forEach(folder => container.appendChild(makeListFolderCard(folder)));
        sortedFiles.forEach(file => container.appendChild(makeListFileCard(file)));
    }
}

// ===== LIBRARY: FOLDER FILES =====
function renderFolderFiles(folderName, contents) {
    const container = document.getElementById('mFolderFileList');
    container.innerHTML = '';
    const { files } = collectFoldersAndFiles(contents);
    if (files.length === 0) {
        container.innerHTML = '<div class="m-empty">No files in this folder.</div>';
        showLibScreen('screenLibraryFolder');
        return;
    }
    const sortedFiles = sortLibItems(files);
    if (mState.libView === 'grid') {
        const grid = document.createElement('div');
        grid.className = 'lib-grid';
        sortedFiles.forEach(file => grid.appendChild(makeGridFileCard(file, 'lib')));
        container.appendChild(grid);
    } else {
        sortedFiles.forEach(file => container.appendChild(makeListFileCard(file)));
    }
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
        renderLibraryRoot();
        updateTopbar();
        return;
    }
    const top = mState.libStack[mState.libStack.length - 1];
    if (top.screen === 'screenLibraryFolder' && top.folder) {
        renderFolderFiles(top.title, top.folder.contents);
    } else {
        showLibScreen(top.screen);
    }
    updateTopbar();
}

function showLibScreen(screenId) {
    document.querySelectorAll('#pagLibrary .m-screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

// ===== MAKE FILE CARD (Smart Desk list view) =====
function makeFileCard(file, context) {
    const fileData = getFileData(file.id);
    const sections = fileData?.c12_sections ? JSON.parse(fileData.c12_sections) : [];
    const sectionCount = sections.filter(s => s.type === 'real').length;
    const pct = file.progress || 0;
    const color = getLibDisplayColor(pct);
    const [g1, g2] = getGridGradient(pct);
    const profLabel = getLibProficiencyLabel(pct);
    const dashOffset = (94.25 * (1 - pct / 100)).toFixed(2);

    const card = document.createElement('div');
    card.className = 'oa-card oa-card-grad';
    card.style.background = `linear-gradient(135deg,${g1},${g2})`;
    card.style.borderColor = getCardBorderColor();
    card.innerHTML = `
        <div class="oa-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
            </svg>
        </div>
        <div class="oa-info">
            <div class="oa-name">${escHtml(file.name)}</div>
            <div class="oa-meta">
                <span>${sectionCount} section${sectionCount !== 1 ? 's' : ''}</span>
                ${pct > 0 ? `<span class="oa-dot"></span><span style="color:${color};font-weight:600">${profLabel}</span>` : ''}
            </div>
        </div>
        <div class="oa-ring">
            <svg viewBox="0 0 38 38" width="38" height="38">
                <circle cx="19" cy="19" r="15" fill="none" style="stroke:rgba(255,255,255,0.15)" stroke-width="3"/>
                ${pct > 0 ? `<circle cx="19" cy="19" r="15" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-dasharray="94.25" stroke-dashoffset="${dashOffset}"/>` : ''}
            </svg>
            <div class="oa-ring-num" style="color:${color}">${pct}%</div>
        </div>
    `;
    card.addEventListener('click', () => {
        mState.currentFileId = file.id;
        mState.currentFileName = file.name;
        mState.currentContext = context;
        if (context === 'lib') {
            pushLibStack({ screen: 'screenSections', title: file.name });
            renderSectionList('lib');
            showLibScreen('screenSections');
            updateTopbar();
        } else {
            renderSectionList('sd');
            showSDScreen('screenSDSections');
            updateTopbar();
        }
    });
    return card;
}

// ===== VIEW TOGGLE =====
function toggleLibView() {
    mState.libView = mState.libView === 'list' ? 'grid' : 'list';
    updateViewBtn();
    const libTop = mState.libStack[mState.libStack.length - 1];
    if (mState.activePage === 'Library') {
        if (!libTop || mState.libStack.length === 0) {
            renderLibraryRoot();
        } else if (libTop.screen === 'screenSections') {
            renderSectionList('lib');
        } else if (libTop.screen === 'screenLibraryFolder') {
            renderFolderFiles(libTop.title, libTop.folder.contents);
        }
    } else if (mState.activePage === 'SmartDesk') {
        const activeTab = document.querySelector('#mSDMainTabBar .m-tab.active')?.dataset.tab;
        if (activeTab === 'playlists') {
            renderSDPlaylistList();
        } else if (getSDScreen() === 'screenSDSections') {
            renderSectionList('sd');
        } else {
            renderSDFileList();
        }
    } else if (mState.activePage === 'Diary') {
        mdRenderContent();
    }
}

function updateViewBtn() {
    const btn = document.getElementById('mLibViewBtn');
    if (!btn) return;
    const isGrid = mState.libView === 'grid';
    btn.innerHTML = isGrid
        ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="3" cy="6" r="1" fill="currentColor"/><circle cx="3" cy="12" r="1" fill="currentColor"/><circle cx="3" cy="18" r="1" fill="currentColor"/></svg>`
        : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>`;
    btn.title = isGrid ? 'Switch to list view' : 'Switch to grid view';
}

// ===== SECTION LIST =====
function renderSectionList(context) {
    const listId = context === 'lib' ? 'mSectionList' : 'mSDSectionList';
    const container = document.getElementById(listId);
    const fileData = getFileData(mState.currentFileId);

    const sections = fileData?.c12_sections ? JSON.parse(fileData.c12_sections) : [];
    const c5Store = fileData?.c5_sectionStore ? JSON.parse(fileData.c5_sectionStore) : {};

    if (context === 'sd') { mState._sdSections = sections; mState._sdC5Store = c5Store; }

    container.innerHTML = '';

    const isGrid = mState.libView === 'grid';
    const showFile = context === 'sd';
    const fileName = mState.currentFileName || '';
    const navC5 = c5Store['navigation'] || {};
    const navCard = isGrid
        ? makeSectionGridCard('Table of Contents', navC5, showFile, fileName)
        : makeSectionListCard('Table of Contents', navC5, showFile, fileName);
    navCard.addEventListener('click', () => openSection('navigation', 'Table of Contents', context));
    container.appendChild(navCard);

    const sort = context === 'lib' ? mState.libSort : mState.sdSort;
    renderSectionItems(container, sections, c5Store, sort, context);
}

function renderSectionItems(container, sections, c5Store, sort, context) {
    const realSections = sections.filter(s => s.type === 'real');

    if (!realSections.length) {
        const empty = document.createElement('div');
        empty.className = 'm-empty';
        empty.textContent = 'No sections yet.';
        container.appendChild(empty);
        return;
    }

    // numMap for sort reference only (section-count sort uses hierarchy)
    const numbers = generateNumbers(sections);
    const numMap = {};
    sections.forEach((s, i) => { numMap[s.id] = numbers[i]; });

    const isOutline = !sort || sort === 'outline';
    const isGrid = mState.libView === 'grid';
    const displaySections = isOutline
        ? realSections
        : sortSections(realSections, c5Store, sort, numMap);

    const showFile = context === 'sd';
    const fileName = mState.currentFileName || '';

    if (isGrid) {
        const grid = document.createElement('div');
        grid.className = 'sc-section-grid';
        displaySections.forEach(section => {
            const c5 = c5Store[section.id] || {};
            const card = makeSectionGridCard(section.title, c5, showFile, fileName);
            card.addEventListener('click', () => openSection(section.id, section.title, context));
            grid.appendChild(card);
        });
        container.appendChild(grid);
    } else {
        displaySections.forEach(section => {
            const c5 = c5Store[section.id] || {};
            const card = makeSectionListCard(section.title, c5, showFile, fileName);
            card.addEventListener('click', () => openSection(section.id, section.title, context));
            container.appendChild(card);
        });
    }
}

function sortSections(sections, c5Store, sort, numMap) {
    const arr = [...sections];
    const diffOrder = { 'Easy': 1, 'Moderate': 2, 'Challenging': 3, 'Hard': 4 };
    const prioOrder = { 'Low': 1, 'Medium': 2, 'High': 3, 'Critical': 4 };

    switch(sort) {
        case 'alpha':
            return arr.sort((a, b) => a.title.localeCompare(b.title));
        case 'section-count': {
            const getSubCount = s => {
                const num = numMap?.[s.id];
                if (!num) return 0;
                const prefix = num + '.';
                return arr.filter(x => {
                    const xNum = numMap?.[x.id];
                    return xNum && xNum.startsWith(prefix);
                }).length;
            };
            return arr.sort((a, b) => getSubCount(b) - getSubCount(a));
        }
        case 'proficiency':
            return arr.sort((a, b) => (c5Store[b.id]?.proficiency || 0) - (c5Store[a.id]?.proficiency || 0));
        case 'progress': {
            const getProg = id => {
                const c5 = c5Store[id];
                if (!c5?.activatedCount) return 0;
                return (c5.revisions.filter(r => r.date).length / c5.activatedCount) * 100;
            };
            return arr.sort((a, b) => getProg(b.id) - getProg(a.id));
        }
        case 'difficulty':
            return arr.sort((a, b) =>
                (diffOrder[c5Store[b.id]?.difficulty] || 0) - (diffOrder[c5Store[a.id]?.difficulty] || 0));
        case 'priority':
            return arr.sort((a, b) =>
                (prioOrder[c5Store[b.id]?.priority] || 0) - (prioOrder[c5Store[a.id]?.priority] || 0));
        case 'last-revised': {
            const getLastDate = id => {
                const c5 = c5Store[id];
                const filled = c5?.revisions?.filter(r => r.date);
                if (!filled?.length) return null;
                const last = filled[filled.length - 1];
                const [d, m] = last.date.split('/');
                return new Date(last.year || new Date().getFullYear(), parseInt(m) - 1, parseInt(d));
            };
            return arr.sort((a, b) => {
                const da = getLastDate(a.id), db = getLastDate(b.id);
                if (!da && !db) return 0;
                if (!da) return -1;
                if (!db) return 1;
                return da - db;
            });
        }
        case 'revision-count':
            return arr.sort((a, b) => {
                const ca = c5Store[a.id]?.revisions?.filter(r => r.date).length || 0;
                const cb = c5Store[b.id]?.revisions?.filter(r => r.date).length || 0;
                return ca - cb;
            });
        default: // 'outline' — preserve original order
            return arr;
    }
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
    renderDetailFooter(tab);
}

// ===== DETAIL FOOTER =====
function renderDetailFooter(tab) {
    const footer = document.getElementById('mDetailFooter');
    if (!footer) return;
    footer.innerHTML = '';

    if (tab === 'notes') {
        const fileData = getFileData(mState.currentFileId);
        const c5Store = fileData?.c5_sectionStore ? JSON.parse(fileData.c5_sectionStore) : {};
        const c5 = c5Store[mState.currentSectionId];
        const studiedToday = c5 && isStudiedToday(c5);

        const wrap = document.createElement('div');
        wrap.className = 'm-df-notes';

        const prevBtn = document.createElement('button');
        prevBtn.className = 'm-df-prev';
        prevBtn.textContent = 'Prev';

        const studiedBtn = document.createElement('button');
        studiedBtn.className = 'm-df-studied' + (studiedToday ? ' studied' : '');
        studiedBtn.textContent = studiedToday ? 'Studied Today ✓' : 'Mark as Studied';
        studiedBtn.addEventListener('click', () => markAsStudied());

        const nextBtn = document.createElement('button');
        nextBtn.className = 'm-df-next';
        nextBtn.textContent = 'Next';

        if (mState.diaryReturn) {
            const entries = mState.diaryEntries || [];
            const idx = mState.diaryEntryIndex ?? 0;
            prevBtn.disabled = idx <= 0;
            prevBtn.addEventListener('click', () => {
                if (idx > 0) {
                    const prev = entries[idx - 1];
                    mState.diaryEntryIndex = idx - 1;
                    mState.currentFileId = prev.fileId.startsWith('f_') ? prev.fileId : `f_${prev.fileId}`;
                    mState.currentFileName = prev.fileName;
                    mState.currentSectionId = prev.sectionId;
                    mState.currentSection = { id: prev.sectionId, title: prev.sectionTitle };
                    mState.libStack[mState.libStack.length - 1].title = prev.sectionTitle;
                    updateTopbar();
                    renderDetailTab('notes', 'mTabContent');
                }
            });
            nextBtn.disabled = idx >= entries.length - 1;
            nextBtn.addEventListener('click', () => {
                if (idx < entries.length - 1) {
                    const next = entries[idx + 1];
                    mState.diaryEntryIndex = idx + 1;
                    mState.currentFileId = next.fileId.startsWith('f_') ? next.fileId : `f_${next.fileId}`;
                    mState.currentFileName = next.fileName;
                    mState.currentSectionId = next.sectionId;
                    mState.currentSection = { id: next.sectionId, title: next.sectionTitle };
                    mState.libStack[mState.libStack.length - 1].title = next.sectionTitle;
                    updateTopbar();
                    renderDetailTab('notes', 'mTabContent');
                }
            });
        } else {
            const allSectionsData = getFileData(mState.currentFileId);
            const realSections = allSectionsData?.c12_sections
                ? JSON.parse(allSectionsData.c12_sections).filter(s => s.type === 'real')
                : [];
            const allSections = [{ id: 'navigation', title: 'Table of Contents' }, ...realSections];
            const currentIdx = allSections.findIndex(s => String(s.id) === String(mState.currentSectionId));
            prevBtn.disabled = currentIdx <= 0;
            prevBtn.addEventListener('click', () => {
                if (currentIdx > 0) {
                    const prev = allSections[currentIdx - 1];
                    mState.currentSectionId = prev.id;
                    mState.currentSection = { id: prev.id, title: prev.title };
                    const contentId = mState.currentContext === 'lib' ? 'mTabContent' : 'mSDTabContent';
                    if (mState.currentContext === 'lib') mState.libStack[mState.libStack.length - 1].title = prev.title;
                    updateTopbar();
                    renderDetailTab('notes', contentId);
                }
            });
            nextBtn.disabled = currentIdx >= allSections.length - 1;
            nextBtn.addEventListener('click', () => {
                if (currentIdx < allSections.length - 1) {
                    const next = allSections[currentIdx + 1];
                    mState.currentSectionId = next.id;
                    mState.currentSection = { id: next.id, title: next.title };
                    const contentId = mState.currentContext === 'lib' ? 'mTabContent' : 'mSDTabContent';
                    if (mState.currentContext === 'lib') mState.libStack[mState.libStack.length - 1].title = next.title;
                    updateTopbar();
                    renderDetailTab('notes', contentId);
                }
            });
        }

        wrap.appendChild(prevBtn);
        wrap.appendChild(studiedBtn);
        wrap.appendChild(nextBtn);
        footer.appendChild(wrap);

    } else if (tab === 'c4') {
        const wrap = document.createElement('div');
        wrap.className = 'm-df-notes';
        const btn = document.createElement('button');
        btn.className = 'm-df-studied';
        btn.textContent = 'Add Observation';
        btn.addEventListener('click', () => _c4OpenModal(null));
        wrap.appendChild(btn);
        footer.appendChild(wrap);

    } else if (tab === 'c5') {
        const fileData = getFileData(mState.currentFileId);
        const c5Store = fileData?.c5_sectionStore ? JSON.parse(fileData.c5_sectionStore) : {};
        const c5 = c5Store[mState.currentSectionId];
        const isCompleted = c5?.isCompleted || false;

        const wrap = document.createElement('div');
        wrap.className = 'm-df-notes';
        const btn = document.createElement('button');
        btn.className = 'm-df-studied' + (isCompleted ? ' studied' : '');
        btn.textContent = isCompleted ? '✓ Completed' : 'Mark as Completed';
        btn.addEventListener('click', async () => {
            const fd = getFileData(mState.currentFileId);
            const store = fd?.c5_sectionStore ? JSON.parse(fd.c5_sectionStore) : {};
            if (!store[mState.currentSectionId]) {
                store[mState.currentSectionId] = {
                    isCompleted: false, difficulty: 'Easy', priority: 'Low',
                    revisions: Array(12).fill(null).map(() => ({ date: null, year: null })),
                    totalSlots: 12, activatedCount: 4, page: 0
                };
            }
            store[mState.currentSectionId].isCompleted = !store[mState.currentSectionId].isCompleted;
            await saveC5(store);
            const contentId = mState.currentContext === 'lib' ? 'mTabContent' : 'mSDTabContent';
            renderDetailTab('c5', contentId);
        });
        wrap.appendChild(btn);
        footer.appendChild(wrap);
    }
}

// ===== TABLE OF CONTENTS =====
function renderTOC(container) {
    const fileData = getFileData(mState.currentFileId);
    const sections = fileData?.c12_sections ? JSON.parse(fileData.c12_sections) : [];

    if (sections.length === 0) {
        container.innerHTML = '<div class="m-notes-empty">No sections yet.</div>';
        return;
    }

    const numbers = generateNumbers(sections);
    const context = mState.activePage === 'SmartDesk' ? 'sd' : 'lib';

    const list = document.createElement('div');
    list.className = 'm-toc-list';

    sections.forEach((section, i) => {
        const item = document.createElement('div');
        item.className = `m-toc-item m-toc-level-${section.level || 1}${section.type === 'dummy' ? ' m-toc-dummy' : ' m-toc-real'}`;

        const num = document.createElement('span');
        num.className = 'm-toc-num';
        num.textContent = numbers[i] + '.';

        const title = document.createElement('span');
        title.className = 'm-toc-title';
        title.textContent = section.title;

        item.appendChild(num);
        item.appendChild(title);

        if (section.type === 'real') {
            item.addEventListener('click', () => openSection(section.id, section.title, context));
        }

        list.appendChild(item);
    });

    container.appendChild(list);
}

// ===== NOTES TAB =====
function renderNotesTab(container) {
    if (mState.currentSectionId === 'navigation') {
        renderTOC(container);
        return;
    }

    const fileData = getFileData(mState.currentFileId);
    const c3Data = fileData?.c3_data ? JSON.parse(fileData.c3_data) : {};
    const sectionData = c3Data[mState.currentSectionId] || c3Data[String(mState.currentSectionId)] || c3Data[Number(mState.currentSectionId)];

    const LEVELS = [
        { id: 'crisp',       label: 'Crisp',       icon: '⚡', sub: 'Key points only' },
        { id: 'conceptual',  label: 'Conceptual',  icon: '💡', sub: 'Core concepts' },
        { id: 'detailed',    label: 'Detailed',    icon: '📚', sub: 'In depth' },
        { id: 'syntopical',  label: 'Syntopical',  icon: '🔗', sub: 'Cross-linked' },
    ];

    const notesWithContent = LEVELS.filter(l => {
        const ld = sectionData?.notes?.[l.id];
        return ld?.versions?.length;
    });

    if (notesWithContent.length > 0) {
        const controls = document.createElement('div');
        controls.className = 'm-notes-controls';

        function makeDropdown() {
            const wrap = document.createElement('div');
            wrap.className = 'm-notes-dropdown-wrap';
            const trigger = document.createElement('button');
            trigger.className = 'm-notes-trigger';
            const menu = document.createElement('div');
            menu.className = 'm-notes-menu';
            trigger.addEventListener('click', e => {
                e.stopPropagation();
                document.querySelectorAll('.m-notes-dropdown-wrap.active').forEach(w => { if (w !== wrap) w.classList.remove('active'); });
                wrap.classList.toggle('active');
            });
            wrap.appendChild(trigger);
            wrap.appendChild(menu);
            return { wrap, trigger, menu };
        }

        const { wrap: lWrap, trigger: lTrigger, menu: lMenu } = makeDropdown();
        const { wrap: vWrap, trigger: vTrigger, menu: vMenu } = makeDropdown();

        controls.appendChild(lWrap);
        controls.appendChild(vWrap);
        container.appendChild(controls);

        const noteContentArea = document.createElement('div');
        noteContentArea.className = 'm-notes-content';
        noteContentArea.id = 'mNoteContentArea';
        container.appendChild(noteContentArea);

        function setLabel(trigger, text) {
            trigger.innerHTML = `<span>${text}</span><span style="font-size:9px">▼</span>`;
        }

        let _curLevelId = null;
        let _curVersionIdx = 0;

        function showNoteContent(levelId, versionIdx) {
            _curLevelId = levelId;
            _curVersionIdx = versionIdx;
            const ld = sectionData.notes[levelId];
            const version = ld?.versions?.[versionIdx];
            noteContentArea.innerHTML = version ? renderNoteContent(version) : '<div class="m-notes-empty">No content.</div>';
        }

        function populateVersions(levelId) {
            const level = notesWithContent.find(l => l.id === levelId);
            setLabel(lTrigger, level.icon + ' ' + level.label);
            const ld = sectionData.notes[levelId];
            vMenu.innerHTML = '';
            const cur = ld.currentVersion || 0;
            ld.versions.forEach((v, i) => {
                const opt = document.createElement('div');
                opt.className = 'm-notes-menu-option' + (i === cur ? ' selected' : '');
                opt.textContent = v.label || `V${i + 1}`;
                opt.addEventListener('click', () => {
                    vMenu.querySelectorAll('.m-notes-menu-option').forEach(o => o.classList.remove('selected'));
                    opt.classList.add('selected');
                    setLabel(vTrigger, v.label || `V${i + 1}`);
                    vWrap.classList.remove('active');
                    showNoteContent(levelId, i);
                });
                vMenu.appendChild(opt);
            });
            setLabel(vTrigger, ld.versions[cur]?.label || `V${cur + 1}`);
            showNoteContent(levelId, cur);
        }

        notesWithContent.forEach((l, idx) => {
            const opt = document.createElement('div');
            opt.className = 'm-notes-menu-option' + (idx === 0 ? ' selected' : '');
            opt.textContent = l.icon + ' ' + l.label;
            opt.addEventListener('click', () => {
                lMenu.querySelectorAll('.m-notes-menu-option').forEach(o => o.classList.remove('selected'));
                opt.classList.add('selected');
                lWrap.classList.remove('active');
                populateVersions(l.id);
            });
            lMenu.appendChild(opt);
        });

        document.addEventListener('click', () => {
            document.querySelectorAll('.m-notes-dropdown-wrap.active').forEach(w => w.classList.remove('active'));
        });

        populateVersions(notesWithContent[0].id);

        let _noteResizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(_noteResizeTimer);
            _noteResizeTimer = setTimeout(() => {
                if (_curLevelId !== null) showNoteContent(_curLevelId, _curVersionIdx);
            }, 200);
        });
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                if (_curLevelId !== null) showNoteContent(_curLevelId, _curVersionIdx);
            }, 350);
        });
    } else {
        const empty = document.createElement('div');
        empty.className = 'm-empty';
        empty.textContent = 'No notes yet.';
        container.appendChild(empty);
    }

}

function parseCornellRight(html) {
    if (!html) return [];
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const items = [];
    const BLOCK = new Set(['P', 'DIV', 'UL', 'OL', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'PRE']);
    let inlineBuf = '';

    function flushInline() {
        inlineBuf.split('\n').forEach(line => {
            const t = line.trim();
            if (t) items.push({ type: 'text', text: t });
        });
        inlineBuf = '';
    }

    function processBlock(node) {
        // Walk block content, treating <br> as line separators
        const lines = [];
        let cur = '';
        function walk(n) {
            if (n.nodeType === 3) { cur += n.textContent; return; }
            if (n.nodeType !== 1) return;
            if (n.nodeName === 'BR') { lines.push(cur); cur = ''; return; }
            Array.from(n.childNodes).forEach(walk);
        }
        Array.from(node.childNodes).forEach(walk);
        if (cur) lines.push(cur);

        const nonEmpty = lines.map(l => l.trim()).filter(l => l);
        if (!nonEmpty.length) { items.push({ type: 'gap' }); return; }

        const isDebulleted = node.classList.contains('c3-debulleted')
            || Array.from(node.classList).some(c => c.startsWith('docx-indent'))
            || !!node.style.paddingLeft;

        nonEmpty.forEach(t => {
            if (isDebulleted && !/^[•·‣⁃]/.test(t)) { items.push({ type: 'indent', text: t }); return; }
            if (/^[•·‣⁃]/.test(t)) { items.push({ type: 'bullet', text: t.replace(/^[•·‣⁃\s]+/, '') }); return; }
            items.push({ type: 'text', text: t });
        });
    }

    Array.from(doc.body.childNodes).forEach(node => {
        if (node.nodeType === 3) { inlineBuf += node.textContent; return; }
        if (node.nodeType !== 1) return;
        if (node.nodeName === 'UL' || node.nodeName === 'OL') {
            flushInline();
            node.querySelectorAll('li').forEach(li => {
                const t = li.textContent.trim();
                if (t) items.push({ type: 'bullet', text: t });
            });
        } else if (BLOCK.has(node.nodeName)) {
            flushInline();
            processBlock(node);
        } else {
            inlineBuf += node.textContent;
        }
    });
    flushInline();
    return items;
}

function renderMobileRight(html) {
    return parseCornellRight(html).map(item => {
        if (item.type === 'bullet') return `<div class="mn-bullet">${escHtml(item.text)}</div>`;
        if (item.type === 'indent') return `<div class="mn-indent">${escHtml(item.text)}</div>`;
        if (item.type === 'gap')    return `<div class="mn-gap"></div>`;
        return `<div class="mn-indent">${escHtml(item.text)}</div>`;
    }).join('');
}

function renderTabletRight(html) {
    return parseCornellRight(html).map(item => {
        if (item.type === 'bullet') return `<p class="bulleted">${escHtml(item.text)}</p>`;
        if (item.type === 'indent') return `<p class="c3-debulleted">${escHtml(item.text)}</p>`;
        if (item.type === 'gap')    return `<p class="gap"></p>`;
        return `<p>${escHtml(item.text)}</p>`;
    }).join('');
}

function normRows(cell) {
    if (cell.rows && cell.rows.length) return cell.rows;
    if (cell.left !== undefined || cell.right !== undefined) return [{ left: cell.left || '', right: cell.right || '', bgLeft: cell.bgLeft || '', bgRight: cell.bgRight || '' }];
    if (cell.content !== undefined) return [{ content: cell.content || '', bg: cell.bg || '' }];
    return [];
}

function renderMobileNotes(cells) {
    const parts = [];
    cells.forEach((cell, i) => {
        if (i > 0) parts.push('<div class="mn-cell-gap"></div>');
        const type = cell.type;
        const rows = normRows(cell);
        if (type === 'header') {
            parts.push(`<div class="mn-h1">${escHtml(stripHtml(rows[0]?.content || ''))}</div>`);
        } else if (type === 'code') {
            parts.push(`<pre class="mn-code">${rows.map(r => escHtml(stripHtml(r.content || ''))).join('\n')}</pre>`);
        } else if (type === 'header-cornell') {
            rows.forEach((r, ri) => {
                const lt = stripHtml(r.left || '').trim();
                if (ri > 0 && !lt) parts.push('<div class="mn-gap"></div>');
                if (lt) parts.push(`<div class="mn-h2">${escHtml(lt)}</div>`);
                parts.push(renderMobileRight(r.right || ''));
            });
        } else if (type === 'cornell') {
            rows.forEach((r, ri) => {
                const lt = stripHtml(r.left || '').trim();
                if (ri > 0 && !lt) parts.push('<div class="mn-gap"></div>');
                if (lt) parts.push(`<div class="mn-h3">${escHtml(lt)}</div>`);
                parts.push(renderMobileRight(r.right || ''));
            });
        } else if (type === 'normal') {
            rows.forEach(r => {
                const content = r.content || '';
                if (content.includes('<table')) { parts.push(renderTableFromHtml(content)); return; }
                const t = stripHtml(content);
                if (t) parts.push(`<div class="mn-para">${escHtml(t)}</div>`);
            });
        }
    });
    return `<div class="mn-wrap">${parts.join('')}</div>`;
}

function renderTabletNotes(cells) {
    const parts = [];
    cells.forEach(cell => {
        const type = cell.type;
        const rows = normRows(cell);
        if (type === 'header') {
            const t = escHtml(stripHtml(rows[0]?.content || ''));
            parts.push(`<div class="tab-cell"><div class="tab-cell-body header">${t}</div></div>`);
        } else if (type === 'code') {
            const t = rows.map(r => escHtml(stripHtml(r.content || ''))).join('\n');
            parts.push(`<div class="tab-cell"><div class="tab-cell-body code">${t}</div></div>`);
        } else if (type === 'normal') {
            const t = escHtml(rows.map(r => stripHtml(r.content || '')).filter(Boolean).join(' '));
            if (t) parts.push(`<div class="tab-cell"><div class="tab-cell-body">${t}</div></div>`);
        } else if (type === 'cornell' || type === 'header-cornell') {
            const isHC = type === 'header-cornell';
            const rowsHtml = rows.map(r => {
                const lt = escHtml(stripHtml(r.left || '').trim());
                const rt = renderTabletRight(r.right || '');
                const lCls = isHC ? 'tab-cell-left hcornell' : 'tab-cell-left';
                return `<div class="tab-cell-row"><div class="${lCls}">${lt}</div><div class="tab-cell-right">${rt}</div></div>`;
            }).join('');
            if (rowsHtml) parts.push(`<div class="tab-cell">${rowsHtml}</div>`);
        }
    });
    return `<div class="tab-wrap">${parts.join('')}</div>`;
}

function renderNoteContent(version) {
    if (!version) return '';
    const isTablet = window.innerWidth >= 600;
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
    return isTablet ? renderTabletNotes(version.cells) : renderMobileNotes(version.cells);
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
    const studiedIdx = c5.revisions.findIndex(r => r.date === dateStr && r.year === year);
    if (studiedIdx >= 0) {
        c5.revisions[studiedIdx] = { date: null, year: null };
    } else {
        let filled = false;
        for (let i = 0; i < c5.activatedCount; i++) {
            if (!c5.revisions[i].date) { c5.revisions[i] = { date: dateStr, year }; filled = true; break; }
        }
        if (!filled) { hideSyncBarAfter('All revision slots filled', 'error', 2000); return; }
    }
    const c5Key = `c5_sectionStore_${mState.currentFileId}`;
    localStorage.setItem(c5Key, JSON.stringify(c5Store));
    localStorage.setItem(`__ts_${c5Key}`, Date.now().toString());
    const contentId = mState.currentContext === 'lib' ? 'mTabContent' : 'mSDTabContent';
    renderDetailTab('notes', contentId);
    pushToSupabase(c5Key, JSON.stringify(c5Store));
}

// ===== C5 TAB =====
function renderC5Tab(container) {
    const fileData = getFileData(mState.currentFileId);
    const c5Store = fileData?.c5_sectionStore ? JSON.parse(fileData.c5_sectionStore) : {};
    const sectionId = mState.currentSectionId;
    if (!c5Store[sectionId]) {
        c5Store[sectionId] = {
            isCompleted: false, difficulty: 'Easy', priority: 'Low',
            revisions: Array(12).fill(null).map(() => ({ date: null, year: null })),
            totalSlots: 12, activatedCount: 4, page: 0,
            scheduleType: 'prime', revisionOn: true
        };
    }
    const c5 = c5Store[sectionId];
    if (!c5.scheduleType) c5.scheduleType = 'prime';
    if (c5.revisionOn === undefined) c5.revisionOn = true;

    const contentId = mState.currentContext === 'lib' ? 'mTabContent' : 'mSDTabContent';
    function rerender() { renderDetailTab('c5', contentId); }

    function ordinal(n) {
        const s = ['th','st','nd','rd'], v = n % 100;
        return n + (s[(v-20)%10] || s[v] || s[0]);
    }

    // ===== COMPUTED VALUES =====
    const filledCount = c5.revisions.filter(r => r?.date).length;
    const activatedCount = c5.activatedCount || 4;
    const pct = activatedCount > 0 ? Math.round(filledCount / activatedCount * 100) : 0;

    function getProficiency(p) {
        if (p <= 25) return { label: 'Novice', color: '#94a3b8' };
        if (p <= 50) return { label: 'Apprentice', color: '#f59e0b' };
        if (p <= 75) return { label: 'Competent', color: '#f97316' };
        return { label: 'Proficient', color: '#22c55e' };
    }
    function getRingColor(p) {
        if (p === 0) return '#334155';
        if (p <= 40) return '#f97316';
        if (p <= 70) return '#f59e0b';
        if (p <= 90) return '#3b82f6';
        return '#22c55e';
    }
    function getLastStudy() {
        const today = new Date(); let latest = null;
        c5.revisions.forEach(r => {
            if (!r?.date) return;
            const [d, m] = r.date.split('/');
            const dt = new Date(r.year || today.getFullYear(), m-1, d);
            if (!latest || dt > latest) latest = dt;
        });
        if (!latest) return 'Never';
        const days = Math.floor((today - latest) / 86400000);
        if (days === 0) return 'Today';
        if (days === 1) return '1d ago';
        if (days < 7) return days + 'd ago';
        const wks = Math.floor(days / 7);
        if (wks < 5) return wks + 'w ago';
        return Math.floor(days / 30) + 'mo ago';
    }

    const proficiency = getProficiency(pct);
    const ringColor = getRingColor(pct);
    const circumference = 408.4;
    const dashOffset = circumference - (circumference * pct / 100);

    // ===== 1. RING CARD =====
    const ringCard = document.createElement('div');
    ringCard.className = 'm-c5-ring-card';
    ringCard.innerHTML = `
        <div class="m-c5-ring-wrap">
            <svg viewBox="0 0 148 148" width="148" height="148" style="transform:rotate(-90deg)">
                <circle class="m-c5-ring-bg" cx="74" cy="74" r="65"/>
                <circle class="m-c5-ring-fill" cx="74" cy="74" r="65"
                    style="stroke:${ringColor};stroke-dashoffset:${dashOffset}"/>
            </svg>
            <div class="m-c5-ring-center">
                <div class="m-c5-ring-pct">${pct}%</div>
            </div>
        </div>
        <div class="m-c5-stats-row">
            <div class="m-c5-stat-chip">
                <div class="m-c5-stat-val">${String(filledCount).padStart(2,'0')}</div>
                <div class="m-c5-stat-key">Revisions</div>
            </div>
            <div class="m-c5-stat-chip">
                <div class="m-c5-stat-val" style="color:${proficiency.color}">${proficiency.label}</div>
                <div class="m-c5-stat-key">Proficiency</div>
            </div>
            <div class="m-c5-stat-chip">
                <div class="m-c5-stat-val">${getLastStudy()}</div>
                <div class="m-c5-stat-key">Last Study</div>
            </div>
        </div>
    `;
    container.appendChild(ringCard);

    // ===== 2. REVISION BOXES =====
    const page = c5.page || 0;
    const totalSlots = c5.totalSlots || 12;
    const pageSize = 12;
    const totalPages = Math.ceil(totalSlots / pageSize);
    const startIdx = page * pageSize;
    const endIdx = Math.min(startIdx + pageSize, totalSlots);
    const lastFilledIdx = c5.revisions.reduce((max, r, i) => r?.date ? i : max, -1);

    const revSection = document.createElement('div');
    revSection.className = 'm-c5-rev-section';
    revSection.innerHTML = `
        <div class="m-c5-rev-header">
            <span class="m-c5-rev-title">Revision Dates</span>
            <div class="m-c5-pag-row">
                <button class="m-c5-pag-btn" id="mc5PagPrev" ${page === 0 ? 'disabled' : ''}>&#8249;</button>
                <span class="m-c5-pag-info">${page+1} / ${totalPages}</span>
                <button class="m-c5-pag-btn" id="mc5PagNext" ${page >= totalPages-1 ? 'disabled' : ''}>&#8250;</button>
            </div>
        </div>
    `;

    const boxesGrid = document.createElement('div');
    boxesGrid.className = 'm-c5-boxes-grid';

    for (let i = startIdx; i < endIdx; i++) {
        const rev = c5.revisions[i] || { date: null, year: null };
        const isActivated = i < activatedCount;
        const isFilled = !!rev.date;
        const isLastFilled = i === lastFilledIdx;
        const isEditable = !isFilled && isActivated && i === lastFilledIdx + 1;

        let state = 'locked';
        if (isFilled && !isLastFilled) state = 'filled-past';
        else if (isFilled && isLastFilled) state = 'filled';
        else if (isEditable) state = 'editable';
        else if (isActivated) state = 'activated';

        const box = document.createElement('div');
        box.className = `m-c5-box ${state}`;

        const topChip = document.createElement('span');
        topChip.className = 'm-c5-box-top';
        topChip.textContent = ordinal(i + 1);
        box.appendChild(topChip);

        if ((state === 'filled' || state === 'filled-past') && rev.date) {
            const dateEl = document.createElement('span');
            dateEl.className = 'm-c5-box-date';
            dateEl.textContent = rev.date;
            box.appendChild(dateEl);
        }

        if (isFilled) {
            const botChip = document.createElement('span');
            botChip.className = 'm-c5-box-bottom';
            botChip.textContent = rev.year || '';
            box.appendChild(botChip);
        }

        if (state === 'editable' || state === 'filled') {
            const dp = document.createElement('input');
            dp.type = 'date';
            dp.style.cssText = 'position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%;z-index:2;-webkit-tap-highlight-color:transparent;outline:none;border:none;background:transparent;';

            // max = today (no future dates)
            const todayD = new Date();
            dp.max = `${todayD.getFullYear()}-${String(todayD.getMonth()+1).padStart(2,'0')}-${String(todayD.getDate()).padStart(2,'0')}`;

            // min = previous revision date + 1 day
            if (i > 0) {
                const prevRev = c5.revisions[i - 1];
                if (prevRev?.date) {
                    const [pd, pm] = prevRev.date.split('/');
                    const py = prevRev.year || todayD.getFullYear();
                    const prevDate = new Date(Number(py), Number(pm) - 1, Number(pd));
                    prevDate.setDate(prevDate.getDate() + 1);
                    dp.min = `${prevDate.getFullYear()}-${String(prevDate.getMonth()+1).padStart(2,'0')}-${String(prevDate.getDate()).padStart(2,'0')}`;
                }
            }

            // pre-populate if box already has a date
            if (rev.date) {
                const [d, m] = rev.date.split('/');
                const y = rev.year || todayD.getFullYear();
                dp.value = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
            }

            dp.addEventListener('change', async () => {
                const val = dp.value;
                if (!val) return;
                const [yr, mo, dy] = val.split('-');
                c5.revisions[i] = { date: `${dy}/${mo}`, year: yr };
                await saveC5(c5Store);
                rerender();
            });
            box.appendChild(dp);
        }

        boxesGrid.appendChild(box);
    }
    revSection.appendChild(boxesGrid);

    const actRow = document.createElement('div');
    actRow.className = 'm-c5-act-row';

    const allActivatedFilled = c5.revisions.slice(0, activatedCount).every(r => r?.date);

    const activateBtn = document.createElement('button');
    activateBtn.className = 'm-c5-act-btn blue';
    activateBtn.textContent = 'Activate More';
    activateBtn.disabled = !allActivatedFilled;
    activateBtn.addEventListener('click', async () => {
        const curActivated = c5.activatedCount;
        if (!c5.revisions.slice(0, curActivated).every(r => r?.date)) return;
        if (curActivated < c5.totalSlots) {
            c5.activatedCount = Math.min(curActivated + 4, c5.totalSlots);
        } else {
            const newSlots = Array(12).fill(null).map(() => ({ date: null, year: null }));
            c5.revisions.push(...newSlots);
            c5.totalSlots += 12;
            c5.activatedCount += 4;
            c5.page = Math.floor((c5.totalSlots - 12) / 12);
        }
        c5.isCompleted = false;
        await saveC5(c5Store); rerender();
    });

    const resetBtn = document.createElement('button');
    resetBtn.className = 'm-c5-act-btn red';
    resetBtn.textContent = 'Reset';
    resetBtn.addEventListener('click', async () => {
        if (!confirm('Reset all revision data?')) return;
        c5.revisions = Array(12).fill(null).map(() => ({ date: null, year: null }));
        c5.activatedCount = 4; c5.totalSlots = 12; c5.page = 0; c5.isCompleted = false;
        await saveC5(c5Store); rerender();
    });

    actRow.appendChild(activateBtn);
    actRow.appendChild(resetBtn);
    revSection.appendChild(actRow);
    container.appendChild(revSection);

    revSection.querySelector('#mc5PagPrev')?.addEventListener('click', async () => {
        if (c5.page > 0) { c5.page--; await saveC5(c5Store); rerender(); }
    });
    revSection.querySelector('#mc5PagNext')?.addEventListener('click', async () => {
        if (c5.page < totalPages - 1) { c5.page++; await saveC5(c5Store); rerender(); }
    });

    // ===== 3. DIFFICULTY + PRIORITY CARD =====
    const diffColors = { Easy:'#22c55e', Moderate:'#f59e0b', Challenging:'#f97316', Hard:'#ef4444' };
    const prioColors = { Low:'#94a3b8', Medium:'#3b82f6', High:'#f97316', Critical:'#ef4444' };

    function makeDropdown(options, current, colors, onSelect, labelMap) {
        const label = key => (labelMap && labelMap[key]) || key;
        const wrap = document.createElement('div');
        wrap.className = 'm-c5-dp-trigger';
        const dot = document.createElement('span');
        dot.className = 'm-c5-dp-dot';
        dot.style.background = colors[current] || '#94a3b8';
        const lbl = document.createElement('span');
        lbl.className = 'm-c5-dp-val';
        lbl.textContent = label(current);
        const arrow = document.createElement('span');
        arrow.className = 'm-c5-dp-arrow';
        arrow.textContent = '▼';
        const menu = document.createElement('div');
        menu.className = 'm-c5-dp-menu';
        options.forEach(opt => {
            const item = document.createElement('div');
            item.className = 'm-c5-dp-option' + (opt === current ? ' selected' : '');
            const itemDot = document.createElement('span');
            itemDot.className = 'm-c5-dp-dot';
            itemDot.style.background = colors[opt];
            item.appendChild(itemDot);
            item.appendChild(document.createTextNode(label(opt)));
            item.addEventListener('click', e => {
                e.stopPropagation();
                dot.style.background = colors[opt];
                lbl.textContent = label(opt);
                menu.querySelectorAll('.m-c5-dp-option').forEach(o => o.classList.remove('selected'));
                item.classList.add('selected');
                wrap.classList.remove('active');
                onSelect(opt);
            });
            menu.appendChild(item);
        });
        wrap.addEventListener('click', e => {
            e.stopPropagation();
            document.querySelectorAll('.m-c5-dp-trigger.active').forEach(d => { if (d !== wrap) d.classList.remove('active'); });
            wrap.classList.toggle('active');
        });
        wrap.appendChild(dot);
        wrap.appendChild(lbl);
        wrap.appendChild(arrow);
        wrap.appendChild(menu);
        return wrap;
    }

    const dpCard = document.createElement('div');
    dpCard.className = 'm-c5-dp-card';

    const diffCell = document.createElement('div');
    diffCell.className = 'm-c5-dp-cell';
    const diffLabel = document.createElement('span');
    diffLabel.className = 'm-c5-dp-label';
    diffLabel.textContent = 'Difficulty';
    diffCell.appendChild(diffLabel);
    diffCell.appendChild(makeDropdown(['Easy','Moderate','Challenging','Hard'], c5.difficulty||'Easy', diffColors, async val => { c5.difficulty = val; await saveC5(c5Store); }));
    dpCard.appendChild(diffCell);

    const prioCell = document.createElement('div');
    prioCell.className = 'm-c5-dp-cell';
    const prioLabel = document.createElement('span');
    prioLabel.className = 'm-c5-dp-label';
    prioLabel.textContent = 'Priority';
    prioCell.appendChild(prioLabel);
    prioCell.appendChild(makeDropdown(['Low','Medium','High','Critical'], c5.priority||'Low', prioColors, async val => { c5.priority = val; await saveC5(c5Store); }));
    dpCard.appendChild(prioCell);

    container.appendChild(dpCard);

    // ===== 4. SCHEDULE CARD =====
    const seriesColors = { prime:'#4d9fec', fibonacci:'#4ec994', triangular:'#ddb56a', regular:'#e8834a', custom:'#a78bfa' };
    const seriesNames  = { prime:'Prime', fibonacci:'Fibonacci', triangular:'Triangular', regular:'Regular', custom:'Custom' };

    const schedCard = document.createElement('div');
    schedCard.className = 'm-c5-sched-card';

    // Revision Series row — simple dropdown
    const seriesRow = document.createElement('div');
    seriesRow.className = 'm-c5-sched-row';
    const seriesRowLabel = document.createElement('span');
    seriesRowLabel.className = 'm-c5-sched-label';
    seriesRowLabel.textContent = 'Revision Series';
    seriesRow.appendChild(seriesRowLabel);
    seriesRow.appendChild(makeDropdown(
        ['prime','fibonacci','triangular','regular','custom'],
        c5.scheduleType || 'prime',
        seriesColors,
        async val => { c5.scheduleType = val; await saveC5(c5Store); rerender(); },
        seriesNames
    ));
    schedCard.appendChild(seriesRow);

    // Badge Status row
    let badgeText = 'No Badge', badgeClass = '';
    try {
        const badge = window.smGetCurrentWeekBadge ? window.smGetCurrentWeekBadge(c5) : null;
        if (badge) {
            badgeText = badge.label || badge.type;
            if (badge.type === 'done')                                         badgeClass = 'done';
            else if (badge.type === 'scheduled' || badge.type === 'in-progress' || badge.type === 'hunting-current' || badge.type === 'defending-current') badgeClass = 'scheduled';
            else if (badge.type === 'missed' || badge.type === 'partial' || badge.type === 'not-done') badgeClass = 'missed';
        }
    } catch(e) {}
    const badgeRow = document.createElement('div');
    badgeRow.className = 'm-c5-sched-row';
    badgeRow.innerHTML = `
        <span class="m-c5-sched-label">Badge Status</span>
        <span class="m-c5-status-badge ${badgeClass}">${badgeText}</span>
    `;
    schedCard.appendChild(badgeRow);

    // Revision Settings toggle row
    const revOn = c5.revisionOn !== false;
    const toggleRow = document.createElement('div');
    toggleRow.className = 'm-c5-sched-row';
    toggleRow.innerHTML = `
        <span class="m-c5-sched-label">Revision Settings</span>
        <div class="m-c5-toggle-wrap">
            <div class="m-c5-toggle-pill${revOn ? '' : ' off'}" id="mc5TogglePill">
                <div class="m-c5-toggle-knob"></div>
            </div>
            <span class="m-c5-toggle-text" style="color:${revOn ? 'var(--success)' : 'var(--text-muted)'}">${revOn ? 'ON' : 'OFF'}</span>
        </div>
    `;
    schedCard.appendChild(toggleRow);
    container.appendChild(schedCard);

    toggleRow.querySelector('#mc5TogglePill').addEventListener('click', async () => {
        c5.revisionOn = !c5.revisionOn;
        await saveC5(c5Store); rerender();
    });

    document.addEventListener('click', () => {
        document.querySelectorAll('.m-c5-dp-trigger.active').forEach(d => d.classList.remove('active'));
    });
}

async function saveC5(c5Store) {
    const c5Key = `c5_sectionStore_${mState.currentFileId}`;
    localStorage.setItem(c5Key, JSON.stringify(c5Store));
    localStorage.setItem(`__ts_${c5Key}`, Date.now().toString());
    await pushToSupabase(c5Key, JSON.stringify(c5Store));
}

// ===== C4 OBSERVATIONS STATE =====
const mC4 = {
    DEFAULT_CATS: ['General', 'Doubts', 'Insights', 'Memorise', 'Keywords', 'Summary', 'Examples', 'Tips'],
    categories: [],
    allNotes: {},
    selectedCat: 'All',
    sortAsc: false,
    editingId: null,
    modalCat: null
};

// ===== C4 TAB =====
function renderC4Tab(container) {
    const fileData = getFileData(mState.currentFileId);
    mC4.allNotes = fileData?.c4_allSectionNotes ? JSON.parse(fileData.c4_allSectionNotes) : {};
    const sectionId = mState.currentSectionId;
    if (!mC4.allNotes[sectionId]) mC4.allNotes[sectionId] = [];

    const savedCats = fileData?.c4_categories ? JSON.parse(fileData.c4_categories) : [];
    const merged = [...mC4.DEFAULT_CATS];
    savedCats.forEach(c => { if (!merged.includes(c)) merged.push(c); });
    mC4.categories = merged;
    mC4.selectedCat = 'All';
    mC4.sortAsc = false;
    mC4.editingId = null;

    container.innerHTML = '';

    const filterBar = document.createElement('div');
    filterBar.className = 'm-c4-filter-bar';
    filterBar.id = 'mC4FilterBar';
    _c4RenderChips(filterBar);
    container.appendChild(filterBar);

    const notesList = document.createElement('div');
    notesList.id = 'mC4NotesList';
    _c4RenderNotes(notesList);
    container.appendChild(notesList);
}

function _c4RenderChips(bar) {
    bar.innerHTML = '';
    const sectionId = mState.currentSectionId;
    const notes = mC4.allNotes[sectionId] || [];
    const counts = {};
    notes.forEach(n => { counts[n.category] = (counts[n.category] || 0) + 1; });
    const total = notes.length;

    // Reset selected cat if it no longer has notes
    if (mC4.selectedCat !== 'All' && (counts[mC4.selectedCat] || 0) === 0) mC4.selectedCat = 'All';

    const makeChip = (label, cat) => {
        const chip = document.createElement('button');
        chip.className = 'm-c4-chip' + (cat === mC4.selectedCat ? ' active' : '');
        chip.textContent = label;
        chip.addEventListener('click', () => {
            mC4.selectedCat = cat;
            _c4RenderChips(document.getElementById('mC4FilterBar'));
            _c4RenderNotes(document.getElementById('mC4NotesList'));
        });
        bar.appendChild(chip);
    };

    makeChip(`All (${total})`, 'All');
    mC4.categories.forEach(cat => {
        const count = counts[cat] || 0;
        if (count > 0) makeChip(`${cat} (${count})`, cat);
    });
}

function _c4RenderNotes(container) {
    if (!container) return;
    container.innerHTML = '';
    const sectionId = mState.currentSectionId;
    const notes = mC4.allNotes[sectionId] || [];

    const filtered = mC4.selectedCat === 'All' ? [...notes] : notes.filter(n => n.category === mC4.selectedCat);
    const sortFn = (a, b) => {
        const at = new Date(a.updatedAt || a.createdAt);
        const bt = new Date(b.updatedAt || b.createdAt);
        return mC4.sortAsc ? at - bt : bt - at;
    };
    const sorted = [
        ...filtered.filter(n => n.starred).sort(sortFn),
        ...filtered.filter(n => !n.starred && !n.checked).sort(sortFn),
        ...filtered.filter(n => !n.starred && n.checked).sort(sortFn)
    ];

    if (sorted.length === 0) {
        container.innerHTML = '<div class="m-empty">No observations yet.</div>';
        return;
    }

    sorted.forEach(note => {
        const card = document.createElement('div');
        card.className = 'm-c4-note' + (note.starred ? ' starred' : '');
        card.innerHTML = `
            <div class="m-c4-note-header">
                <span class="m-c4-note-cat">${escHtml(note.category)}</span>
                <div class="m-c4-note-actions">
                    <button class="m-c4-action-btn edit" title="Edit">✎</button>
                    <button class="m-c4-action-btn delete" title="Delete">🗑</button>
                    <button class="m-c4-action-btn star${note.starred ? ' active' : ''}" title="Star">★</button>
                    <input type="checkbox" class="m-c4-check" ${note.checked ? 'checked' : ''}>
                </div>
            </div>
            <div class="m-c4-note-title${note.checked ? ' checked' : ''}">${escHtml(note.title)}</div>
            <div class="m-c4-note-body${note.checked ? ' checked' : ''}">${escHtml(note.content)}</div>
            <div class="m-c4-note-ts">${_c4FormatTs(note)}</div>
        `;
        card.querySelector('.edit').addEventListener('click', () => _c4OpenModal(note.id));
        card.querySelector('.delete').addEventListener('click', async () => {
            if (!confirm('Delete this observation?')) return;
            const idx = (mC4.allNotes[sectionId] || []).findIndex(n => n.id === note.id);
            if (idx !== -1) mC4.allNotes[sectionId].splice(idx, 1);
            await _c4Save();
            _c4RenderNotes(container);
            _c4RenderChips(document.getElementById('mC4FilterBar'));
        });
        card.querySelector('.star').addEventListener('click', async () => {
            const n = (mC4.allNotes[sectionId] || []).find(n => n.id === note.id);
            if (n) { n.starred = !n.starred; await _c4Save(); _c4RenderNotes(container); }
        });
        card.querySelector('.m-c4-check').addEventListener('change', async (e) => {
            const n = (mC4.allNotes[sectionId] || []).find(n => n.id === note.id);
            if (n) { n.checked = e.target.checked; n.updatedAt = new Date().toISOString(); await _c4Save(); _c4RenderNotes(container); }
        });
        container.appendChild(card);
    });
}

function _c4FormatTs(note) {
    const ref = note.updatedAt ? new Date(note.updatedAt) : new Date(note.createdAt);
    const label = note.updatedAt ? 'Updated' : 'Added';
    const diff = Math.floor((Date.now() - ref) / 86400000);
    if (diff === 0) return `${label}: today`;
    if (diff < 30) return `${label}: ${diff} day${diff === 1 ? '' : 's'} ago`;
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${label} on: ${String(ref.getDate()).padStart(2,'0')} - ${months[ref.getMonth()]} - ${ref.getFullYear()}`;
}

async function _c4Save() {
    const notesKey = `c4_allSectionNotes_${mState.currentFileId}`;
    const catsKey = `c4_categories_${mState.currentFileId}`;
    localStorage.setItem(notesKey, JSON.stringify(mC4.allNotes));
    localStorage.setItem(`__ts_${notesKey}`, Date.now().toString());
    localStorage.setItem(catsKey, JSON.stringify(mC4.categories));
    localStorage.setItem(`__ts_${catsKey}`, Date.now().toString());
    await pushToSupabase(notesKey, JSON.stringify(mC4.allNotes));
    await pushToSupabase(catsKey, JSON.stringify(mC4.categories));
}

// ===== C4 ADD/EDIT MODAL =====
function _c4OpenModal(editId) {
    mC4.editingId = editId;
    const note = editId != null ? (mC4.allNotes[mState.currentSectionId] || []).find(n => n.id === editId) : null;
    mC4.modalCat = note?.category || mC4.categories[0] || 'General';

    document.getElementById('mC4Modal')?.remove();

    const overlay = document.createElement('div');
    overlay.className = 'm-modal-overlay active';
    overlay.id = 'mC4Modal';
    overlay.innerHTML = `
        <div class="m-modal">
            <div class="m-modal-title">${editId != null ? 'Edit' : 'Add'} Observation</div>
            <div class="m-c4-cat-selector-row">
                <button class="m-c4-cat-dropdown-btn" id="mC4CatDropBtn"><span>${escHtml(mC4.modalCat)}</span><span>▾</span></button>
                <button class="m-c4-add-cat-icon-btn" id="mC4AddCatBtn" title="Add category">+</button>
            </div>
            <div class="m-c4-cat-list" id="mC4CatList" style="display:none"></div>
            <input class="m-modal-input" id="mC4TitleInput" placeholder="Title" maxlength="80" value="${escHtml(note?.title || '')}">
            <div class="m-c4-counter" id="mC4TitleCounter">${(note?.title || '').length}/80</div>
            <textarea class="m-modal-input m-modal-textarea" id="mC4ContentInput" placeholder="Content" maxlength="280">${escHtml(note?.content || '')}</textarea>
            <div class="m-c4-counter" id="mC4ContentCounter">${(note?.content || '').length}/280</div>
            <div class="m-modal-btns">
                <button class="m-modal-btn cancel" id="mC4CancelBtn">Cancel</button>
                <button class="m-modal-btn save" id="mC4SaveBtn">Save</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    _c4RenderModalCats();

    overlay.addEventListener('click', e => { if (e.target === overlay) _c4CloseModal(); });
    document.getElementById('mC4CancelBtn').addEventListener('click', _c4CloseModal);
    document.getElementById('mC4SaveBtn').addEventListener('click', _c4SaveNote);
    document.getElementById('mC4AddCatBtn').addEventListener('click', _c4OpenAddCatPopup);
    document.getElementById('mC4CatDropBtn').addEventListener('click', () => {
        const list = document.getElementById('mC4CatList');
        list.style.display = list.style.display === 'none' ? 'block' : 'none';
        if (list.style.display === 'block') _c4RenderModalCats();
    });
    document.getElementById('mC4TitleInput').addEventListener('input', () => {
        document.getElementById('mC4TitleCounter').textContent = `${document.getElementById('mC4TitleInput').value.length}/80`;
    });
    document.getElementById('mC4ContentInput').addEventListener('input', () => {
        document.getElementById('mC4ContentCounter').textContent = `${document.getElementById('mC4ContentInput').value.length}/280`;
    });
    setTimeout(() => document.getElementById('mC4TitleInput')?.focus(), 100);
}

function _c4RenderModalCats() {
    const list = document.getElementById('mC4CatList');
    if (!list) return;
    list.innerHTML = '';
    mC4.categories.forEach(cat => {
        const isGeneral = cat === 'General';
        const item = document.createElement('div');
        item.className = 'm-c4-cat-item' + (cat === mC4.modalCat ? ' active' : '');
        item.innerHTML = `
            <span class="m-c4-cat-name">${escHtml(cat)}</span>
            <div class="m-c4-cat-item-actions">
                ${!isGeneral ? `<button class="m-c4-cat-action rename" title="Rename">✎</button>` : ''}
                ${!isGeneral ? `<button class="m-c4-cat-action del" title="Delete">🗑</button>` : ''}
            </div>
        `;
        item.querySelector('.m-c4-cat-name').addEventListener('click', () => {
            mC4.modalCat = cat;
            const dropBtn = document.getElementById('mC4CatDropBtn');
            if (dropBtn) dropBtn.querySelector('span').textContent = cat;
            const list2 = document.getElementById('mC4CatList');
            if (list2) list2.style.display = 'none';
            _c4RenderModalCats();
        });
        if (!isGeneral) {
            item.querySelector('.rename').addEventListener('click', e => { e.stopPropagation(); _c4ShowRenameInput(cat, item); });
            item.querySelector('.del').addEventListener('click', async e => {
                e.stopPropagation();
                if (!confirm(`Delete "${cat}"? Notes will move to General.`)) return;
                mC4.categories.splice(mC4.categories.indexOf(cat), 1);
                Object.values(mC4.allNotes).forEach(notes => notes.forEach(n => { if (n.category === cat) n.category = 'General'; }));
                if (mC4.modalCat === cat) mC4.modalCat = 'General';
                await _c4Save();
                _c4RenderModalCats();
                _c4RenderChips(document.getElementById('mC4FilterBar'));
                _c4RenderNotes(document.getElementById('mC4NotesList'));
            });
        }
        list.appendChild(item);
    });
}

function _c4ShowRenameInput(cat, itemEl) {
    itemEl.innerHTML = `
        <input class="m-c4-cat-rename-input" value="${escHtml(cat)}" maxlength="40">
        <div class="m-c4-cat-item-actions">
            <button class="m-c4-cat-action confirm" title="Save">✔</button>
            <button class="m-c4-cat-action cancel-r" title="Cancel">✕</button>
        </div>
    `;
    const input = itemEl.querySelector('.m-c4-cat-rename-input');
    input.focus(); input.select();
    const confirmFn = async () => {
        const newCat = input.value.trim();
        if (!newCat || newCat === cat) { _c4RenderModalCats(); return; }
        if (mC4.categories.some(c => c.toLowerCase() === newCat.toLowerCase() && c !== cat)) { alert('Category already exists.'); return; }
        mC4.categories[mC4.categories.indexOf(cat)] = newCat;
        Object.values(mC4.allNotes).forEach(notes => notes.forEach(n => { if (n.category === cat) n.category = newCat; }));
        if (mC4.modalCat === cat) mC4.modalCat = newCat;
        await _c4Save();
        _c4RenderModalCats();
        _c4RenderChips(document.getElementById('mC4FilterBar'));
        _c4RenderNotes(document.getElementById('mC4NotesList'));
    };
    itemEl.querySelector('.confirm').addEventListener('click', confirmFn);
    itemEl.querySelector('.cancel-r').addEventListener('click', () => _c4RenderModalCats());
    input.addEventListener('keydown', e => { if (e.key === 'Enter') confirmFn(); if (e.key === 'Escape') _c4RenderModalCats(); });
}

function _c4CloseModal() {
    document.getElementById('mC4Modal')?.remove();
    mC4.editingId = null;
}

async function _c4SaveNote() {
    const title = document.getElementById('mC4TitleInput')?.value.trim();
    const content = document.getElementById('mC4ContentInput')?.value.trim();
    if (!title) { alert('Please enter a title.'); return; }
    if (!content) { alert('Please enter content.'); return; }

    const sectionId = mState.currentSectionId;
    if (!mC4.allNotes[sectionId]) mC4.allNotes[sectionId] = [];
    const notes = mC4.allNotes[sectionId];

    if (mC4.editingId != null) {
        const note = notes.find(n => n.id === mC4.editingId);
        if (note) { note.title = title; note.content = content; note.category = mC4.modalCat || 'General'; note.updatedAt = new Date().toISOString(); }
    } else {
        const maxId = notes.reduce((m, n) => Math.max(m, n.id || 0), 0);
        notes.unshift({ id: maxId + 1, title, content, category: mC4.modalCat || 'General', starred: false, checked: false, createdAt: new Date().toISOString(), updatedAt: null });
    }

    await _c4Save();
    _c4CloseModal();
    _c4RenderNotes(document.getElementById('mC4NotesList'));
    _c4RenderChips(document.getElementById('mC4FilterBar'));
}

// ===== C4 ADD CATEGORY POPUP =====
function _c4OpenAddCatPopup() {
    document.getElementById('mC4CatPopup')?.remove();

    const popup = document.createElement('div');
    popup.className = 'm-modal-overlay active';
    popup.id = 'mC4CatPopup';
    popup.innerHTML = `
        <div class="m-modal" style="max-width:300px">
            <div class="m-modal-title">New Category</div>
            <input class="m-modal-input" id="mC4NewCatInput" placeholder="Category name" maxlength="40">
            <div class="m-modal-btns">
                <button class="m-modal-btn cancel" id="mC4CatCancelBtn">Cancel</button>
                <button class="m-modal-btn save" id="mC4CatSaveBtn">Add</button>
            </div>
        </div>
    `;
    document.body.appendChild(popup);

    const closePopup = () => popup.remove();
    const confirmFn = async () => {
        const val = document.getElementById('mC4NewCatInput')?.value.trim();
        if (!val) { alert('Enter a name.'); return; }
        if (mC4.categories.some(c => c.toLowerCase() === val.toLowerCase())) { alert('Category already exists.'); return; }
        mC4.categories.push(val);
        mC4.modalCat = val;
        await _c4Save();
        closePopup();
        _c4RenderModalCats();
    };
    popup.addEventListener('click', e => { if (e.target === popup) closePopup(); });
    document.getElementById('mC4CatCancelBtn').addEventListener('click', closePopup);
    document.getElementById('mC4CatSaveBtn').addEventListener('click', confirmFn);
    document.getElementById('mC4NewCatInput').addEventListener('keydown', e => {
        if (e.key === 'Enter') confirmFn();
        if (e.key === 'Escape') closePopup();
    });
    setTimeout(() => document.getElementById('mC4NewCatInput')?.focus(), 100);
}
