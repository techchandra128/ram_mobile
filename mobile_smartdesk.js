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

    const shortcutRaw = mState.syncData?.['ram_smartDeskPlaylists'];
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
        <div class="m-file-icon">🎵</div>
        <div class="m-file-info">
            <div class="m-file-name">${escHtml(pl.name)}</div>
            <div class="m-file-meta">${count} section${count !== 1 ? 's' : ''}</div>
        </div>
        <div class="m-file-arrow"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg></div>
    `;
    return card;
}
