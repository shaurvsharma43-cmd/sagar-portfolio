// Firebase Web SDK Modular Configuration (100% Free Spark Tier - Auth & Firestore only)
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
  getAuth, 
  onAuthStateChanged, 
  signInWithPopup, 
  signInWithCustomToken,
  GoogleAuthProvider, 
  signOut 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
  getFirestore, 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  addDoc,
  updateDoc, 
  query, 
  where, 
  onSnapshot, 
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Firebase Project: dashbord-fb096
const firebaseConfig = {
  apiKey: "AIzaSyAg4lI0iuKXAp3BMduGhgQ4WM-qyANUJAY",
  authDomain: "dashbord-fb096.firebaseapp.com",
  projectId: "dashbord-fb096",
  storageBucket: "dashbord-fb096.firebasestorage.app",
  messagingSenderId: "815458390822",
  appId: "1:815458390822:web:31b7119d8874b49e31a7e7"
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// Consume one-time Discord cross-domain token handoff from URL fragment
if (typeof window !== "undefined" && window.location.hash) {
  const hashStr = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  const hashParams = new URLSearchParams(hashStr);
  const discordToken = hashParams.get("__dt");
  const authError = hashParams.get("__auth_err");

  if (discordToken) {
    hashParams.delete("__dt");
    const remaining = hashParams.toString();
    const cleanUrl = window.location.pathname + window.location.search + (remaining ? "#" + remaining : "");
    window.history.replaceState(null, "", cleanUrl);

    signInWithCustomToken(auth, discordToken).catch((err) => {
      console.error("Discord custom token authentication failed:", err);
    });
  } else if (authError) {
    hashParams.delete("__auth_err");
    const remaining = hashParams.toString();
    const cleanUrl = window.location.pathname + window.location.search + (remaining ? "#" + remaining : "");
    window.history.replaceState(null, "", cleanUrl);
    console.warn("Discord OAuth notice:", authError);
  }
}

export {
  app,
  auth,
  db,
  googleProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithCustomToken,
  signOut,
  collection,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp
};
