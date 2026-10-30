import React from 'react';
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
  Monitor
} from 'lucide-react';

export const BottomNav = () => {
  const { activeTab, setActiveTab, cartCount, sesionCaja, productos, sede } = useApp();

  // Alerta de stock bajo (< 3 unidades en sede activa)
  const stockField = sede === 'VE' ? 'stock_VE' : 'stock_BA';
  const lowStockCount = productos.filter(p => (p[stockField] || 0) <= 3 && p.disponible).length;

  const tabs = [
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
      label: 'Caja & Flujo',
      icon: Wallet,
      badgeDot: !sesionCaja ? 'bg-rose-500' : 'bg-emerald-500',
    },
    {
      id: 'resumen',
      label: 'Resumen',
      icon: BarChart3,
    },
    {
      id: 'stats',
      label: 'Stats',
      icon: TrendingUp,
    },
    {
      id: 'fidelidad',
      label: 'Fidelidad',
      icon: Gift,
    },
    {
      id: 'historial',
      label: 'Historial',
      icon: History,
    },
    {
      id: 'carta',
      label: 'Carta Web',
      icon: Globe,
    },
    {
      id: 'web',
      label: 'Web Hero',
      icon: Monitor,
    },
    {
      id: 'admin',
      label: 'Admin',
      icon: Settings,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-pink-100 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-2 py-1.5 sm:py-2">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-1 overflow-x-auto no-scrollbar">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id || (tab.id === 'historial' && activeTab === 'comandas');

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex-1 min-w-[56px] py-1 px-1 flex flex-col items-center justify-center rounded-2xl transition-all duration-200 select-none ${
                isActive
                  ? 'text-brand-700 bg-pink-50/80 font-bold shadow-sm scale-105'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 font-medium'
              }`}
            >
              <div className="relative">
                <Icon className={`w-4 h-4 sm:w-5 sm:h-5 transition-transform ${isActive ? 'scale-110 text-brand-700' : ''}`} />
                
                {/* Badge numérico */}
                {tab.badge && (
                  <span className={`absolute -top-1.5 -right-2 text-[9px] font-extrabold w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full flex items-center justify-center shadow-sm ${tab.badgeColor}`}>
                    {tab.badge}
                  </span>
                )}

                {/* Badge de punto */}
                {tab.badgeDot && (
                  <span className={`absolute -top-0.5 -right-1 w-2 h-2 rounded-full ring-2 ring-white ${tab.badgeDot}`} />
                )}
              </div>

              <span className={`text-[9px] sm:text-[10px] mt-1 tracking-tight truncate max-w-full ${
                isActive ? 'font-bold text-brand-800' : 'text-slate-600'
              }`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
