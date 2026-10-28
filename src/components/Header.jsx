import React from 'react';
import { useApp, SEDES } from '../context/AppContext';
import { Store, User, LogOut, Wifi, WifiOff, ShoppingBag, Sparkles } from 'lucide-react';

export const Header = ({ onOpenCart, onOpenSwitchModal }) => {
  const { sede, perfil, syncStatus, activeAccount, cartCount, cartTotal } = useApp();

  const currentSedeInfo = sede ? SEDES[sede] : null;

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-pink-100 shadow-sm px-4 py-2.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
        {/* Logo & Marca */}
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-700 via-brand-600 to-pink-500 flex items-center justify-center text-white shadow-md shadow-brand-500/20 text-xl font-bold">
            🧁
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-serif font-bold text-lg text-brand-900 tracking-tight">Dolciangel</span>
              <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-full bg-gold-500/10 text-gold-600 border border-gold-400/30 uppercase tracking-wider">
                CORE
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${
                  syncStatus === 'connected' ? 'bg-emerald-500 animate-pulse-green' :
                  syncStatus === 'connecting' ? 'bg-amber-400 animate-pulse' : 'bg-rose-500'
                }`} />
                {syncStatus === 'connected' ? 'Sincronizado' : syncStatus === 'connecting' ? 'Conectando...' : 'Desconectado'}
              </span>
            </div>
          </div>
        </div>

        {/* Pills de Sede y Perfil Activos */}
        <div className="flex items-center gap-2">
          {/* Pill de Sede */}
          {currentSedeInfo && (
            <button
              onClick={onOpenSwitchModal}
              title="Cambiar local"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-pink-50 hover:bg-pink-100/80 border border-pink-200 text-brand-800 text-xs font-semibold transition-all shadow-sm active:scale-95"
            >
              <span className="text-sm">{currentSedeInfo.icon}</span>
              <span className="hidden sm:inline font-bold">{currentSedeInfo.nombre}</span>
              <span className="sm:hidden font-bold">{sede}</span>
              <span className="text-[10px] text-brand-600 bg-white px-1.5 py-0.2 rounded-full border border-pink-200 hidden md:inline">
                {currentSedeInfo.ciudad}
              </span>
            </button>
          )}

          {/* Pill de Perfil */}
          {perfil && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold shadow-sm">
              <span className="text-sm">{perfil.avatar}</span>
              <span className="font-bold text-slate-900">{perfil.nombre}</span>
              {perfil.isDueno && (
                <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-amber-300">
                  Dueño
                </span>
              )}
            </div>
          )}

          {/* Botón Carrito en Cabecera (con mesa activa) */}
          <button
            onClick={onOpenCart}
            className="relative flex items-center gap-2 px-3 py-1.5 rounded-xl bg-brand-700 hover:bg-brand-800 text-white font-bold text-xs shadow-md shadow-brand-700/25 active:scale-95 transition-all"
          >
            <ShoppingBag className="w-4 h-4 text-pink-200" />
            <span className="hidden sm:inline truncate max-w-[90px]">
              {activeAccount?.name || 'Comanda'}
            </span>
            <span className="bg-white text-brand-800 font-extrabold text-[11px] px-1.5 py-0.2 rounded-full">
              {cartCount}
            </span>
            {cartTotal > 0 && (
              <span className="text-gold-300 font-bold hidden md:inline border-l border-brand-600 pl-1.5">
                S/ {cartTotal.toFixed(2)}
              </span>
            )}
          </button>

          {/* Botón Salir / Cambiar sesión */}
          <button
            onClick={onOpenSwitchModal}
            title="Cambiar sesión o local"
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
