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
  Heart,
  ShieldCheck,
  Award,
  Lock
} from 'lucide-react';

const DEFAULT_CONFIG = {
  titulo: 'Hay momentos que\nmerecen quedarse.',
  subtitulo: 'Elaboración diaria con ingredientes seleccionados.\nEncuéntranos en Villa España y Nuevo Chimbote.',
  imagenUrl: 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=800&q=80',
  avisoSuperior: '✨ Atención hoy en Buenos Aires de 3:00 PM a 10:00 PM • Pedidos y delivery vía WhatsApp',
  telefonoWhatsapp: '51963810237'
};

export const PublicCartaView = ({ onGoToAdmin }) => {
  const [productos, setProductos] = useState([]);
  const [webConfig, setWebConfig] = useState(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('todos');
  const [clientCart, setClientCart] = useState([]);
  const [isCartModalOpen, setIsCartModalOpen] = useState(false);
  const [clientName, setClientName] = useState('');

  // 1. Suscripción en tiempo real a 'configuracion/web_publica' (Hero, textos, avisos, WhatsApp)
  useEffect(() => {
    const unsubConfig = onSnapshot(doc(db, 'configuracion', 'web_publica'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setWebConfig(prev => ({
          ...prev,
          titulo: data.titulo || prev.titulo,
          subtitulo: data.subtitulo || prev.subtitulo,
          imagenUrl: data.imagenUrl || prev.imagenUrl,
          avisoSuperior: data.avisoSuperior !== undefined ? data.avisoSuperior : prev.avisoSuperior,
          telefonoWhatsapp: data.telefonoWhatsapp || prev.telefonoWhatsapp
        }));
      }
    }, (err) => {
      console.warn('Aviso leyendo configuracion/web_publica:', err);
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
    const msg = encodeURIComponent('¡Hola Dolciangel! 🧁 Deseo consultar por la disponibilidad de postres de hoy.');
    window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-[#FFFDF9] text-slate-800 pb-28 font-sans selection:bg-brand-500 selection:text-white">
      {/* 1. BARRA DE AVISO / ANUNCIO SUPERIOR */}
      {webConfig.avisoSuperior && (
        <div className="bg-gradient-to-r from-amber-600 via-rose-700 to-brand-800 text-white text-xs font-bold py-2 px-4 shadow-sm text-center flex items-center justify-center gap-2">
          <Bell className="w-3.5 h-3.5 text-gold-300 shrink-0 animate-bounce" />
          <span className="tracking-wide">{webConfig.avisoSuperior}</span>
        </div>
      )}

      {/* 2. NAVBAR SUPERIOR BOUTIQUE */}
      <nav className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-pink-100 shadow-xs px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          {/* Logo Brand */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-700 to-rose-600 flex items-center justify-center text-white shadow-md shadow-brand-700/20 text-lg">
              🧁
            </div>
            <div>
              <span className="font-serif font-black text-lg tracking-tight text-slate-900 block leading-tight">
                DOLCIANGEL
              </span>
              <span className="text-[9px] font-extrabold uppercase tracking-widest text-brand-700 block -mt-0.5">
                Pastelería Fina & Café
              </span>
            </div>
          </div>

          {/* Enlaces de Navegación Rápida */}
          <div className="flex items-center gap-2">
            <a
              href="#carta"
              className="text-xs font-bold text-slate-700 hover:text-brand-700 px-3 py-1.5 rounded-full hover:bg-pink-50 transition-colors hidden sm:inline"
            >
              Carta del Día
            </a>
            <a
              href="#sedes"
              className="text-xs font-bold text-slate-700 hover:text-brand-700 px-3 py-1.5 rounded-full hover:bg-pink-50 transition-colors hidden sm:inline"
            >
              Nuestras Sedes
            </a>
            <button
              onClick={handleOpenDirectChat}
              className="px-3.5 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-sm transition-all flex items-center gap-1.5 active:scale-95"
            >
              <MessageCircle className="w-3.5 h-3.5 fill-white text-emerald-600" />
              <span>WhatsApp</span>
            </button>
            {onGoToAdmin && (
              <button
                onClick={onGoToAdmin}
                title="Acceso Colaboradores / POS"
                className="p-2 rounded-full text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors ml-1"
              >
                <Lock className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* 3. HERO / PRESENTACIÓN DE DOLCIANGEL */}
      <header className="relative overflow-hidden bg-gradient-to-b from-[#2C1810] via-[#3a2015] to-[#1f100a] text-[#FFFDF8] pt-12 pb-16 px-4">
        {/* Glow de ambientación */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-10 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-8 items-center relative z-10">
          {/* Textos y Llamado a la Acción (7 cols) */}
          <div className="md:col-span-7 space-y-4 text-center md:text-left">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-3.5 py-1 rounded-full text-xs font-bold text-amber-300 border border-white/15 shadow-inner">
              <Sparkles className="w-3.5 h-3.5 text-gold-400" />
              <span>Elaboración 100% Artesanal • Horneado del Día</span>
            </div>

            <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-black leading-tight text-[#F8E7C8] whitespace-pre-line drop-shadow-sm">
              {webConfig.titulo}
            </h1>

            <p className="text-xs sm:text-sm text-amber-100/80 leading-relaxed whitespace-pre-line max-w-lg mx-auto md:mx-0">
              {webConfig.subtitulo}
            </p>

            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 pt-2">
              <a
                href="#carta"
                className="px-6 py-3 rounded-full bg-gradient-to-r from-brand-600 via-rose-600 to-pink-600 hover:from-brand-700 hover:to-pink-700 text-white font-extrabold text-xs sm:text-sm shadow-lg shadow-brand-700/30 transition-all flex items-center gap-2 active:scale-95"
              >
                <span>Explorar Carta Digital</span>
                <span>🍰</span>
              </a>
              <button
                onClick={handleOpenDirectChat}
                className="px-5 py-3 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/20 font-bold text-xs sm:text-sm transition-all flex items-center gap-2 backdrop-blur-sm"
              >
                <PhoneCall className="w-3.5 h-3.5 text-emerald-400" />
                <span>Pedir por WhatsApp</span>
              </button>
            </div>

            {/* Badges de Garantía */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 pt-4 text-[11px] text-amber-200/80 border-t border-white/10">
              <span className="flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-gold-400" />
                <span>Insumos Premium</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Heart className="w-3.5 h-3.5 text-rose-400" />
                <span>Sin Preservantes</span>
              </span>
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Calidad Garantizada</span>
              </span>
            </div>
          </div>

          {/* Banner Fotográfico Protagonista (5 cols) */}
          <div className="md:col-span-5 flex justify-center">
            <div className="relative group max-w-xs sm:max-w-sm w-full">
              <div className="absolute -inset-1 bg-gradient-to-r from-amber-500 to-rose-500 rounded-3xl blur-lg opacity-30 group-hover:opacity-50 transition duration-500" />
              <div className="relative rounded-3xl overflow-hidden border border-white/20 shadow-2xl bg-[#1a0d07] aspect-square flex items-center justify-center p-3">
                <img
                  src={webConfig.imagenUrl}
                  alt="Postres Dolciangel"
                  className="w-full h-full object-cover rounded-2xl transform group-hover:scale-105 transition-transform duration-700"
                  onError={(e) => {
                    e.target.src = 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=800&q=80';
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* 4. PRESENTACIÓN DE HORARIOS & SEDES */}
      <section id="sedes" className="max-w-5xl mx-auto px-4 -mt-8 relative z-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Sede Buenos Aires */}
          <div className="bg-white rounded-3xl p-5 shadow-xl shadow-pink-950/5 border border-pink-100 flex items-start gap-4 transition-all hover:border-pink-300">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-700 to-rose-600 text-white flex items-center justify-center text-xl shrink-0 shadow-md shadow-brand-700/20">
              ☕
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-brand-700 bg-pink-50 px-2 py-0.5 rounded-full">
                  Sede Principal & Café
                </span>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Abierto Hoy
                </span>
              </div>
              <h3 className="font-serif font-bold text-slate-900 text-base mt-1">
                Buenos Aires (Nuevo Chimbote)
              </h3>
              <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-1">
                <MapPin className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                <span>Av. Pacífico Mz. B Lt. 12 - Nuevo Chimbote</span>
              </p>
              <p className="text-xs text-slate-600 flex items-center gap-1.5 mt-1 font-semibold">
                <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>Lunes a Domingo: 3:00 PM – 10:00 PM</span>
              </p>
            </div>
          </div>

          {/* Sede Villa España */}
          <div className="bg-white rounded-3xl p-5 shadow-xl shadow-pink-950/5 border border-pink-100 flex items-start gap-4 transition-all hover:border-pink-300">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-600 to-rose-600 text-white flex items-center justify-center text-xl shrink-0 shadow-md shadow-amber-600/20">
              🏪
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full">
                  Taller & Despacho
                </span>
                <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                  Chimbote
                </span>
              </div>
              <h3 className="font-serif font-bold text-slate-900 text-base mt-1">
                Villa España (Chimbote)
              </h3>
              <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-1">
                <MapPin className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                <span>Villa España Mz. A Lt. 8 - Chimbote</span>
              </p>
              <p className="text-xs text-slate-600 flex items-center gap-1.5 mt-1 font-semibold">
                <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>Lunes a Sábado: 3:30 PM – 9:30 PM</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. CARTA DIGITAL INTERACTIVA */}
      <section id="carta" className="max-w-5xl mx-auto px-4 mt-12 space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 bg-brand-50 text-brand-800 px-3 py-1 rounded-full text-xs font-bold border border-brand-200">
            <span>🍰</span>
            <span>Vitrina del Día • Buenos Aires</span>
          </div>
          <h2 className="font-serif font-bold text-2xl sm:text-3xl text-slate-900">
            Carta Digital Interactiva
          </h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Elige tus postres favoritos con stock confirmado en vivo y envía tu pedido directo a nuestro WhatsApp.
          </p>
        </div>

        {/* Buscador y Filtro de Categorías */}
        <div className="bg-white rounded-3xl shadow-sm border border-pink-100 p-4 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar cheesecake, torta de chocolate, pie de limón..."
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

        {/* Grilla de Productos */}
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
      </section>

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

      {/* 7. BARRA FIJA INFERIOR DEL CARRITO (Sticky Bar cuando hay items) */}
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

      {/* 8. MODAL DE RESUMEN DEL PEDIDO & ENVÍO A WHATSAPP */}
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

      {/* 9. FOOTER CORPORATIVO */}
      <footer className="mt-20 border-t border-pink-100 bg-white py-10 px-4 text-center text-xs text-slate-500 space-y-3">
        <div className="flex items-center justify-center gap-2">
          <span className="text-lg">🧁</span>
          <span className="font-serif font-bold text-slate-900 text-sm">DOLCIANGEL</span>
        </div>
        <p className="max-w-md mx-auto text-[11px] text-slate-400">
          Pastelería Fina & Café • Av. Pacífico Mz. B Lt. 12 (Buenos Aires, Nuevo Chimbote) • Villa España (Chimbote)
        </p>
        <p className="text-[10px] text-slate-400">
          © {new Date().getFullYear()} Dolciangel. Todos los derechos reservados.
        </p>

        {onGoToAdmin && (
          <div className="pt-4 border-t border-slate-100 max-w-xs mx-auto">
            <button
              onClick={onGoToAdmin}
              className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-400 hover:text-brand-700 transition-colors py-1 px-3 rounded-full hover:bg-pink-50"
            >
              <Lock className="w-3 h-3" />
              <span>Acceso Personal / POS (Dolciangel Core)</span>
            </button>
          </div>
        )}
      </footer>
    </div>
  );
};

export default PublicCartaView;
