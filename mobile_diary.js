// mobile_diary.js

const MD_DIFF_COLORS = { Easy: '#22c55e', Moderate: '#f59e0b', Challenging: '#f97316', Hard: '#ef4444' };
const MD_PRIO_COLORS = { Low: '#94a3b8', Medium: '#3b82f6', High: '#f97316', Critical: '#ef4444' };
const MD_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const mdState = {
    allEntries: [],
    tbcEntries: [],
    currentEntries: [],
    selectedWeekKey: null,
    mode: 'tbc',
    sort: 'outline',
    sortOrder: 'asc',
};

// ===== WEEK HELPERS (same logic as web diary) =====
function mdGetWeekStart(date) {
    const d = new Date(date); d.setHours(0,0,0,0);
    const day = d.getDay();
    d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
    return d;
}
function mdMakeWeekKey(dateKey) {
    const ws = mdGetWeekStart(new Date(dateKey));
    return `${ws.getFullYear()}-${String(ws.getMonth()+1).padStart(2,'0')}-${String(ws.getDate()).padStart(2,'0')}`;
}
function mdGetCurrentWeekKey() {
    return mdMakeWeekKey(new Date().toISOString().slice(0,10));
}
function mdBuildAllWeeks() {
    const startDate = mdGetWeekStart(new Date(2026,0,1));
    const endDate = new Date(); endDate.setMonth(endDate.getMonth() + 18);
    const weeks = []; const cur = new Date(startDate);
    while (cur <= endDate) { weeks.push(new Date(cur)); cur.setDate(cur.getDate() + 7); }
    return weeks;
}
function mdWeekMonthLabel(weekStart) {
    const thu = new Date(weekStart); thu.setDate(thu.getDate() + 3);
    return `${MD_MONTHS[thu.getMonth()]} '${String(thu.getFullYear()).slice(2)}`;
}
function mdOrdinal(n) {
    return n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`;
}
function mdGetISOWeek(date) {
    const d = new Date(date); d.setHours(0,0,0,0);
    d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
    const week1 = new Date(d.getFullYear(), 0, 4);
    return 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}
function mdGetISOWeekYear(date) {
    const d = new Date(date); d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7); return d.getFullYear();
}
function mdWeekToDate(week, year) {
    const jan4 = new Date(year, 0, 4);
    const monday = new Date(jan4);
    monday.setDate(jan4.getDate() - (jan4.getDay() + 6) % 7 + (week - 1) * 7);
    return monday;
}
function mdFormatDay(day, month, year) {
    const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    return days[new Date(year, month - 1, day).getDay()];
}
function mdProficiency(pct) {
    if (pct <= 25) return 'Novice';
    if (pct <= 50) return 'Apprentice';
    if (pct <= 75) return 'Competent';
    return 'Proficient';
}

// ===== WEEK NAV =====
function mdBuildWeekNav() {
    const container = document.getElementById('mdWeekNav');
    if (!container) return;

    const allWeeks = mdBuildAllWeeks();
    const currentKey = mdGetCurrentWeekKey();

    const completedMap = {};
    mdState.allEntries.forEach(e => {
        const wk = mdMakeWeekKey(e.dateKey);
        completedMap[wk] = (completedMap[wk] || 0) + 1;
    });

    const tbcMap = {};
    mdState.tbcEntries.forEach(e => {
        if (!e.scheduledWeek || !e.scheduledYear) return;
        const monday = mdWeekToDate(e.scheduledWeek, e.scheduledYear);
        const wk = `${monday.getFullYear()}-${String(monday.getMonth()+1).padStart(2,'0')}-${String(monday.getDate()).padStart(2,'0')}`;
        tbcMap[wk] = (tbcMap[wk] || 0) + 1;
    });

    const monthGroups = [];
    let curGroup = null;
    allWeeks.forEach(ws => {
        const key = `${ws.getFullYear()}-${String(ws.getMonth()+1).padStart(2,'0')}-${String(ws.getDate()).padStart(2,'0')}`;
        const label = mdWeekMonthLabel(ws);
        if (!curGroup || curGroup.label !== label) {
            curGroup = { label, weeks: [] };
            monthGroups.push(curGroup);
        }
        curGroup.weeks.push({ key, weekNum: curGroup.weeks.length + 1 });
    });

    container.innerHTML = '';
    const flex = document.createElement('div');
    flex.className = 'md-week-nav-inner';

    monthGroups.forEach(grp => {
        const table = document.createElement('table');
        table.className = 'md-week-nav-table';

        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        const th = document.createElement('th');
        th.colSpan = grp.weeks.length;
        th.textContent = grp.label;
        th.className = 'md-wn-month';
        headerRow.appendChild(th);
        thead.appendChild(headerRow);

        const tbody = document.createElement('tbody');

        const weekRow = document.createElement('tr');
        grp.weeks.forEach(wk => {
            const td = document.createElement('td');
            td.textContent = mdOrdinal(wk.weekNum);
            td.className = 'md-wn-week' +
                (wk.key === mdState.selectedWeekKey ? ' active' : '') +
                (wk.key === currentKey ? ' current-week' : '');
            td.dataset.weekKey = wk.key;
            td.addEventListener('click', () => mdSelectWeek(wk.key));
            weekRow.appendChild(td);
        });
        tbody.appendChild(weekRow);

        const countRow = document.createElement('tr');
        grp.weeks.forEach(wk => {
            const td = document.createElement('td');
            const isCur = wk.key === currentKey;
            const isPast = wk.key < currentKey;
            let text = '';
            if (isCur) {
                const c = completedMap[wk.key] || 0, t = tbcMap[wk.key] || 0;
                if (c > 0 || t > 0) text = `${c}-${t}`;
            } else if (isPast) {
                const c = completedMap[wk.key] || 0;
                if (c > 0) text = String(c);
            } else {
                const t = tbcMap[wk.key] || 0;
                if (t > 0) text = String(t);
            }
            td.textContent = text;
            td.className = 'md-wn-count' + (!text ? ' md-wn-count-zero' : '') + (isCur ? ' current-week' : '');
            td.dataset.weekKey = wk.key;
            td.addEventListener('click', () => mdSelectWeek(wk.key));
            countRow.appendChild(td);
        });
        tbody.appendChild(countRow);

        table.appendChild(thead);
        table.appendChild(tbody);
        flex.appendChild(table);
    });

    container.appendChild(flex);

    requestAnimationFrame(() => {
        const active = container.querySelector('.md-wn-week.active');
        if (active) active.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    });
}

function mdSelectWeek(weekKey) {
    mdState.selectedWeekKey = weekKey;
    document.querySelectorAll('.md-wn-week').forEach(td => {
        td.classList.toggle('active', td.dataset.weekKey === weekKey);
    });
    const currentKey = mdGetCurrentWeekKey();
    if (weekKey < currentKey) mdState.mode = 'completed';
    else if (weekKey > currentKey) mdState.mode = 'tbc';
    mdRenderContent();
}

// ===== DATA LOADING =====
function mdLoadAllEntries() {
    mdState.allEntries = [];
    const fs = getFileSystem();
    if (!fs) return;
    const files = collectFiles(fs);

    files.forEach(file => {
        const fileData = getFileData(file.id);
        if (!fileData.c12_sections || !fileData.c5_sectionStore) return;
        let sections, store;
        try { sections = JSON.parse(fileData.c12_sections); } catch(e) { return; }
        try { store = JSON.parse(fileData.c5_sectionStore); } catch(e) { return; }

        function processCompleted(secId, secTitle) {
            const data = store[String(secId)] || store[secId];
            if (!data) return;
            (data.revisions || []).forEach((r, i) => {
                if (!r || !r.date || !r.year) return;
                const activated = data.activatedCount || 4;
                const pct = Math.round(((i + 1) / activated) * 100);
                const [day, month] = r.date.split('/').map(Number);
                const dateKey = `${r.year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                mdState.allEntries.push({
                    sectionId: secId, sectionTitle: secTitle,
                    fileId: file.id, fileName: file.name,
                    difficulty: data.difficulty || 'Easy',
                    priority: data.priority || 'Low',
                    dateKey,
                    dateDisplay: mdFormatDay(day, month, r.year),
                    revCount: i + 1,
                    progress: pct,
                    proficiency: mdProficiency(pct),
                });
            });
        }

        processCompleted('navigation', 'Table of Contents');
        sections.forEach(sec => { if (sec.type === 'real') processCompleted(sec.id, sec.title); });
    });

    mdState.allEntries.sort((a, b) =>
        a.dateKey !== b.dateKey ? a.dateKey.localeCompare(b.dateKey) :
        a.fileName !== b.fileName ? a.fileName.localeCompare(b.fileName) :
        a.sectionTitle.localeCompare(b.sectionTitle)
    );
}

function mdLoadTBCEntries() {
    mdState.tbcEntries = [];
    if (typeof smGetNextSlots !== 'function') return;
    const fs = getFileSystem();
    if (!fs) return;
    const files = collectFiles(fs);
    const now = new Date(); now.setHours(0,0,0,0);
    const curW = mdGetISOWeek(now), curY = mdGetISOWeekYear(now);

    files.forEach(file => {
        const fileData = getFileData(file.id);
        if (!fileData.c12_sections || !fileData.c5_sectionStore) return;
        let sections, store;
        try { sections = JSON.parse(fileData.c12_sections); } catch(e) { return; }
        try { store = JSON.parse(fileData.c5_sectionStore); } catch(e) { return; }

        function processTBC(secId, secTitle) {
            const data = store[String(secId)] || store[secId];
            if (!data || data.scheduleActive === false) return;
            const revisions = data.revisions || [];
            if (!revisions[0] || !revisions[0].date) return;

            const activated = data.activatedCount || 4;
            const filled = revisions.slice(0, activated).filter(r => r && r.date).length;
            const pct = Math.round((filled / activated) * 100);

            const lastRev = [...revisions].reverse().find(r => r && r.date);
            let daysAgo = null;
            if (lastRev && lastRev.date && lastRev.year) {
                const [d, m] = lastRev.date.split('/').map(Number);
                daysAgo = Math.floor((now - new Date(lastRev.year, m - 1, d)) / 86400000);
            }

            const studiedThisWeek = revisions.filter(r => {
                if (!r || !r.date || !r.year) return false;
                const [rd, rm] = r.date.split('/').map(Number);
                const rDate = new Date(r.year, rm - 1, rd);
                return mdGetISOWeek(rDate) === curW && mdGetISOWeekYear(rDate) === curY;
            }).length;

            let nextSlots = [];
            try {
                nextSlots = smGetNextSlots({
                    revisions, scheduleType: data.scheduleType || 'prime',
                    scheduleN: data.scheduleN || 4, smSlotCount: data.smSlotCount,
                    smGrace: data.smGrace, smPenalty: data.smPenalty,
                    smMissedMode: data.smMissedMode, smCustomGaps: data.smCustomGaps,
                    smRpw: data.smRpw, smPerSlotRpw: data.smPerSlotRpw,
                });
            } catch(e) {}

            nextSlots.forEach(slot => {
                const rpw = slot.rpw || 1;
                const count = (slot.week === curW && slot.year === curY) ? Math.max(0, rpw - studiedThisWeek) : rpw;
                for (let r = 0; r < count; r++) {
                    mdState.tbcEntries.push({
                        sectionId: secId, sectionTitle: secTitle,
                        fileId: file.id, fileName: file.name,
                        difficulty: data.difficulty || 'Easy', priority: data.priority || 'Low',
                        progress: pct, proficiency: mdProficiency(pct),
                        revCount: filled, lastRevDaysAgo: daysAgo,
                        scheduledWeek: slot.week, scheduledYear: slot.year,
                    });
                }
            });
        }

        processTBC('navigation', 'Table of Contents');
        sections.forEach(sec => { if (sec.type === 'real') processTBC(sec.id, sec.title); });
    });

    mdState.tbcEntries.sort((a, b) =>
        a.scheduledYear !== b.scheduledYear ? a.scheduledYear - b.scheduledYear :
        a.scheduledWeek !== b.scheduledWeek ? a.scheduledWeek - b.scheduledWeek :
        a.fileName !== b.fileName ? a.fileName.localeCompare(b.fileName) :
        a.sectionTitle.localeCompare(b.sectionTitle)
    );
}

// ===== RENDER =====
function mdRenderContent() {
    const container = document.getElementById('mdContentArea');
    if (!container) return;
    container.innerHTML = '';

    const currentKey = mdGetCurrentWeekKey();
    const isCurrent = mdState.selectedWeekKey === currentKey;

    // Toggle — only for current week, scrolls with content
    if (isCurrent) {
        const toggle = document.createElement('div');
        toggle.className = 'md-mode-toggle';
        [['completed', 'Completed'], ['tbc', 'To Be Completed']].forEach(([m, label]) => {
            const btn = document.createElement('button');
            btn.className = 'md-mode-btn' + (mdState.mode === m ? ' active' : '');
            btn.textContent = label;
            btn.addEventListener('click', () => {
                if (mdState.mode === m) return;
                mdState.mode = m;
                mdRenderContent();
            });
            toggle.appendChild(btn);
        });
        container.appendChild(toggle);
    }

    const rawEntries = mdState.mode === 'completed' ? mdGetCompletedForWeek() : mdGetTBCForWeek();

    if (rawEntries.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'm-empty';
        empty.textContent = mdState.mode === 'completed'
            ? 'No completed entries for this week.'
            : 'Nothing scheduled for this week.';
        container.appendChild(empty);
        return;
    }

    // Build original position map before sorting
    const totalCount = rawEntries.length;
    const origPosMap = {};
    rawEntries.forEach((e, i) => { origPosMap[`${e.fileId}_${e.sectionId}_${i}`] = i + 1; });

    const entries = mdSortEntries(rawEntries, mdState.sort, mdState.sortOrder);
    mdState.currentEntries = entries;

    if (mState.libView === 'grid') {
        const grid = document.createElement('div');
        grid.className = 'sc-section-grid';
        entries.forEach((e, i) => {
            const origIdx = rawEntries.indexOf(e);
            const sectionMeta = { count: origIdx + 1, totalCount };
            grid.appendChild(mdMakeEntryCard(e, i, mdState.sort, sectionMeta));
        });
        container.appendChild(grid);
    } else {
        const list = document.createElement('div');
        list.className = 'md-diary-list';
        entries.forEach((e, i) => {
            const origIdx = rawEntries.indexOf(e);
            const sectionMeta = { count: origIdx + 1, totalCount };
            list.appendChild(mdMakeEntryCard(e, i, mdState.sort, sectionMeta));
        });
        container.appendChild(list);
    }
}

function mdGetCompletedForWeek() {
    if (!mdState.selectedWeekKey) return [];
    return mdState.allEntries.filter(e => mdMakeWeekKey(e.dateKey) === mdState.selectedWeekKey);
}

function mdGetTBCForWeek() {
    if (!mdState.selectedWeekKey) return [];
    const sel = new Date(mdState.selectedWeekKey);
    const selW = mdGetISOWeek(sel), selY = mdGetISOWeekYear(sel);
    return mdState.tbcEntries.filter(e => e.scheduledWeek === selW && e.scheduledYear === selY);
}

function mdMakeEntryCard(entry, entryIdx, sort = 'outline', sectionMeta = {}) {
    // Get c5 data for badge
    const fileData = getFileData(entry.fileId.startsWith('f_') ? entry.fileId : `f_${entry.fileId}`);
    const c5Store = fileData?.c5_sectionStore ? JSON.parse(fileData.c5_sectionStore) : {};
    const c5 = c5Store[String(entry.sectionId)] || c5Store[entry.sectionId] || {};

    const card = mState.libView === 'grid'
        ? makeSectionGridCard(entry.sectionTitle, c5, true, entry.fileName, 'badge', sort, sectionMeta)
        : makeSectionListCard(entry.sectionTitle, c5, true, entry.fileName, 'badge', sort, sectionMeta);
    card.addEventListener('click', () => {
        mState.currentFileId = entry.fileId.startsWith('f_') ? entry.fileId : `f_${entry.fileId}`;
        mState.currentFileName = entry.fileName;
        mState.diaryEntries = mdState.currentEntries;
        mState.diaryEntryIndex = entryIdx;
        switchPage('Library');
        mState.diaryReturn = true;
        openSection(entry.sectionId, entry.sectionTitle, 'lib');
    });
    return card;
}

// ===== SORT =====
function mdSortEntries(entries, sort, order = 'asc') {
    const arr = [...entries];
    if (!sort || sort === 'outline') return arr;
    const dir = order === 'desc' ? -1 : 1;
    const diffOrder = { 'Easy': 1, 'Moderate': 2, 'Challenging': 3, 'Hard': 4 };
    const prioOrder = { 'Low': 1, 'Medium': 2, 'High': 3, 'Critical': 4 };
    const profOrder = { 'Novice': 1, 'Apprentice': 2, 'Competent': 3, 'Proficient': 4 };
    switch (sort) {
        case 'alpha':
            return arr.sort((a, b) => dir * a.sectionTitle.localeCompare(b.sectionTitle, undefined, { numeric: true, sensitivity: 'base' }));
        case 'section-count':
            return arr; // ascending only — original order is the position order
        case 'proficiency':
            return arr.sort((a, b) => dir * ((profOrder[a.proficiency] || 0) - (profOrder[b.proficiency] || 0)));
        case 'progress':
            return arr.sort((a, b) => dir * ((a.progress || 0) - (b.progress || 0)));
        case 'difficulty':
            return arr.sort((a, b) => dir * ((diffOrder[a.difficulty] || 0) - (diffOrder[b.difficulty] || 0)));
        case 'priority':
            return arr.sort((a, b) => dir * ((prioOrder[a.priority] || 0) - (prioOrder[b.priority] || 0)));
        case 'last-revised':
            return arr.sort((a, b) => dir * (a.dateKey || '').localeCompare(b.dateKey || ''));
        case 'revision-count':
            return arr.sort((a, b) => dir * ((a.revCount || 0) - (b.revCount || 0)));
        default:
            return arr;
    }
}

function openDiarySortSheet() {
    document.querySelectorAll('#mDiarySortSheet .m-sort-option').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.sort === mdState.sort);
    });
    document.getElementById('mDiarySortSheet').classList.add('active');
}

function closeDiarySortSheet() {
    document.getElementById('mDiarySortSheet').classList.remove('active');
}

function bindDiarySortSheet() {
    const sheet = document.getElementById('mDiarySortSheet');
    if (!sheet) return;
    sheet.querySelector('.m-sort-backdrop')?.addEventListener('click', closeDiarySortSheet);
    sheet.querySelectorAll('.m-sort-option').forEach(btn => {
        btn.addEventListener('click', () => {
            mdState.sort = btn.dataset.sort;
            if (mdState.sort === 'outline' || mdState.sort === 'section-count') mdState.sortOrder = 'asc';
            closeDiarySortSheet();
            mdRenderContent();
            if (typeof updateSortOrderIndicator === 'function') updateSortOrderIndicator();
        });
    });
}

// ===== INIT =====
function mdDiaryInit() {
    const prevWeek = mdState.selectedWeekKey;
    mdLoadAllEntries();
    mdLoadTBCEntries();
    if (!prevWeek) {
        mdState.selectedWeekKey = mdGetCurrentWeekKey();
        mdState.mode = 'tbc';
    }
    bindDiarySortSheet();
    mdBuildWeekNav();
    mdRenderContent();
}
