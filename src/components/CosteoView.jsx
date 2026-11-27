import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  db,
  doc,
  writeBatch
} from '../services/firebase';
import {
  getProductPrice,
  getProductCost,
  extractCategories,
  calculateNetMargin,
  suggestPriceWithIgv
} from '../services/productUtils';
import {
  ChefHat,
  PackageOpen,
  Plus,
  Search,
  Edit3,
  Trash2,
  Save,
  X,
  AlertTriangle,
  CheckCircle2,
  Calculator,
  Sparkles,
  Box,
  Layers,
  Percent,
  RefreshCw,
  ArrowRight,
  Store
} from 'lucide-react';

const COMPRA_TO_USO = {
  kg: 'g',
  g: 'g',
  L: 'ml',
  ml: 'ml',
  und: 'und'
};

const DEFAULT_PAQUETE_QTY = {
  kg: 1000,
  g: 500,
  L: 1000,
  ml: 500,
  und: 1
};

const formatLimaDateShort = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString('es-PE', {
    timeZone: 'America/Lima',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

const parseDecimalInput = (val) => {
  if (typeof val === 'string') return val.replace(',', '.').trim();
  return val;
};

const safeNum = (val, decimals = null, fallback = 0) => {
  const n = Number(parseDecimalInput(val));
  if (!Number.isFinite(n)) return fallback;
  return decimals !== null ? Number(n.toFixed(decimals)) : n;
};

const sanitizeFirestoreData = (value) => {
  if (value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (Array.isArray(value)) return value.map(sanitizeFirestoreData);
  if (value !== null && typeof value === 'object') {
    const out = {};
    Object.entries(value).forEach(([k, v]) => {
      if (v !== undefined) {
        out[k] = sanitizeFirestoreData(v);
      }
    });
    return out;
  }
  return value;
};

const getSafeDocRef = (collectionName, docId) => {
  const safeCol = String(collectionName || '').trim();
  const safeId = String(docId || '').trim();
  if (!safeCol || !safeId) {
    throw new Error(`Referencia Firestore inválida: "${safeCol}/${safeId}"`);
  }
  return doc(db, safeCol, safeId);
};

const computeRecipeMetrics = (ingredientes = [], empaques = [], rendimiento = 1, mermaPct = 5, insumoMap = new Map()) => {
  const resolveCost = (line) => {
    const live = insumoMap.get(String(line?.insumoId || ''));
    const unitCost = live ? safeNum(live.costo_unitario_base) : safeNum(line?.costo_unitario_base);
    const qty = safeNum(line?.cantidad);
    return { unitCost, subtotal: qty * unitCost };
  };

  const costoTanda = ingredientes.reduce((sum, line) => sum + resolveCost(line).subtotal, 0);
  const rend = Math.max(safeNum(rendimiento, null, 1), 1);
  const costoPostreUnitario = costoTanda / rend;
  const pct = Math.max(safeNum(mermaPct, null, 0), 0);
  const costoMermaUnitario = costoPostreUnitario * (pct / 100);
  const costoEmpaqueUnitario = empaques.reduce((sum, line) => sum + resolveCost(line).subtotal, 0);
  const costoTotalUnitario = safeNum(costoPostreUnitario + costoMermaUnitario + costoEmpaqueUnitario, 2);

  return {
    costoTanda: safeNum(costoTanda, 4),
    rendimiento: rend,
    mermaPct: pct,
    costoPostreUnitario: safeNum(costoPostreUnitario, 4),
    costoMermaUnitario: safeNum(costoMermaUnitario, 4),
    costoEmpaqueUnitario: safeNum(costoEmpaqueUnitario, 4),
    costoTotalUnitario
  };
};

const commitBatchedOperations = async (operations) => {
  if (!operations.length) return;
  const CHUNK_SIZE = 400;
  for (let i = 0; i < operations.length; i += CHUNK_SIZE) {
    const batch = writeBatch(db);
    operations.slice(i, i + CHUNK_SIZE).forEach((op) => {
      if (op.type === 'set') {
        batch.set(op.ref, sanitizeFirestoreData(op.data), op.options || { merge: true });
      } else if (op.type === 'update') {
        batch.set(op.ref, sanitizeFirestoreData(op.data), { merge: true });
      } else if (op.type === 'delete') {
        batch.delete(op.ref);
      }
    });
    await batch.commit();
  }
};

const MARGIN_BADGE = {
  green: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  amber: 'bg-amber-100 text-amber-800 border-amber-200',
  red: 'bg-rose-100 text-rose-800 border-rose-200'
};

const EMPTY_INSUMO = {
  id: null,
  nombre: '',
  tipo: 'materia_prima',
  unidad_compra: 'kg',
  cantidad_por_paquete: '1000',
  unidad_uso: 'g',
  precio_compra: '',
  proveedor: ''
};

export const CosteoView = () => {
  const {
    productos,
    insumosProduccion,
    recetasCosteo,
    costeoTargetProductId,
    setCosteoTargetProductId,
    showToast
  } = useApp();

  const [subView, setSubView] = useState('recetas'); // 'insumos' | 'recetas'

  // ================== ESTADO SUB-VISTA A: INSUMOS ==================
  const [insumoSearch, setInsumoSearch] = useState('');
  const [insumoTipoFilter, setInsumoTipoFilter] = useState('TODOS');
  const [isInsumoModalOpen, setIsInsumoModalOpen] = useState(false);
  const [insumoForm, setInsumoForm] = useState(EMPTY_INSUMO);
  const [savingInsumo, setSavingInsumo] = useState(false);

  // ================== ESTADO SUB-VISTA B: RECETAS ==================
  const [recipeSearch, setRecipeSearch] = useState('');
  const [editingRecipeId, setEditingRecipeId] = useState(null);
  const [createNewProduct, setCreateNewProduct] = useState(false);
  const [selectedProductoId, setSelectedProductoId] = useState('');
  const [newProductNombre, setNewProductNombre] = useState('');
  const [newProductCategoria, setNewProductCategoria] = useState('postres');
  const [rendimiento, setRendimiento] = useState('12');
  const [mermaPct, setMermaPct] = useState('5');
  const [ingredientes, setIngredientes] = useState([]);
  const [empaques, setEmpaques] = useState([]);
  const [notasReceta, setNotasReceta] = useState('');

  // Pickers de insumos dentro de la receta
  const [ingSearch, setIngSearch] = useState('');
  const [ingSelectedId, setIngSelectedId] = useState('');
  const [ingQty, setIngQty] = useState('');
  const [empSearch, setEmpSearch] = useState('');
  const [empSelectedId, setEmpSelectedId] = useState('');
  const [empQty, setEmpQty] = useState('1');

  // Panel de Decisión de Precio
  const [targetMarginPct, setTargetMarginPct] = useState('55');
  const [precioBA, setPrecioBA] = useState('');
  const [precioVE, setPrecioVE] = useState('');
  const [savingRecipe, setSavingRecipe] = useState(false);

  const categoriasDisponibles = useMemo(() => extractCategories(productos), [productos]);

  const insumoMap = useMemo(() => {
    const map = new Map();
    insumosProduccion.forEach((ins) => map.set(ins.id, ins));
    return map;
  }, [insumosProduccion]);

  const productMap = useMemo(() => {
    const map = new Map();
    productos.forEach((p) => map.set(p.id, p));
    return map;
  }, [productos]);

  const recipeByProductId = useMemo(() => {
    const map = new Map();
    recetasCosteo.forEach((r) => {
      if (r.productoId) map.set(r.productoId, r);
    });
    return map;
  }, [recetasCosteo]);

  const insumoUsageCounts = useMemo(() => {
    const counts = new Map();
    recetasCosteo.forEach((r) => {
      const seen = new Set();
      [...(r.ingredientes || []), ...(r.empaques || [])].forEach((line) => {
        if (line.insumoId && !seen.has(line.insumoId)) {
          seen.add(line.insumoId);
          counts.set(line.insumoId, (counts.get(line.insumoId) || 0) + 1);
        }
      });
    });
    return counts;
  }, [recetasCosteo]);

  // Cargar receta existente al formulario
  const loadRecipeIntoEditor = (recipe) => {
    setEditingRecipeId(recipe.id);
    setCreateNewProduct(false);
    setSelectedProductoId(recipe.productoId || '');
    setRendimiento(String(recipe.rendimiento || 1));
    setMermaPct(String(recipe.merma_pct ?? 5));
    setIngredientes(Array.isArray(recipe.ingredientes) ? recipe.ingredientes : []);
    setEmpaques(Array.isArray(recipe.empaques) ? recipe.empaques : []);
    setNotasReceta(recipe.notas || '');

    const linkedProd = productMap.get(recipe.productoId);
    if (linkedProd) {
      setPrecioBA(String(getProductPrice(linkedProd, 'BA') || ''));
      setPrecioVE(String(getProductPrice(linkedProd, 'VE') || ''));
    } else {
      setPrecioBA(String(recipe.precio_BA_referencia || ''));
      setPrecioVE(String(recipe.precio_VE_referencia || ''));
    }
  };

  const resetRecipeEditor = (preselectProductId = '') => {
    setEditingRecipeId(null);
    setCreateNewProduct(false);
    setSelectedProductoId(preselectProductId);
    setNewProductNombre('');
    setNewProductCategoria(categoriasDisponibles[0]?.id || 'postres');
    setRendimiento('12');
    setMermaPct('5');
    setIngredientes([]);
    setEmpaques([]);
    setNotasReceta('');
    if (preselectProductId && productMap.has(preselectProductId)) {
      const p = productMap.get(preselectProductId);
      setPrecioBA(String(getProductPrice(p, 'BA') || ''));
      setPrecioVE(String(getProductPrice(p, 'VE') || ''));
    } else {
      setPrecioBA('');
      setPrecioVE('');
    }
  };

  // Navegación directa desde Catálogo ("Ir a editar receta")
  useEffect(() => {
    if (!costeoTargetProductId) return;
    setSubView('recetas');
    const existing = recipeByProductId.get(costeoTargetProductId);
    if (existing) {
      loadRecipeIntoEditor(existing);
    } else {
      resetRecipeEditor(costeoTargetProductId);
    }
    setCosteoTargetProductId(null);
  }, [costeoTargetProductId, recipeByProductId]);

  // Al seleccionar producto en dropdown de Recetas
  const handleSelectProducto = (prodId) => {
    setSelectedProductoId(prodId);
    const existing = recipeByProductId.get(prodId);
    if (existing && existing.id !== editingRecipeId) {
      loadRecipeIntoEditor(existing);
      showToast('Receta existente cargada para este producto.', 'info');
      return;
    }
    const prod = productMap.get(prodId);
    if (prod) {
      setPrecioBA(String(getProductPrice(prod, 'BA') || ''));
      setPrecioVE(String(getProductPrice(prod, 'VE') || ''));
    }
  };

  // ================== LOGICA INSUMOS + CASCADA ==================
  const filteredInsumos = useMemo(() => {
    const q = insumoSearch.trim().toLowerCase();
    return insumosProduccion.filter((ins) => {
      const matchTipo = insumoTipoFilter === 'TODOS' || ins.tipo === insumoTipoFilter;
      const matchText =
        !q ||
        (ins.nombre || '').toLowerCase().includes(q) ||
        (ins.proveedor || '').toLowerCase().includes(q);
      return matchTipo && matchText;
    });
  }, [insumosProduccion, insumoSearch, insumoTipoFilter]);

  const liveCostoUnitarioInsumo = useMemo(() => {
    const qty = Number(parseDecimalInput(insumoForm.cantidad_por_paquete)) || 0;
    const price = Number(parseDecimalInput(insumoForm.precio_compra)) || 0;
    return qty > 0 && price >= 0 ? price / qty : 0;
  }, [insumoForm.cantidad_por_paquete, insumoForm.precio_compra]);

  const openCreateInsumo = () => {
    setInsumoForm(EMPTY_INSUMO);
    setIsInsumoModalOpen(true);
  };

  const openEditInsumo = (ins) => {
    setInsumoForm({
      id: ins.id,
      nombre: ins.nombre || '',
      tipo: ins.tipo || 'materia_prima',
      unidad_compra: ins.unidad_compra || 'kg',
      cantidad_por_paquete: String(ins.cantidad_por_paquete || 1000),
      unidad_uso: ins.unidad_uso || COMPRA_TO_USO[ins.unidad_compra] || 'g',
      precio_compra: String(ins.precio_compra ?? ''),
      proveedor: ins.proveedor || ''
    });
    setIsInsumoModalOpen(true);
  };

  const handleUnidadCompraChange = (newUnit) => {
    const mappedUso = COMPRA_TO_USO[newUnit] || 'und';
    setInsumoForm((prev) => ({
      ...prev,
      unidad_compra: newUnit,
      unidad_uso: mappedUso,
      cantidad_por_paquete: prev.id ? prev.cantidad_por_paquete : String(DEFAULT_PAQUETE_QTY[newUnit] || 1)
    }));
  };

  const handleSaveInsumo = async (e) => {
    e.preventDefault();
    if (!insumoForm.nombre.trim()) {
      showToast('Ingresa el nombre del insumo.', 'warning');
      return;
    }
    const qty = Number(parseDecimalInput(insumoForm.cantidad_por_paquete));
    const price = Number(parseDecimalInput(insumoForm.precio_compra));
    if (!Number.isFinite(qty) || qty <= 0) {
      showToast('La cantidad por paquete debe ser mayor a 0.', 'warning');
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      showToast('Ingresa un precio de compra válido.', 'warning');
      return;
    }

    setSavingInsumo(true);
    try {
      const insumoId = String(insumoForm.id || `ins-${Date.now()}`).trim();
      const costoUnitarioBase = safeNum(price / qty, 6);
      const nowIso = new Date().toISOString();

      const payload = sanitizeFirestoreData({
        id: insumoId,
        nombre: String(insumoForm.nombre || '').trim(),
        tipo: String(insumoForm.tipo || 'materia_prima'),
        unidad_compra: String(insumoForm.unidad_compra || 'kg'),
        cantidad_por_paquete: safeNum(qty, 4, 1),
        unidad_uso: String(insumoForm.unidad_uso || 'g'),
        precio_compra: safeNum(price, 2, 0),
        costo_unitario_base: costoUnitarioBase,
        proveedor: String(insumoForm.proveedor || '').trim(),
        ultima_actualizacion: nowIso
      });

      const ops = [
        {
          type: 'set',
          ref: getSafeDocRef('insumos_produccion', insumoId),
          data: payload,
          options: { merge: true }
        }
      ];

      // Recálculo en Cascada sobre recetas_costeo y productos vinculados
      const updatedMap = new Map(insumoMap);
      updatedMap.set(insumoId, payload);

      let affectedRecipes = 0;
      let affectedProducts = 0;

      const syncLine = (line) =>
        String(line.insumoId) === insumoId
          ? {
              ...line,
              insumoId,
              nombre: payload.nombre,
              unidad_uso: payload.unidad_uso,
              costo_unitario_base: costoUnitarioBase,
              cantidad: safeNum(line.cantidad, 4, 0)
            }
          : {
              ...line,
              insumoId: String(line.insumoId || ''),
              nombre: String(line.nombre || ''),
              unidad_uso: String(line.unidad_uso || 'g'),
              costo_unitario_base: safeNum(line.costo_unitario_base, 6, 0),
              cantidad: safeNum(line.cantidad, 4, 0)
            };

      recetasCosteo.forEach((recipe) => {
        if (!recipe?.id) return;
        const usesInIng = (recipe.ingredientes || []).some((l) => String(l.insumoId) === insumoId);
        const usesInEmp = (recipe.empaques || []).some((l) => String(l.insumoId) === insumoId);
        if (!usesInIng && !usesInEmp) return;

        affectedRecipes += 1;
        const newIngredientes = (recipe.ingredientes || []).map(syncLine);
        const newEmpaques = (recipe.empaques || []).map(syncLine);
        const metrics = computeRecipeMetrics(
          newIngredientes,
          newEmpaques,
          recipe.rendimiento,
          recipe.merma_pct,
          updatedMap
        );

        ops.push({
          type: 'update',
          ref: getSafeDocRef('recetas_costeo', recipe.id),
          data: {
            ingredientes: newIngredientes,
            empaques: newEmpaques,
            costo_tanda: metrics.costoTanda,
            costo_postre_unitario: metrics.costoPostreUnitario,
            costo_empaque_unitario: metrics.costoEmpaqueUnitario,
            costo_total_unitario: metrics.costoTotalUnitario,
            updatedAt: nowIso
          }
        });

        if (recipe.productoId && productMap.has(String(recipe.productoId))) {
          affectedProducts += 1;
          ops.push({
            type: 'update',
            ref: getSafeDocRef('productos', recipe.productoId),
            data: {
              costoElaboracion: metrics.costoTotalUnitario,
              costo: metrics.costoTotalUnitario,
              receta_id: String(recipe.id),
              updatedAt: nowIso
            }
          });
        }
      });

      await commitBatchedOperations(ops);
      setIsInsumoModalOpen(false);
      setInsumoForm(EMPTY_INSUMO);

      if (affectedRecipes > 0) {
        showToast(
          `Insumo guardado. Cascada completada: ${affectedRecipes} receta(s) y ${affectedProducts} producto(s) recalculados.`,
          'success'
        );
      } else {
        showToast('Insumo de producción guardado correctamente.', 'success');
      }
    } catch (error) {
      console.error('Error guardando insumo:', error);
      showToast(`No se pudo guardar el insumo: ${error?.message || 'Error'}`, 'error');
    } finally {
      setSavingInsumo(false);
    }
  };

  const handleDeleteInsumo = async (ins) => {
    if (!ins?.id) return;
    const usedInRecipes = recetasCosteo.filter((r) =>
      [...(r.ingredientes || []), ...(r.empaques || [])].some((l) => String(l.insumoId) === String(ins.id))
    );
    if (usedInRecipes.length > 0) {
      const names = usedInRecipes.slice(0, 3).map((r) => r.productoNombre).join(', ');
      showToast(
        `No se puede eliminar "${ins.nombre}" porque está en uso en ${usedInRecipes.length} receta(s): ${names}. Quítalo primero de esas recetas.`,
        'warning'
      );
      return;
    }
    if (!window.confirm(`¿Eliminar el insumo "${ins.nombre}"?`)) return;

    try {
      await commitBatchedOperations([
        { type: 'delete', ref: getSafeDocRef('insumos_produccion', ins.id) }
      ]);
      showToast('Insumo eliminado.', 'info');
    } catch (error) {
      console.error('Error eliminando insumo:', error);
      showToast('Error al eliminar insumo.', 'error');
    }
  };

  // ================== LOGICA RECETAS / ESCANDALLOS ==================
  const rawMaterialOptions = useMemo(() => {
    const q = ingSearch.trim().toLowerCase();
    return insumosProduccion
      .filter((i) => !q || (i.nombre || '').toLowerCase().includes(q))
      .sort((a, b) => (a.tipo === 'materia_prima' ? -1 : 1) - (b.tipo === 'materia_prima' ? -1 : 1));
  }, [insumosProduccion, ingSearch]);

  const packagingOptions = useMemo(() => {
    const q = empSearch.trim().toLowerCase();
    return insumosProduccion
      .filter((i) => !q || (i.nombre || '').toLowerCase().includes(q))
      .sort((a, b) => (a.tipo === 'empaque' ? -1 : 1) - (b.tipo === 'empaque' ? -1 : 1));
  }, [insumosProduccion, empSearch]);

  const addLineToList = (insumoId, qtyStr, list, setList, resetQty) => {
    const ins = insumoMap.get(insumoId);
    const qty = Number(parseDecimalInput(qtyStr));
    if (!ins) {
      showToast('Selecciona un insumo válido.', 'warning');
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      showToast('Ingresa una cantidad mayor a 0.', 'warning');
      return;
    }

    const existsIdx = list.findIndex((item) => item.insumoId === ins.id);
    if (existsIdx >= 0) {
      const updated = list.map((item, idx) =>
        idx === existsIdx
          ? {
              ...item,
              cantidad: Number((safeNum(item.cantidad) + qty).toFixed(3)),
              costo_unitario_base: Number(ins.costo_unitario_base || 0)
            }
          : item
      );
      setList(updated);
    } else {
      setList([
        ...list,
        {
          insumoId: ins.id,
          nombre: ins.nombre,
          unidad_uso: ins.unidad_uso,
          costo_unitario_base: Number(ins.costo_unitario_base || 0),
          cantidad: qty
        }
      ]);
    }
    resetQty();
  };

  const updateLineQty = (setter, insumoId, value) => {
    const qty = Number(parseDecimalInput(value));
    setter((prev) =>
      prev.map((item) =>
        item.insumoId === insumoId ? { ...item, cantidad: Number.isFinite(qty) && qty >= 0 ? qty : 0 } : item
      )
    );
  };

  const removeLine = (setter, insumoId) => {
    setter((prev) => prev.filter((item) => item.insumoId !== insumoId));
  };

  const recipeMetrics = useMemo(
    () => computeRecipeMetrics(ingredientes, empaques, rendimiento, mermaPct, insumoMap),
    [ingredientes, empaques, rendimiento, mermaPct, insumoMap]
  );

  const suggestedPrice = useMemo(
    () => suggestPriceWithIgv(recipeMetrics.costoTotalUnitario, safeNum(targetMarginPct, 2, 55)),
    [recipeMetrics.costoTotalUnitario, targetMarginPct]
  );

  const marginBA = useMemo(
    () => calculateNetMargin(safeNum(precioBA, 2, 0), recipeMetrics.costoTotalUnitario),
    [precioBA, recipeMetrics.costoTotalUnitario]
  );

  const marginVE = useMemo(
    () => calculateNetMargin(safeNum(precioVE, 2, 0), recipeMetrics.costoTotalUnitario),
    [precioVE, recipeMetrics.costoTotalUnitario]
  );

  const handleSaveRecipe = async () => {
    if (savingRecipe) return;
    if (!createNewProduct && !selectedProductoId) {
      showToast('Selecciona un producto del catálogo o activa "Crear producto nuevo".', 'warning');
      return;
    }
    if (createNewProduct && !newProductNombre.trim()) {
      showToast('Escribe el nombre del nuevo producto a crear.', 'warning');
      return;
    }
    const rendNum = Number(parseDecimalInput(rendimiento));
    const mermaNum = Number(parseDecimalInput(mermaPct || '0'));
    if (!Number.isFinite(rendNum) || rendNum <= 0) {
      showToast('El rendimiento debe ser al menos 1 porción por tanda.', 'warning');
      return;
    }
    if (!Number.isFinite(mermaNum) || mermaNum < 0 || mermaNum > 60) {
      showToast('El % de merma debe estar entre 0% y 60%.', 'warning');
      return;
    }
    if (ingredientes.length === 0 && empaques.length === 0) {
      showToast('Agrega al menos un ingrediente o empaque al escandallo.', 'warning');
      return;
    }

    setSavingRecipe(true);
    try {
      const nowIso = new Date().toISOString();
      const targetProdId = String(createNewProduct ? `prod-${Date.now()}` : selectedProductoId).trim();
      const existingByProd = recipeByProductId.get(targetProdId);
      const recetaId = String(editingRecipeId || existingByProd?.id || `rec-${Date.now()}`).trim();

      const sanitizeLines = (list) =>
        list
          .filter((l) => safeNum(l?.cantidad) > 0 && l?.insumoId)
          .map((l) => {
            const live = insumoMap.get(String(l.insumoId));
            return {
              insumoId: String(l.insumoId),
              nombre: String(live?.nombre || l.nombre || 'Insumo'),
              unidad_uso: String(live?.unidad_uso || l.unidad_uso || 'g'),
              costo_unitario_base: safeNum(live?.costo_unitario_base ?? l.costo_unitario_base, 6, 0),
              cantidad: safeNum(l.cantidad, 4, 0)
            };
          });

      const cleanIngredientes = sanitizeLines(ingredientes);
      const cleanEmpaques = sanitizeLines(empaques);

      const linkedProd = productMap.get(targetProdId);
      const productoNombre = String(
        createNewProduct ? newProductNombre.trim() : linkedProd?.nombre || 'Producto'
      );

      const finalPrecioBA =
        safeNum(precioBA) > 0
          ? safeNum(precioBA, 2)
          : linkedProd
          ? safeNum(getProductPrice(linkedProd, 'BA'), 2)
          : 0;
      const finalPrecioVE =
        safeNum(precioVE) > 0
          ? safeNum(precioVE, 2)
          : finalPrecioBA || (linkedProd ? safeNum(getProductPrice(linkedProd, 'VE'), 2) : 0);

      const recetaDoc = sanitizeFirestoreData({
        id: recetaId,
        productoId: targetProdId,
        productoNombre,
        rendimiento: recipeMetrics.rendimiento,
        merma_pct: recipeMetrics.mermaPct,
        ingredientes: cleanIngredientes,
        empaques: cleanEmpaques,
        costo_tanda: recipeMetrics.costoTanda,
        costo_postre_unitario: recipeMetrics.costoPostreUnitario,
        costo_empaque_unitario: recipeMetrics.costoEmpaqueUnitario,
        costo_total_unitario: recipeMetrics.costoTotalUnitario,
        precio_BA_referencia: finalPrecioBA,
        precio_VE_referencia: finalPrecioVE,
        notas: String(notasReceta || '').trim(),
        updatedAt: nowIso
      });

      const ops = [
        {
          type: 'set',
          ref: getSafeDocRef('recetas_costeo', recetaId),
          data: recetaDoc,
          options: { merge: true }
        }
      ];

      if (createNewProduct) {
        ops.push({
          type: 'set',
          ref: getSafeDocRef('productos', targetProdId),
          data: sanitizeFirestoreData({
            id: targetProdId,
            nombre: productoNombre,
            categoria: String(newProductCategoria || 'postres'),
            costoElaboracion: recipeMetrics.costoTotalUnitario,
            costo: recipeMetrics.costoTotalUnitario,
            receta_id: recetaId,
            precios: {
              buenosAires: finalPrecioBA,
              villaEspana: finalPrecioVE
            },
            precio_BA: finalPrecioBA,
            precio_VE: finalPrecioVE,
            precio: finalPrecioBA,
            controla_stock: true,
            visiblePOS: true,
            stock_BA: 0,
            stock_VE: 0,
            disponible: true,
            enCarta: true,
            destacado: false,
            updatedAt: nowIso
          }),
          options: { merge: true }
        });
      } else {
        const prodUpdate = {
          costoElaboracion: recipeMetrics.costoTotalUnitario,
          costo: recipeMetrics.costoTotalUnitario,
          receta_id: recetaId,
          updatedAt: nowIso
        };
        if (finalPrecioBA > 0 || finalPrecioVE > 0) {
          prodUpdate.precios = {
            ...(linkedProd?.precios || {}),
            buenosAires: finalPrecioBA,
            villaEspana: finalPrecioVE
          };
          prodUpdate.precio_BA = finalPrecioBA;
          prodUpdate.precio_VE = finalPrecioVE;
          prodUpdate.precio = finalPrecioBA;
        }
        ops.push({
          type: 'set',
          ref: getSafeDocRef('productos', targetProdId),
          data: sanitizeFirestoreData(prodUpdate),
          options: { merge: true }
        });
      }

      await commitBatchedOperations(ops);
      setEditingRecipeId(recetaId);
      setCreateNewProduct(false);
      setSelectedProductoId(targetProdId);
      setPrecioBA(finalPrecioBA ? String(finalPrecioBA) : '');
      setPrecioVE(finalPrecioVE ? String(finalPrecioVE) : '');

      showToast(
        `Escandallo guardado y costo S/ ${recipeMetrics.costoTotalUnitario.toFixed(2)} sincronizado en "${productoNombre}".`,
        'success'
      );
    } catch (error) {
      console.error('Error guardando escandallo:', error);
      showToast(`Error al guardar la receta: ${error?.message || 'Error'}`, 'error');
    } finally {
      setSavingRecipe(false);
    }
  };

  const handleDeleteRecipe = async (recipe) => {
    if (!recipe?.id) return;
    if (!window.confirm(`¿Eliminar el escandallo de "${recipe.productoNombre}"? El producto conservará su último costo de forma manual.`)) {
      return;
    }
    try {
      const ops = [
        { type: 'delete', ref: getSafeDocRef('recetas_costeo', recipe.id) }
      ];
      if (recipe.productoId && productMap.has(String(recipe.productoId))) {
        ops.push({
          type: 'update',
          ref: getSafeDocRef('productos', recipe.productoId),
          data: { receta_id: null, updatedAt: new Date().toISOString() }
        });
      }
      await commitBatchedOperations(ops);
      if (editingRecipeId === recipe.id) {
        resetRecipeEditor();
      }
      showToast('Receta eliminada del módulo de Costeo.', 'info');
    } catch (error) {
      console.error('Error eliminando receta:', error);
      showToast('No se pudo eliminar la receta.', 'error');
    }
  };

  const filteredRecipes = useMemo(() => {
    const q = recipeSearch.trim().toLowerCase();
    return recetasCosteo.filter(
      (r) => !q || (r.productoNombre || '').toLowerCase().includes(q)
    );
  }, [recetasCosteo, recipeSearch]);

  const uncostedProducts = useMemo(() => {
    return productos.filter((p) => !recipeByProductId.has(p.id)).slice(0, 12);
  }, [productos, recipeByProductId]);

  const selectedProdObj = selectedProductoId ? productMap.get(selectedProductoId) : null;

  return (
    <div className="pb-28 max-w-7xl mx-auto px-4 pt-4 space-y-6">
      {/* Cabecera del Módulo Independiente de Costeo */}
      <div className="bg-gradient-to-r from-slate-900 via-brand-950 to-slate-900 text-white rounded-3xl p-6 shadow-xl border border-slate-800 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-[11px] font-bold uppercase tracking-wider text-amber-200">
            <ChefHat className="w-3.5 h-3.5" />
            <span>Módulo Independiente de Producción</span>
          </div>
          <h2 className="font-serif text-2xl sm:text-3xl font-black tracking-tight">
            Costeo de Producción &amp; Escandallos
          </h2>
          <p className="text-xs text-slate-300 max-w-2xl">
            Gestiona tus materias primas y empaques en taller sin mezclar con el stock de vitrina (BA/VE). Cada cambio de precio recalcula automáticamente tus recetas y márgenes netos post-IGV (18%).
          </p>
        </div>

        {/* Selector de Sub-vista */}
        <div className="flex bg-white/10 p-1.5 rounded-2xl border border-white/15 self-start lg:self-auto">
          <button
            type="button"
            onClick={() => setSubView('recetas')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all ${
              subView === 'recetas'
                ? 'bg-white text-slate-900 shadow-md'
                : 'text-slate-200 hover:text-white'
            }`}
          >
            <Calculator className="w-4 h-4" />
            <span>Recetas / Escandallos ({recetasCosteo.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setSubView('insumos')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all ${
              subView === 'insumos'
                ? 'bg-white text-slate-900 shadow-md'
                : 'text-slate-200 hover:text-white'
            }`}
          >
            <PackageOpen className="w-4 h-4" />
            <span>Insumos ({insumosProduccion.length})</span>
          </button>
        </div>
      </div>

      {/* =================================================================== */}
      {/* SUB-VISTA A: INSUMOS DE PRODUCCIÓN                                  */}
      {/* =================================================================== */}
      {subView === 'insumos' && (
        <div className="space-y-5">
          {/* KPIs Rápidos de Insumos */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-3xl p-4 border border-pink-100 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase text-slate-500">Total Insumos</p>
                <p className="text-2xl font-black text-slate-800">{insumosProduccion.length}</p>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-700">
                <Layers className="w-5 h-5" />
              </div>
            </div>
            <div className="bg-white rounded-3xl p-4 border border-amber-100 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase text-amber-700">Materia Prima</p>
                <p className="text-2xl font-black text-amber-800">
                  {insumosProduccion.filter((i) => i.tipo === 'materia_prima').length}
                </p>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600">
                <ChefHat className="w-5 h-5" />
              </div>
            </div>
            <div className="bg-white rounded-3xl p-4 border border-teal-100 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase text-teal-700">Empaques / Descartables</p>
                <p className="text-2xl font-black text-teal-800">
                  {insumosProduccion.filter((i) => i.tipo === 'empaque').length}
                </p>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-teal-50 flex items-center justify-center text-teal-600">
                <Box className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Barra de herramientas Insumos */}
          <div className="bg-white rounded-3xl p-4 border border-pink-100 shadow-sm flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
            <div className="flex flex-col sm:flex-row gap-2 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={insumoSearch}
                  onChange={(e) => setInsumoSearch(e.target.value)}
                  placeholder="Buscar insumo o proveedor..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-slate-200 text-xs font-semibold focus:outline-none focus:border-brand-500 bg-slate-50"
                />
              </div>

              <div className="flex bg-slate-100 p-1 rounded-2xl text-xs font-bold">
                {[
                  { id: 'TODOS', label: 'Todos' },
                  { id: 'materia_prima', label: 'Materia Prima' },
                  { id: 'empaque', label: 'Empaques' }
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setInsumoTipoFilter(f.id)}
                    className={`px-3 py-1.5 rounded-xl transition-all ${
                      insumoTipoFilter === f.id
                        ? 'bg-white text-brand-800 shadow-xs'
                        : 'text-slate-600'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={openCreateInsumo}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-brand-700 hover:bg-brand-800 text-white text-xs font-extrabold shadow-md transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Insumo</span>
            </button>
          </div>

          {/* Tabla de Insumos */}
          <div className="bg-white rounded-3xl border border-pink-100 shadow-sm overflow-hidden">
            {filteredInsumos.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <PackageOpen className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-sm font-bold text-slate-700">
                  No hay insumos registrados con este filtro
                </p>
                <p className="text-xs text-slate-500">
                  Agrega tus harinas, chocolates, quesos crema, cajas y cucharitas para empezar a costear.
                </p>
                <button
                  type="button"
                  onClick={openCreateInsumo}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-brand-50 text-brand-800 text-xs font-extrabold hover:bg-brand-100"
                >
                  <Plus className="w-4 h-4" />
                  <span>Registrar primer insumo</span>
                </button>
              </div>
            ) : (
              <>
                {/* VISTA MÓVIL (< md): LISTA DE TARJETAS APILADAS (CARD LIST) */}
                <div className="md:hidden divide-y divide-slate-100">
                  {filteredInsumos.map((ins) => {
                    const usageCount = insumoUsageCounts.get(ins.id) || 0;
                    return (
                      <div key={ins.id} className="p-4 space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-extrabold text-sm text-slate-900 leading-tight">
                              {ins.nombre}
                            </div>
                            {ins.proveedor && (
                              <div className="text-xs text-slate-500 mt-0.5">
                                Prov: {ins.proveedor}
                              </div>
                            )}
                          </div>
                          <span
                            className={`shrink-0 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                              ins.tipo === 'empaque'
                                ? 'bg-teal-50 text-teal-800 border-teal-200'
                                : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}
                          >
                            {ins.tipo === 'empaque' ? 'Empaque' : 'Materia Prima'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-2xl border border-slate-100 text-xs">
                          <div>
                            <span className="text-[10px] text-slate-400 font-bold uppercase block">
                              Compra ({ins.unidad_compra})
                            </span>
                            <span className="font-extrabold text-slate-800">
                              S/ {Number(ins.precio_compra || 0).toFixed(2)}
                            </span>
                            <span className="text-[11px] text-slate-500 ml-1">
                              / {ins.cantidad_por_paquete} {ins.unidad_uso}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-indigo-500 font-bold uppercase block">
                              Costo Base
                            </span>
                            <span className="font-black text-indigo-800">
                              S/ {Number(ins.costo_unitario_base || 0).toFixed(4)} / {ins.unidad_uso}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <div className="flex items-center gap-2">
                            {usageCount > 0 ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">
                                <RefreshCw className="w-3 h-3" />
                                {usageCount} receta{usageCount > 1 ? 's' : ''}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs">Sin vincular</span>
                            )}
                            <span className="text-[11px] text-slate-400">
                              • {formatLimaDateShort(ins.ultima_actualizacion)}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEditInsumo(ins)}
                              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-brand-100 text-slate-700 font-bold text-xs flex items-center gap-1"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Editar</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteInsumo(ins)}
                              className="p-2 rounded-xl bg-rose-50 text-rose-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* VISTA TABLET/ESCRITORIO (md:): TABLA COMPLETA */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-black uppercase text-slate-500">
                        <th className="py-3.5 px-4">Insumo / Proveedor</th>
                        <th className="py-3.5 px-3">Tipo</th>
                        <th className="py-3.5 px-3">Presentación Compra</th>
                        <th className="py-3.5 px-3 text-right">Precio Compra</th>
                        <th className="py-3.5 px-3 text-right">Costo Unitario Base</th>
                        <th className="py-3.5 px-3 text-center">Uso en Recetas</th>
                        <th className="py-3.5 px-3">Actualizado</th>
                        <th className="py-3.5 px-4 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {filteredInsumos.map((ins) => {
                        const usageCount = insumoUsageCounts.get(ins.id) || 0;
                        return (
                          <tr key={ins.id} className="hover:bg-pink-50/30 transition-colors">
                            <td className="py-3 px-4">
                              <div className="font-bold text-slate-800">{ins.nombre}</div>
                              {ins.proveedor && (
                                <div className="text-[11px] text-slate-500">Prov: {ins.proveedor}</div>
                              )}
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                                  ins.tipo === 'empaque'
                                    ? 'bg-teal-50 text-teal-800 border-teal-200'
                                    : 'bg-amber-50 text-amber-800 border-amber-200'
                                }`}
                              >
                                {ins.tipo === 'empaque' ? 'Empaque' : 'Materia Prima'}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-slate-700 font-semibold">
                              {ins.cantidad_por_paquete} {ins.unidad_uso}{' '}
                              <span className="text-slate-400">({ins.unidad_compra})</span>
                            </td>
                            <td className="py-3 px-3 text-right font-extrabold text-slate-800">
                              S/ {Number(ins.precio_compra || 0).toFixed(2)}
                            </td>
                            <td className="py-3 px-3 text-right">
                              <span className="inline-block px-2.5 py-1 rounded-xl bg-indigo-50 text-indigo-800 font-black">
                                S/ {Number(ins.costo_unitario_base || 0).toFixed(4)} / {ins.unidad_uso}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center">
                              {usageCount > 0 ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">
                                  <RefreshCw className="w-3 h-3" />
                                  {usageCount} receta{usageCount > 1 ? 's' : ''}
                                </span>
                              ) : (
                                <span className="text-slate-400 text-[11px]">Sin vincular</span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-[11px] text-slate-500">
                              {formatLimaDateShort(ins.ultima_actualizacion)}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => openEditInsumo(ins)}
                                  title="Editar y recalcular recetas"
                                  className="p-2 rounded-xl bg-slate-100 hover:bg-brand-100 text-slate-700 hover:text-brand-800 transition-colors"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteInsumo(ins)}
                                  title="Eliminar insumo"
                                  className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* SUB-VISTA B: RECETAS / ESCANDALLOS Y DECISIÓN DE PRECIO             */}
      {/* =================================================================== */}
      {subView === 'recetas' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* Columna Izquierda: Lista de Recetas y Productos sin Escandallo */}
          <div className="xl:col-span-4 space-y-4">
            <div className="bg-white rounded-3xl p-4 border border-pink-100 shadow-sm space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-serif font-bold text-base text-slate-800">
                  Recetas Guardadas
                </h3>
                <button
                  type="button"
                  onClick={() => resetRecipeEditor()}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-brand-700 hover:bg-brand-800 text-white text-xs font-extrabold transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nueva</span>
                </button>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={recipeSearch}
                  onChange={(e) => setRecipeSearch(e.target.value)}
                  placeholder="Filtrar receta por postre..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold bg-slate-50 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {filteredRecipes.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-6">
                    No hay escandallos guardados aún. Crea el primero a la derecha.
                  </p>
                ) : (
                  filteredRecipes.map((r) => {
                    const isActive = editingRecipeId === r.id;
                    const linked = productMap.get(r.productoId);
                    const pBA = linked ? getProductPrice(linked, 'BA') : Number(r.precio_BA_referencia || 0);
                    const m = calculateNetMargin(pBA, Number(r.costo_total_unitario || 0));
                    return (
                      <div
                        key={r.id}
                        className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-2 cursor-pointer ${
                          isActive
                            ? 'border-brand-500 bg-pink-50/70 shadow-xs'
                            : 'border-slate-100 bg-slate-50/60 hover:border-pink-200'
                        }`}
                        onClick={() => loadRecipeIntoEditor(r)}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-xs text-slate-800 truncate">
                            {r.productoNombre}
                          </div>
                          <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-2 mt-0.5">
                            <span>Costo: <strong className="text-slate-700">S/ {Number(r.costo_total_unitario || 0).toFixed(2)}</strong></span>
                            <span>•</span>
                            <span>{r.rendimiento || 1} porc.</span>
                            {pBA > 0 && (
                              <span className={`px-1.5 py-0.2 rounded-md border text-[10px] font-bold ${MARGIN_BADGE[m.status]}`}>
                                {m.margenPct.toFixed(0)}% neto
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteRecipe(r);
                          }}
                          title="Eliminar receta"
                          className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Acceso rápido a Productos sin receta */}
            {uncostedProducts.length > 0 && (
              <div className="bg-amber-50/70 rounded-3xl p-4 border border-amber-200/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    <span>Catálogo sin Receta ({productos.length - recipeByProductId.size})</span>
                  </h4>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {uncostedProducts.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => resetRecipeEditor(p.id)}
                      className="px-2.5 py-1 rounded-xl bg-white hover:bg-amber-100 border border-amber-200 text-[11px] font-bold text-slate-700 flex items-center gap-1 transition-colors"
                    >
                      <span>{p.nombre}</span>
                      <ArrowRight className="w-3 h-3 text-amber-600" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Columna Derecha: Constructor de Escandallo + Panel de Precio */}
          <div className="xl:col-span-8 space-y-5">
            {insumosProduccion.length === 0 && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-3xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="text-xs text-indigo-900">
                  <strong>Paso 1 recomendado:</strong> Aún no tienes insumos registrados. Registra ingredientes y empaques en la sub-vista <strong>Insumos</strong> para armar tus escandallos.
                </div>
                <button
                  type="button"
                  onClick={() => setSubView('insumos')}
                  className="px-4 py-2 rounded-2xl bg-indigo-600 text-white text-xs font-extrabold whitespace-nowrap hover:bg-indigo-700"
                >
                  Ir a Insumos →
                </button>
              </div>
            )}

            {/* 1. Vínculo con Producto del Catálogo */}
            <div className="bg-white rounded-3xl p-5 border border-pink-100 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <h3 className="font-serif font-bold text-lg text-slate-800">
                  {editingRecipeId ? 'Editando Escandallo' : '1. Producto del Escandallo'}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setCreateNewProduct((v) => !v);
                    setSelectedProductoId('');
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border transition-all ${
                    createNewProduct
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                  }`}
                >
                  {createNewProduct ? '✓ Creando producto nuevo en Catálogo' : '+ Crear producto nuevo desde aquí'}
                </button>
              </div>

              {createNewProduct ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-emerald-50/60 p-4 rounded-2xl border border-emerald-200">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Nombre del Nuevo Postre *
                    </label>
                    <input
                      type="text"
                      value={newProductNombre}
                      onChange={(e) => setNewProductNombre(e.target.value)}
                      placeholder="Ej. Cheesecake de Pistacho"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-emerald-200 bg-white text-xs font-bold focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Categoría del Catálogo
                    </label>
                    <select
                      value={newProductCategoria}
                      onChange={(e) => setNewProductCategoria(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-emerald-200 bg-white text-xs font-bold focus:outline-none focus:border-emerald-500"
                    >
                      {categoriasDisponibles.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.icon} {cat.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                  <div className="md:col-span-8">
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Producto del Catálogo Dolciangel
                    </label>
                    <select
                      value={selectedProductoId}
                      onChange={(e) => handleSelectProducto(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 focus:outline-none focus:border-brand-500"
                    >
                      <option value="">-- Selecciona un postre o bebida --</option>
                      {productos.map((p) => {
                        const hasRec = recipeByProductId.has(p.id);
                        return (
                          <option key={p.id} value={p.id}>
                            {p.nombre} {hasRec ? '✓ (Con receta)' : `(Costo actual: S/ ${getProductCost(p).toFixed(2)})`}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Rendimiento (porc.)
                    </label>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="1"
                      step="1"
                      value={rendimiento}
                      onChange={(e) => setRendimiento(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-2xl border border-slate-200 bg-slate-50 text-base sm:text-xs font-black text-center focus:outline-none focus:border-brand-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      % Merma
                    </label>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      max="60"
                      step="0.5"
                      value={mermaPct}
                      onChange={(e) => setMermaPct(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-2xl border border-slate-200 bg-slate-50 text-base sm:text-xs font-black text-center focus:outline-none focus:border-brand-500"
                    />
                  </div>
                </div>
              )}

              {createNewProduct && (
                <div className="grid grid-cols-2 gap-3 max-w-xs">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Rendimiento (porc.)
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={rendimiento}
                      onChange={(e) => setRendimiento(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-black text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      % Merma
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="60"
                      step="0.5"
                      value={mermaPct}
                      onChange={(e) => setMermaPct(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-black text-center"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 2. Ingredientes de la Tanda Completa */}
            <div className="bg-white rounded-3xl p-5 border border-pink-100 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-serif font-bold text-base text-slate-800">
                    2. Ingredientes por Tanda Completa (Base {rendimiento || 1} porciones)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Ej: para 1 molde de 12 porciones, agrega gramos/ml de toda la receta. Se dividirá automáticamente entre el rendimiento.
                  </p>
                </div>
              </div>

              {/* Buscador + Selector + Cantidad */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
                <div className="sm:col-span-4">
                  <input
                    type="text"
                    value={ingSearch}
                    onChange={(e) => setIngSearch(e.target.value)}
                    placeholder="Filtrar ingrediente..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold"
                  />
                </div>
                <div className="sm:col-span-4">
                  <select
                    value={ingSelectedId}
                    onChange={(e) => setIngSelectedId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold"
                  >
                    <option value="">-- Elegir insumo --</option>
                    {rawMaterialOptions.map((ins) => (
                      <option key={ins.id} value={ins.id}>
                        {ins.nombre} (S/ {Number(ins.costo_unitario_base || 0).toFixed(4)}/{ins.unidad_uso})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="any"
                    value={ingQty}
                    onChange={(e) => setIngQty(e.target.value)}
                    placeholder={`Cant. (${insumoMap.get(ingSelectedId)?.unidad_uso || 'g/ml'})`}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-base sm:text-xs font-bold"
                  />
                </div>
                <div className="sm:col-span-2">
                  <button
                    type="button"
                    onClick={() =>
                      addLineToList(ingSelectedId, ingQty, ingredientes, setIngredientes, () => {
                        setIngQty('');
                      })
                    }
                    className="w-full h-full py-2 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-extrabold flex items-center justify-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Agregar</span>
                  </button>
                </div>
              </div>

              {ingredientes.length > 0 && (
                <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl overflow-hidden">
                  {ingredientes.map((item) => {
                    const live = insumoMap.get(item.insumoId);
                    const unitCost = Number(live?.costo_unitario_base ?? item.costo_unitario_base ?? 0);
                    const sub = (Number(item.cantidad) || 0) * unitCost;
                    return (
                      <div key={item.insumoId} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs bg-white">
                        <div className="min-w-0 flex-1">
                          <span className="font-bold text-slate-800">{live?.nombre || item.nombre}</span>
                          <span className="text-[11px] text-slate-400 ml-2">
                            (S/ {unitCost.toFixed(4)}/{live?.unidad_uso || item.unidad_uso})
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.cantidad}
                            onChange={(e) => updateLineQty(setIngredientes, item.insumoId, e.target.value)}
                            className="w-20 px-2 py-1 rounded-lg border border-slate-200 text-right font-bold bg-slate-50"
                          />
                          <span className="text-[11px] font-bold text-slate-500 w-7">
                            {live?.unidad_uso || item.unidad_uso}
                          </span>
                          <span className="font-black text-slate-800 w-20 text-right">
                            S/ {sub.toFixed(2)}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeLine(setIngredientes, item.insumoId)}
                            className="p-1 text-rose-500 hover:bg-rose-50 rounded-lg"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 3. Empaque y Descartables POR PORCIÓN */}
            <div className="bg-white rounded-3xl p-5 border border-teal-100 shadow-sm space-y-4">
              <div>
                <h3 className="font-serif font-bold text-base text-slate-800">
                  3. Empaque &amp; Descartables (Por Porción Individual)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Se suma directo al costo unitario de cada venta (ej. 1 caja, 1 servilleta, 1 cucharita), sin dividir entre el rendimiento.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 bg-teal-50/50 p-3 rounded-2xl border border-teal-200/70">
                <div className="sm:col-span-4">
                  <input
                    type="text"
                    value={empSearch}
                    onChange={(e) => setEmpSearch(e.target.value)}
                    placeholder="Filtrar empaque..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold"
                  />
                </div>
                <div className="sm:col-span-4">
                  <select
                    value={empSelectedId}
                    onChange={(e) => setEmpSelectedId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold"
                  >
                    <option value="">-- Elegir empaque --</option>
                    {packagingOptions.map((ins) => (
                      <option key={ins.id} value={ins.id}>
                        {ins.nombre} (S/ {Number(ins.costo_unitario_base || 0).toFixed(4)}/{ins.unidad_uso})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="any"
                    value={empQty}
                    onChange={(e) => setEmpQty(e.target.value)}
                    placeholder="Cant./porción"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-base sm:text-xs font-bold"
                  />
                </div>
                <div className="sm:col-span-2">
                  <button
                    type="button"
                    onClick={() =>
                      addLineToList(empSelectedId, empQty, empaques, setEmpaques, () => {
                        setEmpQty('1');
                      })
                    }
                    className="w-full h-full py-2 px-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-extrabold flex items-center justify-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Agregar</span>
                  </button>
                </div>
              </div>

              {empaques.length > 0 && (
                <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl overflow-hidden">
                  {empaques.map((item) => {
                    const live = insumoMap.get(item.insumoId);
                    const unitCost = Number(live?.costo_unitario_base ?? item.costo_unitario_base ?? 0);
                    const sub = (Number(item.cantidad) || 0) * unitCost;
                    return (
                      <div key={item.insumoId} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs bg-white">
                        <div className="min-w-0 flex-1">
                          <span className="font-bold text-slate-800">{live?.nombre || item.nombre}</span>
                          <span className="text-[11px] text-slate-400 ml-2">
                            (S/ {unitCost.toFixed(4)}/{live?.unidad_uso || item.unidad_uso})
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.cantidad}
                            onChange={(e) => updateLineQty(setEmpaques, item.insumoId, e.target.value)}
                            className="w-20 px-2 py-1 rounded-lg border border-slate-200 text-right font-bold bg-slate-50"
                          />
                          <span className="text-[11px] font-bold text-slate-500 w-7">
                            {live?.unidad_uso || item.unidad_uso}
                          </span>
                          <span className="font-black text-slate-800 w-20 text-right">
                            S/ {sub.toFixed(2)}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeLine(setEmpaques, item.insumoId)}
                            className="p-1 text-rose-500 hover:bg-rose-50 rounded-lg"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 4. Fórmula Visible en Tiempo Real + Panel Integrado de Decisión de Precio */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-3xl p-5 shadow-lg space-y-5">
              <div>
                <h3 className="font-serif font-bold text-base text-amber-200 flex items-center gap-2 mb-3">
                  <Calculator className="w-4 h-4" />
                  <span>4. Fórmula de Costeo en Tiempo Real</span>
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs">
                  <div className="bg-white/10 rounded-2xl p-3 border border-white/10">
                    <span className="text-[10px] uppercase text-slate-300 font-bold block">Costo Tanda</span>
                    <strong className="text-base font-black text-white">S/ {recipeMetrics.costoTanda.toFixed(2)}</strong>
                  </div>
                  <div className="bg-white/10 rounded-2xl p-3 border border-white/10">
                    <span className="text-[10px] uppercase text-slate-300 font-bold block">
                      Postre Unit. (÷{recipeMetrics.rendimiento})
                    </span>
                    <strong className="text-base font-black text-white">S/ {recipeMetrics.costoPostreUnitario.toFixed(2)}</strong>
                  </div>
                  <div className="bg-white/10 rounded-2xl p-3 border border-white/10">
                    <span className="text-[10px] uppercase text-slate-300 font-bold block">
                      + Merma ({recipeMetrics.mermaPct}%)
                    </span>
                    <strong className="text-base font-black text-amber-300">+S/ {recipeMetrics.costoMermaUnitario.toFixed(2)}</strong>
                  </div>
                  <div className="bg-white/10 rounded-2xl p-3 border border-white/10">
                    <span className="text-[10px] uppercase text-slate-300 font-bold block">+ Empaque / Und</span>
                    <strong className="text-base font-black text-teal-300">+S/ {recipeMetrics.costoEmpaqueUnitario.toFixed(2)}</strong>
                  </div>
                  <div className="bg-brand-600/90 rounded-2xl p-3 border border-pink-400/50 col-span-2 sm:col-span-1">
                    <span className="text-[10px] uppercase text-pink-100 font-extrabold block">Costo Total Unit.</span>
                    <strong className="text-xl font-black text-white">S/ {recipeMetrics.costoTotalUnitario.toFixed(2)}</strong>
                  </div>
                </div>
              </div>

              {/* Panel Integrado de Decisión de Precio */}
              <div className="bg-white text-slate-800 rounded-2xl p-4 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pb-3 border-b border-slate-100">
                  <div>
                    <h4 className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-brand-700" />
                      <span>Panel de Decisión de Precio (Post-IGV 18%)</span>
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      El margen neto se calcula sobre el ingreso real sin IGV (<code className="bg-slate-100 px-1 rounded">Precio ÷ 1.18 - Costo</code>).
                    </p>
                  </div>

                  {/* Simulador Margen Objetivo */}
                  <div className="flex items-center gap-2 bg-pink-50 border border-pink-200 px-3 py-2 rounded-2xl">
                    <Percent className="w-3.5 h-3.5 text-brand-700" />
                    <span className="text-[11px] font-bold text-slate-700">Margen Neto Meta:</span>
                    <input
                      type="number"
                      min="5"
                      max="90"
                      value={targetMarginPct}
                      onChange={(e) => setTargetMarginPct(e.target.value)}
                      className="w-14 px-2 py-1 rounded-lg border border-pink-200 text-xs font-black text-center bg-white"
                    />
                    <span className="text-xs font-black text-brand-800">
                      Sug: S/ {suggestedPrice.toFixed(2)}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const s = String(suggestedPrice);
                        setPrecioBA(s);
                        setPrecioVE(s);
                      }}
                      className="px-2.5 py-1 rounded-xl bg-brand-700 hover:bg-brand-800 text-white text-[11px] font-extrabold"
                    >
                      Aplicar
                    </button>
                  </div>
                </div>

                {/* Precios BA y VE lado a lado */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Buenos Aires */}
                  <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                        <Store className="w-3.5 h-3.5 text-brand-700" />
                        <span>Sede Buenos Aires (BA)</span>
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold border ${MARGIN_BADGE[marginBA.status]}`}>
                        {marginBA.margenPct.toFixed(1)}% neto
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-500">S/</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.10"
                        value={precioBA}
                        onChange={(e) => setPrecioBA(e.target.value)}
                        placeholder={selectedProdObj ? String(getProductPrice(selectedProdObj, 'BA')) : '0.00'}
                        className="flex-1 px-3 py-2 rounded-xl border border-slate-200 bg-white text-base sm:text-sm font-black text-slate-900"
                      />
                      <button
                        type="button"
                        onClick={() => setPrecioVE(precioBA)}
                        className="px-2.5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-[11px] font-bold text-slate-700"
                        title="Copiar precio de BA a VE"
                      >
                        = a VE
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-[11px] pt-1">
                      <div>
                        <span className="text-slate-500 block">Neto s/ IGV</span>
                        <strong className="text-slate-800">S/ {marginBA.ingresoNeto.toFixed(2)}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block">IGV (18%)</span>
                        <strong className="text-slate-700">S/ {marginBA.igv.toFixed(2)}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Ganancia Neta</span>
                        <strong className={marginBA.gananciaNeta >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                          S/ {marginBA.gananciaNeta.toFixed(2)}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Villa España */}
                  <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                        <Store className="w-3.5 h-3.5 text-indigo-700" />
                        <span>Sede Villa España (VE)</span>
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold border ${MARGIN_BADGE[marginVE.status]}`}>
                        {marginVE.margenPct.toFixed(1)}% neto
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-500">S/</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.10"
                        value={precioVE}
                        onChange={(e) => setPrecioVE(e.target.value)}
                        placeholder={selectedProdObj ? String(getProductPrice(selectedProdObj, 'VE')) : '0.00'}
                        className="flex-1 px-3 py-2 rounded-xl border border-slate-200 bg-white text-base sm:text-sm font-black text-slate-900"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-[11px] pt-1">
                      <div>
                        <span className="text-slate-500 block">Neto s/ IGV</span>
                        <strong className="text-slate-800">S/ {marginVE.ingresoNeto.toFixed(2)}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block">IGV (18%)</span>
                        <strong className="text-slate-700">S/ {marginVE.igv.toFixed(2)}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Ganancia Neta</span>
                        <strong className={marginVE.gananciaNeta >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                          S/ {marginVE.gananciaNeta.toFixed(2)}
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Notas & Botón Guardar */}
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <input
                    type="text"
                    value={notasReceta}
                    onChange={(e) => setNotasReceta(e.target.value)}
                    placeholder="Notas opcionales del proceso o molde (ej. Molde 24cm, hornear 45 min)..."
                    className="flex-1 px-3.5 py-2.5 rounded-2xl border border-slate-200 bg-slate-50 text-xs font-semibold"
                  />
                  <button
                    type="button"
                    disabled={savingRecipe}
                    onClick={handleSaveRecipe}
                    className="flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-black shadow-lg shadow-emerald-600/25 transition-all whitespace-nowrap"
                  >
                    <Save className="w-4 h-4" />
                    <span>
                      {savingRecipe ? 'Sincronizando...' : 'Guardar Receta y Actualizar Producto'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL CRUD INSUMO (92dvh en móvil con footer fijo)                  */}
      {/* =================================================================== */}
      {isInsumoModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsInsumoModalOpen(false);
          }}
        >
          <div className="bg-white w-full h-[92dvh] sm:h-auto sm:max-w-lg rounded-t-2xl sm:rounded-3xl shadow-2xl border border-pink-100 flex flex-col overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between shrink-0">
              <h3 className="font-serif font-bold text-lg sm:text-xl text-slate-800">
                {insumoForm.id ? 'Editar Insumo de Producción' : 'Nuevo Insumo de Producción'}
              </h3>
              <button
                type="button"
                onClick={() => setIsInsumoModalOpen(false)}
                className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveInsumo} className="flex-1 flex flex-col justify-between overflow-y-auto text-xs">
              <div className="p-4 sm:p-5 space-y-3.5">
                {insumoForm.id && (insumoUsageCounts.get(insumoForm.id) || 0) > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-xs text-amber-900 flex items-start gap-2">
                    <RefreshCw className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      Este insumo se usa en <strong>{insumoUsageCounts.get(insumoForm.id)}</strong> receta(s). Al guardar, se recalcularán automáticamente sus costos y los productos vinculados.
                    </span>
                  </div>
                )}

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nombre del Insumo *</label>
                  <input
                    type="text"
                    required
                    value={insumoForm.nombre}
                    onChange={(e) => setInsumoForm({ ...insumoForm, nombre: e.target.value })}
                    placeholder="Ej. Queso Crema Philadelphia, Caja porción..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-base sm:text-xs font-semibold focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Tipo</label>
                    <select
                      value={insumoForm.tipo}
                      onChange={(e) => setInsumoForm({ ...insumoForm, tipo: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-base sm:text-xs font-bold bg-slate-50"
                    >
                      <option value="materia_prima">Materia Prima (Tanda)</option>
                      <option value="empaque">Empaque (Por Porción)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Unidad de Compra</label>
                    <select
                      value={insumoForm.unidad_compra}
                      onChange={(e) => handleUnidadCompraChange(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-base sm:text-xs font-bold bg-slate-50"
                    >
                      <option value="kg">Kilogramo (kg → uso en g)</option>
                      <option value="g">Gramos (g)</option>
                      <option value="L">Litro (L → uso en ml)</option>
                      <option value="ml">Mililitros (ml)</option>
                      <option value="und">Unidades / Paquete (und)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Contenido (en {insumoForm.unidad_uso}) *
                    </label>
                    <input
                      type="number"
                      inputMode="decimal"
                      required
                      min="0.001"
                      step="any"
                      value={insumoForm.cantidad_por_paquete}
                      onChange={(e) =>
                        setInsumoForm({ ...insumoForm, cantidad_por_paquete: e.target.value })
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-base sm:text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Precio Compra (S/.) *
                    </label>
                    <input
                      type="number"
                      inputMode="decimal"
                      required
                      min="0"
                      step="0.01"
                      value={insumoForm.precio_compra}
                      onChange={(e) =>
                        setInsumoForm({ ...insumoForm, precio_compra: e.target.value })
                      }
                      placeholder="Ej. 38.50"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-base sm:text-xs font-black"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Proveedor (opcional)
                  </label>
                  <input
                    type="text"
                    value={insumoForm.proveedor}
                    onChange={(e) => setInsumoForm({ ...insumoForm, proveedor: e.target.value })}
                    placeholder="Ej. Makro, Distribuidora Dulce..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-base sm:text-xs font-semibold"
                  />
                </div>

                {/* Cálculo Automático en Vivo */}
                <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-3 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-indigo-700 block">
                      Costo Unitario Base Calculado
                    </span>
                    {insumoForm.unidad_uso !== 'und' && (
                      <span className="text-[11px] text-indigo-600">
                        Equiv. S/ {(liveCostoUnitarioInsumo * 1000).toFixed(2)} por{' '}
                        {insumoForm.unidad_uso === 'g' ? '1 kg' : '1 L'}
                      </span>
                    )}
                  </div>
                  <div className="text-base font-black text-indigo-900">
                    S/ {liveCostoUnitarioInsumo.toFixed(4)} / {insumoForm.unidad_uso}
                  </div>
                </div>
              </div>

              <div className="sticky bottom-0 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] bg-white border-t border-slate-100 flex justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsInsumoModalOpen(false)}
                  className="flex-1 sm:flex-none px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingInsumo}
                  className="flex-[2] sm:flex-none px-5 py-3 rounded-xl bg-brand-700 hover:bg-brand-800 disabled:opacity-60 text-white font-extrabold flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{savingInsumo ? 'Recalculando...' : 'Guardar Insumo'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
