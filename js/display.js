import { getActiveDb, getBookingsPath } from './storage.js';
import { collection, onSnapshot, query, orderBy, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { updateDashboard } from './summary.js';

export let bookings = [];
export let filteredBookings = [];

let currentPage = 1;
const rowsPerPage = 50;
let bookingsUnsubscribe = null;

// Apply Table Filters
window.applyTableFilters = function () {
    const start = document.getElementById("fromDate").value;
    const end = document.getElementById("toDate").value;
    const buyerFilter = document.getElementById("tableBuyerFilter")?.value || 'all';

    filteredBookings = bookings.filter(b => {
        const date = new Date(b.bookingDate);
        let match = true;
        if (start) match = date >= new Date(start);
        if (end) match = match && date <= new Date(end);
        if (buyerFilter !== 'all') match = match && b.buyer === buyerFilter;
        return match;
    });

    currentPage = 1;
    displayBookings();
};

export function setupTableListeners() {
    const filterBtn = document.getElementById("filterBtn");
    if (filterBtn) {
        filterBtn.removeEventListener("click", window.applyTableFilters);
        filterBtn.addEventListener("click", window.applyTableFilters);
    }

    const buyerFilter = document.getElementById("tableBuyerFilter");
    if (buyerFilter) {
        buyerFilter.removeEventListener("change", window.applyTableFilters);
        buyerFilter.addEventListener("change", window.applyTableFilters);
    }

    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') performSearch(e.target.value);
        });
    }

    const clearBtn = document.getElementById('clearSearchBtn');
    if (clearBtn) {
        clearBtn.addEventListener('click', clearSearch);
    }
}
window.setupTableListeners = setupTableListeners;

// Load bookings from Firebase (Real-time)
export async function loadBookings() {
    const path = getBookingsPath();
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const currentUsername = currentUser.username;

    // 1. Singleton Check: If already listening to the same path, just refresh UI
    if (bookingsUnsubscribe && window._lastBookingsPath === path) {
        console.log(`♻️ Using active listener for ${path}`);
        displayBookings();
        return;
    }

    // 2. Terminate existing listener if exists
    if (bookingsUnsubscribe) bookingsUnsubscribe();
    window._lastBookingsPath = path;

    try {
        const dbInstance = getActiveDb();
        const isAdmin = currentUser.role === 'admin';

        console.log(`📡 Initializing listener for: ${path} ON ${dbInstance.app.options.projectId}`);

        // 2. Build Query
        let q;
        if (isAdmin) {
            // Admin sees all
            q = query(collection(dbInstance, path), orderBy('bookingDate', 'desc'));
        } else {
            // User sees only their own - SERVER SIDE FILTERING
            // Note: orderBy removed for non-admins to avoid requirement for composite index
            q = query(collection(dbInstance, path),
                where('createdBy', '==', currentUsername)
            );
        }

        // 3. Start Listener
        bookingsUnsubscribe = onSnapshot(q, (snapshot) => {
            console.log(`📊 Data Update: Received ${snapshot.size} records for ${path}`);

            bookings = [];
            snapshot.forEach(docSnap => {
                bookings.push({ id: docSnap.id, ...docSnap.data() });
            });

            // Priority Sort (Remains Client-Side as it's complex)
            const now = new Date();
            const currentYearMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;

            bookings.sort((a, b) => {
                const isUnverifiedA = (a.checkStatus || 'Unverified') === 'Unverified';
                const isUnverifiedB = (b.checkStatus || 'Unverified') === 'Unverified';
                const isCurrentA = a.bookingDate && a.bookingDate.startsWith(currentYearMonth);
                const isCurrentB = b.bookingDate && b.bookingDate.startsWith(currentYearMonth);

                const priorityA = (isUnverifiedA && isCurrentA) ? 0 : 1;
                const priorityB = (isUnverifiedB && isCurrentB) ? 0 : 1;
                if (priorityA !== priorityB) return priorityA - priorityB;

                const dateDiff = new Date(b.bookingDate) - new Date(a.bookingDate);
                if (dateDiff !== 0) return dateDiff;

                return (a.customer || '').localeCompare(b.customer || '');
            });

            window.bookings = bookings;
            filteredBookings = [...bookings];

            // 4. Update UI
            displayBookings();

            // Safely notify other modules (using direct imports first, or global fallback)
            if (typeof updateDashboard === 'function') updateDashboard(bookings);

            // Compatibility for HTML/legacy scripts
            if (window.updateBuyerDropdown) window.updateBuyerDropdown();
            if (window.displayBuyerList) window.displayBuyerList();

        }, (err) => {
            console.error("❌ Bookings Listener Error:", err.message, err);
            if (err.code === 'permission-denied') {
                console.warn("🔐 Permission denied for", path);
            }
        });

    } catch (err) {
        console.error("❌ Error setting up bookings listener:", err.message, err);
    }
}
window.loadBookings = loadBookings;
window.updateDashboard = updateDashboard; // Explicitly expose for navigation.js

function performSearch(keyword) {
    if (!keyword) return;
    keyword = keyword.toLowerCase();
    filteredBookings = bookings.filter(b =>
        b.bookingNo?.toString().toLowerCase().includes(keyword) ||
        b.customer?.toLowerCase().includes(keyword) ||
        b.buyer?.toLowerCase().includes(keyword) ||
        b.item?.toLowerCase().includes(keyword)
    );
    currentPage = 1;
    displayBookings();
}

function clearSearch() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = '';
    filteredBookings = [...bookings];
    currentPage = 1;
    displayBookings();
}

window.clearSearch = clearSearch;

export function displayBookings() {
    const tbody = document.getElementById('bookingsTable');
    if (!tbody) return;

    const start = (currentPage - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const paginatedBookings = filteredBookings.slice(start, end);

    if (!paginatedBookings.length) {
        tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted py-4">No bookings found</td></tr>`;
        displayPagination();
        return;
    }

    tbody.innerHTML = paginatedBookings.map(b => {
        const status = b.checkStatus || 'Unverified';
        const isVerified = status === 'Verified';
        const badgeClass = isVerified ? 'badge-status-verified' : 'badge-status-unverified';
        const icon = isVerified ? '<i class="fas fa-check-circle"></i>' : '<i class="fas fa-clock"></i>';

        return `
        <tr>
            <td class="text-center"><span class="booking-id-badge">${b.bookingNo}</span></td>
            <td class="fw-bold text-dark">${b.customer}</td>
            <td>
                <span class="text-truncate-pro col-buyer" title="${b.buyer}">${b.buyer}</span>
            </td>
            <td>
                <span class="text-truncate-pro col-item" title="${b.item || ''}">${b.item || ''}</span>
            </td>
            <td class="text-center text-nowrap">${new Date(b.bookingDate).toLocaleDateString('en-GB')}</td>
            <td class="text-center">
                <span class="${badgeClass}">
                    ${icon} ${status}
                </span>
            </td>
            <td class="text-center text-nowrap">${b.checkDate ? new Date(b.checkDate).toLocaleDateString('en-GB') : '-'}</td>
            <td>
                <span class="text-truncate-pro col-remarks text-muted small" title="${b.remarks || ''}">${b.remarks || '-'}</span>
            </td>
            <td class="text-center">
                <div class="d-flex justify-content-center gap-2">
                    <button class="btn btn-sm btn-warning text-white shadow-sm" onclick="editBooking('${b.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger shadow-sm" onclick="deleteBooking('${b.id}')">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </td>
        </tr>`;
    }).join('');

    displayPagination();
}

function displayPagination() {
    const paginationContainer = document.getElementById('pagination');
    if (!paginationContainer) return;

    if (filteredBookings.length === 0) {
        paginationContainer.innerHTML = '';
        return;
    }

    const totalPages = Math.ceil(filteredBookings.length / rowsPerPage);

    paginationContainer.className = 'd-flex justify-content-center align-items-center p-3 gap-3 bg-light border-top';

    paginationContainer.innerHTML = `
        <button class="btn btn-outline-secondary btn-sm px-3 rounded-pill" ${currentPage === 1 ? 'disabled' : ''} onclick="goToPage(${currentPage - 1})">
            <i class="fas fa-arrow-left me-1"></i> Prev
        </button>
        
        <span class="text-muted small fw-bold">
            Page ${currentPage} of ${totalPages}
        </span>

        <button class="btn btn-outline-secondary btn-sm px-3 rounded-pill" ${currentPage >= totalPages ? 'disabled' : ''} onclick="goToPage(${currentPage + 1})">
            Next <i class="fas fa-arrow-right ms-1"></i>
        </button>
    `;
}

window.goToPage = function (page) {
    if (page < 1 || page > Math.ceil(filteredBookings.length / rowsPerPage)) return;
    currentPage = page;
    displayBookings();

    // Smooth scroll to top of table
    const table = document.querySelector('.table-container');
    if (table) table.scrollIntoView({ behavior: 'smooth', block: 'start' });
};