import React, { useState, useMemo } from 'react';
import { useApp, SEDES } from '../context/AppContext';
import { 
  TrendingUp, 
  BarChart2, 
  PieChart, 
  Award, 
  Store, 
  Calendar, 
  DollarSign, 
  ShoppingBag, 
  Clock, 
  Sparkles,
  Banknote,
  Smartphone,
  CreditCard,
  FileText,
  Percent,
  CheckCircle2
} from 'lucide-react';

export const StatsView = () => {
  const { ventas, sede } = useApp();

  // Filtros: Período y Sede
  const [periodo, setPeriodo] = useState('mes'); // 'hoy', 'semana', 'mes', 'todo'
  const [selectedSede, setSelectedSede] = useState('TODAS'); // 'TODAS', 'BA', 'VE'

  // Filtrado de ventas según período y sede
  const filteredVentas = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    return ventas.filter(v => {
      if (v.estado === 'ANULADA') return false;

      // Filtro Sede
      if (selectedSede !== 'TODAS' && v.sede !== selectedSede) {
        return false;
      }

      // Filtro Período
      if (!v.fecha) return true;
      const vDateStr = v.fecha.split('T')[0];
      const vDate = new Date(v.fecha);

      if (periodo === 'hoy') {
        return vDateStr === todayStr;
      }
      if (periodo === 'semana') {
        const diffTime = Math.abs(now.getTime() - vDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays <= 7;
      }
      if (periodo === 'mes') {
        return (
          vDate.getMonth() === now.getMonth() &&
          vDate.getFullYear() === now.getFullYear()
        );
      }
      return true; // 'todo'
    });
  }, [ventas, periodo, selectedSede]);

  // Cálculos de KPIs Principales
  const kpis = useMemo(() => {
    const totalVentas = filteredVentas.reduce((sum, v) => sum + (v.total || 0), 0);
    const totalComandas = filteredVentas.length;
    const ticketPromedio = totalComandas > 0 ? totalVentas / totalComandas : 0;

    let totalUnidades = 0;
    filteredVentas.forEach(v => {
      if (Array.isArray(v.items)) {
        v.items.forEach(it => {
          totalUnidades += it.cantidad || 0;
        });
      }
    });

    return { totalVentas, totalComandas, ticketPromedio, totalUnidades };
  }, [filteredVentas]);

  // Comparativa Buenos Aires vs Villa España
  const comparativaSedes = useMemo(() => {
    const dataBA = { ventas: 0, comandas: 0, unidades: 0 };
    const dataVE = { ventas: 0, comandas: 0, unidades: 0 };

    // Evaluamos sobre todas las ventas del período elegido (sin filtrar por sede individual)
    const ventasDelPeriodo = ventas.filter(v => {
      if (v.estado === 'ANULADA') return false;
      if (!v.fecha) return true;
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      const vDateStr = v.fecha.split('T')[0];
      const vDate = new Date(v.fecha);

      if (periodo === 'hoy') return vDateStr === todayStr;
      if (periodo === 'semana') {
        const diffDays = Math.ceil(Math.abs(now - vDate) / (1000 * 60 * 60 * 24));
        return diffDays <= 7;
      }
      if (periodo === 'mes') {
        return vDate.getMonth() === now.getMonth() && vDate.getFullYear() === now.getFullYear();
      }
      return true;
    });

    ventasDelPeriodo.forEach(v => {
      const target = v.sede === 'VE' ? dataVE : dataBA;
      target.ventas += v.total || 0;
      target.comandas += 1;
      if (Array.isArray(v.items)) {
        v.items.forEach(it => {
          target.unidades += it.cantidad || 0;
        });
      }
    });

    const totalGeneral = dataBA.ventas + dataVE.ventas;
    const pctBA = totalGeneral > 0 ? (dataBA.ventas / totalGeneral) * 100 : 50;
    const pctVE = totalGeneral > 0 ? (dataVE.ventas / totalGeneral) * 100 : 50;
    const ticketBA = dataBA.comandas > 0 ? dataBA.ventas / dataBA.comandas : 0;
    const ticketVE = dataVE.comandas > 0 ? dataVE.ventas / dataVE.comandas : 0;

    return { dataBA, dataVE, totalGeneral, pctBA, pctVE, ticketBA, ticketVE };
  }, [ventas, periodo]);

  // Ranking de Postres / Productos Más Vendidos
  const rankingProductos = useMemo(() => {
    const map = {};

    filteredVentas.forEach(v => {
      if (Array.isArray(v.items)) {
        v.items.forEach(it => {
          const key = it.nombre || 'Producto';
          if (!map[key]) {
            map[key] = {
              nombre: key,
              categoria: it.categoria || 'otros',
              cantidad: 0,
              recaudado: 0,
              precioUnitario: it.precioUnitario || 0
            };
          }
          map[key].cantidad += it.cantidad || 0;
          map[key].recaudado += it.subtotal || ((it.cantidad || 0) * (it.precioUnitario || 0));
        });
      }
    });

    const sorted = Object.values(map).sort((a, b) => b.cantidad - a.cantidad);
    const maxQty = sorted.length > 0 ? sorted[0].cantidad : 1;

    return { list: sorted.slice(0, 10), maxQty };
  }, [filteredVentas]);

  // Desglose por Método de Pago
  const metodosPago = useMemo(() => {
    let efectivo = 0;
    let yape = 0;
    let tarjeta = 0;

    filteredVentas.forEach(v => {
      if (v.metodoPago === 'EFECTIVO') efectivo += v.total || 0;
      else if (v.metodoPago === 'YAPE_PLIN') yape += v.total || 0;
      else if (v.metodoPago === 'TARJETA') tarjeta += v.total || 0;
    });

    const total = efectivo + yape + tarjeta;
    return {
      efectivo,
      yape,
      tarjeta,
      total,
      pctEfectivo: total > 0 ? (efectivo / total) * 100 : 0,
      pctYape: total > 0 ? (yape / total) * 100 : 0,
      pctTarjeta: total > 0 ? (tarjeta / total) * 100 : 0
    };
  }, [filteredVentas]);

  // Desglose por Franja Horaria
  const turnos = useMemo(() => {
    let manana = { ventas: 0, count: 0 }; // 08:00 - 13:59
    let tarde = { ventas: 0, count: 0 };  // 14:00 - 17:59
    let noche = { ventas: 0, count: 0 };  // 18:00 en adelante

    filteredVentas.forEach(v => {
      if (!v.fecha) return;
      const d = new Date(v.fecha);
      const h = d.getHours();

      if (h < 14) {
        manana.ventas += v.total || 0;
        manana.count += 1;
      } else if (h < 18) {
        tarde.ventas += v.total || 0;
        tarde.count += 1;
      } else {
        noche.ventas += v.total || 0;
        noche.count += 1;
      }
    });

    return { manana, tarde, noche };
  }, [filteredVentas]);

  return (
    <div className="pb-28 max-w-7xl mx-auto px-4 pt-4 space-y-6">
      {/* Encabezado con Filtros */}
      <div className="bg-gradient-to-r from-slate-900 via-brand-950 to-slate-900 rounded-3xl p-6 text-white shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-pink-300 bg-white/10 px-2.5 py-0.5 rounded-full border border-white/20">
                Métricas & BI Comercial
              </span>
              <span className="text-[11px] text-slate-300 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-gold-400" />
                Dolciangel Intelligence
              </span>
            </div>
            <h2 className="text-2xl md:text-3xl font-serif font-bold text-white mt-1">
              Estadísticas de Ventas & Rendimiento
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Ticket promedio, ranking de postres más vendidos y comparativa entre sedes.
            </p>
          </div>

          {/* Filtros rápidos */}
          <div className="flex flex-wrap items-center gap-2 bg-white/10 backdrop-blur-md p-1.5 rounded-2xl border border-white/10">
            {/* Período */}
            <div className="flex bg-slate-950/50 rounded-xl p-1">
              {[
                { id: 'hoy', label: 'Hoy' },
                { id: 'semana', label: '7 Días' },
                { id: 'mes', label: 'Este Mes' },
                { id: 'todo', label: 'Histórico' }
              ].map(p => (
                <button
                  key={p.id}
                  onClick={() => setPeriodo(p.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    periodo === p.id
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Selector de Sede */}
            <div className="flex bg-slate-950/50 rounded-xl p-1">
              {[
                { id: 'TODAS', label: 'Todas' },
                { id: 'BA', label: 'Buenos Aires' },
                { id: 'VE', label: 'Villa España' }
              ].map(s => (
                <button
                  key={s.id}
                  onClick={() => setSelectedSede(s.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    selectedSede === s.id
                      ? 'bg-gold-500 text-slate-950 shadow-sm'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tarjetas Principales de KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Ingresos */}
        <div className="bg-white rounded-2xl p-5 border border-pink-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="absolute top-0 right-0 w-24 h-24 bg-brand-50 rounded-full -mr-8 -mt-8 pointer-events-none group-hover:scale-110 transition-transform" />
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Ventas</span>
            <div className="w-8 h-8 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-brand-700">
            S/ {kpis.totalVentas.toFixed(2)}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {filteredVentas.length} transacciones auditadas
          </span>
        </div>

        {/* Ticket Promedio */}
        <div className="bg-white rounded-2xl p-5 border border-amber-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-50 rounded-full -mr-8 -mt-8 pointer-events-none group-hover:scale-110 transition-transform" />
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ticket Promedio</span>
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-amber-700">
            S/ {kpis.ticketPromedio.toFixed(2)}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            Gasto medio por cliente / comanda
          </span>
        </div>

        {/* Comandas Realizadas */}
        <div className="bg-white rounded-2xl p-5 border border-purple-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-50 rounded-full -mr-8 -mt-8 pointer-events-none group-hover:scale-110 transition-transform" />
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Comandas</span>
            <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-purple-700">
            {kpis.totalComandas}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            Cuentas cobradas con éxito
          </span>
        </div>

        {/* Unidades Totales Vendidas */}
        <div className="bg-white rounded-2xl p-5 border border-emerald-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-full -mr-8 -mt-8 pointer-events-none group-hover:scale-110 transition-transform" />
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Porciones / Platos</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-emerald-700">
            {kpis.totalUnidades}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            Items despachados en vitrina/cocina
          </span>
        </div>
      </div>

      {/* COMPARATIVA DIRECTA: BUENOS AIRES VS VILLA ESPAÑA */}
      <div className="bg-white rounded-3xl p-6 border border-pink-100 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-brand-700">
              Benchmark de Locales
            </span>
            <h3 className="text-xl font-serif font-bold text-slate-900">
              Comparativa: Buenos Aires vs. Villa España
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            Período evaluado: {periodo === 'hoy' ? 'Hoy' : periodo === 'semana' ? 'Últimos 7 días' : periodo === 'mes' ? 'Este Mes' : 'Histórico Total'}
          </span>
        </div>

        {/* Barra de Proporción Visual */}
        <div className="mb-6">
          <div className="flex justify-between text-xs font-extrabold mb-1.5">
            <span className="text-brand-700 flex items-center gap-1.5">
              <span>🏪 Buenos Aires ({comparativaSedes.pctBA.toFixed(1)}%)</span>
            </span>
            <span className="text-amber-700 flex items-center gap-1.5">
              <span>Villa España ({comparativaSedes.pctVE.toFixed(1)}%) 🏪</span>
            </span>
          </div>
          <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
            <div 
              style={{ width: `${comparativaSedes.pctBA}%` }}
              className="bg-gradient-to-r from-brand-600 to-pink-500 h-full transition-all duration-500" 
            />
            <div 
              style={{ width: `${comparativaSedes.pctVE}%` }}
              className="bg-gradient-to-r from-amber-400 to-amber-500 h-full transition-all duration-500" 
            />
          </div>
        </div>

        {/* Tarjetas comparativas lado a lado */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Buenos Aires */}
          <div className="bg-gradient-to-br from-pink-50/60 to-white rounded-2xl p-5 border border-pink-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-sm">
                  BA
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">Buenos Aires</h4>
                  <span className="text-[10px] text-slate-500 font-medium">Nuevo Chimbote</span>
                </div>
              </div>
              <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-brand-100 text-brand-800">
                {comparativaSedes.pctBA.toFixed(0)}% de ventas
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t border-pink-100">
              <div>
                <span className="text-[11px] text-slate-400 block">Total S/.</span>
                <span className="font-extrabold text-brand-700 text-base">
                  S/ {comparativaSedes.dataBA.ventas.toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block">Ticket Prom.</span>
                <span className="font-extrabold text-slate-800 text-base">
                  S/ {comparativaSedes.ticketBA.toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block">Comandas</span>
                <span className="font-extrabold text-slate-800 text-base">
                  {comparativaSedes.dataBA.comandas}
                </span>
              </div>
            </div>
          </div>

          {/* Villa España */}
          <div className="bg-gradient-to-br from-amber-50/60 to-white rounded-2xl p-5 border border-amber-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-sm">
                  VE
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">Villa España</h4>
                  <span className="text-[10px] text-slate-500 font-medium">Chimbote</span>
                </div>
              </div>
              <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900">
                {comparativaSedes.pctVE.toFixed(0)}% de ventas
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t border-amber-100">
              <div>
                <span className="text-[11px] text-slate-400 block">Total S/.</span>
                <span className="font-extrabold text-amber-700 text-base">
                  S/ {comparativaSedes.dataVE.ventas.toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block">Ticket Prom.</span>
                <span className="font-extrabold text-slate-800 text-base">
                  S/ {comparativaSedes.ticketVE.toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block">Comandas</span>
                <span className="font-extrabold text-slate-800 text-base">
                  {comparativaSedes.dataVE.comandas}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid: TOP POSTRES & MÉTODOS DE PAGO */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* RANKING TOP 10 POSTRES MÁS VENDIDOS */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-pink-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gold-400 text-slate-950 flex items-center justify-center">
                <Award className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-serif font-bold text-lg text-slate-900">
                  Top Postres & Productos Más Vendidos
                </h3>
                <span className="text-xs text-slate-400">
                  Ranking ordenado por unidades despachadas
                </span>
              </div>
            </div>
            <span className="text-xs font-bold text-brand-700 bg-pink-50 px-2.5 py-1 rounded-full">
              Top 10
            </span>
          </div>

          <div className="space-y-3">
            {rankingProductos.list.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs">
                No hay ventas registradas para el período seleccionado
              </div>
            ) : (
              rankingProductos.list.map((item, idx) => {
                const percent = (item.cantidad / rankingProductos.maxQty) * 100;
                const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;

                return (
                  <div key={item.nombre} className="p-3 rounded-2xl bg-slate-50/80 hover:bg-pink-50/50 transition-colors border border-slate-100">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-sm font-extrabold w-6 text-center text-slate-700">
                          {medal}
                        </span>
                        <div className="min-w-0">
                          <span className="font-bold text-slate-900 text-xs block truncate">
                            {item.nombre}
                          </span>
                          <span className="text-[10px] text-slate-400 uppercase font-semibold">
                            {item.categoria} • P.U. S/ {item.precioUnitario?.toFixed(2) || '0.00'}
                          </span>
                        </div>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <span className="font-extrabold text-brand-700 text-xs block">
                          {item.cantidad} {item.cantidad === 1 ? 'unidad' : 'unidades'}
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono">
                          S/ {item.recaudado.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Barra de progreso visual */}
                    <div className="h-1.5 w-full bg-slate-200/70 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${percent}%` }}
                        className={`h-full rounded-full ${
                          idx === 0 
                            ? 'bg-gold-500' 
                            : idx === 1 
                            ? 'bg-brand-500' 
                            : 'bg-purple-500'
                        }`}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* COLUMNA DERECHA: MÉTODOS DE PAGO Y FRANJA HORARIA */}
        <div className="space-y-6">
          {/* Métodos de Pago */}
          <div className="bg-white rounded-3xl p-6 border border-pink-100 shadow-sm">
            <h3 className="font-serif font-bold text-base text-slate-900 mb-1 flex items-center gap-2">
              <PieChart className="w-4 h-4 text-brand-600" />
              <span>Ventas por Medio de Pago</span>
            </h3>
            <span className="text-xs text-slate-400 block mb-4">
              Distribución de ingresos digitales vs efectivo
            </span>

            <div className="space-y-3">
              {/* Efectivo */}
              <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-100">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-bold text-emerald-900 flex items-center gap-1.5">
                    <Banknote className="w-4 h-4 text-emerald-700" />
                    <span>Efectivo</span>
                  </span>
                  <span className="font-extrabold text-emerald-800">
                    S/ {metodosPago.efectivo.toFixed(2)} ({metodosPago.pctEfectivo.toFixed(0)}%)
                  </span>
                </div>
                <div className="h-1.5 w-full bg-emerald-100 rounded-full overflow-hidden">
                  <div 
                    style={{ width: `${metodosPago.pctEfectivo}%` }} 
                    className="h-full bg-emerald-600 rounded-full" 
                  />
                </div>
              </div>

              {/* Yape / Plin */}
              <div className="p-3 rounded-2xl bg-purple-50/70 border border-purple-100">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-bold text-purple-900 flex items-center gap-1.5">
                    <Smartphone className="w-4 h-4 text-purple-700" />
                    <span>Yape / Plin</span>
                  </span>
                  <span className="font-extrabold text-purple-800">
                    S/ {metodosPago.yape.toFixed(2)} ({metodosPago.pctYape.toFixed(0)}%)
                  </span>
                </div>
                <div className="h-1.5 w-full bg-purple-100 rounded-full overflow-hidden">
                  <div 
                    style={{ width: `${metodosPago.pctYape}%` }} 
                    className="h-full bg-purple-600 rounded-full" 
                  />
                </div>
              </div>

              {/* Tarjeta */}
              <div className="p-3 rounded-2xl bg-blue-50/70 border border-blue-100">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-bold text-blue-900 flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4 text-blue-700" />
                    <span>Tarjeta (POS)</span>
                  </span>
                  <span className="font-extrabold text-blue-800">
                    S/ {metodosPago.tarjeta.toFixed(2)} ({metodosPago.pctTarjeta.toFixed(0)}%)
                  </span>
                </div>
                <div className="h-1.5 w-full bg-blue-100 rounded-full overflow-hidden">
                  <div 
                    style={{ width: `${metodosPago.pctTarjeta}%` }} 
                    className="h-full bg-blue-600 rounded-full" 
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Franja Horaria / Horas Pico */}
          <div className="bg-white rounded-3xl p-6 border border-pink-100 shadow-sm">
            <h3 className="font-serif font-bold text-base text-slate-900 mb-1 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600" />
              <span>Horarios Pico de Consumo</span>
            </h3>
            <span className="text-xs text-slate-400 block mb-4">
              Distribución de comandas por turno de atención
            </span>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <div>
                  <span className="font-bold text-slate-800 block">Mañana (Apertura a 2pm)</span>
                  <span className="text-[10px] text-slate-400">{turnos.manana.count} ventas</span>
                </div>
                <span className="font-extrabold text-slate-900">
                  S/ {turnos.manana.ventas.toFixed(2)}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-amber-50/60 border border-amber-100">
                <div>
                  <span className="font-bold text-amber-950 block">Tarde (2pm a 6pm)</span>
                  <span className="text-[10px] text-amber-700 font-semibold">{turnos.tarde.count} ventas • Mayor afluencia</span>
                </div>
                <span className="font-extrabold text-amber-900">
                  S/ {turnos.tarde.ventas.toFixed(2)}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <div>
                  <span className="font-bold text-slate-800 block">Noche (6pm a Cierre)</span>
                  <span className="text-[10px] text-slate-400">{turnos.noche.count} ventas</span>
                </div>
                <span className="font-extrabold text-slate-900">
                  S/ {turnos.noche.ventas.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
