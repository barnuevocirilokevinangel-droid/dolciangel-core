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
  ClipboardList, 
  Search, 
  Receipt, 
  Printer, 
  CreditCard, 
  Banknote, 
  Smartphone, 
  Eye, 
  Trash2, 
  Edit3, 
  AlertTriangle,
  Crown,
  Check
} from 'lucide-react';
import { TicketTermico } from './TicketTermico';

export const HistorialComandasView = () => {
  const { sede, perfil, ventas, showToast } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterMetodo, setFilterMetodo] = useState('TODOS');
  const [filterComprobante, setFilterComprobante] = useState('TODOS');
  const [selectedTicket, setSelectedTicket] = useState(null);

  // Estados para Edición exclusiva del Dueño
  const [editingSale, setEditingSale] = useState(null);
  const [editMetodoPago, setEditMetodoPago] = useState('EFECTIVO');
  const [editVendedor, setEditVendedor] = useState('');
  const [editClienteNombre, setEditClienteNombre] = useState('');
  const [editClienteDoc, setEditClienteDoc] = useState('');
  const [editNota, setEditNota] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const isDueno = perfil?.isDueno ?? false;

  // Filtrado
  const filteredVentas = useMemo(() => {
    return ventas.filter(v => {
      const matchSede = !v.sede || v.sede === sede;
      const term = searchTerm.toLowerCase();
      const matchSearch = (v.id || '').toLowerCase().includes(term) ||
                          (v.cliente?.nombre || '').toLowerCase().includes(term) ||
                          (v.cliente?.documento || '').includes(term) ||
                          (v.vendedor || '').toLowerCase().includes(term) ||
                          (v.cuenta?.nombre || '').toLowerCase().includes(term);
      const matchMetodo = filterMetodo === 'TODOS' || v.metodoPago === filterMetodo;
      const matchComp = filterComprobante === 'TODOS' || 
                        v.tipoComprobante === filterComprobante ||
                        ((filterComprobante === 'NOTA_VENTA' || filterComprobante === 'NOTA_INTERNA') && 
                         (v.tipoComprobante === 'NOTA_VENTA' || v.tipoComprobante === 'NOTA_INTERNA'));
      return matchSede && matchSearch && matchMetodo && matchComp;
    });
  }, [ventas, sede, searchTerm, filterMetodo, filterComprobante]);

  const totalRecaudado = useMemo(() => {
    return filteredVentas.reduce((sum, v) => sum + (v.total || 0), 0);
  }, [filteredVentas]);

  // 1. Anular y Borrar Venta (Exclusivo Dueño 👑)
  const handleAnularVenta = async (venta) => {
    if (!isDueno) return;
    const confirmMsg = `¿Estás seguro de ANULAR y BORRAR la venta ${venta.id}?\n\n` +
      `Monto: S/ ${Number(venta.total).toFixed(2)}\n` +
      `Cliente: ${venta.cliente?.nombre || 'Público General'}\n\n` +
      `✓ El stock de los productos vendidos será devuelto automáticamente al inventario de ${venta.sedeNombre}.\n` +
      `✓ Se revertirá el movimiento en el Kardex y Caja.`;

    if (!window.confirm(confirmMsg)) return;

    try {
      const batch = writeBatch(db);
      const stockField = SEDES[venta.sede]?.stockKey || 'stock_BA';

      // 1. Devolver el stock a cada producto
      if (Array.isArray(venta.items)) {
        for (const item of venta.items) {
          const prodRef = doc(collections.productos, item.id);
          batch.update(prodRef, {
            [stockField]: increment(item.cantidad),
            updatedAt: serverTimestamp()
          });

          // Registrar en kardex la devolución de stock
          const kardexRef = doc(collections.kardex, `K-ANULACION-${venta.id}-${item.id}`);
          batch.set(kardexRef, {
            fecha: new Date().toISOString(),
            timestamp: serverTimestamp(),
            sede: venta.sede,
            tipo: 'INGRESO',
            productoId: item.id,
            productoNombre: item.nombre,
            cantidad: item.cantidad,
            motivo: `Devolución de stock por anulación de venta ${venta.id}`,
            responsable: perfil.nombre
          });
        }
      }

      // 2. Si tenía movimiento de caja, anularlo
      const movCajaRef = doc(collections.movimientosCaja, `MC-${venta.id}`);
      batch.delete(movCajaRef);

      // 3. Eliminar el documento de la venta
      const ventaRef = doc(collections.ventas, venta.id);
      batch.delete(ventaRef);

      await batch.commit();
      showToast(`Venta ${venta.id} anulada y stock devuelto exitosamente`, 'success');
    } catch (err) {
      console.error('Error al anular venta:', err);
      showToast('Error al anular venta: ' + err.message, 'error');
    }
  };

  // 2. Abrir Modal de Edición (Exclusivo Dueño 👑)
  const handleOpenEditModal = (venta) => {
    setEditingSale(venta);
    setEditMetodoPago(venta.metodoPago || 'EFECTIVO');
    setEditVendedor(venta.vendedor || '');
    setEditClienteNombre(venta.cliente?.nombre || '');
    setEditClienteDoc(venta.cliente?.documento || '');
    setEditNota(venta.nota || '');
  };

  // Guardar Cambios de la Venta
  const handleSaveEditSale = async (e) => {
    e.preventDefault();
    if (!editingSale || !isDueno) return;

    setIsSavingEdit(true);
    try {
      const ventaRef = doc(collections.ventas, editingSale.id);
      await updateDoc(ventaRef, {
        metodoPago: editMetodoPago,
        vendedor: editVendedor.trim() || editingSale.vendedor,
        'cliente.nombre': editClienteNombre.trim() || 'Público General',
        'cliente.documento': editClienteDoc.trim(),
        nota: editNota.trim(),
        editadoPor: perfil.nombre,
        fechaEdicion: new Date().toISOString(),
        updatedAt: serverTimestamp()
      });

      // Si el método de pago cambió de o hacia EFECTIVO, sincronizar movimiento de caja
      if (editingSale.metodoPago !== editMetodoPago) {
        const movCajaRef = doc(collections.movimientosCaja, `MC-${editingSale.id}`);
        if (editMetodoPago === 'EFECTIVO') {
          await updateDoc(movCajaRef, {
            tipo: 'VENTA_EFECTIVO',
            monto: editingSale.total,
            descripcion: `Venta POS en Efectivo ${editingSale.id} (Método corregido)`
          }).catch(() => {});
        } else if (editingSale.metodoPago === 'EFECTIVO') {
          await deleteDoc(movCajaRef).catch(() => {});
        }
      }

      showToast(`Venta ${editingSale.id} actualizada correctamente`);
      setEditingSale(null);
    } catch (err) {
      console.error('Error al editar venta:', err);
      showToast('Error al guardar cambios: ' + err.message, 'error');
    } finally {
      setIsSavingEdit(false);
    }
  };

  return (
    <div className="pb-28 max-w-7xl mx-auto px-4 pt-4">
      {/* Banner Superior */}
      <div className="bg-gradient-to-r from-brand-700 via-pink-600 to-rose-600 rounded-3xl p-6 text-white shadow-lg shadow-brand-700/20 mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-2xl shadow-inner">
              📋
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-pink-200 bg-white/10 px-2.5 py-0.5 rounded-full border border-white/20">
                  Auditoría de Ventas
                </span>
                {isDueno && (
                  <span className="text-[10px] font-extrabold bg-gold-400 text-slate-950 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                    <Crown className="w-3 h-3" />
                    <span>Modo Dueño: Edición & Anulación Habilitadas</span>
                  </span>
                )}
              </div>
              <h2 className="text-xl md:text-2xl font-serif font-bold mt-1">
                Historial de Comandas & Comprobantes
              </h2>
              <p className="text-xs text-pink-100 mt-0.5">
                Sede: {SEDES[sede]?.nombre} • {filteredVentas.length} comandas registradas
              </p>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur p-3.5 rounded-2xl border border-white/15 text-right">
            <span className="text-[10px] text-pink-200 block uppercase font-bold">Total Facturado</span>
            <span className="text-2xl font-extrabold text-gold-300">
              S/ {totalRecaudado.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Controles de Búsqueda y Filtros */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-pink-100 mb-5 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por ID, mesa, cliente, DNI..."
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:border-brand-500 focus:bg-white"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar w-full sm:w-auto text-xs">
            <span className="text-slate-400 font-bold uppercase text-[10px] mr-1 hidden md:inline">Pago:</span>
            {[
              { id: 'TODOS', label: 'Todos' },
              { id: 'EFECTIVO', label: 'Efectivo' },
              { id: 'YAPE_PLIN', label: 'Yape/Plin' },
              { id: 'TARJETA', label: 'Tarjeta' },
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => setFilterMetodo(m.id)}
                className={`px-3 py-1.5 rounded-full font-bold whitespace-nowrap transition-all ${
                  filterMetodo === m.id
                    ? 'bg-brand-700 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-2 border-t border-slate-100 text-xs">
          <span className="text-slate-400 font-bold uppercase text-[10px] mr-1">Comprobante:</span>
          {[
            { id: 'TODOS', label: 'Todos' },
            { id: 'NOTA_VENTA', label: 'Notas de Venta' },
            { id: 'BOLETA', label: 'Boletas' },
            { id: 'FACTURA', label: 'Facturas' },
          ].map((c) => (
            <button
              key={c.id}
              onClick={() => setFilterComprobante(c.id)}
              className={`px-3 py-1 rounded-full font-bold whitespace-nowrap transition-all ${
                filterComprobante === c.id
                  ? 'bg-pink-100 text-brand-800 border border-pink-300'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla de Comandas */}
      <div className="bg-white rounded-2xl border border-pink-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4">Comprobante / Mesa</th>
                <th className="py-3.5 px-4">Fecha / Vendedor</th>
                <th className="py-3.5 px-4">Cliente</th>
                <th className="py-3.5 px-4">Pago</th>
                <th className="py-3.5 px-4 text-center">Ítems</th>
                <th className="py-3.5 px-4 text-right">Total (S/)</th>
                <th className="py-3.5 px-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredVentas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No se encontraron comandas registradas
                  </td>
                </tr>
              ) : (
                filteredVentas.map((v) => (
                  <tr key={v.id} className="hover:bg-pink-50/20 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-slate-900 block">
                          {v.id}
                        </span>
                        {v.cuenta?.nombre && (
                          <span className="bg-pink-100 text-brand-800 font-bold text-[10px] px-1.5 py-0.2 rounded-md">
                            {v.cuenta.nombre}
                          </span>
                        )}
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.2 rounded-full inline-block mt-0.5 ${
                        v.tipoComprobante === 'BOLETA'
                          ? 'bg-purple-100 text-purple-800'
                          : v.tipoComprobante === 'FACTURA'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {v.tipoComprobante}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                      {new Date(v.fecha).toLocaleString([], { 
                        month: 'short', 
                        day: '2-digit', 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                      <span className="text-[10px] text-slate-400 block font-semibold">
                        Por {v.vendedor}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-slate-900 block truncate max-w-[150px]">
                        {v.cliente?.nombre || 'Público General'}
                      </span>
                      {v.cliente?.documento && (
                        <span className="text-[11px] text-slate-400 font-mono">
                          Doc: {v.cliente.documento}
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center gap-1 font-bold ${
                        v.metodoPago === 'EFECTIVO' ? 'text-emerald-700' :
                        v.metodoPago === 'YAPE_PLIN' ? 'text-purple-700' : 'text-blue-700'
                      }`}>
                        {v.metodoPago === 'EFECTIVO' ? <Banknote className="w-3.5 h-3.5" /> :
                         v.metodoPago === 'YAPE_PLIN' ? <Smartphone className="w-3.5 h-3.5" /> :
                         <CreditCard className="w-3.5 h-3.5" />}
                        <span>{v.metodoPago}</span>
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <span className="bg-slate-100 px-2 py-0.5 rounded-full font-bold text-slate-700">
                        {v.items?.reduce((acc, it) => acc + (it.cantidad || 0), 0) || 0} platos
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right font-bold text-brand-700 text-sm">
                      S/ {Number(v.total).toFixed(2)}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setSelectedTicket(v)}
                          title="Ver Ticket Digital"
                          className="p-1.5 rounded-lg bg-pink-50 hover:bg-pink-100 text-brand-700 font-bold transition-all"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {/* ACCIONES EXCLUSIVAS DEL DUEÑO 👑 */}
                        {isDueno && (
                          <>
                            <button
                              onClick={() => handleOpenEditModal(v)}
                              title="Editar venta (Solo Dueño)"
                              className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 transition-colors"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleAnularVenta(v)}
                              title="Anular venta y devolver stock (Solo Dueño)"
                              className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Editar Venta (Exclusivo Dueño 👑) */}
      {editingSale && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 shadow-2xl border border-pink-100 w-full max-w-md">
            <div className="flex items-center gap-2 mb-3">
              <span className="p-2 rounded-xl bg-amber-100 text-amber-800">
                <Crown className="w-5 h-5" />
              </span>
              <div>
                <h3 className="font-serif font-bold text-lg text-slate-900">
                  Modificar Comprobante {editingSale.id}
                </h3>
                <span className="text-xs text-slate-500">Permiso exclusivo de Dueño</span>
              </div>
            </div>

            <form onSubmit={handleSaveEditSale} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Método de Pago *</label>
                <div className="grid grid-cols-3 gap-2">
                  {['EFECTIVO', 'YAPE_PLIN', 'TARJETA'].map((m) => (
                    <button
                      type="button"
                      key={m}
                      onClick={() => setEditMetodoPago(m)}
                      className={`py-2 px-2.5 rounded-xl border font-bold text-center transition-all ${
                        editMetodoPago === m
                          ? 'border-brand-600 bg-pink-50 text-brand-800 shadow-xs'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Cajero / Vendedor Responsable</label>
                <input
                  type="text"
                  value={editVendedor}
                  onChange={(e) => setEditVendedor(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-semibold focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Nombre Cliente</label>
                  <input
                    type="text"
                    value={editClienteNombre}
                    onChange={(e) => setEditClienteNombre(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Documento (DNI/RUC)</label>
                  <input
                    type="text"
                    value={editClienteDoc}
                    onChange={(e) => setEditClienteDoc(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Nota / Observación</label>
                <input
                  type="text"
                  value={editNota}
                  onChange={(e) => setEditNota(e.target.value)}
                  placeholder="Ej. Cambio de método a solicitud del cliente"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingSale(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="flex-1 py-2.5 rounded-xl bg-brand-700 hover:bg-brand-800 text-white font-bold shadow-md shadow-brand-700/20"
                >
                  {isSavingEdit ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Vista de Ticket SUNAT & Reimpresión */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 shadow-2xl border border-pink-100 w-full max-w-sm max-h-[92vh] overflow-y-auto text-center">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Comprobante Electrónico
              </span>
              <button
                onClick={() => setSelectedTicket(null)}
                className="text-slate-400 hover:text-slate-700 text-base"
              >
                ✕
              </button>
            </div>

            <TicketTermico venta={selectedTicket} />

            <div className="flex gap-2 pt-4">
              <button
                onClick={() => window.print()}
                className="flex-1 py-3 rounded-2xl bg-slate-900 hover:bg-black text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all"
              >
                <Printer className="w-4 h-4 text-gold-400" />
                <span>🖨️ Imprimir Ticket (80mm)</span>
              </button>
              <button
                onClick={() => setSelectedTicket(null)}
                className="py-3 px-4 rounded-2xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 active:scale-95 transition-all"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
