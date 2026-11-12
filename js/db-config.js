import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  collection, doc, setDoc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy
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

// Caché local persistente: la app sigue funcionando sin conexión
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});

// Autenticación anónima (necesaria para las reglas de seguridad)
const auth = getAuth(app);
const authReady = signInAnonymously(auth).catch(err => {
  console.warn('Auth anónima no disponible:', err.code);
});

// ==========================================
// Utilidad: escucha en tiempo real una colección
// ==========================================
function listen(colName, field, onData, onError) {
  authReady.then(() => {
    const q = query(collection(db, colName), orderBy(field, 'asc'));
    onSnapshot(
      q,
      snapshot => onData(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))),
      err => {
        console.error(`Error escuchando "${colName}":`, err);
        onError?.(err);
      }
    );
  });
}

// ==========================================
// 1. EJERCICIOS
// ==========================================
export function subscribeExercises(onData, onError) {
  listen('exercises', 'name', onData, onError);
}

/** El id es un slug del nombre, así es estable y no se duplica */
export async function addExercise({ id, name, target, videoUrl = '' }) {
  await authReady;
  return setDoc(doc(db, 'exercises', id), {
    name,
    target,
    videoUrl,
    createdAt: new Date().toISOString()
  });
}

// ==========================================
// 2. SERIES / LOGS
// ==========================================
export function subscribe(onData, onError) {
  listen('logs', 'ts', onData, onError);
}

export async function addSet(setData) {
  await authReady;
  return addDoc(collection(db, 'logs'), { ...setData, ts: Date.now() });
}

export async function updateSet(logId, updatedFields) {
  await authReady;
  return updateDoc(doc(db, 'logs', logId), updatedFields);
}

export async function deleteSet(logId) {
  await authReady;
  return deleteDoc(doc(db, 'logs', logId));
}