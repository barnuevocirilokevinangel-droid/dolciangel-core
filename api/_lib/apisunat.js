export const APISUNAT_BASE_URL = 'https://back.apisunat.com';

export function getApiSunatConfig() {
  return {
    personaId: (process.env.APISUNAT_ID || process.env.VITE_APISUNAT_ID || '').trim(),
    personaToken: (process.env.APISUNAT_TOKEN || process.env.VITE_APISUNAT_TOKEN || '').trim(),
    ruc: (process.env.APISUNAT_RUC || '10427321351').trim(),
    razonSocial: (process.env.APISUNAT_RAZON_SOCIAL || 'CIRILO JARA RUTH PATRICIA').trim(),
    nombreComercial: (process.env.APISUNAT_NOMBRE_COMERCIAL || 'DOLCIANGEL - PASTELERIA FINA & CAFE').trim(),
    direccion: (process.env.APISUNAT_DIRECCION || 'AV. PACIFICO MZ. B LT. 12 - NUEVO CHIMBOTE').trim()
  };
}

export function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );
}

export function getLimaDateTime() {
  const now = new Date();
  const fechaEmision = now.toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
  const horaEmision = now.toLocaleTimeString('es-PE', {
    timeZone: 'America/Lima',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  return { fechaEmision, horaEmision };
}

export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// Conversión de monto numérico a letras según exigencia SUNAT (Leyenda 1000)
const UNIDADES = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
const DECENAS = ['', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
const ESPECIALES = {
  11: 'ONCE', 12: 'DOCE', 13: 'TRECE', 14: 'CATORCE', 15: 'QUINCE',
  16: 'DIECISEIS', 17: 'DIECISIETE', 18: 'DIECIOCHO', 19: 'DIECINUEVE',
  21: 'VEINTIUN', 22: 'VEINTIDOS', 23: 'VEINTITRES', 24: 'VEINTICUATRO',
  25: 'VEINTICINCO', 26: 'VEINTISEIS', 27: 'VEINTISIETE', 28: 'VEINTIOCHO', 29: 'VEINTINUEVE'
};
const CENTENAS = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

function centenasALetras(n) {
  if (n === 100) return 'CIEN';
  const c = Math.floor(n / 100);
  const resto = n % 100;
  const centena = CENTENAS[c] || '';
  if (resto === 0) return centena;
  if (ESPECIALES[resto]) return `${centena} ${ESPECIALES[resto]}`.trim();
  const d = Math.floor(resto / 10);
  const u = resto % 10;
  return [centena, DECENAS[d] || '', UNIDADES[u] || ''].filter(Boolean).join(' Y ').trim();
}

function milesALetras(n) {
  const miles = Math.floor(n / 1000);
  const resto = n % 1000;
  const strMiles = miles === 0 ? '' : miles === 1 ? 'UN MIL' : `${centenasALetras(miles)} MIL`;
  const strCentenas = centenasALetras(resto);
  if (!strMiles) return strCentenas;
  return strCentenas ? `${strMiles} ${strCentenas}` : strMiles;
}

export function numeroALetras(monto, moneda = 'PEN') {
  const num = Number(monto) || 0;
  const entero = Math.floor(num);
  const decimales = Math.round((num - entero) * 100);
  const letras = entero === 0 ? 'CERO' : milesALetras(entero);
  const nombreMoneda = moneda === 'USD' ? 'DOLARES AMERICANOS' : 'SOLES';
  return `${letras} CON ${String(decimales).padStart(2, '0')}/100 ${nombreMoneda}`;
}

export function buildSupplierParty(config) {
  return {
    'cac:Party': {
      'cac:PartyIdentification': {
        'cbc:ID': {
          _attributes: { schemeID: '6' },
          _text: config.ruc
        }
      },
      'cac:PartyName': {
        'cbc:Name': { _text: config.nombreComercial }
      },
      'cac:PartyLegalEntity': {
        'cbc:RegistrationName': { _text: config.razonSocial },
        'cac:RegistrationAddress': {
          'cbc:AddressTypeCode': { _text: '0000' },
          'cac:AddressLine': {
            'cbc:Line': { _text: config.direccion }
          }
        }
      }
    }
  };
}

export function buildCustomerParty({ tipoDocCliente, numDocCliente, nombreCliente, direccionCliente, emailCliente }) {
  const isNoDoc = !numDocCliente || numDocCliente === '-' || numDocCliente === '00000000' || tipoDocCliente === '-';
  const schemeID = isNoDoc ? '-' : String(tipoDocCliente);
  const docText = isNoDoc ? '00000000' : String(numDocCliente).trim();
  const cleanName = (nombreCliente || 'CLIENTES VARIOS').toString().trim() || 'CLIENTES VARIOS';

  const party = {
    'cac:PartyIdentification': {
      'cbc:ID': {
        _attributes: { schemeID },
        _text: docText
      }
    },
    'cac:PartyLegalEntity': {
      'cbc:RegistrationName': { _text: cleanName }
    }
  };

  if (direccionCliente && direccionCliente.trim().length >= 3) {
    party['cac:PartyLegalEntity']['cac:RegistrationAddress'] = {
      'cac:AddressLine': {
        'cbc:Line': { _text: direccionCliente.trim() }
      }
    };
  }

  if (emailCliente && emailCliente.trim()) {
    party['cac:Contact'] = {
      'cbc:ElectronicMail': { _text: emailCliente.trim() }
    };
  }

  return { 'cac:Party': party };
}

/**
 * Construye líneas UBL 2.1 (InvoiceLine o CreditNoteLine) y totales gravados + IGV 18%
 * siguiendo la aritmética exacta de APISUNAT / SUNAT.
 */
export function buildLinesAndTotals(items = [], { isCreditNote = false, moneda = 'PEN' } = {}) {
  const qtyKey = isCreditNote ? 'cbc:CreditedQuantity' : 'cbc:InvoicedQuantity';

  const lines = (items || []).map((item, idx) => {
    const qty = Number(item.cantidad ?? item.quantity ?? 0);
    const precioUnitario = round2(Number(item.precio ?? item.precioUnitario ?? 0));
    if (!Number.isFinite(qty) || qty <= 0) {
      const err = new Error(`Ítem #${idx + 1} (${item.nombre || 'Producto'}) tiene cantidad inválida.`);
      err.statusCode = 400;
      throw err;
    }
    if (!Number.isFinite(precioUnitario) || precioUnitario <= 0) {
      const err = new Error(`Ítem #${idx + 1} (${item.nombre || 'Producto'}) debe tener precio mayor a S/ 0.00 para SUNAT.`);
      err.statusCode = 400;
      throw err;
    }

    const valorUnitario = Number((precioUnitario / 1.18).toFixed(6));

    // Aritmética de precisión entera (x100000) equivalente al widget oficial APISUNAT
    const qtyInt = Math.round(qty * 100000);
    const precioInt = Math.round(precioUnitario * 100000);
    const rateInt = 18000; // 18%

    const subtotalInt = (qtyInt * precioInt) / (100000 + rateInt);
    const taxInt = (subtotalInt * rateInt) / 100000;

    const lineExtensionAmount = round2(subtotalInt / 100000);
    const taxAmount = round2(taxInt / 100000);
    const itemId = String(item.id || `P${String(idx + 1).padStart(3, '0')}`).slice(0, 30);
    const descripcion = (item.nombre || item.descripcion || 'Producto Dolciangel').toString().trim().slice(0, 250);

    return {
      'cbc:ID': { _text: idx + 1 },
      [qtyKey]: {
        _attributes: { unitCode: 'NIU' },
        _text: qty
      },
      'cbc:LineExtensionAmount': {
        _attributes: { currencyID: moneda },
        _text: lineExtensionAmount
      },
      'cac:PricingReference': {
        'cac:AlternativeConditionPrice': {
          'cbc:PriceAmount': {
            _attributes: { currencyID: moneda },
            _text: precioUnitario
          },
          'cbc:PriceTypeCode': { _text: '01' }
        }
      },
      'cac:TaxTotal': {
        'cbc:TaxAmount': {
          _attributes: { currencyID: moneda },
          _text: taxAmount
        },
        'cac:TaxSubtotal': [
          {
            'cbc:TaxableAmount': {
              _attributes: { currencyID: moneda },
              _text: lineExtensionAmount
            },
            'cbc:TaxAmount': {
              _attributes: { currencyID: moneda },
              _text: taxAmount
            },
            'cac:TaxCategory': {
              'cbc:Percent': { _text: 18 },
              'cbc:TaxExemptionReasonCode': { _text: '10' },
              'cac:TaxScheme': {
                'cbc:ID': { _text: '1000' },
                'cbc:Name': { _text: 'IGV' },
                'cbc:TaxTypeCode': { _text: 'VAT' }
              }
            }
          }
        ]
      },
      'cac:Item': {
        'cbc:Description': { _text: descripcion },
        'cac:SellersItemIdentification': {
          'cbc:ID': { _text: itemId }
        }
      },
      'cac:Price': {
        'cbc:PriceAmount': {
          _attributes: { currencyID: moneda },
          _text: valorUnitario
        }
      }
    };
  });

  const opGravada = round2(lines.reduce((sum, l) => sum + (l['cbc:LineExtensionAmount']._text || 0), 0));
  const totalIgv = round2(lines.reduce((sum, l) => sum + (l['cac:TaxTotal']['cbc:TaxAmount']._text || 0), 0));
  const totalVenta = round2(opGravada + totalIgv);

  const taxTotal = {
    'cbc:TaxAmount': {
      _attributes: { currencyID: moneda },
      _text: totalIgv
    },
    'cac:TaxSubtotal': [
      {
        'cbc:TaxableAmount': {
          _attributes: { currencyID: moneda },
          _text: opGravada
        },
        'cbc:TaxAmount': {
          _attributes: { currencyID: moneda },
          _text: totalIgv
        },
        'cac:TaxCategory': {
          'cac:TaxScheme': {
            'cbc:ID': { _text: '1000' },
            'cbc:Name': { _text: 'IGV' },
            'cbc:TaxTypeCode': { _text: 'VAT' }
          }
        }
      }
    ]
  };

  const legalMonetaryTotal = {
    'cbc:LineExtensionAmount': {
      _attributes: { currencyID: moneda },
      _text: opGravada
    },
    'cbc:TaxInclusiveAmount': {
      _attributes: { currencyID: moneda },
      _text: totalVenta
    },
    'cbc:PayableAmount': {
      _attributes: { currencyID: moneda },
      _text: totalVenta
    }
  };

  return { lines, taxTotal, legalMonetaryTotal, opGravada, totalIgv, totalVenta };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function getNextCorrelativeFromApiSunat({ personaId, personaToken, type, serie }) {
  try {
    const resp = await fetchWithTimeout(`${APISUNAT_BASE_URL}/personas/lastDocument`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ personaId, personaToken, type, serie })
    }, 5000);
    if (!resp.ok) return null;
    const data = await resp.json();
    const suggested = parseInt(data?.suggestedNumber, 10);
    return Number.isFinite(suggested) && suggested > 0 ? suggested : null;
  } catch {
    return null;
  }
}

export async function checkDocumentStatusById({ documentId, fileName }) {
  if (!documentId) {
    const err = new Error('Falta documentId para consultar estado en APISUNAT.');
    err.statusCode = 400;
    throw err;
  }
  const docResp = await fetchWithTimeout(`${APISUNAT_BASE_URL}/documents/${documentId}/getById`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  }, 6000);
  if (!docResp.ok) {
    const err = new Error(`APISUNAT devolvió HTTP ${docResp.status} al consultar ${documentId}`);
    err.statusCode = docResp.status;
    throw err;
  }
  const docJson = await docResp.json();
  const status = docJson?.status || 'PENDIENTE';
  const xmlUrl = docJson?.xml || null;
  const cdrUrl = docJson?.cdr || null;
  const faults = docJson?.faults || [];
  const notes = docJson?.notes || [];
  let hashCpe = docJson?.hash || docJson?.digestValue || null;

  if (!hashCpe && xmlUrl) {
    try {
      const xmlResp = await fetchWithTimeout(xmlUrl, {}, 2500);
      if (xmlResp.ok) {
        const xmlText = await xmlResp.text();
        const match = xmlText.match(/<(?:ds:)?DigestValue>([^<]+)<\/(?:ds:)?DigestValue>/i);
        if (match && match[1]) hashCpe = match[1].trim();
      }
    } catch {
      // No bloquear respuesta si el XML demora
    }
  }

  return {
    documentId,
    fileName: fileName || docJson?.fileName || null,
    status,
    hash_cpe: hashCpe,
    enlace_del_pdf: fileName
      ? `${APISUNAT_BASE_URL}/documents/${documentId}/getPDF/ticket80mm/${fileName}.pdf`
      : null,
    enlace_del_xml: xmlUrl,
    cdr: cdrUrl,
    faults,
    notes
  };
}

/**
 * Envía el comprobante a APISUNAT /personas/v1/sendBill, consulta getById para obtener
 * XML/CDR/estado y extrae el hash_cpe (<ds:DigestValue>) del XML firmado.
 */
export async function sendBillAndFetchArtifacts({ personaId, personaToken, fileName, documentBody, customerEmail }) {
  const sendPayload = {
    personaId,
    personaToken,
    fileName,
    documentBody
  };
  if (customerEmail) {
    sendPayload.customerEmail = customerEmail;
  }

  const sendResponse = await fetchWithTimeout(`${APISUNAT_BASE_URL}/personas/v1/sendBill`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sendPayload)
  }, 15000);

  const sendText = await sendResponse.text();
  let sendData = null;
  try {
    sendData = JSON.parse(sendText);
  } catch {
    throw new Error(`Respuesta inválida de APISUNAT (${sendResponse.status}): ${sendText.slice(0, 200)}`);
  }

  if (!sendResponse.ok || sendData?.status === 'ERROR' || !sendData?.documentId) {
    const errDetail = sendData?.error
      ? (typeof sendData.error === 'string' ? sendData.error : JSON.stringify(sendData.error))
      : (sendData?.message || sendText);
    const err = new Error(`APISUNAT rechazó el envío: ${errDetail}`);
    err.statusCode = sendResponse.status >= 400 ? sendResponse.status : 400;
    err.details = sendData;
    throw err;
  }

  const documentId = sendData.documentId;
  const pdfUrl = `${APISUNAT_BASE_URL}/documents/${documentId}/getPDF/ticket80mm/${fileName}.pdf`;

  let status = sendData.status || 'PENDIENTE';
  let xmlUrl = null;
  let cdrUrl = null;
  let faults = [];
  let notes = [];
  let hashCpe = null;

  // Poll breve para obtener XML, CDR y estado definitivo (max ~3.5s)
  const delays = [650, 900, 1000, 1000];
  for (const waitMs of delays) {
    await sleep(waitMs);
    try {
      const docResp = await fetchWithTimeout(`${APISUNAT_BASE_URL}/documents/${documentId}/getById`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      }, 4000);
      if (!docResp.ok) continue;
      const docJson = await docResp.json();
      status = docJson?.status || status;
      xmlUrl = docJson?.xml || xmlUrl;
      cdrUrl = docJson?.cdr || cdrUrl;
      faults = docJson?.faults || faults;
      notes = docJson?.notes || notes;
      hashCpe = docJson?.hash || docJson?.digestValue || hashCpe;

      if (status && status !== 'PENDIENTE') {
        break;
      }
    } catch {
      // Continuar reintentando dentro de la ventana
    }
  }

  if (status === 'RECHAZADO' || status === 'EXCEPCION' || status === 'ERROR') {
    const faultMsg = Array.isArray(faults) && faults.length > 0
      ? faults.map(f => f.description || f.message || JSON.stringify(f)).join(' | ')
      : `Documento en estado ${status} en SUNAT`;
    const err = new Error(`SUNAT/APISUNAT devolvió ${status}: ${faultMsg}`);
    err.statusCode = 422;
    err.details = { status, faults, notes, documentId, xmlUrl, cdrUrl };
    throw err;
  }

  // Extraer DigestValue (hash_cpe oficial SUNAT) desde el XML firmado si aún no se tiene
  if (!hashCpe && xmlUrl) {
    try {
      const xmlResp = await fetchWithTimeout(xmlUrl, {}, 2500);
      if (xmlResp.ok) {
        const xmlText = await xmlResp.text();
        const match = xmlText.match(/<(?:ds:)?DigestValue>([^<]+)<\/(?:ds:)?DigestValue>/i);
        if (match && match[1]) {
          hashCpe = match[1].trim();
        }
      }
    } catch {
      // Si el XML tarda, no bloquear la emisión; el PDF y XML siguen disponibles
    }
  }

  return {
    documentId,
    fileName,
    status,
    hash_cpe: hashCpe || null,
    enlace_del_pdf: pdfUrl,
    pdf: pdfUrl,
    enlace_del_xml: xmlUrl || null,
    xml: xmlUrl || null,
    cdr: cdrUrl || null,
    faults,
    notes
  };
}
