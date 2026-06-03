// lib/firebase.js
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyA1RVbcmgXYWIkjePNnWeWC4-PTqlzcJD4",
  authDomain: "product-10c9d.firebaseapp.com",
  projectId: "product-10c9d",
  storageBucket: "product-10c9d.firebasestorage.app",
  messagingSenderId: "1027215500403",
  appId: "1:1027215500403:web:0c09dc96501f1186bfb606"
};

// Initialize Firebase for SSR compatibility
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
