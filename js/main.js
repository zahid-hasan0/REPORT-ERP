// js/main.js
import { loadBookings } from './display.js';
import { showPage } from './navigation.js';
import { loadBuyers } from './buyerManager.js';
import { addNotice } from './notice.js';
import { showToast } from "./toast.js";
import { initProfile } from "./profile.js";
import { initAuthGuard, logoutUser, updateSidebarVisibility, canAccessPage, getFirstAllowedPage } from "./auth.js"; // Added getFirstAllowedPage
import { setupReportListeners } from "./summary.js";
import { initNotifications } from "./notifications.js";
import { loadUserProfile, initProfileDropdown } from "./profileManagement.js";
import { initAnnouncements } from "./announcements.js";
import { initMerchandisingGlobal } from "./merchandising.js";

// --- Zoom Level Application ---
export function applyUserZoom() {
    const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const zoom = user.zoomLevel || '100';
    console.log(`🔍 Applying User Zoom: ${zoom}%`);
    document.body.style.zoom = `${zoom}%`;
}
window.applyUserZoom = applyUserZoom;

// Hook sidebar access to zoom
window.updateSidebarAccess = function (user) {
    // This function acts as a hook. Auth.js calls it.
    applyUserZoom();
    // Also ensure visibility is updated just in case called from elsewhere
    updateSidebarVisibility(user);

    // FIX: Auto-reload content if we are stuck on a restricted view but now have access
    const appContent = document.getElementById('app-content');
    const isRestricted = appContent && appContent.innerHTML.includes('Access Restricted');

    if (isRestricted) {
        const defaultPage = user?.defaultPage || 'dashboardPage';

        // Re-import locally or use global if available
        import('./auth.js').then(m => {
            // 1. Try Default Page
            if (m.canAccessPage(defaultPage)) {
                console.log("🔓 Permissions updated! Auto-reloading default page...");
                showPage(defaultPage);
                return;
            }

            // 2. Try Smart Redirect (Any Allowed Page)
            const altPage = m.getFirstAllowedPage(user);
            if (altPage) {
                console.log(`🔓 Permissions updated! Smart Redirecting to ${altPage}...`);
                showPage(altPage);
            }

        }).catch(e => console.error(e));
    }
};

// 1. Initialize Auth Guard immediately (for redirects)
initAuthGuard();

// 2. Global window exports (for HTML onclicks)
window.logoutUser = logoutUser;
window.showPage = showPage;
window.addNotice = addNotice;

// --- Application Startup ---
window.addEventListener('load', async () => {
    console.log('🚀 Application initializing...');

    const currentUser = JSON.parse(localStorage.getItem('currentUser'));

    // Safety check: if no user, checkAuth() already handled redirect to login
    if (!currentUser) return;

    // FORCE Sidebar Visibility Update
    updateSidebarVisibility(currentUser);

    // Attach listeners
    setupReportListeners();
    initNotifications();
    initProfile();
    loadUserProfile();
    initProfileDropdown();
    initAnnouncements();

    try {
        initMerchandisingGlobal();
    } catch (e) {
        console.warn('⚠️ Merchandising initialization failed, but continuing...', e);
    }

    try {
        console.log('📦 Initializing real-time data streams...');
        // Start listeners - these provide immediate data from cache if persistence is on
        loadBookings();
        loadBuyers();

        // --- SMART ROUTING (Check URL Parameter) ---
        const urlParams = new URLSearchParams(window.location.search);
        const pageParam = urlParams.get('page');

        // --- OPEN ACCESS STARTUP ---
        const allowedModules = currentUser.allowedModules || [];

        let preferredPage = (currentUser.role === 'admin' || allowedModules.length > 0)
            ? (currentUser.defaultPage || 'homePage')
            : 'welcomePage';

        // Override if valid pageParam
        if (pageParam && canAccessPage(pageParam)) {
            console.log(`🧭 Navigation: URL Page Param found - ${pageParam}`);
            preferredPage = pageParam;
        }

        console.log(`➡️ Startup: Loading ${preferredPage}`);
        showPage(preferredPage);
        applyUserZoom();

    } catch (error) {
        console.error('❌ Error loading data:', error);
        showToast('Error loading data. Please refresh.', 'error');
    }

    // Initialize Date Widget
    updateDateWidget();
    initSidebarToggle();
});

function initSidebarToggle() {
    const toggleBtn = document.getElementById('sidebarToggle');
    const appContainer = document.querySelector('.app-container');
    const toggleText = document.getElementById('sidebarToggleText');

    if (!toggleBtn || !appContainer) {
        console.warn('⚠️ Sidebar toggle elements not found');
        return;
    }

    const updateToggleText = (collapsed) => {
        if (toggleText) {
            toggleText.textContent = collapsed ? 'Open Sidebar' : 'Close Sidebar';
        }
    };

    // Load saved state
    const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    if (isCollapsed) {
        appContainer.classList.add('app-collapsed');
        updateToggleText(true);
    }

    toggleBtn.addEventListener('click', () => {
        const currentlyCollapsed = appContainer.classList.toggle('app-collapsed');
        localStorage.setItem('sidebarCollapsed', currentlyCollapsed);
        updateToggleText(currentlyCollapsed);
    });
}

function updateDateWidget() {
    const dateEl = document.getElementById('currentDate');
    if (dateEl) {
        const now = new Date();
        const options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
        dateEl.textContent = now.toLocaleDateString('en-US', options);
    }
}

console.log('✅ main.js loaded successfully');
