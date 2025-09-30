import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

// Service account credentials can be stored in environment variables
// For local development, you might use a serviceAccount.json file
// but it's more secure to use environment variables in production.
// const serviceAccount = process.env.GOOGLE_APPLICATION_CREDENTIALS 
//   ? JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS) 
//   : undefined;

let adminDb: Firestore;

function initializeAdmin() {
  // Check if there are any initialized apps
  if (getApps().length > 0) {
    // If an app is already initialized, get the Firestore instance from it
    adminDb = getFirestore(getApps()[0]);
  } else {
    // If no app is initialized, initialize a new one
    // const credential = serviceAccount ? cert(serviceAccount) : undefined;
    initializeApp({
      // credential
    });
    adminDb = getFirestore();
  }
  return adminDb;
}

// Initialize and export the db instance.
// This function ensures that initialization happens only once.
adminDb = initializeAdmin();

export { adminDb };
