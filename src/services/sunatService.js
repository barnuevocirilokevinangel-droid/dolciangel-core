// src/services/sunatService.js
import { db, doc, getDoc, runTransaction, serverTimestamp } from './firebase';

// Endpoint proxy serverless en Vercel para evitar bloqueos de CORS
const API_URL = import.meta.env?.VITE_API_SUNAT_PROXY || "/api/sunat";
const API_TOKEN = "2def7b1448e04c9763445c648197b71d7852c21deaafa1a937772798ff81254b";

export const SUNAT_CONFIG = {
  API_URL,
  TOKEN: API_TOKEN,
  EMPRESA_RUC: '10427321351',
  EMPRESA_RAZON_SOCIAL: 'RUTH PATRICIA CIRILO JARA',
  EMPRESA_NOMBRE_COMERCIAL: 'DOLCIANGEL - PASTELERÍA FINA & CAFÉ',
  EMPRESA_DIRECCION: 'Av. Pacífico Mz. B Lt. 12 - Nuevo Chimbote',
  SERIES: {
    FACTURA: 'F001',
    BOLETA: 'B002', // Sincronizado oficialmente con Arisale (último emitido 1263 -> arranca en 1264)
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
 * Consulta automática de datos de DNI / RUC mediante ApiPeru.dev.
 * Primero consulta el endpoint serverless `/api/consultar-doc` para mantener
 * el token protegido en el servidor. Si falla (p.ej. en entorno de desarrollo local),
 * recurre al fallback directo con el token configurado.
 */
export async function consultarDocumento({ dni, ruc }) {
  const cleanDni = dni ? dni.toString().replace(/\D/g, '').trim() : '';
  const cleanRuc = ruc ? ruc.toString().replace(/\D/g, '').trim() : '';

  // 1. Intentar Serverless Function en Vercel
  try {
    const res = await fetch('/api/consultar-doc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dni: cleanDni, ruc: cleanRuc })
    });
    if (res.ok) {
      const json = await res.json();
      if (json && json.success && json.data) {
        return json;
      }
    }
  } catch (err) {
    console.warn("Fallo al consultar /api/consultar-doc, ejecutando fallback directo:", err);
  }

  // 2. Fallback de contingencia directa en desarrollo local (Vite dev server)
  const token = SUNAT_CONFIG.TOKEN || "2def7b1448e04c9763445c648197b71d7852c21deaafa1a937772798ff81254b";
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
    console.warn("Error en fallback directo ApiPeru:", directErr);
  }

  return { success: false, message: 'No se pudo consultar el documento.' };
}

/**
 * Consulta el siguiente correlativo oficial en Firestore sin quemarlo previamente.
 * - Boletas Buenos Aires: Serie "B002", arranca en 1264.
 * - Facturas Buenos Aires: Serie "F001", arranca en 1.
 * - Tickets Internos (Villa España / NV): Serie "NV01", arranca en 1.
 */
export async function obtenerSiguienteCorrelativo(tipoComprobante = 'BOLETA', sede = 'BA') {
  const isVE = sede === 'VE' || sede === 'villaEspana' || sede === 'Villa España';
  const esFactura = !isVE && (tipoComprobante === 'FACTURA' || tipoComprobante === 'Factura');
  const serie = isVE ? 'NV01' : (esFactura ? 'F001' : 'B002');

  const defaultStarts = {
    'B002': 1264,
    'F001': 1,
    'NV01': 1
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
    console.warn("Fallo en lectura de correlativo Firestore, usando fallback local:", error);
    const storageKey = `dolciangel_correlativo_${serie}`;
    let current = parseInt(localStorage.getItem(storageKey) || defaultStarts[serie] || 1, 10);
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
 * Así, si se emite la 1264, la siguiente venta será automáticamente la 1265.
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
    console.warn("Fallo al incrementar correlativo en Firestore:", err);
    const storageKey = `dolciangel_correlativo_${serie}`;
    localStorage.setItem(storageKey, (numeroEmitido + 1).toString());
  }
}

export const emitirComprobante = async (ventaData) => {
  // 1. Bloqueo estricto para Villa España: Solo emite ticket interno
  const isVE = ventaData.sede === 'villaEspana' || ventaData.sede === 'VE' || ventaData.sede === 'Villa España';
  if (isVE) {
    const correlativo = ventaData.correlativo || ventaData.numero || 1;
    const serie = "NV01";
    return {
      exito: true,
      tipo: 'interno',
      comprobante_simulado: true,
      serie,
      numero: correlativo,
      codigoCompleto: `${serie}-${String(correlativo).padStart(8, '0')}`,
      estado_sunat: 'no_aplica',
      estado: 'CONTROL_INTERNO',
      enlace_del_pdf: null,
      mensaje: "Ticket interno emitido sin valor fiscal"
    };
  }

  // Si es Nota de Venta interna en cualquier sede
  const esNotaVenta = ventaData.tipoDocumento === 'Nota de Venta' || ventaData.tipoComprobante === 'NOTA_VENTA';
  if (esNotaVenta) {
    const correlativo = ventaData.correlativo || ventaData.numero || 1;
    const serie = "NV01";
    return {
      exito: true,
      tipo: 'interno',
      comprobante_simulado: true,
      serie,
      numero: correlativo,
      codigoCompleto: `${serie}-${String(correlativo).padStart(8, '0')}`,
      estado_sunat: 'no_aplica',
      estado: 'CONTROL_INTERNO',
      enlace_del_pdf: null,
      mensaje: "Ticket interno emitido sin valor fiscal"
    };
  }

  // 2. Lógica de Facturación Electrónica para Buenos Aires
  try {
    // Cálculos para evitar decimales infinitos
    const total = parseFloat(ventaData.total) || 0;
    const totalGravada = total / 1.18;
    const totalIgv = total - totalGravada;

    const esFactura = ventaData.tipoDocumento === 'Factura' || ventaData.tipoComprobante === 'FACTURA';
    // Forzado estricto: B002 para Boletas en Buenos Aires arrancando en 1264
    const serie = esFactura ? "F001" : "B002";
    const numero = esFactura 
      ? (ventaData.correlativo || ventaData.numero || 1) 
      : (ventaData.correlativo || 1264);

    const docCliente = (ventaData.clienteDoc || ventaData.cliente?.documento || '').trim();
    const nombreCliente = (ventaData.clienteNombre || ventaData.cliente?.nombre || "CLIENTES VARIOS").trim();
    const direccionCliente = (ventaData.clienteDireccion || ventaData.cliente?.direccion || "").trim();

    const payload = {
      operacion: "generar_comprobante",
      tipo_de_comprobante: esFactura ? "1" : "2",
      serie: serie,
      numero: numero,
      sunat_transaction: "1",
      cliente_tipo_de_documento: docCliente ? (esFactura ? "6" : "1") : "-",
      cliente_numero_de_documento: docCliente || "00000000",
      cliente_denominacion: nombreCliente || "CLIENTES VARIOS",
      cliente_direccion: direccionCliente || "",
      moneda: "1",
      porcentaje_de_igv: 18.00,
      total_gravada: parseFloat(totalGravada.toFixed(2)),
      total_igv: parseFloat(totalIgv.toFixed(2)),
      total: parseFloat(total.toFixed(2)),
      enviar_automaticamente_a_la_sunat: true,
      items: (ventaData.items || []).map((item, idx) => {
         const precioUnitario = parseFloat(item.precio || item.precioUnitario || 0);
         const valorUnitario = precioUnitario / 1.18;
         const cantidad = parseInt(item.cantidad || 1, 10);
         
         return {
           unidad_de_medida: "NIU",
           codigo: item.id || `00${idx + 1}`,
           descripcion: item.nombre || 'Producto Dolciangel',
           cantidad: cantidad,
           valor_unitario: parseFloat(valorUnitario.toFixed(5)),
           precio_unitario: parseFloat(precioUnitario.toFixed(2)),
           descuento: "",
           subtotal: parseFloat((valorUnitario * cantidad).toFixed(2)),
           tipo_de_igv: "1",
           igv: parseFloat(((precioUnitario - valorUnitario) * cantidad).toFixed(2)),
           total: parseFloat((precioUnitario * cantidad).toFixed(2)),
           anticipo_regularizacion: false
         };
      })
    };

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    const rucEmisor = SUNAT_CONFIG.EMPRESA_RUC;
    const codTipoDoc = esFactura ? "01" : "03";
    const fechaHoy = new Date().toISOString().split('T')[0];
    const tipoDocCli = docCliente ? (esFactura ? "6" : "1") : "-";
    const numDocCli = docCliente || "-";
    const finalHash = data.data?.hash || data.data?.codigo_hash || `DA-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    // Estructura oficial SUNAT: ${ruc}|${tipoDoc}|${serie}|${numero}|${igv}|${total}|${fecha}|${tipoDocCliente}|${numDocCliente}|${hash}|
    const qrCalculado = `${rucEmisor}|${codTipoDoc}|${serie}|${numero}|${totalIgv.toFixed(2)}|${total.toFixed(2)}|${fechaHoy}|${tipoDocCli}|${numDocCli}|${finalHash}|`;

    if (data.success) {
      // Incrementar contador en Firestore con éxito
      await incrementarCorrelativo(serie, numero);

      const pdfLink = data.data?.links?.pdf || data.data?.pdf || null;
      const finalSerie = data.data?.serie || serie;
      const finalNumero = data.data?.numero || numero;
      const finalCodigo = `${finalSerie}-${String(finalNumero).padStart(8, '0')}`;

      return {
        exito: true,
        success: true,
        serie: finalSerie,
        numero: finalNumero,
        codigoCompleto: finalCodigo,
        url_comprobante_sunat: pdfLink,
        enlace_del_pdf: pdfLink,
        hash: finalHash,
        cadena_para_codigo_qr: data.data?.cadena_para_codigo_qr || data.data?.qr || qrCalculado,
        estado: 'CONTROL_INTERNO', // Sinceridad operativa: Control interno hasta conexión formal de PSE
        estado_sunat: 'interno',
        mensaje: "Comprobante de venta interno registrado correctamente"
      };
    } else {
      console.error("Error devuelto por ApiPeru:", data);
      return { 
        exito: false, 
        success: false,
        serie,
        numero,
        codigoCompleto: `${serie}-${String(numero).padStart(8, '0')}`,
        hash: finalHash,
        cadena_para_codigo_qr: qrCalculado,
        error: data.message || "Error al emitir en comprobante interno. Revisa los datos." 
      };
    }
  } catch (error) {
    console.error("Error de conexión:", error);
    return { exito: false, error: "Error de red al conectar con ApiPeru." };
  }
};
