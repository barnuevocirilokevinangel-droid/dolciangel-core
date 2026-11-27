import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import { 
  db, 
  collections, 
  onSnapshot, 
  doc, 
  getDoc,
  getDocs,
  setDoc, 
  updateDoc,
  deleteDoc,
  addDoc, 
  serverTimestamp, 
  writeBatch,
  runTransaction,
  increment,
  query,
  orderBy,
  limit
} from '../services/firebase';
import { INITIAL_PRODUCTS } from '../data/initialCatalog';
import {
  emitirComprobante,
  anularComprobante,
  obtenerSiguienteCorrelativo,
  incrementarCorrelativo,
  verificarEstadoComprobante
} from '../services/sunatService';
import { getProductPrice, getProductStock } from '../services/productUtils';

const AppContext = createContext();

export const SEDES = {
  BA: {
    id: 'BA',
    nombre: 'Buenos Aires',
    ciudad: 'Nuevo Chimbote',
    icon: '🏪',
    color: 'from-pink-600 to-rose-700',
    stockKey: 'stock_BA',
    ruc: '10427321351',
    razonSocial: 'RUTH PATRICIA CIRILO JARA',
    nombreComercial: 'DOLCIANGEL - PASTELERÍA FINA & CAFÉ',
    direccion: 'Av. Pacífico Mz. B Lt. 12 - Nuevo Chimbote'
  },
  VE: {
    id: 'VE',
    nombre: 'Villa España',
    ciudad: 'Chimbote',
    icon: '🏪',
    color: 'from-amber-500 to-rose-600',
    stockKey: 'stock_VE',
    ruc: '10427321351',
    razonSocial: 'RUTH PATRICIA CIRILO JARA',
    nombreComercial: 'DOLCIANGEL - PASTELERÍA FINA & CAFÉ',
    direccion: 'Villa España - Chimbote'
  }
};

export const PERFILES = [
  // Villa España
  { id: 'Mariana', nombre: 'Mariana', sede: 'VE', rol: 'Cajera / Atención Villa España', defaultPin: '3852', avatar: '👩‍💼', isDueno: false },
  { id: 'Kokin', nombre: 'Kokin', sede: 'VE', rol: 'Cajero / Atención Villa España', defaultPin: '7294', avatar: '👨‍💼', isDueno: false },
  
  // Buenos Aires
  { id: 'Marlon', nombre: 'Marlon', sede: 'BA', rol: 'Cajero / Atención Buenos Aires', defaultPin: '5168', avatar: '👨‍💼', isDueno: false },
  { id: 'Georgette', nombre: 'Georgette', sede: 'BA', rol: 'Cajera / Atención Buenos Aires', defaultPin: '4839', avatar: '👩‍💼', isDueno: false },
  { id: 'Dayhiro', nombre: 'Dayhiro', sede: 'BA', rol: 'Cajero / Atención Buenos Aires', defaultPin: '9371', avatar: '👨‍💼', isDueno: false },

  // Perfil Global
  { id: 'Angel', nombre: 'Angel (Dueño)', sede: 'ALL', rol: 'Administrador General 👑', defaultPin: '442919', avatar: '👑', isDueno: true },
];

const DEFAULT_ACCOUNTS = [
  { id: 'mesa-01', name: 'Mesa 01', type: 'mesa', items: [] },
  { id: 'mesa-02', name: 'Mesa 02', type: 'mesa', items: [] },
  { id: 'mesa-03', name: 'Mesa 03', type: 'mesa', items: [] },
  { id: 'mostrador', name: 'Mostrador / Llevar', type: 'llevar', items: [] },
];

export const AppProvider = ({ children }) => {
  // 1. Sesión y Sede
  // La sede física puede recordarse en la terminal (default 'BA' para Buenos Aires)
  const [sede, setSede] = useState(() => localStorage.getItem('dg_sede') || 'BA');
  // SEGURIDAD ESTRICTA: El perfil de colaborador NUNCA persiste entre recargas (F5),
  // cierre de ventana o pestañas nuevas. Siempre arranca en null para exigir PIN obligatorio.
  const [perfil, setPerfil] = useState(null);
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== 'undefined') {
      const p = window.location.pathname.toLowerCase();
      const h = window.location.hash.toLowerCase();
      if (p.startsWith('/admin/contabilidad') || h.startsWith('#/admin/contabilidad')) {
        return 'contabilidad';
      }
    }
    return 'ventas';
  });

  // Limpieza defensiva en montaje para evitar cualquier bypass por sesiones viejas en localStorage
  useEffect(() => {
    try {
      localStorage.removeItem('dg_perfil');
      sessionStorage.removeItem('dg_perfil');
    } catch (e) {
      // Silencioso
    }
  }, []);

  // 2. Cuentas / Multi-Mesa simultáneas con aislamiento estricto por sede
  const [accountsBySede, setAccountsBySede] = useState(() => {
    const loadSedeAccounts = (sKey) => {
      const saved = localStorage.getItem(`dg_accounts_${sKey}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch (e) {
          console.error(`Error parseando cuentas guardadas de ${sKey}:`, e);
        }
      }
      return DEFAULT_ACCOUNTS;
    };
    return {
      BA: loadSedeAccounts('BA'),
      VE: loadSedeAccounts('VE')
    };
  });

  const [activeAccountBySede, setActiveAccountBySede] = useState({
    BA: 'mesa-01',
    VE: 'mesa-01'
  });

  const currentSedeKey = sede === 'VE' ? 'VE' : 'BA';

  const accounts = useMemo(() => {
    return accountsBySede[currentSedeKey] || DEFAULT_ACCOUNTS;
  }, [accountsBySede, currentSedeKey]);

  const activeAccountId = activeAccountBySede[currentSedeKey] || 'mesa-01';

  const setActiveAccountId = (newId) => {
    setActiveAccountBySede(prev => ({
      ...prev,
      [currentSedeKey]: newId
    }));
  };

  const setAccounts = (updater) => {
    setAccountsBySede(prev => {
      const currentList = prev[currentSedeKey] || DEFAULT_ACCOUNTS;
      const nextList = typeof updater === 'function' ? updater(currentList) : updater;
      try {
        localStorage.setItem(`dg_accounts_${currentSedeKey}`, JSON.stringify(nextList));
      } catch (e) {
        console.error('Error guardando en localStorage:', e);
      }
      return {
        ...prev,
        [currentSedeKey]: nextList
      };
    });
  };

  // Cuenta activa actual
  const activeAccount = useMemo(() => {
    return accounts.find(a => a.id === activeAccountId) || accounts[0] || DEFAULT_ACCOUNTS[0];
  }, [accounts, activeAccountId]);

  // Carrito de la cuenta activa
  const cart = useMemo(() => {
    return activeAccount?.items || [];
  }, [activeAccount]);

  // Totales de la comanda activa
  const cartTotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.subtotal, 0);
  }, [cart]);

  const cartCount = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.quantity, 0);
  }, [cart]);

  // Total de platos pendientes en TODAS las cuentas/mesas
  const allAccountsCount = useMemo(() => {
    return accounts.reduce((acc, a) => {
      const aCount = (a.items || []).reduce((sub, it) => sub + it.quantity, 0);
      return acc + aCount;
    }, 0);
  }, [accounts]);

  // 3. Estado de sincronización Firestore y Detección de Red Offline/Online
  const [syncStatus, setSyncStatus] = useState('connecting');
  const [isOnline, setIsOnline] = useState(() => typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      showToast('Conexión restablecida con éxito', 'success');
    };
    const handleOffline = () => {
      setIsOnline(false);
      showToast('Sin conexión a internet. Modo offline activado.', 'warning');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const [productos, setProductos] = useState([]);
  const [productosLoaded, setProductosLoaded] = useState(false);
  const [ventas, setVentas] = useState([]);
  const [sesionesCajaList, setSesionesCajaList] = useState([]);
  const [movimientosCaja, setMovimientosCaja] = useState([]);
  const [kardex, setKardex] = useState([]);
  const [clientesFidelidad, setClientesFidelidad] = useState([]);
  const [insumosProduccion, setInsumosProduccion] = useState([]);
  const [recetasCosteo, setRecetasCosteo] = useState([]);
  const [costeoTargetProductId, setCosteoTargetProductId] = useState(null);

  const inFlightSalesRef = useRef(new Set());
  const inFlightVoidsRef = useRef(new Set());

  const openProductInCosteo = (productId) => {
    setCosteoTargetProductId(productId || null);
    setActiveTab('costeo');
  };

  // Sesión de caja derivada de la sede activa sin re-suscribir listeners
  const sesionCaja = useMemo(() => {
    if (!sede) return null;
    return sesionesCajaList.find(s => s.sede === sede && s.estado === 'ABIERTA') || null;
  }, [sesionesCajaList, sede]);

  // 4. Notificaciones Toast (con limpieza de temporizador previo)
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);
  const showToast = (message, type = 'success') => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToast({ message, type, id: Date.now() });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 3500);
  };

  // Guardar en Storage sesión
  useEffect(() => {
    if (sede) localStorage.setItem('dg_sede', sede);
    else localStorage.removeItem('dg_sede');
  }, [sede]);

  // El perfil de colaborador vive únicamente en memoria de la sesión activa
  useEffect(() => {
    try {
      localStorage.removeItem('dg_perfil');
      sessionStorage.removeItem('dg_perfil');
    } catch (e) {}
  }, [perfil]);

  // Login y Logout
  const login = (selectedSede, selectedPerfil, inputPin) => {
    const validPin = selectedPerfil.defaultPin;
    if (inputPin === validPin) {
      setSede(selectedSede);
      setPerfil(selectedPerfil);
      showToast(`¡Bienvenido(a) ${selectedPerfil.nombre}! Sesión iniciada en ${SEDES[selectedSede].nombre}`);
      return true;
    }
    return false;
  };

  const logout = () => {
    setPerfil(null);
    showToast('Sesión cerrada correctamente', 'info');
  };

  const switchSede = (newSede) => {
    setSede(newSede);
    showToast(`Cambiado a sede: ${SEDES[newSede].nombre}`);
  };

  // 5. Suscripciones Firestore en Tiempo Real (onSnapshot) - Montaje único [] para evitar lecturas duplicadas al cambiar de sede
  useEffect(() => {
    setSyncStatus('connecting');

    // PRODUCTOS
    const unsubProd = onSnapshot(collections.productos, (snapshot) => {
      if (snapshot.empty) {
        setProductos([]);
      } else {
        const prods = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        setProductos(prods);
      }
      if (!snapshot.metadata?.fromCache || !snapshot.empty) {
        setProductosLoaded(true);
      }
      setSyncStatus('connected');
    }, (error) => {
      console.error('Error al escuchar productos:', error);
      setSyncStatus('error');
    });

    // VENTAS (últimas 100)
    const qVentas = query(collections.ventas, orderBy('fecha', 'desc'), limit(100));
    const unsubVentas = onSnapshot(qVentas, (snapshot) => {
      const v = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setVentas(v);
    }, (error) => {
      console.error('Error al escuchar ventas:', error);
    });

    // CAJA SESIONES
    const qSesiones = query(collections.sesionesCaja, orderBy('fechaApertura', 'desc'), limit(10));
    const unsubSesiones = onSnapshot(qSesiones, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setSesionesCajaList(docs);
    }, (error) => {
      console.error('Error al escuchar sesiones de caja:', error);
    });

    // MOVIMIENTOS CAJA
    const qMovs = query(collections.movimientosCaja, orderBy('fecha', 'desc'), limit(100));
    const unsubMovs = onSnapshot(qMovs, (snapshot) => {
      const movs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setMovimientosCaja(movs);
    }, (error) => {
      console.error('Error al escuchar movimientos de caja:', error);
    });

    // KARDEX
    const qKardex = query(collections.kardex, orderBy('fecha', 'desc'), limit(100));
    const unsubKardex = onSnapshot(qKardex, (snapshot) => {
      const k = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setKardex(k);
    }, (error) => {
      console.error('Error al escuchar kardex:', error);
    });

    // CLIENTES FIDELIDAD
    const unsubClientes = onSnapshot(collections.clientesFidelidad, (snapshot) => {
      const cli = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setClientesFidelidad(cli);
    }, (error) => {
      console.error('Error al escuchar clientes de fidelidad:', error);
    });

    // INSUMOS DE PRODUCCIÓN (Módulo Costeo)
    const unsubInsumos = onSnapshot(collections.insumosProduccion, (snapshot) => {
      const ins = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setInsumosProduccion(ins);
    }, (error) => {
      console.warn('Aviso al escuchar insumos_produccion:', error);
    });

    // RECETAS / ESCANDALLOS (Módulo Costeo)
    const unsubRecetas = onSnapshot(collections.recetasCosteo, (snapshot) => {
      const rec = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setRecetasCosteo(rec);
    }, (error) => {
      console.warn('Aviso al escuchar recetas_costeo:', error);
    });

    return () => {
      unsubProd();
      unsubVentas();
      unsubSesiones();
      unsubMovs();
      unsubKardex();
      unsubClientes();
      unsubInsumos();
      unsubRecetas();
    };
  }, []);

  // Sembrado inicial seguro: solo inserta productos que NO existen en Firestore
  const seedInitialProducts = async () => {
    try {
      const existingSnap = await getDocs(collections.productos);
      const existingIds = new Set(existingSnap.docs.map((d) => d.id));
      const missing = INITIAL_PRODUCTS.filter((p) => !existingIds.has(p.id));
      if (missing.length === 0) {
        showToast('El catálogo ya está sincronizado en Firestore.', 'info');
        return;
      }

      const batch = writeBatch(db);
      for (const prod of missing) {
        const ref = doc(collections.productos, prod.id);
        batch.set(ref, {
          ...prod,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }, { merge: true });
      }
      await batch.commit();
      showToast(`Catálogo sincronizado: ${missing.length} productos agregados.`);
    } catch (err) {
      console.error('Error al sembrar productos:', err);
      showToast('Error al sembrar productos: ' + err.message, 'error');
    }
  };

  // Gestión de Cuentas / Mesas
  const addAccount = (name, type = 'mesa') => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const newId = `acc-${Date.now()}`;
    const newAccount = {
      id: newId,
      name: trimmed,
      type,
      items: []
    };
    setAccounts(prev => [...prev, newAccount]);
    setActiveAccountId(newId);
    showToast(`Cuenta "${trimmed}" creada`);
  };

  const removeAccount = (accountId) => {
    const target = accounts.find(a => a.id === accountId);
    if (!target) return;
    if (target.items && target.items.length > 0) {
      if (!window.confirm(`La cuenta "${target.name}" tiene ${target.items.length} platos en comanda. ¿Deseas cerrarla y descartar su pedido?`)) {
        return;
      }
    }
    setAccounts(prev => {
      const filtered = prev.filter(a => a.id !== accountId);
      if (filtered.length === 0) return DEFAULT_ACCOUNTS;
      return filtered;
    });
    if (activeAccountId === accountId) {
      const remaining = accounts.filter(a => a.id !== accountId);
      setActiveAccountId(remaining.length > 0 ? remaining[0].id : 'mesa-01');
    }
    showToast(`Cuenta "${target.name}" eliminada`);
  };

  // Carrito helpers vinculados a la cuenta activa (o específica)
  const addToCart = (product, targetAccountId = activeAccountId, qtyToAdd = 1) => {
    const isNoStockControl = product?.controla_stock === false || product?.en_inventario === false || product?.es_personalizado || product?.id?.toString().startsWith('custom-');
    const currentStock = isNoStockControl ? 9999 : getProductStock(product, sede);
    const currentPrice = getProductPrice(product, sede);

    if (!isNoStockControl && currentStock <= 0) {
      showToast(`"${product.nombre}" está agotado en ${SEDES[sede]?.nombre || 'esta sede'}`, 'error');
      return;
    }

    const qty = Math.max(1, Number(qtyToAdd) || Number(product?.cantidad) || 1);

    setAccounts(prev => {
      return prev.map(acc => {
        if (acc.id === targetAccountId) {
          const existing = acc.items.find(item => item.product.id === product.id);
          const currentQty = existing ? existing.quantity : 0;

          if (!isNoStockControl && currentQty + qty > currentStock) {
            showToast(`Stock insuficiente de "${product.nombre}". Disponible: ${currentStock}`, 'warning');
            return acc;
          }

          let updatedItems;
          if (existing) {
            updatedItems = acc.items.map(item =>
              item.product.id === product.id
                ? { ...item, quantity: item.quantity + qty, subtotal: (item.quantity + qty) * currentPrice }
                : item
            );
          } else {
            updatedItems = [...acc.items, { product, quantity: qty, subtotal: qty * currentPrice }];
          }
          return { ...acc, items: updatedItems };
        }
        return acc;
      });
    });
  };

  // Helper específico para agregar ítems libres o personalizados de un solo uso
  const addCustomItemToCart = (customItem, targetAccountId = activeAccountId) => {
    addToCart(customItem, targetAccountId, customItem.cantidad || 1);
  };

  const updateCartQuantity = (productId, delta, targetAccountId = activeAccountId) => {
    setAccounts(prev => {
      return prev.map(acc => {
        if (acc.id === targetAccountId) {
          const updatedItems = acc.items.map(item => {
            if (item.product.id === productId) {
              const isNoStockControl = item.product?.controla_stock === false || item.product?.en_inventario === false || item.product?.es_personalizado || item.product?.id?.toString().startsWith('custom-');
              const currentStock = isNoStockControl ? 9999 : getProductStock(item.product, sede);
              const currentPrice = getProductPrice(item.product, sede);
              const newQty = item.quantity + delta;

              if (!isNoStockControl && newQty > currentStock) {
                showToast(`Límite de stock alcanzado (${currentStock})`, 'warning');
                return item;
              }
              if (newQty <= 0) return null;
              return { ...item, quantity: newQty, subtotal: newQty * currentPrice };
            }
            return item;
          }).filter(Boolean);
          return { ...acc, items: updatedItems };
        }
        return acc;
      });
    });
  };

  // Asignar cantidad exacta con validación estricta (antifrágil contra inputs negativos o 0)
  const updateCartItemExact = (productId, rawQuantity, targetAccountId = activeAccountId) => {
    setAccounts(prev => {
      return prev.map(acc => {
        if (acc.id === targetAccountId) {
          const updatedItems = acc.items.map(item => {
            if (item.product.id === productId) {
              const isNoStockControl = item.product?.controla_stock === false || item.product?.en_inventario === false || item.product?.es_personalizado || item.product?.id?.toString().startsWith('custom-');
              const currentStock = isNoStockControl ? 9999 : getProductStock(item.product, sede);
              const currentPrice = getProductPrice(item.product, sede);
              const parsed = parseInt(rawQuantity, 10);
              const safeQty = isNaN(parsed) || parsed < 1 ? 1 : (isNoStockControl ? parsed : Math.min(parsed, currentStock));
              return { ...item, quantity: safeQty, subtotal: safeQty * currentPrice };
            }
            return item;
          });
          return { ...acc, items: updatedItems };
        }
        return acc;
      });
    });
  };

  const removeFromCart = (productId, targetAccountId = activeAccountId) => {
    setAccounts(prev => {
      return prev.map(acc => {
        if (acc.id === targetAccountId) {
          return { ...acc, items: acc.items.filter(item => item.product.id !== productId) };
        }
        return acc;
      });
    });
  };

  const clearCart = (targetAccountId = activeAccountId) => {
    setAccounts(prev => {
      return prev.map(acc => {
        if (acc.id === targetAccountId) {
          return { ...acc, items: [] };
        }
        return acc;
      });
    });
  };

  // Transacción atómica para cobrar y liquidar la comanda de una cuenta específica
  const processSale = async ({
    metodoPago,
    tipoComprobante,
    clienteDoc,
    clienteNombre,
    clienteDireccion = '',
    clienteTelefono,
    montoRecibido,
    vuelto,
    targetAccountId = activeAccountId
  }) => {
    const lockKey = String(targetAccountId || 'default');
    if (inFlightSalesRef.current.has(lockKey)) {
      throw new Error('Ya hay un cobro en curso para esta cuenta. Por favor espera un momento.');
    }

    const targetAccount = accounts.find(a => a.id === targetAccountId) || activeAccount;
    const itemsToProcess = targetAccount?.items || [];

    if (itemsToProcess.length === 0) throw new Error('La comanda de esta cuenta está vacía');
    if (!sede || !perfil) throw new Error('No hay sesión de sede o perfil activa');

    inFlightSalesRef.current.add(lockKey);
    try {
      const itemsSummary = itemsToProcess.map(item => {
        const qty = Number(item.quantity || 0);
        const priceForSede = Number(getProductPrice(item.product, sede) || 0);
        if (!Number.isFinite(qty) || qty <= 0) {
          throw new Error(`Cantidad inválida para "${item.product?.nombre || 'Producto'}"`);
        }
        return {
          id: String(item.product.id),
          nombre: String(item.product.nombre || 'Producto'),
          categoria: item.product.categoria || (item.product.es_personalizado ? 'Personalizado' : 'Venta Libre'),
          precio: Number(priceForSede.toFixed(2)),
          cantidad: qty,
          subtotal: Number((priceForSede * qty).toFixed(2)),
          icono: item.product.icono || (item.product.es_personalizado ? '✨' : '🧁'),
          es_personalizado: Boolean(item.product.es_personalizado),
          controla_stock: item.product?.controla_stock !== false && item.product?.en_inventario !== false
        };
      });

      const totalToPay = Number(itemsSummary.reduce((sum, it) => sum + it.subtotal, 0).toFixed(2));
      if (!Number.isFinite(totalToPay) || totalToPay <= 0) {
        throw new Error('El importe total a cobrar debe ser mayor a S/ 0.00');
      }

      const isVE = sede === 'VE' || sede === 'villaEspana' || sede === 'Villa España';
      const effectiveTipoComprobante = isVE ? 'NOTA_VENTA' : (tipoComprobante || 'NOTA_VENTA');
      const tipoDocLabel = effectiveTipoComprobante === 'FACTURA' ? 'Factura' : effectiveTipoComprobante === 'BOLETA' ? 'Boleta' : 'Nota de Venta';

      const stockControlledItems = itemsToProcess.filter((item) => {
        return (
          item.product?.controla_stock !== false &&
          item.product?.en_inventario !== false &&
          !item.product?.es_personalizado &&
          !item.product?.id?.toString().startsWith('custom-')
        );
      });

      // 0. Validación previa de stock fresco en Firestore ANTES de emitir ante SUNAT
      for (const item of stockControlledItems) {
        const prodRef = doc(db, 'productos', String(item.product.id));
        const snap = await getDoc(prodRef);
        if (snap.exists()) {
          const freshProd = { id: snap.id, ...snap.data() };
          const avail = getProductStock(freshProd, sede);
          if (avail < item.quantity) {
            throw new Error(
              `Stock insuficiente en ${SEDES[sede].nombre} para "${freshProd.nombre}": disponible ${avail}, solicitado ${item.quantity}`
            );
          }
        }
      }

      const saleId = 'V-' + Date.now();
      const ventaRef = doc(db, 'ventas', saleId);

      // 1. Obtener correlativo oficial y emitir comprobante.
      // REGLA ESTRICTA: Villa España (VE) y cualquier NOTA_VENTA operan 100% internos (NV01) sin invocar nunca APISUNAT.
      const correlativoInfo = await obtenerSiguienteCorrelativo(effectiveTipoComprobante, sede);

      let comprobanteData;
      if (isVE || effectiveTipoComprobante === 'NOTA_VENTA') {
        await incrementarCorrelativo('NV01', correlativoInfo.numero);
        comprobanteData = {
          exito: true,
          success: true,
          tipo: 'interno',
          tipoDoc: 'NV',
          serie: 'NV01',
          numero: correlativoInfo.numero,
          codigoCompleto: `NV01-${String(correlativoInfo.numero).padStart(8, '0')}`,
          estado_sunat: 'no_aplica',
          estado: 'CONTROL_INTERNO',
          hash_cpe: null,
          cdr: null,
          enlace_pdf: null,
          enlace_del_pdf: null,
          enlace_xml: null,
          enlace_del_xml: null,
          opGravada: Number((totalToPay / 1.18).toFixed(2)),
          totalIgv: Number((totalToPay - Number((totalToPay / 1.18).toFixed(2))).toFixed(2)),
          totalVenta: totalToPay
        };
      } else {
        comprobanteData = await emitirComprobante({
          id: saleId,
          sede: 'buenosAires',
          local: 'Buenos Aires',
          tipoDocumento: tipoDocLabel,
          tipoComprobante: effectiveTipoComprobante,
          serie: correlativoInfo.serie,
          numero: correlativoInfo.numero,
          correlativo: correlativoInfo.numero,
          total: totalToPay,
          metodoPago,
          items: itemsSummary,
          clienteDoc: clienteDoc || '',
          clienteNombre: clienteNombre || 'CLIENTES VARIOS',
          clienteDireccion: clienteDireccion || '',
          cliente: {
            documento: clienteDoc || '',
            nombre: clienteNombre || 'CLIENTES VARIOS',
            direccion: clienteDireccion || '',
            telefono: clienteTelefono || ''
          }
        });
      }

      if (!comprobanteData.exito) {
        throw new Error(comprobanteData.error || 'Error al emitir comprobante');
      }

      const opGravada = Number((comprobanteData.opGravada ?? totalToPay / 1.18).toFixed(2));
      const igv = Number((comprobanteData.totalIgv ?? (totalToPay - opGravada)).toFixed(2));
      const finalTotal = Number((comprobanteData.totalVenta ?? totalToPay).toFixed(2));

      const estadoSunatNorm =
        isVE || effectiveTipoComprobante === 'NOTA_VENTA'
          ? 'no_aplica'
          : (comprobanteData.estado_sunat || 'aceptado').toLowerCase();
      const compEstadoUpper =
        isVE || effectiveTipoComprobante === 'NOTA_VENTA'
          ? 'CONTROL_INTERNO'
          : (comprobanteData.estado || 'ACEPTADO').toUpperCase();

      const nowIso = new Date().toISOString();

      const ventaDocData = {
        id: saleId,
        fecha: nowIso,
        timestamp: serverTimestamp(),
        sede,
        local: SEDES[sede].nombre,
        sedeNombre: SEDES[sede].nombre,
        vendedor: perfil.nombre,
        vendedorRol: perfil.rol,
        estado_sunat: estadoSunatNorm,
        serie: comprobanteData.serie || correlativoInfo.serie,
        correlativo: comprobanteData.numero || correlativoInfo.numero,
        hash_cpe: comprobanteData.hash_cpe || comprobanteData.hash || null,
        cdr: comprobanteData.cdr || null,
        enlace_pdf: comprobanteData.enlace_pdf || comprobanteData.enlace_del_pdf || comprobanteData.pdf || null,
        enlace_xml: comprobanteData.enlace_xml || comprobanteData.enlace_del_xml || comprobanteData.xml || null,
        enlace_del_pdf: comprobanteData.enlace_del_pdf || comprobanteData.pdf || null,
        enlace_del_xml: comprobanteData.enlace_del_xml || comprobanteData.xml || null,
        cuenta: {
          id: targetAccount.id,
          nombre: targetAccount.name,
          tipo: targetAccount.type
        },
        items: itemsSummary,
        total: finalTotal,
        opGravada,
        igv,
        metodoPago,
        metodo_pago: metodoPago,
        tipoComprobante: effectiveTipoComprobante,
        comprobante: {
          tipo: comprobanteData.tipo || effectiveTipoComprobante,
          tipoDoc: comprobanteData.tipoDoc || (effectiveTipoComprobante === 'FACTURA' ? '01' : effectiveTipoComprobante === 'BOLETA' ? '03' : 'NV'),
          documentId: comprobanteData.documentId || null,
          fileName: comprobanteData.fileName || null,
          serie: comprobanteData.serie || correlativoInfo.serie,
          numero: comprobanteData.numero || correlativoInfo.numero,
          codigoCompleto: comprobanteData.codigoCompleto || correlativoInfo.codigoCompleto,
          estado: compEstadoUpper,
          enlace_del_pdf: comprobanteData.enlace_del_pdf || comprobanteData.pdf || null,
          enlace_del_xml: comprobanteData.enlace_del_xml || comprobanteData.xml || null,
          cdr: comprobanteData.cdr || null,
          notes: comprobanteData.notes || [],
          url_comprobante_sunat: comprobanteData.enlace_del_pdf || comprobanteData.url_comprobante_sunat || null,
          cadena_para_codigo_qr: comprobanteData.cadena_para_codigo_qr || null,
          hash_cpe: comprobanteData.hash_cpe || comprobanteData.hash || null,
          hash: comprobanteData.hash_cpe || comprobanteData.hash || null,
          fecha: nowIso
        },
        cliente: {
          documento: isVE ? '' : (clienteDoc || ''),
          nombre: clienteNombre || 'Público General',
          direccion: clienteDireccion || '',
          telefono: clienteTelefono || ''
        },
        montoRecibido: Number(montoRecibido) || finalTotal,
        vuelto: Number(vuelto) || 0,
        estado: 'COMPLETADA'
      };

      const stockFieldLegacy = SEDES[sede].stockKey;
      const stockFieldNested = sede === 'VE' ? 'stock.villaEspana' : 'stock.buenosAires';

      // 2. Transacción atómica en Firestore (lectura fresca de stock + guardado de venta, kardex, fidelidad y caja)
      try {
        await runTransaction(db, async (tx) => {
          // Leer primero todos los documentos requeridos por Firestore transaction rules
          const prodSnaps = new Map();
          for (const item of stockControlledItems) {
            const pId = String(item.product.id);
            if (!prodSnaps.has(pId)) {
              const pRef = doc(db, 'productos', pId);
              const snap = await tx.get(pRef);
              prodSnaps.set(pId, { ref: pRef, snap });
            }
          }

          let cliSnap = null;
          let cliRef = null;
          const telClean = clienteTelefono ? clienteTelefono.trim() : '';
          if (telClean.length >= 9) {
            cliRef = doc(db, 'clientes_fidelidad', telClean);
            cliSnap = await tx.get(cliRef);
          }

          // Escritura de la venta
          tx.set(ventaRef, ventaDocData);

          // Descuento atómico y sincronizado (campo legado y anidado) + Kardex
          for (const item of stockControlledItems) {
            const pId = String(item.product.id);
            const entry = prodSnaps.get(pId);
            if (entry?.snap?.exists()) {
              const curr = getProductStock({ id: pId, ...entry.snap.data() }, sede);
              const nextStock = Math.max(0, curr - item.quantity);
              tx.update(entry.ref, {
                [stockFieldLegacy]: nextStock,
                [stockFieldNested]: nextStock,
                disponible: nextStock > 0 || getProductStock({ id: pId, ...entry.snap.data() }, sede === 'BA' ? 'VE' : 'BA') > 0,
                updatedAt: serverTimestamp()
              });
            }

            const kardexRef = doc(db, 'kardex', `K-${saleId}-${pId}`);
            tx.set(kardexRef, {
              id: `K-${saleId}-${pId}`,
              fecha: nowIso,
              timestamp: serverTimestamp(),
              sede,
              tipo: 'VENTA',
              productoId: pId,
              productoNombre: item.product.nombre,
              cantidad: -item.quantity,
              precioUnitario: Number(getProductPrice(item.product, sede) || 0),
              total: Number(item.subtotal || 0),
              motivo: `Venta ${saleId} (${effectiveTipoComprobante} - ${targetAccount.name})`,
              responsable: perfil.nombre
            });
          }

          // Fidelidad
          if (cliRef) {
            if (cliSnap?.exists()) {
              tx.update(cliRef, {
                sellos: increment(1),
                totalVisitas: increment(1),
                totalGastado: increment(finalTotal),
                ultimaVisita: nowIso,
                nombre: clienteNombre || cliSnap.data()?.nombre || 'Cliente Frecuente',
                updatedAt: serverTimestamp()
              });
            } else {
              tx.set(cliRef, {
                id: telClean,
                telefono: telClean,
                nombre: clienteNombre || 'Cliente Frecuente',
                sellos: 1,
                totalVisitas: 1,
                premiosCanjeados: 0,
                totalGastado: finalTotal,
                fechaRegistro: nowIso,
                ultimaVisita: nowIso,
                sedeRegistro: SEDES[sede].nombre
              });
            }
          }

          // Caja efectivo
          if (metodoPago === 'EFECTIVO' && sesionCaja) {
            const movCajaRef = doc(db, 'movimientos_caja', `MC-${saleId}`);
            tx.set(movCajaRef, {
              id: `MC-${saleId}`,
              sesionId: sesionCaja.id,
              fecha: nowIso,
              timestamp: serverTimestamp(),
              sede,
              tipo: 'VENTA_EFECTIVO',
              monto: finalTotal,
              descripcion: `Venta POS en Efectivo ${saleId} (${targetAccount.name})`,
              responsable: perfil.nombre
            });
          }
        });
      } catch (fsErr) {
        console.error('Error en transacción Firestore tras emisión:', fsErr);
        // Respaldo de emergencia para nunca perder ni duplicar un comprobante ya emitido en SUNAT
        try {
          const pendingKey = 'dg_pending_ventas_sync';
          const prevPending = JSON.parse(localStorage.getItem(pendingKey) || '[]');
          const { timestamp: _omit, ...serializableVenta } = ventaDocData;
          prevPending.push({ ...serializableVenta, fecha: nowIso });
          localStorage.setItem(pendingKey, JSON.stringify(prevPending));
        } catch {
          // Ignorar fallo de localStorage
        }
        clearCart(targetAccountId);
        showToast(
          'Comprobante emitido, pero falló la sincronización instantánea con Firestore. Guardado en respaldo local.',
          'warning'
        );
        return { ...ventaDocData, pendingSync: true };
      }

      clearCart(targetAccountId);
      return ventaDocData;
    } finally {
      inFlightSalesRef.current.delete(lockKey);
    }
  };

  // Re-sincronizar cola local de ventas si hubo caída de red tras emisión SUNAT
  useEffect(() => {
    if (!isOnline) return;
    const syncPending = async () => {
      try {
        const raw = localStorage.getItem('dg_pending_ventas_sync');
        if (!raw) return;
        const list = JSON.parse(raw);
        if (!Array.isArray(list) || list.length === 0) return;

        const remaining = [];
        for (const v of list) {
          try {
            await setDoc(doc(db, 'ventas', String(v.id)), {
              ...v,
              timestamp: serverTimestamp(),
              syncedFromLocalRecovery: true
            }, { merge: true });
          } catch {
            remaining.push(v);
          }
        }
        if (remaining.length > 0) {
          localStorage.setItem('dg_pending_ventas_sync', JSON.stringify(remaining));
        } else {
          localStorage.removeItem('dg_pending_ventas_sync');
          showToast(`Respaldo local sincronizado (${list.length} venta/s recuperada/s).`, 'success');
        }
      } catch {
        // Silencioso
      }
    };
    syncPending();
  }, [isOnline]);

  /**
   * Consulta en APISUNAT el estado definitivo de un comprobante en estado PENDIENTE.
   */
  const refreshSunatStatus = async (venta) => {
    if (!venta?.id || !venta?.comprobante?.documentId) {
      throw new Error('La venta no tiene documentId de APISUNAT para consultar.');
    }
    const statusData = await verificarEstadoComprobante({
      documentId: venta.comprobante.documentId,
      fileName: venta.comprobante.fileName || ''
    });

    const newStatusUpper = String(statusData.status || 'PENDIENTE').toUpperCase();
    const ventaRef = doc(db, 'ventas', String(venta.id));
    await updateDoc(ventaRef, {
      estado_sunat: newStatusUpper.toLowerCase(),
      hash_cpe: statusData.hash_cpe || venta.hash_cpe || null,
      cdr: statusData.cdr || venta.cdr || null,
      enlace_xml: statusData.enlace_del_xml || venta.enlace_xml || null,
      enlace_del_xml: statusData.enlace_del_xml || venta.enlace_del_xml || null,
      'comprobante.estado': newStatusUpper,
      'comprobante.hash_cpe': statusData.hash_cpe || venta.comprobante?.hash_cpe || null,
      'comprobante.cdr': statusData.cdr || venta.comprobante?.cdr || null,
      'comprobante.enlace_del_xml': statusData.enlace_del_xml || venta.comprobante?.enlace_del_xml || null,
      'comprobante.notes': statusData.notes || [],
      updatedAt: serverTimestamp()
    });
    return statusData;
  };

  /**
   * Anular Venta con emisión real de Nota de Crédito (07) en APISUNAT si es Boleta/Factura electrónica.
   * Conserva el documento en `ventas` marcado como `estado: 'ANULADA'` para auditoría contable SIRE
   * y devuelve automáticamente el stock al inventario correspondiente mediante transacción segura.
   */
  const anularVenta = async (venta, { motivo = 'ANULACION DE LA OPERACION', codigoMotivo = '01' } = {}) => {
    if (!venta || !venta.id) throw new Error('Venta inválida');
    if (venta.estado === 'ANULADA') throw new Error('Esta venta ya se encuentra anulada');

    const voidKey = String(venta.id);
    if (inFlightVoidsRef.current.has(voidKey)) {
      throw new Error('Ya se está procesando la anulación de esta venta.');
    }

    inFlightVoidsRef.current.add(voidKey);
    try {
      const isVE =
        venta.sede === 'VE' ||
        venta.sede === 'villaEspana' ||
        (venta.sedeNombre && venta.sedeNombre.toLowerCase().includes('villa'));
      const comp = venta.comprobante || {};
      const serieOrig = (comp.serie || '').toUpperCase();
      const esComprobanteSunat =
        !isVE &&
        (venta.tipoComprobante === 'BOLETA' || venta.tipoComprobante === 'FACTURA') &&
        serieOrig !== 'NV01' &&
        comp.estado !== 'CONTROL_INTERNO';

      let notaCreditoData = null;
      if (esComprobanteSunat) {
        notaCreditoData = await anularComprobante({ venta, motivo, codigoMotivo });
      }

      const stockFieldLegacy = isVE ? 'stock_VE' : 'stock_BA';
      const nestedStockField = isVE ? 'stock.villaEspana' : 'stock.buenosAires';
      const targetSedeId = isVE ? 'VE' : 'BA';
      const nowIso = new Date().toISOString();

      const returnItems = Array.isArray(venta.items)
        ? venta.items.filter(
            (item) =>
              item &&
              item.controla_stock !== false &&
              !item.es_personalizado &&
              !item.id?.toString().startsWith('custom-')
          )
        : [];

      await runTransaction(db, async (tx) => {
        const prodEntries = [];
        for (const item of returnItems) {
          const pId = String(item.id);
          const pRef = doc(db, 'productos', pId);
          const snap = await tx.get(pRef);
          prodEntries.push({ item, pId, pRef, snap });
        }

        const movCajaRef = doc(db, 'movimientos_caja', `MC-${venta.id}`);
        const movCajaSnap = await tx.get(movCajaRef);

        // 1. Devolver stock solo a productos existentes en catálogo (evita abortar si un producto fue borrado)
        for (const { item, pId, pRef, snap } of prodEntries) {
          const qty = Number(item.cantidad || 0);
          if (snap.exists() && qty > 0) {
            const curr = getProductStock({ id: pId, ...snap.data() }, targetSedeId);
            const nextStock = curr + qty;
            tx.update(pRef, {
              [stockFieldLegacy]: nextStock,
              [nestedStockField]: nextStock,
              disponible: true,
              updatedAt: serverTimestamp()
            });
          }

          if (qty > 0) {
            const kardexRef = doc(db, 'kardex', `K-ANULACION-${venta.id}-${pId}`);
            tx.set(kardexRef, {
              id: `K-ANULACION-${venta.id}-${pId}`,
              fecha: nowIso,
              timestamp: serverTimestamp(),
              sede: targetSedeId,
              tipo: 'INGRESO',
              productoId: pId,
              productoNombre: item.nombre || 'Producto',
              cantidad: qty,
              motivo: `Devolución de stock por anulación${notaCreditoData ? ` (NC ${notaCreditoData.codigoCompleto})` : ''} de venta ${venta.id}`,
              responsable: perfil?.nombre || 'Admin'
            });
          }
        }

        // 2. Eliminar movimiento de caja en efectivo si existía
        if (movCajaSnap.exists()) {
          tx.delete(movCajaRef);
        }

        // 3. Marcar venta como ANULADA (conservando documento para trazabilidad SIRE)
        const ventaRef = doc(db, 'ventas', String(venta.id));
        tx.update(ventaRef, {
          estado: 'ANULADA',
          estado_sunat: notaCreditoData ? 'anulado_con_nc' : 'anulado',
          fechaAnulacion: nowIso,
          anuladoPor: perfil?.nombre || 'Admin',
          motivoAnulacion: motivo,
          ...(notaCreditoData
            ? {
                notaCredito: {
                  tipoDoc: '07',
                  serie: notaCreditoData.serie,
                  numero: notaCreditoData.numero,
                  codigoCompleto: notaCreditoData.codigoCompleto,
                  documentId: notaCreditoData.documentId,
                  fileName: notaCreditoData.fileName,
                  hash_cpe: notaCreditoData.hash_cpe,
                  enlace_del_pdf: notaCreditoData.enlace_del_pdf,
                  enlace_del_xml: notaCreditoData.enlace_del_xml,
                  cdr: notaCreditoData.cdr,
                  status: notaCreditoData.status,
                  motivo: notaCreditoData.motivo,
                  codigoMotivo: notaCreditoData.codigoMotivo,
                  fecha: nowIso,
                  fechaEmision: notaCreditoData.fechaEmision
                }
              }
            : {}),
          updatedAt: serverTimestamp()
        });
      });

      return notaCreditoData;
    } finally {
      inFlightVoidsRef.current.delete(voidKey);
    }
  };

  return (
    <AppContext.Provider value={{
      sede,
      setSede: switchSede,
      perfil,
      login,
      logout,
      activeTab,
      setActiveTab,
      // Multi-Mesa
      accounts,
      activeAccountId,
      setActiveAccountId,
      activeAccount,
      addAccount,
      removeAccount,
      allAccountsCount,
      // Comanda de cuenta activa
      cart,
      addToCart,
      addCustomItemToCart,
      updateCartQuantity,
      updateCartItemExact,
      removeFromCart,
      clearCart,
      cartTotal,
      cartCount,
      // Firestore Collections y Red
      productos,
      productosLoaded,
      ventas,
      sesionCaja,
      movimientosCaja,
      kardex,
      clientesFidelidad,
      insumosProduccion,
      recetasCosteo,
      costeoTargetProductId,
      setCosteoTargetProductId,
      openProductInCosteo,
      syncStatus,
      isOnline,
      seedInitialProducts,
      processSale,
      anularVenta,
      refreshSunatStatus,
      toast,
      showToast
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
