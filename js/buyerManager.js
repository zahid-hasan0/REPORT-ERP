import { db_admin, getModulePath } from './storage.js';
import { collection, addDoc, getDocs, query, orderBy, deleteDoc, doc, updateDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { showToast } from './toast.js';

// Spinner setup
const spinner = document.createElement('div');
spinner.id = 'buyerSpinner';
spinner.style = `
    display: none;
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    padding: 30px 40px;
    border-radius: 16px;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.2);
    z-index: 10000;
    text-align: center;
`;
spinner.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: center; gap: 16px;">
        <i class="fas fa-spinner fa-spin" style="font-size: 40px; color: #2563eb;"></i>
        <p style="margin: 0; font-size: 15px; font-weight: 600; color: #1e293b;">Processing...</p>
    </div>
`;

const overlay = document.createElement('div');
overlay.id = 'buyerOverlay';
overlay.style = `
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    z-index: 9999;
    backdrop-filter: blur(2px);
`;

document.body.appendChild(overlay);
document.body.appendChild(spinner);

function showSpinner() {
    overlay.style.display = 'block';
    spinner.style.display = 'block';
}

function hideSpinner() {
    overlay.style.display = 'none';
    spinner.style.display = 'none';
}

// Store buyers globally
export let buyers = [];
let buyersUnsubscribe = null;
let isInitializingBuyers = false;

// Load all buyers from Firebase (Real-time + Initial Fetch fallback)
export async function loadBuyers() {
    const path = getModulePath('buyers');
    const dbInstance = db_admin;
    const projectId = dbInstance.app.options.projectId;

    // Singleton check
    const listenerKey = `${projectId}/${path}`;
    if (buyersUnsubscribe && window._lastBuyersPath === listenerKey) {
        displayBuyerList();
        updateBuyerDropdown();
        return;
    }

    if (buyersUnsubscribe) buyersUnsubscribe();
    window._lastBuyersPath = listenerKey;

    console.log(`📡 Stream: [${projectId}] / [${path}]`);

    try {
        const q = query(collection(dbInstance, path), orderBy('name', 'asc'));

        // --- 1. INITIAL FETCH (Fallback) ---
        // Get initial data immediately to show something if stream is slow
        getDocs(q).then(snapshot => {
            if (!buyers.length && snapshot.size > 0) {
                console.log(`📥 Initial fetch received ${snapshot.size} buyers`);
                const newBuyers = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                newBuyers.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
                buyers = newBuyers;
                window.buyers = newBuyers;
                updateBuyerDropdown();
                displayBuyerList();
            }
        }).catch(err => console.warn("⚠️ Initial fetch fallback failed:", err));

        // --- 2. START REAL-TIME STREAM ---
        buyersUnsubscribe = onSnapshot(q, (snapshot) => {
            console.log(`📥 Real-time Buyers Update: ${snapshot.size} docs`);

            const newBuyers = [];
            snapshot.forEach(docSnap => {
                newBuyers.push({ id: docSnap.id, ...docSnap.data() });
            });

            newBuyers.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

            buyers = newBuyers;
            window.buyers = newBuyers;

            updateBuyerDropdown();
            displayBuyerList();

        }, (err) => {
            console.error("❌ Buyers Listener Error:", err.code, err.message);
            // If we have an error, still try to show UI if we have data
            displayBuyerList();
        });

    } catch (err) {
        console.error("❌ Error setting up buyers stream:", err.message);
    }
}
window.loadBuyers = loadBuyers;

// Update buyer dropdown in booking form
export function updateBuyerDropdown() {
    const list = document.getElementById('buyerOptionsList');
    const tableFilter = document.getElementById('tableBuyerFilter');

    if (list) {
        renderBuyerOptions(buyers);
        setupBuyerSearch();
    }

    // Populate table filter dropdown
    if (tableFilter) {
        const currentValue = tableFilter.value;
        const uniqueInBookings = [...new Set((window.bookings || []).map(b => b.buyer))];
        const allPossibleBuyers = [...new Set([...buyers.map(b => b.name), ...uniqueInBookings])].sort();

        tableFilter.innerHTML = '<option value="all">All Buyers</option>';
        allPossibleBuyers.forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            tableFilter.appendChild(option);
        });

        if (currentValue && allPossibleBuyers.includes(currentValue)) {
            tableFilter.value = currentValue;
        }
    }
}

function renderBuyerOptions(filteredBuyers) {
    const list = document.getElementById('buyerOptionsList');
    if (!list) return;

    if (filteredBuyers.length === 0) {
        list.innerHTML = '<div class="px-3 py-2 text-muted small">No buyers found</div>';
        return;
    }

    list.innerHTML = filteredBuyers.map(buyer => `
        <button class="dropdown-item py-2 border-bottom-light" type="button" onclick="window.selectBuyer('${buyer.name}')">
            ${buyer.name}
        </button>
    `).join('');
}

function setupBuyerSearch() {
    const searchInput = document.getElementById('buyerSearchInput');
    if (!searchInput) return;

    // Prevent dropdown from closing when clicking inside search
    searchInput.addEventListener('click', (e) => e.stopPropagation());

    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = buyers.filter(b => b.name.toLowerCase().includes(term));
        renderBuyerOptions(filtered);
    });
}

window.selectBuyer = function (name) {
    const label = document.getElementById('selectedBuyerLabel');
    const hiddenInput = document.getElementById('buyer');

    if (label) label.textContent = name;
    if (hiddenInput) {
        hiddenInput.value = name;
    }

    // Reset search for next time
    const searchInput = document.getElementById('buyerSearchInput');
    if (searchInput) {
        searchInput.value = '';
        renderBuyerOptions(buyers);
    }

    // Bootstrap 5 close dropdown - more robust way
    const dropdownBtn = document.getElementById('buyerDropdownBtn');
    if (dropdownBtn && typeof bootstrap !== 'undefined') {
        const dropdown = bootstrap.Dropdown.getOrCreateInstance(dropdownBtn);
        if (dropdown) dropdown.hide();
    }
};

// Override resetForm to clear custom dropdown
const originalResetForm = window.resetForm;
window.resetForm = function () {
    if (originalResetForm) originalResetForm();
    const label = document.getElementById('selectedBuyerLabel');
    const hiddenInput = document.getElementById('buyer');
    const searchInput = document.getElementById('buyerSearchInput');

    if (label) label.textContent = '-- Select Buyer --';
    if (hiddenInput) hiddenInput.value = '';
    if (searchInput) {
        searchInput.value = '';
        renderBuyerOptions(buyers);
    }
};

// Add new buyer
export async function addBuyer() {
    const input = document.getElementById('newBuyerName');
    const name = input.value.trim();

    // console.log('🔄 Adding buyer:', name);

    if (!name) {
        showToast('Please enter buyer name', 'error');
        return;
    }

    // Check if buyer already exists
    if (buyers.some(b => b.name.toLowerCase() === name.toLowerCase())) {
        showToast('This buyer already exists!', 'error');
        return;
    }

    try {
        showSpinner();
        const { getModulePath } = await import('./storage.js');
        const path = getModulePath('buyers');

        await addDoc(collection(db_admin, path), {
            name: name,
            createdAt: new Date().toISOString()
        });

        input.value = '';
        await loadBuyers();
        hideSpinner();
        showToast('Buyer added successfully!', 'success');
        // console.log('✅ Buyer added:', name);
    } catch (err) {
        hideSpinner();
        console.error("❌ Error adding buyer:", err);
        showToast('Error adding buyer: ' + err.message, 'error');
    }
}

// Display buyer list with premium ERP styling
function displayBuyerList() {
    const container = document.getElementById('buyerListContainer');
    const countEl = document.getElementById('totalBuyersCount');

    if (countEl) countEl.textContent = buyers.length;
    if (!container) return;

    if (!buyers.length) {
        container.innerHTML = `
            <div class="text-center py-5" style="color: #64748b;">
                <i class="fas fa-inbox fa-4x mb-3 opacity-25"></i>
                <h5 class="fw-bold">No Buyers Found</h5>
                <p class="text-muted small">Your directory is currently empty. Add a buyer to get started.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="table-responsive">
            <table class="table table-hover align-middle mb-0">
                <thead class="bg-light">
                    <tr>
                        <th class="ps-4" style="width: 80px;">SL</th>
                        <th>Buyer Identity</th>
                        <th class="text-end pe-4" style="width: 200px;">Actions</th>
                    </tr>
                </thead>
                <tbody class="border-top-0">
                    ${buyers.map((buyer, index) => `
                        <tr>
                            <td class="ps-4">
                                <span class="badge bg-light text-secondary rounded-pill px-3">${String(index + 1).padStart(2, '0')}</span>
                            </td>
                            <td>
                                <div class="d-flex align-items-center">
                                    <div class="avatar-sm me-3 rounded-circle bg-primary-subtle text-primary d-flex align-items-center justify-content-center fw-bold" style="width: 40px; height: 40px; font-size: 14px;">
                                        ${buyer.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div class="fw-bold text-dark h6 mb-0">${buyer.name}</div>
                                </div>
                            </td>
                            <td class="text-end pe-4">
                                <div class="d-flex justify-content-end gap-2">
                                    <button onclick="window.editBuyerName('${buyer.id}')" class="btn btn-sm btn-icon btn-outline-primary border-0 rounded-circle" title="Edit Profile" style="width: 32px; height: 32px; padding: 0;">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    <button onclick="window.deleteBuyer('${buyer.id}')" class="btn btn-sm btn-icon btn-outline-danger border-0 rounded-circle" title="Remove Profile" style="width: 32px; height: 32px; padding: 0;">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// Global Filter Function
window.filterBuyerTable = function (term) {
    const list = document.getElementById('buyerListContainer');
    if (!list) return;

    const searchTerm = term.toLowerCase();
    const filtered = buyers.filter(b => b.name.toLowerCase().includes(searchTerm));

    if (filtered.length === 0) {
        list.querySelector('tbody').innerHTML = `<tr><td colspan="3" class="text-center py-5 text-muted">No buyers match your search</td></tr>`;
        return;
    }

    // Direct DOM update for performance
    const rows = list.querySelectorAll('tbody tr');
    rows.forEach(row => {
        const name = row.querySelector('.h6').textContent.toLowerCase();
        row.style.display = name.includes(searchTerm) ? '' : 'none';
    });
};

// Edit buyer name
export async function editBuyerName(id) {
    const buyer = buyers.find(b => b.id === id);
    if (!buyer) return;

    // Remove existing modal if any
    const existingModal = document.getElementById('editBuyerModal');
    if (existingModal) existingModal.remove();

    const modalHTML = `
        <div class="modal fade" id="editBuyerModal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Edit Buyer Name</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="mb-3">
                            <label class="form-label">Buyer Name</label>
                            <input type="text" class="form-control" id="editBuyerNameInput" value="${buyer.name}">
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button type="button" class="btn btn-primary" id="saveBuyerNameBtn">
                            <i class="fas fa-save me-2"></i>Save Changes
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modalElement = document.getElementById('editBuyerModal');
    const bsModal = new bootstrap.Modal(modalElement);

    // Auto-focus input
    modalElement.addEventListener('shown.bs.modal', () => {
        document.getElementById('editBuyerNameInput').focus();
    });

    bsModal.show();

    // Handle Save
    document.getElementById('saveBuyerNameBtn').addEventListener('click', async () => {
        const input = document.getElementById('editBuyerNameInput');
        const newName = input.value.trim();

        if (!newName) {
            showToast('Please enter a buyer name', 'error');
            return;
        }

        if (newName === buyer.name) {
            bsModal.hide();
            return;
        }

        // Check duplicates
        if (buyers.some(b => b.id !== id && b.name.toLowerCase() === newName.toLowerCase())) {
            showToast('This buyer name already exists!', 'error');
            return;
        }

        try {
            bsModal.hide();
            showSpinner();
            await updateDoc(doc(db_admin, 'buyers', id), {
                name: newName
            });

            await loadBuyers();
            hideSpinner();
            showToast('Buyer name updated successfully!', 'success');
        } catch (err) {
            hideSpinner();
            console.error("Error updating buyer:", err);
            showToast('Error updating buyer: ' + err.message, 'error');
        }

        // Cleanup after hidden
        modalElement.addEventListener('hidden.bs.modal', () => {
            modalElement.remove();
        });
    });

    // Cleanup on manual close without saving
    modalElement.addEventListener('hidden.bs.modal', () => {
        if (document.body.contains(modalElement)) {
            modalElement.remove();
        }
    });
}

// Delete buyer
export async function deleteBuyer(id) {
    const buyer = buyers.find(b => b.id === id);
    if (!buyer) return;

    // Check if buyer is used in any booking
    const bookings = window.bookings || [];
    const usedBookings = bookings.filter(b => b.buyer === buyer.name);
    const isUsed = usedBookings.length > 0;
    // Remove existing modal
    const existingModal = document.getElementById('deleteBuyerModal');
    if (existingModal) existingModal.remove();

    let modalTitle = '<i class="fas fa-trash-alt me-2"></i>Delete Buyer';
    let modalTitleClass = 'text-danger';
    let modalBody = '';
    let modalFooter = '';

    if (isUsed) {
        modalTitle = '<i class="fas fa-ban me-2"></i>Cannot Delete Buyer';
        modalTitleClass = 'text-danger';
        modalBody = `
            <div class="text-center py-3">
                <i class="fas fa-exclamation-circle text-danger mb-3" style="font-size: 48px;"></i>
                <h5 class="text-dark mb-2">Action Blocked</h5>
                <p class="text-muted mb-0">
                    The buyer <strong style="color: #02880dff;">"${buyer.name}"</strong> cannot be deleted because it is currently assigned to <strong style="color: #880202ff;">${usedBookings.length}</strong> booking(s).
                </p>
                <div class="mt-3 p-3 bg-light rounded text-start">
                    <small class="text-secondary">
                        <i class="fas fa-lightbulb me-2 text-primary"></i>
                        <strong>Tip:</strong> To delete this buyer, first reassign their bookings to a different buyer using the "Fix Existing Buyers" tool.
                    </small>
                </div>
            </div>
        `;
        modalFooter = `
            <button type="button" class="btn btn-secondary w-100" data-bs-dismiss="modal">
                <i class="fas fa-check me-2"></i>Understood
            </button>
        `;
    } else {
        modalBody = `
            <div class="text-center py-3">
                <i class="fas fa-trash-alt text-danger mb-3" style="font-size: 48px;"></i>
                <h5 class="text-dark mb-2">Confirm Deletion</h5>
                <p class="text-muted">
                    Are you sure you want to delete <strong>"${buyer.name}"</strong>?
                </p>
                <div class="alert alert-danger mb-0 mt-3 small">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    This action cannot be undone.
                </div>
            </div>
        `;
        modalFooter = `
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-danger" id="confirmDeleteBuyerBtn">
                <i class="fas fa-trash me-2"></i>Yes, Delete
            </button>
        `;
    }

    const modalHTML = `
        <div class="modal fade" id="deleteBuyerModal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header border-0 pb-0">
                        <h5 class="modal-title ${modalTitleClass}">${modalTitle}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        ${modalBody}
                    </div>
                    <div class="modal-footer border-0 pt-0">
                        ${modalFooter}
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modalElement = document.getElementById('deleteBuyerModal');
    const bsModal = new bootstrap.Modal(modalElement);
    bsModal.show();

    // Handle Delete Confirmation (only if button exists)
    const deleteBtn = document.getElementById('confirmDeleteBuyerBtn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
            try {
                bsModal.hide();
                showSpinner();
                await deleteDoc(doc(db_admin, 'buyers', id));
                await loadBuyers();
                hideSpinner();
                showToast('Buyer deleted successfully!', 'success');
            } catch (err) {
                hideSpinner();
                console.error("Error deleting buyer:", err);
                showToast('Error deleting buyer: ' + err.message, 'error');
            }
        });
    }

    // Cleanup on hidden
    modalElement.addEventListener('hidden.bs.modal', () => {
        if (document.body.contains(modalElement)) {
            modalElement.remove();
        }
    });
}

// Fix existing bookings - Update buyer names to match buyer list
export async function fixExistingBuyerNames() {
    const bookings = window.bookings || [];
    if (!bookings.length) {
        showToast('No bookings to fix', 'error');
        return;
    }

    if (!buyers.length) {
        showToast('Please add buyers first', 'error');
        return;
    }

    // Get unique buyer names from bookings
    const uniqueBuyerNames = [...new Set(bookings.map(b => b.buyer))].sort();

    // console.log('Unique buyer names in bookings:', uniqueBuyerNames);

    // Create mapping interface
    const mappingHTML = `
        <div class="mb-3 sticky-top bg-white pt-2" style="z-index: 10;">
            <div class="d-flex justify-content-between align-items-center mb-2 px-1">
                <div class="text-muted small">
                    <i class="fas fa-list-ul me-1"></i>Found <strong>${uniqueBuyerNames.length}</strong> unique buyer names in bookings
                </div>
            </div>
            <input type="text" id="buyerMappingSearch" class="form-control" placeholder="🔍 Search existing names..." autocomplete="off">
        </div>
        <div id="buyerMappingList" style="max-height: 400px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 8px;">
            ${uniqueBuyerNames.map((oldName, index) => `
                <div class="mapping-item p-3 border-bottom d-flex align-items-center justify-content-between" 
                     data-name="${oldName.toLowerCase()}" 
                     style="background: #fff; transition: background 0.2s;">
                    
                    <div style="flex: 1; padding-right: 15px;">
                        <span style="font-weight: 600; color: #334155;">${oldName}</span>
                        <div class="small text-muted">
                            Found in ${bookings.filter(b => b.buyer === oldName).length} booking(s)
                        </div>
                    </div>

                    <div style="flex: 1; max-width: 300px;">
                        <select class="form-select border-primary" id="map_buyer_${index}" style="font-size: 14px;">
                            <option value="">-- Keep as is --</option>
                            ${buyers.map(buyer => `
                                <option value="${buyer.name}" ${buyer.name === oldName ? 'selected' : ''}>
                                    ${buyer.name}
                                </option>
                            `).join('')}
                        </select>
                    </div>
                </div>
            `).join('')}
        </div>
    `;

    // Remove existing modal if any
    const existingModal = document.getElementById('buyerMappingModal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.innerHTML = `
        <div class="modal fade" id="buyerMappingModal" tabindex="-1">
            <div class="modal-dialog modal-lg modal-dialog-scrollable">
                <div class="modal-content">
                    <div class="modal-header bg-light">
                        <h5 class="modal-title">
                            <i class="fas fa-wrench me-2 text-warning"></i>Fix Buyer Names
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        ${mappingHTML}
                    </div>
                    <div class="modal-footer bg-light">
                        <small class="text-muted me-auto">
                            <i class="fas fa-info-circle"></i> Only selected changes will be applied
                        </small>
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button type="button" class="btn btn-primary" id="applyBuyerMapping">
                            <i class="fas fa-save me-2"></i>Apply Changes
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    const bsModal = new bootstrap.Modal(document.getElementById('buyerMappingModal'));
    bsModal.show();

    // 🔍 Search Functionality
    const searchInput = document.getElementById('buyerMappingSearch');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const items = document.querySelectorAll('.mapping-item');
            let hasVisible = false;

            items.forEach(item => {
                const name = item.getAttribute('data-name');
                if (name.includes(searchTerm)) {
                    item.classList.remove('d-none');
                    item.classList.add('d-flex');
                    hasVisible = true;
                } else {
                    item.classList.remove('d-flex');
                    item.classList.add('d-none');
                }
            });
        });
    }

    // Handle apply button
    document.getElementById('applyBuyerMapping').addEventListener('click', async () => {
        const mapping = {};

        let hasChanges = false;

        uniqueBuyerNames.forEach((oldName, index) => {
            const select = document.getElementById(`map_buyer_${index}`);
            if (select && select.value && select.value !== oldName) {
                mapping[oldName] = select.value;
                hasChanges = true;
            }
        });

        if (!hasChanges) {
            showToast('No changes to apply', 'info');
            return;
        }

        bsModal.hide();

        try {
            showSpinner();
            let updated = 0;

            for (const booking of bookings) {
                if (mapping[booking.buyer]) {
                    await updateDoc(doc(db, 'bookings', booking.id), {
                        buyer: mapping[booking.buyer]
                    });
                    updated++;
                }
            }

            // Reload bookings
            if (window.loadBookings) {
                await window.loadBookings();
            }

            hideSpinner();
            showToast(`Successfully updated ${updated} booking(s)!`, 'success');
        } catch (err) {
            hideSpinner();
            console.error("Error fixing buyer names:", err);
            showToast('Error fixing buyer names: ' + err.message, 'error');
        }

        modal.remove();
    });

    // Remove modal on hide
    document.getElementById('buyerMappingModal').addEventListener('hidden.bs.modal', () => {
        modal.remove();
    });
}

// Make functions globally available
window.addBuyer = addBuyer;
window.editBuyerName = editBuyerName;
window.deleteBuyer = deleteBuyer;
window.fixExistingBuyerNames = fixExistingBuyerNames;
window.loadBuyers = loadBuyers;
window.updateBuyerDropdown = updateBuyerDropdown;
window.displayBuyerList = displayBuyerList;

// console.log('✅ buyerManager.js loaded successfully');

// Auto-load buyers on page load
document.addEventListener('DOMContentLoaded', () => {
    // console.log('🔄 DOMContentLoaded - Loading buyers...');
    loadBuyers();
});

// Refresh list when showing the page
// Refresh list when showing the page
document.addEventListener('click', (e) => {
    if (e.target.closest('[onclick*="buyerManagementPage"]')) {
        setTimeout(loadBuyers, 100);
    }
});

export function setupBuyerPageListeners() {
    // Add logic here if there are specific listeners for the buyer page 
    // that are not inline onclicks.
    // Currently, most buyer page buttons use onclick="..." in HTML.
    // But we might have the search input listener in setupBuyerSearch() which is called by loadBuyers -> updateBuyerDropdown.

    // We can ensure the search listeners are active.
    // The setupBuyerSearch() function already handles attaching listeners to 'buyerSearchInput'.

    // Excel upload listener might be needed if it's not inline.
    // Checking HTML... onclick="importExcel()" is inline.

    // So mostly we just need to ensure loadBuyers is called, which initPageScripts does.
    console.log('✅ Buyer page listeners setup (handled via inline/init)');
}
window.setupBuyerPageListeners = setupBuyerPageListeners;