import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  ShoppingCart,
  Package,
  Wallet,
  BarChart3,
  TrendingUp,
  Gift,
  History,
  Globe,
  Settings,
  Monitor,
  FileSpreadsheet,
  ChefHat,
  LayoutGrid,
  X
} from 'lucide-react';

export const BottomNav = () => {
  const { activeTab, setActiveTab, cartCount, sesionCaja, productos, sede, perfil } = useApp();
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const isDueno = Boolean(perfil?.isDueno);

  // Alerta de stock bajo (< 3 unidades en sede activa)
  const stockField = sede === 'VE' ? 'stock_VE' : 'stock_BA';
  const lowStockCount = useMemo(
    () => (productos || []).filter((p) => (p[stockField] || 0) <= 3 && p.disponible && p.controla_stock !== false).length,
    [productos, stockField]
  );

  // 4 pestañas principales fijas en móvil/tablet (< lg)
  const primaryMobileTabs = [
    {
      id: 'ventas',
      label: 'Ventas',
      icon: ShoppingCart,
      badge: cartCount > 0 ? cartCount : null,
      badgeColor: 'bg-brand-600 text-white'
    },
    {
      id: 'inventario',
      label: 'Inventario',
      icon: Package,
      badge: lowStockCount > 0 ? lowStockCount : null,
      badgeColor: 'bg-amber-500 text-white'
    },
    {
      id: 'caja',
      label: 'Caja',
      icon: Wallet,
      badgeDot: !sesionCaja ? 'bg-rose-500' : 'bg-emerald-500'
    },
    {
      id: 'historial',
      label: 'Historial',
      icon: History
    }
  ];

  // Módulos del menú "Más" (filtrados según rol Dueño vs Cajero/Staff)
  const moreModules = useMemo(() => {
    const allModules = [
      {
        id: 'costeo',
        label: 'Costeo',
        desc: 'Insumos y escandallos',
        icon: ChefHat,
        color: 'bg-amber-50 text-amber-800 border-amber-200',
        ownerOnly: true
      },
      {
        id: 'resumen',
        label: 'Resumen',
        desc: 'Cierre diario en soles',
        icon: BarChart3,
        color: 'bg-pink-50 text-brand-800 border-pink-200',
        ownerOnly: false
      },
      {
        id: 'stats',
        label: 'Stats',
        desc: 'Rentabilidad y KPIs',
        icon: TrendingUp,
        color: 'bg-indigo-50 text-indigo-800 border-indigo-200',
        ownerOnly: true
      },
      {
        id: 'contabilidad',
        label: 'SIRE / Contab.',
        desc: 'Exportar ventas SUNAT',
        icon: FileSpreadsheet,
        color: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        ownerOnly: true
      },
      {
        id: 'fidelidad',
        label: 'Fidelidad',
        desc: 'Sellos y canjes',
        icon: Gift,
        color: 'bg-purple-50 text-purple-800 border-purple-200',
        ownerOnly: false
      },
      {
        id: 'carta',
        label: 'Carta Web',
        desc: 'Visibilidad vitrina',
        icon: Globe,
        color: 'bg-sky-50 text-sky-800 border-sky-200',
        ownerOnly: false
      },
      {
        id: 'web',
        label: 'Web Hero',
        desc: 'Portada web pública',
        icon: Monitor,
        color: 'bg-teal-50 text-teal-800 border-teal-200',
        ownerOnly: true
      },
      {
        id: 'admin',
        label: 'Admin',
        desc: 'Catálogo y sistema',
        icon: Settings,
        color: 'bg-slate-100 text-slate-800 border-slate-300',
        ownerOnly: true
      }
    ];

    return allModules.filter((m) => !m.ownerOnly || isDueno);
  }, [isDueno]);

  // Todas las pestañas para pantallas grandes (lg: escritorio)
  const desktopTabs = useMemo(() => {
    return [
      ...primaryMobileTabs.slice(0, 2),
      ...moreModules.filter((m) => m.id === 'costeo'),
      primaryMobileTabs[2],
      ...moreModules.filter((m) => m.id === 'resumen' || m.id === 'stats' || m.id === 'fidelidad'),
      primaryMobileTabs[3],
      ...moreModules.filter((m) => ['contabilidad', 'carta', 'web', 'admin'].includes(m.id))
    ];
  }, [primaryMobileTabs, moreModules]);

  const activeMoreModule = moreModules.find((m) => m.id === activeTab);

  const handleSelectTab = (tabId) => {
    setActiveTab(tabId);
    setIsMoreOpen(false);
  };

  return (
    <>
      {/* Bottom Sheet "Más" para Móvil y Tablet (< lg) */}
      {isMoreOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end justify-center lg:hidden animate-fadeIn"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsMoreOpen(false);
          }}
        >
          <div className="bg-white w-full max-w-lg rounded-t-3xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl border-t border-pink-100 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h3 className="font-serif font-bold text-lg text-slate-900">
                  Módulos de Gestión
                </h3>
                <p className="text-xs text-slate-500">
                  {isDueno ? 'Acceso completo de Administrador / Dueño' : 'Opciones operativas de tienda'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsMoreOpen(false)}
                className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {moreModules.map((mod) => {
                const Icon = mod.icon;
                const isSelected = activeTab === mod.id;
                return (
                  <button
                    key={mod.id}
                    type="button"
                    onClick={() => handleSelectTab(mod.id)}
                    className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between gap-2 active:scale-95 ${
                      isSelected
                        ? 'border-brand-600 bg-pink-50/90 ring-2 ring-brand-500/20 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-pink-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-xl border flex items-center justify-center ${mod.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-extrabold text-xs text-slate-900 leading-tight">
                        {mod.label}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">
                        {mod.desc}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Barra Inferior Fija */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-pink-100 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] pb-[env(safe-area-inset-bottom)]">
        {/* VISTA MÓVIL Y TABLET (< lg): EXACTAMENTE 5 BOTONES FIJOS (4 + 1 "Más") */}
        <div className="grid grid-cols-5 lg:hidden min-h-[56px] px-1">
          {primaryMobileTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive =
              !isMoreOpen &&
              (activeTab === tab.id || (tab.id === 'historial' && activeTab === 'comandas'));

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleSelectTab(tab.id)}
                className={`relative min-h-[56px] flex flex-col items-center justify-center gap-0.5 rounded-xl transition-all select-none ${
                  isActive
                    ? 'text-brand-700 font-extrabold'
                    : 'text-slate-500 hover:text-slate-800 font-semibold'
                }`}
              >
                {isActive && (
                  <span className="absolute top-0 inset-x-4 h-0.5 bg-brand-700 rounded-full" />
                )}
                <div className="relative">
                  <Icon className={`w-5 h-5 ${isActive ? 'text-brand-700 scale-105' : ''}`} />
                  {tab.badge && (
                    <span
                      className={`absolute -top-1.5 -right-2.5 text-[10px] font-black min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center shadow-xs ${tab.badgeColor}`}
                    >
                      {tab.badge}
                    </span>
                  )}
                  {tab.badgeDot && (
                    <span
                      className={`absolute -top-0.5 -right-1 w-2 h-2 rounded-full ring-2 ring-white ${tab.badgeDot}`}
                    />
                  )}
                </div>
                <span className="text-[11px] leading-none tracking-tight">
                  {tab.label}
                </span>
              </button>
            );
          })}

          {/* 5to Botón: Más */}
          <button
            type="button"
            onClick={() => setIsMoreOpen((prev) => !prev)}
            className={`relative min-h-[56px] flex flex-col items-center justify-center gap-0.5 rounded-xl transition-all select-none ${
              isMoreOpen || activeMoreModule
                ? 'text-brand-700 font-extrabold'
                : 'text-slate-500 hover:text-slate-800 font-semibold'
            }`}
          >
            {(isMoreOpen || activeMoreModule) && (
              <span className="absolute top-0 inset-x-4 h-0.5 bg-brand-700 rounded-full" />
            )}
            <div className="relative">
              <LayoutGrid className={`w-5 h-5 ${isMoreOpen || activeMoreModule ? 'text-brand-700 scale-105' : ''}`} />
              {activeMoreModule && !isMoreOpen && (
                <span className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full ring-2 ring-white bg-brand-600" />
              )}
            </div>
            <span className="text-[11px] leading-none tracking-tight truncate max-w-[64px]">
              {activeMoreModule ? activeMoreModule.label : 'Más'}
            </span>
          </button>
        </div>

        {/* VISTA ESCRITORIO (lg:): Barra completa */}
        <div className="hidden lg:flex max-w-6xl mx-auto items-center justify-between gap-1 px-3 py-1.5">
          {desktopTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive =
              activeTab === tab.id || (tab.id === 'historial' && activeTab === 'comandas');

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleSelectTab(tab.id)}
                className={`relative flex-1 min-w-[64px] py-1.5 px-2 flex flex-col items-center justify-center rounded-2xl transition-all duration-200 select-none ${
                  isActive
                    ? 'text-brand-700 bg-pink-50/90 font-extrabold shadow-xs scale-105'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 font-medium'
                }`}
              >
                <div className="relative">
                  <Icon className={`w-5 h-5 ${isActive ? 'text-brand-700' : ''}`} />
                  {tab.badge && (
                    <span
                      className={`absolute -top-1.5 -right-2.5 text-[10px] font-extrabold min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center shadow-xs ${tab.badgeColor}`}
                    >
                      {tab.badge}
                    </span>
                  )}
                  {tab.badgeDot && (
                    <span
                      className={`absolute -top-0.5 -right-1 w-2 h-2 rounded-full ring-2 ring-white ${tab.badgeDot}`}
                    />
                  )}
                </div>
                <span className="text-[10px] mt-1 tracking-tight truncate max-w-full">
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
