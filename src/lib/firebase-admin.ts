
import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';


let adminDb: Firestore;


// This robust singleton pattern ensures Firebase is initialized only once.
if (getApps().length === 0) {
  // Pass no arguments to initializeApp() to allow the SDK to automatically
  // discover credentials from the environment. This is the most robust way
  // to authenticate in managed environments like App Hosting or Cloud Workstations.
  initializeApp();
}

adminDb = getFirestore();

try {
  // Firestore has a maximum batch size of 500.
  // This settings call will only succeed on the very first initialization.
  // Subsequent calls will throw an error, which we safely ignore in the catch block.
  adminDb.settings({
      batchRequests: 500,
  });
} catch (e) {
  // This is expected and fine if settings have already been applied.
}


export { adminDb };
