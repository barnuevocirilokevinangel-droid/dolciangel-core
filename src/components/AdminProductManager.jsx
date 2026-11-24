import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  collections,
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp
} from '../services/firebase';
import {
  getProductPrice,
  getProductStock,
  getProductCost,
  extractCategories,
  getCategoryIcon,
  calculateNetMargin
} from '../services/productUtils';
import { ProductImage } from './ProductImage';
import { ImageUploader } from './ImageUploader';
import {
  Search,
  Plus,
  Edit3,
  Trash2,
  Crown,
  DollarSign,
  Package,
  Layers,
  ChefHat,
  ExternalLink,
  Info
} from 'lucide-react';

const MARGIN_BADGE_STYLES = {
  green: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
  amber: 'bg-amber-100 text-amber-800 border border-amber-200',
  red: 'bg-rose-100 text-rose-800 border border-rose-200'
};

export const AdminProductManager = () => {
  const { productos, recetasCosteo = [], perfil, showToast, openProductInCosteo } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('todos');
  const [filterTipo, setFilterTipo] = useState('todos'); // 'todos', 'vitrina', 'catering'

  // Modales y pestañas del modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [modalTab, setModalTab] = useState('basico'); // 'basico' | 'costeo' | 'stock'
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
  const [formControlaStock, setFormControlaStock] = useState(true);
  const [formRecetaId, setFormRecetaId] = useState(null);

  const isDueno = perfil?.isDueno ?? false;
  const dynamicCategories = useMemo(() => extractCategories(productos), [productos]);

  // Mapa rápido de recetas por productoId o recetaId
  const recetasById = useMemo(() => {
    const map = new Map();
    recetasCosteo.forEach((r) => {
      if (r.id) map.set(r.id, r);
      if (r.productoId) map.set(r.productoId, r);
    });
    return map;
  }, [recetasCosteo]);

  // Filtrado de la tabla
  const filteredProducts = useMemo(() => {
    return productos.filter((p) => {
      const term = searchTerm.toLowerCase().trim();
      const matchSearch =
        (p.nombre || '').toLowerCase().includes(term) ||
        (p.descripcion && p.descripcion.toLowerCase().includes(term)) ||
        (p.categoria && p.categoria.toLowerCase().includes(term));
      const matchCat =
        selectedCategory === 'todos' ||
        p.categoria?.toLowerCase() === selectedCategory.toLowerCase();

      let matchTipo = true;
      if (filterTipo === 'vitrina') matchTipo = !p.esPedidoGrande;
      if (filterTipo === 'catering') matchTipo = Boolean(p.esPedidoGrande);

      return matchSearch && matchCat && matchTipo;
    });
  }, [productos, searchTerm, selectedCategory, filterTipo]);

  // Cálculos de márgenes reales NETOS (descontando 18% IGV)
  const statsRentabilidad = useMemo(() => {
    let countBA = 0;
    let countVE = 0;
    let sumaMargenBA = 0;
    let sumaMargenVE = 0;

    productos.forEach((p) => {
      const costo = getProductCost(p);
      const pBA = getProductPrice(p, 'BA');
      const pVE = getProductPrice(p, 'VE');

      if (costo > 0 && pBA > 0) {
        sumaMargenBA += calculateNetMargin(pBA, costo).margenPct;
        countBA++;
      }
      if (costo > 0 && pVE > 0) {
        sumaMargenVE += calculateNetMargin(pVE, costo).margenPct;
        countVE++;
      }
    });

    return {
      avgMargenBA: countBA > 0 ? sumaMargenBA / countBA : 0,
      avgMargenVE: countVE > 0 ? sumaMargenVE / countVE : 0
    };
  }, [productos]);

  // Abrir Modal de Creación
  const handleOpenCreate = () => {
    setEditingProduct(null);
    setModalTab('basico');
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
    setFormControlaStock(true);
    setFormRecetaId(null);
    setShowCreateModal(true);
  };

  // Abrir Modal de Edición
  const handleOpenEdit = (p) => {
    setShowCreateModal(false);
    setEditingProduct(p);
    setModalTab('basico');
    setFormNombre(p.nombre || '');
    setFormDescripcion(p.descripcion || '');
    setFormCategoria(p.categoria || 'tortas');
    setIsNewCategory(false);
    setNewCategoryName('');
    setFormIcono(p.icono || getCategoryIcon(p.categoria));
    const initialImg =
      p.foto_url || p.imagen || p.image || p.url || p.fotoUrl || p.imagenUrl || p.imagen_url || p.foto || p.img || '';
    setFormImagenUrl(initialImg);
    setFormCosto(p.costoElaboracion?.toString() || p.costo?.toString() || '');
    setFormPrecioBA(getProductPrice(p, 'BA').toString());
    setFormPrecioVE(getProductPrice(p, 'VE').toString());
    setFormStockBA(getProductStock(p, 'BA').toString());
    setFormStockVE(getProductStock(p, 'VE').toString());
    setFormEsPedidoGrande(Boolean(p.esPedidoGrande));
    setFormVisibleBA(p.visible_BA ?? p.mostrar_en_carta ?? true);
    setFormVisibleVE(p.visible_VE ?? p.mostrar_en_carta ?? true);
    setFormControlaStock(p.controla_stock !== false && p.en_inventario !== false);
    const linkedReceta = p.receta_id || recetasById.get(p.id)?.id || null;
    setFormRecetaId(linkedReceta);
  };

  const closeModal = () => {
    setShowCreateModal(false);
    setEditingProduct(null);
  };

  // Guardar (Crear o Actualizar)
  const handleSubmitProduct = async (e) => {
    e.preventDefault();
    if (!formNombre.trim()) {
      setModalTab('basico');
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
      setModalTab('costeo');
      showToast('Debes ingresar al menos un precio válido mayor a 0', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const prodId = String(
        editingProduct?.id ? editingProduct.id : `prod_${finalCategory}_${Date.now()}`
      ).trim();

      const finalImg = String(formImagenUrl || '').trim();

      const payload = {
        id: prodId,
        nombre: formNombre.trim(),
        descripcion: formDescripcion.trim(),
        categoria: finalCategory,
        icono: formIcono || getCategoryIcon(finalCategory),
        // Compatibilidad total de campos de imagen
        foto_url: finalImg,
        imagen: finalImg,
        image: finalImg,
        url: finalImg,
        imagenUrl: finalImg,
        foto: finalImg,
        img: finalImg,
        costoElaboracion: costo,
        costo: costo,
        receta_id: formRecetaId || null,
        precios: {
          buenosAires: pBA,
          villaEspana: pVE
        },
        precio: pBA,
        precio_BA: pBA,
        precio_VE: pVE,
        stock: {
          buenosAires: sBA,
          villaEspana: sVE
        },
        stock_BA: sBA,
        stock_VE: sVE,
        controla_stock: Boolean(formControlaStock),
        en_inventario: Boolean(formControlaStock),
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

      await setDoc(doc(collections.productos, String(prodId)), payload, { merge: true });

      showToast(editingProduct ? '¡Producto actualizado con éxito!' : '¡Nuevo producto registrado!', 'success');
      closeModal();
    } catch (err) {
      console.error('Error al guardar producto:', err);
      showToast('Error: ' + err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Eliminar producto de Firestore
  const handleDeleteProduct = async (p) => {
    if (!isDueno || !p?.id) return;
    if (!window.confirm(`¿Estás seguro de eliminar el producto "${p.nombre}"?\n\nEsta acción eliminará el producto del catálogo y de la Carta Web.`)) {
      return;
    }
    try {
      await deleteDoc(doc(collections.productos, String(p.id)));
      showToast(`Producto "${p.nombre}" eliminado`, 'success');
    } catch (err) {
      console.error('Error al eliminar:', err);
      showToast('Error: ' + err.message, 'error');
    }
  };

  // Previsualización en tiempo real con IGV 18%
  const previewCost = parseFloat(formCosto) || 0;
  const previewPBA = parseFloat(formPrecioBA) || 0;
  const previewPVE = parseFloat(formPrecioVE) || 0;
  const netMarginBA = calculateNetMargin(previewPBA, previewCost);
  const netMarginVE = calculateNetMargin(previewPVE, previewCost);

  const isModalOpen = Boolean(showCreateModal || editingProduct);

  return (
    <div className="space-y-6">
      {/* Banner de Sección */}
      <div className="bg-gradient-to-r from-slate-900 via-brand-950 to-slate-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wider text-pink-300 bg-white/10 px-2.5 py-0.5 rounded-full border border-white/20 flex items-center gap-1">
                <Crown className="w-3.5 h-3.5 text-gold-400" />
                <span>Gestión de Catálogo & Rentabilidad Real (c/ IGV 18%)</span>
              </span>
            </div>
            <h2 className="text-2xl font-serif font-bold text-white mt-1">
              Catálogo Maestro & Análisis de Márgenes
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Rentabilidad neta calculada descontando el 18% de IGV sobre precio de venta.
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

        {/* KPIs de Rentabilidad Real */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-white/10 text-xs">
          <div className="bg-white/5 backdrop-blur p-3 rounded-xl border border-white/10">
            <span className="text-slate-400 block text-[11px]">Total Productos</span>
            <span className="text-lg font-black text-white">{productos.length}</span>
          </div>
          <div className="bg-white/5 backdrop-blur p-3 rounded-xl border border-white/10">
            <span className="text-slate-400 block text-[11px]">Con Receta / Escandallo</span>
            <span className="text-lg font-black text-purple-300">
              {productos.filter((p) => p.receta_id || recetasById.has(p.id)).length}
            </span>
          </div>
          <div className="bg-white/5 backdrop-blur p-3 rounded-xl border border-white/10">
            <span className="text-slate-400 block text-[11px]">Margen Neto Prom. BA (sin IGV)</span>
            <span className={`text-lg font-black ${
              statsRentabilidad.avgMargenBA >= 50 ? 'text-emerald-400' : statsRentabilidad.avgMargenBA >= 30 ? 'text-amber-400' : 'text-rose-400'
            }`}>
              {statsRentabilidad.avgMargenBA.toFixed(1)}%
            </span>
          </div>
          <div className="bg-white/5 backdrop-blur p-3 rounded-xl border border-white/10">
            <span className="text-slate-400 block text-[11px]">Margen Neto Prom. VE (sin IGV)</span>
            <span className={`text-lg font-black ${
              statsRentabilidad.avgMargenVE >= 50 ? 'text-emerald-400' : statsRentabilidad.avgMargenVE >= 30 ? 'text-amber-400' : 'text-rose-400'
            }`}>
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
          <div className="flex bg-slate-100 p-1 rounded-xl">
            {[
              { id: 'todos', label: 'Todos' },
              { id: 'vitrina', label: '🍰 Vitrina' },
              { id: 'catering', label: '📦 Catering' }
            ].map((t) => (
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

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 font-bold text-slate-700 focus:outline-none focus:border-brand-500 text-xs"
          >
            <option value="todos">Todas las categorías ({productos.length})</option>
            {dynamicCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabla Interactiva de Productos & Rentabilidad Neta (post IGV) */}
      <div className="bg-white rounded-3xl border border-pink-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider font-extrabold border-b border-slate-200 text-[10px]">
              <tr>
                <th className="py-3.5 px-4">Producto</th>
                <th className="py-3.5 px-3 text-center">Costo Elaboración</th>
                <th className="py-3.5 px-3 text-center bg-pink-50/40">Precio BA (Neto)</th>
                <th className="py-3.5 px-3 text-center bg-pink-50/40">Ganancia Neta BA</th>
                <th className="py-3.5 px-3 text-center bg-amber-50/40">Precio VE (Neto)</th>
                <th className="py-3.5 px-3 text-center bg-amber-50/40">Ganancia Neta VE</th>
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

                  const mBA = calculateNetMargin(pBA, costo);
                  const mVE = calculateNetMargin(pVE, costo);
                  const hasReceta = Boolean(p.receta_id || recetasById.has(p.id));

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Producto */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl overflow-hidden flex-shrink-0 shadow-inner bg-slate-50 border border-pink-100/60">
                            <ProductImage
                              src={p.foto_url || p.imagen || p.image || p.url || p.fotoUrl || p.imagenUrl || p.imagen_url || p.foto || p.img}
                              alt={p.nombre}
                              categoria={p.categoria}
                              rounded="rounded-2xl"
                              objectFit="object-cover"
                            />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-slate-900 text-xs block">
                                {p.nombre}
                              </span>
                              {p.controla_stock === false && (
                                <span className="text-[9px] bg-slate-100 text-slate-600 border border-slate-200 font-extrabold px-1.5 py-0.2 rounded-md">
                                  Sin Stock POS
                                </span>
                              )}
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

                      {/* Costo + indicador Auto (Receta) */}
                      <td className="py-3.5 px-3 text-center">
                        <span className="font-mono font-bold text-slate-800 block">
                          S/ {costo.toFixed(2)}
                        </span>
                        {hasReceta ? (
                          <button
                            type="button"
                            onClick={() => openProductInCosteo(p.id)}
                            title="Ver o editar receta en Costeo"
                            className="mt-0.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-purple-100 hover:bg-purple-200 text-purple-800 font-extrabold text-[9px] transition-colors"
                          >
                            <ChefHat className="w-2.5 h-2.5" />
                            <span>Auto (Receta)</span>
                          </button>
                        ) : (
                          <span className="text-[9px] text-slate-400 font-semibold">Manual</span>
                        )}
                      </td>

                      {/* Precio BA + Ingreso Neto sin IGV */}
                      <td className="py-3.5 px-3 text-center bg-pink-50/20">
                        <span className="font-mono font-extrabold text-brand-700 block">
                          S/ {pBA.toFixed(2)}
                        </span>
                        <span className="text-[9px] text-slate-400 font-mono">
                          Neto: S/ {mBA.ingresoNeto.toFixed(2)}
                        </span>
                      </td>

                      {/* Ganancia Neta BA */}
                      <td className="py-3.5 px-3 text-center bg-pink-50/20">
                        <span className={`inline-block px-2 py-0.5 rounded-lg font-mono font-extrabold text-[11px] ${MARGIN_BADGE_STYLES[mBA.status]}`}>
                          {mBA.gananciaNeta >= 0 ? '+' : ''}S/ {mBA.gananciaNeta.toFixed(2)} ({mBA.margenPct.toFixed(0)}%)
                        </span>
                      </td>

                      {/* Precio VE + Ingreso Neto sin IGV */}
                      <td className="py-3.5 px-3 text-center bg-amber-50/20">
                        <span className="font-mono font-extrabold text-amber-800 block">
                          S/ {pVE.toFixed(2)}
                        </span>
                        <span className="text-[9px] text-slate-400 font-mono">
                          Neto: S/ {mVE.ingresoNeto.toFixed(2)}
                        </span>
                      </td>

                      {/* Ganancia Neta VE */}
                      <td className="py-3.5 px-3 text-center bg-amber-50/20">
                        <span className={`inline-block px-2 py-0.5 rounded-lg font-mono font-extrabold text-[11px] ${MARGIN_BADGE_STYLES[mVE.status]}`}>
                          {mVE.gananciaNeta >= 0 ? '+' : ''}S/ {mVE.gananciaNeta.toFixed(2)} ({mVE.margenPct.toFixed(0)}%)
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

      {/* MODAL DE PRODUCTO REORGANIZADO EN PESTAÑAS LIMPIAS */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl border border-pink-100 w-full max-w-xl flex flex-col max-h-[90vh] overflow-hidden">
            {/* Header fijo */}
            <div className="px-6 pt-5 pb-3 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">{formIcono || '🧁'}</span>
                  <div>
                    <h3 className="font-serif font-bold text-lg text-slate-900">
                      {editingProduct ? `Editar: ${editingProduct.nombre}` : 'Nuevo Producto en Catálogo'}
                    </h3>
                    <span className="text-[11px] text-slate-400">
                      Configuración modular sin scroll excesivo
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeModal}
                  className="text-slate-400 hover:text-slate-700 text-lg p-1"
                >
                  ✕
                </button>
              </div>

              {/* Pestañas limpias */}
              <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1 rounded-2xl mt-4 text-xs">
                {[
                  { id: 'basico', label: 'Básico', icon: Layers },
                  { id: 'costeo', label: 'Costeo y Precios', icon: DollarSign },
                  { id: 'stock', label: 'Stock y POS', icon: Package }
                ].map((tab) => {
                  const Icon = tab.icon;
                  const active = modalTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setModalTab(tab.id)}
                      className={`py-2 px-2 rounded-xl font-extrabold flex items-center justify-center gap-1.5 transition-all ${
                        active
                          ? 'bg-white text-brand-800 shadow-sm'
                          : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Contenido de Pestaña Activa */}
            <form onSubmit={handleSubmitProduct} className="flex flex-col flex-1 min-h-0">
              <div className="p-6 overflow-y-auto space-y-4 text-xs flex-1">
                {/* PESTAÑA 1: BÁSICO */}
                {modalTab === 'basico' && (
                  <div className="space-y-4 animate-fadeIn">
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div className="sm:col-span-3">
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
                        <label className="font-bold text-slate-700 block mb-1">Icono</label>
                        <input
                          type="text"
                          value={formIcono}
                          onChange={(e) => setFormIcono(e.target.value)}
                          placeholder="🎂"
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-center text-lg focus:outline-none focus:border-brand-500"
                        />
                      </div>
                    </div>

                    {/* Categoría */}
                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="font-bold text-slate-700">Categoría *</label>
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
                          placeholder="Ej. Helados, Waffles, Desayunos..."
                          className="w-full px-3 py-2 rounded-xl border border-brand-400 bg-white font-bold text-brand-900 focus:outline-none"
                        />
                      ) : (
                        <select
                          value={formCategoria}
                          onChange={(e) => setFormCategoria(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-bold text-slate-800 focus:outline-none focus:border-brand-500"
                        >
                          {dynamicCategories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.icon} {c.label}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Descripción</label>
                      <textarea
                        rows={2}
                        value={formDescripcion}
                        onChange={(e) => setFormDescripcion(e.target.value)}
                        placeholder="Detalle de ingredientes, sabor o porciones..."
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-brand-500 resize-none"
                      />
                    </div>

                    {/* Upload WebP a Firebase Storage */}
                    <ImageUploader
                      value={formImagenUrl}
                      onChange={setFormImagenUrl}
                      alt={formNombre || 'Previsualización'}
                      categoria={formCategoria}
                      folder="productos"
                      onNotify={showToast}
                    />

                    {/* Visibilidad Web & Catering */}
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <label className="flex items-center justify-between p-3 rounded-2xl bg-purple-50/70 border border-purple-200 cursor-pointer">
                        <div>
                          <span className="font-extrabold text-purple-950 block">
                            ¿Es para Pedido Grande / Catering?
                          </span>
                          <span className="text-[10px] text-purple-700 block">
                            Tortas enteras, fuentes o bocaditos por ciento para eventos
                          </span>
                        </div>
                        <input
                          type="checkbox"
                          checked={formEsPedidoGrande}
                          onChange={(e) => setFormEsPedidoGrande(e.target.checked)}
                          className="w-5 h-5 text-purple-600 rounded-lg focus:ring-purple-500"
                        />
                      </label>

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
                  </div>
                )}

                {/* PESTAÑA 2: COSTEO Y PRECIOS (CON IGV 18%) */}
                {modalTab === 'costeo' && (
                  <div className="space-y-4 animate-fadeIn">
                    {/* Bloque de Costo (Auto por Receta vs Manual) */}
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <label className="font-extrabold text-slate-800 flex items-center gap-1.5">
                          <span>Costo Unitario de Elaboración (S/.)</span>
                          {formRecetaId && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-black text-[10px] border border-purple-200">
                              <ChefHat className="w-3 h-3" />
                              Auto (Receta)
                            </span>
                          )}
                        </label>

                        {editingProduct && (
                          <button
                            type="button"
                            onClick={() => {
                              const id = editingProduct.id;
                              closeModal();
                              openProductInCosteo(id);
                            }}
                            className="text-[11px] font-extrabold text-purple-700 hover:text-purple-900 inline-flex items-center gap-1 underline"
                          >
                            <ChefHat className="w-3.5 h-3.5" />
                            <span>{formRecetaId ? 'Ir a editar receta' : 'Crear receta en Costeo'}</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={formCosto}
                        readOnly={Boolean(formRecetaId)}
                        onChange={(e) => setFormCosto(e.target.value)}
                        placeholder="0.00"
                        className={`w-full px-3 py-2.5 rounded-xl border font-mono font-bold text-sm focus:outline-none ${
                          formRecetaId
                            ? 'bg-purple-50/70 border-purple-200 text-purple-900 cursor-not-allowed'
                            : 'bg-white border-slate-300 text-slate-900 focus:border-brand-500'
                        }`}
                      />

                      {formRecetaId ? (
                        <div className="flex items-center justify-between text-[11px] text-purple-700">
                          <span>Calculado automáticamente desde su escandallo en el módulo Costeo.</span>
                          <button
                            type="button"
                            onClick={() => setFormRecetaId(null)}
                            className="text-slate-500 hover:text-rose-600 underline font-semibold ml-2 shrink-0"
                          >
                            Desvincular
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-500 block">
                          Producto de reventa o costo manual. Para productos elaborados, vincula una receta desde Costeo.
                        </span>
                      )}
                    </div>

                    {/* Precios de Venta con IGV */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="p-3.5 rounded-2xl bg-pink-50/60 border border-pink-200 space-y-2">
                        <label className="font-bold text-brand-900 block">
                          🏪 Precio Buenos Aires (c/ IGV) *
                        </label>
                        <input
                          type="number"
                          step="0.10"
                          min={0}
                          required
                          value={formPrecioBA}
                          onChange={(e) => setFormPrecioBA(e.target.value)}
                          placeholder="0.00"
                          className="w-full px-3 py-2 rounded-xl border border-brand-300 font-mono font-extrabold text-sm focus:outline-none bg-white text-brand-800"
                        />
                        {previewPBA > 0 && (
                          <div className="space-y-1 pt-1 border-t border-pink-200/80 font-mono text-[11px]">
                            <div className="flex justify-between text-slate-600">
                              <span>Ingreso Neto (/1.18):</span>
                              <span className="font-bold">S/ {netMarginBA.ingresoNeto.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-slate-500">
                              <span>IGV (18%):</span>
                              <span>S/ {netMarginBA.igv.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center pt-1">
                              <span className="font-bold text-slate-700">Ganancia Neta:</span>
                              <span className={`px-2 py-0.5 rounded-lg font-extrabold ${MARGIN_BADGE_STYLES[netMarginBA.status]}`}>
                                {netMarginBA.gananciaNeta >= 0 ? '+' : ''}S/ {netMarginBA.gananciaNeta.toFixed(2)} ({netMarginBA.margenPct.toFixed(1)}%)
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200 space-y-2">
                        <label className="font-bold text-amber-900 block">
                          🏪 Precio Villa España (c/ IGV) *
                        </label>
                        <input
                          type="number"
                          step="0.10"
                          min={0}
                          required
                          value={formPrecioVE}
                          onChange={(e) => setFormPrecioVE(e.target.value)}
                          placeholder={formPrecioBA || '0.00'}
                          className="w-full px-3 py-2 rounded-xl border border-amber-300 font-mono font-extrabold text-sm focus:outline-none bg-white text-amber-900"
                        />
                        {previewPVE > 0 && (
                          <div className="space-y-1 pt-1 border-t border-amber-200/80 font-mono text-[11px]">
                            <div className="flex justify-between text-slate-600">
                              <span>Ingreso Neto (/1.18):</span>
                              <span className="font-bold">S/ {netMarginVE.ingresoNeto.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-slate-500">
                              <span>IGV (18%):</span>
                              <span>S/ {netMarginVE.igv.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center pt-1">
                              <span className="font-bold text-slate-700">Ganancia Neta:</span>
                              <span className={`px-2 py-0.5 rounded-lg font-extrabold ${MARGIN_BADGE_STYLES[netMarginVE.status]}`}>
                                {netMarginVE.gananciaNeta >= 0 ? '+' : ''}S/ {netMarginVE.gananciaNeta.toFixed(2)} ({netMarginVE.margenPct.toFixed(1)}%)
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[10px] text-slate-600">
                      <Info className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>
                        Semáforo de rentabilidad sobre venta neta: <strong className="text-emerald-700">Verde ≥50%</strong> • <strong className="text-amber-700">Ámbar 30–49%</strong> • <strong className="text-rose-700">Rojo &lt;30%</strong>.
                      </span>
                    </div>
                  </div>
                )}

                {/* PESTAÑA 3: STOCK Y CONTROL POS */}
                {modalTab === 'stock' && (
                  <div className="space-y-4 animate-fadeIn">
                    <div className={`p-4 rounded-2xl border transition-all ${
                      formControlaStock
                        ? 'bg-gradient-to-r from-amber-50/90 via-orange-50/50 to-pink-50/40 border-amber-300 shadow-xs'
                        : 'bg-slate-50 border-slate-200'
                    }`}>
                      <label className="flex items-start justify-between cursor-pointer gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-base">📦</span>
                            <span className="font-extrabold text-slate-900 text-sm">
                              Incluir en Control de Inventario / Vitrina
                            </span>
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                              formControlaStock
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-slate-200 text-slate-600 border border-slate-300'
                            }`}>
                              {formControlaStock ? 'Activo' : 'Excluido'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 mt-1 leading-snug">
                            Si está activo, el producto descuenta stock físico y se gestiona en el Kardex e Inventario.
                          </p>
                          {!formControlaStock && (
                            <p className="text-[10px] font-semibold text-rose-700 mt-1">
                              ⚠️ Al desactivarlo, este producto se ocultará de la cuadrícula de ventas del POS.
                            </p>
                          )}
                        </div>

                        <div className="relative inline-flex items-center cursor-pointer flex-shrink-0 pt-0.5">
                          <input
                            type="checkbox"
                            checked={formControlaStock}
                            onChange={(e) => setFormControlaStock(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-700"></div>
                        </div>
                      </label>
                    </div>

                    {formControlaStock ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">Stock Vitrina Buenos Aires</label>
                          <input
                            type="number"
                            min={0}
                            value={formStockBA}
                            onChange={(e) => setFormStockBA(e.target.value)}
                            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 font-mono font-bold text-sm focus:outline-none focus:border-brand-500"
                          />
                        </div>
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">Stock Vitrina Villa España</label>
                          <input
                            type="number"
                            min={0}
                            value={formStockVE}
                            onChange={(e) => setFormStockVE(e.target.value)}
                            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 font-mono font-bold text-sm focus:outline-none focus:border-brand-500"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 text-xs flex items-center gap-2">
                        <span>ℹ️</span>
                        <span>Control de stock físico inactivo para este producto. No descuenta inventario ni se muestra en POS.</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer fijo con acciones */}
              <div className="flex gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50/70">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 font-bold text-xs hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-[2] py-2.5 rounded-xl bg-brand-700 hover:bg-brand-800 disabled:opacity-50 text-white font-extrabold text-xs shadow-md shadow-brand-700/20"
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
