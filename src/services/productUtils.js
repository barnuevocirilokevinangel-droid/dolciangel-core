/**
 * UTILIDADES DE PRODUCTOS, PRECIOS, COSTOS Y CATEGORÍAS
 * Dolciangel Core POS
 */

import { CATEGORIAS as BASE_CATEGORIAS } from '../data/initialCatalog';

/**
 * Obtiene el precio estricto de un producto según la sede activa
 * @param {Object} prod - Documento de producto
 * @param {string} sede - 'BA' | 'VE' o nombre de la sede
 * @returns {number} Precio unitario en S/.
 */
export function getProductPrice(prod, sede = 'BA') {
  if (!prod) return 0;

  const isBA = sede === 'BA' || sede === 'buenosAires' || sede === 'Buenos Aires';
  const isVE = sede === 'VE' || sede === 'villaEspana' || sede === 'Villa España';

  if (isBA) {
    if (prod.precios?.buenosAires !== undefined && prod.precios.buenosAires !== null && !isNaN(prod.precios.buenosAires)) {
      return Number(prod.precios.buenosAires);
    }
    if (prod.precio_BA !== undefined && prod.precio_BA !== null && !isNaN(prod.precio_BA)) {
      return Number(prod.precio_BA);
    }
  }

  if (isVE) {
    if (prod.precios?.villaEspana !== undefined && prod.precios.villaEspana !== null && !isNaN(prod.precios.villaEspana)) {
      return Number(prod.precios.villaEspana);
    }
    if (prod.precio_VE !== undefined && prod.precio_VE !== null && !isNaN(prod.precio_VE)) {
      return Number(prod.precio_VE);
    }
  }

  // Fallbacks universales
  if (prod.precio !== undefined && prod.precio !== null && !isNaN(prod.precio)) {
    return Number(prod.precio);
  }
  if (prod.precios?.buenosAires !== undefined) return Number(prod.precios.buenosAires);
  if (prod.precios?.villaEspana !== undefined) return Number(prod.precios.villaEspana);
  return 0;
}

/**
 * Obtiene el stock disponible de un producto según la sede activa
 */
export function getProductStock(prod, sede = 'BA') {
  if (!prod) return 0;

  const isVE = sede === 'VE' || sede === 'villaEspana' || sede === 'Villa España';

  if (isVE) {
    if (prod.stock?.villaEspana !== undefined && !isNaN(prod.stock.villaEspana)) {
      return Number(prod.stock.villaEspana);
    }
    if (prod.stock_VE !== undefined && !isNaN(prod.stock_VE)) {
      return Number(prod.stock_VE);
    }
  } else {
    if (prod.stock?.buenosAires !== undefined && !isNaN(prod.stock.buenosAires)) {
      return Number(prod.stock.buenosAires);
    }
    if (prod.stock_BA !== undefined && !isNaN(prod.stock_BA)) {
      return Number(prod.stock_BA);
    }
  }

  return 0;
}

/**
 * Obtiene el costo de elaboración estimado de un producto
 */
export function getProductCost(prod) {
  if (!prod) return 0;
  return Number(prod.costoElaboracion || prod.costo || 0);
}

/**
 * Asigna un icono emoji dinámico según el nombre de la categoría
 */
export function getCategoryIcon(catName = '') {
  if (!catName) return '🍰';
  const s = catName.toLowerCase().trim();
  if (s.includes('torta') || s.includes('pastel') || s.includes('tres leches') || s.includes('selva')) return '🎂';
  if (s.includes('cheesecake') || s.includes('postre') || s.includes('porción')) return '🍰';
  if (s.includes('pie') || s.includes('tartaleta') || s.includes('tarta')) return '🥧';
  if (s.includes('keke') || s.includes('queque') || s.includes('muffin') || s.includes('cupcake')) return '🥮';
  if (s.includes('bocado') || s.includes('alfajor') || s.includes('empanada') || s.includes('snack') || s.includes('salado')) return '🥟';
  if (s.includes('jugo') || s.includes('batido') || s.includes('frappe') || s.includes('bebida') || s.includes('gaseosa') || s.includes('refresco')) return '🥤';
  if (s.includes('cafe') || s.includes('café') || s.includes('infusion') || s.includes('infusión') || s.includes('té') || s.includes('te')) return '☕';
  if (s.includes('catering') || s.includes('evento') || s.includes('pedido') || s.includes('ciento')) return '📦';
  if (s.includes('combo') || s.includes('pack') || s.includes('promo')) return '🎁';
  return '🍰';
}

/**
 * Da formato amigable al nombre de la categoría
 */
export function formatCategoryLabel(catId = '') {
  if (!catId) return 'Varios';
  const clean = catId.trim();
  const base = BASE_CATEGORIAS.find(c => c.id === clean.toLowerCase());
  if (base) return base.label;
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

/**
 * Extrae dinámicamente todas las categorías existentes a partir de los productos en Firestore
 * Evita depender de una lista fija en código, manteniendo resiliencia antifrágil.
 */
export function extractCategories(productos = []) {
  const safeList = Array.isArray(productos) ? productos : [];
  const safeBase = Array.isArray(BASE_CATEGORIAS) ? BASE_CATEGORIAS : [];
  const categoryMap = new Map();

  // Categorías base iniciales con validación de nulidad
  safeBase.forEach(c => {
    if (c && c.id) {
      categoryMap.set(c.id.toLowerCase(), {
        id: c.id.toLowerCase(),
        label: c.label || c.id,
        icon: c.icon || '🍰',
        order: c.order || 99
      });
    }
  });

  // Agregar categorías dinámicas encontradas en productos de forma segura
  safeList.forEach(p => {
    if (p && p.categoria && typeof p.categoria === 'string' && p.categoria.trim()) {
      const catKey = p.categoria.trim().toLowerCase();
      if (!categoryMap.has(catKey)) {
        categoryMap.set(catKey, {
          id: catKey,
          label: formatCategoryLabel(p.categoria),
          icon: getCategoryIcon(p.categoria),
          order: 50
        });
      }
    }
  });

  return Array.from(categoryMap.values()).sort((a, b) => (a.order || 50) - (b.order || 50));
}
