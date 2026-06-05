// heatmap.js - Weekly Activity Heatmap

// ===== STATE =====
let hmView = 'calendar';

// ===== EVENT CATEGORIES =====
const HM_CATEGORIES = [
    { id: 'red',    label: 'Holiday',   color: '#f47067', bgDark: '#2e1a1a', bgLight: '#fff5f5', borderLight: '#fca5a5' },
    { id: 'orange', label: 'Exam',      color: '#e8834a', bgDark: '#2e2010', bgLight: '#fff7ed', borderLight: '#fdba74' },
    { id: 'yellow', label: 'Important', color: '#ddb56a', bgDark: '#2e2a10', bgLight: '#fefce8', borderLight: '#fde68a' },
    { id: 'purple', label: 'Reminder',  color: '#a78bfa', bgDark: '#1e1a2e', bgLight: '#f5f3ff', borderLight: '#c4b5fd' },
];

// ===== INIT =====
function initHeatmap() {
    renderHeatmap();
    document.addEventListener('click', hmHandleOutsideClick);
}

// ===== TOGGLE VIEW =====
function hmSetView(view) {
    hmView = view;
    document.querySelectorAll('.hm-toggle-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
    });
    renderHeatmap();
}

// ===== DATE HELPERS =====
function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = (day === 0) ? -6 : 1 - day; // Monday = start
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

function addDays(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
}

function sameDay(a, b) {
    return a.getFullYear() === b.getFullYear() &&
           a.getMonth() === b.getMonth() &&
           a.getDate() === b.getDate();
}

function formatDate(date) {
    return `${date.getDate()}/${date.getMonth() + 1}`;
}

function toDateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

// ===== EVENT STORAGE =====
const HM_EVENTS_KEY = 'hm_events';

function hmGetEvents() {
    try {
        return JSON.parse(localStorage.getItem(HM_EVENTS_KEY)) || {};
    } catch(e) { return {}; }
}

function hmSaveEvent(dateKey, categoryId, text) {
    const events = hmGetEvents();
    if (text.trim() === '') {
        delete events[dateKey];
    } else {
        events[dateKey] = { categoryId, text: text.trim() };
    }
    RAM_SYNC.setItem(HM_EVENTS_KEY, JSON.stringify(events));
}

function hmDeleteEvent(dateKey) {
    const events = hmGetEvents();
    delete events[dateKey];
    RAM_SYNC.setItem(HM_EVENTS_KEY, JSON.stringify(events));
}

// ===== GET COUNT DATA FROM C5 =====
function getCountData() {
    const countMap = {};
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key.startsWith('c5_sectionStore_')) continue;
        try {
            const store = JSON.parse(localStorage.getItem(key));
            if (!store) continue;
            Object.values(store).forEach(sectionData => {
                if (!sectionData || !sectionData.revisions) return;
                sectionData.revisions.forEach(r => {
                    if (!r || !r.date || !r.year) return;
                    const [dd, mm] = r.date.split('/').map(Number);
                    const dateKey = `${r.year}-${String(mm).padStart(2,'0')}-${String(dd).padStart(2,'0')}`;
                    countMap[dateKey] = (countMap[dateKey] || 0) + 1;
                });
            });
        } catch(e) {}
    }
    return countMap;
}

// ===== BUILD COLUMNS =====
function buildWeekColumns() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(2026, 0, 1);
    const weekStart = getWeekStart(startDate);
    const endDate = new Date(today);
    endDate.setMonth(endDate.getMonth() + 18);
    const weeks = [];
    const cur = new Date(weekStart);
    while (cur <= endDate) {
        weeks.push(new Date(cur));
        cur.setDate(cur.getDate() + 7);
    }
    return weeks;
}

// ===== WEEK TYPE =====
function getWeekType(weekStart, currentWeekStart, today) {
    if (weekStart.getTime() === currentWeekStart.getTime()) return 'current';
    if (weekStart < currentWeekStart) return 'past';
    return 'future';
}

// ===== CELL CLASS =====
function getCellClass(cellDate, weekType, today, events, countData) {
    const dateKey = toDateKey(cellDate);
    const event = events[dateKey];

    if (event) {
        const isPast = cellDate < today && !sameDay(cellDate, today);
        return `hm-event-${event.categoryId}${isPast ? '-muted' : ''}`;
    }

    if (weekType === 'future') return 'future';

    // past or current done days — color by count
    if (weekType === 'past' || (weekType === 'current' && cellDate <= today)) {
        const count = countData[dateKey] || 0;
        if (count === 0) return weekType === 'current' ? 'current-missed' : 'past-missed';
        return weekType === 'current' ? 'current-done' : 'past';
    }

    return 'current-upcoming';
}

// ===== CELL VALUE =====
function getCellValue(cellDate, weekType, today, countData) {
    if (hmView === 'calendar') {
        return cellDate.getDate();
    }
    const key = toDateKey(cellDate);
    const count = countData[key];
    return count || '—';
}

// ===== WEEK TOTAL =====
function getWeekTotal(weekStart, weekType, today, countData) {
    if (hmView === 'calendar') {
        const weekNum = getWeekNumber(weekStart);
        return `W${weekNum}`;
    }
    let total = 0;
    for (let i = 0; i < 7; i++) {
        const d = addDays(weekStart, i);
        const key = toDateKey(d);
        total += countData[key] || 0;
    }
    return total || '—';
}

// ===== WEEK NUMBER =====
function getWeekNumber(date) {
    const d = new Date(date.getFullYear(), 0, 1);
    return Math.ceil(((date - d) / 86400000 + d.getDay() + 1) / 7);
}

// ===== MONTH SPANS =====
function buildMonthSpans(weeks) {
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const spans = [];
    let current = null;
    weeks.forEach(ws => {
        const thursday = addDays(ws, 3);
        const label = monthNames[thursday.getMonth()];
        if (!current || current.label !== label) {
            current = { label, count: 1 };
            spans.push(current);
        } else {
            current.count++;
        }
    });
    return spans;
}

// ===== GLOBAL REVISION PROGRESS =====
function getGlobalRevisionProgress() {
    let total = 0, filled = 0;

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key.startsWith('c5_sectionStore_')) continue;

        try {
            const fileId = key.replace('c5_sectionStore_', '');
            const store = JSON.parse(localStorage.getItem(key));
            if (!store) continue;

            // Get active section IDs for this file
            const sectionsRaw = localStorage.getItem(`c12_sections_${fileId}`);
            if (!sectionsRaw) continue;
            const sections = JSON.parse(sectionsRaw);
            const activeIds = new Set([
                'navigation',
                ...sections.filter(s => s.type === 'real').map(s => String(s.id))
            ]);

            Object.entries(store).forEach(([sid, data]) => {
                if (!data) return;
                if (!activeIds.has(String(sid))) return;
                const activated = data.activatedCount || 4;
                const revSlice = data.revisions.slice(0, activated);
                total += activated;
                filled += revSlice.filter(r => r && r.date !== null).length;
            });
        } catch(e) {}
    }

    const pct = total === 0 ? 0 : Math.round((filled / total) * 100);
    return { total, filled, pct };
}

// ===== RENDER =====
// Update progress display
function renderHeatmap() {
    const wrapper = document.getElementById('hmGridWrapper');
    if (!wrapper) return;

    const { total, filled, pct } = getGlobalRevisionProgress();
    const progEl = document.getElementById('hmProgressDisplay');
    const remaining = total - filled;
if (progEl) progEl.innerHTML = `<span class="hm-prog-label">Completed</span><span class="hm-prog-nums">${filled}/${total}</span><span class="hm-prog-pct">${pct}%</span><div class="hm-row2-divider"></div><span class="hm-prog-label">Remaining</span><span class="hm-prog-pct">${remaining}</span>`;

    hmClosePopup();

    const weeks = buildWeekColumns();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentWeekStart = getWeekStart(today);
    const countData = getCountData();
    const events = hmGetEvents();

    const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const monthSpans = buildMonthSpans(weeks);

    // ===== LEFT: fixed label table =====
    let leftHtml = '<table class="hm-label-table">';
    leftHtml += '<thead><tr><th class="hm-year-cell">' + today.getFullYear() + '</th></tr></thead>';
    leftHtml += '<tbody>';
    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
        leftHtml += `<tr><td class="hm-label-cell">${dayLabels[dayIndex]}</td></tr>`;
    }
    leftHtml += `<tr><td class="hm-total-label">Total</td></tr>`;
    leftHtml += '</tbody></table>';

    // ===== RIGHT: scrollable date table =====
    let rightHtml = '<table class="hm-table">';
    rightHtml += '<thead><tr>';
    monthSpans.forEach(span => {
        rightHtml += `<th class="hm-month-cell" colspan="${span.count}">${span.label}</th>`;
    });
    rightHtml += '</tr></thead>';
    rightHtml += '<tbody>';
    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
        rightHtml += '<tr>';
        weeks.forEach(weekStart => {
            const cellDate = addDays(weekStart, dayIndex);
            const weekType = getWeekType(weekStart, currentWeekStart, today);
            const cellClass = getCellClass(cellDate, weekType, today, events, countData);
            const displayVal = getCellValue(cellDate, weekType, today, countData);
            const dateKey = toDateKey(cellDate);
            const event = events[dateKey];
            const tooltip = event ? ` data-tooltip="${event.text}"` : '';
            const isToday = sameDay(cellDate, today);
            rightHtml += `<td class="hm-cell ${cellClass}${isToday ? ' hm-today' : ''}" data-date="${dateKey}" onclick="hmCellClick(event, '${dateKey}')"${tooltip}>${displayVal}</td>`;
        });
        rightHtml += '</tr>';
    }
    rightHtml += '<tr>';
    weeks.forEach(weekStart => {
        const weekType = getWeekType(weekStart, currentWeekStart, today);
        const totalVal = getWeekTotal(weekStart, weekType, today, countData);
        const cls = weekType === 'past' ? 'past' : weekType === 'current' ? 'current' : 'future';
        rightHtml += `<td class="hm-total-cell ${cls}">${totalVal}</td>`;
    });
    rightHtml += '</tr>';
    rightHtml += '</tbody></table>';

    wrapper.innerHTML = `
        <div class="hm-grid-layout">
            <div class="hm-label-panel">${leftHtml}</div>
            <div class="hm-divider-line"></div>
            <div class="hm-scroll-panel" id="hmScrollPanel">${rightHtml}</div>
        </div>
        <div class="hm-tooltip" id="hmTooltip"></div>
    `;

    // Tooltip listeners
    wrapper.querySelectorAll('.hm-cell[data-tooltip]').forEach(cell => {
        cell.addEventListener('mouseenter', hmShowTooltip);
        cell.addEventListener('mouseleave', hmHideTooltip);
    });

    scrollToCurrentWeek(weeks);
}

// ===== SCROLL =====
function scrollToCurrentWeek(weeks) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentWeekStart = getWeekStart(today);
    const currentIndex = weeks.findIndex(w => w.getTime() === currentWeekStart.getTime());
    if (currentIndex === -1) return;
    const panel = document.getElementById('hmScrollPanel');
    if (!panel) return;
    const cellW = 40 + 6;
    const visibleW = panel.offsetWidth;
    const scrollTo = (currentIndex * cellW) - (visibleW / 2) + (cellW / 2);
    panel.scrollLeft = Math.max(0, scrollTo);
}

// ===== TOOLTIP =====
function hmShowTooltip(e) {
    const tooltip = document.getElementById('hmTooltip');
    if (!tooltip) return;
    const text = e.currentTarget.dataset.tooltip;
    if (!text) return;
    tooltip.textContent = text;
    tooltip.classList.add('visible');

    const rect = e.currentTarget.getBoundingClientRect();
    const wrapperRect = document.getElementById('hmGridWrapper').getBoundingClientRect();
    const scrollLeft = document.getElementById('hmGridWrapper').scrollLeft;
    tooltip.style.left = (rect.left - wrapperRect.left + scrollLeft + rect.width / 2) + 'px';
    tooltip.style.top = (rect.top - wrapperRect.top + document.getElementById('hmGridWrapper').scrollTop - 36) + 'px';
}

function hmHideTooltip() {
    const tooltip = document.getElementById('hmTooltip');
    if (tooltip) tooltip.classList.remove('visible');
}

// ===== POPUP =====
let hmActivePopup = null;

function hmCellClick(e, dateKey) {
    e.stopPropagation();
    hmHideTooltip();

    if (hmActivePopup && hmActivePopup.dateKey === dateKey) {
        hmClosePopup();
        return;
    }

    hmClosePopup();

    const events = hmGetEvents();
    const existing = events[dateKey] || null;
    const selectedCat = existing ? existing.categoryId : 'red';
    const existingText = existing ? existing.text : '';

    const popup = document.createElement('div');
    popup.className = 'hm-popup';
    popup.id = 'hmPopup';

    const catsHtml = HM_CATEGORIES.map(cat => `
        <div class="hm-popup-cat ${cat.id === selectedCat ? 'selected' : ''}" data-cat="${cat.id}" onclick="hmSelectCat('${cat.id}')" style="--cat-color: ${cat.color}">
            <span class="hm-popup-dot"></span>
            <span class="hm-popup-cat-label">${cat.label}</span>
        </div>
    `).join('');

    popup.innerHTML = `
        <div class="hm-popup-header">${dateKey}</div>
        <div class="hm-popup-cats">${catsHtml}</div>
        <input class="hm-popup-input" id="hmPopupInput" type="text" placeholder="Add note..." value="${existingText}" maxlength="80" />
        <div class="hm-popup-actions">
            ${existing ? `<button class="hm-popup-del" onclick="hmDeletePopup('${dateKey}')">Delete</button>` : ''}
            <button class="hm-popup-cancel" onclick="hmClosePopup()">Cancel</button>
            <button class="hm-popup-save" onclick="hmSavePopup('${dateKey}')">Save</button>
        </div>
    `;

    document.body.appendChild(popup);
    hmActivePopup = { dateKey, selectedCat };

    // Position next to cell
    const cell = e.currentTarget;
    const rect = cell.getBoundingClientRect();
    const popupW = 220;
    const popupH = 180;

    let left = rect.right + 8;
    let top = rect.top;

    if (left + popupW > window.innerWidth - 8) {
        left = rect.left - popupW - 8;
    }
    if (top + popupH > window.innerHeight - 8) {
        top = window.innerHeight - popupH - 8;
    }

    popup.style.left = left + 'px';
    popup.style.top = top + 'px';

    setTimeout(() => {
        const input = document.getElementById('hmPopupInput');
        if (input) input.focus();
    }, 50);
}

function hmSelectCat(catId) {
    if (!hmActivePopup) return;
    hmActivePopup.selectedCat = catId;
    document.querySelectorAll('.hm-popup-cat').forEach(el => {
        el.classList.toggle('selected', el.dataset.cat === catId);
    });
}

function hmSavePopup(dateKey) {
    const input = document.getElementById('hmPopupInput');
    if (!input) return;
    const text = input.value.trim();
    const catId = hmActivePopup ? hmActivePopup.selectedCat : 'red';
    if (text) {
        hmSaveEvent(dateKey, catId, text);
    }
    hmClosePopup();
    renderHeatmap();
}

function hmDeletePopup(dateKey) {
    hmDeleteEvent(dateKey);
    hmClosePopup();
    renderHeatmap();
}

function hmClosePopup() {
    const popup = document.getElementById('hmPopup');
    if (popup) popup.remove();
    hmActivePopup = null;
}

function hmHandleOutsideClick(e) {
    const popup = document.getElementById('hmPopup');
    if (popup && !popup.contains(e.target)) {
        hmClosePopup();
    }
}