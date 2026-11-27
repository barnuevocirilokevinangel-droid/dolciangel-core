import React, { useState, useMemo, useEffect } from 'react';
import { useApp, SEDES } from '../context/AppContext';
import { validarDNI, validarRUC, consultarDocumento } from '../services/sunatService';
import { getProductPrice, getProductStock, extractCategories } from '../services/productUtils';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  CreditCard,
  Banknote,
  Smartphone,
  Receipt,
  FileText,
  CheckCircle,
  X,
  Sparkles,
  Printer,
  Check,
  Coins,
  Loader2,
  ExternalLink
} from 'lucide-react';

export const VentasView = ({ isCartOpen, setIsCartOpen }) => {
  const {
    productos,
    sede,
    accounts,
    activeAccountId,
    setActiveAccountId,
    activeAccount,
    addAccount,
    removeAccount,
    cart,
    addToCart,
    addCustomItemToCart,
    updateCartQuantity,
    updateCartItemExact,
    removeFromCart,
    clearCart,
    cartTotal,
    cartCount,
    processSale,
    clientesFidelidad,
    showToast
  } = useApp();

  // Modal para agregar ítem personalizado / venta libre de un solo uso
  const [showCustomItemModal, setShowCustomItemModal] = useState(false);
  const [customDescripcion, setCustomDescripcion] = useState('');
  const [customPrecio, setCustomPrecio] = useState('');
  const [customCantidad, setCustomCantidad] = useState(1);

  // Filtrar productos autorizados para el Punto de Venta (POS)
  const productosPOS = useMemo(() => {
    return (productos || []).filter((p) => p && p.controla_stock !== false && p.en_inventario !== false);
  }, [productos]);

  // Categorías derivadas dinámicamente de Firestore
  const dynamicCategories = useMemo(() => extractCategories(productosPOS), [productosPOS]);

  // Buscador Rápido y Categoría Activa
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('todos');

  // Modal para agregar nueva mesa/cuenta
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountType, setNewAccountType] = useState('mesa');

  // Modal de Cobro (SUNAT / Control Interno)
  const [showCheckout, setShowCheckout] = useState(false);
  const [metodoPago, setMetodoPago] = useState('EFECTIVO');
  const [tipoComprobante, setTipoComprobante] = useState('NOTA_VENTA');
  const [clienteDoc, setClienteDoc] = useState('');
  const [clienteNombre, setClienteNombre] = useState('');
  const [clienteDireccion, setClienteDireccion] = useState('');
  const [clienteTelefono, setClienteTelefono] = useState('');
  const [montoRecibido, setMontoRecibido] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Estados de consulta automática ApiPeru para DNI / RUC
  const [isSearchingDoc, setIsSearchingDoc] = useState(false);
  const [docSearchSuccess, setDocSearchSuccess] = useState(null);
  const [docSearchError, setDocSearchError] = useState('');

  // Villa España opera 100% con tickets de control interno
  const isVE = sede === 'VE' || sede === 'villaEspana' || sede === 'Villa España';

  useEffect(() => {
    if (isVE && tipoComprobante !== 'NOTA_VENTA') {
      setTipoComprobante('NOTA_VENTA');
      setClienteDoc('');
      setClienteNombre('');
      setClienteDireccion('');
    }
  }, [isVE, tipoComprobante]);

  // Consulta automática de DNI / RUC en tiempo real con ApiPeru
  useEffect(() => {
    if (isVE || !showCheckout) return;

    const docLimpio = (clienteDoc || '').toString().replace(/\D/g, '').trim();

    if (tipoComprobante === 'BOLETA' && docLimpio.length === 8) {
      let isMounted = true;
      setIsSearchingDoc(true);
      setDocSearchError('');
      setDocSearchSuccess(null);

      consultarDocumento({ dni: docLimpio })
        .then((res) => {
          if (!isMounted) return;
          if (res.success && res.data?.nombre_completo) {
            setClienteNombre(res.data.nombre_completo);
            setDocSearchSuccess('RENIEC');
            setDocSearchError('');
          } else {
            setDocSearchError(res.message || 'DNI no encontrado en RENIEC');
            setDocSearchSuccess(null);
          }
        })
        .catch((err) => {
          if (isMounted) {
            console.warn('Error al consultar DNI:', err);
            setDocSearchError('Error al consultar RENIEC');
            setDocSearchSuccess(null);
          }
        })
        .finally(() => {
          if (isMounted) setIsSearchingDoc(false);
        });

      return () => {
        isMounted = false;
      };
    }

    if (tipoComprobante === 'FACTURA' && docLimpio.length === 11) {
      let isMounted = true;
      setIsSearchingDoc(true);
      setDocSearchError('');
      setDocSearchSuccess(null);

      consultarDocumento({ ruc: docLimpio })
        .then((res) => {
          if (!isMounted) return;
          if (res.success && res.data?.nombre_o_razon_social) {
            setClienteNombre(res.data.nombre_o_razon_social);
            if (res.data?.direccion_completa) {
              setClienteDireccion(res.data.direccion_completa);
            }
            setDocSearchSuccess('SUNAT');
            setDocSearchError('');
          } else {
            setDocSearchError(res.message || 'RUC no encontrado en SUNAT');
            setDocSearchSuccess(null);
          }
        })
        .catch((err) => {
          if (isMounted) {
            console.warn('Error al consultar RUC:', err);
            setDocSearchError('Error al consultar SUNAT');
            setDocSearchSuccess(null);
          }
        })
        .finally(() => {
          if (isMounted) setIsSearchingDoc(false);
        });

      return () => {
        isMounted = false;
      };
    }

    if (docLimpio.length < 8) {
      setDocSearchSuccess(null);
      setDocSearchError('');
    }
  }, [clienteDoc, tipoComprobante, showCheckout, isVE]);

  // Comprobante de la última venta
  const [lastSaleReceipt, setLastSaleReceipt] = useState(null);

  const isSearching = searchTerm.trim().length > 0;

  // Conteo por categoría
  const productsByCategory = useMemo(() => {
    const groups = {};
    (dynamicCategories || []).forEach((c) => {
      if (c && c.id) groups[c.id] = [];
    });
    (productosPOS || []).forEach((p) => {
      if (!p) return;
      const catKey = (p.categoria || 'otros').trim().toLowerCase();
      if (!groups[catKey]) groups[catKey] = [];
      groups[catKey].push(p);
    });
    return groups;
  }, [productosPOS, dynamicCategories]);

  // Lista visible directa (sin acordeones pesados)
  const visibleProducts = useMemo(() => {
    if (isSearching) {
      const term = searchTerm.toLowerCase().trim();
      return productosPOS.filter(
        (p) =>
          p.nombre.toLowerCase().includes(term) ||
          (p.descripcion && p.descripcion.toLowerCase().includes(term)) ||
          (p.categoria && p.categoria.toLowerCase().includes(term))
      );
    }
    if (selectedCategory === 'todos') {
      return productosPOS;
    }
    return productsByCategory[selectedCategory] || [];
  }, [productosPOS, productsByCategory, selectedCategory, searchTerm, isSearching]);

  // Mapa rápido de ítems en carrito
  const cartByProductId = useMemo(() => {
    const map = new Map();
    cart.forEach((c) => map.set(c.product.id, c));
    return map;
  }, [cart]);

  // Autocompletar cliente por celular
  const handlePhoneChange = (e) => {
    const phone = e.target.value.replace(/\D/g, '').slice(0, 9);
    setClienteTelefono(phone);
    if (phone.length === 9) {
      const found = clientesFidelidad.find((c) => c.id === phone);
      if (found && found.nombre) {
        setClienteNombre(found.nombre);
        showToast(`Cliente encontrado: ${found.nombre} (${found.sellos || 0} sellos)`, 'info');
      }
    }
  };

  // Desglose tributario SUNAT
  const opGravada = useMemo(() => cartTotal / 1.18, [cartTotal]);
  const igvCalculado = useMemo(() => cartTotal - opGravada, [cartTotal, opGravada]);

  // Cálculo de vuelto
  const vueltoCalculado = useMemo(() => {
    if (metodoPago !== 'EFECTIVO') return 0;
    const recibido = parseFloat(montoRecibido) || 0;
    return Math.max(0, recibido - cartTotal);
  }, [montoRecibido, cartTotal, metodoPago]);

  const esDniValido = useMemo(() => validarDNI(clienteDoc), [clienteDoc]);
  const esRucValido = useMemo(() => validarRUC(clienteDoc), [clienteDoc]);

  const handleCreateAccount = (e) => {
    e.preventDefault();
    if (!newAccountName.trim()) return;
    addAccount(newAccountName.trim(), newAccountType);
    setNewAccountName('');
    setShowAddAccountModal(false);
  };

  const handleAddCustomItem = (e) => {
    if (e) e.preventDefault();
    const desc = customDescripcion.trim();
    if (!desc) {
      showToast('Ingresa el concepto o descripción del comprobante', 'error');
      return;
    }

    const priceNum = parseFloat(customPrecio);
    if (isNaN(priceNum) || priceNum <= 0) {
      showToast('Ingresa un precio unitario válido mayor a 0', 'error');
      return;
    }

    const qtyNum = Math.max(1, parseInt(customCantidad, 10) || 1);

    const customItem = {
      id: `custom-${Date.now()}`,
      nombre: desc,
      precio: Number(priceNum.toFixed(2)),
      precio_BA: Number(priceNum.toFixed(2)),
      precio_VE: Number(priceNum.toFixed(2)),
      cantidad: qtyNum,
      es_personalizado: true,
      controla_stock: false,
      icono: '✨'
    };

    if (addCustomItemToCart) {
      addCustomItemToCart(customItem, activeAccountId);
    } else {
      addToCart(customItem, activeAccountId, qtyNum);
    }

    showToast(`"${desc}" agregado a ${activeAccount?.name || 'la comanda'}`, 'success');
    setShowCustomItemModal(false);
    setCustomDescripcion('');
    setCustomPrecio('');
    setCustomCantidad(1);
  };

  const handleSetMontoExacto = () => setMontoRecibido(cartTotal.toFixed(2));
  const handleAddEfectivo = (extra) => {
    const actual = parseFloat(montoRecibido) || 0;
    setMontoRecibido((actual + extra).toFixed(2));
  };
  const handleSetBillete = (monto) => setMontoRecibido(monto.toFixed(2));

  const handleTapProductCard = (prod, currentStock, inCartQty) => {
    if (currentStock <= 0) return;
    if (inCartQty >= currentStock) {
      showToast(`Stock máximo alcanzado para "${prod.nombre}" (${currentStock})`, 'warning');
      return;
    }
    addToCart(prod);
  };

  const handleFinalizeSale = async (e) => {
    e.preventDefault();
    if (isProcessing) return;

    if (cartTotal <= 0 || cart.length === 0) {
      showToast('El carrito está vacío. Agrega productos antes de cobrar.', 'warning');
      return;
    }

    const finalTipoComprobante = isVE ? 'NOTA_VENTA' : tipoComprobante;

    if (!isVE && finalTipoComprobante === 'BOLETA') {
      if (!esDniValido) {
        showToast('Para Boleta, el DNI debe tener exactamente 8 dígitos numéricos', 'error');
        return;
      }
      if (!clienteNombre.trim()) {
        showToast('Ingresa el Nombre Completo del cliente para la Boleta', 'error');
        return;
      }
    }

    if (!isVE && finalTipoComprobante === 'FACTURA') {
      if (!esRucValido) {
        showToast('Para Factura, el RUC debe tener 11 dígitos e iniciar con 10 o 20', 'error');
        return;
      }
      if (!clienteNombre.trim()) {
        showToast('Ingresa la Razón Social de la empresa para la Factura', 'error');
        return;
      }
    }

    if (metodoPago === 'EFECTIVO' && (parseFloat(montoRecibido) || 0) < cartTotal) {
      showToast(
        `El monto recibido (S/ ${montoRecibido || '0.00'}) es menor al total (S/ ${cartTotal.toFixed(2)})`,
        'error'
      );
      return;
    }

    setIsProcessing(true);
    try {
      const saleResult = await processSale({
        metodoPago,
        tipoComprobante: finalTipoComprobante,
        clienteDoc: isVE ? '' : clienteDoc,
        clienteNombre,
        clienteDireccion,
        clienteTelefono,
        montoRecibido: metodoPago === 'EFECTIVO' ? montoRecibido : cartTotal,
        vuelto: vueltoCalculado,
        targetAccountId: activeAccountId
      });

      clearCart(activeAccountId);
      setLastSaleReceipt(saleResult);
      setShowCheckout(false);
      setIsCartOpen(false);

      setClienteDoc('');
      setClienteNombre('');
      setClienteDireccion('');
      setDocSearchSuccess(null);
      setDocSearchError('');
      setClienteTelefono('');
      setMontoRecibido('');
      showToast(`¡Comanda de ${activeAccount.name} cobrada con éxito!`, 'success');
    } catch (err) {
      console.error('Error al procesar la venta:', err);
      showToast('Error al procesar la venta: ' + err.message, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResetForNewSale = () => {
    setLastSaleReceipt(null);
    setSearchTerm('');
    setClienteDoc('');
    setClienteNombre('');
    setClienteDireccion('');
    setDocSearchSuccess(null);
    setDocSearchError('');
  };

  return (
    <div className="pb-36 max-w-7xl mx-auto px-2.5 sm:px-4 pt-2 space-y-2">
      {/* ZONA SUPERIOR COMPACTA: Mesas + Buscador + Categorías */}
      <div className="bg-white rounded-2xl p-2.5 shadow-xs border border-pink-100 space-y-2">
        {/* 1. Tira de Cuentas / Mesas en una sola fila deslizable */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {accounts.map((acc) => {
            const isActive = acc.id === activeAccountId;
            const accItemCount = (acc.items || []).reduce((sum, it) => sum + it.quantity, 0);
            const accTotal = (acc.items || []).reduce((sum, it) => sum + it.subtotal, 0);

            return (
              <div
                key={acc.id}
                className={`flex items-center rounded-xl transition-all shrink-0 ${
                  isActive
                    ? 'bg-brand-700 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-pink-50 text-slate-700 border border-slate-200/80'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setActiveAccountId(acc.id)}
                  className="px-2.5 py-1.5 flex items-center gap-1.5 text-left"
                >
                  <span className="text-xs">{acc.type === 'llevar' ? '🛍️' : '🍽️'}</span>
                  <span className="text-xs font-extrabold whitespace-nowrap">{acc.name}</span>
                  {accItemCount > 0 && (
                    <span
                      className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${
                        isActive ? 'bg-gold-400 text-slate-950' : 'bg-brand-600 text-white'
                      }`}
                    >
                      {accItemCount}
                    </span>
                  )}
                  {accTotal > 0 && (
                    <span className={`text-[10px] font-mono font-bold hidden sm:inline ${isActive ? 'text-pink-100' : 'text-brand-700'}`}>
                      S/{accTotal.toFixed(0)}
                    </span>
                  )}
                </button>
                {accounts.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeAccount(acc.id);
                    }}
                    title={`Cerrar ${acc.name}`}
                    className={`pr-2 pl-0.5 py-1 text-[11px] ${
                      isActive ? 'text-pink-200 hover:text-white' : 'text-slate-400 hover:text-rose-600'
                    }`}
                  >
                    ✕
                  </button>
                )}
              </div>
            );
          })}

          <button
            type="button"
            onClick={() => setShowAddAccountModal(true)}
            className="shrink-0 px-2.5 py-1.5 rounded-xl border border-dashed border-pink-300 bg-pink-50/50 hover:bg-pink-100 text-brand-800 text-xs font-extrabold flex items-center gap-1 active:scale-95 whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5 text-brand-700" />
            <span>Mesa</span>
          </button>
        </div>

        {/* 2. Buscador limpio en 1 línea (sin doble lupa) + Botón "+ Libre" */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar postre o bebida..."
              className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-50 border border-slate-200 text-base sm:text-sm font-semibold focus:outline-none focus:border-brand-500 focus:bg-white transition-all"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 flex items-center justify-center text-xs"
              >
                ✕
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setCustomDescripcion('');
              setCustomPrecio('');
              setCustomCantidad(1);
              setShowCustomItemModal(true);
            }}
            className="shrink-0 flex items-center gap-1 px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs shadow-xs active:scale-95 transition-all"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-100" />
            <span>+ Libre</span>
          </button>
        </div>

        {/* 3. Chips de Categorías en 1 sola fila horizontal deslizable */}
        {!isSearching && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5">
            <button
              type="button"
              onClick={() => setSelectedCategory('todos')}
              className={`px-3 py-1.5 rounded-full text-xs font-extrabold whitespace-nowrap transition-all shrink-0 ${
                selectedCategory === 'todos'
                  ? 'bg-brand-700 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Todos ({productosPOS.length})
            </button>
            {dynamicCategories.map((cat) => {
              const count = (productsByCategory[cat.id] || []).length;
              if (count === 0) return null;
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-extrabold whitespace-nowrap transition-all flex items-center gap-1 shrink-0 ${
                    isSelected
                      ? 'bg-brand-700 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.label}</span>
                  <span
                    className={`text-[10px] px-1.5 rounded-full ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* GRILLA COMPACTA DE TOQUE RÁPIDO (CERO IMÁGENES EN MOSTRADOR) */}
      {visibleProducts.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center border border-pink-100 space-y-2">
          <p className="font-serif font-bold text-base text-slate-800">
            No encontramos productos para "{searchTerm}"
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              setSelectedCategory('todos');
            }}
            className="px-4 py-2 rounded-xl bg-brand-700 text-white font-bold text-xs"
          >
            Ver todo el mostrador
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-2.5">
          {visibleProducts.map((prod) => {
            const currentStock = getProductStock(prod, sede);
            const currentPrice = getProductPrice(prod, sede);
            const isOutOfStock = currentStock <= 0;
            const inCartItem = cartByProductId.get(prod.id);
            const qtyInCart = inCartItem ? inCartItem.quantity : 0;

            const stockBadgeClass = isOutOfStock
              ? 'bg-rose-100 text-rose-700 border-rose-200'
              : currentStock <= 5
              ? 'bg-amber-100 text-amber-800 border-amber-200'
              : 'bg-emerald-100 text-emerald-800 border-emerald-200';

            return (
              <div
                key={prod.id}
                role="button"
                tabIndex={isOutOfStock ? -1 : 0}
                onClick={() => handleTapProductCard(prod, currentStock, qtyInCart)}
                className={`relative min-h-[82px] p-2.5 sm:p-3 rounded-2xl border text-left transition-all select-none flex flex-col justify-between ${
                  isOutOfStock
                    ? 'bg-slate-100 border-slate-200 opacity-55 cursor-not-allowed'
                    : qtyInCart > 0
                    ? 'bg-pink-50/80 border-brand-500 ring-1 ring-brand-500/30 shadow-xs active:scale-[0.97] cursor-pointer'
                    : 'bg-white border-slate-200/90 hover:border-pink-300 shadow-2xs active:scale-[0.97] cursor-pointer'
                }`}
              >
                {/* Fila superior: Nombre del producto + Contador si está en cuenta */}
                <div className="flex items-start justify-between gap-1.5">
                  <h4 className="font-bold text-slate-900 text-xs sm:text-sm leading-snug line-clamp-2 flex-1">
                    {prod.nombre}
                  </h4>

                  {qtyInCart > 0 && (
                    <span className="shrink-0 bg-brand-700 text-white font-black text-xs min-w-[24px] h-6 px-1.5 rounded-full flex items-center justify-center shadow-xs">
                      {qtyInCart}
                    </span>
                  )}
                </div>

                {/* Fila inferior: Precio destacado + Badge de Stock + Botón "-" rápido */}
                <div className="flex items-end justify-between gap-1.5 mt-2 pt-1.5 border-t border-slate-100">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-black text-brand-700 text-sm sm:text-base leading-none">
                      S/ {currentPrice.toFixed(2)}
                    </span>
                    <span
                      className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-md border leading-none ${stockBadgeClass}`}
                    >
                      {isOutOfStock ? '0 Agotado' : `Stk ${currentStock}`}
                    </span>
                  </div>

                  {qtyInCart > 0 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateCartQuantity(prod.id, -1);
                      }}
                      title="Restar 1"
                      className="w-7 h-7 rounded-lg bg-white hover:bg-rose-50 border border-brand-200 text-brand-700 hover:text-rose-600 flex items-center justify-center shadow-2xs active:scale-90 shrink-0"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* BARRA FLOTANTE DE CARRITO / COBRO (MOBILE STICKY BAR) */}
      {cartCount > 0 && !isCartOpen && !showCheckout && (
        <div className="fixed bottom-[calc(64px+env(safe-area-inset-bottom))] left-3 right-3 max-w-xl mx-auto z-30">
          <div className="w-full bg-gradient-to-r from-brand-800 via-brand-700 to-pink-600 text-white p-2.5 sm:p-3 rounded-2xl shadow-xl shadow-brand-900/30 flex items-center justify-between gap-2 border border-white/20">
            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              className="flex items-center gap-2.5 min-w-0 flex-1 text-left"
            >
              <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center text-base shrink-0">
                {activeAccount?.type === 'llevar' ? '🛍️' : '🍽️'}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-xs sm:text-sm truncate">
                    {activeAccount?.name}
                  </span>
                  <span className="bg-white/20 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full">
                    {cartCount} {cartCount === 1 ? 'ítem' : 'ítems'}
                  </span>
                </div>
                <span className="text-gold-300 font-black text-sm sm:text-base block leading-tight">
                  S/ {cartTotal.toFixed(2)}
                </span>
              </div>
            </button>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setIsCartOpen(true)}
                className="px-2.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold"
              >
                Ver
              </button>
              <button
                type="button"
                onClick={() => setShowCheckout(true)}
                className="px-4 py-2 rounded-xl bg-white text-brand-800 hover:bg-pink-50 text-xs sm:text-sm font-black shadow-sm active:scale-95 transition-all"
              >
                Cobrar →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BOTTOM SHEET / DRAWER A PANTALLA COMPLETA EN MÓVIL: COMANDA ACTIVA */}
      {isCartOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-stretch sm:justify-end animate-fadeIn"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsCartOpen(false);
          }}
        >
          <div className="bg-white w-full h-[92dvh] sm:h-full sm:max-w-md rounded-t-2xl sm:rounded-none flex flex-col shadow-2xl overflow-hidden">
            {/* Cabecera fija */}
            <div className="p-4 bg-pink-50/80 border-b border-pink-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xl">{activeAccount?.type === 'llevar' ? '🛍️' : '🍽️'}</span>
                <div>
                  <h3 className="font-serif font-bold text-base sm:text-lg text-slate-900 leading-none">
                    {activeAccount?.name}
                  </h3>
                  <span className="text-[11px] text-brand-700 font-bold">
                    {cartCount} {cartCount === 1 ? 'producto' : 'productos'} en cuenta
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {cart.length > 0 && (
                  <button
                    type="button"
                    onClick={() => clearCart()}
                    title="Vaciar comanda"
                    className="p-2 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-rose-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsCartOpen(false)}
                  className="p-2 text-slate-500 hover:text-slate-800 rounded-xl bg-white border border-slate-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Sub-barra para Ítem Libre */}
            <div className="px-4 py-2 bg-amber-50/80 border-b border-amber-100 flex items-center justify-between shrink-0">
              <span className="text-xs text-amber-900 font-semibold">¿Venta personalizada o delivery?</span>
              <button
                type="button"
                onClick={() => {
                  setCustomDescripcion('');
                  setCustomPrecio('');
                  setCustomCantidad(1);
                  setShowCustomItemModal(true);
                }}
                className="text-xs font-extrabold text-amber-900 bg-amber-200/80 hover:bg-amber-300/80 px-3 py-1 rounded-xl flex items-center gap-1"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                <span>+ Ítem Libre</span>
              </button>
            </div>

            {/* Cuerpo scrolleable */}
            <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 p-6">
                  <p className="font-bold text-slate-600 text-sm">Comanda vacía ({activeAccount?.name})</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Toca cualquier tarjeta del mostrador para agregar productos al instante.
                  </p>
                </div>
              ) : (
                cart.map((item) => {
                  const isNoStockControl =
                    item.product.controla_stock === false ||
                    item.product.en_inventario === false ||
                    item.product.es_personalizado;
                  const maxStock = isNoStockControl ? 9999 : getProductStock(item.product, sede);

                  return (
                    <div
                      key={item.product.id}
                      className="flex items-center justify-between gap-2 p-3 rounded-2xl bg-slate-50 border border-slate-200/80"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="font-bold text-slate-900 text-xs sm:text-sm line-clamp-1">
                            {item.product.nombre}
                          </h4>
                          {item.product.es_personalizado && (
                            <span className="text-[9px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200 px-1.5 py-0.2 rounded-md uppercase">
                              Libre
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-brand-700 font-bold">
                          S/ {getProductPrice(item.product, sede).toFixed(2)} c/u
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1">
                          <button
                            type="button"
                            onClick={() => updateCartQuantity(item.product.id, -1)}
                            className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-pink-100 text-slate-700 flex items-center justify-center active:scale-90"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <input
                            type="number"
                            inputMode="numeric"
                            min="1"
                            max={maxStock}
                            value={item.quantity}
                            onChange={(e) => {
                              const raw = e.target.value;
                              if (raw === '') return;
                              const parsed = parseInt(raw, 10);
                              if (isNaN(parsed) || parsed < 1) {
                                updateCartItemExact(item.product.id, 1);
                                return;
                              }
                              if (!isNoStockControl && parsed > maxStock) {
                                showToast(`Stock máximo: ${maxStock}`, 'warning');
                                updateCartItemExact(item.product.id, maxStock);
                                return;
                              }
                              updateCartItemExact(item.product.id, parsed);
                            }}
                            className="w-9 text-center text-base sm:text-sm font-black text-slate-900 bg-transparent border-0 focus:outline-none p-0"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (!isNoStockControl && item.quantity >= maxStock) {
                                showToast(`Stock máximo alcanzado (${maxStock})`, 'warning');
                                return;
                              }
                              addToCart(item.product);
                            }}
                            disabled={!isNoStockControl && item.quantity >= maxStock}
                            className="w-8 h-8 rounded-lg bg-brand-700 disabled:opacity-40 text-white flex items-center justify-center active:scale-90"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="text-right min-w-[58px]">
                          <span className="font-black text-xs sm:text-sm text-slate-900 block">
                            S/ {item.subtotal.toFixed(2)}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeFromCart(item.product.id)}
                          className="text-slate-400 hover:text-rose-600 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer fijo abajo (sticky bottom-0) */}
            <div className="sticky bottom-0 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] bg-white border-t border-slate-200 space-y-3 shrink-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase">Total Cuenta</span>
                <span className="text-xl font-black text-brand-800">S/ {cartTotal.toFixed(2)}</span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsCartOpen(false)}
                  className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs"
                >
                  Seguir Agregando
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsCartOpen(false);
                    setShowCheckout(true);
                  }}
                  disabled={cartTotal <= 0 || cart.length === 0}
                  className="flex-[2] py-3 px-4 rounded-xl bg-brand-700 hover:bg-brand-800 disabled:opacity-50 text-white font-extrabold text-sm shadow-lg shadow-brand-700/25 flex items-center justify-center gap-2"
                >
                  <span>Cobrar Ahora →</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: AGREGAR NUEVA MESA O CUENTA (92dvh en móvil) */}
      {showAddAccountModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-end sm:items-center justify-center sm:p-4 animate-fadeIn"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAddAccountModal(false);
          }}
        >
          <div className="bg-white w-full h-[92dvh] sm:h-auto sm:max-w-sm rounded-t-2xl sm:rounded-3xl shadow-2xl border border-pink-100 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <h3 className="font-serif font-bold text-lg text-slate-900">+ Nueva Cuenta o Mesa</h3>
              <button
                type="button"
                onClick={() => setShowAddAccountModal(false)}
                className="p-2 rounded-xl bg-slate-100 text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateAccount} className="flex-1 flex flex-col justify-between overflow-y-auto">
              <div className="p-5 space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Nombre de la Cuenta o Mesa *
                  </label>
                  <input
                    type="text"
                    value={newAccountName}
                    onChange={(e) => setNewAccountName(e.target.value)}
                    placeholder="Ej. Mesa 04, Barra 2, Para Llevar..."
                    required
                    autoFocus
                    className="w-full px-3.5 py-3 rounded-xl border border-pink-200 text-base font-bold focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">Tipo de Atención</label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setNewAccountType('mesa')}
                      className={`py-3 px-3 rounded-xl text-xs font-extrabold border flex items-center justify-center gap-1.5 ${
                        newAccountType === 'mesa'
                          ? 'border-brand-600 bg-pink-50 text-brand-800'
                          : 'border-slate-200 text-slate-600'
                      }`}
                    >
                      <span>🍽️</span>
                      <span>En Salón</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewAccountType('llevar')}
                      className={`py-3 px-3 rounded-xl text-xs font-extrabold border flex items-center justify-center gap-1.5 ${
                        newAccountType === 'llevar'
                          ? 'border-brand-600 bg-pink-50 text-brand-800'
                          : 'border-slate-200 text-slate-600'
                      }`}
                    >
                      <span>🛍️</span>
                      <span>Para Llevar</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="sticky bottom-0 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] bg-white border-t border-slate-100 flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowAddAccountModal(false)}
                  className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl bg-brand-700 hover:bg-brand-800 text-white font-extrabold text-xs shadow-md"
                >
                  Crear Cuenta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ÍTEM LIBRE / PERSONALIZADO (92dvh en móvil) */}
      {showCustomItemModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-end sm:items-center justify-center sm:p-4 animate-fadeIn"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowCustomItemModal(false);
          }}
        >
          <div className="bg-white w-full h-[92dvh] sm:h-auto sm:max-w-md rounded-t-2xl sm:rounded-3xl shadow-2xl border border-pink-100 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-base sm:text-lg text-slate-900 leading-tight">
                    + Ítem Libre / Personalizado
                  </h3>
                  <span className="text-[11px] text-brand-700 font-bold block">
                    Cuenta: {activeAccount?.name || 'Activa'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCustomItemModal(false)}
                className="p-2 rounded-xl bg-slate-100 text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddCustomItem} className="flex-1 flex flex-col justify-between overflow-y-auto">
              <div className="p-5 space-y-4">
                <div>
                  <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 block mb-1.5">
                    Sugerencias rápidas:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      '🎂 Torta Personalizada',
                      '🛵 Servicio de Delivery',
                      '🧁 Bocaditos Evento',
                      '✨ Decoración Especial',
                      '📦 Empaque para Regalo'
                    ].map((sug, idx) => {
                      const cleanText = sug.replace(/^[^a-zA-ZáéíóúÁÉÍÓÚñÑ]+/, '');
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setCustomDescripcion(cleanText)}
                          className="text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 px-2.5 py-1.5 rounded-xl"
                        >
                          {sug}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Concepto / Descripción del comprobante *
                  </label>
                  <input
                    type="text"
                    value={customDescripcion}
                    onChange={(e) => setCustomDescripcion(e.target.value)}
                    placeholder="Ej. Torta personalizada 1 Kg, Delivery..."
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-base font-semibold focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Precio Unitario (S/.) *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                        S/
                      </span>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="0.01"
                        value={customPrecio}
                        onChange={(e) => setCustomPrecio(e.target.value)}
                        placeholder="0.00"
                        required
                        className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-slate-200 text-base font-black text-slate-900 focus:outline-none focus:border-brand-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Cantidad *</label>
                    <div className="flex items-center">
                      <button
                        type="button"
                        onClick={() =>
                          setCustomCantidad((prev) => Math.max(1, (parseInt(prev, 10) || 1) - 1))
                        }
                        className="w-10 h-[44px] rounded-l-xl bg-slate-100 text-slate-700 font-bold flex items-center justify-center border border-r-0 border-slate-200"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <input
                        type="number"
                        inputMode="numeric"
                        min="1"
                        value={customCantidad}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          setCustomCantidad(isNaN(val) ? '' : Math.max(1, val));
                        }}
                        required
                        className="w-full h-[44px] text-center font-black text-slate-900 border-y border-slate-200 text-base focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setCustomCantidad((prev) => (parseInt(prev, 10) || 1) + 1)}
                        className="w-10 h-[44px] rounded-r-xl bg-slate-100 text-slate-700 font-bold flex items-center justify-center border border-l-0 border-slate-200"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-900">Subtotal ítem:</span>
                  <span className="font-serif font-black text-lg text-amber-950">
                    S/ {((parseFloat(customPrecio) || 0) * (parseInt(customCantidad, 10) || 1)).toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="sticky bottom-0 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] bg-white border-t border-slate-100 flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowCustomItemModal(false)}
                  className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs shadow-md flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Agregar</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL / BOTTOM SHEET DE COBRO (92dvh en móvil, cabecera y footer fijos) */}
      {showCheckout && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-end sm:items-center justify-center sm:p-4 animate-fadeIn"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isProcessing) setShowCheckout(false);
          }}
        >
          <div className="bg-white w-full h-[92dvh] sm:h-auto sm:max-h-[92vh] sm:max-w-lg rounded-t-2xl sm:rounded-3xl shadow-2xl border border-pink-100 flex flex-col overflow-hidden">
            {/* Header Fijo */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-brand-700 to-pink-600 text-white flex items-center justify-between shrink-0 shadow-md">
              <div>
                <span className="text-[11px] text-pink-200 font-bold uppercase tracking-wider block">
                  Cuenta: {activeAccount?.name} ({cartCount} ítems)
                </span>
                <h3 className="font-serif font-bold text-lg sm:text-xl">Confirmar Cobro</h3>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="text-[10px] text-pink-200 block uppercase">Total</span>
                  <span className="text-xl sm:text-2xl font-black text-gold-300">
                    S/ {cartTotal.toFixed(2)}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => setShowCheckout(false)}
                  className="p-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <form onSubmit={handleFinalizeSale} className="flex-1 flex flex-col justify-between overflow-hidden">
              {/* Cuerpo scrolleable */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
                {/* 1. Método de Pago */}
                <div>
                  <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider block mb-2">
                    1. Método de Pago *
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'EFECTIVO', label: 'Efectivo', icon: Banknote },
                      { id: 'YAPE_PLIN', label: 'Yape / Plin', icon: Smartphone },
                      { id: 'TARJETA', label: 'Tarjeta POS', icon: CreditCard }
                    ].map((m) => {
                      const Icon = m.icon;
                      const isSelected = metodoPago === m.id;
                      return (
                        <button
                          type="button"
                          key={m.id}
                          onClick={() => setMetodoPago(m.id)}
                          className={`p-3 rounded-2xl border-2 flex flex-col items-center justify-center gap-1 transition-all text-xs font-extrabold ${
                            isSelected
                              ? 'border-brand-600 bg-pink-50 text-brand-800 shadow-xs'
                              : 'border-slate-200 text-slate-600'
                          }`}
                        >
                          <Icon className={`w-5 h-5 ${isSelected ? 'text-brand-700' : 'text-slate-400'}`} />
                          <span>{m.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Controles Táctiles para Efectivo */}
                {metodoPago === 'EFECTIVO' && (
                  <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-amber-950 flex items-center gap-1">
                        <Coins className="w-4 h-4 text-amber-700" />
                        <span>Efectivo recibido:</span>
                      </span>
                      <button
                        type="button"
                        onClick={handleSetMontoExacto}
                        className="px-2.5 py-1 rounded-lg bg-amber-200 hover:bg-amber-300 text-amber-950 text-xs font-black"
                      >
                        Monto Exacto (S/ {cartTotal.toFixed(2)})
                      </button>
                    </div>

                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-base">
                        S/
                      </span>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.1"
                        min={0}
                        value={montoRecibido}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (!val.startsWith('-')) setMontoRecibido(val);
                        }}
                        placeholder={cartTotal.toFixed(2)}
                        className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-amber-300 bg-white font-black text-slate-900 focus:outline-none focus:border-amber-500 text-base"
                      />
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {[10, 20, 50, 100].map((inc) => (
                        <button
                          type="button"
                          key={inc}
                          onClick={() => handleAddEfectivo(inc)}
                          className="px-3 py-1.5 rounded-xl bg-white border border-amber-300 text-amber-900 text-xs font-extrabold active:scale-95"
                        >
                          +S/{inc}
                        </button>
                      ))}
                      {[20, 50, 100, 200].map((billete) => (
                        <button
                          type="button"
                          key={'b-' + billete}
                          onClick={() => handleSetBillete(billete)}
                          className="px-2.5 py-1.5 rounded-xl bg-amber-100 text-amber-800 text-xs font-bold"
                        >
                          Billete S/{billete}
                        </button>
                      ))}
                    </div>

                    {parseFloat(montoRecibido) >= cartTotal ? (
                      <div className="p-3 rounded-2xl bg-emerald-600 text-white flex items-center justify-between">
                        <span className="text-xs font-extrabold uppercase">Vuelto a entregar:</span>
                        <span className="text-2xl font-black font-mono">
                          S/ {vueltoCalculado.toFixed(2)}
                        </span>
                      </div>
                    ) : parseFloat(montoRecibido) > 0 ? (
                      <div className="p-2 rounded-xl bg-rose-100 border border-rose-300 text-rose-800 text-center text-xs font-bold">
                        Falta S/ {(cartTotal - parseFloat(montoRecibido)).toFixed(2)}
                      </div>
                    ) : null}
                  </div>
                )}

                {/* 2. Comprobante SUNAT / Control Interno */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                      2. Comprobante *
                    </label>
                    {isVE && (
                      <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">
                        Villa España: Control Interno
                      </span>
                    )}
                  </div>

                  {isVE ? (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between">
                      <span className="font-extrabold text-xs text-amber-950">
                        🧾 Nota de Venta / Control Interno
                      </span>
                      <span className="bg-amber-200 text-amber-900 text-[10px] font-extrabold px-2 py-0.5 rounded-lg">
                        VE
                      </span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-2xl">
                      {[
                        { id: 'NOTA_VENTA', label: 'Nota Venta' },
                        { id: 'BOLETA', label: 'Boleta SUNAT' },
                        { id: 'FACTURA', label: 'Factura SUNAT' }
                      ].map((c) => {
                        const isSelected = tipoComprobante === c.id;
                        return (
                          <button
                            type="button"
                            key={c.id}
                            onClick={() => {
                              setTipoComprobante(c.id);
                              setClienteDoc('');
                              if (c.id === 'NOTA_VENTA') setClienteNombre('');
                            }}
                            className={`py-2.5 px-2 rounded-xl text-xs font-extrabold transition-all ${
                              isSelected
                                ? 'bg-white text-brand-800 shadow-xs border border-pink-100'
                                : 'text-slate-500'
                            }`}
                          >
                            {c.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Boleta DNI */}
                {!isVE && tipoComprobante === 'BOLETA' && (
                  <div className="p-3.5 rounded-2xl bg-pink-50/60 border border-pink-200 space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold text-brand-900">
                      <span className="flex items-center gap-1.5">
                        <Receipt className="w-4 h-4 text-brand-700" />
                        <span>Boleta Electrónica (B002)</span>
                      </span>
                      {isSearchingDoc && (
                        <span className="text-[11px] text-brand-600 flex items-center gap-1">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> RENIEC...
                        </span>
                      )}
                      {!isSearchingDoc && docSearchSuccess === 'RENIEC' && (
                        <span className="text-[11px] text-emerald-700 flex items-center gap-0.5">
                          <Check className="w-3.5 h-3.5" /> Verificado
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">
                          DNI (8 dígitos) *
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={8}
                          value={clienteDoc}
                          onChange={(e) => setClienteDoc(e.target.value.replace(/\D/g, ''))}
                          placeholder="Ej. 45678912"
                          required
                          className="w-full px-3 py-2.5 rounded-xl border border-pink-200 text-base font-mono font-bold bg-white focus:outline-none focus:border-brand-500"
                        />
                        {docSearchError && (
                          <p className="text-[10px] text-rose-600 font-semibold mt-1">{docSearchError}</p>
                        )}
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">
                          Nombre Completo *
                        </label>
                        <input
                          type="text"
                          value={clienteNombre}
                          onChange={(e) => setClienteNombre(e.target.value)}
                          placeholder="Nombres y Apellidos"
                          required
                          className="w-full px-3 py-2.5 rounded-xl border border-pink-200 text-base font-bold bg-white focus:outline-none focus:border-brand-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Factura RUC */}
                {!isVE && tipoComprobante === 'FACTURA' && (
                  <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold text-amber-950">
                      <span className="flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-amber-700" />
                        <span>Factura Electrónica (F001)</span>
                      </span>
                      {isSearchingDoc && (
                        <span className="text-[11px] text-amber-700 flex items-center gap-1">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> SUNAT...
                        </span>
                      )}
                      {!isSearchingDoc && docSearchSuccess === 'SUNAT' && (
                        <span className="text-[11px] text-emerald-700 flex items-center gap-0.5">
                          <Check className="w-3.5 h-3.5" /> Verificado
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">
                          RUC (11 dígitos) *
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={11}
                          value={clienteDoc}
                          onChange={(e) => setClienteDoc(e.target.value.replace(/\D/g, ''))}
                          placeholder="20601234567"
                          required
                          className="w-full px-3 py-2.5 rounded-xl border border-amber-300 text-base font-mono font-bold bg-white focus:outline-none focus:border-amber-500"
                        />
                        {docSearchError && (
                          <p className="text-[10px] text-rose-600 font-semibold mt-1">{docSearchError}</p>
                        )}
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">
                          Razón Social *
                        </label>
                        <input
                          type="text"
                          value={clienteNombre}
                          onChange={(e) => setClienteNombre(e.target.value)}
                          placeholder="EMPRESA S.A.C."
                          required
                          className="w-full px-3 py-2.5 rounded-xl border border-amber-300 text-base font-bold bg-white focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>
                    {clienteDireccion && (
                      <input
                        type="text"
                        value={clienteDireccion}
                        onChange={(e) => setClienteDireccion(e.target.value)}
                        placeholder="Dirección fiscal SUNAT"
                        className="w-full px-3 py-2 rounded-xl border border-amber-200 text-xs text-slate-700 bg-white"
                      />
                    )}
                  </div>
                )}

                {/* Fidelidad Celular */}
                <div className="p-3.5 rounded-2xl bg-purple-50/70 border border-purple-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-purple-600" />
                      <span>Fidelidad (Celular opcional)</span>
                    </label>
                    <span className="text-[10px] text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full font-bold">
                      +1 Sello
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="tel"
                      inputMode="numeric"
                      maxLength={9}
                      value={clienteTelefono}
                      onChange={handlePhoneChange}
                      placeholder="Celular 9 dígitos"
                      className="w-full px-3 py-2.5 rounded-xl border border-purple-200 bg-white text-base font-bold focus:outline-none focus:border-purple-500"
                    />
                    {(tipoComprobante === 'NOTA_VENTA' || isVE) && (
                      <input
                        type="text"
                        value={clienteNombre}
                        onChange={(e) => setClienteNombre(e.target.value)}
                        placeholder="Nombre cliente (opcional)"
                        className="w-full px-3 py-2.5 rounded-xl border border-purple-200 bg-white text-base focus:outline-none focus:border-purple-500"
                      />
                    )}
                  </div>
                </div>

                {/* Desglose Tributario */}
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between font-mono">
                  <span>Gravada: S/ {opGravada.toFixed(2)}</span>
                  <span>IGV 18%: S/ {igvCalculado.toFixed(2)}</span>
                  <strong className="text-brand-800">Total: S/ {cartTotal.toFixed(2)}</strong>
                </div>
              </div>

              {/* Botones fijos abajo (sticky bottom-0) */}
              <div className="sticky bottom-0 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] bg-white border-t border-slate-200 flex items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowCheckout(false)}
                  disabled={isProcessing}
                  className="flex-1 py-3.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isProcessing || cartTotal <= 0 || cart.length === 0}
                  className="flex-[2] py-3.5 rounded-xl bg-brand-700 hover:bg-brand-800 disabled:opacity-50 text-white font-extrabold text-sm shadow-lg shadow-brand-700/30 flex items-center justify-center gap-2 active:scale-98"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>
                        {!isVE && tipoComprobante !== 'NOTA_VENTA'
                          ? 'Emitiendo SUNAT...'
                          : 'Registrando...'}
                      </span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span>Confirmar (S/ {cartTotal.toFixed(2)})</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE VENTA EXITOSA CON ENLACE PDF REAL DE APISUNAT */}
      {lastSaleReceipt && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-end sm:items-center justify-center sm:p-4 animate-fadeIn">
          <div className="bg-white w-full h-[92dvh] sm:h-auto sm:max-w-md rounded-t-2xl sm:rounded-3xl p-6 shadow-2xl border border-pink-100 text-center overflow-y-auto flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              <div>
                <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center text-2xl mb-2">
                  ✓
                </div>
                <h3 className="font-serif font-bold text-2xl text-slate-900">¡Venta Exitosa!</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Comanda de <strong>{lastSaleReceipt.cuenta?.nombre || 'Mostrador'}</strong> registrada en{' '}
                  <strong>{lastSaleReceipt.sedeNombre}</strong>.
                </p>
              </div>

              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-left text-xs space-y-2">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">
                      {lastSaleReceipt.tipoComprobante === 'FACTURA'
                        ? 'Factura Electrónica'
                        : lastSaleReceipt.tipoComprobante === 'BOLETA'
                        ? 'Boleta Electrónica'
                        : 'Control Interno'}
                    </span>
                    <span className="font-mono font-black text-base text-slate-900">
                      {lastSaleReceipt.comprobante?.codigoCompleto || lastSaleReceipt.id}
                    </span>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
                      lastSaleReceipt.comprobante?.enlace_del_pdf || lastSaleReceipt.enlace_del_pdf
                        ? (lastSaleReceipt.comprobante?.estado === 'PENDIENTE' || lastSaleReceipt.comprobante?.estado === 'OBSERVADO'
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-200')
                        : 'bg-amber-100 text-amber-800 border border-amber-200'
                    }`}
                  >
                    {lastSaleReceipt.comprobante?.enlace_del_pdf || lastSaleReceipt.enlace_del_pdf
                      ? `SUNAT (${lastSaleReceipt.comprobante?.estado || 'ACEPTADO'})`
                      : 'Control Interno NV01'}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-500">Cliente:</span>
                  <span className="font-bold text-slate-800 text-right truncate max-w-[200px]">
                    {lastSaleReceipt.cliente?.nombre || 'Público General'}
                  </span>
                </div>
                {lastSaleReceipt.cliente?.documento && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Documento:</span>
                    <span className="font-mono font-bold text-slate-800">
                      {lastSaleReceipt.cliente.documento}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500">Método de Pago:</span>
                  <span className="font-bold text-slate-800">{lastSaleReceipt.metodoPago}</span>
                </div>
                <div className="flex justify-between text-sm font-black text-brand-800 pt-1 border-t border-slate-200">
                  <span>Total Cobrado:</span>
                  <span>S/ {Number(lastSaleReceipt.total || 0).toFixed(2)}</span>
                </div>
                {lastSaleReceipt.metodoPago === 'EFECTIVO' && Number(lastSaleReceipt.vuelto) > 0 && (
                  <div className="flex justify-between font-bold text-emerald-700">
                    <span>Vuelto:</span>
                    <span>S/ {Number(lastSaleReceipt.vuelto).toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2.5 pt-2">
              {(lastSaleReceipt.comprobante?.enlace_del_pdf || lastSaleReceipt.enlace_del_pdf) && (
                <a
                  href={lastSaleReceipt.comprobante?.enlace_del_pdf || lastSaleReceipt.enlace_del_pdf}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-4 rounded-2xl bg-slate-900 hover:bg-black text-white font-black text-sm shadow-lg flex items-center justify-center gap-2"
                >
                  <Printer className="w-5 h-5 text-gold-400" />
                  <span>🖨️ Imprimir Comprobante PDF</span>
                  <ExternalLink className="w-4 h-4 text-slate-400" />
                </a>
              )}

              {(lastSaleReceipt.comprobante?.enlace_del_xml || lastSaleReceipt.enlace_del_xml) && (
                <a
                  href={lastSaleReceipt.comprobante?.enlace_del_xml || lastSaleReceipt.enlace_del_xml}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5"
                >
                  <FileText className="w-4 h-4 text-slate-500" />
                  <span>Descargar XML SUNAT</span>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                </a>
              )}

              {(lastSaleReceipt.comprobante?.cdr || lastSaleReceipt.cdr) && (
                <a
                  href={lastSaleReceipt.comprobante?.cdr || lastSaleReceipt.cdr}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-bold text-xs flex items-center justify-center gap-1.5"
                >
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <span>Descargar Constancia CDR SUNAT</span>
                  <ExternalLink className="w-3.5 h-3.5 text-emerald-500" />
                </a>
              )}

              <button
                type="button"
                onClick={handleResetForNewSale}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-brand-700 to-pink-600 text-white font-extrabold text-sm shadow-md flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4 text-gold-300" />
                <span>✨ Nueva Venta</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
