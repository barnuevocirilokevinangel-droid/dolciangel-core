import React, { useState, useMemo, useEffect, useRef } from 'react';
import { db, collections, onSnapshot, doc, setDoc, serverTimestamp } from '../services/firebase';
import { getProductPrice, getProductStock, extractCategories } from '../services/productUtils';
import { LegalModals } from './LegalModals';
import { 
  Sparkles, 
  MessageCircle, 
  ShoppingBag, 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  ArrowLeft, 
  Lock, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  MapPin, 
  X, 
  ArrowRight, 
  ExternalLink, 
  ChevronRight, 
  ChevronLeft, 
  ChevronUp, 
  ChevronDown,
  BookOpen,
  FileText,
  ShieldCheck,
  Send,
  PhoneCall
} from 'lucide-react';

const DEFAULT_CONFIG = {
  titulo: 'Carta Digital del Día',
  subtitulo: 'Postres artesanales horneados diariamente con stock confirmado en vivo para Buenos Aires (Nuevo Chimbote).',
  avisoSuperior: '✨ Atención hoy en Buenos Aires de 3:00 PM a 10:00 PM • Pedidos y delivery vía WhatsApp',
  telefonoWhatsapp: '51963810237'
};

const HERO_DESSERTS = [
  {
    id: 'redvelvet',
    nombre: 'RED VELVET ARTESANAL',
    tagline: '🍓 SUAVE & ELEGANTE',
    title: 'RED VELVET\nARTESANAL',
    titlePlain: 'RED VELVET ARTESANAL',
    subtitle: 'Bake with love & passion • Hecho hoy',
    price: 'S/ 8.50',
    priceNum: 8.50,
    bgText: 'BERRIES',
    bgColor: '#FEE5EA',
    src: '/assets/hero/red-velvet.png',
    thumb: '/assets/hero/thumb-red-velvet.png',
    satellites: [
      { name: 'Fresa rebanada', src: '/assets/hero/strawberry-top.png', style: { top: '14%', left: '14%', animationDuration: '4.5s' } },
      { name: 'Menta fresca', src: '/assets/hero/mint-left.png', style: { top: '52%', left: '10%', animationDuration: '5.2s' } },
      { name: 'Menta tope', src: '/assets/hero/mint-top.png', style: { top: '16%', right: '16%', animationDuration: '4.8s' } },
      { name: 'Arándano', src: '/assets/hero/blueberry-right.png', style: { top: '42%', right: '12%', animationDuration: '5.8s' } },
      { name: 'Fresa entera', src: '/assets/hero/strawberry-small.png', style: { top: '66%', right: '15%', animationDuration: '4.2s' } }
    ]
  },
  {
    id: 'maracuya',
    nombre: 'CHEESECAKE DE MARACUYÁ',
    tagline: '✨ CÍTRICO & CREMOSO',
    title: 'CHEESECAKE DE\nMARACUYÁ',
    titlePlain: 'CHEESECAKE DE MARACUYÁ',
    subtitle: 'Bake with love & passion • Hecho hoy',
    price: 'S/ 9.00',
    priceNum: 9.00,
    bgText: 'PASSION',
    bgColor: '#FEF3C7',
    src: '/assets/hero/cheesecake-maracuya.png',
    thumb: '/assets/hero/thumb-cheesecake-maracuya.png',
    satellites: [
      { name: 'Mitad maracuyá', src: '/assets/hero/maracuya-half.svg', style: { top: '14%', left: '14%', animationDuration: '4.6s' } },
      { name: 'Menta fresca', src: '/assets/hero/mint-left.png', style: { top: '50%', left: '10%', animationDuration: '5.4s' } },
      { name: 'Menta tope', src: '/assets/hero/mint-top.png', style: { top: '16%', right: '16%', animationDuration: '4.9s' } },
      { name: 'Pulpa maracuyá', src: '/assets/hero/maracuya-half.svg', style: { top: '62%', right: '14%', animationDuration: '5.7s' } }
    ]
  },
  {
    id: 'chocolate',
    nombre: 'TORTA SUPREMA CHOCOLATE',
    tagline: '🍫 INTENSO & HÚMEDO',
    title: 'TORTA SUPREMA\nCHOCOLATE',
    titlePlain: 'TORTA SUPREMA CHOCOLATE',
    subtitle: 'Bake with love & passion • Hecho hoy',
    price: 'S/ 8.50',
    priceNum: 8.50,
    bgText: 'CACAO',
    bgColor: '#EBD5CB',
    src: '/assets/hero/torta-chocolate.png',
    thumb: '/assets/hero/thumb-torta-chocolate.png',
    satellites: [
      { name: 'Frambuesa', src: '/assets/hero/raspberry.svg', style: { top: '14%', left: '14%', animationDuration: '4.4s' } },
      { name: 'Menta fresca', src: '/assets/hero/mint-left.png', style: { top: '50%', left: '10%', animationDuration: '5.2s' } },
      { name: 'Fresa lámina', src: '/assets/hero/strawberry-top.png', style: { top: '16%', right: '16%', animationDuration: '4.8s' } },
      { name: 'Frambuesa', src: '/assets/hero/raspberry.svg', style: { top: '62%', right: '14%', animationDuration: '5.6s' } }
    ]
  }
];

export function resolveProductImg(p) {
  if (!p) return null;
  if (p.imagenUrl && typeof p.imagenUrl === 'string' && p.imagenUrl.trim().length > 5) return p.imagenUrl.trim();
  if (p.imagen && typeof p.imagen === 'string' && p.imagen.trim().length > 5) return p.imagen.trim();
  if (p.foto && typeof p.foto === 'string' && p.foto.trim().length > 5) return p.foto.trim();
  if (p.img && typeof p.img === 'string' && p.img.trim().length > 5) return p.img.trim();
  
  const n = String(p.nombre || '').toLowerCase();
  if (n.includes('maracuy') || n.includes('passion') || n.includes('cheesecake')) return '/assets/hero/cheesecake-maracuya.png';
  if (n.includes('chocolate') || n.includes('moca') || n.includes('selva') || n.includes('cacao') || n.includes('fudge') || n.includes('trufa')) return '/assets/hero/torta-chocolate.png';
  if (n.includes('velvet') || n.includes('fresa') || n.includes('arándano') || n.includes('arandano') || n.includes('lúcuma') || n.includes('lucuma') || n.includes('berries') || n.includes('frutos rojos')) return '/assets/hero/red-velvet.png';
  
  return null;
}

export const PublicCartaView = ({ onNavigate }) => {
  // 1. Estados de datos remotos
  const [productos, setProductos] = useState([]);
  const [webConfig, setWebConfig] = useState(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);

  // 2. Estados de navegación y filtros de catálogo
  const [activeCatalogoTab, setActiveCatalogoTab] = useState('vitrina'); // 'vitrina' | 'pedidos'
  const [selectedCategory, setSelectedCategory] = useState('todos');
  const [searchTerm, setSearchTerm] = useState('');

  // 3. Estados de Hero Showcase
  const [activeFlavor, setActiveFlavor] = useState(0);
  const [isCakeTransitioning, setIsCakeTransitioning] = useState(false);

  // 4. Estados de Carrito y Checkout
  const [cart, setCart] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('dg_cart') || '[]');
    } catch (e) {
      return [];
    }
  });
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [cartBadgePulse, setCartBadgePulse] = useState(false);

  // Formulario Checkout
  const [chkNombre, setChkNombre] = useState('');
  const [chkTelefono, setChkTelefono] = useState('');
  const [chkTipoEntrega, setChkTipoEntrega] = useState('DELIVERY'); // 'DELIVERY' | 'RECOJO'
  const [chkDireccion, setChkDireccion] = useState('');
  const [chkNotas, setChkNotas] = useState('');
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);

  // 5. Estados de Modales
  const [selectedProductModal, setSelectedProductModal] = useState(null);
  const [isLibroOpen, setIsLibroOpen] = useState(false);
  const [isTerminosOpen, setIsTerminosOpen] = useState(false);
  const [isPrivacidadOpen, setIsPrivacidadOpen] = useState(false);

  // Toast flotante
  const [toast, setToast] = useState(null);
  const toastTimeoutRef = useRef(null);

  const showToast = (message, type = 'info') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ message, type });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, 3200);
  };

  // Guardar carrito en localStorage
  useEffect(() => {
    try {
      localStorage.setItem('dg_cart', JSON.stringify(cart));
    } catch (e) {
      console.warn('Error guardando carrito:', e);
    }
  }, [cart]);

  // Suscripción en tiempo real a 'configuracion/web_publica'
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

  // Suscripción en tiempo real a colección 'productos'
  useEffect(() => {
    const unsubProds = onSnapshot(collections.productos, (snapshot) => {
      const prods = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setProductos(prods);
      setLoading(false);
    }, (error) => {
      console.error("Error al cargar productos en carta pública:", error);
      setLoading(false);
    });

    return () => unsubProds();
  }, []);

  // Cambiar sabor del hero con animación
  const handleSelectFlavor = (index) => {
    if (index === activeFlavor || isCakeTransitioning) return;
    setIsCakeTransitioning(true);
    setTimeout(() => {
      setActiveFlavor(index);
      setIsCakeTransitioning(false);
    }, 280);
  };

  const handlePrevFlavor = () => {
    const nextIdx = (activeFlavor - 1 + HERO_DESSERTS.length) % HERO_DESSERTS.length;
    handleSelectFlavor(nextIdx);
  };

  const handleNextFlavor = () => {
    const nextIdx = (activeFlavor + 1) % HERO_DESSERTS.length;
    handleSelectFlavor(nextIdx);
  };

  // Filtrado de productos disponibles
  const availablePublicProducts = useMemo(() => {
    return productos.filter(p => {
      const isVisible = (p.mostrar_en_carta !== false) && (p.visible_BA !== false);
      return isVisible;
    });
  }, [productos]);

  // Categorías dinámicas
  const dynamicCategories = useMemo(() => {
    return extractCategories(availablePublicProducts);
  }, [availablePublicProducts]);

  // Filtrado final de productos para la cuadrícula
  const filteredProducts = useMemo(() => {
    const needle = searchTerm.toLowerCase().trim();
    return availablePublicProducts.filter(p => {
      // 1. Pestaña: Vitrina del día vs Tortas enteras & pedidos grandes
      const matchTab = activeCatalogoTab === 'vitrina' ? !p.esPedidoGrande : Boolean(p.esPedidoGrande);
      // 2. Categoría
      const matchCat = selectedCategory === 'todos' || p.categoria?.toLowerCase() === selectedCategory.toLowerCase();
      // 3. Buscador
      const matchSearch = !needle || 
        p.nombre?.toLowerCase().includes(needle) || 
        p.descripcion?.toLowerCase().includes(needle);

      return matchTab && matchCat && matchSearch;
    });
  }, [availablePublicProducts, activeCatalogoTab, selectedCategory, searchTerm]);

  // Selección editorial Dolciangel (primeros 5 productos destacados o con mayor stock)
  const dolciSelectionProducts = useMemo(() => {
    const pool = availablePublicProducts.filter(p => !p.esPedidoGrande);
    const sorted = [...pool].sort((a, b) => {
      const stockA = getProductStock(a, 'BA');
      const stockB = getProductStock(b, 'BA');
      return stockB - stockA;
    });
    return sorted.slice(0, 5);
  }, [availablePublicProducts]);

  // Operaciones del Carrito
  const cartCount = useMemo(() => {
    return cart.reduce((acc, it) => acc + (it.qty || 0), 0);
  }, [cart]);

  const cartTotal = useMemo(() => {
    return cart.reduce((acc, it) => acc + (it.precioNum * it.qty), 0);
  }, [cart]);

  const triggerCartBadgePulse = () => {
    setCartBadgePulse(true);
    setTimeout(() => setCartBadgePulse(false), 400);
  };

  const handleAddToCart = (product, qtyToAdd = 1) => {
    const stockBA = getProductStock(product, 'BA');
    const price = getProductPrice(product, 'BA');

    // Validación de stock solo para productos de vitrina diaria
    if (!product.esPedidoGrande && stockBA <= 0) {
      showToast(`El producto "${product.nombre}" está agotado hoy en vitrina`, 'warning');
      return;
    }

    setCart(prev => {
      const existingIdx = prev.findIndex(item => String(item.id) === String(product.id));
      if (existingIdx !== -1) {
        const currentQty = prev[existingIdx].qty;
        if (!product.esPedidoGrande && (currentQty + qtyToAdd) > stockBA) {
          showToast(`Solo quedan ${stockBA} porciones disponibles de "${product.nombre}" hoy`, 'warning');
          return prev;
        }
        const updated = [...prev];
        updated[existingIdx] = {
          ...updated[existingIdx],
          qty: currentQty + qtyToAdd
        };
        return updated;
      }

      if (!product.esPedidoGrande && qtyToAdd > stockBA) {
        showToast(`Solo quedan ${stockBA} porciones disponibles hoy`, 'warning');
        return prev;
      }

      return [
        ...prev,
        {
          id: product.id,
          rawId: product.id,
          nombre: product.nombre,
          em: '🍰',
          precioNum: price,
          precioFormatted: `S/ ${price.toFixed(2)}`,
          qty: qtyToAdd,
          esPedidoGrande: Boolean(product.esPedidoGrande),
          image: resolveProductImg(product)
        }
      ];
    });

    triggerCartBadgePulse();
    showToast(`✨ Añadido: ${product.nombre}`, 'success');
  };

  const handleAddHeroToCart = () => {
    const heroItem = HERO_DESSERTS[activeFlavor];
    setCart(prev => {
      const existingIdx = prev.findIndex(item => item.id === heroItem.id);
      if (existingIdx !== -1) {
        const updated = [...prev];
        updated[existingIdx].qty += 1;
        return updated;
      }
      return [
        ...prev,
        {
          id: heroItem.id,
          rawId: heroItem.id,
          nombre: heroItem.titlePlain,
          em: '🍰',
          precioNum: heroItem.priceNum,
          precioFormatted: heroItem.price,
          qty: 1,
          esPedidoGrande: false,
          image: heroItem.src
        }
      ];
    });
    triggerCartBadgePulse();
    showToast(`✨ Añadido: ${heroItem.titlePlain}`, 'success');
  };

  const handleUpdateCartQty = (id, delta) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.id === id) {
          const newQty = item.qty + delta;
          if (newQty <= 0) return null;
          return { ...item, qty: newQty };
        }
        return item;
      }).filter(Boolean);
    });
    triggerCartBadgePulse();
  };

  const handleClearCart = () => {
    setCart([]);
    triggerCartBadgePulse();
    showToast('Carrito vaciado', 'info');
  };

  // Enviar pedido vía WhatsApp
  const handleOpenDirectChat = (customMsg) => {
    const phone = webConfig.telefonoWhatsapp || '51963810237';
    const msg = customMsg || '¡Hola Dolciangel! 🧁 Deseo consultar la carta y disponibilidad de postres de hoy.';
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // Submit del Formulario de Checkout E-commerce
  const handleCheckoutSubmit = async (e) => {
    e.preventDefault();
    if (cart.length === 0) return;

    if (!chkNombre.trim()) {
      showToast('Por favor ingresa tu nombre y apellido', 'error');
      return;
    }

    const cleanPhone = chkTelefono.replace(/\D/g, '').trim();
    if (cleanPhone.length !== 9 || !cleanPhone.startsWith('9')) {
      showToast('Ingresa un número de celular peruano válido (9 dígitos comenzando con 9)', 'error');
      return;
    }

    if (chkTipoEntrega === 'DELIVERY' && chkDireccion.trim().length < 5) {
      showToast('Por favor ingresa tu dirección exacta de entrega y referencia', 'error');
      return;
    }

    setIsSubmittingOrder(true);
    const orderId = `WEB-${Date.now().toString().slice(-6)}`;
    const total = cartTotal;
    const modalidadTexto = chkTipoEntrega === 'DELIVERY'
      ? `🛵 Delivery a domicilio`
      : `🏪 Recojo en Tienda (Buenos Aires)`;
    const direccionFinal = chkTipoEntrega === 'DELIVERY'
      ? chkDireccion.trim()
      : 'Local Buenos Aires: Av. Pacífico Mz. B Lt. 12, Nuevo Chimbote';

    const orderPayload = {
      id: orderId,
      fecha: new Date().toISOString(),
      cliente: {
        nombre: chkNombre.trim(),
        telefono: cleanPhone,
        tipoEntrega: chkTipoEntrega,
        direccion: direccionFinal,
        notas: chkNotas.trim() || ''
      },
      items: cart.map(i => ({
        id: String(i.id),
        nombre: i.nombre,
        cantidad: i.qty,
        precio: i.precioNum,
        subtotal: Number((i.precioNum * i.qty).toFixed(2))
      })),
      total: Number(total.toFixed(2)),
      sede: 'BA',
      sedeNombre: 'Buenos Aires',
      estado: 'PENDIENTE_YAPE',
      origen: 'CARTA_WEB_ECOMMERCE'
    };

    // 1. Guardar en Firestore 'pedidos_web'
    try {
      await setDoc(doc(db, 'pedidos_web', orderId), {
        ...orderPayload,
        timestamp: serverTimestamp()
      });
    } catch (err) {
      console.warn('Aviso guardando en pedidos_web:', err);
    }

    // 2. Formateo exacto del mensaje de WhatsApp oficial
    const itemsText = cart.map(i => `• *${i.qty}x* ${i.nombre} — S/ ${(i.precioNum * i.qty).toFixed(2)}`).join('\n');
    const entregaLinea = chkTipoEntrega === 'DELIVERY'
      ? `🛵 *Entrega:* Delivery: ${chkDireccion.trim()}`
      : `🏪 *Entrega:* Recojo en Tienda (Buenos Aires, Nuevo Chimbote)`;
    const notasLinea = chkNotas.trim() ? `\n📝 *Notas:* ${chkNotas.trim()}` : '';

    const waMessage = 
      `🧁 *¡NUEVO PEDIDO WEB DOLCIANGEL!* 🍰\n\n` +
      `🆔 *Código:* #${orderId}\n` +
      `👤 *Cliente:* ${chkNombre.trim()}\n` +
      `📱 *WhatsApp:* ${cleanPhone}\n` +
      `${entregaLinea}${notasLinea}\n\n` +
      `🛒 *DETALLE DEL PEDIDO:*\n${itemsText}\n\n` +
      `💰 *TOTAL A PAGAR: S/ ${total.toFixed(2)}*\n` +
      `⚡ *Método de Pago:* Yape / Plin / Efectivo\n\n` +
      `¡Hola Dolciangel! Acabo de confirmar mi pedido en la carta web. ¿Me confirman para realizar el pago por Yape? ¡Muchas gracias! ✨`;

    const phone = webConfig.telefonoWhatsapp || '51963810237';
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(waMessage)}`, '_blank');

    // Limpieza
    setCart([]);
    setIsCheckoutOpen(false);
    setIsCartOpen(false);
    setIsSubmittingOrder(false);
    showToast('¡Pedido enviado con éxito! Abriendo WhatsApp... ✨', 'success');
  };

  const currentHero = HERO_DESSERTS[activeFlavor];
  const leftHero = HERO_DESSERTS[(activeFlavor - 1 + HERO_DESSERTS.length) % HERO_DESSERTS.length];
  const rightHero = HERO_DESSERTS[(activeFlavor + 1) % HERO_DESSERTS.length];

  return (
    <div className="carta-page selection:bg-amber-900 selection:text-white" style={{ background: 'var(--page, #FFFDF8)', minHeight: '100vh' }}>
      
      {/* 0. Noise texture background */}
      <div className="noise" aria-hidden="true"></div>

      {/* 1. BARRA DE AVISO / TICKER SUPERIOR */}
      {webConfig.avisoSuperior && (
        <div className="bg-gradient-to-r from-[#2C1810] via-[#4A2411] to-[#2C1810] text-[#FFFDF8] text-xs font-semibold py-2 px-4 shadow-sm text-center flex items-center justify-center gap-2 border-b border-amber-900/20">
          <span className="text-amber-400">✨</span>
          <span className="tracking-wide text-xs">{webConfig.avisoSuperior}</span>
        </div>
      )}

      {/* 2. NAV CARTA BOUTIQUE (1:1 de dolciangel-carta-web) */}
      <nav className="carta-nav" aria-label="Navegación carta">
        <div className="container carta-nav__inner">
          <button 
            type="button" 
            onClick={() => onNavigate && onNavigate('landing')} 
            className="carta-nav__back" 
            aria-label="Volver al inicio"
          >
            <span className="carta-nav__back-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </span>
            <span className="carta-nav__back-label">Inicio</span>
          </button>

          <a 
            href="#carta" 
            onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }} 
            className="carta-nav__logo" 
            aria-label="Dolciangel, volver al inicio"
          >
            <span className="carta-nav__wordmark font-serif">Dolciangel</span>
            <span className="carta-nav__descriptor">Carta artesanal</span>
          </a>

          <div className="carta-nav__actions flex items-center gap-2">
            <button 
              className="nav__cart-btn carta-nav__cart" 
              id="cartBtn" 
              type="button"
              onClick={() => setIsCartOpen(true)} 
              aria-label="Ver carrito" 
              style={{ color: 'var(--ink-2, #5A3A25)' }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="22" height="22" aria-hidden="true">
                <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
                <line x1="3" y1="6" x2="21" y2="6"/>
                <path d="M16 10a4 4 0 01-8 0"/>
              </svg>
              <span className="carta-nav__cart-label">Carrito</span>
              {cartCount > 0 && (
                <span className={`cart-badge ${cartBadgePulse ? 'is-pulse' : ''}`} id="cartCount" aria-live="polite">
                  {cartCount}
                </span>
              )}
            </button>

            <button 
              type="button"
              className="btn btn--wa btn--sm" 
              id="navWaBtn" 
              onClick={() => handleOpenDirectChat()}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14" aria-hidden="true">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              <span className="carta-nav__order-label">Pedir</span>
            </button>

            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('core')}
                title="Acceso Colaboradores / POS"
                className="p-1.5 rounded-full text-amber-950/40 hover:text-amber-950 hover:bg-amber-100/50 transition-colors ml-1"
                aria-label="Acceso colaborador"
              >
                <Lock className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* 3. HERO SHOWCASE EDITORIAL PREMIUM (1:1 de dolciangel-carta-web) */}
      <section 
        className="hero-showcase hero-section" 
        id="heroShowcase" 
        aria-label="Portada interactiva Dolciangel"
        style={{ backgroundColor: currentHero.bgColor }}
      >
        {/* Grain overlay */}
        <div className="hero-grain-overlay" aria-hidden="true"></div>

        {/* Capa 1: Texto tipográfico gigante trasero (Z-1) */}
        <div className="hero-bg-text-wrap" aria-hidden="true">
          <span className="hero-bg-text" id="heroBgText">{currentHero.bgText}</span>
        </div>

        {/* Contenedor principal con layout editorial */}
        <div className="hero-showcase__container">
          
          {/* Columna Izquierda: Información editorial, precio y CTA */}
          <div className="hero-info">
            <div className="hero-tagline-badge" id="heroTaglineBadge">
              {currentHero.tagline}
            </div>
            <h1 className="hero-title" id="heroDessertTitle">
              {currentHero.title.split('\n').map((line, idx) => (
                <React.Fragment key={idx}>
                  {line}
                  {idx === 0 && <br />}
                </React.Fragment>
              ))}
            </h1>
            <p className="hero-subtitle" id="heroDessertSubtitle">
              {currentHero.subtitle}
            </p>
            <div className="hero-actions">
              <span className="hero-price" id="heroDessertPrice">{currentHero.price}</span>
              <button 
                className="btn-hero-order" 
                id="heroOrderBtn" 
                type="button"
                onClick={handleAddHeroToCart}
              >
                + Añadir a mi Pedido
              </button>
            </div>
          </div>

          {/* Stage Central: Postres laterales 3D + Postre central activo + Satélites */}
          <div className="hero-showcase__stage" id="heroStage">
            
            {/* Postre lateral izquierdo desenfocado */}
            <div 
              className="hero-side-cake hero-side-cake--left cursor-pointer" 
              id="heroSideLeft"
              onClick={handlePrevFlavor}
              title={`Ver ${leftHero.titlePlain}`}
            >
              <img className="hero-side-cake__img" src={leftHero.src} alt={leftHero.titlePlain} />
            </div>

            {/* Satélites flotantes fotográficos en capas */}
            <div className="hero-satellites" id="heroSatellites">
              {currentHero.satellites.map((sat, sIdx) => (
                <img 
                  key={sIdx}
                  className="hero-sat" 
                  src={sat.src} 
                  alt={sat.name}
                  style={sat.style}
                />
              ))}
            </div>

            {/* Postre héroe central activo con sombra y microinteracción */}
            <div className="hero-product-stage hero-interactive" id="heroProductStage">
              <div className="hero-cake-box hero-dessert" id="heroCakeBox">
                <img 
                  className={`hero-product-img hero-main-img hero-cake-transition ${isCakeTransitioning ? 'slide-exit' : ''}`} 
                  id="heroDessertImg" 
                  src={currentHero.src} 
                  alt={currentHero.titlePlain} 
                  draggable="false" 
                />
                <div className="hero-shadow" id="heroShadow"></div>
              </div>
            </div>

            {/* Postre lateral derecho desenfocado */}
            <div 
              className="hero-side-cake hero-side-cake--right cursor-pointer" 
              id="heroSideRight"
              onClick={handleNextFlavor}
              title={`Ver ${rightHero.titlePlain}`}
            >
              <img className="hero-side-cake__img" src={rightHero.src} alt={rightHero.titlePlain} />
            </div>
          </div>

          {/* Columna Derecha: Dock vertical de miniaturas y controles */}
          <aside className="hero-controls" aria-label="Seleccionar postre">
            <div className="hero-vertical-dock">
              <button 
                className="hero-dock-arrow" 
                id="heroPrevBtn" 
                type="button" 
                aria-label="Postre anterior"
                onClick={handlePrevFlavor}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="18 15 12 9 6 15"/>
                </svg>
              </button>

              <div className="hero-thumbs-col" id="heroThumbsCol">
                <div 
                  className="hero-thumb-pointer" 
                  id="heroThumbPointer" 
                  aria-hidden="true"
                  style={{ top: `${activeFlavor * 56 + 18}px` }}
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                    <polygon points="6,12 18,6 18,18"/>
                  </svg>
                </div>

                {HERO_DESSERTS.map((d, idx) => (
                  <button
                    key={d.id}
                    type="button"
                    className={`hero-thumb ${idx === activeFlavor ? 'is-active' : ''}`}
                    onClick={() => handleSelectFlavor(idx)}
                    aria-label={`Ver ${d.titlePlain}`}
                  >
                    <img src={d.thumb} alt={d.titlePlain} onError={(e) => { e.currentTarget.src = d.src; }} />
                  </button>
                ))}
              </div>

              <button 
                className="hero-dock-arrow" 
                id="heroNextBtn" 
                type="button" 
                aria-label="Postre siguiente"
                onClick={handleNextFlavor}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>
            </div>
          </aside>

        </div>

        {/* 4. Marquee continuo inferior (20s boutique dorado) */}
        <div className="marquee-container hero-ticker py-3 border-t border-amber-900/10 bg-amber-50/40 select-none" aria-hidden="true">
          <div className="marquee-content font-semibold tracking-widest text-xs uppercase text-amber-950/70">
            <span className="inline-flex gap-8 px-4">
              <span>✨ BOUTIQUE ARTESANAL</span> <span>•</span>
              <span>🍰 HORNEADO DIARIO EN VILLA ESPAÑA Y BUENOS AIRES</span> <span>•</span>
              <span>🍓 FRUTAS FRESCAS SELECCIONADAS</span> <span>•</span>
              <span>🤎 HECHO CON AMOR Y PASIÓN</span> <span>•</span>
            </span>
            <span className="inline-flex gap-8 px-4">
              <span>✨ BOUTIQUE ARTESANAL</span> <span>•</span>
              <span>🍰 HORNEADO DIARIO EN VILLA ESPAÑA Y BUENOS AIRES</span> <span>•</span>
              <span>🍓 FRUTAS FRESCAS SELECCIONADAS</span> <span>•</span>
              <span>🤎 HECHO CON AMOR Y PASIÓN</span> <span>•</span>
            </span>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
           CARTA INTERACTIVA PRINCIPAL
      ══════════════════════════════════════ */}
      <main>
        <section className="carta" id="carta">
          <div className="container">

            <header className="carta__hd reveal-item">
              <div>
                <span className="carta__eyebrow">Explora por categoría</span>
                <h2 className="carta__title">¿Qué se te antoja hoy?</h2>
              </div>
              <p className="carta__sub">Desliza, descubre y encuentra tu favorito horneado hoy.</p>
            </header>

            {/* Selector de Experiencia: Vitrina del Día vs Pedidos Grandes & Tortas Enteras */}
            <div className="carta-tabs-switch reveal-item" role="tablist" aria-label="Modalidad del catálogo">
              <button 
                id="tabVitrina" 
                className={`carta-tab-btn ${activeCatalogoTab === 'vitrina' ? 'is-active' : ''}`} 
                type="button" 
                role="tab" 
                aria-selected={activeCatalogoTab === 'vitrina'} 
                onClick={() => { setActiveCatalogoTab('vitrina'); setSelectedCategory('todos'); }}
              >
                <span className="carta-tab-btn__ico">🧁</span>
                <div className="carta-tab-btn__txt">
                  <strong>Vitrina del Día</strong>
                  <span>Porciones frescas & bebidas</span>
                </div>
              </button>
              <button 
                id="tabPedidos" 
                className={`carta-tab-btn ${activeCatalogoTab === 'pedidos' ? 'is-active' : ''}`} 
                type="button" 
                role="tab" 
                aria-selected={activeCatalogoTab === 'pedidos'} 
                onClick={() => { setActiveCatalogoTab('pedidos'); setSelectedCategory('todos'); }}
              >
                <span className="carta-tab-btn__ico">🎂</span>
                <div className="carta-tab-btn__txt">
                  <strong>Tortas Enteras & Bocaditos</strong>
                  <span>A pedido para celebraciones</span>
                </div>
              </button>
            </div>

            {/* Chips de Categorías */}
            <div className="cats-wrap cats-wrap--visual reveal-item">
              <div className="cats" id="catsBar" role="tablist" aria-label="Filtrar por categoría">
                <button
                  type="button"
                  className={`cat-chip ${selectedCategory === 'todos' ? 'is-active' : ''}`}
                  onClick={() => setSelectedCategory('todos')}
                  role="tab"
                  aria-selected={selectedCategory === 'todos'}
                >
                  <span className="cat-chip__visual" aria-hidden="true">
                    <span className="cat-chip__em">🍰</span>
                  </span>
                  <span className="cat-chip__content">
                    <span className="cat-chip__name">Todos</span>
                    <span className="cat-chip__count">{availablePublicProducts.length} postres</span>
                  </span>
                  <span className="cat-chip__arrow" aria-hidden="true">↗</span>
                </button>

                {dynamicCategories.map(cat => {
                  const countInCat = availablePublicProducts.filter(p => p.categoria?.toLowerCase() === cat.id.toLowerCase()).length;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      className={`cat-chip ${selectedCategory === cat.id ? 'is-active' : ''}`}
                      onClick={() => setSelectedCategory(cat.id)}
                      role="tab"
                      aria-selected={selectedCategory === cat.id}
                    >
                      <span className="cat-chip__visual" aria-hidden="true">
                        <span className="cat-chip__em">{cat.icon || '🧁'}</span>
                      </span>
                      <span className="cat-chip__content">
                        <span className="cat-chip__name">{cat.label}</span>
                        <span className="cat-chip__count">{countInCat} producto{countInCat !== 1 ? 's' : ''}</span>
                      </span>
                      <span className="cat-chip__arrow" aria-hidden="true">↗</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selección Editorial Dolciangel (Favoritos de la casa) */}
            {dolciSelectionProducts.length > 0 && activeCatalogoTab === 'vitrina' && selectedCategory === 'todos' && !searchTerm && (
              <section className="dolci-selection reveal-item" id="dolciSelection" aria-labelledby="dolciSelectionTitle">
                <header className="dolci-selection__head">
                  <div>
                    <span className="dolci-selection__eyebrow">Favoritos de la casa</span>
                    <h2 className="dolci-selection__title" id="dolciSelectionTitle">Selección <em>Dolciangel</em></h2>
                  </div>
                  <p className="dolci-selection__intro">Cinco creaciones elegidas para convertir cualquier pausa en un momento especial.</p>
                </header>

                <div className="dolci-selection__stage">
                  {/* Tarjeta destacada principal */}
                  {dolciSelectionProducts[0] && (
                    <div className="dolci-selection__featured" id="dolciSelectionFeatured">
                      <button 
                        className="dolci-selection-card text-left" 
                        type="button" 
                        onClick={() => setSelectedProductModal(dolciSelectionProducts[0])}
                      >
                        <span className="dolci-selection-card__media" aria-hidden="true">
                          {resolveProductImg(dolciSelectionProducts[0]) ? (
                            <img 
                              className="dolci-selection-card__image is-loaded" 
                              src={resolveProductImg(dolciSelectionProducts[0])} 
                              alt={dolciSelectionProducts[0].nombre} 
                            />
                          ) : (
                            <span className="dolci-selection-card__emoji">🧁</span>
                          )}
                        </span>
                        <span className="dolci-selection-card__content">
                          <span className="dolci-selection-card__label"><i></i>Recomendado por la casa</span>
                          <strong className="dolci-selection-card__name">{dolciSelectionProducts[0].nombre}</strong>
                          <span className="dolci-selection-card__desc">
                            {dolciSelectionProducts[0].descripcion || 'Un favorito artesanal preparado para disfrutar sin prisa.'}
                          </span>
                          <span className="dolci-selection-card__foot">
                            <b>S/ {getProductPrice(dolciSelectionProducts[0], 'BA').toFixed(2)}</b>
                            <span>Descubrir <i aria-hidden="true">↗</i></span>
                          </span>
                        </span>
                      </button>
                    </div>
                  )}

                  {/* Lista de 4 minitargetas laterales */}
                  <div className="dolci-selection__list" id="dolciSelectionList">
                    {dolciSelectionProducts.slice(1).map((prod) => (
                      <button
                        key={prod.id}
                        className="dolci-selection-mini text-left"
                        type="button"
                        onClick={() => setSelectedProductModal(prod)}
                      >
                        <span className="dolci-selection-mini__media" aria-hidden="true">
                          {resolveProductImg(prod) ? (
                            <img className="dolci-selection-mini__image is-loaded" src={resolveProductImg(prod)} alt={prod.nombre} />
                          ) : (
                            <span className="dolci-selection-mini__emoji">🍰</span>
                          )}
                        </span>
                        <span className="dolci-selection-mini__info">
                          <strong className="dolci-selection-mini__name">{prod.nombre}</strong>
                          <span className="dolci-selection-mini__price">S/ {getProductPrice(prod, 'BA').toFixed(2)}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="dolci-selection__bridge" aria-hidden="true">
                  <span></span><i></i><span></span>
                </div>
              </section>
            )}

            {/* Cabecera del Catálogo Completo */}
            <div className="catalog-head reveal-item">
              <div>
                <span className="catalog-head__eyebrow">La colección completa</span>
                <h2 className="catalog-head__title">Nuestra carta</h2>
              </div>

              {/* Búsqueda */}
              <div className="search">
                <svg className="search__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="17" height="17" aria-hidden="true">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input 
                  type="search" 
                  id="searchInp" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search__inp" 
                  placeholder="Buscar postre, cheesecake, bebida…" 
                  autoComplete="off" 
                  autoCorrect="off" 
                  spellCheck="false" 
                  aria-label="Buscar producto"
                />
                {searchTerm && (
                  <button 
                    className="search__clr" 
                    id="searchClr" 
                    type="button"
                    onClick={() => setSearchTerm('')} 
                    aria-label="Limpiar búsqueda"
                    style={{ display: 'flex' }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14" aria-hidden="true">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Contador de resultados */}
            <p className="carta__meta" id="countLabel" aria-live="polite">
              {filteredProducts.length} producto{filteredProducts.length !== 1 ? 's' : ''} disponible{filteredProducts.length !== 1 ? 's' : ''}
            </p>

            {/* Grid de Productos con Microinteracciones y Stock en Vivo */}
            <div className="products" id="productsGrid" aria-live="polite">
              {filteredProducts.length === 0 ? (
                <div className="empty" style={{ gridColumn: '1/-1' }}>
                  <div className="empty__ico">🧁</div>
                  <div className="empty__ttl">
                    Sin productos {activeCatalogoTab === 'vitrina' ? 'en la vitrina del día' : 'a pedido'} en esta sección
                  </div>
                  <div className="empty__sub">
                    Prueba seleccionando otra categoría o consúltanos pedidos especiales directamente por WhatsApp
                  </div>
                  <button 
                    className="btn btn--wa btn--sm" 
                    type="button"
                    onClick={() => handleOpenDirectChat('Hola Dolciangel 🍰 Quisiera consultar la disponibilidad de un postre.')}
                  >
                    Consultar por WhatsApp
                  </button>
                </div>
              ) : (
                filteredProducts.map((p, i) => {
                  const stockBA = getProductStock(p, 'BA');
                  const price = getProductPrice(p, 'BA');
                  const isAgotado = !p.esPedidoGrande && stockBA <= 0;
                  const isUltimas = !p.esPedidoGrande && stockBA > 0 && stockBA <= 3;
                  const resolvedImg = resolveProductImg(p);

                  return (
                    <div 
                      key={p.id} 
                      className="c-wrap" 
                      style={{ animationDelay: `${Math.min(i * 0.04, 0.32)}s` }}
                    >
                      <div 
                        className={`card card-luxury-hover cursor-pointer ${isAgotado ? 'opacity-75' : ''}`}
                        onClick={() => setSelectedProductModal(p)}
                      >
                        {/* Imagen del Producto */}
                        <div className="card__img relative">
                          <div className="card__img-bg" style={{ background: 'linear-gradient(145deg,#F3E9DD 0%,#E8D9C7 100%)' }}></div>
                          
                          {resolvedImg ? (
                            <img 
                              className="card__img-real is-loaded" 
                              src={resolvedImg} 
                              alt={p.nombre} 
                              loading="lazy" 
                            />
                          ) : (
                            <div className="card__img-placeholder" style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 2, background: 'linear-gradient(145deg,#F5ECE2 0%,#EBDDD0 100%)' }}>
                              <div style={{ width: '52px', height: '52px', borderRadius: '16px', background: 'rgba(255,252,248,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(90,50,31,0.1)', border: '1px solid rgba(198,162,114,0.35)' }}>
                                <span style={{ fontSize: '24px', lineHeight: 1 }}>🧁</span>
                              </div>
                              <span style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontSize: '12px', fontWeight: 600, color: '#5A3825', marginTop: '8px', letterSpacing: '0.03em' }}>
                                Dolciangel
                              </span>
                            </div>
                          )}

                          <div className="card__img-fade"></div>

                          {/* Badges de Stock */}
                          <div className="card__tags">
                            {isAgotado ? (
                              <span className="card__tag" style={{ background: '#FEE2E2', color: '#991B1B', borderColor: '#F87171' }}>
                                🛑 Agotado hoy en vitrina
                              </span>
                            ) : isUltimas ? (
                              <span className="card__tag" style={{ background: '#FEF3C7', color: '#92400E', borderColor: '#FCD34D' }}>
                                ⚡ ¡Últimas {stockBA} porciones!
                              </span>
                            ) : !p.esPedidoGrande ? (
                              <span className="card__tag">
                                ✨ En Vitrina ({stockBA})
                              </span>
                            ) : (
                              <span className="card__tag" style={{ background: '#E0F2FE', color: '#0369A1' }}>
                                🎂 A Pedido
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Cuerpo de la Tarjeta */}
                        <div className="card__body">
                          <div className="card__name">{p.nombre}</div>
                          <div className="card__desc">
                            {p.descripcion || 'Horneado artesanal con ingredientes de primera calidad.'}
                          </div>

                          <div className="card__foot">
                            <span className="card__price">S/ {price.toFixed(2)}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <button 
                                className={`btn-card-add ${isAgotado ? 'opacity-40 pointer-events-none' : ''}`}
                                type="button" 
                                disabled={isAgotado}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddToCart(p);
                                }} 
                                title={isAgotado ? 'Producto agotado' : 'Añadir al carrito'}
                              >
                                {isAgotado ? 'Agotado' : '+ Añadir'}
                              </button>
                              <span className="card__pedir">Ver →</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

          </div>
        </section>
      </main>

      {/* ══════════════════════════════════════
           MODAL DE DETALLE DE PRODUCTO (.pmodal)
      ══════════════════════════════════════ */}
      {selectedProductModal && (
        <div className="pmodal" id="productModal" role="dialog" aria-modal="true" aria-labelledby="pModalName">
          <div className="pmodal__overlay" onClick={() => setSelectedProductModal(null)}></div>
          <div className="pmodal__panel" role="document">
            <button 
              className="pmodal__close" 
              type="button" 
              onClick={() => setSelectedProductModal(null)} 
              aria-label="Cerrar modal"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="18" height="18" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>

            <div className="pmodal__img relative">
              {resolveProductImg(selectedProductModal) ? (
                <img 
                  className="pmodal__img-real is-loaded" 
                  src={resolveProductImg(selectedProductModal)} 
                  alt={selectedProductModal.nombre} 
                />
              ) : (
                <span className="pmodal__emoji" aria-hidden="true">🧁</span>
              )}
            </div>

            <div className="pmodal__scroll">
              <div className="pmodal__hd">
                <h2 className="pmodal__name" id="pModalName">{selectedProductModal.nombre}</h2>
                <span className="pmodal__price">
                  S/ {getProductPrice(selectedProductModal, 'BA').toFixed(2)}
                </span>
              </div>

              <p className="pmodal__desc">
                {selectedProductModal.descripcion || 'Elaborado artesanalmente por maestros pasteleros con ingredientes frescos y balance de dulzor perfecto.'}
              </p>

              <div className="pmodal__details space-y-2 py-3 border-y border-amber-900/10 text-xs text-amber-950/80">
                <div className="flex items-center justify-between">
                  <span>Categoría:</span>
                  <strong className="font-semibold">{selectedProductModal.categoria || 'Pastelería Fina'}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span>Disponibilidad en Buenos Aires:</span>
                  {selectedProductModal.esPedidoGrande ? (
                    <span className="text-sky-700 font-bold">🎂 A Pedido con 24h de anticipación</span>
                  ) : getProductStock(selectedProductModal, 'BA') > 0 ? (
                    <span className="text-emerald-700 font-bold">✨ {getProductStock(selectedProductModal, 'BA')} porciones listas en vitrina</span>
                  ) : (
                    <span className="text-rose-700 font-bold">🛑 Agotado hoy en vitrina</span>
                  )}
                </div>
              </div>

              <div className="pmodal__actions pt-4">
                <button 
                  className={`btn btn--cart btn--lg w-full ${(!selectedProductModal.esPedidoGrande && getProductStock(selectedProductModal, 'BA') <= 0) ? 'opacity-40 pointer-events-none' : ''}`}
                  type="button" 
                  disabled={!selectedProductModal.esPedidoGrande && getProductStock(selectedProductModal, 'BA') <= 0}
                  onClick={() => {
                    handleAddToCart(selectedProductModal);
                    setSelectedProductModal(null);
                  }}
                >
                  🛒 Agregar al carrito
                </button>
                <button 
                  className="btn btn--wa btn--lg w-full" 
                  type="button"
                  onClick={() => {
                    handleOpenDirectChat(`¡Hola Dolciangel! 🧁 Quisiera consultar por el producto: *${selectedProductModal.nombre}*`);
                    setSelectedProductModal(null);
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" aria-hidden="true">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  Pedir por WhatsApp
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════
           CARRITO LATERAL (.cart-drawer)
      ══════════════════════════════════════ */}
      {isCartOpen && (
        <div className="cart-drawer" id="cartDrawer" role="dialog" aria-modal="true" aria-label="Carrito de pedido">
          <div className="cart-drawer__overlay" onClick={() => setIsCartOpen(false)}></div>
          <div className="cart-drawer__panel">
            <div className="cart-drawer__hd">
              <h3 className="cart-drawer__title">Mi carrito</h3>
              <button 
                className="cart-drawer__close" 
                type="button" 
                onClick={() => setIsCartOpen(false)} 
                aria-label="Cerrar carrito"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="18" height="18" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div className="cart-drawer__body">
              {cart.length === 0 ? (
                <div className="cart-empty" id="cartEmpty" style={{ display: 'flex' }}>
                  <span className="cart-empty__ico">🛒</span>
                  <p className="cart-empty__txt">Tu carrito está vacío</p>
                  <button className="btn btn--outline" type="button" onClick={() => setIsCartOpen(false)}>
                    Explorar la carta
                  </button>
                </div>
              ) : (
                <div className="cart-items" id="cartItems">
                  {cart.map((item, i) => (
                    <div key={item.id} className="cart-item" style={{ animationDelay: `${Math.min(i * 0.05, 0.3)}s` }}>
                      <span className="cart-item__emoji">{item.em || '🍰'}</span>
                      <div className="cart-item__info">
                        <div className="cart-item__name">{item.nombre}</div>
                        <div className="cart-item__price">
                          S/ {item.precioNum.toFixed(2)} × {item.qty} = <strong>S/ {(item.precioNum * item.qty).toFixed(2)}</strong>
                        </div>
                      </div>
                      <div className="cart-item__qty">
                        <button 
                          className="cart-item__qty-btn" 
                          type="button" 
                          onClick={() => handleUpdateCartQty(item.id, -1)} 
                          aria-label="Menos"
                        >
                          −
                        </button>
                        <span className="cart-item__qty-num">{item.qty}</span>
                        <button 
                          className="cart-item__qty-btn" 
                          type="button" 
                          onClick={() => handleUpdateCartQty(item.id, 1)} 
                          aria-label="Más"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {cart.length > 0 && (
              <div className="cart-drawer__ft" id="cartFoot" style={{ display: 'flex' }}>
                <div className="cart-total-row">
                  <span>Total estimado</span>
                  <strong id="cartTotal">S/ {cartTotal.toFixed(2)}</strong>
                </div>
                <button 
                  className="btn btn--primary btn--lg w-full flex items-center justify-center gap-2" 
                  id="btnGoCheckout" 
                  type="button" 
                  onClick={() => {
                    setIsCartOpen(false);
                    setIsCheckoutOpen(true);
                  }}
                >
                  Continuar Pedido →
                </button>
                <button 
                  className="cart-clear-btn" 
                  type="button" 
                  onClick={handleClearCart}
                >
                  Vaciar carrito
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════
           BARRA FLOTANTE INFERIOR DE CARRITO (.cart-float-bar)
      ══════════════════════════════════════ */}
      {cartCount > 0 && !isCartOpen && !isCheckoutOpen && (
        <aside 
          className="cart-float-bar" 
          id="cartFloatBar" 
          onClick={() => setIsCartOpen(true)} 
          aria-label="Abrir resumen del carrito"
          style={{ display: 'flex' }}
        >
          <div className="cart-float-bar__left">
            <span className="cart-float-bar__badge" id="floatBadge">{cartCount}</span>
            <div className="cart-float-bar__info">
              <span className="cart-float-bar__title">Mi Carrito</span>
              <span className="cart-float-bar__total" id="floatTotal">S/ {cartTotal.toFixed(2)}</span>
            </div>
          </div>
          <button className="cart-float-bar__cta" type="button">
            <span>Continuar Pedido</span>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        </aside>
      )}

      {/* ══════════════════════════════════════
           MODAL DE CHECKOUT E-COMMERCE (.checkout-modal)
      ══════════════════════════════════════ */}
      {isCheckoutOpen && (
        <div className="checkout-modal" id="checkoutModal" role="dialog" aria-modal="true" aria-labelledby="chkTitle">
          <div className="checkout-modal__overlay" onClick={() => setIsCheckoutOpen(false)}></div>
          <div className="checkout-modal__panel">
            <div className="checkout-modal__header">
              <div className="checkout-modal__icon">🧁</div>
              <div style={{ flex: 1 }}>
                <h3 className="checkout-modal__title" id="chkTitle">Confirmar Pedido Web</h3>
                <p className="checkout-modal__sub">Dolciangel • Sede Buenos Aires (Nuevo Chimbote)</p>
              </div>
              <button 
                className="checkout-modal__close" 
                type="button" 
                onClick={() => setIsCheckoutOpen(false)} 
                aria-label="Cerrar modal"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCheckoutSubmit} className="checkout-modal__body">
              {/* 1. Datos del Cliente */}
              <div className="chk-field">
                <label htmlFor="chkNombre" className="chk-label">Nombre y Apellido <span className="chk-req text-rose-600">*</span></label>
                <input 
                  type="text" 
                  id="chkNombre" 
                  value={chkNombre}
                  onChange={(e) => setChkNombre(e.target.value)}
                  className="chk-input" 
                  required 
                  placeholder="Ej. Ana García" 
                  autoComplete="name" 
                />
              </div>

              <div className="chk-field">
                <label htmlFor="chkTelefono" className="chk-label">Teléfono / WhatsApp (9 dígitos) <span className="chk-req text-rose-600">*</span></label>
                <input 
                  type="tel" 
                  id="chkTelefono" 
                  value={chkTelefono}
                  onChange={(e) => setChkTelefono(e.target.value)}
                  className="chk-input" 
                  required 
                  pattern="[0-9]{9}" 
                  maxLength={9} 
                  placeholder="9XXXXXXXX" 
                  autoComplete="tel" 
                />
                <small className="chk-hint text-xs text-amber-900/60 mt-1">
                  Te contactaremos para validar tu pedido y verificar la captura Yape.
                </small>
              </div>

              {/* 2. Tipo de Entrega */}
              <div className="chk-field">
                <label className="chk-label">Modalidad de Entrega <span className="chk-req text-rose-600">*</span></label>
                <div className="chk-delivery-toggle">
                  <button 
                    type="button" 
                    id="btnTipoDelivery" 
                    className={`chk-toggle-btn ${chkTipoEntrega === 'DELIVERY' ? 'is-active' : ''}`} 
                    onClick={() => setChkTipoEntrega('DELIVERY')}
                  >
                    🛵 Delivery
                  </button>
                  <button 
                    type="button" 
                    id="btnTipoRecojo" 
                    className={`chk-toggle-btn ${chkTipoEntrega === 'RECOJO' ? 'is-active' : ''}`} 
                    onClick={() => setChkTipoEntrega('RECOJO')}
                  >
                    🏪 Recojo en Tienda
                  </button>
                </div>
              </div>

              {/* 3. Dirección de Delivery (condicional) */}
              {chkTipoEntrega === 'DELIVERY' ? (
                <div className="chk-field" id="chkDireccionWrap">
                  <label htmlFor="chkDireccion" className="chk-label">Dirección exacta y referencia <span className="chk-req text-rose-600">*</span></label>
                  <textarea 
                    id="chkDireccion" 
                    value={chkDireccion}
                    onChange={(e) => setChkDireccion(e.target.value)}
                    className="chk-textarea" 
                    rows="2" 
                    required={chkTipoEntrega === 'DELIVERY'}
                    placeholder="Urbanización, calle, número/lote y punto de referencia"
                  ></textarea>
                </div>
              ) : (
                <div className="chk-recojo-box" id="chkRecojoBox" style={{ display: 'flex' }}>
                  <span className="chk-recojo-icon">📍</span>
                  <div>
                    <strong>Sede Buenos Aires:</strong>
                    <p>Av. Pacífico Mz. B Lt. 12, Nuevo Chimbote. Tu pedido estará preparado listo para recoger.</p>
                  </div>
                </div>
              )}

              {/* 4. Notas adicionales */}
              <div className="chk-field">
                <label htmlFor="chkNotas" className="chk-label">Notas o dedicatoria especial (opcional)</label>
                <input 
                  type="text" 
                  id="chkNotas" 
                  value={chkNotas}
                  onChange={(e) => setChkNotas(e.target.value)}
                  className="chk-input" 
                  placeholder="Ej. Velita, dedicatoria, servilletas extra..." 
                />
              </div>

              {/* 5. Resumen del Pedido */}
              <div className="chk-summary">
                <h4 className="chk-summary__title">Resumen de tu compra</h4>
                <div className="chk-summary__items" id="chkSummaryItems">
                  {cart.map(item => (
                    <div key={item.id} className="flex justify-between items-center text-xs py-1 border-b border-amber-900/5">
                      <span>{item.qty}x {item.nombre}</span>
                      <strong>S/ {(item.precioNum * item.qty).toFixed(2)}</strong>
                    </div>
                  ))}
                </div>
                <div className="chk-summary__total-row">
                  <span>Total a Pagar:</span>
                  <strong id="chkSummaryTotal">S/ {cartTotal.toFixed(2)}</strong>
                </div>
              </div>

              <div className="chk-yape-notice">
                ⚡ <span>Al confirmar, serás derivado a nuestro <strong>WhatsApp oficial ({webConfig.telefonoWhatsapp || '51963810237'})</strong> para coordinar el comprobante de Yape/Plin.</span>
              </div>

              <div className="chk-actions flex gap-3 pt-2">
                <button 
                  type="button" 
                  className="btn btn--outline flex-1" 
                  onClick={() => setIsCheckoutOpen(false)}
                >
                  Volver
                </button>
                <button 
                  type="submit" 
                  className="btn btn--primary btn--lg flex-2" 
                  disabled={isSubmittingOrder}
                >
                  {isSubmittingOrder ? 'Registrando...' : 'Confirmar Pedido vía WhatsApp 🚀'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════
           FOOTER BOUTIQUE & CUMPLIMIENTO LEGAL PERÚ (INDECOPI & LEY 29733)
      ══════════════════════════════════════ */}
      <footer className="footer" id="contacto" role="contentinfo">
        <div className="container footer__grid">
          
          {/* Identificación de Marca y Datos Fiscales Reales */}
          <div className="footer__brand">
            <span className="footer__logo font-serif">Dolciangel</span>
            <p className="footer__desc">
              Pastelería artesanal boutique. Horneado fresco cada día con ingredientes naturales en Chimbote y Nuevo Chimbote.
            </p>
            <div className="footer__fiscal text-xs text-amber-900/60 mt-3 space-y-1">
              <p className="font-semibold text-amber-950/80">DOLCIANGEL - PASTELERÍA FINA &amp; CAFÉ</p>
              <p>Razón Social: RUTH PATRICIA CIRILO JARA • RUC: 10427321351</p>
              <p>Dirección Fiscal: Av. Pacífico Mz. B Lt. 12 - Nuevo Chimbote, Áncash</p>
            </div>
          </div>

          {/* Enlaces de Carta */}
          <div className="footer__col">
            <div className="footer__col-title">Carta Digital</div>
            <ul className="footer__links">
              <li>
                <button 
                  type="button" 
                  onClick={() => { setActiveCatalogoTab('vitrina'); window.scrollTo({ top: 500, behavior: 'smooth' }); }} 
                  className="hover:underline text-left"
                >
                  Vitrina del Día
                </button>
              </li>
              <li>
                <button 
                  type="button" 
                  onClick={() => { setActiveCatalogoTab('pedidos'); window.scrollTo({ top: 500, behavior: 'smooth' }); }} 
                  className="hover:underline text-left"
                >
                  Tortas Enteras a Pedido
                </button>
              </li>
              <li>
                <button 
                  type="button" 
                  onClick={() => handleOpenDirectChat('Hola Dolciangel 🍰 Quisiera cotizar bocaditos para un evento.')} 
                  className="hover:underline text-left"
                >
                  Bocaditos &amp; Eventos
                </button>
              </li>
            </ul>
          </div>

          {/* Cumplimiento Legal Perú (Indecopi & Ley 29733) */}
          <div className="footer__col">
            <div className="footer__col-title">Legal &amp; Transparencia</div>
            <ul className="footer__links space-y-2">
              <li>
                <button 
                  type="button"
                  onClick={() => setIsLibroOpen(true)}
                  className="flex items-center gap-1.5 text-xs text-amber-950 font-bold hover:underline"
                >
                  <BookOpen className="w-3.5 h-3.5 text-amber-800" />
                  <span>Libro de Reclamaciones (Indecopi)</span>
                </button>
              </li>
              <li>
                <button 
                  type="button"
                  onClick={() => setIsTerminosOpen(true)}
                  className="flex items-center gap-1.5 text-xs text-amber-900/80 hover:underline"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Términos y Condiciones</span>
                </button>
              </li>
              <li>
                <button 
                  type="button"
                  onClick={() => setIsPrivacidadOpen(true)}
                  className="flex items-center gap-1.5 text-xs text-amber-900/80 hover:underline"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Política de Privacidad (Ley 29733)</span>
                </button>
              </li>
            </ul>
          </div>

        </div>

        {/* Línea inferior de copyright */}
        <div className="container footer__copy flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-amber-900/10 pt-6 mt-8 text-xs text-amber-900/60">
          <p>© {new Date().getFullYear()} Dolciangel — Chimbote &amp; Nuevo Chimbote, Perú. Todos los derechos reservados.</p>
          <p>Conforme al Código de Protección y Defensa del Consumidor (Ley N° 29571).</p>
        </div>
      </footer>

      {/* FAB WhatsApp Flotante */}
      <button 
        type="button"
        className="fab" 
        id="fabWa" 
        onClick={() => handleOpenDirectChat()} 
        aria-label="Pedir por WhatsApp"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" width="26" height="26" aria-hidden="true">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
        <span className="fab__ring"></span>
      </button>

      {/* Modales Legales Perú (Indecopi & Ley 29733) */}
      <LegalModals
        isLibroOpen={isLibroOpen}
        onCloseLibro={() => setIsLibroOpen(false)}
        isTerminosOpen={isTerminosOpen}
        onCloseTerminos={() => setIsTerminosOpen(false)}
        isPrivacidadOpen={isPrivacidadOpen}
        onClosePrivacidad={() => setIsPrivacidadOpen(false)}
      />

      {/* Toast Notification Flotante */}
      {toast && (
        <div 
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full shadow-2xl text-xs font-bold text-white flex items-center gap-2 backdrop-blur-md animate-bounceOnce"
          style={{
            background: toast.type === 'error' ? '#DC2626' : toast.type === 'warning' ? '#D97706' : '#1C0C04'
          }}
        >
          {toast.type === 'error' ? <AlertCircle className="w-4 h-4 text-rose-300" /> :
           toast.type === 'warning' ? <AlertCircle className="w-4 h-4 text-amber-300" /> :
           <CheckCircle className="w-4 h-4 text-emerald-400" />}
          <span>{toast.message}</span>
        </div>
      )}

    </div>
  );
};
