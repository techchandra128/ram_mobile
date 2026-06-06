// column1-2.js - Section List Panel

// ===== STATE =====
const c12State = {
    currentSort: 'Outline',
    sortAsc: true,
    sortOrder: 'asc', // 'asc' | 'desc' | 'none'
    selectedSection: 'navigation',
    selectedType: 'real',
    insertAfterIndex: null,
    newSectionLevel: 1,

    // Navigation is separate — not in sections array
    navigation: {
        id: 'navigation', title: 'Table of Contents', type: 'navigation', level: 1,
        progress: 70, revisionCount: 10, revisionTotal: 16, lastRevised: 2
    },

    sections: [],
    nextId: 1
    
};

// ===== LOCALSTORAGE =====
let c12FileId = null;
let c12FileName = '';

// ===== PLAYLIST MODE =====
const c12PlaylistMode = (() => {
    const params = new URLSearchParams(window.location.search);
    return !!params.get('playlistId');
})();
let c12PlaylistId = null;
let c12PlaylistSections = []; // [{ fileId, sectionId }]

function getPlaylist() {
    if (!c12PlaylistId) {
        const params = new URLSearchParams(window.location.search);
        c12PlaylistId = params.get('playlistId');
    }
    try {
        const all = JSON.parse(localStorage.getItem('ram_playlists') || '[]');
        return all.find(p => p.id === c12PlaylistId) || null;
    } catch(e) { return null; }
}

function savePlaylist(pl) {
    try {
        const all = JSON.parse(localStorage.getItem('ram_playlists') || '[]');
        const idx = all.findIndex(p => p.id === pl.id);
        if (idx !== -1) all[idx] = pl;
        localStorage.setItem('ram_playlists', JSON.stringify(all));
    } catch(e) {}
}

function getFileId() {
    if (c12FileId) return c12FileId;
    const params = new URLSearchParams(window.location.search);
    c12FileId = params.get('fileId') || 'default';
    c12FileName = decodeURIComponent(params.get('fileName') || 'Chapter');
    return c12FileId;
}

function saveC12State() {
    if (c12PlaylistMode) return; // don't save section structure in playlist mode
    const id = getFileId();
    RAM_SYNC.setItem(`c12_sections_${id}`, JSON.stringify(c12State.sections));
    RAM_SYNC.setItem(`c12_nextId_${id}`, JSON.stringify(c12State.nextId));
    RAM_SYNC.setItem(`c12_newSectionLevel_${id}`, JSON.stringify(c12State.newSectionLevel));
    window.parent.postMessage({ type: 'ramDataSaved' }, '*');
}

function loadC12State() {
    const id = getFileId();
    const sections = localStorage.getItem(`c12_sections_${id}`);
    const nextId = localStorage.getItem(`c12_nextId_${id}`);
    const newSectionLevel = localStorage.getItem(`c12_newSectionLevel_${id}`);
    if (sections) c12State.sections = JSON.parse(sections);
    if (nextId) c12State.nextId = JSON.parse(nextId);
    if (newSectionLevel) c12State.newSectionLevel = JSON.parse(newSectionLevel);
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
    if (c12PlaylistMode) {
        initPlaylistMode();
        return;
    }
    getFileId();
    // Set chapter title
    const titleEl = document.querySelector('.c12-chapter-title span');
    if (titleEl) titleEl.textContent = c12FileName;
    loadC12State();
    setTimeout(() => {
        renderSectionList();
        renderModalSections();
        selectSection(c12State.selectedSection);
    }, 100);
});

// ===== PLAYLIST MODE INIT =====
function initPlaylistMode() {
    const params = new URLSearchParams(window.location.search);
    c12PlaylistId = params.get('playlistId');
    const playlistName = decodeURIComponent(params.get('fileName') || 'Playlist');

    // Set title
    const titleEl = document.querySelector('.c12-chapter-title span');
    if (titleEl) titleEl.textContent = playlistName;

    // Hide add/sort controls not relevant in playlist mode
    const sortDropdown = document.getElementById('c12SortDropdown');
    const sortArrow = document.getElementById('c12SortArrow');
    if (sortDropdown) sortDropdown.style.display = 'none';
    if (sortArrow) sortArrow.style.display = 'none';

    const pl = getPlaylist();
    if (!pl) {
        const container = document.getElementById('c12SectionList');
        if (container) container.innerHTML = '<div style="padding:16px;color:var(--text-secondary);font-size:13px;">Playlist not found.</div>';
        return;
    }

    // Build virtual sections list from all referenced files
    c12PlaylistSections = [];
    pl.sections.forEach((ref, idx) => {
        try {
            const sectionsRaw = localStorage.getItem(`c12_sections_${ref.fileId}`);
            if (!sectionsRaw) return;
            const sections = JSON.parse(sectionsRaw);
            const sec = sections.find(s => String(s.id) === String(ref.sectionId));
            if (!sec) return;
            c12PlaylistSections.push({
                ...sec,
                _fileId: ref.fileId,
                _playlistIdx: idx,
                _flatNum: idx + 1,
                level: 1 // flat level 1
            });
        } catch(e) {}
    });

    // Populate c12State.sections with playlist sections (for compatibility with column3/5)
    // We set fileId context to the first section's file by default
    if (c12PlaylistSections.length > 0) {
        c12FileId = c12PlaylistSections[0]._fileId;
        c12State.sections = c12PlaylistSections.map(s => ({ ...s }));
    }

    setTimeout(() => {
        renderPlaylistSectionList();
        if (c12PlaylistSections.length > 0) {
            selectPlaylistSection(c12PlaylistSections[0]);
        }
    }, 100);
}

function renderPlaylistSectionList() {
    const container = document.getElementById('c12SectionList');
    if (!container) return;
    container.innerHTML = '';

    const pl = getPlaylist();
    const total = c12PlaylistSections.length;

    c12PlaylistSections.forEach((sec, idx) => {
        const isActive = c12State.selectedSection === sec.id && c12FileId === sec._fileId;

        const row = document.createElement('div');
        row.className = 'c12-section-row';
        row.dataset.id = sec.id;

        const numCell = document.createElement('div');
        numCell.className = 'c12-cell c12-col1 c12-num-cell';
        numCell.textContent = String(idx + 1).padStart(total >= 10 ? 2 : 1, '0');

        const titleCell = document.createElement('div');
        titleCell.className = `c12-cell c12-title-cell${isActive ? ' active' : ''}`;
        titleCell.textContent = sec.title;
        titleCell.onclick = () => selectPlaylistSection(sec);

        // Delete from playlist button (does NOT touch original)
        const delBtn = document.createElement('button');
        delBtn.className = 'c12-inline-edit-btn';
        delBtn.title = 'Remove from playlist';
        delBtn.innerHTML = '✕';
        delBtn.onclick = (e) => {
            e.stopPropagation();
            removeFromPlaylist(idx);
        };
        titleCell.appendChild(delBtn);

        row.appendChild(numCell);
        row.appendChild(titleCell);
        container.appendChild(row);
    });
}

function selectPlaylistSection(sec) {
    c12State.selectedSection = sec.id;
    c12FileId = sec._fileId;

    // Re-render list to update active
    renderPlaylistSectionList();

    // Scroll into view
    const activeEl = document.querySelector('.c12-title-cell.active');
    if (activeEl) activeEl.scrollIntoView({ block: 'center', behavior: 'smooth' });

    // Update col3 header
    const col3Header = document.querySelector('.col-3 .ph-cell');
    if (col3Header) col3Header.textContent = sec.title;

    if (typeof onSectionSelected === 'function') {
        onSectionSelected(sec.id, sec);
    }
}

function removeFromPlaylist(idx) {
    const pl = getPlaylist();
    if (!pl) return;
    pl.sections.splice(idx, 1);
    savePlaylist(pl);

    // Rebuild local list
    c12PlaylistSections.splice(idx, 1);
    renderPlaylistSectionList();

    // Select adjacent section
    if (c12PlaylistSections.length > 0) {
        const newIdx = Math.min(idx, c12PlaylistSections.length - 1);
        selectPlaylistSection(c12PlaylistSections[newIdx]);
    }
}

// ===== HELPERS =====
function pad(n) {
    return String(n).padStart(2, '0');
}

function getRealTotal() {
    // Navigation + all real sections
    return c12State.sections.filter(s => s.type === 'real').length + 1;
}

// ===== HIERARCHICAL NUMBERING =====
// Only for c12State.sections (not navigation)
function generateNumbers(sections) {
    const counters = [0, 0, 0, 0, 0];
    const result = [];
    sections.forEach(section => {
        const level = section.level;
        counters[level]++;
        for (let l = level + 1; l <= 4; l++) counters[l] = 0;
        let num = '';
        for (let l = 1; l <= level; l++) num += (l === 1 ? '' : '.') + counters[l];
        result.push(num);
    });
    return result;
}

function isStudiedToday(section) {
    const data = getSectionC5Data(section);
    if (!data) return false;
    const today = new Date(); today.setHours(0,0,0,0);
    return data.revisions.some(r => {
        if (!r.date || !r.year) return false;
        const [day, month] = r.date.split('/').map(Number);
        const d = new Date(r.year, month - 1, day);
        d.setHours(0,0,0,0);
        return d.getTime() === today.getTime();
    });
}

// ===== COLUMN 1 VALUE =====
function getCol1Value(section, outlineNum, realPos) {
    const realTotal = getRealTotal();
    const isNav = section.type === 'navigation';
    const isDummy = section.type === 'dummy';

    switch (c12State.currentSort) {

        case 'Outline': {
            const studied = !isDummy && isStudiedToday(section);
            return { text: isNav ? '—' : outlineNum, color: studied ? '#22c55e' : null };
        }

        case 'SectionCount': {
            if (isDummy) return { text: '—' };
            const studied = isStudiedToday(section);
            const padded = realTotal >= 10;
            const pos = padded ? String(realPos).padStart(2, '0') : String(realPos);
            const tot = padded ? String(realTotal).padStart(2, '0') : String(realTotal);
            return { text: '[' + pos + '/' + tot + ']', color: studied ? '#22c55e' : null };
        }

        case 'Progress': {
            if (isDummy) return { text: '—' };
            const pData = getSectionC5Data(section);
            const pct = getC5Progress(pData);
            let pColor = '#94a3b8';
            if (pct > 75) pColor = '#22c55e';
            else if (pct > 50) pColor = '#f97316';
            else if (pct > 25) pColor = '#f59e0b';
            return { text: pct + '%', color: pColor };
        }
        

        case 'Count': {
            if (isDummy) return { text: '—' };
            const cData = getSectionC5Data(section);
            const filled = cData ? cData.revisions.filter(r => r.date !== null).length : 0;
            const activated = cData ? (cData.activatedCount || 4) : 4;
            const studied = isStudiedToday(section);
            return { text: '[' + pad(filled) + '/' + pad(activated) + ']', color: studied ? '#22c55e' : null };
        }
        
        case 'LastRevised': {
            if (isDummy) return { text: '—' };
            const lData = getSectionC5Data(section);
            if (!lData) return { text: '—' };
            let latest = null;
            lData.revisions.forEach(r => {
                if (r.date && r.year) {
                    const [day, month] = r.date.split('/').map(Number);
                    const d = new Date(r.year, month - 1, day);
                    if (!latest || d > latest) latest = d;
                }
            });
            if (!latest) return { text: '—' };
            const today = new Date(); today.setHours(0,0,0,0);
            const diff = Math.floor((today - latest) / (1000*60*60*24));
            const studied = isStudiedToday(section);
            return { text: String(diff), color: studied ? '#22c55e' : null };
        }

        case 'Alphabetical': {
            if (isNav) {
                const studied = isStudiedToday(section);
                return { text: 'N', color: studied ? '#22c55e' : null };
            }
            if (isDummy) return { text: '—' };
            const studied = isStudiedToday(section);
            return { text: section.title.charAt(0).toUpperCase(), color: studied ? '#22c55e' : null };
        }
        
        case 'Difficulty': {
            if (isDummy) return { text: '—' };
            const diffMap = { Easy: { text: 'E', color: '#22c55e' }, Moderate: { text: 'M', color: '#f59e0b' }, Challenging: { text: 'C', color: '#f97316' }, Hard: { text: 'H', color: '#ef4444' } };
            const sData = getSectionC5Data(section);
            const diff = sData ? sData.difficulty : 'Easy';
            return diffMap[diff] || { text: 'E', color: '#22c55e' };
        }

        case 'Priority': {
            if (isDummy) return { text: '—' };
            const prioMap = { Low: { text: 'L', color: '#94a3b8' }, Medium: { text: 'M', color: '#3b82f6' }, High: { text: 'H', color: '#f97316' }, Critical: { text: 'C', color: '#ef4444' } };
            const sData = getSectionC5Data(section);
            const prio = sData ? sData.priority : 'Low';
            return prioMap[prio] || { text: 'L', color: '#94a3b8' };
        }

        case 'Proficiency': {
            if (isDummy) return { text: '—' };
            const sData = getSectionC5Data(section);
            const pct = sData ? getC5Progress(sData) : 0;
            if (pct <= 25) return { text: 'NV', color: '#94a3b8' };
            if (pct <= 50) return { text: 'AB', color: '#f59e0b' };
            if (pct <= 75) return { text: 'CT', color: '#f97316' };
            return { text: 'PR', color: '#22c55e' };
        }

        default:
            return { text: isNav ? '0.0' : outlineNum };
    }
}

function getSectionC5Data(section) {
    const id = section.type === 'navigation' ? 'navigation' : section.id;
    return c5SectionStore[id] || null;
}

function isSectionCompleted(section) {
    const data = getSectionC5Data(section);
    if (!data) return false;
    return data.isCompleted;
}

function getC5Progress(data) {
    if (!data) return 0;
    if (data.isCompleted) return 100;
    const activated = data.activatedCount || 4;
    const filled = data.revisions.slice(0, activated).filter(r => r.date !== null).length;
    return Math.round((filled / activated) * 100);
}


// ===== SORT =====
function getSortedSections() {
    const nav = c12State.navigation;
    const reals = c12State.sections.filter(s => s.type === 'real');
    const dummies = c12State.sections.filter(s => s.type === 'dummy');
    const order = c12State.sortOrder;

    // No sort needed
    if (c12State.currentSort === 'Outline') return [nav, ...c12State.sections];
    if (c12State.currentSort === 'SectionCount') return [nav, ...reals, ...dummies];

    // No order — maintain outline but show data
    if (order === 'none') return [nav, ...c12State.sections];

    const asc = order === 'asc';

    if (c12State.currentSort === 'Alphabetical') {
        const sortedReals = [...reals].sort((a, b) => {
            const valA = a.title.toLowerCase();
            const valB = b.title.toLowerCase();
            if (valA < valB) return asc ? -1 : 1;
            if (valA > valB) return asc ? 1 : -1;
            return 0;
        });
        return [nav, ...sortedReals, ...dummies];
    }

    const sortable = [nav, ...reals];

    sortable.sort((a, b) => {
        let valA, valB;
        const aData = getSectionC5Data(a);
        const bData = getSectionC5Data(b);

        switch (c12State.currentSort) {
            case 'Progress':
            case 'Proficiency':
                valA = getC5Progress(aData);
                valB = getC5Progress(bData);
                break;
            case 'Count':
                valA = aData ? aData.revisions.filter(r => r.date !== null).length : 0;
                valB = bData ? bData.revisions.filter(r => r.date !== null).length : 0;
                break;

                case 'LastRevised': {
                const aLast = getSectionC5Data(a);
                const bLast = getSectionC5Data(b);
                const getDiff = (data) => {
                    if (!data) return 99999;
                    let latest = null;
                    data.revisions.forEach(r => {
                        if (r.date && r.year) {
                            const [day, month] = r.date.split('/').map(Number);
                            const d = new Date(r.year, month - 1, day);
                            if (!latest || d > latest) latest = d;
                        }
                    });
                    if (!latest) return 99999;
                    const today = new Date(); today.setHours(0,0,0,0);
                    return Math.floor((today - latest) / (1000*60*60*24));
                };
                valA = getDiff(aLast);
                valB = getDiff(bLast);
                break;
            }

            case 'Difficulty': {
                const dOrder = { Easy: 0, Moderate: 1, Challenging: 2, Hard: 3 };
                valA = dOrder[aData ? aData.difficulty : 'Easy'] ?? 0;
                valB = dOrder[bData ? bData.difficulty : 'Easy'] ?? 0;
                break;
            }
            case 'Priority': {
                const pOrder = { Low: 0, Medium: 1, High: 2, Critical: 3 };
                valA = pOrder[aData ? aData.priority : 'Low'] ?? 0;
                valB = pOrder[bData ? bData.priority : 'Low'] ?? 0;
                break;
            }
            default: return 0;
        }

        if (valA < valB) return asc ? -1 : 1;
        if (valA > valB) return asc ? 1 : -1;
        return 0; // tie = maintain original order
    });

    return [...sortable, ...dummies];
}

// ===== RENDER SECTION LIST =====
function renderSectionList() {
    const container = document.getElementById('c12SectionList');
    container.innerHTML = '';

    // Original numbers always based on original order (sections only, no nav)
    const originalNumbers = generateNumbers(c12State.sections);
    const numMap = {};
    c12State.sections.forEach((s, i) => { numMap[s.id] = originalNumbers[i]; });

    // Real position map (navigation = 1, reals in original order after)
    const realPosMap = { navigation: 1 };
    let pos = 2;
    c12State.sections.forEach(s => { if (s.type === 'real') realPosMap[s.id] = pos++; });

    const displayList = getSortedSections();

    displayList.forEach(section => {
        const isNav   = section.type === 'navigation';
        const isDummy = section.type === 'dummy';

        const col1Val = getCol1Value(
            section,
            numMap[section.id] || '',
            realPosMap[section.id] || ''
        );

        const isActive = isNav
            ? c12State.selectedSection === 'navigation'
            : c12State.selectedSection === section.id;

        const clickHandler = isNav
            ? `onclick="selectSection('navigation')"`
            : isDummy ? ''
            : `onclick="selectSection(${section.id})"`;

        const row = document.createElement('div');
        row.className = isNav ? 'c12-section-row navigation' : 'c12-section-row';
        row.dataset.id = section.id;

        const isStudied = col1Val.color === '#22c55e' && !isDummy && 
            (c12State.currentSort === 'Outline' || c12State.currentSort === 'SectionCount' || 
             c12State.currentSort === 'LastRevised' || c12State.currentSort === 'Count' || 
             c12State.currentSort === 'Alphabetical');
        const hasColor = col1Val.color && !isDummy && !isStudied;
        const numCellStyle = hasColor ? `style="background:${col1Val.color};"` : '';

        const numCellClass = isStudied && !isActive
            ? 'c12-cell c12-col1 c12-num-cell studied-today'
            : hasColor ? 'c12-cell c12-col1 c12-num-cell colored' 
            : 'c12-cell c12-col1 c12-num-cell';

        const studiedToday = !isDummy && !isActive && isStudiedToday(section);
        const completed = !isDummy && !isActive && !studiedToday && isSectionCompleted(section);

        const colorSorts = ['Progress', 'Proficiency', 'Difficulty', 'Priority'];
        const isColorSort = colorSorts.includes(c12State.currentSort);

        let titleStudiedClass = '';
        if (isActive) {
            titleStudiedClass = '';
        } else if (studiedToday) {
            titleStudiedClass = 'studied-today-title';
        } else if (completed) {
            titleStudiedClass = 'completed-title';
        }
        
        const editBtn = !isNav && !isDummy ? `<button class="c12-inline-edit-btn" onclick="event.stopPropagation();quickRenameFromList(${section.id})" title="Rename section">&#x270E;</button>` : '';
        row.innerHTML = `
            <div class="${numCellClass}" ${numCellStyle}>${col1Val.text}</div>
            <div class="c12-cell c12-title-cell ${isActive ? 'active' : ''} ${isDummy ? 'dummy' : ''} ${titleStudiedClass}" ${clickHandler}>
                <span>${section.title}</span>
                ${editBtn}
            </div>
        `;

        container.appendChild(row);
    });
}

// ===== SELECT SECTION =====
function selectSection(id) {
    c12State.selectedSection = id;
    renderSectionList();

    // Scroll selected section into view
    const activeEl = document.querySelector('.c12-title-cell.active');
    if (activeEl) activeEl.scrollIntoView({ block: 'center', behavior: 'smooth' });

    // Update col3 header
    const col3Header = document.querySelector('.col-3 .ph-cell');
    if (col3Header) {
        if (id === 'navigation') {
            col3Header.textContent = 'Navigation';
        } else {
            const sec = c12State.sections.find(s => s.id === id);
            col3Header.textContent = sec ? sec.title : '';
        }
    }

    if (typeof onSectionSelected === 'function') {
        onSectionSelected(id, id === 'navigation' ? c12State.navigation : c12State.sections.find(s => s.id === id));
    }
}

// ===== SORT DROPDOWN =====
function toggleSortDropdown() {
    document.getElementById('c12SortDropdown').classList.toggle('active');
}

function selectSort(event, sortType) {
    event.stopPropagation();

    c12State.currentSort = sortType;

    const labels = {
        'Outline':      'X.X.X.X',
        'SectionCount': '[X/N]',
        'Progress':     'X%',
        'Count':        '[XX/XX]',
        'LastRevised':  'Days Ago',
        'Alphabetical': 'ABC',
        'Difficulty':   'D',
        'Priority':     'P',
        'Proficiency':  'Prof'
    };
    document.getElementById('c12SortLabel').textContent = labels[sortType] || '';

    const dropdownLabels = {
        'Outline':      'Outline Number',
        'SectionCount': 'Section Count',
        'Progress':     'Progress',
        'Count':        'Revision Count',
        'LastRevised':  'Last Revised',
        'Alphabetical': 'Alphabetical',
        'Difficulty':   'Difficulty',
        'Priority':     'Priority',
        'Proficiency':  'Proficiency'
    };
    document.getElementById('c12DropdownLabel').textContent = dropdownLabels[sortType];

    document.querySelectorAll('.c12-dropdown-option').forEach(el => el.classList.remove('selected'));
    const clicked = event.target.closest('.c12-dropdown-option');
    if (clicked) clicked.classList.add('selected');

    const arrow = document.getElementById('c12SortArrow');
    const noSort = sortType === 'Outline' || sortType === 'SectionCount';

    if (noSort) {
        arrow.classList.add('disabled');
        arrow.textContent = '—';
        c12State.sortOrder = 'none';
    } else {
        arrow.classList.remove('disabled');
        // Priority defaults to desc
        c12State.sortOrder = sortType === 'Priority' ? 'desc' : 'asc';
        arrow.textContent = c12State.sortOrder === 'asc' ? '↑' : '↓';
    }

    document.getElementById('c12SortDropdown').classList.remove('active');
    renderSectionList();
}

function toggleSortArrow() {
    const noSort = c12State.currentSort === 'Outline' || c12State.currentSort === 'SectionCount';
    if (noSort) return;

    // Cycle: asc → desc → none → asc
    if (c12State.sortOrder === 'asc') c12State.sortOrder = 'desc';
    else if (c12State.sortOrder === 'desc') c12State.sortOrder = 'none';
    else c12State.sortOrder = 'asc';

    const arrow = document.getElementById('c12SortArrow');
    if (c12State.sortOrder === 'asc') arrow.textContent = '↑';
    else if (c12State.sortOrder === 'desc') arrow.textContent = '↓';
    else arrow.textContent = '—';

    renderSectionList();
}


// Close dropdown on outside click
document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('c12SortDropdown');
    if (dropdown && !dropdown.contains(e.target)) dropdown.classList.remove('active');
});

// ===== BACK BUTTON =====
function handleBack() {
    if (window.parent !== window) {
        const progress = typeof getOverallProgressForMain === 'function' ? getOverallProgressForMain() : 0;
        window.parent.postMessage({ type: 'progressUpdate', fileId: getFileId(), progress }, '*');
        window.parent.postMessage('closeFile', '*');
    } else {
        window.location.href = 'index.html';
    }
}

// ===== MODAL =====
function openAddSectionModal() {
    document.getElementById('c12ModalOverlay').classList.add('active');
    renderModalSections();
    updateAddSectionRow();
}

function closeAddSectionModal() {
    document.getElementById('c12ModalOverlay').classList.remove('active');
}

function saveAndClose() {
    saveC12State();
    renderSectionList();
    notifyTOCChanged();
    closeAddSectionModal();
}

function notifyTOCChanged() {
    if (typeof c3State !== 'undefined' && c3State.currentSectionId === 'navigation' &&
        typeof renderTabBody === 'function') {
        renderTabBody('navigation', c3State.activeTab);
    }
}

// ===== RENDER MODAL SECTIONS =====
function renderModalSections() {
    const container = document.getElementById('c12ModalSections');
    if (!container) return;
    container.innerHTML = '';

    const numbers = generateNumbers(c12State.sections);
    const realTotal = getRealTotal();

    // Navigation row — always first, all buttons disabled except +
    const navRow = document.createElement('div');
    navRow.className = 'c12-modal-section-row';
    navRow.innerHTML = `
        <div class="c12-modal-pos-cell">${realTotal >= 10 ? '[01/' + String(realTotal).padStart(2,'0') + ']' : '[1/' + realTotal + ']'}</div>
        <div class="c12-modal-indent-wrap level-1">
            <div class="c12-modal-num-cell">—</div>
            <div class="c12-modal-title-cell"><span>Table of Contents</span></div>
        </div>

        <div class="c12-modal-actions-cell">
            <button class="c12-action-btn edit" title="Edit" disabled>✎</button>
            <button class="c12-action-btn add" title="Add below" onclick="addBelowNavigation()">+</button>
            <button class="c12-action-btn level-left"  disabled>◀</button>
            <button class="c12-action-btn level-right" disabled>▶</button>
            <button class="c12-action-btn move-up"     disabled>▲</button>
            <button class="c12-action-btn move-down"   disabled>▼</button>
            <button class="c12-action-btn delete"      disabled>🗑️</button>
        </div>

    `;
    container.appendChild(navRow);

    // Real pos counter (navigation = 1, so start at 2)
    let realPos = 2;

    c12State.sections.forEach((section, index) => {
        const isDummy = section.type === 'dummy';
        const canMoveLeft  = section.level > 1 && canCascadeLeft(index);
        const canMoveRight = section.level < 4 && canMoveToLevel(index, section.level + 1);

        const padded = realTotal >= 10;
        const pos = padded ? String(realPos).padStart(2, '0') : String(realPos);
        const tot = padded ? String(realTotal).padStart(2, '0') : String(realTotal);
        const posCell = isDummy ? '—' : '[' + pos + '/' + tot + ']';
        if (!isDummy) realPos++;

        const row = document.createElement('div');
        row.className = 'c12-modal-section-row';
        row.dataset.index = index;

        row.innerHTML = `
            <div class="c12-modal-pos-cell">${posCell}</div>
            <div class="c12-modal-indent-wrap level-${section.level}">
                <div class="c12-modal-num-cell">${numbers[index]}</div>
                <div class="c12-modal-title-cell" ondblclick="inlineEditTitle(this, ${index})"><span>${section.title}</span></div>
            </div>
            <div class="c12-modal-actions-cell">
                <button class="c12-action-btn edit"       title="Edit"       onclick="openEditBox(${index})">✎</button>
                <button class="c12-action-btn add"        title="Add below"  onclick="addBelowSection(${index})">+</button>            
                <button class="c12-action-btn level-left" title="Level left" onclick="moveSectionLevel(${index},'left')"  ${!canMoveLeft  ? 'disabled' : ''}>◀</button>
                <button class="c12-action-btn level-right"title="Level right"onclick="moveSectionLevel(${index},'right')" ${!canMoveRight ? 'disabled' : ''}>▶</button>
                <button class="c12-action-btn move-up"    title="Move up"    onclick="moveSectionOrder(${index},'up')"    ${!canMoveUp(index)   ? 'disabled' : ''}>▲</button>
                <button class="c12-action-btn move-down"  title="Move down"  onclick="moveSectionOrder(${index},'down')"  ${!canMoveDown(index) ? 'disabled' : ''}>▼</button>
                <button class="c12-action-btn delete"     title="Delete"     onclick="deleteSection(${index})">🗑️</button>
            </div>
            
        `;

        container.appendChild(row);
    });
}

function addBelowNavigation() {
    c12State.insertAfterIndex = -1; // -1 = insert at beginning of sections array
    openInputBox();
}

function inlineEditTitle(cell, index) {
    const section = c12State.sections[index];
    const current = section.title;
    cell.innerHTML = `<input type="text" value="${current}" maxlength="100"
        style="width:100%; border:none; outline:none; font-size:14px; font-weight:500; color:#334155; background:transparent;"
        onblur="saveInlineTitle(this, ${index})"
        onkeydown="if(event.key==='Enter') this.blur(); if(event.key==='Escape') { this.value='${current}'; this.blur(); }">`;
    const input = cell.querySelector('input');
    input.focus();
    input.select();
}

function saveInlineTitle(input, index) {
    const newTitle = input.value.trim();
    if (newTitle) c12State.sections[index].title = newTitle;
    renderModalSections();
    renderSectionList();
}

// ===== ADD SECTION ROW (bottom of modal) =====
function getNextNumberForLevel(level) {
    const sections = c12State.sections;
    const counters = [0, 0, 0, 0, 0];
    sections.forEach(s => {
        counters[s.level]++;
        for (let l = s.level + 1; l <= 4; l++) counters[l] = 0;
    });
    counters[level]++;
    for (let l = level + 1; l <= 4; l++) counters[l] = 0;
    let num = '';
    for (let l = 1; l <= level; l++) num += (l === 1 ? '' : '.') + counters[l];
    return num;
}

function updateAddSectionRow() {
    const level = c12State.newSectionLevel;
    const wrap = document.getElementById('c12AddIndentWrap');
    if (wrap) wrap.className = 'c12-modal-indent-wrap level-' + level;
    const numCell = document.getElementById('c12AddNumCell');
    if (numCell) numCell.textContent = getNextNumberForLevel(level);
    const leftBtn  = document.getElementById('c12AddLevelLeft');
    const rightBtn = document.getElementById('c12AddLevelRight');
    if (leftBtn)  leftBtn.disabled  = level <= 1;
    if (rightBtn) rightBtn.disabled = !canMoveToLevel(c12State.sections.length, level + 1);
}

function changeNewSectionLevel(direction) {
    const level = c12State.newSectionLevel;
    if (direction === 'left' && level > 1) {
        c12State.newSectionLevel--;
    } else if (direction === 'right' && level < 4) {
        if (!canMoveToLevel(c12State.sections.length, level + 1)) return;
        c12State.newSectionLevel++;
    }
    updateAddSectionRow();
    saveC12State();
}

// ===== CASCADE LOGIC =====
function findChildren(parentIndex) {
    const parentLevel = c12State.sections[parentIndex].level;
    const children = [];
    for (let i = parentIndex + 1; i < c12State.sections.length; i++) {
        if (c12State.sections[i].level <= parentLevel) break;
        children.push(i);
    }
    return children;
}

function canCascadeLeft(index) {
    const section = c12State.sections[index];
    if (section.level <= 1) return false;
    for (const ci of findChildren(index)) {
        if (c12State.sections[ci].level - 1 < 1) return false;
    }
    return true;
}

function canMoveToLevel(index, targetLevel) {
    if (targetLevel > 4) return false;
    if (targetLevel <= 1) return true;
    const parentLevel = targetLevel - 1;
    for (let i = index - 1; i >= 0; i--) {
        if (c12State.sections[i].level === parentLevel) return true;
        if (c12State.sections[i].level < parentLevel) break;
    }
    return false;
}

function canMoveUp(index) {
    if (index === 0) return false;
    const level = c12State.sections[index].level;
    for (let i = index - 1; i >= 0; i--) {
        if (c12State.sections[i].level === level) return true;
        if (c12State.sections[i].level < level) return false;
    }
    return false;
}

function canMoveDown(index) {
    if (index === c12State.sections.length - 1) return false;
    const level = c12State.sections[index].level;
    for (let i = index + 1; i < c12State.sections.length; i++) {
        if (c12State.sections[i].level === level) return true;
        if (c12State.sections[i].level < level) return false;
    }
    return false;
}

function getSectionBlock(index) {
    const sections = c12State.sections;
    const level = sections[index].level;
    let count = 1;
    for (let i = index + 1; i < sections.length; i++) {
        if (sections[i].level <= level) break;
        count++;
    }
    return count;
}

function getSectionBlockFromArray(arr, index) {
    const level = arr[index].level;
    let count = 1;
    for (let i = index + 1; i < arr.length; i++) {
        if (arr[i].level <= level) break;
        count++;
    }
    return count;
}

function moveSectionOrder(index, direction) {
    const sections = c12State.sections;
    const level = sections[index].level;

    if (direction === 'up') {
        let targetIndex = -1;
        for (let i = index - 1; i >= 0; i--) {
            if (sections[i].level === level) { targetIndex = i; break; }
            if (sections[i].level < level) break;
        }
        if (targetIndex === -1) return;
        const sectionBlock = getSectionBlock(index);
        const combined = [...sections];
        const sectionItems = combined.splice(index, sectionBlock);
        combined.splice(targetIndex, 0, ...sectionItems);
        c12State.sections = combined;
    } else {
        let targetIndex = -1;
        for (let i = index + 1; i < sections.length; i++) {
            if (sections[i].level === level) { targetIndex = i; break; }
            if (sections[i].level < level) break;
        }
        if (targetIndex === -1) return;
        const sectionBlock = getSectionBlock(index);
        const combined = [...sections];
        const sectionItems = combined.splice(index, sectionBlock);
        const adjustedTarget = targetIndex - sectionBlock;
        const targetBlockSize = getSectionBlockFromArray(combined, adjustedTarget);
        combined.splice(adjustedTarget + targetBlockSize, 0, ...sectionItems);
        c12State.sections = combined;
    }

    renderModalSections();
    updateAddSectionRow();
    renderSectionList();
}

function moveSectionLevel(index, direction) {
    const section = c12State.sections[index];

    if (direction === 'left') {
        if (!canCascadeLeft(index)) return;
        const originalLevel = section.level;
        const nextSection = c12State.sections[index + 1];
        const shouldMoveChildren = nextSection && nextSection.level > originalLevel;
        section.level--;

        if (shouldMoveChildren) {
            findChildren(index).forEach(ci => { c12State.sections[ci].level--; });
        }

        // Only move add section level if children are being moved too
        if (shouldMoveChildren) {
            const addLevel = c12State.newSectionLevel;
            if (addLevel > originalLevel) {
                c12State.newSectionLevel--;
            }
        }

    } else {
        const newLevel = section.level + 1;
        if (!canMoveToLevel(index, newLevel)) return;
        section.level = newLevel;
    }
    renderModalSections();
    updateAddSectionRow();
}

// ===== ADD / DELETE =====

function addBelowSection(index) {
    c12State.insertAfterIndex = index;
    c12State.newSectionLevel = c12State.sections[index].level;
    openInputBox();
}

function deleteSection(index) {
    const section = c12State.sections[index];
    const children = findChildren(index);
    const msg = children.length > 0
        ? `Delete "${section.title}" and its ${children.length} child section(s)?`
        : `Delete "${section.title}"?`;
    if (!confirm(msg)) return;

    // Collect all IDs being deleted
    const deletedIds = [section.id, ...children.map(ci => c12State.sections[ci].id)];

    [...children].reverse().forEach(ci => c12State.sections.splice(ci, 1));
    c12State.sections.splice(index, 1);

    // Clean up c5 store for deleted sections
    if (typeof c5SectionStore !== 'undefined' && typeof saveC5Store === 'function') {
        deletedIds.forEach(id => { delete c5SectionStore[String(id)]; delete c5SectionStore[id]; });
        // If no real sections remain, also clean up navigation
        const hasRealSections = c12State.sections.some(s => s.type === 'real' || s.type === 'dummy');
        if (!hasRealSections) delete c5SectionStore['navigation'];
        saveC5Store();
    }

    renderModalSections();
    updateAddSectionRow();
    renderSectionList();
    if (typeof renderC3 === 'function') renderC3(c3State.currentSectionId);
    if (typeof renderC5 === 'function') renderC5();
    try {
        const progress = typeof getOverallProgress === 'function' ? getOverallProgress() : 0;
        const fileId = typeof getFileId === 'function' ? getFileId() : 'default';
        window.parent.postMessage({ type: 'progressUpdate', fileId, progress }, '*');
    } catch(e) {}
}

// ===== INPUT BOX =====

function quickRenameFromList(sectionId) {
    const idx = c12State.sections.findIndex(s => s.id == sectionId);
    if (idx === -1) return;
    openEditBox(idx);
}

function openEditBox(index) {
    const section = c12State.sections[index];
    c12State._editingIndex = index;
    document.getElementById('c12EditTitleInput').value = section.title;
    document.getElementById('c12EditOverlay').classList.add('active');
    setTimeout(() => document.getElementById('c12EditTitleInput').focus(), 100);
}

function closeEditBox() {
    document.getElementById('c12EditOverlay').classList.remove('active');
    c12State._editingIndex = null;
}

function confirmEditSection() {
    const title = document.getElementById('c12EditTitleInput').value.trim();
    if (!title) { alert('Please enter a section title.'); return; }
    const section = c12State.sections[c12State._editingIndex];
    section.title = title;
    closeEditBox();
    renderModalSections();
    renderSectionList();
    if (typeof c3State !== 'undefined' && c3State.currentSectionId === section.id) {
        const titleEl = document.getElementById('c3SectionTitle');
        if (titleEl) titleEl.textContent = title;
    }
}

function openInputBox() {
    c12State._editingIndex = null;
    document.getElementById('c12InputTitle').textContent = 'Add New Section';
    document.getElementById('c12TypeRow').style.display = 'flex';
    document.getElementById('c12MoveToSelect').style.display = 'none';
    document.getElementById('c12TitleInput').value = '';
    selectType('real');
    document.getElementById('c12InputOverlay').classList.add('active');
    setTimeout(() => document.getElementById('c12TitleInput').focus(), 100);
}

function closeInputBox() {
    document.getElementById('c12InputOverlay').classList.remove('active');
    c12State.insertAfterIndex = null;
    c12State._editingIndex = null;
}

function selectType(type) {
    c12State.selectedType = type;
    document.getElementById('typeReal').classList.toggle('selected', type === 'real');
    document.getElementById('typeDummy').classList.toggle('selected', type === 'dummy');
    document.getElementById('radioReal').style.background = type === 'real' ? 'radial-gradient(circle, #3b82f6 45%, white 46%)' : '';
    document.getElementById('radioReal').style.borderColor = type === 'real' ? '#3b82f6' : '#cbd5e1';
    document.getElementById('radioDummy').style.background = type === 'dummy' ? 'radial-gradient(circle, #3b82f6 45%, white 46%)' : '';
    document.getElementById('radioDummy').style.borderColor = type === 'dummy' ? '#3b82f6' : '#cbd5e1';
}

function confirmAddSection() {
    const title = document.getElementById('c12TitleInput').value.trim();
    if (!title) { alert('Please enter a section title.'); return; }

    const level = c12State.newSectionLevel;
    const insertAfter = c12State.insertAfterIndex;

    const newSection = {
        id: c12State.nextId++,
        title,
        level,
        type: c12State.selectedType,
        progress: 0,
        revisionCount: 0,
        revisionTotal: 16,
        lastRevised: 0
    };

    if (insertAfter === -1) {
        c12State.sections.unshift(newSection); // insert at beginning
    } else if (insertAfter !== null) {
        c12State.sections.splice(insertAfter + 1, 0, newSection);
    } else {
        c12State.sections.push(newSection);
    }

    // Keep input box open for adding more — just clear and show toast
    document.getElementById('c12TitleInput').value = '';
    document.getElementById('c12TitleInput').focus();
    showInputBoxToast('\u201c' + title + '\u201d added');
    renderModalSections();
    updateAddSectionRow();
    renderSectionList();
    if (c3State.currentSectionId === 'navigation' && typeof renderC5 === 'function') renderC5();
    // Ensure navigation has a c5 store entry since it now has content (sections list)
    if (typeof c5SectionStore !== 'undefined' && typeof getDefaultC5Data === 'function' && !c5SectionStore['navigation']) {
        c5SectionStore['navigation'] = getDefaultC5Data();
        if (typeof saveC5Store === 'function') saveC5Store();
    }
    // Re-render current section and update heatmap
    if (typeof renderC3 === 'function') renderC3(c3State.currentSectionId);
    try {
        const progress = typeof getOverallProgress === 'function' ? getOverallProgress() : 0;
        const fileId = typeof getFileId === 'function' ? getFileId() : 'default';
        window.parent.postMessage({ type: 'progressUpdate', fileId, progress }, '*');
    } catch(e) {}
}

function showInputBoxToast(msg) {
    const box = document.getElementById('c12InputBox');
    if (!box) return;
    let toast = box.querySelector('.c12-input-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'c12-input-toast';
        box.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('visible');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('visible'), 2000);
}

// Enter / Escape in input box
document.addEventListener('DOMContentLoaded', () => {

    const theme = localStorage.getItem('ram_theme') || 'dark';
    const toggleBtn = document.getElementById('c12ThemeToggle');
    if (toggleBtn) toggleBtn.textContent = theme === 'dark' ? '🌙' : '☀️';

    const input = document.getElementById('c12TitleInput');
    if (input) {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') confirmAddSection();
            if (e.key === 'Escape') closeInputBox();
        });
    }
    const editInput = document.getElementById('c12EditTitleInput');
    if (editInput) {
        editInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') confirmEditSection();
            if (e.key === 'Escape') closeEditBox();
        });
    }
});

// Close modals on overlay click
document.addEventListener('DOMContentLoaded', () => {
    const overlay = document.getElementById('c12ModalOverlay');
    if (overlay) overlay.addEventListener('click', (e) => { if (e.target === overlay) closeAddSectionModal(); });

    const inputOverlay = document.getElementById('c12InputOverlay');
    if (inputOverlay) inputOverlay.addEventListener('click', (e) => { if (e.target === inputOverlay) closeInputBox(); });

    const editOverlay = document.getElementById('c12EditOverlay');
    if (editOverlay) editOverlay.addEventListener('click', (e) => { if (e.target === editOverlay) closeEditBox(); });

});

// ===== UPLOAD TXT =====
function triggerUploadTxt() {
    const input = document.getElementById('c12UploadTxtInput');
    if (input) { input.value = ''; input.click(); }
}

function handleUploadTxt(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const result = parseUploadText(e.target.result);

        if (result.error) {
            alert('Upload failed:\n\n' + result.error);
            return;
        }

        result.sections.forEach(s => {
            c12State.sections.push({
                id: c12State.nextId++,
                title: s.title,
                level: s.level,
                type: s.type,
                progress: 0,
                revisionCount: 0,
                revisionTotal: 16,
                lastRevised: 0
            });
        });

        saveC12State();
        renderModalSections();
        updateAddSectionRow();
        renderSectionList();
        // Ensure navigation has a c5 store entry since it now has content
        if (typeof c5SectionStore !== 'undefined' && typeof getDefaultC5Data === 'function' && !c5SectionStore['navigation']) {
            c5SectionStore['navigation'] = getDefaultC5Data();
            if (typeof saveC5Store === 'function') saveC5Store();
        }
        // Trigger heatmap update and re-render current section
        try {
            const progress = typeof getOverallProgress === 'function' ? getOverallProgress() : 0;
            const fileId = typeof getFileId === 'function' ? getFileId() : 'default';
            window.parent.postMessage({ type: 'progressUpdate', fileId, progress }, '*');
        } catch(e) {}
        // Re-render c3 and c5 for current section to update notes bar and progress
        if (typeof renderC3 === 'function') renderC3(c3State.currentSectionId);
        if (typeof renderC5 === 'function') renderC5();
    };
    reader.readAsText(file);
}

function toggleFileTheme() {
    const html = document.documentElement;
    const current = html.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';

    html.setAttribute('data-theme', next);
    RAM_SYNC.setItem('ram_theme', next);
    if (window.parent !== window) {
        window.parent.postMessage({ type: 'themeChange', theme: next }, '*');
    }

    document.getElementById('c12ThemeToggle').textContent = next === 'dark' ? '🌙' : '☀️';
}
// ===== EXPORT / IMPORT =====

function exportFileData() {
    const id = getFileId();
    const data = {
        version: 1,
        fileId: id,
        exportedAt: new Date().toISOString(),
        c12_sections:       JSON.parse(localStorage.getItem(`c12_sections_${id}`)       || '[]'),
        c12_nextId:         JSON.parse(localStorage.getItem(`c12_nextId_${id}`)         || '1'),
        c12_newSectionLevel:JSON.parse(localStorage.getItem(`c12_newSectionLevel_${id}`)|| '1'),
        c3_data:            JSON.parse(localStorage.getItem(`c3_data_${id}`)            || '{}'),
        c4_allSectionNotes: JSON.parse(localStorage.getItem(`c4_allSectionNotes_${id}`) || '{}'),
        c4_categories:      JSON.parse(localStorage.getItem(`c4_categories_${id}`)      || '[]'),
        c5_sectionStore:    JSON.parse(localStorage.getItem(`c5_sectionStore_${id}`)    || '{}'),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ram_export_${id}_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function triggerImportFile() {
    document.getElementById('c12ImportFileInput').value = '';
    document.getElementById('c12ImportFileInput').click();
}

function importFileData(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (!data.version || !data.c12_sections) {
                alert('Invalid export file.');
                return;
            }
            if (!confirm('This will overwrite all current data for this file. Continue?')) return;
            const id = getFileId();
            RAM_SYNC.setItem(`c12_sections_${id}`,        JSON.stringify(data.c12_sections));
            RAM_SYNC.setItem(`c12_nextId_${id}`,          JSON.stringify(data.c12_nextId));
            RAM_SYNC.setItem(`c12_newSectionLevel_${id}`, JSON.stringify(data.c12_newSectionLevel));
            RAM_SYNC.setItem(`c3_data_${id}`,             JSON.stringify(data.c3_data));
            RAM_SYNC.setItem(`c4_allSectionNotes_${id}`,  JSON.stringify(data.c4_allSectionNotes));
            RAM_SYNC.setItem(`c4_categories_${id}`,       JSON.stringify(data.c4_categories));
            RAM_SYNC.setItem(`c5_sectionStore_${id}`,     JSON.stringify(data.c5_sectionStore));
            // Reload state
            loadC12State();
            renderSectionList();
            if (typeof loadC3State === 'function') loadC3State();
            if (typeof loadC4State === 'function') loadC4State();
            if (typeof loadC5Store === 'function') loadC5Store();
            if (typeof renderC5 === 'function') renderC5();
            if (typeof renderC3 === 'function') renderC3(c3State.currentSectionId);
            closeAddSectionModal();
            alert('Import successful!');
        } catch(err) {
            alert('Failed to parse file: ' + err.message);
        }
    };
    reader.readAsText(file);
}