// graphs.js - Revision Graphs

// ===== STATE =====
let grChartType = 'bar'; // bar = histogram internally // bar | line | cumulative | area
let grRangeLabel = 'All Time';
let grCustomFrom = null;
let grCustomTo = null;
let grRangeOpen = false;

// ===== INIT =====
function initGraphs() {
    renderGraph();
}

// ===== DATA =====
function grGetAllData() {
    // Reuse getCountData from heatmap.js — returns { 'YYYY-MM-DD': count }
    return getCountData();
}

function grFilterData(countMap) {
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    let fromDate = null;

    if (grRangeLabel === 'Last 7 Days') {
        fromDate = new Date(today);
        fromDate.setDate(fromDate.getDate() - 6);
    } else if (grRangeLabel === 'Last 15 Days') {
        fromDate = new Date(today);
        fromDate.setDate(fromDate.getDate() - 14);
    } else if (grRangeLabel === 'Last 30 Days') {
        fromDate = new Date(today);
        fromDate.setDate(fromDate.getDate() - 29);
    } else if (grRangeLabel === 'Last 3 Months') {
        fromDate = new Date(today);
        fromDate.setMonth(fromDate.getMonth() - 3);
    } else if (grRangeLabel === 'Last 6 Months') {
        fromDate = new Date(today);
        fromDate.setMonth(fromDate.getMonth() - 6);
    } else if (grRangeLabel === 'Last 1 Year') {
        fromDate = new Date(today);
        fromDate.setFullYear(fromDate.getFullYear() - 1);
    } else if (grRangeLabel === 'Custom' && grCustomFrom && grCustomTo) {
        fromDate = new Date(grCustomFrom);
    }

    const toDate = (grRangeLabel === 'Custom' && grCustomTo) ? new Date(grCustomTo) : today;
    toDate.setHours(23, 59, 59, 999);

    // Get all date keys that have data, sort them
    const allKeys = Object.keys(countMap).sort();
    if (allKeys.length === 0) return [];

    // Determine range
    const startKey = fromDate ? toDateKey(fromDate) : allKeys[0];
    const endKey = toDateKey(toDate);

    // Build a continuous date array from startKey to endKey
    const result = [];
    const cur = new Date(startKey);
    const end = new Date(endKey);

    while (cur <= end) {
        const key = toDateKey(cur);
        result.push({ date: key, count: countMap[key] || 0 });
        cur.setDate(cur.getDate() + 1);
    }

    return result;
}

function grBuildCumulative(data) {
    let running = 0;
    return data.map(d => {
        running += d.count;
        return { date: d.date, count: running };
    });
}

// ===== RENDER =====
function renderGraph() {
    const wrapper = document.getElementById('grChartWrapper');
    if (!wrapper) return;

    const countMap = grGetAllData();
    let data = grFilterData(countMap);

    if (data.length === 0 || data.every(d => d.count === 0)) {
        wrapper.innerHTML = '<div class="gr-empty">No revision data yet. Complete some revisions to see graphs.</div>';
        return;
    }

    // For cumulative, transform data
    const drawData = (grChartType === 'cumulative') ? grBuildCumulative(data) : data;

    // Remove empty state if present
    let canvasContainer = document.getElementById('grCanvasContainer');
    if (!canvasContainer) {
        wrapper.innerHTML = '<div id="grCanvasContainer" class="gr-canvas-container"><canvas id="grCanvas"></canvas></div>';
        canvasContainer = document.getElementById('grCanvasContainer');
    }

    const canvas = document.getElementById('grCanvas');
    const maxCount = Math.max(...drawData.map(d => d.count));

    // Cell width = 40px (same as heatmap), padding
    const cellW = 20;
    const paddingLeft = 52; // for Y axis labels
    const paddingRight = 20;
    const paddingTop = 20;
    const paddingBottom = 48; // for X axis labels

    const totalW = paddingLeft + (drawData.length * cellW) + paddingRight;
    const wrapperH = wrapper.clientHeight || 400;
    const totalH = wrapperH;
    const chartH = totalH - paddingTop - paddingBottom;

    canvas.width = Math.max(totalW, wrapper.clientWidth);
    canvas.height = totalH;
    canvasContainer.style.width = canvas.width + 'px';
    canvasContainer.style.height = totalH + 'px';

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Resolve CSS variables
    const style = getComputedStyle(document.documentElement);
    const colorBg = style.getPropertyValue('--bg-secondary').trim() || '#1a1a2e';
    const colorBorder = style.getPropertyValue('--border-default').trim() || '#2a2a3e';
    const colorMuted = style.getPropertyValue('--text-muted').trim() || '#6b7280';
    const colorSecondary = style.getPropertyValue('--text-secondary').trim() || '#94a3b8';
    const colorAccent = style.getPropertyValue('--accent-blue').trim() || '#4f9cf9';
    const colorPrimary = style.getPropertyValue('--text-primary').trim() || '#e2e8f0';

    // ===== Y AXIS =====
    const yTickCount = 5;
    const yMax = Math.ceil(maxCount * 1.1) || 1; // 10% headroom
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillStyle = colorMuted;
    ctx.textAlign = 'right';

    for (let i = 0; i <= yTickCount; i++) {
        const val = Math.round((yMax / yTickCount) * i);
        const y = paddingTop + chartH - (val / yMax) * chartH;
        ctx.fillText(val, paddingLeft - 8, y + 4);

        // Grid line
        ctx.beginPath();
        ctx.strokeStyle = colorBorder;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 4]);
        ctx.moveTo(paddingLeft, y);
        ctx.lineTo(canvas.width - paddingRight, y);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    // ===== X AXIS LABELS =====
    ctx.textAlign = 'center';
    ctx.fillStyle = colorMuted;
    ctx.font = '10px system-ui, sans-serif';

    // Show label every N bars to avoid clutter
    const labelEvery = Math.max(1, Math.ceil(drawData.length / 30));

    drawData.forEach((d, i) => {
        if (i % labelEvery !== 0) return;
        const x = paddingLeft + i * cellW + cellW / 2;
        const dateObj = new Date(d.date);
        const label = `${dateObj.getDate()}/${dateObj.getMonth() + 1}`;
        ctx.save();
        ctx.translate(x, totalH - paddingBottom + 14);
        ctx.rotate(-Math.PI / 4);
        ctx.fillText(label, 0, 0);
        ctx.restore();
    });

    // ===== DRAW CHART =====
    if (grChartType === 'bar') {
        grDrawBar(ctx, drawData, paddingLeft, paddingTop, cellW, chartH, yMax, colorAccent, colorBorder);
    } else if (grChartType === 'line') {
        grDrawLine(ctx, drawData, paddingLeft, paddingTop, cellW, chartH, yMax, colorAccent, false);
    } else if (grChartType === 'cumulative') {
        grDrawLine(ctx, drawData, paddingLeft, paddingTop, cellW, chartH, yMax, '#22c55e', false);
    } else if (grChartType === 'area') {
        grDrawLine(ctx, drawData, paddingLeft, paddingTop, cellW, chartH, yMax, colorAccent, true);
    }

    // ===== TODAY LINE =====
    const todayKey = toDateKey(new Date());
    const todayIdx = drawData.findIndex(d => d.date === todayKey);
    if (todayIdx >= 0) {
        const x = paddingLeft + todayIdx * cellW + (grChartType === 'bar' ? cellW : cellW / 2);
        ctx.beginPath();
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.moveTo(x, paddingTop);
        ctx.lineTo(x, paddingTop + chartH);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#f59e0b';
        ctx.font = '10px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Today', x, paddingTop - 6);
    }

    // ===== STORE DRAW DATA FOR TOOLTIP =====
    canvas._grDrawData = drawData;
    canvas._grParams = { paddingLeft, paddingTop, cellW, chartH, yMax };
}

// ===== BAR DRAW =====
function grDrawBar(ctx, data, pLeft, pTop, cellW, chartH, yMax, color, borderColor) {
    const barW = cellW;
    data.forEach((d, i) => {
        if (d.count === 0) return;
        const x = pLeft + i * cellW + (cellW - barW) / 2;
        const barH = (d.count / yMax) * chartH;
        const y = pTop + chartH - barH;

        ctx.fillStyle = color;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.rect(x, y, barW, barH);
        ctx.fill();
        ctx.globalAlpha = 1;
    });
}

// ===== LINE / AREA DRAW =====
function grDrawLine(ctx, data, pLeft, pTop, cellW, chartH, yMax, color, fill) {
    const points = data.map((d, i) => ({
        x: pLeft + i * cellW + cellW / 2,
        y: pTop + chartH - (d.count / yMax) * chartH
    }));

    if (fill) {
        ctx.beginPath();
        ctx.moveTo(points[0].x, pTop + chartH);
        points.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.lineTo(points[points.length - 1].x, pTop + chartH);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.18;
        ctx.fill();
        ctx.globalAlpha = 1;
    }

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.stroke();

    // Dots
    points.forEach((p, i) => {
        if (data[i].count === 0) return;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
    });
}

// ===== TOOLTIP =====
function grSetupTooltip() {
    const canvas = document.getElementById('grCanvas');
    if (!canvas) return;
    const tooltip = document.getElementById('grTooltip');

    canvas.addEventListener('mousemove', (e) => {
        const data = canvas._grDrawData;
        const params = canvas._grParams;
        if (!data || !params) return;

        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;

        const { paddingLeft, cellW } = params;
        const idx = Math.floor((mx - paddingLeft) / cellW);

        if (idx < 0 || idx >= data.length) {
            tooltip.classList.remove('visible');
            return;
        }

        const d = data[idx];
        const dateObj = new Date(d.date);
        const label = `${dateObj.getDate()}/${dateObj.getMonth() + 1}/${dateObj.getFullYear()}`;
        tooltip.textContent = `${label}: ${d.count} revision${d.count !== 1 ? 's' : ''}`;
        tooltip.style.left = (e.clientX + 12) + 'px';
        tooltip.style.top = (e.clientY - 28) + 'px';
        tooltip.classList.add('visible');
    });

    canvas.addEventListener('mouseleave', () => {
        tooltip.classList.remove('visible');
    });
}

// ===== CHART TYPE TOGGLE =====
function grSetChart(type) {
    grChartType = type;
    document.querySelectorAll('.gr-toggle-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.chart === type);
    });
    renderGraph();
    setTimeout(grSetupTooltip, 50);
}

// ===== DATE RANGE =====
function grSelectRange(label) {
    if (label === 'Custom') return; // handled by modal
    grRangeLabel = label;
    grCustomFrom = null;
    grCustomTo = null;
    document.querySelectorAll('.gr-filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.range === label);
    });
    renderGraph();
    setTimeout(grSetupTooltip, 50);
}

function grOpenCustomModal() {
    document.getElementById('grCustomModal').classList.add('active');
}

function grCloseCustomModal() {
    document.getElementById('grCustomModal').classList.remove('active');
}

function grApplyCustom() {
    const from = document.getElementById('grCustomFrom').value;
    const to = document.getElementById('grCustomTo').value;
    if (!from || !to) return;
    if (from > to) { alert('From date must be before To date.'); return; }
    grCustomFrom = from;
    grCustomTo = to;
    grRangeLabel = 'Custom';
    document.querySelectorAll('.gr-filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.range === 'Custom');
    });
    grCloseCustomModal();
    renderGraph();
    setTimeout(grSetupTooltip, 50);
}

// Close modal on overlay click
document.addEventListener('click', (e) => {
    const modal = document.getElementById('grCustomModal');
    if (modal && e.target === modal) grCloseCustomModal();
});

// Resize redraw
window.addEventListener('resize', () => {
    if (document.getElementById('graphsLayer')?.classList.contains('active')) {
        renderGraph();
        setTimeout(grSetupTooltip, 50);
    }
});