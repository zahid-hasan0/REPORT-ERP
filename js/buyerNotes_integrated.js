import { db_notes as db, getModulePath } from './storage.js';
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, orderBy, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { showToast } from './toast.js';

let items = [];
let editingItemId = null;
let allBuyers = new Set();
let deleteIdTarget = null;
const MODULE_ID = 'buyer-notes-module';

function getUI() {
    const container = document.getElementById(MODULE_ID);
    if (!container) return {};
    return {
        searchInput: container.querySelector('#searchInput'),
        buyerFilter: container.querySelector('#buyerFilter'),
        totalItems: container.querySelector('#totalItems'),
        totalBuyers: container.querySelector('#totalBuyers'),
        itemsTableBody: container.querySelector('#itemsTableBody'),
        entryPage: container.querySelector('#entryPage'),
        formTitle: container.querySelector('#formTitle'),
        saveButtonText: container.querySelector('#saveButtonText'),
        buyerName: container.querySelector('#buyerName'),
        description: container.querySelector('#description'),
        tpcLogic: container.querySelector('#tpcLogic'),
        logicCode: container.querySelector('#logicCode'),
        logicDescription: container.querySelector('#logicDescription'),
        comments: container.querySelector('#comments'),
        addNewBtn: container.querySelector('#addNewBtn'),
        saveBtn: container.querySelector('#saveBtn'),
        cancelBtn: container.querySelector('#cancelBtn'),
        closeFormBtn: container.querySelector('#closeFormBtn'),
        downloadBtn: container.querySelector('#downloadBtn'),
        printBtn: container.querySelector('#printBtn')
    };
}

export async function initBuyerNotes() {
    console.log("📝 Initializing Buyer Notes Module...");
    setupEventListeners();
    loadFromFirestore();
}

function setupEventListeners() {
    const ui = getUI();
    if (ui.searchInput) ui.searchInput.oninput = filterItems;
    if (ui.buyerFilter) ui.buyerFilter.onchange = filterItems;
    if (ui.addNewBtn) ui.addNewBtn.onclick = () => showEntryPage();
    if (ui.saveBtn) ui.saveBtn.onclick = saveItem;
    if (ui.cancelBtn) ui.cancelBtn.onclick = closeEntryPage;
    if (ui.closeFormBtn) ui.closeFormBtn.onclick = closeEntryPage;

    // Global functions for inline buttons
    window.editItemNote = editItemNote;
    window.confirmDeleteNote = confirmDeleteNote;
    window.executeDeleteNote = executeDeleteNote;
}

function loadFromFirestore() {
    const path = getModulePath('buyer_notes');
    console.log(`📡 Fetching Buyer Notes from [${path}] on Notes Database...`);
    const q = query(collection(db, path), orderBy('timestamp', 'desc'));

    onSnapshot(q, (snapshot) => {
        items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log(`✅ Received ${items.length} notes.`);
        updateBuyersList();

        // Filter out pending deletions for non-admin users in main list
        const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
        const displayItems = currentUser.role === 'admin'
            ? items
            : items.filter(i => i.status !== 'pending_deletion');

        renderItems(displayItems);
    }, (error) => {
        console.error('Firestore Error:', error);
        showToast('Failed to load notes', 'error');
    });
}

function updateBuyersList() {
    allBuyers.clear();
    items.forEach(item => { if (item.buyerName) allBuyers.add(item.buyerName); });

    const ui = getUI();
    if (!ui.buyerFilter) return;
    const val = ui.buyerFilter.value;
    ui.buyerFilter.innerHTML = '<option value="">All Buyers</option>';
    Array.from(allBuyers).sort().forEach(buyer => {
        ui.buyerFilter.innerHTML += `<option value="${buyer}">${buyer}</option>`;
    });
    ui.buyerFilter.value = val;
    if (ui.totalBuyers) ui.totalBuyers.textContent = allBuyers.size;
}

function renderItems(itemsToRender) {
    const ui = getUI();
    if (!ui.itemsTableBody) return;
    if (ui.totalItems) ui.totalItems.textContent = itemsToRender.length;

    if (itemsToRender.length === 0) {
        ui.itemsTableBody.innerHTML = '<tr><td colspan="8" class="text-center py-5 text-muted">No items found.</td></tr>';
        return;
    }

    ui.itemsTableBody.innerHTML = itemsToRender.map((item, i) => {
        const isPending = item.status === 'pending_deletion';
        const rowClass = isPending ? 'table-warning opacity-75' : '';
        const statusBadge = isPending ? '<span class="badge bg-warning text-dark ms-2"><i class="fas fa-clock me-1"></i>Delete Request</span>' : '';

        return `
        <tr class="${rowClass}">
            <td>${i + 1}</td>
            <td><strong>${item.buyerName || 'N/A'}</strong> ${statusBadge}</td>
            <td>${item.description || '-'}</td>
            <td>${item.tpcLogic || '-'}</td>
            <td><span class="badge bg-light text-dark border">${item.logicCode || '-'}</span></td>
            <td>${item.logicDescription || '-'}</td>
            <td>${item.comments || '-'}</td>
            <td>
                <div class="d-flex flex-column" style="line-height: 1.2;">
                    <span class="text-muted" style="font-size: 0.75rem;">${item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}</span>
                    <span class="fw-bold text-dark" style="font-size: 0.8rem;">${item.creatorName || (item.createdBy === 'admin' ? 'Admin' : 'Admin')}</span>
                </div>
            </td>
            <td class="text-center">
                <div class="d-flex gap-1 justify-content-center">
                    <button class="btn btn-sm btn-outline-primary" onclick="editItemNote('${item.id}')" ${isPending ? 'disabled' : ''}><i class="fas fa-edit"></i></button>
                    <button class="btn btn-sm btn-outline-danger" onclick="confirmDeleteNote('${item.id}')" ${isPending ? 'disabled' : ''}><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>
    `}).join('');
}

function filterItems() {
    const ui = getUI();
    const search = ui.searchInput.value.toLowerCase();
    const buyer = ui.buyerFilter.value;

    let filtered = items;
    if (buyer) filtered = filtered.filter(i => i.buyerName === buyer);
    if (search.trim()) {
        filtered = filtered.filter(i =>
            Object.values(i).some(v => String(v).toLowerCase().includes(search))
        );
    }
    renderItems(filtered);
}

function showEntryPage(itemId) {
    const ui = getUI();
    ui.entryPage.classList.add('active'); // Use class for flex centering

    if (itemId) {
        const item = items.find(i => i.id === itemId);
        if (item) {
            editingItemId = itemId;
            ui.formTitle.textContent = 'Edit Item';
            ui.saveButtonText.textContent = 'Update Item';
            ui.buyerName.value = item.buyerName || '';
            ui.description.value = item.description || '';
            ui.tpcLogic.value = item.tpcLogic || '';
            ui.logicCode.value = item.logicCode || '';
            ui.logicDescription.value = item.logicDescription || '';
            ui.comments.value = item.comments || '';
        }
    } else {
        resetForm();
    }
}

function closeEntryPage() {
    getUI().entryPage.classList.remove('active');
    resetForm();
}

function resetForm() {
    editingItemId = null;
    const ui = getUI();
    if (!ui.buyerName) return;
    ui.formTitle.textContent = 'Add New Item';
    ui.saveButtonText.textContent = 'Save Item';
    ui.buyerName.value = '';
    ui.description.value = '';
    ui.tpcLogic.value = '';
    ui.logicCode.value = '';
    ui.logicDescription.value = '';
    ui.comments.value = '';
}

async function saveItem() {
    const ui = getUI();
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const buyerName = ui.buyerName.value.trim();
    if (!buyerName) return showToast('Buyer Name is required!', 'error');

    const itemData = {
        buyerName,
        description: ui.description.value.trim(),
        tpcLogic: ui.tpcLogic.value.trim(),
        logicCode: ui.logicCode.value.trim(),
        logicDescription: ui.logicDescription.value.trim(),
        comments: ui.comments.value.trim(),
        status: editingItemId ? (items.find(i => i.id === editingItemId)?.status || 'active') : 'active',
        createdAt: new Date().toISOString(), // Standardized for Notifications.
        timestamp: serverTimestamp(), // Keep for sorting
        // User Tracking
        createdBy: currentUser.username || 'unknown',
        creatorName: currentUser.role === 'admin' ? 'Zahid' : (currentUser.fullName || 'Admin')
    };

    try {
        const path = getModulePath('buyer_notes');
        if (editingItemId) {
            await updateDoc(doc(db, path, editingItemId), itemData);
            showToast('Item updated successfully');
        } else {
            await addDoc(collection(db, path), itemData);
            showToast('Item added successfully');
        }
        closeEntryPage();
    } catch (error) {
        console.error(error);
        showToast('Save failed', 'error');
    }
}

export function editItemNote(id) { showEntryPage(id); }

export function confirmDeleteNote(id) {
    deleteIdTarget = id;
    const modal = new bootstrap.Modal(document.getElementById('deleteNoteModal'));
    modal.show();
}

export async function executeDeleteNote() {
    if (!deleteIdTarget) return;
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const path = getModulePath('buyer_notes');

    try {
        if (currentUser.role === 'admin') {
            // Admin deletes permanently
            await deleteDoc(doc(db, path, deleteIdTarget));
            showToast('Item deleted successfully permanently');
        } else {
            // Regular user requests deletion
            await updateDoc(doc(db, path, deleteIdTarget), {
                status: 'pending_deletion',
                deletionRequestedBy: currentUser.username,
                deletionRequestedAt: new Date().toISOString()
            });
            showToast('Deletion request sent for admin approval');
        }

        const modal = bootstrap.Modal.getInstance(document.getElementById('deleteNoteModal'));
        if (modal) modal.hide();
    } catch (error) {
        console.error("Delete operation failed:", error);
        showToast('Operation failed: ' + error.message, 'error');
    }
}
