// uploadpdf.js - PDF Viewer for Reference Tab

// ===== STATE =====
const pdfState = {
    pdfDoc: null,
    currentVersion: -1,    // index into levelData.versions for current pdf
    sectionId: null,
    tab: 'reference',
    levelId: 'default',
    mode: 'view',           // 'view' | 'edit'
    scale: 1.0,
    fitMode: 'width',       // 'width' | 'height' | 'visible' | 'actual' | 'page'
    annotMode: null,        // 'highlight' | 'underline' | 'strikethrough' | null
    annotations: {},        // key: `${sectionId}_${versionIndex}` -> array of annotation objects
    searchQuery: '',
    searchResults: [],
    searchIndex: -1,
};

const PDF_JS_CDN = 'libs/pdf.min.js';

const PDF_COLORS = ['#FFD700','#FF6B6B','#4ECDC4','#45B7D1','#96CEB4','#FF9F43','#A29BFE','#FD79A8','#55EFC4','#FFFFFF'];

const pdfAnnotColors = {
    highlight: '#FFD700',
    underline: '#4d9fec',
    strikethrough: '#f47067',
};

const PDF_JS_WORKER = 'libs/pdf.worker.min.js';

// ===== LOAD PDF.JS =====
function loadPdfJs(callback) {
    if (window.pdfjsLib) { callback(); return; }
    const script = document.createElement('script');
    script.src = PDF_JS_CDN;
    script.onload = () => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_JS_WORKER;
        callback();
    };
    document.head.appendChild(script);
}

// ===== OPEN PDF VIEWER =====
function openPdfViewer(sectionId, levelId, versionIndex, mode) {
    pdfState.sectionId = sectionId;
    pdfState.levelId = levelId;
    pdfState.currentVersion = versionIndex;
    pdfState.mode = mode || 'view';
    pdfState.annotMode = null;

    const overlay = document.getElementById('c3PdfOverlay');
    if (!overlay) return;
    overlay.classList.add('active');

    updatePdfToolbar();
    pdfInitColorMenus();

    const levelData = getLevelData(sectionId, 'reference', levelId);
    const version = levelData.versions[versionIndex];
    if (!version || !version.pdfData) {
        showPdfError('No PDF data found.');
        return;
    }

    loadPdfJs(() => {
        const binary = atob(version.pdfData);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        pdfjsLib.getDocument({ data: bytes }).promise.then(doc => {
            pdfState.pdfDoc = doc;
            renderAllPages();
        }).catch(err => {
            showPdfError('Failed to load PDF: ' + err.message);
        });
    });
}

// ===== RENDER ALL PAGES =====
function renderAllPages() {
    const container = document.getElementById('c3PdfContainer');
    if (!container) return;
    container.innerHTML = '';

    if (!pdfState.pdfDoc) return;

    const totalPages = pdfState.pdfDoc.numPages;
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        renderPage(pageNum, container);
    }
}

function renderPage(pageNum, container) {
    pdfState.pdfDoc.getPage(pageNum).then(page => {
        const scale = getScale(page);
        const viewport = page.getViewport({ scale });

        const pageWrapper = document.createElement('div');
        pageWrapper.className = 'c3-pdf-page-wrapper';
        pageWrapper.dataset.page = pageNum;

        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        const annotLayer = document.createElement('div');
        annotLayer.className = 'c3-pdf-annot-layer';
        annotLayer.style.width = viewport.width + 'px';
        annotLayer.style.height = viewport.height + 'px';
        annotLayer.style.pointerEvents = (pdfState.mode === 'edit' && pdfState.annotMode) ? 'all' : 'none';
        annotLayer.style.cursor = (pdfState.mode === 'edit' && pdfState.annotMode) ? 'crosshair' : 'default';

        pageWrapper.appendChild(canvas);
        pageWrapper.appendChild(annotLayer);
        container.appendChild(pageWrapper);

        const ctx = canvas.getContext('2d');
        page.render({ canvasContext: ctx, viewport }).promise.then(() => {
            drawAnnotations(pageNum, annotLayer, viewport);
            if (pdfState.mode === 'edit') {
                setupAnnotationEvents(pageNum, canvas, annotLayer, viewport);
            }
        });
    });
}

// ===== SCALE CALCULATION =====
function getScale(page) {
    const container = document.getElementById('c3PdfContainer');
    if (!container) return pdfState.scale;

    const viewport = page.getViewport({ scale: 1 });
    const containerWidth = container.clientWidth - 32;
    const containerHeight = container.clientHeight - 32;

    switch (pdfState.fitMode) {
        case 'width':   return containerWidth / viewport.width;
        case 'height':  return containerHeight / viewport.height;
        case 'visible': return Math.min(containerWidth / viewport.width, containerHeight / viewport.height);
        case 'page':    return Math.min(containerWidth / viewport.width, containerHeight / viewport.height);
        case 'actual':  return 1.0;
        default:        return pdfState.scale;
    }
}

// ===== ANNOTATIONS =====
function getAnnotKey() {
    return `${pdfState.sectionId}_${pdfState.currentVersion}`;
}

function getAnnotations() {
    const key = getAnnotKey();
    if (!pdfState.annotations[key]) pdfState.annotations[key] = [];
    return pdfState.annotations[key];
}

function drawAnnotations(pageNum, layer, viewport) {
    layer.innerHTML = '';
    const annots = getAnnotations().filter(a => a.page === pageNum);
    annots.forEach(a => {
        const el = document.createElement('div');
        el.className = 'c3-pdf-annot';
        el.style.left   = (a.x * viewport.width) + 'px';
        el.style.top    = (a.y * viewport.height) + 'px';
        el.style.width  = (a.w * viewport.width) + 'px';
        el.style.height = (a.h * viewport.height) + 'px';
        const color = a.color || (a.type === 'highlight' ? '#FFD700' : a.type === 'underline' ? '#4d9fec' : '#f47067');
        if (a.type === 'highlight') {
            el.style.background = color;
            el.style.opacity = '0.35';
            el.style.borderRadius = '2px';
        } else if (a.type === 'underline') {
            el.style.background = 'transparent';
            el.style.borderBottom = `2px solid ${color}`;
        } else if (a.type === 'strikethrough') {
            el.style.background = 'transparent';
            el.style.borderBottom = `2px solid ${color}`;
            el.style.transform = 'translateY(-50%)';
        }
        layer.appendChild(el);
    });
}

function setupAnnotationEvents(pageNum, canvas, layer, viewport) {
    if (pdfState.mode !== 'edit') return;
    let startX, startY, isDrawing = false, tempEl = null;

    layer.addEventListener('mousedown', e => {
        if (!pdfState.annotMode) return;
        const rect = layer.getBoundingClientRect();
        startX = e.clientX - rect.left;
        startY = e.clientY - rect.top;
        isDrawing = true;

        tempEl = document.createElement('div');
        tempEl.className = 'c3-pdf-annot temp';
        const tempColor = pdfAnnotColors[pdfState.annotMode];
        if (pdfState.annotMode === 'highlight') {
            tempEl.style.background = tempColor;
            tempEl.style.opacity = '0.35';
            tempEl.style.borderRadius = '2px';
        } else if (pdfState.annotMode === 'underline') {
            tempEl.style.background = 'transparent';
            tempEl.style.borderBottom = `2px solid ${tempColor}`;
        } else if (pdfState.annotMode === 'strikethrough') {
            tempEl.style.background = 'transparent';
            tempEl.style.borderBottom = `2px solid ${tempColor}`;
            tempEl.style.transform = 'translateY(-50%)';
        }
        tempEl.style.left = startX + 'px';
        tempEl.style.top  = startY + 'px';
        layer.appendChild(tempEl);
    });

    layer.addEventListener('mousemove', e => {
        if (!isDrawing || !tempEl) return;
        const rect = layer.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        tempEl.style.width  = Math.abs(x - startX) + 'px';
        tempEl.style.height = Math.abs(y - startY) + 'px';
        tempEl.style.left   = Math.min(x, startX) + 'px';
        tempEl.style.top    = Math.min(y, startY) + 'px';
    });

    layer.addEventListener('mouseup', e => {
        if (!isDrawing || !tempEl) return;
        isDrawing = false;
        const rect = layer.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const ax = Math.min(x, startX) / viewport.width;
        const ay = Math.min(y, startY) / viewport.height;
        const aw = Math.abs(x - startX) / viewport.width;
        const ah = Math.abs(y - startY) / viewport.height;

        if (aw > 0.005 && ah > 0.002) {
            getAnnotations().push({ type: pdfState.annotMode, page: pageNum, x: ax, y: ay, w: aw, h: ah, color: pdfAnnotColors[pdfState.annotMode] });
            drawAnnotations(pageNum, layer, viewport);
        } else {
            tempEl.remove();
        }
        tempEl = null;
    });
}

// ===== TOOLBAR ACTIONS =====
function updatePdfToolbar() {
    const editTools = document.getElementById('c3PdfEditTools');
    const saveRow   = document.getElementById('c3PdfSaveRow');
    if (editTools) editTools.style.display = pdfState.mode === 'edit' ? 'flex' : 'none';
    if (saveRow)   saveRow.style.display   = pdfState.mode === 'edit' ? 'flex' : 'none';

    // Mode toggle buttons
    const btnEdit = document.getElementById('c3PdfModeEdit');
    const btnView = document.getElementById('c3PdfModeView');
    if (btnEdit) { btnEdit.classList.toggle('active', pdfState.mode === 'edit'); }
    if (btnView) { btnView.classList.toggle('active', pdfState.mode === 'view'); }

    // Annot buttons
    ['highlight', 'underline', 'strikethrough'].forEach(type => {
        const btn = document.getElementById('c3PdfAnnot_' + type);
        if (btn) btn.classList.toggle('active', pdfState.annotMode === type);
    });

    // Fit dropdown label
    const fitLabels = { width: 'Fit Width', height: 'Fit Height', visible: 'Fit Visible', actual: 'Actual Size', page: 'Fit Page' };
    const fitTrigger = document.getElementById('c3PdfFitTrigger');
    if (fitTrigger) fitTrigger.querySelector('span').textContent = fitLabels[pdfState.fitMode] || 'Fit Width';
}

function pdfSwitchMode(mode) {
    const container = document.getElementById('c3PdfContainer');
    const scrollTop = container ? container.scrollTop : 0;
    pdfState.mode = mode;
    pdfState.annotMode = null;
    updatePdfToolbar();
    renderAllPages();
    if (container) setTimeout(() => { container.scrollTop = scrollTop; }, 50);
}

function pdfSetFit(mode) {
    pdfState.fitMode = mode;
    document.getElementById('c3PdfFitMenu').classList.remove('active');
    updatePdfToolbar();
    renderAllPages();
}

function pdfZoomIn() {
    pdfState.fitMode = 'custom';
    pdfState.scale = Math.min(pdfState.scale + 0.25, 5.0);
    renderAllPages();
}

function pdfZoomOut() {
    pdfState.fitMode = 'custom';
    pdfState.scale = Math.max(pdfState.scale - 0.25, 0.25);
    renderAllPages();
}

// ===== COLOR PICKER =====
function pdfInitColorMenus() {
    ['highlight', 'underline', 'strikethrough'].forEach(type => {
        const menu = document.getElementById('c3PdfColorMenu_' + type);
        if (!menu) return;
        menu.innerHTML = '';
        PDF_COLORS.forEach(color => {
            const swatch = document.createElement('div');
            swatch.className = 'c3-pdf-color-swatch';
            swatch.style.background = color;
            swatch.onclick = () => {
                pdfAnnotColors[type] = color;
                const dot = document.getElementById('c3PdfColorDot_' + type);
                if (dot) dot.style.background = color;
                menu.classList.remove('active');
            };
            menu.appendChild(swatch);
        });
    });
}

function pdfToggleColorPicker(type) {
    ['highlight', 'underline', 'strikethrough'].forEach(t => {
        if (t !== type) document.getElementById('c3PdfColorMenu_' + t)?.classList.remove('active');
    });
    document.getElementById('c3PdfColorMenu_' + type)?.classList.toggle('active');
}

function pdfToggleAnnot(type) {
    pdfState.annotMode = pdfState.annotMode === type ? null : type;
    updatePdfToolbar();
    document.querySelectorAll('.c3-pdf-annot-layer').forEach(layer => {
        layer.style.pointerEvents = pdfState.annotMode ? 'all' : 'none';
        layer.style.cursor = pdfState.annotMode ? 'crosshair' : 'default';
    });
    ['highlight', 'underline', 'strikethrough'].forEach(t => {
        const group = document.getElementById('c3PdfAnnot_' + t)?.closest('.c3-pdf-annot-group');
        if (group) group.classList.toggle('active', t === pdfState.annotMode);
    });
}

// ===== SEARCH =====
function pdfSearch() {
    const query = document.getElementById('c3PdfSearchInput')?.value?.trim().toLowerCase();
    if (!query || !pdfState.pdfDoc) return;

    // Remove old search highlights
    document.querySelectorAll('.c3-pdf-search-highlight').forEach(el => el.remove());

    const doc = pdfState.pdfDoc;
    const totalPages = doc.numPages;
    let firstMatch = null;

    const searchPage = (pageNum) => {
        return doc.getPage(pageNum).then(page => {
            const scale = getScale(page);
            const viewport = page.getViewport({ scale });
            return page.getTextContent().then(textContent => {
                const pageWrapper = document.querySelector(`.c3-pdf-page-wrapper[data-page="${pageNum}"]`);
                if (!pageWrapper) return;

                textContent.items.forEach(item => {
                    if (!item.str.toLowerCase().includes(query)) return;

                    const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
                    const x = tx[4];
                    const y = tx[5];
                    const w = item.width * scale;
                    const h = item.height * scale;

                    const highlight = document.createElement('div');
                    highlight.className = 'c3-pdf-search-highlight';
                    highlight.style.left   = x + 'px';
                    highlight.style.top    = (y - h) + 'px';
                    highlight.style.width  = w + 'px';
                    highlight.style.height = h + 'px';
                    pageWrapper.appendChild(highlight);

                    if (!firstMatch) firstMatch = highlight;
                });
            });
        });
    };

    const pages = [];
    for (let i = 1; i <= totalPages; i++) pages.push(i);
    Promise.all(pages.map(searchPage)).then(() => {
        if (firstMatch) firstMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
}

// ===== SAVE =====
function pdfSaveCurrent() {
    saveCurrentPdfAnnotations();
    saveC3State();
    closePdfViewer();
    const panel = document.getElementById('c3TabPanel_reference');
    if (panel) renderContentState(panel, pdfState.sectionId, 'reference', pdfState.levelId, 'Reference');
}

function pdfSaveAsNew() {
    const levelData = getLevelData(pdfState.sectionId, 'reference', pdfState.levelId);
    const currentVer = levelData.versions[pdfState.currentVersion];
    if (!currentVer) return;

    // Clone version with current annotations
    const newVer = { ...currentVer, source: 'pdf' };
    levelData.versions.push(newVer);
    levelData.currentVersion = levelData.versions.length - 1;
    pdfState.currentVersion = levelData.currentVersion;

    // Move annotations to new version
    const oldKey = getAnnotKey();
    const oldAnnots = pdfState.annotations[oldKey] ? [...pdfState.annotations[oldKey]] : [];
    pdfState.annotations[`${pdfState.sectionId}_${pdfState.currentVersion}`] = oldAnnots;

    saveCurrentPdfAnnotations();
    saveC3State();
    closePdfViewer();
    const panel = document.getElementById('c3TabPanel_reference');
    if (panel) renderContentState(panel, pdfState.sectionId, 'reference', pdfState.levelId, 'Reference');
}

function saveCurrentPdfAnnotations() {
    const levelData = getLevelData(pdfState.sectionId, 'reference', pdfState.levelId);
    const version = levelData.versions[pdfState.currentVersion];
    if (!version) return;
    version.annotations = getAnnotations();
}

// ===== CLOSE =====
function closePdfViewer() {
    const overlay = document.getElementById('c3PdfOverlay');
    if (overlay) overlay.classList.remove('active');
    pdfState.pdfDoc = null;
    pdfState.annotMode = null;
}

// ===== UPLOAD PDF FILE =====
function handleC3UploadPdf(event, panel, sectionId, tab, levelId) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        // Store as base64
        const base64 = e.target.result.split(',')[1];

        const levelData = getLevelData(sectionId, tab, levelId);
        levelData.versions.push({ template: 'pdf', pdfData: base64, source: 'pdf', annotations: [] });
        levelData.currentVersion = levelData.versions.length - 1;

        saveC3State();
        closeAddModal();

        const targetPanel = panel || document.getElementById('c3TabPanel_' + tab);
        if (targetPanel) renderContentState(targetPanel, sectionId, tab, levelId, 'Reference');
        initTabBar();
    };
    reader.readAsDataURL(file);
}

// ===== SHOW ERROR =====
function showPdfError(msg) {
    const container = document.getElementById('c3PdfContainer');
    if (container) container.innerHTML = `<div style="color:#ef4444;padding:32px;text-align:center;">${msg}</div>`;
}

// ===== SEARCH ON ENTER =====
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('c3PdfSearchInput');
    if (searchInput) searchInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') pdfSearch();
    });

    const overlay = document.getElementById('c3PdfOverlay');
    if (overlay) {
        overlay.addEventListener('click', e => {
            if (e.target === overlay) closePdfViewer();
        });
    }

    const fitMenu = document.getElementById('c3PdfFitMenu');
    document.addEventListener('click', e => {
        if (fitMenu && !e.target.closest('#c3PdfFitWrap')) {
            fitMenu.classList.remove('active');
        }
    });
});