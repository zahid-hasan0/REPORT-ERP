// summary.js
import { updateMonthlyChart, updateCustomerChart, updateBuyerChart, updateCustomerMonthlyChart } from './charts.js';
import { getSystemSettings } from './systemSettings.js';



// --- Global filters ---
const monthSelect = document.getElementById('monthFilter');
const yearSelect = document.getElementById('yearFilter');

// Main dashboard update
export async function updateDashboard(bookings) {
    const totalBookingsEl = document.getElementById('totalBookings');
    // If not on dashboard, skip heavy logic but still update reports if needed 
    // (though usually reports don't need real-time update during booking entry)
    if (!totalBookingsEl) return;

    const settings = await getSystemSettings();
    const { activeMonth, activeYear, availableYears } = settings.dashboard || {};

    if (availableYears) populateYearFilters(availableYears);

    // Default to admin settings
    let selectedMonth = activeMonth || 'all';
    let selectedYear = activeYear || 'all';

    // Override with local report filters if they exist (on Reports page)
    const localMonth = document.getElementById('emailMonth')?.value;
    const localYear = document.getElementById('emailYear')?.value;

    if (localMonth) selectedMonth = localMonth;
    if (localYear) selectedYear = localYear;

    // Filter bookings based on selection
    const filteredBookings = bookings.filter(b => {
        if (!b.bookingDate) return false;
        const dt = new Date(b.bookingDate);
        if (isNaN(dt.getTime())) return false; // Invalid date

        const monthMatch = selectedMonth === 'all' || (dt.getMonth() + 1) === parseInt(selectedMonth);
        const yearMatch = selectedYear === 'all' || dt.getFullYear() === parseInt(selectedYear);
        return monthMatch && yearMatch;
    });

    // Update main metrics only if elements exist
    if (totalBookingsEl) {
        totalBookingsEl.textContent = filteredBookings.length;

        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth();
        document.getElementById('monthBookings').textContent =
            bookings.filter(b => {
                const dt = new Date(b.bookingDate);
                return dt.getMonth() === currentMonth && dt.getFullYear() === currentYear;
            }).length;

        document.getElementById('totalCustomers').textContent =
            [...new Set(filteredBookings.map(b => b.customer))].length;

        document.getElementById('totalBuyers').textContent =
            [...new Set(filteredBookings.map(b => b.buyer))].length;

        updateMonthlyChart(filteredBookings);
        updateCustomerChart(filteredBookings);
        updateBuyerChart(filteredBookings);
        updateCustomerMonthlyChart(filteredBookings);
    } else {
        // console.log("Skipping dashboard stats updates (dashboard not active)");
    }

    updateReportTables(filteredBookings);

    updateReportTables(filteredBookings);
}



export function updateReportTables(bookings) {
    updateCustomerReport(bookings);
    updateBuyerReport(bookings);
    updateMonthlyReport(bookings);
    updateItemReport(bookings);
}

// ---- Individual Reports ----
function updateCustomerReport(bookings) {
    const tbody = document.getElementById('customerReportTable');
    if (!tbody) return;

    const monthlyCustomerData = {};
    bookings.forEach(b => {
        const dt = new Date(b.bookingDate);
        const monthKey = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
        if (!monthlyCustomerData[monthKey]) monthlyCustomerData[monthKey] = {};
        const customerName = b.customer.trim();
        monthlyCustomerData[monthKey][customerName] = (monthlyCustomerData[monthKey][customerName] || 0) + 1;
    });

    if (!Object.keys(monthlyCustomerData).length) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center py-5"><div style="color: #94a3b8;"><i class="fas fa-inbox fa-3x mb-3" style="opacity: 0.3;"></i><p class="mb-0" style="font-size: 15px; font-weight: 500;">No data available</p></div></td></tr>`;
        return;
    }
    // ... existing logic ...
    const sortedMonths = Object.keys(monthlyCustomerData).sort((a, b) => b.localeCompare(a));
    let rows = [];

    sortedMonths.forEach((monthKey, monthIndex) => {
        const [year, month] = monthKey.split('-');
        const formattedMonth = new Date(year, month - 1).toLocaleString('default', {
            month: 'long',
            year: 'numeric'
        });

        // Get all customers for this month sorted by count
        const customersInMonth = Object.entries(monthlyCustomerData[monthKey])
            .sort((a, b) => b[1] - a[1]);

        const monthTotal = Object.values(monthlyCustomerData[monthKey])
            .reduce((sum, count) => sum + count, 0);

        // Month divider
        if (monthIndex > 0) {
            rows.push(`
                <tr style="height: 12px;">
                    <td colspan="4" style="padding: 0; background-color: #f8fafc;"></td>
                </tr>
            `);
        }

        customersInMonth.forEach(([customer, count], index) => {
            const percentage = ((count / monthTotal) * 100).toFixed(1);

            // Top 3 styling
            const isTop3 = index < 3;
            const rankColors = [
                { bg: '#fef3c7', text: '#92400e', rank: '1st' },
                { bg: '#e0e7ff', text: '#3730a3', rank: '2nd' },
                { bg: '#fed7aa', text: '#9a3412', rank: '3rd' }
            ];

            const rankStyle = isTop3 ? rankColors[index] : null;

            rows.push(`
                <tr class="customer-row" style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 14px 20px;">
                        <strong style="color: #1e293b; font-size: 14px; font-weight: 600;">
                            ${customer}
                        </strong>
                    </td>
                    <td style="padding: 14px 20px;">
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <span style="color: #475569; font-size: 13px; font-weight: 500;">
                                ${formattedMonth}
                            </span>
                            
                        </div>
                    </td>
                    <td class="text-center" style="padding: 14px 20px;">
                        <span style="background-color: #10b981; color: white; padding: 6px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; display: inline-block; min-width: 50px;">
                            ${count}
                        </span>
                    </td>
                    <td class="text-end" style="padding: 14px 20px;">
                        <div style="display: flex; align-items: center; justify-content: flex-end; gap: 8px;">
                            <div style="width: 80px; height: 8px; background-color: #e2e8f0; border-radius: 10px; overflow: hidden;">
                                <div style="width: ${percentage}%; height: 100%; background: linear-gradient(to right, #0891b2, #06b6d4); border-radius: 10px;"></div>
                            </div>
                            <span style="color: #0891b2; font-size: 13px; font-weight: 700; min-width: 50px;">
                                ${percentage}%
                            </span>
                        </div>
                    </td>
                </tr>
            `);
        });
    });

    tbody.innerHTML = rows.join('');
}

function updateBuyerReport(bookings) {
    const tbody = document.getElementById('buyerReportTable');
    if (!tbody) return;

    const monthlyBuyerData = {};
    bookings.forEach(b => {
        const dt = new Date(b.bookingDate);
        const monthKey = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
        if (!monthlyBuyerData[monthKey]) monthlyBuyerData[monthKey] = {};
        const buyerName = b.buyer.trim();
        monthlyBuyerData[monthKey][buyerName] = (monthlyBuyerData[monthKey][buyerName] || 0) + 1;
    });

    if (!Object.keys(monthlyBuyerData).length) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center py-5"><div style="color: #94a3b8;"><i class="fas fa-inbox fa-3x mb-3" style="opacity: 0.3;"></i><p class="mb-0" style="font-size: 15px; font-weight: 500;">No data available</p></div></td></tr>`;
        return;
    }
    // ... existing logic for buyer report ...
    const sortedMonths = Object.keys(monthlyBuyerData).sort((a, b) => b.localeCompare(a));
    let rows = [];

    sortedMonths.forEach((monthKey, monthIndex) => {
        const [year, month] = monthKey.split('-');
        const formattedMonth = new Date(year, month - 1).toLocaleString('default', {
            month: 'long',
            year: 'numeric'
        });

        // Get  3 buyers for this month
        const topBuyers = Object.entries(monthlyBuyerData[monthKey])
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3);

        const monthTotal = Object.values(monthlyBuyerData[monthKey])
            .reduce((sum, count) => sum + count, 0);

        // Month divider
        if (monthIndex > 0) {
            rows.push(`
                <tr style="height: 12px;">
                    <td colspan="4" style="padding: 0; background-color: #f8fafc;"></td>
                </tr>
            `);
        }

        topBuyers.forEach(([buyer, count], index) => {
            const percentage = ((count / monthTotal) * 100).toFixed(1);
            const rankSuffix = ['1st', '2nd', '3rd'][index];
            const rankColors = [
                { bg: '#fef3c7', text: '#92400e' },
                { bg: '#e0e7ff', text: '#3730a3' },
                { bg: '#fed7aa', text: '#9a3412' }
            ];
            const rankStyle = rankColors[index];

            rows.push(`
                <tr class="buyer-row" style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 14px 20px;">
                        <strong style="color: #1e293b; font-size: 14px; font-weight: 600;">
                            ${buyer}
                        </strong>
                    </td>
                    <td style="padding: 14px 20px;">
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <span style="color: #475569; font-size: 13px; font-weight: 500;">
                                ${formattedMonth}
                            </span>
                            <span style="background-color: ${rankStyle.bg}; color: ${rankStyle.text}; padding: 3px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; display: inline-block; width: fit-content;">
                                ${rankSuffix}
                            </span>
                        </div>
                    </td>
                    <td class="text-center" style="padding: 14px 20px;">
                        <span style="background-color: #2563eb; color: white; padding: 6px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; display: inline-block; min-width: 50px;">
                            ${count}
                        </span>
                    </td>
                    <td class="text-end" style="padding: 14px 20px;">
                        <div style="display: flex; align-items: center; justify-content: flex-end; gap: 8px;">
                            <div style="width: 80px; height: 8px; background-color: #e2e8f0; border-radius: 10px; overflow: hidden;">
                                <div style="width: ${percentage}%; height: 100%; background: linear-gradient(to right, #10b981, #059669); border-radius: 10px;"></div>
                            </div>
                            <span style="color: #10b981; font-size: 13px; font-weight: 700; min-width: 50px;">
                                ${percentage}%
                            </span>
                        </div>
                    </td>
                </tr>
            `);
        });
    });

    tbody.innerHTML = rows.join('');
}


function updateMonthlyReport(bookings) {
    const tbody = document.getElementById('monthlyReportTable');
    if (!tbody) return;

    const stats = {};
    bookings.forEach(b => {
        const m = new Date(b.bookingDate).toLocaleString('default', { month: 'long', year: 'numeric' });
        if (!stats[m]) stats[m] = { bookings: 0, customers: new Set(), buyers: new Set() };
        stats[m].bookings++;
        stats[m].customers.add(b.customer);
        stats[m].buyers.add(b.buyer);
    });

    if (!Object.keys(stats).length) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">No data available</td></tr>';
        return;
    }

    tbody.innerHTML = Object.entries(stats)
        .map(([m, s], i) => {
            const growth = i === 0 ? 0 : Math.floor(Math.random() * 30 - 10);
            const color = growth >= 0 ? 'success' : 'danger';
            return `<tr>
                <td><strong>${m}</strong></td>
                <td class="text-center"><span class="badge bg-primary">${s.bookings}</span></td>
                <td class="text-center"><span class="badge bg-warning">${s.customers.size}</span></td>
                <td class="text-center"><span class="badge bg-info">${s.buyers.size}</span></td>
                
            </tr>`;
        }).join('');
}

function updateItemReport(bookings) {
    const tbody = document.getElementById('itemReportTable');
    if (!tbody) return;

    const data = {};
    bookings.forEach(b => {
        if (!data[b.item]) data[b.item] = { count: 0, customers: {} };
        data[b.item].count++;
        data[b.item].customers[b.customer] = (data[b.item].customers[b.customer] || 0) + 1;
    });

    if (!Object.keys(data).length) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-4">No data available</td></tr>';
        return;
    }

    const totalItems = Object.values(data).reduce((sum, it) => sum + it.count, 0);

    tbody.innerHTML = Object.entries(data)
        .sort((a, b) => b[1].count - a[1].count)
        .map(([item, d]) => {
            const topCust = Object.entries(d.customers).sort((a, b) => b[1] - a[1])[0];
            const pop = ((d.count / totalItems) * 100).toFixed(1);
            return `<tr>
                <td><strong>${item}</strong></td>
                <td class="text-center"><span class="badge bg-success">${d.count}</span></td>
                <td>${topCust ? topCust[0] : '-'}</td>
                <td class="text-end">
                    <div class="d-flex align-items-center justify-content-end gap-2">
                        <div class="progress flex-grow-1" style="height:8px; max-width:100px;">
                            <div class="progress-bar bg-warning" style="width:${pop}%"></div>
                        </div>
                        <small class="text-muted">${pop}%</small>
                    </div>
                </td>
            </tr>`;
        }).join('');
}

// --- Event listeners for filter ---
export function setupReportListeners() {
    const monthSelect = document.getElementById('emailMonth');
    const yearSelect = document.getElementById('emailYear');

    if (monthSelect) {
        monthSelect.removeEventListener('change', handleReportFilterChange);
        monthSelect.addEventListener('change', handleReportFilterChange);
    }
    if (yearSelect) {
        yearSelect.removeEventListener('change', handleReportFilterChange);
        yearSelect.addEventListener('change', handleReportFilterChange);
    }
    console.log('✅ Report listeners attached (emailMonth/Year)');
}
window.setupReportListeners = setupReportListeners;

function handleReportFilterChange() {
    updateDashboard(window.bookings || []);
}

function populateYearFilters(years) {
    const filters = ['yearFilter', 'emailYear'];
    filters.forEach(id => {
        const select = document.getElementById(id);
        if (!select) return;

        const currentVal = select.value;
        const exists = Array.from(select.options).some(opt => opt.value !== 'all');
        if (exists && select.options.length === years.length + 1) return; // Already populated

        select.innerHTML = `<option value="all">All Years</option>` +
            years.map(y => `<option value="${y}">${y}</option>`).join("");

        if (currentVal) select.value = currentVal;
    });
}
