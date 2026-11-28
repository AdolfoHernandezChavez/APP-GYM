import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  collection, doc, setDoc, addDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBFtZThlC4DYXwewdN3xLVkcHukvZX8IeA",
  authDomain: "gym-sirenita.firebaseapp.com",
  projectId: "gym-sirenita",
  storageBucket: "gym-sirenita.firebasestorage.app",
  messagingSenderId: "555975086964",
  appId: "1:555975086964:web:8311c04907985792d99221",
  measurementId: "G-NRPYELN96M"
};

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});
const auth = getAuth(app);

// ===== Acceso (cuentas de correo; la sesión se guarda en el móvil) =====
export const watchAuth = cb => onAuthStateChanged(auth, cb);
export const login = (email, pass) => signInWithEmailAndPassword(auth, email, pass);
export const logout = () => signOut(auth);
export const resetPassword = email => sendPasswordResetEmail(auth, email);

/** Escucha una colección en tiempo real y devuelve la función para dejar de escuchar */
function listen(colName, field, onData, onError) {
  return onSnapshot(
    query(collection(db, colName), orderBy(field, 'asc')),
    snap => onData(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    err => { console.error(`Error escuchando "${colName}":`, err); onError?.(err); }
  );
}

// ===== Ejercicios =====
export const subscribeExercises = (onData, onError) => listen('exercises', 'name', onData, onError);
export const addExercise = ({ id, name, target, videoUrl = '' }) =>
  setDoc(doc(db, 'exercises', id), { name, target, videoUrl, createdAt: new Date().toISOString() });
export const deleteExercise = id => deleteDoc(doc(db, 'exercises', id));

// ===== Series =====
export const subscribe = (onData, onError) => listen('logs', 'ts', onData, onError);
export const addSet = setData => addDoc(collection(db, 'logs'), { ...setData, ts: Date.now() });
export const updateSet = (id, fields) => updateDoc(doc(db, 'logs', id), fields);
export const deleteSet = id => deleteDoc(doc(db, 'logs', id));

// ===== Ciclo (solo perfil de Ariel) =====
export const subscribeCycle = (onData, onError) => listen('cycle', 'start', onData, onError);
export const addPeriod = p => addDoc(collection(db, 'cycle'), p);
export const updatePeriod = (id, fields) => updateDoc(doc(db, 'cycle', id), fields);
export const deletePeriod = id => deleteDoc(doc(db, 'cycle', id));
