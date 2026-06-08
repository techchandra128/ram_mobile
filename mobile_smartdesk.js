// mobile_smartdesk.js — Smart Desk screen rendering and navigation

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

// ===== TAB SWITCHING =====
function sdSwitchMainTab(tab) {
    document.querySelectorAll('#mSDMainTabBar .m-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === tab);
    });
    const fileList = document.getElementById('mSDFileList');
    const playlistList = document.getElementById('mSDPlaylistList');
    if (tab === 'files') {
        fileList.style.display = '';
        playlistList.style.display = 'none';
        renderSDFileList();
    } else {
        fileList.style.display = 'none';
        playlistList.style.display = '';
        renderSDPlaylistList();
    }
}

// ===== FILES TAB =====
function renderSDFileList() {
    const container = document.getElementById('mSDFileList');
    if (!container) return;

    const shortcutRaw = mState.syncData?.['ram_smartDesk'];
    const shortcuts = shortcutRaw
        ? (typeof shortcutRaw === 'string' ? JSON.parse(shortcutRaw) : shortcutRaw)
        : [];

    if (shortcuts.length === 0) {
        container.innerHTML = '<div class="m-empty">No files on Smart Desk.</div>';
        return;
    }

    const fs = getFileSystem();
    if (!fs) { container.innerHTML = '<div class="m-empty">No files found.</div>'; return; }

    const allFiles = collectFiles(fs);
    const pinned = shortcuts.map(id => allFiles.find(f => f.id === id)).filter(Boolean);

    if (pinned.length === 0) {
        container.innerHTML = '<div class="m-empty">No files on Smart Desk.</div>';
        return;
    }

    container.innerHTML = '';
    if (mState.libView === 'grid') {
        const grid = document.createElement('div');
        grid.className = 'lib-grid';
        pinned.forEach(file => grid.appendChild(makeGridFileCard(file, 'sd')));
        container.appendChild(grid);
    } else {
        pinned.forEach(file => container.appendChild(makeFileCard(file, 'sd')));
    }
}

// ===== PLAYLISTS TAB =====
function renderSDPlaylistList() {
    const container = document.getElementById('mSDPlaylistList');
    if (!container) return;

    const shortcutRaw = mState.syncData?.['ram_smartDesk_playlists'];
    const shortcuts = shortcutRaw
        ? (typeof shortcutRaw === 'string' ? JSON.parse(shortcutRaw) : shortcutRaw)
        : [];

    if (shortcuts.length === 0) {
        container.innerHTML = '<div class="m-empty">No sets on Smart Desk.</div>';
        return;
    }

    const playlistsRaw = mState.syncData?.['ram_playlists'];
    const allPlaylists = playlistsRaw
        ? (typeof playlistsRaw === 'string' ? JSON.parse(playlistsRaw) : playlistsRaw)
        : [];

    const pinned = shortcuts.map(id => allPlaylists.find(p => p.id === id)).filter(Boolean);

    if (pinned.length === 0) {
        container.innerHTML = '<div class="m-empty">No sets on Smart Desk.</div>';
        return;
    }

    container.innerHTML = '';
    if (mState.libView === 'grid') {
        const grid = document.createElement('div');
        grid.className = 'lib-grid';
        pinned.forEach(pl => grid.appendChild(makeGridPlaylistCard(pl)));
        container.appendChild(grid);
    } else {
        pinned.forEach(pl => container.appendChild(makePlaylistCard(pl)));
    }
}

function getPlaylistProgress(pl) {
    if (!pl.sections || pl.sections.length === 0) return 0;
    const cache = {};
    let total = 0, count = 0;
    pl.sections.forEach(({ fileId, sectionId }) => {
        const fid = fileId.startsWith('f_') ? fileId : `f_${fileId}`;
        if (!cache[fid]) cache[fid] = getFileData(fid);
        const c5Store = cache[fid]?.c5_sectionStore ? JSON.parse(cache[fid].c5_sectionStore) : {};
        total += (c5Store[sectionId]?.proficiency || 0);
        count++;
    });
    return count > 0 ? Math.round(total / count) : 0;
}

function makePlaylistCard(pl) {
    const count = pl.sections ? pl.sections.length : 0;
    const pct = getPlaylistProgress(pl);
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
                <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
            </svg>
        </div>
        <div class="oa-info">
            <div class="oa-name">${escHtml(pl.name)}</div>
            <div class="oa-meta">
                <span>${count} section${count !== 1 ? 's' : ''}</span>
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
        mState.currentFileName = pl.name;
        renderPlaylistSectionList(pl);
        showSDScreen('screenSDSections');
        updateTopbar();
    });
    return card;
}

function makeGridPlaylistCard(pl) {
    const count = pl.sections ? pl.sections.length : 0;
    const pct = getPlaylistProgress(pl);
    const color = getLibDisplayColor(pct);
    const [g1, g2] = getGridGradient(pct);
    const card = document.createElement('div');
    card.className = 'gc-card';
    card.innerHTML = `
        <div class="gc-top" style="background:linear-gradient(135deg,${g1},${g2})">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
            </svg>
            <div class="gc-name">${escHtml(pl.name)}</div>
            <div class="gc-meta">${count} section${count !== 1 ? 's' : ''}</div>
        </div>
        <div class="gc-bottom">
            <div class="gc-bar-track"><div class="gc-bar" style="width:${pct}%;background:${color}"></div></div>
            <span class="gc-pct" style="color:${color}">${pct}%</span>
        </div>
    `;
    card.addEventListener('click', () => {
        mState.currentFileName = pl.name;
        renderPlaylistSectionList(pl);
        showSDScreen('screenSDSections');
        updateTopbar();
    });
    return card;
}

// ===== PLAYLIST SECTION LIST =====
function renderPlaylistSectionList(pl) {
    const container = document.getElementById('mSDSectionList');
    container.innerHTML = '';

    if (!pl.sections || pl.sections.length === 0) {
        container.innerHTML = '<div class="m-empty">No sections in this playlist.</div>';
        return;
    }

    const fs = getFileSystem();
    const allFiles = fs ? collectFiles(fs) : [];
    const isGrid = mState.libView === 'grid';

    const makeCard = (ref) => {
        const fileData = getFileData(ref.fileId);
        const sections = fileData?.c12_sections ? JSON.parse(fileData.c12_sections) : [];
        const section = sections.find(s => s.id === ref.sectionId || s.id === Number(ref.sectionId));
        const title = section?.title || `Section ${ref.sectionId}`;
        const c5Store = fileData?.c5_sectionStore ? JSON.parse(fileData.c5_sectionStore) : {};
        const c5 = c5Store[ref.sectionId] || c5Store[String(ref.sectionId)] || {};
        const fileObj = allFiles.find(f => f.id === ref.fileId);
        const fileName = fileObj?.name || '';

        const card = isGrid
            ? makeSectionGridCard(title, c5, true, fileName, 'prof')
            : makeSectionListCard(title, c5, true, fileName, 'prof');
        card.addEventListener('click', () => {
            mState.currentFileId = ref.fileId;
            mState.currentFileName = fileName;
            openSection(ref.sectionId, title, 'sd');
        });
        return card;
    };

    if (isGrid) {
        const grid = document.createElement('div');
        grid.className = 'sc-section-grid';
        pl.sections.forEach(ref => grid.appendChild(makeCard(ref)));
        container.appendChild(grid);
    } else {
        pl.sections.forEach(ref => container.appendChild(makeCard(ref)));
    }
}
