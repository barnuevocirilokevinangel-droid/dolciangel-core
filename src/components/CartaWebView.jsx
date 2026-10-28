import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { CATEGORIAS } from '../data/initialCatalog';
import { db, doc, updateDoc, serverTimestamp } from '../services/firebase';
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
  Save
} from 'lucide-react';

export const CartaWebView = () => {
  const { productos, showToast } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('todos');
  const [editingPriceId, setEditingPriceId] = useState(null);
  const [tempPrice, setTempPrice] = useState('');
  const [isUpdating, setIsUpdating] = useState({});

  // Filtrado
  const filteredProducts = productos.filter(p => {
    const matchSearch = p.nombre.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCat = selectedCategory === 'todos' || p.categoria === selectedCategory;
    return matchSearch && matchCat;
  });

  // Estadísticas
  const publicCount = productos.filter(p => p.mostrar_en_carta).length;
  const availableCount = productos.filter(p => p.disponible).length;

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
    setTempPrice(prod.precio.toString());
  };

  const handleSavePrice = async (prodId) => {
    const numPrice = parseFloat(tempPrice);
    if (isNaN(numPrice) || numPrice < 0) {
      showToast('Ingresa un precio válido en Soles', 'error');
      return;
    }
    await handleUpdateProduct(prodId, { precio: numPrice });
    setEditingPriceId(null);
  };

  return (
    <div className="pb-28 max-w-7xl mx-auto px-4 pt-4">
      {/* Banner Superior de Vinculación */}
      <div className="bg-gradient-to-r from-brand-700 via-pink-600 to-rose-600 rounded-3xl p-6 text-white shadow-lg shadow-brand-700/20 mb-6">
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
                Gestión de la Carta Digital & Precios
              </h2>
              <p className="text-xs text-pink-100 mt-0.5">
                Los cambios se reflejan al instante en la carta pública <span className="font-mono underline">dolciangel-carta-web</span>
              </p>
            </div>
          </div>

          {/* Estadísticas de la carta */}
          <div className="flex items-center gap-3 bg-white/10 backdrop-blur p-3 rounded-2xl border border-white/15 text-xs">
            <div className="text-center px-2">
              <span className="text-[10px] text-pink-200 block uppercase font-bold">En Carta Web</span>
              <span className="text-lg font-extrabold text-gold-300">{publicCount}</span>
            </div>
            <div className="w-px h-8 bg-white/20" />
            <div className="text-center px-2">
              <span className="text-[10px] text-pink-200 block uppercase font-bold">Disponibles</span>
              <span className="text-lg font-extrabold text-white">{availableCount}</span>
            </div>
            <div className="w-px h-8 bg-white/20" />
            <div className="text-center px-2">
              <span className="text-[10px] text-pink-200 block uppercase font-bold">Total Catálogo</span>
              <span className="text-lg font-extrabold text-white">{productos.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Controles de Búsqueda y Filtros */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-pink-100 mb-5">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filtrar por nombre..."
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:border-brand-500 focus:bg-white"
            />
          </div>

          {/* Pills de Categorías */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar w-full sm:w-auto">
            <button
              onClick={() => setSelectedCategory('todos')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                selectedCategory === 'todos'
                  ? 'bg-brand-700 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Todos
            </button>
            {CATEGORIAS.map((cat) => (
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
      </div>

      {/* Tabla / Lista de Productos */}
      <div className="bg-white rounded-2xl border border-pink-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4">Producto</th>
                <th className="py-3.5 px-4">Categoría</th>
                <th className="py-3.5 px-4 text-center">Precio Unitario (S/)</th>
                <th className="py-3.5 px-4 text-center">Carta Pública</th>
                <th className="py-3.5 px-4 text-center">Estado Tienda</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    No se encontraron productos con los filtros seleccionados
                  </td>
                </tr>
              ) : (
                filteredProducts.map((prod) => {
                  const isPublic = prod.mostrar_en_carta ?? true;
                  const isAvailable = prod.disponible ?? true;
                  const isSaving = isUpdating[prod.id];
                  const isEditingPrice = editingPriceId === prod.id;

                  return (
                    <tr 
                      key={prod.id} 
                      className="hover:bg-pink-50/30 transition-colors"
                    >
                      {/* Producto */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{prod.icono || '🧁'}</span>
                          <div>
                            <span className="font-bold text-slate-900 block text-sm">
                              {prod.nombre}
                            </span>
                            <span className="text-[11px] text-slate-400 font-mono">
                              ID: {prod.id}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Categoría */}
                      <td className="py-3.5 px-4">
                        <span className="capitalize font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full text-[11px]">
                          {prod.categoria}
                        </span>
                      </td>

                      {/* Precio Unitario Editable */}
                      <td className="py-3.5 px-4 text-center">
                        {isEditingPrice ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <span className="font-bold text-slate-500">S/</span>
                            <input
                              type="number"
                              step="0.5"
                              value={tempPrice}
                              onChange={(e) => setTempPrice(e.target.value)}
                              className="w-20 px-2 py-1 rounded-lg border border-brand-500 font-bold text-slate-800 text-xs focus:outline-none bg-pink-50/50"
                              autoFocus
                            />
                            <button
                              onClick={() => handleSavePrice(prod.id)}
                              className="p-1 rounded-lg bg-brand-700 text-white hover:bg-brand-800"
                              title="Guardar"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingPriceId(null)}
                              className="p-1 rounded-lg bg-slate-200 text-slate-600 hover:bg-slate-300"
                              title="Cancelar"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleStartEditPrice(prod)}
                            className="group inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-50 hover:bg-pink-100/70 border border-slate-200 hover:border-pink-300 transition-all"
                            title="Click para editar precio"
                          >
                            <span className="font-bold text-slate-900 text-sm">
                              S/ {prod.precio ? prod.precio.toFixed(2) : '0.00'}
                            </span>
                            <Edit3 className="w-3 h-3 text-slate-400 group-hover:text-brand-600 transition-colors" />
                          </button>
                        )}
                      </td>

                      {/* Toggle: Mostrar en Carta Pública */}
                      <td className="py-3.5 px-4 text-center">
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
                              <span>ON (Visible)</span>
                            </>
                          ) : (
                            <>
                              <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                              <span>OFF (Oculto)</span>
                            </>
                          )}
                        </button>
                      </td>

                      {/* Badge de Estado: Disponible / Agotado */}
                      <td className="py-3.5 px-4 text-center">
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
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
