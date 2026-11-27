// src/services/sunatService.js
import { db, doc, getDoc, runTransaction, serverTimestamp } from './firebase';

// Endpoints serverless reales en Vercel (APISUNAT & ApiPeru)
const EMITIR_API_URL = import.meta.env?.VITE_API_EMITIR_URL || '/api/emitir-comprobante';
const ANULAR_API_URL = import.meta.env?.VITE_API_ANULAR_URL || '/api/anular-comprobante';
const API_TOKEN = '2def7b1448e04c9763445c648197b71d7852c21deaafa1a937772798ff81254b';

export const SUNAT_CONFIG = {
  API_URL: EMITIR_API_URL,
  ANULAR_URL: ANULAR_API_URL,
  TOKEN: API_TOKEN,
  EMPRESA_RUC: '10427321351',
  EMPRESA_RAZON_SOCIAL: 'CIRILO JARA RUTH PATRICIA',
  EMPRESA_NOMBRE_COMERCIAL: 'DOLCIANGEL - PASTELERÍA FINA & CAFÉ',
  EMPRESA_DIRECCION: 'Av. Pacífico Mz. B Lt. 12 - Nuevo Chimbote',
  SERIES: {
    FACTURA: 'F001',
    BOLETA: 'B002', // Sincronizado oficialmente con Arisale (último emitido 1263 -> arranca en 1264)
    NOTA_CREDITO_FACTURA: 'FC01',
    NOTA_CREDITO_BOLETA: 'BC02',
    NOTA_VENTA: 'NV01'
  }
};

export const NUBEFACT_CONFIG = SUNAT_CONFIG;

/**
 * Valida un DNI peruano (exactamente 8 dígitos numéricos)
 */
export function validarDNI(dni) {
  if (!dni) return false;
  const clean = dni.toString().trim();
  return /^\d{8}$/.test(clean);
}

/**
 * Valida un RUC peruano (11 dígitos numéricos iniciando con 10 o 20)
 */
export function validarRUC(ruc) {
  if (!ruc) return false;
  const clean = ruc.toString().trim();
  return /^(10|20)\d{9}$/.test(clean);
}

/**
 * Consulta automática de datos de DNI / RUC mediante ApiPeru.dev vía `/api/consultar-doc`.
 */
export async function consultarDocumento({ dni, ruc }) {
  const cleanDni = dni ? dni.toString().replace(/\D/g, '').trim() : '';
  const cleanRuc = ruc ? ruc.toString().replace(/\D/g, '').trim() : '';

  // 1. Endpoint serverless en Vercel (usa process.env.APIPERU_TOKEN)
  try {
    const res = await fetch('/api/consultar-doc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dni: cleanDni, ruc: cleanRuc })
    });
    if (res.ok) {
      const json = await res.json();
      if (json && json.success && (json.data || json.nombre_completo)) {
        return json;
      }
    }
  } catch (err) {
    console.warn('Fallo al consultar /api/consultar-doc, ejecutando fallback local:', err);
  }

  // 2. Fallback directo para desarrollo local (`vite dev`) sin runtime Vercel
  const token = import.meta.env?.VITE_APIPERU_TOKEN || SUNAT_CONFIG.TOKEN;
  try {
    if (cleanDni && cleanDni.length === 8) {
      const resp = await fetch('https://apiperu.dev/api/dni', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ dni: cleanDni })
      });
      const data = await resp.json();
      if (data && data.success && data.data) {
        const nombreCompleto = data.data.nombre_completo ||
          `${data.data.nombres || ''} ${data.data.apellido_paterno || ''} ${data.data.apellido_materno || ''}`.trim();
        return {
          success: true,
          tipo: 'dni',
          nombre_completo: nombreCompleto,
          data: {
            dni: cleanDni,
            nombre_completo: nombreCompleto,
            nombres: data.data.nombres || '',
            apellido_paterno: data.data.apellido_paterno || '',
            apellido_materno: data.data.apellido_materno || ''
          }
        };
      }
    } else if (cleanRuc && cleanRuc.length === 11) {
      const resp = await fetch('https://apiperu.dev/api/ruc', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ ruc: cleanRuc })
      });
      const data = await resp.json();
      if (data && data.success && data.data) {
        const razonSocial = data.data.nombre_o_razon_social || data.data.razon_social || '';
        const direccion = data.data.direccion_completa || data.data.direccion || '';
        return {
          success: true,
          tipo: 'ruc',
          nombre_o_razon_social: razonSocial,
          direccion_completa: direccion,
          data: {
            ruc: cleanRuc,
            nombre_o_razon_social: razonSocial,
            direccion_completa: direccion,
            estado: data.data.estado || '',
            condicion: data.data.condicion || ''
          }
        };
      }
    }
  } catch (directErr) {
    console.warn('Error en fallback directo ApiPeru:', directErr);
  }

  return { success: false, message: 'No se pudo consultar el documento.' };
}

/**
 * Consulta el siguiente correlativo oficial en Firestore sin quemarlo previamente.
 * Solo Buenos Aires emite comprobantes electrónicos SUNAT (B002 / F001 / BC02 / FC01).
 * Villa España opera exclusivamente con Nota de Venta interna (NV01).
 */
export async function obtenerSiguienteCorrelativo(tipoComprobante = 'BOLETA', sede = 'BA', customSerie = null) {
  const isVE = sede === 'VE' || sede === 'villaEspana' || sede === 'Villa España';
  let serie = isVE ? 'NV01' : customSerie;
  if (!serie) {
    if (isVE || tipoComprobante === 'NOTA_VENTA' || tipoComprobante === 'Nota de Venta') {
      serie = 'NV01';
    } else if (tipoComprobante === 'FACTURA' || tipoComprobante === 'Factura') {
      serie = 'F001';
    } else {
      serie = 'B002';
    }
  }

  const defaultStarts = {
    B002: 1264,
    F001: 1,
    FC01: 1,
    BC02: 1,
    NV01: 1
  };

  const correlativoRef = doc(db, 'config', 'correlativos');

  try {
    const snap = await getDoc(correlativoRef);
    let current = defaultStarts[serie] || 1;

    if (snap.exists()) {
      const data = snap.data();
      if (data && typeof data[serie] === 'number') {
        current = Math.max(data[serie], defaultStarts[serie] || 1);
      }
    }

    const codigoCompleto = `${serie}-${String(current).padStart(8, '0')}`;
    return {
      serie,
      numero: current,
      codigoCompleto
    };
  } catch (error) {
    console.warn('Fallo en lectura de correlativo Firestore, usando fallback local:', error);
    const storageKey = `dolciangel_correlativo_${serie}`;
    const current = parseInt(localStorage.getItem(storageKey) || defaultStarts[serie] || 1, 10);
    const codigoCompleto = `${serie}-${String(current).padStart(8, '0')}`;
    return {
      serie,
      numero: current,
      codigoCompleto
    };
  }
}

/**
 * Incrementa atómicamente en Firestore el correlativo tras una emisión confirmada exitosa.
 */
export async function incrementarCorrelativo(serie = 'B002', numeroEmitido = 1264) {
  const correlativoRef = doc(db, 'config', 'correlativos');
  try {
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(correlativoRef);
      const currentInDb = snap.exists() && typeof snap.data()[serie] === 'number'
        ? snap.data()[serie]
        : numeroEmitido;
      const nextNumber = Math.max(currentInDb, numeroEmitido) + 1;
      transaction.set(correlativoRef, {
        [serie]: nextNumber,
        updatedAt: serverTimestamp()
      }, { merge: true });
    });

    const storageKey = `dolciangel_correlativo_${serie}`;
    localStorage.setItem(storageKey, (numeroEmitido + 1).toString());
  } catch (err) {
    console.warn('Fallo al incrementar correlativo en Firestore:', err);
    const storageKey = `dolciangel_correlativo_${serie}`;
    localStorage.setItem(storageKey, (numeroEmitido + 1).toString());
  }
}

/**
 * Emite un comprobante real en SUNAT mediante /api/emitir-comprobante (APISUNAT)
 * para Boletas/Facturas de Buenos Aires, o registra control interno NV01.
 */
export const emitirComprobante = async (ventaData) => {
  // 1. Villa España o Nota de Venta: control interno operativo NV01 (sin envío a SUNAT)
  const isVE = ventaData.sede === 'villaEspana' || ventaData.sede === 'VE' || ventaData.sede === 'Villa España';
  const esNotaVenta = ventaData.tipoDocumento === 'Nota de Venta' || ventaData.tipoComprobante === 'NOTA_VENTA';

  if (isVE || esNotaVenta) {
    const serie = 'NV01';
    const correlativo = ventaData.correlativo || ventaData.numero || 1;
    await incrementarCorrelativo(serie, correlativo);
    return {
      exito: true,
      success: true,
      tipo: 'interno',
      tipoDoc: 'NV',
      serie,
      numero: correlativo,
      codigoCompleto: `${serie}-${String(correlativo).padStart(8, '0')}`,
      estado_sunat: 'no_aplica',
      estado: 'CONTROL_INTERNO',
      hash_cpe: null,
      enlace_del_pdf: null,
      enlace_del_xml: null,
      mensaje: 'Comprobante interno registrado correctamente (sin valor tributario SUNAT)'
    };
  }

  // 2. Facturación Electrónica REAL con APISUNAT (/api/emitir-comprobante)
  const total = parseFloat(ventaData.total) || 0;
  const esFactura = ventaData.tipoDocumento === 'Factura' || ventaData.tipoComprobante === 'FACTURA';
  const serie = esFactura ? 'F001' : 'B002';
  const numero = esFactura
    ? (ventaData.correlativo || ventaData.numero || 1)
    : (ventaData.correlativo || 1264);

  const docCliente = (ventaData.clienteDoc || ventaData.cliente?.documento || '').toString().trim();
  const nombreCliente = (ventaData.clienteNombre || ventaData.cliente?.nombre || 'CLIENTES VARIOS').toString().trim();
  const direccionCliente = (ventaData.clienteDireccion || ventaData.cliente?.direccion || '').toString().trim();

  try {
    const response = await fetch(EMITIR_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipoComprobante: esFactura ? 'FACTURA' : 'BOLETA',
        tipoDoc: esFactura ? '01' : '03',
        serie,
        numero,
        total,
        items: ventaData.items || [],
        clienteDoc: docCliente,
        clienteNombre: nombreCliente,
        clienteDireccion: direccionCliente,
        cliente: {
          tipoDoc: docCliente ? (esFactura ? '6' : '1') : '-',
          numDoc: docCliente,
          nombre: nombreCliente,
          direccion: direccionCliente
        }
      })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success) {
      return {
        exito: false,
        success: false,
        serie,
        numero,
        codigoCompleto: `${serie}-${String(numero).padStart(8, '0')}`,
        error: data.message || `Error al emitir comprobante en APISUNAT (HTTP ${response.status})`
      };
    }

    const finalSerie = data.serie || serie;
    const finalNumero = data.numero || numero;
    const finalCodigo = data.codigoCompleto || `${finalSerie}-${String(finalNumero).padStart(8, '0')}`;

    await incrementarCorrelativo(finalSerie, finalNumero);

    const pdfLink = data.enlace_pdf || data.enlace_del_pdf || data.pdf || null;
    const xmlLink = data.enlace_xml || data.enlace_del_xml || data.xml || null;
    const rawStatus = String(data.status || data.estado_sunat || 'ACEPTADO').toUpperCase();

    return {
      exito: true,
      success: true,
      tipo: esFactura ? 'FACTURA' : 'BOLETA',
      tipoDoc: data.tipoDoc || (esFactura ? '01' : '03'),
      documentId: data.documentId || null,
      fileName: data.fileName || null,
      serie: finalSerie,
      numero: finalNumero,
      codigoCompleto: finalCodigo,
      opGravada: Number(data.opGravada ?? Number((total / 1.18).toFixed(2))),
      totalIgv: Number(data.totalIgv ?? Number((total - total / 1.18).toFixed(2))),
      totalVenta: Number(data.totalVenta ?? total),
      hash_cpe: data.hash_cpe || null,
      hash: data.hash_cpe || null,
      enlace_pdf: pdfLink,
      enlace_del_pdf: pdfLink,
      pdf: pdfLink,
      url_comprobante_sunat: pdfLink,
      enlace_xml: xmlLink,
      enlace_del_xml: xmlLink,
      xml: xmlLink,
      cdr: data.cdr || null,
      notes: data.notes || [],
      cadena_para_codigo_qr: data.cadena_para_codigo_qr || null,
      estado: rawStatus,
      estado_sunat: rawStatus.toLowerCase(),
      mensaje:
        rawStatus === 'PENDIENTE'
          ? `Comprobante ${finalCodigo} enviado a SUNAT (PENDIENTE de CDR)`
          : rawStatus === 'OBSERVADO'
          ? `Comprobante ${finalCodigo} emitido con OBSERVACIONES en SUNAT`
          : `Comprobante ${finalCodigo} emitido y aceptado en SUNAT`
    };
  } catch (error) {
    console.error('Error de red al conectar con /api/emitir-comprobante:', error);
    return {
      exito: false,
      success: false,
      error: 'Error de conexión con el servidor de facturación electrónica APISUNAT.'
    };
  }
};

/**
 * Consulta el estado definitivo de un comprobante PENDIENTE en APISUNAT.
 */
export async function verificarEstadoComprobante({ documentId, fileName = '' }) {
  if (!documentId) {
    throw new Error('Este comprobante no tiene documentId registrado.');
  }
  const params = new URLSearchParams({ documentId });
  if (fileName) params.set('fileName', fileName);

  const response = await fetch(`${EMITIR_API_URL}?${params.toString()}`, {
    method: 'GET'
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) {
    throw new Error(data.message || `Error HTTP ${response.status} al consultar SUNAT`);
  }
  return data;
}

/**
 * Emite una Nota de Crédito electrónica (tipo 07) en APISUNAT para anular una Boleta/Factura.
 */
export async function anularComprobante({ venta, motivo = 'ANULACION DE LA OPERACION', codigoMotivo = '01' }) {
  const comp = venta?.comprobante || {};
  const origSerie = (comp.serie || (venta?.tipoComprobante === 'FACTURA' ? 'F001' : 'B002')).toUpperCase();
  const origEsFactura = venta?.tipoComprobante === 'FACTURA' || comp.tipoDoc === '01' || origSerie.startsWith('F');
  const ncSerie = origEsFactura ? 'FC01' : 'BC02';

  const corrInfo = await obtenerSiguienteCorrelativo('NOTA_CREDITO', 'BA', ncSerie);

  const response = await fetch(ANULAR_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      venta,
      ncSerie,
      ncNumero: corrInfo.numero,
      motivo,
      codigoMotivo
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) {
    throw new Error(data.message || `Error al emitir Nota de Crédito en APISUNAT (HTTP ${response.status})`);
  }

  await incrementarCorrelativo(data.serie || ncSerie, data.numero || corrInfo.numero);

  return {
    success: true,
    documentId: data.documentId || null,
    fileName: data.fileName || null,
    tipoDoc: '07',
    serie: data.serie || ncSerie,
    numero: data.numero || corrInfo.numero,
    codigoCompleto: data.codigoCompleto,
    fechaEmision: data.fechaEmision || new Date().toISOString().split('T')[0],
    opGravada: data.opGravada,
    totalIgv: data.totalIgv,
    totalVenta: data.totalVenta,
    motivo: data.motivo || motivo,
    codigoMotivo: data.codigoMotivo || codigoMotivo,
    hash_cpe: data.hash_cpe || null,
    enlace_del_pdf: data.enlace_del_pdf || data.pdf || null,
    pdf: data.pdf || data.enlace_del_pdf || null,
    enlace_del_xml: data.enlace_del_xml || data.xml || null,
    xml: data.xml || data.enlace_del_xml || null,
    cdr: data.cdr || null,
    status: data.status || 'ACEPTADO',
    docModificado: data.docModificado || null
  };
}
