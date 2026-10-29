/**
 * SERVICIO DE FACTURACIÓN ELECTRÓNICA SUNAT / NUBEFACT
 * Dolciangel Core POS
 * 
 * Estructurado según las especificaciones de la API v1 de Nubefact (Perú).
 * Permite simulación local completa y conexión inmediata con solo ingresar
 * NUBEFACT_URL y NUBEFACT_TOKEN.
 */

export const NUBEFACT_CONFIG = {
  // Cuando se conecte Nubefact en producción, colocar las credenciales en .env
  // o configurar en la base de datos de administración
  API_URL: import.meta.env?.VITE_NUBEFACT_URL || '',
  TOKEN: import.meta.env?.VITE_NUBEFACT_TOKEN || '',
  EMPRESA_RUC: '20609876543',
  EMPRESA_RAZON_SOCIAL: 'DOLCIANGEL PASTELERÍA & CAFÉ S.A.C.',
  EMPRESA_DIRECCION: 'Av. Pacífico Mz. B Lt. 12 - Nuevo Chimbote',
  SERIES: {
    FACTURA: 'F001',
    BOLETA: 'B001',
    NOTA_VENTA: 'NV01'
  }
};

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
 * Emite el comprobante electrónico hacia Nubefact / SUNAT
 * Si no hay API Key configurada, simula localmente la emisión con éxito,
 * generando los datos listos para el ticket y guardando el estado en Firestore.
 */
export async function emitirComprobante(venta) {
  const payload = generarPayloadNubefact(venta);
  const tipo = venta.tipoComprobante || 'NOTA_VENTA';

  // Si hay credenciales activas de Nubefact, hacer la llamada HTTP real
  if (NUBEFACT_CONFIG.API_URL && NUBEFACT_CONFIG.TOKEN) {
    try {
      const response = await fetch(NUBEFACT_CONFIG.API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Token token="${NUBEFACT_CONFIG.TOKEN}"`
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok || data.errors) {
        throw new Error(data.errors || 'Error en respuesta de Nubefact/SUNAT');
      }

      return {
        success: true,
        tipo,
        serie: data.serie || payload.serie,
        numero: data.numero || payload.numero,
        enlace_del_pdf: data.enlace_del_pdf || null,
        enlace_del_xml: data.enlace_del_xml || null,
        cadena_para_codigo_qr: data.cadena_para_codigo_qr || null,
        estado: 'ACEPTADO_SUNAT',
        fechaEmision: new Date().toISOString(),
        payload: payload
      };
    } catch (err) {
      console.warn('Fallo en conexión en vivo con Nubefact, pasando a modo contingencia:', err);
      // En caso de corte de internet o credencial temporal, no bloquear la venta en mostrador
    }
  }

  // SIMULACIÓN LOCAL CON PROTOCOLO SUNAT
  const correlativoSimulado = Math.floor(1000 + (Date.now() % 9000));
  const serie = payload.serie;
  const numero = correlativoSimulado.toString().padStart(6, '0');
  const codigoCompleto = `${serie}-${numero}`;

  // Cadena oficial QR SUNAT simulada
  const qrString = [
    NUBEFACT_CONFIG.EMPRESA_RUC,
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
    success: true,
    tipo,
    serie,
    numero,
    codigoCompleto,
    enlace_del_pdf: null,
    enlace_del_xml: null,
    cadena_para_codigo_qr: qrString,
    estado: 'SIMULADO_LOCAL',
    mensaje: 'Comprobante generado localmente (Arquitectura lista para Nubefact/SUNAT)',
    fechaEmision: new Date().toISOString(),
    payload: payload
  };
}
