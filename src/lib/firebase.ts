import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";

const firebaseConfig = {
  "projectId": "studio-3737899036-7f9e4",
  "appId": "1:726562212716:web:341ba95bdf30de1d6e8149",
  "apiKey": "AIzaSyCJfg46kRm5OA_s8xTceG81lMqJpeeTdEM",
  "authDomain": "studio-3737899036-7f9e4.firebaseapp.com",
  "measurementId": "",
  "storageBucket": "studio-3737899036-7f9e4.appspot.com",
  "messagingSenderId": "726562212716"
};

const app: FirebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth: Auth = getAuth(app);
const db: Firestore = getFirestore(app);

if (typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence);
}

export { app, auth, db };
