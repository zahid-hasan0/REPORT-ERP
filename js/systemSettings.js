// js/systemSettings.js
import { db } from './firebaseConfig.js';
import { collection, getDocs, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { showToast } from './toast.js';

const SETTINGS_COLLECTION = "system_settings";
const CONFIG_DOC_ID = "app_config";

let cachedSettings = null;

// Default initial settings if none exist
const DEFAULT_SETTINGS = {
    whatsapp: {
        individual: [
            { name: "Rajib Vai (DE-1)", number: "01738601614" },
            { name: "Shakil Vai (DE-2)", number: "01757461477" },
            { name: "Sabbir Vai (DE-3)", number: "01713141291" },
            { name: "Aziz Vai (DE-4)", number: "01798442258" },
            { name: "Aminul Vai (DE-5)", number: "01618941814" }
        ],
        full_report: [
            { name: "Farid Vaia", number: "01984411753" },
            { name: "Ramjan Vaia", number: "01907884179" },
            { name: "Tanvir Vaia", number: "01907884178" }
        ]
    },
    dashboard: {
        availableYears: ["2023", "2024", "2025", "2026"],
        activeMonth: "all",
        activeYear: "all"
    },
    whatsapp_templates: {
        emb_send_selected: "{jobNo}   {buyer}",
        emb_full_report: "📦 EMB STATUS REPORT ({date})\n━━━━━━━━━━━━━━━━━━━━━━\n{index}. JOB: {jobNo} ━━ {buyer} ━━ {wo} ━━ {status} ━━ {comments}"
    },
    globalNotice: "Welcome to Report Erp System!"
};

/**
 * Fetch settings from Firestore or return cached/default
 */
export async function getSystemSettings() {
    if (cachedSettings) return cachedSettings;

    try {
        const docRef = doc(db, SETTINGS_COLLECTION, CONFIG_DOC_ID);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            cachedSettings = docSnap.data();
        } else {
            // First time setup: Save defaults to Firestore
            cachedSettings = DEFAULT_SETTINGS;
            await setSystemSettings(DEFAULT_SETTINGS);
        }
        return cachedSettings;
    } catch (error) {
        console.error("Error fetching system settings:", error);
        return DEFAULT_SETTINGS; // Fallback
    }
}

/**
 * Save settings to Firestore
 */
export async function setSystemSettings(newSettings) {
    try {
        const docRef = doc(db, SETTINGS_COLLECTION, CONFIG_DOC_ID);
        await setDoc(docRef, newSettings);
        cachedSettings = newSettings;
        return true;
    } catch (error) {
        console.error("Error saving system settings:", error);
        showToast("Failed to save settings.", "error");
        return false;
    }
}

/**
 * Convenience getter for WhatsApp contacts
 */
export async function getWhatsAppContacts() {
    const settings = await getSystemSettings();
    return settings.whatsapp || DEFAULT_SETTINGS.whatsapp;
}

/**
 * Convenience getter for Dashboard years
 */
export async function getDashboardYears() {
    const settings = await getSystemSettings();
    return settings.dashboard?.availableYears || DEFAULT_SETTINGS.dashboard.availableYears;
}

/**
 * Get a specific WhatsApp template
 */
export async function getWhatsAppTemplate(templateKey) {
    const settings = await getSystemSettings();
    return settings.whatsapp_templates?.[templateKey] || DEFAULT_SETTINGS.whatsapp_templates?.[templateKey] || "";
}

/**
 * Update a specific WhatsApp template
 */
export async function updateWhatsAppTemplate(templateKey, content) {
    try {
        const settings = await getSystemSettings();
        if (!settings.whatsapp_templates) {
            settings.whatsapp_templates = {};
        }
        settings.whatsapp_templates[templateKey] = content;
        await setSystemSettings(settings);
        showToast("Template saved successfully!", "success");
        return true;
    } catch (error) {
        console.error("Error updating template:", error);
        showToast("Failed to save template.", "error");
        return false;
    }
}
