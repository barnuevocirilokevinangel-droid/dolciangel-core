import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { SEDES } from '../context/AppContext';
import { NUBEFACT_CONFIG } from '../services/sunatService';
import { Printer, CheckCircle, Sparkles } from 'lucide-react';

export const TicketTermico = ({ venta, onPrint, onClose }) => {
  if (!venta) return null;

  const sedeInfo = SEDES[venta.sede] || {
    nombre: venta.sedeNombre || 'Dolciangel',
    ciudad: 'Chimbote'
  };

  const isVE = venta.sede === 'VE' || venta.sede === 'villaEspana' || venta.sede === 'Villa España';
  const tipo = venta.tipoComprobante || 'NOTA_VENTA';
  const comprobante = venta.comprobante || {};

  const serieDefecto = isVE ? 'NV01' : (tipo === 'FACTURA' ? 'F001' : 'B002');
  const serieComprobante = isVE ? 'NV01' : (comprobante.serie || (tipo === 'FACTURA' ? 'F001' : 'B002'));
  const numComprobante = comprobante.numero || venta.correlativo || (tipo === 'BOLETA' ? 1264 : 1);
  // Requisito oficial: Mostrar explícitamente B002-${String(numero).padStart(8, '0')} (Ejemplo: B002-00001264)
  const codigoComprobante = `${serieComprobante}-${String(numComprobante).padStart(8, '0')}`;

  const tituloComprobante = isVE
    ? 'TICKET DE CONTROL INTERNO'
    : tipo === 'FACTURA'
    ? 'FACTURA ELECTRÓNICA'
    : tipo === 'BOLETA'
    ? 'BOLETA DE VENTA ELECTRÓNICA'
    : 'NOTA DE VENTA INTERNA';

  const total = Number(venta.total) || 0;
  const opGravada = venta.opGravada !== undefined ? Number(venta.opGravada) : Number((total / 1.18).toFixed(2));
  const igv = venta.igv !== undefined ? Number(venta.igv) : Number((total - opGravada).toFixed(2));
  const recibido = Number(venta.montoRecibido) || total;
  const vuelto = Number(venta.vuelto) || 0;

  // Composición de valor QR oficial bajo estándar SUNAT:
  // ${ruc}|${tipoDoc}|${serie}|${numero}|${igv}|${total}|${fecha}|${tipoDocCliente}|${numDocCliente}|${hash}|
  const rucEmisor = NUBEFACT_CONFIG.EMPRESA_RUC || '10427321351';
  const codTipoDoc = tipo === 'FACTURA' ? '01' : tipo === 'BOLETA' ? '03' : '00';
  const totIgv = igv.toFixed(2);
  const totVenta = total.toFixed(2);
  const fechaYMD = venta.fecha ? new Date(venta.fecha).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
  const docCliente = (venta.cliente?.documento || '').trim();
  const tipoDocCli = docCliente ? (tipo === 'FACTURA' ? '6' : '1') : '-';
  const numDocCli = docCliente || '-';
  const hashComprobante = comprobante.hash || comprobante.codigo_hash || comprobante.digest_value || 'DA-HASH';

  const qrValue = `${rucEmisor}|${codTipoDoc}|${serieComprobante}|${numComprobante}|${totIgv}|${totVenta}|${fechaYMD}|${tipoDocCli}|${numDocCli}|${hashComprobante}|`;

  const fechaFormateada = venta.fecha 
    ? new Date(venta.fecha).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'medium' })
    : new Date().toLocaleString('es-PE');

  const handlePrint = () => {
    if (onPrint) {
      onPrint();
    } else {
      window.print();
    }
  };

  return (
    <div className="w-full">
      {/* ESTILOS DE IMPRESIÓN PARA TICKETERA TÉRMICA CONTINUA (58mm / 80mm) */}
      <style>{`
        @page {
          size: 80mm auto;
          margin: 0;
        }
        @media print {
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            width: 80mm !important;
            max-width: 80mm !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            overflow: visible !important;
          }
          body * {
            visibility: hidden !important;
          }
          #ticket-termico-print, #ticket-termico-print * {
            visibility: visible !important;
          }
          #ticket-termico-print {
            position: absolute !important;
            left: 0 !important;
            right: 0 !important;
            top: 0 !important;
            width: 80mm !important;
            max-width: 80mm !important;
            margin: 0 auto !important;
            padding: 4mm !important;
            background: #ffffff !important;
            color: #000000 !important;
            font-family: 'Courier New', Courier, monospace !important;
            font-size: 11px !important;
            line-height: 1.25 !important;
            box-shadow: none !important;
            border: none !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
        }
      `}</style>

      {/* TICKET VISUAL / IMPRESIBLE */}
      <div 
        id="ticket-termico-print"
        className="bg-white rounded-2xl p-5 text-slate-900 border border-slate-200 font-mono text-xs shadow-inner max-w-[340px] mx-auto select-none"
      >
        {/* Cabecera */}
        <div className="text-center space-y-1 pb-3 border-b border-dashed border-slate-300">
          <div className="text-xl">🧁</div>
          <h2 className="font-extrabold text-sm tracking-tight text-slate-900 uppercase">
            DOLCIANGEL
          </h2>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">
            PASTELERÍA FINA & CAFÉ
          </p>
          <p className="text-[9px] uppercase font-semibold text-slate-600">
            De: {sedeInfo.razonSocial || NUBEFACT_CONFIG.EMPRESA_RAZON_SOCIAL || 'RUTH PATRICIA CIRILO JARA'}
          </p>
          <p className="text-[10px] text-slate-800 font-black">
            RUC: {sedeInfo.ruc || NUBEFACT_CONFIG.EMPRESA_RUC || '10427321351'}
          </p>
          <p className="text-[9px] text-slate-500">
            Sede: {sedeInfo.nombre} ({sedeInfo.ciudad})
          </p>
          <p className="text-[9px] text-slate-400">
            {sedeInfo.direccion || NUBEFACT_CONFIG.EMPRESA_DIRECCION}
          </p>
        </div>

        {/* Datos del Comprobante */}
        <div className="py-2.5 border-b border-dashed border-slate-300 text-center space-y-0.5">
          <span className="font-black text-xs block text-slate-800">
            {tituloComprobante}
          </span>
          <span className="font-extrabold text-sm block text-brand-800 font-mono">
            {codigoComprobante}
          </span>
          <span className="text-[10px] text-slate-500 block">
            Fecha: {fechaFormateada}
          </span>
        </div>

        {/* Datos de Atención y Cliente */}
        <div className="py-2.5 border-b border-dashed border-slate-300 text-[11px] space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-500">Mesa/Cuenta:</span>
            <span className="font-bold text-slate-800">{venta.cuenta?.nombre || 'Mostrador'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Atendido por:</span>
            <span className="font-bold text-slate-800">{venta.vendedor || 'Colaborador'}</span>
          </div>

          {(venta.cliente?.nombre && venta.cliente.nombre !== 'Público General') && (
            <div className="flex justify-between">
              <span className="text-slate-500">Cliente:</span>
              <span className="font-bold text-slate-800 truncate max-w-[170px] text-right">
                {venta.cliente.nombre}
              </span>
            </div>
          )}

          {venta.cliente?.documento && (
            <div className="flex justify-between">
              <span className="text-slate-500">
                {tipo === 'FACTURA' ? 'RUC:' : 'DNI:'}
              </span>
              <span className="font-bold text-slate-800 font-mono">
                {venta.cliente.documento}
              </span>
            </div>
          )}

          {venta.cliente?.telefono && (
            <div className="flex justify-between text-purple-700">
              <span>Fidelidad:</span>
              <span className="font-bold">{venta.cliente.telefono} (+1 sello)</span>
            </div>
          )}
        </div>

        {/* Tabla de Productos / Items */}
        <div className="py-2.5 border-b border-dashed border-slate-300">
          <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase pb-1 mb-1 border-b border-slate-100">
            <span>Cant. Descripción</span>
            <span>Total</span>
          </div>
          <div className="space-y-1.5 text-[11px]">
            {(venta.items || []).map((it, idx) => (
              <div key={idx} className="flex justify-between items-start">
                <span className="pr-2 leading-tight">
                  <strong>{it.cantidad}x</strong> {it.nombre}
                </span>
                <span className="font-bold whitespace-nowrap">
                  S/ {(it.subtotal || it.cantidad * (it.precio || 0)).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Desglose Económico SUNAT */}
        <div className="py-2.5 border-b border-dashed border-slate-300 text-[11px] space-y-1">
          <div className="flex justify-between text-slate-500">
            <span>Op. Gravada:</span>
            <span>S/ {opGravada.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-slate-500">
            <span>IGV (18%):</span>
            <span>S/ {igv.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm font-black text-slate-900 pt-1 border-t border-slate-200">
            <span>TOTAL:</span>
            <span className="text-brand-800 text-base">S/ {total.toFixed(2)}</span>
          </div>
        </div>

        {/* Detalles de Pago & Vuelto */}
        <div className="py-2.5 border-b border-dashed border-slate-300 text-[11px] space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-500">Medio de Pago:</span>
            <span className="font-bold text-slate-800">{venta.metodoPago || 'EFECTIVO'}</span>
          </div>
          {venta.metodoPago === 'EFECTIVO' && (
            <>
              <div className="flex justify-between">
                <span className="text-slate-500">Monto Recibido:</span>
                <span className="font-semibold text-slate-800">S/ {recibido.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-emerald-700">
                <span>VUELTO:</span>
                <span>S/ {vuelto.toFixed(2)}</span>
              </div>
            </>
          )}
        </div>

        {/* Pie de Ticket & Estado SUNAT */}
        <div className="pt-2 text-center space-y-1.5 text-[9px] text-slate-600">
          {/* Código QR Oficial SUNAT centrado */}
          <div className="flex flex-col items-center justify-center my-2 pt-1">
            <div className="bg-white p-1 border border-slate-300 rounded shadow-sm inline-block">
              <QRCodeSVG
                value={qrValue}
                size={92}
                level="M"
                includeMargin={false}
              />
            </div>

            {/* Hash del comprobante */}
            {hashComprobante && (
              <p className="text-[7.5px] font-mono mt-1 text-center max-w-[210px] break-all leading-tight text-slate-500">
                Hash: <span className="font-bold text-slate-700">{hashComprobante}</span>
              </p>
            )}

            <p className="text-[7px] text-slate-400 mt-0.5">
              Consulte su comprobante en: www.sunat.gob.pe
            </p>
          </div>

          {/* Sinceridad Operativa y Leyenda del Comprobante */}
          <div className="pt-1 space-y-0.5">
            <p className="font-black text-[9px] uppercase tracking-wide text-slate-900 border-y border-dashed border-slate-300 py-1">
              COMPROBANTE DE VENTA INTERNO
            </p>
            <p className="text-[7.5px] text-slate-500 uppercase">
              (Control administrativo interno - Operación regular)
            </p>
          </div>

          <p className="font-bold text-slate-700 pt-1">
            ¡Gracias por endulzar tu día con Dolciangel!
          </p>
          <p className="text-[8px] text-slate-400">
            Conserva tu comprobante • www.dolciangel.pe
          </p>
        </div>
      </div>
    </div>
  );
};
