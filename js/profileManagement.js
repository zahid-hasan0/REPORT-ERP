// js/profileManagement.js
import { db } from './storage.js';
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { showToast } from './toast.js';

const PROFILE_COLLECTION = 'user_profiles';
const MAX_IMAGE_SIZE = 150; // Max width/height for compression
const COMPRESSION_QUALITY = 0.7;

// Toggle Sidebar Profile Dropdown
window.toggleProfileDropdown = function () {
    const dropdown = document.getElementById('sidebarProfileDropdown');
    const chevron = document.getElementById('sidebarChevron');

    // Toggle dropdown class
    const isActive = dropdown.classList.contains('active');

    if (!isActive) {
        dropdown.classList.add('active');
        if (chevron) chevron.style.transform = 'rotate(180deg)';
    } else {
        dropdown.classList.remove('active');
        if (chevron) chevron.style.transform = 'rotate(0deg)';
    }
};

// Export init function to setup listeners
export function initProfileDropdown() {
    const footerBtn = document.getElementById('sidebarFooterBtn');
    if (footerBtn) {
        footerBtn.addEventListener('click', toggleProfileDropdown);
        console.log('✅ Profile dropdown listener attached');
    } else {
        console.error('❌ Sidebar footer button not found');
    }
}

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('sidebarProfileDropdown');
    const footerBtn = document.getElementById('sidebarFooterBtn');

    if (dropdown && dropdown.classList.contains('active')) {
        if (!dropdown.contains(e.target) && !footerBtn.contains(e.target)) {
            dropdown.classList.remove('active');
            document.getElementById('sidebarChevron').style.transform = 'rotate(0deg)';
        }
    }
});

// Open Profile Edit Modal from Sidebar Dropdown
document.getElementById('sidebarEditProfileBtn')?.addEventListener('click', function () {
    // Close dropdown first
    const dropdown = document.getElementById('sidebarProfileDropdown');
    dropdown.classList.remove('active');
    document.getElementById('sidebarChevron').style.transform = 'rotate(0deg)';

    // Wait a bit for animation
    setTimeout(() => {
        const modalEl = document.getElementById('profileEditModal');
        if (!modalEl) {
            console.error('Profile Edit Modal element not found!');
            return;
        }

        // Use window.bootstrap to ensure access to the library
        const editModal = new window.bootstrap.Modal(modalEl);
        const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');

        // Populate edit modal from local data (Instant open)
        const currentName = document.getElementById('dropdownProfileName')?.textContent || currentUser.fullName || currentUser.username;
        const currentImage = document.getElementById('dropdownProfileImage')?.src || './gms icon.png';
        const role = currentUser.role === 'admin' ? 'Administrator' : 'User';

        document.getElementById('editModalProfileName').textContent = currentName;
        document.getElementById('editModalUserRole').textContent = role;
        document.getElementById('profileNameInput').value = currentName;

        const editImage = document.getElementById('editModalProfileImage');
        editImage.src = currentImage;

        editModal.show();
    }, 300);
});

// Open Profile Edit Modal (Second Step) - This listener is for the original flow, if still needed.
// If the view modal is completely removed, this listener might also be removed.
// For now, keeping it as the instruction only specified replacing openProfileModal.
document.getElementById('openEditProfileBtn')?.addEventListener('click', async function () {
    // Close view modal
    const viewModal = bootstrap.Modal.getInstance(document.getElementById('profileViewModal'));
    if (viewModal) viewModal.hide();

    // Wait a bit for animation
    setTimeout(async () => {
        const editModal = new bootstrap.Modal(document.getElementById('profileEditModal'));
        const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');

        if (!currentUser.username) {
            showToast('User session not found', 'error');
            return;
        }

        // Load current profile data
        try {
            const profileRef = doc(db, PROFILE_COLLECTION, currentUser.username);
            const profileSnap = await getDoc(profileRef);

            let profileData = {
                name: currentUser.fullName || currentUser.username,
                image: null
            };

            if (profileSnap.exists()) {
                profileData = { ...profileData, ...profileSnap.data() };
            }

            // Populate edit modal
            document.getElementById('editModalProfileName').textContent = profileData.name;
            document.getElementById('editModalUserRole').textContent = currentUser.role === 'admin' ? 'Administrator' : 'User';
            document.getElementById('profileNameInput').value = profileData.name;

            const editImage = document.getElementById('editModalProfileImage');
            if (profileData.image) {
                editImage.src = profileData.image;
            } else {
                editImage.src = './gms icon.png';
            }

            editModal.show();
        } catch (error) {
            console.error('Error loading profile:', error);
            showToast('Failed to load profile data', 'error');
        }
    }, 300);
});

// Handle Image Upload
document.getElementById('profileImageUpload')?.addEventListener('change', async function (e) {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        showToast('Please select an image file', 'error');
        return;
    }

    try {
        const compressedImage = await compressImage(file);

        // Update preview in edit modal
        document.getElementById('editModalProfileImage').src = compressedImage;

        // Store temporarily for saving
        window.tempProfileImage = compressedImage;

        showToast('Image selected. Click "Save Changes" to update.', 'info');
    } catch (error) {
        console.error('Error processing image:', error);
        showToast('Failed to process image', 'error');
    }
});

// Compress Image
function compressImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);

        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;

            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Calculate new dimensions
                if (width > height) {
                    if (width > MAX_IMAGE_SIZE) {
                        height = (height * MAX_IMAGE_SIZE) / width;
                        width = MAX_IMAGE_SIZE;
                    }
                } else {
                    if (height > MAX_IMAGE_SIZE) {
                        width = (width * MAX_IMAGE_SIZE) / height;
                        height = MAX_IMAGE_SIZE;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Convert to JPEG with compression
                const compressedDataUrl = canvas.toDataURL('image/jpeg', COMPRESSION_QUALITY);
                resolve(compressedDataUrl);
            };

            img.onerror = (err) => reject(err);
        };

        reader.onerror = (err) => reject(err);
    });
}

// Save Profile Changes
document.getElementById('saveProfileBtn')?.addEventListener('click', async function () {
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const newName = document.getElementById('profileNameInput').value.trim();

    if (!newName) {
        showToast('Please enter a name', 'error');
        return;
    }

    if (!currentUser.username) {
        showToast('User session not found', 'error');
        return;
    }

    try {
        const saveBtn = this;
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Saving...';

        const profileData = {
            name: newName,
            image: window.tempProfileImage || document.getElementById('editModalProfileImage').src,
            updatedAt: new Date().toISOString()
        };

        // Save to Firestore
        const profileRef = doc(db, PROFILE_COLLECTION, currentUser.username);
        await setDoc(profileRef, profileData, { merge: true });

        // Update localStorage
        currentUser.fullName = newName;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));

        // Update all UI elements
        document.getElementById('sidebarUserName').textContent = newName;
        document.getElementById('dropdownProfileName').textContent = newName;
        document.getElementById('editModalProfileName').textContent = newName;

        const sidebarImage = document.getElementById('sidebarProfileImage');
        const dropdownImage = document.getElementById('dropdownProfileImage');
        if (profileData.image && profileData.image !== './gms icon.png') {
            sidebarImage.src = profileData.image;
            dropdownImage.src = profileData.image;
        }

        // Clear temp image
        delete window.tempProfileImage;

        showToast('Profile updated successfully!', 'success');

        // Close edit modal
        const modalEl = document.getElementById('profileEditModal');
        if (modalEl) {
            const modal = window.bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();
        }

    } catch (error) {
        console.error('Error saving profile:', error);
        showToast('Failed to save profile: ' + error.message, 'error');
    } finally {
        const saveBtn = document.getElementById('saveProfileBtn');
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fas fa-save me-2"></i>Save Changes';
    }
});

// Load profile on page load
export async function loadUserProfile() {
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');

    if (!currentUser.username) return;

    try {
        const profileRef = doc(db, PROFILE_COLLECTION, currentUser.username);
        const profileSnap = await getDoc(profileRef);

        // Pre-populate role
        const roleText = currentUser.role === 'admin' ? 'Administrator' : 'User';
        const dropdownRole = document.getElementById('dropdownUserRole');
        if (dropdownRole) dropdownRole.textContent = roleText;

        // Populate Profile Page Role if exists
        const profilePageRole = document.getElementById('profilePageRole');
        if (profilePageRole) profilePageRole.value = roleText;

        // Default Data
        let finalName = currentUser.fullName || currentUser.username;
        let finalImage = './gms icon.png';

        if (profileSnap.exists()) {
            const profileData = profileSnap.data();
            if (profileData.name) finalName = profileData.name;
            if (profileData.image) finalImage = profileData.image;
        }

        // Update UI Elements
        // 1. Sidebar & Header
        const sidebarName = document.getElementById('sidebarUserName');
        if (sidebarName) sidebarName.textContent = finalName;

        const dropdownName = document.getElementById('dropdownProfileName');
        if (dropdownName) dropdownName.textContent = finalName;

        const sidebarImage = document.getElementById('sidebarProfileImage');
        if (sidebarImage) sidebarImage.src = finalImage;

        const dropdownImage = document.getElementById('dropdownProfileImage');
        if (dropdownImage) dropdownImage.src = finalImage;

        // 2. Profile Page Inputs (if on profile page)
        const profilePageName = document.getElementById('profilePageName');
        if (profilePageName) profilePageName.value = finalName;

        const profilePageImg = document.getElementById('profilePageImage');
        if (profilePageImg) profilePageImg.src = finalImage;

    } catch (error) {
        console.error('Error loading user profile:', error);
    }
}

console.log('✅ profileManagement.js loaded');
