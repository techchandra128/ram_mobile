// diary.js

// ===== CONSTANTS =====
const DR_DIFF_COLORS = { Easy: '#22c55e', Moderate: '#f59e0b', Challenging: '#f97316', Hard: '#ef4444' };
const DR_PRIO_COLORS = { Low: '#94a3b8', Medium: '#3b82f6', High: '#f97316', Critical: '#ef4444' };
const DR_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ===== STATE =====
const drState = {
    allEntries: [],      // flat list of all diary entries (completed)
    filteredEntries: [], // after filter
    tbcEntries: [],      // to be completed entries (placeholder)
    filterDiff: [],
    filterPrio: [],
    filterFile: 'all',
    selectedWeekKey: null,
    mode: 'completed',   // 'completed' | 'tbc'
};

const drPvState = {
    entry: null,
};

// Get Monday of the week containing a given date
function drGetWeekStart(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const day = d.getDay();
    const diff = (day === 0) ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return d;
}

// Week key = "YYYY-MM-DD" of that week's Monday
function drMakeWeekKey(dateKey) {
    const d = new Date(dateKey);
    const ws = drGetWeekStart(d);
    return `${ws.getFullYear()}-${String(ws.getMonth()+1).padStart(2,'0')}-${String(ws.getDate()).padStart(2,'0')}`;
}

function drGetCurrentWeekKey() {
    return drMakeWeekKey(new Date().toISOString().slice(0, 10));
}

// Build all calendar weeks Jan 2026 → today + 18 months (same as heatmap)
function drBuildAllWeeks() {
    const startDate = drGetWeekStart(new Date(2026, 0, 1));
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 18);
    const weeks = [];
    const cur = new Date(startDate);
    while (cur <= endDate) {
        weeks.push(new Date(cur));
        cur.setDate(cur.getDate() + 7);
    }
    return weeks;
}

// Month label based on Thursday of the week (ISO standard, same as heatmap)
function drWeekMonthLabel(weekStart) {
    const thu = new Date(weekStart);
    thu.setDate(thu.getDate() + 3);
    return `${DR_MONTHS[thu.getMonth()]} '${String(thu.getFullYear()).slice(2)}`;
}

// Week number within its month group (1st, 2nd, etc.)
function drOrdinal(n) {
    return n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`;
}

function drBuildWeekNav() {
    const container = document.getElementById('drWeekNav');
    if (!container) return;

    const allWeeks = drBuildAllWeeks();
    const currentKey = drGetCurrentWeekKey();

    // Build completed count map
    const completedMap = {};
    drState.allEntries.forEach(e => {
        const wk = drMakeWeekKey(e.dateKey);
        if (wk) completedMap[wk] = (completedMap[wk] || 0) + 1;
    });

    // Build TBC count map
    const tbcMap = {};
    drState.tbcEntries.forEach(e => {
        if (!e.scheduledWeek || !e.scheduledYear) return;
        const monday = drWeekToDate(e.scheduledWeek, e.scheduledYear);
        const wk = `${monday.getFullYear()}-${String(monday.getMonth()+1).padStart(2,'0')}-${String(monday.getDate()).padStart(2,'0')}`;
        tbcMap[wk] = (tbcMap[wk] || 0) + 1;
    });

    // Group by month label
    const monthGroups = [];
    let curGroup = null;
    allWeeks.forEach(ws => {
        const key = `${ws.getFullYear()}-${String(ws.getMonth()+1).padStart(2,'0')}-${String(ws.getDate()).padStart(2,'0')}`;
        const label = drWeekMonthLabel(ws);
        if (!curGroup || curGroup.label !== label) {
            curGroup = { label, weeks: [] };
            monthGroups.push(curGroup);
        }
        const weekNum = curGroup.weeks.length + 1;
        curGroup.weeks.push({ key, weekNum });
    });

    container.innerHTML = '';
    const flex = document.createElement('div');
    flex.className = 'dr-week-nav-inner';

    monthGroups.forEach(grp => {
        const table = document.createElement('table');
        table.className = 'dr-week-nav-table';

        // Month header row
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        const th = document.createElement('th');
        th.colSpan = grp.weeks.length;
        th.textContent = grp.label;
        th.className = 'dr-wn-month';
        headerRow.appendChild(th);
        thead.appendChild(headerRow);

        // Week cells row
        const tbody = document.createElement('tbody');
        const weekRow = document.createElement('tr');
        grp.weeks.forEach((wk, idx) => {
            const td = document.createElement('td');
            td.textContent = drOrdinal(wk.weekNum);
            td.className = 'dr-wn-week' +
                (wk.key === drState.selectedWeekKey ? ' active' : '') +
                (wk.key === currentKey ? ' current-week' : '');
            td.dataset.weekKey = wk.key;
            td.addEventListener('click', () => drSelectWeek(wk.key));
            weekRow.appendChild(td);
        });
        tbody.appendChild(weekRow);

        const countRow = document.createElement('tr');
        grp.weeks.forEach((wk, idx) => {
            const td = document.createElement('td');
            const isCur = wk.key === currentKey;
            const isPast = wk.key < currentKey;
            const isFirst = idx === 0;
            const isLast = idx === grp.weeks.length - 1;
            let text = '';
            if (isCur) {
                const c = completedMap[wk.key] || 0;
                const t = tbcMap[wk.key] || 0;
                if (c > 0 || t > 0) text = `${c}-${t}`;
            } else if (isPast) {
                const c = completedMap[wk.key] || 0;
                if (c > 0) text = String(c);
            } else {
                const t = tbcMap[wk.key] || 0;
                if (t > 0) text = String(t);
            }
            td.textContent = text;
            td.className = 'dr-wn-count' + (text === '' ? ' dr-wn-count-zero' : '') + (isCur ? ' current-week' : '');
            if (isCur) {
                if (isFirst) td.style.borderBottomLeftRadius = '5px';
                if (isLast) td.style.borderBottomRightRadius = '5px';
            }
            td.dataset.weekKey = wk.key;
            td.addEventListener('click', () => drSelectWeek(wk.key));
            countRow.appendChild(td);
        });
        tbody.appendChild(countRow);

        table.appendChild(thead);
        table.appendChild(tbody);
        flex.appendChild(table);
    });

    container.appendChild(flex);

    // Scroll active week into view
    requestAnimationFrame(() => {
        const active = container.querySelector('.dr-wn-week.active');
        if (active) active.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    });
}

function drSelectWeek(weekKey) {
    drState.selectedWeekKey = weekKey;
    document.querySelectorAll('.dr-wn-week').forEach(td => {
        td.classList.toggle('active', td.dataset.weekKey === weekKey);
    });

    const currentKey = drGetCurrentWeekKey();
    const isCurrent = weekKey === currentKey;
    const isPast = weekKey < currentKey;

    // Show toggle only for current week
    const toggleGroup = document.getElementById('drToggleGroup');
    if (toggleGroup) toggleGroup.classList.toggle('visible', isCurrent);

    // Auto-set mode based on week type
    if (isPast) {
        drState.mode = 'completed';
    } else if (!isCurrent) {
        drState.mode = 'tbc';
    }
    // current week: keep whatever mode was last selected

    drUpdateToggleUI();
    if (drState.mode === 'tbc') drLoadTBCEntries();
    drRenderAll();
}


function drCollectAllFiles(cur, result) {
    if (!result) result = [];
    for (const [name, item] of Object.entries(cur)) {
        if (item.type === 'file' && item.fileId) {
            result.push({ name, fileId: item.fileId });
        } else if (item.type === 'folder' && item.contents) {
            drCollectAllFiles(item.contents, result);
        }
    }
    return result;
}

function drLoadAllEntries() {
    drState.allEntries = [];

    const fsRaw = localStorage.getItem('ram_fileSystem');
    if (!fsRaw) return;
    let fs;
    try { fs = JSON.parse(fsRaw); } catch(e) { return; }

    const files = drCollectAllFiles(fs);

    files.forEach(file => {
        const sectionsRaw = localStorage.getItem(`c12_sections_${file.fileId}`);
        const storeRaw    = localStorage.getItem(`c5_sectionStore_${file.fileId}`);
        if (!sectionsRaw || !storeRaw) return;

        let sections, store;
        try { sections = JSON.parse(sectionsRaw); } catch(e) { return; }
        try { store    = JSON.parse(storeRaw);    } catch(e) { return; }

        function processCompletedSec(secId, secTitle) {
            const data = store[String(secId)] || store[secId];
            if (!data) return;

            const filledRevs = (data.revisions || [])
                .map((r, i) => ({ ...r, slotIndex: i }))
                .filter(r => r.date && r.year);

            filledRevs.forEach(rev => {
                const countAsOf = rev.slotIndex + 1;
                const activated = data.activatedCount || 4;
                const pctAsOf = Math.round((countAsOf / activated) * 100);
                const profAsOf = drProficiency(pctAsOf);

                const [day, month] = rev.date.split('/').map(Number);
                const dateKey = `${rev.year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                const dateDisplay = drFormatDate(day, month, rev.year);

                drState.allEntries.push({
                    sectionId: secId,
                    sectionTitle: secTitle,
                    fileId: file.fileId,
                    fileName: file.name,
                    difficulty: data.difficulty || 'Easy',
                    priority: data.priority || 'Low',
                    dateKey,
                    dateDisplay,
                    revCount: countAsOf,
                    progress: pctAsOf,
                    proficiency: profAsOf,
                    lastRevised: dateDisplay,
                    slotIndex: rev.slotIndex,
                });
            });
        }

        processCompletedSec('navigation', 'Table of Contents');

        sections.forEach(sec => {
            if (sec.type !== 'real') return;
            processCompletedSec(sec.id, sec.title);
        });
    });

    // Sort entries by date ascending (oldest first), then by file+section within same date
    drState.allEntries.sort((a, b) => {
        if (a.dateKey !== b.dateKey) return a.dateKey.localeCompare(b.dateKey);
        if (a.fileName !== b.fileName) return a.fileName.localeCompare(b.fileName);
        return a.sectionTitle.localeCompare(b.sectionTitle);
    });
}

// ===== TBC DATA =====
// Schedule logic removed — now handled by series_modal.js (smGetNextSlots)

function drLoadTBCEntries() {
    drState.tbcEntries = [];

    if (typeof smGetNextSlots !== 'function') return;

    const fsRaw = localStorage.getItem('ram_fileSystem');
    if (!fsRaw) return;
    let fs;
    try { fs = JSON.parse(fsRaw); } catch(e) { return; }

    const files = drCollectAllFiles(fs);

    files.forEach(file => {
        const sectionsRaw = localStorage.getItem(`c12_sections_${file.fileId}`);
        const storeRaw    = localStorage.getItem(`c5_sectionStore_${file.fileId}`);
        if (!sectionsRaw || !storeRaw) return;

        let sections, store;
        try { sections = JSON.parse(sectionsRaw); } catch(e) { return; }
        try { store    = JSON.parse(storeRaw);    } catch(e) { return; }

        function processSec(secId, secTitle) {
            const data = store[String(secId)] || store[secId];
            if (!data) return;
            if (data.scheduleActive === false) return;
            const revisions = data.revisions || [];
            if (!revisions[0] || !revisions[0].date) return;

            const activated = data.activatedCount || 4;
            const filled = revisions.slice(0, activated).filter(r => r && r.date).length;
            const pct = Math.round((filled / activated) * 100);

            const lastRevEntry = [...revisions].reverse().find(r => r && r.date);
            let daysAgo = null;
            if (lastRevEntry && lastRevEntry.date && lastRevEntry.year) {
                const [d, m] = lastRevEntry.date.split('/').map(Number);
                const rev = new Date(lastRevEntry.year, m - 1, d);
                const todayD = new Date(); todayD.setHours(0,0,0,0);
                daysAgo = Math.floor((todayD - rev) / 86400000);
            }

            // Count how many times already studied in the current ISO week
            const nowDate = new Date(); nowDate.setHours(0,0,0,0);
            const curISOWeek = drGetISOWeek(nowDate);
            const curISOYear = drGetISOWeekYear(nowDate);
            const studiedThisWeek = revisions.filter(r => {
                if (!r || !r.date || !r.year) return false;
                const [rd, rm] = r.date.split('/').map(Number);
                const rDate = new Date(r.year, rm - 1, rd);
                return drGetISOWeek(rDate) === curISOWeek && drGetISOWeekYear(rDate) === curISOYear;
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
            } catch(e) { nextSlots = []; }

            nextSlots.forEach(slot => {
                const rpw = slot.rpw || 1;
                const isCurrentWeek = slot.week === curISOWeek && slot.year === curISOYear;
                const count = isCurrentWeek ? Math.max(0, rpw - studiedThisWeek) : rpw;
                for (let r = 0; r < count; r++) {
                    drState.tbcEntries.push({
                        sectionId: secId, sectionTitle: secTitle,
                        fileId: file.fileId, fileName: file.name,
                        difficulty: data.difficulty || 'Easy', priority: data.priority || 'Low',
                        progress: pct, proficiency: drProficiency(pct),
                        revCount: filled, lastRevDaysAgo: daysAgo,
                        nextSlotIndex: slot.slot, scheduledWeek: slot.week, scheduledYear: slot.year,
                    });
                }
            });
        }

        // Navigation section (Table of Contents) is stored separately, not in sections list
        processSec('navigation', 'Table of Contents');

        sections.forEach(sec => {
            if (sec.type !== 'real') return;
            processSec(sec.id, sec.title);
        });
    });

    // Sort by scheduled year/week, then file, then section
    drState.tbcEntries.sort((a, b) => {
        if (a.scheduledYear !== b.scheduledYear) return a.scheduledYear - b.scheduledYear;
        if (a.scheduledWeek !== b.scheduledWeek) return a.scheduledWeek - b.scheduledWeek;
        if (a.fileName !== b.fileName) return a.fileName.localeCompare(b.fileName);
        return a.sectionTitle.localeCompare(b.sectionTitle);
    });
}

function drWeekToDate(week, year) {
    const jan4 = new Date(year, 0, 4);
    const monday = new Date(jan4);
    monday.setDate(jan4.getDate() - (jan4.getDay() + 6) % 7 + (week - 1) * 7);
    return monday;
}

function drGetISOWeek(date) {
    const d = new Date(date); d.setHours(0,0,0,0);
    d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
    const week1 = new Date(d.getFullYear(), 0, 4);
    return 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}

function drGetISOWeekYear(date) {
    const d = new Date(date); d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7); return d.getFullYear();
}

function drFormatDate(day, month, year) {
    const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const d = new Date(year, month - 1, day);
    return days[d.getDay()];
}

function drProficiency(pct) {
    if (pct <= 25) return 'Novice';
    if (pct <= 50) return 'Apprentice';
    if (pct <= 75) return 'Competent';
    return 'Proficient';
}

// ===== FILTER =====
function drApplyFilters() {
    drState.filteredEntries = drState.allEntries.filter(e => {
        if (drState.filterDiff.length && !drState.filterDiff.includes(e.difficulty)) return false;
        if (drState.filterPrio.length && !drState.filterPrio.includes(e.priority)) return false;
        if (drState.filterFile !== 'all' && e.fileId !== drState.filterFile) return false;
        if (drState.selectedWeekKey && drMakeWeekKey(e.dateKey) !== drState.selectedWeekKey) return false;
        return true;
    });
}

// ===== RENDER =====
function drRender() {
    if (drState.mode === 'completed') {
        drApplyFilters();
        drRenderTable();
    } else {
        drRenderTBCTable();
    }
    drUpdateCount();
}

function drRenderAll() {
    drBuildWeekNav();
    drRender();
}

function drRenderTable() {
    const container = document.getElementById('drCompletedScroll');
    if (!container) return;
    container.innerHTML = '';

    if (drState.filteredEntries.length === 0) {
        container.innerHTML = `<div class="as-empty" style="padding:40px;text-align:center">No diary entries found.</div>`;
        return;
    }

    // Group by dateKey
    const groups = [];
    let curGroup = null;
    drState.filteredEntries.forEach(entry => {
        if (!curGroup || curGroup.dateKey !== entry.dateKey) {
            curGroup = { dateKey: entry.dateKey, entries: [] };
            groups.push(curGroup);
        }
        curGroup.entries.push(entry);
    });

    groups.forEach(group => {
        const groupDiv = document.createElement('div');
        groupDiv.className = 'diary-group';

        const table = document.createElement('table');
        table.className = 'as-table diary-table';
        table.innerHTML = `<colgroup>
            <col class="dr-col-date"><col class="dr-col-num"><col class="dr-col-section">
            <col class="dr-col-file"><col class="dr-col-diff"><col class="dr-col-prio">
            <col class="dr-col-prof"><col class="dr-col-progress">
            <col class="dr-col-rev"><col class="dr-col-last">
        </colgroup>`;
        const tbody = document.createElement('tbody');

        group.entries.forEach((entry, i) => {
            const tr = document.createElement('tr');
            tr.dataset.dateKey = entry.dateKey;
            tr.dataset.sectionId = String(entry.sectionId);
            tr.dataset.fileId = entry.fileId;

            const profColor = entry.progress <= 25 ? '#94a3b8' : entry.progress <= 50 ? '#f59e0b' : entry.progress <= 75 ? '#f97316' : '#22c55e';
            const barColor  = entry.progress === 100 ? '#22c55e' : entry.progress >= 50 ? '#f97316' : '#3b82f6';
            const filled = entry.progress >= 100 ? 4 : entry.progress >= 75 ? 3 : entry.progress >= 50 ? 2 : entry.progress >= 25 ? 1 : 0;
            const fillColor = ['#3b82f6','#f59e0b','#f97316','#22c55e'][filled > 0 ? filled - 1 : 0];

            const dateCellHtml = i === 0
                ? `<span style="font-size:11px;font-family:'JetBrains Mono',monospace;color:var(--accent-blue);font-weight:700">${entry.dateDisplay}</span>`
                : '';

            tr.innerHTML = `
                <td style="text-align:center">${dateCellHtml}</td>
                <td style="text-align:center"><div style="color:var(--text-primary);font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:700">${i + 1}</div></td>
                <td style="text-align:left;padding-left:2px"><div class="as-td-name" title="${escDr(entry.sectionTitle)}">${escDr(entry.sectionTitle)}</div></td>
                <td style="text-align:left;padding-left:2px"><div class="as-td-file" title="${escDr(entry.fileName)}">${escDr(entry.fileName)}</div></td>
                <td class="as-td-editable" style="text-align:center"></td>
                <td class="as-td-editable" style="text-align:center"></td>
                <td style="text-align:center"><span class="as-pill" style="background:${profColor}18;color:${profColor};border:1px solid ${profColor}44;min-width:96px;justify-content:center;">${entry.proficiency}</span></td>
                <td style="text-align:center">
                    <div style="display:inline-flex;align-items:center;gap:4px;vertical-align:middle;">
                        <div class="as-prog-pill">
                            <div class="as-prog-cell" style="background:${filled >= 1 ? fillColor : ''}"></div>
                            <div class="as-prog-cell" style="background:${filled >= 2 ? fillColor : ''}"></div>
                            <div class="as-prog-cell" style="background:${filled >= 3 ? fillColor : ''}"></div>
                            <div class="as-prog-cell" style="background:${filled >= 4 ? fillColor : ''}"></div>
                        </div>
                        <span class="as-pct-pill" style="border:1px solid ${barColor}44;background:${barColor}18;color:${barColor};">${entry.progress}%</span>
                    </div>
                </td>
                <td style="text-align:center"><span class="as-pill" style="border:1px solid var(--text-secondary);color:var(--text-secondary)">${entry.revCount}</span></td>
                <td style="text-align:center"><span style="font-size:11px;font-family:'JetBrains Mono',monospace;color:var(--text-secondary)">${entry.lastRevised}</span></td>
            `;

            const diffTd = tr.querySelectorAll('.as-td-editable')[0];
            diffTd.appendChild(drInlineDropdown(entry, 'difficulty', ['Easy','Moderate','Challenging','Hard'], DR_DIFF_COLORS, tr));

            const prioTd = tr.querySelectorAll('.as-td-editable')[1];
            prioTd.appendChild(drInlineDropdown(entry, 'priority', ['Low','Medium','High','Critical'], DR_PRIO_COLORS, tr));

            tr.addEventListener('click', () => {
                document.querySelectorAll('.diary-group .as-table tbody tr').forEach(r => r.classList.remove('as-selected'));
                tr.classList.add('as-selected');
                drOpenPreview(entry);
            });

            tbody.appendChild(tr);
        });

        table.appendChild(tbody);
        groupDiv.appendChild(table);
        container.appendChild(groupDiv);
    });

    // Auto-scroll to bottom
    requestAnimationFrame(() => { container.scrollTop = container.scrollHeight; });
}

function drUpdateCount() {
    const el = document.getElementById('drCount');
    if (!el) return;
    const count = drState.mode === 'completed' ? drState.filteredEntries.length : drState.tbcEntries.length;
    el.textContent = `${count} entr${count !== 1 ? 'ies' : 'y'}`;
}

// ===== TBC TABLE RENDER =====
function drRenderTBCTable() {
    const container = document.getElementById('drGroupsScroll');
    if (!container) return;
    container.innerHTML = '';

    // Filter by selected week
    let entries = drState.tbcEntries;
    if (drState.selectedWeekKey) {
        // selectedWeekKey is "YYYY-MM-DD" of that week's Monday
        // Convert to week/year for direct comparison
        const selDate = new Date(drState.selectedWeekKey);
        const selWeek = drGetISOWeek(selDate);
        const selYear = drGetISOWeekYear(selDate);
        entries = drState.tbcEntries.filter(e =>
            e.scheduledWeek === selWeek && e.scheduledYear === selYear
        );
    }

    if (entries.length === 0) {
        container.innerHTML = `<div class="as-empty" style="padding:40px;text-align:center">No entries to be completed.</div>`;
        return;
    }

    const groupDiv = document.createElement('div');
    groupDiv.className = 'diary-group';

    const table = document.createElement('table');
    table.className = 'as-table diary-table';
    table.innerHTML = `<colgroup>
        <col style="width:44px">
        <col style="width:18%">
        <col style="width:14%">
        <col style="width:11%">
        <col style="width:10%">
        <col style="width:11%">
        <col style="width:14%">
        <col style="width:10%">
        <col style="width:9%">
    </colgroup>`;
    const tbody = document.createElement('tbody');

    entries.forEach(entry => {
        const tr = document.createElement('tr');
        tr.dataset.sectionId = String(entry.sectionId);
        tr.dataset.fileId = entry.fileId;

        const profColor = entry.progress <= 25 ? '#94a3b8' : entry.progress <= 50 ? '#f59e0b' : entry.progress <= 75 ? '#f97316' : '#22c55e';
        const barColor  = entry.progress === 100 ? '#22c55e' : entry.progress >= 50 ? '#f97316' : '#3b82f6';
        const filled = entry.progress >= 100 ? 4 : entry.progress >= 75 ? 3 : entry.progress >= 50 ? 2 : entry.progress >= 25 ? 1 : 0;
        const fillColor = ['#3b82f6','#f59e0b','#f97316','#22c55e'][filled > 0 ? filled - 1 : 0];

        const d = entry.lastRevDaysAgo;
        let lastRevHtml;
        if (entry.progress >= 100) {
            lastRevHtml = `<span class="as-done">Done ✓</span>`;
        } else if (d === null) {
            lastRevHtml = `<span class="as-overdue">Never</span>`;
        } else if (d === 0) {
            lastRevHtml = `<span class="as-done">Today</span>`;
        } else if (d === 1) {
            lastRevHtml = `1 day ago`;
        } else if (d > 30) {
            lastRevHtml = `<span class="as-overdue">${d} days ago</span>`;
        } else {
            lastRevHtml = `${d} days ago`;
        }

        tr.innerHTML = `
            <td style="text-align:center"><div style="color:var(--text-primary);font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:700">${entries.indexOf(entry) + 1}</div></td>
            <td style="text-align:left;padding-left:8px"><div class="as-td-name" title="${escDr(entry.sectionTitle)}">${escDr(entry.sectionTitle)}</div></td>
            <td style="text-align:left;padding-left:2px"><div class="as-td-file" title="${escDr(entry.fileName)}">${escDr(entry.fileName)}</div></td>
            <td class="as-td-editable" style="text-align:center"></td>
            <td class="as-td-editable" style="text-align:center"></td>
            <td style="text-align:center"><span class="as-pill" style="background:${profColor}18;color:${profColor};border:1px solid ${profColor}44;min-width:96px;justify-content:center;">${entry.proficiency}</span></td>
            <td style="text-align:center">
                <div style="display:inline-flex;align-items:center;gap:4px;vertical-align:middle;">
                    <div class="as-prog-pill">
                        <div class="as-prog-cell" style="background:${filled >= 1 ? fillColor : ''}"></div>
                        <div class="as-prog-cell" style="background:${filled >= 2 ? fillColor : ''}"></div>
                        <div class="as-prog-cell" style="background:${filled >= 3 ? fillColor : ''}"></div>
                        <div class="as-prog-cell" style="background:${filled >= 4 ? fillColor : ''}"></div>
                    </div>
                    <span class="as-pct-pill" style="border:1px solid ${barColor}44;background:${barColor}18;color:${barColor};">${entry.progress}%</span>
                </div>
            </td>
            <td style="text-align:center"><span class="as-pill" style="border:1px solid var(--text-secondary);color:var(--text-secondary)">${entry.revCount}</span></td>
            <td style="text-align:center"><span class="as-pill" style="border:1px solid var(--text-secondary);color:var(--text-secondary)">${lastRevHtml}</span></td>
        `;

        const diffTd = tr.querySelectorAll('.as-td-editable')[0];
        diffTd.appendChild(drInlineDropdown(entry, 'difficulty', ['Easy','Moderate','Challenging','Hard'], DR_DIFF_COLORS, tr));

        const prioTd = tr.querySelectorAll('.as-td-editable')[1];
        prioTd.appendChild(drInlineDropdown(entry, 'priority', ['Low','Medium','High','Critical'], DR_PRIO_COLORS, tr));

        tr.addEventListener('click', () => {
            document.querySelectorAll('.diary-group .as-table tbody tr').forEach(r => r.classList.remove('as-selected'));
            tr.classList.add('as-selected');
            drOpenPreview(entry);
        });

        tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    groupDiv.appendChild(table);
    container.appendChild(groupDiv);
}



function escDr(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ===== INLINE DROPDOWN =====
function drInlineDropdown(entry, field, options, colorMap, tr) {
    const wrap = document.createElement('div');
    wrap.className = 'as-inline-dd-wrap';

    const val = entry[field];
    const color = colorMap[val] || '#94a3b8';

    const pill = document.createElement('span');
    pill.className = 'as-pill as-pill-btn';
    pill.style.cssText = `background:${color}18;color:${color};border:1px solid ${color}44;cursor:pointer;user-select:none;min-width:96px;justify-content:center;`;
    pill.innerHTML = `${escDr(val)} <span style="font-size:8px">▼</span>`;

    const menu = document.createElement('div');
    menu.className = 'as-inline-dd-menu';
    options.forEach(opt => {
        const c = colorMap[opt] || '#94a3b8';
        const item = document.createElement('div');
        item.className = 'as-inline-dd-item' + (opt === val ? ' selected' : '');
        item.style.cssText = `color:${c}`;
        item.innerHTML = opt;
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            wrap.classList.remove('active');
            if (opt !== entry[field]) {
                drSaveDiffPrio(entry, field, opt);
                entry[field] = opt;
                drRender();
            }
        });
        menu.appendChild(item);
    });

    pill.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.as-inline-dd-wrap.active').forEach(w => { if (w !== wrap) w.classList.remove('active'); });
        if (!wrap.classList.contains('active')) {
            const rect = pill.getBoundingClientRect();
            menu.style.top = (rect.bottom + 4) + 'px';
            menu.style.left = rect.left + 'px';
        }
        wrap.classList.toggle('active');
    });

    wrap.appendChild(pill);
    wrap.appendChild(menu);
    return wrap;
}

function drSaveDiffPrio(entry, field, value) {
    try {
        const storeRaw = localStorage.getItem(`c5_sectionStore_${entry.fileId}`);
        if (!storeRaw) return;
        const store = JSON.parse(storeRaw);
        const data = store[String(entry.sectionId)] || store[entry.sectionId];
        if (!data) return;
        data[field] = value;
        store[String(entry.sectionId)] = data;
        localStorage.setItem(`c5_sectionStore_${entry.fileId}`, JSON.stringify(store));
        // Update all entries for this section
        drState.allEntries.forEach(e => {
            if (e.fileId === entry.fileId && e.sectionId === entry.sectionId) {
                e[field] = value;
            }
        });
    } catch(e) {}
}

// ===== FILTER CHIPS =====
function drToggleDiff(val) {
    const idx = drState.filterDiff.indexOf(val);
    if (idx === -1) drState.filterDiff.push(val);
    else drState.filterDiff.splice(idx, 1);
    drRenderFilterChips();
    drRender();
}

function drTogglePrio(val) {
    const idx = drState.filterPrio.indexOf(val);
    if (idx === -1) drState.filterPrio.push(val);
    else drState.filterPrio.splice(idx, 1);
    drRenderFilterChips();
    drRender();
}

function drRenderFilterChips() {
    ['Easy','Moderate','Challenging','Hard'].forEach(d => {
        const el = document.getElementById(`drChipDiff_${d}`);
        if (el) el.classList.toggle('active', drState.filterDiff.includes(d));
    });
    ['Low','Medium','High','Critical'].forEach(p => {
        const el = document.getElementById(`drChipPrio_${p}`);
        if (el) el.classList.toggle('active', drState.filterPrio.includes(p));
    });
}

function drOnFileFilter(e) {
    drState.filterFile = e.target.value;
    drRender();
}

function drPopulateFileSelect() {
    const sel = document.getElementById('drFileSelect');
    if (!sel) return;
    sel.innerHTML = '<option value="all">All Books</option>';
    const seen = new Set();
    drState.allEntries.forEach(e => {
        if (!seen.has(e.fileId)) {
            seen.add(e.fileId);
            const opt = document.createElement('option');
            opt.value = e.fileId;
            opt.textContent = e.fileName;
            sel.appendChild(opt);
        }
    });
}

// ===== PREVIEW PANEL =====
function drOpenPreview(entry) {
    const panel = document.getElementById('drPreview');
    if (!panel) return;

    drPvState.entry = entry;
    panel.style.display = 'flex';

    const theme = document.documentElement.getAttribute('data-theme') || 'dark';

    // Find index in filteredEntries for prev/next
    const idx = drState.filteredEntries.findIndex(e =>
        e.fileId === entry.fileId && e.sectionId === entry.sectionId && e.dateKey === entry.dateKey
    );
    const isFirst = idx === 0;
    const isLast = idx === drState.filteredEntries.length - 1;
    const isStudied = asIsStudied(entry);

    const sendLoad = (iframe) => {
        iframe.contentWindow.postMessage({
            type: 'pvLoad',
            fileId: entry.fileId,
            sectionId: entry.sectionId,
            sectionTitle: entry.sectionTitle,
            theme, isStudied, isFirst, isLast
        }, '*');
    };

    let iframe = panel.querySelector('iframe.dr-pv-iframe');

    if (!iframe) {
        panel.innerHTML = '';
        iframe = document.createElement('iframe');
        iframe.className = 'dr-pv-iframe as-pv-iframe';
        iframe.style.cssText = 'width:100%;height:100%;border:none;border-radius:12px;';
        panel.appendChild(iframe);

        const onMsg = (e) => {
            if (e.data?.type === 'pvReady' && e.source === iframe.contentWindow) {
                window.removeEventListener('message', onMsg);
                sendLoad(iframe);
            }
        };
        window.addEventListener('message', onMsg);
        iframe.src = 'preview.html';
    } else {
        sendLoad(iframe);
    }
}

function drClosePreview() {
    const panel = document.getElementById('drPreview');
    if (panel) panel.style.display = 'none';
    document.querySelectorAll('.diary-group-table tr').forEach(tr => tr.classList.remove('dr-selected'));
    drPvState.entry = null;
}

function drNavPreview(dir) {
    const entries = drState.filteredEntries;
    const cur = drPvState.entry;
    const idx = entries.findIndex(e =>
        e.fileId === cur.fileId && e.sectionId === cur.sectionId && e.dateKey === cur.dateKey
    );
    const newIdx = dir === 'prev' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= entries.length) return;
    const newEntry = entries[newIdx];

    document.querySelectorAll('.diary-group .as-table tbody tr').forEach(tr => tr.classList.remove('as-selected'));
    document.querySelectorAll('.diary-group .as-table tbody tr').forEach(tr => {
        if (tr.dataset.dateKey === newEntry.dateKey &&
            tr.dataset.sectionId === String(newEntry.sectionId) &&
            tr.dataset.fileId === newEntry.fileId) {
            tr.classList.add('as-selected');
            tr.scrollIntoView({ block: 'nearest' });
        }
    });

    drPvState.entry = newEntry;
    drOpenPreview(newEntry);
}

// Handle messages from preview iframe (nav/close — no studied toggle in diary)
window.addEventListener('message', (e) => {
    if (e.data?.type === 'pvNav') {
        const diaryLayer = document.getElementById('diaryLayer');
        if (diaryLayer && diaryLayer.classList.contains('active')) {
            drNavPreview(e.data.dir);
        }
    } else if (e.data?.type === 'pvClose') {
        const diaryLayer = document.getElementById('diaryLayer');
        if (diaryLayer && diaryLayer.classList.contains('active')) {
            drClosePreview();
        }
    } else if (e.data?.type === 'pvStudied') {
        const diaryLayer = document.getElementById('diaryLayer');
        if (diaryLayer && diaryLayer.classList.contains('active') && drPvState.entry) {
            asMarkStudied(drPvState.entry);
            // Refresh studied state in preview iframe
            const isStudied = asIsStudied(drPvState.entry);
            const iframe = document.querySelector('#drPreview iframe');
            if (iframe) iframe.contentWindow.postMessage({ type: 'pvStudiedUpdate', isStudied }, '*');
        }
    }
});

// Close inline dropdowns on outside click
document.addEventListener('click', () => {
    document.querySelectorAll('.as-inline-dd-wrap.active').forEach(w => w.classList.remove('active'));
});

// ===== AUTO REFRESH =====
let drRefreshBound = false;
function drSetupRefresh() {
    if (drRefreshBound) return;
    drRefreshBound = true;
    window.addEventListener('storage', (e) => {
        if (!e.key || !e.key.startsWith('c5_sectionStore_')) return;
        const layer = document.getElementById('diaryLayer');
        if (!layer || !layer.classList.contains('active')) return;
        drLoadAllEntries();
        drApplyFilters();
        drRenderGroups();
        drUpdateCount();
    });
    window.addEventListener('message', (e) => {
        if (e.data?.type === 'ramDataSaved') {
            const layer = document.getElementById('diaryLayer');
            if (layer && layer.classList.contains('active')) {
                drLoadAllEntries();
                drApplyFilters();
                drRenderGroups();
                drUpdateCount();
            }
        }
    });
}

// ===== MODE TOGGLE =====
function drUpdateToggleUI() {
    const mode = drState.mode;
    const togCompleted = document.getElementById('drTogCompleted');
    const togTBC = document.getElementById('drTogTBC');
    if (togCompleted) togCompleted.classList.toggle('active', mode === 'completed');
    if (togTBC) togTBC.classList.toggle('active', mode === 'tbc');

    const tbcBox = document.getElementById('drTBCBox');
    const completedBox = document.getElementById('drCompletedBox');
    if (tbcBox) tbcBox.style.display = mode === 'tbc' ? '' : 'none';
    if (completedBox) completedBox.style.display = mode === 'completed' ? '' : 'none';
}

function drSwitchMode(mode) {
    if (drState.mode === mode) return;
    drState.mode = mode;
    drUpdateToggleUI();
    drState.selectedWeekKey = drGetCurrentWeekKey();
    drRenderAll();
}

// ===== SHOW / INIT =====
function showDiary() {
    setActiveNav('navDiary');
    ['dashboardLayer','graphsLayer','smartDeskLayer','settingsLayer','asLayer','playlistsLayer','campaignLayer','allFilesLayer'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.remove('active');
    });
    document.getElementById('mainPage').classList.remove('active');
    document.getElementById('diaryLayer').classList.add('active');

    drState.filterDiff = [];
    drState.filterPrio = [];
    drState.filterFile = 'all';
    drState.mode = 'tbc';

    drLoadAllEntries();
    drLoadTBCEntries();
    drPopulateFileSelect();
    const sel = document.getElementById('drFileSelect');
    if (sel) sel.value = 'all';
    drRenderFilterChips();
    drState.selectedWeekKey = drGetCurrentWeekKey();

    // Show toggle for current week (default), set UI
    const toggleGroup = document.getElementById('drToggleGroup');
    if (toggleGroup) toggleGroup.classList.add('visible');
    drUpdateToggleUI();

    drRenderAll();
    drSetupRefresh();
}