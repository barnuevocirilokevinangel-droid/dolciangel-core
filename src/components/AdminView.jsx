import React, { useState } from 'react';
import { useApp, SEDES, PERFILES } from '../context/AppContext';
import { runLegacyMigration, resyncLegacyClients } from '../services/migration';
import { AdminProductManager } from './AdminProductManager';
import { GestorHeroView } from './GestorHeroView';
import { 
  Settings, 
  Database, 
  Download, 
  RotateCcw, 
  Store, 
  Users, 
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Layers,
  Cake,
  Crown,
  Sliders,
  Globe
} from 'lucide-react';

export const AdminView = ({ onOpenSwitchModal }) => {
  const { 
    sede, 
    perfil, 
    productos, 
    ventas, 
    kardex, 
    clientesFidelidad, 
    movimientosCaja,
    seedInitialProducts,
    showToast 
  } = useApp();

  const isDueno = perfil?.isDueno ?? false;
  const [activeTab, setActiveTab] = useState(isDueno ? 'catalogo' : 'sistema');
  const [isSeeding, setIsSeeding] = useState(false);

  // Estados para la Herramienta de Migración
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState(0);
  const [migrationStatusMsg, setMigrationStatusMsg] = useState('');
  const [migrationReport, setMigrationReport] = useState(null);

  // Sembrar catálogo base
  const handleSeed = async () => {
    if (!window.confirm('¿Deseas poblar o sincronizar el catálogo inicial completo de Dolciangel con Firestore?')) {
      return;
    }
    setIsSeeding(true);
    try {
      await seedInitialProducts();
    } finally {
      setIsSeeding(false);
    }
  };

  // Ejecutar Migración de Datos Históricos
  const handleRunMigration = async () => {
    const confirmPrompt = '¿Deseas iniciar la migración de datos anteriores de Dolciangel?\n\n' +
      '• Se escanearán las colecciones anteriores ("clientes", "clientes-VE", "productos-BA", "productos-VE", "locales/*/historial" y "finanzas-angel-gastos").\n' +
      '• Se migrarán a las colecciones unificadas ("clientes_fidelidad", "productos", "movimientos_caja").\n' +
      '• El sistema verifica duplicados de forma inteligente para no sobreescribir datos existentes.';

    if (!window.confirm(confirmPrompt)) return;

    setIsMigrating(true);
    setMigrationProgress(5);
    setMigrationStatusMsg('Iniciando analizador de colecciones...');
    setMigrationReport(null);

    try {
      const stats = await runLegacyMigration((progress, msg) => {
        setMigrationProgress(progress);
        setMigrationStatusMsg(msg);
      });

      setMigrationReport(stats);
      showToast('¡Migración histórica completada con éxito!', 'success');
    } catch (err) {
      console.error('Error durante la migración:', err);
      showToast('Error en la migración: ' + err.message, 'error');
    } finally {
      setIsMigrating(false);
    }
  };

  // Re-sincronizar Nombres Completos y Cumpleaños de Clientes
  const handleResyncClients = async () => {
    const confirmPrompt = '¿Deseas re-sincronizar y corregir los nombres completos y fechas de cumpleaños de todos los clientes?\n\n' +
      '• Escanea "clientes" (Buenos Aires) y "clientes-VE" (Villa España).\n' +
      '• Rescata nombres completos compuestos (ej. Paul Goicochea) y fechas de cumpleaños (ej. 04-01).\n' +
      '• Usa { merge: true } preservando intactos todos los sellos y visitas acumuladas.';

    if (!window.confirm(confirmPrompt)) return;

    setIsMigrating(true);
    setMigrationProgress(5);
    setMigrationStatusMsg('Re-sincronizando clientes y fechas de cumpleaños...');
    setMigrationReport(null);

    try {
      const stats = await resyncLegacyClients((progress, msg) => {
        setMigrationProgress(progress);
        setMigrationStatusMsg(msg);
      });
      showToast(`¡Clientes enriquecidos! ${stats.actualizados} registros actualizados.`, 'success');
    } catch (err) {
      console.error('Error al re-sincronizar clientes:', err);
      showToast('Error: ' + err.message, 'error');
    } finally {
      setIsMigrating(false);
    }
  };

  // Exportar backup local JSON
  const handleExportJSON = () => {
    const backupData = {
      exportDate: new Date().toISOString(),
      sedeActiva: sede,
      perfilActivo: perfil?.nombre,
      totales: {
        productos: productos.length,
        ventas: ventas.length,
        kardex: kardex.length,
        clientesFidelidad: clientesFidelidad.length,
        movimientosCaja: movimientosCaja.length
      },
      productos,
      ventas,
      kardex,
      clientesFidelidad,
      movimientosCaja
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dolciangel-backup-${sede}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Backup JSON descargado exitosamente');
  };

  return (
    <div className="pb-28 max-w-7xl mx-auto px-4 pt-4 space-y-6">
      {/* Banner Superior con Selector de Sub-Pestañas */}
      <div className="bg-gradient-to-r from-slate-900 via-brand-900 to-pink-900 rounded-3xl p-6 text-white shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center text-2xl shadow-inner">
              ⚙️
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-pink-300 bg-white/10 px-2.5 py-0.5 rounded-full border border-white/20">
                Panel Central
              </span>
              <h2 className="text-xl md:text-2xl font-serif font-bold mt-1">
                Administración & Catálogo
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Control de rentabilidad, catálogo de sedes y migración de datos de Dolciangel Core
              </p>
            </div>
          </div>

          {/* Sub-Pestañas de Navegación Admin */}
          <div className="flex flex-wrap items-center gap-1.5 bg-black/30 p-1.5 rounded-2xl border border-white/10 text-xs">
            <button
              onClick={() => setActiveTab('catalogo')}
              className={`px-3.5 py-2 rounded-xl font-bold flex items-center gap-1.5 transition-all ${
                activeTab === 'catalogo'
                  ? 'bg-gradient-to-r from-gold-400 to-amber-500 text-slate-950 shadow-md font-extrabold'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <Crown className="w-3.5 h-3.5 text-amber-900" />
              <span>Catálogo & Rentabilidad</span>
            </button>
            <button
              onClick={() => setActiveTab('web')}
              className={`px-3.5 py-2 rounded-xl font-bold flex items-center gap-1.5 transition-all ${
                activeTab === 'web'
                  ? 'bg-gradient-to-r from-amber-400 via-rose-500 to-pink-600 text-white shadow-md font-extrabold'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <Globe className="w-3.5 h-3.5 text-amber-200" />
              <span>🖥️ Web Principal</span>
            </button>
            <button
              onClick={() => setActiveTab('sistema')}
              className={`px-3.5 py-2 rounded-xl font-bold flex items-center gap-1.5 transition-all ${
                activeTab === 'sistema'
                  ? 'bg-white text-slate-900 shadow-md font-extrabold'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <Sliders className="w-3.5 h-3.5 text-pink-500" />
              <span>Sistema & Migración</span>
            </button>
          </div>
        </div>
      </div>

      {/* Contenido según pestaña */}
      {activeTab === 'web' ? (
        <GestorHeroView />
      ) : activeTab === 'catalogo' ? (
        isDueno ? (
          <AdminProductManager />
        ) : (
          <div className="bg-white rounded-3xl p-10 border border-pink-100 shadow-sm text-center max-w-lg mx-auto space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-pink-50 text-brand-600 flex items-center justify-center text-3xl mx-auto">
              👑
            </div>
            <div>
              <h3 className="text-lg font-serif font-bold text-slate-900">
                Acceso Exclusivo para el Dueño
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                La gestión de costos, análisis de rentabilidad y edición de precios por sede está reservada únicamente para el perfil de <strong>Angel (Dueño)</strong>.
              </p>
            </div>
            <button
              onClick={onOpenSwitchModal}
              className="px-5 py-2.5 rounded-xl bg-brand-700 text-white font-bold text-xs hover:bg-brand-800 transition-all inline-flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Cambiar a Perfil Dueño</span>
            </button>
          </div>
        )
      ) : (
        <>
          {/* SECCIÓN DESTACADA: HERRAMIENTA DE MIGRACIÓN DE BASE DE DATOS */}
          <div className="bg-gradient-to-br from-purple-900 via-brand-900 to-pink-950 rounded-3xl p-6 text-white shadow-xl border-2 border-gold-400/30 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-brand-500/20 to-transparent rounded-full -mr-20 -mt-20 pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gold-400 text-slate-950 flex items-center justify-center text-2xl shadow-md">
              🔄
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-gold-300 bg-white/10 px-3 py-0.5 rounded-full border border-gold-400/30 inline-block">
                Firebase Migration Tool
              </span>
              <h3 className="text-xl font-serif font-bold mt-1">
                Herramienta de Migración de Base de Datos
              </h3>
              <p className="text-xs text-pink-200 mt-0.5 max-w-xl">
                Escanea de forma no destructiva las colecciones históricas previas (clientes, inventario de locales y gastos) y las unifica en el formato profesional de Dolciangel Core, verificando duplicados.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 self-start md:self-auto">
            <button
              onClick={handleResyncClients}
              disabled={isMigrating}
              className="px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white font-extrabold text-xs border border-white/20 active:scale-95 transition-all flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <Cake className="w-4 h-4 text-pink-300" />
              <span>Rescatar Nombres & Cumpleaños</span>
            </button>

            <button
              onClick={handleRunMigration}
              disabled={isMigrating}
              className="px-5 py-3 rounded-2xl bg-gradient-to-r from-gold-400 to-amber-500 hover:from-gold-300 hover:to-amber-400 disabled:opacity-50 text-slate-950 font-black text-xs shadow-lg shadow-gold-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <RefreshCw className={`w-4 h-4 ${isMigrating ? 'animate-spin' : ''}`} />
              <span>{isMigrating ? 'Sincronizando...' : '🔄 Migración Completa'}</span>
            </button>
          </div>
        </div>

        {/* Barra de Progreso Activa */}
        {isMigrating && (
          <div className="bg-black/30 backdrop-blur rounded-2xl p-4 border border-white/15 my-4 space-y-2">
            <div className="flex justify-between items-center text-xs font-bold">
              <span className="text-pink-200 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-gold-400 animate-ping" />
                {migrationStatusMsg}
              </span>
              <span className="text-gold-300 font-mono text-sm">{migrationProgress}%</span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden p-0.5">
              <div 
                className="bg-gradient-to-r from-pink-500 via-rose-400 to-gold-400 h-full rounded-full transition-all duration-300"
                style={{ width: `${migrationProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Reporte de Migración Exitoso */}
        {migrationReport && (
          <div className="bg-white/10 backdrop-blur rounded-2xl p-4 border border-gold-400/40 my-3 animate-fadeIn text-xs">
            <div className="flex items-center gap-2 text-gold-300 font-bold mb-2">
              <CheckCircle className="w-4 h-4" />
              <span>Resultados de la Migración Histórica:</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                <span className="text-pink-200 block">Clientes de Fidelidad:</span>
                <span className="text-base font-extrabold text-white">
                  +{migrationReport.clientesMigrados} agregados
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  ({migrationReport.clientesOmitidos} omitidos por ya existir)
                </span>
              </div>
              <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                <span className="text-pink-200 block">Productos & Carta:</span>
                <span className="text-base font-extrabold text-white">
                  +{migrationReport.productosMigrados} agregados
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  ({migrationReport.productosOmitidos} omitidos por ya existir)
                </span>
              </div>
              <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                <span className="text-pink-200 block">Movimientos & Gastos:</span>
                <span className="text-base font-extrabold text-white">
                  +{migrationReport.movimientosMigrados} agregados
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  ({migrationReport.movimientosOmitidos} omitidos por ya existir)
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Grid de Paneles de Configuración */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Tarjeta 1: Sede y Sesión Activa */}
        <div className="bg-white rounded-3xl p-6 border border-pink-100 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 text-brand-700 font-bold text-sm">
            <Store className="w-5 h-5" />
            <span>Sede & Colaborador en Turno</span>
          </div>

          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-xs space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-semibold">Sede en operación:</span>
              <span className="font-extrabold text-slate-800 text-sm">
                {SEDES[sede]?.nombre} ({SEDES[sede]?.ciudad})
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-semibold">Perfil activo:</span>
              <span className="font-bold text-slate-800 flex items-center gap-1">
                <span>{perfil?.avatar}</span>
                <span>{perfil?.nombre}</span>
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-semibold">Rol del perfil:</span>
              <span className="font-semibold text-slate-600">{perfil?.rol}</span>
            </div>
          </div>

          <button
            onClick={onOpenSwitchModal}
            className="w-full py-2.5 rounded-xl bg-pink-50 hover:bg-pink-100 text-brand-800 font-bold text-xs border border-pink-200 transition-all flex items-center justify-center gap-1.5"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Cambiar de Local o de Usuario</span>
          </button>
        </div>

        {/* Tarjeta 2: Catálogo y Siembra en Firestore */}
        <div className="bg-white rounded-3xl p-6 border border-pink-100 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 text-brand-700 font-bold text-sm">
            <Database className="w-5 h-5" />
            <span>Catálogo Inicial & Firestore</span>
          </div>

          <p className="text-xs text-slate-500">
            Sincroniza y puebla automáticamente las 8 categorías principales (Tortas, Cheesecakes, Pies, Kekes, Bocados, Jugos, Cafés, Otros) con sus precios e inventario inicial.
          </p>

          <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200 flex items-center justify-between text-xs">
            <span className="text-slate-600">Productos en Firestore:</span>
            <span className="font-extrabold text-brand-700 text-sm">
              {productos.length} ítems
            </span>
          </div>

          <button
            onClick={handleSeed}
            disabled={isSeeding}
            className="w-full py-2.5 rounded-xl bg-brand-700 hover:bg-brand-800 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-brand-700/20 transition-all flex items-center justify-center gap-1.5"
          >
            {isSeeding ? '⏳ Sembrando...' : '🌱 Sembrar / Actualizar Catálogo Inicial'}
          </button>
        </div>

        {/* Tarjeta 3: Copias de Respaldo */}
        <div className="bg-white rounded-3xl p-6 border border-pink-100 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 text-brand-700 font-bold text-sm">
            <Download className="w-5 h-5" />
            <span>Respaldo de Datos (Backup JSON)</span>
          </div>

          <p className="text-xs text-slate-500">
            Descarga una copia completa en formato JSON con todas las ventas, inventario, kardex, caja y clientes de fidelidad registrados.
          </p>

          <button
            onClick={handleExportJSON}
            className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-1.5"
          >
            <Download className="w-4 h-4" />
            <span>Descargar Backup JSON Completo</span>
          </button>
        </div>

        {/* Tarjeta 4: Perfiles y PINes del Sistema */}
        <div className="bg-white rounded-3xl p-6 border border-pink-100 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 text-brand-700 font-bold text-sm">
            <Users className="w-5 h-5" />
            <span>Colaboradores & PINes de Acceso</span>
          </div>

          <div className="divide-y divide-slate-100 text-xs">
            {PERFILES.map((p) => (
              <div key={p.id} className="py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span>{p.avatar}</span>
                  <div>
                    <span className="font-bold text-slate-800 block">{p.nombre}</span>
                    <span className="text-[11px] text-slate-400">{p.rol}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block font-mono">PIN Inicial:</span>
                  <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-lg">
                    {p.defaultPin}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      </>
      )}
    </div>
  );
};
