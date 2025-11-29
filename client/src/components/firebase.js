// firebase.js
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyA0x1DbzFdErh5PAeg9sequydSaT8QVrwg",
    authDomain: "multi-chatiing.firebaseapp.com",
    projectId: "multi-chatiing",
    storageBucket: "multi-chatiing.firebasestorage.app",
    messagingSenderId: "279820353236",
    appId: "1:279820353236:web:684c07fae198cc8cd0c541",
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
