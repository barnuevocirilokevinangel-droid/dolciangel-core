import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { db, doc, onSnapshot, setDoc, serverTimestamp } from '../services/firebase';
import { 
  Globe, 
  Save, 
  CheckCircle, 
  Sparkles, 
  Image as ImageIcon, 
  Type, 
  FileText, 
  RotateCcw, 
  ExternalLink,
  Layers,
  Eye,
  UploadCloud,
  Check
} from 'lucide-react';

const DEFAULT_HERO = {
  titulo: 'Hay momentos que\nmerecen quedarse.',
  subtitulo: 'Elaboración diaria con ingredientes seleccionados.\nEncuéntranos en Villa España y Nuevo Chimbote.',
  imagenUrl: 'assets/hero/cheesecake-maracuya.png'
};

const IMAGE_PRESETS = [
  {
    nombre: 'Cheesecake Maracuyá',
    url: 'assets/hero/cheesecake-maracuya.png',
    icon: '🥭'
  },
  {
    nombre: 'Torta de Chocolate',
    url: 'assets/hero/torta-chocolate.png',
    icon: '🍫'
  },
  {
    nombre: 'Red Velvet Artesanal',
    url: 'assets/hero/red-velvet.png',
    icon: '🍓'
  }
];

export const GestorHeroView = () => {
  const { perfil, showToast } = useApp();

  const [titulo, setTitulo] = useState(DEFAULT_HERO.titulo);
  const [subtitulo, setSubtitulo] = useState(DEFAULT_HERO.subtitulo);
  const [imagenUrl, setImagenUrl] = useState(DEFAULT_HERO.imagenUrl);

  const [metadata, setMetadata] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // 1. Suscripción en tiempo real a configuracion_web/hero_principal
  useEffect(() => {
    const docRef = doc(db, 'configuracion_web', 'hero_principal');
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.titulo !== undefined) setTitulo(data.titulo);
        if (data.subtitulo !== undefined) setSubtitulo(data.subtitulo);
        if (data.imagenUrl !== undefined) setImagenUrl(data.imagenUrl);

        let fechaTexto = 'Reciente';
        if (data.ultimaActualizacion) {
          if (typeof data.ultimaActualizacion.toDate === 'function') {
            fechaTexto = data.ultimaActualizacion.toDate().toLocaleString();
          } else if (typeof data.ultimaActualizacion === 'string') {
            fechaTexto = new Date(data.ultimaActualizacion).toLocaleString();
          }
        }

        setMetadata({
          actualizadoPor: data.actualizadoPor || 'Angel (Dueño)',
          fecha: fechaTexto
        });
      }
      setIsLoading(false);
    }, (error) => {
      console.warn('Aviso al leer configuracion_web/hero_principal:', error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 2. Guardar Cambios en Firestore
  const handleGuardar = async (e) => {
    if (e) e.preventDefault();
    if (!titulo.trim()) {
      showToast('El título principal no puede estar vacío', 'error');
      return;
    }

    setIsSaving(true);
    setSavedSuccess(false);

    try {
      const docRef = doc(db, 'configuracion_web', 'hero_principal');
      const payload = {
        titulo: titulo.trim(),
        subtitulo: subtitulo.trim(),
        imagenUrl: imagenUrl.trim() || DEFAULT_HERO.imagenUrl,
        ultimaActualizacion: serverTimestamp(),
        actualizadoPor: perfil?.nombre || 'Angel (Dueño)'
      };

      await setDoc(docRef, payload, { merge: true });

      setSavedSuccess(true);
      showToast('¡Web Principal actualizada con éxito en tiempo real!', 'success');
      setTimeout(() => setSavedSuccess(false), 3500);
    } catch (err) {
      console.error('Error al guardar configuración web:', err);
      showToast('Error al guardar: ' + err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Cargar imagen local como Data URL
  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      showToast('La imagen es mayor a 2MB. Recomendamos imágenes livianas o URLs directas.', 'warning');
    }

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const result = uploadEvent.target?.result;
      if (typeof result === 'string') {
        setImagenUrl(result);
        showToast('Imagen cargada en la vista previa', 'info');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleResetDefaults = () => {
    if (!window.confirm('¿Deseas restablecer los valores de portada a los textos predeterminados?')) return;
    setTitulo(DEFAULT_HERO.titulo);
    setSubtitulo(DEFAULT_HERO.subtitulo);
    setImagenUrl(DEFAULT_HERO.imagenUrl);
  };

  return (
    <div className="pb-28 max-w-7xl mx-auto px-4 pt-4 space-y-6 animate-fadeIn">
      {/* Banner Principal Superior */}
      <div className="bg-gradient-to-r from-amber-900 via-brand-800 to-rose-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute -right-8 -bottom-8 w-44 h-44 bg-white/5 rounded-full blur-2xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center text-2xl shadow-inner border border-white/20">
              🖥️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-200 bg-white/10 px-2.5 py-0.5 rounded-full border border-white/20">
                  CMS Dinámico
                </span>
                <span className="text-[10px] font-extrabold bg-emerald-500/80 text-white px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  Sincronización en Vivo
                </span>
              </div>
              <h2 className="text-xl md:text-2xl font-serif font-bold mt-1">
                Gestor de Web Principal (Portada Hero)
              </h2>
              <p className="text-xs text-amber-100/80 mt-0.5">
                Edita los textos y la imagen de portada de la web pública (dolciangel-carta-web) sin reprogramar ni redesplegar
              </p>
            </div>
          </div>

          {metadata && (
            <div className="bg-black/25 backdrop-blur px-4 py-2 rounded-2xl border border-white/10 text-xs text-right">
              <span className="text-amber-200/70 block text-[10px] uppercase font-bold tracking-wider">Último cambio guardado</span>
              <span className="font-semibold text-white">{metadata.fecha}</span>
              <span className="text-amber-100/60 block text-[10px]">por {metadata.actualizadoPor}</span>
            </div>
          )}
        </div>
      </div>

      {/* Cuadrícula: Formulario a la izquierda + Live Preview a la derecha */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* COLUMNA 1: Formulario de Edición (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-brand-600" />
              Contenido de la Sección Hero
            </h3>
            <button
              type="button"
              onClick={handleResetDefaults}
              className="text-xs text-slate-400 hover:text-slate-700 flex items-center gap-1 transition-colors"
              title="Restablecer a textos por defecto"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Valores por defecto</span>
            </button>
          </div>

          <form onSubmit={handleGuardar} className="space-y-5">
            {/* 1. Título Principal */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Type className="w-3.5 h-3.5 text-brand-600" />
                <span>Título Principal del Hero</span>
                <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                rows={2}
                required
                placeholder="Ej. El arte de endulzar tus momentos en Chimbote"
                className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 text-slate-900 font-serif text-base transition-all resize-none shadow-sm"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Tip: Puedes usar saltos de línea para darle ritmo poético boutique al encabezado.
              </p>
            </div>

            {/* 2. Subtítulo o Descripción */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-brand-600" />
                <span>Subtítulo o Descripción de Portada</span>
              </label>
              <textarea
                value={subtitulo}
                onChange={(e) => setSubtitulo(e.target.value)}
                rows={3}
                placeholder="Ej. Pasteles artesanales, cheesecakes y postres diarios con la mejor calidad"
                className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 text-slate-700 text-sm transition-all resize-none shadow-sm"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Aparece debajo del título principal indicando sedes, frescura y horario.
              </p>
            </div>

            {/* 3. Imagen Principal Flotante */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-brand-600" />
                <span>Imagen Principal / Ilustración Flotante</span>
              </label>

              {/* Presets Rápidos */}
              <div className="flex flex-wrap items-center gap-2 mb-2.5">
                <span className="text-[11px] font-semibold text-slate-500 mr-1">Presets boutique:</span>
                {IMAGE_PRESETS.map((preset) => (
                  <button
                    key={preset.url}
                    type="button"
                    onClick={() => setImagenUrl(preset.url)}
                    className={`px-2.5 py-1 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition-all ${
                      imagenUrl === preset.url
                        ? 'bg-amber-100 border-amber-400 text-amber-900 font-bold shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span>{preset.icon}</span>
                    <span>{preset.nombre}</span>
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={imagenUrl}
                  onChange={(e) => setImagenUrl(e.target.value)}
                  placeholder="URL de la imagen (ej. assets/hero/cheesecake-maracuya.png o https://...)"
                  className="flex-1 px-4 py-2.5 rounded-2xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 text-slate-800 text-xs font-mono transition-all shadow-sm"
                />
                <label className="px-3.5 py-2.5 rounded-2xl border border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer transition-colors flex items-center gap-1.5 shrink-0 shadow-xs">
                  <UploadCloud className="w-4 h-4 text-brand-600" />
                  <span>Subir foto</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Botón de Guardado */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
              <div className="text-xs text-slate-500">
                {savedSuccess && (
                  <span className="text-emerald-600 font-bold flex items-center gap-1.5 animate-fadeIn">
                    <CheckCircle className="w-4 h-4" />
                    ¡Guardado! Tu web pública ya se actualizó.
                  </span>
                )}
              </div>

              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-3 rounded-2xl bg-gradient-to-r from-brand-700 to-pink-600 hover:from-brand-800 hover:to-pink-700 text-white font-bold text-sm shadow-md shadow-brand-700/20 hover:shadow-lg transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Guardando en Web...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>💾 Guardar Cambios en la Web</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* COLUMNA 2: Live Preview Visual Boutique (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-brand-600" />
              <span>Vista Previa en Tiempo Real</span>
            </span>
            <span className="text-[10px] font-bold text-brand-700 bg-brand-50 px-2.5 py-0.5 rounded-full border border-brand-200">
              index.html
            </span>
          </div>

          {/* Tarjeta Mockup Hero */}
          <div className="rounded-3xl border border-amber-900/15 overflow-hidden shadow-xl bg-[#2C1810] text-[#FFFDF8] relative p-6 sm:p-7">
            {/* Grain & Lighting */}
            <div className="absolute inset-0 bg-radial from-amber-500/10 via-transparent to-black/40 pointer-events-none" />

            <div className="relative z-10 space-y-4">
              <span className="inline-block text-[10px] font-extrabold tracking-widest uppercase text-amber-300 bg-amber-400/10 px-3 py-1 rounded-full border border-amber-400/20">
                🍰 BOUTIQUE DE POSTRES ARTESANALES
              </span>

              {/* Título renderizado */}
              <h1 className="font-serif text-2xl sm:text-3xl font-bold leading-tight text-[#F8E7C8] whitespace-pre-line italic">
                {titulo || 'Hay momentos que merecen quedarse.'}
              </h1>

              {/* Subtítulo renderizado */}
              <p className="text-xs text-amber-100/75 leading-relaxed whitespace-pre-line">
                {subtitulo || 'Elaboración diaria con ingredientes seleccionados.'}
              </p>

              {/* Botones de acción simulados */}
              <div className="flex items-center gap-2 pt-1">
                <span className="px-3.5 py-1.5 rounded-full bg-gradient-to-r from-[#DBC08B] to-[#C69F65] text-[#2C1810] text-[11px] font-bold shadow-sm inline-flex items-center gap-1">
                  <span>Explorar Carta Web</span>
                  <span>👉</span>
                </span>
                <span className="px-3.5 py-1.5 rounded-full border border-amber-200/30 text-amber-100 text-[11px] font-semibold">
                  Nuestras Sedes 📍
                </span>
              </div>

              {/* Imagen central protagonista con sombra elegante */}
              <div className="pt-4 flex items-center justify-center relative">
                <div className="relative group">
                  <img
                    src={imagenUrl || DEFAULT_HERO.imagenUrl}
                    alt="Preview Hero"
                    className="w-44 h-44 object-contain filter drop-shadow-[0_15px_25px_rgba(0,0,0,0.55)] transition-transform duration-500 group-hover:scale-105"
                    onError={(e) => {
                      // Fallback visual si la ruta es inválida
                      e.target.src = 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=400&q=80';
                    }}
                  />
                  <div className="w-36 h-4 bg-black/40 rounded-full blur-md mx-auto -mt-2" />
                </div>
              </div>
            </div>

            {/* Marquee Ticker inferior mini */}
            <div className="mt-5 -mx-7 -mb-7 py-2 bg-amber-950/60 border-t border-amber-900/30 text-[9px] uppercase tracking-widest text-amber-300/80 text-center font-bold">
              ✨ HECHO CON AMOR Y PASIÓN • HORNEADO DIARIO EN BUENOS AIRES
            </div>
          </div>

          <div className="bg-slate-100/80 rounded-2xl p-3.5 border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
            <span className="text-[11px]">¿Quieres ver cómo luce en la web real?</span>
            <a
              href="../dolciangel-carta-web/index.html"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-brand-700 hover:text-brand-900 inline-flex items-center gap-1 text-[11px]"
            >
              <span>Abrir Portada Web</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

      </div>
    </div>
  );
};
