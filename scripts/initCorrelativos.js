import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCOcc0JIOYONwlIHva5i7BLdGZ4OFGq1uo",
  authDomain: "dolciangel-5d2aa.firebaseapp.com",
  projectId: "dolciangel-5d2aa",
  storageBucket: "dolciangel-5d2aa.firebasestorage.app",
  messagingSenderId: "139109905813",
  appId: "1:139109905813:web:c6f1bae511ce5d9f3eb29c"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function initCorrelativos() {
  console.log('🔄 Sincronizando correlativo oficial con Arisale en Firestore...');
  const ref = doc(db, 'config', 'correlativos');
  const snap = await getDoc(ref);
  const data = snap.exists() ? snap.data() : {};

  // El último número emitido hoy fue el 1263. Por lo tanto, el siguiente correlativo a emitir debe ser 1264.
  const b002 = (!data.B002 || data.B002 < 1264) ? 1264 : data.B002;
  const f001 = data.F001 || 1;
  const nv01 = data.NV01 || 1;

  await setDoc(ref, {
    B002: b002,
    F001: f001,
    NV01: nv01,
    serieActivaBoleta: 'B002',
    sede: 'buenosAires',
    updatedAt: serverTimestamp()
  }, { merge: true });

  console.log(`✅ Correlativo configurado en Firestore: Serie B002 -> Siguiente: ${b002}`);
  process.exit(0);
}

initCorrelativos().catch(err => {
  console.error('❌ Error configurando correlativos:', err);
  process.exit(1);
});
