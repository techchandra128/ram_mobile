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
    pinned.forEach(file => container.appendChild(makeFileCard(file, 'sd')));
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
        container.innerHTML = '<div class="m-empty">No playlists on Smart Desk.</div>';
        return;
    }

    const playlistsRaw = mState.syncData?.['ram_playlists'];
    const allPlaylists = playlistsRaw
        ? (typeof playlistsRaw === 'string' ? JSON.parse(playlistsRaw) : playlistsRaw)
        : [];

    const pinned = shortcuts.map(id => allPlaylists.find(p => p.id === id)).filter(Boolean);

    if (pinned.length === 0) {
        container.innerHTML = '<div class="m-empty">No playlists on Smart Desk.</div>';
        return;
    }

    container.innerHTML = '';
    pinned.forEach(pl => container.appendChild(makePlaylistCard(pl)));
}

function makePlaylistCard(pl) {
    const count = pl.sections ? pl.sections.length : 0;
    const card = document.createElement('div');
    card.className = 'm-file-card';
    card.innerHTML = `
        <div class="m-file-icon">📇</div>
        <div class="m-file-info">
            <div class="m-file-name">${escHtml(pl.name)}</div>
            <div class="m-file-meta">${count} section${count !== 1 ? 's' : ''}</div>
        </div>
        <div class="m-file-arrow"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg></div>
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

    pl.sections.forEach(ref => {
        const fileData = getFileData(ref.fileId);
        const sections = fileData?.c12_sections ? JSON.parse(fileData.c12_sections) : [];
        const section = sections.find(s => s.id === ref.sectionId || s.id === Number(ref.sectionId));
        const title = section?.title || `Section ${ref.sectionId}`;

        const c5Store = fileData?.c5_sectionStore ? JSON.parse(fileData.c5_sectionStore) : {};
        const c5 = c5Store[ref.sectionId] || c5Store[String(ref.sectionId)];
        const pct = c5?.proficiency || 0;
        const color = getLibProgressColor(pct);

        const fileObj = allFiles.find(f => f.id === ref.fileId);
        const fileName = fileObj?.name || '';

        const card = document.createElement('div');
        card.className = 'm-file-card m-section-card';
        card.innerHTML = `
            <div class="m-file-icon">📄</div>
            <div class="m-file-info">
                <div class="m-file-name">${escHtml(title)}</div>
                ${fileName ? `<div class="m-file-meta">${escHtml(fileName)}</div>` : ''}
            </div>
            <div class="m-pct-badge" style="color:${color};border-color:${color}">${pct}%</div>
        `;
        card.addEventListener('click', () => {
            mState.currentFileId = ref.fileId;
            mState.currentFileName = fileName;
            openSection(ref.sectionId, title, 'sd');
        });
        container.appendChild(card);
    });
}
