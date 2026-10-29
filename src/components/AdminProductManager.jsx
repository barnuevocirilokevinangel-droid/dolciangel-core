import React, { useState, useMemo } from 'react';
import { useApp, SEDES } from '../context/AppContext';
import { 
  db, 
  collections, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp 
} from '../services/firebase';
import { 
  getProductPrice, 
  getProductStock, 
  getProductCost, 
  extractCategories,
  getCategoryIcon 
} from '../services/productUtils';
import { ProductImage } from './ProductImage';
import { 
  Search, 
  Plus, 
  Edit3, 
  Trash2, 
  Crown, 
  TrendingUp, 
  AlertCircle, 
  Check, 
  X, 
  DollarSign, 
  Package, 
  Sparkles, 
  Eye, 
  EyeOff, 
  Layers,
  Filter
} from 'lucide-react';

export const AdminProductManager = () => {
  const { productos, perfil, showToast } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('todos');
  const [filterTipo, setFilterTipo] = useState('todos'); // 'todos', 'vitrina', 'catering'
  
  // Modales
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Estados del Formulario (Creación / Edición)
  const [formNombre, setFormNombre] = useState('');
  const [formDescripcion, setFormDescripcion] = useState('');
  const [formCategoria, setFormCategoria] = useState('tortas');
  const [isNewCategory, setIsNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [formIcono, setFormIcono] = useState('🎂');
  const [formImagenUrl, setFormImagenUrl] = useState('');
  const [formCosto, setFormCosto] = useState('');
  const [formPrecioBA, setFormPrecioBA] = useState('');
  const [formPrecioVE, setFormPrecioVE] = useState('');
  const [formStockBA, setFormStockBA] = useState('10');
  const [formStockVE, setFormStockVE] = useState('10');
  const [formEsPedidoGrande, setFormEsPedidoGrande] = useState(false);
  const [formVisibleBA, setFormVisibleBA] = useState(true);
  const [formVisibleVE, setFormVisibleVE] = useState(true);

  const isDueno = perfil?.isDueno ?? false;
  const dynamicCategories = useMemo(() => extractCategories(productos), [productos]);

  // Filtrado de la tabla
  const filteredProducts = useMemo(() => {
    return productos.filter(p => {
      const term = searchTerm.toLowerCase().trim();
      const matchSearch = p.nombre.toLowerCase().includes(term) ||
                          (p.descripcion && p.descripcion.toLowerCase().includes(term)) ||
                          (p.categoria && p.categoria.toLowerCase().includes(term));
      const matchCat = selectedCategory === 'todos' || p.categoria?.toLowerCase() === selectedCategory.toLowerCase();
      
      let matchTipo = true;
      if (filterTipo === 'vitrina') matchTipo = !p.esPedidoGrande;
      if (filterTipo === 'catering') matchTipo = Boolean(p.esPedidoGrande);

      return matchSearch && matchCat && matchTipo;
    });
  }, [productos, searchTerm, selectedCategory, filterTipo]);

  // Cálculos de márgenes generales
  const statsRentabilidad = useMemo(() => {
    let count = 0;
    let sumaMargenBA = 0;
    let sumaMargenVE = 0;

    productos.forEach(p => {
      const costo = getProductCost(p);
      const pBA = getProductPrice(p, 'BA');
      const pVE = getProductPrice(p, 'VE');

      if (costo > 0 && pBA > 0) {
        sumaMargenBA += ((pBA - costo) / pBA) * 100;
        count++;
      }
      if (costo > 0 && pVE > 0) {
        sumaMargenVE += ((pVE - costo) / pVE) * 100;
      }
    });

    const avgMargenBA = count > 0 ? sumaMargenBA / count : 0;
    const avgMargenVE = count > 0 ? sumaMargenVE / count : 0;

    return { avgMargenBA, avgMargenVE };
  }, [productos]);

  // Abrir Modal de Creación
  const handleOpenCreate = () => {
    setFormNombre('');
    setFormDescripcion('');
    setFormCategoria(dynamicCategories[0]?.id || 'tortas');
    setIsNewCategory(false);
    setNewCategoryName('');
    setFormIcono('🎂');
    setFormImagenUrl('');
    setFormCosto('');
    setFormPrecioBA('');
    setFormPrecioVE('');
    setFormStockBA('10');
    setFormStockVE('10');
    setFormEsPedidoGrande(false);
    setFormVisibleBA(true);
    setFormVisibleVE(true);
    setShowCreateModal(true);
  };

  // Abrir Modal de Edición
  const handleOpenEdit = (p) => {
    setEditingProduct(p);
    setFormNombre(p.nombre || '');
    setFormDescripcion(p.descripcion || '');
    setFormCategoria(p.categoria || 'tortas');
    setIsNewCategory(false);
    setNewCategoryName('');
    setFormIcono(p.icono || getCategoryIcon(p.categoria));
    setFormImagenUrl(p.imagenUrl || p.imagen || '');
    setFormCosto(p.costoElaboracion?.toString() || p.costo?.toString() || '');
    setFormPrecioBA(getProductPrice(p, 'BA').toString());
    setFormPrecioVE(getProductPrice(p, 'VE').toString());
    setFormStockBA(getProductStock(p, 'BA').toString());
    setFormStockVE(getProductStock(p, 'VE').toString());
    setFormEsPedidoGrande(Boolean(p.esPedidoGrande));
    setFormVisibleBA(p.visible_BA ?? p.mostrar_en_carta ?? true);
    setFormVisibleVE(p.visible_VE ?? p.mostrar_en_carta ?? true);
  };

  // Guardar (Crear o Actualizar)
  const handleSubmitProduct = async (e) => {
    e.preventDefault();
    if (!formNombre.trim()) {
      showToast('Ingresa el nombre del producto', 'error');
      return;
    }

    const finalCategory = isNewCategory 
      ? (newCategoryName.trim().toLowerCase() || 'otros')
      : formCategoria.toLowerCase();

    const costo = parseFloat(formCosto) || 0;
    const pBA = parseFloat(formPrecioBA) || 0;
    const pVE = parseFloat(formPrecioVE) || pBA;
    const sBA = parseInt(formStockBA, 10) || 0;
    const sVE = parseInt(formStockVE, 10) || 0;

    if (pBA <= 0 && pVE <= 0) {
      showToast('Debes ingresar al menos un precio válido mayor a 0', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const prodId = editingProduct 
        ? editingProduct.id 
        : `prod_${finalCategory}_${Date.now()}`;

      const payload = {
        id: prodId,
        nombre: formNombre.trim(),
        descripcion: formDescripcion.trim(),
        categoria: finalCategory,
        icono: formIcono || getCategoryIcon(finalCategory),
        imagenUrl: formImagenUrl.trim(),
        costoElaboracion: costo,
        precios: {
          buenosAires: pBA,
          villaEspana: pVE
        },
        precio: pBA, // compatibilidad legacy
        precio_BA: pBA,
        precio_VE: pVE,
        stock: {
          buenosAires: sBA,
          villaEspana: sVE
        },
        stock_BA: sBA, // compatibilidad legacy
        stock_VE: sVE,
        esPedidoGrande: Boolean(formEsPedidoGrande),
        visible_BA: Boolean(formVisibleBA),
        visible_VE: Boolean(formVisibleVE),
        mostrar_en_carta: Boolean(formVisibleBA || formVisibleVE),
        disponible: (sBA + sVE) > 0,
        updatedAt: serverTimestamp()
      };

      if (!editingProduct) {
        payload.creadoEn = serverTimestamp();
      }

      await setDoc(doc(collections.productos, prodId), payload, { merge: true });

      showToast(editingProduct ? '¡Producto actualizado con éxito!' : '¡Nuevo producto registrado!', 'success');
      setShowCreateModal(false);
      setEditingProduct(null);
    } catch (err) {
      console.error('Error al guardar producto:', err);
      showToast('Error: ' + err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Eliminar producto de Firestore
  const handleDeleteProduct = async (p) => {
    if (!isDueno) return;
    if (!window.confirm(`¿Estás seguro de eliminar el producto "${p.nombre}"?\n\nEsta acción eliminará el producto del catálogo y de la Carta Web.`)) {
      return;
    }
    try {
      await deleteDoc(doc(collections.productos, p.id));
      showToast(`Producto "${p.nombre}" eliminado`, 'success');
    } catch (err) {
      console.error('Error al eliminar:', err);
      showToast('Error: ' + err.message, 'error');
    }
  };

  // Previsualización de Márgenes para el formulario
  const previewCost = parseFloat(formCosto) || 0;
  const previewPBA = parseFloat(formPrecioBA) || 0;
  const previewPVE = parseFloat(formPrecioVE) || 0;
  const marginSolesBA = previewPBA - previewCost;
  const marginPctBA = previewPBA > 0 ? (marginSolesBA / previewPBA) * 100 : 0;
  const marginSolesVE = previewPVE - previewCost;
  const marginPctVE = previewPVE > 0 ? (marginSolesVE / previewPVE) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Banner de Sección */}
      <div className="bg-gradient-to-r from-slate-900 via-brand-950 to-slate-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-pink-300 bg-white/10 px-2.5 py-0.5 rounded-full border border-white/20 flex items-center gap-1">
                <Crown className="w-3.5 h-3.5 text-gold-400" />
                <span>Gestión de Catálogo & Rentabilidad</span>
              </span>
              <span className="text-[11px] text-slate-300">
                Precios por Sede y Costos de Elaboración
              </span>
            </div>
            <h2 className="text-2xl font-serif font-bold text-white mt-1">
              Catálogo Maestro & Análisis de Márgenes
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Control centralizado de costos, precios Buenos Aires vs. Villa España y catálogo de catering.
            </p>
          </div>

          <button
            onClick={handleOpenCreate}
            className="px-5 py-3 rounded-2xl bg-gradient-to-r from-gold-400 to-amber-500 hover:from-gold-300 hover:to-amber-400 text-slate-950 font-black text-xs shadow-lg shadow-gold-500/20 active:scale-95 transition-all flex items-center gap-2 self-start md:self-auto"
          >
            <Plus className="w-4 h-4 text-slate-950" />
            <span>+ Nuevo Producto</span>
          </button>
        </div>

        {/* KPIs de Rentabilidad */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-white/10 text-xs">
          <div className="bg-white/5 backdrop-blur p-3 rounded-xl border border-white/10">
            <span className="text-slate-400 block text-[11px]">Total Productos</span>
            <span className="text-lg font-black text-white">{productos.length}</span>
          </div>
          <div className="bg-white/5 backdrop-blur p-3 rounded-xl border border-white/10">
            <span className="text-slate-400 block text-[11px]">Catering / Tortas Enteras</span>
            <span className="text-lg font-black text-purple-300">
              {productos.filter(p => p.esPedidoGrande).length}
            </span>
          </div>
          <div className="bg-white/5 backdrop-blur p-3 rounded-xl border border-white/10">
            <span className="text-slate-400 block text-[11px]">Margen Promedio BA</span>
            <span className="text-lg font-black text-emerald-400">
              {statsRentabilidad.avgMargenBA.toFixed(1)}%
            </span>
          </div>
          <div className="bg-white/5 backdrop-blur p-3 rounded-xl border border-white/10">
            <span className="text-slate-400 block text-[11px]">Margen Promedio VE</span>
            <span className="text-lg font-black text-amber-400">
              {statsRentabilidad.avgMargenVE.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="bg-white rounded-3xl p-4 shadow-sm border border-pink-100 flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nombre o descripción..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium focus:outline-none focus:border-brand-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto text-xs">
          {/* Filtro Tipo */}
          <div className="flex bg-slate-100 p-1 rounded-xl">
            {[
              { id: 'todos', label: 'Todos' },
              { id: 'vitrina', label: '🍰 Vitrina' },
              { id: 'catering', label: '📦 Catering' },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setFilterTipo(t.id)}
                className={`px-3 py-1 rounded-lg font-bold transition-all ${
                  filterTipo === t.id
                    ? 'bg-brand-700 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Filtro Categorías Dinámicas */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 font-bold text-slate-700 focus:outline-none focus:border-brand-500 text-xs"
          >
            <option value="todos">Todas las categorías ({productos.length})</option>
            {dynamicCategories.map(c => (
              <option key={c.id} value={c.id}>
                {c.icon} {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabla Interactiva de Productos & Rentabilidad */}
      <div className="bg-white rounded-3xl border border-pink-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider font-extrabold border-b border-slate-200 text-[10px]">
              <tr>
                <th className="py-3.5 px-4">Producto</th>
                <th className="py-3.5 px-3 text-center">Costo Elaboración</th>
                <th className="py-3.5 px-3 text-center bg-pink-50/40">Precio BA</th>
                <th className="py-3.5 px-3 text-center bg-pink-50/40">Ganancia BA</th>
                <th className="py-3.5 px-3 text-center bg-amber-50/40">Precio VE</th>
                <th className="py-3.5 px-3 text-center bg-amber-50/40">Ganancia VE</th>
                <th className="py-3.5 px-3 text-center">Stock por Sede</th>
                <th className="py-3.5 px-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-400 text-xs">
                    No hay productos que coincidan con la búsqueda
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const costo = getProductCost(p);
                  const pBA = getProductPrice(p, 'BA');
                  const pVE = getProductPrice(p, 'VE');
                  const sBA = getProductStock(p, 'BA');
                  const sVE = getProductStock(p, 'VE');

                  const gananciaBA = pBA - costo;
                  const pctBA = pBA > 0 ? (gananciaBA / pBA) * 100 : 0;

                  const gananciaVE = pVE - costo;
                  const pctVE = pVE > 0 ? (gananciaVE / pVE) * 100 : 0;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Producto */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl overflow-hidden flex-shrink-0 shadow-inner bg-slate-50 border border-pink-100/60">
                            <ProductImage
                              src={p.imagenUrl || p.imagen || p.img}
                              alt={p.nombre}
                              categoria={p.categoria}
                              rounded="rounded-2xl"
                            />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-slate-900 text-xs block">
                                {p.nombre}
                              </span>
                              {p.esPedidoGrande && (
                                <span className="text-[9px] bg-purple-100 text-purple-800 font-extrabold px-1.5 py-0.2 rounded-md">
                                  📦 Catering
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 capitalize font-medium">
                              {p.categoria}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Costo */}
                      <td className="py-3.5 px-3 text-center font-mono font-semibold text-slate-700">
                        S/ {costo.toFixed(2)}
                      </td>

                      {/* Precio BA */}
                      <td className="py-3.5 px-3 text-center font-mono font-extrabold text-brand-700 bg-pink-50/20">
                        S/ {pBA.toFixed(2)}
                      </td>

                      {/* Ganancia BA */}
                      <td className="py-3.5 px-3 text-center bg-pink-50/20">
                        <span className={`inline-block px-2 py-0.5 rounded-lg font-mono font-extrabold text-[11px] ${
                          pctBA >= 50 ? 'bg-emerald-100 text-emerald-800' :
                          pctBA >= 30 ? 'bg-amber-100 text-amber-800' :
                          'bg-rose-100 text-rose-800'
                        }`}>
                          +S/ {gananciaBA.toFixed(2)} ({pctBA.toFixed(0)}%)
                        </span>
                      </td>

                      {/* Precio VE */}
                      <td className="py-3.5 px-3 text-center font-mono font-extrabold text-amber-800 bg-amber-50/20">
                        S/ {pVE.toFixed(2)}
                      </td>

                      {/* Ganancia VE */}
                      <td className="py-3.5 px-3 text-center bg-amber-50/20">
                        <span className={`inline-block px-2 py-0.5 rounded-lg font-mono font-extrabold text-[11px] ${
                          pctVE >= 50 ? 'bg-emerald-100 text-emerald-800' :
                          pctVE >= 30 ? 'bg-amber-100 text-amber-800' :
                          'bg-rose-100 text-rose-800'
                        }`}>
                          +S/ {gananciaVE.toFixed(2)} ({pctVE.toFixed(0)}%)
                        </span>
                      </td>

                      {/* Stock por Sede */}
                      <td className="py-3.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5 text-[10px] font-mono">
                          <span className={`px-1.5 py-0.5 rounded-md font-bold ${
                            sBA > 3 ? 'bg-slate-100 text-slate-700' : sBA > 0 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-700'
                          }`}>
                            BA: {sBA}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded-md font-bold ${
                            sVE > 3 ? 'bg-slate-100 text-slate-700' : sVE > 0 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-700'
                          }`}>
                            VE: {sVE}
                          </span>
                        </div>
                      </td>

                      {/* Acciones */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleOpenEdit(p)}
                            title="Editar producto y precios"
                            className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 transition-colors"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(p)}
                            title="Eliminar producto"
                            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: CREAR / EDITAR PRODUCTO */}
      {(showCreateModal || editingProduct) && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 shadow-2xl border border-pink-100 w-full max-w-xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{formIcono || '🧁'}</span>
                <div>
                  <h3 className="font-serif font-bold text-lg text-slate-900">
                    {editingProduct ? 'Editar Producto & Rentabilidad' : 'Nuevo Producto en Catálogo'}
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    Precios diferenciados por local y control de catering
                  </span>
                </div>
              </div>
              <button
                onClick={() => { setShowCreateModal(false); setEditingProduct(null); }}
                className="text-slate-400 hover:text-slate-600 text-lg p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitProduct} className="space-y-4 text-xs">
              {/* Nombre y Descripción */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="font-bold text-slate-700 block mb-1">Nombre del Producto *</label>
                  <input
                    type="text"
                    required
                    value={formNombre}
                    onChange={(e) => setFormNombre(e.target.value)}
                    placeholder="Ej. Torta Red Velvet Especial"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Icono / Emoji</label>
                  <input
                    type="text"
                    value={formIcono}
                    onChange={(e) => setFormIcono(e.target.value)}
                    placeholder="🎂"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-center text-lg focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Descripción</label>
                <textarea
                  rows={2}
                  value={formDescripcion}
                  onChange={(e) => setFormDescripcion(e.target.value)}
                  placeholder="Detalle de ingredientes, sabor o porciones..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-brand-500"
                />
              </div>

              {/* URL de Imagen con Previsualización Skeleton en Vivo */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Foto del Producto (URL Imagen Web / Cloudinary / Firebase)
                </label>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <input
                      type="url"
                      value={formImagenUrl}
                      onChange={(e) => setFormImagenUrl(e.target.value)}
                      placeholder="https://ejemplo.com/torta-chocolate.webp"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-xs focus:outline-none focus:border-brand-500"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">
                      Pega un enlace https directo a la foto para que se visualice en la Carta y el POS.
                    </span>
                  </div>

                  {/* Previsualización interactiva con Skeleton */}
                  <div className="w-14 h-14 rounded-2xl overflow-hidden border border-pink-200 shadow-sm flex-shrink-0 bg-slate-50">
                    <ProductImage
                      src={formImagenUrl}
                      alt={formNombre || 'Previsualización'}
                      categoria={formCategoria}
                      rounded="rounded-2xl"
                    />
                  </div>
                </div>
              </div>

              {/* Categoría Dinámica */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700">Categoría del Producto *</label>
                  <button
                    type="button"
                    onClick={() => setIsNewCategory(!isNewCategory)}
                    className="text-[11px] font-extrabold text-brand-700 hover:underline"
                  >
                    {isNewCategory ? '← Elegir existente' : '+ Crear nueva categoría'}
                  </button>
                </div>

                {isNewCategory ? (
                  <input
                    type="text"
                    required
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Nombre de la nueva categoría (ej. Helados, Waffles, Desayunos)..."
                    className="w-full px-3 py-2 rounded-xl border border-brand-400 bg-white font-bold text-brand-900 focus:outline-none"
                    autoFocus
                  />
                ) : (
                  <select
                    value={formCategoria}
                    onChange={(e) => setFormCategoria(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-bold text-slate-800 focus:outline-none focus:border-brand-500"
                  >
                    {dynamicCategories.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.icon} {c.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Costos y Precios Diferenciados */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-pink-50/70 via-purple-50/50 to-amber-50/70 border border-pink-200 space-y-3">
                <span className="font-extrabold text-slate-800 uppercase tracking-wider text-[11px] block">
                  Finanzas & Precios por Local
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Costo */}
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Costo Elaboración (S/.)</label>
                    <input
                      type="number"
                      step="0.10"
                      min={0}
                      value={formCosto}
                      onChange={(e) => setFormCosto(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono font-bold focus:outline-none bg-white"
                    />
                  </div>

                  {/* Precio Buenos Aires */}
                  <div>
                    <label className="font-bold text-brand-900 block mb-1">🏪 Precio Buenos Aires (S/.) *</label>
                    <input
                      type="number"
                      step="0.50"
                      min={0}
                      required
                      value={formPrecioBA}
                      onChange={(e) => setFormPrecioBA(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3 py-2 rounded-xl border border-brand-300 font-mono font-bold focus:outline-none bg-white text-brand-700"
                    />
                  </div>

                  {/* Precio Villa España */}
                  <div>
                    <label className="font-bold text-amber-900 block mb-1">🏪 Precio Villa España (S/.) *</label>
                    <input
                      type="number"
                      step="0.50"
                      min={0}
                      required
                      value={formPrecioVE}
                      onChange={(e) => setFormPrecioVE(e.target.value)}
                      placeholder={formPrecioBA || "0.00"}
                      className="w-full px-3 py-2 rounded-xl border border-amber-300 font-mono font-bold focus:outline-none bg-white text-amber-800"
                    />
                  </div>
                </div>

                {/* Previsualización en Tiempo Real de Margen */}
                {previewCost > 0 && (previewPBA > 0 || previewPVE > 0) && (
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-pink-200/80 text-center font-mono text-[11px]">
                    <div className="bg-white/80 p-2 rounded-xl border border-pink-200">
                      <span className="text-slate-500 block text-[10px]">Margen Buenos Aires:</span>
                      <span className="font-extrabold text-brand-700">
                        +S/ {marginSolesBA.toFixed(2)} ({marginPctBA.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="bg-white/80 p-2 rounded-xl border border-amber-200">
                      <span className="text-slate-500 block text-[10px]">Margen Villa España:</span>
                      <span className="font-extrabold text-amber-800">
                        +S/ {marginSolesVE.toFixed(2)} ({marginPctVE.toFixed(0)}%)
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Stock Inicial por Sede */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Stock Inicial Buenos Aires</label>
                  <input
                    type="number"
                    min={0}
                    value={formStockBA}
                    onChange={(e) => setFormStockBA(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono font-bold focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Stock Inicial Villa España</label>
                  <input
                    type="number"
                    min={0}
                    value={formStockVE}
                    onChange={(e) => setFormStockVE(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono font-bold focus:outline-none"
                  />
                </div>
              </div>

              {/* Switches: Catering y Visibilidad por Sede */}
              <div className="space-y-2 pt-1 border-t border-slate-100">
                {/* Switch Pedido Grande */}
                <label className="flex items-center justify-between p-3 rounded-2xl bg-purple-50/70 border border-purple-200 cursor-pointer">
                  <div>
                    <span className="font-extrabold text-purple-950 block">
                      ¿Es para Pedido Grande / Catering?
                    </span>
                    <span className="text-[10px] text-purple-700 block">
                      Tortas enteras, fuentes, bocaditos por docena o ciento para eventos y reuniones
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={formEsPedidoGrande}
                    onChange={(e) => setFormEsPedidoGrande(e.target.checked)}
                    className="w-5 h-5 text-purple-600 rounded-lg focus:ring-purple-500"
                  />
                </label>

                {/* Switches Visibilidad en Carta Web */}
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer">
                    <span className="font-bold text-slate-700 text-[11px]">Visible Carta Web (BA)</span>
                    <input
                      type="checkbox"
                      checked={formVisibleBA}
                      onChange={(e) => setFormVisibleBA(e.target.checked)}
                      className="w-4 h-4 text-brand-600 rounded"
                    />
                  </label>
                  <label className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer">
                    <span className="font-bold text-slate-700 text-[11px]">Visible Carta Web (VE)</span>
                    <input
                      type="checkbox"
                      checked={formVisibleVE}
                      onChange={(e) => setFormVisibleVE(e.target.checked)}
                      className="w-4 h-4 text-brand-600 rounded"
                    />
                  </label>
                </div>
              </div>

              {/* Botones del Modal */}
              <div className="flex gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => { setShowCreateModal(false); setEditingProduct(null); }}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-2.5 rounded-xl bg-brand-700 hover:bg-brand-800 disabled:opacity-50 text-white font-extrabold shadow-md shadow-brand-700/20"
                >
                  {isSaving ? 'Guardando...' : editingProduct ? 'Guardar Cambios' : 'Crear Producto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
