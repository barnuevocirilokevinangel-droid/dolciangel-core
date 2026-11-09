/**
 * SERVICIO DE FACTURACIÓN ELECTRÓNICA SUNAT / NUBEFACT
 * Dolciangel Core POS
 * 
 * Estructurado según las especificaciones de la API v1 de Nubefact (Perú).
 * Permite simulación local completa y conexión inmediata con solo ingresar
 * NUBEFACT_URL y NUBEFACT_TOKEN.
 */

export const SUNAT_CONFIG = {
  // Credenciales para endpoint genérico JSON (compatible con Nubefact u otro proveedor económico)
  API_URL: import.meta.env?.VITE_API_SUNAT_URL || import.meta.env?.VITE_NUBEFACT_URL || '',
  TOKEN: import.meta.env?.VITE_API_SUNAT_TOKEN || import.meta.env?.VITE_NUBEFACT_TOKEN || '',
  EMPRESA_RUC: '20609876543',
  EMPRESA_RAZON_SOCIAL: 'DOLCIANGEL PASTELERÍA & CAFÉ S.A.C.',
  EMPRESA_DIRECCION: 'Av. Pacífico Mz. B Lt. 12 - Nuevo Chimbote',
  SERIES: {
    FACTURA: 'F001',
    BOLETA: 'B001',
    NOTA_VENTA: 'NV01'
  }
};

// Alias de retrocompatibilidad
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
 * Convierte una venta de Dolciangel al payload oficial JSON de Nubefact
 */
export function generarPayloadNubefact(venta) {
  const tipo = venta.tipoComprobante || 'NOTA_VENTA';
  const total = Number(venta.total) || 0;
  const totalGravada = Number((total / 1.18).toFixed(2));
  const totalIgv = Number((total - totalGravada).toFixed(2));

  // Determinar tipo de comprobante y serie
  let tipoDeComprobante = 2; // 2 = Boleta por defecto
  let serie = NUBEFACT_CONFIG.SERIES.BOLETA;
  let tipoDocIdentidad = '1'; // 1 = DNI
  let docNumero = (venta.cliente?.documento || '').trim();
  let denominacion = (venta.cliente?.nombre || 'Público General').trim();

  if (tipo === 'FACTURA') {
    tipoDeComprobante = 1;
    serie = NUBEFACT_CONFIG.SERIES.FACTURA;
    tipoDocIdentidad = '6'; // 6 = RUC
  } else if (tipo === 'BOLETA') {
    tipoDeComprobante = 2;
    serie = NUBEFACT_CONFIG.SERIES.BOLETA;
    tipoDocIdentidad = docNumero.length === 8 ? '1' : '-';
    if (!docNumero && total < 700) {
      docNumero = '00000000';
      denominacion = denominacion || 'CLIENTE MENOR';
    }
  } else {
    // NOTA DE VENTA INTERNA
    tipoDeComprobante = 0; // Uso interno
    serie = NUBEFACT_CONFIG.SERIES.NOTA_VENTA;
    tipoDocIdentidad = '-';
  }

  // Estructurar items según formato Nubefact
  const itemsNubefact = (venta.items || []).map((it, idx) => {
    const cant = Number(it.cantidad) || 1;
    const precioConIgv = Number(it.precio || it.precioUnitario) || 0;
    const valorSinIgv = Number((precioConIgv / 1.18).toFixed(4));
    const subtotalSinIgv = Number((valorSinIgv * cant).toFixed(2));
    const totalItem = Number((precioConIgv * cant).toFixed(2));
    const igvItem = Number((totalItem - subtotalSinIgv).toFixed(2));

    return {
      unidad_de_medida: 'NIU', // NIU = Unidad de bien
      codigo: it.id || `PROD-${idx + 1}`,
      descripcion: (it.nombre || 'Producto Dolciangel').toUpperCase(),
      cantidad: cant,
      valor_unitario: valorSinIgv,
      precio_unitario: Number(precioConIgv.toFixed(2)),
      descuento: 0,
      subtotal: subtotalSinIgv,
      tipo_de_igv: 1, // 1 = Gravado - Operación Onerosa
      igv: igvItem,
      total: totalItem,
      anticipo_regularizacion: false
    };
  });

  const now = new Date();
  const fechaEmision = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;

  return {
    operacion: 'generar_comprobante',
    tipo_de_comprobante: tipoDeComprobante,
    serie: serie,
    numero: venta.correlativo || Math.floor(1000 + Math.random() * 9000),
    sunat_transaction: 1, // 1 = Venta Interna
    cliente_tipo_de_documento: tipoDocIdentidad,
    cliente_numero_de_documento: docNumero || '00000000',
    cliente_denominacion: denominacion.toUpperCase(),
    cliente_direccion: venta.cliente?.direccion || 'NUEVO CHIMBOTE',
    cliente_email: venta.cliente?.email || '',
    fecha_de_emision: fechaEmision,
    moneda: 1, // 1 = PEN (Soles)
    tipo_de_cambio: '',
    porcentaje_de_igv: 18.00,
    descuento_global: 0,
    total_descuento: 0,
    total_anticipo: 0,
    total_gravada: totalGravada,
    total_inafecta: 0,
    total_exonerada: 0,
    total_igv: totalIgv,
    total_gratuita: 0,
    total_otros_cargos: 0,
    total: Number(total.toFixed(2)),
    medio_de_pago: venta.metodoPago === 'EFECTIVO' ? 'EFECTIVO' : venta.metodoPago === 'YAPE_PLIN' ? 'YAPE/PLIN' : 'TARJETA',
    items: itemsNubefact
  };
}

/**
 * Emite el comprobante electrónico hacia el proveedor SUNAT (Nubefact o endpoint genérico JSON)
 * REGLAS DE NEGOCIO ESTRICTAS:
 * 1. Sede Villa España opera 100% bajo control interno sin valor fiscal; aborta la llamada API y retorna éxito local inmediato.
 * 2. Solo las ventas de Buenos Aires con tipo "BOLETA" o "FACTURA" disparan el consumo de la API externa.
 * 3. Si no hay API Key o falla la conexión, opera en simulación local para no trabar el mostrador.
 */
export async function emitirComprobante(venta) {
  const sede = venta?.sede || '';
  const isVE = sede === 'VE' || sede === 'villaEspana' || sede === 'Villa España';

  // 1. REGLA ESTRICTA VILLA ESPAÑA: abortar la API y retornar inmediatamente un éxito local
  if (isVE) {
    const correlativo = venta.correlativo || Math.floor(1000 + (Date.now() % 9000));
    const serie = SUNAT_CONFIG.SERIES.NOTA_VENTA;
    const numero = correlativo.toString().padStart(6, '0');
    return {
      exito: true,
      tipo: 'interno',
      comprobante_simulado: true,
      serie,
      numero,
      codigoCompleto: `${serie}-${numero}`,
      estado_sunat: 'no_aplica',
      estado: 'CONTROL_INTERNO',
      enlace_del_pdf: null,
      mensaje: 'Ticket de control interno emitido en Villa España (sin valor fiscal)'
    };
  }

  const tipo = venta.tipoComprobante || 'NOTA_VENTA';
  const esFiscal = tipo === 'BOLETA' || tipo === 'FACTURA';

  // 2. REGLA ESTRICTA NOTA DE VENTA BUENOS AIRES: uso interno, no consume API
  if (!esFiscal) {
    const correlativo = venta.correlativo || Math.floor(1000 + (Date.now() % 9000));
    const serie = SUNAT_CONFIG.SERIES.NOTA_VENTA;
    const numero = correlativo.toString().padStart(6, '0');
    return {
      exito: true,
      tipo: 'interno',
      comprobante_simulado: true,
      serie,
      numero,
      codigoCompleto: `${serie}-${numero}`,
      estado_sunat: 'no_aplica',
      estado: 'CONTROL_INTERNO',
      enlace_del_pdf: null,
      mensaje: 'Nota de venta interna emitida en Buenos Aires'
    };
  }

  // 3. SOLO VENTAS DE BUENOS AIRES MARCADAS EXPLÍCITAMENTE COMO BOLETA O FACTURA:
  const payload = generarPayloadNubefact(venta);

  // Consumir endpoint genérico JSON (usando VITE_API_SUNAT_URL / VITE_API_SUNAT_TOKEN)
  if (SUNAT_CONFIG.API_URL && SUNAT_CONFIG.TOKEN) {
    try {
      const response = await fetch(SUNAT_CONFIG.API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': SUNAT_CONFIG.TOKEN.startsWith('Bearer ') || SUNAT_CONFIG.TOKEN.startsWith('Token ')
            ? SUNAT_CONFIG.TOKEN
            : `Bearer ${SUNAT_CONFIG.TOKEN}`,
          'token': SUNAT_CONFIG.TOKEN
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok || data.errors || data.error) {
        throw new Error(data.errors || data.error || 'Error en respuesta del proveedor de facturación SUNAT');
      }

      return {
        exito: true,
        success: true,
        tipo,
        serie: data.serie || payload.serie,
        numero: data.numero || payload.numero,
        codigoCompleto: `${data.serie || payload.serie}-${data.numero || payload.numero}`,
        enlace_del_pdf: data.enlace_del_pdf || data.pdf || null,
        enlace_del_xml: data.enlace_del_xml || data.xml || null,
        cadena_para_codigo_qr: data.cadena_para_codigo_qr || data.qr || null,
        estado: 'ACEPTADO_SUNAT',
        estado_sunat: 'aceptado',
        fechaEmision: new Date().toISOString(),
        payload: payload
      };
    } catch (err) {
      console.warn('Fallo en conexión con API SUNAT externa, pasando a contingencia/simulación local:', err);
    }
  }

  // Simulación local de 1 segundo (Ready for Nubefact / Proveedor Económico)
  await new Promise(resolve => setTimeout(resolve, 1000));

  const correlativo = venta.correlativo || Math.floor(1000 + (Date.now() % 9000));
  const serie = payload.serie;
  const numero = correlativo.toString().padStart(6, '0');
  const codigoCompleto = `${serie}-${numero}`;

  // Cadena oficial QR SUNAT
  const qrString = [
    SUNAT_CONFIG.EMPRESA_RUC,
    payload.tipo_de_comprobante.toString().padStart(2, '0'),
    serie,
    numero,
    payload.total_igv.toFixed(2),
    payload.total.toFixed(2),
    payload.fecha_de_emision,
    payload.cliente_tipo_de_documento,
    payload.cliente_numero_de_documento
  ].join('|');

  return {
    exito: true,
    success: true,
    enlace_del_pdf: null,
    comprobante_simulado: true,
    estado_sunat: 'simulado_local',
    tipo,
    serie,
    numero,
    codigoCompleto,
    enlace_del_xml: null,
    cadena_para_codigo_qr: qrString,
    estado: 'EMITIDO',
    mensaje: 'Comprobante simulado localmente con éxito para Buenos Aires (Ready for SUNAT)',
    fechaEmision: new Date().toISOString(),
    payload: payload
  };
}
