// column4.js - Notes Panel

// ===== STATE =====
const c4State = {
    allSectionNotes: {}, // keyed by section id
    notes: [],
    categories: ['General', 'Doubts', 'Insights', 'Memorise', 'Keywords', 'Summary', 'Examples', 'Tips'],
    selectedCategory: 'All',
    sortAsc: false, // false = newest first
    nextId: 1
};

// ===== INIT =====
// ===== LOCALSTORAGE =====
function saveC4State() {
    const id = getFileId();
    RAM_SYNC.setItem(`c4_allSectionNotes_${id}`, JSON.stringify(c4State.allSectionNotes));
    RAM_SYNC.setItem(`c4_categories_${id}`, JSON.stringify(c4State.categories));
    window.parent.postMessage({ type: 'ramDataSaved' }, '*');
}

function loadC4State() {
    const id = getFileId();
    const notes = localStorage.getItem(`c4_allSectionNotes_${id}`);
    const categories = localStorage.getItem(`c4_categories_${id}`);
    if (notes) c4State.allSectionNotes = JSON.parse(notes);
    if (categories) {
        const saved = JSON.parse(categories);
        const merged = [...c4State.categories];
        saved.forEach(c => { if (!merged.includes(c)) merged.push(c); });
        c4State.categories = merged;
    }
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
    loadC4State();
    loadC4ForSection('navigation');
    renderCategoryFilter();
    renderModalCategories();
});

// ===== TIMESTAMP HELPERS =====
function formatTimestamp(note) {
    const now = new Date();
    const ref = note.updatedAt ? new Date(note.updatedAt) : new Date(note.createdAt);
    const isUpdated = !!note.updatedAt;
    const label = isUpdated ? 'Updated' : 'Added';

    const diffMs = now - ref;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return `${label}: today`;
    if (diffDays < 30) return `${label}: ${diffDays} day${diffDays === 1 ? '' : 's'} ago`;

    // Calendar mode for older
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const d = ref.getDate().toString().padStart(2, '0');
    const m = months[ref.getMonth()];
    const y = ref.getFullYear();
    return `${label} on: ${d} - ${m} - ${y}`;
}

// ===== SORT NOTES =====
function getSortedNotes() {
    const filtered = c4State.selectedCategory === 'All'
        ? [...c4State.notes]
        : c4State.notes.filter(n => n.category === c4State.selectedCategory);

    const starred    = filtered.filter(n => n.starred);
    const unchecked  = filtered.filter(n => !n.starred && !n.checked);
    const checked    = filtered.filter(n => !n.starred && n.checked);

    const sortFn = (a, b) => {
        const aTime = new Date(a.updatedAt || a.createdAt);
        const bTime = new Date(b.updatedAt || b.createdAt);
        return c4State.sortAsc ? aTime - bTime : bTime - aTime;
    };

    return [
        ...starred.sort(sortFn),
        ...unchecked.sort(sortFn),
        ...checked.sort(sortFn)
    ];
}

function loadC4ForSection(id) {
    if (!c4State.allSectionNotes[id]) c4State.allSectionNotes[id] = [];
    c4State.notes = c4State.allSectionNotes[id];
    c4State.selectedCategory = 'All';
    const label = document.getElementById('c4CategoryLabel');
    if (label) label.textContent = 'All';
    renderCategoryFilter();
    renderNotes();
}

// ===== RENDER NOTES =====
function renderNotes() {
    const container = document.getElementById('c4NotesList');
    if (!container) return;
    container.innerHTML = '';

    const sorted = getSortedNotes();

    if (sorted.length === 0) {
        container.innerHTML = `<div style="text-align:center; color:#94a3b8; font-size:13px; padding:24px 0;">No notes yet</div>`;
        return;
    }

    sorted.forEach(note => {
        const card = document.createElement('div');
        card.className = `c4-note-card${note.starred ? ' starred' : ''}`;
        card.dataset.id = note.id;

        card.innerHTML = `
            <div class="c4-note-category-row">
                <span class="c4-note-category-label">${note.category}</span>
                <div class="c4-note-actions">
                    <span class="c4-action-icon edit" title="Edit" onclick="openEditNote(${note.id})">✎</span>
                    <span class="c4-action-icon delete" title="Delete" onclick="deleteNote(${note.id})">🗑</span>
                    <span class="c4-action-icon star${note.starred ? ' active' : ''}" title="Star" onclick="toggleStar(${note.id})">★</span>
                    <input type="checkbox" class="c4-note-checkbox" ${note.checked ? 'checked' : ''} onchange="toggleCheck(${note.id})">
                </div>
            </div>
            <div class="c4-note-title${note.checked ? ' checked' : ''}">${escapeHtml(note.title)}</div>
            <div class="c4-note-content${note.checked ? ' checked' : ''}">${escapeHtml(note.content)}</div>
            <div class="c4-note-timestamp">${formatTimestamp(note)}</div>
        `;

        container.appendChild(card);
    });
}

// ===== TOGGLE STAR =====
function toggleStar(id) {
    const note = c4State.notes.find(n => n.id === id);
    if (!note) return;
    note.starred = !note.starred;
    saveC4State();
    renderNotes();
}

// ===== TOGGLE CHECK =====
function toggleCheck(id) {
    const note = c4State.notes.find(n => n.id === id);
    if (!note) return;
    note.checked = !note.checked;
    note.updatedAt = new Date().toISOString();
    saveC4State();
    renderNotes();
}

// ===== DELETE NOTE =====
function deleteNote(id) {
    if (!confirm('Delete this note?')) return;
    const idx = c4State.notes.findIndex(n => n.id === id);
    if (idx !== -1) c4State.notes.splice(idx, 1);
    saveC4State();
    renderNotes();
}

// ===== SORT TOGGLE =====
function toggleC4Sort() {
    c4State.sortAsc = !c4State.sortAsc;
    document.getElementById('c4SortBtn').textContent = c4State.sortAsc ? '↑' : '↓';
    renderNotes();
}

// ===== CATEGORY FILTER =====
function renderCategoryFilter() {
    const menu = document.getElementById('c4CategoryMenu');
    if (!menu) return;
    const all = ['All', ...c4State.categories];
    menu.innerHTML = all.map(cat => `
        <div class="c4-dropdown-option${cat === c4State.selectedCategory ? ' selected' : ''}"
             onclick="selectC4Category('${cat}')">${cat}</div>
    `).join('');
}

function toggleC4CategoryDropdown() {
    document.getElementById('c4CategoryFilter').classList.toggle('active');
}

function selectC4Category(cat) {
    c4State.selectedCategory = cat;
    document.getElementById('c4CategoryLabel').textContent = cat;
    document.getElementById('c4CategoryFilter').classList.remove('active');
    renderCategoryFilter();
    renderNotes();
}

document.addEventListener('click', (e) => {
    const filter = document.getElementById('c4CategoryFilter');
    if (filter && !filter.contains(e.target)) filter.classList.remove('active');
});

// ===== OPEN ADD NOTE MODAL =====
function openAddNoteModal() {
    c4State._editingId = null;
    document.getElementById('c4ModalTitle').textContent = 'Add New Note';
    document.getElementById('c4NoteTitle').value = '';
    document.getElementById('c4NoteContent').value = '';
    document.getElementById('c4TitleCounter').textContent = '0/80';
    document.getElementById('c4ContentCounter').textContent = '0/280';
    renderModalCategories();
    document.getElementById('c4ModalOverlay').classList.add('active');
    setTimeout(() => document.getElementById('c4NoteTitle').focus(), 100);
}

// ===== OPEN EDIT NOTE =====
function openEditNote(id) {
    const note = c4State.notes.find(n => n.id === id);
    if (!note) return;
    c4State._editingId = id;
    document.getElementById('c4ModalTitle').textContent = 'Edit Note';
    document.getElementById('c4NoteTitle').value = note.title;
    document.getElementById('c4NoteContent').value = note.content;
    document.getElementById('c4TitleCounter').textContent = `${note.title.length}/80`;
    document.getElementById('c4ContentCounter').textContent = `${note.content.length}/280`;
    renderModalCategories(note.category);
    document.getElementById('c4ModalOverlay').classList.add('active');
    setTimeout(() => document.getElementById('c4NoteTitle').focus(), 100);
}

// ===== CLOSE MODAL =====
function closeC4Modal() {
    document.getElementById('c4ModalOverlay').classList.remove('active');
    c4State._editingId = null;
}

// ===== SAVE NOTE =====
function saveC4Note() {
    const title = document.getElementById('c4NoteTitle').value.trim();
    const content = document.getElementById('c4NoteContent').value.trim();
    const category = c4State._modalCategory || c4State.categories[0];

    if (!title) { alert('Please enter a title.'); return; }
    if (!content) { alert('Please enter content.'); return; }

    if (c4State._editingId !== null && c4State._editingId !== undefined) {
        const note = c4State.notes.find(n => n.id === c4State._editingId);
        if (note) {
            note.title = title;
            note.content = content;
            note.category = category;
            note.updatedAt = new Date().toISOString();
        }
    } else {
        c4State.notes.unshift({
            id: c4State.nextId++,
            title,
            content,
            category,
            starred: false,
            checked: false,
            createdAt: new Date().toISOString(),
            updatedAt: null
        });
    }

    saveC4State();
    closeC4Modal();
    renderNotes();
    renderCategoryFilter();
}

// ===== MODAL CATEGORY DROPDOWN =====
function renderModalCategories(selected) {
    const sel = selected || c4State.categories[0];
    c4State._modalCategory = sel;

    document.getElementById('c4ModalCategoryLabel').textContent = sel;

    const menu = document.getElementById('c4ModalCategoryMenu');
    menu.innerHTML = c4State.categories.map(cat => {
        const isGeneral = cat === 'General';
        const actions = isGeneral ? '' : `
            <span class="c4-cat-edit-btn" onclick="openRenameCategoryInput(event,'${cat}')" title="Rename">✎</span>
            <span class="c4-cat-delete-btn" onclick="deleteCategory(event,'${cat}')" title="Delete">🗑</span>
        `;
        return `
            <div class="c4-modal-dropdown-option${cat === sel ? ' selected' : ''}" data-cat="${cat}">
                <span class="c4-cat-label" onclick="selectModalCategory('${cat}')">${cat}</span>
                <span class="c4-cat-actions">${actions}</span>
            </div>
        `;
    }).join('');
}

function openRenameCategoryInput(e, cat) {
    e.stopPropagation();
    const menu = document.getElementById('c4ModalCategoryMenu');
    const option = menu.querySelector(`[data-cat="${cat}"]`);
    if (!option) return;
    option.innerHTML = `
        <input class="c4-cat-rename-input" id="c4CatRenameInput" value="${cat}" maxlength="40">
        <span class="c4-cat-rename-confirm" onclick="confirmRenameCategory(event,'${cat}')">✔</span>
        <span class="c4-cat-rename-cancel" onclick="cancelRenameCategory(event,'${cat}')">✕</span>
    `;
    const input = document.getElementById('c4CatRenameInput');
    input.focus();
    input.select();
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter') confirmRenameCategory(e, cat);
        if (e.key === 'Escape') cancelRenameCategory(e, cat);
    });
}

function confirmRenameCategory(e, oldCat) {
    e.stopPropagation();
    const input = document.getElementById('c4CatRenameInput');
    const newCat = input.value.trim();
    if (!newCat) return;
    if (newCat === oldCat) { cancelRenameCategory(e, oldCat); return; }
    const exists = c4State.categories.some(c => c.toLowerCase() === newCat.toLowerCase() && c !== oldCat);
    if (exists) { alert('Category already exists.'); return; }

    const idx = c4State.categories.indexOf(oldCat);
    if (idx !== -1) c4State.categories[idx] = newCat;

    // Update all notes with old category name
    Object.values(c4State.allSectionNotes).forEach(notes => {
        notes.forEach(n => { if (n.category === oldCat) n.category = newCat; });
    });

    if (c4State._modalCategory === oldCat) c4State._modalCategory = newCat;
    saveC4State();
    renderModalCategories(c4State._modalCategory);
    renderCategoryFilter();
    renderNotes();
}

function cancelRenameCategory(e, cat) {
    e.stopPropagation();
    renderModalCategories(c4State._modalCategory);
}

function deleteCategory(e, cat) {
    e.stopPropagation();
    const idx = c4State.categories.indexOf(cat);
    if (idx !== -1) c4State.categories.splice(idx, 1);

    // Move all notes with deleted category to General
    Object.values(c4State.allSectionNotes).forEach(notes => {
        notes.forEach(n => { if (n.category === cat) n.category = 'General'; });
    });

    if (c4State._modalCategory === cat) c4State._modalCategory = 'General';
    saveC4State();
    renderModalCategories(c4State._modalCategory);
    renderCategoryFilter();
    renderNotes();
}

function toggleModalCategoryDropdown() {
    document.getElementById('c4ModalCategoryTrigger').classList.toggle('active');
    document.getElementById('c4ModalCategoryMenu').classList.toggle('active');
}

function selectModalCategory(cat) {
    c4State._modalCategory = cat;
    document.getElementById('c4ModalCategoryLabel').textContent = cat;
    document.getElementById('c4ModalCategoryTrigger').classList.remove('active');
    document.getElementById('c4ModalCategoryMenu').classList.remove('active');
    renderModalCategories(cat);
}

// ===== ADD CATEGORY POPUP =====
function openAddCategoryPopup() {
    document.getElementById('c4NewCategoryInput').value = '';
    document.getElementById('c4PopupOverlay').classList.add('active');
    setTimeout(() => document.getElementById('c4NewCategoryInput').focus(), 100);
}

function closeAddCategoryPopup() {
    document.getElementById('c4PopupOverlay').classList.remove('active');
}

function confirmAddCategory() {
    const input = document.getElementById('c4NewCategoryInput').value.trim();
    if (!input) { alert('Please enter a category name.'); return; }

    const exists = c4State.categories.some(c => c.toLowerCase() === input.toLowerCase());
    if (exists) { alert('Category already exists.'); return; }

    c4State.categories.push(input);
    c4State._modalCategory = input;
    saveC4State();
    closeAddCategoryPopup();
    renderModalCategories(input);
    renderCategoryFilter();
}

// ===== CHAR COUNTERS =====
function updateC4TitleCounter() {
    const val = document.getElementById('c4NoteTitle').value.length;
    document.getElementById('c4TitleCounter').textContent = `${val}/80`;
}

function updateC4ContentCounter() {
    const val = document.getElementById('c4NoteContent').value.length;
    document.getElementById('c4ContentCounter').textContent = `${val}/280`;
}

// ===== KEYBOARD HANDLERS =====
document.addEventListener('DOMContentLoaded', () => {
    const titleInput = document.getElementById('c4NoteTitle');
    const contentInput = document.getElementById('c4NoteContent');
    const popupInput = document.getElementById('c4NewCategoryInput');

    if (titleInput) titleInput.addEventListener('keydown', e => { if (e.key === 'Escape') closeC4Modal(); });
    if (contentInput) {
        contentInput.addEventListener('keydown', e => {
            if (e.key === 'Escape') closeC4Modal();
            if (e.key === 'Enter' && e.ctrlKey) saveC4Note();
        });
    }
    if (popupInput) {
        popupInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') confirmAddCategory();
            if (e.key === 'Escape') closeAddCategoryPopup();
        });
    }

    // Close modal on overlay click
    const overlay = document.getElementById('c4ModalOverlay');
    if (overlay) overlay.addEventListener('click', e => { if (e.target === overlay) closeC4Modal(); });

    const popupOverlay = document.getElementById('c4PopupOverlay');
    if (popupOverlay) popupOverlay.addEventListener('click', e => { if (e.target === popupOverlay) closeAddCategoryPopup(); });

    // Close modal dropdown on outside click
    document.addEventListener('click', e => {
        const trigger = document.getElementById('c4ModalCategoryTrigger');
        if (trigger && !trigger.closest('.c4-modal-dropdown').contains(e.target)) {
            trigger.classList.remove('active');
            document.getElementById('c4ModalCategoryMenu').classList.remove('active');
        }
    });
});

// ===== UTILITY =====
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}