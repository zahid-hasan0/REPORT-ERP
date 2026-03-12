function showToast(message, type = 'success') {
    const toastEl = document.getElementById('liveToast');
    const toastMsgEl = document.getElementById('toastMessage');
    if (!toastEl || !toastMsgEl) return;

    toastMsgEl.textContent = message;
    toastEl.className = `toast align-items-center text-white border-0 bg-${type === 'danger' ? 'danger' : type === 'warning' ? 'warning' : 'success'}`;

    const toast = new bootstrap.Toast(toastEl);
    toast.show();
}

function getStatusBadge(status) {
    switch (status) {
        case 'Approved': return 'badge-gms badge-approved';
        case 'Rejected': return 'badge-gms badge-rejected';
        default: return 'badge-gms badge-pending';
    }
}

let confirmCallback = null;
function showConfirm(message, callback) {
    const modalEl = document.getElementById('confirmModal');
    const msgEl = document.getElementById('confirmMessage');
    const btnEl = document.getElementById('confirmBtnAction');

    if (!modalEl) {
        if (confirm(message)) callback();
        return;
    }

    msgEl.textContent = message;
    confirmCallback = callback;

    const modal = new bootstrap.Modal(modalEl);
    modal.show();

    const newBtn = btnEl.cloneNode(true);
    btnEl.parentNode.replaceChild(newBtn, btnEl);
    newBtn.addEventListener('click', () => {
        if (confirmCallback) confirmCallback();
        const instance = bootstrap.Modal.getInstance(modalEl);
        if (instance) instance.hide();
    });
}

function formatWhatsAppNumber(number) {
    let clean = number.replace(/\D/g, '');
    if (clean.length === 11 && clean.startsWith('0')) {
        return '88' + clean;
    }
    return clean;
}
