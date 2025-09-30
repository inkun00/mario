import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

// Ensure Firebase Admin is initialized only once.
if (!getApps().length) {
  initializeApp();
}

const adminDb: Firestore = getFirestore();

export { adminDb };
