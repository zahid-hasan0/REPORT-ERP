// excel.js
import { getActiveDb, getBookingsPath } from './storage.js';
import { collection, addDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { loadBookings } from './display.js';
import { showToast } from './toast.js';

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
        <p style="margin: 0; font-size: 15px; font-weight: 600; color: #1e293b;">Uploading Excel...</p>
        <p style="margin: 0; font-size: 13px; color: #64748b;">Please wait while we process your file</p>
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

function parseBookingDate(input) {
    if (!input) return new Date();

    if (input instanceof Date) return input;

    if (typeof input === 'number') {
        const date = XLSX.SSF.parse_date_code(input);
        return new Date(date.y, date.m - 1, date.d);
    }

    const parts = input.toString().split(/[-\/]/);
    if (parts[0].length === 4) {
        // "YYYY-MM-DD" format
        return new Date(parts[0], parts[1] - 1, parts[2]);
    } else {
        // "DD/MM/YYYY" format
        return new Date(parts[2], parts[1] - 1, parts[0]);
    }
}

// Firestore-এ save করার জন্য local date string
function formatDateForFirestore(input) {
    const dateObj = parseBookingDate(input);
    return `${dateObj.getFullYear()}-${(dateObj.getMonth() + 1).toString().padStart(2, '0')}-${dateObj.getDate().toString().padStart(2, '0')}`;
}

export async function importExcel() {
    const file = document.getElementById('excelFile').files[0];
    if (!file) {
        showToast('Please select an Excel file', 'error');
        return;
    }

    if (typeof XLSX === 'undefined') {
        showToast('Excel library not loaded. Please refresh the page.', 'error');
        return;
    }

    showSpinner();

    const reader = new FileReader();
    reader.onload = async function (e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

            if (jsonData.length === 0) {
                showToast('Excel file is empty', 'error');
                hideSpinner();
                return;
            }

            const activeDb = getActiveDb();
            const bookingsPath = getBookingsPath();
            const user = JSON.parse(localStorage.getItem('currentUser') || '{}');

            console.log(`🚀 Starting import of ${jsonData.length} rows to ${bookingsPath}`);

            let imported = 0, skipped = 0;
            for (const row of jsonData) {
                // Flexible mapping for headers
                const bookingNo = String(row['Booking No'] || row['BOOKING NO'] || '').trim();
                const customer = String(row['Customer'] || row['CUSTOMER'] || '').trim();
                const buyer = String(row['Buyer'] || row['BUYER'] || '').trim();
                const item = String(row['Item'] || row['ITEM'] || '').trim();
                const remarks = String(row['Remarks'] || row['REMARKS'] || '').trim();
                const checkStatus = String(row['Status'] || row['Check Status'] || 'Unverified').trim();

                // Flexible date mapping
                const rawDate = row['Date'] || row['DATE'] || row['Booking Date'];
                const bookingDate = rawDate ? formatDateForFirestore(rawDate) : formatDateForFirestore(new Date());

                const rawCheckDate = row['Check Date'] || row['CHECK DATE'];
                let checkDate = '';
                if (rawCheckDate) {
                    checkDate = formatDateForFirestore(rawCheckDate);
                }

                if (bookingNo && customer) {
                    await addDoc(collection(activeDb, bookingsPath), {
                        bookingNo,
                        customer,
                        buyer,
                        item,
                        bookingDate,
                        checkStatus,
                        checkDate,
                        remarks,
                        // Add audit info for consistency with manual entry
                        createdBy: user.username || 'System',
                        creatorName: user.fullName || user.username || 'System Import',
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    });
                    imported++;
                } else {
                    skipped++;
                }
            }

            console.log(`✅ Import finished: ${imported} added, ${skipped} skipped.`);
            await loadBookings();
            hideSpinner();

            if (imported > 0) {
                showToast(`Successfully imported ${imported} bookings!`, 'success');
            } else {
                showToast('No valid bookings found in the file. Check Booking No and Customer columns.', 'error');
            }

            document.getElementById('excelFile').value = '';

        } catch (err) {
            console.error("🔥 Error importing Excel:", err);
            hideSpinner();
            showToast(`Error: ${err.message}`, 'error');
        }
    };

    reader.onerror = function () {
        hideSpinner();
        showToast('Failed to read Excel file', 'error');
    };

    reader.readAsArrayBuffer(file);
}

window.importExcel = importExcel;

// Template download function
function downloadTemplate() {
    try {
        const template = [
            {
                "Booking No": "BK-2024-001",
                "Customer": "GMS Composite",
                "Buyer": "H&M",
                "Item": "T-Shirt 100% Cotton",
                "Date": new Date().toISOString().split('T')[0],
                "Status": "Unverified",
                "Check Date": "",
                "Remarks": "Sample internal note"
            },
            {
                "Booking No": "BK-2024-002",
                "Customer": "GMS Textile",
                "Buyer": "Zara",
                "Item": "Polo Shirt",
                "Date": new Date().toISOString().split('T')[0],
                "Status": "Verified",
                "Check Date": new Date().toISOString().split('T')[0],
                "Remarks": ""
            }
        ];

        // Create workbook
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(template);

        // Set column widths
        ws['!cols'] = [
            { wch: 20 }, // Booking No
            { wch: 25 }, // Customer
            { wch: 20 }, // Buyer
            { wch: 25 }, // Item
            { wch: 15 }, // Date
            { wch: 15 }, // Status
            { wch: 15 }, // Check Date
            { wch: 30 }  // Remarks
        ];

        XLSX.utils.book_append_sheet(wb, ws, "Booking Template");
        XLSX.writeFile(wb, "Booking_Import_Template.xlsx");

        showToast('Template downloaded successfully!', 'success');
    } catch (err) {
        console.error("Error downloading template:", err);
        showToast('Failed to download template', 'error');
    }
}

// Make it globally accessible for HTML onclick
window.downloadTemplate = downloadTemplate;
