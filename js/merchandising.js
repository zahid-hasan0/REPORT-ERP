import { db_notes as db, getModulePath } from './storage.js';
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, orderBy, onSnapshot, serverTimestamp, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { showToast } from './toast.js';

/* Merchandising System Logic - Firestore Integrated & Optimized */

let buyers = [];
let loadedEntries = []; // Cache for filtering
let currentBuyer = '';
let unsubscribeBuyers = null;
let unsubscribeEntries = null;

/**
 * --- Global Shared Initialization ---
 * Call this early (e.g., in navigation.js) to pre-load buyers.
 */
export function initMerchandisingGlobal() {
    if (!db) return;
    console.log("🚀 Pre-loading Merchandising Data...");
    listenToBuyers();
}

/**
 * --- Initialization for Packing List Page ---
 */
export function initMerchandising() {
    console.log("📦 Initializing Packing List");
    if (!db) {
        console.error("🔴 Firestore database (db_notes) is not initialized!");
        showToast("Database error: db_notes not found", "error");
        return;
    }

    // Ensure listener is running
    listenToBuyers();

    // Render immediately if we have data
    if (buyers.length > 0) renderBuyerGrid();

    setupPackingListListeners();
    setupFilterListeners();
}

/**
 * --- Initialization for Manage Buyers Page ---
 */
export function initMerchandisingBuyers() {
    console.log("👥 Initializing Manage Buyers");
    if (!db) {
        console.error("🔴 Firestore database (db_notes) is not initialized!");
        showToast("Database error: db_notes not found", "error");
        return;
    }

    listenToBuyers();
    if (buyers.length > 0) renderBuyerList();
}

/**
 * Real-time listener for buyers - optimized to run once
 */
function listenToBuyers() {
    const path = getModulePath('merch_buyers');

    // If already subscribed to this path, don't re-subscribe
    if (unsubscribeBuyers && unsubscribeBuyers._path === path) {
        console.log("⏭️ Already listening to buyers at current path.");
        return;
    }

    if (unsubscribeBuyers) unsubscribeBuyers();

    try {
        console.log(`📡 Starting buyer listener at ${path}`);
        const q = query(collection(db, path));

        unsubscribeBuyers = onSnapshot(q, (snapshot) => {
            buyers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            buyers.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

            console.log(`✅ Buyers synced: ${buyers.length}`);

            // Update UI if elements exist
            const grid = document.getElementById('buyerGrid');
            if (grid) renderBuyerGrid();

            const list = document.getElementById('buyerList');
            if (list) renderBuyerList();
        }, (error) => {
            console.error('Firestore Error (Buyers):', error);
            // Only show toast if it's a critical logic error, not just a permission deny on logout
            if (window.location.hash !== '#login') {
                showToast('Failed to sync buyers', 'error');
            }
        });

        unsubscribeBuyers._path = path;
    } catch (err) {
        console.error("Error setting up buyers listener:", err);
    }
}

function renderBuyerGrid() {
    const grid = document.getElementById('buyerGrid');
    if (!grid) return;
    grid.innerHTML = '';

    if (buyers.length === 0) {
        grid.innerHTML = '<div class="text-center py-5 text-muted w-100">No buyers found. Please add buyers in "Manage Buyers".</div>';
        return;
    }

    buyers.forEach(buyerObj => {
        const card = document.createElement('div');
        card.className = 'buyer-card';
        card.onclick = () => openBuyerPage(buyerObj.name);
        card.innerHTML = `<h3>${buyerObj.name}</h3>`;
        grid.appendChild(card);
    });
}

function renderBuyerList() {
    const list = document.getElementById('buyerList');
    if (!list) return;
    list.innerHTML = '';

    if (buyers.length === 0) {
        list.innerHTML = '<div class="text-center py-4 text-muted">No buyers found.</div>';
        return;
    }

    buyers.forEach(buyerObj => {
        const item = document.createElement('div');
        item.className = 'buyer-list-item list-group-item list-group-item-action border-0 border-bottom py-3 d-flex justify-content-between align-items-center';
        item.innerHTML = `
            <div class="d-flex align-items-center">
                <div class="buyer-avatar bg-light text-primary rounded-circle d-flex align-items-center justify-content-center me-3" style="width: 40px; height: 40px;">
                    <i class="fas fa-building"></i>
                </div>
                <span class="fw-bold text-dark fs-6">${buyerObj.name}</span>
            </div>
            <div class="d-flex gap-2">
                <button class="btn btn-sm btn-outline-primary fw-bold" onclick="editMerchBuyer('${buyerObj.id}', '${buyerObj.name.replace(/'/g, "\\'")}')">
                    <i class="fas fa-edit me-1"></i> Edit
                </button>
                <button class="btn btn-sm btn-outline-danger fw-bold" onclick="deleteMerchBuyer('${buyerObj.id}', '${buyerObj.name.replace(/'/g, "\\'")}')">
                    <i class="fas fa-trash-alt me-1"></i> Delete
                </button>
            </div>
        `;
        list.appendChild(item);
    });
}

/**
 * Handle Add/Update form submission
 */
async function handleEntrySubmit(e) {
    e.preventDefault();

    if (!currentBuyer) {
        return showToast('Buyer not selected!', 'error');
    }

    const editId = document.getElementById('entryEditId').value;

    try {
        const path = getModulePath('merch_packing_list');
        if (editId) {
            await updateDoc(doc(db, path, editId), entryData); // Note: verify entryData usage, but standardizing on form read
            showToast('Entry updated successfully!', 'success');
        } else {
            const formData = {
                date: document.getElementById('entryDate').value,
                style: document.getElementById('entryStyle').value,
                po: document.getElementById('entryPO').value,
                color: document.getElementById('entryColor').value,
                qty: document.getElementById('entryQty').value,
                excess: document.getElementById('entryExcess').value,
                remarks: document.getElementById('entryRemarks').value,
                buyer: currentBuyer,
                createdBy: JSON.parse(localStorage.getItem('currentUser')).username
            };

            if (!formData.style || !formData.po) return showToast('Style and PO are required!', 'error');

            formData.timestamp = serverTimestamp();
            await addDoc(collection(db, path), formData);
            showToast('Entry added successfully!', 'success');
        }
        document.getElementById('entryForm').reset();
        document.getElementById('entryEditId').value = '';
    } catch (error) {
        console.error('Entry save failed:', error);
        showToast('Failed to save entry: ' + error.message, 'error');
    }
}

function setupPackingListListeners() {
    const entryForm = document.getElementById('entryForm');
    if (entryForm) {
        entryForm.removeEventListener('submit', handleEntrySubmit);
        entryForm.addEventListener('submit', handleEntrySubmit);
    }
}

function setupFilterListeners() {
    const fromDate = document.getElementById('filterFromDate');
    const toDate = document.getElementById('filterToDate');
    const searchInput = document.getElementById('entrySearchInput');

    if (fromDate) fromDate.onchange = applyFilters;
    if (toDate) toDate.onchange = applyFilters;
    if (searchInput) searchInput.addEventListener('input', applyFilters);

    window.clearDateFilter = () => {
        if (fromDate) fromDate.value = '';
        if (toDate) toDate.value = '';
        if (searchInput) searchInput.value = '';
        applyFilters();
    };
}

function listenToEntries(buyerName) {
    if (unsubscribeEntries) unsubscribeEntries();

    // Clear previous data immediately
    loadedEntries = [];
    renderEntriesUI(); // Render empty state

    try {
        const path = getModulePath('merch_packing_list');
        const q = query(
            collection(db, path),
            where('buyer', '==', buyerName)
        );

        unsubscribeEntries = onSnapshot(q, (snapshot) => {
            const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');

            // OPEN ACCESS: Everyone can see all entries (requested by user)
            loadedEntries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Combined sort: Date desc, then timestamp desc
            loadedEntries.sort((a, b) => {
                const dateCompare = (b.date || "").localeCompare(a.date || "");
                if (dateCompare !== 0) return dateCompare;
                return (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0);
            });

            console.log(`✅ Entries synced for ${buyerName}: ${loadedEntries.length} (Private View)`);
            applyFilters();
        }, (error) => {
            console.error('Firestore Error (Entries):', error);
            if (window.location.hash !== '#login') {
                showToast('Failed to sync entries', 'error');
            }
        });
    } catch (err) {
        console.error("Error setting up entries listener:", err);
    }
}

// --- Navigation Logic ---
let currentFilteredEntries = [];
let currentPage = 1; // 1-based index
const ITEMS_PER_PAGE = 50;

// ...

window.openBuyerPage = function (buyerName) {
    currentBuyer = buyerName;
    const landing = document.getElementById('buyerSelectionPage');
    const content = document.getElementById('entryPage');
    const title = document.getElementById('buyerTitle');

    if (landing) landing.classList.add('d-none');
    if (content) content.classList.remove('d-none');
    if (title) title.textContent = buyerName;

    // Set Default Filter (Last 1 Month)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dateStr = thirtyDaysAgo.toISOString().split('T')[0];

    const fromDate = document.getElementById('filterFromDate');
    if (fromDate) fromDate.value = dateStr;
    const searchInput = document.getElementById('entrySearchInput');
    if (searchInput) searchInput.value = '';

    listenToEntries(buyerName);
};

// ...

function applyFilters() {
    const from = document.getElementById('filterFromDate')?.value;
    const to = document.getElementById('filterToDate')?.value;
    const search = document.getElementById('entrySearchInput')?.value.toLowerCase().trim();

    let filtered = loadedEntries;

    // Date Filter
    if (from) {
        filtered = filtered.filter(e => e.date >= from);
    }
    if (to) {
        filtered = filtered.filter(e => e.date <= to);
    }

    // Search Filter
    if (search) {
        filtered = filtered.filter(e =>
            (e.style || '').toLowerCase().includes(search) ||
            (e.po || '').toLowerCase().includes(search) ||
            (e.color || '').toLowerCase().includes(search)
        );
    }

    currentFilteredEntries = filtered;
    currentPage = 1; // Reset to first page
    renderEntriesUI();
}

function renderEntriesUI() {
    const tbody = document.getElementById('tableBody');
    if (!tbody) return;

    if (currentFilteredEntries.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center py-5 text-muted">No entries found</td></tr>';
        renderPaginationControls();
        return;
    }

    // Pagination Logic
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const entriesToRender = currentFilteredEntries.slice(startIndex, endIndex);

    tbody.innerHTML = entriesToRender.map(entry => `
        <tr>
            <td>${entry.date || '-'}</td>
            <td>${entry.style || '-'}</td>
            <td>${entry.po || '-'}</td>
            <td>${entry.color || '-'}</td>
            <td>${parseInt(entry.qty || 0).toLocaleString()}</td>
            <td>${entry.excess || '-'}</td>
            <td>${entry.remarks || '-'}</td>
            <td class="text-center">
                <div class="d-flex gap-1 justify-content-center">
                    <button class="btn btn-sm btn-outline-primary" onclick="editEntry('${entry.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteEntry('${entry.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');

    renderPaginationControls();
}

function renderPaginationControls() {
    let paginationDiv = document.getElementById('merchPagination');
    if (!paginationDiv) {
        const tableResponsive = document.querySelector('.table-responsive');
        if (tableResponsive) {
            paginationDiv = document.createElement('div');
            paginationDiv.id = 'merchPagination';
            // Cleaner, centered style
            paginationDiv.className = 'd-flex justify-content-center align-items-center mt-4 gap-3';
            tableResponsive.after(paginationDiv);
        } else {
            return;
        }
    }

    const totalItems = currentFilteredEntries.length;
    if (totalItems === 0) {
        paginationDiv.style.display = 'none';
        return;
    }
    paginationDiv.style.display = 'flex';

    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

    paginationDiv.innerHTML = `
        <button class="btn btn-outline-secondary btn-sm px-3 rounded-pill" ${currentPage === 1 ? 'disabled' : ''} onclick="changePage(-1)">
            <i class="fas fa-arrow-left me-1"></i> Prev
        </button>
        
        <span class="text-muted small fw-bold user-select-none">
            Page ${currentPage} of ${totalPages}
        </span>

        <button class="btn btn-outline-secondary btn-sm px-3 rounded-pill" ${currentPage >= totalPages ? 'disabled' : ''} onclick="changePage(1)">
            Next <i class="fas fa-arrow-right ms-1"></i>
        </button>
    `;
}

window.changePage = function (delta) {
    currentPage += delta;
    renderEntriesUI();
};

/**
 * Entry Management - Edit (Populate Form)
 */
window.editEntry = function (id) {
    const entry = loadedEntries.find(e => e.id === id);
    if (!entry) return;

    // Populate Fields
    const editIdInput = document.getElementById('entryEditId');
    if (editIdInput) editIdInput.value = id;

    if (document.getElementById('entryDate')) document.getElementById('entryDate').value = entry.date || '';
    if (document.getElementById('entryStyle')) document.getElementById('entryStyle').value = entry.style || '';
    if (document.getElementById('entryPO')) document.getElementById('entryPO').value = entry.po || '';
    if (document.getElementById('entryColor')) document.getElementById('entryColor').value = entry.color || '';
    if (document.getElementById('entryQty')) document.getElementById('entryQty').value = entry.qty || '';
    if (document.getElementById('entryExcess')) document.getElementById('entryExcess').value = entry.excess || '';
    if (document.getElementById('entryRemarks')) document.getElementById('entryRemarks').value = entry.remarks || '';

    // Update UI Indicators
    const submitBtn = document.querySelector('.btn-submit');
    if (submitBtn) submitBtn.textContent = 'Update Entry';

    const formTitle = document.querySelector('.entry-form h4');
    if (formTitle) formTitle.textContent = 'Edit Entry';

    // Scroll to form
    const formEl = document.querySelector('.entry-form');
    if (formEl) formEl.scrollIntoView({ behavior: 'smooth' });
};

window.deleteEntry = async function (id) {
    const confirmed = await window.showConfirm("Are you sure you want to delete this entry?");
    if (!confirmed) return;

    try {
        const path = getModulePath('merch_packing_list');
        await deleteDoc(doc(db, path, id));
        showToast('Entry deleted successfully!', 'success');

        // Reset if we were editing this specific entry
        const editIdVal = document.getElementById('entryEditId')?.value;
        if (editIdVal === id) {
            resetEntryForm();
        }
    } catch (error) {
        console.error('Delete failed:', error);
        showToast('Failed to delete entry', 'error');
    }
};

/**
 * Buyer Management (Exposed to window)
 */
window.addMerchBuyer = async function () {
    const nameInput = document.getElementById('newBuyerName');
    if (!nameInput) return;
    const name = nameInput.value.trim();
    if (!name) return showToast('Please enter a buyer name!', 'error');

    if (buyers.some(b => b.name.toLowerCase() === name.toLowerCase())) {
        return showToast('Buyer already exists!', 'error');
    }

    try {
        const path = getModulePath('merch_buyers');
        await addDoc(collection(db, path), { name, timestamp: serverTimestamp() });
        showToast('Buyer added successfully!', 'success');
        nameInput.value = '';
    } catch (error) {
        console.error('Add failed:', error);
        showToast('Failed to add buyer: ' + error.message, 'error');
    }
}

window.editMerchBuyer = function (id, name) {
    if (document.getElementById('editBuyerOldName')) document.getElementById('editBuyerOldName').value = id;
    if (document.getElementById('editBuyerName')) document.getElementById('editBuyerName').value = name;
    window._editingMerchBuyerId = id;
    window._editingMerchBuyerOldName = name;

    const modalEl = document.getElementById('editBuyerModal');
    if (modalEl) {
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    }
}

window.saveMerchBuyerEdit = async function () {
    const id = window._editingMerchBuyerId;
    const oldName = window._editingMerchBuyerOldName;
    const newNameInput = document.getElementById('editBuyerName');
    const newName = newNameInput ? newNameInput.value.trim() : '';

    if (!newName || newName === oldName) return;

    try {
        const path = getModulePath('merch_buyers');
        await updateDoc(doc(db, path, id), { name: newName });
        showToast('Buyer updated successfully!', 'success');
        const modalEl = document.getElementById('editBuyerModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
    } catch (error) {
        console.error('Update failed:', error);
        showToast('Failed to update buyer: ' + error.message, 'error');
    }
}

window.deleteMerchBuyer = async function (id, name) {
    const confirmed = await window.showConfirm(`Are you sure you want to delete ${name}?`);
    if (!confirmed) return;

    try {
        const path = getModulePath('merch_buyers');
        await deleteDoc(doc(db, path, id));
        showToast('Buyer deleted successfully!', 'success');
    } catch (error) {
        console.error('Delete failed:', error);
        showToast('Failed to delete buyer: ' + error.message, 'error');
    }
}
