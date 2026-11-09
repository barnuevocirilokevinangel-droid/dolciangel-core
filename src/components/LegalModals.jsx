import React, { useState } from 'react';
import { db, collections, addDoc, serverTimestamp } from '../services/firebase';
import { 
  BookOpen, 
  ShieldCheck, 
  FileText, 
  X, 
  CheckCircle, 
  AlertCircle, 
  Send,
  Building2,
  Calendar,
  User,
  Phone,
  Mail,
  Home,
  CreditCard
} from 'lucide-react';

export const LegalModals = ({
  isLibroOpen,
  onCloseLibro,
  isTerminosOpen,
  onCloseTerminos,
  isPrivacidadOpen,
  onClosePrivacidad
}) => {
  // Estado Formulario Libro de Reclamaciones
  const [formData, setFormData] = useState({
    nombre: '',
    tipoDoc: 'DNI',
    numDoc: '',
    telefono: '',
    email: '',
    direccion: '',
    esMenor: false,
    nombreApoderado: '',
    tipoBien: 'Producto',
    montoReclamado: '',
    descripcionBien: '',
    tipoReclamo: 'Reclamo', // 'Reclamo' o 'Queja'
    detalle: '',
    pedido: '',
    aceptaTerminos: false
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hojaReclamoNum, setHojaReclamoNum] = useState(null);

  const handleSubmitLibro = async (e) => {
    e.preventDefault();
    if (!formData.aceptaTerminos) {
      alert('Debes aceptar la declaración y tratamiento de datos personales para continuar.');
      return;
    }

    setIsSubmitting(true);
    try {
      const year = new Date().getFullYear();
      const correlativo = `LR-${year}-${Date.now().toString().slice(-6)}`;

      const payload = {
        hojaNumero: correlativo,
        fecha: new Date().toISOString(),
        timestamp: serverTimestamp(),
        estado: 'PENDIENTE',
        empresa: {
          ruc: '10427321351',
          razonSocial: 'RUTH PATRICIA CIRILO JARA',
          nombreComercial: 'DOLCIANGEL - PASTELERÍA FINA & CAFÉ',
          direccion: 'Av. Pacífico Mz. B Lt. 12 - Nuevo Chimbote, Áncash'
        },
        consumidor: {
          nombre: formData.nombre.trim(),
          tipoDoc: formData.tipoDoc,
          numDoc: formData.numDoc.trim(),
          telefono: formData.telefono.trim(),
          email: formData.email.trim(),
          direccion: formData.direccion.trim(),
          esMenor: formData.esMenor,
          apoderado: formData.esMenor ? formData.nombreApoderado.trim() : null
        },
        bienContratado: {
          tipo: formData.tipoBien,
          monto: formData.montoReclamado ? parseFloat(formData.montoReclamado) : null,
          descripcion: formData.descripcionBien.trim()
        },
        reclamacion: {
          tipo: formData.tipoReclamo,
          detalle: formData.detalle.trim(),
          pedido: formData.pedido.trim()
        }
      };

      await addDoc(collections.reclamaciones || 'reclamaciones', payload);
      setHojaReclamoNum(correlativo);
    } catch (err) {
      console.error('Error al registrar reclamo:', err);
      // Si la colección no está en collections object, escribir directo
      try {
        const year = new Date().getFullYear();
        const correlativo = `LR-${year}-${Date.now().toString().slice(-6)}`;
        await addDoc(collections.ventas, {
          tipoRegistro: 'RECLAMO_INDOCOPI',
          hojaNumero: correlativo,
          ...formData,
          timestamp: serverTimestamp()
        });
        setHojaReclamoNum(correlativo);
      } catch (e2) {
        alert('Ocurrió un error al enviar el formulario. Por favor, comunícate directamente a nuestro WhatsApp oficial.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setFormData({
      nombre: '',
      tipoDoc: 'DNI',
      numDoc: '',
      telefono: '',
      email: '',
      direccion: '',
      esMenor: false,
      nombreApoderado: '',
      tipoBien: 'Producto',
      montoReclamado: '',
      descripcionBien: '',
      tipoReclamo: 'Reclamo',
      detalle: '',
      pedido: '',
      aceptaTerminos: false
    });
    setHojaReclamoNum(null);
    onCloseLibro();
  };

  return (
    <>
      {/* ══════════════════════════════════════════════════════════
          1. MODAL: LIBRO DE RECLAMACIONES VIRTUAL (INDECOPI)
      ══════════════════════════════════════════════════════════ */}
      {isLibroOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-[#FFFDF8] rounded-3xl max-w-2xl w-full border border-amber-900/20 shadow-2xl overflow-hidden my-6 max-h-[92vh] flex flex-col">
            
            {/* Cabecera Oficial Indecopi */}
            <div className="bg-gradient-to-r from-[#2C1810] via-[#4A2411] to-[#2C1810] text-[#FFFDF8] p-5 sm:p-6 relative border-b border-amber-500/20">
              <button
                onClick={handleResetForm}
                className="absolute top-4 right-4 p-2 rounded-full text-amber-200/70 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Cerrar modal"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#DBC08B] to-[#C69F65] text-[#2C1810] flex items-center justify-center text-2xl font-bold shadow-md">
                  📖
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-widest font-extrabold text-amber-300 bg-amber-400/10 px-2.5 py-0.5 rounded-full border border-amber-400/20">
                    Conforme al D.S. N° 011-2011-PCM / Ley N° 29571
                  </span>
                  <h2 className="font-serif font-black text-xl sm:text-2xl text-[#F8E7C8] mt-1">
                    Libro de Reclamaciones Virtual
                  </h2>
                  <p className="text-[11px] text-amber-100/75">
                    DOLCIANGEL • RUTH PATRICIA CIRILO JARA • RUC: 10427321351
                  </p>
                </div>
              </div>
            </div>

            {/* Contenido / Formulario */}
            <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-6 text-slate-800 text-xs">
              {hojaReclamoNum ? (
                /* Pantalla de Éxito / Constancia */
                <div className="py-8 text-center space-y-4">
                  <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto text-3xl shadow-inner">
                    ✓
                  </div>
                  <h3 className="font-serif font-bold text-xl text-slate-900">
                    ¡Hoja de Reclamación Registrada con Éxito!
                  </h3>
                  <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl max-w-md mx-auto text-left space-y-1.5">
                    <p className="font-bold text-slate-800">
                      N° de Registro: <span className="text-brand-700 font-mono text-sm">{hojaReclamoNum}</span>
                    </p>
                    <p className="text-slate-600">
                      Fecha: {new Date().toLocaleDateString('es-PE')} a las {new Date().toLocaleTimeString('es-PE')}
                    </p>
                    <p className="text-slate-600">
                      Consumidor: {formData.nombre} ({formData.tipoDoc}: {formData.numDoc})
                    </p>
                  </div>
                  <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                    Conforme a la normativa de INDECOPI, el proveedor dará respuesta al presente reclamo o queja en un plazo no mayor a quince (15) días hábiles a través del correo electrónico registrado.
                  </p>
                  <button
                    onClick={handleResetForm}
                    className="px-6 py-2.5 rounded-full bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-all"
                  >
                    Entendido y Cerrar
                  </button>
                </div>
              ) : (
                /* Formulario Oficial */
                <form onSubmit={handleSubmitLibro} className="space-y-6">
                  {/* Datos del Establecimiento */}
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                      Datos del Proveedor
                    </span>
                    <p className="font-bold text-slate-900 text-xs">
                      RUTH PATRICIA CIRILO JARA (DOLCIANGEL)
                    </p>
                    <p className="text-[11px] text-slate-600">
                      RUC: 10427321351 • Sede: Av. Pacífico Mz. B Lt. 12, Nuevo Chimbote, Áncash - Perú
                    </p>
                  </div>

                  {/* 1. Identificación del Consumidor */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 border-b border-slate-200 pb-1.5">
                      <User className="w-4 h-4 text-brand-700" />
                      <h3 className="font-bold text-slate-900 uppercase text-[11px] tracking-wider">
                        1. Identificación del Consumidor Reclamante
                      </h3>
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Nombre Completo o Razón Social *</label>
                      <input
                        type="text"
                        required
                        value={formData.nombre}
                        onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                        placeholder="Nombres y Apellidos"
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-brand-600"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Tipo de Documento *</label>
                        <select
                          value={formData.tipoDoc}
                          onChange={(e) => setFormData({ ...formData, tipoDoc: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-brand-600"
                        >
                          <option value="DNI">DNI</option>
                          <option value="Carnet Extranjería">Carnet Extranjería</option>
                          <option value="RUC">RUC</option>
                          <option value="Pasaporte">Pasaporte</option>
                        </select>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="font-bold text-slate-700 block mb-1">Número de Documento *</label>
                        <input
                          type="text"
                          required
                          value={formData.numDoc}
                          onChange={(e) => setFormData({ ...formData, numDoc: e.target.value })}
                          placeholder="Número oficial"
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-brand-600"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Teléfono / Celular *</label>
                        <input
                          type="tel"
                          required
                          value={formData.telefono}
                          onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                          placeholder="Ej. 963810237"
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-brand-600"
                        />
                      </div>

                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Correo Electrónico *</label>
                        <input
                          type="email"
                          required
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          placeholder="tucorreo@ejemplo.com"
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-brand-600"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Domicilio / Dirección *</label>
                      <input
                        type="text"
                        required
                        value={formData.direccion}
                        onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                        placeholder="Av. / Jr. / Calle, Distrito, Ciudad"
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-brand-600"
                      />
                    </div>
                  </div>

                  {/* 2. Identificación del Bien Contratado */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center gap-2 border-b border-slate-200 pb-1.5">
                      <CreditCard className="w-4 h-4 text-brand-700" />
                      <h3 className="font-bold text-slate-900 uppercase text-[11px] tracking-wider">
                        2. Identificación del Bien Contratado
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Tipo de Bien *</label>
                        <div className="flex gap-4 pt-1">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="radio"
                              name="tipoBien"
                              value="Producto"
                              checked={formData.tipoBien === 'Producto'}
                              onChange={(e) => setFormData({ ...formData, tipoBien: e.target.value })}
                            />
                            <span>Producto (Postre/Torta/Bebida)</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="radio"
                              name="tipoBien"
                              value="Servicio"
                              checked={formData.tipoBien === 'Servicio'}
                              onChange={(e) => setFormData({ ...formData, tipoBien: e.target.value })}
                            />
                            <span>Servicio (Atención/Catering)</span>
                          </label>
                        </div>
                      </div>

                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Monto Reclamado (S/) (Opcional)</label>
                        <input
                          type="number"
                          step="0.10"
                          value={formData.montoReclamado}
                          onChange={(e) => setFormData({ ...formData, montoReclamado: e.target.value })}
                          placeholder="0.00"
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-brand-600"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Descripción del Producto o Servicio *</label>
                      <input
                        type="text"
                        required
                        value={formData.descripcionBien}
                        onChange={(e) => setFormData({ ...formData, descripcionBien: e.target.value })}
                        placeholder="Ej. Porción de Cheesecake de Maracuyá / Pedido de Torta"
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-brand-600"
                      />
                    </div>
                  </div>

                  {/* 3. Detalle de la Reclamación */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center gap-2 border-b border-slate-200 pb-1.5">
                      <FileText className="w-4 h-4 text-brand-700" />
                      <h3 className="font-bold text-slate-900 uppercase text-[11px] tracking-wider">
                        3. Detalle de la Reclamación y Pedido
                      </h3>
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Tipo de Reclamación *</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label className={`p-3 rounded-xl border cursor-pointer flex flex-col transition-all ${
                          formData.tipoReclamo === 'Reclamo'
                            ? 'bg-amber-50/70 border-amber-400 text-amber-950 font-bold'
                            : 'bg-white border-slate-200 text-slate-700'
                        }`}>
                          <div className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="tipoReclamo"
                              value="Reclamo"
                              checked={formData.tipoReclamo === 'Reclamo'}
                              onChange={(e) => setFormData({ ...formData, tipoReclamo: e.target.value })}
                            />
                            <span>RECLAMO</span>
                          </div>
                          <span className="text-[10px] font-normal text-slate-500 mt-1 pl-5">
                            Disconformidad relacionada a los productos o servicios adquiridos.
                          </span>
                        </label>

                        <label className={`p-3 rounded-xl border cursor-pointer flex flex-col transition-all ${
                          formData.tipoReclamo === 'Queja'
                            ? 'bg-amber-50/70 border-amber-400 text-amber-950 font-bold'
                            : 'bg-white border-slate-200 text-slate-700'
                        }`}>
                          <div className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="tipoReclamo"
                              value="Queja"
                              checked={formData.tipoReclamo === 'Queja'}
                              onChange={(e) => setFormData({ ...formData, tipoReclamo: e.target.value })}
                            />
                            <span>QUEJA</span>
                          </div>
                          <span className="text-[10px] font-normal text-slate-500 mt-1 pl-5">
                            Malestar o descontento respecto a la atención al público (no sobre el producto).
                          </span>
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Detalle de los Hechos (Fundamentación) *</label>
                      <textarea
                        required
                        rows={3}
                        value={formData.detalle}
                        onChange={(e) => setFormData({ ...formData, detalle: e.target.value })}
                        placeholder="Describe de manera clara lo ocurrido con fecha y hora aproximada..."
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-brand-600 resize-none"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Pedido Concreto del Consumidor *</label>
                      <textarea
                        required
                        rows={2}
                        value={formData.pedido}
                        onChange={(e) => setFormData({ ...formData, pedido: e.target.value })}
                        placeholder="¿Qué solución solicita para su caso? (Ej. Cambio de producto, devolución, disculpas formales)"
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-brand-600 resize-none"
                      />
                    </div>
                  </div>

                  {/* Declaración Legal y Consentimiento Ley 29733 */}
                  <div className="bg-slate-100 p-3.5 rounded-2xl border border-slate-200 space-y-2">
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        required
                        checked={formData.aceptaTerminos}
                        onChange={(e) => setFormData({ ...formData, aceptaTerminos: e.target.checked })}
                        className="mt-0.5"
                      />
                      <span className="text-[11px] text-slate-600 leading-snug">
                        Declaro ser el titular del servicio y autorizo el tratamiento de mis datos personales exclusivamente para la atención y resolución de esta reclamación, de conformidad con la Ley N° 29733 (Ley de Protección de Datos Personales del Perú) y el Código de Protección y Defensa del Consumidor.
                      </span>
                    </label>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={handleResetForm}
                      className="px-5 py-2.5 rounded-full border border-slate-200 text-slate-600 font-bold hover:bg-slate-100 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-6 py-2.5 rounded-full bg-gradient-to-r from-brand-700 to-rose-700 hover:from-brand-800 hover:to-rose-800 text-white font-extrabold shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <span>Enviando Hoja...</span>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span>Enviar Reclamación</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          2. MODAL: TÉRMINOS Y CONDICIONES
      ══════════════════════════════════════════════════════════ */}
      {isTerminosOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-[#FFFDF8] rounded-3xl max-w-xl w-full border border-amber-900/20 shadow-2xl overflow-hidden my-6 max-h-[85vh] flex flex-col">
            <div className="bg-[#2C1810] text-[#FFFDF8] p-5 flex items-center justify-between border-b border-amber-500/20">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-gold-400" />
                <h3 className="font-serif font-bold text-lg text-[#F8E7C8]">
                  Términos y Condiciones de Uso
                </h3>
              </div>
              <button
                onClick={onCloseTerminos}
                className="p-1 rounded-full text-amber-200/70 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-700 leading-relaxed">
              <div>
                <h4 className="font-bold text-slate-900 text-sm mb-1">1. Identificación del Titular</h4>
                <p>
                  El sitio web y la carta digital de <strong>DOLCIANGEL</strong> son operados por Ruth Patricia Cirilo Jara, con RUC N° 10427321351, con domicilio fiscal y sede en Av. Pacífico Mz. B Lt. 12, Nuevo Chimbote, Áncash - Perú.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 text-sm mb-1">2. Catálogo y Precios</h4>
                <p>
                  Todos los precios expuestos en la carta digital se expresan en Soles peruanos (S/) e incluyen los tributos de ley (IGV 18%). Las fotografías son referenciales y corresponden a preparaciones artesanales que pueden presentar sutiles variaciones naturales propias de la repostería fina.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 text-sm mb-1">3. Disponibilidad y Stock en Vivo</h4>
                <p>
                  Dolciangel elabora sus productos diariamente sin preservantes. La disponibilidad en vitrina está sujeta al stock físico del día. Al remitir el pedido vía WhatsApp, nuestro equipo confirma la disponibilidad inmediata antes de cualquier confirmación de pago.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 text-sm mb-1">4. Modificaciones y Cancelaciones</h4>
                <p>
                  En tortas enteras y pedidos personalizados (catering), se requiere anticipación mínima de 24 a 48 horas. Una vez iniciada la producción artesanal, no se admiten cancelaciones con devolución dineraria.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 text-sm mb-1">5. Canales de Atención</h4>
                <p>
                  Cualquier consulta respecto a nuestros productos puede canalizarse a través de nuestra línea de WhatsApp oficial +51 963 810 237 o de manera presencial en nuestras sedes de Nuevo Chimbote y Chimbote.
                </p>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                onClick={onCloseTerminos}
                className="px-5 py-2 rounded-full bg-slate-900 text-white font-bold text-xs"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          3. MODAL: POLÍTICA DE PRIVACIDAD (LEY 29733)
      ══════════════════════════════════════════════════════════ */}
      {isPrivacidadOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-[#FFFDF8] rounded-3xl max-w-xl w-full border border-amber-900/20 shadow-2xl overflow-hidden my-6 max-h-[85vh] flex flex-col">
            <div className="bg-[#2C1810] text-[#FFFDF8] p-5 flex items-center justify-between border-b border-amber-500/20">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h3 className="font-serif font-bold text-lg text-[#F8E7C8]">
                  Política de Privacidad y Protección de Datos
                </h3>
              </div>
              <button
                onClick={onClosePrivacidad}
                className="p-1 rounded-full text-amber-200/70 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-700 leading-relaxed">
              <p className="bg-emerald-50 p-3 rounded-xl border border-emerald-200 text-emerald-900 font-medium">
                En cumplimiento de la Ley N° 29733 (Ley de Protección de Datos Personales del Perú) y su Reglamento, Dolciangel garantiza la seguridad y confidencialidad de la información de sus clientes.
              </p>

              <div>
                <h4 className="font-bold text-slate-900 text-sm mb-1">1. Finalidad del Tratamiento</h4>
                <p>
                  Los datos personales proporcionados voluntariamente por el usuario (nombre, número telefónico, dirección de entrega) son utilizados exclusivamente para:
                </p>
                <ul className="list-disc pl-5 mt-1 space-y-0.5">
                  <li>Procesar y coordinar los pedidos de productos solicitados por WhatsApp.</li>
                  <li>Efectuar las entregas a domicilio (delivery).</li>
                  <li>Atender consultas, sugerencias y hojas de reclamaciones conforme a ley.</li>
                </ul>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 text-sm mb-1">2. No Compartición con Terceros</h4>
                <p>
                  Dolciangel no vende, arrienda ni comparte los datos personales de sus clientes con terceros para fines comerciales o publicitarios no autorizados.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 text-sm mb-1">3. Ejercicio de Derechos ARCO</h4>
                <p>
                  El titular de los datos personales puede ejercer en cualquier momento sus derechos de Acceso, Rectificación, Cancelación y Oposición (ARCO) comunicándose a nuestro WhatsApp oficial o visitando nuestra sede de Nuevo Chimbote.
                </p>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                onClick={onClosePrivacidad}
                className="px-5 py-2 rounded-full bg-slate-900 text-white font-bold text-xs"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default LegalModals;
