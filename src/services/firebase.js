import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  enableIndexedDbPersistence,
  collection, 
  doc, 
  getDoc,
  getDocs,
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  limit, 
  serverTimestamp, 
  writeBatch,
  increment,
  runTransaction
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCOcc0JIOYONwlIHva5i7BLdGZ4OFGq1uo",
  authDomain: "dolciangel-5d2aa.firebaseapp.com",
  projectId: "dolciangel-5d2aa",
  storageBucket: "dolciangel-5d2aa.firebasestorage.app",
  messagingSenderId: "139109905813",
  appId: "1:139109905813:web:c6f1bae511ce5d9f3eb29c",
  measurementId: "G-K55LTV19EY"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

// Habilitar persistencia offline con IndexedDB
// Garantiza que ventas y comandas en mostrador se guarden localmente si se corta el wifi
if (typeof window !== 'undefined') {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('Persistencia Firestore: Múltiples pestañas abiertas. La persistencia opera en la pestaña principal.');
    } else if (err.code === 'unimplemented') {
      console.warn('Persistencia Firestore: El navegador actual no soporta almacenamiento IndexedDB.');
    }
  });
}

// Colecciones principales de Dolciangel Core
export const collections = {
  productos: collection(db, 'productos'),
  ventas: collection(db, 'ventas'),
  clientesFidelidad: collection(db, 'clientes_fidelidad'),
  movimientosCaja: collection(db, 'movimientos_caja'),
  sesionesCaja: collection(db, 'sesiones_caja'),
  kardex: collection(db, 'kardex'),
  canjesFidelidad: collection(db, 'canjes_fidelidad'),
};

export {
  db,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  writeBatch,
  increment,
  runTransaction
};
