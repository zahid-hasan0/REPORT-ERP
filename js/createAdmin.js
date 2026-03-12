// createAdmin.js
// Run this script ONCE to create the default admin user: zahidadmin / password123
// Uses DIRECT FIRESTORE WRITE (No Auth SDK)

import { db } from './firebaseConfig.js';
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

async function createDefaultAdmin() {
    const username = 'zahidadmin';
    const password = 'password123';

    console.log(`🚀 Attempting to create default admin: ${username}`);

    try {
        const userRef = doc(db, "users", username);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            console.log("✅ Admin user already exists in Firestore.");
            // Optional: Force update role to admin to be safe
            await setDoc(userRef, {
                role: 'admin',
                isApproved: true,
                isActive: true
            }, { merge: true });
            console.log("✅ Admin permissions enforced.");
            return;
        }

        // Create User Doc
        await setDoc(userRef, {
            username: username,
            password: password,
            fullName: 'Zahid Admin',
            role: 'admin',
            isApproved: true,
            createdAt: new Date().toISOString(),
            allowedModules: ['all']
        });

        console.log('✅ Default Admin Created Successfully!');
        console.log('Username:', username);
        console.log('Password:', password);

    } catch (error) {
        console.error("❌ Failed to create admin:", error);
    }
}

// Auto-run
createDefaultAdmin();
