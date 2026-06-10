// editor.js - Editor Window for Column 3

// ===== STATE =====
let c3CurrentMode = 'edit';
let c3TableBorder = true;
let c3ActiveCell = null;
let c3ActiveTable = null;
let c3SavedSelection = null;
let c3BulletTargetLI = null;
let c3EditorContext = null; // { sectionId, tab, levelId, template, editing, viewOnly }

// ===== UNDO/REDO STACK =====
let c3UndoStack = [];
let c3RedoStack = [];

function c3SnapshotState() {
    const body = document.getElementById('c3EditorModalBody');
    if (!body) return;
    const snapshot = body.innerHTML;
    c3UndoStack.push(snapshot);
    if (c3UndoStack.length > 50) c3UndoStack.shift();
    c3RedoStack = [];
    c3UpdateUndoRedoBtns();
}

function c3Undo() {
    if (c3UndoStack.length === 0) return;
    const body = document.getElementById('c3EditorModalBody');
    c3RedoStack.push(body.innerHTML);
    body.innerHTML = c3UndoStack.pop();
    c3EditorContext._lastActiveCell = null;
    c3EditorContext._lastActiveRow = null;
    updateCellRowButtons();
    c3UpdateUndoRedoBtns();
}

function c3Redo() {
    if (c3RedoStack.length === 0) return;
    const body = document.getElementById('c3EditorModalBody');
    c3UndoStack.push(body.innerHTML);
    body.innerHTML = c3RedoStack.pop();
    c3EditorContext._lastActiveCell = null;
    c3EditorContext._lastActiveRow = null;
    updateCellRowButtons();
    c3UpdateUndoRedoBtns();
}

function c3UpdateUndoRedoBtns() {
    const undoBtn = document.getElementById('c3UndoBtn');
    const redoBtn = document.getElementById('c3RedoBtn');
    if (undoBtn) { undoBtn.disabled = c3UndoStack.length === 0; undoBtn.style.opacity = c3UndoStack.length === 0 ? '0.3' : '1'; }
    if (redoBtn) { redoBtn.disabled = c3RedoStack.length === 0; redoBtn.style.opacity = c3RedoStack.length === 0 ? '0.3' : '1'; }
}

document.addEventListener('keydown', (e) => {
    const overlay = document.getElementById('c3EditorOverlay');
    if (!overlay || !overlay.classList.contains('active')) return;
    if (e.ctrlKey && e.key === 'z') { e.preventDefault(); c3Undo(); }
    if (e.ctrlKey && e.key === 'y') { e.preventDefault(); c3Redo(); }
});

// ===== OPEN EDITOR =====
function openEditorWindow(context) {
    c3EditorContext = context;
    c3CurrentMode = context.viewOnly ? 'view' : 'edit';

    // Set level switcher
    const levelDef = NOTES_LEVELS.find(l => l.id === context.levelId);
    const label = levelDef ? levelDef.label : context.levelId;
    const labelEl = document.getElementById('c3LevelLabel');
    if (labelEl) labelEl.textContent = label;
    // Mark selected option
    document.querySelectorAll('.c3-level-option').forEach(opt => {
        opt.classList.toggle('selected', opt.dataset.level === context.levelId);
    });
    // Store selected level (starts as current)
    c3EditorContext._selectedLevelId = context.levelId;

    const overlay = document.getElementById('c3EditorOverlay');
    const editor = document.getElementById('c3EditorModalBody');
    editor.innerHTML = '';
    c3UndoStack = [];
    c3RedoStack = [];
    c3UpdateUndoRedoBtns();

    // Determine if plain or cornell
    const isPlain = context.template === 'plain' || isPlainContent(context);
    const cellAddRow = document.getElementById('c3CellAddRow');
    if (cellAddRow) cellAddRow.style.display = isPlain ? 'none' : 'flex';
    const cornellBtns = document.getElementById('c3CornellToolbarBtns');
    const cellShadingWrap = document.getElementById('c3CellShadingWrap');
    if (cornellBtns) cornellBtns.style.display = isPlain ? 'none' : 'flex';
    if (cellShadingWrap) cellShadingWrap.style.display = isPlain ? 'none' : 'flex';

    // Load existing content if editing
    if (context.editing || context.viewOnly) {
        loadEditorContent(context, isPlain);
    } else {
        // New content
        if (!isPlain) {
            editor.setAttribute('contenteditable', 'false');
            // Auto-add first cornell cell
            c3AddCell('cornell');
        } else {
            editor.setAttribute('contenteditable', 'true');
        }
    }

    switchEditorMode(c3CurrentMode);
    overlay.classList.add('active');
    updateCellRowButtons();
}

function isPlainContent(context) {
    const levelData = getLevelData(context.sectionId, context.tab, context.levelId);
    const v = levelData.versions[levelData.currentVersion];
    return v && v.template === 'plain';
}

// ===== LOAD CONTENT INTO EDITOR =====
function loadEditorContent(context, isPlain) {
    const levelData = getLevelData(context.sectionId, context.tab, context.levelId);
    const v = levelData.versions[levelData.currentVersion];
    const editor = document.getElementById('c3EditorModalBody');

    if (!v) return;

    if (isPlain || v.template === 'plain') {
        editor.setAttribute('contenteditable', 'true');
        editor.innerHTML = v.html || '';
    } else {
        editor.setAttribute('contenteditable', 'false');
        if (v.cells) c3DeserializeCells(v.cells);
    }
}

// ===== LEVEL SWITCHER =====
function toggleLevelDropdown() {
    document.getElementById('c3LevelMenu').classList.toggle('active');
}

function selectEditorLevel(levelId) {
    if (!c3EditorContext) return;
    c3EditorContext._selectedLevelId = levelId;
    const levelDef = NOTES_LEVELS.find(l => l.id === levelId);
    const label = levelDef ? levelDef.label : levelId;
    document.getElementById('c3LevelLabel').textContent = label;
    document.querySelectorAll('.c3-level-option').forEach(opt => {
        opt.classList.toggle('selected', opt.dataset.level === levelId);
    });
    document.getElementById('c3LevelMenu').classList.remove('active');
}

// ===== CLOSE EDITOR =====
function closeEditorModal() {
    document.getElementById('c3EditorOverlay').classList.remove('active');
    c3CurrentMode = 'edit';
    c3EditorContext = null;
    c3SelMode = null;
    document.querySelectorAll('.c3-tbl-btn.sel-mode').forEach(b => b.classList.remove('active'));
    c3ClearSelection();
}

function closeTextEditor() {
    // Cancel — check if empty and restore if needed
    closeEditorModal();
    if (c3EditorContext) {
        const panel = document.getElementById('c3TabPanel_' + (c3EditorContext.tab || 'notes'));
        if (panel) {
            if (c3EditorContext.tab === 'notes') {
                renderNotesTab(panel, c3EditorContext.sectionId);
            } else {
                renderSimpleTab(panel, c3EditorContext.sectionId, c3EditorContext.tab);
            }
        }
    }
}

function saveTextEditorAsNew() {
    if (!c3EditorContext) return;
    const { sectionId, tab, levelId } = c3EditorContext;
    const targetLevelId = c3EditorContext._selectedLevelId || levelId;
    const editor = document.getElementById('c3EditorModalBody');

    const isPlain = editor.getAttribute('contenteditable') === 'true';
    let newVersion;
    if (isPlain) {
        newVersion = { template: 'plain', html: editor.innerHTML };
    } else {
        newVersion = { template: 'cornell', cells: c3SerializeCells() };
    }

    // Scenario 4: different level → COPY (original untouched, append to target)
    const targetData = getLevelData(sectionId, tab, targetLevelId);
    targetData.versions.push(newVersion);
    targetData.currentVersion = targetData.versions.length - 1;

    saveC3State();
    closeEditorModal();

    const panel = document.getElementById('c3TabPanel_' + tab);
    if (panel) {
        const levelDef = NOTES_LEVELS.find(l => l.id === targetLevelId);
        const labelText = levelDef ? levelDef.label : (tab.charAt(0).toUpperCase() + tab.slice(1));
        renderContentState(panel, sectionId, tab, targetLevelId, labelText);
    }

    if (typeof renderC3Footer === 'function') renderC3Footer(sectionId);
    if (typeof renderC5LabelStates === 'function') renderC5LabelStates();
    if (typeof renderC5 === 'function') renderC5();
}

// ===== SAVE EDITOR =====
function saveTextEditor() {
    if (!c3EditorContext) return;
    const { sectionId, tab, levelId } = c3EditorContext;
    const targetLevelId = c3EditorContext._selectedLevelId || levelId;
    const editor = document.getElementById('c3EditorModalBody');
    const levelData = getLevelData(sectionId, tab, levelId);

    const isPlain = editor.getAttribute('contenteditable') === 'true';
    let newVersion;
    if (isPlain) {
        newVersion = { template: 'plain', html: editor.innerHTML };
    } else {
        newVersion = { template: 'cornell', cells: c3SerializeCells() };
    }

    if (targetLevelId !== levelId) {
        // Scenario 3: different level → MOVE
        // Remove from original level
        if (c3EditorContext.editing && levelData.currentVersion >= 0) {
            levelData.versions.splice(levelData.currentVersion, 1);
            levelData.currentVersion = levelData.versions.length > 0
                ? Math.max(0, levelData.currentVersion - 1)
                : -1;
        }
        // Append to target level
        const targetData = getLevelData(sectionId, tab, targetLevelId);
        targetData.versions.push(newVersion);
        targetData.currentVersion = targetData.versions.length - 1;
    } else {
        // Same level — existing behavior
        if (c3EditorContext.editing && levelData.currentVersion >= 0) {
            levelData.versions[levelData.currentVersion] = newVersion;
        } else {
            levelData.versions.push(newVersion);
            levelData.currentVersion = levelData.versions.length - 1;
        }
    }

    saveC3State();
    closeEditorModal();

    // Re-render the tab at target level
    const panel = document.getElementById('c3TabPanel_' + tab);
    if (panel) {
        const levelDef = NOTES_LEVELS.find(l => l.id === targetLevelId);
        const labelText = levelDef ? levelDef.label : (tab.charAt(0).toUpperCase() + tab.slice(1));
        renderContentState(panel, sectionId, tab, targetLevelId, labelText);
    }

    if (typeof renderC3Footer === 'function') renderC3Footer(sectionId);
    if (typeof renderC5LabelStates === 'function') renderC5LabelStates();
    if (typeof renderC5 === 'function') renderC5();
}

// ===== VIEW MODE =====
function openViewMode() {
    switchEditorMode('view');
}

function switchEditorMode(mode) {
    c3CurrentMode = mode;
    const cellAddRow = document.getElementById('c3CellAddRow');
    const editBody   = document.getElementById('c3EditorModalBody');
    const viewPanel  = document.getElementById('c3EditorViewPanel');
    const currentScroll = (mode === 'view' ? editBody : viewPanel);
    const savedScroll = currentScroll ? currentScroll.scrollTop : 0;
    const footer     = document.getElementById('c3EditorModalFooter');
    const header     = document.getElementById('c3EditorModalHeader');
    const iconEdit   = document.getElementById('c3ModeIconEdit');
    const iconView   = document.getElementById('c3ModeIconView');

    const cornellBtns = document.getElementById('c3CornellToolbarBtns');
    const cellShadingWrap = document.getElementById('c3CellShadingWrap');
    const toolbarRow1 = document.querySelector('.c3-editor-toolbar-row1');

    if (mode === 'view') {
        iconEdit && iconEdit.classList.remove('active');
        iconView && iconView.classList.add('active');
        buildViewPanel(viewPanel, editBody);
        viewPanel.classList.add('active');
        editBody.style.display = 'none';
        if (cellAddRow) cellAddRow.style.display = 'none';
        if (toolbarRow1) toolbarRow1.style.display = 'none';
        if (cornellBtns) cornellBtns.style.display = 'none';
        if (cellShadingWrap) cellShadingWrap.style.display = 'none';
        if (footer) footer.style.display = 'none';
        if (header) header.style.display = 'block';
    } else {
        iconEdit && iconEdit.classList.add('active');
        iconView && iconView.classList.remove('active');
        viewPanel.classList.remove('active');
        editBody.style.display = 'block';
        const isPlain = editBody.getAttribute('contenteditable') === 'true';
        if (toolbarRow1) toolbarRow1.style.display = 'flex';
        if (cellAddRow) cellAddRow.style.display = isPlain ? 'none' : 'flex';
        if (cornellBtns) cornellBtns.style.display = isPlain ? 'none' : 'flex';
        if (cellShadingWrap) cellShadingWrap.style.display = isPlain ? 'none' : 'flex';
        if (footer) footer.style.display = 'flex';
        if (header) header.style.display = 'block';
        if (c3EditorContext && c3EditorContext.viewOnly) {
            c3EditorContext.editing = true;
        }
    }
    setTimeout(() => {
        const target = mode === 'view' ? viewPanel : editBody;
        if (target) target.scrollTop = savedScroll;
    }, 0);
}

function buildViewPanel(viewPanel, editBody) {
    const isPlain = editBody.getAttribute('contenteditable') === 'true';
    let html = '';

    if (isPlain) {
        html = editBody.innerHTML;
    } else {
        const cells = Array.from(editBody.querySelectorAll('.c3-editor-cell'));
        cells.forEach(cell => {
            const type = cell.dataset.type;
            const rows = Array.from(cell.querySelectorAll(':scope > .c3-cell-row'));

            if (type === 'cornell') {
                html += `<div style="border:1px solid var(--border-default);border-radius:8px;margin:8px 0;overflow:hidden;">`;
                rows.forEach(row => {
                    const left  = row.querySelector('.c3-cornell-left')?.innerHTML || '';
                    const right = row.querySelector('.c3-cornell-right')?.innerHTML || '';
                    const bgL = row.querySelector('.c3-cornell-left')?.style.background || 'var(--bg-secondary)';
                    const bgR = row.querySelector('.c3-cornell-right')?.style.background || '';
                    html += `<div style="display:flex;border-bottom:1px solid var(--border-default);">
                        <div style="width:30%;border-right:1px solid var(--border-default);padding:10px 12px;font-weight:600;font-size:14px;color:var(--text-primary);text-align:right;background:${bgL};min-height:48px;">${left}</div>
                        <div style="flex:1;padding:10px 12px;font-size:14px;font-weight:500;color:var(--text-primary);${bgR ? `background:${bgR};` : ''}min-height:48px;">${right}</div>
                    </div>`;
                });
                html += `</div>`;
            } else if (type === 'header-cornell') {
                html += `<div style="border:1px solid var(--border-default);border-radius:8px;margin:8px 0;overflow:hidden;">`;
                rows.forEach(row => {
                    const left  = row.querySelector('.c3-cornell-left')?.innerHTML || '';
                    const right = row.querySelector('.c3-cornell-right')?.innerHTML || '';
                    const bgL = row.querySelector('.c3-cornell-left')?.style.background || 'var(--bg-active)';
                    const bgR = row.querySelector('.c3-cornell-right')?.style.background || '';
                    html += `<div style="display:flex;border-bottom:1px solid var(--border-default);">
                        <div style="width:30%;border-right:1px solid var(--border-default);padding:10px 12px;font-weight:600;font-size:14px;color:var(--text-primary);text-align:right;background:${bgL};min-height:48px;">${left}</div>
                        <div style="flex:1;padding:10px 12px;font-size:14px;font-weight:500;color:var(--text-primary);${bgR ? `background:${bgR};` : ''}min-height:48px;">${right}</div>
                    </div>`;
                });
                html += `</div>`;
            } else if (type === 'code') {
                html += `<div style="background:var(--bg-code);border:1px solid var(--border-default);border-radius:8px;margin:8px 0;overflow:hidden;font-family:'Courier New',monospace;font-size:13px;color:var(--text-secondary);">`;
                rows.forEach(row => {
                    const content = row.querySelector('.c3-cell-body')?.innerHTML || '';
                    const bg = row.querySelector('.c3-cell-body')?.style.background || '';
                    html += `<div style="padding:10px 12px;border-bottom:1px solid var(--border-default);min-height:48px;${bg ? `background:${bg};` : ''}">${content}</div>`;
                });
                html += `</div>`;
            } else if (type === 'header') {
                html += `<div class="c3-view-header-cell" style="overflow:hidden;padding:0;">`;
                rows.forEach(row => {
                    const content = row.querySelector('.c3-cell-body')?.innerHTML || '';
                    const bg = row.querySelector('.c3-cell-body')?.style.background || '';
                    html += `<div style="padding:10px 12px;border-bottom:1px solid rgba(255,255,255,0.1);min-height:48px;${bg ? `background:${bg};` : ''}">${content}</div>`;
                });
                html += `</div>`;
            } else {
                html += `<div style="border:1px solid var(--border-default);border-radius:8px;margin:8px 0;overflow:hidden;">`;
                rows.forEach(row => {
                    const content = row.querySelector('.c3-cell-body')?.innerHTML || '';
                    const bg = row.querySelector('.c3-cell-body')?.style.background || '';
                    html += `<div style="padding:10px 12px;font-size:15px;color:var(--text-primary);border-bottom:1px solid var(--border-default);min-height:48px;${bg ? `background:${bg};` : ''}">${content}</div>`;
                });
                html += `</div>`;
            }
        });
    }

    // Fix table borders
    const temp = document.createElement('div');
    temp.innerHTML = html;
    temp.querySelectorAll('table').forEach(t => {
        // Wrap in a div for border + rounded corners
        const wrapper = document.createElement('div');
        wrapper.className = 'c3-table-wrap';
        t.parentNode.insertBefore(wrapper, t);
        wrapper.appendChild(t);

        t.style.borderCollapse = 'separate';
        t.style.borderSpacing = '0';
        t.style.width = '100%';
        t.style.tableLayout = 'fixed';
        t.style.margin = '0';

        const allRows = Array.from(t.querySelectorAll('tr'));
        const isManual = t.classList.contains('manual-table');
        allRows.forEach((row, ri) => {
            const cells = Array.from(row.querySelectorAll('td, th'));
            cells.forEach((cell, ci) => {
                cell.style.padding = '6px 8px';
                cell.style.height = '40px';
                cell.style.borderRight = ci < cells.length - 1 ? '1px solid var(--border-default)' : 'none';
                cell.style.borderBottom = ri < allRows.length - 1 ? '1px solid var(--border-default)' : 'none';
                cell.style.borderTop = 'none';
                cell.style.borderLeft = 'none';
                if (isManual) {
                    if (ri === 0) {
                        cell.style.background = 'var(--bg-active)';
                        cell.style.fontWeight = '600';
                    } else if (ri % 2 === 0) {
                        cell.style.background = 'var(--bg-hover)';
                    } else {
                        cell.style.background = 'var(--bg-primary)';
                    }
                }
            });
        });
    });
    viewPanel.innerHTML = temp.innerHTML;
}

// ===== TOOLBAR ACTIONS =====
function c3Exec(cmd, value) {
    const editor = document.getElementById('c3EditorModalBody');

    // Browser's execCommand('insertUnorderedList') moves a middle LI to end of list.
    // LI reference captured at mousedown time (c3BulletTargetLI) before focus could shift.
    console.log('[BULLET DEBUG] c3Exec called, cmd:', cmd, 'c3BulletTargetLI:', c3BulletTargetLI);
    if (cmd === 'insertUnorderedList' && c3BulletTargetLI) {
        const li = c3BulletTargetLI;
        c3BulletTargetLI = null;
        console.log('[BULLET DEBUG] custom handler running for LI:', li.textContent.substring(0, 30));
        editor.focus();
        const ul = li.parentElement;
        const items = Array.from(ul.children);
        const idx = items.indexOf(li);
        const before = items.slice(0, idx);
        const after = items.slice(idx + 1);
        const p = document.createElement('p');
        p.innerHTML = li.innerHTML || '<br>';
        const parent = ul.parentNode;
        if (before.length > 0) {
            const bul = document.createElement('ul');
            before.forEach(i => bul.appendChild(i));
            parent.insertBefore(bul, ul);
        }
        parent.insertBefore(p, ul);
        if (after.length > 0) {
            const aul = document.createElement('ul');
            after.forEach(i => aul.appendChild(i));
            parent.insertBefore(aul, ul);
        }
        ul.remove();
        const sel = window.getSelection();
        const r = document.createRange();
        r.setStart(p.firstChild || p, 0);
        r.collapse(true);
        sel.removeAllRanges();
        sel.addRange(r);
        updateToolbarState();
        return;
    }

    editor.focus();
    restoreSelection();
    document.execCommand(cmd, false, value || null);
    updateToolbarState();
}

function c3ChangeCase(type) {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    const text = range.toString();
    if (!text) return;
    let newText;
    if (type === 'upper') newText = text.toUpperCase();
    else if (type === 'lower') newText = text.toLowerCase();
    else if (type === 'title') newText = text.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
    else if (type === 'sentence') newText = text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
    range.deleteContents();
    range.insertNode(document.createTextNode(newText));
}

// ===== CELL ROW INSERT =====
function c3InsertCellRow(direction) {
    if (!c3EditorContext || !c3EditorContext._lastActiveCell) return;
    c3SnapshotState();
    const cell = c3EditorContext._lastActiveCell;
    const type = cell.dataset.type;

    const row = buildCellRow(type);

    let rows = Array.from(cell.querySelectorAll(':scope > .c3-cell-row'));

    // If no rows exist yet, wrap existing content as first row
    if (rows.length === 0) {
        const firstRow = buildCellRow(type);
        if (type === 'cornell' || type === 'header-cornell') {
            const wrap = cell.querySelector('.c3-cornell-wrap');
            if (wrap) {
                firstRow.querySelector('.c3-cornell-left').innerHTML = wrap.querySelector('.c3-cornell-left')?.innerHTML || '';
                firstRow.querySelector('.c3-cornell-right').innerHTML = wrap.querySelector('.c3-cornell-right')?.innerHTML || '';
                wrap.remove();
            }
        } else {
            const existing = cell.querySelector('.c3-cell-body');
            if (existing) {
                firstRow.querySelector('.c3-cell-body').innerHTML = existing.innerHTML;
                existing.remove();
            }
        }
        const cellDeleteBtn = cell.querySelector('.c3-cell-delete');
        if (cellDeleteBtn) cell.insertBefore(firstRow, cellDeleteBtn);
        else cell.appendChild(firstRow);
        rows = [firstRow];
    }

    // Use tracked active row as reference, fallback to first/last
    const refRow = c3EditorContext._lastActiveRow && cell.contains(c3EditorContext._lastActiveRow)
        ? c3EditorContext._lastActiveRow
        : (direction === 'above' ? rows[0] : rows[rows.length - 1]);

    if (direction === 'above') refRow.before(row);
    else refRow.after(row);

    row.querySelector('[contenteditable]')?.focus();
}

function buildCellRow(type) {
    const row = document.createElement('div');
    row.className = 'c3-cell-row';

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'c3-cell-row-delete';
    deleteBtn.textContent = '✕';
    deleteBtn.onclick = () => { if (confirm('Delete this row?')) row.remove(); };

    if (type === 'cornell' || type === 'header-cornell') {
        const left = document.createElement('div');
        left.className = 'c3-cornell-left';
        left.contentEditable = 'true';
        const right = document.createElement('div');
        right.className = 'c3-cornell-right';
        right.contentEditable = 'true';
        attachBackspaceHandler(right);
        row.appendChild(left);
        row.appendChild(right);
    } else {
        const body = document.createElement('div');
        body.className = 'c3-cell-body' + (type === 'code' ? ' code' : '') + (type === 'header' ? ' header-cell' : '');
        body.contentEditable = 'true';
        if (type !== 'code') attachBackspaceHandler(body);
        row.appendChild(body);
    }

    row.appendChild(deleteBtn);
    return row;
}

function c3DeleteActiveCell() {
    if (!c3EditorContext || !c3EditorContext._lastActiveCell) return;
    if (confirm('Delete this entire cell?')) {
        c3SnapshotState();
        c3EditorContext._lastActiveCell.remove();
        c3EditorContext._lastActiveCell = null;
        updateCellRowButtons();
    }
}

function c3SplitCell() {
    if (!c3EditorContext || !c3EditorContext._lastActiveCell || !c3EditorContext._lastActiveRow) return;
    c3SnapshotState();
    const cell = c3EditorContext._lastActiveCell;
    const activeRow = c3EditorContext._lastActiveRow;
    const type = cell.dataset.type;
    const rows = Array.from(cell.querySelectorAll(':scope > .c3-cell-row'));
    const splitIndex = rows.indexOf(activeRow);
    if (splitIndex <= 0 || rows.length < 2) return;

    // Create new cell of same type
    const newCell = document.createElement('div');
    newCell.className = 'c3-editor-cell';
    newCell.dataset.type = type;

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'c3-cell-delete';
    deleteBtn.textContent = '✕';
    deleteBtn.onclick = () => { if (confirm('Delete this cell?')) newCell.remove(); };

    // Move rows from splitIndex onward to new cell
    const rowsToMove = rows.slice(splitIndex);
    rowsToMove.forEach(row => newCell.appendChild(row));
    newCell.appendChild(deleteBtn);

    // Insert new cell after original
    cell.after(newCell);

    // Re-attach click tracking on new cell rows
    rowsToMove.forEach(row => {
        row.addEventListener('click', () => {
            if (c3EditorContext) {
                c3EditorContext._lastActiveCell = newCell;
                c3EditorContext._lastActiveRow = row;
            }
            updateCellRowButtons();
        });
    });

    updateCellRowButtons();
}

function updateCellRowButtons() {
    const hasCell = !!(c3EditorContext && c3EditorContext._lastActiveCell);
    const above = document.getElementById('c3CellRowAbove');
    const below = document.getElementById('c3CellRowBelow');
    const del = document.getElementById('c3CellDeleteBtn');
    const split = document.getElementById('c3CellSplitBtn');
    if (above) above.disabled = !hasCell;
    if (below) below.disabled = !hasCell;
    if (del) del.disabled = !hasCell;

    // Split: enabled only if cell has 2+ rows AND active row is NOT the first row
    let canSplit = false;
    if (hasCell && c3EditorContext._lastActiveRow) {
        const cell = c3EditorContext._lastActiveCell;
        const rows = Array.from(cell.querySelectorAll(':scope > .c3-cell-row'));
        const rowIndex = rows.indexOf(c3EditorContext._lastActiveRow);
        canSplit = rows.length >= 2 && rowIndex > 0;
    }
    if (split) {
        split.disabled = !canSplit;
        split.style.opacity = canSplit ? '1' : '0.3';
    }
}

function c3LineSpacing(value) {
    if (!value) return;
    const editor = document.getElementById('c3EditorModalBody');
    editor.focus();
    document.execCommand('selectAll', false, null);
    editor.style.lineHeight = value;
}

function c3VerticalAlign(position) {
    const editor = document.getElementById('c3EditorModalBody');
    editor.focus();
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    const block = sel.getRangeAt(0).startContainer.parentElement.closest('div, p, td, th');
    if (block) block.style.verticalAlign = position;
}

function c3Indent(direction) {
    const editor = document.getElementById('c3EditorModalBody');
    editor.focus();
    restoreSelection();
    document.execCommand(direction === 'in' ? 'indent' : 'outdent', false, null);
}

// ===== BACKSPACE HANDLER (3-step: bullet → indent → merge) =====
function attachBackspaceHandler(el) {
    el.addEventListener('keydown', function(e) {
        if (e.key !== 'Backspace') return;

        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;
        const range = sel.getRangeAt(0);
        if (!range.collapsed) return;

        const anchorNode = sel.anchorNode;

        // Detect if cursor is inside a td within this el
        let tdNode = anchorNode.nodeType === 3 ? anchorNode.parentElement : anchorNode;
        let insideTd = false;
        let tdEl = null;
        while (tdNode && tdNode !== el) {
            if (tdNode.tagName === 'TD') { insideTd = true; tdEl = tdNode; break; }
            tdNode = tdNode.parentElement;
        }

        // Find the closest block element
        let block = anchorNode.nodeType === 3 ? anchorNode.parentElement : anchorNode;
        const boundary = insideTd ? tdEl : el;
        while (block && block !== boundary && !['LI','P','DIV'].includes(block.tagName)) {
            block = block.parentElement;
        }
        if (!block || block === boundary) return;

        // Check cursor is at very start of block
        const tempRange = document.createRange();
        tempRange.selectNodeContents(block);
        tempRange.setEnd(range.startContainer, range.startOffset);
        if (tempRange.toString().length > 0) return;

        if (insideTd) {
            // ===== TABLE INSIDE CORNELL: same as plain table handler =====
            if (block.tagName === 'LI') {
                e.preventDefault();
                const ul = block.parentElement;
                const p = document.createElement('p');
                p.innerHTML = block.innerHTML || '<br>';
                p.style.paddingLeft = '';
                p.classList.add('c3-debulleted');
                const liIndex = Array.from(ul.children).indexOf(block);
                block.remove();
                if (ul.children.length === 0) {
                    ul.parentNode.insertBefore(p, ul);
                    ul.remove();
                } else if (liIndex === 0) {
                    ul.parentNode.insertBefore(p, ul);
                } else {
                    ul.after(p);
                }
                const newRange = document.createRange();
                newRange.setStart(p, 0);
                newRange.collapse(true);
                sel.removeAllRanges();
                sel.addRange(newRange);
            } else if (block.tagName === 'P') {
                const inlinePadding = parseInt(block.style.paddingLeft);
                const computedPadding = parseInt(window.getComputedStyle(block).paddingLeft) || 0;
                const currentPadding = isNaN(inlinePadding) ? computedPadding : inlinePadding;
                if (currentPadding > 0 && isNaN(inlinePadding)) {
                    e.preventDefault();
                    block.style.paddingLeft = currentPadding + 'px';
                    const newRange = document.createRange();
                    newRange.setStart(block, 0);
                    newRange.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(newRange);
                } else if (currentPadding > 24) {
                    e.preventDefault();
                    block.style.paddingLeft = '24px';
                    const newRange = document.createRange();
                    newRange.setStart(block, 0);
                    newRange.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(newRange);
                } else if (currentPadding === 24) {
                    e.preventDefault();
                    block.style.paddingLeft = '0px';
                    const newRange = document.createRange();
                    newRange.setStart(block, 0);
                    newRange.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(newRange);
                }
            }
        } else {
            // ===== CORNELL CELL =====
            if (block.tagName === 'LI') {
                e.preventDefault();
                const ul = block.parentElement;
                const p = document.createElement('p');
                p.classList.add('c3-debulleted');
                let totalIndent = 0;
                let node = ul;
                while (node && node !== el) {
                    if (node.tagName === 'UL' || node.tagName === 'OL') {
                        totalIndent += (parseInt(window.getComputedStyle(node).paddingLeft) || 0)
                                     + (parseInt(window.getComputedStyle(node).marginLeft) || 0);
                    }
                    node = node.parentElement;
                }
                totalIndent += parseInt(window.getComputedStyle(block).paddingLeft) || 0;
                p.style.paddingLeft = totalIndent + 'px';
                p.innerHTML = block.innerHTML || '<br>';
                ul.after(p);
                block.remove();
                if (ul.children.length === 0) ul.remove();
                const newRange = document.createRange();
                newRange.setStart(p, 0);
                newRange.collapse(true);
                sel.removeAllRanges();
                sel.addRange(newRange);
            } else if (block.tagName === 'P') {
                const currentPadding = parseInt(block.style.paddingLeft) || 0;
                if (currentPadding > 20) {
                    e.preventDefault();
                    block.style.paddingLeft = '20px';
                    const newRange = document.createRange();
                    newRange.setStart(block, 0);
                    newRange.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(newRange);
                } else if (currentPadding === 20) {
                    e.preventDefault();
                    block.style.paddingLeft = '0px';
                    const newRange = document.createRange();
                    newRange.setStart(block, 0);
                    newRange.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(newRange);
                }
            }
        }
    });
}

function updateToolbarState() {
    const cmds = ['bold','italic','underline','strikeThrough','insertUnorderedList','insertOrderedList','justifyLeft','justifyCenter','justifyRight','justifyFull'];
    cmds.forEach(cmd => {
        const btn = document.querySelector(`[data-cmd="${cmd}"]`);
        if (btn) btn.classList.toggle('active', document.queryCommandState(cmd));
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const header = document.getElementById('c3EditorModalHeader');
    if (header) header.addEventListener('mousedown', () => saveSelection());

    const toolbar = document.querySelector('.c3-editor-toolbar-row1');
    if (toolbar) toolbar.addEventListener('mousedown', (e) => {
        saveSelection();
        c3BulletTargetLI = null;
        console.log('[BULLET DEBUG] toolbar mousedown, target:', e.target.tagName, e.target.className);
        if (e.target.closest('button')) {
            const editorEl = document.getElementById('c3EditorModalBody');
            const sel = window.getSelection();
            console.log('[BULLET DEBUG] rangeCount:', sel?.rangeCount, 'collapsed:', sel?.rangeCount > 0 ? sel.getRangeAt(0).collapsed : 'n/a');
            if (sel && sel.rangeCount > 0 && sel.getRangeAt(0).collapsed) {
                let node = sel.anchorNode;
                while (node && node !== editorEl) {
                    if (node.nodeName === 'LI') { c3BulletTargetLI = node; break; }
                    node = node.parentNode;
                }
            }
            console.log('[BULLET DEBUG] c3BulletTargetLI:', c3BulletTargetLI);
            e.preventDefault();
        }
    });

    const editor = document.getElementById('c3EditorModalBody');
    if (editor) {
        editor.addEventListener('keyup', updateToolbarState);
        editor.addEventListener('mouseup', updateToolbarState);

        let c3SnapshotTimer = null;
        let c3LastSnapshot = '';

        editor.addEventListener('keydown', function(e) {
            if (e.key !== 'Backspace') return;
            const sel = window.getSelection();
            if (!sel || sel.rangeCount === 0) return;
            const range = sel.getRangeAt(0);
            if (!range.collapsed) return;

            // Check if we're inside a td
            let node = sel.anchorNode;
            let td = null;
            while (node && node !== editor) {
                if (node.nodeName === 'TD') { td = node; break; }
                node = node.parentNode;
            }
            if (!td) return;

            // Find block element (LI or P) inside td
            let block = sel.anchorNode.nodeType === 3 ? sel.anchorNode.parentElement : sel.anchorNode;
            while (block && block !== td && !['LI','P','DIV'].includes(block.tagName)) {
                block = block.parentElement;
            }
            if (!block || block === td) return;

            // Check cursor is at start of block
            const tempRange = document.createRange();
            tempRange.selectNodeContents(block);
            tempRange.setEnd(range.startContainer, range.startOffset);
            if (tempRange.toString().length > 0) return;

            if (block.tagName === 'LI') {
                e.preventDefault();
                const ul = block.parentElement;
                const ulPadding = parseInt(window.getComputedStyle(ul).paddingLeft) || 0;
                const ulMargin = parseInt(window.getComputedStyle(ul).marginLeft) || 0;
                const totalIndent = ulPadding + ulMargin;
                const p = document.createElement('p');
                p.innerHTML = block.innerHTML || '<br>';
                p.style.paddingLeft = '';
                p.classList.add('c3-debulleted');
                // Insert p after ul (not before), then move it to replace the li position
                const liIndex = Array.from(ul.children).indexOf(block);
                block.remove();
                if (ul.children.length === 0) {
                    ul.parentNode.insertBefore(p, ul);
                    ul.remove();
                } else if (liIndex === 0) {
                    ul.parentNode.insertBefore(p, ul);
                } else {
                    ul.after(p);
                }
                const newRange = document.createRange();
                newRange.setStart(p, 0);
                newRange.collapse(true);
                sel.removeAllRanges();
                sel.addRange(newRange);
            } else if (block.tagName === 'P') {
                const inlinePadding = parseInt(block.style.paddingLeft);
                const computedPadding = parseInt(window.getComputedStyle(block).paddingLeft) || 0;
                const currentPadding = isNaN(inlinePadding) ? computedPadding : inlinePadding;
                if (currentPadding > 0 && isNaN(inlinePadding)) {
                    // First backspace after bullet removal — make indent explicit
                    e.preventDefault();
                    block.style.paddingLeft = currentPadding + 'px';
                    const newRange = document.createRange();
                    newRange.setStart(block, 0);
                    newRange.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(newRange);
                } else if (currentPadding > 24) {
                    e.preventDefault();
                    block.style.paddingLeft = '24px';
                    const newRange = document.createRange();
                    newRange.setStart(block, 0);
                    newRange.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(newRange);
                } else if (currentPadding === 24) {
                    e.preventDefault();
                    block.style.paddingLeft = '0px';
                    const newRange = document.createRange();
                    newRange.setStart(block, 0);
                    newRange.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(newRange);
                }
            }
        });

        editor.addEventListener('focus', () => {
            c3LastSnapshot = editor.innerHTML;
        }, true);

        editor.addEventListener('input', () => {
            clearTimeout(c3SnapshotTimer);
            c3SnapshotTimer = setTimeout(() => {
                if (editor.innerHTML !== c3LastSnapshot) {
                    c3UndoStack.push(c3LastSnapshot);
                    if (c3UndoStack.length > 50) c3UndoStack.shift();
                    c3RedoStack = [];
                    c3LastSnapshot = editor.innerHTML;
                    c3UpdateUndoRedoBtns();
                }
            }, 800);
        });
    }
});

// ===== COLOR PALETTE =====
const c3Colors = [
    '#000000','#1a1a1a','#333333','#4d4d4d','#666666','#808080','#999999','#ffffff',
    '#ff0000','#ff4d00','#ff9900','#ffff00','#00ff00','#00ffff','#0000ff','#ff00ff',
    '#ff6666','#ffb366','#ffff66','#66ff66','#66ffff','#6666ff','#ff66ff','#ffcccc',
    '#cc0000','#cc6600','#cc9900','#99cc00','#00cc66','#0099cc','#6600cc','#cc0099',
    '#800000','#804000','#808000','#008000','#008080','#000080','#400080','#800040'
];

function buildColorPalette(paletteEl, type) {
    paletteEl.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'c3-color-grid';
    c3Colors.forEach(color => {
        const swatch = document.createElement('div');
        swatch.className = 'c3-color-swatch';
        swatch.style.background = color;
        swatch.title = color;
        swatch.onclick = (e) => { e.stopPropagation(); applyColor(type, color); closeAllPalettes(); };
        grid.appendChild(swatch);
    });
    paletteEl.appendChild(grid);
    const sep = document.createElement('div');
    sep.className = 'c3-color-sep';
    paletteEl.appendChild(sep);
    const custom = document.createElement('button');
    custom.className = 'c3-color-custom';
    custom.innerHTML = '+ Custom Color';
    custom.onclick = (e) => {
        e.stopPropagation();
        const input = document.createElement('input');
        input.type = 'color';
        input.onchange = () => { applyColor(type, input.value); closeAllPalettes(); };
        input.click();
    };
    paletteEl.appendChild(custom);
}

function saveSelection() {
    const sel = window.getSelection();
    if (sel.rangeCount > 0) c3SavedSelection = sel.getRangeAt(0).cloneRange();
}

function restoreSelection() {
    if (c3SavedSelection) {
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(c3SavedSelection);
    }
}

function applyColor(type, color) {
    const editor = document.getElementById('c3EditorModalBody');
    editor.focus();
    restoreSelection();
    if (type === 'text') {
        c3LastTextColor = color;
        document.execCommand('foreColor', false, color);
        document.getElementById('c3TextColorBar').style.background = color;
    } else {
        c3LastHighlightColor = color;
        document.execCommand('backColor', false, color);
        document.getElementById('c3HighlightColorBar').style.background = color;
    }
}

function toggleColorPalette(type) {
    const paletteId = type === 'text' ? 'c3TextColorPalette' : 'c3HighlightColorPalette';
    const triggerId = type === 'text' ? 'c3TextColorApply' : 'c3HighlightApply';
    const palette = document.getElementById(paletteId);
    const trigger = document.getElementById(triggerId);
    const isActive = palette.classList.contains('active');
    closeAllPalettes();
    if (!isActive) {
        saveSelection();
        buildColorPalette(palette, type);
        const rect = trigger.getBoundingClientRect();
        palette.style.top = (rect.bottom + 6) + 'px';
        palette.style.left = rect.left + 'px';
        palette.classList.add('active');
    }
}

function closeAllPalettes() {
    document.querySelectorAll('.c3-color-palette').forEach(p => p.classList.remove('active'));
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('.c3-toolbar-color-wrap')) closeAllPalettes();
});

// ===== CELL TEMPLATES (Cornell) =====
function c3AddCell(type) {
    const body = document.getElementById('c3EditorModalBody');
    const cell = document.createElement('div');
    cell.className = 'c3-editor-cell';
    cell.dataset.type = type;

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'c3-cell-delete';
    deleteBtn.textContent = '✕';
    deleteBtn.onclick = () => { if (confirm('Delete this cell?')) cell.remove(); };

    const firstRow = buildCellRow(type);
    if (type === 'header') firstRow.querySelector('.c3-cell-body').classList.add('header-cell');
    cell.appendChild(firstRow);
    cell.appendChild(deleteBtn);

    const allCells = Array.from(body.querySelectorAll('.c3-editor-cell'));
    const activeCell = allCells.find(c => c.contains(document.activeElement)) || (c3EditorContext && c3EditorContext._lastActiveCell);
    if (activeCell && body.contains(activeCell)) {
        activeCell.before(cell);
    } else {
        body.appendChild(cell);
    }

    const firstEditable = cell.querySelector('[contenteditable]');
    if (firstEditable) firstEditable.focus();
}

document.addEventListener('DOMContentLoaded', () => {
    const body = document.getElementById('c3EditorModalBody');
    if (body) {
        body.addEventListener('click', (e) => {
            const clickedCell = e.target.closest('.c3-editor-cell');
            const clickedRow = e.target.closest('.c3-cell-row');
            const clickedPart = e.target.closest('.c3-cornell-left, .c3-cornell-right, .c3-cell-body');
            if (c3EditorContext) {
                c3EditorContext._lastActiveCell = clickedCell || null;
                c3EditorContext._lastActiveRow = clickedRow || null;
                c3EditorContext._lastActivePart = clickedPart || null;
            }
            updateCellRowButtons();
        });

        body.addEventListener('paste', (e) => {
            e.preventDefault();
            const text = (e.clipboardData || window.clipboardData).getData('text/plain');
            document.execCommand('insertText', false, text);
        });
    }
});

// ===== SERIALIZE / DESERIALIZE =====
function c3SerializeCells() {
    const body = document.getElementById('c3EditorModalBody');
    const cells = Array.from(body.querySelectorAll('.c3-editor-cell'));
    return cells.map(cell => {
        const type = cell.dataset.type;
        const rows = Array.from(cell.querySelectorAll('.c3-cell-row'));
        if (rows.length > 0) {
            if (type === 'cornell' || type === 'header-cornell') {
                return { type, rows: rows.map(r => ({
                    left: r.querySelector('.c3-cornell-left')?.innerHTML || '',
                    right: r.querySelector('.c3-cornell-right')?.innerHTML || '',
                    bgLeft: r.querySelector('.c3-cornell-left')?.style.background || '',
                    bgRight: r.querySelector('.c3-cornell-right')?.style.background || '',
                })) };
            } else {
                return { type, rows: rows.map(r => ({
                    content: r.querySelector('.c3-cell-body')?.innerHTML || '',
                    bg: r.querySelector('.c3-cell-body')?.style.background || '',
                })) };
            }
        }
        if (type === 'cornell' || type === 'header-cornell') {
            return { type,
                left: cell.querySelector('.c3-cornell-left')?.innerHTML || '',
                right: cell.querySelector('.c3-cornell-right')?.innerHTML || '',
                bgLeft: cell.querySelector('.c3-cornell-left')?.style.background || '',
                bgRight: cell.querySelector('.c3-cornell-right')?.style.background || '',
            };
        }
        return { type,
            content: cell.querySelector('.c3-cell-body')?.innerHTML || '',
            bg: cell.querySelector('.c3-cell-body')?.style.background || '',
        };
    });
}

function c3DeserializeCells(cells) {
    const body = document.getElementById('c3EditorModalBody');
    body.innerHTML = '';
    if (!cells || cells.length === 0) return;
    cells.forEach(cellData => {
        c3AddCell(cellData.type);
        const allCells = body.querySelectorAll('.c3-editor-cell');
        const cell = allCells[allCells.length - 1];

        if (cellData.rows && cellData.rows.length > 0) {
            // First row already created by c3AddCell — populate it
            const existingRows = Array.from(cell.querySelectorAll(':scope > .c3-cell-row'));
            cellData.rows.forEach((rowData, i) => {
                if (i === 0 && existingRows[0]) {
                    // Populate the auto-created first row
                    if (cellData.type === 'cornell' || cellData.type === 'header-cornell') {
                        existingRows[0].querySelector('.c3-cornell-left').innerHTML = rowData.left || '';
                        existingRows[0].querySelector('.c3-cornell-right').innerHTML = rowData.right || '';
                        if (rowData.bgLeft) existingRows[0].querySelector('.c3-cornell-left').style.background = rowData.bgLeft;
                        if (rowData.bgRight) existingRows[0].querySelector('.c3-cornell-right').style.background = rowData.bgRight;
                    } else {
                        existingRows[0].querySelector('.c3-cell-body').innerHTML = rowData.content || '';
                        if (rowData.bg) existingRows[0].querySelector('.c3-cell-body').style.background = rowData.bg;
                    }
                } else {
                    c3InsertCellRowInto(cell, cellData.type, rowData);
                }
            });
        } else if (cellData.type === 'cornell' || cellData.type === 'header-cornell') {
            const firstRow = cell.querySelector('.c3-cell-row');
            if (firstRow) {
                firstRow.querySelector('.c3-cornell-left').innerHTML = cellData.left || '';
                firstRow.querySelector('.c3-cornell-right').innerHTML = cellData.right || '';
                if (cellData.bgLeft) firstRow.querySelector('.c3-cornell-left').style.background = cellData.bgLeft;
                if (cellData.bgRight) firstRow.querySelector('.c3-cornell-right').style.background = cellData.bgRight;
            }
        } else {
            const bodyEl = cell.querySelector('.c3-cell-body');
            if (bodyEl) {
                bodyEl.innerHTML = cellData.content || '';
                if (cellData.bg) bodyEl.style.background = cellData.bg;
            }
        }
    });
}

function c3InsertCellRowInto(cell, type, rowData) {
    const row = document.createElement('div');
    row.className = 'c3-cell-row';

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'c3-cell-row-delete';
    deleteBtn.textContent = '✕';
    deleteBtn.onclick = () => { if (confirm('Delete this row?')) row.remove(); };

    if (type === 'cornell' || type === 'header-cornell') {
        const left = document.createElement('div');
        left.className = 'c3-cornell-left';
        left.contentEditable = 'true';
        left.innerHTML = rowData.left || '';
        if (rowData.bgLeft) left.style.background = rowData.bgLeft;
        const right = document.createElement('div');
        right.className = 'c3-cornell-right';
        right.contentEditable = 'true';
        right.innerHTML = rowData.right || '';
        if (rowData.bgRight) right.style.background = rowData.bgRight;
        attachBackspaceHandler(right);
        row.appendChild(left);
        row.appendChild(right);
    } else {
        const body = document.createElement('div');
        body.className = 'c3-cell-body' + (type === 'code' ? ' code' : '') + (type === 'header' ? ' header-cell' : '');
        body.contentEditable = 'true';
        body.innerHTML = rowData.content || '';
        if (rowData.bg) body.style.background = rowData.bg;
        if (type !== 'code') attachBackspaceHandler(body);
        row.appendChild(body);
    }

    row.appendChild(deleteBtn);
    const cellDeleteBtn = cell.querySelector('.c3-cell-delete');
    if (cellDeleteBtn) cell.insertBefore(row, cellDeleteBtn);
    else cell.appendChild(row);
}

// ===== TABLE TOOLBAR ROW 2 =====
let c3SelMode = null; // 'cell' | 'row' | 'col' | 'table'
let c3SelItems = new Set(); // selected tds, trs, or the table

function showTableToolbar(table) {
    c3ActiveTable = table;
    const row2 = document.getElementById('c3TableToolbarRow2');
    if (row2) row2.style.display = 'flex';
    c3ToggleMainJustifyBtns(true);
}

function hideTableToolbar() {
    const row2 = document.getElementById('c3TableToolbarRow2');
    if (row2) row2.style.display = 'none';
    c3ActiveTable = null;
    c3ActiveCell = null;
    c3ClearSelection();
    c3ToggleMainJustifyBtns(false);
}

function c3ClearSelection() {
    c3SelItems.forEach(el => el.classList.remove('c3-sel-highlight'));
    c3SelItems.clear();
    // Remove arrow/handle overlays
    document.querySelectorAll('.c3-row-arrow, .c3-col-arrow, .c3-table-handle').forEach(el => el.remove());
}

function c3SetSelMode(mode) {
    // Toggle off if same
    if (c3SelMode === mode) {
        c3SelMode = null;
        document.querySelectorAll('.c3-tbl-btn.sel-mode').forEach(b => b.classList.remove('active'));
        c3ClearSelection();
        return;
    }
    c3SelMode = mode;
    document.querySelectorAll('.c3-tbl-btn.sel-mode').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById('c3SelMode' + mode.charAt(0).toUpperCase() + mode.slice(1));
    if (btn) btn.classList.add('active');
    c3ClearSelection();
    if (mode === 'table' && c3ActiveTable) c3SelectWholeTable();
}

function c3SelectWholeTable() {
    if (!c3ActiveTable) return;
    c3ClearSelection();
    c3ActiveTable.querySelectorAll('td, th').forEach(cell => {
        cell.classList.add('c3-sel-highlight');
        c3SelItems.add(cell);
    });
    // Add handle
    const handle = document.createElement('div');
    handle.className = 'c3-table-handle';
    handle.title = 'Table selected';
    handle.onclick = () => c3SelectWholeTable();
    c3ActiveTable.style.position = 'relative';
    c3ActiveTable.appendChild(handle);
}

function c3HandleCellClick(e) {
    if (!c3SelMode) return;
    const td = e.target.closest('td, th');
    if (!td || !c3ActiveTable || !c3ActiveTable.contains(td)) return;
    e.stopPropagation();

    if (c3SelMode === 'cell') {
        if (c3SelItems.has(td)) {
            td.classList.remove('c3-sel-highlight');
            c3SelItems.delete(td);
        } else {
            td.classList.add('c3-sel-highlight');
            c3SelItems.add(td);
        }
    } else if (c3SelMode === 'row') {
        const row = td.closest('tr');
        const cells = Array.from(row.cells);
        const allSelected = cells.every(c => c3SelItems.has(c));
        cells.forEach(c => {
            if (allSelected) { c.classList.remove('c3-sel-highlight'); c3SelItems.delete(c); }
            else { c.classList.add('c3-sel-highlight'); c3SelItems.add(c); }
        });
    } else if (c3SelMode === 'col') {
        const colIdx = Array.from(td.parentElement.cells).indexOf(td);
        c3ActiveTable.querySelectorAll('tr').forEach(r => {
            const c = r.cells[colIdx];
            if (!c) return;
            if (c3SelItems.has(c)) { c.classList.remove('c3-sel-highlight'); c3SelItems.delete(c); }
            else { c.classList.add('c3-sel-highlight'); c3SelItems.add(c); }
        });
    } else if (c3SelMode === 'table') {
        c3SelectWholeTable();
    }
}

function c3HandleCellHover(e) {
    if (!c3SelMode || c3SelMode === 'cell' || c3SelMode === 'table') return;
    const td = e.target.closest('td, th');
    if (!td || !c3ActiveTable || !c3ActiveTable.contains(td)) return;

    document.querySelectorAll('.c3-row-arrow, .c3-col-arrow').forEach(el => el.remove());

    if (c3SelMode === 'row') {
        const arrow = document.createElement('div');
        arrow.className = 'c3-row-arrow';
        arrow.textContent = '→';
        arrow.title = 'Select row';
        const rect = td.closest('tr').getBoundingClientRect();
        const editorRect = document.getElementById('c3EditorModalBody').getBoundingClientRect();
        arrow.style.position = 'fixed';
        arrow.style.top = (rect.top + rect.height / 2 - 9) + 'px';
        arrow.style.left = (editorRect.left - 22) + 'px';
        arrow.onclick = (ev) => { ev.stopPropagation(); c3HandleCellClick({ target: td, stopPropagation: () => {} }); };
        document.body.appendChild(arrow);
    } else if (c3SelMode === 'col') {
        const colIdx = Array.from(td.parentElement.cells).indexOf(td);
        const firstCell = c3ActiveTable.rows[0]?.cells[colIdx];
        if (!firstCell) return;
        const arrow = document.createElement('div');
        arrow.className = 'c3-col-arrow';
        arrow.textContent = '↓';
        arrow.title = 'Select column';
        const rect = firstCell.getBoundingClientRect();
        arrow.style.position = 'fixed';
        arrow.style.top = (rect.top - 22) + 'px';
        arrow.style.left = (rect.left + rect.width / 2 - 9) + 'px';
        arrow.onclick = (ev) => { ev.stopPropagation(); c3HandleCellClick({ target: td, stopPropagation: () => {} }); };
        document.body.appendChild(arrow);
    }
}

function c3ApplyTblAppColor(color) {
    c3LastTblShadingColor = color;
    const bar = document.getElementById('c3TblShadingBar');
    if (bar) bar.style.background = color;
    const targets = c3SelItems.size > 0 ? Array.from(c3SelItems) : (c3ActiveCell ? [c3ActiveCell] : []);
    targets.forEach(el => el.style.background = color);
}

// Apply last used shading to selected cells or active cell
function c3TblExec(cmd) {
    const alignMap = { justifyLeft: 'left', justifyCenter: 'center', justifyRight: 'right', justifyFull: 'justify' };
    const align = alignMap[cmd];
    if (!align) return;
    const targets = c3SelItems.size > 0 ? Array.from(c3SelItems) : (c3ActiveCell ? [c3ActiveCell] : []);
    targets.forEach(cell => cell.style.textAlign = align);
}

function c3ToggleMainJustifyBtns(disabled) {
    ['justifyLeft','justifyCenter','justifyRight','justifyFull'].forEach(cmd => {
        const btn = document.querySelector(`[data-cmd="${cmd}"]`);
        if (btn) {
            btn.disabled = disabled;
            btn.style.opacity = disabled ? '0.3' : '';
            btn.style.pointerEvents = disabled ? 'none' : '';
        }
    });
}

function applyLastTblShading() {
    const color = document.getElementById('c3TblShadingBar')?.style.background;
    if (!color) return;
    const targets = c3SelItems.size > 0 ? Array.from(c3SelItems) : (c3ActiveCell ? [c3ActiveCell] : []);
    targets.forEach(el => el.style.background = color);
}

// Last used color apply functions
let c3LastTextColor = '#111827';
let c3LastHighlightColor = '#ffff00';
let c3LastCellShadingColor = 'var(--bg-active)';
let c3LastTblShadingColor = 'var(--bg-active)';

function applyLastColor(type) {
    const editor = document.getElementById('c3EditorModalBody');
    editor.focus();
    restoreSelection();
    if (type === 'text') {
        document.execCommand('foreColor', false, c3LastTextColor);
    } else {
        document.execCommand('backColor', false, c3LastHighlightColor);
    }
}

function applyLastCellShading() {
    const part = c3EditorContext && c3EditorContext._lastActivePart;
    if (part) part.style.background = c3LastCellShadingColor;
}

function getCellIndex(cell) { return Array.from(cell.parentElement.cells).indexOf(cell); }
function getRowIndex(cell) { return Array.from(cell.closest('tbody').rows).indexOf(cell.parentElement); }

document.addEventListener('DOMContentLoaded', () => {
    const editor = document.getElementById('c3EditorModalBody');
    if (!editor) return;
    editor.addEventListener('click', (e) => {
        const td = e.target.closest('td');
        if (td) {
            c3ActiveCell = td;
            showTableToolbar(td.closest('table'));
            c3HandleCellClick(e);
        } else {
            if (!e.target.closest('#c3TableToolbarRow2')) hideTableToolbar();
        }
    });
    editor.addEventListener('mouseover', (e) => c3HandleCellHover(e));
    editor.addEventListener('keyup', () => {
        if (c3ActiveCell) { const t = c3ActiveCell.closest('table'); if (t) showTableToolbar(t); }
    });
});

document.addEventListener('click', (e) => {
    if (!e.target.closest('#c3TableToolbarRow2') && !e.target.closest('#c3EditorModalBody')) hideTableToolbar();
});

document.addEventListener('click', (e) => {
    if (!e.target.closest('#c3LevelSwitcher')) {
        const menu = document.getElementById('c3LevelMenu');
        if (menu) menu.classList.remove('active');
    }
});

function c3TableInsertRow(direction) {
    if (!c3ActiveCell) return;
    const tbody = c3ActiveTable.querySelector('tbody');
    const colCount = tbody.rows[0].cells.length;
    const rowIndex = getRowIndex(c3ActiveCell);
    const newRow = tbody.insertRow(direction === 'above' ? rowIndex : rowIndex + 1);
    for (let i = 0; i < colCount; i++) newRow.insertCell(i).innerHTML = '&nbsp;';
    showTableToolbar(c3ActiveTable);
}

function c3TableInsertCol(direction) {
    if (!c3ActiveCell) return;
    const colIndex = getCellIndex(c3ActiveCell);
    const insertAt = direction === 'left' ? colIndex : colIndex + 1;
    c3ActiveTable.querySelectorAll('tr').forEach(row => row.insertCell(insertAt).innerHTML = '&nbsp;');
    showTableToolbar(c3ActiveTable);
}

function c3TableDeleteRow() {
    if (!c3ActiveCell) return;
    const tbody = c3ActiveTable.querySelector('tbody');
    if (tbody.rows.length <= 1) { c3TableDelete(); return; }
    tbody.deleteRow(getRowIndex(c3ActiveCell));
    c3ActiveCell = null;
    showTableToolbar(c3ActiveTable);
}

function c3TableDeleteCol() {
    if (!c3ActiveCell) return;
    const colIndex = getCellIndex(c3ActiveCell);
    const rows = c3ActiveTable.querySelectorAll('tr');
    if (rows[0].cells.length <= 1) { c3TableDelete(); return; }
    rows.forEach(row => row.deleteCell(colIndex));
    c3ActiveCell = null;
    showTableToolbar(c3ActiveTable);
}

function c3TableDelete() { if (c3ActiveTable) { c3ActiveTable.remove(); hideTableToolbar(); } }

function c3TableAlign(position) {
    if (!c3ActiveCell) return;
    c3ActiveCell.style.verticalAlign = position === 'middle' ? 'middle' : position === 'bottom' ? 'bottom' : 'top';
}

function c3TableSplit(withHeader) {
    if (!c3ActiveCell || !c3ActiveTable) return;
    const tbody = c3ActiveTable.querySelector('tbody');
    const rows = Array.from(tbody.rows);
    const rowIndex = getRowIndex(c3ActiveCell);
    if (rowIndex === 0) { alert('Cannot split at first row.'); return; }
    const secondRows = rows.slice(rowIndex);
    let html = `<p><br></p><table class="bordered"><tbody>`;
    if (withHeader) {
        html += '<tr>';
        Array.from(rows[0].cells).forEach(cell => { html += `<td style="background:var(--bg-active);font-weight:600;color:var(--text-primary);">${cell.innerHTML}</td>`; });
        html += '</tr>';
    }
    secondRows.forEach(row => {
        html += '<tr>';
        Array.from(row.cells).forEach(cell => { html += `<td>${cell.innerHTML}</td>`; });
        html += '</tr>';
    });
    html += '</tbody></table><p><br></p>';
    secondRows.forEach(row => row.remove());
    c3ActiveTable.insertAdjacentHTML('afterend', html);
    hideTableToolbar();
}

function c3ToggleHeaderCell() {
    if (!c3ActiveCell) return;
    const isHeader = c3ActiveCell.style.background === 'var(--bg-active)';
    if (isHeader) {
        c3ActiveCell.style.background = '';
        c3ActiveCell.style.fontWeight = '';
        c3ActiveCell.style.color = '';
    } else {
        c3ActiveCell.style.background = 'var(--bg-active)';
        c3ActiveCell.style.fontWeight = '600';
        c3ActiveCell.style.color = 'var(--text-primary)';
    }
}

// ===== CELL SHADING =====
const C3_APP_COLORS = [
    { label: 'Header', value: 'var(--bg-active)' },
    { label: 'Code',   value: 'var(--bg-code)' },
    { label: 'Grey',   value: 'var(--bg-secondary)' },
    { label: 'Base',   value: 'var(--bg-primary)' },
];

const C3_EXTRA_COLORS = [
    '#dbeafe','#bfdbfe','#93c5fd','#60a5fa','#3b82f6','#1d4ed8',
    '#dcfce7','#bbf7d0','#86efac','#4ade80','#22c55e','#15803d',
    '#fef9c3','#fef08a','#fde047','#facc15','#eab308','#a16207',
    '#fee2e2','#fecaca','#fca5a5','#f87171','#ef4444','#b91c1c',
    '#f3e8ff','#e9d5ff','#d8b4fe','#c084fc','#a855f7','#7e22ce',
    '#ffedd5','#fed7aa','#fdba74','#fb923c','#f97316','#c2410c',
    '#f1f5f9','#e2e8f0','#cbd5e1','#94a3b8','#475569','#1e293b',
];

function c3BuildShadingPalette(paletteEl, applyFn) {
    paletteEl.innerHTML = '';

    // Row 1: app colors
    const row1 = document.createElement('div');
    row1.className = 'c3-shading-row';
    C3_APP_COLORS.forEach(color => {
        const sw = document.createElement('div');
        sw.className = 'c3-shading-swatch app-color';
        sw.style.background = color.value;
        sw.title = color.label;
        sw.onclick = (e) => { e.stopPropagation(); applyFn(color.value); closeAllShadingPalettes(); };
        row1.appendChild(sw);
    });
    paletteEl.appendChild(row1);

    const sep = document.createElement('div');
    sep.className = 'c3-shading-sep';
    paletteEl.appendChild(sep);

    // Extra colors in rows of 6
    for (let i = 0; i < C3_EXTRA_COLORS.length; i += 6) {
        const row = document.createElement('div');
        row.className = 'c3-shading-row';
        C3_EXTRA_COLORS.slice(i, i + 6).forEach(color => {
            const sw = document.createElement('div');
            sw.className = 'c3-shading-swatch';
            sw.style.background = color;
            sw.title = color;
            sw.onclick = (e) => { e.stopPropagation(); applyFn(color); closeAllShadingPalettes(); };
            row.appendChild(sw);
        });
        paletteEl.appendChild(row);
    }
}

function closeAllShadingPalettes() {
    document.querySelectorAll('.c3-shading-palette').forEach(p => p.classList.remove('active'));
}

function c3PositionPalette(palette, triggerBtn) {
    const rect = triggerBtn.getBoundingClientRect();
    palette.style.top = (rect.bottom + 6) + 'px';
    palette.style.left = rect.left + 'px';
}

// Table toolbar shading
function c3ToggleTblShadingPalette(e) {
    e.stopPropagation();
    const palette = document.getElementById('c3TblShadingPalette');
    const btn = document.getElementById('c3TblShadingApply');
    const isActive = palette.classList.contains('active');
    closeAllShadingPalettes();
    if (!isActive) {
        // Only show extra colors (app colors are shown as buttons)
        palette.innerHTML = '';
        for (let i = 0; i < C3_EXTRA_COLORS.length; i += 6) {
            const row = document.createElement('div');
            row.className = 'c3-shading-row';
            C3_EXTRA_COLORS.slice(i, i + 6).forEach(color => {
                const sw = document.createElement('div');
                sw.className = 'c3-shading-swatch';
                sw.style.background = color;
                sw.title = color;
                sw.onclick = (ev) => {
                    ev.stopPropagation();
                    c3ApplyTblAppColor(color);
                    closeAllShadingPalettes();
                };
                row.appendChild(sw);
            });
            palette.appendChild(row);
        }
        c3PositionPalette(palette, btn);
        palette.classList.add('active');
    }
}

// Cornell toolbar shading
function c3ToggleCellShadingPalette(e) {
    e.stopPropagation();
    const palette = document.getElementById('c3CellShadingPalette');
    const btn = document.getElementById('c3CellShadingApply');
    const isActive = palette.classList.contains('active');
    closeAllShadingPalettes();
    if (!isActive) {
        c3BuildShadingPalette(palette, (color) => {
            c3LastCellShadingColor = color;
            const bar = document.getElementById('c3CellShadingBar');
            if (bar) bar.style.background = color;
            const part = c3EditorContext && c3EditorContext._lastActivePart;
            if (part) part.style.background = color;
        });
        c3PositionPalette(palette, btn);
        palette.classList.add('active');
    }
}

document.addEventListener('click', () => closeAllShadingPalettes());

// ===== INSERT TABLE MODAL =====
function openInsertTableModal() { document.getElementById('c3TableModalOverlay').classList.add('active'); }
function closeInsertTableModal() { document.getElementById('c3TableModalOverlay').classList.remove('active'); }

function selectTableBorder(val) {
    c3TableBorder = val;
    document.getElementById('c3TableBorderYes').classList.toggle('selected', val === true);
    document.getElementById('c3TableBorderNo').classList.toggle('selected', val === false);
}

function confirmInsertTable() {
    const rows = parseInt(document.getElementById('c3TableRows').value) || 3;
    const cols = parseInt(document.getElementById('c3TableCols').value) || 3;
    const borderClass = c3TableBorder ? 'bordered' : 'no-border';

    const table = document.createElement('table');
    table.className = borderClass + ' manual-table';
    const tbody = document.createElement('tbody');
    for (let r = 0; r < rows; r++) {
        const tr = document.createElement('tr');
        for (let c = 0; c < cols; c++) {
            const td = document.createElement('td');
            td.innerHTML = '&nbsp;';
            if (r === 0) {
                td.style.background = 'var(--bg-active)';
                td.style.fontWeight = '600';
                td.style.color = 'var(--text-primary)';
            }
            tr.appendChild(td);
        }
        tbody.appendChild(tr);
    }
    table.appendChild(tbody);

    const p = document.createElement('p');
    p.innerHTML = '<br>';

    const editor = document.getElementById('c3EditorModalBody');
    editor.focus();

    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        range.collapse(false);
        range.insertNode(p);
        range.insertNode(table);
    } else {
        editor.appendChild(table);
        editor.appendChild(p);
    }

    closeInsertTableModal();
}

document.addEventListener('DOMContentLoaded', () => {
    const overlay = document.getElementById('c3TableModalOverlay');
    if (overlay) overlay.addEventListener('click', (e) => { if (e.target === overlay) closeInsertTableModal(); });
});

// ===== COLUMN RESIZE =====
(function() {
    let resizing = false;
    let startX = 0;
    let leftCol = null;
    let rightCol = null;
    let leftStartW = 0;
    let rightStartW = 0;
    let totalW = 0;
    let snapshotTaken = false;

    document.addEventListener('mousemove', (e) => {
        const editor = document.getElementById('c3EditorModalBody');
        if (!editor) return;

        if (resizing) {
            if (!snapshotTaken) { c3SnapshotState(); snapshotTaken = true; }
            const dx = e.clientX - startX;
            const newLeft = Math.max(30, leftStartW + dx);
            const newRight = Math.max(30, rightStartW - dx);
            if (newLeft + newRight > totalW + 2) return;
            leftCol.style.width = (newLeft / totalW * 100).toFixed(2) + '%';
            rightCol.style.width = (newRight / totalW * 100).toFixed(2) + '%';
            return;
        }

        // Show resize cursor near td right borders (not last col)
        const td = e.target.closest('td');
        if (!td || !editor.contains(td)) return;
        const rect = td.getBoundingClientRect();
        const nearRightEdge = e.clientX > rect.right - 6 && e.clientX < rect.right + 6;
        const table = td.closest('table');
        const row = td.parentElement;
        const tds = Array.from(row.cells);
        const colIdx = tds.indexOf(td);
        const isLastCol = colIdx === tds.length - 1;

        if (nearRightEdge && !isLastCol) {
            td.style.cursor = 'col-resize';
        } else {
            td.style.cursor = '';
        }
    });

    document.addEventListener('mousedown', (e) => {
        const editor = document.getElementById('c3EditorModalBody');
        if (!editor) return;
        const td = e.target.closest('td');
        if (!td || !editor.contains(td)) return;

        const rect = td.getBoundingClientRect();
        const nearRightEdge = e.clientX > rect.right - 6 && e.clientX < rect.right + 6;
        if (!nearRightEdge) return;

        const table = td.closest('table');
        const row = td.parentElement;
        const tds = Array.from(row.cells);
        const colIdx = tds.indexOf(td);
        if (colIdx === tds.length - 1) return;

        // Ensure colgroup exists with col elements
        let colgroup = table.querySelector('colgroup');
        if (!colgroup) {
            colgroup = document.createElement('colgroup');
            const colCount = tds.length;
            const pct = (100 / colCount).toFixed(2);
            for (let i = 0; i < colCount; i++) {
                const col = document.createElement('col');
                col.style.width = pct + '%';
                colgroup.appendChild(col);
            }
            table.insertBefore(colgroup, table.firstChild);
        }

        const cols = Array.from(colgroup.querySelectorAll('col'));
        leftCol = cols[colIdx];
        rightCol = cols[colIdx + 1];
        totalW = table.getBoundingClientRect().width;
        leftStartW = tds[colIdx].getBoundingClientRect().width;
        rightStartW = tds[colIdx + 1].getBoundingClientRect().width;
        startX = e.clientX;
        resizing = true;
        snapshotTaken = false;
        e.preventDefault();
    });

    document.addEventListener('mouseup', () => {
        resizing = false;
        leftCol = null;
        rightCol = null;
    });
})();