// mobile_diary.js

const MD_DIFF_COLORS = { Easy: '#22c55e', Moderate: '#f59e0b', Challenging: '#f97316', Hard: '#ef4444' };
const MD_PRIO_COLORS = { Low: '#94a3b8', Medium: '#3b82f6', High: '#f97316', Critical: '#ef4444' };
const MD_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const mdState = {
    allEntries: [],
    tbcEntries: [],
    selectedWeekKey: null,
    mode: 'tbc',
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
        [['completed', 'Completed'], ['tbc', 'To Be Done']].forEach(([m, label]) => {
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

    const entries = mdState.mode === 'completed' ? mdGetCompletedForWeek() : mdGetTBCForWeek();

    if (entries.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'm-empty';
        empty.textContent = mdState.mode === 'completed'
            ? 'No completed entries for this week.'
            : 'Nothing scheduled for this week.';
        container.appendChild(empty);
        return;
    }

    const countEl = document.createElement('div');
    countEl.className = 'md-entry-count';
    countEl.textContent = `${entries.length} entr${entries.length !== 1 ? 'ies' : 'y'}`;
    container.appendChild(countEl);

    const list = document.createElement('div');
    list.className = 'md-diary-list';
    entries.forEach(e => list.appendChild(mdMakeEntryCard(e)));
    container.appendChild(list);
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

function mdMakeEntryCard(entry) {
    const diffColor = MD_DIFF_COLORS[entry.difficulty] || '#94a3b8';
    const prioColor = MD_PRIO_COLORS[entry.priority] || '#94a3b8';
    const profColor = entry.progress <= 25 ? '#94a3b8'
        : entry.progress <= 50 ? '#f59e0b'
        : entry.progress <= 75 ? '#f97316'
        : '#22c55e';

    let rightLabel = '';
    if (mdState.mode === 'completed') {
        rightLabel = entry.dateDisplay || '';
    } else {
        const d = entry.lastRevDaysAgo;
        if (entry.progress >= 100) rightLabel = 'Done';
        else if (d === null) rightLabel = 'Never';
        else if (d === 0) rightLabel = 'Today';
        else rightLabel = `${d}d ago`;
    }

    const card = document.createElement('div');
    card.className = 'md-entry-card';
    card.style.borderLeftColor = diffColor;
    card.innerHTML = `
        <div class="md-entry-top">
            <div class="md-entry-title">${escHtml(entry.sectionTitle)}</div>
            <div class="md-entry-right">${escHtml(rightLabel)}</div>
        </div>
        <div class="md-entry-file">${escHtml(entry.fileName)}</div>
        <div class="md-entry-badges">
            <span class="md-badge" style="background:${diffColor}18;color:${diffColor};border:1px solid ${diffColor}44">${entry.difficulty}</span>
            <span class="md-badge" style="background:${prioColor}18;color:${prioColor};border:1px solid ${prioColor}44">${entry.priority}</span>
            <span class="md-badge" style="background:${profColor}18;color:${profColor};border:1px solid ${profColor}44">${entry.proficiency}</span>
            <span class="md-badge" style="background:${profColor}18;color:${profColor};border:1px solid ${profColor}44">${entry.progress}%</span>
        </div>
    `;
    return card;
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
    mdBuildWeekNav();
    mdRenderContent();
}
