import React, { useState, useMemo } from 'react';
import { useApp, SEDES } from '../context/AppContext';
import { 
  db, 
  collections, 
  doc, 
  updateDoc, 
  deleteDoc, 
  writeBatch, 
  increment, 
  serverTimestamp 
} from '../services/firebase';
import { 
  History, 
  ShoppingCart, 
  Wallet, 
  Package, 
  Gift, 
  Search, 
  Trash2, 
  Edit3, 
  Crown, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  Receipt,
  Eye,
  Filter,
  DollarSign,
  TrendingDown,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  X
} from 'lucide-react';
import { HistorialComandasView } from './HistorialComandasView';

export const HistorialGlobalView = () => {
  const { 
    sede, 
    perfil, 
    ventas, 
    movimientosCaja, 
    kardex, 
    canjesAuditados = [], 
    showToast 
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState('ventas'); // 'ventas', 'caja', 'kardex', 'canjes'
  const [filterSede, setFilterSede] = useState('TODAS');
  const [searchTerm, setSearchTerm] = useState('');

  // Modales de Edición Exclusiva para Dueño 👑
  const [editingGasto, setEditingGasto] = useState(null);
  const [editGastoMonto, setEditGastoMonto] = useState('');
  const [editGastoMotivo, setEditGastoMotivo] = useState('Insumos');
  const [editGastoDetalle, setEditGastoDetalle] = useState('');
  const [editGastoResponsable, setEditGastoResponsable] = useState('');

  const [editingKardex, setEditingKardex] = useState(null);
  const [editKardexMotivo, setEditKardexMotivo] = useState('');
  const [editKardexJustificacion, setEditKardexJustificacion] = useState('');
  const [editKardexResponsable, setEditKardexResponsable] = useState('');

  const isDueno = perfil?.isDueno ?? false;

  // 1. Filtrado de Movimientos de Caja
  const filteredCaja = useMemo(() => {
    return movimientosCaja.filter(m => {
      const matchSede = filterSede === 'TODAS' || m.sede === filterSede;
      const term = searchTerm.toLowerCase();
      const matchSearch = (m.motivo || '').toLowerCase().includes(term) ||
                          (m.detalle || '').toLowerCase().includes(term) ||
                          (m.responsable || '').toLowerCase().includes(term) ||
                          (m.tipo || '').toLowerCase().includes(term);
      return matchSede && matchSearch;
    });
  }, [movimientosCaja, filterSede, searchTerm]);

  // 2. Filtrado de Kardex
  const filteredKardex = useMemo(() => {
    return kardex.filter(k => {
      const matchSede = filterSede === 'TODAS' || k.sede === filterSede;
      const term = searchTerm.toLowerCase();
      const matchSearch = (k.productoNombre || '').toLowerCase().includes(term) ||
                          (k.motivo || '').toLowerCase().includes(term) ||
                          (k.justificacion || '').toLowerCase().includes(term) ||
                          (k.responsable || '').toLowerCase().includes(term);
      return matchSede && matchSearch;
    });
  }, [kardex, filterSede, searchTerm]);

  // 3. Filtrado de Canjes
  const filteredCanjes = useMemo(() => {
    return canjesAuditados.filter(c => {
      const matchSede = filterSede === 'TODAS' || c.sede === filterSede;
      const term = searchTerm.toLowerCase();
      const matchSearch = (c.nombreCliente || '').toLowerCase().includes(term) ||
                          (c.telefono || '').includes(term) ||
                          (c.premio || '').toLowerCase().includes(term) ||
                          (c.canjeadoPor || '').toLowerCase().includes(term);
      return matchSede && matchSearch;
    });
  }, [canjesAuditados, filterSede, searchTerm]);

  // ANULAR / BORRAR GASTO (Dueño 👑)
  const handleDeleteGasto = async (mov) => {
    if (!isDueno) return;
    if (!window.confirm(`¿Estás seguro de eliminar el registro de gasto "${mov.motivo}" por S/ ${mov.monto?.toFixed(2)}?\n\nEsta acción es irreversible.`)) {
      return;
    }
    try {
      await deleteDoc(doc(collections.movimientosCaja, mov.id));
      showToast('Gasto eliminado del historial', 'success');
    } catch (err) {
      console.error('Error al eliminar gasto:', err);
      showToast('Error: ' + err.message, 'error');
    }
  };

  // EDITAR GASTO (Dueño 👑)
  const handleOpenEditGasto = (mov) => {
    if (!isDueno) return;
    setEditingGasto(mov);
    setEditGastoMonto(mov.monto?.toString() || '');
    setEditGastoMotivo(mov.motivo || 'Insumos');
    setEditGastoDetalle(mov.detalle || '');
    setEditGastoResponsable(mov.responsable || '');
  };

  const handleSaveEditGasto = async (e) => {
    e.preventDefault();
    if (!editingGasto) return;
    const montoNum = parseFloat(editGastoMonto);
    if (isNaN(montoNum) || montoNum <= 0) {
      showToast('Ingresa un monto válido', 'error');
      return;
    }
    try {
      const movRef = doc(collections.movimientosCaja, editingGasto.id);
      await updateDoc(movRef, {
        monto: montoNum,
        motivo: editGastoMotivo,
        detalle: editGastoDetalle.trim(),
        responsable: editGastoResponsable.trim() || editingGasto.responsable,
        editadoPor: perfil.nombre,
        fechaEdicion: new Date().toISOString(),
        updatedAt: serverTimestamp()
      });
      showToast('Gasto actualizado exitosamente', 'success');
      setEditingGasto(null);
    } catch (err) {
      console.error('Error al editar gasto:', err);
      showToast('Error: ' + err.message, 'error');
    }
  };

  // ANULAR / BORRAR MOVIMIENTO KARDEX (Dueño 👑)
  const handleDeleteKardex = async (item) => {
    if (!isDueno) return;
    if (!window.confirm(`¿Estás seguro de eliminar este registro de Kardex de "${item.productoNombre}" (${item.cantidad} un.)?\n\nNota: Si deseas reponer o ajustar el stock real, hazlo desde la pestaña de Inventario.`)) {
      return;
    }
    try {
      await deleteDoc(doc(collections.kardex, item.id));
      showToast('Registro de Kardex eliminado', 'success');
    } catch (err) {
      console.error('Error al eliminar kardex:', err);
      showToast('Error: ' + err.message, 'error');
    }
  };

  // EDITAR MOVIMIENTO KARDEX (Dueño 👑)
  const handleOpenEditKardex = (item) => {
    if (!isDueno) return;
    setEditingKardex(item);
    setEditKardexMotivo(item.motivo || '');
    setEditKardexJustificacion(item.justificacion || '');
    setEditKardexResponsable(item.responsable || '');
  };

  const handleSaveEditKardex = async (e) => {
    e.preventDefault();
    if (!editingKardex) return;
    try {
      const kardexRef = doc(collections.kardex, editingKardex.id);
      await updateDoc(kardexRef, {
        motivo: editKardexMotivo,
        justificacion: editKardexJustificacion.trim(),
        responsable: editKardexResponsable.trim() || editingKardex.responsable,
        editadoPor: perfil.nombre,
        fechaEdicion: new Date().toISOString(),
        updatedAt: serverTimestamp()
      });
      showToast('Movimiento de inventario actualizado', 'success');
      setEditingKardex(null);
    } catch (err) {
      console.error('Error al editar kardex:', err);
      showToast('Error: ' + err.message, 'error');
    }
  };

  // REVERTIR CANJE DE FIDELIDAD (Dueño 👑)
  const handleRevertirCanje = async (canje) => {
    if (!isDueno) return;
    if (!window.confirm(`¿Revertir y anular el canje de "${canje.nombreCliente}"?\n\n✓ Se devolverán 6 sellos al cliente.\n✓ Se eliminará este registro de auditoría.`)) {
      return;
    }
    try {
      const batch = writeBatch(db);
      const clientRef = doc(collections.clientesFidelidad, canje.clienteId || canje.telefono);
      batch.update(clientRef, {
        sellos: increment(6),
        premiosCanjeados: increment(-1),
        updatedAt: serverTimestamp()
      });
      const canjeRef = doc(collections.canjesFidelidad, canje.id);
      batch.delete(canjeRef);
      await batch.commit();
      showToast('Canje revertido y 6 sellos devueltos al cliente', 'success');
    } catch (err) {
      console.error('Error al revertir canje:', err);
      showToast('Error: ' + err.message, 'error');
    }
  };

  return (
    <div className="pb-28 max-w-7xl mx-auto px-4 pt-4 space-y-6">
      {/* Header Superior con modo Dueño */}
      <div className="bg-gradient-to-r from-slate-900 via-purple-950 to-slate-900 rounded-3xl p-6 text-white shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-300 bg-white/10 px-2.5 py-0.5 rounded-full border border-white/20">
                Auditoría Global & Trazabilidad
              </span>
              {isDueno && (
                <span className="text-[10px] font-extrabold bg-gold-400 text-slate-950 px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                  <Crown className="w-3 h-3" />
                  <span>Modo Dueño Activo</span>
                </span>
              )}
            </div>
            <h2 className="text-2xl md:text-3xl font-serif font-bold text-white mt-1">
              Historial de Operaciones
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Control centralizado de comandas, flujo de caja, movimientos de kardex y canjes de premios.
            </p>
          </div>

          {/* Filtros rápidos: Selector de Sede */}
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md p-1.5 rounded-2xl border border-white/10 self-start md:self-auto">
            <span className="text-xs font-bold text-slate-300 pl-2">Sede:</span>
            <div className="flex bg-slate-950/60 rounded-xl p-1">
              {[
                { id: 'TODAS', label: 'Todas' },
                { id: 'BA', label: 'Buenos Aires' },
                { id: 'VE', label: 'Villa España' }
              ].map(s => (
                <button
                  key={s.id}
                  onClick={() => setFilterSede(s.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    filterSede === s.id
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

      {/* Selector de Sub-Pestañas (Tabs Superiores) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        {[
          { id: 'ventas', label: '🛒 Ventas & Comandas', count: ventas.length },
          { id: 'caja', label: '💵 Caja & Gastos', count: movimientosCaja.length },
          { id: 'kardex', label: '📦 Kardex / Stock', count: kardex.length },
          { id: 'canjes', label: '🎁 Canjes Fidelidad', count: canjesAuditados.length }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`px-4 py-2.5 rounded-2xl text-xs font-extrabold whitespace-nowrap transition-all flex items-center gap-2 shadow-sm ${
              activeSubTab === tab.id
                ? 'bg-brand-700 text-white shadow-brand-700/30 scale-102'
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <span>{tab.label}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
              activeSubTab === tab.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* CONTENIDO DE CADA SUB-PESTAÑA */}

      {/* 1. VENTAS & COMANDAS */}
      {activeSubTab === 'ventas' && (
        <div>
          <HistorialComandasView />
        </div>
      )}

      {/* 2. CAJA & GASTOS */}
      {activeSubTab === 'caja' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-4 border border-pink-100 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por motivo, detalle o responsable..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-brand-500"
              />
            </div>
            <span className="text-xs text-slate-500 font-medium self-end sm:self-auto">
              Mostrando {filteredCaja.length} movimientos
            </span>
          </div>

          <div className="bg-white rounded-3xl border border-pink-100 shadow-sm overflow-hidden">
            <div className="divide-y divide-slate-100">
              {filteredCaja.length === 0 ? (
                <div className="p-10 text-center text-slate-400 text-xs">
                  No hay movimientos de caja registrados con estos filtros
                </div>
              ) : (
                filteredCaja.map(mov => {
                  const isGasto = mov.tipo === 'EGRESO_GASTO';
                  const isApertura = mov.tipo === 'APERTURA';
                  const isCierre = mov.tipo === 'CIERRE_ARQUEO';
                  const isVenta = mov.tipo === 'VENTA_EFECTIVO';

                  return (
                    <div key={mov.id} className="p-4 hover:bg-slate-50/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div className="flex items-start gap-3">
                        <div className={`w-9 h-9 rounded-2xl flex items-center justify-center text-base flex-shrink-0 ${
                          isGasto ? 'bg-rose-100 text-rose-700' :
                          isApertura ? 'bg-emerald-100 text-emerald-800' :
                          isCierre ? 'bg-amber-100 text-amber-800' :
                          'bg-purple-100 text-purple-700'
                        }`}>
                          {isGasto ? '💸' : isApertura ? '🔓' : isCierre ? '🔒' : '💵'}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-sm">
                              {mov.motivo || mov.tipo}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                              {mov.sede === 'VE' ? 'Villa España' : 'Buenos Aires'}
                            </span>
                          </div>

                          {mov.detalle && (
                            <p className="text-xs text-slate-600 mt-0.5">{mov.detalle}</p>
                          )}

                          <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1">
                            <span>👤 {mov.responsable || 'Colaborador'}</span>
                            <span>•</span>
                            <span>📅 {mov.fecha ? new Date(mov.fecha).toLocaleString('es-PE') : 'Hoy'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-4 self-end sm:self-auto">
                        <div className="text-right">
                          <span className={`text-base font-extrabold font-mono ${
                            isGasto ? 'text-rose-600' : 'text-emerald-700'
                          }`}>
                            {isGasto ? '-' : '+'} S/ {Number(mov.monto || 0).toFixed(2)}
                          </span>
                        </div>

                        {/* ACCIONES EXCLUSIVAS DEL DUEÑO 👑 */}
                        {isDueno && isGasto && (
                          <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200">
                            <button
                              onClick={() => handleOpenEditGasto(mov)}
                              title="Editar gasto (Solo Dueño)"
                              className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 transition-colors"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteGasto(mov)}
                              title="Eliminar gasto (Solo Dueño)"
                              className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. KARDEX & INVENTARIO */}
      {activeSubTab === 'kardex' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-4 border border-pink-100 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por producto, motivo o responsable..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-brand-500"
              />
            </div>
            <span className="text-xs text-slate-500 font-medium self-end sm:self-auto">
              Mostrando {filteredKardex.length} registros de Kardex
            </span>
          </div>

          <div className="bg-white rounded-3xl border border-pink-100 shadow-sm overflow-hidden">
            <div className="divide-y divide-slate-100">
              {filteredKardex.length === 0 ? (
                <div className="p-10 text-center text-slate-400 text-xs">
                  No hay movimientos de kardex registrados
                </div>
              ) : (
                filteredKardex.map(item => {
                  const isIngreso = item.tipo === 'INGRESO';
                  const isMerma = item.tipo === 'MERMA';

                  return (
                    <div key={item.id} className="p-4 hover:bg-slate-50/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div className="flex items-start gap-3">
                        <div className={`w-9 h-9 rounded-2xl flex items-center justify-center text-base flex-shrink-0 ${
                          isIngreso ? 'bg-emerald-100 text-emerald-800' :
                          isMerma ? 'bg-rose-100 text-rose-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {isIngreso ? '📥' : isMerma ? '🗑️' : '🛒'}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-sm">
                              {item.productoNombre}
                            </span>
                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                              isIngreso ? 'bg-emerald-100 text-emerald-800' :
                              isMerma ? 'bg-rose-100 text-rose-700' :
                              'bg-blue-100 text-blue-800'
                            }`}>
                              {item.tipo}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                              {item.sede === 'VE' ? 'Villa España' : 'Buenos Aires'}
                            </span>
                          </div>

                          <p className="text-xs text-slate-600 mt-0.5">
                            Motivo: <span className="font-semibold">{item.motivo}</span>
                            {item.justificacion && ` — "${item.justificacion}"`}
                          </p>

                          <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1">
                            <span>👤 {item.responsable || 'Colaborador'}</span>
                            <span>•</span>
                            <span>📅 {item.fecha ? new Date(item.fecha).toLocaleString('es-PE') : 'Hoy'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-4 self-end sm:self-auto">
                        <div className="text-right">
                          <span className={`text-base font-extrabold font-mono ${
                            isIngreso ? 'text-emerald-700' : 'text-slate-800'
                          }`}>
                            {isIngreso ? '+' : '-'}{item.cantidad} un.
                          </span>
                        </div>

                        {/* ACCIONES EXCLUSIVAS DEL DUEÑO 👑 */}
                        {isDueno && (
                          <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200">
                            <button
                              onClick={() => handleOpenEditKardex(item)}
                              title="Editar registro de Kardex (Solo Dueño)"
                              className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 transition-colors"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteKardex(item)}
                              title="Eliminar registro de Kardex (Solo Dueño)"
                              className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4. CANJES DE FIDELIDAD */}
      {activeSubTab === 'canjes' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-4 border border-pink-100 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por cliente, celular o premio..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-brand-500"
              />
            </div>
            <span className="text-xs text-slate-500 font-medium self-end sm:self-auto">
              Mostrando {filteredCanjes.length} canjes auditados
            </span>
          </div>

          <div className="bg-white rounded-3xl border border-pink-100 shadow-sm overflow-hidden">
            <div className="divide-y divide-slate-100">
              {filteredCanjes.length === 0 ? (
                <div className="p-10 text-center text-slate-400 text-xs">
                  No hay canjes de fidelidad registrados
                </div>
              ) : (
                filteredCanjes.map(canje => (
                  <div key={canje.id} className="p-4 hover:bg-slate-50/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-2xl bg-gold-400/20 text-gold-700 flex items-center justify-center text-base flex-shrink-0">
                        🎁
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm">
                            {canje.nombreCliente}
                          </span>
                          <span className="font-mono text-[11px] text-slate-500">
                            ({canje.telefono})
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                            {canje.sedeNombre || canje.sede}
                          </span>
                        </div>

                        <p className="text-xs text-brand-700 font-semibold mt-0.5">
                          {canje.premio}
                        </p>

                        <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1">
                          <span>👤 Entregado por: {canje.canjeadoPor || 'Colaborador'}</span>
                          <span>•</span>
                          <span>📅 {canje.fecha ? new Date(canje.fecha).toLocaleString('es-PE') : 'Hoy'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4 self-end sm:self-auto">
                      <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-emerald-100 text-emerald-800">
                        Canje Validad
                      </span>

                      {/* REVERTIR CANJE (Solo Dueño 👑) */}
                      {isDueno && (
                        <button
                          onClick={() => handleRevertirCanje(canje)}
                          title="Revertir canje y devolver 6 sellos (Solo Dueño)"
                          className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[11px] border border-rose-200 transition-all flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Revertir Canje</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Editar Gasto (Solo Dueño 👑) */}
      {editingGasto && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 shadow-2xl border border-pink-100 w-full max-w-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-serif font-bold text-lg text-slate-900 flex items-center gap-2">
                <Crown className="w-4 h-4 text-gold-500" />
                <span>Editar Gasto de Caja</span>
              </h3>
              <button onClick={() => setEditingGasto(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditGasto} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Monto (S/.)</label>
                <input
                  type="number"
                  step="0.10"
                  value={editGastoMonto}
                  onChange={(e) => setEditGastoMonto(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Motivo</label>
                <select
                  value={editGastoMotivo}
                  onChange={(e) => setEditGastoMotivo(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-brand-500"
                >
                  <option value="Insumos">Insumos y Compras de Cocina</option>
                  <option value="Delivery">Delivery / Mensajería</option>
                  <option value="Servicios">Servicios / Limpieza</option>
                  <option value="Personal">Adelanto / Pago Personal</option>
                  <option value="Otro">Otro Gasto Operativo</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Detalle / Justificación</label>
                <textarea
                  value={editGastoDetalle}
                  onChange={(e) => setEditGastoDetalle(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Responsable</label>
                <input
                  type="text"
                  value={editGastoResponsable}
                  onChange={(e) => setEditGastoResponsable(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingGasto(null)}
                  className="flex-1 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-brand-700 hover:bg-brand-800 text-white font-bold shadow-md shadow-brand-700/20"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Editar Kardex (Solo Dueño 👑) */}
      {editingKardex && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 shadow-2xl border border-pink-100 w-full max-w-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-serif font-bold text-lg text-slate-900 flex items-center gap-2">
                <Crown className="w-4 h-4 text-gold-500" />
                <span>Editar Movimiento Kardex</span>
              </h3>
              <button onClick={() => setEditingKardex(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditKardex} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Producto</label>
                <input
                  type="text"
                  disabled
                  value={editingKardex.productoNombre}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-100 text-slate-500 font-bold"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Motivo</label>
                <input
                  type="text"
                  value={editKardexMotivo}
                  onChange={(e) => setEditKardexMotivo(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Justificación</label>
                <textarea
                  value={editKardexJustificacion}
                  onChange={(e) => setEditKardexJustificacion(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingKardex(null)}
                  className="flex-1 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-brand-700 hover:bg-brand-800 text-white font-bold shadow-md shadow-brand-700/20"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
