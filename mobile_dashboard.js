// mobile_dashboard.js — heatmap rendering, graphs rendering, dashboard tabs

// ===== DASHBOARD TABS =====
function bindDashTabs() {
    document.querySelectorAll('.m-dash-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.m-dash-tab').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            mState.activeDash = btn.dataset.dash;
            renderDashboard(mState.activeDash);
        });
    });
}

function renderDashboard(view) {
    const container = document.getElementById('mDashContent');
    container.innerHTML = '';
    if (view === 'heatmap') renderMobileHeatmap(container);
    else renderMobileGraphs(container);
}

// ===== HEATMAP =====
function renderMobileHeatmap(container) {
    const HM_CATEGORIES = [
        { id: 'red',    label: 'Holiday',   color: '#f47067' },
        { id: 'orange', label: 'Exam',      color: '#e8834a' },
        { id: 'yellow', label: 'Important', color: '#ddb56a' },
        { id: 'purple', label: 'Reminder',  color: '#a78bfa' },
    ];

    function hmGetEvents() {
        try { return JSON.parse(localStorage.getItem('hm_events')) || {}; } catch(e) { return {}; }
    }

    function toDateKey(date) {
        return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
    }

    function getStudyData() {
        const fs = getFileSystem();
        if (!fs) return {};
        const files = collectFiles(fs);
        const studyMap = {};
        files.forEach(file => {
            const fd = getFileData(file.id);
            const c5Store = fd?.c5_sectionStore ? JSON.parse(fd.c5_sectionStore) : {};
            Object.values(c5Store).forEach(c5 => {
                if (!c5?.revisions) return;
                c5.revisions.forEach(r => {
                    if (r.date && r.year) {
                        const parts = r.date.split('/');
                        if (parts.length === 2) {
                            const key = `${r.year}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
                            studyMap[key] = (studyMap[key] || 0) + 1;
                        }
                    }
                });
            });
        });
        return studyMap;
    }

    const events = hmGetEvents();
    const studyData = getStudyData();
    const today = new Date();

    const wrapper = document.createElement('div');
    wrapper.className = 'm-heatmap-wrapper';

    const legend = document.createElement('div');
    legend.className = 'm-hm-legend';
    HM_CATEGORIES.forEach(cat => {
        legend.innerHTML += `<span class="m-hm-legend-item"><span class="m-hm-dot" style="background:${cat.color}"></span>${cat.label}</span>`;
    });
    wrapper.appendChild(legend);

    const totalWeeks = 18;
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - (startDate.getDay() === 0 ? 6 : startDate.getDay() - 1));
    startDate.setDate(startDate.getDate() - (totalWeeks - 1) * 7);

    const gridWrap = document.createElement('div');
    gridWrap.className = 'm-hm-scroll';

    const dayLabels = document.createElement('div');
    dayLabels.className = 'm-hm-day-labels';
    ['M','T','W','T','F','S','S'].forEach(d => {
        dayLabels.innerHTML += `<div class="m-hm-day-label">${d}</div>`;
    });

    const grid = document.createElement('div');
    grid.className = 'm-hm-grid';

    let currentMonth = -1;
    for (let w = 0; w < totalWeeks; w++) {
        const col = document.createElement('div');
        col.className = 'm-hm-col';

        const weekStart = new Date(startDate);
        weekStart.setDate(weekStart.getDate() + w * 7);
        const monthLabel = document.createElement('div');
        monthLabel.className = 'm-hm-month-label';
        if (weekStart.getMonth() !== currentMonth) {
            currentMonth = weekStart.getMonth();
            monthLabel.textContent = weekStart.toLocaleString('default', { month: 'short' });
        }
        col.appendChild(monthLabel);

        for (let d = 0; d < 7; d++) {
            const cellDate = new Date(startDate);
            cellDate.setDate(cellDate.getDate() + w * 7 + d);
            const key = toDateKey(cellDate);
            const count = studyData[key] || 0;
            const event = events[key];
            const isToday = key === toDateKey(today);
            const isFuture = cellDate > today;

            const cell = document.createElement('div');
            cell.className = 'm-hm-cell';
            if (isToday) cell.classList.add('today');
            if (isFuture) cell.classList.add('future');

            if (event) {
                const cat = HM_CATEGORIES.find(c => c.id === event.categoryId);
                if (cat) cell.style.background = cat.color + '44';
                cell.style.borderColor = cat?.color || 'transparent';
                cell.title = event.text;
                cell.classList.add('has-event');
            } else if (!isFuture && count > 0) {
                const intensity = Math.min(count / 5, 1);
                const alpha = Math.round(40 + intensity * 180);
                cell.style.background = `rgba(59,130,246,${alpha/255})`;
            }

            cell.innerHTML = `<span class="m-hm-date">${cellDate.getDate()}</span>`;
            col.appendChild(cell);
        }
        grid.appendChild(col);
    }

    gridWrap.appendChild(dayLabels);
    gridWrap.appendChild(grid);
    wrapper.appendChild(gridWrap);

    const totalStudied = Object.keys(studyData).length;
    const thisMonth = Object.entries(studyData).filter(([k]) => k.startsWith(`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`)).reduce((s, [, v]) => s + v, 0);

    const stats = document.createElement('div');
    stats.className = 'm-hm-stats';
    stats.innerHTML = `
        <div class="m-hm-stat"><div class="m-hm-stat-val">${thisMonth}</div><div class="m-hm-stat-label">This Month</div></div>
        <div class="m-hm-stat"><div class="m-hm-stat-val">${studyData[toDateKey(today)] || 0}</div><div class="m-hm-stat-label">Today</div></div>
        <div class="m-hm-stat"><div class="m-hm-stat-val">${totalStudied}</div><div class="m-hm-stat-label">Active Days</div></div>
    `;
    wrapper.appendChild(stats);

    container.appendChild(wrapper);
}

// ===== GRAPHS =====
function renderMobileGraphs(container) {
    const fs = getFileSystem();
    if (!fs) { container.innerHTML = '<div class="m-empty">No data.</div>'; return; }

    const files = collectFiles(fs);
    const dailyMap = {};

    files.forEach(file => {
        const fd = getFileData(file.id);
        const c5Store = fd?.c5_sectionStore ? JSON.parse(fd.c5_sectionStore) : {};
        Object.values(c5Store).forEach(c5 => {
            if (!c5?.revisions) return;
            c5.revisions.forEach(r => {
                if (r.date && r.year) {
                    const parts = r.date.split('/');
                    if (parts.length === 2) {
                        const key = `${r.year}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
                        dailyMap[key] = (dailyMap[key] || 0) + 1;
                    }
                }
            });
        });
    });

    const days = [];
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        days.push({ key, label: d.getDate(), count: dailyMap[key] || 0 });
    }

    const maxCount = Math.max(...days.map(d => d.count), 1);

    const wrap = document.createElement('div');
    wrap.className = 'm-graph-wrap';

    const title = document.createElement('div');
    title.className = 'm-graph-title';
    title.textContent = 'Study Activity — Last 30 Days';
    wrap.appendChild(title);

    const chart = document.createElement('div');
    chart.className = 'm-bar-chart';

    days.forEach(day => {
        const barWrap = document.createElement('div');
        barWrap.className = 'm-bar-wrap';
        const h = day.count > 0 ? Math.max(4, Math.round((day.count / maxCount) * 80)) : 2;
        barWrap.innerHTML = `
            <div class="m-bar" style="height:${h}px${day.count > 0 ? '' : ';background:var(--border)'}"></div>
            <div class="m-bar-label">${day.label}</div>
        `;
        chart.appendChild(barWrap);
    });

    wrap.appendChild(chart);

    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - (weekStart.getDay() === 0 ? 6 : weekStart.getDay() - 1));
    const thisWeek = days.filter(d => new Date(d.key) >= weekStart).reduce((s, d) => s + d.count, 0);
    const thisMonth = days.reduce((s, d) => s + d.count, 0);

    const statsRow = document.createElement('div');
    statsRow.className = 'm-hm-stats';
    statsRow.innerHTML = `
        <div class="m-hm-stat"><div class="m-hm-stat-val">${studyStreak(dailyMap, today)}</div><div class="m-hm-stat-label">Day Streak</div></div>
        <div class="m-hm-stat"><div class="m-hm-stat-val">${thisWeek}</div><div class="m-hm-stat-label">This Week</div></div>
        <div class="m-hm-stat"><div class="m-hm-stat-val">${thisMonth}</div><div class="m-hm-stat-label">30 Days</div></div>
    `;
    wrap.appendChild(statsRow);
    container.appendChild(wrap);
}

function studyStreak(dailyMap, today) {
    let streak = 0;
    const d = new Date(today);
    while (true) {
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        if (dailyMap[key] > 0) { streak++; d.setDate(d.getDate() - 1); }
        else break;
    }
    return streak;
}
