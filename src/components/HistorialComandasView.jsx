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
  Check,
  ExternalLink,
  Loader2,
  FileText,
  XCircle
} from 'lucide-react';
import { TicketTermico } from './TicketTermico';

export const HistorialComandasView = () => {
  const { sede, perfil, ventas, anularVenta, showToast } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterMetodo, setFilterMetodo] = useState('TODOS');
  const [filterComprobante, setFilterComprobante] = useState('TODOS');
  const [selectedTicket, setSelectedTicket] = useState(null);

  // Estados para Anulación con Nota de Crédito APISUNAT (Exclusivo Dueño)
  const [voidingSale, setVoidingSale] = useState(null);
  const [voidCodigoMotivo, setVoidCodigoMotivo] = useState('01');
  const [voidMotivo, setVoidMotivo] = useState('ANULACION DE LA OPERACION');
  const [isVoiding, setIsVoiding] = useState(false);

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
      const matchSede = !v.sede || v.sede === sede ||
        (sede === 'VE' && (v.sede === 'villaEspana' || v.sede === 'VE')) ||
        (sede === 'BA' && (v.sede === 'buenosAires' || v.sede === 'BA'));
      const term = searchTerm.toLowerCase();
      const matchSearch = (v.id || '').toLowerCase().includes(term) ||
                          (v.comprobante?.codigoCompleto || '').toLowerCase().includes(term) ||
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
    return filteredVentas
      .filter(v => v.estado !== 'ANULADA')
      .reduce((sum, v) => sum + (v.total || 0), 0);
  }, [filteredVentas]);

  // 1. Abrir Modal de Anulación / Nota de Crédito (Exclusivo Dueño 👑)
  const handleAnularVenta = (venta) => {
    if (!isDueno) return;
    if (venta.estado === 'ANULADA') {
      showToast('Esta venta ya fue anulada previamente', 'warning');
      return;
    }
    setVoidingSale(venta);
    setVoidCodigoMotivo('01');
    setVoidMotivo('ANULACION DE LA OPERACION');
  };

  // Confirmar Anulación (emite Nota de Crédito en APISUNAT si es Boleta/Factura)
  const handleConfirmVoidSale = async (e) => {
    e.preventDefault();
    if (!voidingSale || !isDueno || isVoiding) return;

    setIsVoiding(true);
    try {
      const ncResult = await anularVenta(voidingSale, {
        motivo: voidMotivo.trim() || 'ANULACION DE LA OPERACION',
        codigoMotivo: voidCodigoMotivo
      });

      if (ncResult) {
        showToast(
          `Venta anulada y Nota de Crédito ${ncResult.codigoCompleto} emitida en SUNAT`,
          'success'
        );
      } else {
        showToast(`Venta interna ${voidingSale.id} anulada y stock devuelto`, 'success');
      }
      setVoidingSale(null);
    } catch (err) {
      console.error('Error al anular venta:', err);
      showToast('Error al anular comprobante: ' + err.message, 'error');
    } finally {
      setIsVoiding(false);
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

      {/* Tabla / Card List de Comandas */}
      <div className="bg-white rounded-2xl border border-pink-100 shadow-sm overflow-hidden">
        {/* VISTA MÓVIL (< md): LISTA DE TARJETAS APILADAS */}
        <div className="md:hidden divide-y divide-slate-100">
          {filteredVentas.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              No se encontraron comandas registradas
            </div>
          ) : (
            filteredVentas.map((v) => {
              const pdfUrl = v.comprobante?.enlace_del_pdf || v.enlace_del_pdf;
              const xmlUrl = v.comprobante?.enlace_del_xml || v.enlace_del_xml;
              const isAnulada = v.estado === 'ANULADA';
              const codigoDisplay = v.comprobante?.codigoCompleto || v.id;
              const totalPlatos = v.items?.reduce((acc, it) => acc + (it.cantidad || 0), 0) || 0;

              return (
                <div
                  key={v.id}
                  className={`p-3.5 space-y-2 text-xs ${isAnulada ? 'bg-rose-50/40 opacity-85' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`font-mono font-black text-sm ${
                            isAnulada ? 'line-through text-rose-700' : 'text-slate-900'
                          }`}
                        >
                          {codigoDisplay}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.2 rounded-full ${
                            v.tipoComprobante === 'BOLETA'
                              ? 'bg-purple-100 text-purple-800'
                              : v.tipoComprobante === 'FACTURA'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {v.tipoComprobante}
                        </span>
                        {isAnulada && (
                          <span className="text-[10px] font-extrabold px-2 py-0.2 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                            ANULADA
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {v.cliente?.nombre || 'Público General'}{' '}
                        {v.cliente?.documento ? `(${v.cliente.documento})` : ''}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={`font-black text-base block ${
                          isAnulada ? 'line-through text-rose-500' : 'text-brand-700'
                        }`}
                      >
                        S/ {Number(v.total || 0).toFixed(2)}
                      </span>
                      <span className="text-[10px] font-bold text-slate-500">
                        {v.metodoPago} • {totalPlatos} ít.
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <span className="text-[11px] text-slate-400">
                      {new Date(v.fecha).toLocaleString([], {
                        month: 'short',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}{' '}
                      • {v.vendedor}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {pdfUrl ? (
                        <a
                          href={pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1.5 rounded-lg bg-slate-900 text-white font-bold text-[11px] inline-flex items-center gap-1"
                        >
                          <Printer className="w-3.5 h-3.5 text-gold-400" />
                          <span>PDF</span>
                        </a>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setSelectedTicket(v)}
                          className="px-2.5 py-1.5 rounded-lg bg-pink-50 text-brand-700 font-bold text-[11px] inline-flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Ver</span>
                        </button>
                      )}

                      {xmlUrl && (
                        <a
                          href={xmlUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg bg-slate-100 text-slate-700"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </a>
                      )}

                      {isDueno && !isAnulada && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(v)}
                            className="p-1.5 rounded-lg bg-amber-50 text-amber-800"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAnularVenta(v)}
                            className="p-1.5 rounded-lg bg-rose-50 text-rose-700"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* VISTA TABLET/ESCRITORIO (md:): TABLA COMPLETA */}
        <div className="hidden md:block overflow-x-auto">
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
                filteredVentas.map((v) => {
                  const pdfUrl = v.comprobante?.enlace_del_pdf || v.enlace_del_pdf;
                  const xmlUrl = v.comprobante?.enlace_del_xml || v.enlace_del_xml;
                  const isAnulada = v.estado === 'ANULADA';
                  const codigoDisplay = v.comprobante?.codigoCompleto || v.id;

                  return (
                  <tr key={v.id} className={`hover:bg-pink-50/20 transition-colors ${isAnulada ? 'bg-rose-50/40 opacity-80' : ''}`}>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`font-mono font-bold block ${isAnulada ? 'line-through text-rose-700' : 'text-slate-900'}`}>
                          {codigoDisplay}
                        </span>
                        {v.cuenta?.nombre && (
                          <span className="bg-pink-100 text-brand-800 font-bold text-[10px] px-1.5 py-0.2 rounded-md">
                            {v.cuenta.nombre}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                        <span className={`text-[10px] font-bold px-2 py-0.2 rounded-full inline-block ${
                          v.tipoComprobante === 'BOLETA'
                            ? 'bg-purple-100 text-purple-800'
                            : v.tipoComprobante === 'FACTURA'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {v.tipoComprobante}
                        </span>
                        {isAnulada && (
                          <span className="text-[10px] font-extrabold px-2 py-0.2 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                            ANULADA
                          </span>
                        )}
                        {v.notaCredito?.codigoCompleto && (
                          <a
                            href={v.notaCredito.enlace_del_pdf || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] font-mono font-bold px-2 py-0.2 rounded-full bg-slate-800 text-gold-300 hover:bg-black inline-flex items-center gap-1"
                            title="Abrir PDF de Nota de Crédito en SUNAT"
                          >
                            <span>NC {v.notaCredito.codigoCompleto}</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>
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

                    <td className={`py-3.5 px-4 text-right font-bold text-sm ${isAnulada ? 'line-through text-rose-500' : 'text-brand-700'}`}>
                      S/ {Number(v.total).toFixed(2)}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {pdfUrl ? (
                          <a
                            href={pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Abrir PDF SUNAT (APISUNAT)"
                            className="px-2 py-1.5 rounded-lg bg-slate-900 hover:bg-black text-white font-bold text-[10px] inline-flex items-center gap-1 transition-all"
                          >
                            <Printer className="w-3.5 h-3.5 text-gold-400" />
                            <span>PDF</span>
                          </a>
                        ) : (
                          <button
                            onClick={() => setSelectedTicket(v)}
                            title="Ver Detalle Interno"
                            className="p-1.5 rounded-lg bg-pink-50 hover:bg-pink-100 text-brand-700 font-bold transition-all"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        )}

                        {xmlUrl && (
                          <a
                            href={xmlUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Descargar XML SUNAT"
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </a>
                        )}

                        {/* ACCIONES EXCLUSIVAS DEL DUEÑO 👑 */}
                        {isDueno && !isAnulada && (
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
                              title="Anular venta / Emitir Nota de Crédito SUNAT (Solo Dueño)"
                              className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 transition-colors"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </>
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

      {/* Modal: Editar Venta (92dvh en móvil) */}
      {editingSale && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-end sm:items-center justify-center sm:p-4 animate-fadeIn">
          <div className="bg-white w-full h-[92dvh] sm:h-auto sm:max-w-md rounded-t-2xl sm:rounded-3xl p-5 shadow-2xl border border-pink-100 flex flex-col justify-between overflow-y-auto">
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

      {/* Modal: Anular Venta / Emitir Nota de Crédito SUNAT (92dvh en móvil) */}
      {voidingSale && (
        <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-xs flex items-end sm:items-center justify-center sm:p-4 animate-fadeIn">
          <div className="bg-white w-full h-[92dvh] sm:h-auto sm:max-w-md rounded-t-2xl sm:rounded-3xl p-5 shadow-2xl border border-rose-200 flex flex-col justify-between overflow-y-auto space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-serif font-bold text-lg text-slate-900">
                  Anular Venta {voidingSale.comprobante?.codigoCompleto || voidingSale.id}
                </h3>
                <p className="text-xs text-slate-500">
                  {(voidingSale.tipoComprobante === 'BOLETA' || voidingSale.tipoComprobante === 'FACTURA') &&
                  voidingSale.comprobante?.serie !== 'NV01'
                    ? 'Se emitirá automáticamente una Nota de Crédito (07) ante SUNAT vía APISUNAT.'
                    : 'Se anulará el ticket de control interno y se devolverá el stock.'}
                </p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Cliente:</span>
                <span className="font-bold text-slate-800">{voidingSale.cliente?.nombre || 'Público General'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total:</span>
                <span className="font-bold text-rose-700">S/ {Number(voidingSale.total || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Local:</span>
                <span className="font-semibold text-slate-700">{voidingSale.sedeNombre || voidingSale.sede}</span>
              </div>
            </div>

            <form onSubmit={handleConfirmVoidSale} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Tipo de Nota de Crédito (Catálogo 09 SUNAT)</label>
                <select
                  value={voidCodigoMotivo}
                  onChange={(e) => setVoidCodigoMotivo(e.target.value)}
                  disabled={isVoiding}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-semibold focus:outline-none focus:border-rose-500"
                >
                  <option value="01">01 - Anulación de la operación</option>
                  <option value="02">02 - Anulación por error en el RUC</option>
                  <option value="06">06 - Devolución total</option>
                  <option value="07">07 - Devolución por ítem</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Motivo / Sustento *</label>
                <input
                  type="text"
                  value={voidMotivo}
                  onChange={(e) => setVoidMotivo(e.target.value)}
                  required
                  disabled={isVoiding}
                  placeholder="Ej. ANULACION DE LA OPERACION"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-rose-500 font-semibold"
                />
              </div>

              <p className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 font-medium">
                ✓ El stock será devuelto automáticamente al Kardex y la venta se conservará marcada como ANULADA para el registro contable SIRE.
              </p>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setVoidingSale(null)}
                  disabled={isVoiding}
                  className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isVoiding}
                  className="flex-[2] py-3 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white font-extrabold shadow-lg shadow-rose-600/25 flex items-center justify-center gap-2 transition-all"
                >
                  {isVoiding ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Emitiendo Nota de Crédito...</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4" />
                      <span>Confirmar Anulación</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Vista de Detalle / Ticket Interno */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 shadow-2xl border border-pink-100 w-full max-w-sm max-h-[92vh] overflow-y-auto text-center">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Detalle de Venta
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
              {selectedTicket.comprobante?.enlace_del_pdf ? (
                <a
                  href={selectedTicket.comprobante.enlace_del_pdf}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-3 rounded-2xl bg-slate-900 hover:bg-black text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all"
                >
                  <Printer className="w-4 h-4 text-gold-400" />
                  <span>🖨️ Abrir PDF APISUNAT</span>
                </a>
              ) : (
                <button
                  onClick={() => window.print()}
                  className="flex-1 py-3 rounded-2xl bg-slate-900 hover:bg-black text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all"
                >
                  <Printer className="w-4 h-4 text-gold-400" />
                  <span>Imprimir Control Interno</span>
                </button>
              )}
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
