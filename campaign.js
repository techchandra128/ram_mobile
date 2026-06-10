// campaign.js

// ===== STATE =====
let cpCampaigns = [];         // [{id, name, items:[{id, type, fileId|playlistId, target, deadline}]}]
let cpActiveCampaignId = null;
let cpCurrentLayout = 'a';    // 'a' | 'b' | 'c'

// ===== STORAGE =====
function cpLoad() {
    const saved = localStorage.getItem('ram_campaigns');
    cpCampaigns = saved ? JSON.parse(saved) : [];
}
function cpSave() {
    localStorage.setItem('ram_campaigns', JSON.stringify(cpCampaigns));
}

// ===== SHOW PAGE =====
function showCampaign() {
    setActiveNav('navCampaign');
    document.getElementById('dashboardLayer').classList.remove('active');
    document.getElementById('graphsLayer').classList.remove('active');
    document.getElementById('mainPage').classList.remove('active');
    document.getElementById('asLayer').classList.remove('active');
    document.getElementById('diaryLayer').classList.remove('active');
    document.getElementById('playlistsLayer').classList.remove('active');
    document.getElementById('smartDeskLayer').classList.remove('active');
    document.getElementById('allFilesLayer').classList.remove('active');
    document.getElementById('settingsLayer').classList.remove('active');
    document.getElementById('campaignLayer').classList.add('active');
    cpLoad();
    cpRender();
}

// ===== LAYOUT SWITCH =====
function cpSetLayout(l) {
    cpCurrentLayout = l;
    ['a','b','c'].forEach(x => {
        document.getElementById('cpLayout'+x.toUpperCase()).style.display = 'none';
        document.getElementById('cpPill'+x.toUpperCase()).classList.toggle('active', x === l);
    });
    document.getElementById('cpLayout'+l.toUpperCase()).style.display = l === 'a' ? 'flex' : 'flex';
    cpRender();
}

// ===== HELPERS =====
function cpGetActiveCampaign() {
    return cpCampaigns.find(c => c.id === cpActiveCampaignId) || null;
}

function cpDaysLeft(deadline) {
    if (!deadline) return null;
    const now = new Date(); now.setHours(0,0,0,0);
    const d = new Date(deadline); d.setHours(0,0,0,0);
    return Math.ceil((d - now) / 86400000);
}

function cpProgressRing(pct, size) {
    size = size || 52;
    const r = (size - 8) / 2;
    const cx = size / 2, cy = size / 2;
    const circ = 2 * Math.PI * r;
    const offset = circ * (1 - pct / 100);
    return `<svg class="cp-ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--border-default)" stroke-width="3.5"/>
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--accent-blue)" stroke-width="3.5"
            stroke-dasharray="${circ.toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}"
            stroke-linecap="round" transform="rotate(-90 ${cx} ${cy})"/>
        <text x="${cx}" y="${cy+4}" text-anchor="middle" font-size="${size < 44 ? 9 : 11}" fill="var(--text-primary)" font-family="inherit">${pct}%</text>
    </svg>`;
}

function cpGetProgress(item) {
    // Read from campaign-specific progress stored per item
    // key: ram_cp_progress_<campaignId>_<itemId>
    const key = `ram_cp_progress_${cpActiveCampaignId}_${item.id}`;
    const saved = localStorage.getItem(key);
    if (!saved) return 0;
    const data = JSON.parse(saved);
    return data.pct || 0;
}

// Collect all playlists
function cpCollectAllPlaylists() {
    const saved = localStorage.getItem('ram_playlists');
    if (!saved) return [];
    const pls = JSON.parse(saved);
    return pls.map(pl => ({ playlistId: pl.id, name: pl.name, progress: pl.progress || 0 }));
}

// Collect all files (reuse sd helper)
function cpCollectAllFiles() {
    return sdCollectAllFiles(fileSystem);
}

// ===== RENDER =====
function cpRender() {
    cpRenderLayoutA();
    cpRenderLayoutB();
    cpRenderLayoutC();
}

function cpBuildFileCards(container, campaignId) {
    const campaign = cpCampaigns.find(c => c.id === campaignId);
    if (!campaign) { container.innerHTML = '<div class="cp-empty">No campaign selected.</div>'; return; }
    if (!campaign.items || campaign.items.length === 0) {
        container.innerHTML = '<div class="cp-empty">No files added. Click + Add to import files or playlists.</div>';
        return;
    }
    container.innerHTML = '';
    campaign.items.forEach(item => {
        const pct = cpGetProgress(item);
        const days = cpDaysLeft(item.deadline);
        const urgent = days !== null && days <= 5;

        const card = document.createElement('div');
        card.className = 'cp-file-card';

        const typeEl = document.createElement('div');
        typeEl.className = 'cp-file-card-type';
        typeEl.textContent = item.type === 'playlist' ? '🎵 Collection' : '📄 Book';
        card.appendChild(typeEl);

        const nameEl = document.createElement('div');
        nameEl.className = 'cp-file-card-name';
        nameEl.textContent = item.name;
        nameEl.title = item.name;
        card.appendChild(nameEl);

        const ringWrap = document.createElement('div');
        ringWrap.className = 'cp-file-card-ring';
        ringWrap.innerHTML = cpProgressRing(pct, 56);
        card.appendChild(ringWrap);

        const footer = document.createElement('div');
        footer.className = 'cp-file-card-footer';

        const daysEl = document.createElement('div');
        daysEl.className = 'cp-days-left' + (urgent ? ' urgent' : '');
        daysEl.textContent = days !== null ? (days === 0 ? 'Today!' : days < 0 ? 'Overdue' : days + 'd left') : 'No deadline';
        footer.appendChild(daysEl);

        const revEl = document.createElement('div');
        revEl.className = 'cp-rev-target';
        revEl.textContent = '×' + (item.target || 2);
        footer.appendChild(revEl);

        card.appendChild(footer);

        const delBtn = document.createElement('button');
        delBtn.className = 'cp-file-card-del';
        delBtn.textContent = '✕';
        delBtn.title = 'Remove from campaign';
        delBtn.onclick = (e) => { e.stopPropagation(); cpRemoveItem(campaignId, item.id); };
        card.appendChild(delBtn);

        card.onclick = (e) => {
            if (e.target === delBtn) return;
            cpOpenItem(item, campaignId);
        };

        container.appendChild(card);
    });
}

// ===== LAYOUT A =====
function cpRenderLayoutA() {
    const sidebar = document.getElementById('cpSidebarList');
    const area = document.getElementById('cpFilesAreaA');
    if (!sidebar || !area) return;

    sidebar.innerHTML = '';
    if (cpCampaigns.length === 0) {
        sidebar.innerHTML = '<div class="cp-empty" style="padding:12px;font-size:12px;">No campaigns yet.</div>';
    } else {
        cpCampaigns.forEach(c => {
            const item = document.createElement('div');
            item.className = 'cp-sidebar-item' + (c.id === cpActiveCampaignId ? ' active' : '');
            item.innerHTML = `<span class="cp-sidebar-icon">🎯</span><span class="cp-sidebar-name">${c.name}</span>`;
            item.onclick = () => { cpActiveCampaignId = c.id; cpRender(); };
            sidebar.appendChild(item);
        });
    }

    if (!cpActiveCampaignId && cpCampaigns.length > 0) cpActiveCampaignId = cpCampaigns[0].id;
    cpBuildFileCards(area, cpActiveCampaignId);
    cpUpdateAddBtnLabel('A');
}

// ===== LAYOUT B =====
function cpRenderLayoutB() {
    const tabsBar = document.getElementById('cpTabsBar');
    const content = document.getElementById('cpTabContent');
    if (!tabsBar || !content) return;

    // keep + button, rebuild tabs
    tabsBar.innerHTML = '';
    cpCampaigns.forEach(c => {
        const tab = document.createElement('button');
        tab.className = 'cp-tab' + (c.id === cpActiveCampaignId ? ' active' : '');
        tab.textContent = c.name;
        tab.onclick = () => { cpActiveCampaignId = c.id; cpRender(); };
        tabsBar.appendChild(tab);
    });
    const newBtn = document.createElement('button');
    newBtn.className = 'cp-tab-new';
    newBtn.textContent = '+';
    newBtn.title = 'New Campaign';
    newBtn.onclick = () => cpShowNewCampaignModal();
    tabsBar.appendChild(newBtn);

    if (!cpActiveCampaignId && cpCampaigns.length > 0) cpActiveCampaignId = cpCampaigns[0].id;
    cpBuildFileCards(content, cpActiveCampaignId);
    cpUpdateAddBtnLabel('B');
}

// ===== LAYOUT C =====
function cpRenderLayoutC() {
    const grid = document.getElementById('cpCampaignGrid');
    if (!grid) return;
    grid.innerHTML = '';

    if (cpCampaigns.length === 0) {
        grid.innerHTML = '<div class="cp-empty">No campaigns yet. Click + New Campaign to start.</div>';
        return;
    }

    cpCampaigns.forEach(c => {
        const card = document.createElement('div');
        card.className = 'cp-campaign-card';

        card.innerHTML = `
            <div class="cp-campaign-card-icon">🎯</div>
            <div class="cp-campaign-card-name">${c.name}</div>
            <div class="cp-campaign-card-meta">${(c.items||[]).length} item${(c.items||[]).length !== 1 ? 's' : ''}</div>
        `;

        const del = document.createElement('button');
        del.className = 'cp-campaign-card-del';
        del.textContent = '✕';
        del.title = 'Delete campaign';
        del.onclick = (e) => { e.stopPropagation(); cpDeleteCampaign(c.id); };
        card.appendChild(del);

        card.onclick = (e) => {
            if (e.target === del) return;
            cpActiveCampaignId = c.id;
            cpOpenDrillDown(c);
        };
        grid.appendChild(card);
    });
}

function cpOpenDrillDown(campaign) {
    document.getElementById('cpCampaignGrid').style.display = 'none';
    const drillSection = document.getElementById('cpDrillFiles');
    drillSection.style.display = 'flex';
    document.getElementById('cpDrillTitle').textContent = campaign.name;
    const filesArea = document.getElementById('cpDrillFilesArea');
    cpBuildFileCards(filesArea, campaign.id);
    cpUpdateAddBtnLabel('C');
}

function cpCloseDrillDown() {
    document.getElementById('cpCampaignGrid').style.display = 'flex';
    document.getElementById('cpDrillFiles').style.display = 'none';
    cpActiveCampaignId = null;
}

function cpUpdateAddBtnLabel(layout) {
    // Show/hide the add-to-campaign button based on context
    const btn = document.getElementById('cpAddItemBtn');
    if (!btn) return;
    btn.style.display = cpActiveCampaignId ? '' : 'none';
}

// ===== OPEN ITEM =====
function cpOpenItem(item, campaignId) {
    const fileLayer = document.getElementById('fileLayer');
    const frame = document.getElementById('fileFrame');
    if (item.type === 'file') {
        const enc = encodeURIComponent(item.name);
        frame.src = `fileview.html?fileId=${item.fileId}&fileName=${enc}&campaignId=${campaignId}&campaignItemId=${item.id}`;
    } else {
        // playlist — open same way as normal playlist open
        const enc = encodeURIComponent(item.name);
        frame.src = `fileview.html?playlistId=${item.playlistId}&fileName=${enc}&campaignId=${campaignId}&campaignItemId=${item.id}`;
    }
    fileLayer.classList.add('active');
}

// ===== NEW CAMPAIGN MODAL =====
function cpShowNewCampaignModal() {
    document.getElementById('cpNewCampaignInput').value = '';
    document.getElementById('cpNewCampaignModal').classList.add('active');
    setTimeout(() => document.getElementById('cpNewCampaignInput').focus(), 100);
}
function cpCloseNewCampaignModal() {
    document.getElementById('cpNewCampaignModal').classList.remove('active');
}
function cpConfirmNewCampaign() {
    const name = document.getElementById('cpNewCampaignInput').value.trim();
    if (!name) return;
    const id = 'cp_' + Date.now();
    cpCampaigns.push({ id, name, items: [] });
    cpActiveCampaignId = id;
    cpSave();
    cpCloseNewCampaignModal();
    cpRender();
}

// ===== ADD ITEMS MODAL =====
let cpImportTarget = null;    // deadline input value
let cpImportRevTarget = 2;    // spinner value

function cpShowAddItemModal() {
    if (!cpActiveCampaignId) return;
    cpImportRevTarget = 2;
    document.getElementById('cpImportSpinVal').textContent = cpImportRevTarget;
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('cpImportDeadline').value = '';
    document.getElementById('cpImportStartDate').value = today;

    const body = document.getElementById('cpAddItemBody');
    body.innerHTML = '';

    // Files section
    const filesLabel = document.createElement('div');
    filesLabel.className = 'cp-modal-section-label';
    filesLabel.textContent = 'Files';
    body.appendChild(filesLabel);

    const allFiles = cpCollectAllFiles();
    const campaign = cpGetActiveCampaign();
    const existingIds = (campaign.items || []).map(i => i.fileId || i.playlistId);

    if (allFiles.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'cp-empty';
        empty.style.padding = '8px 0';
        empty.textContent = 'No files in library.';
        body.appendChild(empty);
    } else {
        allFiles.forEach(f => {
            const row = document.createElement('label');
            row.className = 'cp-modal-file-row';
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.dataset.type = 'file';
            cb.dataset.fileId = f.fileId;
            cb.dataset.name = f.name;
            cb.dataset.progress = f.progress || 0;
            const alreadyIn = existingIds.includes(f.fileId);
            if (alreadyIn) { cb.checked = true; cb.disabled = true; }
            const nameEl = document.createElement('span');
            nameEl.className = 'cp-modal-file-name';
            nameEl.textContent = f.name;
            if (alreadyIn) nameEl.style.color = 'var(--text-muted)';
            const tag = document.createElement('span');
            tag.className = 'cp-modal-file-tag';
            tag.textContent = 'file';
            row.appendChild(cb); row.appendChild(nameEl); row.appendChild(tag);
            body.appendChild(row);
        });
    }

    // Playlists section
    const plLabel = document.createElement('div');
    plLabel.className = 'cp-modal-section-label';
    plLabel.style.marginTop = '8px';
    plLabel.textContent = 'Sets';
    body.appendChild(plLabel);

    const allPlaylists = cpCollectAllPlaylists();
    if (allPlaylists.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'cp-empty';
        empty.style.padding = '8px 0';
        empty.textContent = 'No playlists yet.';
        body.appendChild(empty);
    } else {
        allPlaylists.forEach(pl => {
            const row = document.createElement('label');
            row.className = 'cp-modal-file-row';
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.dataset.type = 'playlist';
            cb.dataset.playlistId = pl.playlistId;
            cb.dataset.name = pl.name;
            cb.dataset.progress = pl.progress || 0;
            const alreadyIn = existingIds.includes(pl.playlistId);
            if (alreadyIn) { cb.checked = true; cb.disabled = true; }
            const nameEl = document.createElement('span');
            nameEl.className = 'cp-modal-file-name';
            nameEl.textContent = pl.name;
            if (alreadyIn) nameEl.style.color = 'var(--text-muted)';
            const tag = document.createElement('span');
            tag.className = 'cp-modal-file-tag';
            tag.textContent = 'playlist';
            row.appendChild(cb); row.appendChild(nameEl); row.appendChild(tag);
            body.appendChild(row);
        });
    }

    document.getElementById('cpAddItemModal').classList.add('active');
}

function cpCloseAddItemModal() {
    document.getElementById('cpAddItemModal').classList.remove('active');
}

function cpSpinnerChange(delta) {
    cpImportRevTarget = Math.max(1, Math.min(10, cpImportRevTarget + delta));
    document.getElementById('cpImportSpinVal').textContent = cpImportRevTarget;
}

function cpConfirmAddItems() {
    const deadline = document.getElementById('cpImportDeadline').value;
    const checkboxes = document.querySelectorAll('#cpAddItemBody input[type="checkbox"]:checked:not(:disabled)');
    const campaign = cpGetActiveCampaign();
    if (!campaign) return;

    checkboxes.forEach(cb => {
        const itemId = 'cpi_' + Date.now() + '_' + Math.random().toString(36).slice(2,6);
        const newItem = {
            id: itemId,
            type: cb.dataset.type,
            name: cb.dataset.name,
            target: cpImportRevTarget,
            deadline: deadline || null
        };
        if (cb.dataset.type === 'file') newItem.fileId = cb.dataset.fileId;
        else newItem.playlistId = cb.dataset.playlistId;
        campaign.items.push(newItem);
    });

    cpSave();
    cpCloseAddItemModal();
    cpRender();

    // If in drill-down, refresh it
    if (cpCurrentLayout === 'c' && document.getElementById('cpDrillFiles').style.display !== 'none') {
        cpOpenDrillDown(campaign);
    }
}

// ===== DELETE CAMPAIGN =====
function cpDeleteCampaign(id) {
    if (!confirm('Delete this campaign? Campaign data will be removed but original files are unaffected.')) return;
    cpCampaigns = cpCampaigns.filter(c => c.id !== id);
    if (cpActiveCampaignId === id) cpActiveCampaignId = cpCampaigns.length > 0 ? cpCampaigns[0].id : null;
    cpSave();
    cpRender();
}

// ===== REMOVE ITEM FROM CAMPAIGN =====
function cpRemoveItem(campaignId, itemId) {
    const campaign = cpCampaigns.find(c => c.id === campaignId);
    if (!campaign) return;
    campaign.items = campaign.items.filter(i => i.id !== itemId);
    cpSave();
    cpRender();
    if (cpCurrentLayout === 'c' && document.getElementById('cpDrillFiles').style.display !== 'none') {
        cpOpenDrillDown(campaign);
    }
}

// ===== KEYBOARD HANDLERS =====
document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
        if (document.getElementById('cpNewCampaignModal').classList.contains('active')) {
            cpConfirmNewCampaign();
        }
    }
    if (e.key === 'Escape') {
        if (document.getElementById('cpNewCampaignModal').classList.contains('active')) cpCloseNewCampaignModal();
        if (document.getElementById('cpAddItemModal').classList.contains('active')) cpCloseAddItemModal();
    }
});
