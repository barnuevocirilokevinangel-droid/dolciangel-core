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
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

    const rawTipo = (body.tipoDoc || body.tipoComprobante || body.tipoDocumento || 'BOLETA').toString().toUpperCase();
    const esFactura = rawTipo === '01' || rawTipo === 'FACTURA' || body.tipo_de_comprobante === '1';
    const tipoDoc = esFactura ? '01' : '03';
    const serie = (body.serie || (esFactura ? 'F001' : 'B002')).toString().trim().toUpperCase();

    const requestedNum = parseInt(body.numero || body.correlativo || (esFactura ? 1 : 1264), 10);
    const apiSuggestedNum = await getNextCorrelativeFromApiSunat({
      personaId: config.personaId,
      personaToken: config.personaToken,
      type: tipoDoc,
      serie
    });
    const numeroFinal = Math.max(
      Number.isFinite(requestedNum) && requestedNum > 0 ? requestedNum : 1,
      apiSuggestedNum || 0
    );
    const correlativoPadded = String(numeroFinal).padStart(8, '0');
    const codigoCompleto = `${serie}-${correlativoPadded}`;
    const fileName = `${config.ruc}-${tipoDoc}-${codigoCompleto}`;

    const items = Array.isArray(body.items) ? body.items : [];
    if (items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'La venta debe contener al menos un ítem para emitir comprobante.'
      });
    }

    const clienteRaw = body.cliente || {};
    const docCliente = (body.clienteDoc ?? clienteRaw.numDoc ?? clienteRaw.documento ?? '').toString().replace(/\D/g, '').trim();
    const nombreCliente = (body.clienteNombre ?? clienteRaw.nombre ?? clienteRaw.rznSocial ?? 'CLIENTES VARIOS').toString().trim();
    const direccionCliente = (body.clienteDireccion ?? clienteRaw.direccion ?? '').toString().trim();
    const emailCliente = (body.clienteEmail ?? clienteRaw.email ?? '').toString().trim();

    let tipoDocCliente = '-';
    let numDocCliente = '00000000';

    if (esFactura) {
      if (!/^\d{11}$/.test(docCliente)) {
        return res.status(400).json({
          success: false,
          message: 'Para emitir Factura Electrónica es obligatorio un RUC válido de 11 dígitos.'
        });
      }
      tipoDocCliente = '6';
      numDocCliente = docCliente;
    } else if (/^\d{8}$/.test(docCliente)) {
      tipoDocCliente = '1';
      numDocCliente = docCliente;
    } else if (/^\d{11}$/.test(docCliente)) {
      tipoDocCliente = '6';
      numDocCliente = docCliente;
    }

    const { fechaEmision, horaEmision } = getLimaDateTime();
    const { lines, taxTotal, legalMonetaryTotal, opGravada, totalIgv, totalVenta } = buildLinesAndTotals(items, {
      isCreditNote: false,
      moneda: 'PEN'
    });

    if (totalVenta <= 0) {
      return res.status(400).json({
        success: false,
        message: 'El importe total del comprobante debe ser mayor a S/ 0.00.'
      });
    }

    // Estructura estricta UBL 2.1 requerida por APISUNAT (/personas/v1/sendBill)
    const documentBody = {
      'cbc:UBLVersionID': { _text: '2.1' },
      'cbc:CustomizationID': { _text: '2.0' },
      'cbc:ID': { _text: codigoCompleto },
      'cbc:IssueDate': { _text: fechaEmision },
      'cbc:IssueTime': { _text: horaEmision },
      ...(esFactura ? { 'cbc:DueDate': { _text: fechaEmision } } : {}),
      'cbc:InvoiceTypeCode': {
        _text: tipoDoc,
        _attributes: { listID: '0101' }
      },
      'cbc:Note': [
        {
          _text: numeroALetras(totalVenta, 'PEN'),
          _attributes: { languageLocaleID: '1000' }
        }
      ],
      'cbc:DocumentCurrencyCode': { _text: 'PEN' },
      'cac:AccountingSupplierParty': buildSupplierParty(config),
      'cac:AccountingCustomerParty': buildCustomerParty({
        tipoDocCliente,
        numDocCliente,
        nombreCliente: nombreCliente || 'CLIENTES VARIOS',
        direccionCliente,
        emailCliente
      }),
      'cac:PaymentTerms': [
        {
          'cbc:ID': { _text: 'FormaPago' },
          'cbc:PaymentMeansID': { _text: 'Contado' }
        }
      ],
      'cac:TaxTotal': taxTotal,
      'cac:LegalMonetaryTotal': legalMonetaryTotal,
      'cac:InvoiceLine': lines
    };

    const result = await sendBillAndFetchArtifacts({
      personaId: config.personaId,
      personaToken: config.personaToken,
      fileName,
      documentBody,
      customerEmail: emailCliente || undefined
    });

    const qrTipoDocCli = tipoDocCliente === '-' ? '-' : tipoDocCliente;
    const qrNumDocCli = tipoDocCliente === '-' ? '-' : numDocCliente;
    const qrString = `${config.ruc}|${tipoDoc}|${serie}|${numeroFinal}|${totalIgv.toFixed(2)}|${totalVenta.toFixed(2)}|${fechaEmision}|${qrTipoDocCli}|${qrNumDocCli}|${result.hash_cpe || ''}|`;

    return res.status(200).json({
      success: true,
      status: result.status,
      documentId: result.documentId,
      fileName: result.fileName,
      tipoDoc,
      serie,
      numero: numeroFinal,
      correlativo: numeroFinal,
      codigoCompleto,
      fechaEmision,
      opGravada,
      totalIgv,
      totalVenta,
      hash_cpe: result.hash_cpe,
      enlace_pdf: result.enlace_del_pdf,
      enlace_del_pdf: result.enlace_del_pdf,
      pdf: result.pdf,
      enlace_xml: result.enlace_del_xml,
      enlace_del_xml: result.enlace_del_xml,
      xml: result.xml,
      cdr: result.cdr,
      cadena_para_codigo_qr: qrString
    });
  } catch (error) {
    console.error('Error en /api/emitir-comprobante:', error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Error interno al emitir el comprobante en APISUNAT.',
      details: error.details || null
    });
  }
}
