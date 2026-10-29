import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
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
import { emitirComprobante } from '../services/sunatService';
import { getProductPrice, getProductStock } from '../services/productUtils';

const AppContext = createContext();

export const SEDES = {
  BA: {
    id: 'BA',
    nombre: 'Buenos Aires',
    ciudad: 'Nuevo Chimbote',
    icon: '🏪',
    color: 'from-pink-600 to-rose-700',
    stockKey: 'stock_BA'
  },
  VE: {
    id: 'VE',
    nombre: 'Villa España',
    ciudad: 'Chimbote',
    icon: '🏪',
    color: 'from-amber-500 to-rose-600',
    stockKey: 'stock_VE'
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
  { id: 'Angel', nombre: 'Angel (Dueño)', sede: 'ALL', rol: 'Administrador General 👑', defaultPin: '0000', avatar: '👑', isDueno: true },
];

const DEFAULT_ACCOUNTS = [
  { id: 'mesa-01', name: 'Mesa 01', type: 'mesa', items: [] },
  { id: 'mesa-02', name: 'Mesa 02', type: 'mesa', items: [] },
  { id: 'mesa-03', name: 'Mesa 03', type: 'mesa', items: [] },
  { id: 'mostrador', name: 'Mostrador / Llevar', type: 'llevar', items: [] },
];

export const AppProvider = ({ children }) => {
  // 1. Sesión y Sede
  const [sede, setSede] = useState(() => localStorage.getItem('dg_sede') || null);
  const [perfil, setPerfil] = useState(() => {
    const saved = localStorage.getItem('dg_perfil');
    return saved ? JSON.parse(saved) : null;
  });
  const [activeTab, setActiveTab] = useState('ventas');

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

  // 3. Estado de sincronización Firestore
  const [syncStatus, setSyncStatus] = useState('connecting');
  const [productos, setProductos] = useState([]);
  const [ventas, setVentas] = useState([]);
  const [sesionCaja, setSesionCaja] = useState(null);
  const [movimientosCaja, setMovimientosCaja] = useState([]);
  const [kardex, setKardex] = useState([]);
  const [clientesFidelidad, setClientesFidelidad] = useState([]);

  // 4. Notificaciones Toast
  const [toast, setToast] = useState(null);
  const showToast = (message, type = 'success') => {
    setToast({ message, type, id: Date.now() });
    setTimeout(() => setToast(null), 3500);
  };

  // Guardar en Storage sesión
  useEffect(() => {
    if (sede) localStorage.setItem('dg_sede', sede);
    else localStorage.removeItem('dg_sede');
  }, [sede]);

  useEffect(() => {
    if (perfil) localStorage.setItem('dg_perfil', JSON.stringify(perfil));
    else localStorage.removeItem('dg_perfil');
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

  // 5. Suscripciones Firestore en Tiempo Real (onSnapshot)
  useEffect(() => {
    setSyncStatus('connecting');

    // PRODUCTOS
    const unsubProd = onSnapshot(collections.productos, (snapshot) => {
      if (snapshot.empty) {
        setProductos([]);
      } else {
        const prods = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
      const v = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setVentas(v);
    }, (error) => {
      console.error('Error al escuchar ventas:', error);
    });

    // CAJA SESIONES
    const qSesiones = query(collections.sesionesCaja, orderBy('fechaApertura', 'desc'), limit(10));
    const unsubSesiones = onSnapshot(qSesiones, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      if (sede) {
        const abierta = docs.find(s => s.sede === sede && s.estado === 'ABIERTA');
        setSesionCaja(abierta || null);
      } else {
        setSesionCaja(null);
      }
    });

    // MOVIMIENTOS CAJA
    const qMovs = query(collections.movimientosCaja, orderBy('fecha', 'desc'), limit(100));
    const unsubMovs = onSnapshot(qMovs, (snapshot) => {
      const movs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMovimientosCaja(movs);
    });

    // KARDEX
    const qKardex = query(collections.kardex, orderBy('fecha', 'desc'), limit(100));
    const unsubKardex = onSnapshot(qKardex, (snapshot) => {
      const k = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setKardex(k);
    });

    // CLIENTES FIDELIDAD
    const unsubClientes = onSnapshot(collections.clientesFidelidad, (snapshot) => {
      const cli = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setClientesFidelidad(cli);
    });

    return () => {
      unsubProd();
      unsubVentas();
      unsubSesiones();
      unsubMovs();
      unsubKardex();
      unsubClientes();
    };
  }, [sede]);

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
  const addToCart = (product, targetAccountId = activeAccountId) => {
    const currentStock = getProductStock(product, sede);
    const currentPrice = getProductPrice(product, sede);

    if (currentStock <= 0) {
      showToast(`"${product.nombre}" está agotado en ${SEDES[sede]?.nombre || 'esta sede'}`, 'error');
      return;
    }

    setAccounts(prev => {
      return prev.map(acc => {
        if (acc.id === targetAccountId) {
          const existing = acc.items.find(item => item.product.id === product.id);
          const currentQty = existing ? existing.quantity : 0;

          if (currentQty + 1 > currentStock) {
            showToast(`Stock insuficiente de "${product.nombre}". Disponible: ${currentStock}`, 'warning');
            return acc;
          }

          let updatedItems;
          if (existing) {
            updatedItems = acc.items.map(item =>
              item.product.id === product.id
                ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * currentPrice }
                : item
            );
          } else {
            updatedItems = [...acc.items, { product, quantity: 1, subtotal: currentPrice }];
          }
          return { ...acc, items: updatedItems };
        }
        return acc;
      });
    });
  };

  const updateCartQuantity = (productId, delta, targetAccountId = activeAccountId) => {
    setAccounts(prev => {
      return prev.map(acc => {
        if (acc.id === targetAccountId) {
          const updatedItems = acc.items.map(item => {
            if (item.product.id === productId) {
              const currentStock = getProductStock(item.product, sede);
              const currentPrice = getProductPrice(item.product, sede);
              const newQty = item.quantity + delta;

              if (newQty > currentStock) {
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
        categoria: item.product.categoria,
        precio: priceForSede,
        cantidad: item.quantity,
        subtotal: priceForSede * item.quantity,
        icono: item.product.icono || '🧁'
      };
    });

    // Emisión / Simulación SUNAT - Nubefact
    const comprobanteData = await emitirComprobante({
      id: saleId,
      tipoComprobante,
      total: totalToPay,
      metodoPago,
      items: itemsSummary,
      cliente: {
        documento: clienteDoc || '',
        nombre: clienteNombre || 'Público General',
        telefono: clienteTelefono || ''
      }
    });

    const opGravada = Number((totalToPay / 1.18).toFixed(2));
    const igv = Number((totalToPay - opGravada).toFixed(2));

    // 1. Guardar la venta en 'ventas' con la información de la Mesa/Cuenta
    const ventaDocData = {
      id: saleId,
      fecha: new Date().toISOString(),
      timestamp: serverTimestamp(),
      sede,
      sedeNombre: SEDES[sede].nombre,
      vendedor: perfil.nombre,
      vendedorRol: perfil.rol,
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
      tipoComprobante, // 'NOTA_VENTA' | 'BOLETA' | 'FACTURA'
      comprobante: {
        tipo: comprobanteData.tipo,
        serie: comprobanteData.serie,
        numero: comprobanteData.numero,
        codigoCompleto: comprobanteData.codigoCompleto || `${comprobanteData.serie}-${comprobanteData.numero}`,
        estado: comprobanteData.estado || 'SIMULADO_LOCAL',
        enlace_del_pdf: comprobanteData.enlace_del_pdf || null,
        enlace_del_xml: comprobanteData.enlace_del_xml || null,
        cadena_para_codigo_qr: comprobanteData.cadena_para_codigo_qr || null,
        fecha: new Date().toISOString()
      },
      cliente: {
        documento: clienteDoc || '',
        nombre: clienteNombre || 'Público General',
        telefono: clienteTelefono || ''
      },
      montoRecibido: Number(montoRecibido) || totalToPay,
      vuelto: Number(vuelto) || 0,
      estado: 'COMPLETADA'
    };
    batch.set(ventaRef, ventaDocData);

    // 2. Descontar stock atómicamente y registrar en kardex
    for (const item of itemsToProcess) {
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
      updateCartQuantity,
      removeFromCart,
      clearCart,
      cartTotal,
      cartCount,
      // Firestore Collections
      productos,
      ventas,
      sesionCaja,
      movimientosCaja,
      kardex,
      clientesFidelidad,
      syncStatus,
      seedInitialProducts,
      processSale,
      toast,
      showToast
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
