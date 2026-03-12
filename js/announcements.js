// js/announcements.js
import { db } from './storage.js';
import { collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let announcements = [];

// Initialize Announcements
export async function initAnnouncements() {
    console.log('📢 Initializing Announcements...');

    // Load announcements
    await loadAnnouncements();

    // Setup event listeners
    const announcementBtn = document.getElementById('announcement-btn');
    const closeBtn = document.getElementById('close-announcement-drawer');
    const drawer = document.getElementById('announcement-drawer');

    if (announcementBtn) {
        announcementBtn.addEventListener('click', toggleAnnouncementDrawer);
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', closeAnnouncementDrawer);
    }

    // Close on click outside
    document.addEventListener('click', (e) => {
        if (drawer && drawer.classList.contains('active')) {
            if (!drawer.contains(e.target) && !announcementBtn.contains(e.target)) {
                closeAnnouncementDrawer();
            }
        }
    });
}

// Load Announcements from Firestore
async function loadAnnouncements() {
    try {
        const q = query(collection(db, 'notices'), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);

        announcements = [];
        snapshot.forEach(doc => {
            announcements.push({
                id: doc.id,
                ...doc.data()
            });
        });

        console.log(`✅ Loaded ${announcements.length} announcements`);

        // Update badge
        updateAnnouncementBadge();

        // Render announcements
        renderAnnouncements();

    } catch (error) {
        console.error('Error loading announcements:', error);
    }
}

// Update Badge
function updateAnnouncementBadge() {
    const badge = document.getElementById('announcement-badge');
    if (!badge) return;

    if (announcements.length > 0) {
        badge.textContent = announcements.length;
        badge.classList.remove('d-none');
    } else {
        badge.classList.add('d-none');
    }
}

// Render Announcements
function renderAnnouncements() {
    const container = document.getElementById('announcement-list');
    if (!container) return;

    if (announcements.length === 0) {
        container.innerHTML = `
            <div class="text-center p-5 text-white">
                <i class="fas fa-inbox fa-3x mb-3 d-block opacity-50"></i>
                <p class="mb-0" style="font-size: 15px; font-weight: 500;">No announcements at this moment</p>
            </div>
        `;
        return;
    }

    container.innerHTML = announcements.map((announcement, index) => `
        <div class="announcement-card" style="animation: slideIn 0.3s ease ${index * 0.05}s both;">
            <div class="announcement-card-header">
                <div class="announcement-card-icon">
                    <i class="fas fa-bullhorn"></i>
                </div>
                <div style="flex: 1;">
                    <div style="font-weight: 600; color: #1e293b; font-size: 0.85rem;">
                        Announcement #${index + 1}
                    </div>
                    <div style="font-size: 0.75rem; color: #64748b;">
                        ${formatDate(announcement.createdAt)}
                    </div>
                </div>
            </div>
            <div class="announcement-card-text">
                ${announcement.text}
            </div>
        </div>
    `).join('');
}

// Format Date
function formatDate(dateString) {
    if (!dateString) return 'Recently';

    try {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
        });
    } catch (e) {
        return 'Recently';
    }
}

// Toggle Drawer
function toggleAnnouncementDrawer() {
    const drawer = document.getElementById('announcement-drawer');
    if (!drawer) return;

    drawer.classList.toggle('active');
}

// Close Drawer
function closeAnnouncementDrawer() {
    const drawer = document.getElementById('announcement-drawer');
    if (!drawer) return;

    drawer.classList.remove('active');
}

// Add slideIn animation to CSS dynamically
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            opacity: 0;
            transform: translateX(20px);
        }
        to {
            opacity: 1;
            transform: translateX(0);
        }
    }
`;
document.head.appendChild(style);

console.log('✅ announcements.js loaded');
