import React, { useState, useMemo } from 'react';
import { useApp, SEDES } from '../context/AppContext';
import { db, doc, updateDoc, serverTimestamp } from '../services/firebase';
import { 
  extractCategories, 
  getProductPrice, 
  getProductStock, 
  getCategoryIcon 
} from '../services/productUtils';
import { ProductImage } from './ProductImage';
import { 
  Globe, 
  Search, 
  Eye, 
  EyeOff, 
  Check, 
  AlertCircle, 
  Sparkles, 
  Edit3, 
  ExternalLink,
  Save,
  MessageCircle,
  Package,
  Cake,
  Layers,
  Store,
  LayoutGrid,
  List
} from 'lucide-react';

export const CartaWebView = () => {
  const { productos, sede, showToast } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('todos');
  const [viewFilter, setViewFilter] = useState('todos'); // 'todos', 'vitrina', 'catering'
  const [displayMode, setDisplayMode] = useState('grid'); // 'grid' | 'table'
  
  // Edición de Precios
  const [editingPriceId, setEditingPriceId] = useState(null);
  const [tempPriceBA, setTempPriceBA] = useState('');
  const [tempPriceVE, setTempPriceVE] = useState('');
  const [isUpdating, setIsUpdating] = useState({});

  // Categorías dinámicas desde Firestore
  const dynamicCategories = useMemo(() => extractCategories(productos), [productos]);

  // Filtrado de productos
  const filteredProducts = useMemo(() => {
    return productos.filter(p => {
      const term = searchTerm.toLowerCase().trim();
      const matchSearch = p.nombre.toLowerCase().includes(term) ||
                          (p.descripcion && p.descripcion.toLowerCase().includes(term));
      const matchCat = selectedCategory === 'todos' || p.categoria?.toLowerCase() === selectedCategory.toLowerCase();

      let matchTipo = true;
      if (viewFilter === 'vitrina') matchTipo = !p.esPedidoGrande;
      if (viewFilter === 'catering') matchTipo = Boolean(p.esPedidoGrande);

      return matchSearch && matchCat && matchTipo;
    });
  }, [productos, searchTerm, selectedCategory, viewFilter]);

  // Métricas de la carta
  const publicCount = productos.filter(p => p.mostrar_en_carta ?? true).length;
  const availableCount = productos.filter(p => p.disponible ?? true).length;
  const cateringCount = productos.filter(p => p.esPedidoGrande).length;
  const vitrinaCount = productos.length - cateringCount;

  // Actualizar campo en Firestore en tiempo real
  const handleUpdateProduct = async (prodId, updates) => {
    setIsUpdating(prev => ({ ...prev, [prodId]: true }));
    try {
      const prodRef = doc(db, 'productos', prodId);
      await updateDoc(prodRef, {
        ...updates,
        updatedAt: serverTimestamp()
      });
      showToast('Producto actualizado en la Carta Digital');
    } catch (err) {
      console.error('Error al actualizar producto:', err);
      showToast('Error al actualizar: ' + err.message, 'error');
    } finally {
      setIsUpdating(prev => ({ ...prev, [prodId]: false }));
    }
  };

  const handleStartEditPrice = (prod) => {
    setEditingPriceId(prod.id);
    setTempPriceBA(getProductPrice(prod, 'BA').toString());
    setTempPriceVE(getProductPrice(prod, 'VE').toString());
  };

  const handleSavePrice = async (prodId) => {
    const numBA = parseFloat(tempPriceBA);
    const numVE = parseFloat(tempPriceVE);

    if (isNaN(numBA) || numBA < 0 || isNaN(numVE) || numVE < 0) {
      showToast('Ingresa precios válidos en Soles para ambas sedes', 'error');
      return;
    }

    await handleUpdateProduct(prodId, {
      precios: {
        buenosAires: numBA,
        villaEspana: numVE
      },
      precio: numBA,
      precio_BA: numBA,
      precio_VE: numVE
    });
    setEditingPriceId(null);
  };

  // Generador de mensaje rápido de cotización por WhatsApp (para catering)
  const handleOpenWhatsAppQuote = (prod) => {
    const telefono = '51963810237'; // Línea oficial de pedidos
    const mensaje = encodeURIComponent(
      `Hola Dolciangel 🍰, deseo consultar y cotizar el pedido especial de: *${prod.nombre}*` +
      `\n\n¿Tienen disponibilidad para esta semana? ¡Muchas gracias!`
    );
    window.open(`https://wa.me/${telefono}?text=${mensaje}`, '_blank');
  };

  return (
    <div className="pb-28 max-w-7xl mx-auto px-4 pt-4 space-y-6">
      {/* Banner Superior de Vinculación */}
      <div className="bg-gradient-to-r from-brand-800 via-pink-700 to-rose-700 rounded-3xl p-6 text-white shadow-xl shadow-brand-700/20 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-2xl shadow-inner">
              🌐
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-pink-200 bg-white/10 px-2.5 py-0.5 rounded-full border border-white/20">
                Sincronización en Vivo
              </span>
              <h2 className="text-xl md:text-2xl font-serif font-bold mt-1">
                Gestión de Carta Digital & Pedidos Grandes
              </h2>
              <p className="text-xs text-pink-100 mt-0.5">
                Control de vitrina del día, tortas enteras y bocaditos a pedido para <span className="font-mono underline">dolciangel-carta-web</span>
              </p>
            </div>
          </div>

          {/* Estadísticas de la carta */}
          <div className="flex items-center gap-3 bg-white/10 backdrop-blur p-3 rounded-2xl border border-white/15 text-xs">
            <div className="text-center px-2">
              <span className="text-[10px] text-pink-200 block uppercase font-bold">Vitrina Diaria</span>
              <span className="text-lg font-extrabold text-white">{vitrinaCount}</span>
            </div>
            <div className="w-px h-8 bg-white/20" />
            <div className="text-center px-2">
              <span className="text-[10px] text-pink-200 block uppercase font-bold">Catering / Pedidos</span>
              <span className="text-lg font-extrabold text-purple-300">{cateringCount}</span>
            </div>
            <div className="w-px h-8 bg-white/20" />
            <div className="text-center px-2">
              <span className="text-[10px] text-pink-200 block uppercase font-bold">En Carta Web</span>
              <span className="text-lg font-extrabold text-gold-300">{publicCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Selector de Filtros de Vista: Vitrina vs Catering */}
      <div className="bg-white rounded-3xl p-4 shadow-sm border border-pink-100 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          {/* Tabs Vitrina vs Catering */}
          <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl w-full sm:w-auto">
            <button
              onClick={() => setViewFilter('todos')}
              className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                viewFilter === 'todos'
                  ? 'bg-brand-700 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todos ({productos.length})
            </button>
            <button
              onClick={() => setViewFilter('vitrina')}
              className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                viewFilter === 'vitrina'
                  ? 'bg-brand-700 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>🍰</span>
              <span>Vitrina del Día ({vitrinaCount})</span>
            </button>
            <button
              onClick={() => setViewFilter('catering')}
              className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                viewFilter === 'catering'
                  ? 'bg-purple-700 text-white shadow-sm'
                  : 'text-purple-700 hover:bg-purple-100'
              }`}
            >
              <span>🎂</span>
              <span>Tortas & Bocaditos a Pedido ({cateringCount})</span>
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Buscador */}
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar en la carta..."
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-brand-500 focus:bg-white"
              />
            </div>

            {/* Selector de Modo: Cuadrícula vs Tabla */}
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setDisplayMode('grid')}
                className={`p-1.5 rounded-lg transition-all ${
                  displayMode === 'grid'
                    ? 'bg-brand-700 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Vista de Tarjetas / Catálogo Visual"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setDisplayMode('table')}
                className={`p-1.5 rounded-lg transition-all ${
                  displayMode === 'table'
                    ? 'bg-brand-700 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Vista de Tabla Detallada"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Categorías Dinámicas Extraídas de Firestore */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-2 border-t border-slate-100">
          <button
            onClick={() => setSelectedCategory('todos')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
              selectedCategory === 'todos'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Todas ({productos.length})
          </button>
          {dynamicCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                selectedCategory === cat.id
                  ? 'bg-brand-700 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* CONTENIDO SEGÚN MODO DE VISUALIZACIÓN */}
      {displayMode === 'grid' ? (
        /* VISTA DE TARJETAS CON IMÁGENES Y SKELETON LOADING */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {filteredProducts.length === 0 ? (
            <div className="col-span-full py-12 text-center text-slate-400 bg-white rounded-3xl border border-pink-100 p-8">
              No se encontraron productos con los filtros seleccionados
            </div>
          ) : (
            filteredProducts.map((prod) => {
              const isPublic = prod.mostrar_en_carta ?? true;
              const isAvailable = prod.disponible ?? true;
              const isCatering = Boolean(prod.esPedidoGrande);
              const isSaving = isUpdating[prod.id];
              const isEditingPrice = editingPriceId === prod.id;

              const pBA = getProductPrice(prod, 'BA');
              const pVE = getProductPrice(prod, 'VE');

              return (
                <div
                  key={prod.id}
                  className={`bg-white rounded-2xl border transition-all flex flex-col justify-between overflow-hidden p-3 shadow-xs hover:shadow-md ${
                    isCatering ? 'border-purple-200 hover:border-purple-300' : 'border-pink-100 hover:border-pink-300'
                  }`}
                >
                  <div>
                    {/* Contenedor de Imagen (rounded-2xl, h-40 o aspect-square) con Skeleton Loading */}
                    <div className="w-full h-40 sm:aspect-square rounded-2xl overflow-hidden mb-2.5 relative bg-slate-50 shadow-inner">
                      <ProductImage
                        src={prod.imagenUrl || prod.imagen || prod.img}
                        alt={prod.nombre}
                        categoria={prod.categoria}
                        aspectRatio="h-40 sm:aspect-square"
                        rounded="rounded-2xl"
                      />

                      {/* Badges Flotantes sobre la Imagen */}
                      <div className="absolute top-2 left-2 z-10">
                        <button
                          onClick={() => handleUpdateProduct(prod.id, { esPedidoGrande: !isCatering })}
                          disabled={isSaving}
                          title="Alternar entre Vitrina o Catering"
                          className={`text-[9px] font-extrabold px-2 py-0.5 rounded-md backdrop-blur-md shadow-xs transition-all active:scale-95 ${
                            isCatering
                              ? 'bg-purple-900/85 text-purple-100'
                              : 'bg-slate-900/70 text-slate-100'
                          }`}
                        >
                          {isCatering ? '🎂 Catering' : '🍰 Vitrina'}
                        </button>
                      </div>

                      <div className="absolute top-2 right-2 z-10">
                        <button
                          onClick={() => handleUpdateProduct(prod.id, { mostrar_en_carta: !isPublic })}
                          disabled={isSaving}
                          title="Alternar visibilidad en Carta Web"
                          className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full backdrop-blur-md shadow-xs flex items-center gap-1 ${
                            isPublic
                              ? 'bg-emerald-600/90 text-white'
                              : 'bg-slate-700/80 text-slate-200'
                          }`}
                        >
                          {isPublic ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                          <span>{isPublic ? 'Carta ON' : 'Oculto'}</span>
                        </button>
                      </div>
                    </div>

                    <h4 className="font-bold text-slate-900 text-xs sm:text-sm leading-snug line-clamp-2">
                      {prod.nombre}
                    </h4>
                    <span className="text-[10px] font-bold text-brand-700 uppercase tracking-wider block mt-0.5 capitalize">
                      {prod.categoria}
                    </span>
                  </div>

                  {/* Precios Diferenciados y Acciones */}
                  <div className="mt-3 pt-2 border-t border-slate-100 space-y-2">
                    {isEditingPrice ? (
                      <div className="bg-pink-50/70 p-2 rounded-xl border border-pink-200 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[10px] font-bold text-brand-800">BA: S/</span>
                          <input
                            type="number"
                            step="0.5"
                            value={tempPriceBA}
                            onChange={(e) => setTempPriceBA(e.target.value)}
                            className="w-16 px-1 py-0.5 rounded border border-brand-300 font-bold text-xs"
                          />
                        </div>
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[10px] font-bold text-amber-800">VE: S/</span>
                          <input
                            type="number"
                            step="0.5"
                            value={tempPriceVE}
                            onChange={(e) => setTempPriceVE(e.target.value)}
                            className="w-16 px-1 py-0.5 rounded border border-amber-300 font-bold text-xs"
                          />
                        </div>
                        <div className="flex gap-1 pt-1">
                          <button
                            onClick={() => handleSavePrice(prod.id)}
                            className="flex-1 py-1 rounded bg-brand-700 text-white font-bold text-[10px]"
                          >
                            Guardar
                          </button>
                          <button
                            onClick={() => setEditingPriceId(null)}
                            className="px-2 py-1 rounded bg-slate-200 text-slate-600 font-bold text-[10px]"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => handleStartEditPrice(prod)}
                          className="flex items-center gap-1.5 text-left group"
                          title="Click para editar precios"
                        >
                          <div>
                            <span className="text-[11px] font-mono font-extrabold text-brand-700 block">
                              BA: S/ {pBA.toFixed(2)}
                            </span>
                            <span className="text-[10px] font-mono font-semibold text-amber-800 block">
                              VE: S/ {pVE.toFixed(2)}
                            </span>
                          </div>
                          <Edit3 className="w-3 h-3 text-slate-400 group-hover:text-brand-600 transition-colors" />
                        </button>

                        <button
                          onClick={() => handleUpdateProduct(prod.id, { disponible: !isAvailable })}
                          disabled={isSaving}
                          className={`px-2 py-1 rounded-lg text-[10px] font-extrabold transition-all ${
                            isAvailable
                              ? 'bg-pink-100 text-brand-800 hover:bg-pink-200'
                              : 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                          }`}
                        >
                          {isAvailable ? 'Disponible' : 'Agotado'}
                        </button>
                      </div>
                    )}

                    {isCatering && (
                      <button
                        onClick={() => handleOpenWhatsAppQuote(prod)}
                        className="w-full py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[10px] border border-emerald-200 transition-colors flex items-center justify-center gap-1"
                      >
                        <MessageCircle className="w-3 h-3 text-emerald-600" />
                        <span>Cotizar WhatsApp</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* VISTA DE TABLA CON THUMBNAILS Y SKELETON */
        <div className="bg-white rounded-3xl border border-pink-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-extrabold border-b border-slate-200 text-[10px]">
                <tr>
                  <th className="py-3.5 px-4">Producto & Categoría</th>
                  <th className="py-3.5 px-3 text-center">Tipo de Pedido</th>
                  <th className="py-3.5 px-3 text-center">Precios (BA vs VE)</th>
                  <th className="py-3.5 px-3 text-center">Visibilidad Carta</th>
                  <th className="py-3.5 px-3 text-center">Estado Tienda</th>
                  <th className="py-3.5 px-3 text-center">Acción Rápida</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-400">
                      No se encontraron productos con los filtros seleccionados
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((prod) => {
                    const isPublic = prod.mostrar_en_carta ?? true;
                    const isAvailable = prod.disponible ?? true;
                    const isCatering = Boolean(prod.esPedidoGrande);
                    const isSaving = isUpdating[prod.id];
                    const isEditingPrice = editingPriceId === prod.id;

                    const pBA = getProductPrice(prod, 'BA');
                    const pVE = getProductPrice(prod, 'VE');

                    return (
                      <tr 
                        key={prod.id} 
                        className={`hover:bg-pink-50/20 transition-colors ${isCatering ? 'bg-purple-50/20' : ''}`}
                      >
                        {/* Producto con Thumbnail Skeleton */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl overflow-hidden flex-shrink-0 shadow-inner bg-slate-50 border border-pink-100/60">
                              <ProductImage
                                src={prod.imagenUrl || prod.imagen || prod.img}
                                alt={prod.nombre}
                                categoria={prod.categoria}
                                rounded="rounded-2xl"
                              />
                            </div>
                            <div>
                              <span className="font-bold text-slate-900 block text-xs">
                                {prod.nombre}
                              </span>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[10px] text-slate-400 font-mono">
                                  ID: {prod.id}
                                </span>
                                <span className="text-[10px] text-brand-700 bg-pink-50 px-1.5 py-0.2 rounded capitalize font-semibold">
                                  {prod.categoria}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Tipo: Vitrina vs Catering */}
                        <td className="py-3.5 px-3 text-center">
                          <button
                            onClick={() => handleUpdateProduct(prod.id, { esPedidoGrande: !isCatering })}
                            disabled={isSaving}
                            title="Click para alternar entre Vitrina diaria o Pedido Grande / Catering"
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold text-[11px] transition-all active:scale-95 ${
                              isCatering
                                ? 'bg-purple-100 text-purple-900 border border-purple-300 hover:bg-purple-200 shadow-xs'
                                : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
                            }`}
                          >
                            {isCatering ? (
                              <>
                                <Package className="w-3.5 h-3.5 text-purple-700" />
                                <span>🎂 Catering / Grande</span>
                              </>
                            ) : (
                              <>
                                <Cake className="w-3.5 h-3.5 text-slate-500" />
                                <span>🍰 Vitrina Diaria</span>
                              </>
                            )}
                          </button>
                        </td>

                        {/* Precios Diferenciados (BA vs VE) */}
                        <td className="py-3.5 px-3 text-center">
                          {isEditingPrice ? (
                            <div className="flex flex-col items-center gap-1.5 bg-pink-50/60 p-2 rounded-xl border border-pink-200">
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] font-bold text-brand-700">BA: S/</span>
                                <input
                                  type="number"
                                  step="0.5"
                                  value={tempPriceBA}
                                  onChange={(e) => setTempPriceBA(e.target.value)}
                                  className="w-16 px-1.5 py-0.5 rounded border border-brand-400 text-xs font-bold"
                                />
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] font-bold text-amber-800">VE: S/</span>
                                <input
                                  type="number"
                                  step="0.5"
                                  value={tempPriceVE}
                                  onChange={(e) => setTempPriceVE(e.target.value)}
                                  className="w-16 px-1.5 py-0.5 rounded border border-amber-400 text-xs font-bold"
                                />
                              </div>
                              <div className="flex items-center gap-1 mt-1">
                                <button
                                  onClick={() => handleSavePrice(prod.id)}
                                  className="px-2 py-0.5 rounded bg-brand-700 text-white font-bold text-[10px] hover:bg-brand-800"
                                >
                                  Guardar
                                </button>
                                <button
                                  onClick={() => setEditingPriceId(null)}
                                  className="px-2 py-0.5 rounded bg-slate-200 text-slate-600 font-bold text-[10px]"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleStartEditPrice(prod)}
                              className="group inline-flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl bg-slate-50 hover:bg-pink-100/60 border border-slate-200 transition-all"
                              title="Click para editar precios por sede"
                            >
                              <div className="flex items-center gap-2 text-[11px] font-mono">
                                <span className="text-brand-800 font-extrabold">BA: S/ {pBA.toFixed(2)}</span>
                                <span className="text-slate-300">|</span>
                                <span className="text-amber-800 font-extrabold">VE: S/ {pVE.toFixed(2)}</span>
                                <Edit3 className="w-3 h-3 text-slate-400 group-hover:text-brand-600" />
                              </div>
                            </button>
                          )}
                        </td>

                        {/* Visibilidad en Carta Web */}
                        <td className="py-3.5 px-3 text-center">
                          <button
                            onClick={() => handleUpdateProduct(prod.id, { mostrar_en_carta: !isPublic })}
                            disabled={isSaving}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold text-xs transition-all active:scale-95 ${
                              isPublic
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200 hover:bg-emerald-200'
                                : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200'
                            }`}
                          >
                            {isPublic ? (
                              <>
                                <Eye className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Visible</span>
                              </>
                            ) : (
                              <>
                                <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                                <span>Oculto</span>
                              </>
                            )}
                          </button>
                        </td>

                        {/* Estado Tienda: Disponible / Agotado */}
                        <td className="py-3.5 px-3 text-center">
                          <button
                            onClick={() => handleUpdateProduct(prod.id, { disponible: !isAvailable })}
                            disabled={isSaving}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold text-xs transition-all active:scale-95 ${
                              isAvailable
                                ? 'bg-pink-100 text-brand-800 border border-brand-200 hover:bg-pink-200'
                                : 'bg-rose-100 text-rose-800 border border-rose-200 hover:bg-rose-200'
                            }`}
                          >
                            <span className={`w-2 h-2 rounded-full ${isAvailable ? 'bg-brand-600' : 'bg-rose-600'}`} />
                            <span>{isAvailable ? 'Disponible' : 'Agotado'}</span>
                          </button>
                        </td>

                        {/* Acción Rápida: Cotización WhatsApp */}
                        <td className="py-3.5 px-3 text-center">
                          {isCatering ? (
                            <button
                              onClick={() => handleOpenWhatsAppQuote(prod)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[11px] border border-emerald-200 transition-colors"
                              title="Probar cotización en WhatsApp"
                            >
                              <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                              <span>WhatsApp</span>
                            </button>
                          ) : (
                            <span className="text-slate-400 text-[11px] font-mono">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
