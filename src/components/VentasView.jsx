import React, { useState, useMemo } from 'react';
import { useApp, SEDES } from '../context/AppContext';
import { CATEGORIAS } from '../data/initialCatalog';
import { 
  Search, 
  ChevronDown, 
  ChevronUp, 
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
  ShoppingBag,
  UtensilsCrossed,
  ShoppingBag as BagIcon,
  PlusCircle,
  Users
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
    updateCartQuantity, 
    removeFromCart, 
    clearCart, 
    cartTotal, 
    cartCount,
    allAccountsCount,
    processSale,
    clientesFidelidad,
    showToast
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('todos');
  const [openAccordions, setOpenAccordions] = useState({
    tortas: true,
    cheesecakes: true,
    pies: true,
    kekes: true,
    bocados: true,
    jugos: true,
    cafes: true,
    otros: true
  });

  // Modal para agregar nueva mesa/cuenta
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountType, setNewAccountType] = useState('mesa');

  // Modal de Cobro
  const [showCheckout, setShowCheckout] = useState(false);
  const [metodoPago, setMetodoPago] = useState('EFECTIVO');
  const [tipoComprobante, setTipoComprobante] = useState('NOTA_INTERNA');
  const [clienteDoc, setClienteDoc] = useState('');
  const [clienteNombre, setClienteNombre] = useState('');
  const [clienteTelefono, setClienteTelefono] = useState('');
  const [montoRecibido, setMontoRecibido] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastSaleReceipt, setLastSaleReceipt] = useState(null);

  const stockField = sede ? SEDES[sede].stockKey : 'stock_BA';

  // Toggle acordeón
  const toggleAccordion = (catId) => {
    setOpenAccordions(prev => ({ ...prev, [catId]: !prev[catId] }));
  };

  const toggleAll = (open) => {
    const next = {};
    CATEGORIAS.forEach(c => { next[c.id] = open; });
    setOpenAccordions(next);
  };

  // Filtrado de productos
  const filteredProducts = useMemo(() => {
    return productos.filter(p => {
      const matchSearch = p.nombre.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCat = selectedCategory === 'todos' || p.categoria === selectedCategory;
      return matchSearch && matchCat;
    });
  }, [productos, searchTerm, selectedCategory]);

  // Agrupar por categoría
  const productsByCategory = useMemo(() => {
    const groups = {};
    CATEGORIAS.forEach(c => { groups[c.id] = []; });
    filteredProducts.forEach(p => {
      if (groups[p.categoria]) {
        groups[p.categoria].push(p);
      } else {
        if (!groups['otros']) groups['otros'] = [];
        groups['otros'].push(p);
      }
    });
    return groups;
  }, [filteredProducts]);

  // Autocompletar cliente por celular
  const handlePhoneChange = (e) => {
    const phone = e.target.value.replace(/\D/g, '').slice(0, 9);
    setClienteTelefono(phone);
    if (phone.length === 9) {
      const found = clientesFidelidad.find(c => c.id === phone);
      if (found && found.nombre) {
        setClienteNombre(found.nombre);
        showToast(`Cliente encontrado: ${found.nombre} (${found.sellos || 0} sellos)`, 'info');
      }
    }
  };

  // Calcular vuelto
  const vueltoCalculado = useMemo(() => {
    if (metodoPago !== 'EFECTIVO') return 0;
    const recibido = parseFloat(montoRecibido) || 0;
    return Math.max(0, recibido - cartTotal);
  }, [montoRecibido, cartTotal, metodoPago]);

  // Crear nueva mesa/cuenta
  const handleCreateAccount = (e) => {
    e.preventDefault();
    if (!newAccountName.trim()) return;
    addAccount(newAccountName.trim(), newAccountType);
    setNewAccountName('');
    setShowAddAccountModal(false);
  };

  // Ejecutar venta y liquidar únicamente la cuenta activa
  const handleFinalizeSale = async (e) => {
    e.preventDefault();

    if (tipoComprobante === 'BOLETA') {
      if (!clienteDoc || clienteDoc.trim().length !== 8) {
        showToast('Para Boleta el DNI debe tener 8 dígitos numéricos', 'error');
        return;
      }
      if (!clienteNombre.trim()) {
        showToast('Ingresa el nombre del cliente para la Boleta', 'error');
        return;
      }
    }

    if (tipoComprobante === 'FACTURA') {
      if (!clienteDoc || clienteDoc.trim().length !== 11) {
        showToast('Para Factura el RUC debe tener 11 dígitos numéricos', 'error');
        return;
      }
      if (!clienteNombre.trim()) {
        showToast('Ingresa la Razón Social para la Factura', 'error');
        return;
      }
    }

    if (metodoPago === 'EFECTIVO' && parseFloat(montoRecibido) < cartTotal) {
      showToast(`El monto recibido (S/ ${montoRecibido}) es menor al total a pagar (S/ ${cartTotal.toFixed(2)})`, 'error');
      return;
    }

    setIsProcessing(true);
    try {
      const saleResult = await processSale({
        metodoPago,
        tipoComprobante,
        clienteDoc,
        clienteNombre,
        clienteTelefono,
        montoRecibido: metodoPago === 'EFECTIVO' ? montoRecibido : cartTotal,
        vuelto: vueltoCalculado,
        targetAccountId: activeAccountId
      });

      setLastSaleReceipt(saleResult);
      setShowCheckout(false);
      setIsCartOpen(false);
      showToast(`¡Comanda de ${activeAccount.name} cobrada con éxito! (Ticket ${saleResult.id})`, 'success');

      // Limpiar formulario de cobro
      setClienteDoc('');
      setClienteNombre('');
      setClienteTelefono('');
      setMontoRecibido('');
    } catch (err) {
      console.error('Error al procesar la venta:', err);
      showToast('Error al procesar la venta: ' + err.message, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="pb-28 max-w-7xl mx-auto px-4 pt-4">
      {/* 1. BARRA DE NAVEGACIÓN HORIZONTAL DE MESAS / CUENTAS SIMULTÁNEAS */}
      <div className="bg-white rounded-3xl p-3 shadow-sm border border-pink-100 mb-4">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-extrabold uppercase tracking-wider text-brand-800 text-[11px] flex items-center gap-1.5">
              <span>🍽️</span>
              <span>Cuentas & Mesas Abiertas</span>
            </span>
            <span className="bg-pink-100 text-brand-800 font-bold px-2 py-0.2 rounded-full text-[10px]">
              {accounts.length} activas
            </span>
          </div>

          <div className="text-[11px] text-slate-500">
            {allAccountsCount > 0 ? (
              <span className="text-brand-700 font-semibold">
                Total en salón: <strong>{allAccountsCount}</strong> platos
              </span>
            ) : (
              <span>Todas las cuentas listas</span>
            )}
          </div>
        </div>

        {/* Pestañas de Cuentas Desplazables Horizontalmente */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          {accounts.map((acc) => {
            const isActive = acc.id === activeAccountId;
            const accItemCount = (acc.items || []).reduce((sum, it) => sum + it.quantity, 0);
            const accTotal = (acc.items || []).reduce((sum, it) => sum + it.subtotal, 0);

            return (
              <div
                key={acc.id}
                className={`group relative flex items-center rounded-2xl transition-all flex-shrink-0 ${
                  isActive
                    ? 'bg-gradient-to-r from-brand-700 to-pink-600 text-white shadow-md shadow-brand-700/25 scale-[1.02]'
                    : 'bg-slate-50 hover:bg-pink-50/60 text-slate-700 border border-slate-200/80 hover:border-pink-300'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setActiveAccountId(acc.id)}
                  className="px-3.5 py-2 flex items-center gap-2 text-left"
                >
                  <span className="text-base">
                    {acc.type === 'llevar' ? '🛍️' : '🍽️'}
                  </span>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-xs font-bold leading-none ${isActive ? 'text-white' : 'text-slate-900'}`}>
                        {acc.name}
                      </span>
                      {/* Badge con número de items */}
                      {accItemCount > 0 && (
                        <span className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded-full ${
                          isActive
                            ? 'bg-gold-400 text-slate-950 font-black'
                            : 'bg-brand-600 text-white'
                        }`}>
                          {accItemCount}
                        </span>
                      )}
                    </div>
                    {accTotal > 0 && (
                      <span className={`text-[10px] block font-mono font-bold mt-0.5 ${
                        isActive ? 'text-pink-100' : 'text-brand-700'
                      }`}>
                        S/ {accTotal.toFixed(2)}
                      </span>
                    )}
                  </div>
                </button>

                {/* Botón eliminar mesa si es extra o no es predeterminada */}
                {accounts.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeAccount(acc.id);
                    }}
                    title={`Cerrar ${acc.name}`}
                    className={`mr-2 p-1 rounded-full text-xs opacity-60 hover:opacity-100 transition-opacity ${
                      isActive ? 'text-white/80 hover:text-white hover:bg-white/20' : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                    }`}
                  >
                    ✕
                  </button>
                )}
              </div>
            );
          })}

          {/* Botón "+ Agregar Cuenta / Mesa" */}
          <button
            type="button"
            onClick={() => setShowAddAccountModal(true)}
            className="flex-shrink-0 px-3 py-2 rounded-2xl border-2 border-dashed border-pink-300 hover:border-brand-500 bg-pink-50/50 hover:bg-pink-100/60 text-brand-800 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 whitespace-nowrap shadow-xs"
          >
            <Plus className="w-4 h-4 text-brand-700" />
            <span>+ Agregar Cuenta / Mesa</span>
          </button>
        </div>
      </div>

      {/* Barra de Búsqueda y Filtros Rápidos */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-pink-100 mb-5">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar torta, cheesecake, café..."
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:border-brand-500 focus:bg-white transition-all"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto text-xs">
            <button
              onClick={() => toggleAll(true)}
              className="px-2.5 py-1.5 rounded-lg bg-pink-50 hover:bg-pink-100 text-brand-700 font-semibold transition-colors"
            >
              Expandir todos
            </button>
            <button
              onClick={() => toggleAll(false)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold transition-colors"
            >
              Colapsar
            </button>
          </div>
        </div>

        {/* Pills de Categorías */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-3 mt-2 border-t border-slate-100">
          <button
            onClick={() => setSelectedCategory('todos')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
              selectedCategory === 'todos'
                ? 'bg-brand-700 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Todos ({productos.length})
          </button>
          {CATEGORIAS.map((cat) => {
            const count = (productsByCategory[cat.id] || []).length;
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-brand-700 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid de Contenido con Acordeones */}
      <div className="space-y-4">
        {CATEGORIAS.map((cat) => {
          const items = productsByCategory[cat.id] || [];
          if (selectedCategory !== 'todos' && selectedCategory !== cat.id) return null;
          if (items.length === 0) return null;

          const isOpen = openAccordions[cat.id] ?? true;

          return (
            <div 
              key={cat.id} 
              className="bg-white rounded-2xl border border-pink-100/80 shadow-sm overflow-hidden transition-all"
            >
              <button
                onClick={() => toggleAccordion(cat.id)}
                className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-pink-50/60 to-white hover:bg-pink-50/90 text-left transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">{cat.icon}</span>
                  <div>
                    <h3 className="font-serif font-bold text-base text-slate-900 flex items-center gap-2">
                      {cat.label}
                      <span className="text-xs font-normal text-slate-500 bg-white border border-pink-200 px-2 py-0.5 rounded-full">
                        {items.length} productos
                      </span>
                    </h3>
                  </div>
                </div>
                <div className="text-brand-700 p-1 rounded-full bg-white shadow-xs border border-pink-100">
                  {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
              </button>

              {isOpen && (
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 border-t border-pink-50">
                  {items.map((prod) => {
                    const currentStock = prod[stockField] || 0;
                    const isOutOfStock = currentStock <= 0;
                    const inCartItem = cart.find(c => c.product.id === prod.id);

                    return (
                      <div
                        key={prod.id}
                        className={`relative p-3.5 rounded-2xl border transition-all flex flex-col justify-between ${
                          isOutOfStock 
                            ? 'bg-slate-50/80 border-slate-200 opacity-60' 
                            : inCartItem
                            ? 'bg-pink-50/40 border-brand-400 shadow-sm'
                            : 'bg-white border-slate-100 hover:border-pink-300 hover:shadow-md'
                        }`}
                      >
                        {inCartItem && (
                          <div className="absolute -top-2 -right-2 bg-brand-700 text-white font-extrabold text-xs w-6 h-6 rounded-full flex items-center justify-center shadow-md animate-scaleUp">
                            {inCartItem.quantity}
                          </div>
                        )}

                        <div>
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <span className="text-2xl">{prod.icono || '🧁'}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              currentStock > 5
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : currentStock > 0
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-rose-100 text-rose-800 border border-rose-200'
                            }`}>
                              {currentStock > 0 ? `Stock: ${currentStock}` : 'Agotado'}
                            </span>
                          </div>

                          <h4 className="font-bold text-slate-900 text-sm leading-snug line-clamp-2">
                            {prod.nombre}
                          </h4>
                          {prod.descripcion && (
                            <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">
                              {prod.descripcion}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100">
                          <div>
                            <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Precio</span>
                            <span className="font-bold text-brand-700 text-base">
                              S/ {prod.precio.toFixed(2)}
                            </span>
                          </div>

                          {inCartItem ? (
                            <div className="flex items-center gap-1 bg-white border border-brand-200 rounded-xl p-0.5 shadow-sm">
                              <button
                                onClick={() => updateCartQuantity(prod.id, -1)}
                                className="w-7 h-7 rounded-lg bg-pink-50 hover:bg-pink-100 text-brand-700 flex items-center justify-center active:scale-90"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="w-6 text-center text-xs font-bold text-slate-800">
                                {inCartItem.quantity}
                              </span>
                              <button
                                onClick={() => addToCart(prod)}
                                disabled={inCartItem.quantity >= currentStock}
                                className="w-7 h-7 rounded-lg bg-brand-700 hover:bg-brand-800 disabled:opacity-40 text-white flex items-center justify-center active:scale-90"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => addToCart(prod)}
                              disabled={isOutOfStock}
                              className={`flex items-center gap-1 px-3 py-1.5 rounded-xl font-bold text-xs shadow-sm transition-all active:scale-95 ${
                                isOutOfStock
                                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                  : 'bg-brand-700 hover:bg-brand-800 text-white shadow-brand-700/20'
                              }`}
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Agregar</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Floating Bar inferior cuando hay ítems en la cuenta activa */}
      {cartCount > 0 && !isCartOpen && (
        <div className="fixed bottom-20 left-4 right-4 max-w-lg mx-auto z-30 animate-bounceOnce">
          <button
            onClick={() => setIsCartOpen(true)}
            className="w-full bg-gradient-to-r from-brand-700 via-brand-600 to-pink-600 text-white p-4 rounded-2xl shadow-xl shadow-brand-700/30 flex items-center justify-between border border-white/20 active:scale-98 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-lg">
                {activeAccount.type === 'llevar' ? '🛍️' : '🍽️'}
              </div>
              <div className="text-left">
                <span className="text-xs text-pink-100 font-semibold block">
                  {activeAccount.name}
                </span>
                <span className="font-extrabold text-sm">{cartCount} platos / postres</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-gold-300 font-extrabold text-lg">
                S/ {cartTotal.toFixed(2)}
              </span>
              <span className="bg-white text-brand-800 text-xs font-bold px-3 py-1.5 rounded-xl shadow-sm">
                Ver Pedido →
              </span>
            </div>
          </button>
        </div>
      )}

      {/* Drawer / Modal de Comanda (Carrito) de la cuenta activa */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex justify-end animate-fadeIn">
          <div className="bg-white w-full max-w-md h-full flex flex-col shadow-2xl animate-slideLeft">
            <div className="p-4 bg-pink-50/70 border-b border-pink-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">{activeAccount.type === 'llevar' ? '🛍️' : '🍽️'}</span>
                <div>
                  <h3 className="font-serif font-bold text-lg text-slate-800 leading-none">
                    Comanda: {activeAccount.name}
                  </h3>
                  <span className="text-[11px] text-brand-700 font-semibold">
                    {cartCount} platos agregados a esta cuenta
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {cart.length > 0 && (
                  <button
                    onClick={() => clearCart()}
                    title="Vaciar comanda de esta mesa"
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-slate-400">
                  <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-3xl mb-3">
                    🧁
                  </div>
                  <p className="font-bold text-slate-600">Comanda vacía para {activeAccount.name}</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-[220px]">
                    Selecciona postres y bebidas del menú para agregarlos a esta cuenta.
                  </p>
                </div>
              ) : (
                cart.map((item) => (
                  <div
                    key={item.product.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/80 hover:bg-pink-50/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{item.product.icono || '🧁'}</span>
                      <div>
                        <h4 className="font-bold text-slate-800 text-xs sm:text-sm line-clamp-1">
                          {item.product.nombre}
                        </h4>
                        <span className="text-xs text-brand-700 font-bold">
                          S/ {item.product.precio.toFixed(2)} c/u
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5 shadow-xs">
                        <button
                          onClick={() => updateCartQuantity(item.product.id, -1)}
                          className="w-6 h-6 rounded bg-slate-100 hover:bg-pink-100 text-slate-700 flex items-center justify-center"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-6 text-center text-xs font-bold text-slate-800">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => addToCart(item.product)}
                          className="w-6 h-6 rounded bg-brand-700 text-white flex items-center justify-center"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="text-right min-w-[55px]">
                        <span className="font-extrabold text-sm text-slate-900 block">
                          S/ {item.subtotal.toFixed(2)}
                        </span>
                      </div>

                      <button
                        onClick={() => removeFromCart(item.product.id)}
                        className="text-slate-300 hover:text-rose-500 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {cart.length > 0 && (
              <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-3">
                <div className="space-y-1.5 text-xs text-slate-600">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span className="font-semibold">S/ {(cartTotal / 1.18).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>IGV (18% incluido):</span>
                    <span className="font-semibold">S/ {(cartTotal - (cartTotal / 1.18)).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-base font-extrabold text-slate-900 pt-1 border-t border-slate-200">
                    <span>Total a Pagar ({activeAccount.name}):</span>
                    <span className="text-brand-700 text-xl font-bold">
                      S/ {cartTotal.toFixed(2)}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setShowCheckout(true)}
                  className="w-full py-3.5 px-4 rounded-xl bg-brand-700 hover:bg-brand-800 text-white font-extrabold text-sm shadow-lg shadow-brand-700/30 flex items-center justify-center gap-2 active:scale-98 transition-all"
                >
                  <span>Cobrar {activeAccount.name}</span>
                  <span className="bg-white/20 px-2 py-0.5 rounded-lg text-xs">
                    S/ {cartTotal.toFixed(2)}
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Agregar Nueva Mesa o Cuenta */}
      {showAddAccountModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 shadow-2xl border border-pink-100 w-full max-w-sm">
            <h3 className="font-serif font-bold text-lg text-slate-900">
              + Agregar Cuenta o Mesa
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Crea una comanda separada e independiente para atender en simultáneo.
            </p>

            <form onSubmit={handleCreateAccount} className="mt-4 space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Nombre de la Cuenta o Mesa *
                </label>
                <input
                  type="text"
                  value={newAccountName}
                  onChange={(e) => setNewAccountName(e.target.value)}
                  placeholder="Ej. Mesa 04, Barra 2, Para Llevar..."
                  required
                  autoFocus
                  className="w-full px-3 py-2.5 rounded-xl border border-pink-200 text-xs font-bold focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Tipo de Atención
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewAccountType('mesa')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all ${
                      newAccountType === 'mesa'
                        ? 'border-brand-600 bg-pink-50 text-brand-800 shadow-xs'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span>🍽️</span>
                    <span>Consumo en Salón</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewAccountType('llevar')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all ${
                      newAccountType === 'llevar'
                        ? 'border-brand-600 bg-pink-50 text-brand-800 shadow-xs'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span>🛍️</span>
                    <span>Para Llevar</span>
                  </button>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddAccountModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-brand-700 hover:bg-brand-800 text-white font-bold text-xs shadow-md shadow-brand-700/20"
                >
                  Crear Cuenta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Cobro & Emisión SUNAT */}
      {showCheckout && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl border border-pink-100 w-full max-w-lg max-h-[92vh] overflow-y-auto">
            <div className="p-5 bg-gradient-to-r from-brand-700 to-pink-600 text-white flex items-center justify-between sticky top-0 z-10">
              <div>
                <span className="text-xs text-pink-200 font-bold uppercase tracking-wider">
                  Liquidando: {activeAccount.name}
                </span>
                <h3 className="font-serif font-bold text-xl">Confirmar Cobro</h3>
              </div>
              <div className="text-right">
                <span className="text-xs text-pink-200 block">Total a Cobrar</span>
                <span className="text-2xl font-extrabold text-gold-300">
                  S/ {cartTotal.toFixed(2)}
                </span>
              </div>
            </div>

            <form onSubmit={handleFinalizeSale} className="p-5 space-y-5">
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
                  1. Método de Pago *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'EFECTIVO', label: 'Efectivo', icon: Banknote },
                    { id: 'YAPE_PLIN', label: 'Yape / Plin', icon: Smartphone },
                    { id: 'TARJETA', label: 'Tarjeta POS', icon: CreditCard },
                  ].map((m) => {
                    const Icon = m.icon;
                    const isSelected = metodoPago === m.id;
                    return (
                      <button
                        type="button"
                        key={m.id}
                        onClick={() => setMetodoPago(m.id)}
                        className={`p-3 rounded-2xl border-2 flex flex-col items-center justify-center gap-1.5 transition-all text-xs font-bold ${
                          isSelected
                            ? 'border-brand-600 bg-pink-50 text-brand-800 shadow-sm'
                            : 'border-slate-200 hover:border-slate-300 text-slate-600'
                        }`}
                      >
                        <Icon className={`w-5 h-5 ${isSelected ? 'text-brand-700' : 'text-slate-400'}`} />
                        <span>{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {metodoPago === 'EFECTIVO' && (
                <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-amber-900">Monto recibido en efectivo:</span>
                    {vueltoCalculado > 0 && (
                      <span className="font-extrabold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                        Vuelto: S/ {vueltoCalculado.toFixed(2)}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">S/</span>
                      <input
                        type="number"
                        step="0.5"
                        min={cartTotal}
                        value={montoRecibido}
                        onChange={(e) => setMontoRecibido(e.target.value)}
                        placeholder={cartTotal.toFixed(2)}
                        className="w-full pl-8 pr-3 py-2 rounded-xl border border-amber-300 bg-white font-bold text-slate-800 focus:outline-none focus:border-amber-500 text-sm"
                      />
                    </div>
                    {[20, 50, 100].map((billete) => (
                      <button
                        type="button"
                        key={billete}
                        onClick={() => setMontoRecibido(billete.toString())}
                        className="px-2.5 py-1.5 rounded-xl bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 text-xs font-bold shadow-xs"
                      >
                        S/{billete}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setMontoRecibido(cartTotal.toString())}
                      className="px-2.5 py-1.5 rounded-xl bg-amber-200 hover:bg-amber-300 text-amber-900 text-xs font-bold"
                    >
                      Exacto
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
                  2. Tipo de Comprobante *
                </label>
                <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 rounded-2xl">
                  {[
                    { id: 'NOTA_INTERNA', label: 'Nota Interna' },
                    { id: 'BOLETA', label: 'Boleta' },
                    { id: 'FACTURA', label: 'Factura' },
                  ].map((c) => {
                    const isSelected = tipoComprobante === c.id;
                    return (
                      <button
                        type="button"
                        key={c.id}
                        onClick={() => {
                          setTipoComprobante(c.id);
                          setClienteDoc('');
                          if (c.id === 'NOTA_INTERNA') setClienteNombre('');
                        }}
                        className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                          isSelected
                            ? 'bg-white text-brand-800 shadow-sm'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        {c.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {tipoComprobante === 'BOLETA' && (
                <div className="p-4 rounded-2xl bg-pink-50/50 border border-pink-200 space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-brand-900">
                    <Receipt className="w-4 h-4 text-brand-700" />
                    <span>Datos de Boleta de Venta</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">DNI (8 dígitos) *</label>
                      <input
                        type="text"
                        maxLength={8}
                        value={clienteDoc}
                        onChange={(e) => setClienteDoc(e.target.value.replace(/\D/g, ''))}
                        placeholder="12345678"
                        required
                        className="w-full px-3 py-2 rounded-xl border border-pink-200 text-xs font-bold focus:outline-none focus:border-brand-500 bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">Nombre Completo *</label>
                      <input
                        type="text"
                        value={clienteNombre}
                        onChange={(e) => setClienteNombre(e.target.value)}
                        placeholder="Nombres y Apellidos"
                        required
                        className="w-full px-3 py-2 rounded-xl border border-pink-200 text-xs font-bold focus:outline-none focus:border-brand-500 bg-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {tipoComprobante === 'FACTURA' && (
                <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200 space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                    <FileText className="w-4 h-4 text-amber-700" />
                    <span>Datos de Factura Electrónica</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">RUC (11 dígitos) *</label>
                      <input
                        type="text"
                        maxLength={11}
                        value={clienteDoc}
                        onChange={(e) => setClienteDoc(e.target.value.replace(/\D/g, ''))}
                        placeholder="20601234567"
                        required
                        className="w-full px-3 py-2 rounded-xl border border-amber-300 text-xs font-bold focus:outline-none focus:border-amber-500 bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">Razón Social *</label>
                      <input
                        type="text"
                        value={clienteNombre}
                        onChange={(e) => setClienteNombre(e.target.value)}
                        placeholder="EMPRESA S.A.C."
                        required
                        className="w-full px-3 py-2 rounded-xl border border-amber-300 text-xs font-bold focus:outline-none focus:border-amber-500 bg-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="p-3.5 rounded-2xl bg-purple-50/70 border border-purple-200">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-purple-600" />
                    <span>Programa de Fidelidad (Celular)</span>
                  </label>
                  <span className="text-[10px] text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full font-bold">
                    +1 Sello Automático
                  </span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="tel"
                    maxLength={9}
                    value={clienteTelefono}
                    onChange={handlePhoneChange}
                    placeholder="9XXXXXXXX (9 dígitos)"
                    className="flex-1 px-3 py-2 rounded-xl border border-purple-200 bg-white text-xs font-bold focus:outline-none focus:border-purple-500"
                  />
                  {tipoComprobante === 'NOTA_INTERNA' && (
                    <input
                      type="text"
                      value={clienteNombre}
                      onChange={(e) => setClienteNombre(e.target.value)}
                      placeholder="Nombre (opcional)"
                      className="w-40 px-3 py-2 rounded-xl border border-purple-200 bg-white text-xs focus:outline-none focus:border-purple-500"
                    />
                  )}
                </div>
                <p className="text-[11px] text-purple-600 mt-1">
                  Al ingresar el número, el cliente acumula visitas para canjear postres gratis.
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCheckout(false)}
                  disabled={isProcessing}
                  className="flex-1 py-3 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-colors"
                >
                  Regresar
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="flex-[2] py-3.5 rounded-xl bg-brand-700 hover:bg-brand-800 disabled:opacity-50 text-white font-extrabold text-xs shadow-lg shadow-brand-700/30 flex items-center justify-center gap-2 transition-all active:scale-98"
                >
                  {isProcessing ? (
                    <span className="animate-spin text-base">⏳ Procesando...</span>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span>Cobrar {activeAccount.name} (S/ {cartTotal.toFixed(2)})</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Ticket / Comprobante Emitido */}
      {lastSaleReceipt && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 shadow-2xl border border-pink-100 w-full max-w-sm text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center text-3xl mb-3 shadow-inner">
              ✓
            </div>
            <h3 className="font-serif font-bold text-xl text-slate-900">¡Venta Exitosa!</h3>
            <p className="text-xs text-slate-500 mt-1">
              {lastSaleReceipt.cuenta?.nombre || 'Cuenta'} • Ticket {lastSaleReceipt.id}
            </p>

            <div className="bg-slate-50 rounded-2xl p-4 my-4 text-left font-mono text-xs space-y-1.5 border border-slate-200">
              <div className="text-center font-bold pb-2 border-b border-dashed border-slate-300">
                DOLCIANGEL - {lastSaleReceipt.sedeNombre}
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Cuenta / Mesa:</span>
                <span className="font-bold text-slate-700">{lastSaleReceipt.cuenta?.nombre}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Atendido por:</span>
                <span className="font-bold text-slate-700">{lastSaleReceipt.vendedor}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Método Pago:</span>
                <span className="font-bold text-slate-700">{lastSaleReceipt.metodoPago}</span>
              </div>
              {lastSaleReceipt.cliente.nombre && (
                <div className="flex justify-between text-slate-500">
                  <span>Cliente:</span>
                  <span className="font-bold text-slate-700 truncate max-w-[150px]">
                    {lastSaleReceipt.cliente.nombre}
                  </span>
                </div>
              )}
              <div className="py-2 border-t border-b border-dashed border-slate-300 space-y-1">
                {lastSaleReceipt.items.map((it, idx) => (
                  <div key={idx} className="flex justify-between text-[11px]">
                    <span>{it.cantidad}x {it.nombre}</span>
                    <span>S/ {it.subtotal.toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between font-bold text-slate-900 text-sm pt-1">
                <span>TOTAL:</span>
                <span className="text-brand-700 font-extrabold">S/ {lastSaleReceipt.total.toFixed(2)}</span>
              </div>
              {lastSaleReceipt.vuelto > 0 && (
                <div className="flex justify-between text-emerald-700 font-bold">
                  <span>VUELTO:</span>
                  <span>S/ {lastSaleReceipt.vuelto.toFixed(2)}</span>
                </div>
              )}
            </div>

            <button
              onClick={() => setLastSaleReceipt(null)}
              className="w-full py-3 rounded-xl bg-brand-700 hover:bg-brand-800 text-white font-bold text-xs shadow-md shadow-brand-700/20"
            >
              Cerrar y Continuar Atendiendo
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
