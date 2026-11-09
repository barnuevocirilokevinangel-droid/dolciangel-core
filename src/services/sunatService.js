// src/services/sunatService.js
import { db, doc, runTransaction, serverTimestamp } from './firebase';

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
    BOLETA: 'B002', // Sincronizado oficialmente con Arisale (último emitido 1263 -> siguiente 1264)
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
 * Obtiene e incrementa de forma atómica en Firestore el siguiente correlativo oficial.
 * - Boletas Buenos Aires: Serie "B002", arranca en 1264 e incrementa de 1 en 1.
 * - Facturas Buenos Aires: Serie "F001", arranca en 1.
 * - Tickets Internos (Villa España / NV): Serie "NV01", arranca en 1.
 */
export async function obtenerSiguienteCorrelativo(tipoComprobante = 'BOLETA', sede = 'BA') {
  const isVE = sede === 'VE' || sede === 'villaEspana' || sede === 'Villa España';
  const serie = isVE 
    ? 'NV01' 
    : tipoComprobante === 'FACTURA' 
    ? 'F001' 
    : tipoComprobante === 'BOLETA' 
    ? 'B002' 
    : 'NV01';

  const defaultStarts = {
    'B002': 1264,
    'F001': 1,
    'NV01': 1
  };

  const correlativoRef = doc(db, 'config', 'correlativos');

  try {
    const numeroAsignado = await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(correlativoRef);
      let current = defaultStarts[serie] || 1;

      if (snap.exists()) {
        const data = snap.data();
        if (data && typeof data[serie] === 'number') {
          current = Math.max(data[serie], defaultStarts[serie] || 1);
        }
      }

      const next = current + 1;
      transaction.set(correlativoRef, {
        [serie]: next,
        updatedAt: serverTimestamp()
      }, { merge: true });

      return current;
    });

    const codigoCompleto = `${serie}-${String(numeroAsignado).padStart(6, '0')}`;
    return {
      serie,
      numero: numeroAsignado,
      codigoCompleto
    };
  } catch (error) {
    console.warn("Fallo en transacción atómica de correlativo Firestore, usando fallback local:", error);
    const storageKey = `dolciangel_correlativo_${serie}`;
    let current = parseInt(localStorage.getItem(storageKey) || defaultStarts[serie] || 1, 10);
    localStorage.setItem(storageKey, (current + 1).toString());
    const codigoCompleto = `${serie}-${String(current).padStart(6, '0')}`;
    return {
      serie,
      numero: current,
      codigoCompleto
    };
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
      codigoCompleto: `${serie}-${String(correlativo).padStart(6, '0')}`,
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
      codigoCompleto: `${serie}-${String(correlativo).padStart(6, '0')}`,
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
    const serie = ventaData.serie || (esFactura ? "F001" : "B002");
    const numero = ventaData.correlativo || ventaData.numero || (esFactura ? 1 : 1264);
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
    const qrCalculado = `${rucEmisor}|${codTipoDoc}|${serie}|${numero}|${totalIgv.toFixed(2)}|${total.toFixed(2)}|${fechaHoy}|${tipoDocCli}|${numDocCli}|`;

    if (data.success) {
      const pdfLink = data.data?.links?.pdf || data.data?.pdf || null;
      return {
        exito: true,
        success: true,
        serie: data.data?.serie || serie,
        numero: data.data?.numero || numero,
        codigoCompleto: `${data.data?.serie || serie}-${data.data?.numero || numero}`,
        url_comprobante_sunat: pdfLink,
        enlace_del_pdf: pdfLink,
        hash: data.data?.hash || data.data?.codigo_hash || null,
        cadena_para_codigo_qr: data.data?.cadena_para_codigo_qr || data.data?.qr || qrCalculado,
        estado: 'ACEPTADO_SUNAT',
        estado_sunat: 'aceptado',
        mensaje: "Comprobante emitido con éxito en SUNAT"
      };
    } else {
      console.error("Error devuelto por ApiPeru:", data);
      return { 
        exito: false, 
        success: false,
        serie,
        numero,
        codigoCompleto: `${serie}-${numero}`,
        hash: null,
        cadena_para_codigo_qr: qrCalculado,
        error: data.message || "Error al emitir en SUNAT. Revisa los datos." 
      };
    }
  } catch (error) {
    console.error("Error de conexión:", error);
    return { exito: false, error: "Error de red al conectar con ApiPeru." };
  }
};
