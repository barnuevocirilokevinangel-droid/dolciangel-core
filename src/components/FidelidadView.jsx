import React, { useState, useEffect } from 'react';
import { useApp, SEDES } from '../context/AppContext';
import { 
  db, 
  collections, 
  doc, 
  updateDoc, 
  setDoc, 
  deleteDoc, 
  serverTimestamp, 
  increment, 
  onSnapshot, 
  query, 
  orderBy, 
  limit, 
  writeBatch 
} from '../services/firebase';
import { 
  Gift, 
  Search, 
  Sparkles, 
  Award, 
  Clock, 
  Phone, 
  Plus, 
  Crown, 
  Trash2, 
  Edit3,
  Calendar,
  X,
  History,
  CheckCircle2,
  Cake
} from 'lucide-react';

export const FidelidadView = () => {
  const { sede, perfil, clientesFidelidad, showToast } = useApp();

  const [searchPhone, setSearchPhone] = useState('');
  const [selectedClient, setSelectedClient] = useState(null);
  const [canjesAuditados, setCanjesAuditados] = useState([]);
  
  // Modal: Nuevo Cliente
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientName, setNewClientName] = useState('');
  const [newClientBirthday, setNewClientBirthday] = useState('');
  const [newClientLevel, setNewClientLevel] = useState('Clásico');

  // Modal: Historial del Cliente
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Modal: Edición de Cliente (Exclusivo Dueño 👑)
  const [editingClient, setEditingClient] = useState(null);
  const [editClientName, setEditClientName] = useState('');
  const [editClientPhone, setEditClientPhone] = useState('');
  const [editClientSellos, setEditClientSellos] = useState(0);
  const [editClientBirthday, setEditClientBirthday] = useState('');
  const [editClientLevel, setEditClientLevel] = useState('Clásico');

  const isDueno = perfil?.isDueno ?? false;

  // Escuchar historial de canjes en tiempo real
  useEffect(() => {
    const qCanjes = query(collections.canjesFidelidad, orderBy('fecha', 'desc'), limit(50));
    const unsub = onSnapshot(qCanjes, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setCanjesAuditados(docs);
    });
    return () => unsub();
  }, []);

  // Mantener actualizado el cliente seleccionado si cambia en Firestore
  useEffect(() => {
    if (selectedClient) {
      const updated = clientesFidelidad.find(c => c.id === selectedClient.id);
      if (updated) setSelectedClient(updated);
    }
  }, [clientesFidelidad]);

  // Filtrar clientes por búsqueda (teléfono o nombre)
  const filteredClients = clientesFidelidad.filter((c) => {
    const term = searchPhone.toLowerCase();
    const phoneMatch = (c.telefono || '').includes(term);
    const nameMatch = (c.nombre || '').toLowerCase().includes(term);
    return phoneMatch || nameMatch;
  });

  // Auto-seleccionar si el teléfono coincide exactamente
  useEffect(() => {
    if (searchPhone.trim().length === 9) {
      const found = clientesFidelidad.find(c => c.telefono === searchPhone.trim());
      if (found) setSelectedClient(found);
    }
  }, [searchPhone, clientesFidelidad]);

  // Canjear Premio (6 sellos = 1 porción gratis)
  const handleCanjearPremio = async () => {
    if (!selectedClient) return;
    const currentSellos = selectedClient.sellos || 0;
    if (currentSellos < 6) {
      showToast(`El cliente tiene ${currentSellos} sellos. Necesita 6 para canjear.`, 'warning');
      return;
    }

    try {
      const clientRef = doc(collections.clientesFidelidad, selectedClient.id);
      const canjeId = `CANJE-${Date.now()}`;
      const premioTexto = '1 Porción de Postre Gratis (6 Sellos)';

      await updateDoc(clientRef, {
        sellos: increment(-6),
        premiosCanjeados: increment(1),
        ultimoCanje: new Date().toISOString(),
        updatedAt: serverTimestamp()
      });

      const canjeRef = doc(collections.canjesFidelidad, canjeId);
      await setDoc(canjeRef, {
        id: canjeId,
        clienteId: selectedClient.id,
        telefono: selectedClient.telefono,
        nombreCliente: selectedClient.nombre || 'Cliente Frecuente',
        premio: premioTexto,
        sede,
        sedeNombre: SEDES[sede]?.nombre || 'Sede',
        canjeadoPor: perfil?.nombre || 'Colaborador',
        fecha: new Date().toISOString(),
        timestamp: serverTimestamp()
      });

      showToast(`¡Premio canjeado con éxito para ${selectedClient.nombre || 'el cliente'}!`, 'success');
    } catch (err) {
      console.error('Error al canjear premio:', err);
      showToast('Error al canjear: ' + err.message, 'error');
    }
  };

  // Revertir Canje Erróneo (Exclusivo Dueño 👑)
  const handleRevertirCanje = async (canje) => {
    if (!isDueno) return;
    if (!window.confirm(`¿Revertir y anular el canje de premio de "${canje.nombreCliente}"?\n\n✓ Se devolverán 6 sellos al cliente.\n✓ Se eliminará este registro de auditoría.`)) {
      return;
    }

    try {
      const batch = writeBatch(db);

      // 1. Devolver 6 sellos al cliente
      const clientRef = doc(collections.clientesFidelidad, canje.clienteId || canje.telefono);
      batch.update(clientRef, {
        sellos: increment(6),
        premiosCanjeados: increment(-1),
        updatedAt: serverTimestamp()
      });

      // 2. Eliminar el registro de canje
      const canjeRef = doc(collections.canjesFidelidad, canje.id);
      batch.delete(canjeRef);

      await batch.commit();
      showToast('Canje revertido y 6 sellos devueltos al cliente', 'success');
    } catch (err) {
      console.error('Error al revertir canje:', err);
      showToast('Error al revertir: ' + err.message, 'error');
    }
  };

  // Agregar Sello Manual (+1 Visita)
  const handleAgregarSelloManual = async (cliente) => {
    try {
      const clientRef = doc(collections.clientesFidelidad, cliente.id);
      await updateDoc(clientRef, {
        sellos: increment(1),
        totalVisitas: increment(1),
        ultimaVisita: new Date().toISOString(),
        updatedAt: serverTimestamp()
      });
      showToast(`+1 Sello asignado a ${cliente.nombre || cliente.telefono}`, 'success');
    } catch (err) {
      console.error('Error al agregar sello:', err);
      showToast('Error: ' + err.message, 'error');
    }
  };

  // Eliminar Cliente (Exclusivo Dueño 👑)
  const handleDeleteClient = async (cliente) => {
    if (!isDueno) return;
    if (!window.confirm(`¿Estás seguro de eliminar permanentemente al cliente "${cliente.nombre}" (${cliente.telefono})?`)) {
      return;
    }

    try {
      await deleteDoc(doc(collections.clientesFidelidad, cliente.id));
      if (selectedClient?.id === cliente.id) setSelectedClient(null);
      showToast('Cliente eliminado del programa de fidelidad', 'success');
    } catch (err) {
      console.error('Error al eliminar cliente:', err);
      showToast('Error: ' + err.message, 'error');
    }
  };

  // Abrir Modal de Edición de Cliente (Exclusivo Dueño 👑)
  const handleOpenEditClient = (cliente) => {
    setEditingClient(cliente);
    setEditClientName(cliente.nombre || '');
    setEditClientPhone(cliente.telefono || '');
    setEditClientSellos(cliente.sellos || 0);
    setEditClientBirthday(cliente.cumpleanos || '');
    setEditClientLevel(cliente.nivel || 'Clásico');
  };

  // Guardar Cambios del Cliente
  const handleSaveEditClient = async (e) => {
    e.preventDefault();
    if (!editingClient || !isDueno) return;

    try {
      const cliRef = doc(collections.clientesFidelidad, editingClient.id);
      await updateDoc(cliRef, {
        nombre: editClientName.trim() || 'Cliente Frecuente',
        telefono: editClientPhone.trim(),
        sellos: parseInt(editClientSellos, 10) || 0,
        cumpleanos: editClientBirthday.trim(),
        nivel: editClientLevel,
        editadoPor: perfil.nombre,
        updatedAt: serverTimestamp()
      });

      showToast('Datos del cliente actualizados', 'success');
      setEditingClient(null);
    } catch (err) {
      console.error('Error al editar cliente:', err);
      showToast('Error al editar: ' + err.message, 'error');
    }
  };

  // Crear cliente manualmente
  const handleCreateClient = async (e) => {
    e.preventDefault();
    const phone = newClientPhone.trim().replace(/\D/g, '');
    if (phone.length !== 9) {
      showToast('El teléfono debe tener 9 dígitos', 'error');
      return;
    }

    try {
      const cliRef = doc(collections.clientesFidelidad, phone);
      const newCli = {
        id: phone,
        telefono: phone,
        nombre: newClientName.trim() || 'Cliente Frecuente',
        cumpleanos: newClientBirthday.trim(),
        nivel: newClientLevel || 'Clásico',
        sellos: 1,
        totalVisitas: 1,
        premiosCanjeados: 0,
        totalGastado: 0,
        fechaRegistro: new Date().toISOString(),
        sedeRegistro: SEDES[sede]?.nombre || 'Sede',
        historial: [
          {
            fecha: new Date().toISOString().split('T')[0],
            hora: new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
            descripcion: 'Registro inicial (+1 sello de bienvenida)',
            puntos: 1,
            empleado: perfil?.nombre || 'Colaborador',
            tipo: 'registro'
          }
        ],
        premiosRecibidos: []
      };
      await setDoc(cliRef, newCli);
      setSelectedClient(newCli);
      setShowNewClientModal(false);
      setNewClientPhone('');
      setNewClientName('');
      setNewClientBirthday('');
      setNewClientLevel('Clásico');
      showToast(`¡Cliente ${newCli.nombre} registrado con 1 sello de bienvenida!`, 'success');
    } catch (err) {
      console.error('Error al crear cliente:', err);
      showToast('Error: ' + err.message, 'error');
    }
  };

  return (
    <div className="pb-28 max-w-7xl mx-auto px-4 pt-4">
      {/* Banner Superior */}
      <div className="bg-gradient-to-r from-purple-700 via-brand-600 to-pink-600 rounded-3xl p-6 text-white shadow-lg shadow-purple-900/20 mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-2xl shadow-inner">
              🎁
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-pink-200 bg-white/10 px-2.5 py-0.5 rounded-full border border-white/20">
                  Dolciangel Rewards
                </span>
                {isDueno && (
                  <span className="text-[10px] font-extrabold bg-gold-400 text-slate-950 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                    <Crown className="w-3 h-3" />
                    <span>Modo Dueño</span>
                  </span>
                )}
              </div>
              <h2 className="text-xl md:text-2xl font-serif font-bold mt-1">
                Programa de Clientes & Fidelidad
              </h2>
              <p className="text-xs text-pink-100 mt-0.5">
                Por cada visita o compra acumulan 1 sello • 6 sellos = 1 porción gratis de torta
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowNewClientModal(true)}
            className="px-4 py-2.5 rounded-xl bg-gold-500 hover:bg-gold-600 text-slate-950 font-extrabold text-xs shadow-md transition-all active:scale-95 flex items-center gap-1.5 self-start md:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>+ Nuevo Cliente</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna Izquierda: Buscador y Lista de Clientes */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-4 border border-pink-100 shadow-sm">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
              Buscar Cliente por Teléfono o Nombre
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchPhone}
                onChange={(e) => setSearchPhone(e.target.value)}
                placeholder="Ingresa 9 dígitos o nombre..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs font-bold focus:outline-none focus:border-brand-500 bg-slate-50"
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-pink-100 shadow-sm overflow-hidden">
            <div className="p-3 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 flex justify-between items-center">
              <span>Clientes ({filteredClients.length})</span>
              <span>Sellos</span>
            </div>
            <div className="divide-y divide-slate-100 max-h-[460px] overflow-y-auto">
              {filteredClients.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  No se encontraron clientes registrados
                </div>
              ) : (
                filteredClients.map((cli) => {
                  const isSelected = selectedClient?.id === cli.id;
                  const sellosCount = cli.sellos || 0;
                  const canRedeem = sellosCount >= 6;

                  return (
                    <button
                      key={cli.id}
                      onClick={() => setSelectedClient(cli)}
                      className={`w-full p-3 text-left transition-colors flex items-center justify-between text-xs ${
                        isSelected ? 'bg-pink-50/80 font-bold border-l-4 border-brand-600' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs flex-shrink-0">
                          {cli.nombre ? cli.nombre.charAt(0).toUpperCase() : 'C'}
                        </div>
                        <div className="min-w-0">
                          <span className="font-bold text-slate-900 block truncate">
                            {cli.nombre || 'Cliente Frecuente'}
                          </span>
                          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                            <span className="text-[11px] text-slate-500 font-mono">
                              {cli.telefono}
                            </span>
                            {cli.cumpleanos && (
                              <span className="text-[10px] bg-pink-100 text-pink-700 font-bold px-1.5 py-0.2 rounded-md flex items-center gap-0.5">
                                🎂 {cli.cumpleanos}
                              </span>
                            )}
                            {cli.nivel && cli.nivel.toLowerCase() !== 'clásico' && (
                              <span className="text-[9px] bg-amber-100 text-amber-800 font-extrabold px-1.5 py-0.2 rounded-md uppercase">
                                {cli.nivel}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        {canRedeem && (
                          <span className="text-[10px] font-extrabold bg-gold-400/20 text-gold-700 border border-gold-400/40 px-1.5 py-0.2 rounded-full animate-pulse">
                            ¡Premio!
                          </span>
                        )}
                        <span className={`font-extrabold text-sm px-2 py-0.5 rounded-lg ${
                          canRedeem ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {sellosCount}/6
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Columna Derecha / Central: Tarjeta Digital de Fidelidad & Canje */}
        <div className="lg:col-span-2 space-y-6">
          {selectedClient ? (
            <div className="bg-white rounded-3xl p-6 border border-pink-200 shadow-md relative overflow-hidden">
              <div className="absolute top-0 right-0 w-36 h-36 bg-gradient-to-bl from-pink-100 to-transparent rounded-full -mr-10 -mt-10 pointer-events-none" />

              {/* Encabezado del Cliente con Nombre Completo y Cumpleaños */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-purple-700 bg-purple-100 px-3 py-0.5 rounded-full border border-purple-200">
                      Tarjeta de Fidelidad Activa
                    </span>
                    {selectedClient.nivel && (
                      <span className="text-xs font-extrabold uppercase bg-amber-100 text-amber-900 border border-amber-200 px-2.5 py-0.5 rounded-full">
                        Nivel {selectedClient.nivel}
                      </span>
                    )}
                  </div>

                  <h3 className="text-2xl font-serif font-bold text-slate-900 mt-1">
                    {selectedClient.nombre || 'Cliente Frecuente'}
                  </h3>

                  <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                    <span className="flex items-center gap-1 font-mono font-bold text-slate-700">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      {selectedClient.telefono}
                    </span>
                    <span>•</span>
                    <span className="font-semibold text-brand-700 flex items-center gap-1">
                      🎂 Cumpleaños: {selectedClient.cumpleanos || 'No registrado'}
                    </span>
                    <span>•</span>
                    <span>Registrado en {selectedClient.sedeRegistro || 'Dolciangel'}</span>
                  </div>
                </div>

                {/* Acciones principales de la tarjeta */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* BOTÓN VER HISTORIAL */}
                  <button
                    onClick={() => setShowHistoryModal(true)}
                    className="px-3.5 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 font-extrabold text-xs border border-purple-200 transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>📜 Ver Historial</span>
                  </button>

                  {/* +1 Sello */}
                  <button
                    onClick={() => handleAgregarSelloManual(selectedClient)}
                    className="px-3 py-2 rounded-xl bg-pink-50 hover:bg-pink-100 text-brand-700 font-bold text-xs border border-pink-200 transition-all flex items-center gap-1 shadow-sm active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+1 Sello</span>
                  </button>

                  {/* ACCIONES EXCLUSIVAS DEL DUEÑO 👑 */}
                  {isDueno && (
                    <>
                      <button
                        onClick={() => handleOpenEditClient(selectedClient)}
                        title="Editar cliente (Solo Dueño)"
                        className="p-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition-all shadow-sm"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteClient(selectedClient)}
                        title="Eliminar cliente (Solo Dueño)"
                        className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-all shadow-sm"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Los 6 Sellos Visuales */}
              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 mb-6">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Sellos Acumulados: {selectedClient.sellos || 0} de 6
                  </span>
                  <span className="text-xs font-extrabold text-brand-700">
                    {selectedClient.sellos >= 6 ? '¡Completado para canjear!' : `Faltan ${6 - (selectedClient.sellos || 0)} sellos`}
                  </span>
                </div>

                <div className="grid grid-cols-6 gap-2 sm:gap-3">
                  {[1, 2, 3, 4, 5, 6].map((num) => {
                    const isStamped = (selectedClient.sellos || 0) >= num;
                    const isPrizeSlot = num === 6;

                    return (
                      <div
                        key={num}
                        className={`aspect-square rounded-2xl flex flex-col items-center justify-center p-2 text-center transition-all ${
                          isStamped
                            ? 'bg-gradient-to-tr from-brand-700 to-pink-500 text-white shadow-md shadow-brand-500/30 scale-105'
                            : isPrizeSlot
                            ? 'bg-gold-50 border-2 border-dashed border-gold-400 text-gold-700'
                            : 'bg-white border-2 border-dashed border-slate-200 text-slate-300'
                        }`}
                      >
                        <span className="text-xl sm:text-2xl mb-1">
                          {isStamped ? (isPrizeSlot ? '🎁' : '🧁') : isPrizeSlot ? '🎁' : '⭕'}
                        </span>
                        <span className={`text-[10px] font-bold ${isStamped ? 'text-white' : 'text-slate-400'}`}>
                          {num === 6 ? '¡Premio!' : `Sello ${num}`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Botón de Canje de Premio */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-pink-50 border border-amber-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gold-500 text-slate-950 flex items-center justify-center text-xl shadow-sm">
                    🎁
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">Canje de Porción Gratis</h4>
                    <p className="text-xs text-slate-500">
                      Válido para 1 porción de torta, cheesecake o pie a elección en vitrina.
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleCanjearPremio}
                  disabled={(selectedClient.sellos || 0) < 6}
                  className={`px-5 py-3 rounded-xl font-extrabold text-xs shadow-md transition-all flex items-center gap-2 whitespace-nowrap active:scale-95 ${
                    (selectedClient.sellos || 0) >= 6
                      ? 'bg-gradient-to-r from-gold-500 to-amber-600 text-slate-950 shadow-gold-500/30 cursor-pointer animate-pulse'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <Award className="w-4 h-4" />
                  <span>🎁 Canjear Premio Ahora</span>
                </button>
              </div>

              {/* Estadísticas históricas del cliente */}
              <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-100 text-center text-xs">
                <div>
                  <span className="text-slate-400 block">Total Visitas:</span>
                  <span className="font-extrabold text-slate-800 text-sm">{selectedClient.totalVisitas || 0}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Premios Canjeados:</span>
                  <span className="font-extrabold text-purple-700 text-sm">{selectedClient.premiosCanjeados || 0}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Total Consumido:</span>
                  <span className="font-extrabold text-brand-700 text-sm">
                    S/ {(selectedClient.totalGastado || 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-3xl p-10 border border-pink-100 shadow-sm text-center">
              <div className="w-16 h-16 rounded-full bg-pink-50 text-brand-700 mx-auto flex items-center justify-center text-3xl mb-3">
                🎁
              </div>
              <h3 className="font-serif font-bold text-lg text-slate-800">
                Selecciona un cliente de la lista o busca por número
              </h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Ingresa el celular del cliente para ver sus sellos acumulados y autorizar canjes de premios.
              </p>
            </div>
          )}

          {/* Historial de Canjes Auditados */}
          <div className="bg-white rounded-2xl border border-pink-100 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-purple-600" />
                <span>Auditoría de Canjes Realizados</span>
              </h4>
              <span className="text-xs text-slate-400">{canjesAuditados.length} canjes</span>
            </div>

            <div className="p-3 divide-y divide-slate-100 max-h-[240px] overflow-y-auto">
              {canjesAuditados.length === 0 ? (
                <p className="text-center text-xs text-slate-400 py-4">
                  No hay canjes registrados recientemente
                </p>
              ) : (
                canjesAuditados.map((canje) => (
                  <div key={canje.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-slate-900 block">
                        {canje.nombreCliente} ({canje.telefono})
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {canje.premio} • Por {canje.canjeadoPor} en {canje.sedeNombre}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400">
                        {canje.fecha ? new Date(canje.fecha).toLocaleDateString('es-PE') : ''}
                      </span>

                      {/* Botón Revertir (Solo Dueño 👑) */}
                      {isDueno && (
                        <button
                          onClick={() => handleRevertirCanje(canje)}
                          title="Revertir canje y devolver sellos (Solo Dueño)"
                          className="p-1 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-600"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MODAL: VER HISTORIAL DE CONSUMO Y PREMIOS DEL CLIENTE */}
      {showHistoryModal && selectedClient && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 shadow-2xl border border-pink-100 w-full max-w-xl max-h-[90vh] flex flex-col">
            {/* Encabezado del Modal */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-purple-700 bg-purple-100 px-2.5 py-0.5 rounded-full">
                    Historial del Cliente
                  </span>
                  {selectedClient.nivel && (
                    <span className="text-xs font-extrabold uppercase bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full">
                      {selectedClient.nivel}
                    </span>
                  )}
                </div>
                <h3 className="font-serif font-bold text-xl text-slate-900 mt-1">
                  {selectedClient.nombre || 'Cliente Frecuente'}
                </h3>
                <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                  <span className="font-mono font-bold text-slate-700">📱 {selectedClient.telefono}</span>
                  <span>•</span>
                  <span className="text-pink-600 font-bold">🎂 Cumpleaños: {selectedClient.cumpleanos || 'No registrado'}</span>
                </div>
              </div>

              <button
                onClick={() => setShowHistoryModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Resumen rápido de métricas del cliente */}
            <div className="grid grid-cols-3 gap-2 py-3 border-b border-slate-100 text-center text-xs">
              <div className="bg-purple-50/60 p-2 rounded-xl">
                <span className="text-slate-500 text-[10px] block">Sellos Actuales</span>
                <span className="text-base font-extrabold text-purple-700">{selectedClient.sellos || 0} / 6</span>
              </div>
              <div className="bg-brand-50/60 p-2 rounded-xl">
                <span className="text-slate-500 text-[10px] block">Visitas Registradas</span>
                <span className="text-base font-extrabold text-brand-700">{selectedClient.totalVisitas || 0}</span>
              </div>
              <div className="bg-amber-50/60 p-2 rounded-xl">
                <span className="text-slate-500 text-[10px] block">Premios Canjeados</span>
                <span className="text-base font-extrabold text-amber-800">{selectedClient.premiosCanjeados || 0}</span>
              </div>
            </div>

            {/* Contenido con Scroll: Historial de Visitas y Premios */}
            <div className="flex-1 overflow-y-auto py-4 space-y-4">
              {/* Sección 1: Visitas / Puntos */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-brand-600" />
                  <span>Historial de Visitas & Puntos ({Array.isArray(selectedClient.historial) ? selectedClient.historial.length : 0})</span>
                </h4>

                {Array.isArray(selectedClient.historial) && selectedClient.historial.length > 0 ? (
                  <div className="space-y-2">
                    {selectedClient.historial.map((item, idx) => (
                      <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                        <div>
                          <span className="font-bold text-slate-900 block">
                            {item.descripcion || '+1 punto por postre'}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            Atendido por: {item.empleado || 'Colaborador'} {item.nivel ? `• Nivel ${item.nivel}` : ''}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-extrabold text-emerald-700 block">
                            +{item.puntos || 1} pt.
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {item.fecha} {item.hora ? `• ${item.hora}` : ''}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 bg-slate-50 rounded-xl text-center text-xs text-slate-400">
                    No hay visitas detalladas en el historial previo de este cliente
                  </div>
                )}
              </div>

              {/* Sección 2: Premios Recibidos */}
              {Array.isArray(selectedClient.premiosRecibidos) && selectedClient.premiosRecibidos.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5 text-gold-500" />
                    <span>Premios Reclamados ({selectedClient.premiosRecibidos.length})</span>
                  </h4>
                  <div className="space-y-2">
                    {selectedClient.premiosRecibidos.map((pr, idx) => (
                      <div key={idx} className="p-3 rounded-xl bg-amber-50/60 border border-amber-100 flex items-center justify-between text-xs">
                        <div>
                          <span className="font-bold text-amber-950 block">
                            {pr.premio || pr.descripcion || '1 Porción de Torta Gratis'}
                          </span>
                          <span className="text-[11px] text-amber-800">
                            Entregado por: {pr.empleado || 'Dolciangel'}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {pr.fecha}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors"
              >
                Cerrar Historial
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Editar Cliente (Solo Dueño 👑) */}
      {editingClient && isDueno && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 shadow-2xl border border-pink-100 w-full max-w-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-serif font-bold text-lg text-slate-900 flex items-center gap-2">
                <Crown className="w-4 h-4 text-gold-500" />
                <span>Editar Cliente</span>
              </h3>
              <button onClick={() => setEditingClient(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditClient} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Nombre Completo</label>
                <input
                  type="text"
                  value={editClientName}
                  onChange={(e) => setEditClientName(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Teléfono (9 dígitos)</label>
                <input
                  type="tel"
                  maxLength={9}
                  value={editClientPhone}
                  onChange={(e) => setEditClientPhone(e.target.value.replace(/\D/g, ''))}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono font-bold focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Cumpleaños (ej. 04-01 o 15/05)</label>
                <input
                  type="text"
                  value={editClientBirthday}
                  onChange={(e) => setEditClientBirthday(e.target.value)}
                  placeholder="DD-MM"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Nivel del Cliente</label>
                <select
                  value={editClientLevel}
                  onChange={(e) => setEditClientLevel(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-brand-500"
                >
                  <option value="Clásico">Clásico</option>
                  <option value="Black">Black</option>
                  <option value="Gold">Gold</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Sellos Acumulados (0 a 6)</label>
                <input
                  type="number"
                  min={0}
                  max={6}
                  value={editClientSellos}
                  onChange={(e) => setEditClientSellos(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold text-purple-700 focus:outline-none focus:border-brand-500"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Ajuste manual de sellos acumulados
                </span>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingClient(null)}
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

      {/* Modal: Crear Nuevo Cliente */}
      {showNewClientModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 shadow-2xl border border-pink-100 w-full max-w-sm">
            <h3 className="font-serif font-bold text-lg text-slate-900">
              Nuevo Cliente de Fidelidad
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Registra al cliente para empezar a acumular sellos de porciones gratis.
            </p>

            <form onSubmit={handleCreateClient} className="mt-4 space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Número de Celular (9 dígitos) *
                </label>
                <input
                  type="tel"
                  maxLength={9}
                  value={newClientPhone}
                  onChange={(e) => setNewClientPhone(e.target.value.replace(/\D/g, ''))}
                  placeholder="9XXXXXXXX"
                  required
                  autoFocus
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Nombre Completo del Cliente
                </label>
                <input
                  type="text"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  placeholder="Ej. Valeria Mendoza"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Cumpleaños (Opcional, ej. 04-01)
                </label>
                <input
                  type="text"
                  value={newClientBirthday}
                  onChange={(e) => setNewClientBirthday(e.target.value)}
                  placeholder="DD-MM"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewClientModal(false)}
                  className="flex-1 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-brand-700 hover:bg-brand-800 text-white font-bold text-xs shadow-md shadow-brand-700/20"
                >
                  Registrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
