import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  "projectId": "studio-3737899036-7f9e4",
  "appId": "1:726562212716:web:341ba95bdf30de1d6e8149",
  "apiKey": "AIzaSyCJfg46kRm5OA_s8xTceG81lMqJpeeTdEM",
  "authDomain": "studio-3737899036-7f9e4.firebaseapp.com",
  "measurementId": "",
  "storageBucket": "studio-3737899036-7f9e4.appspot.com",
  "messagingSenderId": "726562212716"
};


// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
