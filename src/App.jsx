import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { LoginModal } from './components/LoginModal';
import { VentasView } from './components/VentasView';
import { CartaWebView } from './components/CartaWebView';
import { CajaView } from './components/CajaView';
import { FidelidadView } from './components/FidelidadView';
import { KardexView } from './components/KardexView';
import { ResumenView } from './components/ResumenView';
import { StatsView } from './components/StatsView';
import { HistorialGlobalView } from './components/HistorialGlobalView';
import { AdminView } from './components/AdminView';
import { GestorHeroView } from './components/GestorHeroView';
import { AlertCircle, CheckCircle, Info } from 'lucide-react';

const MainLayout = () => {
  const { 
    sede, 
    perfil, 
    activeTab, 
    productos, 
    seedInitialProducts, 
    toast 
  } = useApp();

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isSwitchModalOpen, setIsSwitchModalOpen] = useState(false);

  // Auto-siembra de catálogo inicial si la base de datos está vacía al cargar
  useEffect(() => {
    if (productos.length === 0) {
      // Pequeño timeout para no interferir con la primera lectura de Firestore
      const timer = setTimeout(() => {
        if (productos.length === 0) {
          seedInitialProducts();
        }
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [productos.length]);

  const isAuthModalOpen = (!sede || !perfil) || isSwitchModalOpen;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col selection:bg-brand-500 selection:text-white">
      {/* Modal de Inicio / Cambio de Sede y Perfil */}
      <LoginModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsSwitchModalOpen(false)}
        canClose={Boolean(sede && perfil)}
      />

      {/* Cabecera Principal */}
      <Header 
        onOpenCart={() => setIsCartOpen(true)}
        onOpenSwitchModal={() => setIsSwitchModalOpen(true)}
      />

      {/* Contenido Dinámico de la Pestaña Activa */}
      <main className="flex-1">
        {activeTab === 'ventas' && (
          <VentasView 
            isCartOpen={isCartOpen} 
            setIsCartOpen={setIsCartOpen} 
          />
        )}
        {activeTab === 'inventario' && <KardexView />}
        {activeTab === 'caja' && <CajaView />}
        {activeTab === 'resumen' && <ResumenView />}
        {activeTab === 'stats' && <StatsView />}
        {activeTab === 'fidelidad' && <FidelidadView />}
        {(activeTab === 'historial' || activeTab === 'comandas') && (
          <HistorialGlobalView />
        )}
        {activeTab === 'carta' && <CartaWebView />}
        {activeTab === 'web' && <GestorHeroView />}
        {activeTab === 'admin' && (
          <AdminView onOpenSwitchModal={() => setIsSwitchModalOpen(true)} />
        )}
      </main>

      {/* Barra de Navegación Inferior Fija */}
      <BottomNav />

      {/* Toast Notificaciones Flotantes */}
      {toast && (
        <div className="fixed top-16 right-4 z-50 animate-bounceOnce max-w-sm">
          <div className={`p-3.5 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-bold border backdrop-blur-md ${
            toast.type === 'error'
              ? 'bg-rose-600 text-white border-rose-500 shadow-rose-600/30'
              : toast.type === 'warning'
              ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-amber-500/30'
              : toast.type === 'info'
              ? 'bg-slate-800 text-white border-slate-700 shadow-slate-800/30'
              : 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-600/30'
          }`}>
            {toast.type === 'error' ? <AlertCircle className="w-4 h-4" /> :
             toast.type === 'warning' ? <AlertCircle className="w-4 h-4" /> :
             toast.type === 'info' ? <Info className="w-4 h-4" /> :
             <CheckCircle className="w-4 h-4" />}
            <span>{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainLayout />
    </AppProvider>
  );
}
