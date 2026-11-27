import {
  getApiSunatConfig,
  setCorsHeaders,
  getLimaDateTime,
  numeroALetras,
  buildSupplierParty,
  buildCustomerParty,
  buildLinesAndTotals,
  getNextCorrelativeFromApiSunat,
  sendBillAndFetchArtifacts
} from './_lib/apisunat.js';

export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Método no permitido. Use POST.' });
  }

  const config = getApiSunatConfig();
  if (!config.personaId || !config.personaToken) {
    return res.status(500).json({
      success: false,
      message: 'Faltan credenciales APISUNAT_ID o APISUNAT_TOKEN en las variables de entorno.'
    });
  }

  try {
    let body = {};
    try {
      body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    } catch {
      return res.status(400).json({ success: false, message: 'Cuerpo JSON inválido.' });
    }
    const venta = body.venta || body;
    const comp = venta.comprobante || {};

    const normalizeSede = (val) =>
      String(val || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
    const isVillaEspana = (val) => {
      const n = normalizeSede(val);
      return n === 've' || n === 'villaespana' || n.includes('villa espana');
    };
    if (
      isVillaEspana(body.local) ||
      isVillaEspana(body.sede) ||
      isVillaEspana(venta.sede) ||
      isVillaEspana(venta.local) ||
      isVillaEspana(venta.sedeNombre)
    ) {
      return res.status(400).json({
        success: false,
        message: 'La sede Villa España no está habilitada para emitir comprobantes electrónicos SUNAT'
      });
    }

    const origTipoRaw = (
      body.origTipoDoc ||
      comp.tipoDoc ||
      venta.tipoComprobante ||
      comp.tipo ||
      'BOLETA'
    ).toString().toUpperCase();

    const origSerie = (body.origSerie || comp.serie || (origTipoRaw === 'FACTURA' || origTipoRaw === '01' ? 'F001' : 'B002'))
      .toString()
      .trim()
      .toUpperCase();

    const origEsFactura = origTipoRaw === '01' || origTipoRaw === 'FACTURA' || origSerie.startsWith('F');
    const origTipoDocCode = origEsFactura ? '01' : '03';

    const origNumero = parseInt(body.origNumero || comp.numero || venta.correlativo || 0, 10);
    if (!origNumero || origNumero <= 0) {
      return res.status(400).json({
        success: false,
        message: 'No se encontró el número correlativo original del comprobante a anular.'
      });
    }

    const origNumeroPadded = String(origNumero).padStart(8, '0');
    const origFullId = body.origCodigoCompleto || comp.codigoCompleto || `${origSerie}-${origNumeroPadded}`;

    const rawOrigDate = body.origFecha || comp.fecha || venta.fecha;
    const { fechaEmision, horaEmision } = getLimaDateTime();
    const origFechaEmision = rawOrigDate
      ? new Date(rawOrigDate).toLocaleDateString('en-CA', { timeZone: 'America/Lima' })
      : fechaEmision;

    const ncSerie = (body.ncSerie || (origEsFactura ? 'FC01' : 'BC02')).toString().trim().toUpperCase();
    const requestedNcNum = parseInt(body.ncNumero || 1, 10);
    const apiSuggestedNcNum = await getNextCorrelativeFromApiSunat({
      personaId: config.personaId,
      personaToken: config.personaToken,
      type: '07',
      serie: ncSerie
    });
    const ncNumeroFinal = Math.max(
      Number.isFinite(requestedNcNum) && requestedNcNum > 0 ? requestedNcNum : 1,
      apiSuggestedNcNum || 0
    );
    const ncCorrelativoPadded = String(ncNumeroFinal).padStart(8, '0');
    const ncFullId = `${ncSerie}-${ncCorrelativoPadded}`;
    const fileName = `${config.ruc}-07-${ncFullId}`;

    const items = Array.isArray(venta.items) ? venta.items : [];
    if (items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'El comprobante original no tiene ítems para emitir la Nota de Crédito.'
      });
    }

    const cliente = venta.cliente || {};
    const docCliente = (body.clienteDoc ?? cliente.documento ?? cliente.numDoc ?? '').toString().replace(/\D/g, '').trim();
    const nombreCliente = (body.clienteNombre ?? cliente.nombre ?? 'CLIENTES VARIOS').toString().trim();
    const direccionCliente = (body.clienteDireccion ?? cliente.direccion ?? '').toString().trim();

    let tipoDocCliente = '-';
    let numDocCliente = '00000000';
    if (origEsFactura || /^\d{11}$/.test(docCliente)) {
      tipoDocCliente = '6';
      numDocCliente = docCliente || '00000000000';
    } else if (/^\d{8}$/.test(docCliente)) {
      tipoDocCliente = '1';
      numDocCliente = docCliente;
    }

    const codigoMotivo = (body.codigoMotivo || '01').toString().trim(); // Catalogo 09 SUNAT: 01 = Anulación de la operación
    const motivo = (body.motivo || 'ANULACION DE LA OPERACION').toString().trim().slice(0, 250);

    const { lines, taxTotal, legalMonetaryTotal, opGravada, totalIgv, totalVenta } = buildLinesAndTotals(items, {
      isCreditNote: true,
      moneda: 'PEN'
    });

    // Estructura estricta UBL 2.1 Nota de Crédito (07) para APISUNAT
    const documentBody = {
      'cbc:UBLVersionID': { _text: '2.1' },
      'cbc:CustomizationID': { _text: '2.0' },
      'cbc:ID': { _text: ncFullId },
      'cbc:IssueDate': { _text: fechaEmision },
      'cbc:IssueTime': { _text: horaEmision },
      'cbc:Note': [
        {
          _text: numeroALetras(totalVenta, 'PEN'),
          _attributes: { languageLocaleID: '1000' }
        }
      ],
      'cbc:DocumentCurrencyCode': { _text: 'PEN' },
      'cac:AdditionalDocumentReference': [
        {
          'cbc:ID': { _text: origFullId },
          'cbc:DocumentTypeCode': { _text: '99' },
          'cbc:DocumentType': { _text: origEsFactura ? 'Factura' : 'Boleta de venta' },
          'cac:IssuerParty': {
            'cac:PartyIdentification': {
              'cbc:ID': {
                _attributes: { schemeID: '6' },
                _text: config.ruc
              }
            }
          }
        }
      ],
      'cac:DiscrepancyResponse': {
        'cbc:ReferenceID': { _text: origFullId },
        'cbc:ResponseCode': { _text: codigoMotivo },
        'cbc:Description': { _text: motivo }
      },
      'cac:BillingReference': {
        'cac:InvoiceDocumentReference': {
          'cbc:ID': { _text: origFullId },
          'cbc:IssueDate': { _text: origFechaEmision },
          'cbc:DocumentTypeCode': { _text: origTipoDocCode }
        }
      },
      'cac:AccountingSupplierParty': buildSupplierParty(config),
      'cac:AccountingCustomerParty': buildCustomerParty({
        tipoDocCliente,
        numDocCliente,
        nombreCliente: nombreCliente || 'CLIENTES VARIOS',
        direccionCliente
      }),
      'cac:TaxTotal': taxTotal,
      'cac:LegalMonetaryTotal': legalMonetaryTotal,
      'cac:CreditNoteLine': lines
    };

    const result = await sendBillAndFetchArtifacts({
      personaId: config.personaId,
      personaToken: config.personaToken,
      fileName,
      documentBody
    });

    return res.status(200).json({
      success: true,
      status: result.status,
      estado_sunat: String(result.status || 'ACEPTADO').toUpperCase(),
      documentId: result.documentId,
      fileName: result.fileName,
      tipoDoc: '07',
      serie: ncSerie,
      numero: ncNumeroFinal,
      correlativo: ncNumeroFinal,
      codigoCompleto: ncFullId,
      fechaEmision,
      opGravada,
      totalIgv,
      totalVenta,
      motivo,
      codigoMotivo,
      hash_cpe: result.hash_cpe,
      enlace_pdf: result.enlace_del_pdf,
      enlace_del_pdf: result.enlace_del_pdf,
      pdf: result.pdf,
      enlace_xml: result.enlace_del_xml,
      enlace_del_xml: result.enlace_del_xml,
      xml: result.xml,
      cdr: result.cdr,
      faults: result.faults || [],
      notes: result.notes || [],
      docModificado: {
        tipoDoc: origTipoDocCode,
        serie: origSerie,
        numero: origNumero,
        codigoCompleto: origFullId,
        fechaEmision: origFechaEmision
      }
    });
  } catch (error) {
    console.error('Error en /api/anular-comprobante:', error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Error interno al emitir Nota de Crédito en APISUNAT.',
      details: error.details || null
    });
  }
}
