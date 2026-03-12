import { db, getModulePath } from './storage.js';
import { collection, addDoc, updateDoc, deleteDoc, doc, query, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { showToast } from './toast.js';

let entries = [];
let editingId = null;

export async function initMyDiary() {
    console.log("📔 Initializing My Diary Module...");
    setupDiaryListeners();
    loadDiaryEntries();
}

function setupDiaryListeners() {
    const form = document.getElementById('diaryForm');
    if (form) form.onsubmit = saveDiaryEntry;

    window.editDiaryEntry = (id) => {
        const entry = entries.find(e => e.id === id);
        if (!entry) return;

        editingId = id;
        document.getElementById('diaryEditId').value = id;
        document.getElementById('diaryTopic').value = entry.topic || '';
        document.getElementById('diaryContent').value = entry.content || '';
        document.getElementById('diarySubmitBtn').innerHTML = '<i class="fas fa-check me-2"></i>Update Reflection';

        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.confirmDeleteDiary = (id) => {
        const modal = new bootstrap.Modal(document.getElementById('deleteDiaryModal'));
        document.getElementById('confirmDeleteDiaryBtn').onclick = async () => {
            const path = getModulePath('my_diary');
            try {
                await deleteDoc(doc(db, path, id));
                showToast("Memory deleted", "success");
                modal.hide();
            } catch (err) {
                showToast("Operation failed", "error");
            }
        };
        modal.show();
    };

    window.resetDiaryForm = () => {
        editingId = null;
        document.getElementById('diaryForm').reset();
        document.getElementById('diaryEditId').value = '';
        document.getElementById('diarySubmitBtn').innerHTML = '<i class="fas fa-feather-pointed me-2"></i>Save Reflection';
    };
}

function loadDiaryEntries() {
    const path = getModulePath('my_diary');
    console.log(`📡 My Diary: Syncing path [${path}]`);
    const q = query(collection(db, path), orderBy('createdAt', 'desc'));

    onSnapshot(q, (snapshot) => {
        entries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        document.getElementById('diary-total-count').textContent = entries.length;
        renderDiaryEntries();
    }, (error) => {
        console.error("Diary Sync Error:", error);
        showToast("Access denied or sync error", "error");
    });
}

function renderDiaryEntries() {
    const container = document.getElementById('diaryListContainer');
    if (!container) return;

    if (entries.length === 0) {
        container.innerHTML = `
            <div class="col-12 text-center py-5">
                <div class="text-muted small">Your diary is empty. Capture your first thought above!</div>
            </div>
        `;
        return;
    }

    container.innerHTML = entries.map((e, index) => {
        const date = e.createdAt ? new Date(e.createdAt).toLocaleDateString('en-US', {
            month: 'long', day: 'numeric', year: 'numeric'
        }) : 'Today';

        const variant = (index % 5) + 1;

        return `
            <div class="col-md-6">
                <div class="diary-card card-variant-${variant} h-100 d-flex flex-column shadow">
                    <div class="d-flex justify-content-between align-items-start mb-4">
                        <span class="entry-date-badge">${date}</span>
                        <div class="btn-group p-1 bg-white bg-opacity-10 rounded-3">
                            <button class="btn btn-link text-white p-2" onclick="editDiaryEntry('${e.id}')">
                                <i class="fas fa-pencil-alt"></i>
                            </button>
                            <button class="btn btn-link text-white p-2" onclick="confirmDeleteDiary('${e.id}')">
                                <i class="fas fa-trash-can"></i>
                            </button>
                        </div>
                    </div>
                    <h5 class="diary-title">${e.topic || 'Untitled Reflection'}</h5>
                    <p class="diary-content-preview flex-grow-1">${e.content || ''}</p>
                </div>
            </div>
        `;
    }).join('');
}

async function saveDiaryEntry(e) {
    e.preventDefault();
    const path = getModulePath('my_diary');

    const data = {
        topic: document.getElementById('diaryTopic').value.trim(),
        content: document.getElementById('diaryContent').value.trim(),
        updatedAt: new Date().toISOString()
    };

    try {
        if (editingId) {
            await updateDoc(doc(db, path, editingId), data);
            showToast("Reflection updated");
        } else {
            await addDoc(collection(db, path), {
                ...data,
                createdAt: new Date().toISOString()
            });
            showToast("Memory saved");
        }
        window.resetDiaryForm();
    } catch (err) {
        console.error(err);
        showToast("Save failed", "error");
    }
}
