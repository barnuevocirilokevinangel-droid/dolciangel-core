import React, { useState, useMemo } from 'react';
import { useApp, SEDES } from '../context/AppContext';
import { CATEGORIAS } from '../data/initialCatalog';
import { 
  BarChart3, 
  Calendar, 
  Banknote, 
  Smartphone, 
  CreditCard, 
  Printer, 
  Share2, 
  Wallet, 
  ShoppingBag,
  TrendingUp,
  ArrowDownLeft,
  CheckCircle2,
  Store
} from 'lucide-react';

export const ResumenView = () => {
  const { sede, ventas, movimientosCaja, sesionCaja, showToast } = useApp();

  // Fecha seleccionada (por defecto hoy en YYYY-MM-DD local)
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });

  const [selectedSedeFilter, setSelectedSedeFilter] = useState(sede || 'BA');

  // Filtrar ventas por fecha y sede
  const ventasDia = useMemo(() => {
    return ventas.filter(v => {
      const matchSede = selectedSedeFilter === 'TODAS' || v.sede === selectedSedeFilter;
      const vFecha = (v.fecha || '').split('T')[0];
      return matchSede && vFecha === selectedDate && v.estado !== 'ANULADA';
    });
  }, [ventas, selectedDate, selectedSedeFilter]);

  // Total del Día en S/.
  const totalDia = useMemo(() => {
    return ventasDia.reduce((sum, v) => sum + (v.total || 0), 0);
  }, [ventasDia]);

  // Desglose por Método de Pago
  const pagoDesglose = useMemo(() => {
    let efectivo = 0;
    let yape = 0;
    let tarjeta = 0;

    ventasDia.forEach(v => {
      if (v.metodoPago === 'EFECTIVO') efectivo += v.total || 0;
      else if (v.metodoPago === 'YAPE_PLIN') yape += v.total || 0;
      else if (v.metodoPago === 'TARJETA') tarjeta += v.total || 0;
    });

    return { efectivo, yape, tarjeta };
  }, [ventasDia]);

  // Desglose de Unidades Vendidas por Categoría
  const categoriaDesglose = useMemo(() => {
    const counts = {};
    const totals = {};
    CATEGORIAS.forEach(c => {
      counts[c.id] = 0;
      totals[c.id] = 0;
    });

    ventasDia.forEach(v => {
      if (Array.isArray(v.items)) {
        v.items.forEach(it => {
          const cat = it.categoria || 'otros';
          if (counts[cat] === undefined) {
            counts[cat] = 0;
            totals[cat] = 0;
          }
          counts[cat] += it.cantidad || 0;
          totals[cat] += it.subtotal || 0;
        });
      }
    });

    return { counts, totals };
  }, [ventasDia]);

  // Total de platos / porciones vendidas
  const totalPlatosVendidos = useMemo(() => {
    return Object.values(categoriaDesglose.counts).reduce((a, b) => a + b, 0);
  }, [categoriaDesglose]);

  // Egresos del día
  const egresosDia = useMemo(() => {
    return movimientosCaja.filter(m => {
      const matchSede = selectedSedeFilter === 'TODAS' || m.sede === selectedSedeFilter;
      const mFecha = (m.fecha || '').split('T')[0];
      return matchSede && mFecha === selectedDate && m.tipo === 'EGRESO_GASTO';
    }).reduce((sum, m) => sum + (m.monto || 0), 0);
  }, [movimientosCaja, selectedDate, selectedSedeFilter]);

  // Saldo efectivo en gaveta esperado (si hay sesión del día)
  const saldoGavetaTeorico = useMemo(() => {
    const apertura = sesionCaja ? Number(sesionCaja.montoApertura || 0) : 0;
    return apertura + pagoDesglose.efectivo - egresosDia;
  }, [sesionCaja, pagoDesglose.efectivo, egresosDia]);

  // Compartir texto por WhatsApp
  const handleShareSummary = () => {
    const text = `📊 *RESUMEN DIARIO DOLCIANGEL*\n` +
      `📅 Fecha: ${selectedDate}\n` +
      `🏪 Sede: ${SEDES[selectedSedeFilter]?.nombre || 'Todas'}\n\n` +
      `💰 *TOTAL DEL DÍA: S/ ${totalDia.toFixed(2)}*\n` +
      `🧾 Comandas: ${ventasDia.length} ventas (${totalPlatosVendidos} porciones)\n\n` +
      `💵 Efectivo: S/ ${pagoDesglose.efectivo.toFixed(2)}\n` +
      `📱 Yape / Plin: S/ ${pagoDesglose.yape.toFixed(2)}\n` +
      `💳 Tarjeta POS: S/ ${pagoDesglose.tarjeta.toFixed(2)}\n` +
      `🔻 Salidas / Egresos: S/ ${egresosDia.toFixed(2)}\n\n` +
      `🧁 *Top Categorías:*\n` +
      CATEGORIAS.map(c => `• ${c.label}: ${categoriaDesglose.counts[c.id] || 0} un. (S/ ${(categoriaDesglose.totals[c.id] || 0).toFixed(2)})`).join('\n');

    const encoded = encodeURI(text);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
  };

  return (
    <div className="pb-28 max-w-7xl mx-auto px-4 pt-4 space-y-6">
      {/* Selector de Fecha y Sede */}
      <div className="bg-white rounded-3xl p-4 shadow-sm border border-pink-100 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs w-full sm:w-auto">
          <Calendar className="w-4 h-4 text-brand-700" />
          <span className="font-bold text-slate-700">Fecha del Resumen:</span>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 font-bold text-slate-800 text-xs focus:outline-none focus:border-brand-500 bg-slate-50"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl text-xs font-bold">
            <button
              onClick={() => setSelectedSedeFilter('BA')}
              className={`px-3 py-1 rounded-xl transition-all ${
                selectedSedeFilter === 'BA'
                  ? 'bg-white text-brand-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Buenos Aires
            </button>
            <button
              onClick={() => setSelectedSedeFilter('VE')}
              className={`px-3 py-1 rounded-xl transition-all ${
                selectedSedeFilter === 'VE'
                  ? 'bg-white text-brand-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Villa España
            </button>
            <button
              onClick={() => setSelectedSedeFilter('TODAS')}
              className={`px-3 py-1 rounded-xl transition-all ${
                selectedSedeFilter === 'TODAS'
                  ? 'bg-white text-brand-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Ambas Sedes
            </button>
          </div>

          <button
            onClick={handleShareSummary}
            title="Compartir resumen por WhatsApp"
            className="p-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold transition-all border border-emerald-200"
          >
            <Share2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => window.print()}
            title="Imprimir resumen"
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all border border-slate-200"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 1. TARJETA GIGANTE: TOTAL DEL DÍA EN SOLES */}
      <div className="bg-gradient-to-tr from-brand-900 via-brand-700 to-pink-600 rounded-3xl p-8 text-white shadow-2xl shadow-brand-700/25 relative overflow-hidden text-center">
        <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full -mr-24 -mt-24 pointer-events-none blur-xl" />
        
        <span className="text-xs font-black uppercase tracking-widest text-pink-200 bg-white/15 px-3.5 py-1 rounded-full border border-white/20 inline-block">
          Cierre & Recaudación Diaria • {SEDES[selectedSedeFilter]?.nombre || 'Consolidado'}
        </span>

        <div className="my-4">
          <span className="text-sm text-pink-100 block font-semibold mb-1">VENTAS TOTALES DEL DÍA</span>
          <div className="text-5xl sm:text-6xl font-black text-gold-300 tracking-tight font-serif">
            S/ {totalDia.toFixed(2)}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-pink-100 pt-2 border-t border-white/15">
          <span className="flex items-center gap-1 font-bold">
            <ShoppingBag className="w-4 h-4 text-gold-300" />
            <span>{ventasDia.length} comandas emitidas</span>
          </span>
          <span>•</span>
          <span className="flex items-center gap-1 font-bold">
            <TrendingUp className="w-4 h-4 text-emerald-300" />
            <span>{totalPlatosVendidos} porciones y bebidas vendidas</span>
          </span>
          <span>•</span>
          <span className="flex items-center gap-1 font-bold">
            <span>Ticket Promedio: </span>
            <strong className="text-white">
              S/ {ventasDia.length > 0 ? (totalDia / ventasDia.length).toFixed(2) : '0.00'}
            </strong>
          </span>
        </div>
      </div>

      {/* 2. DESGLOSE POR MÉTODO DE PAGO */}
      <div>
        <h3 className="font-serif font-bold text-lg text-slate-800 mb-3 flex items-center gap-2">
          <span>💳</span>
          <span>Desglose por Método de Pago</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Efectivo */}
          <div className="bg-white rounded-3xl p-5 border border-pink-100 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Banknote className="w-4 h-4 text-emerald-600" />
                <span>Efectivo en Caja</span>
              </span>
              <span className="text-[11px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                {totalDia > 0 ? `${((pagoDesglose.efectivo / totalDia) * 100).toFixed(0)}%` : '0%'}
              </span>
            </div>
            <div className="text-2xl font-black text-slate-900">
              S/ {pagoDesglose.efectivo.toFixed(2)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              {ventasDia.filter(v => v.metodoPago === 'EFECTIVO').length} transacciones
            </div>
          </div>

          {/* Yape / Plin */}
          <div className="bg-white rounded-3xl p-5 border border-pink-100 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-purple-600" />
                <span>Yape / Plin</span>
              </span>
              <span className="text-[11px] font-extrabold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full">
                {totalDia > 0 ? `${((pagoDesglose.yape / totalDia) * 100).toFixed(0)}%` : '0%'}
              </span>
            </div>
            <div className="text-2xl font-black text-purple-900">
              S/ {pagoDesglose.yape.toFixed(2)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              {ventasDia.filter(v => v.metodoPago === 'YAPE_PLIN').length} transacciones
            </div>
          </div>

          {/* Tarjeta */}
          <div className="bg-white rounded-3xl p-5 border border-pink-100 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-blue-600" />
                <span>Tarjeta POS</span>
              </span>
              <span className="text-[11px] font-extrabold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                {totalDia > 0 ? `${((pagoDesglose.tarjeta / totalDia) * 100).toFixed(0)}%` : '0%'}
              </span>
            </div>
            <div className="text-2xl font-black text-blue-900">
              S/ {pagoDesglose.tarjeta.toFixed(2)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              {ventasDia.filter(v => v.metodoPago === 'TARJETA').length} transacciones
            </div>
          </div>
        </div>
      </div>

      {/* 3. RESUMEN DE FLUJO DE CAJA CHICA */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-md">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-gold-400" />
            <h3 className="font-serif font-bold text-base">Arqueo de Flujo de Efectivo</h3>
          </div>
          <span className="text-xs text-slate-400">Saldo teórico en gaveta</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
            <span className="text-[11px] text-slate-400 block font-bold">Apertura</span>
            <span className="text-base font-extrabold text-white">
              S/ {sesionCaja ? Number(sesionCaja.montoApertura || 0).toFixed(2) : '0.00'}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
            <span className="text-[11px] text-emerald-400 block font-bold">+ Ventas Efectivo</span>
            <span className="text-base font-extrabold text-emerald-300">
              + S/ {pagoDesglose.efectivo.toFixed(2)}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
            <span className="text-[11px] text-rose-400 block font-bold">- Egresos / Gastos</span>
            <span className="text-base font-extrabold text-rose-300">
              - S/ {egresosDia.toFixed(2)}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-gold-400/20 border border-gold-400/30">
            <span className="text-[11px] text-gold-300 block font-extrabold">= Efectivo en Mano</span>
            <span className="text-lg font-black text-gold-300">
              S/ {saldoGavetaTeorico.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* 4. UNIDADES VENDIDAS POR CATEGORÍA */}
      <div className="bg-white rounded-3xl p-6 border border-pink-100 shadow-sm">
        <h3 className="font-serif font-bold text-lg text-slate-800 mb-4 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <span>🧁</span>
            <span>Unidades & Recaudación por Categoría</span>
          </span>
          <span className="text-xs font-normal text-slate-500">
            {totalPlatosVendidos} porciones en total
          </span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
          {CATEGORIAS.map((cat) => {
            const count = categoriaDesglose.counts[cat.id] || 0;
            const subtotal = categoriaDesglose.totals[cat.id] || 0;
            const pct = totalDia > 0 ? (subtotal / totalDia) * 100 : 0;

            return (
              <div 
                key={cat.id}
                className="p-3.5 rounded-2xl border border-slate-200/80 bg-slate-50/60 hover:bg-pink-50/40 transition-colors flex flex-col justify-between"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{cat.icon}</span>
                    <span className="font-bold text-slate-900 text-sm">{cat.label}</span>
                  </div>
                  <span className="font-extrabold text-sm text-brand-700 bg-white border border-pink-200 px-2 py-0.5 rounded-lg shadow-xs">
                    {count} un.
                  </span>
                </div>

                <div>
                  <div className="flex justify-between items-center text-xs text-slate-600 mb-1">
                    <span>Recaudado:</span>
                    <span className="font-extrabold text-slate-900">S/ {subtotal.toFixed(2)}</span>
                  </div>

                  {/* Barra de Progreso */}
                  <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="bg-brand-600 h-full rounded-full transition-all"
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
