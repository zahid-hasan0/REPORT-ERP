// Main application logic

let drafts = [];
let fetchedReports = [];
let currentPage = 1;
const ITEMS_PER_PAGE = 25;

const UI = {
    jobInput: document.getElementById("jobNumbers"),
    addBtn: document.getElementById("addBtn"),
    draftTable: document.getElementById("draftTable"),
    draftCountBadge: document.getElementById("draftCountBadge"),
    submitSelectedBtn: document.getElementById("submitSelected"),
    checkAll: document.getElementById("checkAll"),
    deleteAllBtn: document.getElementById("deleteAllBtn"),
    submissionStatus: document.getElementById("submissionStatus"),
    copyDraftsBtn: document.getElementById("copyDraftsBtn"),
    whatsappSelectedBtn: document.getElementById("whatsappSelectedBtn"),
    whatsappFullBtn: document.getElementById("whatsappFullBtn"),
    dbReportTable: document.getElementById("dbReportTable"),
    dbTotalCount: document.getElementById("dbTotalCount")
};

document.addEventListener("DOMContentLoaded", () => {
    initApp();
});

function initApp() {
    loadDrafts();
    setupEventListeners();
    renderUI();
}

function setupEventListeners() {
    if (UI.addBtn) UI.addBtn.addEventListener("click", handleAddDrafts);
    if (UI.submitSelectedBtn) UI.submitSelectedBtn.addEventListener("click", handleSubmitSelected);
    if (UI.checkAll) UI.checkAll.addEventListener("change", toggleSelectAll);
    if (UI.deleteAllBtn) UI.deleteAllBtn.addEventListener("click", handleDeleteAll);
    if (UI.copyDraftsBtn) UI.copyDraftsBtn.addEventListener("click", handleCopyDrafts);
    if (UI.whatsappSelectedBtn) UI.whatsappSelectedBtn.addEventListener("click", openWhatsappModal);
    if (UI.whatsappFullBtn) UI.whatsappFullBtn.addEventListener("click", openWhatsappFullModal);

    // Modal Action Listeners
    document.getElementById("waFinalSendBtn")?.addEventListener("click", sendWhatsAppMessage);
    document.getElementById("waFullFinalSendBtn")?.addEventListener("click", sendWhatsAppFullReport);

    // Report Page listeners
    document.getElementById("printBtn")?.addEventListener("click", () => window.print());
    document.getElementById("excelBtn")?.addEventListener("click", exportToExcel);
    document.getElementById("copyBtn")?.addEventListener("click", copyDbTableToClipboard);

    if (UI.dbReportTable) {
        loadDatabaseReports();
    }
}

function loadDrafts() {
    try {
        const stored = JSON.parse(localStorage.getItem('jobReports') || '[]');
        drafts = stored.filter(d => d && d.id && d.jobNo);
    } catch (e) {
        console.error("Storage error:", e);
        drafts = [];
    }
}

function saveDrafts() {
    localStorage.setItem('jobReports', JSON.stringify(drafts));
}

function handleAddDrafts() {
    const input = UI.jobInput?.value.trim();
    if (!input) return showToast("Enter job numbers.", "warning");

    const jobs = [...new Set(input.split(/,|\n/).map(j => j.trim()).filter(j => j !== ""))];
    let addedCount = 0;

    jobs.forEach(jobNo => {
        if (!drafts.some(d => d.jobNo === jobNo)) {
            drafts.push({
                id: crypto.randomUUID(),
                jobNo,
                buyer: "",
                wo: "",
                status: "Pending",
                comments: "",
                editable: true,
                selected: false
            });
            addedCount++;
        }
    });

    if (addedCount > 0) {
        UI.jobInput.value = "";
        saveDrafts();
        renderDrafts();
        showToast(`Added ${addedCount} new jobs.`);
    } else {
        showToast("No new jobs added.", "warning");
    }
}

function renderDrafts() {
    if (!UI.draftTable) return;
    UI.draftTable.innerHTML = "";
    if (UI.draftCountBadge) UI.draftCountBadge.textContent = drafts.length;

    drafts.forEach((d, idx) => {
        const tr = document.createElement("tr");
        if (d.selected) tr.classList.add("table-active");

        const isEditable = d.editable !== false;
        tr.innerHTML = `
            <td class="text-center"><input type="checkbox" class="form-check-input" ${d.selected ? 'checked' : ''} onchange="toggleRowSelection('${d.id}')"></td>
            <td class="fw-bold text-muted">${idx + 1}</td>
            <td class="fw-bold text-primary">${d.jobNo}</td>
            <td>${isInput('buyer', d, isEditable)}</td>
            <td>${isInput('wo', d, isEditable)}</td>
            <td>${isStatusSelect(d, isEditable)}</td>
            <td>${isInput('comments', d, isEditable)}</td>
            <td class="text-end">
                <div class="row-actions">
                    <button class="btn-gms-row btn-gms-row-${isEditable ? 'save' : 'edit'}" onclick="${isEditable ? 'saveRow' : 'editRow'}('${d.id}')">
                        ${isEditable ? 'Save' : 'Edit'}
                    </button>
                    <button class="btn-gms-row btn-gms-row-delete" onclick="deleteRow('${d.id}')">Delete</button>
                </div>
            </td>
        `;
        UI.draftTable.appendChild(tr);
    });

    updateGlobalControls();
}

const isInput = (field, d, editable) => editable
    ? `<input type="text" class="form-control" value="${d[field] || ''}" onchange="updateDraftField('${d.id}', '${field}', this.value)" placeholder="${field.toUpperCase()}">`
    : `<span>${d[field] || '-'}</span>`;

const isStatusSelect = (d, editable) => editable
    ? `<select class="form-select" onchange="updateDraftField('${d.id}', 'status', this.value)">
        <option value="Pending" ${d.status === 'Pending' ? 'selected' : ''}>Pending</option>
        <option value="Approved" ${d.status === 'Approved' ? 'selected' : ''}>Approved</option>
        <option value="Rejected" ${d.status === 'Rejected' ? 'selected' : ''}>Rejected</option>
       </select>`
    : `<span class="badge ${getStatusBadge(d.status)}">${d.status}</span>`;

window.toggleRowSelection = (id) => {
    const draft = drafts.find(d => d.id === id);
    if (draft) {
        draft.selected = !draft.selected;
        saveDrafts();
        renderDrafts();
    }
};

window.updateDraftField = (id, field, value) => {
    const draft = drafts.find(d => d.id === id);
    if (draft) draft[field] = value.trim();
    saveDrafts();
};

window.saveRow = (id) => {
    const draft = drafts.find(d => d.id === id);
    if (draft) {
        draft.editable = false;
        saveDrafts();
        renderDrafts();
        showToast("Saved locally.");
    }
};

window.editRow = (id) => {
    const draft = drafts.find(d => d.id === id);
    if (draft) {
        draft.editable = true;
        renderDrafts();
    }
};

window.deleteRow = (id) => {
    showConfirm("Delete this draft?", () => {
        drafts = drafts.filter(d => d.id !== id);
        saveDrafts();
        renderDrafts();
        showToast("Deleted.", "danger");
    });
};

function toggleSelectAll() {
    const checked = UI.checkAll.checked;
    drafts.forEach(d => d.selected = checked);
    saveDrafts();
    renderDrafts();
}

function handleDeleteAll() {
    if (drafts.length === 0) return;
    showConfirm("Clear all drafts?", () => {
        drafts = [];
        saveDrafts();
        renderDrafts();
        showToast("All drafts cleared.", "danger");
    });
}

function updateGlobalControls() {
    const selected = drafts.filter(d => d.selected).length;
    if (UI.submitSelectedBtn) {
        UI.submitSelectedBtn.disabled = selected === 0;
        UI.submitSelectedBtn.innerHTML = `<i class="fas fa-cloud-upload-alt me-2"></i>Submit Selected ${selected > 0 ? `(${selected})` : ''}`;
    }
    if (UI.checkAll) {
        UI.checkAll.checked = drafts.length > 0 && drafts.every(d => d.selected);
        UI.checkAll.indeterminate = selected > 0 && selected < drafts.length;
    }
}

async function handleSubmitSelected() {
    const selectedDrafts = drafts.filter(d => d.selected);
    if (selectedDrafts.length === 0) return;

    if (selectedDrafts.some(d => !d.buyer || !d.wo)) {
        return showToast("Buyer and WO are required.", "warning");
    }

    showConfirm(`Submit ${selectedDrafts.length} jobs to database?`, async () => {
        try {
            UI.submitSelectedBtn.disabled = true;
            if (UI.submissionStatus) UI.submissionStatus.textContent = "Processing...";

            await API.submitJobs(selectedDrafts);

            drafts = drafts.filter(d => !d.selected);
            saveDrafts();
            renderDrafts();
            showToast("Successfully submitted!");
        } catch (err) {
            console.error(err);
            showToast("Failed to submit.", "danger");
        } finally {
            UI.submitSelectedBtn.disabled = false;
            if (UI.submissionStatus) UI.submissionStatus.textContent = "";
        }
    });
}

// --- Database View (report.html) ---
window.loadDatabaseReports = loadDatabaseReports;
async function loadDatabaseReports() {
    if (!UI.dbReportTable) return;
    UI.dbReportTable.innerHTML = '<tr><td colspan="8" class="text-center py-4">Loading reports...</td></tr>';

    try {
        fetchedReports = await API.fetchReports();
        currentPage = 1;
        renderRecords();
        updateStats();
    } catch (err) {
        console.error(err);
        UI.dbReportTable.innerHTML = '<tr><td colspan="8" class="text-center text-danger">Error loading data.</td></tr>';
    }
}

function renderRecords() {
    if (!UI.dbReportTable) return;

    const search = document.getElementById("searchInput")?.value.toLowerCase() || "";
    const filtered = fetchedReports.filter(r =>
        (r.jobNo || "").toLowerCase().includes(search) ||
        (r.buyer || "").toLowerCase().includes(search) ||
        (r.wo || "").toLowerCase().includes(search)
    );

    const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
    if (currentPage > totalPages) currentPage = Math.max(1, totalPages);

    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const pageData = filtered.slice(start, start + ITEMS_PER_PAGE);

    UI.dbReportTable.innerHTML = "";
    if (pageData.length === 0) {
        UI.dbReportTable.innerHTML = '<tr><td colspan="8" class="text-center py-3 text-muted">No records found.</td></tr>';
    }

    pageData.forEach((r, idx) => {
        const tr = document.createElement("tr");
        const date = r.submittedAt ? new Date(r.submittedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
        const isEditable = r.editable === true;

        tr.innerHTML = `
            <td>${start + idx + 1}</td>
            <td class="fw-bold text-primary">${r.jobNo}</td>
            <td>${isDbInput('buyer', r, isEditable)}</td>
            <td>${isDbInput('wo', r, isEditable)}</td>
            <td>${isDbStatusSelect(r, isEditable)}</td>
            <td class="small text-muted">${isDbInput('comments', r, isEditable)}</td>
            <td class="small text-secondary">${date}</td>
            <td class="text-end">
                <div class="row-actions">
                    <button class="btn-gms-row btn-gms-row-${isEditable ? 'save' : 'edit'}" onclick="${isEditable ? 'saveDbRow' : 'editDbRow'}('${r.id}')">
                        ${isEditable ? 'Save' : 'Edit'}
                    </button>
                    <button class="btn-gms-row btn-gms-row-delete" onclick="deleteDbRow('${r.id}')">Delete</button>
                </div>
            </td>
        `;
        UI.dbReportTable.appendChild(tr);
    });

    renderPagination(filtered.length, totalPages);
}

const isDbInput = (field, r, editable) => editable
    ? `<input type="text" class="form-control" value="${r[field] || ''}" data-field="${field}">`
    : `<span>${r[field] || '-'}</span>`;

const isDbStatusSelect = (r, editable) => editable
    ? `<select class="form-select" data-field="status">
        <option value="Pending" ${r.status === 'Pending' ? 'selected' : ''}>Pending</option>
        <option value="Approved" ${r.status === 'Approved' ? 'selected' : ''}>Approved</option>
        <option value="Rejected" ${r.status === 'Rejected' ? 'selected' : ''}>Rejected</option>
       </select>`
    : `<span class="badge ${getStatusBadge(r.status)}">${r.status}</span>`;

function renderPagination(total, totalPages) {
    if (!UI.dbTotalCount) return;
    if (total === 0) {
        UI.dbTotalCount.innerHTML = "No entries.";
        return;
    }

    UI.dbTotalCount.innerHTML = `
        <div class="d-flex justify-content-between align-items-center w-100">
            <div>Showing ${total} entries</div>
            <nav>
                <ul class="pagination pagination-sm mb-0">
                    <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
                        <button class="page-link" onclick="changePage(${currentPage - 1})">Prev</button>
                    </li>
                    <li class="page-item disabled"><span class="page-link">Page ${currentPage} of ${totalPages}</span></li>
                    <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
                        <button class="page-link" onclick="changePage(${currentPage + 1})">Next</button>
                    </li>
                </ul>
            </nav>
        </div>
    `;
}

window.changePage = (p) => { currentPage = p; renderRecords(); };
window.filterTable = () => { currentPage = 1; renderRecords(); };
window.clearSearch = () => {
    const input = document.getElementById("searchInput");
    if (input) input.value = "";
    filterTable();
};

window.editDbRow = (id) => {
    const report = fetchedReports.find(r => r.id === id);
    if (report) { report.editable = true; renderRecords(); }
};

window.saveDbRow = async (id) => {
    const report = fetchedReports.find(r => r.id === id);
    if (!report) return;

    const row = document.querySelector(`button[onclick="saveDbRow('${id}')"]`).closest("tr");
    const updates = {};
    row.querySelectorAll("[data-field]").forEach(el => updates[el.dataset.field] = el.value.trim());

    try {
        await API.updateReport(id, updates);
        Object.assign(report, updates);
        report.editable = false;
        renderRecords();
        updateStats();
        showToast("Updated.");
    } catch (err) {
        showToast("Update failed.", "danger");
    }
};

window.deleteDbRow = (id) => {
    showConfirm("Permanently delete this record?", async () => {
        try {
            await API.deleteReport(id);
            fetchedReports = fetchedReports.filter(r => r.id !== id);
            renderRecords();
            updateStats();
            showToast("Record deleted.", "danger");
        } catch (err) {
            showToast("Failed to delete.", "danger");
        }
    });
};

function updateStats() {
    const counts = { total: fetchedReports.length, pending: 0, approved: 0, rejected: 0 };
    fetchedReports.forEach(r => {
        if (r.status === "Pending") counts.pending++;
        else if (r.status === "Approved") counts.approved++;
        else if (r.status === "Rejected") counts.rejected++;
    });

    if (document.getElementById("totalJobs")) document.getElementById("totalJobs").textContent = counts.total;
    if (document.getElementById("pendingJobs")) document.getElementById("pendingJobs").textContent = counts.pending;
    if (document.getElementById("approvedJobs")) document.getElementById("approvedJobs").textContent = counts.approved;
    if (document.getElementById("rejectedJobs")) document.getElementById("rejectedJobs").textContent = counts.rejected;
}

function openWhatsappModal() {
    const selected = drafts.filter(d => d.selected);
    if (selected.length === 0) return showToast("Select jobs first.", "warning");

    const list = document.getElementById("waContactList");
    if (list) {
        list.innerHTML = WAS_CONTACTS.map((c, i) => `
            <label class="list-group-item d-flex align-items-center gap-3 py-3 border-0 rounded mb-2 bg-light bg-opacity-50" style="cursor: pointer;">
                <input class="form-check-input flex-shrink-0" type="radio" name="waContact" value="${c.number}" ${i === 0 ? 'checked' : ''}>
                <div class="d-flex align-items-center gap-3">
                    <div class="bg-success bg-opacity-10 text-success p-2 rounded-circle"><i class="fas fa-user"></i></div>
                    <div class="fw-bold">${c.name}</div>
                </div>
            </label>
        `).join("");
    }

    new bootstrap.Modal(document.getElementById('whatsappModal')).show();
}

function sendWhatsAppMessage() {
    const selected = drafts.filter(d => d.selected);
    const radio = document.querySelector('input[name="waContact"]:checked');
    if (!radio) return showToast("Select a contact.", "warning");

    const number = formatWhatsAppNumber(radio.value);
    const text = getMessageText(selected, true, true);
    window.open(`https://api.whatsapp.com/send?phone=${number}&text=${encodeURIComponent(text)}`, '_blank');
    bootstrap.Modal.getInstance(document.getElementById('whatsappModal')).hide();
}

function openWhatsappFullModal() {
    const selected = drafts.filter(d => d.selected);
    if (selected.length === 0) return showToast("Select jobs first.", "warning");

    const list = document.getElementById("waFullContactList");
    if (list) {
        list.innerHTML = FULL_REPORT_CONTACTS.map((c, i) => `
            <label class="list-group-item d-flex align-items-center gap-3 py-3 border-0 rounded mb-2 bg-light bg-opacity-50" style="cursor: pointer;">
                <input class="form-check-input flex-shrink-0" type="radio" name="waFullContact" value="${c.number}" ${i === 0 ? 'checked' : ''}>
                <div class="d-flex align-items-center gap-3">
                    <div class="bg-success bg-opacity-10 text-success p-2 rounded-circle"><i class="fas fa-user-check"></i></div>
                    <div class="fw-bold">${c.name}</div>
                </div>
            </div>
        </label>
        `).join("");
    }

    new bootstrap.Modal(document.getElementById('whatsappFullModal')).show();
}

function sendWhatsAppFullReport() {
    const radio = document.querySelector('input[name="waFullContact"]:checked');
    if (!radio) return showToast("Select a contact.", "warning");

    const number = formatWhatsAppNumber(radio.value);
    const selected = drafts.filter(d => d.selected);
    const text = getMessageText(selected, true, false);
    window.open(`https://api.whatsapp.com/send?phone=${number}&text=${encodeURIComponent(text)}`, '_blank');
    bootstrap.Modal.getInstance(document.getElementById('whatsappFullModal')).hide();
}

function getMessageText(selected, includeStatus, includeSuffix) {
    if (!includeSuffix) {
        let text = `EMB STATUS REPORT (${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })})\n━━━━━━━━━━━━━━━━━━━━━━\n`;
        selected.forEach(d => {
            text += `JOB: ${d.jobNo} ━━ ${d.buyer || '-'} ━━ ${d.wo || '-'} ━━ ${(d.status || 'PENDING').toUpperCase()}${d.comments ? ` ━━ ${d.comments}` : ''}\n`;
        });
        return text.trim();
    }

    let text = "Dear Brother Need Some Emblishment Wo\n";
    selected.forEach(d => {
        let row = `${d.jobNo}`;
        if (d.buyer) row += `   ${d.buyer}`;
        if (d.wo) row += `   ${d.wo}`;
        if (includeStatus && d.status && d.status !== 'Pending') row += `   ${d.status}`;
        if (d.comments) row += `   ${d.comments}`;
        text += row + "\n";
    });
    return text.trim();
}

function handleCopyDrafts() {
    const selected = drafts.filter(d => d.selected);
    if (selected.length === 0) return showToast("Select rows to copy.", "warning");

    const text = getMessageText(selected, true, true);
    navigator.clipboard.writeText(text)
        .then(() => showToast(`Copied ${selected.length} jobs!`))
        .catch(() => showToast("Copy failed.", "danger"));
}

function copyDbTableToClipboard() {
    if (fetchedReports.length === 0) return showToast("No data.", "warning");
    let text = "Job No\tBuyer\tWO\tStatus\tComments\n";
    fetchedReports.forEach(r => text += `${r.jobNo}\t${r.buyer}\t${r.wo}\t${r.status}\t${r.comments}\n`);
    navigator.clipboard.writeText(text).then(() => showToast("Table copied!"));
}

function exportToExcel() {
    if (fetchedReports.length === 0) return showToast("No data.", "warning");
    const data = [["Job No", "Buyer", "WO", "Status", "Comments", "Submitted At"]];
    fetchedReports.forEach(r => data.push([r.jobNo, r.buyer, r.wo, r.status, r.comments, r.submittedAt]));
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reports");
    XLSX.writeFile(wb, "Emblishment Job Report.xlsx");
}

function renderUI() {
    renderDrafts();
}