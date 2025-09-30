import { initializeApp, getApps, App, ServiceAccount } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

// Ensure the app is initialized only once
if (!getApps().length) {
  initializeApp();
}

const adminDb: Firestore = getFirestore();

try {
  adminDb.settings({
      // Firestore has a maximum batch size of 500.
      batchRequests: 500,
  });
} catch (e) {
  // Settings have already been applied, this is fine.
}


export { adminDb };
