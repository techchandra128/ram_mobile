// mobile_library.js — library rendering, section list, section detail, notes, tasks, progress

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

// ===== LIBRARY: VIEW SWITCH =====
function switchLibView(view) {
    mState.libView = view;
    const icon = document.getElementById('mLibViewIcon');
    if (view === 'list') {
        // In list mode — icon shows grid (tap to switch to grid)
        icon.innerHTML = '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>';
    } else {
        // In grid mode — icon shows list (tap to switch to list)
        icon.innerHTML = '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>';
    }
    const active = document.querySelector('#pagLibrary .m-screen.active');
    if (active?.id === 'screenLibraryRoot') renderLibraryRoot();
    else if (active?.id === 'screenLibraryFolder') {
        const top = mState.libStack[mState.libStack.length - 1];
        if (top?.folder) renderFolderFiles(top.title, top.folder.contents);
    }
}

// ===== LIBRARY: SORT SHEET =====
function openLibSortSheet() {
    document.querySelectorAll('#mLibSortSheet .m-sort-option').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.sort === mState.libRootSort);
    });
    document.getElementById('mLibSortSheet').classList.add('active');
}

function closeLibSortSheet() {
    document.getElementById('mLibSortSheet').classList.remove('active');
}

// ===== LIBRARY: TOOLBAR BIND =====
function bindLibRootToolbar() {
    document.getElementById('mLibSortBtn').addEventListener('click', openLibSortSheet);
    document.getElementById('mLibViewBtn').addEventListener('click', () => {
        switchLibView(mState.libView === 'list' ? 'grid' : 'list');
    });
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
}

// ===== LIST VIEW: FOLDER CARD =====
function makeListFolderCard(folder) {
    const pct = folder.progress || 0;
    const color = getLibProgressColor(pct);
    const fileCount = Object.keys(folder.contents).filter(k => folder.contents[k].type === 'file').length;
    const card = document.createElement('div');
    card.className = 'm-file-card m-folder-card';
    card.innerHTML = `
        <div class="m-file-icon">📁</div>
        <div class="m-file-info">
            <div class="m-file-name">${escHtml(folder.name)}</div>
            <div class="m-file-meta">${fileCount} file${fileCount !== 1 ? 's' : ''}</div>
        </div>
        <div class="m-pct-badge" style="color:${color};border-color:${color}">${pct}%</div>
        <div class="m-file-arrow"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg></div>
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
    const color = getLibProgressColor(pct);
    const card = document.createElement('div');
    card.className = 'm-file-card';
    card.innerHTML = `
        <div class="m-file-icon">📖</div>
        <div class="m-file-info">
            <div class="m-file-name">${escHtml(file.name)}</div>
            <div class="m-file-meta">${sectionCount} section${sectionCount !== 1 ? 's' : ''}</div>
        </div>
        <div class="m-pct-badge" style="color:${color};border-color:${color}">${pct}%</div>
        <div class="m-file-arrow"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg></div>
    `;
    card.addEventListener('click', () => {
        mState.currentFileId = file.id;
        mState.currentFileName = file.name;
        mState.currentContext = 'lib';
        pushLibStack({ screen: 'screenSections', title: file.name });
        renderSectionList('lib');
        showLibScreen('screenSections');
        bindLibSort();
    });
    return card;
}

// ===== GRID VIEW: FOLDER =====
function makeGridFolderItem(folder, ringBg) {
    const pct = Math.round(folder.progress || 0);
    const color = getLibProgressColor(pct);
    const deg = Math.round((pct / 100) * 360);
    const item = document.createElement('div');
    item.className = 'm-grid-item';
    const circle = document.createElement('div');
    circle.className = 'm-prog-circle';
    circle.style.background = `conic-gradient(${color} ${deg}deg, ${ringBg} ${deg}deg)`;
    const inner = document.createElement('div');
    inner.className = 'm-prog-circle-inner';
    inner.textContent = pct + '%';
    inner.style.color = color;
    circle.appendChild(inner);
    item.appendChild(circle);
    const name = document.createElement('div');
    name.className = 'm-grid-name';
    name.textContent = folder.name;
    name.title = folder.name;
    item.appendChild(name);
    item.addEventListener('click', () => {
        pushLibStack({ screen: 'screenLibraryFolder', title: folder.name, folder });
        renderFolderFiles(folder.name, folder.contents);
    });
    return item;
}

// ===== GRID VIEW: FILE =====
function makeGridFileItem(file, ringBg) {
    const pct = Math.round(file.progress || 0);
    const color = getLibProgressColor(pct);
    const deg = Math.round((pct / 100) * 360);
    const item = document.createElement('div');
    item.className = 'm-grid-item';
    const rect = document.createElement('div');
    rect.className = 'm-prog-rect';
    rect.style.background = `conic-gradient(${color} ${deg}deg, ${ringBg} ${deg}deg)`;
    const inner = document.createElement('div');
    inner.className = 'm-prog-rect-inner';
    inner.textContent = pct + '%';
    inner.style.color = color;
    rect.appendChild(inner);
    item.appendChild(rect);
    const name = document.createElement('div');
    name.className = 'm-grid-name';
    name.textContent = file.name;
    name.title = file.name;
    item.appendChild(name);
    item.addEventListener('click', () => {
        mState.currentFileId = file.id;
        mState.currentFileName = file.name;
        mState.currentContext = 'lib';
        pushLibStack({ screen: 'screenSections', title: file.name });
        renderSectionList('lib');
        showLibScreen('screenSections');
        bindLibSort();
    });
    return item;
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
        grid.className = 'm-lib-grid';
        const ringBg = getComputedStyle(document.body).getPropertyValue('--bg3').trim() || '#1e293b';
        sortedFolders.forEach(folder => grid.appendChild(makeGridFolderItem(folder, ringBg)));
        sortedFiles.forEach(file => grid.appendChild(makeGridFileItem(file, ringBg)));
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
        grid.className = 'm-lib-grid';
        const ringBg = getComputedStyle(document.body).getPropertyValue('--bg3').trim() || '#1e293b';
        sortedFiles.forEach(file => grid.appendChild(makeGridFileItem(file, ringBg)));
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

    if (context === 'sd') { mState._sdSections = sections; mState._sdC5Store = c5Store; }

    container.innerHTML = '';

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

    const notesWithContent = LEVELS.filter(l => {
        const ld = sectionData?.notes?.[l.id];
        return ld?.versions?.length;
    });

    if (notesWithContent.length > 0) {
        const controls = document.createElement('div');
        controls.className = 'm-notes-controls';

        const levelSelect = document.createElement('select');
        levelSelect.className = 'm-notes-select';
        levelSelect.id = 'mNoteLevelSelect';
        notesWithContent.forEach(l => {
            const opt = document.createElement('option');
            opt.value = l.id;
            opt.textContent = l.icon + ' ' + l.label;
            levelSelect.appendChild(opt);
        });

        const versionSelect = document.createElement('select');
        versionSelect.className = 'm-notes-select';
        versionSelect.id = 'mNoteVersionSelect';

        controls.appendChild(levelSelect);
        controls.appendChild(versionSelect);
        container.appendChild(controls);

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

    const allSectionsData = getFileData(mState.currentFileId);
    const allSections = allSectionsData?.c12_sections ? JSON.parse(allSectionsData.c12_sections).filter(s => s.type === 'real') : [];
    const currentIdx = allSections.findIndex(s => String(s.id) === String(mState.currentSectionId));

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
    hideSyncBarAfter('Saved ✓', 'success', 2000);
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
        slot.innerHTML = `<div class="m-rev-slot-num">#${i+1}</div><div class="m-rev-slot-date">${isFilled ? rev.date : (isActive ? '—' : '·')}</div>`;
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
    hideSyncBarAfter('Saved ✓', 'success', 2000);
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
    hideSyncBarAfter('Saved ✓', 'success', 2000);
}
