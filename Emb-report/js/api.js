const API = {
    submitJobs: async (jobs) => {
        const batch = db.batch();
        jobs.forEach(job => {
            const { id, editable, selected, ...data } = job;
            data.submittedAt = new Date().toISOString();
            const docRef = db.collection(REPORTS_COLLECTION).doc();
            batch.set(docRef, data);
        });
        return batch.commit();
    },

    fetchReports: async () => {
        const snapshot = await db.collection(REPORTS_COLLECTION)
            .orderBy("submittedAt", "desc")
            .get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },

    updateReport: (id, updates) => {
        return db.collection(REPORTS_COLLECTION).doc(id).update(updates);
    },

    deleteReport: (id) => {
        return db.collection(REPORTS_COLLECTION).doc(id).delete();
    }
};
