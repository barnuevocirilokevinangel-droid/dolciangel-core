import React, { useState, useMemo } from 'react';
import { useApp, SEDES } from '../context/AppContext';
import { 
  db, 
  collections, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  serverTimestamp 
} from '../services/firebase';
import { 
  Wallet, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Lock, 
  Unlock, 
  DollarSign, 
  Smartphone, 
  CreditCard, 
  AlertTriangle, 
  CheckCircle, 
  FileText,
  Clock,
  User,
  PlusCircle,
  HelpCircle,
  Crown,
  Trash2,
  Edit3
} from 'lucide-react';

export const CajaView = () => {
  const { 
    sede, 
    perfil, 
    sesionCaja, 
    ventas, 
    movimientosCaja, 
    showToast 
  } = useApp();

  const [showAperturaModal, setShowAperturaModal] = useState(false);
  const [montoApertura, setMontoApertura] = useState('');

  const [showGastoModal, setShowGastoModal] = useState(false);
  const [gastoMonto, setGastoMonto] = useState('');
  const [gastoMotivo, setGastoMotivo] = useState('Insumos');
  const [gastoDetalle, setGastoDetalle] = useState('');

  // Edición de Gasto (Exclusivo Dueño 👑)
  const [editingGasto, setEditingGasto] = useState(null);
  const [editGastoMonto, setEditGastoMonto] = useState('');
  const [editGastoMotivo, setEditGastoMotivo] = useState('Insumos');
  const [editGastoDetalle, setEditGastoDetalle] = useState('');
  const [editGastoResponsable, setEditGastoResponsable] = useState('');

  const [showArqueoModal, setShowArqueoModal] = useState(false);
  const [montoContado, setMontoContado] = useState('');
  const [arqueoNota, setArqueoNota] = useState('');
  const [arqueoResult, setArqueoResult] = useState(null);

  const isDueno = perfil?.isDueno ?? false;

  // Filtrar ventas del turno activo
  const ventasTurno = useMemo(() => {
    if (!sesionCaja) return [];
    const fechaInicio = new Date(sesionCaja.fechaApertura).getTime();
    return ventas.filter(v => {
      const fechaVenta = new Date(v.fecha).getTime();
      return v.sede === sede && fechaVenta >= fechaInicio;
    });
  }, [ventas, sesionCaja, sede]);

  // Totales de ventas por método de pago
  const ventasEfectivo = useMemo(() => {
    return ventasTurno
      .filter(v => v.metodoPago === 'EFECTIVO')
      .reduce((sum, v) => sum + (v.total || 0), 0);
  }, [ventasTurno]);

  const ventasDigital = useMemo(() => {
    return ventasTurno
      .filter(v => v.metodoPago !== 'EFECTIVO')
      .reduce((sum, v) => sum + (v.total || 0), 0);
  }, [ventasTurno]);

  // Filtrar egresos/gastos del turno activo
  const egresosTurno = useMemo(() => {
    if (!sesionCaja) return [];
    return movimientosCaja.filter(m => 
      m.sesionId === sesionCaja.id && m.tipo === 'EGRESO_GASTO'
    );
  }, [movimientosCaja, sesionCaja]);

  const totalEgresos = useMemo(() => {
    return egresosTurno.reduce((sum, m) => sum + (m.monto || 0), 0);
  }, [egresosTurno]);

  // Efectivo esperado en gaveta (Apertura + Ventas Efectivo - Egresos)
  const efectivoEsperado = useMemo(() => {
    if (!sesionCaja) return 0;
    const inicial = Number(sesionCaja.montoApertura) || 0;
    return inicial + ventasEfectivo - totalEgresos;
  }, [sesionCaja, ventasEfectivo, totalEgresos]);

  // 1. Abrir Turno de Caja
  const handleApertura = async (e) => {
    e.preventDefault();
    const inicial = parseFloat(montoApertura);
    if (isNaN(inicial) || inicial < 0) {
      showToast('Ingresa un monto de apertura válido', 'error');
      return;
    }

    try {
      const sesionId = `SESION-${sede}-${Date.now()}`;
      const sesionRef = doc(collections.sesionesCaja, sesionId);

      const dataApertura = {
        id: sesionId,
        sede,
        sedeNombre: SEDES[sede].nombre,
        montoApertura: inicial,
        fechaApertura: new Date().toISOString(),
        timestamp: serverTimestamp(),
        abiertoPor: perfil.nombre,
        estado: 'ABIERTA'
      };

      await setDoc(sesionRef, dataApertura);
      setShowAperturaModal(false);
      setMontoApertura('');
      showToast(`¡Turno de caja abierto con S/ ${inicial.toFixed(2)}!`);
    } catch (err) {
      console.error('Error al abrir turno:', err);
      showToast('Error al abrir turno: ' + err.message, 'error');
    }
  };

  // 2. Registrar Gasto / Salida
  const handleRegistrarGasto = async (e) => {
    e.preventDefault();
    const monto = parseFloat(gastoMonto);
    if (isNaN(monto) || monto <= 0) {
      showToast('Ingresa un monto válido para el egreso', 'error');
      return;
    }
    if (!gastoDetalle.trim()) {
      showToast('Describe el motivo o comprobante del gasto', 'error');
      return;
    }

    try {
      const movId = `EGRESO-${Date.now()}`;
      const movRef = doc(collections.movimientosCaja, movId);

      await setDoc(movRef, {
        id: movId,
        sesionId: sesionCaja.id,
        sede,
        tipo: 'EGRESO_GASTO',
        monto,
        motivo: gastoMotivo,
        descripcion: gastoDetalle.trim(),
        responsable: perfil.nombre,
        fecha: new Date().toISOString(),
        timestamp: serverTimestamp()
      });

      setShowGastoModal(false);
      setGastoMonto('');
      setGastoDetalle('');
      showToast(`Gasto de S/ ${monto.toFixed(2)} registrado en caja`);
    } catch (err) {
      console.error('Error al registrar egreso:', err);
      showToast('Error: ' + err.message, 'error');
    }
  };

  // 3. Eliminar / Anular Gasto (Exclusivo Dueño 👑)
  const handleDeleteGasto = async (egreso) => {
    if (!isDueno) return;
    if (!window.confirm(`¿Estás seguro de anular el gasto de S/ ${egreso.monto.toFixed(2)} (${egreso.descripcion})? El saldo teórico de caja se recalculará automáticamente.`)) {
      return;
    }

    try {
      await deleteDoc(doc(collections.movimientosCaja, egreso.id));
      showToast(`Gasto de S/ ${egreso.monto.toFixed(2)} anulado exitosamente`, 'success');
    } catch (err) {
      console.error('Error al borrar gasto:', err);
      showToast('Error al anular gasto: ' + err.message, 'error');
    }
  };

  // 4. Abrir Modal de Edición de Gasto (Exclusivo Dueño 👑)
  const handleOpenEditGasto = (egreso) => {
    setEditingGasto(egreso);
    setEditGastoMonto(egreso.monto.toString());
    setEditGastoMotivo(egreso.motivo || 'Insumos');
    setEditGastoDetalle(egreso.descripcion || '');
    setEditGastoResponsable(egreso.responsable || perfil.nombre);
  };

  // Guardar Cambios del Gasto
  const handleSaveEditGasto = async (e) => {
    e.preventDefault();
    if (!editingGasto || !isDueno) return;

    const numMonto = parseFloat(editGastoMonto);
    if (isNaN(numMonto) || numMonto <= 0) {
      showToast('Ingresa un monto válido', 'error');
      return;
    }

    try {
      const movRef = doc(collections.movimientosCaja, editingGasto.id);
      await updateDoc(movRef, {
        monto: numMonto,
        motivo: editGastoMotivo,
        descripcion: editGastoDetalle.trim(),
        responsable: editGastoResponsable.trim(),
        editadoPor: perfil.nombre,
        fechaEdicion: new Date().toISOString(),
        updatedAt: serverTimestamp()
      });

      showToast('Gasto actualizado correctamente');
      setEditingGasto(null);
    } catch (err) {
      console.error('Error al editar gasto:', err);
      showToast('Error al editar: ' + err.message, 'error');
    }
  };

  // 5. Arqueo Ciego y Cierre de Turno
  const handleCerrarTurno = async (e) => {
    e.preventDefault();
    const contado = parseFloat(montoContado);
    if (isNaN(contado) || contado < 0) {
      showToast('Ingresa el monto de efectivo que tienes en mano', 'error');
      return;
    }

    const diferencia = contado - efectivoEsperado;
    let estadoArqueo = 'CUADRADO';
    if (diferencia > 0.05) estadoArqueo = 'SOBRANTE';
    else if (diferencia < -0.05) estadoArqueo = 'FALTANTE';

    try {
      const sesionRef = doc(collections.sesionesCaja, sesionCaja.id);

      const cierreData = {
        estado: 'CERRADA',
        fechaCierre: new Date().toISOString(),
        cerradoPor: perfil.nombre,
        montoContado: contado,
        montoEsperado: efectivoEsperado,
        diferencia,
        estadoArqueo,
        notaCierre: arqueoNota.trim(),
        ventasEfectivo,
        ventasDigital,
        totalEgresos,
        totalVendido: ventasEfectivo + ventasDigital
      };

      await updateDoc(sesionRef, cierreData);

      const cierreMovRef = doc(collections.movimientosCaja, `CIERRE-${Date.now()}`);
      await setDoc(cierreMovRef, {
        sesionId: sesionCaja.id,
        sede,
        tipo: 'CIERRE_ARQUEO',
        monto: contado,
        diferencia,
        estadoArqueo,
        responsable: perfil.nombre,
        fecha: new Date().toISOString(),
        timestamp: serverTimestamp()
      });

      setArqueoResult({
        contado,
        esperado: efectivoEsperado,
        diferencia,
        estadoArqueo,
        responsable: perfil.nombre
      });

      setShowArqueoModal(false);
      setMontoContado('');
      setArqueoNota('');
      showToast('Turno cerrado y arqueo registrado correctamente');
    } catch (err) {
      console.error('Error al cerrar turno:', err);
      showToast('Error al cerrar turno: ' + err.message, 'error');
    }
  };

  return (
    <div className="pb-28 max-w-7xl mx-auto px-4 pt-4">
      {/* Banner de Estado de Caja */}
      <div className={`rounded-3xl p-6 text-white shadow-lg mb-6 ${
        sesionCaja 
          ? 'bg-gradient-to-r from-brand-700 via-brand-600 to-pink-600 shadow-brand-700/20' 
          : 'bg-gradient-to-r from-slate-700 to-slate-800 shadow-slate-800/20'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-2xl shadow-inner">
              {sesionCaja ? '💵' : '🔒'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                  sesionCaja ? 'bg-emerald-400 text-emerald-950 font-bold' : 'bg-slate-600 text-slate-200'
                }`}>
                  {sesionCaja ? 'Turno Abierto' : 'Caja Cerrada'}
                </span>
                <span className="text-xs text-pink-100">Sede {SEDES[sede]?.nombre}</span>
                {isDueno && (
                  <span className="text-[10px] font-extrabold bg-gold-400 text-slate-950 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                    <Crown className="w-3 h-3" />
                    <span>Modo Dueño</span>
                  </span>
                )}
              </div>
              <h2 className="text-xl md:text-2xl font-serif font-bold mt-1">
                Control de Caja Chica & Arqueo Ciego
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!sesionCaja ? (
              <button
                onClick={() => setShowAperturaModal(true)}
                className="px-4 py-2.5 rounded-xl bg-gold-500 hover:bg-gold-600 text-slate-950 font-extrabold text-xs shadow-md transition-all active:scale-95 flex items-center gap-2"
              >
                <Unlock className="w-4 h-4" />
                <span>Abrir Turno de Caja</span>
              </button>
            ) : (
              <>
                <button
                  onClick={() => setShowGastoModal(true)}
                  className="px-3.5 py-2.5 rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold text-xs border border-white/25 transition-all flex items-center gap-1.5"
                >
                  <ArrowDownLeft className="w-4 h-4 text-rose-300" />
                  <span>- Registrar Gasto</span>
                </button>
                <button
                  onClick={() => setShowArqueoModal(true)}
                  className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs shadow-md transition-all active:scale-95 flex items-center gap-1.5"
                >
                  <Lock className="w-4 h-4" />
                  <span>Cerrar Turno (Arqueo)</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {!sesionCaja ? (
        <div className="bg-white rounded-3xl p-8 border border-pink-100 shadow-sm text-center max-w-lg mx-auto my-8">
          <div className="w-16 h-16 rounded-full bg-pink-50 text-brand-700 mx-auto flex items-center justify-center text-3xl mb-4">
            🔒
          </div>
          <h3 className="font-serif font-bold text-xl text-slate-800">
            No hay turno de caja abierto en {SEDES[sede]?.nombre}
          </h3>
          <p className="text-xs text-slate-500 mt-2 max-w-sm mx-auto">
            Para registrar ventas en efectivo y controlar egresos del día, ingresa el monto de apertura de gaveta.
          </p>
          <button
            onClick={() => setShowAperturaModal(true)}
            className="mt-6 px-6 py-3 rounded-2xl bg-brand-700 hover:bg-brand-800 text-white font-extrabold text-xs shadow-lg shadow-brand-700/20 active:scale-95 transition-all"
          >
            Abrir Turno Ahora
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {isDueno ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-emerald-500 to-teal-700 rounded-2xl p-4 text-white shadow-md">
                <div className="flex items-center justify-between text-emerald-100 text-xs">
                  <span className="font-bold uppercase tracking-wider">Efectivo en Gaveta</span>
                  <Wallet className="w-4 h-4" />
                </div>
                <div className="text-2xl font-extrabold mt-2">
                  S/ {efectivoEsperado.toFixed(2)}
                </div>
                <div className="text-[11px] text-emerald-100/90 mt-1">
                  Apertura (S/{Number(sesionCaja.montoApertura).toFixed(2)}) + Ventas (S/{ventasEfectivo.toFixed(2)}) - Egresos (S/{totalEgresos.toFixed(2)})
                </div>
              </div>

              <div className="bg-white rounded-2xl p-4 border border-pink-100 shadow-sm">
                <div className="flex items-center justify-between text-slate-400 text-xs">
                  <span className="font-bold uppercase tracking-wider">Ventas Efectivo</span>
                  <DollarSign className="w-4 h-4 text-brand-600" />
                </div>
                <div className="text-2xl font-extrabold text-slate-900 mt-2">
                  S/ {ventasEfectivo.toFixed(2)}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Cobrado en caja física
                </div>
              </div>

              <div className="bg-white rounded-2xl p-4 border border-pink-100 shadow-sm">
                <div className="flex items-center justify-between text-slate-400 text-xs">
                  <span className="font-bold uppercase tracking-wider">Digital (Yape/Plin/Tarjeta)</span>
                  <Smartphone className="w-4 h-4 text-purple-600" />
                </div>
                <div className="text-2xl font-extrabold text-purple-700 mt-2">
                  S/ {ventasDigital.toFixed(2)}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  En cuentas bancarias / POS
                </div>
              </div>

              <div className="bg-white rounded-2xl p-4 border border-pink-100 shadow-sm">
                <div className="flex items-center justify-between text-slate-400 text-xs">
                  <span className="font-bold uppercase tracking-wider">Egresos / Gastos</span>
                  <ArrowDownLeft className="w-4 h-4 text-rose-500" />
                </div>
                <div className="text-2xl font-extrabold text-rose-600 mt-2">
                  S/ {totalEgresos.toFixed(2)}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  {egresosTurno.length} salidas registradas
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-5 border border-pink-100 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center text-xl">
                  🛡️
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">
                    Modo Colaborador Activo (Arqueo Ciego)
                  </h4>
                  <p className="text-xs text-slate-500">
                    Por política de seguridad interna, los saldos calculados están reservados para la verificación final. Al cerrar el turno ingresarás tu conteo físico.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-3 border-t border-slate-100 text-xs">
                <div>
                  <span className="text-slate-400 block">Abierto por:</span>
                  <span className="font-bold text-slate-700">{sesionCaja.abiertoPor}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Hora Apertura:</span>
                  <span className="font-bold text-slate-700">
                    {new Date(sesionCaja.fechaApertura).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Comandas Registradas:</span>
                  <span className="font-bold text-slate-700">{ventasTurno.length} ventas</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Egresos de Turno:</span>
                  <span className="font-bold text-slate-700">{egresosTurno.length} salidas</span>
                </div>
              </div>
            </div>
          )}

          {/* Historial de Movimientos de Caja del Turno */}
          <div className="bg-white rounded-2xl border border-pink-100 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-brand-700" />
                <span>Salidas de Caja & Egresos ({egresosTurno.length})</span>
              </h3>
              <button
                onClick={() => setShowGastoModal(true)}
                className="text-xs font-bold text-brand-700 hover:text-brand-900 flex items-center gap-1"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Registrar Salida</span>
              </button>
            </div>

            <div className="p-4">
              {egresosTurno.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">
                  No se han registrado salidas o gastos en este turno
                </p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {egresosTurno.map((egreso) => (
                    <div key={egreso.id} className="py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                            {egreso.motivo}
                          </span>
                          <span className="font-semibold text-slate-800">{egreso.descripcion}</span>
                        </div>
                        <span className="text-[11px] text-slate-400 mt-0.5 block">
                          Por {egreso.responsable} • {new Date(egreso.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="font-extrabold text-rose-600 text-sm">
                          - S/ {egreso.monto.toFixed(2)}
                        </span>

                        {/* ACCIONES EXCLUSIVAS DEL DUEÑO 👑 */}
                        {isDueno && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleOpenEditGasto(egreso)}
                              title="Editar gasto (Solo Dueño)"
                              className="p-1 rounded-lg text-slate-400 hover:text-amber-800 hover:bg-amber-50 transition-colors"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteGasto(egreso)}
                              title="Anular gasto (Solo Dueño)"
                              className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Apertura de Caja */}
      {showAperturaModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 shadow-2xl border border-pink-100 w-full max-w-sm">
            <div className="w-12 h-12 rounded-2xl bg-brand-100 text-brand-700 mx-auto flex items-center justify-center text-2xl mb-3">
              💵
            </div>
            <h3 className="font-serif font-bold text-lg text-slate-900 text-center">
              Apertura de Caja
            </h3>
            <p className="text-xs text-slate-500 text-center mt-1">
              Sede {SEDES[sede]?.nombre} • Responsable: {perfil?.nombre}
            </p>

            <form onSubmit={handleApertura} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Monto Inicial en Gaveta (S/) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">S/</span>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={montoApertura}
                    onChange={(e) => setMontoApertura(e.target.value)}
                    placeholder="Ej. 100.00"
                    required
                    autoFocus
                    className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-pink-200 text-slate-800 font-bold focus:outline-none focus:border-brand-500 text-sm"
                  />
                </div>
                <div className="flex gap-2 mt-2">
                  {[50, 100, 150].map((v) => (
                    <button
                      type="button"
                      key={v}
                      onClick={() => setMontoApertura(v.toString())}
                      className="px-2 py-1 rounded-lg bg-pink-50 hover:bg-pink-100 text-brand-700 text-xs font-bold"
                    >
                      S/{v}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAperturaModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-brand-700 hover:bg-brand-800 text-white font-bold text-xs shadow-md shadow-brand-700/20"
                >
                  Confirmar Apertura
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Registrar Gasto / Salida */}
      {showGastoModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 shadow-2xl border border-pink-100 w-full max-w-md">
            <h3 className="font-serif font-bold text-lg text-slate-900">
              - Registrar Gasto / Salida de Caja
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Quedará registrado en los movimientos de auditoría de este turno.
            </p>

            <form onSubmit={handleRegistrarGasto} className="mt-4 space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Monto (S/) *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">S/</span>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    value={gastoMonto}
                    onChange={(e) => setGastoMonto(e.target.value)}
                    placeholder="0.00"
                    required
                    autoFocus
                    className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 text-slate-800 font-bold focus:outline-none focus:border-brand-500 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Motivo / Categoría *</label>
                <select
                  value={gastoMotivo}
                  onChange={(e) => setGastoMotivo(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold focus:outline-none focus:border-brand-500 bg-white"
                >
                  <option value="Insumos">Insumos de Pastelería / Cocina</option>
                  <option value="Compras">Compras Urgentes / Supermercado</option>
                  <option value="Delivery">Pago a Motorizado / Delivery</option>
                  <option value="Servicios">Servicios Básicos / Limpieza</option>
                  <option value="Personal">Adelanto / Pasajes Personal</option>
                  <option value="Otros">Otros Egresos</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Detalle / Justificación *</label>
                <textarea
                  value={gastoDetalle}
                  onChange={(e) => setGastoDetalle(e.target.value)}
                  placeholder="Ej. Compra de 2kg de fresas para Cheesecake..."
                  rows={2}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowGastoModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-600/20"
                >
                  Guardar Egreso
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Editar Gasto (Exclusivo Dueño 👑) */}
      {editingGasto && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 shadow-2xl border border-pink-100 w-full max-w-md">
            <div className="flex items-center gap-2 mb-3">
              <span className="p-2 rounded-xl bg-amber-100 text-amber-800">
                <Crown className="w-5 h-5" />
              </span>
              <div>
                <h3 className="font-serif font-bold text-lg text-slate-900">
                  Modificar Gasto de Caja
                </h3>
                <span className="text-xs text-slate-500">Permiso exclusivo de Dueño</span>
              </div>
            </div>

            <form onSubmit={handleSaveEditGasto} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Monto (S/) *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">S/</span>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    value={editGastoMonto}
                    onChange={(e) => setEditGastoMonto(e.target.value)}
                    required
                    className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 font-bold text-slate-900 focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Categoría / Motivo *</label>
                <select
                  value={editGastoMotivo}
                  onChange={(e) => setEditGastoMotivo(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-semibold focus:outline-none focus:border-brand-500 bg-white"
                >
                  <option value="Insumos">Insumos de Pastelería / Cocina</option>
                  <option value="Compras">Compras Urgentes / Supermercado</option>
                  <option value="Delivery">Pago a Motorizado / Delivery</option>
                  <option value="Servicios">Servicios Básicos / Limpieza</option>
                  <option value="Personal">Adelanto / Pasajes Personal</option>
                  <option value="Otros">Otros Egresos</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Descripción / Detalle *</label>
                <textarea
                  value={editGastoDetalle}
                  onChange={(e) => setEditGastoDetalle(e.target.value)}
                  rows={2}
                  required
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

      {/* Modal: Arqueo Ciego & Cierre de Turno */}
      {showArqueoModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 shadow-2xl border border-pink-100 w-full max-w-md">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 mx-auto flex items-center justify-center text-2xl mb-3">
              🛡️
            </div>
            <h3 className="font-serif font-bold text-lg text-slate-900 text-center">
              Cierre de Turno (Arqueo Ciego)
            </h3>
            <p className="text-xs text-slate-500 text-center mt-1">
              Cuenta todo el dinero en efectivo que tienes en gaveta e ingrésalo a continuación. El sistema auditará la diferencia automáticamente.
            </p>

            <form onSubmit={handleCerrarTurno} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Efectivo Contado en Gaveta (S/) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">S/</span>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={montoContado}
                    onChange={(e) => setMontoContado(e.target.value)}
                    placeholder="Total en monedas y billetes"
                    required
                    autoFocus
                    className="w-full pl-8 pr-3 py-2.5 rounded-xl border-2 border-brand-300 text-slate-900 font-extrabold focus:outline-none focus:border-brand-600 text-base"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Observaciones de Cierre</label>
                <input
                  type="text"
                  value={arqueoNota}
                  onChange={(e) => setArqueoNota(e.target.value)}
                  placeholder="Ej. Quedan monedas para cambio mañana"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowArqueoModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50"
                >
                  Volver
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-brand-700 hover:bg-brand-800 text-white font-extrabold text-xs shadow-md shadow-brand-700/20"
                >
                  Confirmar y Cerrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Resultado de Auditoría de Arqueo */}
      {arqueoResult && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 shadow-2xl border border-pink-100 w-full max-w-sm text-center">
            <div className={`w-14 h-14 rounded-2xl mx-auto flex items-center justify-center text-3xl mb-3 shadow-inner ${
              arqueoResult.estadoArqueo === 'CUADRADO' 
                ? 'bg-emerald-100 text-emerald-700' 
                : arqueoResult.estadoArqueo === 'SOBRANTE'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-rose-100 text-rose-700'
            }`}>
              {arqueoResult.estadoArqueo === 'CUADRADO' ? '✓' : arqueoResult.estadoArqueo === 'SOBRANTE' ? '▲' : '⚠'}
            </div>

            <h3 className="font-serif font-bold text-xl text-slate-900">
              Resultado de Arqueo: {arqueoResult.estadoArqueo}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Auditado por {arqueoResult.responsable}
            </p>

            <div className="bg-slate-50 rounded-2xl p-4 my-4 text-xs font-mono space-y-2 border border-slate-200 text-left">
              <div className="flex justify-between">
                <span>Efectivo Contado:</span>
                <span className="font-bold">S/ {arqueoResult.contado.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Efectivo Esperado:</span>
                <span className="font-bold">S/ {arqueoResult.esperado.toFixed(2)}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-300 font-bold text-sm">
                <span>Diferencia:</span>
                <span className={
                  arqueoResult.diferencia >= 0 ? 'text-emerald-700' : 'text-rose-600'
                }>
                  {arqueoResult.diferencia > 0 ? '+' : ''}S/ {arqueoResult.diferencia.toFixed(2)}
                </span>
              </div>
            </div>

            <button
              onClick={() => setArqueoResult(null)}
              className="w-full py-2.5 rounded-xl bg-brand-700 hover:bg-brand-800 text-white font-bold text-xs"
            >
              Aceptar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
