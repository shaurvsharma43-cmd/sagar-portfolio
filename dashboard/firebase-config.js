// Firebase Web SDK Modular Configuration (100% Free Spark Tier - Auth & Firestore only)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
  getAuth, 
  onAuthStateChanged, 
  signInWithPopup, 
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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

export {
  app,
  auth,
  db,
  googleProvider,
  onAuthStateChanged,
  signInWithPopup,
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
