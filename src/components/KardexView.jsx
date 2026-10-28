import React, { useState, useMemo } from 'react';
import { useApp, SEDES } from '../context/AppContext';
import { 
  db, 
  collections, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  serverTimestamp, 
  increment,
  writeBatch
} from '../services/firebase';
import { 
  Package, 
  ArrowUpRight, 
  ArrowDownLeft, 
  AlertTriangle, 
  Plus, 
  Search, 
  Clock, 
  FileText,
  Filter,
  CheckCircle2,
  Crown,
  Trash2,
  Edit3
} from 'lucide-react';

export const KardexView = () => {
  const { sede, perfil, productos, kardex, showToast } = useApp();

  const [activeFilter, setActiveFilter] = useState('TODOS');
  const [searchTerm, setSearchTerm] = useState('');

  // Modales
  const [showMermaModal, setShowMermaModal] = useState(false);
  const [selectedProdMerma, setSelectedProdMerma] = useState('');
  const [cantidadMerma, setCantidadMerma] = useState('');
  const [motivoMerma, setMotivoMerma] = useState('Vencimiento');
  const [justificacionMerma, setJustificacionMerma] = useState('');

  const [showIngresoModal, setShowIngresoModal] = useState(false);
  const [selectedProdIngreso, setSelectedProdIngreso] = useState('');
  const [cantidadIngreso, setCantidadIngreso] = useState('');
  const [origenIngreso, setOrigenIngreso] = useState('Producción Interna');

  // Edición de Movimiento (Exclusivo Dueño 👑)
  const [editingKardex, setEditingKardex] = useState(null);
  const [editMotivo, setEditMotivo] = useState('');
  const [editJustificacion, setEditJustificacion] = useState('');
  const [editResponsable, setEditResponsable] = useState('');

  const isDueno = perfil?.isDueno ?? false;
  const stockField = sede ? SEDES[sede].stockKey : 'stock_BA';

  // Filtrado de movimientos
  const filteredKardex = useMemo(() => {
    return kardex.filter(item => {
      const matchSede = !item.sede || item.sede === sede;
      const matchSearch = (item.productoNombre || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (item.motivo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (item.justificacion || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchType = activeFilter === 'TODOS' || item.tipo === activeFilter;
      return matchSede && matchSearch && matchType;
    });
  }, [kardex, sede, searchTerm, activeFilter]);

  // 1. Registrar Merma / Pérdida con Justificación Obligatoria
  const handleRegistrarMerma = async (e) => {
    e.preventDefault();
    if (!selectedProdMerma) {
      showToast('Selecciona un producto para la merma', 'error');
      return;
    }
    const cant = parseInt(cantidadMerma, 10);
    if (isNaN(cant) || cant <= 0) {
      showToast('Ingresa una cantidad válida mayor a 0', 'error');
      return;
    }
    if (!justificacionMerma.trim()) {
      showToast('La justificación de la merma es obligatoria', 'error');
      return;
    }

    const prod = productos.find(p => p.id === selectedProdMerma);
    if (!prod) return;

    try {
      const kardexId = `K-MERMA-${Date.now()}`;
      const kardexRef = doc(collections.kardex, kardexId);

      await setDoc(kardexRef, {
        id: kardexId,
        fecha: new Date().toISOString(),
        timestamp: serverTimestamp(),
        sede,
        tipo: 'MERMA',
        productoId: prod.id,
        productoNombre: prod.nombre,
        cantidad: -cant,
        motivo: `Merma: ${motivoMerma}`,
        justificacion: justificacionMerma.trim(),
        responsable: perfil.nombre
      });

      const prodRef = doc(collections.productos, prod.id);
      await updateDoc(prodRef, {
        [stockField]: increment(-cant),
        updatedAt: serverTimestamp()
      });

      setShowMermaModal(false);
      setSelectedProdMerma('');
      setCantidadMerma('');
      setJustificacionMerma('');
      showToast(`Merma de ${cant}x ${prod.nombre} registrada correctamente`);
    } catch (err) {
      console.error('Error al registrar merma:', err);
      showToast('Error: ' + err.message, 'error');
    }
  };

  // 2. Registrar Ingreso de Stock
  const handleRegistrarIngreso = async (e) => {
    e.preventDefault();
    if (!selectedProdIngreso) {
      showToast('Selecciona un producto para el ingreso', 'error');
      return;
    }
    const cant = parseInt(cantidadIngreso, 10);
    if (isNaN(cant) || cant <= 0) {
      showToast('Ingresa una cantidad válida mayor a 0', 'error');
      return;
    }

    const prod = productos.find(p => p.id === selectedProdIngreso);
    if (!prod) return;

    try {
      const kardexId = `K-INGRESO-${Date.now()}`;
      const kardexRef = doc(collections.kardex, kardexId);

      await setDoc(kardexRef, {
        id: kardexId,
        fecha: new Date().toISOString(),
        timestamp: serverTimestamp(),
        sede,
        tipo: 'INGRESO',
        productoId: prod.id,
        productoNombre: prod.nombre,
        cantidad: cant,
        motivo: `Ingreso: ${origenIngreso}`,
        responsable: perfil.nombre
      });

      const prodRef = doc(collections.productos, prod.id);
      await updateDoc(prodRef, {
        [stockField]: increment(cant),
        updatedAt: serverTimestamp()
      });

      setShowIngresoModal(false);
      setSelectedProdIngreso('');
      setCantidadIngreso('');
      showToast(`Ingreso de +${cant}x ${prod.nombre} añadido al stock`);
    } catch (err) {
      console.error('Error al registrar ingreso:', err);
      showToast('Error: ' + err.message, 'error');
    }
  };

  // 3. Anular Movimiento de Kardex (Exclusivo Dueño 👑)
  const handleAnularKardex = async (item) => {
    if (!isDueno) return;
    const confirmMsg = `¿Deseas ANULAR este movimiento de kardex?\n\n` +
      `Producto: ${item.productoNombre}\n` +
      `Cantidad: ${item.cantidad > 0 ? '+' : ''}${item.cantidad}\n` +
      `Tipo: ${item.tipo}\n\n` +
      `✓ Se revertirá el stock de este producto en el inventario.`;

    if (!window.confirm(confirmMsg)) return;

    try {
      const batch = writeBatch(db);

      // Revertir el stock: si cantidad fue -2, revertir es +2. Si fue +10, revertir es -10.
      if (item.productoId) {
        const prodRef = doc(collections.productos, item.productoId);
        batch.update(prodRef, {
          [stockField]: increment(-item.cantidad),
          updatedAt: serverTimestamp()
        });
      }

      // Eliminar registro del kardex
      const kRef = doc(collections.kardex, item.id);
      batch.delete(kRef);

      await batch.commit();
      showToast(`Movimiento anulado y stock revertido correctamente`, 'success');
    } catch (err) {
      console.error('Error al anular kardex:', err);
      showToast('Error al anular movimiento: ' + err.message, 'error');
    }
  };

  // 4. Editar Movimiento (Exclusivo Dueño 👑)
  const handleOpenEditKardex = (item) => {
    setEditingKardex(item);
    setEditMotivo(item.motivo || '');
    setEditJustificacion(item.justificacion || '');
    setEditResponsable(item.responsable || perfil.nombre);
  };

  const handleSaveEditKardex = async (e) => {
    e.preventDefault();
    if (!editingKardex || !isDueno) return;

    try {
      const kRef = doc(collections.kardex, editingKardex.id);
      await updateDoc(kRef, {
        motivo: editMotivo.trim(),
        justificacion: editJustificacion.trim(),
        responsable: editResponsable.trim(),
        editadoPor: perfil.nombre,
        fechaEdicion: new Date().toISOString(),
        updatedAt: serverTimestamp()
      });

      showToast('Movimiento de Kardex actualizado');
      setEditingKardex(null);
    } catch (err) {
      console.error('Error al editar kardex:', err);
      showToast('Error al editar: ' + err.message, 'error');
    }
  };

  return (
    <div className="pb-28 max-w-7xl mx-auto px-4 pt-4">
      {/* Banner Superior */}
      <div className="bg-gradient-to-r from-slate-800 via-slate-900 to-brand-900 rounded-3xl p-6 text-white shadow-lg mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center text-2xl shadow-inner">
              📦
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-pink-300 bg-white/10 px-2.5 py-0.5 rounded-full border border-white/20">
                  Kardex Valorizado & Trazabilidad
                </span>
                {isDueno && (
                  <span className="text-[10px] font-extrabold bg-gold-400 text-slate-950 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                    <Crown className="w-3 h-3" />
                    <span>Modo Dueño</span>
                  </span>
                )}
              </div>
              <h2 className="text-xl md:text-2xl font-serif font-bold mt-1">
                Inventario & Kardex - {SEDES[sede]?.nombre}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Historial cronológico de movimientos de mercadería, ventas y mermas justificadas
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowMermaModal(true)}
              className="px-3.5 py-2.5 rounded-xl bg-rose-600/90 hover:bg-rose-700 text-white font-bold text-xs border border-rose-500/30 transition-all flex items-center gap-1.5 shadow-sm"
            >
              <AlertTriangle className="w-4 h-4 text-rose-200" />
              <span>- Registrar Merma</span>
            </button>
            <button
              onClick={() => setShowIngresoModal(true)}
              className="px-4 py-2.5 rounded-xl bg-gold-500 hover:bg-gold-600 text-slate-950 font-extrabold text-xs shadow-md transition-all active:scale-95 flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>+ Ingreso Stock</span>
            </button>
          </div>
        </div>
      </div>

      {/* Controles de Filtros y Búsqueda */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-pink-100 mb-5">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por producto o motivo..."
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:border-brand-500 focus:bg-white"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar w-full sm:w-auto">
            {[
              { id: 'TODOS', label: 'Todos' },
              { id: 'VENTA', label: 'Ventas POS' },
              { id: 'INGRESO', label: 'Ingresos' },
              { id: 'MERMA', label: 'Mermas' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setActiveFilter(f.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                  activeFilter === f.id
                    ? 'bg-brand-700 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tabla Cronológica de Kardex */}
      <div className="bg-white rounded-2xl border border-pink-100 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
            <Clock className="w-4 h-4 text-brand-700" />
            <span>Movimientos Registrados ({filteredKardex.length})</span>
          </h3>
          <span className="text-xs text-slate-500">
            Últimos 100 movimientos en tiempo real
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Fecha / Hora</th>
                <th className="py-3 px-4">Tipo</th>
                <th className="py-3 px-4">Producto</th>
                <th className="py-3 px-4 text-center">Cantidad</th>
                <th className="py-3 px-4">Motivo / Justificación</th>
                <th className="py-3 px-4">Responsable</th>
                {isDueno && <th className="py-3 px-4 text-center">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredKardex.length === 0 ? (
                <tr>
                  <td colSpan={isDueno ? 7 : 6} className="py-8 text-center text-slate-400">
                    No hay movimientos registrados con los filtros seleccionados
                  </td>
                </tr>
              ) : (
                filteredKardex.map((item) => {
                  const isIngreso = item.tipo === 'INGRESO' || item.cantidad > 0;
                  const isMerma = item.tipo === 'MERMA';

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap text-slate-500 font-mono">
                        {new Date(item.fecha).toLocaleString([], { 
                          month: 'short', 
                          day: '2-digit', 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </td>

                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                          isMerma
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : isIngreso
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-purple-100 text-purple-800 border border-purple-200'
                        }`}>
                          {isMerma ? 'MERMA' : isIngreso ? 'INGRESO' : 'VENTA'}
                        </span>
                      </td>

                      <td className="py-3 px-4 font-bold text-slate-900">
                        {item.productoNombre}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span className={`font-mono font-bold text-sm ${
                          isIngreso ? 'text-emerald-600' : 'text-rose-600'
                        }`}>
                          {item.cantidad > 0 ? `+${item.cantidad}` : item.cantidad}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-700 block">
                          {item.motivo}
                        </span>
                        {item.justificacion && (
                          <span className="text-[11px] text-slate-500 block italic mt-0.5">
                            "{item.justificacion}"
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-slate-600">
                        {item.responsable || 'Sistema'}
                      </td>

                      {/* ACCIONES EXCLUSIVAS DEL DUEÑO 👑 */}
                      {isDueno && (
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleOpenEditKardex(item)}
                              title="Editar motivo/justificación"
                              className="p-1 rounded-lg text-slate-400 hover:text-amber-800 hover:bg-amber-50 transition-colors"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleAnularKardex(item)}
                              title="Anular movimiento y revertir stock"
                              className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Editar Movimiento Kardex (Exclusivo Dueño 👑) */}
      {editingKardex && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 shadow-2xl border border-pink-100 w-full max-w-md">
            <div className="flex items-center gap-2 mb-3">
              <span className="p-2 rounded-xl bg-amber-100 text-amber-800">
                <Crown className="w-5 h-5" />
              </span>
              <div>
                <h3 className="font-serif font-bold text-lg text-slate-900">
                  Modificar Registro de Kardex
                </h3>
                <span className="text-xs text-slate-500">Permiso exclusivo de Dueño</span>
              </div>
            </div>

            <form onSubmit={handleSaveEditKardex} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Producto</label>
                <input
                  type="text"
                  disabled
                  value={editingKardex.productoNombre}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-100 text-slate-600 font-bold"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Motivo *</label>
                <input
                  type="text"
                  value={editMotivo}
                  onChange={(e) => setEditMotivo(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-semibold focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Justificación Detallada</label>
                <textarea
                  value={editJustificacion}
                  onChange={(e) => setEditJustificacion(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Responsable</label>
                <input
                  type="text"
                  value={editResponsable}
                  onChange={(e) => setEditResponsable(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingKardex(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-brand-700 hover:bg-brand-800 text-white font-bold shadow-md shadow-brand-700/20"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Registrar Merma / Pérdida */}
      {showMermaModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 shadow-2xl border border-pink-100 w-full max-w-md">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 mx-auto flex items-center justify-center text-2xl mb-3">
              ⚠️
            </div>
            <h3 className="font-serif font-bold text-lg text-slate-900 text-center">
              Registrar Merma / Baja de Producto
            </h3>
            <p className="text-xs text-slate-500 text-center mt-1">
              Sede: {SEDES[sede]?.nombre} • Se descontará del stock disponible
            </p>

            <form onSubmit={handleRegistrarMerma} className="mt-4 space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Producto a dar de baja *
                </label>
                <select
                  value={selectedProdMerma}
                  onChange={(e) => setSelectedProdMerma(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold focus:outline-none focus:border-brand-500 bg-white"
                >
                  <option value="">-- Selecciona el producto --</option>
                  {productos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} (Stock actual: {p[stockField] || 0})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Cantidad *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={cantidadMerma}
                    onChange={(e) => setCantidadMerma(e.target.value)}
                    placeholder="Ej. 2"
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Causa / Motivo *
                  </label>
                  <select
                    value={motivoMerma}
                    onChange={(e) => setMotivoMerma(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold focus:outline-none focus:border-brand-500 bg-white"
                  >
                    <option value="Vencimiento">Vencimiento / Descomposición</option>
                    <option value="Rotura / Caída">Rotura accidental / Caída</option>
                    <option value="Mala preparación">Error de receta / Cocina</option>
                    <option value="Muestra / Degustación">Muestra a cliente</option>
                    <option value="Ajuste de inventario">Conteo físico menor</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-rose-700 block mb-1">
                  Justificación Obligatoria de la Merma *
                </label>
                <textarea
                  value={justificacionMerma}
                  onChange={(e) => setJustificacionMerma(e.target.value)}
                  placeholder="Explica qué ocurrió detalladamente para la auditoría..."
                  rows={3}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-rose-200 text-xs focus:outline-none focus:border-rose-500 bg-rose-50/20"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowMermaModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-600/20"
                >
                  Confirmar Merma
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Registrar Ingreso de Stock */}
      {showIngresoModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 shadow-2xl border border-pink-100 w-full max-w-md">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center text-2xl mb-3">
              📥
            </div>
            <h3 className="font-serif font-bold text-lg text-slate-900 text-center">
              Ingreso de Mercadería al Stock
            </h3>
            <p className="text-xs text-slate-500 text-center mt-1">
              Sede: {SEDES[sede]?.nombre} • Se sumará al stock disponible
            </p>

            <form onSubmit={handleRegistrarIngreso} className="mt-4 space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Producto a ingresar *
                </label>
                <select
                  value={selectedProdIngreso}
                  onChange={(e) => setSelectedProdIngreso(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold focus:outline-none focus:border-brand-500 bg-white"
                >
                  <option value="">-- Selecciona el producto --</option>
                  {productos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} (Stock actual: {p[stockField] || 0})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Cantidad a sumar *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={cantidadIngreso}
                    onChange={(e) => setCantidadIngreso(e.target.value)}
                    placeholder="Ej. 10"
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Origen / Lote
                  </label>
                  <select
                    value={origenIngreso}
                    onChange={(e) => setOrigenIngreso(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold focus:outline-none focus:border-brand-500 bg-white"
                  >
                    <option value="Producción Interna">Taller / Cocina Central</option>
                    <option value="Proveedor Externo">Compra Proveedor</option>
                    <option value="Traslado de Sede">Traslado entre sedes</option>
                    <option value="Ajuste positivo">Ajuste de inventario</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowIngresoModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-brand-700 hover:bg-brand-800 text-white font-bold text-xs shadow-md shadow-brand-700/20"
                >
                  Sumar al Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
