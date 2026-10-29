import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { INITIAL_PRODUCTS } from '../src/data/initialCatalog.js';

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
const colRef = collection(db, 'productos');

async function syncPrices() {
  console.log('🔄 Iniciando sincronización de precios oficiales para Buenos Aires en Firestore...');
  
  // 1. Obtener productos actuales en Firestore
  const snapshot = await getDocs(colRef);
  const existingDocs = new Map();
  snapshot.docs.forEach(d => {
    existingDocs.set(d.id, d.data());
    // También mapear por nombre en minúsculas por si el ID difiere
    const nameKey = (d.data().nombre || '').toLowerCase().trim();
    if (nameKey) existingDocs.set(nameKey, { id: d.id, ...d.data() });
  });

  console.log(`📦 Encontrados ${snapshot.size} productos en Firestore.`);

  let updatedCount = 0;
  let createdCount = 0;

  for (const officialProd of INITIAL_PRODUCTS) {
    const docId = officialProd.id;
    const nameKey = officialProd.nombre.toLowerCase().trim();
    const existing = existingDocs.get(docId) || existingDocs.get(nameKey);

    const targetDocId = existing?.id || docId;
    const docToUpdate = doc(colRef, targetDocId);

    // Mantener los valores de Villa España intactos si ya existen
    const finalPrecios = {
      buenosAires: officialProd.precios.buenosAires,
      villaEspana: existing?.precios?.villaEspana ?? existing?.precio_VE ?? officialProd.precios.villaEspana
    };

    const finalStock = {
      buenosAires: existing?.stock?.buenosAires ?? existing?.stock_BA ?? officialProd.stock.buenosAires,
      villaEspana: existing?.stock?.villaEspana ?? existing?.stock_VE ?? officialProd.stock.villaEspana
    };

    const payload = {
      ...officialProd,
      id: targetDocId,
      precios: finalPrecios,
      precio: officialProd.precios.buenosAires, // fallback legacy
      precio_BA: officialProd.precios.buenosAires,
      precio_VE: finalPrecios.villaEspana,
      stock: finalStock,
      stock_BA: finalStock.buenosAires,
      stock_VE: finalStock.villaEspana,
      visible_BA: true,
      visible_VE: false, // Regla estricta: Villa España excluida de la carta pública
      mostrar_en_carta: Boolean(finalStock.buenosAires > 0),
      updatedAt: serverTimestamp()
    };

    await setDoc(docToUpdate, payload, { merge: true });

    if (existing) {
      updatedCount++;
      console.log(`  ✓ Actualizado: ${officialProd.nombre} -> BA: S/ ${officialProd.precios.buenosAires.toFixed(2)} | VE: S/ ${finalPrecios.villaEspana.toFixed(2)}`);
    } else {
      createdCount++;
      console.log(`  + Creado: ${officialProd.nombre} -> BA: S/ ${officialProd.precios.buenosAires.toFixed(2)} | VE: S/ ${finalPrecios.villaEspana.toFixed(2)}`);
    }
  }

  console.log(`\n🎉 Sincronización completada con éxito:`);
  console.log(`   - Productos actualizados con precios oficiales BA: ${updatedCount}`);
  console.log(`   - Nuevos productos registrados: ${createdCount}`);
  console.log(`   - Total procesados: ${INITIAL_PRODUCTS.length}`);
  process.exit(0);
}

syncPrices().catch(err => {
  console.error('❌ Error sincronizando precios:', err);
  process.exit(1);
});
