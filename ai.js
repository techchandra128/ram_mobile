// ai.js - AI Chat Logic

// ===== STATE =====
const aiState = {
    mode: null,
    sectionId: null,
    sectionTitle: '',
    sectionContent: '',
    chatHistory: [],
    generatedCells: null,
    questionStep: 0,
    template: null,
    detailLevel: null,
    focusArea: null,
    isGenerating: false,
    versions: [],        // array of { label, cells }
    currentVersion: -1, // index into versions
    abortController: null,
};

function setSendBtn(state) {
    const btn = document.getElementById('aiSendBtn');
    if (!btn) return;
    if (state === 'stop') {
        btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>';
        btn.onclick = aiStopGeneration;
        btn.disabled = false;
    } else {
        btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>';
        btn.onclick = aiSendMessage;
        btn.disabled = false;
    }
}

function aiStopGeneration() {
    if (aiState.abortController) aiState.abortController.abort();
    aiState.isGenerating = false;
    aiState.abortController = null;
    removeTypingIndicator();
    aiAddMessage('ai', 'Generation stopped.');
    setSendBtn('send');
}

// ===== OPEN MODAL =====
function openAiModal(mode, levelId) {
    aiState.mode = mode;
    aiState.levelId = levelId || 'crisp';
    aiState.sectionId = c3State.currentSectionId;
    aiState.sectionTitle = getSectionTitle(aiState.sectionId);
    aiState.sectionContent = getSectionContent(aiState.sectionId);
    aiState.chatHistory = [];
    aiState.generatedCells = null;
    aiState.questionStep = 0;
    aiState.template = null;
    aiState.detailLevel = null;
    aiState.focusArea = null;
    aiState.isGenerating = false;

    // Reset UI
    document.getElementById('aiMessages').innerHTML = '';
    
    // Reset versions
    aiState.versions = [];
    aiState.currentVersion = -1;

    // If existing notes — load as V1
    const existingHtml = getSectionContentHtml(aiState.sectionId);
    const existingCells = c3State.sectionData[aiState.sectionId]?.content?.cells;
    if (existingHtml && existingHtml.trim() && existingCells && existingCells.length > 0) {
        aiState.versions.push({ label: 'V1', levelId: aiState.levelId, cells: JSON.parse(JSON.stringify(existingCells)) });
        aiState.currentVersion = 0;
        renderPreviewCells(aiState.versions[0].cells);
    } else {
        document.getElementById('aiPreviewBody').innerHTML = `
            <div class="ai-preview-empty" id="aiPreviewEmpty">
                <div class="ai-preview-empty-icon">✦</div>
                <div class="ai-preview-empty-text">Notes will appear here</div>
            </div>`;
    }
    renderVersionDropdown();
    document.getElementById('aiTextarea').value = '';

    // Show overlay
    document.getElementById('aiOverlay').classList.add('active');

    // Start flow
    if (mode === 'ai-notes') {
        startAiNotesFlow();
    } else if (mode === 'ask-me') {
        startAskMeFlow();
    }
}

// ===== CLOSE MODAL =====
function closeAiModal() {
    document.getElementById('aiOverlay').classList.remove('active');
}

// ===== GET SECTION TITLE =====
function getSectionTitle(id) {
    if (id === 'navigation') return c12State.navigation.title;
    const sec = c12State.sections.find(s => s.id === id);
    return sec ? sec.title : '';
}

// ===== GET SECTION CONTENT =====
function getSectionContent(id) {
    const data = c3State.sectionData[id];
    if (!data || !data.content) return '';

    if (typeof data.content === 'object') {
        if (data.content.plain) return data.content.text || '';
        if (data.content.cells && data.content.cells.length > 0) {
            return data.content.cells.map(cell => {
                if (cell.type === 'cornell') return `${cell.left}: ${cell.right}`;
                if (cell.type === 'code') return cell.content;
                return cell.content || '';
            }).join('\n\n');
        }
        return data.content.legacy || '';
    }
    return data.content || '';
}

// ===== GET SECTION CONTENT AS HTML =====
function getSectionContentHtml(id) {
    const data = c3State.sectionData[id];
    if (!data || !data.content) return '';

    if (typeof data.content === 'object') {
        if (data.content.plain) return data.content.text || '';
        if (data.content.cells && data.content.cells.length > 0) {
            let html = '';
            data.content.cells.forEach(cell => {
                if (cell.type === 'cornell') {
                    html += `<div style="display:flex;border:1px solid #e2e8f0;border-radius:8px;margin:8px 0;">
                        <div style="width:30%;border-right:1px solid #e2e8f0;padding:10px 12px;font-weight:600;font-size:14px;color:#1e293b;text-align:right;">${cell.left || ''}</div>
                        <div style="flex:1;padding:10px 12px;font-size:14px;color:#334155;">${cell.right || ''}</div>
                    </div>`;
                } else if (cell.type === 'code') {
                    const temp = document.createElement('div');
                    temp.innerHTML = cell.content || '';
                    temp.querySelectorAll('table').forEach(t => {
                        t.style.borderCollapse = 'collapse';
                        t.style.width = '100%';
                        t.style.tableLayout = 'fixed';
                        t.querySelectorAll('td, th').forEach(c => {
                            c.style.border = '1px solid #cbd5e1';
                            c.style.padding = '6px 8px';
                        });
                    });
                    html += `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;margin:8px 0;font-family:'Courier New',monospace;font-size:13px;color:#334155;">${temp.innerHTML}</div>`;
                } else {
                    const temp = document.createElement('div');
                    temp.innerHTML = cell.content || '';
                    temp.querySelectorAll('table').forEach(t => {
                        t.style.borderCollapse = 'collapse';
                        t.style.width = '100%';
                        t.style.tableLayout = 'fixed';
                        t.querySelectorAll('td, th').forEach(c => {
                            c.style.border = '1px solid #cbd5e1';
                            c.style.padding = '6px 8px';
                        });
                    });
                    html += cell.type === 'header'
                        ? `<div style="background:#eff6ff;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;margin:8px 0;font-size:15px;font-weight:600;color:#1e293b;">${temp.innerHTML}</div>`
                        : `<div style="border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;margin:8px 0;font-size:15px;color:#111827;">${temp.innerHTML}</div>`;
                }
            });
            return html;
        }
        return data.content.legacy || '';
    }
    return data.content || '';
}

// ===== AI NOTES FLOW =====
function startAiNotesFlow() {
    const context = `[MODE: NOTES PREPARATION]\n\nSection Title: ${aiState.sectionTitle}\n\nExisting Content:\n${aiState.sectionContent || 'None'}`;
    aiState.chatHistory = [{ role: 'user', content: context }];
    showTypingIndicator();
    callAi('chat').then(response => {
        removeTypingIndicator();
        aiState.chatHistory.push({ role: 'assistant', content: response });
        aiAddMessage('ai', response);
    });
}

function askTemplateQuestion() {
    aiAddMessage('ai', 'Which template?', [
        { label: '📋 Cornell', value: 'cornell' },
        { label: '📝 Plain Text', value: 'plain' }
    ], (val) => {
        aiState.template = val;
        aiState.questionStep = 1;
        aiAddMessage('user', val === 'cornell' ? '📋 Cornell' : '📝 Plain Text');
        aiState.chatHistory.push({ role: 'user', content: val === 'cornell' ? 'Cornell' : 'Plain Text' });
        setTimeout(() => askDetailQuestion(), 400);
    });
}

function askDetailQuestion() {
    aiAddMessage('ai', 'How detailed?', [
        { label: '⚡ Crisp', value: 'crisp' },
        { label: '💡 Conceptual', value: 'conceptual' },
        { label: '📚 Detailed', value: 'detailed' },
        { label: '🔗 Syntopical', value: 'syntopical' }

    ], (val) => {
        aiState.detailLevel = val;
        aiState.levelId = val;
        aiState.questionStep = 2;
        const labels = { crisp: '⚡ Crisp', conceptual: '💡 Conceptual', detailed: '📚 Detailed', syntopical: '🔗 Syntopical' };

        aiAddMessage('user', labels[val]);
        aiState.chatHistory.push({ role: 'user', content: val });
        aiAddMessage('ai', "All set. Say the word and I'll generate.");
        aiState.chatHistory.push({ role: 'assistant', content: "All set. Say the word and I'll generate." });
    });
}

// ===== ASK ME FLOW =====
function startAskMeFlow() {
    const context = `[MODE: ASK ME]\n\nSection Title: ${aiState.sectionTitle}\n\nSection Content:\n${aiState.sectionContent || 'No content yet.'}`;
    aiState.chatHistory = [{ role: 'user', content: context }];
    showTypingIndicator();
    callAi('chat').then(response => {
        removeTypingIndicator();
        aiState.chatHistory.push({ role: 'assistant', content: response });
        aiAddMessage('ai', response);
    });
}

// ===== SEND MESSAGE =====
async function aiSendMessage() {
    const textarea = document.getElementById('aiTextarea');
    const text = textarea.value.trim();
    if (!text || aiState.isGenerating) return;

    textarea.value = '';
    resizeTextarea(textarea);
    aiAddMessage('user', text);
    aiState.chatHistory.push({ role: 'user', content: text });

    // If waiting for final generate confirmation (questionStep === 2 means options done)
    if (aiState.questionStep === 2) {
        const lower = text.toLowerCase();
        const isConfirm = lower.includes('yes') || lower.includes('go') || lower.includes('generate') || lower.includes('do it') || lower.includes('ok') || lower.includes('sure') || lower.includes('let') || lower.includes('proceed');
        if (isConfirm) {
            setTimeout(() => generateNotes(), 400);
            return;
        }
        // If not a confirm, reset to chat
        aiState.questionStep = 0;
    }

    // If in options selection step, dont process as chat
    if (aiState.questionStep === 1) return;

    // Detect regeneration intent directly in JS — dont rely on AI
    const lowerText = text.toLowerCase();
    const isRegenRequest = aiState.generatedCells && (
        lowerText.includes('crisp') || lowerText.includes('conceptual') ||
        lowerText.includes('detailed') || lowerText.includes('syntopical') ||
        lowerText.includes('regenerate') || lowerText.includes('generate again') ||
        lowerText.includes('another version') || lowerText.includes('new version') ||
        lowerText.includes('different format') || lowerText.includes('cornell') ||
        lowerText.includes('plain text') || lowerText.includes('generate notes') ||
        lowerText.includes('make notes') || lowerText.includes('create notes')
    );
    if (isRegenRequest) {
        aiState.questionStep = 0;
        aiState.template = null;
        aiState.detailLevel = null;
        setTimeout(() => askTemplateQuestion(), 400);
        return;
    }

    showTypingIndicator();
    aiState.isGenerating = true;
    setSendBtn('stop');

    const response = await callAi('chat');
    removeTypingIndicator();
    aiState.isGenerating = false;
    setSendBtn('send');

    if (response === null) return; // stopped by user

    // Check if AI wants to show options
    if (response.trim().includes('__ASK_OPTIONS__')) {
        aiState.questionStep = 0;
        aiState.template = null;
        aiState.detailLevel = null;
        askTemplateQuestion();
        return;
    }

    // Check if response is a JSON array of cells
    try {
        const trimmed = response.trim();
        if (trimmed.startsWith('[')) {
            const cells = JSON.parse(trimmed);
            if (Array.isArray(cells) && cells[0]?.type) {
                aiState.generatedCells = cells;
                const vNum = aiState.versions.length + 1;
                aiState.versions.push({ label: 'V' + vNum, levelId: aiState.levelId, cells: JSON.parse(JSON.stringify(cells)) });
                aiState.currentVersion = aiState.versions.length - 1;
                renderPreviewCells(cells);
                renderVersionDropdown();
                aiAddMessage('ai', `Notes ready! <b>V${vNum}</b> is in the preview.`);
                aiState.chatHistory.push({ role: 'assistant', content: `Notes generated as V${vNum}.` });
                aiState.questionStep = 0;
                return;
            }
        }
    } catch (e) { /* not JSON */ }

    // Check if AI is asking ready to generate — show option buttons
    const lower = response.toLowerCase();
    if (lower.includes('ready to generate')) {
        aiState.chatHistory.push({ role: 'assistant', content: response });
        aiAddMessage('ai', response, [
            { label: "Yes, let's go", value: 'yes' },
            { label: 'Not yet', value: 'no' }
        ], (val) => {
            if (val === 'yes') {
                aiAddMessage('user', "Yes, let's go");
                aiState.chatHistory.push({ role: 'user', content: "Yes, let's go" });
                setTimeout(() => askTemplateQuestion(), 400);
            } else {
                aiAddMessage('user', 'Not yet');
                aiState.chatHistory.push({ role: 'user', content: 'Not yet, I have more to discuss.' });
                aiAddMessage('ai', 'Sure, what else?');
                aiState.chatHistory.push({ role: 'assistant', content: 'Sure, what else?' });
            }
        });
        return;
    }

    aiState.chatHistory.push({ role: 'assistant', content: response });
    aiAddMessage('ai', response);
}

// ===== GENERATE NOTES =====
async function generateNotes() {
    aiAddMessage('ai', `Perfect! Generating <b>${aiState.detailLevel}</b> notes in <b>${aiState.template}</b> format...`);
    showTypingIndicator();
    aiState.isGenerating = true;
    setSendBtn('stop');

    const response = await callAi('generate');
    removeTypingIndicator();
    aiState.isGenerating = false;
    setSendBtn('send');

    if (response === null) return; // stopped by user

    try {
        const cleaned = response.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
        const cells = JSON.parse(cleaned);
        aiState.generatedCells = cells;
        aiState.questionStep = 0;
        // Add as new version
        const vNum = aiState.versions.length + 1;
        aiState.versions.push({ label: 'V' + vNum, levelId: aiState.levelId, cells: JSON.parse(JSON.stringify(cells)) });
        aiState.currentVersion = aiState.versions.length - 1;
        renderPreviewCells(cells);
        renderVersionDropdown();
        aiAddMessage('ai', `Notes generated! You can <b>import</b> them into the section or <b>copy</b> as text.`);
    } catch (e) {
        aiAddMessage('ai', 'Sorry, something went wrong generating notes. Please try again.');
        console.error('Parse error:', e, response);
    }
}

// ===== CALL AI =====
async function callAi(mode) {
    // Use test mode if enabled
    if (typeof AI_TEST_MODE !== 'undefined' && AI_TEST_MODE) {
        return await fakeApiCall(aiState.chatHistory, mode);
    }

    // Build messages
    let messages = [];

    if (mode === 'ask-me-summary') {
        messages = [{
            role: 'user',
            content: `Section Title: ${aiState.sectionTitle}\n\nSection Content:\n${aiState.sectionContent}\n\nPlease give me a concise summary of this content.`
        }];
    } else if (mode === 'generate') {
        const prompt = buildGenerationPrompt();
        messages = [
            ...aiState.chatHistory.slice(-10),
            { role: 'user', content: prompt }
        ];
    } else {
        // chat mode
        messages = [
            ...aiState.chatHistory.slice(-10), // last 10 messages for context
        ];
        if (aiState.mode === 'ask-me' && aiState.sectionContent) {
            messages = [
                {
                    role: 'user',
                    content: `Section Title: ${aiState.sectionTitle}\n\nSection Content:\n${aiState.sectionContent}`
                },
                { role: 'assistant', content: 'I have read the section content. I am ready to help.' },
                ...messages
            ];
        }
    }

    try {
        aiState.abortController = new AbortController();
        const response = await fetch('http://localhost:3001/api/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            signal: aiState.abortController.signal,
            body: JSON.stringify({
                apiKey: AI_CONFIG.apiKey,
                model: AI_CONFIG.model,
                max_tokens: AI_CONFIG.maxTokens,
                system: AI_SYSTEM_PROMPT,
                messages: messages,
            })
        });

        const data = await response.json();
        aiState.abortController = null;
        return data.content[0].text;
    } catch (e) {
        aiState.abortController = null;
        if (e.name === 'AbortError') return null;
        console.error('API error:', e);
        return 'Sorry, there was an error connecting to the AI. Please try again.';
    }
}

// ===== BUILD GENERATION PROMPT =====
function buildGenerationPrompt() {
    let prompt = `Generate notes for the following:\n\n`;
    prompt += `Section Title: ${aiState.sectionTitle}\n`;
    prompt += `Template: ${aiState.template}\n`;
    prompt += `Detail Level: ${aiState.detailLevel}\n`;
    if (aiState.focusArea) prompt += `Focus Areas: ${aiState.focusArea}\n`;
    if (aiState.sectionContent) prompt += `\nExisting Content (for reference):\n${aiState.sectionContent}\n`;
    prompt += `\nOutput ONLY the JSON array of cells. Nothing else.`;
    return prompt;
}

// ===== RENDER PREVIEW CELLS =====
function renderPreviewCells(cells) {
    const preview = document.getElementById('aiPreviewBody');
    preview.innerHTML = '';

    // Re-add floating actions
    const actions = document.createElement('div');
    actions.className = 'ai-actions';
    actions.id = 'aiActions';
    actions.innerHTML = `
        <div class="ai-version-wrap" id="aiVersionWrap"></div>
        <button class="ai-action-btn ai-btn-copy" onclick="aiCopyNotes()" title="Copy">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
        </button>
        <button class="ai-action-btn ai-btn-import" onclick="aiImportNotes()" title="Import">⬇</button>
        <button class="ai-action-btn ai-btn-close" onclick="closeAiModal()" title="Close">✕</button>`;

    const body = document.createElement('div');
    body.style.paddingTop = '48px';

    cells.forEach(cell => {
        const el = document.createElement('div');
        el.className = 'ai-cell';

        if (cell.type === 'cornell') {
            el.innerHTML = `
                <div class="ai-cornell-wrap">
                    <div class="ai-cornell-left">${cell.left || ''}</div>
                    <div class="ai-cornell-right">${cell.right || ''}</div>
                </div>`;
        } else if (cell.type === 'code') {
            const temp = document.createElement('div');
            temp.innerHTML = cell.content || '';
            temp.querySelectorAll('table').forEach(t => {
                t.style.borderCollapse = 'collapse';
                t.style.width = '100%';
                t.style.tableLayout = 'fixed';
                t.querySelectorAll('td, th').forEach(c => {
                    c.style.border = '1px solid #cbd5e1';
                    c.style.padding = '6px 8px';
                });
            });
            el.innerHTML = `<div class="ai-cell-body code">${temp.innerHTML}</div>`;
        } else if (cell.type === 'header') {
            el.innerHTML = `<div class="ai-cell-body" style="background:#eff6ff;font-weight:600;color:#1e293b;">${cell.content || ''}</div>`;
        } else {
            const temp = document.createElement('div');
            temp.innerHTML = cell.content || '';
            temp.querySelectorAll('table').forEach(t => {
                t.style.borderCollapse = 'collapse';
                t.style.width = '100%';
                t.style.tableLayout = 'fixed';
                t.querySelectorAll('td, th').forEach(c => {
                    c.style.border = '1px solid #cbd5e1';
                    c.style.padding = '6px 8px';
                });
            });
            el.innerHTML = `<div class="ai-cell-body">${temp.innerHTML}</div>`;
        }

        body.appendChild(el);
    });

    preview.appendChild(actions);
    preview.appendChild(body);
}

// ===== IMPORT NOTES =====
function aiImportNotes() {
    if (!aiState.generatedCells || aiState.generatedCells.length === 0) {
        alert('No notes to import yet.');
        return;
    }

    const sectionId = aiState.sectionId;
    const levelId = aiState.levelId || 'crisp';
    const tab = 'notes';

    const levelData = getLevelData(sectionId, tab, levelId);
    const alreadyImported = levelData.versions.some(v => v._aiImported && JSON.stringify(v.cells || v.html) === JSON.stringify(aiState.generatedCells));
    if (alreadyImported) {
        showAiToast('Already imported');
        return;
    }

    const isPlain = aiState.template === 'plain';
    if (isPlain) {
        const mergedHtml = aiState.generatedCells.map(cell => cell.content || '').join('');
        levelData.versions.push({ template: 'plain', html: mergedHtml, _aiImported: true });
    } else {
        const cells = aiState.generatedCells.map(cell => {
            if (cell.type === 'cornell') return { type: 'cornell', left: cell.left, right: cell.right };
            if (cell.type === 'code') return { type: 'code', content: cell.content };
            if (cell.type === 'header') return { type: 'header', content: cell.content };
            return { type: 'text', content: cell.content };
        });
        levelData.versions.push({ template: 'cornell', cells, _aiImported: true });
    }

    levelData.currentVersion = levelData.versions.length - 1;
    saveC3State();

    const levelDef = NOTES_LEVELS.find(l => l.id === levelId);
    const labelText = levelDef ? levelDef.label : 'Notes';
    const panel = document.getElementById('c3TabPanel_notes');
    if (panel) renderContentState(panel, sectionId, tab, levelId, labelText);
    if (typeof initTabBar === 'function') initTabBar();
    showAiToast(`Imported to ${labelText}`);
}

// ===== TOAST =====
function showAiToast(msg) {
    const existing = document.getElementById('aiToast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.id = 'aiToast';
    toast.textContent = msg;
    toast.style.cssText = `
        position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
        background: #1e293b; color: #fff; padding: 8px 16px; border-radius: 8px;
        font-size: 13px; font-weight: 500; z-index: 9999;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2); pointer-events: none;
        opacity: 1; transition: opacity 0.3s ease;
    `;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 2000);
}

// ===== COPY NOTES =====
function aiCopyNotes() {
    if (!aiState.generatedCells) {
        alert('No notes to copy yet.');
        return;
    }

    const text = aiState.generatedCells.map(cell => {
        if (cell.type === 'cornell') return `${cell.left}\n${cell.right}`;
        if (cell.type === 'code') return cell.content;
        // Strip HTML tags for plain text
        const div = document.createElement('div');
        div.innerHTML = cell.content;
        return div.textContent;
    }).join('\n\n');

    navigator.clipboard.writeText(text).then(() => {
        const btn = document.querySelector('.ai-btn-copy');
        if (btn) {
            btn.style.background = '#f0fdf4';
            btn.style.borderColor = '#86efac';
            setTimeout(() => {
                btn.style.background = '';
                btn.style.borderColor = '';
            }, 1000);
        }
    });
}

// ===== ADD MESSAGE =====
function aiAddMessage(role, text, options, optionCallback, isInput) {
    const messages = document.getElementById('aiMessages');

    const msg = document.createElement('div');
    msg.className = `ai-msg ${role}`;

    const bubble = document.createElement('div');
    bubble.className = 'ai-bubble';
    bubble.innerHTML = text;
    msg.appendChild(bubble);

    // Option buttons
    if (options && optionCallback) {
        const opts = document.createElement('div');
        opts.className = 'ai-options';
        options.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'ai-option-btn';
            btn.textContent = opt.label;
            btn.onclick = () => {
                // Disable all options after selection
                opts.querySelectorAll('.ai-option-btn').forEach(b => {
                    b.disabled = true;
                    b.style.opacity = '0.5';
                });
                btn.classList.add('selected');
                btn.style.opacity = '1';
                optionCallback(opt.value);
            };
            opts.appendChild(btn);
        });
        msg.appendChild(opts);
    }

    messages.appendChild(msg);
    messages.scrollTop = messages.scrollHeight;
}

// ===== TYPING INDICATOR =====
function showTypingIndicator() {
    const messages = document.getElementById('aiMessages');
    const typing = document.createElement('div');
    typing.className = 'ai-msg ai';
    typing.id = 'aiTyping';
    typing.innerHTML = `
        <div class="ai-typing">
            <div class="ai-typing-dot"></div>
            <div class="ai-typing-dot"></div>
            <div class="ai-typing-dot"></div>
        </div>`;
    messages.appendChild(typing);
    messages.scrollTop = messages.scrollHeight;
}

function removeTypingIndicator() {
    const typing = document.getElementById('aiTyping');
    if (typing) typing.remove();
}

// ===== TEXTAREA AUTO RESIZE =====
function resizeTextarea(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

// ===== ESCAPE HTML (for code cells) =====
function escapeHtmlAi(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');
}

// ===== VERSION DROPDOWN =====
function renderVersionDropdown() {
    const wrap = document.getElementById('aiVersionWrap');
    if (!wrap) return;
    if (aiState.versions.length === 0) { wrap.innerHTML = ''; return; }

    const currentV = aiState.versions[aiState.currentVersion];
    const currentLevelId = currentV?.levelId || 'crisp';

    function getLevelLabel(lid) {
        const levelDef = NOTES_LEVELS.find(l => l.id === lid);
        return levelDef ? levelDef.label : 'Notes';
    }

    // Unique levels in order of first appearance
    const seenLevels = [];
    aiState.versions.forEach(v => {
        const lid = v.levelId || 'unknown';
        if (!seenLevels.includes(lid)) seenLevels.push(lid);
    });

    // Versions filtered to current level, with per-level numbering
    const levelVersions = [];
    let count = 0;
    aiState.versions.forEach((v, i) => {
        if ((v.levelId || 'unknown') === currentLevelId) {
            count++;
            levelVersions.push({ globalIdx: i, vNum: count });
        }
    });

    const currentVEntry = levelVersions.find(lv => lv.globalIdx === aiState.currentVersion);
    const currentVNum = currentVEntry ? currentVEntry.vNum : 1;

    wrap.innerHTML = `
        <div class="ai-version-dropdown" id="aiLevelDropdown" onclick="toggleLevelDropdown()">
            <span>${getLevelLabel(currentLevelId)}</span>
            <span style="font-size:9px;">▼</span>
            <div class="ai-version-menu" id="aiLevelMenu">
                ${seenLevels.map(lid => `
                    <div class="ai-version-option ${lid === currentLevelId ? 'selected' : ''}"
                         onclick="selectLevel(event, '${lid}')">${getLevelLabel(lid)}</div>
                `).join('')}
            </div>
        </div>
        <div class="ai-version-dropdown" id="aiVersionDropdown" onclick="toggleVersionDropdown()">
            <span>V${currentVNum}</span>
            <span style="font-size:9px;">▼</span>
            <div class="ai-version-menu" id="aiVersionMenu" style="min-width:70px;">
                ${levelVersions.map(lv => `
                    <div class="ai-version-option ${lv.globalIdx === aiState.currentVersion ? 'selected' : ''}"
                         onclick="selectVersion(event, ${lv.globalIdx})">V${lv.vNum}</div>
                `).join('')}
            </div>
        </div>`;
}

function toggleLevelDropdown() {
    document.getElementById('aiLevelDropdown')?.classList.toggle('active');
    document.getElementById('aiVersionDropdown')?.classList.remove('active');
}

function toggleVersionDropdown() {
    document.getElementById('aiVersionDropdown')?.classList.toggle('active');
    document.getElementById('aiLevelDropdown')?.classList.remove('active');
}

function selectLevel(event, levelId) {
    event.stopPropagation();
    // Switch to the most recent version of this level
    let lastIdx = -1;
    for (let i = 0; i < aiState.versions.length; i++) {
        if ((aiState.versions[i].levelId || 'unknown') === levelId) lastIdx = i;
    }
    if (lastIdx >= 0) {
        aiState.currentVersion = lastIdx;
        aiState.generatedCells = aiState.versions[lastIdx].cells;
        renderPreviewCells(aiState.versions[lastIdx].cells);
        renderVersionDropdown();
    }
    document.getElementById('aiLevelDropdown')?.classList.remove('active');
}

function selectVersion(event, index) {
    event.stopPropagation();
    aiState.currentVersion = index;
    aiState.generatedCells = aiState.versions[index].cells;
    renderPreviewCells(aiState.versions[index].cells);
    renderVersionDropdown();
    document.getElementById('aiVersionDropdown')?.classList.remove('active');
}

// ===== EVENT LISTENERS =====
document.addEventListener('DOMContentLoaded', () => {

    // Textarea auto resize + enter to send
    const textarea = document.getElementById('aiTextarea');
    if (textarea) {
        textarea.addEventListener('input', () => resizeTextarea(textarea));
        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                aiSendMessage();
            }
        });
    }

    // Close on overlay click
    const overlay = document.getElementById('aiOverlay');
    if (overlay) {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeAiModal();
        });
    }

    // ASK ME button
    const askMeBtn = document.getElementById('c3AskMeBtn');
    if (askMeBtn) {
        askMeBtn.addEventListener('click', () => openAiModal('ask-me'));
    }

});