import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    signOut, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword,
    updatePassword,
    sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import { 
    getFirestore, 
    doc, 
    getDoc, 
    setDoc, 
    collection, 
    addDoc, 
    query, 
    where, 
    getDocs, 
    onSnapshot, 
    deleteDoc, 
    updateDoc, 
    arrayUnion, 
    arrayRemove, 
    orderBy, 
    limit, 
    writeBatch,
    increment 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAMTYZGCkVv1QausRJSyutrSUUvJ0mkqD4",
  authDomain: "koopplatform-dd9f8.firebaseapp.com",
  projectId: "koopplatform-dd9f8",
  storageBucket: "koopplatform-dd9f8.firebasestorage.app",
  messagingSenderId: "757328538678",
  appId: "1:757328538678:web:ffc9994b42025765b1fc97",
  measurementId: "G-R9K7G471FN"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { 
    firebaseConfig,
    app, auth, db, 
    onAuthStateChanged, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, updatePassword, sendPasswordResetEmail,
    doc, getDoc, setDoc, collection, addDoc, query, where, getDocs, onSnapshot, deleteDoc, updateDoc, 
    arrayUnion, arrayRemove, orderBy, limit, writeBatch, increment
};