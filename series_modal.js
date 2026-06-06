// series_modal.js — Single source of truth for revision scheduling logic
// Used by: column5.js (modal UI) and diary.js (TBC computation)

(function () {
    'use strict';

    // ===== SERIES DEFINITIONS =====
    const SERIES = [
        { key: 'prime',      name: 'Prime',      color: '#4d9fec', defaultSlots: 18, maxSlots: 47, how: 'Mixes short and long gaps unpredictably, creating an irregular but intense revision rhythm.', good: 'Technical subjects, coding, problem-solving, memory-intensive topics.', gaps: [] },
        { key: 'fibonacci',  name: 'Fibonacci',  color: '#4ec994', defaultSlots: 9,  maxSlots: 12, how: 'Gaps grow gradually following natural memory decay — each revision lands just before forgetting sets in.', good: 'Concept-heavy subjects like history, economics, law, polity.', gaps: [] },
        { key: 'triangular', name: 'Triangular', color: '#ddb56a', defaultSlots: 11, maxSlots: 20, how: 'Gaps grow steadily and moderately — more frequent than Fibonacci in later slots.', good: 'Subjects you grasp quickly but need steady long-term reinforcement.', gaps: [] },
        { key: 'regular',    name: 'Regular',    color: '#e8834a', defaultSlots: 12, how: 'Fixed equal intervals, completely predictable.', good: 'Simple consistent revision rhythm, easy planning.', gaps: [] },
        { key: 'custom',     name: 'Custom',     color: '#a78bfa', defaultSlots: 0,  how: 'You choose exactly which weeks to revise.', good: 'Experienced learners who know their own retention patterns.', gaps: [] }
    ];
    const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const MONTHS_FULL  = ['January','February','March','April','May','June','July','August','September','October','November','December'];

    function isPrime(n) {
        if (n < 2) return false; if (n === 2) return true; if (n % 2 === 0) return false;
        for (let i = 3; i <= Math.sqrt(n); i += 2) if (n % i === 0) return false;
        return true;
    }
    function generateGaps(key, maxWeeks) {
        const base = [1, 2, 3]; const extended = [];
        if (key === 'fibonacci') { let a = 3, b = 5; while (b <= maxWeeks) { extended.push(b); [a, b] = [b, a + b]; } }
        else if (key === 'prime') { for (let n = 5; n <= maxWeeks; n++) { if (isPrime(n)) extended.push(n); } }
        else if (key === 'triangular') { for (let n = 3; n * (n + 1) / 2 <= maxWeeks; n++) { const t = n * (n + 1) / 2; if (t > 3) extended.push(t); } }
        return [...base, ...extended];
    }
    const MAX_WEEKS = 240;
    SERIES.forEach(s => {
        if (['prime','fibonacci','triangular'].includes(s.key)) { s.gaps = generateGaps(s.key, MAX_WEEKS); s.maxSlots = s.gaps.length; }
    });

    // ===== DATE HELPERS =====
    function getISOWeek(date) {
        const d = new Date(date); d.setHours(0,0,0,0);
        d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
        const week1 = new Date(d.getFullYear(), 0, 4);
        return 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
    }
    function getISOWeekYear(date) {
        const d = new Date(date); d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7); return d.getFullYear();
    }
    function getMonthWeeks(year, month) {
        const weeks = []; const firstDay = new Date(year, month, 1);
        let day = firstDay.getDay(); let mondayOffset = (day === 0) ? -6 : 1 - day;
        let monday = new Date(year, month, 1 + mondayOffset); let w = 1;
        while (true) {
            const thu = new Date(monday); thu.setDate(monday.getDate() + 3);
            if (thu.getFullYear() > year || (thu.getFullYear() === year && thu.getMonth() > month)) break;
            if (thu.getMonth() === month && thu.getFullYear() === year) weeks.push({ weekNum: w, monday: new Date(monday) });
            monday.setDate(monday.getDate() + 7); w++; if (w > 6) break;
        }
        return weeks;
    }
    function getMondayOfWeek(date) {
        const d = new Date(date); d.setHours(0,0,0,0);
        const day = d.getDay(); const diff = (day === 0) ? -6 : 1 - day;
        d.setDate(d.getDate() + diff); return d;
    }
    function addWeeksToDate(date, n) { const d = new Date(date); d.setDate(d.getDate() + n * 7); return d; }
    function weekKeyFromDate(date) { return `${getISOWeekYear(date)}-W${getISOWeek(date)}`; }
    function getWkRevCountsKey(mondayDate) {
        const isoW = getISOWeek(mondayDate), isoY = getISOWeekYear(mondayDate);
        for (let offset = 0; offset <= 1; offset++) {
            let y = mondayDate.getFullYear(), m = mondayDate.getMonth() + offset;
            if (m > 11) { m = 0; y++; }
            const weeks = getMonthWeeks(y, m);
            for (let i = 0; i < weeks.length; i++) {
                if (getISOWeek(weeks[i].monday) === isoW && getISOWeekYear(weeks[i].monday) === isoY) return `${y}-${m}-${i}`;
            }
        }
        return null;
    }

    // ===== STATE =====
    const _today = new Date(); _today.setHours(0,0,0,0);
    const CURRENT_YEAR = _today.getFullYear();
    const CURRENT_MONTH = _today.getMonth();

    function getCurrentWeekIdx() {
        const weeks = getMonthWeeks(CURRENT_YEAR, CURRENT_MONTH);
        const curIso = getISOWeek(_today), curYear = getISOWeekYear(_today);
        for (let i = 0; i < weeks.length; i++) {
            if (getISOWeek(weeks[i].monday) === curIso && getISOWeekYear(weeks[i].monday) === curYear) return i;
        }
        return 0;
    }
    const CURRENT_WEEK_IDX = getCurrentWeekIdx();

    let activeSeries = 'prime';
    const wkRevCounts = { prime:{}, fibonacci:{}, triangular:{}, regular:{}, custom:{} };
    const confirmedRevCounts = { prime:{}, fibonacci:{}, triangular:{}, regular:{}, custom:{} };
    const seriesRPW = { prime:1, fibonacci:1, triangular:1, regular:1, custom:1 };
    const confirmedRPW = { prime:1, fibonacci:1, triangular:1, regular:1, custom:1 };
    const perSlotRPW = { prime:{1:2,2:2,3:2}, fibonacci:{1:2,2:2,3:2}, triangular:{1:2,2:2,3:2}, regular:{}, custom:{} };
    const confirmedPerSlotRPW = { prime:{}, fibonacci:{}, triangular:{}, regular:{}, custom:{} };
    let slotCount = 18;
    let regularInterval = 4;
    let missedMode = 'no-hunt';
    const seriesSelected = { prime: null, fibonacci: null, triangular: null, regular: null, custom: new Set() };
    let customGaps = [1, 4];
    let tempCustomGaps = [1, 4];
    let startWeek = { year: CURRENT_YEAR, month: CURRENT_MONTH, weekIdx: CURRENT_WEEK_IDX };
    let customEndWeek = offsetWeeks(4);
    let wkPickerMode = 'start';
    let wkPickerYear = CURRENT_YEAR;
    let wkPickerMonth = CURRENT_MONTH;
    let wkPickerSelected = null;
    let wmapView = 'day';
    let _slotBadges = {};
    let _weekSlotMap = {};
    let _lastSlotMonday = null;
    let _onSaveCallback = null;

    const revState = {
        revisions: Array(40).fill(null).map(() => ({ date: null, year: null })),
        totalSlots: 40, activatedCount: 40,
        _editingIndex: null, _calYear: null, _calMonth: null, _calSelectedDate: null,
    };

    // ===== HELPERS =====
    function offsetWeeks(n) {
        let anchorDate = getStartWeekMonday();
        let y = anchorDate.getFullYear(), m = anchorDate.getMonth();
        const anchorWeeks = getMonthWeeks(y, m);
        let wIdx = 0;
        for (let i = 0; i < anchorWeeks.length; i++) {
            if (getISOWeek(anchorWeeks[i].monday) === getISOWeek(anchorDate) && getISOWeekYear(anchorWeeks[i].monday) === getISOWeekYear(anchorDate)) { wIdx = i; break; }
        }
        let remaining = n - 1;
        while (remaining > 0) {
            const weeksInM = getMonthWeeks(y, m).length; const weeksLeft = weeksInM - wIdx - 1;
            if (remaining <= weeksLeft) { wIdx += remaining; remaining = 0; }
            else { remaining -= (weeksLeft + 1); wIdx = 0; m++; if (m > 11) { m = 0; y++; } }
        }
        return { year: y, month: m, weekIdx: wIdx };
    }

    function getSeriesGaps() {
        const s = SERIES.find(x => x.key === activeSeries);
        if (activeSeries === 'custom') return customGaps.slice(0, slotCount);
        if (activeSeries === 'regular') { const gaps = []; let w = 1; for (let i = 0; i < slotCount; i++) { gaps.push(w); w += regularInterval; } return gaps; }
        return s.gaps.slice(0, slotCount);
    }

    function getLastSlotLoc() {
        if (activeSeries === 'custom') return customEndWeek;
        const gaps = getSeriesGaps(); if (!gaps.length) return null;
        const lastMonday = _lastSlotMonday || addWeeksToDate(getStartWeekMonday(), gaps[gaps.length - 1] - 1);
        for (let offset = 0; offset <= 1; offset++) {
            let y = lastMonday.getFullYear(), m = lastMonday.getMonth() + offset;
            if (m > 11) { m = 0; y++; }
            const weeks = getMonthWeeks(y, m);
            const isoW = getISOWeek(lastMonday), isoY = getISOWeekYear(lastMonday);
            for (let wi = 0; wi < weeks.length; wi++) {
                if (getISOWeek(weeks[wi].monday) === isoW && getISOWeekYear(weeks[wi].monday) === isoY) return { year: y, month: m, weekIdx: wi };
            }
        }
        return null;
    }
    function getSlotEndMonthYear() { const loc = getLastSlotLoc(); if (!loc) return { year: CURRENT_YEAR, month: CURRENT_MONTH }; return { year: loc.year, month: loc.month }; }
    function isDurationExceeded(year, month) {
        if (activeSeries === 'custom') return year > customEndWeek.year || (year === customEndWeek.year && month > customEndWeek.month);
        const end = getSlotEndMonthYear();
        return year > end.year || (year === end.year && month > end.month);
    }

    function getStartWeekMonday() {
        const weeks = getMonthWeeks(startWeek.year, startWeek.month);
        if (weeks[startWeek.weekIdx]) return new Date(weeks[startWeek.weekIdx].monday);
        return getMondayOfWeek(_today);
    }
    function formatWeekLabel(sw) {
        const weeks = getMonthWeeks(sw.year, sw.month);
        if (!weeks[sw.weekIdx]) return '—';
        return `W${sw.weekIdx + 1} · ${MONTHS_SHORT[sw.month]} · ${sw.year}`;
    }
    function formatDateShort(date) { return `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}`; }

    function getSeriesGapValues() {
        if (activeSeries === 'custom') return customGaps.slice(0, slotCount);
        if (activeSeries === 'regular') return getSeriesGaps();
        const s = SERIES.find(x => x.key === activeSeries);
        if (!s || !s.gaps || s.gaps.length === 0) return [1,2,3];
        return s.gaps.slice(0, slotCount);
    }

    function getRevDates() {
        return revState.revisions.filter(r => r.date && r.year)
            .map(r => { const [d,m] = r.date.split('/').map(Number); const dt = new Date(r.year, m-1, d); dt.setHours(0,0,0,0); return dt; })
            .sort((a,b) => a-b);
    }

    function getFinalSlotRPW(slotIndex) {
        const ps = perSlotRPW[activeSeries];
        if (ps && ps[slotIndex] !== undefined) return ps[slotIndex];
        return seriesRPW[activeSeries] || 1;
    }

    function buildDefaultRevCounts() {
        const counts = {}; const gaps = getSeriesGapValues(); let anchorMonday = getStartWeekMonday();
        gaps.forEach((g, i) => {
            const slotMonday = i === 0 ? new Date(anchorMonday) : addWeeksToDate(anchorMonday, gaps[i] - gaps[0]);
            const key = getWkRevCountsKey(slotMonday);
            if (key) counts[key] = getFinalSlotRPW(i + 1);
        });
        return counts;
    }

    function getWmapStartDate() {
        const configStart = getStartWeekMonday(); const revDates = getRevDates();
        if (revDates.length === 0) return configStart;
        const earliestMonday = getMondayOfWeek(revDates[0]);
        return earliestMonday < configStart ? earliestMonday : configStart;
    }

    // ===== SLOT BADGE ENGINE =====
    function computeSlotBadges(penaltyArg, graceArg) {
        const badges = {}; const revDates = getRevDates();
        const gaps = getSeriesGapValues();
        const penalty = penaltyArg !== undefined ? penaltyArg : parseInt(document.getElementById('smPenaltyVal')?.textContent || '1');
        const grace   = graceArg   !== undefined ? graceArg   : parseInt(document.getElementById('smGraceVal')?.textContent   || '0');
        const todayMonday = getMondayOfWeek(_today); const todayKey = weekKeyFromDate(_today);
        const revPerWeek = {};
        revDates.forEach(d => { const k = weekKeyFromDate(d); revPerWeek[k] = (revPerWeek[k] || 0) + 1; });
        const startMonday = getStartWeekMonday();
        let currentSlot = 1, slotAnchorMonday = new Date(startMonday), i = 0;
        let defendingSlot = null, defendingWindowStart = null, defendingWindowEnd = null;
        let huntingSlot = null, huntWindowStart = null, huntWindowEnd = null;
        const maxIterations = 300; let iter = 0;

        while (iter++ < maxIterations) {
            if (i >= gaps.length) break;

            // DEFENDING MODE
            if (defendingSlot !== null) {
                const isSlot1Defending = (defendingSlot === 1 && defendingWindowEnd === null);
                if (isSlot1Defending) {
                    let w = new Date(defendingWindowStart); let defended = false; let defendedMonday = null; let cumDef1 = 0;
                    while (w <= todayMonday) {
                        const wk = weekKeyFromDate(w); const wkCount = revPerWeek[wk] || 0; cumDef1 += wkCount;
                        if (cumDef1 >= getFinalSlotRPW(1)) {
                            let w2 = new Date(defendingWindowStart); let cumPrev = 0;
                            while (w2 < w) { const wk2 = weekKeyFromDate(w2); const c2 = revPerWeek[wk2] || 0; cumPrev += c2; if (!badges[wk2]) badges[wk2] = cumPrev > 0 ? { type: 'in-progress', label: 'Defending Slot 1 🔄' } : { type: 'defending-current', label: 'Defending Slot 1 🛡️' }; w2.setDate(w2.getDate() + 7); }
                            badges[wk] = { type: 'defended', label: 'Slot 1 Defended ✅' }; defended = true; defendedMonday = new Date(w); break;
                        } else { if (!badges[wk]) badges[wk] = cumDef1 > 0 ? { type: 'in-progress', label: 'Defending Slot 1 🔄' } : { type: 'defending-current', label: 'Defending Slot 1 🛡️' }; }
                        w.setDate(w.getDate() + 7);
                    }
                    if (defended) { const gapDiff = gaps[1] - gaps[0]; slotAnchorMonday = addWeeksToDate(defendedMonday, gapDiff); currentSlot = 2; i = 1; defendingSlot = null; defendingWindowStart = null; defendingWindowEnd = null; continue; } else break;
                }
                let w = new Date(defendingWindowStart); let defended = false; let defendedMonday = null; let cumDef = 0;
                while (w <= defendingWindowEnd) {
                    const wk = weekKeyFromDate(w); const wkCount = revPerWeek[wk] || 0; const wkIsPast = w < todayMonday; const wkIsCurrent = wk === todayKey; const isLastDefWeek = w.getTime() === defendingWindowEnd.getTime(); cumDef += wkCount;
                    if (cumDef >= getFinalSlotRPW(defendingSlot)) {
                        let w2 = new Date(defendingWindowStart); let cumPrev = 0;
                        while (w2 < w) { const wk2 = weekKeyFromDate(w2); const c2 = revPerWeek[wk2] || 0; cumPrev += c2; if (!badges[wk2]) badges[wk2] = cumPrev > 0 ? { type: 'in-progress', label: `Defending Slot ${defendingSlot} 🔄` } : { type: 'defending-current', label: `Defending Slot ${defendingSlot} 🛡️` }; w2.setDate(w2.getDate() + 7); }
                        badges[wk] = { type: 'defended', label: `Slot ${defendingSlot} Defended ✅` }; defended = true; defendedMonday = new Date(w); break;
                    } else {
                        if (!badges[wk]) {
                            if (wkIsCurrent) badges[wk] = cumDef > 0 ? { type: 'in-progress', label: `Defending Slot ${defendingSlot} 🔄` } : { type: 'defending-current', label: `Defending Slot ${defendingSlot} 🛡️` };
                            else if (wkIsPast) { if (isLastDefWeek) badges[wk] = cumDef > 0 ? { type: 'partial', label: `Slot ${defendingSlot} — Partial` } : { type: 'missed', label: `Slot ${defendingSlot} — Missed ❌` }; else badges[wk] = cumDef > 0 ? { type: 'in-progress', label: `Defending Slot ${defendingSlot} 🔄` } : { type: 'defending-current', label: `Defending Slot ${defendingSlot} 🛡️` }; }
                        }
                    }
                    w.setDate(w.getDate() + 7);
                }
                if (defended) { const gapDiff = i > 0 ? gaps[i] - gaps[i-1] : gaps[i]; slotAnchorMonday = addWeeksToDate(defendedMonday, gapDiff); defendingSlot = null; defendingWindowStart = null; defendingWindowEnd = null; continue; }
                if (todayMonday <= defendingWindowEnd) break;
                const winEndKey = weekKeyFromDate(defendingWindowEnd);
                if (badges[winEndKey] && (badges[winEndKey].type === 'defending-current' || badges[winEndKey].type === 'not-done')) badges[winEndKey] = { type: 'missed', label: `Slot ${defendingSlot} — Missed ❌` };
                const newDefSlot = Math.max(0, defendingSlot - penalty);
                if (newDefSlot === 0) { const winEnd = defendingWindowEnd; const nextRev = revDates.find(d => d > winEnd); if (!nextRev) break; slotAnchorMonday = getMondayOfWeek(nextRev); currentSlot = 1; i = 0; defendingSlot = null; defendingWindowStart = null; defendingWindowEnd = null; continue; }
                const newGapIdx = newDefSlot - 1; const newWindowSize = newGapIdx > 0 ? gaps[newGapIdx] - gaps[newGapIdx-1] : gaps[newGapIdx];
                defendingSlot = newDefSlot; defendingWindowStart = addWeeksToDate(defendingWindowEnd, 1); defendingWindowEnd = newDefSlot === 1 ? null : addWeeksToDate(defendingWindowStart, newWindowSize - 1); i = newGapIdx + 1; continue;
            }

            // HUNTING MODE
            if (huntingSlot !== null) {
                const isInfiniteHunt = (huntWindowEnd === null); let w = new Date(huntWindowStart); const loopEnd = isInfiniteHunt ? todayMonday : huntWindowEnd;
                let hunted = false; let huntedMonday = null; let cumHunt = 0;
                while (w <= loopEnd) {
                    const wk = weekKeyFromDate(w); const wkCount = revPerWeek[wk] || 0; const wkIsPast = w < todayMonday; const wkIsCurrent = wk === todayKey; const isLastHuntWeek = !isInfiniteHunt && (w.getTime() === huntWindowEnd.getTime()); cumHunt += wkCount;
                    if (cumHunt >= getFinalSlotRPW(huntingSlot)) {
                        let w2 = new Date(huntWindowStart); let cumPrev = 0;
                        while (w2 < w) { const wk2 = weekKeyFromDate(w2); const c2 = revPerWeek[wk2] || 0; cumPrev += c2; if (!badges[wk2]) badges[wk2] = cumPrev > 0 ? { type: 'in-progress', label: `Hunting Slot ${huntingSlot} 🔄` } : { type: 'hunting-current', label: `Hunting Slot ${huntingSlot} 🎯` }; w2.setDate(w2.getDate() + 7); }
                        badges[wk] = { type: 'hunted', label: `Slot ${huntingSlot} Hunted ✅` }; hunted = true; huntedMonday = new Date(w); break;
                    } else { if (!badges[wk]) { if (wkIsCurrent) badges[wk] = cumHunt > 0 ? { type: 'in-progress', label: `Hunting Slot ${huntingSlot} 🔄` } : { type: 'hunting-current', label: `Hunting Slot ${huntingSlot} 🎯` }; else if (wkIsPast) { if (isLastHuntWeek) badges[wk] = cumHunt > 0 ? { type: 'partial', label: `Slot ${huntingSlot} — Partial` } : { type: 'missed', label: `Slot ${huntingSlot} — Missed ❌` }; else badges[wk] = cumHunt > 0 ? { type: 'in-progress', label: `Hunting Slot ${huntingSlot} 🔄` } : { type: 'hunting-current', label: `Hunting Slot ${huntingSlot} 🎯` }; } } }
                    w.setDate(w.getDate() + 7);
                }
                if (hunted) { const gapDiff = i > 0 ? gaps[i] - gaps[i-1] : gaps[i]; slotAnchorMonday = addWeeksToDate(huntedMonday, gapDiff); huntingSlot = null; huntWindowStart = null; huntWindowEnd = null; continue; }
                if (isInfiniteHunt) break;
                if (todayMonday <= huntWindowEnd) break;
                const huntEndKey = weekKeyFromDate(huntWindowEnd);
                if (badges[huntEndKey] && (badges[huntEndKey].type === 'hunting-current' || badges[huntEndKey].type === 'not-done')) badges[huntEndKey] = { type: 'missed', label: `Slot ${huntingSlot} — Missed ❌` };
                const gapDiffH = i > 0 ? gaps[i] - gaps[i-1] : gaps[i]; slotAnchorMonday = addWeeksToDate(slotAnchorMonday, gapDiffH); huntingSlot = null; huntWindowStart = null; huntWindowEnd = null; continue;
            }

            // NORMAL MODE
            const slotWeekKey = weekKeyFromDate(slotAnchorMonday); const isPastOrCurrent = slotAnchorMonday <= todayMonday;
            if (!isPastOrCurrent) break;
            const count = revPerWeek[slotWeekKey] || 0; const slotRPW = getFinalSlotRPW(currentSlot); const isCurrentWeek = slotWeekKey === todayKey;
            if (count >= slotRPW) {
                badges[slotWeekKey] = { type: 'done', label: `Slot ${currentSlot} — Done ✅` }; currentSlot++; i++;
                if (i >= gaps.length) break; const gapDiff = gaps[i] - gaps[i-1]; slotAnchorMonday = addWeeksToDate(slotAnchorMonday, gapDiff);
            } else if (isCurrentWeek) {
                badges[slotWeekKey] = count > 0 ? { type: 'in-progress', label: `Slot ${currentSlot} — In Progress 🔄` } : { type: 'scheduled', label: `Slot ${currentSlot} — Scheduled 📅` }; break;
            } else {
                if (grace === 0) {
                    badges[slotWeekKey] = count > 0 ? { type: 'partial', label: `Slot ${currentSlot} — Partial` } : { type: 'missed', label: `Slot ${currentSlot} — Missed ❌` };
                    if (penalty > 0) {
                        const droppedSlot = Math.max(0, currentSlot - penalty);
                        if (droppedSlot === 0 && currentSlot > 1) { const nextRev = revDates.find(d => getMondayOfWeek(d) > slotAnchorMonday); if (!nextRev) break; slotAnchorMonday = getMondayOfWeek(nextRev); currentSlot = 1; i = 0; continue; }
                        const actualDropped = droppedSlot === 0 ? 1 : droppedSlot; defendingSlot = actualDropped; const defGapIdx = actualDropped - 1; const windowSize = defGapIdx > 0 ? gaps[defGapIdx] - gaps[defGapIdx-1] : gaps[defGapIdx]; defendingWindowStart = addWeeksToDate(slotAnchorMonday, 1); defendingWindowEnd = actualDropped === 1 ? null : addWeeksToDate(defendingWindowStart, windowSize - 1); i = defGapIdx + 1; continue;
                    }
                    if (missedMode !== 'no-hunt') { huntingSlot = currentSlot; huntWindowStart = addWeeksToDate(slotAnchorMonday, 1); huntWindowEnd = (missedMode === 'next-slot' && i + 1 < gaps.length) ? addWeeksToDate(slotAnchorMonday, gaps[i + 1] - gaps[i] - 1) : null; i++; currentSlot++; continue; }
                    i++; currentSlot++; if (i >= gaps.length) break; slotAnchorMonday = addWeeksToDate(slotAnchorMonday, gaps[i] - gaps[i-1]); continue;
                }
                // Grace > 0
                badges[slotWeekKey] = count > 0 ? { type: 'in-progress', label: `Slot ${currentSlot} — In Progress 🔄` } : { type: 'not-done', label: `Slot ${currentSlot} — Not Done ⚠️` };
                let cumulative = count; let graceDone = false; let graceDoneMonday = null; let lastGraceKey = null; let lastGraceMonday = null; let hitCurrentWeek = false;
                for (let gw = 1; gw <= grace; gw++) {
                    const gwMonday = addWeeksToDate(slotAnchorMonday, gw); const gwKey = weekKeyFromDate(gwMonday); const gwIsCurrent = gwKey === todayKey; const gwIsPast = gwMonday < todayMonday;
                    if (gwIsCurrent) {
                        hitCurrentWeek = true; const thisWeekCount = revPerWeek[gwKey] || 0; cumulative += thisWeekCount;
                        if (cumulative >= slotRPW) { badges[gwKey] = { type: 'done', label: `Slot ${currentSlot} — Done ✅` }; graceDone = true; graceDoneMonday = new Date(gwMonday); }
                        else if (cumulative > 0) badges[gwKey] = { type: 'in-progress', label: `Slot ${currentSlot} — In Progress 🔄` };
                        else { const remaining = grace - gw + 1; badges[gwKey] = { type: 'grace', label: `Slot ${currentSlot} Grace ${remaining} ⌛` }; }
                        break;
                    }
                    if (gwIsPast) {
                        cumulative += revPerWeek[gwKey] || 0; lastGraceKey = gwKey; lastGraceMonday = gwMonday;
                        if (cumulative >= slotRPW) { badges[gwKey] = { type: 'done', label: `Slot ${currentSlot} — Done ✅` }; graceDone = true; graceDoneMonday = new Date(gwMonday); break; }
                        else if (cumulative > 0) badges[gwKey] = { type: 'in-progress', label: `Slot ${currentSlot} — In Progress 🔄` };
                        else { const remaining = grace - gw + 1; badges[gwKey] = { type: 'grace', label: `Slot ${currentSlot} Grace ${remaining} ⌛` }; }
                    } else break;
                }
                if (graceDone) { currentSlot++; i++; if (i >= gaps.length) break; const gapDiff = gaps[i] - gaps[i-1]; slotAnchorMonday = addWeeksToDate(graceDoneMonday, gapDiff); }
                else if (hitCurrentWeek) break;
                else {
                    const finalMonday = lastGraceMonday || slotAnchorMonday; const finalKey = lastGraceKey || slotWeekKey;
                    if (cumulative > 0) badges[finalKey] = { type: 'partial', label: `Slot ${currentSlot} — Partial` };
                    else badges[finalKey] = { type: 'missed', label: `Slot ${currentSlot} — Missed ❌` };
                    if (penalty > 0) {
                        const droppedSlot2 = Math.max(0, currentSlot - penalty);
                        if (droppedSlot2 === 0 && currentSlot > 1) { const nextRev = revDates.find(d => getMondayOfWeek(d) > finalMonday); if (!nextRev) break; slotAnchorMonday = getMondayOfWeek(nextRev); currentSlot = 1; i = 0; continue; }
                        const actualDropped2 = droppedSlot2 === 0 ? 1 : droppedSlot2; defendingSlot = actualDropped2; const defGapIdx2 = actualDropped2 - 1; const windowSize2 = defGapIdx2 > 0 ? gaps[defGapIdx2] - gaps[defGapIdx2-1] : gaps[defGapIdx2]; defendingWindowStart = addWeeksToDate(finalMonday, 1); defendingWindowEnd = actualDropped2 === 1 ? null : addWeeksToDate(defendingWindowStart, windowSize2 - 1); i = defGapIdx2 + 1; continue;
                    }
                    if (missedMode !== 'no-hunt') { huntingSlot = currentSlot; huntWindowStart = addWeeksToDate(finalMonday, 1); huntWindowEnd = (missedMode === 'next-slot' && i + 1 < gaps.length) ? addWeeksToDate(slotAnchorMonday, gaps[i + 1] - gaps[i] - 1) : null; i++; currentSlot++; continue; }
                    i++; currentSlot++; if (i >= gaps.length) break; slotAnchorMonday = addWeeksToDate(slotAnchorMonday, gaps[i] - gaps[i-1]); continue;
                }
            }
        }

        Object.keys(revPerWeek).forEach(wk => { if (!badges[wk] && wk <= weekKeyFromDate(_today)) badges[wk] = { type: 'early', label: 'Off-schedule ✅' }; });
        badges._projectionState = { nextSlot: currentSlot, nextSlotMonday: new Date(slotAnchorMonday), gapIndex: i, defending: defendingSlot !== null, defendingSlot, defendingWindowEnd, hunting: huntingSlot !== null, huntingSlot, huntWindowEnd };
        return badges;
    }

    // ===== PURE BADGE COMPUTATION (no DOM, safe to call without modal open) =====
    function computeBadgesPure(sectionRevisions, scheduleType, settings) {
        // Save state
        const savedRevisions = revState.revisions.slice();
        const savedActiveSeries = activeSeries;
        const savedSlotCount = slotCount;
        const savedInterval = regularInterval;
        const savedMissedMode = missedMode;
        const savedStartWeek = { ...startWeek };
        const savedCustomGaps = customGaps.slice();
        const savedRPW = { ...seriesRPW };
        const savedPerSlot = JSON.parse(JSON.stringify(perSlotRPW));

        // Load section data
        revState.revisions = (sectionRevisions || []).map(r => ({ date: r ? r.date || null : null, year: r ? r.year || null : null }));
        while (revState.revisions.length < 40) revState.revisions.push({ date: null, year: null });
        activeSeries = scheduleType || 'prime';
        regularInterval = (settings && settings.scheduleN) || 4;
        missedMode = (settings && settings.smMissedMode) || 'no-hunt';
        if (settings && settings.smCustomGaps) customGaps = settings.smCustomGaps.slice();

        // Derive slot count
        const s = SERIES.find(x => x.key === activeSeries);
        slotCount = (settings && settings.smSlotCount) || (s ? s.defaultSlots : 18) || 18;

        // Derive start week from first revision
        const firstRev = revState.revisions.find(r => r.date && r.year);
        if (firstRev) {
            const [d, m] = firstRev.date.split('/').map(Number);
            const firstDate = new Date(firstRev.year, m - 1, d); firstDate.setHours(0,0,0,0);
            const fy = firstDate.getFullYear(), fm = firstDate.getMonth();
            const isoW = getISOWeek(firstDate), isoY = getISOWeekYear(firstDate);
            const fWeeks = getMonthWeeks(fy, fm);
            let found = false;
            for (let wi = 0; wi < fWeeks.length; wi++) {
                if (getISOWeek(fWeeks[wi].monday) === isoW && getISOWeekYear(fWeeks[wi].monday) === isoY) { startWeek = { year: fy, month: fm, weekIdx: wi }; found = true; break; }
            }
            if (!found) startWeek = { year: CURRENT_YEAR, month: CURRENT_MONTH, weekIdx: CURRENT_WEEK_IDX };
        } else {
            startWeek = { year: CURRENT_YEAR, month: CURRENT_MONTH, weekIdx: CURRENT_WEEK_IDX };
        }

        // Reset RPW to defaults for computation
        ['prime','fibonacci','triangular'].forEach(k => { seriesRPW[k] = 1; perSlotRPW[k] = {1:2,2:2,3:2}; });
        seriesRPW['regular'] = 1; perSlotRPW['regular'] = {};
        seriesRPW['custom'] = 1; perSlotRPW['custom'] = {};

        // Pass penalty/grace directly so they work even when modal DOM isn't open
        const penaltyVal = (settings && settings.smPenalty !== undefined) ? Number(settings.smPenalty) : 1;
        const graceVal   = (settings && settings.smGrace   !== undefined) ? Number(settings.smGrace)   : 0;

        let badges;
        try { badges = computeSlotBadges(penaltyVal, graceVal); } catch(e) { badges = { _projectionState: null }; }

        // Restore state
        revState.revisions = savedRevisions;
        activeSeries = savedActiveSeries;
        slotCount = savedSlotCount;
        regularInterval = savedInterval;
        missedMode = savedMissedMode;
        startWeek = savedStartWeek;
        customGaps = savedCustomGaps;
        Object.assign(seriesRPW, savedRPW);
        Object.keys(savedPerSlot).forEach(k => { perSlotRPW[k] = savedPerSlot[k]; });

        return badges;
    }

    function addToSet(set, slotMonday, slotIndex) {
        for (let offset = 0; offset <= 1; offset++) {
            let y = slotMonday.getFullYear(), m = slotMonday.getMonth() + offset;
            if (m > 11) { m = 0; y++; }
            const weeks = getMonthWeeks(y, m); const isoW = getISOWeek(slotMonday), isoY = getISOWeekYear(slotMonday);
            for (let wi = 0; wi < weeks.length; wi++) {
                if (getISOWeek(weeks[wi].monday) === isoW && getISOWeekYear(weeks[wi].monday) === isoY) {
                    const key = `${y}-${m}-${wi}`; set.add(key); if (slotIndex !== undefined) _weekSlotMap[key] = slotIndex; return;
                }
            }
        }
    }

    function buildFutureSlotSet() {
        const set = new Set(); _weekSlotMap = {}; _lastSlotMonday = null;
        const todayMonday = getMondayOfWeek(_today); const gaps = getSeriesGapValues();
        const badges = _slotBadges && Object.keys(_slotBadges).length > 0 ? _slotBadges : computeSlotBadges();
        const proj = badges._projectionState; if (!proj) return set;
        let slotMonday; let i = proj.gapIndex;
        if (proj.defending) { addToSet(set, todayMonday, proj.defendingSlot); if (proj.defendingSlot === 1 || proj.defendingWindowEnd === null) { const gapDiff = i > 0 ? gaps[i] - gaps[i-1] : gaps[i]; slotMonday = addWeeksToDate(todayMonday, gapDiff); } else { slotMonday = addWeeksToDate(getMondayOfWeek(proj.defendingWindowEnd), gaps[i] - (i > 0 ? gaps[i-1] : 0)); } }
        else if (proj.hunting) { addToSet(set, todayMonday, proj.huntingSlot); if (proj.huntWindowEnd === null) { const gapDiff = i > 0 ? gaps[i] - gaps[i-1] : gaps[i]; slotMonday = addWeeksToDate(todayMonday, gapDiff); } else { slotMonday = addWeeksToDate(getMondayOfWeek(proj.huntWindowEnd), gaps[i] - (i > 0 ? gaps[i-1] : 0)); } }
        else { slotMonday = new Date(proj.nextSlotMonday); if (slotMonday < todayMonday) slotMonday = new Date(todayMonday); }
        while (i < gaps.length) {
            _lastSlotMonday = new Date(slotMonday); addToSet(set, slotMonday, i + 1);
            const futureKey = weekKeyFromDate(slotMonday); if (!_slotBadges[futureKey]) _slotBadges[futureKey] = { type: 'scheduled', label: `Slot ${i + 1} — Scheduled 📅` };
            i++; if (i >= gaps.length) break; const gapDiff = gaps[i] - gaps[i-1]; slotMonday = addWeeksToDate(slotMonday, gapDiff);
        }
        return set;
    }

    function getSlotPositionFromBadge() {
        const todayKey = weekKeyFromDate(_today); const badge = _slotBadges && _slotBadges[todayKey];
        if (badge && badge.label) { const m = badge.label.match(/Slot (\d+)/); if (m) return parseInt(m[1], 10); }
        return 0;
    }

    function updateSlotPosition() {
        seriesSelected[activeSeries] = null;
        if (['prime','fibonacci','triangular'].includes(activeSeries)) wkRevCounts[activeSeries] = buildDefaultRevCounts();
        const pos = getSlotPositionFromBadge();
        const el = document.getElementById('smSlotPosLabel'); if (el) el.textContent = `Current Slot Position — ${pos}`;
        updateWeekMap();
    }

    // ===== WEEK MAP UI =====
    function setWmapView(view) {
        wmapView = view;
        const d = document.getElementById('smViewTabDay'); const w = document.getElementById('smViewTabWeek');
        if (d) d.classList.toggle('active', view === 'day');
        if (w) w.classList.toggle('active', view === 'week');
        updateWeekMap();
    }

    function updateEndWeekDisplay() {
        const block = document.getElementById('smEndWeekBlock'); if (!block) return;
        const isCustomSlots = activeSeries === 'custom';
        const btn = document.getElementById('smEndWeekBtn'); const sub = document.getElementById('smEndWeekSub');
        if (isCustomSlots) {
            if (btn) { btn.style.opacity = ''; btn.style.pointerEvents = ''; }
            if (sub) sub.textContent = 'Map shows weeks up to this point';
            const ev = document.getElementById('smEndWeekVal'); if (ev) ev.textContent = formatWeekLabel(customEndWeek);
        } else {
            if (btn) { btn.style.opacity = '0.45'; btn.style.pointerEvents = 'none'; }
            if (sub) sub.textContent = 'Auto-calculated from last slot';
            const endLoc = getLastSlotLoc(); const ev = document.getElementById('smEndWeekVal');
            if (ev) ev.textContent = endLoc ? formatWeekLabel(endLoc) : '—';
        }
    }

    function updateWeekMap() {
        const s = SERIES.find(x => x.key === activeSeries); const isInteractive = activeSeries === 'custom';
        _slotBadges = computeSlotBadges(); seriesSelected[s.key] = buildFutureSlotSet(); const activeSet = seriesSelected[s.key];
        updateEndWeekDisplay();
        const pos = getSlotPositionFromBadge(); const el = document.getElementById('smSlotPosLabel'); if (el) el.textContent = `Current Slot Position — ${pos}`;
        const body = document.getElementById('smWmapBody'); if (!body) return;
        const scrollTop = body.scrollTop; body.innerHTML = '';
        if (wmapView === 'week') renderWeekView(body, activeSet, isInteractive);
        else renderDayView(body, activeSet, isInteractive);
        requestAnimationFrame(() => { if (scrollTop > 0) body.scrollTop = scrollTop; });
    }

    function renderWeekView(body, activeSet, isInteractive) {
        const sw = getStartWeekMonday(); let y = sw.getFullYear(), m = sw.getMonth();
        while (!isDurationExceeded(y, m)) {
            const weeks = getMonthWeeks(y, m);
            if (weeks.length > 0) {
                const row = document.createElement('div'); row.className = 'wmap-month-row';
                const monthCell = document.createElement('div'); monthCell.className = 'wmap-month-cell';
                const lbl = document.createElement('div'); lbl.className = 'wmap-month-label';
                const mPart = document.createElement('span'); mPart.className = 'wmap-month-part'; mPart.textContent = MONTHS_SHORT[m];
                const yPart = document.createElement('span'); yPart.className = 'wmap-month-part'; yPart.textContent = String(y).slice(2);
                lbl.appendChild(mPart); lbl.appendChild(yPart); monthCell.appendChild(lbl); row.appendChild(monthCell);
                const weeksDiv = document.createElement('div'); weeksDiv.className = 'wmap-weeks';
                weeks.forEach((wk, idx) => {
                    const wkIso = getISOWeek(wk.monday), wkYear = getISOWeekYear(wk.monday);
                    const curIso = getISOWeek(_today), curYear = getISOWeekYear(_today);
                    const isPast = wkYear < curYear || (wkYear === curYear && wkIso < curIso);
                    const isCurrent = wkIso === curIso && wkYear === curYear;
                    const treatAsPast = isPast && activeSeries !== 'custom';
                    const key = `${y}-${m}-${idx}`; const isSelected = activeSet && activeSet.has(key);
                    const slotIdx = _weekSlotMap[key];
                    const revCount = slotIdx !== undefined ? getFinalSlotRPW(slotIdx) : (wkRevCounts[activeSeries][key] || seriesRPW[activeSeries] || 1);
                    const cell = document.createElement('div');
                    let cls = 'wk-cell';
                    if (treatAsPast) cls += ' past'; else if (isCurrent) cls += ' current';
                    if (isSelected) cls += ' selected';
                    if (isInteractive && !treatAsPast) cls += ' selectable';
                    if (!isInteractive && !treatAsPast) cls += ' display-only';
                    if (isSelected && !treatAsPast) cls += ' has-count';
                    cell.className = cls; cell.dataset.key = key;
                    const wkText = document.createElement('span'); wkText.className = 'wk-text'; wkText.textContent = `W${idx + 1}`; cell.appendChild(wkText);
                    if (isSelected && !treatAsPast) {
                        const sup = document.createElement('span'); sup.className = 'wk-sup'; sup.textContent = revCount; cell.appendChild(sup);
                        const inl = document.createElement('div'); inl.className = 'wk-inline'; inl.innerHTML = `<button class="wk-inline-btn" data-key="${key}" data-dir="-1">−</button><span class="wk-inline-val">${revCount}</span><button class="wk-inline-btn" data-key="${key}" data-dir="1">+</button>`;
                        inl.querySelectorAll('.wk-inline-btn').forEach(btn => { btn.addEventListener('click', e => { e.stopPropagation(); const k = btn.dataset.key; const d = parseInt(btn.dataset.dir); const sIdx = _weekSlotMap[k]; let cur = sIdx !== undefined ? getFinalSlotRPW(sIdx) : (wkRevCounts[activeSeries][k] || 1); const newVal = Math.max(1, Math.min(7, cur + d)); if (sIdx !== undefined) perSlotRPW[activeSeries][sIdx] = newVal; wkRevCounts[activeSeries][k] = newVal; updateWeekMap(); }); });
                        cell.appendChild(inl);
                    }
                    if (isInteractive && !treatAsPast && activeSet) {
                        cell.addEventListener('click', () => {
                            if (activeSet.has(key)) { activeSet.delete(key); delete wkRevCounts[activeSeries][key]; } else activeSet.add(key);
                            updateWeekMap();
                        });
                    }
                    weeksDiv.appendChild(cell);
                });
                row.appendChild(weeksDiv); body.appendChild(row);
            }
            m++; if (m > 11) { m = 0; y++; }
        }
    }

    function renderDayView(body, activeSet, isInteractive) {
        const startDate = getWmapStartDate(); const startYear = startDate.getFullYear(), startMonth = startDate.getMonth();
        let y = startMonth === 0 ? startYear - 1 : startYear; let m = startMonth === 0 ? 11 : startMonth - 1;
        let lastSlotLoc = activeSeries === 'custom' ? customEndWeek : getLastSlotLoc();
        while (!isDurationExceeded(y, m)) {
            const weeks = getMonthWeeks(y, m); const isLastMonth = lastSlotLoc && y === lastSlotLoc.year && m === lastSlotLoc.month;
            if (weeks.length > 0) {
                let firstWeekRendered = false;
                weeks.forEach((wk, idx) => {
                    const wkIso = getISOWeek(wk.monday), wkYear = getISOWeekYear(wk.monday);
                    const startIso = getISOWeek(startDate), startIsoYear = getISOWeekYear(startDate);
                    const todayIso = getISOWeek(_today), todayIsoYear = getISOWeekYear(_today);
                    const isBeforeStart = wkYear < startIsoYear || (wkYear === startIsoYear && wkIso < startIso);
                    const isCurrent = wkIso === todayIso && wkYear === todayIsoYear;
                    if (isBeforeStart) return; if (isLastMonth && idx > lastSlotLoc.weekIdx) return;
                    const key = `${y}-${m}-${idx}`; const isSelected = activeSet && activeSet.has(key);
                    const slotIdx = _weekSlotMap[key]; const revCount = slotIdx !== undefined ? getFinalSlotRPW(slotIdx) : (wkRevCounts[activeSeries][key] || seriesRPW[activeSeries] || 1);
                    const row = document.createElement('div'); row.className = 'wmap-week-row';
                    // Month cell
                    const monthCell = document.createElement('div'); monthCell.className = 'wmap-month-cell';
                    if (!firstWeekRendered) { const lbl = document.createElement('div'); lbl.className = 'wmap-month-label'; const mPart = document.createElement('span'); mPart.className = 'wmap-month-part'; mPart.textContent = MONTHS_SHORT[m]; const yPart = document.createElement('span'); yPart.className = 'wmap-month-part'; yPart.textContent = String(y).slice(2); lbl.appendChild(mPart); lbl.appendChild(yPart); monthCell.appendChild(lbl); firstWeekRendered = true; } else { const emptyLbl = document.createElement('div'); emptyLbl.className = 'wmap-month-label empty'; monthCell.appendChild(emptyLbl); }
                    row.appendChild(monthCell);
                    // Week pill
                    const weekCol = document.createElement('div'); weekCol.className = 'wmap-week-cell-col';
                    const cell = document.createElement('div');
                    let cls = 'wk-cell';
                    if (isCurrent) cls += ' current'; if (isSelected) cls += ' selected';
                    if (isInteractive) cls += ' selectable'; else cls += ' display-only';
                    if (isSelected) cls += ' has-count'; cell.className = cls; cell.dataset.key = key;
                    const wkText = document.createElement('span'); wkText.className = 'wk-text'; wkText.textContent = `W${idx + 1}`; cell.appendChild(wkText);
                    if (isSelected) {
                        const sup = document.createElement('span'); sup.className = 'wk-sup'; sup.textContent = revCount; cell.appendChild(sup);
                        const inl = document.createElement('div'); inl.className = 'wk-inline'; inl.innerHTML = `<button class="wk-inline-btn" data-key="${key}" data-dir="-1">−</button><span class="wk-inline-val">${revCount}</span><button class="wk-inline-btn" data-key="${key}" data-dir="1">+</button>`;
                        inl.querySelectorAll('.wk-inline-btn').forEach(btn => { btn.addEventListener('click', e => { e.stopPropagation(); const k = btn.dataset.key; const d = parseInt(btn.dataset.dir); const sIdx = _weekSlotMap[k]; let cur = sIdx !== undefined ? getFinalSlotRPW(sIdx) : (wkRevCounts[activeSeries][k] || 1); const newVal = Math.max(1, Math.min(7, cur + d)); if (sIdx !== undefined) perSlotRPW[activeSeries][sIdx] = newVal; wkRevCounts[activeSeries][k] = newVal; updateWeekMap(); }); });
                        cell.appendChild(inl);
                    }
                    if (isInteractive && activeSet) { cell.addEventListener('click', () => { if (activeSet.has(key)) { activeSet.delete(key); delete wkRevCounts[activeSeries][key]; } else activeSet.add(key); updateWeekMap(); }); }
                    weekCol.appendChild(cell); row.appendChild(weekCol);
                    // Days
                    const daysCol = document.createElement('div'); daysCol.className = 'wmap-days-col';
                    for (let d = 0; d < 7; d++) {
                        const dayDate = new Date(wk.monday); dayDate.setDate(dayDate.getDate() + d); dayDate.setHours(0,0,0,0);
                        const dayIsToday = dayDate.getTime() === startDate.getTime();
                        const isRecorded = revState.revisions.some(r => { if (!r.date || !r.year) return false; const [rd,rm] = r.date.split('/').map(Number); const rec = new Date(r.year, rm-1, rd); rec.setHours(0,0,0,0); return rec.getTime() === dayDate.getTime(); });
                        const isFuture = dayDate > _today;
                        const dayCell = document.createElement('div');
                        let dcls = 'wk-cell';
                        if (isRecorded) dcls += ' recorded'; else if (isSelected) dcls += ' selected'; else if (dayIsToday) dcls += ' current';
                        if (!isFuture) dcls += ' day-clickable'; dayCell.className = dcls;
                        if (!isFuture) { dayCell.dataset.label = isRecorded ? 'Mark as Unstudied' : 'Mark as Studied'; dayCell.addEventListener('click', () => toggleStudiedDate(new Date(dayDate))); }
                        const dayText = document.createElement('span'); dayText.className = 'wk-text'; dayText.textContent = dayDate.getDate(); dayCell.appendChild(dayText); daysCol.appendChild(dayCell);
                    }
                    row.appendChild(daysCol);
                    // Badge
                    const rightCol = document.createElement('div'); rightCol.className = 'wmap-right-col';
                    const wkMonday = new Date(wk.monday); const wkKey = weekKeyFromDate(wkMonday); const badge = _slotBadges[wkKey];
                    if (badge) { const pill = document.createElement('span'); pill.className = `slot-badge ${badge.type}`; pill.textContent = badge.label; if (badge.type === 'partial') { const icon = document.createElement('span'); icon.className = 'partial-icon'; pill.appendChild(icon); } rightCol.appendChild(pill); }
                    row.appendChild(rightCol); body.appendChild(row);
                });
            }
            m++; if (m > 11) { m = 0; y++; }
        }
    }

    // ===== SETTINGS STEPPERS =====
    function updateStepperStates(valId, val, min, max) {
        const valEl = document.getElementById(valId); if (!valEl) return;
        const btns = valEl.parentElement.querySelectorAll('.st-stepper-btn');
        if (btns.length >= 2) { btns[0].disabled = val <= min; btns[1].disabled = val >= max; }
    }
    function stepSlots(dir) {
        if (activeSeries === 'custom') { const max = customGaps.length; slotCount = Math.max(1, Math.min(max, slotCount + dir)); const sv = document.getElementById('smSlotsVal'); if (sv) sv.textContent = slotCount; updateStepperStates('smSlotsVal', slotCount, 1, max); updateCustomGapsSummary(); syncCustomEndWeek(); seriesSelected['custom'] = null; updateWeekMap(); updateSeriesDisplay(); return; }
        const s = SERIES.find(x => x.key === activeSeries); const maxSlots = s.maxSlots || s.gaps.length || 52;
        slotCount = Math.max(1, Math.min(maxSlots, slotCount + dir)); const sv = document.getElementById('smSlotsVal'); if (sv) sv.textContent = slotCount;
        updateStepperStates('smSlotsVal', slotCount, 1, maxSlots); seriesSelected[activeSeries] = null; updateWeekMap(); updateSeriesDisplay();
    }
    function stepGrace(dir) { const el = document.getElementById('smGraceVal'); const val = Math.max(0, Math.min(4, parseInt(el.textContent) + dir)); el.textContent = val; updateStepperStates('smGraceVal', val, 0, 4); updateWeekMap(); }
    function stepPenalty(dir) {
        const el = document.getElementById('smPenaltyVal'); const val = Math.max(0, Math.min(4, parseInt(el.textContent) + dir)); el.textContent = val;
        updateStepperStates('smPenaltyVal', val, 0, 4);
        const mb = document.getElementById('smMissedBlock'); if (mb) mb.style.display = val === 0 ? '' : 'none';
        updateWeekMap();
    }
    function stepRPW(dir) { const el = document.getElementById('smRpwVal'); let val = Math.max(1, Math.min(7, parseInt(el.textContent) + dir)); el.textContent = val; seriesRPW[activeSeries] = val; perSlotRPW[activeSeries] = {}; updateStepperStates('smRpwVal', val, 1, 7); updateWeekMap(); }
    function stepInterval(dir) {
        regularInterval = Math.max(1, Math.min(52, regularInterval + dir)); const iv = document.getElementById('smIntervalVal'); if (iv) iv.textContent = regularInterval;
        updateStepperStates('smIntervalVal', regularInterval, 1, 52); seriesSelected['regular'] = null; wkRevCounts['regular'] = {}; updateWeekMap(); updateSeriesDisplay();
    }
    function missedSelect(el, mode) { el.closest('.radio-list').querySelectorAll('.radio-row').forEach(r => r.classList.remove('active')); el.classList.add('active'); missedMode = mode; updateWeekMap(); }

    // ===== SERIES DISPLAY =====
    function updateSeriesDisplay() {
        const block = document.getElementById('smSeriesDisplayBlock'); const el = document.getElementById('smSeriesDisplayNums'); if (!block || !el) return;
        const show = activeSeries !== 'custom'; block.style.display = show ? '' : 'none';
        if (!show) return; el.textContent = getSeriesGaps().join(', '); updateEndWeekDisplay();
    }
    function updateCustomGapsSummary() { const el = document.getElementById('smCustomGapsSummary'); if (el) el.textContent = customGaps.length > 0 ? customGaps.slice(0, slotCount).join(', ') : '—'; }
    function syncCustomEndWeek() { const activeGaps = customGaps.slice(0, slotCount); if (activeGaps.length > 0) customEndWeek = offsetWeeks(activeGaps[activeGaps.length - 1]); }

    // ===== NUM PICKER =====
    function openNumPicker() { tempCustomGaps = [...customGaps]; renderNumPickerGrid(); const o = document.getElementById('smNumPickerOverlay'); if (o) o.classList.add('active'); }
    function cancelNumPicker() { const o = document.getElementById('smNumPickerOverlay'); if (o) o.classList.remove('active'); }
    function confirmNumPicker() {
        customGaps = [...tempCustomGaps]; if (customGaps.length === 0) customGaps = [1];
        slotCount = customGaps.length; const sv = document.getElementById('smSlotsVal'); if (sv) sv.textContent = slotCount;
        updateStepperStates('smSlotsVal', slotCount, 1, customGaps.length); updateCustomGapsSummary(); syncCustomEndWeek();
        const o = document.getElementById('smNumPickerOverlay'); if (o) o.classList.remove('active');
        seriesSelected['custom'] = null; updateWeekMap(); updateSeriesDisplay();
    }
    function handleNumPickerOverlayClick(e) { if (e.target === document.getElementById('smNumPickerOverlay')) cancelNumPicker(); }
    function renderNumPickerGrid() {
        const grid = document.getElementById('smNumPickerGrid'); if (!grid) return; grid.innerHTML = '';
        for (let n = 1; n <= 200; n++) { const cell = document.createElement('div'); cell.className = 'np-cell' + (tempCustomGaps.includes(n) ? ' selected' : '') + (n === 1 ? ' locked' : ''); cell.textContent = n; cell.addEventListener('click', () => toggleGapNum(n)); grid.appendChild(cell); }
        updateNpSummary();
    }
    function toggleGapNum(n) { if (n === 1) return; const idx = tempCustomGaps.indexOf(n); if (idx !== -1) { if (tempCustomGaps.length === 1) return; tempCustomGaps.splice(idx, 1); } else { tempCustomGaps.push(n); tempCustomGaps.sort((a,b) => a-b); } renderNumPickerGrid(); }
    function updateNpSummary() { const el = document.getElementById('smNpSummaryBar'); if (el) el.textContent = tempCustomGaps.length > 0 ? tempCustomGaps.join(', ') : 'None selected'; }

    // ===== WEEK PICKER =====
    function openWeekPicker(mode) {
        wkPickerMode = mode; const cur = mode === 'start' ? startWeek : customEndWeek;
        wkPickerYear = cur.year; wkPickerMonth = cur.month; wkPickerSelected = { ...cur };
        const t = document.getElementById('smWkPickerTitle'); if (t) t.textContent = mode === 'start' ? 'Select Start Week' : 'Select End Week';
        renderWkPickerGrid(); const o = document.getElementById('smWkPickerOverlay'); if (o) o.classList.add('active');
    }
    function closeWeekPicker() { const o = document.getElementById('smWkPickerOverlay'); if (o) o.classList.remove('active'); wkPickerSelected = null; }
    function handleWkOverlayClick(e) { if (e.target === document.getElementById('smWkPickerOverlay')) closeWeekPicker(); }
    function wkNavMonth(dir) { wkPickerMonth += dir; if (wkPickerMonth < 0) { wkPickerMonth = 11; wkPickerYear--; } if (wkPickerMonth > 11) { wkPickerMonth = 0; wkPickerYear++; } renderWkPickerGrid(); }
    function renderWkPickerGrid() {
        const ml = document.getElementById('smWkPickerMonthLabel'); if (ml) ml.textContent = `${MONTHS_FULL[wkPickerMonth]} ${wkPickerYear}`;
        const grid = document.getElementById('smWkPickerGrid'); if (!grid) return; grid.innerHTML = '';
        const weeks = getMonthWeeks(wkPickerYear, wkPickerMonth); const todayMonday = getMondayOfWeek(_today);
        const otherWeek = (activeSeries === 'custom') ? (wkPickerMode === 'start' ? customEndWeek : startWeek) : null;
        weeks.forEach((wk, idx) => {
            const isSelected = wkPickerSelected && wkPickerSelected.year === wkPickerYear && wkPickerSelected.month === wkPickerMonth && wkPickerSelected.weekIdx === idx;
            const isAnchor = !isSelected && otherWeek && otherWeek.year === wkPickerYear && otherWeek.month === wkPickerMonth && otherWeek.weekIdx === idx;
            const isToday = wk.monday.getTime() === todayMonday.getTime();
            const sunday = new Date(wk.monday); sunday.setDate(sunday.getDate() + 6);
            const row = document.createElement('div'); row.className = 'wk-picker-row' + (isSelected ? ' selected' : '') + (isAnchor ? ' anchor' : '');
            const wkNum = document.createElement('span'); wkNum.className = 'wk-num'; wkNum.textContent = `W${idx + 1}`;
            const wkRange = document.createElement('span'); wkRange.className = 'wk-range'; wkRange.textContent = `${formatDateShort(wk.monday)} – ${formatDateShort(sunday)}`;
            row.appendChild(wkNum); row.appendChild(wkRange);
            if (isToday) { const dot = document.createElement('span'); dot.className = 'wk-today-dot'; row.appendChild(dot); }
            if (isSelected) { const tag = document.createElement('span'); tag.className = 'wk-week-tag ' + (wkPickerMode === 'start' ? 'tag-start' : 'tag-end'); tag.textContent = wkPickerMode === 'start' ? 'Start' : 'End'; row.appendChild(tag); }
            if (isAnchor) { const tag = document.createElement('span'); tag.className = 'wk-week-tag tag-anchor'; tag.textContent = wkPickerMode === 'start' ? 'End' : 'Start'; row.appendChild(tag); }
            row.onclick = () => { wkPickerSelected = { year: wkPickerYear, month: wkPickerMonth, weekIdx: idx }; renderWkPickerGrid(); };
            grid.appendChild(row);
        });
    }
    function getCustomEndGap() {
        const startMonday = getStartWeekMonday(); const endWeeksArr = getMonthWeeks(customEndWeek.year, customEndWeek.month);
        if (!endWeeksArr[customEndWeek.weekIdx]) return null;
        const endMonday = new Date(endWeeksArr[customEndWeek.weekIdx].monday); endMonday.setHours(0,0,0,0);
        const gap = Math.round((endMonday - startMonday) / (7 * 24 * 60 * 60 * 1000)) + 1;
        return gap > 0 ? gap : null;
    }
    function syncCustomGaps() {
        const gap = getCustomEndGap(); if (gap === null) return;
        customGaps[customGaps.length - 1] = gap; customGaps = [...new Set(customGaps)].sort((a,b) => a-b); tempCustomGaps = [...customGaps];
        slotCount = customGaps.length; const sv = document.getElementById('smSlotsVal'); if (sv) sv.textContent = slotCount;
        updateStepperStates('smSlotsVal', slotCount, 1, customGaps.length); updateCustomGapsSummary();
    }
    function confirmWeekPicker() {
        if (!wkPickerSelected) { closeWeekPicker(); return; }
        if (wkPickerMode === 'start') { startWeek = { ...wkPickerSelected }; const sv = document.getElementById('smStartWeekVal'); if (sv) sv.textContent = formatWeekLabel(startWeek); Object.keys(seriesSelected).forEach(k => seriesSelected[k] = null); if (activeSeries === 'custom') syncCustomGaps(); }
        else { customEndWeek = { ...wkPickerSelected }; const ev = document.getElementById('smEndWeekVal'); if (ev) ev.textContent = formatWeekLabel(customEndWeek); seriesSelected['custom'] = null; syncCustomGaps(); }
        closeWeekPicker(); updateWeekMap(); updateSeriesDisplay();
    }

    function keyToGapNumber(key) {
        const [y, m, idx] = key.split('-').map(Number); const weeks = getMonthWeeks(y, m); if (!weeks[idx]) return null;
        const clickedMonday = getMondayOfWeek(weeks[idx].monday); const anchorMonday = getStartWeekMonday();
        const diffWeeks = Math.round((clickedMonday - anchorMonday) / (7 * 24 * 60 * 60 * 1000)); return diffWeeks + 1;
    }

    // ===== SERIES LIST / INFO =====
    function buildSchedLeft() {
        const c = document.getElementById('smSchedLeft'); if (!c) return; c.innerHTML = '';
        SERIES.forEach(s => {
            const item = document.createElement('div'); item.className = 'sl-item' + (s.key === activeSeries ? ' active' : ''); item.dataset.key = s.key;
            item.innerHTML = `<div class="sl-dot" style="background:${s.color}"></div><span class="sl-name">${s.name}</span>`;
            item.onclick = () => selectSeries(s.key); c.appendChild(item);
        });
    }
    function buildInfoRows() {
        const c = document.getElementById('smInfoRows'); if (!c) return; c.innerHTML = '';
        SERIES.forEach(s => { const row = document.createElement('div'); row.className = 'info-row'; row.innerHTML = `<div class="info-name-cell"><div class="info-dot" style="background:${s.color}"></div><span class="info-name">${s.name}</span></div><div class="info-how">${s.how}</div><div class="info-good">${s.good}</div>`; c.appendChild(row); });
    }

    function selectSeries(key) {
        activeSeries = key;
        const fs = document.getElementById('smFooterSelected'); if (fs) fs.textContent = SERIES.find(s => s.key === key).name;
        document.querySelectorAll('#smSchedLeft .sl-item').forEach(i => i.classList.toggle('active', i.dataset.key === key));
        const rb = document.getElementById('smRegularBlock'); if (rb) rb.style.display = key === 'regular' ? '' : 'none';
        const isCustom = key === 'custom';
        if (isCustom) {
            const cb = document.getElementById('smCustomGapsBlock'); if (cb) cb.style.display = '';
            if (slotCount < 1) slotCount = 1; if (slotCount > customGaps.length) slotCount = customGaps.length;
            const sv = document.getElementById('smSlotsVal'); if (sv) sv.textContent = slotCount;
            updateStepperStates('smSlotsVal', slotCount, 1, customGaps.length); updateCustomGapsSummary(); updateEndWeekDisplay();
        } else {
            const cb = document.getElementById('smCustomGapsBlock'); if (cb) cb.style.display = 'none';
            const _s = SERIES.find(s => s.key === key); slotCount = _s.defaultSlots;
            const sv = document.getElementById('smSlotsVal'); if (sv) sv.textContent = slotCount;
            updateStepperStates('smSlotsVal', slotCount, 1, _s.maxSlots || _s.gaps.length || 52);
            updateEndWeekDisplay(); updateWeekMap(); updateSeriesDisplay();
        }
        if (key !== 'custom') seriesSelected[key] = null;
        if (Object.keys(confirmedRevCounts[key]).length > 0) {
            wkRevCounts[key] = { ...confirmedRevCounts[key] }; const rpw = confirmedRPW[key]; seriesRPW[key] = rpw; perSlotRPW[key] = confirmedPerSlotRPW[key] ? { ...confirmedPerSlotRPW[key] } : {};
            const rv = document.getElementById('smRpwVal'); if (rv) rv.textContent = rpw; updateStepperStates('smRpwVal', rpw, 1, 7);
        } else {
            perSlotRPW[key] = {}; if (['prime','fibonacci','triangular'].includes(key)) { perSlotRPW[key][1] = 2; perSlotRPW[key][2] = 2; perSlotRPW[key][3] = 2; }
            const defaultGlobal = 1; seriesRPW[key] = defaultGlobal; wkRevCounts[key] = ['prime','fibonacci','triangular'].includes(key) ? buildDefaultRevCounts() : {};
            const rv = document.getElementById('smRpwVal'); if (rv) rv.textContent = defaultGlobal; updateStepperStates('smRpwVal', defaultGlobal, 1, 7);
        }
        updateWeekMap(); updateSeriesDisplay();
    }

    function switchTab(tab, el) {
        document.querySelectorAll('#smPageOverlay .sm-tab').forEach(t => t.classList.remove('active')); el.classList.add('active');
        const ps = document.getElementById('smPanelSchedule'); if (ps) ps.classList.toggle('active', tab === 'schedule');
        const pi = document.getElementById('smPanelInfo'); if (pi) pi.classList.toggle('active', tab === 'info');
    }

    // ===== REVISION BOXES UI =====
    function revOrdinal(n) { const s = ['th','st','nd','rd'], v = n % 100; return n + (s[(v-20)%10] || s[v] || s[0]); }
    function revGetToday() { const d = new Date(); d.setHours(0,0,0,0); return d; }
    function revIsSameDay(a, b) { return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate(); }
    function revParseDateStr(dateStr, year) { if (!dateStr || !year) return null; const [day,month] = dateStr.split('/').map(Number); const d = new Date(year,month-1,day); d.setHours(0,0,0,0); return d; }
    function revGetMinDate(index) { if (index === 0) return null; const prev = revState.revisions[index-1]; if (!prev || !prev.date) return null; const prevDate = revParseDateStr(prev.date, prev.year); if (!prevDate) return null; const min = new Date(prevDate); min.setDate(min.getDate()+1); return min; }
    function revGetBoxClass(index) {
        const lastFilledIndex = revState.revisions.reduce((last,r,i) => r.date !== null ? i : last, -1);
        const activated = revState.activatedCount; const rev = revState.revisions[index]; const filled = rev?.date !== null;
        if (index >= activated) return 'locked';
        if (filled && index === lastFilledIndex) return 'filled';
        if (filled && index < lastFilledIndex) return 'filled-past';
        if (index === lastFilledIndex + 1) return 'editable';
        return 'activated';
    }

    function toggleStudiedDate(dayDate) {
        const allDates = revState.revisions.filter(r => r.date && r.year).map(r => revParseDateStr(r.date, r.year));
        const existingIdx = allDates.findIndex(d => revIsSameDay(d, dayDate));
        if (existingIdx >= 0) allDates.splice(existingIdx, 1); else allDates.push(dayDate);
        allDates.sort((a,b) => a-b);
        for (let i = 0; i < revState.revisions.length; i++) {
            if (i < allDates.length) { const d = allDates[i]; const day = String(d.getDate()).padStart(2,'0'); const month = String(d.getMonth()+1).padStart(2,'0'); revState.revisions[i] = { date: day+'/'+month, year: d.getFullYear() }; }
            else revState.revisions[i] = { date: null, year: null };
        }
        revRenderBoxes(); updateSlotPosition();
    }

    function revRenderBoxes() {
        const grid = document.getElementById('smRevDatesGrid'); if (!grid) return; grid.innerHTML = '';
        const lastFilledIndex = revState.revisions.reduce((last,r,i) => r.date !== null ? i : last, -1);
        revState.revisions.forEach((rev, index) => {
            const boxState = revGetBoxClass(index); const isLastFilled = index === lastFilledIndex && rev.date !== null; const clickable = boxState === 'editable' || isLastFilled;
            const box = document.createElement('div'); box.className = `c5-date-box ${isLastFilled ? 'filled' : boxState}`;
            if (clickable) box.onclick = () => revOpenCalendar(index);
            const topLabel = document.createElement('div'); topLabel.className = 'c5-box-top'; topLabel.textContent = revOrdinal(index+1); box.appendChild(topLabel);
            const dateEl = document.createElement('div'); dateEl.className = 'c5-box-date'; dateEl.textContent = rev.date || ''; box.appendChild(dateEl);
            if (rev.date && rev.year) { const bottomLabel = document.createElement('div'); bottomLabel.className = 'c5-box-bottom'; bottomLabel.textContent = rev.year; box.appendChild(bottomLabel); }
            grid.appendChild(box);
        });
    }

    function revOpenCalendar(index) {
        revState._editingIndex = index; const existing = revState.revisions[index]; const today = revGetToday();
        revState._calSelectedDate = (existing.date && existing.year) ? revParseDateStr(existing.date, existing.year) : null;
        revState._calYear = today.getFullYear(); revState._calMonth = today.getMonth();
        const title = document.getElementById('smRevCalTitle'); if (title) title.textContent = 'Set ' + revOrdinal(index+1) + ' Revision Date';
        const clearBtn = document.getElementById('smRevCalClearBtn'); if (clearBtn) clearBtn.style.display = existing.date ? '' : 'none';
        const o = document.getElementById('smRevCalOverlay'); if (o) o.classList.add('active');
        revRenderCalendar();
    }
    function revCloseCalendar() { const o = document.getElementById('smRevCalOverlay'); if (o) o.classList.remove('active'); revState._editingIndex = null; revState._calSelectedDate = null; }
    function revCalNav(dir) { revState._calMonth += dir; if (revState._calMonth < 0) { revState._calMonth = 11; revState._calYear--; } if (revState._calMonth > 11) { revState._calMonth = 0; revState._calYear++; } revRenderCalendar(); }
    function revRenderCalendar() {
        const year = revState._calYear, month = revState._calMonth; const today = revGetToday(); const index = revState._editingIndex; const minDate = revGetMinDate(index);
        const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
        const el = document.getElementById('smRevCalMonthLabel'); if (el) el.textContent = monthNames[month]+' '+year;
        const grid = document.getElementById('smRevCalGrid'); if (!grid) return; grid.innerHTML = '';
        ['Su','Mo','Tu','We','Th','Fr','Sa'].forEach(d => { const h = document.createElement('div'); h.className = 'rev-cal-day-hdr'; h.textContent = d; grid.appendChild(h); });
        const firstDay = new Date(year, month, 1).getDay(); const daysInMonth = new Date(year, month+1, 0).getDate();
        for (let i = 0; i < firstDay; i++) { const empty = document.createElement('div'); empty.className = 'rev-cal-day empty'; grid.appendChild(empty); }
        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(year, month, d); date.setHours(0,0,0,0);
            const isFuture = date > today; const isBeforeMin = minDate && date < minDate; const disabled = isFuture || isBeforeMin;
            const isToday = revIsSameDay(date, today); const isSelected = revState._calSelectedDate && revIsSameDay(date, revState._calSelectedDate);
            const cell = document.createElement('div'); let cls = 'rev-cal-day';
            if (disabled) cls += ' disabled'; if (isToday) cls += ' today'; if (isSelected) cls += ' selected';
            cell.className = cls; cell.textContent = d;
            if (!disabled) { cell.onclick = () => { revState._calSelectedDate = date; revRenderCalendar(); }; }
            grid.appendChild(cell);
        }
    }
    function revClearDate() {
        const index = revState._editingIndex; if (index === null) return;
        revState.revisions[index] = { date: null, year: null };
        for (let i = index+1; i < revState.revisions.length; i++) revState.revisions[i] = { date: null, year: null };
        revCloseCalendar(); revRenderBoxes(); updateSlotPosition();
    }
    function revSaveDate() {
        const index = revState._editingIndex; if (index === null) return;
        if (!revState._calSelectedDate) { alert('Please select a date.'); return; }
        const d = revState._calSelectedDate; const day = String(d.getDate()).padStart(2,'0'); const month = String(d.getMonth()+1).padStart(2,'0'); const year = d.getFullYear();
        revState.revisions[index] = { date: day+'/'+month, year };
        for (let i = index+1; i < revState.revisions.length; i++) { const next = revState.revisions[i]; if (next.date) { const nextDate = revParseDateStr(next.date, next.year); if (nextDate && nextDate <= d) revState.revisions[i] = { date: null, year: null }; } }
        revCloseCalendar(); revRenderBoxes(); updateSlotPosition();
    }

    // ===== CONFIRM / CLOSE =====
    function onConfirm() {
        confirmedRevCounts[activeSeries] = { ...wkRevCounts[activeSeries] };
        confirmedRPW[activeSeries] = seriesRPW[activeSeries] || 1;
        confirmedPerSlotRPW[activeSeries] = { ...perSlotRPW[activeSeries] };
        if (_onSaveCallback) {
            const resultRevisions = revState.revisions.map(r => ({ date: r.date || null, year: r.year || null }));
            const penaltyEl = document.getElementById('smPenaltyVal');
            const graceEl = document.getElementById('smGraceVal');
            _onSaveCallback({
                revisions: resultRevisions,
                scheduleType: activeSeries,
                scheduleN: regularInterval,
                smSlotCount: slotCount,
                smGrace: graceEl ? parseInt(graceEl.textContent) : 0,
                smPenalty: penaltyEl ? parseInt(penaltyEl.textContent) : 1,
                smMissedMode: missedMode,
                smCustomGaps: customGaps.slice(),
                smRpw: seriesRPW[activeSeries] || 1,
                smPerSlotRpw: { ...perSlotRPW[activeSeries] },
            });
        }
        closeModal();
    }

    function closeModal() {
        const o = document.getElementById('smPageOverlay');
        if (o) { o.classList.remove('active'); }
        _onSaveCallback = null;
    }

    // ===== INIT MODAL UI =====
    function initModalUI(mode) {
        buildSchedLeft(); buildInfoRows();
        // Derive start week from first revision
        const firstRev = revState.revisions.find(r => r.date && r.year);
        if (firstRev) {
            const [d, m] = firstRev.date.split('/').map(Number);
            const firstDate = new Date(firstRev.year, m-1, d); firstDate.setHours(0,0,0,0);
            const fy = firstDate.getFullYear(), fm = firstDate.getMonth();
            const isoW = getISOWeek(firstDate), isoY = getISOWeekYear(firstDate);
            const fWeeks = getMonthWeeks(fy, fm);
            for (let wi = 0; wi < fWeeks.length; wi++) {
                if (getISOWeek(fWeeks[wi].monday) === isoW && getISOWeekYear(fWeeks[wi].monday) === isoY) { startWeek = { year: fy, month: fm, weekIdx: wi }; break; }
            }
        } else { startWeek = { year: CURRENT_YEAR, month: CURRENT_MONTH, weekIdx: CURRENT_WEEK_IDX }; }
        customEndWeek = offsetWeeks(4);
        const s = SERIES.find(x => x.key === activeSeries);
        slotCount = s ? s.defaultSlots : 18;
        // Reset wkRevCounts for current series
        if (['prime','fibonacci','triangular'].includes(activeSeries)) { wkRevCounts[activeSeries] = buildDefaultRevCounts(); }
        // Reset UI steppers
        const sv = document.getElementById('smSlotsVal'); if (sv) sv.textContent = slotCount;
        const iv = document.getElementById('smIntervalVal'); if (iv) iv.textContent = regularInterval;
        const rv = document.getElementById('smRpwVal'); if (rv) rv.textContent = 1;
        const gv = document.getElementById('smGraceVal'); if (gv) gv.textContent = 0;
        const pv = document.getElementById('smPenaltyVal'); if (pv) pv.textContent = 1;
        if (s) { updateStepperStates('smSlotsVal', slotCount, 1, s.maxSlots || s.gaps.length || 52); }
        updateStepperStates('smIntervalVal', regularInterval, 1, 52);
        updateStepperStates('smRpwVal', 1, 1, 7);
        updateStepperStates('smGraceVal', 0, 0, 4);
        updateStepperStates('smPenaltyVal', 1, 0, 4);
        const stwv = document.getElementById('smStartWeekVal'); if (stwv) stwv.textContent = formatWeekLabel(startWeek);
        const ewv = document.getElementById('smEndWeekVal'); if (ewv) ewv.textContent = formatWeekLabel(customEndWeek);
        const rb = document.getElementById('smRegularBlock'); if (rb) rb.style.display = activeSeries === 'regular' ? '' : 'none';
        const cb = document.getElementById('smCustomGapsBlock'); if (cb) cb.style.display = activeSeries === 'custom' ? '' : 'none';
        const mb = document.getElementById('smMissedBlock'); if (mb) mb.style.display = 'none';
        const fs = document.getElementById('smFooterSelected'); if (fs) fs.textContent = s ? s.name : '';
        // Reset radio buttons
        document.querySelectorAll('#smPageOverlay .radio-row').forEach(r => r.classList.remove('active'));
        const noHunt = document.querySelector('#smPageOverlay .radio-row[data-mode="no-hunt"]'); if (noHunt) noHunt.classList.add('active');
        missedMode = 'no-hunt';
        // Make sure correct tab is shown
        const ps = document.getElementById('smPanelSchedule'); const pi = document.getElementById('smPanelInfo');
        if (ps) ps.classList.add('active'); if (pi) pi.classList.remove('active');
        document.querySelectorAll('#smPageOverlay .sm-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'schedule'));
        updateWeekMap(); updateSeriesDisplay(); revRenderBoxes();
    }

    // ===== PUBLIC API =====

    window.openSeriesModal = function(config) {
        _onSaveCallback = config.onSave || null;
        // Load revisions from column5 into revState
        const srcRevisions = config.revisions || [];
        const boxCount = Math.max(40, srcRevisions.length);
        revState.revisions = Array(boxCount).fill(null).map((_, i) => {
            const r = srcRevisions[i];
            return r ? { date: r.date || null, year: r.year || null } : { date: null, year: null };
        });
        revState.totalSlots = boxCount; revState.activatedCount = boxCount;
        // Set series
        activeSeries = config.scheduleType || 'prime';
        if (config.mode === 'custom') activeSeries = 'custom';
        regularInterval = config.scheduleN || 4;
        if (config.smCustomGaps) customGaps = config.smCustomGaps.slice();
        seriesRPW[activeSeries] = (config.smRpw !== undefined) ? Number(config.smRpw) : 1;
        perSlotRPW[activeSeries] = config.smPerSlotRpw ? { ...config.smPerSlotRpw } : (['prime','fibonacci','triangular'].includes(activeSeries) ? {1:2,2:2,3:2} : {});
        confirmedRPW[activeSeries] = seriesRPW[activeSeries];
        confirmedPerSlotRPW[activeSeries] = { ...perSlotRPW[activeSeries] };
        // Show overlay
        const overlay = document.getElementById('smPageOverlay');
        if (!overlay) { console.warn('Series modal HTML not found in page'); return; }
        overlay.classList.add('active');
        initModalUI(config.mode || 'settings');
    };

    window.closeSeriesModal = function() { closeModal(); };

    window.smGetCurrentWeekBadge = function(sectionData) {
        const badges = computeBadgesPure(sectionData.revisions, sectionData.scheduleType, sectionData);
        const todayKey = weekKeyFromDate(_today);
        return badges[todayKey] || null;
    };

    window.smGetNextSlots = function(sectionData) {
        const badges = computeBadgesPure(sectionData.revisions, sectionData.scheduleType, sectionData);
        const proj = badges._projectionState; if (!proj) return [];

        // Save/restore needed for buildFutureSlotSet which uses global state
        const savedRevisions = revState.revisions.slice();
        const savedActiveSeries = activeSeries; const savedSlotCount = slotCount;
        const savedInterval = regularInterval; const savedMissedMode = missedMode;
        const savedStartWeek = { ...startWeek }; const savedCustomGaps = customGaps.slice();
        const saved_slotBadges = _slotBadges; const saved_weekSlotMap = _weekSlotMap;

        // Apply section data to state
        revState.revisions = (sectionData.revisions || []).map(r => ({ date: r ? r.date || null : null, year: r ? r.year || null : null }));
        while (revState.revisions.length < 40) revState.revisions.push({ date: null, year: null });
        activeSeries = sectionData.scheduleType || 'prime';
        const savedSeriesRPWVal = seriesRPW[activeSeries];
        const savedPerSlotRPWVal = { ...perSlotRPW[activeSeries] };
        seriesRPW[activeSeries] = (sectionData.smRpw !== undefined) ? Number(sectionData.smRpw) : 1;
        perSlotRPW[activeSeries] = sectionData.smPerSlotRpw ? { ...sectionData.smPerSlotRpw } : (['prime','fibonacci','triangular'].includes(activeSeries) ? {1:2,2:2,3:2} : {});
        regularInterval = sectionData.scheduleN || 4;
        missedMode = sectionData.smMissedMode || 'no-hunt';
        if (sectionData.smCustomGaps) customGaps = sectionData.smCustomGaps.slice();
        const s = SERIES.find(x => x.key === activeSeries);
        slotCount = sectionData.smSlotCount || (s ? s.defaultSlots : 18) || 18;
        const firstRev = revState.revisions.find(r => r.date && r.year);
        if (firstRev) {
            const [d, m] = firstRev.date.split('/').map(Number);
            const firstDate = new Date(firstRev.year, m-1, d); firstDate.setHours(0,0,0,0);
            const fy = firstDate.getFullYear(), fm = firstDate.getMonth();
            const isoW = getISOWeek(firstDate), isoY = getISOWeekYear(firstDate);
            const fWeeks = getMonthWeeks(fy, fm);
            for (let wi = 0; wi < fWeeks.length; wi++) {
                if (getISOWeek(fWeeks[wi].monday) === isoW && getISOWeekYear(fWeeks[wi].monday) === isoY) { startWeek = { year: fy, month: fm, weekIdx: wi }; break; }
            }
        } else startWeek = { year: CURRENT_YEAR, month: CURRENT_MONTH, weekIdx: CURRENT_WEEK_IDX };
        _slotBadges = badges; _weekSlotMap = {};

        const futureSet = buildFutureSlotSet();
        const slots = [];
        futureSet.forEach(key => {
            const slotIdx = _weekSlotMap[key];
            const [y, m, wi] = key.split('-').map(Number);
            const weeks = getMonthWeeks(y, m);
            if (weeks[wi]) { const isoW = getISOWeek(weeks[wi].monday); const isoY = getISOWeekYear(weeks[wi].monday); slots.push({ week: isoW, year: isoY, slot: slotIdx || 0, rpw: getFinalSlotRPW(slotIdx || 0) }); }
        });
        slots.sort((a,b) => a.year !== b.year ? a.year - b.year : a.week - b.week);

        // Restore
        seriesRPW[activeSeries] = savedSeriesRPWVal; perSlotRPW[activeSeries] = savedPerSlotRPWVal;
        revState.revisions = savedRevisions; activeSeries = savedActiveSeries; slotCount = savedSlotCount;
        regularInterval = savedInterval; missedMode = savedMissedMode; startWeek = savedStartWeek;
        customGaps = savedCustomGaps; _slotBadges = saved_slotBadges; _weekSlotMap = saved_weekSlotMap;
        return slots;
    };

    // Expose functions for onclick handlers in HTML
    window.smSwitchTab = switchTab;
    window.smSetWmapView = setWmapView;
    window.smStepSlots = stepSlots;
    window.smStepGrace = stepGrace;
    window.smStepPenalty = stepPenalty;
    window.smStepRPW = stepRPW;
    window.smStepInterval = stepInterval;
    window.smMissedSelect = missedSelect;
    window.smOpenWeekPicker = openWeekPicker;
    window.smCloseWeekPicker = closeWeekPicker;
    window.smHandleWkOverlayClick = handleWkOverlayClick;
    window.smWkNavMonth = wkNavMonth;
    window.smConfirmWeekPicker = confirmWeekPicker;
    window.smOpenNumPicker = openNumPicker;
    window.smCancelNumPicker = cancelNumPicker;
    window.smConfirmNumPicker = confirmNumPicker;
    window.smHandleNumPickerOverlayClick = handleNumPickerOverlayClick;
    window.smRevCalNav = revCalNav;
    window.smRevCloseCalendar = revCloseCalendar;
    window.smRevClearDate = revClearDate;
    window.smRevSaveDate = revSaveDate;
    window.smSelectSeries = selectSeries;
    window.smOnConfirm = onConfirm;
    window.smCloseModal = closeModal;

})();
