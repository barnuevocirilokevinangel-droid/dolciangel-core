import React, { useState, useMemo } from 'react';
import { useApp, SEDES } from '../context/AppContext';
import { 
  db, 
  collections, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  serverTimestamp, 
  increment,
  writeBatch
} from '../services/firebase';
import { 
  getProductPrice, 
  getProductStock, 
  extractCategories 
} from '../services/productUtils';
import { ProductImage } from './ProductImage';
import { 
  Package, 
  ArrowUpRight, 
  ArrowDownLeft, 
  AlertTriangle, 
  Plus, 
  Search, 
  Clock, 
  FileText,
  Filter,
  CheckCircle2,
  Crown,
  Trash2,
  Edit3,
  Boxes,
  Store,
  SlidersHorizontal,
  Layers,
  X,
  Save,
  Check,
  AlertCircle
} from 'lucide-react';

export const KardexView = () => {
  const { sede, perfil, productos, kardex, showToast } = useApp();

  // Selector de Tabs Principal: 'stock' (por defecto) | 'kardex'
  const [inventoryTab, setInventoryTab] = useState('stock');

  // Estado para Tab 1: Stock Actual
  const [stockSearch, setStockSearch] = useState('');
  const [stockCategory, setStockCategory] = useState('todos');
  const [stockStatusFilter, setStockStatusFilter] = useState('todos'); // 'todos', 'agotado_ba', 'agotado_ve', 'con_stock'
  
  // Modal de Ajuste Rápido de Stock
  const [editingStockProd, setEditingStockProd] = useState(null);
  const [quickStockBA, setQuickStockBA] = useState('');
  const [quickStockVE, setQuickStockVE] = useState('');
  const [quickMotivo, setQuickMotivo] = useState('Conteo físico y cuadre de inventario');
  const [isSavingStock, setIsSavingStock] = useState(false);

  // Estado para Tab 2: Movimientos Kardex
  const [activeFilter, setActiveFilter] = useState('TODOS');
  const [searchTerm, setSearchTerm] = useState('');

  // Modales de Kardex
  const [showMermaModal, setShowMermaModal] = useState(false);
  const [selectedProdMerma, setSelectedProdMerma] = useState('');
  const [cantidadMerma, setCantidadMerma] = useState('');
  const [motivoMerma, setMotivoMerma] = useState('Vencimiento');
  const [justificacionMerma, setJustificacionMerma] = useState('');

  const [showIngresoModal, setShowIngresoModal] = useState(false);
  const [selectedProdIngreso, setSelectedProdIngreso] = useState('');
  const [cantidadIngreso, setCantidadIngreso] = useState('');
  const [origenIngreso, setOrigenIngreso] = useState('Producción Interna');

  // Edición de Movimiento Kardex (Exclusivo Dueño 👑)
  const [editingKardex, setEditingKardex] = useState(null);
  const [editMotivo, setEditMotivo] = useState('');
  const [editJustificacion, setEditJustificacion] = useState('');
  const [editResponsable, setEditResponsable] = useState('');

  const isDueno = perfil?.isDueno ?? false;
  const stockField = sede ? SEDES[sede].stockKey : 'stock_BA';

  // Categorías extraídas dinámicamente
  const categories = useMemo(() => extractCategories(productos), [productos]);

  // Métricas Consolidadas de Stock
  const stockStats = useMemo(() => {
    let totalItems = productos.length;
    let totalUnitsBA = 0;
    let totalUnitsVE = 0;
    let agotadosBA = 0;
    let agotadosVE = 0;

    productos.forEach(p => {
      const ba = getProductStock(p, 'BA');
      const ve = getProductStock(p, 'VE');
      totalUnitsBA += ba;
      totalUnitsVE += ve;
      if (ba <= 0) agotadosBA++;
      if (ve <= 0) agotadosVE++;
    });

    return { totalItems, totalUnitsBA, totalUnitsVE, agotadosBA, agotadosVE };
  }, [productos]);

  // Filtrado de productos para la vista "Stock Actual"
  const filteredStockProducts = useMemo(() => {
    return productos.filter(p => {
      const matchSearch = (p.nombre || '').toLowerCase().includes(stockSearch.toLowerCase()) ||
                          (p.categoria || '').toLowerCase().includes(stockSearch.toLowerCase()) ||
                          (p.id || '').toLowerCase().includes(stockSearch.toLowerCase());
      
      const matchCategory = stockCategory === 'todos' || p.categoria === stockCategory;

      const ba = getProductStock(p, 'BA');
      const ve = getProductStock(p, 'VE');

      let matchStatus = true;
      if (stockStatusFilter === 'agotado_ba') {
        matchStatus = ba <= 0;
      } else if (stockStatusFilter === 'agotado_ve') {
        matchStatus = ve <= 0;
      } else if (stockStatusFilter === 'agotado_cualquiera') {
        matchStatus = ba <= 0 || ve <= 0;
      } else if (stockStatusFilter === 'con_stock') {
        matchStatus = ba > 0 && ve > 0;
      }

      return matchSearch && matchCategory && matchStatus;
    });
  }, [productos, stockSearch, stockCategory, stockStatusFilter]);

  // Filtrado de movimientos Kardex
  const filteredKardex = useMemo(() => {
    return kardex.filter(item => {
      const matchSede = !item.sede || item.sede === sede;
      const matchSearch = (item.productoNombre || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (item.motivo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (item.justificacion || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchType = activeFilter === 'TODOS' || item.tipo === activeFilter;
      return matchSede && matchSearch && matchType;
    });
  }, [kardex, sede, searchTerm, activeFilter]);

  // 1. Abrir Modal de Ajuste Rápido de Stock
  const handleOpenQuickStock = (prod) => {
    setEditingStockProd(prod);
    setQuickStockBA(getProductStock(prod, 'BA').toString());
    setQuickStockVE(getProductStock(prod, 'VE').toString());
    setQuickMotivo('Conteo físico y cuadre de inventario');
  };

  // 2. Guardar Ajuste Rápido de Stock en Firestore (Actualiza ambas sedes y audita en Kardex)
  const handleSaveQuickStock = async (e) => {
    e.preventDefault();
    if (!editingStockProd) return;

    const valBA = parseInt(quickStockBA, 10);
    const valVE = parseInt(quickStockVE, 10);

    if (isNaN(valBA) || valBA < 0 || isNaN(valVE) || valVE < 0) {
      showToast('Ingresa números válidos (0 o mayores) para ambas sedes', 'error');
      return;
    }

    setIsSavingStock(true);
    try {
      const currentBA = getProductStock(editingStockProd, 'BA');
      const currentVE = getProductStock(editingStockProd, 'VE');
      const deltaBA = valBA - currentBA;
      const deltaVE = valVE - currentVE;

      const batch = writeBatch(db);
      const prodRef = doc(collections.productos, editingStockProd.id);

      batch.update(prodRef, {
        stock_BA: valBA,
        stock_VE: valVE,
        stock: {
          buenosAires: valBA,
          villaEspana: valVE
        },
        updatedAt: serverTimestamp()
      });

      // Si hubo cambio en Buenos Aires, registrar movimiento de auditoría en Kardex
      if (deltaBA !== 0) {
        const kIdBA = `K-AJUSTE-BA-${Date.now()}`;
        const kRefBA = doc(collections.kardex, kIdBA);
        batch.set(kRefBA, {
          id: kIdBA,
          fecha: new Date().toISOString(),
          timestamp: serverTimestamp(),
          sede: 'BA',
          tipo: deltaBA > 0 ? 'INGRESO' : 'MERMA',
          productoId: editingStockProd.id,
          productoNombre: editingStockProd.nombre,
          cantidad: deltaBA,
          motivo: quickMotivo.trim() || 'Ajuste rápido de inventario',
          justificacion: `Ajuste manual de stock de ${currentBA} a ${valBA} unidades en Buenos Aires`,
          responsable: perfil?.nombre || 'Administración',
          origen: 'Ajuste de Inventario Consolidado'
        });
      }

      // Si hubo cambio en Villa España, registrar movimiento de auditoría en Kardex
      if (deltaVE !== 0) {
        const kIdVE = `K-AJUSTE-VE-${Date.now() + 1}`;
        const kRefVE = doc(collections.kardex, kIdVE);
        batch.set(kRefVE, {
          id: kIdVE,
          fecha: new Date().toISOString(),
          timestamp: serverTimestamp(),
          sede: 'VE',
          tipo: deltaVE > 0 ? 'INGRESO' : 'MERMA',
          productoId: editingStockProd.id,
          productoNombre: editingStockProd.nombre,
          cantidad: deltaVE,
          motivo: quickMotivo.trim() || 'Ajuste rápido de inventario',
          justificacion: `Ajuste manual de stock de ${currentVE} a ${valVE} unidades en Villa España`,
          responsable: perfil?.nombre || 'Administración',
          origen: 'Ajuste de Inventario Consolidado'
        });
      }

      await batch.commit();
      showToast(`Stock de "${editingStockProd.nombre}" actualizado correctamente`, 'success');
      setEditingStockProd(null);
    } catch (err) {
      console.error('Error al actualizar stock:', err);
      showToast('Error al actualizar stock: ' + err.message, 'error');
    } finally {
      setIsSavingStock(false);
    }
  };

  // 3. Registrar Merma / Pérdida con Justificación Obligatoria
  const handleRegistrarMerma = async (e) => {
    e.preventDefault();
    if (!selectedProdMerma) {
      showToast('Selecciona un producto para la merma', 'error');
      return;
    }
    const cant = parseInt(cantidadMerma, 10);
    if (isNaN(cant) || cant <= 0) {
      showToast('Ingresa una cantidad válida mayor a 0', 'error');
      return;
    }
    if (!justificacionMerma.trim()) {
      showToast('La justificación de la merma es obligatoria', 'error');
      return;
    }

    const prod = productos.find(p => p.id === selectedProdMerma);
    if (!prod) return;

    try {
      const kardexId = `K-MERMA-${Date.now()}`;
      const kardexRef = doc(collections.kardex, kardexId);

      await setDoc(kardexRef, {
        id: kardexId,
        fecha: new Date().toISOString(),
        timestamp: serverTimestamp(),
        sede,
        tipo: 'MERMA',
        productoId: prod.id,
        productoNombre: prod.nombre,
        cantidad: -cant,
        motivo: motivoMerma,
        justificacion: justificacionMerma.trim(),
        responsable: perfil.nombre,
        origen: 'Registro Manual de Pérdida'
      });

      // Descontar del stock en Firestore (soporta campos anidados y directos)
      const currentStock = getProductStock(prod, sede);
      const newStock = Math.max(0, currentStock - cant);
      const prodRef = doc(collections.productos, prod.id);

      await updateDoc(prodRef, {
        [stockField]: increment(-cant),
        [`stock.${sede === 'BA' ? 'buenosAires' : 'villaEspana'}`]: newStock,
        updatedAt: serverTimestamp()
      });

      showToast(`Merma registrada: -${cant} ${prod.nombre}`, 'warning');
      setShowMermaModal(false);
      setCantidadMerma('');
      setJustificacionMerma('');
      setSelectedProdMerma('');
    } catch (err) {
      console.error('Error al registrar merma:', err);
      showToast('Error al registrar la merma: ' + err.message, 'error');
    }
  };

  // 4. Registrar Ingreso de Mercadería
  const handleRegistrarIngreso = async (e) => {
    e.preventDefault();
    if (!selectedProdIngreso) {
      showToast('Selecciona un producto', 'error');
      return;
    }
    const cant = parseInt(cantidadIngreso, 10);
    if (isNaN(cant) || cant <= 0) {
      showToast('Ingresa una cantidad válida mayor a 0', 'error');
      return;
    }

    const prod = productos.find(p => p.id === selectedProdIngreso);
    if (!prod) return;

    try {
      const kardexId = `K-INGRESO-${Date.now()}`;
      const kardexRef = doc(collections.kardex, kardexId);

      await setDoc(kardexRef, {
        id: kardexId,
        fecha: new Date().toISOString(),
        timestamp: serverTimestamp(),
        sede,
        tipo: 'INGRESO',
        productoId: prod.id,
        productoNombre: prod.nombre,
        cantidad: cant,
        motivo: `Ingreso: ${origenIngreso}`,
        justificacion: `Abastecimiento desde ${origenIngreso}`,
        responsable: perfil.nombre,
        origen: origenIngreso
      });

      // Sumar al stock en Firestore
      const currentStock = getProductStock(prod, sede);
      const newStock = currentStock + cant;
      const prodRef = doc(collections.productos, prod.id);

      await updateDoc(prodRef, {
        [stockField]: increment(cant),
        [`stock.${sede === 'BA' ? 'buenosAires' : 'villaEspana'}`]: newStock,
        updatedAt: serverTimestamp()
      });

      showToast(`Stock ingresado: +${cant} ${prod.nombre}`, 'success');
      setShowIngresoModal(false);
      setCantidadIngreso('');
      setSelectedProdIngreso('');
    } catch (err) {
      console.error('Error al ingresar mercadería:', err);
      showToast('Error al ingresar mercadería: ' + err.message, 'error');
    }
  };

  // 5. Anular Movimiento de Kardex (Exclusivo Dueño 👑)
  const handleAnularKardex = async (item) => {
    if (!isDueno) return;
    const confirmMsg = `¿Deseas ANULAR este movimiento de kardex?\n\n` +
      `Producto: ${item.productoNombre}\n` +
      `Cantidad: ${item.cantidad > 0 ? '+' : ''}${item.cantidad}\n` +
      `Tipo: ${item.tipo}\n\n` +
      `✓ Se revertirá el stock de este producto en el inventario.`;

    if (!window.confirm(confirmMsg)) return;

    try {
      const batch = writeBatch(db);

      if (item.productoId) {
        const prodRef = doc(collections.productos, item.productoId);
        batch.update(prodRef, {
          [stockField]: increment(-item.cantidad),
          updatedAt: serverTimestamp()
        });
      }

      const kRef = doc(collections.kardex, item.id);
      batch.delete(kRef);

      await batch.commit();
      showToast(`Movimiento anulado y stock revertido correctamente`, 'success');
    } catch (err) {
      console.error('Error al anular kardex:', err);
      showToast('Error al anular movimiento: ' + err.message, 'error');
    }
  };

  // 6. Editar Movimiento (Exclusivo Dueño 👑)
  const handleOpenEditKardex = (item) => {
    setEditingKardex(item);
    setEditMotivo(item.motivo || '');
    setEditJustificacion(item.justificacion || '');
    setEditResponsable(item.responsable || perfil.nombre);
  };

  const handleSaveEditKardex = async (e) => {
    e.preventDefault();
    if (!editingKardex || !isDueno) return;

    try {
      const kRef = doc(collections.kardex, editingKardex.id);
      await updateDoc(kRef, {
        motivo: editMotivo.trim(),
        justificacion: editJustificacion.trim(),
        responsable: editResponsable.trim(),
        editadoPor: perfil.nombre,
        fechaEdicion: new Date().toISOString(),
        updatedAt: serverTimestamp()
      });

      showToast('Movimiento de Kardex actualizado');
      setEditingKardex(null);
    } catch (err) {
      console.error('Error al editar kardex:', err);
      showToast('Error al editar: ' + err.message, 'error');
    }
  };

  return (
    <div className="pb-28 max-w-7xl mx-auto px-4 pt-4">
      {/* Banner Superior Principal */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-brand-900 rounded-3xl p-6 text-white shadow-xl mb-6 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center text-2xl shadow-inner border border-white/10">
              📦
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-pink-300 bg-white/10 px-2.5 py-0.5 rounded-full border border-white/20">
                  Gestión Integral de Inventarios
                </span>
                {isDueno && (
                  <span className="text-[10px] font-extrabold bg-gold-400 text-slate-950 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                    <Crown className="w-3 h-3" />
                    <span>Modo Dueño</span>
                  </span>
                )}
              </div>
              <h2 className="text-xl md:text-2xl font-serif font-bold mt-1">
                Control de Stock & Kardex Multisede
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Sede Activa en POS: <span className="font-bold text-gold-300">{SEDES[sede]?.nombre}</span> • Sincronización en tiempo real
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowMermaModal(true)}
              className="px-3.5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs border border-rose-500/30 transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
            >
              <AlertTriangle className="w-4 h-4 text-rose-200" />
              <span>- Registrar Merma</span>
            </button>
            <button
              onClick={() => setShowIngresoModal(true)}
              className="px-4 py-2.5 rounded-xl bg-gold-500 hover:bg-gold-600 text-slate-950 font-extrabold text-xs shadow-md transition-all active:scale-95 flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>+ Ingreso Stock</span>
            </button>
          </div>
        </div>
      </div>

      {/* SELECTOR DE VISTAS PRINCIPALES (TABS) */}
      <div className="flex items-center gap-2 bg-slate-200/90 p-1.5 rounded-2xl mb-6 shadow-inner max-w-md">
        <button
          onClick={() => setInventoryTab('stock')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
            inventoryTab === 'stock'
              ? 'bg-white text-slate-900 shadow-md scale-[1.02]'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Boxes className="w-4 h-4 text-brand-700" />
          <span>Stock Actual ({productos.length})</span>
        </button>

        <button
          onClick={() => setInventoryTab('kardex')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
            inventoryTab === 'kardex'
              ? 'bg-white text-slate-900 shadow-md scale-[1.02]'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Clock className="w-4 h-4 text-brand-700" />
          <span>Movimientos Kardex ({kardex.length})</span>
        </button>
      </div>

      {/* ============================================================== */}
      {/* TAB 1: STOCK ACTUAL CONSOLIDADO POR SEDES                     */}
      {/* ============================================================== */}
      {inventoryTab === 'stock' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Tarjetas KPI de Resumen de Inventario */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-pink-100 shadow-sm">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Catálogo</span>
              <span className="text-xl font-extrabold text-slate-800 mt-1 block">{stockStats.totalItems} ítems</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-sm">
              <span className="text-[10px] font-bold text-emerald-600 uppercase block">Stock Buenos Aires</span>
              <span className="text-xl font-extrabold text-emerald-700 mt-1 block">{stockStats.totalUnitsBA} unids</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-blue-100 shadow-sm">
              <span className="text-[10px] font-bold text-blue-600 uppercase block">Stock Villa España</span>
              <span className="text-xl font-extrabold text-blue-700 mt-1 block">{stockStats.totalUnitsVE} unids</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-rose-100 shadow-sm">
              <span className="text-[10px] font-bold text-rose-500 uppercase block">Agotados B. Aires</span>
              <span className={`text-xl font-extrabold mt-1 block ${stockStats.agotadosBA > 0 ? 'text-rose-600' : 'text-slate-700'}`}>
                {stockStats.agotadosBA} prods
              </span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-rose-100 shadow-sm">
              <span className="text-[10px] font-bold text-rose-500 uppercase block">Agotados V. España</span>
              <span className={`text-xl font-extrabold mt-1 block ${stockStats.agotadosVE > 0 ? 'text-rose-600' : 'text-slate-700'}`}>
                {stockStats.agotadosVE} prods
              </span>
            </div>
          </div>

          {/* Barra de Filtros y Búsqueda para Stock Actual */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-pink-100 space-y-3">
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={stockSearch}
                  onChange={(e) => setStockSearch(e.target.value)}
                  placeholder="Buscar producto por nombre o código..."
                  className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:border-brand-500 focus:bg-white"
                />
              </div>

              {/* Filtro rápido por estado de stock */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar w-full sm:w-auto">
                {[
                  { id: 'todos', label: 'Todos' },
                  { id: 'con_stock', label: 'Con Stock en Ambas' },
                  { id: 'agotado_ba', label: 'Agotados en BA' },
                  { id: 'agotado_ve', label: 'Agotados en VE' },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setStockStatusFilter(f.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                      stockStatusFilter === f.id
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Categorías dinámicas */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
              <button
                onClick={() => setStockCategory('todos')}
                className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                  stockCategory === 'todos'
                    ? 'bg-brand-700 text-white'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                Todas las Categorías
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setStockCategory(cat)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                    stockCategory === cat
                      ? 'bg-brand-700 text-white'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* TABLA PRINCIPAL DE STOCK CONSOLIDADO */}
          <div className="bg-white rounded-2xl border border-pink-100 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <Boxes className="w-4 h-4 text-brand-700" />
                <span>Inventario Físico Actual ({filteredStockProducts.length} productos)</span>
              </h3>
              <span className="text-xs text-slate-500 hidden sm:inline">
                Sedes: Buenos Aires (BA) • Villa España (VE)
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Producto</th>
                    <th className="py-3 px-4">Categoría</th>
                    <th className="py-3 px-4 text-center">Stock Buenos Aires</th>
                    <th className="py-3 px-4 text-center">Stock Villa España</th>
                    <th className="py-3 px-4 text-center">Precio BA / VE</th>
                    <th className="py-3 px-4 text-center">Ajuste Rápido</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStockProducts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        <Package className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                        <p className="font-semibold text-sm">No se encontraron productos</p>
                        <p className="text-xs text-slate-400 mt-1">Prueba cambiando los filtros de búsqueda o categoría</p>
                      </td>
                    </tr>
                  ) : (
                    filteredStockProducts.map((prod) => {
                      const stockBA = getProductStock(prod, 'BA');
                      const stockVE = getProductStock(prod, 'VE');
                      const precioBA = getProductPrice(prod, 'BA');
                      const precioVE = getProductPrice(prod, 'VE');

                      return (
                        <tr key={prod.id} className="hover:bg-pink-50/20 transition-colors">
                          {/* 1. Imagen y Nombre del producto */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0 border border-slate-200 shadow-sm">
                                <ProductImage 
                                  src={prod.imagen || prod.foto} 
                                  alt={prod.nombre} 
                                  categoria={prod.categoria} 
                                  className="w-full h-full object-cover" 
                                />
                              </div>
                              <div>
                                <span className="font-bold text-slate-900 text-sm block leading-tight">
                                  {prod.nombre}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  ID: {prod.id}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* 2. Categoría */}
                          <td className="py-3 px-4">
                            <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold">
                              {prod.categoria || 'Sin categoría'}
                            </span>
                          </td>

                          {/* 3. Stock Buenos Aires (Verde si > 0, Rojo si <= 0) */}
                          <td className="py-3 px-4 text-center">
                            {stockBA > 0 ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-black shadow-xs">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                {stockBA} unids
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-xs font-black shadow-xs">
                                ⚠️ AGOTADO (0)
                              </span>
                            )}
                          </td>

                          {/* 4. Stock Villa España (Verde si > 0, Rojo si <= 0) */}
                          <td className="py-3 px-4 text-center">
                            {stockVE > 0 ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-black shadow-xs">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                {stockVE} unids
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-xs font-black shadow-xs">
                                ⚠️ AGOTADO (0)
                              </span>
                            )}
                          </td>

                          {/* 5. Precios BA / VE */}
                          <td className="py-3 px-4 text-center">
                            <div className="text-xs">
                              <span className="font-bold text-slate-800 block">
                                BA: S/ {precioBA.toFixed(2)}
                              </span>
                              <span className="text-slate-500 font-medium block text-[11px]">
                                VE: S/ {precioVE.toFixed(2)}
                              </span>
                            </div>
                          </td>

                          {/* 6. Botón de Ajuste Rápido de Stock Directo */}
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => handleOpenQuickStock(prod)}
                              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-brand-700 text-white font-bold text-xs shadow-sm transition-all flex items-center gap-1.5 mx-auto active:scale-95"
                            >
                              <SlidersHorizontal className="w-3.5 h-3.5 text-gold-400" />
                              <span>Ajustar Stock</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: MOVIMIENTOS KARDEX (HISTORIAL CRONOLÓGICO)             */}
      {/* ============================================================== */}
      {inventoryTab === 'kardex' && (
        <div className="space-y-5 animate-fadeIn">
          {/* Controles de Filtros y Búsqueda de Kardex */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-pink-100">
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar por producto, motivo o justificación..."
                  className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:border-brand-500 focus:bg-white"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar w-full sm:w-auto">
                {[
                  { id: 'TODOS', label: 'Todos' },
                  { id: 'VENTA', label: 'Ventas POS' },
                  { id: 'INGRESO', label: 'Ingresos' },
                  { id: 'MERMA', label: 'Mermas' },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setActiveFilter(f.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                      activeFilter === f.id
                        ? 'bg-brand-700 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Tabla Cronológica de Kardex */}
          <div className="bg-white rounded-2xl border border-pink-100 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-brand-700" />
                <span>Movimientos Registrados ({filteredKardex.length})</span>
              </h3>
              <span className="text-xs text-slate-500">
                Historial cronológico en tiempo real
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Fecha / Hora</th>
                    <th className="py-3 px-4">Tipo</th>
                    <th className="py-3 px-4">Producto</th>
                    <th className="py-3 px-4 text-center">Cantidad</th>
                    <th className="py-3 px-4">Motivo / Justificación</th>
                    <th className="py-3 px-4">Responsable</th>
                    {isDueno && <th className="py-3 px-4 text-center">Acciones</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredKardex.length === 0 ? (
                    <tr>
                      <td colSpan={isDueno ? 7 : 6} className="py-12 text-center text-slate-400">
                        <FileText className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                        <p className="font-semibold text-sm">No hay movimientos registrados</p>
                        <p className="text-xs text-slate-400 mt-1">Los ingresos, ventas y mermas aparecerán aquí</p>
                      </td>
                    </tr>
                  ) : (
                    filteredKardex.map((item) => {
                      const isIngreso = item.tipo === 'INGRESO' || (item.cantidad > 0 && item.tipo !== 'MERMA');
                      const isMerma = item.tipo === 'MERMA';

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                            <span className="font-bold text-slate-700 block">
                              {new Date(item.fecha).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {new Date(item.fecha).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                              isIngreso 
                                ? 'bg-emerald-100 text-emerald-800' 
                                : isMerma 
                                ? 'bg-rose-100 text-rose-800' 
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {item.tipo}
                            </span>
                          </td>

                          <td className="py-3 px-4 font-bold text-slate-800">
                            {item.productoNombre}
                          </td>

                          <td className="py-3 px-4 text-center">
                            <span className={`font-mono font-bold text-sm ${
                              isIngreso 
                                ? 'text-emerald-600' 
                                : 'text-rose-600'
                            }`}>
                              {item.cantidad > 0 ? `+${item.cantidad}` : item.cantidad}
                            </span>
                          </td>

                          <td className="py-3 px-4 max-w-xs">
                            <span className="font-medium text-slate-700 block">
                              {item.motivo || 'Sin motivo registrado'}
                            </span>
                            {item.justificacion && (
                              <span className="text-[11px] text-slate-500 block italic mt-0.5">
                                "{item.justificacion}"
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-slate-600">
                            {item.responsable || 'Sistema'}
                          </td>

                          {/* ACCIONES EXCLUSIVAS DEL DUEÑO 👑 */}
                          {isDueno && (
                            <td className="py-3 px-4 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => handleOpenEditKardex(item)}
                                  title="Editar motivo/justificación"
                                  className="p-1 rounded-lg text-slate-400 hover:text-amber-800 hover:bg-amber-50 transition-colors"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleAnularKardex(item)}
                                  title="Anular movimiento y revertir stock"
                                  className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: AJUSTE RÁPIDO DE STOCK DIRECTO                          */}
      {/* ============================================================== */}
      {editingStockProd && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 shadow-2xl border border-pink-100 w-full max-w-md">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl overflow-hidden bg-slate-100 flex-shrink-0 border border-slate-200 shadow-sm">
                  <ProductImage 
                    src={editingStockProd.imagen || editingStockProd.foto} 
                    alt={editingStockProd.nombre} 
                    categoria={editingStockProd.categoria} 
                    className="w-full h-full object-cover" 
                  />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-pink-600 bg-pink-50 px-2 py-0.5 rounded-md">
                    {editingStockProd.categoria || 'Producto'}
                  </span>
                  <h3 className="font-serif font-bold text-base text-slate-900 mt-0.5 leading-tight">
                    {editingStockProd.nombre}
                  </h3>
                  <span className="text-xs text-slate-400 font-mono">ID: {editingStockProd.id}</span>
                </div>
              </div>
              <button
                onClick={() => setEditingStockProd(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 mb-4 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              Ingresa el nuevo conteo de stock físico. El sistema calculará la diferencia y registrará la auditoría en el Kardex.
            </p>

            <form onSubmit={handleSaveQuickStock} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                {/* Stock Buenos Aires */}
                <div className="bg-emerald-50/50 p-3 rounded-2xl border border-emerald-200">
                  <label className="font-bold text-emerald-800 block mb-1">
                    Stock Buenos Aires *
                  </label>
                  <span className="text-[10px] text-emerald-600 block mb-1.5 font-medium">
                    Actual: {getProductStock(editingStockProd, 'BA')} unids
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={quickStockBA}
                    onChange={(e) => setQuickStockBA(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-emerald-300 font-black text-sm text-emerald-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Stock Villa España */}
                <div className="bg-blue-50/50 p-3 rounded-2xl border border-blue-200">
                  <label className="font-bold text-blue-800 block mb-1">
                    Stock Villa España *
                  </label>
                  <span className="text-[10px] text-blue-600 block mb-1.5 font-medium">
                    Actual: {getProductStock(editingStockProd, 'VE')} unids
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={quickStockVE}
                    onChange={(e) => setQuickStockVE(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-blue-300 font-black text-sm text-blue-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Motivo / Justificación del Ajuste *</label>
                <input
                  type="text"
                  value={quickMotivo}
                  onChange={(e) => setQuickMotivo(e.target.value)}
                  placeholder="Ej. Conteo físico y cuadre de inventario"
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-semibold focus:outline-none focus:border-brand-500 text-xs"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  disabled={isSavingStock}
                  onClick={() => setEditingStockProd(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingStock}
                  className="flex-1 py-2.5 rounded-xl bg-brand-700 hover:bg-brand-800 text-white font-bold shadow-md shadow-brand-700/20 transition-all flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSavingStock ? 'Guardando...' : 'Confirmar Ajuste'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDITAR MOVIMIENTO KARDEX (EXCLUSIVO DUEÑO 👑) */}
      {editingKardex && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 shadow-2xl border border-pink-100 w-full max-w-md">
            <div className="flex items-center gap-2 mb-3">
              <span className="p-2 rounded-xl bg-amber-100 text-amber-800">
                <Crown className="w-5 h-5" />
              </span>
              <div>
                <h3 className="font-serif font-bold text-lg text-slate-900">
                  Modificar Registro de Kardex
                </h3>
                <span className="text-xs text-slate-500">Permiso exclusivo de Dueño</span>
              </div>
            </div>

            <form onSubmit={handleSaveEditKardex} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Producto</label>
                <input
                  type="text"
                  disabled
                  value={editingKardex.productoNombre}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-100 text-slate-600 font-bold"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Motivo *</label>
                <input
                  type="text"
                  value={editMotivo}
                  onChange={(e) => setEditMotivo(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-semibold focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Justificación Detallada</label>
                <textarea
                  value={editJustificacion}
                  onChange={(e) => setEditJustificacion(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Responsable</label>
                <input
                  type="text"
                  value={editResponsable}
                  onChange={(e) => setEditResponsable(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingKardex(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-brand-700 hover:bg-brand-800 text-white font-bold shadow-md shadow-brand-700/20"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REGISTRAR MERMA / PÉRDIDA */}
      {showMermaModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 shadow-2xl border border-pink-100 w-full max-w-md">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 mx-auto flex items-center justify-center text-2xl mb-3">
              ⚠️
            </div>
            <h3 className="font-serif font-bold text-lg text-slate-900 text-center">
              Registrar Merma / Baja de Producto
            </h3>
            <p className="text-xs text-slate-500 text-center mt-1">
              Sede: {SEDES[sede]?.nombre} • Se descontará del stock disponible
            </p>

            <form onSubmit={handleRegistrarMerma} className="mt-4 space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Producto a dar de baja *
                </label>
                <select
                  value={selectedProdMerma}
                  onChange={(e) => setSelectedProdMerma(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold focus:outline-none focus:border-brand-500 bg-white"
                >
                  <option value="">-- Selecciona el producto --</option>
                  {productos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} (Stock actual: {getProductStock(p, sede)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Cantidad *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={cantidadMerma}
                    onChange={(e) => setCantidadMerma(e.target.value)}
                    placeholder="Ej. 2"
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Motivo *
                  </label>
                  <select
                    value={motivoMerma}
                    onChange={(e) => setMotivoMerma(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold focus:outline-none focus:border-brand-500 bg-white"
                  >
                    <option value="Vencimiento">Vencimiento</option>
                    <option value="Daño / Caída">Daño / Caída</option>
                    <option value="Falla de Refrigeración">Falla de frío</option>
                    <option value="Consumo de Personal">Consumo personal</option>
                    <option value="Muestra Comercial">Degustación / Muestra</option>
                    <option value="Error de Producción">Error producción</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Justificación Detallada *
                </label>
                <textarea
                  value={justificacionMerma}
                  onChange={(e) => setJustificacionMerma(e.target.value)}
                  placeholder="Explica qué ocurrió con el producto (Obligatorio para auditoría)..."
                  required
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowMermaModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-600/20"
                >
                  Confirmar Merma
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REGISTRAR INGRESO DE STOCK */}
      {showIngresoModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 shadow-2xl border border-pink-100 w-full max-w-md">
            <div className="w-12 h-12 rounded-2xl bg-gold-100 text-gold-700 mx-auto flex items-center justify-center text-2xl mb-3">
              📥
            </div>
            <h3 className="font-serif font-bold text-lg text-slate-900 text-center">
              Registrar Ingreso de Mercadería
            </h3>
            <p className="text-xs text-slate-500 text-center mt-1">
              Sede: {SEDES[sede]?.nombre} • Se sumará al stock disponible
            </p>

            <form onSubmit={handleRegistrarIngreso} className="mt-4 space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Producto a ingresar *
                </label>
                <select
                  value={selectedProdIngreso}
                  onChange={(e) => setSelectedProdIngreso(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold focus:outline-none focus:border-brand-500 bg-white"
                >
                  <option value="">-- Selecciona el producto --</option>
                  {productos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} (Stock actual: {getProductStock(p, sede)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Cantidad a sumar *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={cantidadIngreso}
                    onChange={(e) => setCantidadIngreso(e.target.value)}
                    placeholder="Ej. 10"
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Origen / Lote
                  </label>
                  <select
                    value={origenIngreso}
                    onChange={(e) => setOrigenIngreso(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold focus:outline-none focus:border-brand-500 bg-white"
                  >
                    <option value="Producción Interna">Taller / Cocina Central</option>
                    <option value="Proveedor Externo">Compra Proveedor</option>
                    <option value="Traslado de Sede">Traslado entre sedes</option>
                    <option value="Ajuste positivo">Ajuste de inventario</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowIngresoModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-brand-700 hover:bg-brand-800 text-white font-bold text-xs shadow-md shadow-brand-700/20"
                >
                  Sumar al Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
