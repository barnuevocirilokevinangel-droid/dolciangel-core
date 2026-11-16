import React, { useState, useEffect, useMemo } from 'react';
import { useApp, SEDES } from '../context/AppContext';
import { db, collections, getDocs, query, where } from '../services/firebase';
import { SUNAT_CONFIG } from '../services/sunatService';
import {
  FileSpreadsheet,
  Download,
  Calendar,
  Filter,
  ExternalLink,
  FileText,
  Printer,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Building2,
  Calculator
} from 'lucide-react';

const round2 = (n) => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;

function getLimaMonthString() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' }).slice(0, 7);
}

function toLimaDateYMD(isoOrDate) {
  if (!isoOrDate) return '';
  const d = new Date(isoOrDate);
  if (isNaN(d.getTime())) return String(isoOrDate).slice(0, 10);
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
}

function formatDMY(ymd) {
  if (!ymd || !ymd.includes('-')) return ymd || '';
  const [y, m, d] = ymd.split('-');
  return `${d}/${m}/${y}`;
}

function escapeCsvField(val) {
  const str = val === null || val === undefined ? '' : String(val);
  if (/[",\n\r;]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export const ContabilidadView = () => {
  const { ventas: ventasContext, showToast } = useApp();

  const [selectedMonth, setSelectedMonth] = useState(getLimaMonthString);
  const [filterSede, setFilterSede] = useState('TODAS');
  const [onlySunatDocs, setOnlySunatDocs] = useState(true);
  const [monthlyVentas, setMonthlyVentas] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchMonthFromFirestore = async (monthStr) => {
    setIsLoading(true);
    try {
      const [year, month] = monthStr.split('-').map(Number);
      const startIso = `${monthStr}-01T00:00:00.000Z`;
      // Margen +/-1 día por diferencia horaria UTC vs Lima (UTC-5)
      const prevDay = new Date(Date.UTC(year, month - 1, 0)).toISOString();
      const nextMonthStart = new Date(Date.UTC(year, month, 2)).toISOString();

      const qEmision = query(
        collections.ventas,
        where('fecha', '>=', prevDay),
        where('fecha', '<=', nextMonthStart)
      );
      const qAnulacion = query(
        collections.ventas,
        where('fechaAnulacion', '>=', prevDay),
        where('fechaAnulacion', '<=', nextMonthStart)
      );

      const [snapEmision, snapAnulacion] = await Promise.all([
        getDocs(qEmision),
        getDocs(qAnulacion)
      ]);

      const merged = new Map();
      snapEmision.forEach((d) => merged.set(d.id, { id: d.id, ...d.data() }));
      snapAnulacion.forEach((d) => merged.set(d.id, { id: d.id, ...d.data() }));

      // Mezclar también con ventas en memoria por si acaba de emitirse una venta offline/local
      (ventasContext || []).forEach((v) => {
        if (!merged.has(v.id)) {
          const emYmd = toLimaDateYMD(v.fecha);
          const anYmd = toLimaDateYMD(v.notaCredito?.fecha || v.fechaAnulacion);
          if (emYmd.startsWith(monthStr) || anYmd.startsWith(monthStr)) {
            merged.set(v.id, v);
          }
        }
      });

      setMonthlyVentas(Array.from(merged.values()));
    } catch (err) {
      console.error('Error consultando Firestore para contabilidad SIRE:', err);
      // Fallback a ventas en contexto si falla índice o red
      setMonthlyVentas(ventasContext || []);
      showToast('Mostrando registros en memoria (verifique conexión)', 'warning');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMonthFromFirestore(selectedMonth);
  }, [selectedMonth]);

  // Construcción de filas contables bajo estructura SUNAT SIRE (RVIE)
  const sireRows = useMemo(() => {
    const periodo = selectedMonth.replace('-', '');
    const rucEmisor = SUNAT_CONFIG.EMPRESA_RUC || '10427321351';
    const rows = [];

    monthlyVentas.forEach((v) => {
      // Filtro por sede
      const normalizedSede =
        v.sede === 'villaEspana' || v.sede === 'VE' ? 'VE' : 'BA';
      if (filterSede !== 'TODAS' && normalizedSede !== filterSede) return;

      const comp = v.comprobante || {};
      const tipoRaw = (v.tipoComprobante || comp.tipo || 'NOTA_VENTA').toUpperCase();
      const isFactura = tipoRaw === 'FACTURA' || comp.tipoDoc === '01';
      const isBoleta = tipoRaw === 'BOLETA' || comp.tipoDoc === '03';
      const serie = (comp.serie || (isFactura ? 'F001' : isBoleta ? 'B002' : 'NV01')).toUpperCase();
      const esSunatReal = (isFactura || isBoleta) && serie !== 'NV01';

      if (onlySunatDocs && !esSunatReal) return;

      const tipoDocSunat = isFactura ? '01' : isBoleta ? '03' : 'NV';
      const numeroNum = comp.numero || v.correlativo || 1;
      const numeroStr = String(numeroNum).padStart(8, '0');

      const total = round2(v.total || 0);
      const opGravada = round2(v.opGravada !== undefined ? v.opGravada : total / 1.18);
      const igv = round2(v.igv !== undefined ? v.igv : total - opGravada);

      const docCliente = (v.cliente?.documento || '').toString().trim();
      const tipoDocCli = docCliente
        ? (isFactura || docCliente.length === 11 ? '6' : docCliente.length === 8 ? '1' : '-')
        : '-';
      const numDocCli = docCliente || '00000000';
      const nombreCli = (v.cliente?.nombre || 'CLIENTES VARIOS').trim();

      const fechaEmisionYMD = toLimaDateYMD(comp.fecha || v.fecha);
      const sedeLabel = v.sedeNombre || SEDES[normalizedSede]?.nombre || normalizedSede;

      // 1. Fila del comprobante original (01 / 03 / NV) si pertenece al mes seleccionado
      if (fechaEmisionYMD.startsWith(selectedMonth)) {
        rows.push({
          rowKey: `${v.id}-ORIG`,
          sortDate: comp.fecha || v.fecha || '',
          periodo,
          carSunat: esSunatReal ? `${rucEmisor}${tipoDocSunat}${serie}${numeroStr.padStart(10, '0')}` : '',
          fechaEmision: formatDMY(fechaEmisionYMD),
          fechaVencimiento: formatDMY(fechaEmisionYMD),
          tipoComprobante: tipoDocSunat,
          serie,
          numero: numeroStr,
          codigoCompleto: `${serie}-${numeroStr}`,
          tipoDocCliente: tipoDocCli,
          numDocCliente: numDocCli,
          razonSocialCliente: nombreCli,
          baseGravada: opGravada,
          igv,
          total,
          moneda: 'PEN',
          docModTipo: '',
          docModSerie: '',
          docModNumero: '',
          docModFecha: '',
          sede: sedeLabel,
          metodoPago: v.metodoPago || 'EFECTIVO',
          estado: v.estado === 'ANULADA' ? (v.notaCredito ? 'ANULADO_CON_NC' : 'ANULADO') : (comp.estado || 'EMITIDO'),
          hashCpe: v.hash_cpe || comp.hash_cpe || comp.hash || '',
          enlacePdf: v.enlace_del_pdf || comp.enlace_del_pdf || '',
          enlaceXml: v.enlace_del_xml || comp.enlace_del_xml || ''
        });
      }

      // 2. Si fue anulada con Nota de Crédito (07) en APISUNAT, incluir la fila negativa de NC en su mes de emisión
      if (v.estado === 'ANULADA' && v.notaCredito) {
        const nc = v.notaCredito;
        const ncFechaYMD = toLimaDateYMD(nc.fechaEmision || nc.fecha || v.fechaAnulacion);
        if (ncFechaYMD.startsWith(selectedMonth)) {
          const ncNumStr = String(nc.numero || 1).padStart(8, '0');
          const ncSerie = (nc.serie || (isFactura ? 'FC01' : 'BC02')).toUpperCase();

          rows.push({
            rowKey: `${v.id}-NC`,
            sortDate: nc.fecha || v.fechaAnulacion || v.fecha || '',
            periodo,
            carSunat: `${rucEmisor}07${ncSerie}${ncNumStr.padStart(10, '0')}`,
            fechaEmision: formatDMY(ncFechaYMD),
            fechaVencimiento: formatDMY(ncFechaYMD),
            tipoComprobante: '07',
            serie: ncSerie,
            numero: ncNumStr,
            codigoCompleto: `${ncSerie}-${ncNumStr}`,
            tipoDocCliente: tipoDocCli,
            numDocCliente: numDocCli,
            razonSocialCliente: nombreCli,
            baseGravada: -opGravada,
            igv: -igv,
            total: -total,
            moneda: 'PEN',
            docModTipo: tipoDocSunat,
            docModSerie: serie,
            docModNumero: numeroStr,
            docModFecha: formatDMY(fechaEmisionYMD),
            sede: sedeLabel,
            metodoPago: v.metodoPago || 'EFECTIVO',
            estado: nc.status || 'ACEPTADO',
            hashCpe: nc.hash_cpe || '',
            enlacePdf: nc.enlace_del_pdf || '',
            enlaceXml: nc.enlace_del_xml || ''
          });
        }
      }
    });

    return rows.sort((a, b) => new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime());
  }, [monthlyVentas, selectedMonth, filterSede, onlySunatDocs]);

  // Totales netos del mes (descontando Notas de Crédito)
  const resumenMes = useMemo(() => {
    let baseNeta = 0;
    let igvNeto = 0;
    let totalNeto = 0;
    let countBoletas = 0;
    let countFacturas = 0;
    let countNC = 0;

    sireRows.forEach((r) => {
      // Si una NV interna sin NC fue anulada, no suma al neto
      if (r.tipoComprobante === 'NV' && r.estado === 'ANULADO') return;
      baseNeta += r.baseGravada;
      igvNeto += r.igv;
      totalNeto += r.total;
      if (r.tipoComprobante === '01') countFacturas++;
      else if (r.tipoComprobante === '03') countBoletas++;
      else if (r.tipoComprobante === '07') countNC++;
    });

    return {
      baseNeta: round2(baseNeta),
      igvNeto: round2(igvNeto),
      totalNeto: round2(totalNeto),
      countFacturas,
      countBoletas,
      countNC
    };
  }, [sireRows]);

  // Descargar Excel (.csv con BOM UTF-8 y columnas tributarias SIRE RVIE)
  const handleDownloadCsv = () => {
    if (sireRows.length === 0) {
      showToast('No hay registros en el período seleccionado para exportar', 'warning');
      return;
    }

    const headers = [
      'Periodo',
      'CAR_SUNAT',
      'Fecha_Emision',
      'Fecha_Vencimiento',
      'Tipo_CP',
      'Serie_CDP',
      'Nro_CDP',
      'Tipo_Doc_Identidad',
      'Nro_Doc_Identidad',
      'Apellidos_Nombres_Razon_Social',
      'BI_Gravada',
      'IGV_IPM',
      'Total_CP',
      'Moneda',
      'Tipo_CP_Modificado',
      'Serie_CP_Modificado',
      'Nro_CP_Modificado',
      'Fecha_Emision_Modificado',
      'Local_Sede',
      'Metodo_Pago',
      'Estado',
      'Hash_CPE',
      'Enlace_PDF',
      'Enlace_XML'
    ];

    const lines = [
      headers.join(','),
      ...sireRows.map((r) =>
        [
          r.periodo,
          r.carSunat,
          r.fechaEmision,
          r.fechaVencimiento,
          r.tipoComprobante,
          r.serie,
          r.numero,
          r.tipoDocCliente,
          r.numDocCliente,
          r.razonSocialCliente,
          r.baseGravada.toFixed(2),
          r.igv.toFixed(2),
          r.total.toFixed(2),
          r.moneda,
          r.docModTipo,
          r.docModSerie,
          r.docModNumero,
          r.docModFecha,
          r.sede,
          r.metodoPago,
          r.estado,
          r.hashCpe,
          r.enlacePdf,
          r.enlaceXml
        ]
          .map(escapeCsvField)
          .join(',')
      )
    ];

    const csvContent = '\uFEFF' + lines.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `SIRE_RVIE_Dolciangel_${selectedMonth}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(`Excel SIRE (${sireRows.length} registros) descargado correctamente`, 'success');
  };

  return (
    <div className="pb-28 max-w-7xl mx-auto px-4 pt-4 space-y-6">
      {/* Cabecera Tributaria / Contabilidad */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 rounded-3xl p-6 text-white shadow-xl border border-emerald-500/20">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300 shadow-inner">
              <Calculator className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-300 bg-emerald-500/15 px-2.5 py-0.5 rounded-full border border-emerald-400/30">
                  SUNAT • SIRE RVIE
                </span>
                <span className="text-[10px] font-mono text-slate-300 bg-white/10 px-2 py-0.5 rounded-full">
                  RUC {SUNAT_CONFIG.EMPRESA_RUC}
                </span>
              </div>
              <h2 className="text-xl md:text-2xl font-serif font-bold mt-1">
                Contabilidad & Registro de Ventas SIRE
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Declaración mensual de Boletas (03), Facturas (01), Notas de Crédito (07) y exportación Excel CSV.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => fetchMonthFromFirestore(selectedMonth)}
              disabled={isLoading}
              className="px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-2 border border-white/15 transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Actualizar</span>
            </button>
            <button
              onClick={handleDownloadCsv}
              className="px-5 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/25 flex items-center gap-2 active:scale-95 transition-all"
            >
              <Download className="w-4 h-4" />
              <span>📥 Descargar Excel SIRE (.csv)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filtros de Período y Sede */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-pink-100 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
            <Calendar className="w-4 h-4 text-brand-700" />
            <label className="text-xs font-bold text-slate-600">Mes Tributario:</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-xs font-extrabold text-slate-900 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <Building2 className="w-4 h-4 text-slate-400 mr-0.5" />
            {[
              { id: 'TODAS', label: 'Todos los locales' },
              { id: 'BA', label: 'Buenos Aires' },
              { id: 'VE', label: 'Villa España' }
            ].map((s) => (
              <button
                key={s.id}
                onClick={() => setFilterSede(s.id)}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                  filterSede === s.id
                    ? 'bg-brand-700 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-bold text-slate-700 bg-emerald-50/70 border border-emerald-200 px-3.5 py-2 rounded-xl">
          <input
            type="checkbox"
            checked={onlySunatDocs}
            onChange={(e) => setOnlySunatDocs(e.target.checked)}
            className="rounded text-emerald-600 focus:ring-emerald-500"
          />
          <span>Solo Comprobantes SUNAT (01, 03, 07)</span>
        </label>
      </div>

      {/* Tarjetas de Resumen Tributario */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase block">Base Imponible Neta</span>
          <span className="text-2xl font-black text-slate-900 mt-1 block">
            S/ {resumenMes.baseNeta.toFixed(2)}
          </span>
          <span className="text-[10px] text-slate-400">Op. Gravadas del período</span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-emerald-200 shadow-xs">
          <span className="text-[11px] font-bold text-emerald-700 uppercase block">IGV (18%) Neto</span>
          <span className="text-2xl font-black text-emerald-700 mt-1 block">
            S/ {resumenMes.igvNeto.toFixed(2)}
          </span>
          <span className="text-[10px] text-emerald-600/80">Débito fiscal (01 + 03 - 07)</span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-pink-200 shadow-xs">
          <span className="text-[11px] font-bold text-brand-800 uppercase block">Importe Total Neto</span>
          <span className="text-2xl font-black text-brand-800 mt-1 block">
            S/ {resumenMes.totalNeto.toFixed(2)}
          </span>
          <span className="text-[10px] text-slate-400">{sireRows.length} filas en registro</span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase block">Comprobantes SUNAT</span>
          <div className="flex items-center justify-between text-xs pt-0.5">
            <span className="text-amber-800 font-bold">Facturas (01):</span>
            <span className="font-mono font-black text-slate-900">{resumenMes.countFacturas}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-purple-800 font-bold">Boletas (03):</span>
            <span className="font-mono font-black text-slate-900">{resumenMes.countBoletas}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-rose-700 font-bold">Notas Crédito (07):</span>
            <span className="font-mono font-black text-rose-700">{resumenMes.countNC}</span>
          </div>
        </div>
      </div>

      {/* Tabla de Registros SIRE */}
      <div className="bg-white rounded-2xl border border-pink-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider font-bold border-b border-slate-200 text-[11px]">
              <tr>
                <th className="py-3 px-3">Fecha</th>
                <th className="py-3 px-3">Tipo / Serie-Nro</th>
                <th className="py-3 px-3">Cliente (Doc / Razón Social)</th>
                <th className="py-3 px-3">Local / Pago</th>
                <th className="py-3 px-3 text-right">Base Grav.</th>
                <th className="py-3 px-3 text-right">IGV 18%</th>
                <th className="py-3 px-3 text-right">Total</th>
                <th className="py-3 px-3 text-center">Estado</th>
                <th className="py-3 px-3 text-center">SUNAT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-400 font-semibold">
                    Cargando registros tributarios desde Firestore...
                  </td>
                </tr>
              ) : sireRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-400">
                    No se encontraron comprobantes para el mes {selectedMonth}.
                  </td>
                </tr>
              ) : (
                sireRows.map((r) => {
                  const isNC = r.tipoComprobante === '07';
                  return (
                    <tr
                      key={r.rowKey}
                      className={`hover:bg-slate-50/80 transition-colors ${isNC ? 'bg-rose-50/30' : ''}`}
                    >
                      <td className="py-3 px-3 whitespace-nowrap font-mono text-slate-600">
                        {r.fechaEmision}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className={`px-1.5 py-0.5 rounded font-mono font-extrabold text-[10px] ${
                            r.tipoComprobante === '01'
                              ? 'bg-amber-100 text-amber-900'
                              : r.tipoComprobante === '03'
                              ? 'bg-purple-100 text-purple-900'
                              : r.tipoComprobante === '07'
                              ? 'bg-rose-100 text-rose-900'
                              : 'bg-slate-100 text-slate-700'
                          }`}>
                            {r.tipoComprobante}
                          </span>
                          <span className="font-mono font-bold text-slate-900">
                            {r.codigoCompleto}
                          </span>
                        </div>
                        {isNC && r.docModSerie && (
                          <span className="text-[10px] text-rose-600 block font-mono mt-0.5">
                            Modifica: {r.docModTipo} {r.docModSerie}-{r.docModNumero}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-semibold text-slate-800 block truncate max-w-[180px]">
                          {r.razonSocialCliente}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          [{r.tipoDocCliente}] {r.numDocCliente}
                        </span>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="font-semibold text-slate-700 block">{r.sede}</span>
                        <span className="text-[10px] text-slate-400 font-bold">{r.metodoPago}</span>
                      </td>
                      <td className={`py-3 px-3 text-right font-mono ${isNC ? 'text-rose-600' : 'text-slate-700'}`}>
                        {r.baseGravada.toFixed(2)}
                      </td>
                      <td className={`py-3 px-3 text-right font-mono ${isNC ? 'text-rose-600' : 'text-slate-700'}`}>
                        {r.igv.toFixed(2)}
                      </td>
                      <td className={`py-3 px-3 text-right font-mono font-black ${isNC ? 'text-rose-700' : 'text-slate-900'}`}>
                        {r.total.toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          r.estado.includes('ANULADO')
                            ? 'bg-rose-100 text-rose-800'
                            : r.estado === 'CONTROL_INTERNO'
                            ? 'bg-slate-100 text-slate-700'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {r.estado}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {r.enlacePdf && (
                            <a
                              href={r.enlacePdf}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Abrir PDF APISUNAT"
                              className="p-1.5 rounded-lg bg-slate-900 hover:bg-black text-gold-300 transition-all"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </a>
                          )}
                          {r.enlaceXml && (
                            <a
                              href={r.enlaceXml}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Descargar XML SUNAT"
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
