// uploaddocx.js - DOCX upload handler for Column 3

// ===== MAIN HANDLER =====
function handleC3UploadDocx(event, panel, sectionId, tab, levelId) {
    const file = event.target.files[0];
    if (!file) return;

    if (!window.mammoth) {
        alert('Mammoth.js not loaded yet. Please try again in a moment.');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const arrayBuffer = e.target.result;

        // Ask user: plain or cornell
        showDocxTemplateModal(arrayBuffer, panel, sectionId, tab, levelId);
    };
    reader.readAsArrayBuffer(file);
}

// ===== TEMPLATE CHOICE MODAL =====
function showDocxTemplateModal(arrayBuffer, panel, sectionId, tab, levelId) {
    // Reuse existing coming soon overlay area — build a simple inline modal
    const overlay = document.createElement('div');
    overlay.className = 'c3-coming-soon-overlay active';
    overlay.id = 'c3DocxTemplateOverlay';

    overlay.innerHTML = `
        <div class="c3-coming-soon-modal" style="gap:20px;">
            <div class="c3-coming-soon-icon">📋</div>
            <div class="c3-coming-soon-title">Choose Template</div>
            <div class="c3-coming-soon-desc">How should the docx be imported?</div>
            <div style="display:flex;gap:12px;margin-top:8px;">
                <button id="docxPlainBtn" class="c3-btn c3-btn-secondary" style="flex:1;">Plain</button>
                <button id="docxCornellBtn" class="c3-btn c3-btn-save" style="flex:1;">Cornell</button>
            </div>
            <button class="c3-coming-soon-close" id="docxTemplateClose">✕</button>
        </div>`;

    document.body.appendChild(overlay);

    document.getElementById('docxTemplateClose').onclick = () => overlay.remove();

    document.getElementById('docxPlainBtn').onclick = () => {
        overlay.remove();
        processDocxPlain(arrayBuffer, panel, sectionId, tab, levelId);
    };

    document.getElementById('docxCornellBtn').onclick = () => {
        overlay.remove();
        processDocxCornell(arrayBuffer, panel, sectionId, tab, levelId);
    };
}

// ===== EXTRACT INDENT LEVELS FROM RAW DOCX XML =====
async function extractParagraphIndents(arrayBuffer) {
    const indentedTexts = new Set();
    try {
        // Use native ZIP reading via a worker-free approach
        // DOCX is a ZIP — use the File API trick with a blob and zip.js-style local file reading
        // We'll use the fact that mammoth already parsed the zip — instead, parse via fetch blob
        const blob = new Blob([arrayBuffer], { type: 'application/zip' });
        const url = URL.createObjectURL(blob);

        // Use a hidden iframe trick isn't viable — instead use fflate if available, else fallback
        // Try fflate (lightweight, no CDN needed if bundled) — fallback: use style-name matching only
        if (typeof fflate === 'undefined') {
            URL.revokeObjectURL(url);
            return indentedTexts; // fallback to style-name only approach
        }

        const uint8 = new Uint8Array(arrayBuffer);
        const unzipped = fflate.unzipSync(uint8);
        const xmlBytes = unzipped['word/document.xml'];
        if (!xmlBytes) return indentedTexts;
        const xmlStr = new TextDecoder().decode(xmlBytes);

        const paraRegex = /<w:p[ >][\s\S]*?<\/w:p>/g;
        let match;
        while ((match = paraRegex.exec(xmlStr)) !== null) {
            const para = match[0];
            if (/w:numPr/.test(para)) continue;
            const indMatch = para.match(/w:left="(\d+)"/);
            if (!indMatch || parseInt(indMatch[1]) < 360) continue;
            const text = para.replace(/<[^>]+>/g, '').trim();
            if (text) indentedTexts.add(text);
        }
        URL.revokeObjectURL(url);
    } catch(e) {
        console.log('[indent] error:', e);
    }
    return indentedTexts;
}

// ===== APPLY INDENT CLASSES TO HTML =====
function applyDocxIndent(html, indentedTexts) {
    if (!indentedTexts || indentedTexts.size === 0) return html;
    console.log('[indent] applying to', indentedTexts.size, 'texts');
    const temp = document.createElement('div');
    temp.innerHTML = html;
    temp.querySelectorAll('p').forEach(function(p) {
        if (p.closest('li')) return;
        const text = p.textContent.trim();
        if (text && indentedTexts.has(text)) {
            p.classList.add('docx-indent-1');
        }
    });
    return temp.innerHTML;
}

// ===== PLAIN PROCESSING =====
function processDocxPlain(arrayBuffer, panel, sectionId, tab, levelId) {
    const bufferCopy = arrayBuffer.slice(0);
    const indentPromise = extractParagraphIndents(bufferCopy);

    mammoth.convertToHtml({ arrayBuffer }, {
        styleMap: [
            "p[style-name='Heading 1'] => p:fresh",
            "p[style-name='Heading 2'] => p:fresh",
            "p[style-name='Heading 3'] => p:fresh",
            "p[style-name='Heading 4'] => p:fresh",
            "p[style-name='Heading 5'] => p:fresh",
            "p[style-name='Heading 6'] => p:fresh",
        ],
        convertImage: mammoth.images.imgElement(function(image) {
            return image.read('base64').then(function(imageData) {
                return { src: 'data:' + image.contentType + ';base64,' + imageData };
            });
        })
    }).then(function(result) {
        return indentPromise.then(function(indents) {
            // Strip bold/italic/underline from plain upload
            const temp = document.createElement('div');
            temp.innerHTML = result.value;
            temp.querySelectorAll('strong, b').forEach(el => {
                const span = document.createElement('span');
                span.innerHTML = el.innerHTML;
                el.replaceWith(span);
            });
            temp.querySelectorAll('em, i, u').forEach(el => {
                const span = document.createElement('span');
                span.innerHTML = el.innerHTML;
                el.replaceWith(span);
            });
            const html = applyDocxIndent(temp.innerHTML, indents);
            if (!html || !html.trim()) {
                alert('No content found in the docx file.');
                return;
            }

            const levelData = getLevelData(sectionId, tab, levelId);
            levelData.versions.push({ template: 'plain', html });
            levelData.currentVersion = levelData.versions.length - 1;
            saveC3State();

            const levelDef = NOTES_LEVELS.find(l => l.id === levelId);
            const labelText = levelDef ? levelDef.label : (tab.charAt(0).toUpperCase() + tab.slice(1));
            const targetPanel = panel || document.getElementById('c3TabPanel_' + tab);
            if (targetPanel) renderContentState(targetPanel, sectionId, tab, levelId, labelText);
            closeAddModal();
            if (typeof renderC5 === 'function') renderC5();
        });
    }).catch(function(err) {
        alert('Failed to read docx: ' + err.message);
    });
}

// ===== CORNELL PROCESSING =====
function processDocxCornell(arrayBuffer, panel, sectionId, tab, levelId) {
    const bufferCopy = arrayBuffer.slice(0);
    const indentPromise = extractParagraphIndents(bufferCopy);

    mammoth.convertToHtml({ arrayBuffer }, {
        styleMap: [
            "p[style-name='Heading 1'] => h1:fresh",
            "p[style-name='Heading 2'] => h2:fresh",
            "p[style-name='Heading 4'] => h4:fresh",
        ],
        convertImage: mammoth.images.imgElement(function(image) {
            return image.read('base64').then(function(imageData) {
                return { src: 'data:' + image.contentType + ';base64,' + imageData };
            });
        })
    }).then(function(result) {
        return indentPromise.then(function(indentedTexts) {
            const html = result.value;
            const parsed = parseDocxCornell(html, indentedTexts);

            if (parsed.error) {
                alert('Upload failed:\n\n' + parsed.error);
                return;
            }

            const levelData = getLevelData(sectionId, tab, levelId);
            levelData.versions.push({ template: 'cornell', cells: parsed.cells });
            levelData.currentVersion = levelData.versions.length - 1;
            saveC3State();

            const levelDef = NOTES_LEVELS.find(l => l.id === levelId);
            const labelText = levelDef ? levelDef.label : (tab.charAt(0).toUpperCase() + tab.slice(1));
            const targetPanel = panel || document.getElementById('c3TabPanel_' + tab);
            if (targetPanel) renderContentState(targetPanel, sectionId, tab, levelId, labelText);
            closeAddModal();
            if (typeof renderC5 === 'function') renderC5();
        });
    }).catch(function(err) {
        alert('Failed to read docx: ' + err.message);
    });
}

// ===== CORNELL PARSER =====
function parseDocxCornell(html, indentedTexts) {
    const temp = document.createElement('div');
    temp.innerHTML = html;

    const children = Array.from(temp.children);
    const cells = [];

    for (let i = 0; i < children.length; i++) {
        const el = children[i];
        const tag = el.tagName.toLowerCase();

        // Only tables and h1/h2 allowed — anything else is error
        if (tag === 'h1' || tag === 'h2') {
            // h1 → header cell, h2 → code cell
            // But per rules these should be inside tables — flag as error
            return { error: `Unexpected element <${tag}> found outside a table. All content must be inside tables.` };
        }

        if (tag !== 'table') {
            // Any non-table element (p, h3, ul, etc.)
            if (el.textContent.trim() !== '') {
                return { error: `Unexpected content found outside a table: "${el.textContent.trim().substring(0, 50)}". All content must be inside tables.` };
            }
            continue; // skip empty elements
        }

        // It's a table — analyze columns
        const rows = Array.from(el.querySelectorAll('tr'));
        if (rows.length === 0) continue;

        // Determine column count from first row
        const firstRowCols = rows[0].querySelectorAll('td, th').length;

        // Check if ALL cells in table contain only h4 text → treat as plain normal table
        const allTds = Array.from(el.querySelectorAll('td, th'));
        const nonEmptyTds = allTds.filter(td => td.textContent.trim() !== '');
        const allH4 = nonEmptyTds.length > 0 && nonEmptyTds.every(td => {
            const wrap = document.createElement('div');
            wrap.innerHTML = td.innerHTML.trim();
            const children = Array.from(wrap.children).filter(c => c.textContent.trim() !== '');
            return children.length > 0 && children.every(c => c.tagName.toLowerCase() === 'h4');
        });

        if (allH4) {
            // All cells are h4 → import as plain normal table with styling
            cells.push({ type: 'normal', rows: [{ content: buildStyledTable(el, rows) }] });
            continue;
        }

        if (firstRowCols === 1) {
            // Single column table — determine cell type from first row
            const firstTd = rows[0].querySelector('td, th');
            const firstInner = document.createElement('div');
            firstInner.innerHTML = firstTd ? firstTd.innerHTML.trim() : '';
            const firstTag = firstInner.firstElementChild ? firstInner.firstElementChild.tagName.toLowerCase() : null;

            let cellType = 'normal';
            if (firstTag === 'h1') cellType = 'header';
            else if (firstTag === 'h2') cellType = 'code';

            // All rows become rows inside one cell
            const cellRows = [];
            for (let r = 0; r < rows.length; r++) {
                const td = rows[r].querySelector('td, th');
                if (!td) continue;

                const inner = document.createElement('div');
                inner.innerHTML = td.innerHTML.trim();

                let content = '';
                if (cellType === 'header' || cellType === 'code') {
                    // Unwrap h1/h2 tags, preserve each paragraph as <br> separated line
                    const paras = inner.querySelectorAll('h1, h2, p');
                    if (paras.length > 0) {
                        content = Array.from(paras).map(p => p.innerHTML).join('<br>');
                    } else {
                        content = inner.innerHTML;
                    }
                } else {
                    content = applyDocxIndent(inner.innerHTML, indentedTexts);
                }

                cellRows.push({ content });
            }

            cells.push({ type: cellType, rows: cellRows });
        } else if (firstRowCols === 2) {
            // Two column table → one cornell cell with all rows inside it
            // Detect header-cornell: left cell contains h1
            const firstLeftTd = rows[0].querySelector('td, th');
            const leftInner = document.createElement('div');
            leftInner.innerHTML = firstLeftTd ? firstLeftTd.innerHTML.trim() : '';
            const hasH1Left = !!leftInner.querySelector('h1');
            const cornellType = hasH1Left ? 'header-cornell' : 'cornell';

            const cornellRows = [];
            for (let r = 0; r < rows.length; r++) {
                const tds = rows[r].querySelectorAll('td, th');
                if (tds.length < 2) continue;
                // Strip h1 tags from left, keep text
                const leftDiv = document.createElement('div');
                leftDiv.innerHTML = tds[0].innerHTML.trim();
                leftDiv.querySelectorAll('h1').forEach(h => {
                    const span = document.createElement('span');
                    span.innerHTML = h.innerHTML;
                    h.replaceWith(span);
                });
                cornellRows.push({ left: leftDiv.innerHTML.trim(), right: applyDocxIndent(tds[1].innerHTML.trim(), indentedTexts) });
            }
            cells.push({ type: cornellType, rows: cornellRows });
        } else {
            // 3+ columns → normal cell with styled table
            cells.push({ type: 'normal', rows: [{ content: buildStyledTable(el, rows) }] });
        }
    }

    if (cells.length === 0) {
        return { error: 'No content found in the docx file.' };
    }

    return { cells };
}

// ===== BUILD STYLED TABLE HTML =====
function buildStyledTable(el, rows) {
    const colCount = rows[0].querySelectorAll('td, th').length;
    const colWidth = (100 / colCount).toFixed(2) + '%';

    let html = `<table class="bordered" style="width:100%;table-layout:fixed;"><colgroup>`;
    for (let c = 0; c < colCount; c++) html += `<col style="width:${colWidth};">`;
    html += `</colgroup><tbody>`;

    rows.forEach((row, r) => {
        const tds = Array.from(row.querySelectorAll('td, th'));
        let rowBg = '';
        if (r === 0) {
            rowBg = 'background:var(--bg-active);';
        } else if (r % 2 === 0) {
            rowBg = 'background:var(--bg-secondary);';
        } else {
            rowBg = 'background:var(--bg-primary);';
        }

        html += '<tr>';
        tds.forEach(td => {
            const wrap = document.createElement('div');
            wrap.innerHTML = td.innerHTML.trim();
            wrap.querySelectorAll('h4').forEach(h => {
                const span = document.createElement('span');
                span.innerHTML = h.innerHTML;
                h.replaceWith(span);
            });
            const cellContent = wrap.innerHTML;

            if (r === 0) {
                html += `<td style="${rowBg}font-weight:600;color:var(--text-primary);padding:6px 8px;">${cellContent}</td>`;
            } else {
                html += `<td style="${rowBg}padding:6px 8px;">${cellContent}</td>`;
            }
        });
        html += '</tr>';
    });

    html += '</tbody></table>';
    return html;
}