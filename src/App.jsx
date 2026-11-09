import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { LoginModal } from './components/LoginModal';
import { ProtectedRoute } from './components/ProtectedRoute';
import { VentasView } from './components/VentasView';
import { CartaWebView } from './components/CartaWebView';
import { PublicCartaView } from './components/PublicCartaView';
import { LandingPageView } from './components/LandingPageView';
import { CajaView } from './components/CajaView';
import { FidelidadView } from './components/FidelidadView';
import { KardexView } from './components/KardexView';
import { ResumenView } from './components/ResumenView';
import { StatsView } from './components/StatsView';
import { HistorialGlobalView } from './components/HistorialGlobalView';
import { AdminView } from './components/AdminView';
import { GestorHeroView } from './components/GestorHeroView';
import { AlertCircle, CheckCircle, Info } from 'lucide-react';

export const resolveCurrentRoute = () => {
  if (typeof window === 'undefined') return 'landing';

  const hostname = window.location.hostname.toLowerCase();
  // 1. Detección automática del host exclusivo del Core/POS
  if (hostname === 'core.dolciangel.com' || hostname.startsWith('core.') || hostname.startsWith('admin.')) {
    return 'core';
  }

  const pathname = window.location.pathname.toLowerCase();
  const hash = window.location.hash.toLowerCase();
  const search = window.location.search.toLowerCase();

  // 2. Ruta /core o /admin -> Punto de Venta (POS) y panel de gestión protegido por PIN
  if (
    pathname.startsWith('/core') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/pos') ||
    pathname.startsWith('/sistema') ||
    hash.startsWith('#/core') ||
    hash.startsWith('#/admin') ||
    hash.startsWith('#/pos') ||
    hash.startsWith('#core') ||
    hash.startsWith('#admin') ||
    search.includes('route=core') ||
    search.includes('route=admin')
  ) {
    return 'core';
  }

  // 3. Ruta /carta -> Carta digital pública para clientes
  if (
    pathname.startsWith('/carta') ||
    hash.startsWith('#/carta') ||
    hash.startsWith('#carta') ||
    search.includes('route=carta')
  ) {
    return 'carta';
  }

  // 4. Ruta '/' por defecto -> Landing page pública de presentación
  return 'landing';
};

const MainLayout = ({ onNavigate }) => {
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
      const timer = setTimeout(() => {
        if (productos.length === 0) {
          seedInitialProducts();
        }
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [productos.length]);

  // SEGURIDAD: Si no está autenticado, bloqueo estricto con pantalla de PIN antes de mostrar POS o inventario
  if (!sede || !perfil) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4">
        <LoginModal 
          isOpen={true} 
          onClose={() => {}}
          canClose={false}
        />
        <div className="fixed bottom-6 z-50 text-center">
          <button
            onClick={() => onNavigate && onNavigate('landing')}
            className="text-xs text-slate-400 hover:text-white underline font-semibold transition-colors"
          >
            ← Volver a la página web pública
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col selection:bg-brand-500 selection:text-white">
      {/* Modal de Cambio de Sede y Perfil cuando ya está autenticado */}
      <LoginModal 
        isOpen={isSwitchModalOpen} 
        onClose={() => setIsSwitchModalOpen(false)}
        canClose={true}
      />

      {/* Cabecera Principal */}
      <Header 
        onOpenCart={() => setIsCartOpen(true)}
        onOpenSwitchModal={() => setIsSwitchModalOpen(true)}
        onGoToPublic={() => onNavigate && onNavigate('landing')}
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
  const [currentRoute, setCurrentRoute] = useState(resolveCurrentRoute);

  // Escuchar cambios de URL (popstate del historial y hashchange)
  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentRoute(resolveCurrentRoute());
    };

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);

    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);

  const handleNavigate = (route) => {
    let targetPath = '/';
    if (route === 'carta') {
      targetPath = '/carta';
    } else if (route === 'core' || route === 'admin') {
      targetPath = '/core';
    } else {
      targetPath = '/';
    }

    try {
      window.history.pushState({}, '', targetPath);
    } catch (e) {
      window.location.hash = targetPath;
    }
    setCurrentRoute(route);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 1. RUTA /carta: Carta digital interactiva para clientes (Sin PIN)
  if (currentRoute === 'carta') {
    return <PublicCartaView onNavigate={handleNavigate} />;
  }

  // 2. RUTA /core (o /admin): Punto de Venta y Gestión protegido por PIN de colaborador
  if (currentRoute === 'core') {
    return (
      <AppProvider>
        <ProtectedRoute onNavigate={handleNavigate}>
          <MainLayout onNavigate={handleNavigate} />
        </ProtectedRoute>
      </AppProvider>
    );
  }

  // 3. RUTA /: Landing page pública de presentación (Hero, marca, locales en Nuevo Chimbote y Chimbote) (Sin PIN)
  return <LandingPageView onNavigate={handleNavigate} />;
}
