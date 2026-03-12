// navigation.js
import { loadBookings } from './display.js';
import { loadBuyers } from './buyerManager.js';
import { updateDashboard } from './summary.js';
import { initSettings } from './adminSettings.js';
import { getSystemSettings } from './systemSettings.js';
import { initReportGenerator } from './reportGenerator.js';
import { canAccessPage } from './auth.js'; // Import Single Source of Truth

// ------------------------------------
// Access Logic now handled in auth.js
// ------------------------------------
// ------------------------------------

// Cache for page content
const pageCache = {};

export async function showPage(pageId, event) {
    if (event) event.preventDefault();

    // 0. Security Check
    if (!canAccessPage(pageId)) {
        console.warn(`⛔ Access denied to ${pageId}`);
        // Optionally show a "Access Denied" toast or just return
        return;
    }

    const navMap = {
        'dashboardPage': 'nav-dashboard',
        'bookingPage': 'nav-booking',
        'embEntryPage': 'nav-emb-entry',
        'embReportPage': 'nav-emb-report',
        'buyerNotesPage': 'nav-buyer-notes',
        'buyerManagementPage': 'nav-buyers',
        'reportPage': 'nav-reports',
        'settingsPage': 'nav-settings',
        'merchandisingPage': 'nav-merchandising',
        'merchandisingBuyersPage': 'nav-merchandising-buyers',
        'myTasksPage': 'nav-my-tasks',
        'myDiaryPage': 'nav-my-diary',
        'profilePage': 'nav-profile',
        'welcomePage': '',
        'homePage': 'nav-home'
    };

    const titleMap = {
        'dashboardPage': 'Dashboard Overview',
        'bookingPage': 'Booking Operations',
        'embEntryPage': 'Emb Entry',
        'embReportPage': 'Emb Reports',
        'buyerNotesPage': 'Buyer Notes',
        'buyerManagementPage': 'Buyer Library',
        'reportPage': 'Analytics & Reports',
        'settingsPage': 'System Settings',
        'merchandisingPage': 'Packing List',
        'merchandisingBuyersPage': 'Manage Buyers',
        'myTasksPage': 'My Task Planner',
        'myDiaryPage': 'Personal Diary',
        'profilePage': 'Profile Management',
        'welcomePage': 'System Access',
        'homePage': 'Workspace Overview'
    };

    // 1. Update Sidebar Active State
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    const activeNavId = navMap[pageId];
    if (activeNavId) {
        const activeLink = document.getElementById(activeNavId);
        if (activeLink) activeLink.classList.add('active');
    }

    // 2. Update Header Title
    const pageTitle = document.getElementById('pageTitle');
    if (pageTitle) {
        pageTitle.innerText = titleMap[pageId] || 'Overview';
    }

    // 3. Load Content
    const appContent = document.getElementById('app-content');
    if (!appContent) return;

    // Map pageId to file path
    const fileMap = {
        'dashboardPage': 'pages/dashboard.html',
        'bookingPage': 'pages/booking.html',
        'embEntryPage': 'pages/emb-entry.html',
        'embReportPage': 'pages/emb-report.html',
        'buyerNotesPage': 'pages/buyer-notes.html',
        'buyerManagementPage': 'pages/buyers.html',
        'reportPage': 'pages/reports.html',
        'settingsPage': 'pages/settings.html',
        'merchandisingPage': 'pages/merchandising.html',
        'merchandisingBuyersPage': 'pages/merchandising-buyers.html',
        'myTasksPage': 'pages/my-tasks.html',
        'myDiaryPage': 'pages/my-diary.html',
        'profilePage': 'pages/profile.html',
        'welcomePage': 'pages/welcome.html',
        'homePage': 'pages/home.html'
    };

    let filePath = fileMap[pageId];

    // Special Logic: If User has NO modules, show 'home.html' instead of Dashboard -> REMOVED (Open Access)
    // if (pageId === 'dashboardPage') {
    //     const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
    //     const isAdmin = user.role === 'admin';
    //     const hasModules = user.allowedModules && user.allowedModules.length > 0;
    //
    //     if (!isAdmin && !hasModules) {
    //         filePath = 'pages/home.html';
    //     }
    // }

    if (!filePath) {
        console.error(`Page ID ${pageId} not found in fileMap.`);
        appContent.innerHTML = '<div class="p-4 text-danger">Page not found (Invalid ID)</div>';
        return;
    }

    try {
        let content = pageCache[pageId];
        // Don't cache only if it's missing (Dashboard now cached as well)
        if (!content) {
            const response = await fetch(filePath);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            content = await response.text();
            pageCache[pageId] = content;
        }

        appContent.innerHTML = content;

        // 4. Initialize Page Scripts
        await initPageScripts(pageId, false); // False means not a skip-reinjection call

    } catch (error) {
        console.error('❌ Error loading page:', error.message, error.stack);
        appContent.innerHTML = `<div class="p-4 text-danger">Error loading page: ${error.message}</div>`;
    }
}
window.showPage = showPage;
window.canAccessPage = canAccessPage; // Expose globally just in case

// Optimized showPage for state-preserving navigation
window.showPageOptimized = async function (pageId) {
    const navMap = {
        'dashboardPage': 'nav-dashboard',
        'bookingPage': 'nav-booking',
        'embEntryPage': 'nav-emb-entry',
        'embReportPage': 'nav-emb-report',
        'buyerNotesPage': 'nav-buyer-notes',
        'buyerManagementPage': 'nav-buyers',
        'reportPage': 'nav-reports',
        'settingsPage': 'nav-settings',
        'merchandisingPage': 'nav-merchandising',
        'merchandisingBuyersPage': 'nav-merchandising-buyers',
        'myTasksPage': 'nav-my-tasks',
        'myDiaryPage': 'nav-my-diary',
        'profilePage': 'nav-profile'
    };

    const activeNav = document.querySelector('.nav-link.active');
    const isAlreadyOnPage = activeNav && activeNav.id === navMap[pageId];

    if (isAlreadyOnPage && document.getElementById('app-content').innerHTML.trim() !== "") {
        console.log(`ℹ️ Already on ${pageId}, skipping re-injection.`);
        await initPageScripts(pageId, true); // True means skip resetForm
        return true;
    }

    await showPage(pageId);
    return false;
};

async function initPageScripts(pageId, skipReset = false) {
    console.log(`🚀 Initializing script for: ${pageId} (skipReset: ${skipReset})`);

    if (pageId === 'homePage') {
        console.log("🏠 Initializing Home Page Logic...");
        // Home page logic is currently handles via inline script in home.html
        // but can be extended here.
    }
    else if (pageId === 'dashboardPage') {
        if (window.bookings) await updateDashboard(window.bookings);
    }
    else if (pageId === 'bookingPage') {
        // Re-attach listeners for booking form
        if (window.setupBookingFormListeners) window.setupBookingFormListeners();
        if (window.setupTableListeners) window.setupTableListeners();

        if (!skipReset && window.resetForm) window.resetForm();

        // Reload data to ensure table is fresh if not just preserving state
        if (!skipReset) {
            await loadBookings();
            await loadBuyers();
        }
    }
    else if (pageId === 'buyerManagementPage') {
        if (window.setupBuyerPageListeners) window.setupBuyerPageListeners();
        await loadBuyers();
    }
    else if (pageId === 'reportPage') {
        if (window.setupReportListeners) window.setupReportListeners();
        if (window.initReportGenerator) window.initReportGenerator();

        // Force update of report tables if data exists
        if (window.bookings && window.bookings.length > 0) {
            await updateDashboard(window.bookings);
        } else {
            await loadBookings();
        }
    }
    else if (pageId === 'embEntryPage') {
        const { initEmbEntry } = await import('./embReport_integrated.js');
        await initEmbEntry();
    }
    else if (pageId === 'embReportPage') {
        const { initEmbReportView } = await import('./embReport_integrated.js');
        await initEmbReportView();
    }
    else if (pageId === 'buyerNotesPage') {
        const { initBuyerNotes } = await import('./buyerNotes_integrated.js');
        await initBuyerNotes();
    }
    else if (pageId === 'profilePage') {
        const { loadUserProfile } = await import('./profileManagement.js');
        await loadUserProfile();

        // 1. Image Preview Listener
        const imgInput = document.getElementById('profilePageImageUpload');
        if (imgInput) {
            imgInput.onchange = function (e) {
                if (e.target.files && e.target.files[0]) {
                    const reader = new FileReader();
                    reader.onload = function (evt) {
                        document.getElementById('profilePageImage').src = evt.target.result;
                    };
                    reader.readAsDataURL(e.target.files[0]);
                }
            };
        }

        // 2. Save Handler
        window.saveUserProfilePage = async function () {
            const { db } = await import('./storage.js');
            const { doc, setDoc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
            const { showToast } = await import('./toast.js');

            const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
            const newName = document.getElementById('profilePageName').value.trim();
            const imageInput = document.getElementById('profilePageImageUpload');

            // Preferences
            const prefUnverified = document.getElementById('prefUnverified')?.checked;
            const prefSound = document.getElementById('prefSound')?.checked;

            if (!newName) {
                showToast('Please enter a name', 'error');
                return;
            }

            try {
                const saveBtn = document.getElementById('saveProfilePageBtn');
                saveBtn.disabled = true;
                saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Saving...';

                // Determine Image Data (Default to current)
                let imageData = document.getElementById('profilePageImage').src;

                // Handle image upload if selected
                if (imageInput.files && imageInput.files[0]) {
                    const file = imageInput.files[0];

                    // Client-side Resize Logic
                    const resizeImage = (file, maxWidth = 300) => {
                        return new Promise((resolve) => {
                            const reader = new FileReader();
                            reader.onload = (e) => {
                                const img = new Image();
                                img.onload = () => {
                                    const canvas = document.createElement('canvas');
                                    let width = img.width;
                                    let height = img.height;
                                    if (width > maxWidth) {
                                        height *= maxWidth / width;
                                        width = maxWidth;
                                    }
                                    canvas.width = width;
                                    canvas.height = height;
                                    const ctx = canvas.getContext('2d');
                                    ctx.drawImage(img, 0, 0, width, height);
                                    resolve(canvas.toDataURL('image/jpeg', 0.8));
                                };
                                img.src = e.target.result;
                            };
                            reader.readAsDataURL(file);
                        });
                    };

                    try {
                        imageData = await resizeImage(file, 300);
                    } catch (err) {
                        console.error("Resize error", err);
                        showToast("Error processing image", "error");
                        saveBtn.disabled = false;
                        return;
                    }
                }

                // Update Firestore
                const profileRef = doc(db, 'user_profiles', currentUser.username);
                await setDoc(profileRef, {
                    name: newName,
                    image: imageData,
                    preferences: {
                        unverifiedAlerts: prefUnverified,
                        soundEffects: prefSound
                    },
                    updatedAt: new Date().toISOString()
                }, { merge: true });

                // Update LocalStorage
                currentUser.fullName = newName;
                if (!currentUser.preferences) currentUser.preferences = {};
                currentUser.preferences.unverifiedAlerts = prefUnverified;
                localStorage.setItem('currentUser', JSON.stringify(currentUser));

                // Update UI Sidebar immediately
                document.getElementById('sidebarUserName').textContent = newName;
                const sidebarImg = document.getElementById('sidebarProfileImage');
                if (sidebarImg) sidebarImg.src = imageData;

                showToast('Profile saved successfully!', 'success');
            } catch (error) {
                console.error('Error saving profile:', error);
                let msg = 'Failed to save profile';
                if (error.code === 'permission-denied') msg = 'Permission denied.';
                if (error.message && error.message.includes('size')) msg = 'Image too large for database.';
                showToast(msg, 'error');
            } finally {
                const saveBtn = document.getElementById('saveProfilePageBtn');
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.innerHTML = '<i class="fas fa-save me-2"></i>Save Changes';
                }
            }
        };

        // 3. Password Change Handler
        window.changeUserPassword = async function () {
            const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
            const currentPass = document.getElementById('currentPassword').value;
            const newPass = document.getElementById('newPassword').value;
            const confirmPass = document.getElementById('confirmNewPassword').value;

            const { db } = await import('./storage.js');
            const { doc, getDoc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
            const { showToast } = await import('./toast.js');

            if (newPass !== confirmPass) {
                showToast("New passwords do not match.", "error");
                return;
            }
            if (newPass.length < 6) {
                showToast("Password should be at least 6 characters.", "warning");
                return;
            }

            try {
                const btn = document.getElementById('changePassBtn');
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Updating...';

                // Verify Old Password
                const userRef = doc(db, 'users', currentUser.username);
                const snap = await getDoc(userRef);

                if (snap.exists()) {
                    const userData = snap.data();
                    if (userData.password !== currentPass) {
                        showToast("Incorrect current password.", "error");
                        btn.disabled = false;
                        btn.innerHTML = 'Update Password';
                        return;
                    }

                    // Update Password
                    await updateDoc(userRef, { password: newPass });
                    showToast("Password updated successfully!", "success");

                    document.getElementById('currentPassword').value = '';
                    document.getElementById('newPassword').value = '';
                    document.getElementById('confirmNewPassword').value = '';
                }

            } catch (e) {
                console.error("Password update error:", e);
                showToast("Failed to update password.", "error");
            } finally {
                const btn = document.getElementById('changePassBtn');
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = 'Update Password';
                }
            }
        };
    }
    else if (pageId === 'settingsPage') {
        await initSettings();
    }
    else if (pageId === 'merchandisingPage') {
        const { initMerchandising } = await import('./merchandising.js');
        initMerchandising();
    }
    else if (pageId === 'merchandisingBuyersPage') {
        const { initMerchandisingBuyers } = await import('./merchandising.js');
        initMerchandisingBuyers();
    }
    else if (pageId === 'myTasksPage') {
        const { initMyTasks } = await import('./myTasks.js');
        initMyTasks();
    }
    else if (pageId === 'myDiaryPage') {
        const { initMyDiary } = await import('./myDiary.js');
        initMyDiary();
    }
    else if (pageId === 'profilePage') {
        console.log("👤 Initializing Profile Page...");
        const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
        console.log("Current User Data:", currentUser);

        // Populate Header with Login Username (as requested)
        const nameDisplay = document.getElementById('profilePageNameDisplay');
        if (nameDisplay) {
            nameDisplay.textContent = '@' + (currentUser.username || 'User');
            console.log("Set Header to:", nameDisplay.textContent);
        } else {
            console.error("❌ profilePageNameDisplay not found!");
        }

        // Populate Subtitle with Real Name
        const usernameDisplay = document.getElementById('profilePageUsernameDisplay');
        if (usernameDisplay) {
            usernameDisplay.textContent = currentUser.fullName || 'No Name Set';
            console.log("Set Subtitle to:", usernameDisplay.textContent);
        }

        // Populate Input
        const nameInput = document.getElementById('profilePageName');
        if (nameInput) nameInput.value = currentUser.fullName || currentUser.username || '';

        // Populate Image
        const img = document.getElementById('profilePageImage');
        if (img && currentUser.image) img.src = currentUser.image;
    }
}


// Clock Modal Logic (Preserved)
window.showClockModal = function () {
    const modalEl = document.getElementById('clockModal');
    if (!modalEl) return;
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
    updateClock();
    if (!window.clockInterval) {
        window.clockInterval = setInterval(updateClock, 1000);
    }
};

function updateClock() {
    const now = new Date();
    const timeEl = document.getElementById('clockTime');
    const dateEl = document.getElementById('clockDate');
    if (timeEl) timeEl.textContent = now.toLocaleTimeString('en-US', { hour12: true });
    if (dateEl) dateEl.textContent = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}
