import React from 'react';
import { SEDES } from '../context/AppContext';
import { NUBEFACT_CONFIG } from '../services/sunatService';

/**
 * Componente optimizado para impresión térmica directa de tickets (80mm / 58mm)
 * Oculta la interfaz web circundante y formatea los datos tributarios y comerciales
 * eliminando márgenes de navegador.
 */
export const TicketPrint = ({ venta, id = "ticket-print-root", className = "" }) => {
  if (!venta) return null;

  const sedeInfo = SEDES[venta.sede] || {
    nombre: venta.sedeNombre || 'Dolciangel',
    ciudad: 'Chimbote'
  };

  const isVE = venta.sede === 'VE' || venta.sede === 'villaEspana' || venta.sede === 'Villa España';
  const tipo = venta.tipoComprobante || 'NOTA_VENTA';
  const comprobante = venta.comprobante || {};
  const codigoComprobante = comprobante.codigoCompleto || 
    `${comprobante.serie || (tipo === 'FACTURA' ? 'F001' : tipo === 'BOLETA' ? 'B001' : 'NV01')}-${comprobante.numero || venta.id}`;

  const tituloComprobante = isVE
    ? 'TICKET DE CONTROL INTERNO'
    : tipo === 'FACTURA'
    ? 'FACTURA ELECTRÓNICA'
    : tipo === 'BOLETA'
    ? 'BOLETA DE VENTA ELECTRÓNICA'
    : 'NOTA DE VENTA';

  const total = Number(venta.total) || 0;
  const opGravada = venta.opGravada !== undefined ? Number(venta.opGravada) : Number((total / 1.18).toFixed(2));
  const igv = venta.igv !== undefined ? Number(venta.igv) : Number((total - opGravada).toFixed(2));
  const recibido = Number(venta.montoRecibido) || total;
  const vuelto = Number(venta.vuelto) || 0;

  const fechaFormateada = venta.fecha 
    ? new Date(venta.fecha).toLocaleString('es-PE', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit', 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
      })
    : new Date().toLocaleString('es-PE');

  return (
    <div 
      id={id}
      className={`ticket-termico-container bg-white text-black font-mono text-[11px] leading-tight select-none ${className}`}
      style={{
        width: '100%',
        maxWidth: '80mm',
        margin: '0 auto',
        padding: '4mm',
        color: '#000000',
        fontFamily: "'Courier New', Courier, monospace",
        pageBreakInside: 'avoid',
        breakInside: 'avoid',
        height: 'auto'
      }}
    >
      {/* Estilos de impresión térmica continua (58mm / 80mm) */}
      <style>{`
        @page {
          size: auto;
          margin: 0mm;
        }
        @media print {
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            width: 100% !important;
            height: auto !important;
          }
          /* Oculta todos los elementos de la interfaz de la web al imprimir */
          body * {
            visibility: hidden !important;
          }
          /* Muestra ÚNICAMENTE el ticket blanco y negro con tipografía monoespaciada legible */
          #${id},
          #${id} * {
            visibility: visible !important;
          }
          #${id} {
            position: absolute !important;
            left: 0 !important;
            right: 0 !important;
            top: 0 !important;
            width: 100% !important;
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
            min-height: auto !important;
            max-height: none !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>
      {/* 1. CABECERA: LOGO, EMPRESA Y SEDE */}
      <div className="text-center pb-2 mb-2 border-b border-dashed border-black">
        <div className="text-xl leading-none mb-1">🧁</div>
        <h1 className="font-black text-sm tracking-wide uppercase leading-tight">
          DOLCIANGEL
        </h1>
        <p className="text-[10px] uppercase font-bold tracking-wider">
          PASTELERÍA FINA & CAFÉ
        </p>
        <p className="text-[9px] uppercase font-semibold text-gray-800">
          De: {sedeInfo.razonSocial || NUBEFACT_CONFIG.EMPRESA_RAZON_SOCIAL || 'RUTH PATRICIA CIRILO JARA'}
        </p>
        <p className="text-[10px] font-black mt-0.5">
          RUC: {sedeInfo.ruc || NUBEFACT_CONFIG.EMPRESA_RUC || '10427321351'}
        </p>
        <p className="text-[10px]">
          Sede: {sedeInfo.nombre} - {sedeInfo.ciudad}
        </p>
        <p className="text-[9px] text-gray-700">
          {sedeInfo.direccion || NUBEFACT_CONFIG.EMPRESA_DIRECCION}
        </p>
      </div>

      {/* 2. DATOS DEL COMPROBANTE Y CORRELATIVO */}
      <div className="text-center pb-2 mb-2 border-b border-dashed border-black space-y-0.5">
        <span className="font-extrabold text-xs block uppercase">
          {tituloComprobante}
        </span>
        <span className="font-black text-sm block tracking-widest">
          {codigoComprobante}
        </span>
        <span className="text-[10px] block">
          Fecha y Hora: {fechaFormateada}
        </span>
      </div>

      {/* 3. DATOS DE ATENCIÓN Y CLIENTE */}
      <div className="pb-2 mb-2 border-b border-dashed border-black space-y-1 text-[11px]">
        <div className="flex justify-between">
          <span>Mesa / Cuenta:</span>
          <span className="font-bold">{venta.cuenta?.nombre || 'Mostrador'}</span>
        </div>
        <div className="flex justify-between">
          <span>Cajero(a):</span>
          <span className="font-bold">{venta.vendedor || 'Colaborador'}</span>
        </div>

        {venta.cliente?.nombre && venta.cliente.nombre !== 'Público General' && (
          <div className="flex justify-between">
            <span>Cliente:</span>
            <span className="font-bold text-right truncate max-w-[170px]">
              {venta.cliente.nombre}
            </span>
          </div>
        )}

        {venta.cliente?.documento && (
          <div className="flex justify-between">
            <span>{tipo === 'FACTURA' ? 'RUC:' : 'DNI:'}</span>
            <span className="font-bold">{venta.cliente.documento}</span>
          </div>
        )}
      </div>

      {/* 4. ITEMS DE LA VENTA */}
      <div className="pb-2 mb-2 border-b border-dashed border-black">
        <div className="flex justify-between font-bold text-[10px] uppercase pb-1 mb-1 border-b border-black">
          <span>Cant. Descripción</span>
          <span className="text-right">Total</span>
        </div>
        <div className="space-y-1 text-[11px]">
          {(venta.items || []).map((it, idx) => (
            <div key={idx} className="flex justify-between items-start">
              <span className="pr-2 leading-tight">
                <strong>{it.cantidad}x</strong> {it.nombre}
              </span>
              <span className="font-bold whitespace-nowrap text-right">
                S/ {(it.subtotal || it.cantidad * (it.precio || 0)).toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 5. DESGLOSE TRIBUTARIO Y TOTAL */}
      <div className="pb-2 mb-2 border-b border-dashed border-black space-y-1 text-[11px]">
        <div className="flex justify-between">
          <span>Op. Gravada:</span>
          <span>S/ {opGravada.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span>IGV (18%):</span>
          <span>S/ {igv.toFixed(2)}</span>
        </div>
        <div className="flex justify-between font-black text-sm pt-1 border-t border-black">
          <span>IMPORTE TOTAL:</span>
          <span className="text-base font-extrabold">S/ {total.toFixed(2)}</span>
        </div>
      </div>

      {/* 6. MEDIO DE PAGO & VUELTO */}
      <div className="pb-2 mb-2 border-b border-dashed border-black space-y-1 text-[11px]">
        <div className="flex justify-between">
          <span>Medio de Pago:</span>
          <span className="font-bold">{venta.metodoPago || 'EFECTIVO'}</span>
        </div>
        {venta.metodoPago === 'EFECTIVO' && (
          <>
            <div className="flex justify-between">
              <span>Monto Recibido:</span>
              <span>S/ {recibido.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>VUELTO:</span>
              <span>S/ {vuelto.toFixed(2)}</span>
            </div>
          </>
        )}
      </div>

      {/* 7. PIE DE TICKET */}
      <div className="text-center pt-1 text-[9px] space-y-1 text-black">
        {isVE ? (
          <p className="font-extrabold text-[8px] uppercase tracking-wide text-black">
            ** TICKET DE CONTROL INTERNO - SIN VALOR FISCAL **
          </p>
        ) : comprobante.estado === 'ACEPTADO_SUNAT' ? (
          <p className="font-bold text-[8px] text-black">
            ✓ Comprobante autorizado por SUNAT
          </p>
        ) : null}
        <p className="font-bold text-black">
          ¡Gracias por endulzar tu momento con Dolciangel!
        </p>
        <p className="text-[8px] text-black">
          Conserve este comprobante para cualquier cambio o reclamo.
        </p>
        <p className="text-[8px] font-mono font-bold text-black">
          www.dolciangel.pe
        </p>
      </div>
    </div>
  );
};

export default TicketPrint;
