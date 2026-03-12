import { getActiveDb, getBookingsPath } from './storage.js';
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { loadBookings } from './display.js';
import { showToast } from './toast.js';

//Spinner  start 
const spinner = document.createElement('div');
spinner.id = 'excelSpinner';
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
        <i class="fas fa-spinner fa-spin" style="font-size: 40px; color: #0c4ddaff;"></i>
        <p style="margin: 0; font-size: 15px; font-weight: 600; color: #00b318ff;">Booking Processing</p>
        <p style="margin: 0; font-size: 13px; color: #1704c2ff;">Please wait while we process your Booking</p>
    </div>
`;

// Add overlay
const overlay = document.createElement('div');
overlay.id = 'excelOverlay';
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

//Spinner  End

export async function saveBooking(e) {
    e.preventDefault();

    const path = getBookingsPath();
    const user = JSON.parse(localStorage.getItem('currentUser') || '{}');

    // ✅ BUYER VALIDATION - Check if buyer is selected
    const buyerValue = document.getElementById('buyer').value;
    if (!buyerValue) {
        showToast('Please select a buyer from the dropdown', 'error');
        document.getElementById('buyer').focus();
        return;
    }

    // ✅ Warn if buyer list is empty, but don't block (to avoid getting stuck during sync)
    if (!window.buyers || window.buyers.length === 0) {
        console.warn("⚠️ Buyer list not loaded, proceeding with raw value:", buyerValue);
    } else {
        const buyerExists = window.buyers.some(b => b.name === buyerValue);
        if (!buyerExists) {
            console.warn("⚠️ Non-standard buyer entered:", buyerValue);
        }
    }

    const editId = document.getElementById('editId').value;

    // Get check status value
    const checkStatusValue = document.getElementById('checkStatus').value || 'Unverified';

    // Auto-set check date to today if status is Verified and no date is manually set
    let checkDateValue = document.getElementById('checkDate').value || '';
    if (checkStatusValue === 'Verified' && !checkDateValue) {
        const today = new Date().toISOString().split('T')[0];
        checkDateValue = today;
    }

    const booking = {
        bookingNo: document.getElementById('bookingNo').value,
        customer: document.getElementById('customer').value,
        buyer: buyerValue,
        item: document.getElementById('item').value,
        bookingDate: document.getElementById('bookingDate').value,
        checkStatus: checkStatusValue,
        checkDate: checkDateValue,
        remarks: document.getElementById('remarks').value,
        // Audit Info
        createdBy: user.username,
        creatorName: user.fullName || user.username,
        updatedAt: new Date().toISOString()
    };

    try {
        showSpinner();
        const dbInstance = getActiveDb();

        if (editId) {
            let finalDocRef;
            if (window._lastBookingSourcePath && window._lastBookingSourcePath.endsWith(editId)) {
                finalDocRef = doc(dbInstance, window._lastBookingSourcePath);
            } else {
                finalDocRef = doc(dbInstance, path, editId);
            }
            console.log("📝 Updating booking...", editId);
            await updateDoc(finalDocRef, booking);
            window._lastBookingSourcePath = null;
        } else {
            console.log("📡 Adding new booking...");
            await addDoc(collection(dbInstance, path), {
                ...booking,
                createdAt: new Date().toISOString()
            });
        }

        resetForm();
        hideSpinner();
        showToast('Saved successfully', 'success');

    } catch (err) {
        hideSpinner();
        console.error("❌ Save Error:", err);
        showToast("Save failed: " + (err.code || err.message), 'error');
    }
}

export function resetForm() {
    const form = document.getElementById('bookingForm');
    if (!form) return;

    form.reset();
    document.getElementById('editId').value = '';

    // Set default booking date to today
    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('bookingDate');
    if (dateInput) dateInput.value = today;
}
window.resetForm = resetForm;

export async function editBooking(id) {
    const bookings = window.bookings || [];

    const booking = bookings.find(b => b.id === id);
    if (!booking) {
        console.log("❌ Booking not found for id:", id);
        showToast("Booking not found for id: " + id, 'error');
        return;
    }

    // 1. Switch to the booking page using optimized function
    const wasAlreadyActive = await window.showPageOptimized('bookingPage');

    const populateForm = () => {
        try {
            const editIdEl = document.getElementById('editId');
            if (!editIdEl) {
                console.error("❌ Edit form elements not found");
                return;
            }

            editIdEl.value = booking.id;
            document.getElementById('bookingNo').value = booking.bookingNo || '';
            document.getElementById('customer').value = booking.customer || '';

            // Set Hidden Input
            const buyerInput = document.getElementById('buyer');
            if (buyerInput) buyerInput.value = booking.buyer || '';

            // Set UI Label for Custom Dropdown
            const buyerLabel = document.getElementById('selectedBuyerLabel');
            if (buyerLabel) buyerLabel.textContent = booking.buyer || '-- Select Buyer --';

            document.getElementById('item').value = booking.item || '';
            document.getElementById('bookingDate').value = booking.bookingDate || '';
            document.getElementById('checkStatus').value = booking.checkStatus || 'Unverified';
            document.getElementById('checkDate').value = booking.checkDate || '';
            document.getElementById('remarks').value = booking.remarks || '';

            window.scrollTo({ top: 0, behavior: 'smooth' });
            console.log("✅ Form populated for booking:", booking.bookingNo);
        } catch (err) {
            console.error("Error populating form:", err);
        }
    };

    if (wasAlreadyActive) {
        populateForm();
    } else {
        // Wait for potential content injection
        setTimeout(populateForm, 150);
    }
}

window.editBooking = editBooking;

export function deleteBooking(id) {
    const deleteModalEl = document.getElementById("deleteModal");
    const deleteModal = new bootstrap.Modal(deleteModalEl);
    const confirmBtn = document.getElementById("confirmDeleteBtn");
    const path = getBookingsPath();

    // Remove previous click listeners to avoid duplicates
    confirmBtn.replaceWith(confirmBtn.cloneNode(true));
    const newConfirmBtn = document.getElementById("confirmDeleteBtn");
    newConfirmBtn.addEventListener("click", async () => { // Made async
        deleteModal.hide();
        try {
            showSpinner(); // Re-added
            const dbInstance = getActiveDb();
            console.log(`📡 Deleting booking ${id}...`); // Updated message

            await deleteDoc(doc(dbInstance, path, id)); // Used await

            hideSpinner(); // Moved here
            showToast("Successfully deleted", "success"); // Moved here

        } catch (err) {
            hideSpinner();
            console.error("❌ Delete Error:", err);
            showToast("Delete failed: " + err.message, "error");
        }
    });

    deleteModal.show();
}
window.deleteBooking = deleteBooking;

// Attach form listener
export function setupBookingFormListeners() {
    const form = document.getElementById('bookingForm');
    if (form) {
        form.removeEventListener('submit', saveBooking);
        form.addEventListener('submit', saveBooking);
        console.log('✅ Booking form listener attached');
    }
}
window.setupBookingFormListeners = setupBookingFormListeners;