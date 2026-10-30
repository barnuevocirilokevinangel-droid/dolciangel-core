import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  writeBatch, 
  Timestamp 
} from 'firebase/firestore';

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

function parseDateAndTimestamp(data) {
  // Si ya tiene Firestore Timestamp
  if (data.timestamp && typeof data.timestamp.toMillis === 'function') {
    const millis = data.timestamp.toMillis();
    return {
      fecha: new Date(millis).toISOString(),
      timestamp: data.timestamp
    };
  } else if (data.timestamp && data.timestamp.seconds) {
    const millis = data.timestamp.seconds * 1000 + (data.timestamp.nanoseconds || 0) / 1000000;
    return {
      fecha: new Date(millis).toISOString(),
      timestamp: Timestamp.fromMillis(millis)
    };
  }

  // Si tiene fecha 'YYYY-MM-DD' y hora 'HH:mm'
  if (data.fecha) {
    const timeStr = data.hora ? `${data.hora}:00` : '12:00:00';
    const dateObj = new Date(`${data.fecha}T${timeStr}`);
    if (!isNaN(dateObj.getTime())) {
      return {
        fecha: dateObj.toISOString(),
        timestamp: Timestamp.fromDate(dateObj)
      };
    }
  }

  // Fallback a fecha actual
  const now = new Date();
  return {
    fecha: now.toISOString(),
    timestamp: Timestamp.fromDate(now)
  };
}

function parseMetodoPago(raw) {
  if (!raw) return 'EFECTIVO';
  const str = String(raw).toLowerCase().trim();
  if (str.includes('yape') || str.includes('plin')) return 'YAPE_PLIN';
  if (str.includes('tarjeta') || str.includes('card') || str.includes('pos')) return 'TARJETA';
  return 'EFECTIVO';
}

async function migrateOldSales() {
  console.log('🚀 Iniciando Migración Exclusiva de Ventas Históricas a la colección "ventas"...');

  // 1. Obtener IDs ya existentes en 'ventas' para garantizar idempotencia estricta
  const existingVentasSnap = await getDocs(collection(db, 'ventas'));
  const existingVentaIds = new Set(existingVentasSnap.docs.map(d => d.id));
  console.log(`📊 Ventas actuales en colección 'ventas': ${existingVentasSnap.size}`);

  let totalMigrated = 0;
  let totalSkipped = 0;

  const sources = [
    { loc: 'BA', sedeNombre: 'Buenos Aires', sedeSlug: 'buenosAires' },
    { loc: 'VE', sedeNombre: 'Villa España', sedeSlug: 'villaEspana' }
  ];

  for (const src of sources) {
    console.log(`\n📂 Leyendo historial de "${src.loc}" (locales/${src.loc}/historial)...`);
    const historyCol = collection(db, 'locales', src.loc, 'historial');
    const snap = await getDocs(historyCol);
    console.log(`Encontrados ${snap.size} documentos en locales/${src.loc}/historial.`);

    let batch = writeBatch(db);
    let batchCount = 0;

    for (const d of snap.docs) {
      const data = d.data();
      const targetDocId = `V-HIST-${src.loc}-${d.id}`;

      if (existingVentaIds.has(targetDocId) || existingVentaIds.has(d.id)) {
        totalSkipped++;
        continue;
      }

      // Descartar si es explícitamente un gasto
      if (data.tipo === 'gasto' || data.tipo === 'EGRESO_GASTO' || data.gasto) {
        continue;
      }

      const { fecha, timestamp } = parseDateAndTimestamp(data);
      const metodoPago = parseMetodoPago(data.metodoPago);
      const vendedor = data.empleado || data.vendedor || (src.loc === 'VE' ? 'Mariana / Kokin' : 'Marlon / Georgette');

      // Determinar items y total
      let items = [];
      let total = 0;

      if (Array.isArray(data.ventas) && data.ventas.length > 0) {
        // Documento agregado (como los diarios de BA)
        items = data.ventas.map((it, idx) => {
          const qty = Number(it.cantidad || 1);
          const sub = Number(it.total || (Number(it.precio || 0) * qty) || 0);
          return {
            id: it.productoId || `prod_hist_${src.loc}_${idx}`,
            nombre: it.nombre || it.producto || 'Producto Dolciangel',
            cantidad: qty,
            precio: qty > 0 ? (sub / qty) : sub,
            subtotal: sub
          };
        });
        total = Number(data.total || items.reduce((acc, it) => acc + it.subtotal, 0));
      } else {
        // Documento individual
        const qty = Number(data.cantidad || 1);
        const sub = Number(data.total || (Number(data.precio || 0) * qty) || 0);
        items = [{
          id: data.productoId || `prod_hist_${src.loc}_${d.id}`,
          nombre: data.producto || data.nombre || 'Producto Dolciangel',
          cantidad: qty,
          precio: Number(data.precio || (qty > 0 ? sub / qty : sub)),
          subtotal: sub
        }];
        total = sub;
      }

      if (total <= 0 && items.length === 0) {
        continue;
      }

      const ventaDoc = {
        id: targetDocId,
        idOriginal: d.id,
        fecha,
        timestamp,
        sede: src.loc,
        sedeNombre: src.sedeNombre,
        sedeSlug: src.sedeSlug,
        vendedor,
        vendedorRol: 'Cajero / Atención',
        cuenta: {
          id: 'cuenta_historica',
          nombre: 'Venta Histórica',
          tipo: 'llevar'
        },
        items,
        total,
        opGravada: Number((total / 1.18).toFixed(2)),
        igv: Number((total - (total / 1.18)).toFixed(2)),
        metodoPago,
        tipoComprobante: 'NOTA_VENTA',
        cliente: {
          nombre: data.cliente || 'Público General',
          documento: data.documento || '',
          telefono: data.telefono || ''
        },
        estado: 'COMPLETADA',
        origen: 'MIGRACION_HISTORICA_VENTAS'
      };

      const docRef = doc(collection(db, 'ventas'), targetDocId);
      batch.set(docRef, ventaDoc, { merge: true });
      existingVentaIds.add(targetDocId);
      totalMigrated++;
      batchCount++;

      if (batchCount >= 400) {
        console.log(`💾 Guardando lote de ${batchCount} ventas en Firestore...`);
        await batch.commit();
        batch = writeBatch(db);
        batchCount = 0;
      }
    }

    if (batchCount > 0) {
      console.log(`💾 Guardando último lote de ${batchCount} ventas en Firestore...`);
      await batch.commit();
    }
  }

  console.log('\n=============================================');
  console.log(`✅ Migración finalizada con éxito!`);
  console.log(`📦 Ventas migradas e insertadas en 'ventas': ${totalMigrated}`);
  console.log(`⏩ Ventas omitidas (ya existentes): ${totalSkipped}`);
  console.log('=============================================\n');
}

migrateOldSales().then(() => process.exit(0)).catch(err => {
  console.error('❌ Error en la migración:', err);
  process.exit(1);
});
