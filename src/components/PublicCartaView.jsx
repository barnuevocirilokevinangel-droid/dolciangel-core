import React, { useState, useMemo, useEffect } from 'react';
import { db, collections, onSnapshot, doc } from '../services/firebase';
import { getProductPrice, getProductStock, extractCategories } from '../services/productUtils';
import { ProductImage } from './ProductImage';
import { 
  ShoppingBag, 
  MessageCircle, 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  Sparkles, 
  Clock, 
  MapPin, 
  CheckCircle,
  X,
  ExternalLink,
  ChevronRight,
  PhoneCall,
  Bell,
  ArrowLeft,
  Lock,
  Store
} from 'lucide-react';

const DEFAULT_CONFIG = {
  titulo: 'Carta Digital del Día',
  subtitulo: 'Postres artesanales horneados diariamente con stock confirmado en vivo para Buenos Aires (Nuevo Chimbote).',
  avisoSuperior: '✨ Atención hoy en Buenos Aires de 3:00 PM a 10:00 PM • Pedidos y delivery vía WhatsApp',
  telefonoWhatsapp: '51963810237'
};

export const PublicCartaView = ({ onNavigate }) => {
  const [productos, setProductos] = useState([]);
  const [webConfig, setWebConfig] = useState(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('todos');
  const [clientCart, setClientCart] = useState([]);
  const [isCartModalOpen, setIsCartModalOpen] = useState(false);
  const [clientName, setClientName] = useState('');

  // 1. Suscripción en tiempo real a 'configuracion/web_publica'
  useEffect(() => {
    const unsubConfig = onSnapshot(doc(db, 'configuracion', 'web_publica'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setWebConfig(prev => ({
          ...prev,
          titulo: data.titulo || prev.titulo,
          subtitulo: data.subtitulo || prev.subtitulo,
          avisoSuperior: data.avisoSuperior !== undefined ? data.avisoSuperior : prev.avisoSuperior,
          telefonoWhatsapp: data.telefonoWhatsapp || prev.telefonoWhatsapp
        }));
      }
    }, (err) => {
      console.warn('Aviso leyendo configuracion/web_publica en /carta:', err);
    });

    return () => unsubConfig();
  }, []);

  // 2. Lectura en tiempo real de Firestore (Colección 'productos')
  useEffect(() => {
    const unsubProds = onSnapshot(collections.productos, (snapshot) => {
      const prods = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setProductos(prods);
      setLoading(false);
    }, (error) => {
      console.error("Error al cargar carta pública:", error);
      setLoading(false);
    });

    return () => unsubProds();
  }, []);

  // 3. Regla estricta de la Carta Web: Solo productos con mostrar_en_carta === true y stock_BA > 0
  const availablePublicProducts = useMemo(() => {
    return productos.filter(p => {
      const isVisible = (p.mostrar_en_carta ?? true) && (p.visible_BA ?? true);
      const stockBA = getProductStock(p, 'BA');
      return isVisible && stockBA > 0;
    });
  }, [productos]);

  // Categorías presentes en los productos disponibles
  const dynamicCategories = useMemo(() => {
    return extractCategories(availablePublicProducts);
  }, [availablePublicProducts]);

  // Filtrado por búsqueda y categoría
  const filteredProducts = useMemo(() => {
    return availablePublicProducts.filter(p => {
      const term = searchTerm.toLowerCase().trim();
      const matchSearch = p.nombre.toLowerCase().includes(term) ||
                          (p.descripcion && p.descripcion.toLowerCase().includes(term));
      const matchCat = selectedCategory === 'todos' || p.categoria?.toLowerCase() === selectedCategory.toLowerCase();
      return matchSearch && matchCat;
    });
  }, [availablePublicProducts, searchTerm, selectedCategory]);

  // Funciones del Carrito Comensal
  const handleAddToCart = (product) => {
    const stockAvailable = getProductStock(product, 'BA');
    setClientCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= stockAvailable) return prev;
        return prev.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const handleUpdateQuantity = (productId, delta) => {
    setClientCart(prev => {
      return prev.map(item => {
        if (item.product.id === productId) {
          const maxStock = getProductStock(item.product, 'BA');
          const newQty = item.quantity + delta;
          if (newQty > maxStock) return item;
          if (newQty <= 0) return null;
          return { ...item, quantity: newQty };
        }
        return item;
      }).filter(Boolean);
    });
  };

  const handleRemoveFromCart = (productId) => {
    setClientCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const cartItemCount = useMemo(() => {
    return clientCart.reduce((sum, item) => sum + item.quantity, 0);
  }, [clientCart]);

  const cartTotalPrice = useMemo(() => {
    return clientCart.reduce((sum, item) => {
      const price = getProductPrice(item.product, 'BA');
      return sum + (price * item.quantity);
    }, 0);
  }, [clientCart]);

  // Generador de pedido por WhatsApp
  const handleSendWhatsAppOrder = () => {
    if (clientCart.length === 0) return;

    let itemsText = clientCart.map(it => {
      const price = getProductPrice(it.product, 'BA');
      const subtotal = price * it.quantity;
      return `• *${it.quantity}x* ${it.product.nombre} _(S/ ${subtotal.toFixed(2)})_`;
    }).join('\n');

    const customerHeader = clientName.trim() 
      ? `👤 *Cliente:* ${clientName.trim()}\n` 
      : '';

    const message = 
      `🧁 *¡HOLA DOLCIANGEL! DESEO REALIZAR UN PEDIDO:* 🍰\n\n` +
      customerHeader +
      `📍 *Sede:* Buenos Aires (Nuevo Chimbote)\n` +
      `📅 *Fecha:* ${new Date().toLocaleDateString('es-PE')}\n\n` +
      `🛒 *DETALLE DEL PEDIDO:*\n` +
      `${itemsText}\n\n` +
      `💰 *TOTAL ESTIMADO: S/ ${cartTotalPrice.toFixed(2)}*\n\n` +
      `¿Tienen disponibilidad inmediata para recojo o delivery? ¡Muchas gracias! ✨`;

    const encoded = encodeURIComponent(message);
    const phone = webConfig.telefonoWhatsapp || '51963810237';
    window.open(`https://wa.me/${phone}?text=${encoded}`, '_blank');
  };

  const handleOpenDirectChat = () => {
    const phone = webConfig.telefonoWhatsapp || '51963810237';
    const msg = encodeURIComponent('¡Hola Dolciangel! 🧁 Deseo consultar por la disponibilidad de postres de hoy en la carta.');
    window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-[#FFFDF9] text-slate-800 pb-28 font-sans selection:bg-brand-500 selection:text-white">
      {/* 1. BARRA DE AVISO SUPERIOR */}
      {webConfig.avisoSuperior && (
        <div className="bg-gradient-to-r from-amber-600 via-rose-700 to-brand-800 text-white text-xs font-bold py-2 px-4 shadow-sm text-center flex items-center justify-center gap-2">
          <Bell className="w-3.5 h-3.5 text-gold-300 shrink-0 animate-bounce" />
          <span className="tracking-wide">{webConfig.avisoSuperior}</span>
        </div>
      )}

      {/* 2. NAVBAR SUPERIOR DE LA CARTA */}
      <nav className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-pink-100 shadow-xs px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          {/* Botón Volver al Inicio (Landing) */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigate && onNavigate('landing')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 hover:bg-pink-100/70 text-slate-700 hover:text-brand-800 text-xs font-bold transition-all active:scale-95"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Inicio</span>
            </button>

            <div className="flex items-center gap-2">
              <span className="text-xl">🧁</span>
              <div>
                <span className="font-serif font-black text-base sm:text-lg tracking-tight text-slate-900 block leading-tight">
                  Carta Digital
                </span>
                <span className="text-[9px] font-extrabold uppercase tracking-widest text-brand-700 block">
                  Buenos Aires • Nuevo Chimbote
                </span>
              </div>
            </div>
          </div>

          {/* Acciones */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenDirectChat}
              className="px-3.5 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-sm transition-all flex items-center gap-1.5 active:scale-95"
            >
              <MessageCircle className="w-3.5 h-3.5 fill-white text-emerald-600" />
              <span className="hidden sm:inline">WhatsApp</span>
            </button>
            {onNavigate && (
              <button
                onClick={() => onNavigate('core')}
                title="Acceso Colaboradores / POS"
                className="p-2 rounded-full text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors ml-1"
              >
                <Lock className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* 3. ENCABEZADO COMPACTO DE LA CARTA */}
      <header className="bg-gradient-to-r from-brand-900 via-rose-900 to-pink-900 text-white py-8 px-4 relative overflow-hidden">
        <div className="max-w-5xl mx-auto relative z-10 text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 bg-white/10 px-3 py-0.5 rounded-full text-[11px] font-bold text-pink-200 border border-white/15">
              <Sparkles className="w-3 h-3 text-gold-400" />
              <span>Stock Confirmado en Vivo</span>
            </div>
            <h1 className="font-serif font-black text-2xl sm:text-3xl text-white">
              Vitrina del Día • Buenos Aires
            </h1>
            <p className="text-xs text-pink-100/80 max-w-lg">
              Av. Pacífico Mz. B Lt. 12 (Nuevo Chimbote) • Atención de Lunes a Domingo de 3:00 PM a 10:00 PM
            </p>
          </div>

          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/15 text-xs text-pink-200">
            <Clock className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Delivery & Recojo en tienda disponible</span>
          </div>
        </div>
      </header>

      {/* 4. BUSCADOR Y SELECTOR DE CATEGORÍAS */}
      <section className="max-w-5xl mx-auto px-4 -mt-4 relative z-20 space-y-4">
        <div className="bg-white rounded-3xl shadow-xl shadow-pink-950/5 border border-pink-100 p-4 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar cheesecake de maracuyá, torta de chocolate, pie de limón..."
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs sm:text-sm focus:outline-none focus:border-brand-500 focus:bg-white transition-all"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                Limpiar
              </button>
            )}
          </div>

          {/* Carrusel de Categorías */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-1 pb-1">
            <button
              onClick={() => setSelectedCategory('todos')}
              className={`px-4 py-2 rounded-full text-xs font-extrabold whitespace-nowrap transition-all shadow-xs ${
                selectedCategory === 'todos'
                  ? 'bg-brand-700 text-white shadow-brand-700/25 scale-[1.02]'
                  : 'bg-slate-100 text-slate-700 hover:bg-pink-50 hover:text-brand-700'
              }`}
            >
              🍰 Todos ({availablePublicProducts.length})
            </button>

            {dynamicCategories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2 rounded-full text-xs font-extrabold whitespace-nowrap transition-all flex items-center gap-1.5 shadow-xs ${
                  selectedCategory === cat.id
                    ? 'bg-brand-700 text-white shadow-brand-700/25 scale-[1.02]'
                    : 'bg-slate-100 text-slate-700 hover:bg-pink-50 hover:text-brand-700'
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 5. GRILLA DE PRODUCTOS DE LA CARTA */}
      <main className="max-w-5xl mx-auto px-4 mt-8">
        {loading ? (
          <div className="text-center py-16 space-y-3">
            <div className="w-10 h-10 border-4 border-pink-200 border-t-brand-700 rounded-full animate-spin mx-auto" />
            <p className="text-xs font-bold text-slate-500">Cargando los postres de hoy...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 text-center border border-pink-100 shadow-sm max-w-md mx-auto my-8">
            <div className="text-4xl mb-3">🧁</div>
            <h3 className="font-serif font-bold text-slate-900 text-lg">No encontramos postres disponibles</h3>
            <p className="text-xs text-slate-500 mt-1">
              {searchTerm 
                ? `No hay coincidencias para "${searchTerm}". Prueba con otra palabra.` 
                : 'En este momento todos los productos de esta categoría están agotados en vitrina.'}
            </p>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="mt-4 px-4 py-2 rounded-xl bg-pink-100 text-brand-800 font-bold text-xs hover:bg-pink-200 transition-colors"
              >
                Ver todos los disponibles
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredProducts.map(prod => {
              const stockBA = getProductStock(prod, 'BA');
              const priceBA = getProductPrice(prod, 'BA');
              const cartItem = clientCart.find(it => it.product.id === prod.id);

              return (
                <div
                  key={prod.id}
                  className="bg-white rounded-3xl border border-pink-100 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col justify-between group"
                >
                  <div>
                    {/* Imagen con Aspect Ratio */}
                    <div className="w-full aspect-square relative bg-slate-50 overflow-hidden">
                      <ProductImage
                        src={prod.imagenUrl || prod.imagen || prod.img}
                        alt={prod.nombre}
                        categoria={prod.categoria}
                        aspectRatio="aspect-square"
                        rounded="rounded-none"
                      />

                      {/* Stock Badge */}
                      <div className="absolute top-3 right-3 z-10">
                        <span className="text-[10px] font-black px-2.5 py-1 rounded-full shadow-md bg-emerald-600 text-white backdrop-blur-md flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                          <span>{stockBA <= 3 ? `¡Últimas ${stockBA}!` : `Stock: ${stockBA}`}</span>
                        </span>
                      </div>

                      {prod.esPedidoGrande && (
                        <div className="absolute top-3 left-3 z-10">
                          <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-purple-900/90 text-purple-100 backdrop-blur-md shadow-xs">
                            🎂 Catering / Entera
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Información del Producto */}
                    <div className="p-4 space-y-1.5">
                      <span className="text-[10px] font-bold text-brand-700 uppercase tracking-wider block">
                        {prod.categoria}
                      </span>
                      <h3 className="font-serif font-bold text-slate-900 text-base leading-snug group-hover:text-brand-700 transition-colors">
                        {prod.nombre}
                      </h3>
                      {prod.descripcion && (
                        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                          {prod.descripcion}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Pie de Card: Precio & Botón de Carrito */}
                  <div className="p-4 pt-0">
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-semibold text-slate-400 block">Precio porción</span>
                        <span className="font-serif font-black text-lg text-slate-900">
                          S/ {priceBA.toFixed(2)}
                        </span>
                      </div>

                      {cartItem ? (
                        <div className="flex items-center gap-1.5 bg-pink-50 p-1 rounded-2xl border border-pink-200">
                          <button
                            onClick={() => handleUpdateQuantity(prod.id, -1)}
                            className="w-7 h-7 rounded-xl bg-white text-slate-700 hover:bg-slate-100 flex items-center justify-center font-bold text-xs shadow-xs"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-6 text-center text-xs font-black text-brand-900">
                            {cartItem.quantity}
                          </span>
                          <button
                            onClick={() => handleAddToCart(prod)}
                            disabled={cartItem.quantity >= stockBA}
                            className="w-7 h-7 rounded-xl bg-brand-700 disabled:opacity-40 text-white flex items-center justify-center font-bold text-xs shadow-xs active:scale-90"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleAddToCart(prod)}
                          className="px-4 py-2.5 rounded-2xl bg-brand-700 hover:bg-brand-800 text-white font-extrabold text-xs shadow-md shadow-brand-700/20 transition-all flex items-center gap-1.5 active:scale-95"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Agregar</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* 6. BOTÓN FLOTANTE DIRECTO DE WHATSAPP (Bottom Right) */}
      <button
        onClick={handleOpenDirectChat}
        className="fixed bottom-6 right-6 z-40 bg-emerald-500 hover:bg-emerald-600 text-white p-3.5 rounded-full shadow-2xl shadow-emerald-500/40 hover:scale-110 active:scale-95 transition-all flex items-center gap-2 group"
        title="Consultar por WhatsApp"
      >
        <MessageCircle className="w-6 h-6 fill-white text-emerald-500" />
        <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 font-extrabold text-xs whitespace-nowrap">
          ¿Deseas consultar?
        </span>
      </button>

      {/* 7. BARRA FIJA INFERIOR DEL CARRITO */}
      {cartItemCount > 0 && (
        <div className="fixed bottom-4 left-4 right-4 max-w-lg mx-auto z-40 animate-slideUp">
          <div className="bg-slate-950/95 backdrop-blur-md text-white p-3.5 rounded-3xl shadow-2xl border border-white/15 flex items-center justify-between gap-3">
            <button
              onClick={() => setIsCartModalOpen(true)}
              className="flex items-center gap-3 text-left pl-1"
            >
              <div className="w-10 h-10 rounded-2xl bg-brand-600 flex items-center justify-center font-black text-sm text-white shadow-md shadow-brand-600/30">
                {cartItemCount}
              </div>
              <div>
                <span className="text-[10px] text-pink-300 uppercase font-extrabold block">Tu Selección</span>
                <span className="text-sm font-black text-gold-300">
                  Total: S/ {cartTotalPrice.toFixed(2)}
                </span>
              </div>
            </button>

            <button
              onClick={() => setIsCartModalOpen(true)}
              className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-extrabold text-xs shadow-md transition-all flex items-center gap-1.5 active:scale-95"
            >
              <span>Ver Pedido</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 8. MODAL DE RESUMEN DEL PEDIDO */}
      {isCartModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-md w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🛒</span>
                <div>
                  <h3 className="font-serif font-bold text-slate-900 text-base">Tu Pedido Dolciangel</h3>
                  <span className="text-[10px] text-slate-400">Sede Buenos Aires • Nuevo Chimbote</span>
                </div>
              </div>
              <button
                onClick={() => setIsCartModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Nombre del Cliente */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                ¿A nombre de quién registramos el pedido? (Opcional)
              </label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Ej. María Sánchez"
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:border-brand-500"
              />
            </div>

            {/* Lista de Items */}
            <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto pr-1">
              {clientCart.map(it => {
                const price = getProductPrice(it.product, 'BA');
                const maxStock = getProductStock(it.product, 'BA');

                return (
                  <div key={it.product.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-xs text-slate-900 truncate">{it.product.nombre}</h4>
                      <span className="text-[10px] text-slate-400">S/ {price.toFixed(2)} c/u</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleUpdateQuantity(it.product.id, -1)}
                        className="w-6 h-6 rounded bg-slate-100 text-slate-700 flex items-center justify-center text-xs font-bold"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-5 text-center text-xs font-bold">{it.quantity}</span>
                      <button
                        onClick={() => handleAddToCart(it.product)}
                        disabled={it.quantity >= maxStock}
                        className="w-6 h-6 rounded bg-pink-100 text-brand-800 disabled:opacity-40 flex items-center justify-center text-xs font-bold"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="text-right min-w-[55px]">
                      <span className="font-extrabold text-xs text-slate-900">
                        S/ {(price * it.quantity).toFixed(2)}
                      </span>
                    </div>

                    <button
                      onClick={() => handleRemoveFromCart(it.product.id)}
                      className="text-slate-300 hover:text-rose-600 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Total */}
            <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-sm">
              <span className="font-bold text-slate-700">Total a Pagar:</span>
              <span className="font-black text-brand-700 text-lg">S/ {cartTotalPrice.toFixed(2)}</span>
            </div>

            {/* Botón WhatsApp Modal */}
            <div className="pt-2 space-y-2">
              <button
                onClick={handleSendWhatsAppOrder}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-extrabold text-xs shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 active:scale-98 transition-all"
              >
                <MessageCircle className="w-4 h-4 fill-white text-emerald-600" />
                <span>Enviar Pedido a WhatsApp (+{webConfig.telefonoWhatsapp || '51 963 810 237'})</span>
              </button>
              <button
                onClick={() => setIsCartModalOpen(false)}
                className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50"
              >
                Seguir explorando la carta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. FOOTER DE LA CARTA */}
      <footer className="mt-20 border-t border-pink-100 bg-white py-10 px-4 text-center text-xs text-slate-500 space-y-3">
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => onNavigate && onNavigate('landing')}
            className="font-bold text-brand-700 hover:underline text-xs"
          >
            ← Volver a la Portada Principal
          </button>
        </div>
        <p className="max-w-md mx-auto text-[11px] text-slate-400">
          Dolciangel Pastelería Fina & Café • Av. Pacífico Mz. B Lt. 12 (Buenos Aires, Nuevo Chimbote)
        </p>

        {onNavigate && (
          <div className="pt-4 border-t border-slate-100 max-w-xs mx-auto">
            <button
              onClick={() => onNavigate('core')}
              className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-400 hover:text-brand-700 transition-colors py-1 px-3 rounded-full hover:bg-pink-50"
            >
              <Lock className="w-3 h-3" />
              <span>Acceso Colaboradores / POS</span>
            </button>
          </div>
        )}
      </footer>
    </div>
  );
};

export default PublicCartaView;
