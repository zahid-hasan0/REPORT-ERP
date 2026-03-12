import { db } from './storage.js';
import { collection, addDoc, getDocs, orderBy, query, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { showToast } from "./toast.js";
// spinner 
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
        <i class="fas fa-spinner fa-spin" style="font-size: 40px; color: #2563eb;"></i>
        <p style="margin: 0; font-size: 15px; font-weight: 600; color: #1e293b;">Notice Processing</p>
        <p style="margin: 0; font-size: 13px; color: #64748b;">Please wait while we process your Notice</p>
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



// Load notices on page load
document.addEventListener("DOMContentLoaded", async function () {
    await loadNotices();
});

// Add a new notice
export async function addNotice() {
    const input = document.getElementById("marqueeTextInput");
    const text = input.value.trim();
    if (!text) {
        showToast("Please write something!", "error");
        return;
    }

    try {
        showSpinner()
        await addDoc(collection(db, "notices"), {
            text: text,
            createdAt: new Date().toISOString()
        });
        input.value = "";
        await loadNotices();
        hideSpinner()
        showToast("Notice added successfully!", "success");
    } catch (err) {
        console.error("Error adding notice:", err);
        showToast("Could not add notice: " + err.message, "error");
    }
}

// Load notices from Firebase
export async function loadNotices() {
    try {
        const q = query(collection(db, "notices"), orderBy("createdAt", "asc"));
        const snapshot = await getDocs(q);
        const notices = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));

        // No longer showing in marquee, only in announcement drawer
        renderNoticeList(notices);
    } catch (err) {
        console.error("Error loading notices:", err);
        showToast("Could not load notices", "error");
    }
}

// Show notices in marquee - DEPRECATED (marquee removed)
function showNotices(notices) {
    // Marquee element no longer exists, this function is kept for compatibility
    // Notices are now shown in the announcement drawer
}

// Render notice list with numbers
function renderNoticeList(notices) {
    const container = document.getElementById("noticeListContainer");
    if (!container) return;

    if (!notices.length) {
        container.innerHTML = '<p style="text-align:center; color:#64748b; font-size:14px;">No notices available</p>';
        return;
    }

    container.innerHTML = notices.map((notice, index) => `
        <div style="
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            padding: 10px; 
            background: #fff; 
            border: 1px solid #e2e8f0; 
            border-radius: 8px; 
            margin-bottom: 8px;
        ">
            <span style="font-size: 14px; color: #334155; font-weight: 500;">
                ${index + 1}. ${notice.text}
            </span>
            <button onclick="window.deleteNotice('${notice.id}')" style="
                background: #fee2e2; 
                color: #ef4444; 
                border: none; 
                padding: 6px 12px; 
                border-radius: 6px; 
                cursor: pointer; 
                font-size: 12px; 
                font-weight: 600;
                transition: all 0.2s;
            " onmouseover="this.style.background='#fecaca'" onmouseout="this.style.background='#fee2e2'">
                <i class="fas fa-trash"></i> Delete
            </button>
        </div>
    `).join('');
}

// Delete notice by ID (click button)
let noticeToDeleteId = null; // delete করার জন্য notice id save রাখবে

// Trigger delete modal
window.deleteNotice = function (id) {
    noticeToDeleteId = id;
    const deleteModalEl = document.getElementById("deleteModal"); // আগের modal id
    const deleteModal = new bootstrap.Modal(deleteModalEl);
    deleteModal.show();
};

// Confirm delete button in modal
// Confirm delete button in modal
const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener("click", async () => {
        if (!noticeToDeleteId) return;

        const deleteModalEl = document.getElementById("deleteModal");
        const deleteModal = bootstrap.Modal.getInstance(deleteModalEl);
        deleteModal.hide();

        try {
            showSpinner();
            await deleteDoc(doc(db, "notices", noticeToDeleteId));
            hideSpinner();
            showToast("Notice deleted successfully", "success");
            noticeToDeleteId = null;
            await loadNotices();
        } catch (err) {
            hideSpinner();
            console.error("Error deleting notice:", err);
            showToast("Failed to delete notice", "error");
        }
    });
}

// Delete notice by number input using modal
const deleteNoticeBtn = document.getElementById("deleteNoticeBtn");
if (deleteNoticeBtn) {
    deleteNoticeBtn.addEventListener("click", async () => {
        const input = document.getElementById("deleteNoticeInput");
        const num = parseInt(input.value);

        if (isNaN(num) || num < 1) {
            showToast("Please enter a valid notice number", "error");
            return;
        }

        try {
            const q = query(collection(db, "notices"), orderBy("createdAt", "asc"));
            const snapshot = await getDocs(q);
            const notices = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));

            if (num > notices.length) {
                showToast("Notice number out of range", "error");
                return;
            }

            noticeToDeleteId = notices[num - 1].id; // save id
            const deleteModalEl = document.getElementById("deleteModal");
            const deleteModal = new bootstrap.Modal(deleteModalEl);
            deleteModal.show();

            input.value = ""; // reset input
        } catch (err) {
            console.error("Error deleting notice:", err);
            showToast("Failed to delete notice", "error");
        }
    });
}
// Make functions globally available
window.addNotice = addNotice;
window.loadNotices = loadNotices;
