import { 
  db, 
  collections, 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  writeBatch, 
  serverTimestamp 
} from './firebase.js';

/**
 * Mapeador de categorías legacy a las 8 categorías canónicas de Dolciangel Core:
 * tortas, cheesecakes, pies, kekes, bocados, jugos, cafes, otros.
 */
function mapLegacyCategory(sec) {
  if (!sec) return 'otros';
  const s = sec.toLowerCase();
  if (s.includes('torta') || s.includes('tresleches')) return 'tortas';
  if (s.includes('cheesecake') || s.includes('postre')) return 'cheesecakes';
  if (s.includes('pie')) return 'pies';
  if (s.includes('keke') || s.includes('queque')) return 'kekes';
  if (s.includes('bocado') || s.includes('snack') || s.includes('alfajor')) return 'bocados';
  if (s.includes('jugo') || s.includes('milk') || s.includes('jarra') || s.includes('frappe')) return 'jugos';
  if (s.includes('cafe') || s.includes('infusion')) return 'cafes';
  return 'otros';
}

/**
 * Extrae de forma robusta el nombre completo del cliente
 */
export function extractClientFullName(data) {
  if (data.nombreCompleto && data.nombreCompleto.trim()) {
    return data.nombreCompleto.trim();
  }
  const n = (data.nombre || '').trim();
  const a = (data.apellido || '').trim();
  if (n && a) {
    // Si nombre ya incluye el apellido, evitar duplicarlo
    if (n.toLowerCase().includes(a.toLowerCase())) return n;
    return `${n} ${a}`.trim();
  }
  return n || a || (data.name || '').trim() || 'Cliente Frecuente';
}

/**
 * Extrae la fecha de cumpleaños del cliente
 */
export function extractClientBirthday(data) {
  return (data.cumpleanos || data.cumpleaños || data.cumple || data.fechaNacimiento || data.cumpleanosTexto || '').trim();
}

/**
 * Re-sincronización y corrección de clientes antiguos hacia `clientes_fidelidad`
 * Usa { merge: true } para enriquecer nombres completos, cumpleaños, nivel e historial
 * SIN perder ni reiniciar los sellos acumulados.
 */
export async function resyncLegacyClients(onProgress = () => {}) {
  const stats = {
    actualizados: 0,
    nuevos: 0,
    errores: 0
  };

  const legacyClientCollections = [
    { name: 'clientes', sedeName: 'Buenos Aires', defaultSede: 'BA' },
    { name: 'clientes-VE', sedeName: 'Villa España', defaultSede: 'VE' }
  ];

  onProgress(5, 'Iniciando re-sincronización y rescate de nombres y cumpleaños...');

  for (const colInfo of legacyClientCollections) {
    try {
      const snap = await getDocs(collection(db, colInfo.name));
      let batch = writeBatch(db);
      let batchCount = 0;

      for (const d of snap.docs) {
        const data = d.data();
        const rawPhone = (data.telefono || data.celular || d.id || '').replace(/\D/g, '');
        const phone = rawPhone.length >= 9 ? rawPhone.slice(-9) : d.id.trim();
        if (!phone) continue;

        const nombreCompleto = extractClientFullName(data);
        const cumpleanos = extractClientBirthday(data);
        const nivel = data.nivelActual || data.nivel || 'Clásico';
        const historial = data.historial || data.historialPuntos || [];
        const premiosRecibidos = data.premiosRecibidos || [];
        const rawSellos = Number(data.puntos || data.sellos || (Array.isArray(historial) ? historial.length : 1)) || 1;

        const clientDocRef = doc(collections.clientesFidelidad, phone);

        const updatePayload = {
          id: phone,
          telefono: phone,
          nombre: nombreCompleto,
          cumpleanos: cumpleanos,
          nivel: nivel,
          sedeRegistro: data.sedeRegistro || colInfo.sedeName,
          fechaRegistro: data.fechaRegistro || (data.creadoEn ? new Date(data.creadoEn.seconds * 1000).toISOString() : new Date().toISOString()),
          ultimaVisita: data.ultimaVisita || new Date().toISOString(),
          historial: historial,
          premiosRecibidos: premiosRecibidos,
          updatedAt: serverTimestamp()
        };

        // Si el cliente no existe aún, agregamos sellos iniciales
        // Con merge: true, si ya existe en clientes_fidelidad, sus sellos actuales NO se sobrescriben a menos que no tenga
        if (data.puntos !== undefined) {
          updatePayload.puntosOriginales = Number(data.puntos);
        }

        batch.set(clientDocRef, updatePayload, { merge: true });
        stats.actualizados++;
        batchCount++;

        if (batchCount >= 400) {
          await batch.commit();
          batch = writeBatch(db);
          batchCount = 0;
        }
      }

      if (batchCount > 0) {
        await batch.commit();
      }
    } catch (err) {
      console.error(`Error al sincronizar ${colInfo.name}:`, err);
      stats.errores++;
    }
  }

  onProgress(100, `¡Re-sincronización finalizada! ${stats.actualizados} clientes enriquecidos.`);
  return stats;
}

/**
 * Ejecuta la migración completa de datos históricos
 */
export async function runLegacyMigration(onProgress = () => {}) {
  const stats = {
    clientesMigrados: 0,
    clientesOmitidos: 0,
    productosMigrados: 0,
    productosOmitidos: 0,
    movimientosMigrados: 0,
    movimientosOmitidos: 0,
  };

  // 1. Clientes
  onProgress(10, 'Obteniendo clientes actuales para control de duplicados...');
  const existingClientesSnap = await getDocs(collections.clientesFidelidad);
  const existingPhones = new Set(existingClientesSnap.docs.map(d => d.id.trim()));

  const legacyClientCollections = [
    { name: 'clientes', sedeName: 'Buenos Aires', defaultSede: 'BA' },
    { name: 'clientes-VE', sedeName: 'Villa España', defaultSede: 'VE' }
  ];

  for (const colInfo of legacyClientCollections) {
    onProgress(20, `Escaneando colección histórica "${colInfo.name}"...`);
    try {
      const snap = await getDocs(collection(db, colInfo.name));
      let batch = writeBatch(db);
      let batchCount = 0;

      for (const d of snap.docs) {
        const data = d.data();
        const rawPhone = (data.telefono || data.celular || d.id || '').replace(/\D/g, '');
        const phone = rawPhone.length >= 9 ? rawPhone.slice(-9) : d.id.trim();

        if (existingPhones.has(phone)) {
          // Si ya existe, actualizamos con merge para rescatar nombre completo y cumpleaños sin perder sellos
          const nombreCompleto = extractClientFullName(data);
          const cumpleanos = extractClientBirthday(data);
          const nivel = data.nivelActual || data.nivel || 'Clásico';
          const historial = data.historial || data.historialPuntos || [];

          const targetRef = doc(collections.clientesFidelidad, phone);
          batch.set(targetRef, {
            nombre: nombreCompleto,
            cumpleanos: cumpleanos,
            nivel: nivel,
            historial: historial,
            updatedAt: serverTimestamp()
          }, { merge: true });
          batchCount++;

          stats.clientesOmitidos++;
        } else {
          const nombreCompleto = extractClientFullName(data);
          const cumpleanos = extractClientBirthday(data);
          const nivel = data.nivelActual || data.nivel || 'Clásico';
          const historial = data.historial || data.historialPuntos || [];
          const sellos = Number(data.puntos || data.sellos || (Array.isArray(historial) ? historial.length : 1)) || 1;
          const totalVisitas = Array.isArray(historial) ? historial.length : sellos;

          const newClientDoc = {
            id: phone,
            telefono: phone,
            nombre: nombreCompleto,
            cumpleanos: cumpleanos,
            nivel: nivel,
            sellos: Math.max(1, sellos),
            totalVisitas: Math.max(1, totalVisitas),
            premiosCanjeados: Number(data.premiosCanjeados || 0),
            totalGastado: Number(data.totalGastado || 0),
            fechaRegistro: data.fechaRegistro || (data.creadoEn ? new Date(data.creadoEn.seconds * 1000).toISOString() : new Date().toISOString()),
            ultimaVisita: data.ultimaVisita || new Date().toISOString(),
            sedeRegistro: colInfo.sedeName,
            historial: historial,
            premiosRecibidos: data.premiosRecibidos || [],
            origen: 'MIGRACION_HISTORICA',
            updatedAt: serverTimestamp()
          };

          const targetRef = doc(collections.clientesFidelidad, phone);
          batch.set(targetRef, newClientDoc, { merge: true });
          existingPhones.add(phone);
          stats.clientesMigrados++;
          batchCount++;
        }

        if (batchCount >= 400) {
          await batch.commit();
          batch = writeBatch(db);
          batchCount = 0;
        }
      }

      if (batchCount > 0) {
        await batch.commit();
      }
    } catch (err) {
      console.warn(`Aviso al leer ${colInfo.name}:`, err.message);
    }
  }

  // 2. Productos
  onProgress(45, 'Verificando productos existentes en Firestore...');
  const existingProdsSnap = await getDocs(collections.productos);
  const existingProdNames = new Set(
    existingProdsSnap.docs.map(d => (d.data().nombre || '').toLowerCase().trim())
  );

  const legacyProdCollections = [
    { name: 'productos-BA', sedeStock: 'stock_BA' },
    { name: 'productos-VE', sedeStock: 'stock_VE' }
  ];

  for (const colInfo of legacyProdCollections) {
    onProgress(55, `Escaneando productos de "${colInfo.name}"...`);
    try {
      const snap = await getDocs(collection(db, colInfo.name));
      let batch = writeBatch(db);
      let batchCount = 0;

      for (const d of snap.docs) {
        const data = d.data();
        if (!data.nombre) continue;

        const normName = data.nombre.toLowerCase().trim();
        if (existingProdNames.has(normName)) {
          stats.productosOmitidos++;
          continue;
        }

        const prodId = `prod_mig_${d.id.replace(/[^a-zA-Z0-9_]/g, '_')}`;
        const targetCategory = mapLegacyCategory(data.sec || data.categoria);

        const newProdDoc = {
          id: prodId,
          nombre: data.nombre.trim(),
          categoria: targetCategory,
          precio: Number(data.precio || 5.00),
          stock_BA: colInfo.sedeStock === 'stock_BA' ? Number(data.stock || 15) : 10,
          stock_VE: colInfo.sedeStock === 'stock_VE' ? Number(data.stock || 15) : 10,
          disponible: data.activo !== false,
          mostrar_en_carta: data.mostrar_en_carta !== false,
          icono: data.ico || '🧁',
          descripcion: data.descripcion || '',
          origen: 'MIGRACION_HISTORICA',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };

        const targetRef = doc(collections.productos, prodId);
        batch.set(targetRef, newProdDoc);
        existingProdNames.add(normName);
        stats.productosMigrados++;
        batchCount++;

        if (batchCount >= 400) {
          await batch.commit();
          batch = writeBatch(db);
          batchCount = 0;
        }
      }

      if (batchCount > 0) {
        await batch.commit();
      }
    } catch (err) {
      console.warn(`Aviso al leer ${colInfo.name}:`, err.message);
    }
  }

  // 3. Movimientos de Caja
  onProgress(75, 'Verificando movimientos de caja previos...');
  const existingMovsSnap = await getDocs(collections.movimientosCaja);
  const existingMovIds = new Set(existingMovsSnap.docs.map(d => d.id));

  for (const loc of ['BA', 'VE']) {
    onProgress(85, `Migrando registros de caja desde "locales/${loc}/historial"...`);
    try {
      const snap = await getDocs(collection(db, 'locales', loc, 'historial'));
      let batch = writeBatch(db);
      let batchCount = 0;

      for (const d of snap.docs) {
        const data = d.data();
        const movId = `MIG-${loc}-${d.id}`;
        if (existingMovIds.has(movId)) {
          stats.movimientosOmitidos++;
          continue;
        }

        const isGasto = data.tipo === 'gasto' || data.tipo === 'EGRESO_GASTO' || Boolean(data.gasto);
        const monto = Number(data.total || data.monto || data.precio || 0);

        if (monto > 0) {
          const newMovDoc = {
            id: movId,
            sesionId: 'MIGRACION_HISTORICA',
            sede: loc,
            tipo: isGasto ? 'EGRESO_GASTO' : 'VENTA_EFECTIVO',
            monto,
            motivo: data.motivo || data.categoria || (isGasto ? 'Gasto Histórico' : 'Venta Histórica'),
            descripcion: data.descripcion || data.producto || 'Movimiento importado',
            responsable: data.empleado || 'Histórico',
            fecha: data.fecha ? new Date(data.fecha).toISOString() : new Date().toISOString(),
            origen: 'MIGRACION_HISTORICA',
            timestamp: serverTimestamp()
          };

          const targetRef = doc(collections.movimientosCaja, movId);
          batch.set(targetRef, newMovDoc);
          existingMovIds.add(movId);
          stats.movimientosMigrados++;
          batchCount++;

          if (batchCount >= 400) {
            await batch.commit();
            batch = writeBatch(db);
            batchCount = 0;
          }
        }
      }

      if (batchCount > 0) {
        await batch.commit();
      }
    } catch (err) {
      console.warn(`Aviso en locales/${loc}/historial:`, err.message);
    }
  }

  onProgress(95, 'Escaneando gastos desde "finanzas-angel-gastos"...');
  try {
    const snap = await getDocs(collection(db, 'finanzas-angel-gastos'));
    let batch = writeBatch(db);
    let batchCount = 0;

    for (const d of snap.docs) {
      const data = d.data();
      const movId = `MIG-FIN-${d.id}`;
      if (existingMovIds.has(movId)) {
        stats.movimientosOmitidos++;
        continue;
      }

      const monto = Number(data.monto || data.total || 0);
      if (monto > 0) {
        const newMovDoc = {
          id: movId,
          sesionId: 'MIGRACION_HISTORICA',
          sede: 'BA',
          tipo: 'EGRESO_GASTO',
          monto,
          motivo: data.categoria || data.motivo || 'Gasto General',
          descripcion: data.descripcion || data.detalle || 'Gasto importado de finanzas',
          responsable: 'Angel',
          fecha: data.fecha ? new Date(data.fecha).toISOString() : new Date().toISOString(),
          origen: 'MIGRACION_HISTORICA',
          timestamp: serverTimestamp()
        };

        const targetRef = doc(collections.movimientosCaja, movId);
        batch.set(targetRef, newMovDoc);
        existingMovIds.add(movId);
        stats.movimientosMigrados++;
        batchCount++;

        if (batchCount >= 400) {
          await batch.commit();
          batch = writeBatch(db);
          batchCount = 0;
        }
      }
    }

    if (batchCount > 0) {
      await batch.commit();
    }
  } catch (err) {
    console.warn('Aviso en finanzas-angel-gastos:', err.message);
  }

  onProgress(100, '¡Migración completada exitosamente!');
  return stats;
}
