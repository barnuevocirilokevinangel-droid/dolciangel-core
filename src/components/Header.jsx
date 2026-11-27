import React from 'react';
import { useApp, SEDES } from '../context/AppContext';
import { LogOut, ShoppingBag, Globe } from 'lucide-react';

export const Header = ({ onOpenCart, onOpenSwitchModal, onGoToPublic }) => {
  const { sede, perfil, syncStatus, isOnline, activeAccount, cartCount, cartTotal, logout } = useApp();

  const currentSedeInfo = sede ? SEDES[sede] : null;
  const statusDotColor = !isOnline
    ? 'bg-rose-500 animate-pulse'
    : syncStatus === 'connected'
    ? 'bg-emerald-500 animate-pulse-green'
    : syncStatus === 'connecting'
    ? 'bg-amber-400 animate-pulse'
    : 'bg-rose-500';

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-pink-100 shadow-xs h-12 sm:h-14 px-3 sm:px-4 flex items-center">
      <div className="max-w-7xl w-full mx-auto flex items-center justify-between gap-2">
        {/* Logo compacto en 1 sola línea */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-brand-700 via-brand-600 to-pink-500 flex items-center justify-center text-white shadow-sm text-base sm:text-lg font-bold shrink-0">
            🧁
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-serif font-bold text-base sm:text-lg text-brand-900 tracking-tight truncate">
              Dolciangel
            </span>
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${statusDotColor}`}
              title={!isOnline ? 'Sin conexión' : syncStatus === 'connected' ? 'Sincronizado' : 'Conectando...'}
            />
            {!isOnline && (
              <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700">
                Offline
              </span>
            )}
          </div>
        </div>

        {/* Controles compactos: Sede + Perfil + Carrito + Bloqueo */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {currentSedeInfo && (
            <button
              type="button"
              onClick={onOpenSwitchModal}
              title="Cambiar sede o perfil"
              className="flex items-center gap-1 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full bg-pink-50 hover:bg-pink-100 border border-pink-200 text-brand-800 text-xs font-extrabold transition-all active:scale-95"
            >
              <span className="text-xs sm:text-sm">{currentSedeInfo.icon}</span>
              <span className="sm:hidden">{sede}</span>
              <span className="hidden sm:inline">{currentSedeInfo.nombre}</span>
            </button>
          )}

          {perfil && (
            <button
              type="button"
              onClick={onOpenSwitchModal}
              title="Cambiar usuario / rol"
              className="flex items-center gap-1 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 text-xs font-bold transition-all active:scale-95"
            >
              <span className="text-xs sm:text-sm">{perfil.avatar}</span>
              <span className="max-w-[72px] sm:max-w-[110px] truncate">{perfil.nombre}</span>
              {perfil.isDueno && (
                <span className="hidden xs:inline-block bg-amber-100 text-amber-800 text-[9px] font-black px-1.5 py-0.2 rounded-full border border-amber-300">
                  Dueño
                </span>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={onOpenCart}
            className="relative flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl bg-brand-700 hover:bg-brand-800 text-white font-bold text-xs shadow-sm active:scale-95 transition-all"
          >
            <ShoppingBag className="w-3.5 h-3.5 text-pink-200" />
            <span className="hidden md:inline truncate max-w-[85px]">
              {activeAccount?.name || 'Mesa'}
            </span>
            <span className="bg-white text-brand-800 font-extrabold text-[11px] px-1.5 rounded-full">
              {cartCount}
            </span>
            {cartTotal > 0 && (
              <span className="text-gold-300 font-bold hidden lg:inline border-l border-brand-600 pl-1.5">
                S/ {cartTotal.toFixed(2)}
              </span>
            )}
          </button>

          {onGoToPublic && (
            <button
              type="button"
              onClick={onGoToPublic}
              title="Ir a la Web Pública"
              className="hidden xl:flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-pink-50 hover:bg-pink-100 border border-pink-200 text-brand-800 text-xs font-bold transition-all"
            >
              <Globe className="w-3.5 h-3.5 text-brand-700" />
              <span>Web</span>
            </button>
          )}

          <button
            type="button"
            onClick={logout}
            title="Bloquear pantalla / Cerrar turno"
            className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
