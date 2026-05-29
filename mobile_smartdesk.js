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

function renderSDFileList() {
    const container = document.getElementById('mSDFileList');
    const fs = getFileSystem();
    if (!fs) { container.innerHTML = '<div class="m-empty">No files found.</div>'; return; }
    const files = collectFiles(fs);
    if (files.length === 0) { container.innerHTML = '<div class="m-empty">No files yet.</div>'; return; }
    container.innerHTML = '';
    files.forEach(file => container.appendChild(makeFileCard(file, 'sd')));
}

function bindSDSort() {
    document.getElementById('mSDSortSelect').addEventListener('change', (e) => {
        mState.sdSort = e.target.value;
        const sections = mState._sdSections;
        const c5Store = mState._sdC5Store;
        if (sections && c5Store) {
            renderSectionItems(document.getElementById('mSDSectionList'), sections, c5Store, mState.sdSort, 'sd');
        }
    });
}
