
const firebaseConfig = {
    apiKey: "AIzaSyAYi7iZPhSWpZP9JFda8WREaLQ6mZHksjY",
    authDomain: "item-notes.firebaseapp.com",
    projectId: "item-notes",
    storageBucket: "item-notes.firebasestorage.app",
    messagingSenderId: "937625064892",
    appId: "1:937625064892:web:c73a10c2e747cf8fb847b9",
    measurementId: "G-QHHV6X5XE6"
};

let db, firebaseInitialized = false;
try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    firebaseInitialized = true;
    updateConnectionStatus('connected');
} catch (error) {
    console.error('❌ Firebase error:', error);
    updateConnectionStatus('error');
    showToast('Firebase connection failed', 'error');
}

let items = [], editingItemId = null, allBuyers = new Set();
let deleteIdTarget = null; // Store ID for deletion
const COLLECTION = 'merchandise_items';

// --- UI Helpers ---

function showLoader(text) {
    document.getElementById('loaderText').textContent = text || 'Loading...';
    document.getElementById('loader').classList.add('active');
}

function hideLoader() {
    document.getElementById('loader').classList.remove('active');
}

function showToast(message, type = 'success') {
    const toastContainer = document.getElementById('toastContainer');
    const toastEl = document.createElement('div');
    toastEl.className = `toast toast-custom align-items-center show`;
    toastEl.style.borderLeftColor = type === 'error' ? 'var(--danger)' : 'var(--success)';

    // Add icon based on type
    const icon = type === 'error' ? 'bi-exclamation-circle-fill text-danger' : 'bi-check-circle-fill text-success';

    toastEl.innerHTML = `
        <div class="d-flex">
            <div class="toast-body d-flex align-items-center gap-2">
                <i class="bi ${icon} fs-5"></i>
                <span style="font-weight: 500;">${message}</span>
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>
    `;

    toastContainer.appendChild(toastEl);

    // Auto remove after 3 seconds
    setTimeout(() => {
        toastEl.classList.remove('show');
        setTimeout(() => toastEl.remove(), 300);
    }, 3000);
}

function updateConnectionStatus(status) {
    const icon = document.querySelector('#firebaseStatus i');
    const text = document.getElementById('statusText');
    if (status === 'connected') {
        icon.className = 'bi bi-cloud-fill status-connected';
        text.textContent = 'Connected';
    } else {
        icon.className = 'bi bi-exclamation-circle-fill status-error';
        text.textContent = 'Offline';
    }
}

// --- Firestore Operations ---

function loadFromFirestore() {
    if (!firebaseInitialized) {
        items = [];
        renderItems(items);
        return;
    }
    // Initial loader only
    if (items.length === 0) showLoader('Syncing...');

    try {
        db.collection(COLLECTION).orderBy('timestamp', 'desc').onSnapshot(function (snapshot) {
            items = [];
            snapshot.forEach(function (doc) {
                items.push({ id: doc.id, ...doc.data() });
            });
            updateBuyersList();
            renderItems(items);
            hideLoader();
        }, function (error) {
            console.error('❌ Error:', error);
            hideLoader();
            showToast('Failed to load data', 'error');
        });
    } catch (error) {
        hideLoader();
        showToast('System Error: ' + error.message, 'error');
    }
}

function saveToFirestore(item) {
    if (!firebaseInitialized) {
        showToast('Database not connected', 'error');
        return Promise.resolve(null);
    }
    showLoader('Saving...');
    return db.collection(COLLECTION).add({
        ...item,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    }).then(function (docRef) {
        hideLoader();
        showToast('Item added successfully');
        return docRef.id;
    }).catch(function (error) {
        hideLoader();
        showToast(error.message, 'error');
        return null;
    });
}

function updateInFirestore(id, item) {
    if (!firebaseInitialized) return Promise.resolve(false);
    showLoader('Updating...');
    return db.collection(COLLECTION).doc(id).update({
        ...item,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    }).then(function () {
        hideLoader();
        showToast('Item updated successfully');
        return true;
    }).catch(function (error) {
        hideLoader();
        showToast(error.message, 'error');
        return false;
    });
}

function deleteFromFirestore(id) {
    if (!firebaseInitialized) return Promise.resolve(false);
    showLoader('Deleting...');
    return db.collection(COLLECTION).doc(id).delete().then(function () {
        hideLoader();
        showToast('Item deleted successfully');
        return true;
    }).catch(function (error) {
        hideLoader();
        showToast(error.message, 'error');
        return false;
    });
}

function bulkSaveToFirestore(itemsArray) {
    if (!firebaseInitialized) return Promise.resolve(0);
    showLoader('Uploading...');
    var batch = db.batch();
    var count = 0;
    itemsArray.forEach(function (item) {
        var docRef = db.collection(COLLECTION).doc();
        batch.set(docRef, {
            ...item,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        count++;
    });
    return batch.commit().then(function () {
        hideLoader();
        return count;
    }).catch(function (error) {
        hideLoader();
        showToast(error.message, 'error');
        return 0;
    });
}

// --- App Logic ---

function updateBuyersList() {
    allBuyers.clear();
    items.forEach(function (item) {
        if (item.buyerName) allBuyers.add(item.buyerName);
    });
    var filter = document.getElementById('buyerFilter');
    var val = filter.value;
    filter.innerHTML = '<option value="">All Buyers</option>';
    Array.from(allBuyers).sort().forEach(function (buyer) {
        filter.innerHTML += '<option value="' + buyer + '">' + buyer + '</option>';
    });
    filter.value = val;
    document.getElementById('totalBuyers').textContent = allBuyers.size;
}

function renderItems(itemsToRender) {
    var tbody = document.getElementById('itemsTableBody');
    document.getElementById('totalItems').textContent = itemsToRender.length;

    if (itemsToRender.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center py-5 text-muted">No items found.</td></tr>';
        return;
    }

    var html = '';
    itemsToRender.forEach(function (item, i) {
        html += '<tr>' +
            '<td>' + (i + 1) + '</td>' +
            '<td><strong>' + (item.buyerName || 'N/A') + '</strong></td>' +
            '<td>' + (item.description || '-') + '</td>' +
            '<td>' + (item.tpcLogic || '-') + '</td>' +
            '<td><span class="badge bg-secondary">' + (item.logicCode || '-') + '</span></td>' +
            '<td>' + (item.logicDescription || '-') + '</td>' +
            '<td>' + (item.comments || '-') + '</td>' +
            '<td class="text-center">' +
            '<button class="btn btn-sm btn-link text-primary action-btn" onclick="editItem(\'' + item.id + '\')" title="Edit"><i class="bi bi-pencil-fill"></i></button>' +
            '<button class="btn btn-sm btn-link text-danger action-btn" onclick="confirmDelete(\'' + item.id + '\')" title="Delete"><i class="bi bi-trash-fill"></i></button>' +
            '</td>' +
            '</tr>';
    });
    tbody.innerHTML = html;
}

function handleFileUpload(e) {
    var file = e.target.files[0];
    if (!file) return;

    // Check file type
    if (!file.name.match(/\.(xlsx|xls|csv)$/)) {
        showToast('Invalid file format. Please upload Excel or CSV.', 'error');
        return;
    }

    showLoader('Reading...');
    var reader = new FileReader();
    reader.onload = function (ev) {
        try {
            var data = new Uint8Array(ev.target.result);
            var wb = XLSX.read(data, { type: 'array' });
            var ws = wb.Sheets[wb.SheetNames[0]];
            var json = XLSX.utils.sheet_to_json(ws, { header: 1 });
            if (json.length < 2) {
                hideLoader();
                showToast('File is empty', 'error');
                return;
            }
            var newItems = [];
            for (var i = 1; i < json.length; i++) {
                var row = json[i];
                if (row[0]) { // Only check if Buyer Name exists (row[0])
                    newItems.push({
                        buyerName: String(row[0] || '').trim(),
                        description: String(row[1] || '').trim(),
                        tpcLogic: String(row[2] || '').trim(),
                        logicCode: String(row[3] || '').trim(),
                        logicDescription: String(row[4] || '').trim(),
                        comments: String(row[5] || '').trim()
                    });
                }
            }
            if (newItems.length === 0) {
                hideLoader();
                showToast('No valid data found', 'error');
                return;
            }
            bulkSaveToFirestore(newItems).then(function (count) {
                if (count > 0) showToast(`Running import: ${count} items added`);
            });
        } catch (error) {
            hideLoader();
            showToast('Import failed: ' + error.message, 'error');
        }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
}

function filterItems() {
    var search = document.getElementById('searchInput').value.toLowerCase();
    var buyer = document.getElementById('buyerFilter').value;
    var filtered = items;
    if (buyer) {
        filtered = filtered.filter(function (i) { return i.buyerName === buyer; });
    }
    if (search.trim()) {
        filtered = filtered.filter(function (i) {
            return Object.values(i).some(function (v) {
                return String(v).toLowerCase().includes(search);
            });
        });
    }
    renderItems(filtered);
}

function showEntryPage(itemId) {
    document.getElementById('entryPage').style.display = 'block';

    // Add small animation
    setTimeout(() => {
        document.querySelector('.form-card').style.opacity = '1';
        document.querySelector('.form-card').style.transform = 'scale(1)';
    }, 10);

    if (itemId) {
        var item = items.find(function (i) { return i.id === itemId; });
        if (item) {
            editingItemId = itemId;
            document.getElementById('formTitle').textContent = 'Edit Item';
            document.getElementById('saveButtonText').textContent = 'Update Item';
            document.getElementById('buyerName').value = item.buyerName || '';
            document.getElementById('description').value = item.description || '';
            document.getElementById('tpcLogic').value = item.tpcLogic || '';
            document.getElementById('logicCode').value = item.logicCode || '';
            document.getElementById('logicDescription').value = item.logicDescription || '';
            document.getElementById('comments').value = item.comments || '';
        }
    } else {
        resetForm();
    }
}

function closeEntryPage() {
    document.getElementById('entryPage').style.display = 'none';
    resetForm();
}

function resetForm() {
    editingItemId = null;
    document.getElementById('formTitle').textContent = 'Add New Item';
    document.getElementById('saveButtonText').textContent = 'Save Item';
    document.getElementById('buyerName').value = '';
    document.getElementById('description').value = '';
    document.getElementById('tpcLogic').value = '';
    document.getElementById('logicCode').value = '';
    document.getElementById('logicDescription').value = '';
    document.getElementById('comments').value = '';
}

function saveItem() {
    var buyerName = document.getElementById('buyerName').value.trim();
    var description = document.getElementById('description').value.trim();
    var tpcLogic = document.getElementById('tpcLogic').value.trim();
    var logicCode = document.getElementById('logicCode').value.trim();
    var logicDescription = document.getElementById('logicDescription').value.trim();
    var comments = document.getElementById('comments').value.trim();

    // Validation: Only Buyer Name is required
    if (!buyerName) {
        showToast('Buyer Name is required!', 'error');
        document.getElementById('buyerName').focus();
        return;
    }

    var itemData = {
        buyerName: buyerName,
        description: description,
        tpcLogic: tpcLogic,
        logicCode: logicCode,
        logicDescription: logicDescription,
        comments: comments
    };

    if (editingItemId) {
        updateInFirestore(editingItemId, itemData).then(function (success) {
            if (success) closeEntryPage();
        });
    } else {
        saveToFirestore(itemData).then(function (docId) {
            if (docId) closeEntryPage();
        });
    }
}

function editItem(id) {
    showEntryPage(id);
}

// Replaces the old deleteItem with Modal logic
function confirmDelete(id) {
    deleteIdTarget = id;
    var myModal = new bootstrap.Modal(document.getElementById('deleteModal'));
    myModal.show();
}

function executeDelete() {
    if (deleteIdTarget) {
        deleteFromFirestore(deleteIdTarget).then(() => {
            // Close modal manually if needed, but the button should do it
            var modalEl = document.getElementById('deleteModal');
            var modal = bootstrap.Modal.getInstance(modalEl);
            modal.hide();
        });
    }
}

function downloadData() {
    showLoader('Preparing...');
    try {
        var headers = ['Buyer Name', 'Description', 'TPC Logic', 'Logic Code', 'Logic Description', 'Comments'];
        var rows = items.map(function (i) {
            return [
                i.buyerName || '', i.description || '', i.tpcLogic || '',
                i.logicCode || '', i.logicDescription || '', i.comments || ''
            ];
        });
        var ws = XLSX.utils.aoa_to_sheet([headers].concat(rows));
        var wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Merchandise Items');
        var fileName = 'merchandise_items_' + new Date().toISOString().split('T')[0] + '.xlsx';
        XLSX.writeFile(wb, fileName);
        hideLoader();
        showToast('Download started');
    } catch (error) {
        hideLoader();
        showToast('Download error: ' + error.message, 'error');
    }
}

function printData() {
    showLoader('Preparing...');
    var win = window.open('', '_blank');
    var rows = '';
    items.forEach(function (item, i) {
        rows += '<tr>' +
            '<td>' + (i + 1) + '</td>' +
            '<td><strong>' + (item.buyerName || 'N/A') + '</strong></td>' +
            '<td>' + (item.description || '') + '</td>' +
            '<td>' + (item.tpcLogic || '') + '</td>' +
            '<td>' + (item.logicCode || '') + '</td>' +
            '<td>' + (item.logicDescription || '') + '</td>' +
            '<td>' + (item.comments || '') + '</td>' +
            '</tr>';
    });
    var content = '<!DOCTYPE html><html><head><title>Merchandise Items</title><style>' +
        'body{font-family: Inter, sans-serif; padding:20px;}' +
        'h1{color:#10b981}' +
        'table{width:100%;border-collapse:collapse;margin-top:20px}' +
        'th,td{border:1px solid #ddd;padding:8px;text-align:left;font-size:12px}' +
        'th{background-color:#0f172a;color:white}tr:nth-child(even){background-color:#f9f9f9}' +
        '</style></head><body>' +
        '<h1>Merchandise Items Report</h1>' +
        '<p><strong>Generated:</strong> ' + new Date().toLocaleString() + '</p>' +
        '<p><strong>Total Items:</strong> ' + items.length + ' | <strong>Buyers:</strong> ' + allBuyers.size + '</p>' +
        '<table><thead><tr>' +
        '<th>#</th><th>Buyer Name</th><th>Description</th><th>TPC Logic</th>' +
        '<th>Logic Code</th><th>Logic Description</th><th>Comments</th>' +
        '</tr></thead><tbody>' + rows + '</tbody></table>' +
        '</body></html>';
    win.document.write(content);
    win.document.close();
    setTimeout(function () { win.print(); hideLoader(); }, 250);
}

window.addEventListener('load', function () {
    loadFromFirestore();
    document.getElementById('fileInput').addEventListener('change', handleFileUpload);
    document.getElementById('searchInput').addEventListener('input', filterItems);
    document.getElementById('buyerFilter').addEventListener('change', filterItems);
    document.getElementById('downloadBtn').addEventListener('click', downloadData);
    document.getElementById('printBtn').addEventListener('click', printData);
    document.getElementById('addNewBtn').addEventListener('click', function () { showEntryPage(); });
    document.getElementById('saveBtn').addEventListener('click', saveItem);
    document.getElementById('cancelBtn').addEventListener('click', closeEntryPage);
    document.getElementById('closeFormBtn').addEventListener('click', closeEntryPage);

    // Bind Delete Confirmation
    document.getElementById('confirmDeleteBtn').addEventListener('click', executeDelete);
});
