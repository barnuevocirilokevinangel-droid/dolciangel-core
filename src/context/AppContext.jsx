import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import { 
  db, 
  collections, 
  onSnapshot, 
  doc, 
  getDocs,
  setDoc, 
  updateDoc,
  deleteDoc,
  addDoc, 
  serverTimestamp, 
  writeBatch,
  increment,
  query,
  orderBy,
  limit
} from '../services/firebase';
import { INITIAL_PRODUCTS } from '../data/initialCatalog';
import { emitirComprobante, anularComprobante, obtenerSiguienteCorrelativo } from '../services/sunatService';
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
  const [ventas, setVentas] = useState([]);
  const [sesionesCajaList, setSesionesCajaList] = useState([]);
  const [movimientosCaja, setMovimientosCaja] = useState([]);
  const [kardex, setKardex] = useState([]);
  const [clientesFidelidad, setClientesFidelidad] = useState([]);
  const [insumosProduccion, setInsumosProduccion] = useState([]);
  const [recetasCosteo, setRecetasCosteo] = useState([]);
  const [costeoTargetProductId, setCosteoTargetProductId] = useState(null);

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

  // Sembrado inicial de productos
  const seedInitialProducts = async () => {
    try {
      const batch = writeBatch(db);
      for (const prod of INITIAL_PRODUCTS) {
        const ref = doc(collections.productos, prod.id);
        batch.set(ref, {
          ...prod,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      await batch.commit();
      showToast('¡Catálogo inicial sembrado exitosamente en Firestore!');
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

  // Transacción batch para cobrar y liquidar la comanda de una cuenta específica
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
    const targetAccount = accounts.find(a => a.id === targetAccountId) || activeAccount;
    const itemsToProcess = targetAccount?.items || [];

    if (itemsToProcess.length === 0) throw new Error('La comanda de esta cuenta está vacía');
    if (!sede || !perfil) throw new Error('No hay sesión de sede o perfil activa');

    const totalToPay = itemsToProcess.reduce((sum, it) => sum + it.subtotal, 0);

    const batch = writeBatch(db);
    const stockField = SEDES[sede].stockKey;
    const saleId = 'V-' + Date.now();
    const ventaRef = doc(collections.ventas, saleId);

    const itemsSummary = itemsToProcess.map(item => {
      const priceForSede = getProductPrice(item.product, sede);
      return {
        id: item.product.id,
        nombre: item.product.nombre,
        categoria: item.product.categoria || (item.product.es_personalizado ? 'Personalizado' : 'Venta Libre'),
        precio: priceForSede,
        cantidad: item.quantity,
        subtotal: priceForSede * item.quantity,
        icono: item.product.icono || (item.product.es_personalizado ? '✨' : '🧁'),
        es_personalizado: Boolean(item.product.es_personalizado),
        controla_stock: Boolean(item.product.controla_stock)
      };
    });

    const isVE = sede === 'VE' || sede === 'villaEspana' || sede === 'Villa España';
    const effectiveTipoComprobante = isVE ? 'NOTA_VENTA' : (tipoComprobante || 'NOTA_VENTA');
    const tipoDocLabel = effectiveTipoComprobante === 'FACTURA' ? 'Factura' : effectiveTipoComprobante === 'BOLETA' ? 'Boleta' : 'Nota de Venta';

    // 1. Obtener correlativo oficial atómico en Firestore (B002 desde 1264 para Boletas, F001 para Facturas)
    const correlativoInfo = await obtenerSiguienteCorrelativo(effectiveTipoComprobante, sede);

    // Emisión hacia ApiPeru (Buenos Aires) o Control Interno (Villa España)
    const comprobanteData = await emitirComprobante({
      id: saleId,
      sede: isVE ? 'villaEspana' : 'buenosAires',
      tipoDocumento: tipoDocLabel,
      tipoComprobante: effectiveTipoComprobante,
      serie: correlativoInfo.serie,
      numero: correlativoInfo.numero,
      correlativo: correlativoInfo.numero,
      total: totalToPay,
      metodoPago,
      items: itemsSummary,
      clienteDoc: isVE ? '' : (clienteDoc || ''),
      clienteNombre: clienteNombre || 'CLIENTES VARIOS',
      clienteDireccion: clienteDireccion || '',
      cliente: {
        documento: isVE ? '' : (clienteDoc || ''),
        nombre: clienteNombre || 'CLIENTES VARIOS',
        direccion: clienteDireccion || '',
        telefono: clienteTelefono || ''
      }
    });

    if (!comprobanteData.exito) {
      throw new Error(comprobanteData.error || 'Error al emitir comprobante');
    }

    const opGravada = Number((totalToPay / 1.18).toFixed(2));
    const igv = Number((totalToPay - opGravada).toFixed(2));

    // 1. Guardar la venta en 'ventas' con la información completa de comprobante APISUNAT, local y método de pago
    const ventaDocData = {
      id: saleId,
      fecha: new Date().toISOString(),
      timestamp: serverTimestamp(),
      sede,
      local: SEDES[sede].nombre,
      sedeNombre: SEDES[sede].nombre,
      vendedor: perfil.nombre,
      vendedorRol: perfil.rol,
      estado_sunat: isVE || effectiveTipoComprobante === 'NOTA_VENTA' ? 'no_aplica' : (comprobanteData.estado_sunat || 'aceptado'),
      serie: comprobanteData.serie || correlativoInfo.serie,
      correlativo: comprobanteData.numero || correlativoInfo.numero,
      hash_cpe: comprobanteData.hash_cpe || comprobanteData.hash || null,
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
      total: totalToPay,
      opGravada,
      igv,
      metodoPago, // 'EFECTIVO' | 'YAPE_PLIN' | 'TARJETA'
      metodo_pago: metodoPago,
      tipoComprobante: effectiveTipoComprobante, // 'NOTA_VENTA' | 'BOLETA' | 'FACTURA'
      comprobante: {
        tipo: comprobanteData.tipo || effectiveTipoComprobante,
        tipoDoc: comprobanteData.tipoDoc || (effectiveTipoComprobante === 'FACTURA' ? '01' : effectiveTipoComprobante === 'BOLETA' ? '03' : 'NV'),
        documentId: comprobanteData.documentId || null,
        fileName: comprobanteData.fileName || null,
        serie: comprobanteData.serie || correlativoInfo.serie,
        numero: comprobanteData.numero || correlativoInfo.numero,
        codigoCompleto: comprobanteData.codigoCompleto || correlativoInfo.codigoCompleto,
        estado: comprobanteData.estado || (isVE || effectiveTipoComprobante === 'NOTA_VENTA' ? 'CONTROL_INTERNO' : 'ACEPTADO'),
        enlace_del_pdf: comprobanteData.enlace_del_pdf || comprobanteData.pdf || null,
        enlace_del_xml: comprobanteData.enlace_del_xml || comprobanteData.xml || null,
        cdr: comprobanteData.cdr || null,
        url_comprobante_sunat: comprobanteData.enlace_del_pdf || comprobanteData.url_comprobante_sunat || null,
        cadena_para_codigo_qr: comprobanteData.cadena_para_codigo_qr || null,
        hash_cpe: comprobanteData.hash_cpe || comprobanteData.hash || null,
        hash: comprobanteData.hash_cpe || comprobanteData.hash || null,
        fecha: new Date().toISOString()
      },
      cliente: {
        documento: isVE ? '' : (clienteDoc || ''),
        nombre: clienteNombre || 'Público General',
        direccion: clienteDireccion || '',
        telefono: clienteTelefono || ''
      },
      montoRecibido: Number(montoRecibido) || totalToPay,
      vuelto: Number(vuelto) || 0,
      estado: 'COMPLETADA'
    };
    batch.set(ventaRef, ventaDocData);

    // 2. Descontar stock atómicamente y registrar en kardex (solo para productos con control de stock activo)
    for (const item of itemsToProcess) {
      const controlsStock = item.product?.controla_stock !== false && 
                            item.product?.en_inventario !== false && 
                            !item.product?.es_personalizado &&
                            !item.product?.id?.toString().startsWith('custom-');
      if (!controlsStock) continue;

      const prodRef = doc(collections.productos, item.product.id);
      const stockFieldLegacy = SEDES[sede].stockKey;
      const stockFieldNested = sede === 'VE' ? 'stock.villaEspana' : 'stock.buenosAires';

      batch.update(prodRef, {
        [stockFieldLegacy]: increment(-item.quantity),
        [stockFieldNested]: increment(-item.quantity),
        updatedAt: serverTimestamp()
      });

      const kardexRef = doc(collections.kardex, `K-${saleId}-${item.product.id}`);
      batch.set(kardexRef, {
        fecha: new Date().toISOString(),
        timestamp: serverTimestamp(),
        sede,
        tipo: 'VENTA',
        productoId: item.product.id,
        productoNombre: item.product.nombre,
        cantidad: -item.quantity,
        precioUnitario: item.product.precio,
        total: item.subtotal,
        motivo: `Venta ${saleId} (${tipoComprobante} - ${targetAccount.name})`,
        responsable: perfil.nombre
      });
    }

    // 3. Si hay celular, actualizar/crear en clientes_fidelidad
    if (clienteTelefono && clienteTelefono.trim().length >= 9) {
      const telClean = clienteTelefono.trim();
      const cliRef = doc(collections.clientesFidelidad, telClean);
      const existingCli = clientesFidelidad.find(c => c.id === telClean);

      if (existingCli) {
        batch.update(cliRef, {
          sellos: increment(1),
          totalVisitas: increment(1),
          totalGastado: increment(totalToPay),
          ultimaVisita: new Date().toISOString(),
          nombre: clienteNombre || existingCli.nombre || 'Cliente Frecuente',
          updatedAt: serverTimestamp()
        });
      } else {
        batch.set(cliRef, {
          id: telClean,
          telefono: telClean,
          nombre: clienteNombre || 'Cliente Frecuente',
          sellos: 1,
          totalVisitas: 1,
          premiosCanjeados: 0,
          totalGastado: totalToPay,
          fechaRegistro: new Date().toISOString(),
          ultimaVisita: new Date().toISOString(),
          sedeRegistro: SEDES[sede].nombre
        });
      }
    }

    // 4. Si el pago es en efectivo y hay caja abierta, registrar movimiento
    if (metodoPago === 'EFECTIVO' && sesionCaja) {
      const movCajaRef = doc(collections.movimientosCaja, `MC-${saleId}`);
      batch.set(movCajaRef, {
        sesionId: sesionCaja.id,
        fecha: new Date().toISOString(),
        timestamp: serverTimestamp(),
        sede,
        tipo: 'VENTA_EFECTIVO',
        monto: totalToPay,
        descripcion: `Venta POS en Efectivo ${saleId} (${targetAccount.name})`,
        responsable: perfil.nombre
      });
    }

    // Ejecutar lote atómico
    await batch.commit();

    // VACIAR ÚNICAMENTE LA CUENTA LIQUIDADA
    clearCart(targetAccountId);

    return ventaDocData;
  };

  /**
   * Anular Venta con emisión real de Nota de Crédito (07) en APISUNAT si es Boleta/Factura electrónica.
   * Conserva el documento en `ventas` marcado como `estado: 'ANULADA'` para auditoría contable SIRE
   * y devuelve automáticamente el stock al inventario correspondiente.
   */
  const anularVenta = async (venta, { motivo = 'ANULACION DE LA OPERACION', codigoMotivo = '01' } = {}) => {
    if (!venta || !venta.id) throw new Error('Venta inválida');
    if (venta.estado === 'ANULADA') throw new Error('Esta venta ya se encuentra anulada');

    const comp = venta.comprobante || {};
    const serieOrig = (comp.serie || '').toUpperCase();
    const esComprobanteSunat =
      (venta.tipoComprobante === 'BOLETA' || venta.tipoComprobante === 'FACTURA') &&
      serieOrig !== 'NV01' &&
      comp.estado !== 'CONTROL_INTERNO';

    let notaCreditoData = null;
    if (esComprobanteSunat) {
      notaCreditoData = await anularComprobante({ venta, motivo, codigoMotivo });
    }

    const batch = writeBatch(db);
    const isVE =
      venta.sede === 'VE' ||
      venta.sede === 'villaEspana' ||
      (venta.sedeNombre && venta.sedeNombre.toLowerCase().includes('villa'));
    const stockFieldLegacy = isVE ? 'stock_VE' : 'stock_BA';
    const nestedStockField = isVE ? 'stock.villaEspana' : 'stock.buenosAires';
    const targetSedeId = isVE ? 'VE' : 'BA';

    // 1. Devolver stock en Firestore (solo ítems que controlan inventario)
    if (Array.isArray(venta.items)) {
      for (const item of venta.items) {
        const controlsStock =
          item.controla_stock !== false &&
          !item.es_personalizado &&
          !item.id?.toString().startsWith('custom-');
        if (!controlsStock) continue;

        const prodRef = doc(collections.productos, item.id);
        batch.update(prodRef, {
          [stockFieldLegacy]: increment(item.cantidad),
          [nestedStockField]: increment(item.cantidad),
          updatedAt: serverTimestamp()
        });

        const kardexRef = doc(collections.kardex, `K-ANULACION-${venta.id}-${item.id}`);
        batch.set(kardexRef, {
          fecha: new Date().toISOString(),
          timestamp: serverTimestamp(),
          sede: targetSedeId,
          tipo: 'INGRESO',
          productoId: item.id,
          productoNombre: item.nombre,
          cantidad: item.cantidad,
          motivo: `Devolución de stock por anulación${notaCreditoData ? ` (NC ${notaCreditoData.codigoCompleto})` : ''} de venta ${venta.id}`,
          responsable: perfil?.nombre || 'Admin'
        });
      }
    }

    // 2. Eliminar movimiento de caja en efectivo asociado si existiera
    const movCajaRef = doc(collections.movimientosCaja, `MC-${venta.id}`);
    batch.delete(movCajaRef);

    // 3. Marcar venta como ANULADA (nunca borrar documento fiscal para trazabilidad SIRE)
    const ventaRef = doc(collections.ventas, venta.id);
    batch.update(ventaRef, {
      estado: 'ANULADA',
      fechaAnulacion: new Date().toISOString(),
      anuladoPor: perfil?.nombre || 'Admin',
      motivoAnulacion: motivo,
      ...(notaCreditoData ? {
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
          fecha: new Date().toISOString(),
          fechaEmision: notaCreditoData.fechaEmision
        }
      } : {}),
      updatedAt: serverTimestamp()
    });

    await batch.commit();
    return notaCreditoData;
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
      toast,
      showToast
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
