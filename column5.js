// column5.js - Dashboard Column

// ===== STATE =====
const c5SectionStore = {};

function isSectionDataEmpty(id) {
    if (id === 'navigation') {
        // Non-empty if any real or dummy section exists
        const hasSections = c12State.sections.some(s => s.type === 'real' || s.type === 'dummy');
        if (hasSections) return false;
        // Or if any tab has manually added content
        const data = c3State.sectionData['navigation'];
        if (!data) return true;
        for (const tab of Object.values(data)) {
            if (typeof tab === 'object' && tab !== null) {
                for (const level of Object.values(tab)) {
                    if (level && level.versions && level.versions.length > 0) return false;
                }
            }
        }
        return true;
    }
    const data = c3State.sectionData[id];
    if (!data) return true;
    // New structure: check if any tab has any version
    for (const tab of Object.values(data)) {
        if (typeof tab === 'object' && tab !== null) {
            for (const level of Object.values(tab)) {
                if (level && level.versions && level.versions.length > 0) return false;
            }
        }
    }
    return true;
}

// ===== CAMPAIGN MODE =====
const _cpParams = new URLSearchParams(window.location.search);
const _cpCampaignId = _cpParams.get('campaignId') || null;
const _cpItemId = _cpParams.get('campaignItemId') || null;

function getCampaignTarget() {
    if (!_cpCampaignId || !_cpItemId) return null;
    const saved = localStorage.getItem('ram_campaigns');
    if (!saved) return null;
    const campaigns = JSON.parse(saved);
    const campaign = campaigns.find(c => c.id === _cpCampaignId);
    if (!campaign) return null;
    const item = (campaign.items || []).find(i => i.id === _cpItemId);
    return item ? (item.target || 2) : null;
}

function getDefaultC5Data() {
    const cpTarget = getCampaignTarget();
    return {
        isCompleted: false,
        difficulty: 'Easy',
        priority: 'Low',
        revisions: Array(12).fill(null).map(() => ({ date: null, year: null, scheduledWeek: null, scheduledYear: null })),
        totalSlots: 12,
        activatedCount: cpTarget !== null ? cpTarget : 4,
        page: 0,
        scheduleType: 'prime',
        scheduleN: 4,
        scheduleActive: true,
        // Series modal settings
        smSlotCount: 18,
        smGrace: 0,
        smPenalty: 1,
        smMissedMode: 'no-hunt',
        smCustomGaps: [1, 4],
    };
}

const c5State = {
    mode: 'section',
    isCompleted: false,
    difficulty: 'Easy',
    priority: 'Low',
    revisions: Array(12).fill(null).map(() => ({ date: null, year: null, scheduledWeek: null, scheduledYear: null })),
    totalSlots: 12,
    activatedCount: 4,
    _editingIndex: null,
    _calYear: null,
    _calMonth: null,
    _calSelectedDate: null,
    page: 0,
    scheduleType: 'prime',
    scheduleN: 4,
    scheduleActive: true,
    // Series modal settings
    smSlotCount: 18,
    smGrace: 0,
    smPenalty: 1,
    smMissedMode: 'no-hunt',
    smCustomGaps: [1, 4],
};

// ===== LOCALSTORAGE =====
function c5StoreKey() {
    const id = getFileId();
    if (_cpCampaignId && _cpItemId) return `c5_cp_${_cpCampaignId}_${_cpItemId}`;
    return `c5_sectionStore_${id}`;
}

function saveC5Store() {
    RAM_SYNC.setItem(c5StoreKey(), JSON.stringify(c5SectionStore));
    window.parent.postMessage({ type: 'ramDataSaved' }, '*');
}

function loadC5Store() {
    const data = localStorage.getItem(c5StoreKey());
    if (data) {
        const parsed = JSON.parse(data);
        Object.keys(parsed).forEach(sid => {
            c5SectionStore[sid] = parsed[sid];
        });
    }
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
    loadC5Store();
    loadC5ForSection('navigation');
    document.getElementById('c5DiffDot').style.background = '#22c55e';
    document.getElementById('c5PrioDot').style.background = '#94a3b8';
    renderSectionList();
});

// ===== ORDINAL =====
function ordinal(n) {
    const s = ['th','st','nd','rd'];
    const v = n % 100;
    return n + (s[(v-20)%10] || s[v] || s[0]);
}

// ===== PROGRESS =====
function getProgress() {
    if (c5State.mode === 'overall') return getOverallProgress();
    if (c5State.isCompleted) return 100;
    const activated = c5State.activatedCount;
    if (activated === 0) return 0;
    const filled = c5State.revisions.slice(0, activated).filter(r => r.date !== null).length;
    return Math.round((filled / activated) * 100);
}

function getOverallProgress() {
    const allSections = c12State.sections.filter(s => s.type === 'real');
    const allIds = ['navigation', ...allSections.map(s => s.id)];
    let total = 0, count = 0;
    allIds.forEach(id => {
        const data = c5SectionStore[id];
        if (!data) { count++; return; }
        if (data.isCompleted) { total += 100; count++; return; }
        const activated = data.activatedCount || 4;
        const filled = data.revisions.slice(0, activated).filter(r => r.date !== null).length;
        total += Math.round((filled / activated) * 100);
        count++;
    });
    return count === 0 ? 0 : Math.round(total / count);
}

function getFilledCount() {
    return c5State.revisions.filter(r => r.date !== null).length;
}

// ===== PROFICIENCY COLOR =====
function getProficiencyColor(pct) {
    if (pct <= 25) return '#94a3b8';
    if (pct <= 50) return '#f59e0b';
    if (pct <= 75) return '#f97316';
    return '#22c55e';
}

// ===== BOX STATE =====
function getBoxClass(globalIndex) {
    const lastFilledIndex = c5State.revisions.reduce((last, r, i) => r.date !== null ? i : last, -1);
    if (c5State.isCompleted) {
        const filled = c5State.revisions[globalIndex]?.date !== null;
        if (filled && globalIndex === lastFilledIndex) return 'filled';
        return filled ? 'filled-past' : 'locked';
    }

    const activated = c5State.activatedCount;
    const rev = c5State.revisions[globalIndex];
    const filled = rev?.date !== null;

    // Not activated at all
    if (globalIndex >= activated) return 'locked';

    if (filled && globalIndex === lastFilledIndex) return 'filled';
    if (filled && globalIndex < lastFilledIndex) return 'filled-past';

    // Editable = next empty after last filled, and prev not today
    if (globalIndex === lastFilledIndex + 1) {
        return 'editable';
    }
    
    // If last filled was just cleared and this slot is now empty and within activated
    if (globalIndex === lastFilledIndex + 1 && globalIndex < c5State.activatedCount) {
        return 'editable';
    }

    // Activated but not yet editable
    return 'activated';
}

// ===== EDITABILITY =====
function isBoxEditable(index) {
    const lastFilledIndex = c5State.revisions.reduce((last, r, i) => r.date !== null ? i : last, -1);
    if (index === lastFilledIndex && lastFilledIndex !== -1) return true;
    if (c5State.isCompleted) return false;
    if (index >= c5State.activatedCount) return false;
    return getBoxClass(index) === 'editable';
}

// ===== DATE HELPERS =====
function getToday() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
}

function isSameDay(a, b) {
    return a.getFullYear() === b.getFullYear() &&
           a.getMonth() === b.getMonth() &&
           a.getDate() === b.getDate();
}

function parseDateStr(dateStr, year) {
    if (!dateStr || !year) return null;
    const [day, month] = dateStr.split('/').map(Number);
    const d = new Date(year, month - 1, day);
    d.setHours(0, 0, 0, 0);
    return d;
}

function getMinDate(index) {
    if (index === 0) return null;
    const prev = c5State.revisions[index - 1];
    if (!prev || !prev.date) return null;
    const prevDate = parseDateStr(prev.date, prev.year);
    if (!prevDate) return null;
    const min = new Date(prevDate);
    min.setDate(min.getDate() + 1);
    return min;
}

// ===== ISO WEEK HELPERS =====
function getISOWeek(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
    const week1 = new Date(d.getFullYear(), 0, 4);
    return 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}

function getISOWeekYear(date) {
    const d = new Date(date);
    d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
    return d.getFullYear();
}

// Add n weeks to a {week, year} and return new {week, year}
function addWeeks(week, year, n) {
    // Convert to date (Monday of that ISO week), add n*7 days
    const jan4 = new Date(year, 0, 4);
    const monday = new Date(jan4);
    monday.setDate(jan4.getDate() - (jan4.getDay() + 6) % 7 + (week - 1) * 7);
    monday.setDate(monday.getDate() + n * 7);
    return { week: getISOWeek(monday), year: getISOWeekYear(monday) };
}

// Fibonacci gaps from W (slot 1's base week)
// Case 1 (Mon-Fri): slots 2&3 → W+0, slot 4 → W+1, slot 5 → W+2, slot 6 → W+3, slot 7 → W+5...
// Case 2 (Sat-Sun): slots 2&3 → W+1, slot 4 → W+2, slot 5 → W+3, slot 6 → W+5...
const FIBO_SEQ = [1, 2, 3, 5, 8, 13, 21, 34, 55]; // gaps for slots 4,5,6,7,8,9,10,11,12...

function getFiboGapFromBase(slotIndex, isCase2) {
    // slotIndex is 0-based (slot 1 = index 0, slot 2 = index 1, etc.)
    // Returns weeks to add to W (base week of slot 1)
    if (slotIndex === 0) return 0; // slot 1 → W+0
    if (slotIndex === 1 || slotIndex === 2) return isCase2 ? 1 : 0; // slots 2&3
    // slot 4+ (index 3+): use fibonacci sequence, shifted by 1 for case 2
    const fiboIdx = slotIndex - 3; // slot 4 = fiboIdx 0 → gap 1
    const gap = fiboIdx < FIBO_SEQ.length ? FIBO_SEQ[fiboIdx] : (() => {
        let a = 34, b = 55;
        for (let i = FIBO_SEQ.length; i <= fiboIdx; i++) { const c = a + b; a = b; b = c; }
        return b;
    })();
    return isCase2 ? gap + 1 : gap;
}

function isWeekend(date) {
    const day = date.getDay();
    return day === 0 || day === 6; // Sunday or Saturday
}

// Calculate ALL scheduled weeks from scratch based on slot 1's actual study date
function c5RecalcAllScheduledWeeks(slot1Date) {
    const isCase2 = isWeekend(slot1Date);
    const baseWeek = getISOWeek(slot1Date);
    const baseYear = getISOWeekYear(slot1Date);

    for (let i = 0; i < c5State.revisions.length; i++) {
        const gap = getFiboGapFromBase(i, isCase2);
        const scheduled = addWeeks(baseWeek, baseYear, gap);
        // Only set scheduledWeek if slot not yet filled, preserve existing for filled slots
        if (!c5State.revisions[i].date) {
            c5State.revisions[i].scheduledWeek = scheduled.week;
            c5State.revisions[i].scheduledYear = scheduled.year;
        }
    }
    // Always set slot 0's scheduled week too (it's the base)
    c5State.revisions[0].scheduledWeek = baseWeek;
    c5State.revisions[0].scheduledYear = baseYear;
}

// Apply late penalty: recalculate remaining slots from actualWeek with dropped gap
function c5ApplyLatePenalty(filledIndex, actualWeek, actualYear) {
    // Find what the original gap was for this slot
    const slot1Rev = c5State.revisions[0];
    if (!slot1Rev || !slot1Rev.date) return;
    const slot1Date = parseDateStr(slot1Rev.date, slot1Rev.year);
    if (!slot1Date) return;
    const isCase2 = isWeekend(slot1Date);

    // Penalty: use previous gap instead of current gap, add to actual week
    const currentGap = getFiboGapFromBase(filledIndex, isCase2);
    const prevGap = filledIndex <= 1 ? 0 : getFiboGapFromBase(filledIndex - 1, isCase2);
    const penaltyGap = Math.max(currentGap - prevGap, 1); // drop one fibonacci step

    // Recalculate all future slots from actualWeek + penaltyGap
    for (let i = filledIndex + 1; i < c5State.revisions.length; i++) {
        const stepsAhead = i - filledIndex;
        const gap = stepsAhead === 1 ? penaltyGap : penaltyGap + getFiboGapFromBase(i, isCase2) - getFiboGapFromBase(filledIndex + 1, isCase2);
        const scheduled = addWeeks(actualWeek, actualYear, Math.max(gap, 1));
        if (!c5State.revisions[i].date) {
            c5State.revisions[i].scheduledWeek = scheduled.week;
            c5State.revisions[i].scheduledYear = scheduled.year;
        }
    }
}

// Main function called after a slot is filled
function c5UpdateScheduleAfterStudy(filledIndex, actualDate) {
    const type = c5State.scheduleType;
    if (type !== 'fibonacci') {
        // Regular: next slot = scheduled week + n, or actual week + n if late
        const n = c5State.scheduleN || 4;
        const actualWeek = getISOWeek(actualDate);
        const actualYear = getISOWeekYear(actualDate);
        const nextIndex = filledIndex + 1;
        if (nextIndex < c5State.revisions.length) {
            const sched = c5State.revisions[filledIndex];
            const isLate = sched.scheduledWeek && (actualYear > sched.scheduledYear || (actualYear === sched.scheduledYear && actualWeek > sched.scheduledWeek));
            const base = isLate ? { week: actualWeek, year: actualYear } : (sched.scheduledWeek ? { week: sched.scheduledWeek, year: sched.scheduledYear } : { week: actualWeek, year: actualYear });
            const next = addWeeks(base.week, base.year, n);
            for (let i = nextIndex; i < c5State.revisions.length; i++) {
                if (!c5State.revisions[i].date) {
                    const ahead = addWeeks(base.week, base.year, n * (i - filledIndex));
                    c5State.revisions[i].scheduledWeek = ahead.week;
                    c5State.revisions[i].scheduledYear = ahead.year;
                }
            }
        }
        return;
    }

    const actualWeek = getISOWeek(actualDate);
    const actualYear = getISOWeekYear(actualDate);

    if (filledIndex === 0) {
        // First study: calculate ALL scheduled weeks from scratch
        c5RecalcAllScheduledWeeks(actualDate);
        return;
    }

    // Check if late
    const sched = c5State.revisions[filledIndex];
    const isLate = sched.scheduledWeek && (actualYear > sched.scheduledYear || (actualYear === sched.scheduledYear && actualWeek > sched.scheduledWeek));

    if (isLate) {
        c5ApplyLatePenalty(filledIndex, actualWeek, actualYear);
    }
    // Early or on time: no change to schedule
}

// ===== RENDER MAIN =====
function renderC5LabelStates() {
    const isEmpty = isSectionDataEmpty(c3State.currentSectionId);
    const diffDropdown = document.getElementById('c5DiffDropdown');
    const prioDropdown = document.getElementById('c5PrioDropdown');
    if (diffDropdown) diffDropdown.style.opacity = isEmpty ? '0.35' : '1';
    if (diffDropdown) diffDropdown.style.pointerEvents = isEmpty ? 'none' : 'auto';
    if (prioDropdown) prioDropdown.style.opacity = isEmpty ? '0.35' : '1';
    if (prioDropdown) prioDropdown.style.pointerEvents = isEmpty ? 'none' : 'auto';
}


function renderC5() {
    renderC5Circle();
    renderC5Dates();
    renderC5Stats();
    renderC5Footer();
    renderC5ActivateBtn();
    renderC5LabelStates();
    renderC5Schedule();
}

// ===== CIRCLE =====
function renderC5Circle() {
    const pct = getProgress();
    const radius = 65;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (pct / 100) * circumference;

    const fill = document.getElementById('c5CircleFill');
    const pctEl = document.getElementById('c5CirclePct');
    const labelEl = document.getElementById('c5CircleLabel');
    const bg = document.getElementById('c5CircleBg');

    if (!fill) return;

    fill.style.strokeDasharray = circumference;
    fill.style.strokeDashoffset = offset;
    fill.setAttribute('r', radius);
    if (bg) bg.setAttribute('r', radius);

    const color = getProficiencyColor(pct);
    fill.style.stroke = color;

    if (c5State.isCompleted) {
        fill.classList.add('completed');
    } else {
        fill.classList.remove('completed');
    }

    if (pctEl) pctEl.textContent = pct + '%';
    if (labelEl) labelEl.textContent = c5State.mode === 'overall' ? 'Overall' : 'Section';
}

// ===== DATE BOXES =====
function renderC5Dates() {
    const grid = document.getElementById('c5DatesGrid');
    if (!grid) return;
    grid.innerHTML = '';

    const isEmpty = isSectionDataEmpty(c3State.currentSectionId);

    const start = c5State.page * 12;
    const end = start + 12;
    const pageRevisions = c5State.revisions.slice(start, end);

    pageRevisions.forEach((rev, localIndex) => {
        const globalIndex = start + localIndex;

        const boxState = getBoxClass(globalIndex);

        const lastFilledIndex = c5State.revisions.reduce((last, r, i) => r.date !== null ? i : last, -1);
        const isLastFilled = globalIndex === lastFilledIndex && c5State.revisions[globalIndex]?.date !== null;
        const lastFilledIdx = c5State.revisions.reduce((last, r, i) => r.date !== null ? i : last, -1);

        const clickable = boxState === 'editable' || isLastFilled;

        const box = document.createElement('div');
        const isFilled = rev?.date !== null;
        box.className = `c5-date-box ${isEmpty ? 'locked' : isLastFilled ? 'filled' : boxState}`;
        
        if (clickable && !isEmpty) box.onclick = () => openC5DatePicker(globalIndex);

        // Top label
        const topLabel = document.createElement('div');
        topLabel.className = 'c5-box-top';
        topLabel.textContent = ordinal(globalIndex + 1);
        box.appendChild(topLabel);

        // Center date
        const dateEl = document.createElement('div');
        dateEl.className = 'c5-box-date';
        dateEl.textContent = rev.date || '';
        box.appendChild(dateEl);

        // Bottom label (year)
        if (rev.date && rev.year) {
            const bottomLabel = document.createElement('div');
            bottomLabel.className = 'c5-box-bottom';
            bottomLabel.textContent = rev.year;
            box.appendChild(bottomLabel);
        }

        grid.appendChild(box);
    });

    // Pagination
    const totalPages = Math.ceil(c5State.totalSlots / 12);
    const prevBtn = document.getElementById('c5PagePrev');
    const nextBtn = document.getElementById('c5PageNext');
    const pageInfo = document.getElementById('c5PageInfo');

    if (prevBtn) prevBtn.disabled = c5State.page === 0;
    if (nextBtn) nextBtn.disabled = c5State.page >= totalPages - 1;
    if (pageInfo) pageInfo.textContent = totalPages > 1 ? `${c5State.page + 1} / ${totalPages}` : '';
}

// ===== ACTIVATE MORE BUTTON =====
function renderC5ActivateBtn() {
    const btn = document.getElementById('c5BtnAddMore');
    const resetBtn = document.getElementById('c5BtnReset');
    if (!btn) return;

    const isEmpty = isSectionDataEmpty(c3State.currentSectionId);

    const activated = c5State.activatedCount;
    const filledActivated = c5State.revisions.slice(0, activated).filter(r => r.date !== null).length;
    const allActivatedFilled = filledActivated === activated;

    btn.disabled = isEmpty || !allActivatedFilled;

    if (resetBtn) {
        const anyFilled = c5State.revisions.some(r => r.date !== null);
        resetBtn.disabled = isEmpty || !anyFilled;
    }
}

// ===== STATS =====
function renderC5Stats() {
    const activated = c5State.activatedCount;
    const filled = c5State.revisions.slice(0, activated).filter(r => r.date !== null).length;
    const pct = getProgress();

    const countVal = document.getElementById('c5StatCountVal');
    const progVal = document.getElementById('c5StatProgressVal');
    const lastVal = document.getElementById('c5StatLastVal');

    if (c5State.isCompleted) {
        if (countVal) countVal.textContent = getFilledCount();
        if (progVal) progVal.textContent = 'Proficient';
    } else {
        if (countVal) countVal.textContent = pad2(filled) + '/' + pad2(activated);
        if (progVal) progVal.textContent = getProficiency(pct);
    }

    if (lastVal) {
        const lastDate = getLastStudyDate();
        if (lastDate) {
            const today = getToday();
            const diff = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));
            if (diff === 0) lastVal.textContent = 'Today';
            else if (diff === 1) lastVal.textContent = '1 day ago';
            else lastVal.textContent = diff + ' days ago';
        } else {
            lastVal.textContent = '—';
        }
    }
}

function getLastStudyDate() {
    let latest = null;
    c5State.revisions.forEach(r => {
        if (r.date && r.year) {
            const d = parseDateStr(r.date, r.year);
            if (d && (!latest || d > latest)) latest = d;
        }
    });
    return latest;
}

function pad2(n) { return String(n).padStart(2, '0'); }

// ===== FOOTER =====
function renderC5Footer() {
    const footer = document.getElementById('c5Footer');
    const text = document.getElementById('c5FooterText');
    if (!footer || !text) return;

    const isEmpty = isSectionDataEmpty(c3State.currentSectionId);
    const allFilled = c5State.revisions.slice(0, c5State.activatedCount).every(r => r.date !== null);

    if (isEmpty) {
        footer.classList.remove('completed');
        footer.classList.add('disabled');
        text.textContent = 'Mark as Completed';
        footer.onmouseenter = null;
        footer.onmouseleave = null;
        return;
    }

    if (c5State.isCompleted) {
        footer.classList.add('completed');
        footer.classList.remove('disabled');
        text.textContent = 'Completed';
        if (allFilled) {
            footer.classList.add('disabled');
            footer.onmouseenter = null;
            footer.onmouseleave = null;
        } else {
            footer.onmouseenter = () => { text.textContent = 'Unmark as Completed'; };
            footer.onmouseleave = () => { text.textContent = 'Completed'; };
        }
    } else {
        footer.classList.remove('completed');
        footer.classList.remove('disabled');
        text.textContent = 'Mark as Completed';
        footer.onmouseenter = null;
        footer.onmouseleave = null;
    }
}

// ===== LOAD / SAVE SECTION =====
function loadC5ForSection(id) {
    const isEmpty = isSectionDataEmpty(id);
    if (!c5SectionStore[id]) {
        if (isEmpty) {
            const def = getDefaultC5Data();
            c5State.isCompleted    = def.isCompleted;
            c5State.difficulty     = def.difficulty;
            c5State.priority       = def.priority;
            c5State.revisions      = def.revisions;
            c5State.totalSlots     = def.totalSlots;
            c5State.activatedCount = def.activatedCount;
            c5State.page           = def.page;
            c5State.scheduleType   = def.scheduleType;
            c5State.scheduleN      = def.scheduleN;
            c5State.scheduleActive = def.scheduleActive;
            renderC5();
            return;
        }
        c5SectionStore[id] = getDefaultC5Data();
    }
    const data = c5SectionStore[id];
    c5State.isCompleted   = data.isCompleted;
    c5State.difficulty    = data.difficulty;
    c5State.priority      = data.priority;
    c5State.revisions     = data.revisions;
    c5State.totalSlots    = data.totalSlots;
    c5State.activatedCount = data.activatedCount;
    c5State.page          = data.page;
    c5State.scheduleType  = data.scheduleType  || 'prime';
    c5State.scheduleN     = data.scheduleN     || 4;
    c5State.scheduleActive = data.scheduleActive !== undefined ? data.scheduleActive : true;
    c5State.smSlotCount   = data.smSlotCount   !== undefined ? data.smSlotCount   : 18;
    c5State.smGrace       = data.smGrace       !== undefined ? data.smGrace       : 0;
    c5State.smPenalty     = data.smPenalty     !== undefined ? data.smPenalty     : 1;
    c5State.smMissedMode  = data.smMissedMode  || 'no-hunt';
    c5State.smCustomGaps  = data.smCustomGaps  || [1, 4];

    // Migrate old revisions that lack scheduledWeek
    c5State.revisions = c5State.revisions.map(r => ({
        date: r.date || null, year: r.year || null,
        scheduledWeek: r.scheduledWeek || null, scheduledYear: r.scheduledYear || null
    }));

    document.getElementById('c5DiffLabel').textContent = data.difficulty;
    document.getElementById('c5PrioLabel').textContent = data.priority;
    const diffColors = { Easy:'#22c55e', Moderate:'#f59e0b', Challenging:'#f97316', Hard:'#ef4444' };
    const prioColors = { Low:'#94a3b8', Medium:'#3b82f6', High:'#f97316', Critical:'#ef4444' };
    document.getElementById('c5DiffDot').style.background = diffColors[data.difficulty];
    document.getElementById('c5PrioDot').style.background = prioColors[data.priority];
    renderC5();
}

function saveC5ForSection(id) {
    if (!c5SectionStore[id]) c5SectionStore[id] = getDefaultC5Data();

    const data = c5SectionStore[id];
    data.isCompleted    = c5State.isCompleted;
    data.difficulty     = c5State.difficulty;
    data.priority       = c5State.priority;
    data.revisions      = c5State.revisions;
    data.totalSlots     = c5State.totalSlots;
    data.activatedCount = c5State.activatedCount;
    data.page           = c5State.page;
    data.scheduleType   = c5State.scheduleType;
    data.scheduleN      = c5State.scheduleN;
    data.scheduleActive = c5State.scheduleActive;
    data.smSlotCount    = c5State.smSlotCount;
    data.smGrace        = c5State.smGrace;
    data.smPenalty      = c5State.smPenalty;
    data.smMissedMode   = c5State.smMissedMode;
    data.smCustomGaps   = c5State.smCustomGaps;
    saveC5Store();

    if (typeof renderC3Footer === 'function') {
        const secId = c3State.currentSectionId;
        const section = secId === 'navigation' ? c12State.navigation : c12State.sections.find(s => s.id === secId);
        if (typeof renderC3Footer === 'function') renderC3Footer(secId);
    }

    if (typeof renderSectionList === 'function') renderSectionList();

    try {
        const progress = getOverallProgress();
        const fileId = getFileId();
        window.parent.postMessage({ type: 'progressUpdate', fileId, progress }, '*');
    } catch(e) {}
}

// ===== TOGGLE COMPLETED =====
function toggleC5Completed() {
    const isEmpty = isSectionDataEmpty(c3State.currentSectionId);
    if (isEmpty) return;

    const allFilled = c5State.revisions.slice(0, c5State.activatedCount).every(r => r.date !== null);
    if (allFilled) return;

    if (!c5State.isCompleted) {
        // Marking as completed — add today if not already present
        const today = getToday();
        const alreadyHasToday = c5State.revisions.some(r => {
            if (!r.date || !r.year) return false;
            return isSameDay(parseDateStr(r.date, r.year), today);
        });
        if (!alreadyHasToday) {
            const lastFilledIndex = c5State.revisions.reduce((last, r, i) => r.date !== null ? i : last, -1);
            const nextIndex = lastFilledIndex + 1;
            if (nextIndex < c5State.totalSlots) {
                const d = today;
                const day = String(d.getDate()).padStart(2, '0');
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const year = d.getFullYear();
                const actualWeek = getISOWeek(d);
                const actualYear = getISOWeekYear(d);
                const prevSched = c5State.revisions[nextIndex] || {};
                const scheduledWeek = prevSched.scheduledWeek || null;
                const scheduledYear = prevSched.scheduledYear || null;
                c5State.revisions[nextIndex] = { date: day + '/' + month, year, scheduledWeek, scheduledYear };

                // Update schedule
                c5UpdateScheduleAfterStudy(nextIndex, d);
            }
        }
        c5State.isCompleted = true;
    } else {
        c5State.isCompleted = false;
    }

    saveC5ForSection(c3State.currentSectionId);
    renderC5();
}

// ===== ACTIVATE MORE =====
function c5AddMoreRevisions() {
    const activated = c5State.activatedCount;
    const filledActivated = c5State.revisions.slice(0, activated).filter(r => r.date !== null).length;
    if (filledActivated < activated) return;

    // If we still have locked slots on current page, activate 4 more
    if (activated < c5State.totalSlots) {
        c5State.activatedCount += 4;
    } else {
        // All slots used, add 12 more slots, activate first 4 of them
        const newSlots = Array(12).fill(null).map(() => ({ date: null, year: null }));
        c5State.revisions.push(...newSlots);
        c5State.totalSlots += 12;
        c5State.activatedCount += 4;
        // Go to new page
        c5State.page = Math.floor((c5State.totalSlots - 12) / 12);
    }

    c5State.isCompleted = false;
    saveC5ForSection(c3State.currentSectionId);
    renderC5();
    if (typeof renderC3Footer === 'function') renderC3Footer(c3State.currentSectionId);
}

// ===== RESET =====
function c5ResetProgress() {
    if (!confirm('Reset all revision dates? This cannot be undone.')) return;
    c5State.revisions = Array(12).fill(null).map(() => ({ date: null, year: null, scheduledWeek: null, scheduledYear: null }));
    c5State.totalSlots = 12;
    c5State.activatedCount = 4;
    c5State.isCompleted = false;
    c5State.page = 0;
    saveC5ForSection(c3State.currentSectionId);
    renderC5();
}

// ===== MODE DROPDOWN =====
function toggleC5Dropdown() {
    document.getElementById('c5ModeDropdown').classList.toggle('active');
}

function selectC5Mode(mode) {
    c5State.mode = mode;
    const labels = { section: 'Section Progress', overall: 'Overall Progress' };
    document.getElementById('c5ModeLabel').textContent = labels[mode];
    document.querySelectorAll('#c5ModeDropdown .c5-dropdown-option').forEach(el => {
        el.classList.toggle('selected', el.dataset.mode === mode);
    });
    document.getElementById('c5ModeDropdown').classList.remove('active');
    renderC5();
}

document.addEventListener('click', (e) => {
    const dd = document.getElementById('c5ModeDropdown');
    if (dd && !dd.contains(e.target)) dd.classList.remove('active');
});

// ===== PAGINATION =====
function c5PagePrev() {
    if (c5State.page > 0) { c5State.page--; renderC5Dates(); }
}

function c5PageNext() {
    const totalPages = Math.ceil(c5State.totalSlots / 12);
    if (c5State.page < totalPages - 1) { c5State.page++; renderC5Dates(); }
}

// ===== DATE PICKER =====
function openC5DatePicker(index) {
    const lastFilledIndex = c5State.revisions.reduce((last, r, i) => r.date !== null ? i : last, -1);
    if (c5State.isCompleted && index !== lastFilledIndex) return;
    c5State._editingIndex = index;

    const existing = c5State.revisions[index];
    const today = getToday();

    c5State._calSelectedDate = (existing.date && existing.year)
        ? parseDateStr(existing.date, existing.year)
        : null;

    c5State._calYear = today.getFullYear();
    c5State._calMonth = today.getMonth();

    const title = document.getElementById('c5ModalTitle');
    if (title) title.textContent = 'Set ' + ordinal(index + 1) + ' Revision Date';

    document.getElementById('c5DateModal').classList.add('active');
    renderC5Calendar();
}

function closeC5DatePicker() {
    document.getElementById('c5DateModal').classList.remove('active');
    c5State._editingIndex = null;
    c5State._calSelectedDate = null;
}

function c5CalPrev() {
    c5State._calMonth--;
    if (c5State._calMonth < 0) { c5State._calMonth = 11; c5State._calYear--; }
    renderC5Calendar();
}

function c5CalNext() {
    c5State._calMonth++;
    if (c5State._calMonth > 11) { c5State._calMonth = 0; c5State._calYear++; }
    renderC5Calendar();
}

function renderC5Calendar() {
    const year = c5State._calYear;
    const month = c5State._calMonth;
    const today = getToday();
    const index = c5State._editingIndex;
    const minDate = getMinDate(index);

    const monthNames = ['January','February','March','April','May','June',
                        'July','August','September','October','November','December'];
    const el = document.getElementById('c5CalMonthLabel');
    if (el) el.textContent = monthNames[month] + ' ' + year;

    const grid = document.getElementById('c5CalGrid');
    if (!grid) return;
    grid.innerHTML = '';

    ['Su','Mo','Tu','We','Th','Fr','Sa'].forEach(d => {
        const h = document.createElement('div');
        h.className = 'c5-cal-day-header';
        h.textContent = d;
        grid.appendChild(h);
    });

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < firstDay; i++) {
        const empty = document.createElement('div');
        empty.className = 'c5-cal-day empty';
        grid.appendChild(empty);
    }

    for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month, d);
        date.setHours(0, 0, 0, 0);
        const isFuture = date > today;
        const isBeforeMin = minDate && date < minDate;
        const disabled = isFuture || isBeforeMin;
        const isToday = isSameDay(date, today);
        const isSelected = c5State._calSelectedDate && isSameDay(date, c5State._calSelectedDate);

        const cell = document.createElement('div');
        let cls = 'c5-cal-day';
        if (disabled) cls += ' disabled';
        if (isToday) cls += ' today';
        if (isSelected) cls += ' selected';
        cell.className = cls;
        cell.textContent = d;

        if (!disabled) {
            cell.onclick = () => {
                c5State._calSelectedDate = date;
                renderC5Calendar();
            };
        }
        grid.appendChild(cell);
    }
}

function c5ClearDate() {
    const index = c5State._editingIndex;
    if (index === null) return;
    c5State.revisions[index] = { date: null, year: null, scheduledWeek: c5State.revisions[index].scheduledWeek, scheduledYear: c5State.revisions[index].scheduledYear };
    for (let i = index + 1; i < c5State.revisions.length; i++) {
        c5State.revisions[i] = { date: null, year: null, scheduledWeek: null, scheduledYear: null };
    }
    c5State.isCompleted = false;
    closeC5DatePicker();
    saveC5ForSection(c3State.currentSectionId);
    renderC5();
    if (typeof renderC3 === 'function') renderC3(c3State.currentSectionId);
}

function c5SaveDate() {
    const index = c5State._editingIndex;
    if (index === null) return;
    if (!c5State._calSelectedDate) { alert('Please select a date.'); return; }

    const d = c5State._calSelectedDate;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();

    const actualWeek = getISOWeek(d);
    const actualYear = getISOWeekYear(d);

    // Get scheduled week for this slot (what was planned)
    const prevSched = c5State.revisions[index];
    const scheduledWeek = prevSched.scheduledWeek || null;
    const scheduledYear = prevSched.scheduledYear || null;

    c5State.revisions[index] = { date: day + '/' + month, year, scheduledWeek, scheduledYear };

    // Clear future slots that are now invalid
    for (let i = index + 1; i < c5State.revisions.length; i++) {
        const next = c5State.revisions[i];
        if (next.date) {
            const nextDate = parseDateStr(next.date, next.year);
            if (nextDate && nextDate <= d) {
                c5State.revisions[i] = { date: null, year: null, scheduledWeek: null, scheduledYear: null };
            }
        }
    }

    // Update schedule
    c5UpdateScheduleAfterStudy(index, d);

    closeC5DatePicker();
    const allNowFilled = c5State.revisions.slice(0, c5State.activatedCount).every(r => r.date !== null);
    if (allNowFilled) c5State.isCompleted = true;
    else c5State.isCompleted = false;
    saveC5ForSection(c3State.currentSectionId);
    renderC5();
    if (typeof renderC3Footer === 'function') renderC3Footer(c3State.currentSectionId);
}

// ===== SCHEDULE UI =====
function renderC5Schedule() {
    const typeLabel = document.getElementById('c5SchedTypeLabel');
    const labels = { prime: 'Prime', fibonacci: 'Fibonacci', triangular: 'Triangular', regular: 'Regular', custom: 'Custom' };
    if (typeLabel) typeLabel.textContent = labels[c5State.scheduleType] || c5State.scheduleType;

    // Toggle = Diary visibility switch
    const toggleBtn = document.getElementById('c5ToggleBtn');
    if (toggleBtn) {
        toggleBtn.textContent = c5State.scheduleActive ? 'ON' : 'OFF';
        toggleBtn.classList.toggle('c5-on', c5State.scheduleActive);
        toggleBtn.classList.toggle('c5-off', !c5State.scheduleActive);
        toggleBtn.title = c5State.scheduleActive ? 'Visible in Diary' : 'Hidden in Diary';
    }

    // Dot color for selected series
    const dot = document.getElementById('c5SchedDot');
    const seriesColors = { prime: '#4d9fec', fibonacci: '#4ec994', triangular: '#ddb56a', regular: '#e8834a', custom: '#a78bfa' };
    if (dot) dot.style.background = seriesColors[c5State.scheduleType] || '#4d9fec';

    // Highlight selected option in dropdown
    document.querySelectorAll('#c5SchedMenu .c5-sched-option').forEach(opt => {
        const optType = opt.textContent.trim().toLowerCase();
        opt.classList.toggle('selected', optType === c5State.scheduleType);
    });

    // Show current week badge status
    renderC5BadgeStatus();
}

function renderC5BadgeStatus() {
    const pill = document.getElementById('c5StatusPill');
    if (!pill) return;
    if (typeof smGetCurrentWeekBadge !== 'function') { pill.textContent = '—'; return; }
    const badge = smGetCurrentWeekBadge({
        revisions: c5State.revisions,
        scheduleType: c5State.scheduleType,
        scheduleN: c5State.scheduleN,
        smSlotCount: c5State.smSlotCount,
        smGrace: c5State.smGrace,
        smPenalty: c5State.smPenalty,
        smMissedMode: c5State.smMissedMode,
        smCustomGaps: c5State.smCustomGaps,
    });
    if (badge) {
        pill.textContent = badge.label;
        const typeColorMap = {
            done: '#4ec994', missed: '#f47067', early: '#ddb56a',
            defended: '#e8834a', hunted: '#22d3ee', scheduled: '#4d9fec',
            'in-progress': '#4d9fec', partial: '#ddb56a', grace: '#ddb56a',
            'not-done': '#ddb56a', 'defending-current': '#4d9fec', 'hunting-current': '#22d3ee',
        };
        pill.style.color = typeColorMap[badge.type] || 'var(--text-secondary)';
        pill.style.borderColor = (typeColorMap[badge.type] || 'var(--border-default)') + '44';
        pill.style.background = (typeColorMap[badge.type] || 'var(--bg-secondary)') + '18';
    } else {
        pill.textContent = '—';
        pill.style.color = 'var(--text-muted)';
        pill.style.borderColor = 'var(--border-default)';
        pill.style.background = 'var(--bg-primary)';
    }
}

function openC5SeriesModal() {
    if (typeof openSeriesModal !== 'function') return;
    openSeriesModal({
        mode: 'settings',
        revisions: c5State.revisions,
        scheduleType: c5State.scheduleType,
        scheduleN: c5State.scheduleN,
        smSlotCount: c5State.smSlotCount,
        smGrace: c5State.smGrace,
        smPenalty: c5State.smPenalty,
        smMissedMode: c5State.smMissedMode,
        smCustomGaps: c5State.smCustomGaps,
        smRpw: c5State.smRpw,
        smPerSlotRpw: c5State.smPerSlotRpw,
        onSave: function(result) {
            c5State.scheduleType = result.scheduleType;
            c5State.scheduleN = result.scheduleN;
            c5State.smSlotCount = result.smSlotCount;
            c5State.smGrace = result.smGrace;
            c5State.smPenalty = result.smPenalty;
            c5State.smMissedMode = result.smMissedMode;
            c5State.smCustomGaps = result.smCustomGaps;
            c5State.smRpw = result.smRpw;
            c5State.smPerSlotRpw = result.smPerSlotRpw;
            // Sync revisions from modal back to column5
            const newRevisions = result.revisions;
            for (let i = 0; i < c5State.revisions.length; i++) {
                if (newRevisions[i]) {
                    c5State.revisions[i].date = newRevisions[i].date;
                    c5State.revisions[i].year = newRevisions[i].year;
                }
            }
            // Recalculate scheduled weeks if first revision exists
            if (c5State.revisions[0] && c5State.revisions[0].date) {
                const slot1Date = parseDateStr(c5State.revisions[0].date, c5State.revisions[0].year);
                if (slot1Date) c5RecalcAllScheduledWeeks(slot1Date);
            }
            saveC5ForSection(c3State.currentSectionId);
            renderC5();
        }
    });
}

function toggleC5SchedDropdown() {
    document.getElementById('c5SchedTypeDropdown').classList.toggle('active');
}

function selectC5SchedType(event, type) {
    event.stopPropagation();
    document.getElementById('c5SchedTypeDropdown').classList.remove('active');

    // Custom → open full modal in custom mode
    if (type === 'custom') {
        if (typeof openSeriesModal !== 'function') return;
        openSeriesModal({
            mode: 'custom',
            revisions: c5State.revisions,
            scheduleType: 'custom',
            scheduleN: c5State.scheduleN,
            smSlotCount: c5State.smSlotCount,
            smGrace: c5State.smGrace,
            smPenalty: c5State.smPenalty,
            smMissedMode: c5State.smMissedMode,
            smCustomGaps: c5State.smCustomGaps,
            smRpw: c5State.smRpw,
            smPerSlotRpw: c5State.smPerSlotRpw,
            onSave: function(result) {
                c5State.scheduleType = result.scheduleType;
                c5State.scheduleN = result.scheduleN;
                c5State.smSlotCount = result.smSlotCount;
                c5State.smGrace = result.smGrace;
                c5State.smPenalty = result.smPenalty;
                c5State.smMissedMode = result.smMissedMode;
                c5State.smCustomGaps = result.smCustomGaps;
                c5State.smRpw = result.smRpw;
                c5State.smPerSlotRpw = result.smPerSlotRpw;
                const newRevisions = result.revisions;
                for (let i = 0; i < c5State.revisions.length; i++) {
                    if (newRevisions[i]) { c5State.revisions[i].date = newRevisions[i].date; c5State.revisions[i].year = newRevisions[i].year; }
                }
                if (c5State.revisions[0] && c5State.revisions[0].date) {
                    const slot1Date = parseDateStr(c5State.revisions[0].date, c5State.revisions[0].year);
                    if (slot1Date) c5RecalcAllScheduledWeeks(slot1Date);
                }
                saveC5ForSection(c3State.currentSectionId);
                renderC5();
            }
        });
        return;
    }

    c5State.scheduleType = type;

    // When switching to regular, recalculate all unfilled slots from the last filled slot
    if (type !== 'fibonacci') {
        const n = c5State.scheduleN || 4;
        const lastFilledIndex = c5State.revisions.reduce((last, r, i) => r.date !== null ? i : last, -1);
        if (lastFilledIndex >= 0) {
            const lastFilled = c5State.revisions[lastFilledIndex];
            const baseWeek = lastFilled.scheduledWeek || getISOWeek(parseDateStr(lastFilled.date, lastFilled.year));
            const baseYear = lastFilled.scheduledYear || getISOWeekYear(parseDateStr(lastFilled.date, lastFilled.year));
            for (let i = lastFilledIndex + 1; i < c5State.revisions.length; i++) {
                if (!c5State.revisions[i].date) {
                    const ahead = addWeeks(baseWeek, baseYear, n * (i - lastFilledIndex));
                    c5State.revisions[i].scheduledWeek = ahead.week;
                    c5State.revisions[i].scheduledYear = ahead.year;
                }
            }
        }
    }

    saveC5ForSection(c3State.currentSectionId);
    renderC5Schedule();
}

function toggleC5ScheduleActive() {
    c5State.scheduleActive = !c5State.scheduleActive;
    saveC5ForSection(c3State.currentSectionId);
    renderC5Schedule();
}

function selectC5ViewMode(mode) {
    const slotBtn = document.getElementById('c5SlotBtn');
    const durBtn = document.getElementById('c5DurBtn');
    if (slotBtn) slotBtn.classList.toggle('active', mode === 'slot');
    if (durBtn) durBtn.classList.toggle('active', mode === 'duration');
    c5State.viewMode = mode;
    renderC5Dates();
}

function saveC5ScheduleN() {
    const input = document.getElementById('c5SchedNInput');
    if (!input) return;
    const val = parseInt(input.value);
    if (!isNaN(val) && val >= 1) {
        c5State.scheduleN = val;
        saveC5ForSection(c3State.currentSectionId);
    }
}

// ===== DIFFICULTY =====
function toggleC5Diff() {
    const isEmpty = isSectionDataEmpty(c3State.currentSectionId);
    if (isEmpty) return;
    document.getElementById('c5DiffDropdown').classList.toggle('active');
}

function selectC5Diff(event, value, color) {
    event.stopPropagation();
    c5State.difficulty = value;
    document.getElementById('c5DiffLabel').textContent = value;
    document.getElementById('c5DiffDot').style.background = color;
    document.getElementById('c5DiffDropdown').classList.remove('active');
    saveC5ForSection(c3State.currentSectionId);
}

// ===== PRIORITY =====
function toggleC5Prio() {
    const isEmpty = isSectionDataEmpty(c3State.currentSectionId);
    if (isEmpty) return;
    document.getElementById('c5PrioDropdown').classList.toggle('active');
}

function selectC5Prio(event, value, color) {
    event.stopPropagation();
    c5State.priority = value;
    document.getElementById('c5PrioLabel').textContent = value;
    document.getElementById('c5PrioDot').style.background = color;
    document.getElementById('c5PrioDropdown').classList.remove('active');
    saveC5ForSection(c3State.currentSectionId);
}

function getProficiency(pct) {
    if (pct <= 25) return 'Novice';
    if (pct <= 50) return 'Advanced Beginner';
    if (pct <= 75) return 'Competent';
    return 'Proficient';
}

function getOverallProgressForMain() {
    return getOverallProgress();
}

// Close dropdowns on outside click
document.addEventListener('click', (e) => {
    const diff = document.getElementById('c5DiffDropdown');
    if (diff && !diff.contains(e.target)) diff.classList.remove('active');
    const prio = document.getElementById('c5PrioDropdown');
    if (prio && !prio.contains(e.target)) prio.classList.remove('active');
    const sched = document.getElementById('c5SchedTypeDropdown');
    if (sched && !sched.contains(e.target)) sched.classList.remove('active');
});

// Close modal on overlay click
document.addEventListener('DOMContentLoaded', () => {
    const overlay = document.getElementById('c5DateModal');
    if (overlay) overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeC5DatePicker();
    });
});