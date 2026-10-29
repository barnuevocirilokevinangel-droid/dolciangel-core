import React from 'react';
import { SEDES } from '../context/AppContext';
import { NUBEFACT_CONFIG } from '../services/sunatService';
import { Printer, CheckCircle, Sparkles } from 'lucide-react';

export const TicketTermico = ({ venta, onPrint, onClose }) => {
  if (!venta) return null;

  const sedeInfo = SEDES[venta.sede] || {
    nombre: venta.sedeNombre || 'Dolciangel',
    ciudad: 'Chimbote'
  };

  const tipo = venta.tipoComprobante || 'NOTA_VENTA';
  const comprobante = venta.comprobante || {};
  const codigoComprobante = comprobante.codigoCompleto || 
    `${comprobante.serie || (tipo === 'FACTURA' ? 'F001' : tipo === 'BOLETA' ? 'B001' : 'NV01')}-${comprobante.numero || venta.id}`;

  const tituloComprobante = tipo === 'FACTURA'
    ? 'FACTURA ELECTRÓNICA'
    : tipo === 'BOLETA'
    ? 'BOLETA DE VENTA ELECTRÓNICA'
    : 'NOTA DE VENTA INTERNA';

  const total = Number(venta.total) || 0;
  const opGravada = venta.opGravada !== undefined ? Number(venta.opGravada) : Number((total / 1.18).toFixed(2));
  const igv = venta.igv !== undefined ? Number(venta.igv) : Number((total - opGravada).toFixed(2));
  const recibido = Number(venta.montoRecibido) || total;
  const vuelto = Number(venta.vuelto) || 0;

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
      {/* ESTILOS DE IMPRESIÓN PARA TICKETERA TÉRMICA DE 80mm / 58mm */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #ticket-termico-print, #ticket-termico-print * {
            visibility: visible !important;
          }
          #ticket-termico-print {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 78mm !important;
            margin: 0 !important;
            padding: 2mm 3mm !important;
            background: white !important;
            color: black !important;
            font-family: 'Courier New', Courier, monospace !important;
            font-size: 11px !important;
            line-height: 1.25 !important;
          }
          @page {
            size: 80mm auto;
            margin: 0;
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
            Pastelería Fina & Café
          </p>
          <p className="text-[10px] text-slate-600 font-bold">
            RUC: {NUBEFACT_CONFIG.EMPRESA_RUC}
          </p>
          <p className="text-[9px] text-slate-500">
            Sede: {sedeInfo.nombre} ({sedeInfo.ciudad})
          </p>
          <p className="text-[9px] text-slate-400">
            {NUBEFACT_CONFIG.EMPRESA_DIRECCION}
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
        <div className="pt-3 text-center space-y-1 text-[9px] text-slate-400">
          {comprobante.estado === 'ACEPTADO_SUNAT' ? (
            <p className="font-bold text-emerald-600">
              ✓ Comprobante autorizado por SUNAT
            </p>
          ) : (
            <p className="text-[8px] text-slate-400">
              Comprobante emitido electrónicamente
            </p>
          )}

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
