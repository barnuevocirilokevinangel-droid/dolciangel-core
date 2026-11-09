import React, { useState, useMemo, useEffect } from 'react';
import { db, collections, onSnapshot, query, where } from '../services/firebase';
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
  PhoneCall
} from 'lucide-react';

const WHATSAPP_PHONE = '51963810237'; // Línea oficial de pedidos Dolciangel

export const PublicCartaView = () => {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('todos');
  const [clientCart, setClientCart] = useState([]);
  const [isCartModalOpen, setIsCartModalOpen] = useState(false);
  const [clientName, setClientName] = useState('');

  // 1. Lectura en tiempo real de Firestore (Colección 'productos')
  useEffect(() => {
    const unsub = onSnapshot(collections.productos, (snapshot) => {
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

    return () => unsub();
  }, []);

  // 2. Regla estricta de la Carta Web: Solo productos con mostrar_en_carta === true y stock_BA > 0
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

  const cartTotalItems = clientCart.reduce((sum, it) => sum + it.quantity, 0);
  const cartTotalPrice = clientCart.reduce((sum, it) => {
    const price = getProductPrice(it.product, 'BA');
    return sum + (price * it.quantity);
  }, 0);

  // 3. Generación y Envío de Pedido a WhatsApp
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
    window.open(`https://wa.me/${WHATSAPP_PHONE}?text=${encoded}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50/40 via-white to-pink-50/20 text-slate-800 pb-28 font-sans selection:bg-brand-500 selection:text-white">
      {/* 1. HERO CABECERA ELEGANTE */}
      <header className="bg-gradient-to-r from-brand-900 via-rose-900 to-pink-800 text-white shadow-xl relative overflow-hidden">
        {/* Adorno decorativo de fondo */}
        <div className="absolute -right-10 -bottom-10 w-44 h-44 bg-white/5 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -left-10 -top-10 w-44 h-44 bg-pink-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="max-w-4xl mx-auto px-4 py-8 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-3.5 py-1 rounded-full text-xs font-bold text-pink-200 border border-white/15 mb-3 shadow-inner">
            <Sparkles className="w-3.5 h-3.5 text-gold-400" />
            <span>Carta Web Oficial • Stock en Vivo</span>
          </div>

          <div className="text-4xl mb-1 animate-bounceOnce">🧁</div>
          <h1 className="text-3xl md:text-4xl font-serif font-black tracking-tight text-white drop-shadow-sm">
            DOLCIANGEL
          </h1>
          <p className="text-xs uppercase font-extrabold tracking-widest text-pink-200 mt-1">
            Pastelería Fina & Café
          </p>

          <p className="text-xs text-pink-100/90 max-w-md mx-auto mt-2 leading-relaxed">
            El arte de endulzar tus momentos en Chimbote. Cheesecakes horneados, tortas artesanales y bocaditos del día.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 text-[11px] text-pink-200 mt-4">
            <span className="flex items-center gap-1.5 bg-black/20 px-3 py-1 rounded-full border border-white/10">
              <MapPin className="w-3.5 h-3.5 text-gold-400" />
              <span>Av. Pacífico Mz. B Lt. 12 (Buenos Aires)</span>
            </span>
            <span className="flex items-center gap-1.5 bg-black/20 px-3 py-1 rounded-full border border-white/10">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              <span>Atención Diaria</span>
            </span>
          </div>
        </div>
      </header>

      {/* 2. BARRA DE BÚSQUEDA Y CATEGORÍAS */}
      <section className="max-w-4xl mx-auto px-4 -mt-5 relative z-20">
        <div className="bg-white rounded-2xl shadow-xl shadow-pink-900/5 border border-pink-100 p-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar cheesecake, torta de chocolate, pie..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm focus:outline-none focus:border-brand-500 focus:bg-white transition-all"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                Limpiar
              </button>
            )}
          </div>

          {/* Carrusel de Categorías */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-3 pb-1">
            <button
              onClick={() => setSelectedCategory('todos')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold whitespace-nowrap transition-all shadow-xs ${
                selectedCategory === 'todos'
                  ? 'bg-brand-700 text-white shadow-brand-700/25'
                  : 'bg-slate-100 text-slate-700 hover:bg-pink-50 hover:text-brand-700'
              }`}
            >
              🍰 Todos ({availablePublicProducts.length})
            </button>

            {dynamicCategories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-extrabold whitespace-nowrap transition-all flex items-center gap-1.5 shadow-xs ${
                  selectedCategory === cat.id
                    ? 'bg-brand-700 text-white shadow-brand-700/25'
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

      {/* 3. GRILLA DE PRODUCTOS DE LA CARTA */}
      <main className="max-w-4xl mx-auto px-4 mt-6">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {filteredProducts.map(prod => {
              const stockBA = getProductStock(prod, 'BA');
              const priceBA = getProductPrice(prod, 'BA');
              const cartItem = clientCart.find(it => it.product.id === prod.id);

              return (
                <div
                  key={prod.id}
                  className="bg-white rounded-2xl border border-pink-100/80 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between group"
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
                      <div className="absolute top-2.5 right-2.5 z-10">
                        <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-md bg-emerald-600 text-white backdrop-blur-md">
                          {stockBA <= 3 ? `¡Últimas ${stockBA}!` : `Stock: ${stockBA}`}
                        </span>
                      </div>

                      {prod.esPedidoGrande && (
                        <div className="absolute top-2.5 left-2.5 z-10">
                          <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-purple-900/90 text-purple-100 backdrop-blur-md shadow-xs">
                            🎂 Catering / Entera
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Información del Postre */}
                    <div className="p-3.5 space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-brand-700 block">
                        {prod.categoria}
                      </span>
                      <h3 className="font-bold text-slate-900 text-sm leading-snug line-clamp-2 group-hover:text-brand-800 transition-colors">
                        {prod.nombre}
                      </h3>
                      {prod.descripcion && (
                        <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2">
                          {prod.descripcion}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Precio y Botón de Compra */}
                  <div className="p-3.5 pt-0 flex items-center justify-between border-t border-slate-50 mt-2">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold block uppercase">Porción</span>
                      <span className="font-extrabold text-brand-700 text-base">
                        S/ {priceBA.toFixed(2)}
                      </span>
                    </div>

                    {cartItem ? (
                      <div className="flex items-center gap-1.5 bg-pink-50 border border-brand-200 rounded-xl p-1 shadow-xs">
                        <button
                          onClick={() => handleUpdateQuantity(prod.id, -1)}
                          className="w-7 h-7 rounded-lg bg-white hover:bg-pink-100 text-brand-700 flex items-center justify-center font-bold active:scale-90 transition-all"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-6 text-center text-xs font-black text-slate-900">
                          {cartItem.quantity}
                        </span>
                        <button
                          onClick={() => handleAddToCart(prod)}
                          disabled={cartItem.quantity >= stockBA}
                          className="w-7 h-7 rounded-lg bg-brand-700 hover:bg-brand-800 disabled:opacity-40 text-white flex items-center justify-center font-bold active:scale-90 transition-all shadow-xs"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleAddToCart(prod)}
                        className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-brand-700 to-pink-600 hover:from-brand-800 hover:to-pink-700 text-white font-extrabold text-xs shadow-md shadow-brand-700/20 flex items-center gap-1.5 active:scale-95 transition-all"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Pedir</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* 4. PIE DE PÁGINA COMENSAL & ENLACE AL POS */}
      <footer className="max-w-4xl mx-auto px-4 mt-12 text-center text-slate-500 text-xs space-y-2 border-t border-pink-100/60 pt-6">
        <p className="font-bold text-slate-700">
          Dolciangel Pastelería Fina & Café • RUC: 10427321351
        </p>
        <p className="text-[11px] text-slate-400">
          Los precios y stock corresponden a la sede de Buenos Aires y se actualizan en vivo.
        </p>
        <div>
          <a
            href="/"
            className="inline-flex items-center gap-1 text-[11px] font-bold text-pink-700 hover:text-brand-900 underline mt-2"
          >
            🔐 Acceso Colaboradores / POS Mostrador
          </a>
        </div>
      </footer>

      {/* 5. BARRA FLOTANTE INFERIOR DE PEDIDO (Sticky Bar) */}
      {cartTotalItems > 0 && (
        <div className="fixed bottom-3 inset-x-3 sm:max-w-md sm:mx-auto z-40 animate-slideUp">
          <div className="bg-slate-950 text-white rounded-2xl p-3 shadow-2xl shadow-slate-950/50 border border-slate-800 flex items-center justify-between gap-3">
            <button 
              onClick={() => setIsCartModalOpen(true)}
              className="flex items-center gap-3 text-left pl-1 hover:opacity-90 transition-opacity"
            >
              <div className="w-10 h-10 rounded-xl bg-brand-600 text-white flex items-center justify-center font-black relative">
                <ShoppingBag className="w-5 h-5" />
                <span className="absolute -top-1.5 -right-1.5 bg-gold-400 text-slate-950 text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-md">
                  {cartTotalItems}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-pink-300 block">Tu selección</span>
                <span className="font-black text-sm text-white">S/ {cartTotalPrice.toFixed(2)}</span>
              </div>
            </button>

            <button
              onClick={handleSendWhatsAppOrder}
              className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-extrabold text-xs shadow-lg shadow-emerald-500/30 flex items-center gap-2 active:scale-95 transition-all"
            >
              <MessageCircle className="w-4 h-4 fill-white text-emerald-600" />
              <span>Pedir por WhatsApp</span>
            </button>
          </div>
        </div>
      )}

      {/* 6. MODAL DE RESUMEN DEL PEDIDO */}
      {isCartModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md p-6 max-h-[85vh] flex flex-col justify-between shadow-2xl border border-pink-100">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-pink-100 text-brand-700 flex items-center justify-center font-bold">
                    🧁
                  </div>
                  <div>
                    <h3 className="font-serif font-bold text-base text-slate-900">Tu Pedido Dolciangel</h3>
                    <p className="text-[10px] text-slate-400">{cartTotalItems} productos seleccionados</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsCartModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Input opcional de Nombre */}
              <div className="mt-3">
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Tu nombre (opcional para el mensaje):
                </label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Ej. Ana Pérez"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-brand-500"
                />
              </div>

              {/* Lista de Items */}
              <div className="my-4 divide-y divide-slate-100 max-h-[40vh] overflow-y-auto pr-1">
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
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-5 text-center text-xs font-bold">{it.quantity}</span>
                        <button
                          onClick={() => handleAddToCart(it.product)}
                          disabled={it.quantity >= maxStock}
                          className="w-6 h-6 rounded bg-pink-100 text-brand-800 disabled:opacity-40 flex items-center justify-center text-xs font-bold"
                        >
                          <Plus className="w-3 h-3" />
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
            </div>

            {/* Botón WhatsApp Modal */}
            <div className="pt-4 space-y-2">
              <button
                onClick={handleSendWhatsAppOrder}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-extrabold text-xs shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 active:scale-98 transition-all"
              >
                <MessageCircle className="w-4 h-4 fill-white text-emerald-600" />
                <span>Enviar Pedido a WhatsApp (+51 963 810 237)</span>
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
    </div>
  );
};

export default PublicCartaView;
