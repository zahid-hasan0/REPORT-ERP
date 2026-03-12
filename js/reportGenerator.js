// js/reportGenerator.js
import { showToast } from './toast.js';

let filteredReportData = [];

export function initReportGenerator() {
    console.log('📊 Initializing Report Generator...');
    setupReportBuyerDropdown();
    setupReportListeners();
}

function setupReportBuyerDropdown() {
    const list = document.getElementById('reportBuyerList');
    const searchInput = document.getElementById('reportBuyerSearch');
    const btn = document.getElementById('reportBuyerBtn');

    if (!list || !btn) return;

    // Use global buyers from window
    const buyers = window.buyers || [];

    function renderOptions(data) {
        list.innerHTML = `
            <button class="dropdown-item py-2 border-bottom-light" type="button" onclick="window.selectReportBuyer('all')">
                All Buyers
            </button>
        ` + data.map(buyer => `
            <button class="dropdown-item py-2 border-bottom-light" type="button" onclick="window.selectReportBuyer('${buyer.name}')">
                ${buyer.name}
            </button>
        `).join('');
    }

    renderOptions(buyers);

    if (searchInput) {
        searchInput.addEventListener('click', (e) => e.stopPropagation());
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const filtered = buyers.filter(b => b.name.toLowerCase().includes(term));
            renderOptions(filtered);
        });
    }

    // Auto-focus search when dropdown opens
    const container = document.getElementById('reportBuyerDropdownContainer');
    if (container) {
        container.addEventListener('shown.bs.dropdown', () => {
            if (searchInput) searchInput.focus();
        });
    }
}

window.selectReportBuyer = function (name) {
    const label = document.getElementById('reportBuyerLabel');
    const hiddenInput = document.getElementById('reportBuyerValue');
    const searchInput = document.getElementById('reportBuyerSearch');

    if (label) label.textContent = name === 'all' ? 'All Buyers' : name;
    if (hiddenInput) hiddenInput.value = name;

    if (searchInput) {
        searchInput.value = '';
        const buyers = window.buyers || [];
        // Re-render full list for next open
        const list = document.getElementById('reportBuyerList');
        if (list) {
            list.innerHTML = `
                <button class="dropdown-item py-2 border-bottom-light" type="button" onclick="window.selectReportBuyer('all')">
                    All Buyers
                </button>
            ` + buyers.map(buyer => `
                <button class="dropdown-item py-2 border-bottom-light" type="button" onclick="window.selectReportBuyer('${buyer.name}')">
                    ${buyer.name}
                </button>
            `).join('');
        }
    }

    // Close dropdown
    const btn = document.getElementById('reportBuyerBtn');
    if (btn && typeof bootstrap !== 'undefined') {
        const dropdown = bootstrap.Dropdown.getOrCreateInstance(btn);
        if (dropdown) dropdown.hide();
    }
};

function setupReportListeners() {
    // Buttons are already in HTML with onclick
}

export function generateReport() {
    const month = document.getElementById('reportMonth').value;
    const fromDate = document.getElementById('reportFromDate').value;
    const toDate = document.getElementById('reportToDate').value;
    const buyer = document.getElementById('reportBuyerValue').value;

    // Validation: At least one filter must be selected
    if (month === 'all' && buyer === 'all' && (!fromDate || !toDate)) {
        showToast('Please select at least one filter (Buyer, Month, or Date Range) to generate report!', 'warning');
        return;
    }

    const allBookings = window.bookings || [];

    filteredReportData = allBookings.filter(b => {
        if (!b.bookingDate) return false;
        const dt = new Date(b.bookingDate);

        // Month Filter
        const monthMatch = month === 'all' || (dt.getMonth() + 1) === parseInt(month);

        // Date Range Filter
        let dateMatch = true;
        if (fromDate && new Date(b.bookingDate) < new Date(fromDate)) dateMatch = false;
        if (toDate && new Date(b.bookingDate) > new Date(toDate)) dateMatch = false;

        // Buyer Filter
        const buyerMatch = buyer === 'all' || b.buyer === buyer;

        return monthMatch && dateMatch && buyerMatch;
    });

    // Sort by date descending
    filteredReportData.sort((a, b) => new Date(b.bookingDate) - new Date(a.bookingDate));

    renderReportResults(filteredReportData);

    // Enable/Disable action buttons
    const exportBtn = document.getElementById('reportExportBtn');
    const printBtn = document.getElementById('reportPrintBtn');
    if (exportBtn) exportBtn.disabled = filteredReportData.length === 0;
    if (printBtn) printBtn.disabled = filteredReportData.length === 0;

    if (filteredReportData.length === 0) {
        showToast('No records found matching your filters', 'info');
    } else {
        showToast(`Generated report with ${filteredReportData.length} records`, 'success');
    }
}

function renderReportResults(data) {
    const tbody = document.getElementById('reportResultsTable');
    if (!tbody) return;

    if (data.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center py-5 text-muted">
                    <div class="opacity-50">
                        <i class="fas fa-inbox fa-3x mb-3"></i>
                        <p class="mb-0 fw-medium">No results found for selected filters</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = data.map(b => `
        <tr>
            <td class="ps-4 fw-bold text-primary">${b.bookingNo || '-'}</td>
            <td>${b.customer || '-'}</td>
            <td><span class="badge bg-light text-dark fw-normal border">${b.buyer || '-'}</span></td>
            <td>${b.item || '-'}</td>
            <td class="text-nowrap">${b.bookingDate ? new Date(b.bookingDate).toLocaleDateString('en-GB') : '-'}</td>
            <td>
                <span class="badge ${b.checkStatus === 'Verified' ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'} px-2 py-1">
                    ${b.checkStatus || 'Unverified'}
                </span>
            </td>
            <td class="text-nowrap">${b.checkDate ? new Date(b.checkDate).toLocaleDateString('en-GB') : '-'}</td>
            <td class="pe-4 small text-muted">${b.remarks || '-'}</td>
        </tr>
    `).join('');
}

export function resetReportGenerator() {
    document.getElementById('reportMonth').value = 'all';
    document.getElementById('reportFromDate').value = '';
    document.getElementById('reportToDate').value = '';
    document.getElementById('reportBuyerValue').value = 'all';
    document.getElementById('reportBuyerLabel').textContent = 'All Buyers';

    const tbody = document.getElementById('reportResultsTable');
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center py-5 text-muted">
                    <div class="opacity-50">
                        <i class="fas fa-filter fa-3x mb-3"></i>
                        <p class="mb-0 fw-medium">Select filters and click "Generate" to view results</p>
                    </div>
                </td>
            </tr>
        `;
    }

    const exportBtn = document.getElementById('reportExportBtn');
    const printBtn = document.getElementById('reportPrintBtn');
    if (exportBtn) exportBtn.disabled = true;
    if (printBtn) printBtn.disabled = true;

    filteredReportData = [];
    showToast('Filters reset', 'info');
}

// --- Excel Export Functionality ---
export async function exportToExcel() {
    if (filteredReportData.length === 0) {
        showToast('No data to export', 'error');
        return;
    }

    try {
        showToast('Preparing Excel file...', 'info');
        const ExcelJS = window.ExcelJS;
        if (!ExcelJS) {
            throw new Error('ExcelJS library not loaded');
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Booking Report');

        // Header Styling
        const headerStyle = {
            font: { bold: true, color: { argb: 'FFFFFF' } },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: '0864CF' } },
            alignment: { horizontal: 'center', vertical: 'middle' },
            border: {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            }
        };

        // Columns
        worksheet.columns = [
            { header: 'Booking No', key: 'bookingNo', width: 20 },
            { header: 'Customer', key: 'customer', width: 30 },
            { header: 'Buyer', key: 'buyer', width: 25 },
            { header: 'Item', key: 'item', width: 25 },
            { header: 'Date', key: 'bookingDate', width: 15 },
            { header: 'Status', key: 'checkStatus', width: 15 },
            { header: 'Check Date', key: 'checkDate', width: 15 },
            { header: 'Remarks', key: 'remarks', width: 35 }
        ];

        // Apply header styles
        worksheet.getRow(1).eachCell((cell) => {
            cell.style = headerStyle;
        });

        // Add Data
        filteredReportData.forEach(item => {
            worksheet.addRow({
                bookingNo: item.bookingNo,
                customer: item.customer,
                buyer: item.buyer,
                item: item.item,
                bookingDate: item.bookingDate,
                checkStatus: item.checkStatus || 'Unverified',
                checkDate: item.checkDate || '-',
                remarks: item.remarks || '-'
            });
        });

        // Write to buffer and download
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Booking_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url);

        showToast('Excel file downloaded successfully!', 'success');
    } catch (error) {
        console.error('Export Error:', error);
        showToast('Failed to export Excel: ' + error.message, 'error');
    }
}

// --- Print Functionality ---
export function printReport() {
    if (filteredReportData.length === 0) {
        showToast('No data to print', 'error');
        return;
    }

    const printWindow = window.open('', '_blank');
    const content = `
        <html>
        <head>
            <title>Booking Report</title>
            <link href="https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.2/css/bootstrap.min.css" rel="stylesheet">
            <style>
                body { padding: 40px; font-family: sans-serif; }
                .report-header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #0864CF; padding-bottom: 20px; }
                .report-header h1 { color: #0864CF; margin-bottom: 5px; }
                .table thead { background-color: #f8fafc; }
                .badge-verified { color: #10b981; }
                .badge-unverified { color: #ef4444; }
                @media print {
                    .no-print { display: none; }
                }
            </style>
        </head>
        <body>
            <div class="report-header">
                <h1>Report Erp System</h1>
                <h3>Detailed Booking Report</h3>
                <p class="text-muted">Generated on: ${new Date().toLocaleString()}</p>
            </div>
            
            <table class="table table-bordered table-striped">
                <thead>
                    <tr>
                        <th>Booking No</th>
                        <th>Customer</th>
                        <th>Buyer</th>
                        <th>Item</th>
                        <th>Date</th>
                        <th>Status</th>
                        <th>Check Date</th>
                    </tr>
                </thead>
                <tbody>
                    ${filteredReportData.map(b => `
                        <tr>
                            <td><strong>${b.bookingNo}</strong></td>
                            <td>${b.customer}</td>
                            <td>${b.buyer}</td>
                            <td>${b.item}</td>
                            <td>${b.bookingDate}</td>
                            <td class="${b.checkStatus === 'Verified' ? 'badge-verified' : 'badge-unverified'}">
                                ${b.checkStatus || 'Unverified'}
                            </td>
                            <td>${b.checkDate || '-'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            
            <div class="mt-5 text-end text-muted small">
                © ${new Date().getFullYear()} Report Erp - Automated System
            </div>
            
            <script>
                window.onload = function() {
                    window.print();
                    // window.close();
                }
            </script>
        </body>
        </html>
    `;

    printWindow.document.open();
    printWindow.document.write(content);
    printWindow.document.close();
}

// Make functions globally available for HTML onclicks
window.generateReport = generateReport;
window.resetReportGenerator = resetReportGenerator;
window.exportToExcel = exportToExcel;
window.printReport = printReport;
window.initReportGenerator = initReportGenerator;
