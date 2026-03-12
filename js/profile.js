
// js/profile.js
import { db } from './storage.js';
import { doc, getDoc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { showToast } from "./toast.js";

// Constants
const PROFILE_DOC_ID = 'global_profile';
const PROFILE_COLLECTION = 'app_settings';
const MAX_IMAGE_WIDTH = 150; // Resize to this width
const COMPRESSION_QUALITY = 0.7; // JPEG quality

// Initialize Profile
export function initProfile() {
    console.log('👤 Initializing User Profile (Cloud Sync)...');

    // Inject Custom UI HTML if not present
    if (!document.getElementById('profileDropdownContainer')) {
        injectProfileUI();
    }

    // Listen for real-time updates
    const docRef = doc(db, PROFILE_COLLECTION, PROFILE_DOC_ID);
    onSnapshot(docRef, (doc) => {
        if (doc.exists()) {
            const data = doc.data();
            updateProfileUI(data.name, data.image);
            console.log('🔄 Profile updated from cloud');
        } else {
            console.log('⚠️ No profile found in cloud, using defaults.');
            setDoc(docRef, {
                name: 'User',
                image: null,
                updatedAt: new Date().toISOString()
            }, { merge: true });
        }
    }, (error) => {
        console.error("Error listening to profile:", error);
    });
}

// Update UI elements (Navbar & Sidebar)
function updateProfileUI(name, image) {
    // 1. Navbar Elements
    const nameEl = document.getElementById('username');
    const iconEl = document.getElementById('userProfileIcon'); // Header icon wrapper
    const imgEl = document.getElementById('userProfileImage'); // Header image tag

    // 2. Sidebar Elements (New IDs: sidebarUserName, sidebarUserImage)
    const sidebarNameEl = document.getElementById('sidebarUserName');
    const sidebarImgEl = document.querySelector('.user-mini-profile img');

    // Update Text (Header Only)
    if (name) {
        if (nameEl) nameEl.textContent = name;
    }

    // Update Image
    if (image) {
        // Navbar Image
        if (imgEl) {
            imgEl.src = image;
            imgEl.style.display = 'block';
        }
        if (iconEl) iconEl.style.display = 'none';

        // Sidebar Image
        if (sidebarImgEl) {
            sidebarImgEl.src = image;
        }

        // Dropdown Preview
        const dropdownPreview = document.getElementById('profileImagePreview');
        if (dropdownPreview && dropdownPreview.style.display !== 'none' && !dropdownPreview.dataset.tempImage) {
            dropdownPreview.src = image;
        }

    } else {
        // No custom image -> Revert to defaults
        if (imgEl) imgEl.style.display = 'none';
        if (iconEl) iconEl.style.display = 'block';

        // Sidebar fallback (keep default icon)
        if (sidebarImgEl) sidebarImgEl.src = './gms icon.png';
    }
}

// Open/Toggle Profile Dropdown
export async function openProfileModal() {
    const dropdown = document.getElementById('profileDropdown');
    const container = document.getElementById('profileDropdownContainer');
    const trigger = document.getElementById('userProfileSection');

    // Toggle visibility
    if (dropdown.classList.contains('active')) {
        closeDropdown();
        return;
    }

    console.log('🔓 Opening Profile Dropdown');

    // Position the dropdown
    const rect = trigger.getBoundingClientRect();
    // Align to the right edge of the trigger, but ensure it's not off-screen
    let rightPos = window.innerWidth - rect.right;
    if (rightPos < 10) rightPos = 10; // Keep at least 10px from edge

    container.style.top = `${rect.bottom + 8}px`;
    container.style.right = `${rightPos}px`;
    container.style.left = 'auto'; // Prevent left interference
    container.style.display = 'block';

    // Fetch latest data
    const docRef = doc(db, PROFILE_COLLECTION, PROFILE_DOC_ID);
    try {
        const docSnap = await getDoc(docRef);
        const data = docSnap.exists() ? docSnap.data() : { name: document.getElementById('username').innerText, image: '' };

        // Populate fields
        document.getElementById('profileNameInput').value = (data.name || '').trim();
        document.getElementById('profileImageInput').value = '';
        delete document.getElementById('profileImagePreview').dataset.tempImage; // Clear temp

        // Setup preview
        const preview = document.getElementById('profileImagePreview');
        const placeholder = document.getElementById('profileImagePlaceholder');

        if (data.image) {
            preview.src = data.image;
            preview.style.display = 'block';
            placeholder.style.display = 'none';
        } else {
            preview.style.display = 'none';
            preview.src = '';
            placeholder.style.display = 'flex';
        }

        // Animate Open
        requestAnimationFrame(() => {
            dropdown.classList.add('active');
        });

        // Add Click Outside Listener
        setTimeout(() => {
            document.addEventListener('click', handleClickOutside);
        }, 100);

    } catch (e) {
        console.error('Error fetching profile:', e);
        showToast('Error loading profile options', 'error');
    }
}

// Close Dropdown
function closeDropdown() {
    const dropdown = document.getElementById('profileDropdown');
    const container = document.getElementById('profileDropdownContainer');

    dropdown.classList.remove('active');
    document.removeEventListener('click', handleClickOutside);

    // Wait for transition to finish before hiding container
    setTimeout(() => {
        container.style.display = 'none';
    }, 300);
}

// Handle Click Outside
function handleClickOutside(e) {
    const container = document.getElementById('profileDropdownContainer');
    const trigger = document.getElementById('userProfileSection');

    // Check if click is outside container AND trigger
    if (container && !container.contains(e.target) && !trigger.contains(e.target)) {
        closeDropdown();
    }
}

// Compress and resize image
function compressImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const scaleFactor = MAX_IMAGE_WIDTH / img.width;
                canvas.width = MAX_IMAGE_WIDTH;
                canvas.height = img.height * scaleFactor;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                // Export as JPEG with compression
                const dataUrl = canvas.toDataURL('image/jpeg', COMPRESSION_QUALITY);
                resolve(dataUrl);
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
}

// Handle Image Change for Preview
async function handleImageSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
        const compressedDataUrl = await compressImage(file);
        const preview = document.getElementById('profileImagePreview');
        const placeholder = document.getElementById('profileImagePlaceholder');

        preview.src = compressedDataUrl;
        preview.style.display = 'block';
        placeholder.style.display = 'none';

        preview.dataset.tempImage = compressedDataUrl; // Store for saving
    } catch (e) {
        console.error("Image processing failed:", e);
        showToast("Failed to process image", "error");
    }
}

// Save Profile
async function saveProfile() {
    const nameInput = document.getElementById('profileNameInput');
    const newName = nameInput.value.trim();
    const saveBtn = document.getElementById('saveProfileBtn');

    const preview = document.getElementById('profileImagePreview');
    const newImage = preview.dataset.tempImage || (preview.style.display !== 'none' ? preview.src : null);

    if (!newName) {
        showToast('Please enter a display name', 'error');
        return;
    }

    try {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Saving...';

        const profileData = {
            name: newName,
            image: newImage,
            updatedAt: new Date().toISOString()
        };

        await setDoc(doc(db, PROFILE_COLLECTION, PROFILE_DOC_ID), profileData, { merge: true });

        showToast('Profile updated!', 'success');
        closeDropdown();

    } catch (e) {
        console.error('Save error:', e);
        showToast('Error saving profile: ' + e.message, 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fas fa-save me-2"></i>Save Changes';
    }
}

// Inject Custom UI HTML
function injectProfileUI() {
    // Styling for the flap animation - Compact Version
    const styles = `
    <style>
        #profileDropdownContainer {
            position: fixed;
            z-index: 10000;
            display: none;
            perspective: 1000px;
        }
        #profileDropdown {
            background: linear-gradient(to bottom, #f8faff, #f1f5f9);
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.15);
            width: 250px; 
            padding: 15px;
            border: 1px solid rgba(0,0,0,0.1);
            transform-origin: top right;
            transform: rotateX(-90deg);
            opacity: 0;
            transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        #profileDropdown.active {
            transform: rotateX(0deg);
            opacity: 1;
        }
        /* Pointy bit */
        #profileDropdown::before {
            content: '';
            position: absolute;
            top: -6px;
            right: 20px;
            width: 12px;
            height: 12px;
            background: #f8faff;
            transform: rotate(45deg);
            border-left: 1px solid rgba(0,0,0,0.1);
            border-top: 1px solid rgba(0,0,0,0.1);
        }
    </style>
    `;

    const html = `
    ${styles}
    <div id="profileDropdownContainer">
        <div id="profileDropdown">
            <div class="d-flex justify-content-between align-items-center mb-2">
                <h6 class="mb-0 fw-bold text-dark" style="font-size: 14px;">
                    <i class="fas fa-user-cog me-2 text-primary"></i>Profile
                </h6>
                <button type="button" class="btn-close btn-sm" style="font-size: 8px;" onclick="document.dispatchEvent(new Event('closeProfile'))"></button>
            </div>
            
            <div class="text-center mb-2">
                <div class="position-relative d-inline-block">
                    <img id="profileImagePreview" src="" 
                        style="width: 60px; height: 60px; border-radius: 50%; object-fit: cover; border: 2px solid #e2e8f0; display: none;">
                    
                    <div id="profileImagePlaceholder" 
                        style="width: 60px; height: 60px; border-radius: 50%; background: #f1f5f9; display: flex; align-items: center; justify-content: center;">
                        <i class="fas fa-camera text-secondary" style="font-size: 20px;"></i>
                    </div>
                    
                    <!-- Edit Overlay -->
                    <label for="profileImageInput" class="position-absolute bottom-0 end-0 bg-primary text-white rounded-circle d-flex align-items-center justify-content-center shadow-sm" 
                           style="width: 24px; height: 24px; cursor: pointer; transition: transform 0.2s;">
                        <i class="fas fa-pen" style="font-size: 9px;"></i>
                    </label>
                </div>
            </div>

            <div class="mb-2">
                <input type="text" class="form-control form-control-sm" id="profileNameInput" placeholder="Enter name" style="font-size: 13px;">
            </div>

            <input type="file" class="d-none" id="profileImageInput" accept="image/*">

            <button type="button" class="btn btn-primary btn-sm w-100" id="saveProfileBtn" style="font-size: 13px;">
                <i class="fas fa-save me-1"></i>Save
            </button>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', html);

    // Attach Event Listeners
    document.getElementById('profileImageInput').addEventListener('change', handleImageSelect);
    // document.getElementById('saveProfileBtn').addEventListener('click', saveProfile);

    // Custom close event listener
    document.addEventListener('closeProfile', closeDropdown);
}

// Make globally available
window.openProfileModal = openProfileModal;
