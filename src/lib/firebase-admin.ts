import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';


let adminDb: Firestore;




function initializeAdmin() {
  const BATCH_REQUESTS_MAX = 500;
  if (getApps().length > 0) {
    adminDb = getFirestore(getApps()[0]);
    adminDb.settings({
        batchRequests: BATCH_REQUESTS_MAX,
    });
  } else {
    initializeApp();
    adminDb = getFirestore();
    adminDb.settings({
        batchRequests: BATCH_REQUESTS_MAX,
    });
  }
  return adminDb;
}

adminDb = initializeAdmin();

export { adminDb };
