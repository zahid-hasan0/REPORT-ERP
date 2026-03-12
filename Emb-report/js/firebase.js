
const firebaseConfig = {
    apiKey: "AIzaSyAYi7iZPhSWpZP9JFda8WREaLQ6mZHksjY",
    authDomain: "item-notes.firebaseapp.com",
    projectId: "item-notes",
    storageBucket: "item-notes.firebasestorage.app",
    messagingSenderId: "937625064892",
    appId: "1:937625064892:web:c73a10c2e747cf8fb847b9",
    measurementId: "G-QHHV6X5XE6"
};

if (typeof firebase === 'undefined') {
    console.error("Firebase SDK not loaded.");
} else {
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
}


const db = firebase.firestore();
const REPORTS_COLLECTION = "emb job storage";
