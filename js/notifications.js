import { getActiveDb, getBookingsPath, db_notes, getModulePath } from './storage.js';
import { collection, query, where, onSnapshot, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { canAccessPage } from './auth.js';

let bookingUnsubscribe = null;
let notesUnsubscribe = null;

let unverifiedBookings = [];
let todayNotes = [];

export function initNotifications() {
    // ... (rest of function remains same until startBuyerNotesListener)

    function startBookingListener(user) {
        // ... (remains same)
        const path = getBookingsPath();
        const dbInstance = getActiveDb();
        // ...
    }

    function startBuyerNotesListener() {
        // 1. Use the correct Database (Notes DB)
        const dbInstance = db_notes;
        // 2. Use the correct Path ('merchandise_items' via helper)
        const path = getModulePath('buyer_notes');

        // Query last 10 notes to check for "Today's" updates
        const q = query(collection(dbInstance, path), orderBy('timestamp', 'desc'), limit(10));

        if (notesUnsubscribe) notesUnsubscribe();
        notesUnsubscribe = onSnapshot(q, (snapshot) => {
            todayNotes = [];
            const todayStr = new Date().toISOString().split('T')[0];

            snapshot.forEach((docSnap) => {
                const data = docSnap.data();
                // Check if created today using createdAt string if available, else fallback
                const createdStr = data.createdAt ? data.createdAt.split('T')[0] : '';

                if (createdStr === todayStr) {
                    todayNotes.push({
                        id: docSnap.id,
                        type: 'note',
                        ...data
                    });
                }
            });
            const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
            combineAndRender(currentUser.role);
        }, (error) => console.error("❌ Notes Notif Error:", error));
    }
    const userString = localStorage.getItem('currentUser');
    if (!userString) return;
    const user = JSON.parse(userString);

    const bellBtn = document.getElementById('notif-bell-btn');
    const drawer = document.getElementById('notif-drawer');
    const closeBtn = document.getElementById('close-notif-drawer');

    if (bellBtn) {
        bellBtn.onclick = (e) => {
            e.stopPropagation();
            drawer.classList.toggle('open');
        };
    }
    if (closeBtn) closeBtn.onclick = () => drawer.classList.remove('open');
    document.addEventListener('click', (e) => {
        if (drawer && drawer.classList.contains('open') && !drawer.contains(e.target) && !bellBtn.contains(e.target)) {
            drawer.classList.remove('open');
        }
    });

    // 1. Booking Notifications (Permission Check)
    updateNotificationAccess(user);
}

export function updateNotificationAccess(user) {
    if (!user) return;

    // Helper to check access based on the PASSED user object (latest data)
    const hasBookingAccess = (user.allowedModules || []).includes('bookingPage') || user.role === 'admin';
    const hasNotesAccess = (user.allowedModules || []).includes('buyerNotesPage') || user.role === 'admin';

    // 1. Booking Listener Management
    if (hasBookingAccess) {
        // Only start if not already running OR if we want to ensure fresh state
        // Simplest strategy: Always restart to be safe, or check a flag.
        // Given firestore listeners are cheap to tear down, let's restart.
        startBookingListener(user);
    } else {
        if (bookingUnsubscribe) {
            console.log("🔕 Access Revoked: Stopping Booking Notifications");
            bookingUnsubscribe();
            bookingUnsubscribe = null;
            unverifiedBookings = []; // Clear data
            combineAndRender(user.role);
        } else {
            console.log("🔕 No Booking Access - Skipping Booking Notifications");
        }
    }

    // 2. Buyer Notes Listener Management
    if (hasNotesAccess) {
        startBuyerNotesListener();
    } else {
        if (notesUnsubscribe) {
            console.log("🔕 Access Revoked: Stopping Buyer Notes Notifications");
            notesUnsubscribe();
            notesUnsubscribe = null;
            todayNotes = [];
            combineAndRender(user.role);
        } else {
            console.log("🔕 No Buyer Notes Access - Skipping Notes Notifications");
        }
    }
}

function startBookingListener(user) {
    // Stop existing first to avoid duplicates
    if (bookingUnsubscribe) bookingUnsubscribe();

    const path = getBookingsPath();
    const dbInstance = getActiveDb();

    let q;
    if (user.role === 'admin') {
        q = query(collection(dbInstance, path), where("checkStatus", "==", "Unverified"));
    } else {
        q = query(collection(dbInstance, path),
            where("checkStatus", "==", "Unverified"),
            where("createdBy", "==", user.username)
        );
    }

    bookingUnsubscribe = onSnapshot(q, (snapshot) => {
        unverifiedBookings = [];
        snapshot.forEach((docSnap) => {
            unverifiedBookings.push({
                id: docSnap.id,
                type: 'booking',
                ...docSnap.data(),
                _sourcePath: docSnap.ref.path
            });
        });
        combineAndRender(user.role);
    }, (error) => console.error("❌ Booking Notif Error:", error));
}

function startBuyerNotesListener() {
    const dbInstance = db_notes; // Corrected DB
    const path = getModulePath('buyer_notes'); // Corrected Path

    // Query last 10 notes to check for "Today's" updates
    const q = query(collection(dbInstance, path), orderBy('timestamp', 'desc'), limit(10));

    if (notesUnsubscribe) notesUnsubscribe();
    notesUnsubscribe = onSnapshot(q, (snapshot) => {
        todayNotes = [];
        const todayStr = new Date().toISOString().split('T')[0];

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            // Check if created today
            const createdStr = data.createdAt ? data.createdAt.split('T')[0] : '';
            if (createdStr === todayStr) {
                todayNotes.push({
                    id: docSnap.id,
                    type: 'note',
                    ...data
                });
            }
        });
        const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
        combineAndRender(currentUser.role);
    }, (error) => console.error("❌ Notes Notif Error:", error));
}

function combineAndRender(role) {
    const allNotifs = [...unverifiedBookings, ...todayNotes];

    // Filter out locally "read" notifications
    const readIds = JSON.parse(localStorage.getItem('read_notifications') || '[]');
    const visibleNotifs = allNotifs.filter(n => !readIds.includes(n.id));

    renderNotifications(visibleNotifs, role);
}

function renderNotifications(items, role) {
    const badge = document.getElementById('notif-badge');
    const list = document.getElementById('notif-list');
    if (!badge || !list) return;

    if (items.length > 0) {
        badge.classList.remove('d-none');
        badge.textContent = items.length;
        badge.classList.add('notif-pulse');
    } else {
        badge.classList.add('d-none');
    }

    if (items.length === 0) {
        list.innerHTML = `<div class="text-center p-5 text-muted small">No new notifications</div>`;
        return;
    }

    const isAdmin = role === 'admin';

    list.innerHTML = items.map(item => {
        if (item.type === 'booking') {
            return `
            <div class="notif-card ${isAdmin ? 'notif-card-readonly' : ''}" 
                 ${isAdmin ? '' : `onclick="handleNotifClick('${item.id}', 'booking')"`}>
                <div class="notif-title text-danger"><i class="fas fa-exclamation-circle me-1"></i> Unverified Booking</div>
                 <div class="mb-1 fw-bold">${item.bookingNo || 'N/A'}</div>
                <div class="notif-meta">
                    <span><i class="fas fa-user"></i> ${item.customer || 'N/A'}</span>
                    <span><i class="fas fa-pencil-alt"></i> ${item.creatorName || item.createdBy || 'Unknown'}</span>
                </div>
            </div>`;
        } else if (item.type === 'note') {
            return `
            <div class="notif-card" onclick="handleNotifClick('${item.id}', 'note')">
                <div class="notif-title text-primary"><i class="fas fa-sticky-note me-1"></i> New Buyer Note</div>
                <div class="mb-1 fw-bold">${item.buyer || 'General'}</div>
                <div class="small text-muted text-truncate">${item.note || 'No content'}</div>
                <div class="notif-meta mt-1">
                     <span class="small" style="font-size: 0.75rem;">${new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
            </div>`;
        }
    }).join('');
}

window.handleNotifClick = async (id, type) => {
    // 1. Mark as Read Locally
    const readIds = JSON.parse(localStorage.getItem('read_notifications') || '[]');
    if (!readIds.includes(id)) {
        readIds.push(id);
        localStorage.setItem('read_notifications', JSON.stringify(readIds));
    }

    // 2. Refresh UI (Remove the clicked item immediately)
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    combineAndRender(currentUser.role);

    // 3. Handle Navigation
    const drawer = document.getElementById('notif-drawer');
    if (drawer) drawer.classList.remove('open');

    if (type === 'booking') {
        const booking = unverifiedBookings.find(b => b.id === id);
        if (!booking) return;

        if (!window.bookings) window.bookings = [];
        // Ensure data is available for editBooking
        const existsIdx = window.bookings.findIndex(b => b.id === id);
        if (existsIdx !== -1) window.bookings[existsIdx] = booking;
        else window.bookings.push(booking);

        window._lastBookingSourcePath = booking._sourcePath;
        if (typeof window.editBooking === 'function') window.editBooking(id);
    } else if (type === 'note') {
        // Navigate to Buyer Notes page
        if (window.showPage) window.showPage('buyerNotesPage');
    }
};

export function stopNotifications() {
    if (bookingUnsubscribe) { bookingUnsubscribe(); bookingUnsubscribe = null; }
    if (notesUnsubscribe) { notesUnsubscribe(); notesUnsubscribe = null; }
}
