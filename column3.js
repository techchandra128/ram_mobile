// column3.js - Column 3 Full Shell

// ===== STATE =====
const c3State = {
    currentSectionId: 'navigation',
    activeTab: 'notes',
    lastLevelId: {}, // sectionId -> levelId

    // Per section, per tab, per level data
    // sectionData[sectionId][tab][level] = { versions: [...], currentVersion: 0 }
    sectionData: {},
};

// ===== TAB DEFINITIONS =====
const C3_TABS = ['notes', 'memorize', 'visualize', 'analyze', 'test', 'reference'];

// Notes levels
const NOTES_LEVELS = [
    { id: 'crisp',       label: 'Crisp',       icon: '⚡', sub: 'Key points only' },
    { id: 'conceptual',  label: 'Conceptual',  icon: '💡', sub: 'Core concepts'   },
    { id: 'detailed',    label: 'Detailed',    icon: '📚', sub: 'In depth'        },
    { id: 'syntopical',  label: 'Syntopical',  icon: '🔗', sub: 'Cross-linked'   },
];

// Add options per tab
const ADD_OPTIONS = {
    notes: [
        { id: 'add-notes',   label: 'Add Notes',   icon: '✏️' },
        { id: 'smart-notes', label: 'Smart Notes',  icon: '🤖' },
        { id: 'upload-text', label: 'Upload Text',  icon: '📄' },
        { id: 'upload-docx', label: 'Upload Docx',  icon: '📋' },
    ],
    memorize: [
        { id: 'add-notes',   label: 'Add Notes',   icon: '✏️' },
        { id: 'smart-notes', label: 'Smart Notes',  icon: '🤖' },
        { id: 'upload-text', label: 'Upload Text',  icon: '📄' },
        { id: 'upload-docx', label: 'Upload Docx',  icon: '📋' },
    ],
    analyze: [
        { id: 'add-notes',   label: 'Add Notes',   icon: '✏️' },
        { id: 'upload-text', label: 'Upload Text',  icon: '📄' },
        { id: 'upload-docx', label: 'Upload Docx',  icon: '📋' },
    ],
    reference: [
        { id: 'upload-pdf',  label: 'Upload PDF',  icon: '📑' },
        { id: 'upload-text', label: 'Upload Text',  icon: '📄' },
        { id: 'upload-docx', label: 'Upload Docx',  icon: '📋' },
    ],
};

const TEMPLATES = [
    { id: 'cornell', label: 'Cornell Notes', icon: '📋' },
    { id: 'plain',   label: 'Plain Text',    icon: '📝' },
];

const TEST_TYPES = [
    { label: 'MCQ',                icon: '❓' },
    { label: 'True / False',       icon: '✅' },
    { label: 'Match the Following',icon: '🔀' },
    { label: 'Ranking / Ordering', icon: '🔢' },
];

// ===== LOCALSTORAGE =====
function saveC3State() {
    const id = getFileId();
    RAM_SYNC.setItem(`c3_data_${id}`, JSON.stringify(c3State.sectionData));
    initTabBar();
    // Initialize c5 store entry for any section that now has content
    if (typeof c5SectionStore !== 'undefined' && typeof getDefaultC5Data === 'function') {
        const sectionId = c3State.currentSectionId;
        if (sectionId && !c5SectionStore[sectionId] && typeof isSectionDataEmpty === 'function' && !isSectionDataEmpty(sectionId)) {
            c5SectionStore[sectionId] = getDefaultC5Data();
            if (typeof saveC5Store === 'function') saveC5Store();
        }
    }
    window.parent.postMessage({ type: 'ramDataSaved' }, '*');
}

function loadC3State() {
    const id = getFileId();
    const data = localStorage.getItem(`c3_data_${id}`);
    if (data) c3State.sectionData = JSON.parse(data);
}

// ===== HELPERS =====
function getSectionTabData(sectionId, tab) {
    if (!c3State.sectionData[sectionId]) c3State.sectionData[sectionId] = {};
    if (!c3State.sectionData[sectionId][tab]) c3State.sectionData[sectionId][tab] = {};
    return c3State.sectionData[sectionId][tab];
}

function getLevelData(sectionId, tab, levelId) {
    const tabData = getSectionTabData(sectionId, tab);
    if (!tabData[levelId]) tabData[levelId] = { versions: [], currentVersion: -1 };
    return tabData[levelId];
}

function hasContent(sectionId, tab, levelId) {
    const d = getLevelData(sectionId, tab, levelId);
    return d.versions.length > 0;
}

function hasAnyContent(sectionId, tab) {
    const tabData = getSectionTabData(sectionId, tab);
    return Object.values(tabData).some(d => d.versions && d.versions.length > 0);
}

function getTabCount(sectionId, tab) {
    if (tab === 'notes') {
        return NOTES_LEVELS.reduce((sum, l) => {
            const d = getLevelData(sectionId, tab, l.id);
            return sum + d.versions.length;
        }, 0);
    }
    const tabData = getSectionTabData(sectionId, tab);
    return Object.values(tabData).reduce((sum, d) => sum + (d.versions ? d.versions.length : 0), 0);
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
    loadC3State();
    initTabBar();
    // Initial render is driven by column1-2.js via selectSection(selectedSection) at 100ms
});

// ===== TAB BAR =====
function initTabBar() {
    const bar = document.getElementById('c3TabBar');
    if (!bar) return;
    bar.innerHTML = '';
    const labels = { notes: 'Notes', memorize: 'Memorize', visualize: 'Visualize', analyze: 'Analyze', test: 'Test', reference: 'Reference' };
    const sectionId = c3State.currentSectionId;
    C3_TABS.forEach(tab => {
        const btn = document.createElement('button');
        btn.className = 'c3-tab-btn' + (tab === c3State.activeTab ? ' active' : '');
        const isNav = sectionId === 'navigation';
        let count = 0;

        if (isNav && tab === 'notes') {
            count = c12State.sections.filter(s => s.type !== 'dummy').length > 0 ? 1 : 0;
        } else if (tab !== 'test' && tab !== 'visualize') {
            count = getTabCount(sectionId, tab);
        }

        btn.textContent = `${labels[tab]} - ${count}`;
        btn.dataset.tab = tab;
        btn.onclick = () => selectTab(tab);
        bar.appendChild(btn);
    });
}

function selectTab(tab) {
    c3State.activeTab = tab;
    // Update tab buttons
    document.querySelectorAll('.c3-tab-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.tab === tab);
    });
    renderTabBody(c3State.currentSectionId, tab);
}

// ===== MAIN RENDER =====
function renderC3(id) {
    c3State.currentSectionId = id;
    initTabBar();

    // Section title
    const titleEl = document.getElementById('c3SectionTitle');
    if (titleEl) {
        const isNav = id === 'navigation';
        const section = isNav ? c12State.navigation : c12State.sections.find(s => s.id === id);
        if (section) {
            if (isNav) {
                titleEl.textContent = section.title;
            } else {
                const idx = c12State.sections.findIndex(s => s.id === id);
                const nums = generateNumbers(c12State.sections);
                const num = idx >= 0 ? nums[idx] : '';
                titleEl.textContent = num ? `${num}. ${section.title}` : section.title;
            }
        }
    }

    // Footer (wrapped so any error here can't block the body render)
    try { renderC3Footer(id); } catch(e) {}

    // Body
    renderTabBody(id, c3State.activeTab);
}

// ===== TOC (NAVIGATION PAGE) =====
function renderC3TOC(panel) {
    panel.innerHTML = '';
    panel.classList.add('c3-toc-panel');

    const numbers = generateNumbers(c12State.sections);

    if (c12State.sections.length === 0) {
        panel.innerHTML = '<div style="text-align:center;color:#94a3b8;font-size:13px;padding:32px;">No sections added yet.</div>';
        return;
    }

    c12State.sections.forEach((section, i) => {
        const item = document.createElement('div');
        item.className = `c3-toc-item level-${section.level} ${section.type === 'dummy' ? 'dummy' : 'real'}`;

        const numSpan = document.createElement('span');
        numSpan.className = 'c3-toc-num';
        numSpan.textContent = numbers[i] + '.';

        const titleSpan = document.createElement('span');
        titleSpan.textContent = section.title;

        item.appendChild(numSpan);
        item.appendChild(titleSpan);

        if (section.type === 'real') {
            item.onclick = () => selectSection(section.id);
        }

        panel.appendChild(item);
    });
}

// ===== RENDER TAB BODY =====
function renderTabBody(sectionId, tab) {
    const panel = document.getElementById('c3TabPanel_' + tab);
    if (!panel) return;

    // Hide all panels, show current
    document.querySelectorAll('.c3-tab-panel').forEach(p => { p.classList.remove('active'); p.classList.remove('c3-toc-panel'); });
    panel.classList.add('active');

    // Navigation section: Notes tab shows TOC only, other tabs render normally
    if (sectionId === 'navigation' && tab === 'notes') {
        renderC3TOC(panel);
        return;
    }

    if (tab === 'test') {
        renderTestTab(panel);
        return;
    }

    if (tab === 'visualize') {
        renderVisualizeTab(panel);
        return;
    }

    // For notes: show level 1 cards first
    if (tab === 'notes') {
        renderNotesTab(panel, sectionId);
        return;
    }

    // For memorize, analyze, reference
    renderSimpleTab(panel, sectionId, tab);
}

// ===== NOTES TAB =====
function renderNotesTab(panel, sectionId) {
    panel.innerHTML = '';

    const filledLevels = NOTES_LEVELS.filter(l => hasContent(sectionId, 'notes', l.id));

    // Go straight to last opened level if it has content
    const lastId = c3State.lastLevelId[sectionId];
    const lastLevel = lastId && filledLevels.find(l => l.id === lastId);
    if (lastLevel) {
        renderContentState(panel, sectionId, 'notes', lastLevel.id, lastLevel.label);
        return;
    }

    // If any content exists, go straight to first filled level
    if (filledLevels.length >= 1) {
        const l = filledLevels[0];
        renderContentState(panel, sectionId, 'notes', l.id, l.label);
        return;
    }

    const container = document.createElement('div');
    container.className = 'c3-level-container';

    const wrap = document.createElement('div');
    wrap.className = 'c3-cards-wrap';

    const row = document.createElement('div');
    row.className = 'c3-cards-row';

    NOTES_LEVELS.forEach(level => {
        const card = document.createElement('div');
        const hasCont = hasContent(sectionId, 'notes', level.id);
        card.className = 'c3-level-card' + (hasCont ? ' has-content' : '');

        card.innerHTML = `
            <div class="c3-level-card-icon">${level.icon}</div>
            <div class="c3-level-card-label">${level.label}</div>
            <div class="c3-level-card-sub">${level.sub}</div>
        `;
        card.onclick = () => renderNotesLevel2(panel, sectionId, level);
        row.appendChild(card);
    });

    wrap.appendChild(row);
    container.appendChild(wrap);
    panel.appendChild(container);
    addAskMeBtn(panel);
}

// Notes Level 2 — add options
function renderNotesLevel2(panel, sectionId, level) {
    const hasCont = hasContent(sectionId, 'notes', level.id);

    if (hasCont) {
        renderContentState(panel, sectionId, 'notes', level.id, level.label);
        return;
    }

    panel.innerHTML = '';
    const container = document.createElement('div');
    container.className = 'c3-level-container';

    const wrap = document.createElement('div');
    wrap.className = 'c3-cards-wrap';

    // Header with back
    const header = document.createElement('div');
    header.className = 'c3-level-header';
    const backBtn = document.createElement('button');
    backBtn.className = 'c3-level-back-btn';
    backBtn.textContent = '←';
    backBtn.onclick = () => renderNotesTab(panel, sectionId);
    const title = document.createElement('div');
    title.className = 'c3-level-title';
    title.textContent = level.label;
    header.appendChild(backBtn);
    header.appendChild(title);

    const row = document.createElement('div');
    row.className = 'c3-cards-row';

    ADD_OPTIONS['notes'].forEach(opt => {
        const card = document.createElement('div');
        card.className = 'c3-card';
        card.innerHTML = `<div class="c3-card-icon">${opt.icon}</div><div class="c3-card-label">${opt.label}</div>`;
        card.onclick = () => handleAddOption(panel, sectionId, 'notes', level, opt);
        row.appendChild(card);
    });

    wrap.appendChild(header);
    wrap.appendChild(row);
    container.appendChild(wrap);
    panel.appendChild(container);
    addAskMeBtn(panel);
}

// ===== SIMPLE TABS (memorize, analyze, reference) =====
function renderSimpleTab(panel, sectionId, tab) {
    panel.innerHTML = '';

    const hasCont = hasAnyContent(sectionId, tab);

    if (hasCont) {
        renderContentState(panel, sectionId, tab, 'default', tab.charAt(0).toUpperCase() + tab.slice(1));
        return;
    }

    const container = document.createElement('div');
    container.className = 'c3-level-container';

    const wrap = document.createElement('div');
    wrap.className = 'c3-cards-wrap';

    const row = document.createElement('div');
    row.className = 'c3-cards-row';

    const opts = ADD_OPTIONS[tab] || [];
    opts.forEach(opt => {
        const card = document.createElement('div');
        card.className = 'c3-card wide';
        card.innerHTML = `<div class="c3-card-icon">${opt.icon}</div><div class="c3-card-label">${opt.label}</div>`;
        card.onclick = () => handleAddOption(panel, sectionId, tab, null, opt);
        row.appendChild(card);
    });

    wrap.appendChild(row);
    container.appendChild(wrap);
    panel.appendChild(container);
    addAskMeBtn(panel);
}

// ===== HANDLE ADD OPTION =====
function handleAddOption(panel, sectionId, tab, level, opt) {
    if (opt.id === 'upload-text') {
        const levelId = level ? level.id : 'default';
        const input = document.getElementById('c3UploadTxtInput');
        input.value = '';
        input.onchange = (e) => handleC3UploadText(e, panel, sectionId, tab, levelId);
        input.click();
        return;
    }

    if (opt.id === 'upload-docx') {
        const levelId = level ? level.id : 'default';
        const input = document.getElementById('c3UploadDocxInput');
        input.value = '';
        input.onchange = (e) => handleC3UploadDocx(e, panel, sectionId, tab, levelId);
        input.click();
        return;
    }

    if (opt.id === 'upload-pdf') {
        const levelId = level ? level.id : 'default';
        const input = document.getElementById('c3UploadPdfInput');
        input.value = '';
        input.onchange = (e) => handleC3UploadPdf(e, panel, sectionId, tab, levelId);
        input.click();
        return;
    }

    if (opt.id === 'smart-notes') {
        const levelId = level ? level.id : 'crisp';
        closeAddModal();
        if (typeof openAiModal === 'function') openAiModal('ai-notes', levelId);
        return;
    }

    if (opt.id === 'add-notes') {
        if (panel) {
            renderTemplateSelect(panel, sectionId, tab, level, () => renderNotesLevel2(panel, sectionId, level));
        } else {
            renderAddModalTemplates(
                document.getElementById('c3AddModalBody'),
                sectionId, tab, level
            );
        }
        return;
    }

}

// ===== TEMPLATE SELECTION (Level 3) =====
function renderTemplateSelect(panel, sectionId, tab, level, backFn) {
    panel.innerHTML = '';
    const container = document.createElement('div');
    container.className = 'c3-level-container';

    const wrap = document.createElement('div');
    wrap.className = 'c3-cards-wrap';

    const header = document.createElement('div');
    header.className = 'c3-level-header';
    const backBtn = document.createElement('button');
    backBtn.className = 'c3-level-back-btn';
    backBtn.textContent = '←';
    backBtn.onclick = backFn;
    const title = document.createElement('div');
    title.className = 'c3-level-title';
    title.textContent = 'Choose Template';
    header.appendChild(backBtn);
    header.appendChild(title);

    const row = document.createElement('div');
    row.className = 'c3-cards-row';

    TEMPLATES.forEach(tmpl => {
        const card = document.createElement('div');
        card.className = 'c3-template-card';
        card.innerHTML = `<div class="c3-template-card-icon">${tmpl.icon}</div><div class="c3-template-card-label">${tmpl.label}</div>`;
        card.onclick = () => {
            const levelId = level ? level.id : 'default';
            // Open editor (placeholder — editor.js will handle this)
            if (typeof openEditorWindow === 'function') {
                openEditorWindow({ sectionId, tab, levelId, template: tmpl.id });
            } else {
                openComingSoon('Editor');
            }
        };
        row.appendChild(card);
    });

    wrap.appendChild(header);
    wrap.appendChild(row);
    container.appendChild(wrap);
    panel.appendChild(container);
}

// ===== HAS CONTENT STATE =====
function renderContentState(panel, sectionId, tab, levelId, labelText) {
    panel.innerHTML = '';

    if (tab === 'notes') c3State.lastLevelId[sectionId] = levelId;

    const levelData = getLevelData(sectionId, tab, levelId);

    // Toolbar
    const toolbar = document.createElement('div');
    toolbar.className = 'c3-content-toolbar';

    // Layer dropdown (notes tab only, show filled levels)
    if (tab === 'notes') {
        const filledLevels = NOTES_LEVELS.filter(l => hasContent(sectionId, 'notes', l.id));
        const lWrap = document.createElement('div');
        lWrap.className = 'c3-version-dropdown-wrap';

        const lTrigger = document.createElement('button');
        lTrigger.className = 'c3-version-trigger';
        lTrigger.innerHTML = `<span>${labelText}</span><span style="font-size:9px;">▼</span>`;
        lTrigger.onclick = () => lWrap.classList.toggle('active');

        const lMenu = document.createElement('div');
        lMenu.className = 'c3-version-menu';
        filledLevels.forEach(l => {
            const opt = document.createElement('div');
            opt.className = 'c3-version-option' + (l.id === levelId ? ' selected' : '');
            opt.textContent = l.label;
            opt.onclick = () => {
                lWrap.classList.remove('active');
                renderContentState(panel, sectionId, tab, l.id, l.label);
            };
            lMenu.appendChild(opt);
        });

        lWrap.appendChild(lTrigger);
        lWrap.appendChild(lMenu);
        toolbar.appendChild(lWrap);
    }

 if (tab === 'reference') {
        const sources = [...new Set(levelData.versions.map(v => v.source).filter(Boolean))];
        const currentVer = levelData.versions[levelData.currentVersion];
        const currentSource = currentVer && currentVer.source ? currentVer.source : (sources[0] || 'text');
        const sourceLabels = { text: 'Text', pdf: 'PDF', docx: 'Docx' };

        const sWrap = document.createElement('div');
        sWrap.className = 'c3-version-dropdown-wrap';
        const sTrigger = document.createElement('button');
        sTrigger.className = 'c3-version-trigger';
        sTrigger.innerHTML = `<span>${sourceLabels[currentSource]}</span><span style="font-size:9px;">▼</span>`;
        sTrigger.onclick = () => sWrap.classList.toggle('active');
        const sMenu = document.createElement('div');
        sMenu.className = 'c3-version-menu';
        sources.forEach(src => {
            const opt = document.createElement('div');
            opt.className = 'c3-version-option' + (src === currentSource ? ' selected' : '');
            opt.textContent = sourceLabels[src];
            opt.onclick = () => {
                sWrap.classList.remove('active');
                const firstOfSource = levelData.versions.findIndex(v => v.source === src);
                if (firstOfSource !== -1) {
                    levelData.currentVersion = firstOfSource;
                    saveC3State();
                    renderContentState(panel, sectionId, tab, levelId, labelText);
                }
            };
            sMenu.appendChild(opt);
        });
        sWrap.appendChild(sTrigger);
        sWrap.appendChild(sMenu);
        toolbar.appendChild(sWrap);

        const sourceVersions = levelData.versions.map((v, i) => ({ v, i })).filter(x => x.v.source === currentSource);
        const vWrap = document.createElement('div');
        vWrap.className = 'c3-version-dropdown-wrap';
        const vTrigger = document.createElement('button');
        vTrigger.className = 'c3-version-trigger';
        const currentSourceIdx = sourceVersions.findIndex(x => x.i === levelData.currentVersion);
        vTrigger.innerHTML = `<span>V${currentSourceIdx + 1}</span><span style="font-size:9px;">▼</span>`;
        vTrigger.onclick = () => vWrap.classList.toggle('active');
        const vMenu = document.createElement('div');
        vMenu.className = 'c3-version-menu';
        sourceVersions.forEach(({ v, i }, idx) => {
            const opt = document.createElement('div');
            opt.className = 'c3-version-option' + (i === levelData.currentVersion ? ' selected' : '');
            opt.textContent = 'V' + (idx + 1);
            opt.onclick = () => {
                levelData.currentVersion = i;
                saveC3State();
                renderContentState(panel, sectionId, tab, levelId, labelText);
            };
            vMenu.appendChild(opt);
        });
        vWrap.appendChild(vTrigger);
        vWrap.appendChild(vMenu);
        toolbar.appendChild(vWrap);

    } else {
        const vWrap = document.createElement('div');
        vWrap.className = 'c3-version-dropdown-wrap';
        const vTrigger = document.createElement('button');
        vTrigger.className = 'c3-version-trigger';
        const currentLabel = levelData.versions.length > 0 ? 'V' + (levelData.currentVersion + 1) : 'V1';
        vTrigger.innerHTML = `<span>${currentLabel}</span><span style="font-size:9px;">▼</span>`;
        vTrigger.onclick = () => vWrap.classList.toggle('active');
        const vMenu = document.createElement('div');
        vMenu.className = 'c3-version-menu';
        levelData.versions.forEach((v, i) => {
            const opt = document.createElement('div');
            opt.className = 'c3-version-option' + (i === levelData.currentVersion ? ' selected' : '');
            opt.textContent = 'V' + (i + 1);
            opt.onclick = () => {
                levelData.currentVersion = i;
                saveC3State();
                renderContentState(panel, sectionId, tab, levelId, labelText);
            };
            vMenu.appendChild(opt);
        });
        vWrap.appendChild(vTrigger);
        vWrap.appendChild(vMenu);
        toolbar.appendChild(vWrap);
    }

    const spacer = document.createElement('div');
    spacer.className = 'c3-toolbar-spacer';
    toolbar.appendChild(spacer);
    
    // Buttons
    const _cv = levelData.versions[levelData.currentVersion];
    const isPdf = _cv && _cv.template === 'pdf';
    const btns = [
        { cls: 'add', icon: '+', label: '', action: () => openAddModal(sectionId, tab) },
        { cls: 'delete', icon: '🗑', label: '', action: () => confirmDeleteVersion(panel, sectionId, tab, levelId, labelText) },
        { cls: 'edit', icon: '✎', label: '', action: () => {
            if (isPdf) openPdfViewer(sectionId, levelId, levelData.currentVersion, 'edit');
            else if (typeof openEditorWindow === 'function') openEditorWindow({ sectionId, tab, levelId, editing: true });
            else openComingSoon('Editor');
        }},
        { cls: 'view', icon: '👁', label: '', action: () => {
            if (isPdf) openPdfViewer(sectionId, levelId, levelData.currentVersion, 'view');
            else if (typeof openEditorWindow === 'function') openEditorWindow({ sectionId, tab, levelId, viewOnly: true });
            else openComingSoon('Viewer');
        }},
    ];

    btns.forEach(b => {
        const btn = document.createElement('button');
        btn.className = `c3-toolbar-btn c3-preview-btn ${b.cls}`;
        btn.innerHTML = b.icon;
btn.title = b.cls.charAt(0).toUpperCase() + b.cls.slice(1);
        btn.onclick = b.action;
        toolbar.appendChild(btn);
    });

    panel.appendChild(toolbar);

    // Content body
    const body = document.createElement('div');
    body.className = 'c3-content-body';

    const currentV = levelData.versions[levelData.currentVersion];
    if (currentV) {
        if (currentV.template === 'pdf') {
            body.innerHTML = '';
            body.style.cursor = 'pointer';
            body.onclick = () => openPdfViewer(sectionId, levelId, levelData.currentVersion, 'view');
            const canvas = document.createElement('canvas');
            canvas.style.width = '100%';
            canvas.style.display = 'block';
            body.appendChild(canvas);
            loadPdfJs(() => {
                const binary = atob(currentV.pdfData);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                pdfjsLib.getDocument({ data: bytes }).promise.then(doc => {
                    doc.getPage(1).then(page => {
                        const viewport = page.getViewport({ scale: 1 });
                        const scale = (body.clientWidth || 300) / viewport.width;
                        const scaled = page.getViewport({ scale });
                        canvas.width = scaled.width;
                        canvas.height = scaled.height;
                        page.render({ canvasContext: canvas.getContext('2d'), viewport: scaled });
                    });
                });
            });
        } else if (currentV.template === 'plain') {
            body.innerHTML = currentV.html || '';
        } else if (currentV.template === 'cornell' && currentV.cells) {
            let html = '';
            currentV.cells.forEach(cell => {
                const rows = cell.rows;
                if (cell.type === 'cornell' || cell.type === 'header-cornell') {
                    html += `<div class="c3-preview-cell" data-type="${cell.type}">`;
                    if (rows && rows.length > 0) {
                        rows.forEach(row => {
                            html += `<div class="c3-preview-cell-row">
                                <div class="c3-preview-cornell-left"${row.bgLeft ? ` style="background:${row.bgLeft}"` : ''}>${row.left || ''}</div>
                                <div class="c3-preview-cornell-right"${row.bgRight ? ` style="background:${row.bgRight}"` : ''}>${row.right || ''}</div>
                            </div>`;
                        });
                    } else {
                        html += `<div class="c3-preview-cornell-wrap">
                            <div class="c3-preview-cornell-left"${cell.bgLeft ? ` style="background:${cell.bgLeft}"` : ''}>${cell.left || ''}</div>
                            <div class="c3-preview-cornell-right"${cell.bgRight ? ` style="background:${cell.bgRight}"` : ''}>${cell.right || ''}</div>
                        </div>`;
                    }
                    html += `</div>`;
                } else if (cell.type === 'code') {
                    html += `<div class="c3-preview-cell" data-type="code">`;
                    if (rows && rows.length > 0) {
                        rows.forEach(row => { html += `<div class="c3-preview-cell-row"><div class="c3-preview-cell-body code"${row.bg ? ` style="background:${row.bg}"` : ''}>${row.content || ''}</div></div>`; });
                    } else {
                        html += `<div class="c3-preview-cell-body code"${cell.bg ? ` style="background:${cell.bg}"` : ''}>${cell.content || ''}</div>`;
                    }
                    html += `</div>`;
                } else if (cell.type === 'header') {
                    html += `<div class="c3-preview-cell" data-type="header">`;
                    if (rows && rows.length > 0) {
                        rows.forEach(row => { html += `<div class="c3-preview-cell-row"><div class="c3-preview-cell-body header"${row.bg ? ` style="background:${row.bg}"` : ''}>${row.content || ''}</div></div>`; });
                    } else {
                        html += `<div class="c3-preview-cell-body header"${cell.bg ? ` style="background:${cell.bg}"` : ''}>${cell.content || ''}</div>`;
                    }
                    html += `</div>`;
                } else {
                    html += `<div class="c3-preview-cell" data-type="text">`;
                    if (rows && rows.length > 0) {
                        rows.forEach(row => {
                            html += `<div class="c3-preview-cell-row"><div class="c3-preview-cell-body"${row.bg ? ` style="background:${row.bg}"` : ''}>${row.content || ''}</div></div>`;
                        });
                    } else {
                        html += `<div class="c3-preview-cell-body"${cell.bg ? ` style="background:${cell.bg}"` : ''}>${cell.content || ''}</div>`;
                    }
                    html += `</div>`;
                }
            });
            body.innerHTML = html;
        }
    } else {
        body.innerHTML = '<p style="color:var(--text-muted);font-size:13px;">No content yet.</p>';
    }

    panel.appendChild(body);

    addAskMeBtn(panel);

    setTimeout(() => {
        renderC3Footer(c3State.currentSectionId);
        renderC5LabelStates();
    }, 0);

    document.addEventListener('click', (e) => {
        document.querySelectorAll('.c3-version-dropdown-wrap').forEach(w => {
            if (!w.contains(e.target)) w.classList.remove('active');
        });
    }, { once: true });
}

// ===== DELETE VERSION =====
function confirmDeleteVersion(panel, sectionId, tab, levelId, labelText) {
    const levelData = getLevelData(sectionId, tab, levelId);
    if (!confirm('Delete this version?')) return;

    levelData.versions.splice(levelData.currentVersion, 1);

    if (levelData.versions.length === 0) {
        levelData.currentVersion = -1;
        saveC3State();
        // Go back to empty state
        if (tab === 'notes') {
            renderNotesTab(panel, sectionId);
        } else {
            renderSimpleTab(panel, sectionId, tab);
        }
        renderC3Footer(sectionId);
        renderC5LabelStates();
        // If section is now fully empty, clear its c5 data
        if (typeof isSectionDataEmpty === 'function' && isSectionDataEmpty(sectionId)) {
            if (typeof c5SectionStore !== 'undefined') {
                delete c5SectionStore[sectionId];
                if (typeof saveC5Store === 'function') saveC5Store();
            }
            if (typeof getDefaultC5Data === 'function' && typeof c5State !== 'undefined') {
                const def = getDefaultC5Data();
                c5State.isCompleted    = def.isCompleted;
                c5State.difficulty     = def.difficulty;
                c5State.priority       = def.priority;
                c5State.revisions      = def.revisions;
                c5State.totalSlots     = def.totalSlots;
                c5State.activatedCount = def.activatedCount;
                c5State.page           = def.page;
            }
            if (typeof renderC5 === 'function') renderC5();
            if (typeof renderC3Footer === 'function') renderC3Footer(sectionId);
            try {
                const progress = typeof getOverallProgress === 'function' ? getOverallProgress() : 0;
                const fileId = typeof getFileId === 'function' ? getFileId() : 'default';
                window.parent.postMessage({ type: 'progressUpdate', fileId, progress }, '*');
            } catch(e) {}
        }
    } else {
        levelData.currentVersion = Math.min(levelData.currentVersion, levelData.versions.length - 1);
        saveC3State();
        renderContentState(panel, sectionId, tab, levelId, labelText);
    }
}

// ===== TEST TAB =====
function renderTestTab(panel) {
    panel.innerHTML = '';

    const container = document.createElement('div');
    container.className = 'c3-level-container';

    const wrap = document.createElement('div');
    wrap.className = 'c3-cards-wrap';

    const row = document.createElement('div');
    row.className = 'c3-cards-row';

    TEST_TYPES.forEach(t => {
        const card = document.createElement('div');
        card.className = 'c3-card wide';
        card.innerHTML = `<div class="c3-card-icon">${t.icon}</div><div class="c3-card-label">${t.label}</div>`;
        card.onclick = () => openComingSoon(t.label);
        row.appendChild(card);
    });

    wrap.appendChild(row);
    container.appendChild(wrap);
    panel.appendChild(container);
}

// ===== VISUALIZE TAB =====
function renderVisualizeTab(panel) {
    panel.innerHTML = '';

    const container = document.createElement('div');
    container.className = 'c3-level-container';

    const wrap = document.createElement('div');
    wrap.className = 'c3-cards-wrap';

    const row = document.createElement('div');
    row.className = 'c3-cards-row';

    const options = [
        { label: 'Images', icon: '🖼️' },
        { label: 'GIF', icon: '🎞️' },
    ];

    options.forEach(opt => {
        const card = document.createElement('div');
        card.className = 'c3-card wide';
        card.innerHTML = `<div class="c3-card-icon">${opt.icon}</div><div class="c3-card-label">${opt.label}</div>`;
        card.onclick = () => openComingSoon(opt.label);
        row.appendChild(card);
    });

    wrap.appendChild(row);
    container.appendChild(wrap);
    panel.appendChild(container);
}

// ===== ASK ME BUTTON =====
function addAskMeBtn(panel) {
    // Remove existing
    const existing = panel.querySelector('.c3-ask-me-btn');
    if (existing) existing.remove();

    const btn = document.createElement('button');
    btn.className = 'c3-ask-me-btn';
    btn.innerHTML = '✦ Ask Me';
    btn.onclick = () => { if (typeof openAiModal === 'function') openAiModal('ask-me'); };
    panel.appendChild(btn);
}
// ===== ADD VERSION MODAL =====
let c3AddModalContext = null;

function openAddModal(sectionId, tab) {
    c3AddModalContext = { sectionId, tab };
    const title = document.getElementById('c3AddModalTitle');
    const body = document.getElementById('c3AddModalBody');
    title.textContent = 'Add Notes';

    if (tab === 'notes') {
        renderAddModalLevel1(body, sectionId, tab);
    } else {
        renderAddModalOptions(body, sectionId, tab, null);
    }

    document.getElementById('c3AddModalOverlay').classList.add('active');
}

function closeAddModal() {
    document.getElementById('c3AddModalOverlay').classList.remove('active');
    c3AddModalContext = null;
}

function renderAddModalLevel1(body, sectionId, tab) {
    body.innerHTML = '';
    const row = document.createElement('div');
    row.className = 'c3-add-modal-cards';

    NOTES_LEVELS.forEach(level => {
        const card = document.createElement('div');
        card.className = 'c3-level-card';
        card.innerHTML = `
            <div class="c3-level-card-icon">${level.icon}</div>
            <div class="c3-level-card-label">${level.label}</div>
            <div class="c3-level-card-sub">${level.sub}</div>
        `;
        card.onclick = () => renderAddModalOptions(body, sectionId, tab, level);
        row.appendChild(card);
    });

    body.appendChild(row);
}

function renderAddModalTemplates(body, sectionId, tab, level) {
    body.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'c3-level-header';
    header.style.width = '100%';
    const backBtn = document.createElement('button');
    backBtn.className = 'c3-level-back-btn';
    backBtn.textContent = '←';
    backBtn.onclick = () => renderAddModalOptions(body, sectionId, tab, level);
    const titleEl = document.createElement('div');
    titleEl.className = 'c3-level-title';
    titleEl.textContent = 'Choose Template';
    header.appendChild(backBtn);
    header.appendChild(titleEl);
    body.appendChild(header);

    const row = document.createElement('div');
    row.className = 'c3-add-modal-cards';

    TEMPLATES.forEach(tmpl => {
        const card = document.createElement('div');
        card.className = 'c3-template-card';
        card.innerHTML = `<div class="c3-template-card-icon">${tmpl.icon}</div><div class="c3-template-card-label">${tmpl.label}</div>`;
        card.onclick = () => {
            const levelId = level ? level.id : 'default';
            closeAddModal();
            if (typeof openEditorWindow === 'function') {
                openEditorWindow({ sectionId, tab, levelId, template: tmpl.id });
            } else {
                openComingSoon('Editor');
            }
        };
        row.appendChild(card);
    });

    body.appendChild(row);
}

function renderAddModalOptions(body, sectionId, tab, level) {
    body.innerHTML = '';

    if (level) {
        // Back + title header
        const header = document.createElement('div');
        header.className = 'c3-level-header';
        header.style.width = '100%';
        const backBtn = document.createElement('button');
        backBtn.className = 'c3-level-back-btn';
        backBtn.textContent = '←';
        backBtn.onclick = () => renderAddModalLevel1(body, sectionId, tab);
        const titleEl = document.createElement('div');
        titleEl.className = 'c3-level-title';
        titleEl.textContent = level.label;
        header.appendChild(backBtn);
        header.appendChild(titleEl);
        body.appendChild(header);
    }

    const row = document.createElement('div');
    row.className = 'c3-add-modal-cards';

    const opts = ADD_OPTIONS[tab] || [];
    opts.forEach(opt => {
        const card = document.createElement('div');
        card.className = 'c3-card';
        card.innerHTML = `<div class="c3-card-icon">${opt.icon}</div><div class="c3-card-label">${opt.label}</div>`;
        card.onclick = () => {
            handleAddOption(null, sectionId, tab, level, opt);
        };
        row.appendChild(card);
    });

    body.appendChild(row);
}

document.addEventListener('DOMContentLoaded', () => {
    const overlay = document.getElementById('c3AddModalOverlay');
    if (overlay) overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeAddModal();
    });
});

// ===== UPLOAD TEXT CONTENT =====
function handleC3UploadText(event, panel, sectionId, tab, levelId) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const result = parseUploadTextContent(e.target.result);

        if (result.error) {
            alert('Upload failed:\n\n' + result.error);
            return;
        }

        const levelData = getLevelData(sectionId, tab, levelId);

        if (result.plain) {
            levelData.versions.push({ template: 'plain', html: result.html, source: tab === 'reference' ? 'text' : null });
            levelData.currentVersion = levelData.versions.length - 1;
        } else {
            const currentV = levelData.versions[levelData.currentVersion];
            if (currentV && currentV.template === 'cornell' && currentV.cells && tab !== 'reference') {
                currentV.cells.push(...result.cells);
            } else {
                levelData.versions.push({ template: 'cornell', cells: result.cells, source: tab === 'reference' ? 'text' : null });
                levelData.currentVersion = levelData.versions.length - 1;
            }
        }

        saveC3State();

        // Re-render
        const levelDef = NOTES_LEVELS.find(l => l.id === levelId);
        const labelText = levelDef ? levelDef.label : (tab.charAt(0).toUpperCase() + tab.slice(1));
        const targetPanel = panel || document.getElementById('c3TabPanel_' + tab);
        if (targetPanel) renderContentState(targetPanel, sectionId, tab, levelId, labelText);
        initTabBar();
        closeAddModal();
        if (typeof renderC5 === 'function') renderC5();
    };
    reader.readAsText(file);
}


// ===== COMING SOON MODAL =====
function openComingSoon(featureName) {
    const overlay = document.getElementById('c3ComingSoonOverlay');
    const desc = document.getElementById('c3ComingSoonDesc');
    if (desc) desc.textContent = `${featureName} is coming soon. We're working on it!`;
    if (overlay) overlay.classList.add('active');
}

function closeComingSoon() {
    const overlay = document.getElementById('c3ComingSoonOverlay');
    if (overlay) overlay.classList.remove('active');
}

// ===== FOOTER =====
function renderC3Footer(id) {
    const prevBtn   = document.getElementById('c3FooterPrev');
    const nextBtn   = document.getElementById('c3FooterNext');
    const studyBtn  = document.getElementById('c3FooterStudied');

    if (!prevBtn || !nextBtn || !studyBtn) return;

    const isNav = id === 'navigation';
    const section = isNav ? null : c12State.sections.find(s => s.id === id);
    const isDummy = section && section.type === 'dummy';

    // Studied state
    const isCompleted   = c5State?.isCompleted || false;
    const isStudiedToday = (typeof isCurrentSectionStudiedToday === 'function') ? isCurrentSectionStudiedToday() : false;

    if (isDummy) {
        studyBtn.textContent = 'Mark as Studied';
        studyBtn.className = 'c3-footer-btn c3-footer-studied';
        studyBtn.disabled = true;
        studyBtn.onmouseenter = null;
        studyBtn.onmouseleave = null;
    } else if (isNav) {
        const hasRealSections = c12State.sections.filter(s => s.type === 'real').length > 0;
        const hasAnyTabContent = Object.values(c3State.sectionData['navigation'] || {}).some(tab =>
            typeof tab === 'object' && Object.values(tab).some(l => l && l.versions && l.versions.length > 0)
        );
        const navEnabled = hasRealSections || hasAnyTabContent;
        studyBtn.className = 'c3-footer-btn c3-footer-studied' + (isStudiedToday ? ' studied' : '');
        studyBtn.disabled = !navEnabled;
        if (!navEnabled) {
            studyBtn.textContent = 'Mark as Studied';
            studyBtn.onmouseenter = null;
            studyBtn.onmouseleave = null;
        } else if (isStudiedToday) {
            studyBtn.textContent = 'Studied Today ✓';
            studyBtn.onmouseenter = () => { studyBtn.textContent = 'Unmark as Studied'; };
            studyBtn.onmouseleave = () => { studyBtn.textContent = 'Studied Today ✓'; };
        } else {
            studyBtn.textContent = 'Mark as Studied';
            studyBtn.onmouseenter = null;
            studyBtn.onmouseleave = null;
        }
    } else if (isStudiedToday) {
        studyBtn.textContent = 'Studied Today ✓';
        studyBtn.className = 'c3-footer-btn c3-footer-studied studied';
        studyBtn.disabled = false;
        studyBtn.onmouseenter = () => { studyBtn.textContent = 'Unmark as Studied'; };
        studyBtn.onmouseleave = () => { studyBtn.textContent = 'Studied Today ✓'; };
    } else {
        const totalCount = C3_TABS.reduce((sum, t) => sum + getTabCount(id, t), 0);
        const hasContent = totalCount > 0;
        studyBtn.textContent = 'Mark as Studied';
        studyBtn.className = 'c3-footer-btn c3-footer-studied';
        studyBtn.disabled = !hasContent;
        studyBtn.onmouseenter = null;
        studyBtn.onmouseleave = null;
    }

    // Prev / Next
    const sorted = typeof getSortedSections === 'function'
        ? getSortedSections().filter(s => s.type !== 'dummy')
        : [];
    const currentIndex = sorted.findIndex(s => String(s.id) === String(id));
    prevBtn.disabled = currentIndex <= 0;
    nextBtn.disabled = currentIndex >= sorted.length - 1;
}

// ===== CALLED FROM col1-2 when section selected =====
function onSectionSelected(id, section) {
    c3State.currentSectionId = id;
    if (typeof loadC4ForSection === 'function') loadC4ForSection(id);
    if (typeof loadC5ForSection === 'function') loadC5ForSection(id);
    renderC3(id);
}

// ===== FOOTER ACTIONS =====
function isCurrentSectionStudiedToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return c5State.revisions.some(r => {
        if (!r.date || !r.year) return false;
        const [day, month] = r.date.split('/').map(Number);
        const d = new Date(r.year, month - 1, day);
        d.setHours(0, 0, 0, 0);
        return d.getTime() === today.getTime();
    });
}

function c3MarkStudied() {
    const id = c3State.currentSectionId;
    const today = getToday();
    const alreadyStudied = isCurrentSectionStudiedToday();

    if (alreadyStudied) {
        // Remove today's date and all after it
        const idx = c5State.revisions.findIndex(r => {
            if (!r.date || !r.year) return false;
            return isSameDay(parseDateStr(r.date, r.year), today);
        });
        if (idx !== -1) {
            const sw = c5State.revisions[idx].scheduledWeek;
            const sy = c5State.revisions[idx].scheduledYear;
            c5State.revisions[idx] = { date: null, year: null, scheduledWeek: sw, scheduledYear: sy };
            for (let i = idx + 1; i < c5State.revisions.length; i++) {
                c5State.revisions[i] = { date: null, year: null, scheduledWeek: null, scheduledYear: null };
            }
        }
    } else {
        const lastFilledIndex = c5State.revisions.reduce((last, r, i) => r.date !== null ? i : last, -1);
        const nextIndex = lastFilledIndex + 1;

        // Extend revisions array if needed
        while (c5State.revisions.length <= nextIndex + 1) {
            c5State.revisions.push({ date: null, year: null, scheduledWeek: null, scheduledYear: null });
            c5State.totalSlots++;
        }

        const prev = lastFilledIndex >= 0 ? c5State.revisions[lastFilledIndex] : null;
        if (prev) {
            const prevDate = parseDateStr(prev.date, prev.year);
            if (prevDate && isSameDay(prevDate, today)) return;
        }

        const d = today;
        const day   = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year  = d.getFullYear();

        const actualWeek = getISOWeek(d);
        const actualYear = getISOWeekYear(d);

        const prevSched = c5State.revisions[nextIndex];
        const scheduledWeek = prevSched.scheduledWeek || null;
        const scheduledYear = prevSched.scheduledYear || null;

        c5State.revisions[nextIndex] = { date: day + '/' + month, year, scheduledWeek, scheduledYear };

        // Update schedule
        c5UpdateScheduleAfterStudy(nextIndex, d);
    }

    const allNowFilled = c5State.revisions.slice(0, c5State.activatedCount).every(r => r.date !== null);
    if (allNowFilled) c5State.isCompleted = true;
    else c5State.isCompleted = false;

    saveC5ForSection(id);
    renderC5();
    renderC3Footer(id);
    if (typeof renderSectionList === 'function') renderSectionList();
}

function c3NavPrev() {
    const sorted = typeof getSortedSections === 'function'
        ? getSortedSections().filter(s => s.type !== 'dummy')
        : [];
    const i = sorted.findIndex(s => String(s.id) === String(c3State.currentSectionId));
    if (i > 0) selectSection(sorted[i - 1].id);
}

function c3NavNext() {
    const sorted = typeof getSortedSections === 'function'
        ? getSortedSections().filter(s => s.type !== 'dummy')
        : [];
    const i = sorted.findIndex(s => String(s.id) === String(c3State.currentSectionId));
    if (i < sorted.length - 1) selectSection(sorted[i + 1].id);
}

// ===== CLOSE COMING SOON ON OVERLAY CLICK =====
document.addEventListener('DOMContentLoaded', () => {
    const overlay = document.getElementById('c3ComingSoonOverlay');
    if (overlay) {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeComingSoon();
        });
    }
});