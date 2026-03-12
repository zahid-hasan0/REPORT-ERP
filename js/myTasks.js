import { db, getModulePath } from './storage.js';
import { collection, addDoc, updateDoc, deleteDoc, doc, query, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { showToast } from './toast.js';

let tasks = [];
let editingId = null;
let currentView = 'all'; // all, Task, Note

export async function initMyTasks() {
    console.log("📅 Initializing My Tasks Module...");
    setupListeners();
    loadTasks();
    populateBuyerDropdown();
}

function setupListeners() {
    const form = document.getElementById('taskForm');
    if (form) form.onsubmit = saveTask;

    const searchInput = document.getElementById('taskSearch');
    if (searchInput) searchInput.oninput = renderTasks;

    window.switchTaskView = (type) => {
        currentView = type;
        document.querySelectorAll('.btn-toggle').forEach(btn => {
            btn.classList.toggle('active', btn.textContent.includes(type) || (type === 'all' && btn.textContent === 'All Entries'));
        });
        renderTasks();
    };

    window.toggleTaskStatus = async (id, currentStatus) => {
        const path = getModulePath('my_tasks');
        const newStatus = currentStatus === 'Completed' ? 'Pending' : 'Completed';
        try {
            await updateDoc(doc(db, path, id), {
                status: newStatus,
                completedAt: newStatus === 'Completed' ? new Date().toISOString() : null
            });
            showToast(`Marked as ${newStatus}`);
        } catch (err) {
            showToast("Update failed", "error");
        }
    };

    window.editTask = (id) => {
        const task = tasks.find(t => t.id === id);
        if (!task) return;

        editingId = id;
        document.getElementById('taskEditId').value = id;
        document.getElementById('taskTitle').value = task.title || '';
        document.getElementById('taskType').value = task.type || 'Task';
        document.getElementById('taskPriority').value = task.priority || 'Medium';
        window.selectTaskBuyer(task.buyer || 'General');
        document.getElementById('taskDetail').value = task.detail || '';
        document.getElementById('taskSubmitBtn').innerHTML = '<i class="fas fa-check me-2"></i>Update Entry';

        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.confirmDeleteTask = (id) => {
        const modal = new bootstrap.Modal(document.getElementById('deleteTaskModal'));
        document.getElementById('confirmDeleteTaskBtn').onclick = async () => {
            const path = getModulePath('my_tasks');
            try {
                await deleteDoc(doc(db, path, id));
                showToast("Task deleted", "success");
                modal.hide();
            } catch (err) {
                showToast("Delete failed", "error");
            }
        };
        modal.show();
    };

    window.resetTaskForm = () => {
        editingId = null;
        document.getElementById('taskForm').reset();
        document.getElementById('taskEditId').value = '';
        window.selectTaskBuyer('General'); // Reset custom dropdown
        document.getElementById('taskSubmitBtn').innerHTML = '<i class="fas fa-cloud-upload-alt me-2"></i>Save Record';
    };
}

function loadTasks() {
    const path = getModulePath('my_tasks');
    console.log(`📡 My Tasks: Syncing path [${path}]`);
    const q = query(collection(db, path), orderBy('createdAt', 'desc'));

    onSnapshot(q, (snapshot) => {
        tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        updateStats();
        renderTasks();
    }, (error) => {
        console.error("Task Sync Error:", error);
        showToast("Syncing failed", "error");
    });
}

function updateStats() {
    const active = tasks.filter(t => t.status !== 'Completed').length;
    const high = tasks.filter(t => t.priority === 'High' && t.status !== 'Completed').length;
    const today = new Date().toISOString().split('T')[0];
    const doneToday = tasks.filter(t => t.status === 'Completed' && t.completedAt?.startsWith(today)).length;

    const activeEl = document.getElementById('stat-active');
    if (activeEl) {
        activeEl.textContent = active;
        document.getElementById('stat-high').textContent = high;
        document.getElementById('stat-done').textContent = doneToday;
    }
}

function renderTasks() {
    const container = document.getElementById('taskStripList');
    if (!container) return;

    const searchTerm = document.getElementById('taskSearch')?.value.toLowerCase() || '';

    let filtered = tasks;
    if (currentView !== 'all') filtered = filtered.filter(t => t.type === currentView);
    if (searchTerm) {
        filtered = filtered.filter(t =>
            t.title?.toLowerCase().includes(searchTerm) ||
            t.detail?.toLowerCase().includes(searchTerm)
        );
    }

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="text-center py-5 text-muted">
                <i class="fas fa-inbox fa-3x mb-3 opacity-25"></i>
                <p>No records found in this view.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map(t => {
        const isDone = t.status === 'Completed';
        const priorityClass = `priority-${(t.priority || 'Medium').toLowerCase()}`;

        return `
            <div class="task-strip ${priorityClass} ${isDone ? 'completed' : ''}">
                <div class="status-toggle ${isDone ? 'checked' : ''}" onclick="toggleTaskStatus('${t.id}', '${t.status}')">
                    ${isDone ? '<i class="fas fa-check"></i>' : ''}
                </div>
                <div class="title-area">
                    <div class="task-title" title="${t.title}">${t.title}</div>
                    <div class="d-flex align-items-center gap-2">
                        <span class="tag">${t.type}</span>
                        <span class="tag bg-dark text-white">${t.buyer || 'General'}</span>
                        <span class="small text-muted opacity-75">${t.detail ? (t.detail.substring(0, 50) + '...') : ''}</span>
                    </div>
                </div>
                <div class="text-end">
                    <span class="small fw-bold text-uppercase opacity-50 d-block mb-1" style="font-size: 0.6rem;">${t.priority}</span>
                </div>
                <div class="d-flex gap-2">
                    <button class="btn btn-sm btn-light border p-2 px-3" onclick="editTask('${t.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-light border text-danger p-2 px-3" onclick="confirmDeleteTask('${t.id}')">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

async function saveTask(e) {
    e.preventDefault();
    const path = getModulePath('my_tasks');
    const data = {
        title: document.getElementById('taskTitle').value.trim(),
        type: document.getElementById('taskType').value,
        priority: document.getElementById('taskPriority').value,
        buyer: document.getElementById('taskBuyer').value,
        detail: document.getElementById('taskDetail').value.trim(),
        status: editingId ? (tasks.find(t => t.id === editingId)?.status || 'Pending') : 'Pending',
        updatedAt: new Date().toISOString()
    };

    try {
        if (editingId) {
            await updateDoc(doc(db, path, editingId), data);
            showToast("Record updated");
        } else {
            await addDoc(collection(db, path), { ...data, createdAt: new Date().toISOString() });
            showToast("Record saved");
        }
        window.resetTaskForm();
    } catch (err) {
        showToast("Save failed", "error");
    }
}

async function populateBuyerDropdown() {
    const list = document.getElementById('taskBuyerOptionsList');
    if (!list) return;

    const buyers = window.buyers || [];
    renderTaskBuyerOptions([{ name: 'General' }, ...buyers]);
    setupTaskBuyerSearch([{ name: 'General' }, ...buyers]);
}

function renderTaskBuyerOptions(filteredBuyers) {
    const list = document.getElementById('taskBuyerOptionsList');
    if (!list) return;

    if (filteredBuyers.length === 0) {
        list.innerHTML = '<div class="px-3 py-2 text-muted small">No buyers found</div>';
        return;
    }

    list.innerHTML = filteredBuyers.map(buyer => `
        <button class="dropdown-item" type="button" onclick="window.selectTaskBuyer('${buyer.name}')">
            ${buyer.name === 'General' ? 'General / Private' : buyer.name}
        </button>
    `).join('');
}

function setupTaskBuyerSearch(allBuyers) {
    const searchInput = document.getElementById('taskBuyerSearchInput');
    if (!searchInput) return;

    searchInput.addEventListener('click', (e) => e.stopPropagation());
    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = allBuyers.filter(b => b.name.toLowerCase().includes(term));
        renderTaskBuyerOptions(filtered);
    });
}

window.selectTaskBuyer = function (name) {
    const label = document.getElementById('selectedTaskBuyerLabel');
    const hiddenInput = document.getElementById('taskBuyer');
    const displayValue = name === 'General' ? 'General / Private' : name;

    if (label) label.textContent = displayValue;
    if (hiddenInput) hiddenInput.value = name;

    // Reset search for next time
    const searchInput = document.getElementById('taskBuyerSearchInput');
    const buyers = window.buyers || [];
    if (searchInput) {
        searchInput.value = '';
        renderTaskBuyerOptions([{ name: 'General' }, ...buyers]);
    }

    // Close dropdown
    const dropdownBtn = document.getElementById('taskBuyerDropdownBtn');
    if (dropdownBtn && typeof bootstrap !== 'undefined') {
        const dropdown = bootstrap.Dropdown.getOrCreateInstance(dropdownBtn);
        if (dropdown) dropdown.hide();
    }
};
