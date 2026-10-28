import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
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
  increment
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
  increment
};
