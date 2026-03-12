import { db_emb as db, getModulePath } from './storage.js';
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, orderBy, writeBatch, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { showToast } from './toast.js';

let drafts = [];
let fetchedReports = [];
let modalContext = []; // stores records to be sent via currently open modal
let currentPage = 1;
const ITEMS_PER_PAGE = 25;

// Scoped UI mapping
function getUI() {
    const container = document.getElementById('emb-report-module');
    if (!container) return {};
    return {
        jobInput: container.querySelector("#jobNumbers"),
        addBtn: container.querySelector("#addBtn"),
        draftTable: container.querySelector("#draftTable"),
        draftCountBadge: container.querySelector("#draftCountBadge"),
        submitSelectedBtn: container.querySelector("#submitSelected"),
        checkAll: container.querySelector("#checkAll"),
        deleteAllBtn: container.querySelector("#deleteAllBtn"),
        submissionStatus: container.querySelector("#submissionStatus"),
        copyDraftsBtn: container.querySelector("#copyDraftsBtn"),
        whatsappSelectedBtn: container.querySelector("#whatsappSelectedBtn"),
        whatsappFullBtn: container.querySelector("#whatsappFullBtn"),
        dbReportTable: container.querySelector("#dbReportTable"),
        dbPagination: container.querySelector("#dbPagination"),
        pageSizeSelect: container.querySelector("#pageSizeSelect"),
        // Stats
        statTotal: container.querySelector("#stat-total-reports"),
        statPending: container.querySelector("#stat-pending-jobs"),
        statApproved: container.querySelector("#stat-approved-jobs"),
        statRejected: container.querySelector("#stat-rejected-jobs")
    };
}

export async function initEmbEntry() {
    console.log("✍️ Initializing Emb Entry...");
    loadDrafts();
    setupEventListeners();
    renderDrafts();
}

export async function initEmbReportView() {
    console.log("📊 Initializing Emb Report View...");
    setupEventListeners();
    const ui = getUI();
    if (ui.dbReportTable) {
        await loadDatabaseReports();
    }
}

function setupEventListeners() {
    const ui = getUI();
    if (ui.addBtn) {
        console.log("✅ Attach 'Add Draft' listener");
        ui.addBtn.onclick = handleAddDrafts;
    } else {
        console.error("❌ 'Add Draft' button not found in UI");
    }

    if (ui.submitSelectedBtn) ui.submitSelectedBtn.onclick = handleSubmitSelected;
    if (ui.checkAll) ui.checkAll.onchange = toggleSelectAll;
    if (ui.deleteAllBtn) ui.deleteAllBtn.onclick = handleDeleteAll;
    if (ui.copyDraftsBtn) ui.copyDraftsBtn.onclick = handleCopyDrafts;
    if (ui.whatsappSelectedBtn) ui.whatsappSelectedBtn.onclick = openWhatsappModal;
    if (ui.whatsappFullBtn) ui.whatsappFullBtn.onclick = openWhatsappFullModal;
    if (ui.pageSizeSelect) {
        ui.pageSizeSelect.onchange = (e) => {
            currentPage = 1;
            renderRecords();
        };
    }

    // Attach to window for the dynamic HTML buttons
    window.toggleRowSelection = toggleRowSelection;
    window.updateDraftField = updateDraftField;
    window.saveRow = saveRow;
    window.editRow = editRow;
    window.deleteRow = deleteRow;

    window.editDbRow = editDbRow;
    window.saveDbRow = saveDbRow;
    window.deleteDbRow = deleteDbRow;
    window.changePage = changePage;
    window.filterTable = filterTable;
    window.clearSearchEmb = clearSearchEmb;
    window.openWhatsappModal = openWhatsappModal;
    window.openWhatsappFullModal = openWhatsappFullModal;
    window.toggleDbRowSelection = toggleDbRowSelection;

    // Global WhatsApp modal listeners (these usually exist in index.html or we reuse them)
    const waFinalBtn = document.getElementById("waFinalSendBtn");
    if (waFinalBtn) waFinalBtn.onclick = sendWhatsAppMessage;

    const waFullFinalBtn = document.getElementById("waFullFinalSendBtn");
    if (waFullFinalBtn) waFullFinalBtn.onclick = sendWhatsAppFullReport;
}

function loadDrafts() {
    try {
        const stored = JSON.parse(localStorage.getItem('jobReports_v2') || '[]');
        drafts = stored.filter(d => d && d.id && d.jobNo);
        window.drafts = drafts; // Expose to window
    } catch (e) {
        drafts = [];
        window.drafts = [];
    }
}

function saveDrafts() {
    localStorage.setItem('jobReports_v2', JSON.stringify(drafts));
    window.drafts = drafts; // Keep window ref in sync
}

function handleAddDrafts() {
    console.log("👉 handleAddDrafts triggered");
    const ui = getUI();
    const input = ui.jobInput?.value.trim();
    console.log("Input value:", input);

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
        ui.jobInput.value = "";
        saveDrafts();
        window.drafts = drafts; // Expose to window for row-level buttons
        renderDrafts();
        showToast(`Added ${addedCount} new jobs.`);
    }
}

function renderDrafts() {
    const ui = getUI();
    if (!ui.draftTable) return;
    ui.draftTable.innerHTML = "";
    if (ui.draftCountBadge) ui.draftCountBadge.textContent = drafts.length;

    // Ensure we have a datalist for buyers
    let buyerList = document.getElementById('sharedBuyerList');
    if (!buyerList) {
        buyerList = document.createElement('datalist');
        buyerList.id = 'sharedBuyerList';
        document.body.appendChild(buyerList);
    }
    const buyerOptions = (window.buyers || []).map(b => `<option value="${b.name}">`).join('');
    buyerList.innerHTML = buyerOptions;

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
                    <button class="btn btn-sm btn-outline-success border-0 px-2" title="WhatsApp Message" onclick="openWhatsappModal(drafts.find(d => d.id === '${d.id}'))">
                        <i class="fab fa-whatsapp"></i>
                    </button>
                    <button class="btn btn-sm ${isEditable ? 'btn-success' : 'btn-primary'} btn-gms-row" onclick="${isEditable ? 'saveRow' : 'editRow'}('${d.id}')">
                        ${isEditable ? 'Save' : 'Edit'}
                    </button>
                    <button class="btn btn-sm btn-danger btn-gms-row" onclick="deleteRow('${d.id}')">Delete</button>
                </div>
            </td>
        `;
        ui.draftTable.appendChild(tr);
    });

    updateGlobalControls();
}

const isInput = (field, d, editable) => {
    if (!editable) return `<span>${d[field] || '-'}</span>`;

    const listAttr = field === 'buyer' ? 'list="sharedBuyerList"' : '';
    return `<input type="text" class="form-control form-control-sm" value="${d[field] || ''}" 
            ${listAttr} onchange="updateDraftField('${d.id}', '${field}', this.value)" placeholder="${field.toUpperCase()}">`;
};

const isStatusSelect = (d, editable) => editable
    ? `<select class="form-select form-select-sm" onchange="updateDraftField('${d.id}', 'status', this.value)">
        <option value="Pending" ${d.status === 'Pending' ? 'selected' : ''}>Pending</option>
        <option value="Approved" ${d.status === 'Approved' ? 'selected' : ''}>Approved</option>
        <option value="Rejected" ${d.status === 'Rejected' ? 'selected' : ''}>Rejected</option>
       </select>`
    : `<span class="badge ${getStatusBadge(d.status)}">${d.status}</span>`;

function getStatusBadge(status) {
    if (status === 'Approved') return 'bg-success';
    if (status === 'Rejected') return 'bg-danger';
    return 'bg-warning text-dark';
}

export function toggleRowSelection(id) {
    const draft = drafts.find(d => d.id === id);
    if (draft) {
        draft.selected = !draft.selected;
        saveDrafts();
        renderDrafts();
    }
}

export function toggleDbRowSelection(id) {
    const report = fetchedReports.find(r => r.id === id);
    if (report) {
        report.selected = !report.selected;
        renderRecords();
    }
}

export function updateDraftField(id, field, value) {
    const draft = drafts.find(d => d.id === id);
    if (draft) draft[field] = value.trim();
    saveDrafts();
}

export function saveRow(id) {
    const draft = drafts.find(d => d.id === id);
    if (draft) {
        draft.editable = false;
        saveDrafts();
        renderDrafts();
        showToast("Saved locally.");
    }
}

export function editRow(id) {
    const draft = drafts.find(d => d.id === id);
    if (draft) {
        draft.editable = true;
        renderDrafts();
    }
}

export async function deleteRow(id) {
    if (await window.showConfirm("Delete this draft?")) {
        drafts = drafts.filter(d => d.id !== id);
        saveDrafts();
        renderDrafts();
        showToast("Deleted.", "danger");
    }
}

function toggleSelectAll() {
    const ui = getUI();
    const checked = ui.checkAll.checked;
    drafts.forEach(d => d.selected = checked);
    saveDrafts();
    renderDrafts();
}

async function handleDeleteAll() {
    if (drafts.length === 0) return;
    if (await window.showConfirm("Clear all drafts?")) {
        drafts = [];
        saveDrafts();
        renderDrafts();
        showToast("All drafts cleared.", "danger");
    }
}

function updateGlobalControls() {
    const ui = getUI();
    const selected = drafts.filter(d => d.selected).length;
    if (ui.submitSelectedBtn) {
        ui.submitSelectedBtn.disabled = selected === 0;
        ui.submitSelectedBtn.innerHTML = `<i class="fas fa-cloud-upload-alt me-2"></i>Submit ${selected > 0 ? `(${selected})` : ''} Jobs`;
    }
    if (ui.checkAll) {
        ui.checkAll.checked = drafts.length > 0 && drafts.every(d => d.selected);
        ui.checkAll.indeterminate = selected > 0 && selected < drafts.length;
    }
}

async function handleSubmitSelected() {
    const selectedDrafts = drafts.filter(d => d.selected);
    if (selectedDrafts.length === 0) return;

    if (selectedDrafts.some(d => !d.buyer || !d.wo)) {
        return showToast("Buyer and WO are required.", "warning");
    }

    if (!await window.showConfirm(`Submit ${selectedDrafts.length} jobs to database?`)) return;

    try {
        const ui = getUI();
        ui.submitSelectedBtn.disabled = true;
        if (ui.submissionStatus) ui.submissionStatus.textContent = "Processing...";

        const path = getModulePath('emb_reports');
        const batch = writeBatch(db);

        selectedDrafts.forEach(job => {
            const { id, editable, selected, ...data } = job;
            data.submittedAt = new Date().toISOString();
            const docRef = doc(collection(db, path));
            batch.set(docRef, data);
        });

        await batch.commit();

        drafts = drafts.filter(d => !d.selected);
        saveDrafts();
        renderDrafts();
        showToast("Successfully submitted!");

        await loadDatabaseReports(); // Refresh DB view if visible
    } catch (err) {
        console.error(err);
        showToast("Failed to submit.", "danger");
    } finally {
        const ui = getUI();
        ui.submitSelectedBtn.disabled = false;
        if (ui.submissionStatus) ui.submissionStatus.textContent = "";
    }
}

// --- Database Section ---
async function loadDatabaseReports() {
    const ui = getUI();
    if (!ui.dbReportTable) return;
    ui.dbReportTable.innerHTML = '<tr><td colspan="8" class="text-center py-4"><i class="fas fa-spinner fa-spin me-2"></i>Loading...</td></tr>';

    try {
        const path = getModulePath('emb_reports');
        const q = query(collection(db, path), orderBy("submittedAt", "desc"));
        const snapshot = await getDocs(q);
        fetchedReports = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        window.fetchedReports = fetchedReports; // Expose to window for row-level buttons

        currentPage = 1;
        renderStats();
        renderRecords();
    } catch (err) {
        console.error("EMB Data Fetch Error:", err);
        ui.dbReportTable.innerHTML = `<tr><td colspan="8" class="text-center text-danger">Error loading data: ${err.message}</td></tr>`;
    }
}

function renderStats() {
    const ui = getUI();
    if (!ui.statTotal) return;

    const total = fetchedReports.length;
    const pending = fetchedReports.filter(r => r.status === 'Pending').length;
    const approved = fetchedReports.filter(r => r.status === 'Approved').length;
    const rejected = fetchedReports.filter(r => r.status === 'Rejected').length;

    ui.statTotal.textContent = total;
    ui.statPending.textContent = pending;
    ui.statApproved.textContent = approved;
    ui.statRejected.textContent = rejected;
}

function renderRecords() {
    const ui = getUI();
    if (!ui.dbReportTable) return;

    const container = document.getElementById('emb-report-module');
    const search = container.querySelector("#searchInput")?.value.toLowerCase() || "";
    const filtered = fetchedReports.filter(r =>
        (r.jobNo || "").toLowerCase().includes(search) ||
        (r.buyer || "").toLowerCase().includes(search) ||
        (r.wo || "").toLowerCase().includes(search)
    );

    const PAGE_SIZE = ui.pageSizeSelect ? parseInt(ui.pageSizeSelect.value) : ITEMS_PER_PAGE;
    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    if (currentPage > totalPages) currentPage = Math.max(1, totalPages);

    const start = (currentPage - 1) * PAGE_SIZE;
    const pageData = filtered.slice(start, start + PAGE_SIZE);

    ui.dbReportTable.innerHTML = "";
    if (pageData.length === 0) {
        ui.dbReportTable.innerHTML = '<tr><td colspan="8" class="text-center py-3 text-muted">No records found.</td></tr>';
    }

    pageData.forEach((r, idx) => {
        const tr = document.createElement("tr");
        if (r.selected) tr.classList.add("table-active");
        const date = r.submittedAt ? new Date(r.submittedAt).toLocaleDateString('en-GB') : '-';
        const isEditable = r.editable === true;

        tr.innerHTML = `
            <td class="text-center"><input type="checkbox" class="form-check-input" ${r.selected ? 'checked' : ''} onclick="toggleDbRowSelection('${r.id}')"></td>
            <td>${start + idx + 1}</td>
            <td class="fw-bold text-primary">${r.jobNo}</td>
            <td>${isDbInput('buyer', r, isEditable)}</td>
            <td>${isDbInput('wo', r, isEditable)}</td>
            <td>${isDbStatusSelect(r, isEditable)}</td>
            <td class="small text-muted">${isDbInput('comments', r, isEditable)}</td>
            <td class="small text-secondary">${date}</td>
            <td class="text-end">
                <div class="row-actions">
                    <button class="btn btn-sm btn-outline-success border-0 px-2" title="WhatsApp Message" onclick="openWhatsappModal(fetchedReports.find(r => r.id === '${r.id}'))">
                        <i class="fab fa-whatsapp"></i>
                    </button>
                    <button class="btn btn-sm ${isEditable ? 'btn-success' : 'btn-outline-primary'} btn-gms-row" onclick="${isEditable ? 'saveDbRow' : 'editDbRow'}('${r.id}')">
                        ${isEditable ? 'Save' : 'Edit'}
                    </button>
                    <button class="btn btn-sm btn-outline-danger btn-gms-row" onclick="deleteDbRow('${r.id}')">Delete</button>
                </div>
            </td>
        `;
        ui.dbReportTable.appendChild(tr);
    });

    renderPagination(filtered.length, totalPages);
}

const isDbInput = (field, r, editable) => {
    if (!editable) return `<span>${r[field] || '-'}</span>`;

    const listAttr = field === 'buyer' ? 'list="sharedBuyerList"' : '';
    return `<input type="text" class="form-control form-control-sm" value="${r[field] || ''}" 
            ${listAttr} data-field="${field}">`;
};

const isDbStatusSelect = (r, editable) => editable
    ? `<select class="form-select form-select-sm" data-field="status">
        <option value="Pending" ${r.status === 'Pending' ? 'selected' : ''}>Pending</option>
        <option value="Approved" ${r.status === 'Approved' ? 'selected' : ''}>Approved</option>
        <option value="Rejected" ${r.status === 'Rejected' ? 'selected' : ''}>Rejected</option>
       </select>`
    : `<span class="badge ${getStatusBadge(r.status)}">${r.status}</span>`;

function renderPagination(total, totalPages) {
    const ui = getUI();
    if (!ui.dbPagination) return;
    if (total === 0) {
        ui.dbPagination.innerHTML = '<span class="text-muted small">No entries found.</span>';
        return;
    }

    ui.dbPagination.innerHTML = `
        <div class="text-muted small fw-bold">
            Showing ${Math.min(total, (currentPage - 1) * (ui.pageSizeSelect ? parseInt(ui.pageSizeSelect.value) : ITEMS_PER_PAGE) + 1)} 
            to ${Math.min(total, currentPage * (ui.pageSizeSelect ? parseInt(ui.pageSizeSelect.value) : ITEMS_PER_PAGE))} 
            of ${total} entries
        </div>
        <nav>
            <ul class="pagination pagination-sm mb-0">
                <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
                    <button class="page-link shadow-none border-0 bg-transparent text-primary fw-bold" onclick="changePage(${currentPage - 1})">
                        <i class="fas fa-chevron-left"></i>
                    </button>
                </li>
                <li class="page-item disabled">
                    <span class="page-link border-0 bg-transparent text-dark fw-bold">Page ${currentPage} of ${totalPages}</span>
                </li>
                <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
                    <button class="page-link shadow-none border-0 bg-transparent text-primary fw-bold" onclick="changePage(${currentPage + 1})">
                        <i class="fas fa-chevron-right"></i>
                    </button>
                </li>
            </ul>
        </nav>
    `;
}

export function changePage(p) { currentPage = p; renderRecords(); }
export function filterTable() { currentPage = 1; renderRecords(); }
export function clearSearchEmb() {
    const container = document.getElementById('emb-report-module');
    const input = container.querySelector("#searchInput");
    if (input) input.value = "";
    filterTable();
}

export function editDbRow(id) {
    const report = fetchedReports.find(r => r.id === id);
    if (report) { report.editable = true; renderRecords(); }
}

export async function saveDbRow(id) {
    const report = fetchedReports.find(r => r.id === id);
    if (!report) return;

    const row = document.querySelector(`button[onclick="saveDbRow('${id}')"]`).closest("tr");
    const updates = {};
    row.querySelectorAll("[data-field]").forEach(el => updates[el.dataset.field] = el.value.trim());

    try {
        const path = getModulePath('emb_reports');
        await updateDoc(doc(db, path, id), updates);
        Object.assign(report, updates);
        report.editable = false;
        renderRecords();
        showToast("Updated.");
    } catch (err) {
        showToast("Update failed.", "danger");
    }
}

export async function deleteDbRow(id) {
    if (!await window.showConfirm("Permanently delete this record?")) return;
    try {
        const path = getModulePath('emb_reports');
        deleteDoc(doc(db, path, id));
        fetchedReports = fetchedReports.filter(r => r.id !== id);
        renderRecords();
        showToast("Record deleted.", "danger");
    } catch (err) {
        showToast("Failed to delete.", "danger");
    }
}

// --- WhatsApp Integration ---
let WAS_CONTACTS = [];
let FULL_REPORT_CONTACTS = [];

async function loadWhatsAppContacts() {
    try {
        const { getSystemSettings } = await import('./systemSettings.js');
        const settings = await getSystemSettings();
        WAS_CONTACTS = settings.whatsapp?.individual || [];
        FULL_REPORT_CONTACTS = settings.whatsapp?.full_report || [];
    } catch (e) {
        console.error("Failed to load WhatsApp contacts:", e);
    }
}

async function openWhatsappModal(singleRecord = null) {
    const isReportPage = !!document.getElementById('stat-total-reports');

    // Fix: If called from an onclick listener directly, singleRecord might be the Event object.
    // We only treat it as a single record if it has a jobNo property.
    const isActualRecord = singleRecord && typeof singleRecord === 'object' && 'jobNo' in singleRecord;

    if (isActualRecord) {
        modalContext = [singleRecord];
    } else {
        // Bulk selection: Use drafts or reports based on current page
        modalContext = isReportPage ? fetchedReports.filter(r => r.selected) : drafts.filter(d => d.selected);
    }

    if (modalContext.length === 0) return showToast("Select or click a job first.", "warning");

    await loadWhatsAppContacts();

    const list = document.getElementById("waContactList");
    if (list) {
        list.innerHTML = WAS_CONTACTS.map((c, i) => `
            <label class="list-group-item d-flex align-items-center gap-3 py-3 border-0 rounded mb-2 bg-light bg-opacity-50" style="cursor: pointer;">
                <input class="form-check-input flex-shrink-0" type="radio" name="waContact" value="${c.number}" ${i === 0 ? 'checked' : ''}>
                <div class="flex-grow-1">
                    <div class="fw-bold text-dark">${c.name}</div>
                    <div class="small text-muted">${c.number}</div>
                </div>
                <i class="fab fa-whatsapp text-success fs-4"></i>
            </label>
        `).join('');
    }

    new bootstrap.Modal(document.getElementById('whatsappModal')).show();
}

async function sendWhatsAppMessage() {
    console.log("📨 Preparing to send individual WhatsApp message...");
    if (modalContext.length === 0) return showToast("No records selected.", "warning");

    const radio = document.querySelector('input[name="waContact"]:checked');
    if (!radio) return showToast("Select a contact.", "warning");

    const number = radio.value;
    const text = await getMessageText(modalContext, true);
    console.log("Final Message Text:", text);

    // Using wa.me for better mobile support
    const url = `https://wa.me/88${number}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
    bootstrap.Modal.getInstance(document.getElementById('whatsappModal')).hide();
}

async function openWhatsappFullModal() {
    const isReportPage = !!document.getElementById('stat-total-reports');
    let records = isReportPage ? fetchedReports : drafts.filter(d => d.selected);

    // USER REQUIREMENT: Full report should include jobs with WO or non-pending status
    modalContext = records.filter(r => {
        const hasWO = r.wo && r.wo.trim() !== "" && r.wo !== "-";
        const isNotPending = (r.status || "Pending").toLowerCase() !== "pending";
        return hasWO || isNotPending;
    });

    if (modalContext.length === 0) return showToast("No completed records (with WO/Approved) to report.", "warning");

    await loadWhatsAppContacts();

    const list = document.getElementById("waFullContactList");
    if (list) {
        list.innerHTML = FULL_REPORT_CONTACTS.map((c, i) => `
            <label class="list-group-item d-flex align-items-center gap-3 py-3 border-0 rounded mb-2 bg-light bg-opacity-50" style="cursor: pointer;">
                <input class="form-check-input flex-shrink-0" type="radio" name="waFullContact" value="${c.number}" ${i === 0 ? 'checked' : ''}>
                <div class="flex-grow-1">
                    <div class="fw-bold text-dark">${c.name}</div>
                    <div class="small text-muted">${c.number}</div>
                </div>
                <i class="fab fa-whatsapp text-primary fs-4"></i>
            </label>
        `).join('');
    }

    new bootstrap.Modal(document.getElementById('whatsappFullModal')).show();
}

async function sendWhatsAppFullReport() {
    console.log("📨 Preparing to send full WhatsApp report...");
    if (modalContext.length === 0) return showToast("No records to report.", "warning");

    const radio = document.querySelector('input[name="waFullContact"]:checked');
    if (!radio) return showToast("Select a contact.", "warning");

    const number = radio.value;
    const text = await getMessageText(modalContext, false);
    console.log("Final Report Text:", text);

    // Using wa.me for better mobile support
    const url = `https://wa.me/88${number}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
    bootstrap.Modal.getInstance(document.getElementById('whatsappFullModal')).hide();
}

/**
 * Generate Message Text based on Current Template from shared settings
 */
async function getMessageText(selected, isSelectedOnly = true) {
    if (isSelectedOnly) {
        // ULTRA RELIABLE FORMAT: Using \r\n and explicit string building
        let text = "Need Emblishment\r\n\r\n";
        selected.forEach(d => {
            text += "• " + (d.jobNo || "").trim() + " " + (d.buyer || "").trim() + "\r\n";
        });
        return text.trim();
    }

    // For Full Report: Use Template system
    const { getSystemSettings } = await import('./systemSettings.js');
    const settings = await getSystemSettings();
    const templates = settings.whatsapp_templates || {};
    const template = templates['emb_full_report'] || "📦 EMB STATUS REPORT ({date})\n━━━━━━━━━━━━━━━━━━━━━━\n{index}. JOB: {jobNo} ━━ {buyer} ━━ {wo} ━━ {status} ━━ {comments}";

    let header = "";
    let rowTemplate = template;
    const rowVars = ['{jobNo}', '{buyer}', '{wo}', '{status}', '{comments}', '{index}'];
    const lines = template.split('\n');
    let rowIndex = lines.findIndex(line => rowVars.some(v => line.includes(v)));

    if (rowIndex !== -1 && rowIndex > 0) {
        header = lines.slice(0, rowIndex).join('\n') + '\n';
        rowTemplate = lines.slice(rowIndex).join('\n');
    }

    let finalMessage = "";
    if (header) {
        finalMessage = header.replaceAll(/{date}/g, new Date().toLocaleDateString('en-GB'));
        if (!finalMessage.endsWith('\n')) finalMessage += '\n';
    }

    const rows = [];
    selected.forEach((d, idx) => {
        let row = rowTemplate;
        row = row.replaceAll(/{index}/g, idx + 1);
        row = row.replaceAll(/{jobNo}/g, d.jobNo || "");
        row = row.replaceAll(/{buyer}/g, d.buyer || "");
        row = row.replaceAll(/{wo}/g, d.wo || "");
        row = row.replaceAll(/{status}/g, (d.status || "Pending").toUpperCase());
        row = row.replaceAll(/{comments}/g, d.comments || "");
        row = row.replaceAll(/{date}/g, new Date().toLocaleDateString('en-GB'));
        rows.push(row.trim());
    });

    finalMessage += rows.join('\r\n');
    return finalMessage.trim();
}

function getLegacyMessageText(selected, isSelectedOnly) {
    let text = "";
    if (!isSelectedOnly) {
        // Full Report Format
        selected.forEach((d, idx) => {
            text += `${idx + 1}. JOB: ${d.jobNo} ━━ ${d.buyer || '-'} ━━ ${d.wo || '-'} ━━ ${(d.status || 'PENDING').toUpperCase()}${d.comments ? ` ━━ ${d.comments}` : ''}\n`;
        });
    } else {
        // Message Report: Only Job Number and Buyer Name
        selected.forEach((d, idx) => {
            text += `${d.jobNo}   ${d.buyer || '-'}\n`;
        });
    }
    return text.trim();
}

async function handleCopyDrafts() {
    const selected = drafts.filter(d => d.selected);
    if (selected.length === 0) return showToast("Select rows to copy.", "warning");

    const text = await getMessageText(selected, true);
    navigator.clipboard.writeText(text).then(() => showToast("Copied!"));
}