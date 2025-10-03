
import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';


let adminDb: Firestore;


// This robust singleton pattern ensures Firebase is initialized only once.
if (getApps().length === 0) {
  initializeApp({
    // Explicitly set the service account to ensure stable authentication in App Hosting.
    serviceAccountId: process.env.APP_HOSTING_SERVICE_ACCOUNT,
    // Explicitly set the projectId to match the client-side configuration.
    // This ensures the Admin SDK connects to the correct database in any environment.
    projectId: "studio-3737899036-7f9e4"
  });
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
