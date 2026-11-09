import React, { useState, useEffect } from 'react';
import { db, doc, onSnapshot } from '../services/firebase';
import { 
  Sparkles, 
  MapPin, 
  Clock, 
  PhoneCall, 
  MessageCircle, 
  Heart, 
  Award, 
  ShieldCheck, 
  ChevronRight, 
  Lock,
  ArrowRight,
  Cake,
  Coffee,
  CheckCircle2,
  Bell
} from 'lucide-react';

const DEFAULT_CONFIG = {
  titulo: 'Hay momentos que\nmerecen quedarse.',
  subtitulo: 'Elaboración diaria con ingredientes seleccionados.\nEncuéntranos en Villa España y Nuevo Chimbote.',
  imagenUrl: 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=800&q=80',
  avisoSuperior: '✨ Atención hoy en Buenos Aires de 3:00 PM a 10:00 PM • Pedidos y delivery vía WhatsApp',
  telefonoWhatsapp: '51963810237'
};

const ESPECIALIDADES = [
  {
    titulo: 'Cheesecakes Horneados',
    descripcion: 'Cremosa base de queso crema horneada lentamente sobre masa crocante con coulis natural de maracuyá o frutos rojos.',
    imagen: 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=600&q=80',
    tag: 'Favorito de la Casa'
  },
  {
    titulo: 'Torta Húmeda de Chocolate',
    descripcion: 'Bizcocho húmedo e intenso de cacao puro bañado en abundante fudge artesanal hecho en olla de cobre.',
    imagen: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=600&q=80',
    tag: 'Clásico Imperdible'
  },
  {
    titulo: 'Red Velvet Artesanal',
    descripcion: 'Suave terciopelo rojo con sutil toque de cacao y relleno con frosting suave de queso crema.',
    imagen: 'https://images.unsplash.com/photo-1586788680434-30d324b2d46f?auto=format&fit=crop&w=600&q=80',
    tag: 'Especial'
  },
  {
    titulo: 'Pies & Tartaletas Clásicas',
    descripcion: 'Pies de limón con merengue suizo dorado y tartaletas crocantes con fresas frescas seleccionadas.',
    imagen: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80',
    tag: 'Receta Tradicional'
  }
];

export const LandingPageView = ({ onNavigate }) => {
  const [webConfig, setWebConfig] = useState(DEFAULT_CONFIG);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'configuracion', 'web_publica'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setWebConfig(prev => ({
          ...prev,
          titulo: data.titulo || prev.titulo,
          subtitulo: data.subtitulo || prev.subtitulo,
          imagenUrl: data.imagenUrl || prev.imagenUrl,
          avisoSuperior: data.avisoSuperior !== undefined ? data.avisoSuperior : prev.avisoSuperior,
          telefonoWhatsapp: data.telefonoWhatsapp || prev.telefonoWhatsapp
        }));
      }
    }, (err) => {
      console.warn('Aviso leyendo configuracion/web_publica:', err);
    });

    return () => unsub();
  }, []);

  const handleOpenWhatsApp = () => {
    const phone = webConfig.telefonoWhatsapp || '51963810237';
    const msg = encodeURIComponent('¡Hola Dolciangel! 🧁 Deseo consultar por disponibilidad de postres y pedidos.');
    window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-[#FFFDF9] text-slate-800 font-sans selection:bg-brand-500 selection:text-white">
      {/* 1. BARRA DE AVISO SUPERIOR */}
      {webConfig.avisoSuperior && (
        <div className="bg-gradient-to-r from-amber-600 via-rose-700 to-brand-800 text-white text-xs font-bold py-2 px-4 shadow-sm text-center flex items-center justify-center gap-2">
          <Bell className="w-3.5 h-3.5 text-gold-300 shrink-0 animate-bounce" />
          <span className="tracking-wide">{webConfig.avisoSuperior}</span>
        </div>
      )}

      {/* 2. NAVBAR PRINCIPAL */}
      <nav className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-pink-100 shadow-xs px-4 py-3.5">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          {/* Logo y Nombre */}
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-brand-700 to-rose-600 flex items-center justify-center text-white shadow-md shadow-brand-700/20 text-xl font-bold">
              🧁
            </div>
            <div>
              <span className="font-serif font-black text-xl tracking-tight text-slate-900 block leading-tight">
                DOLCIANGEL
              </span>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-brand-700 block -mt-0.5">
                Pastelería Fina & Café
              </span>
            </div>
          </div>

          {/* Enlaces y Acciones */}
          <div className="flex items-center gap-3">
            <a
              href="#locales"
              className="text-xs font-bold text-slate-700 hover:text-brand-700 px-3 py-1.5 rounded-full hover:bg-pink-50 transition-colors hidden md:inline"
            >
              Nuestros Locales
            </a>
            <a
              href="#concepto"
              className="text-xs font-bold text-slate-700 hover:text-brand-700 px-3 py-1.5 rounded-full hover:bg-pink-50 transition-colors hidden md:inline"
            >
              Filosofía Artesanal
            </a>

            {/* CTA a /carta */}
            <button
              onClick={() => onNavigate('carta')}
              className="px-4 py-2 rounded-full bg-gradient-to-r from-brand-700 to-rose-600 hover:from-brand-800 hover:to-rose-700 text-white text-xs font-extrabold shadow-md shadow-brand-700/25 transition-all flex items-center gap-1.5 active:scale-95"
            >
              <span>Ver Carta Digital</span>
              <span>🍰</span>
            </button>

            {/* WhatsApp */}
            <button
              onClick={handleOpenWhatsApp}
              className="p-2 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm transition-all hidden sm:flex items-center justify-center"
              title="Escríbenos por WhatsApp"
            >
              <MessageCircle className="w-4 h-4 fill-white" />
            </button>
          </div>
        </div>
      </nav>

      {/* 3. SECCIÓN HERO */}
      <header className="relative overflow-hidden bg-gradient-to-b from-[#2C1810] via-[#3a2015] to-[#1f100a] text-[#FFFDF8] pt-14 pb-20 px-4">
        {/* Glows decorativos */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-brand-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-10 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-8 items-center relative z-10">
          {/* Textos y Acciones (7 cols) */}
          <div className="md:col-span-7 space-y-5 text-center md:text-left">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-1.5 rounded-full text-xs font-bold text-amber-300 border border-white/15 shadow-inner">
              <Sparkles className="w-3.5 h-3.5 text-gold-400" />
              <span>Pastelería Fina Artesanal • Chimbote & Nuevo Chimbote</span>
            </div>

            <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-black leading-tight text-[#F8E7C8] whitespace-pre-line drop-shadow-sm">
              {webConfig.titulo}
            </h1>

            <p className="text-sm sm:text-base text-amber-100/80 leading-relaxed whitespace-pre-line max-w-xl mx-auto md:mx-0">
              {webConfig.subtitulo}
            </p>

            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 pt-2">
              <button
                onClick={() => onNavigate('carta')}
                className="px-6 py-3.5 rounded-full bg-gradient-to-r from-brand-600 via-rose-600 to-pink-600 hover:from-brand-700 hover:to-pink-700 text-white font-black text-sm shadow-xl shadow-brand-700/30 transition-all flex items-center gap-2 active:scale-95"
              >
                <span>Explorar Carta Digital</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={handleOpenWhatsApp}
                className="px-5 py-3.5 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/20 font-bold text-sm transition-all flex items-center gap-2 backdrop-blur-sm"
              >
                <PhoneCall className="w-4 h-4 text-emerald-400" />
                <span>Pedir por WhatsApp</span>
              </button>
            </div>

            {/* Badges de Calidad */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 pt-4 text-xs text-amber-200/80 border-t border-white/10">
              <span className="flex items-center gap-1.5">
                <Award className="w-4 h-4 text-gold-400" />
                <span>Insumos de Primera Calidad</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Heart className="w-4 h-4 text-rose-400" />
                <span>100% Sin Preservantes</span>
              </span>
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Horneado Diario</span>
              </span>
            </div>
          </div>

          {/* Imagen Protagonista (5 cols) */}
          <div className="md:col-span-5 flex justify-center">
            <div className="relative group max-w-sm w-full">
              <div className="absolute -inset-1 bg-gradient-to-r from-amber-500 to-rose-500 rounded-3xl blur-xl opacity-30 group-hover:opacity-50 transition duration-500" />
              <div className="relative rounded-3xl overflow-hidden border border-white/20 shadow-2xl bg-[#1a0d07] aspect-square flex items-center justify-center p-3">
                <img
                  src={webConfig.imagenUrl}
                  alt="Postres Artesanales Dolciangel"
                  className="w-full h-full object-cover rounded-2xl transform group-hover:scale-105 transition-transform duration-700"
                  onError={(e) => {
                    e.target.src = 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=800&q=80';
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* 4. SECCIÓN DE NUESTROS LOCALES (CHIMBOTE & NUEVO CHIMBOTE) */}
      <section id="locales" className="max-w-6xl mx-auto px-4 -mt-10 relative z-20">
        <div className="text-center mb-6 hidden md:block">
          <span className="bg-white px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider text-brand-800 shadow-md border border-pink-100">
            Nuestros Locales & Puntos de Atención
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* LOCAL 1: NUEVO CHIMBOTE (Sede Buenos Aires) */}
          <div className="bg-white rounded-3xl p-6 shadow-xl shadow-pink-950/5 border border-pink-100 transition-all hover:border-pink-300 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-2xl bg-pink-100 text-brand-800 flex items-center justify-center text-xl font-bold">
                    ☕
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-brand-700 bg-pink-50 px-2 py-0.5 rounded-full">
                      Sede Principal & Cafetería
                    </span>
                    <h3 className="font-serif font-black text-slate-900 text-lg mt-0.5">
                      Nuevo Chimbote (Buenos Aires)
                    </h3>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full flex items-center gap-1 border border-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Abierto Hoy
                </span>
              </div>

              <div className="space-y-2 pt-2 text-xs text-slate-600">
                <p className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-brand-600 shrink-0 mt-0.5" />
                  <span className="font-medium">
                    Av. Pacífico Mz. B Lt. 12 - Nuevo Chimbote (Frente a la Av. Principal)
                  </span>
                </p>
                <p className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                  <span className="font-semibold text-slate-800">
                    Lunes a Domingo: 3:00 PM – 10:00 PM
                  </span>
                </p>
                <p className="flex items-center gap-2 text-slate-500">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Cafetería, vitrina diaria, consumo en salón y delivery a domicilio.</span>
                </p>
              </div>
            </div>

            <div className="pt-5 mt-4 border-t border-slate-100 flex items-center gap-2">
              <button
                onClick={() => onNavigate('carta')}
                className="flex-1 py-2.5 rounded-xl bg-brand-700 hover:bg-brand-800 text-white font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-1.5"
              >
                <span>Ver Carta de Buenos Aires</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* LOCAL 2: CHIMBOTE (Sede Villa España) */}
          <div className="bg-white rounded-3xl p-6 shadow-xl shadow-pink-950/5 border border-pink-100 transition-all hover:border-pink-300 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-900 flex items-center justify-center text-xl font-bold">
                    🏪
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full">
                      Taller Central & Despacho
                    </span>
                    <h3 className="font-serif font-black text-slate-900 text-lg mt-0.5">
                      Chimbote (Villa España)
                    </h3>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
                  Chimbote
                </span>
              </div>

              <div className="space-y-2 pt-2 text-xs text-slate-600">
                <p className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-brand-600 shrink-0 mt-0.5" />
                  <span className="font-medium">
                    Villa España Mz. A Lt. 8 - Chimbote
                  </span>
                </p>
                <p className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                  <span className="font-semibold text-slate-800">
                    Lunes a Sábado: 3:30 PM – 9:30 PM
                  </span>
                </p>
                <p className="flex items-center gap-2 text-slate-500">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Taller de producción artesanal, vitrina del día y recojo de tortas enteras.</span>
                </p>
              </div>
            </div>

            <div className="pt-5 mt-4 border-t border-slate-100 flex items-center gap-2">
              <button
                onClick={handleOpenWhatsApp}
                className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-1.5"
              >
                <MessageCircle className="w-4 h-4 text-emerald-400" />
                <span>Consultar Disponibilidad en Villa España</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 5. NUESTRA FILOSOFÍA ARTESANAL */}
      <section id="concepto" className="max-w-6xl mx-auto px-4 py-16 space-y-10">
        <div className="text-center space-y-2 max-w-xl mx-auto">
          <span className="text-xs font-bold uppercase tracking-widest text-brand-700 bg-pink-50 px-3 py-1 rounded-full border border-pink-200">
            Tradición Pastelera
          </span>
          <h2 className="font-serif font-black text-2xl sm:text-3xl text-slate-900">
            El verdadero sabor de lo hecho con amor
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
            En Dolciangel creemos que cada porción de torta o cheesecake debe ser una experiencia inolvidable. Cuidamos cada detalle desde el batido hasta la presentación.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-3xl border border-pink-100 shadow-sm text-center space-y-3 hover:shadow-md transition-shadow">
            <div className="w-14 h-14 bg-pink-50 text-brand-700 rounded-2xl flex items-center justify-center text-2xl mx-auto">
              🥣
            </div>
            <h3 className="font-serif font-bold text-slate-900 text-base">Insumos Seleccionados</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Mantequilla pura, quesos crema de primera línea, cacao peruano y frutas frescas de temporada. Sin sustitutos baratos ni premezclas industriales.
            </p>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-pink-100 shadow-sm text-center space-y-3 hover:shadow-md transition-shadow">
            <div className="w-14 h-14 bg-amber-50 text-amber-700 rounded-2xl flex items-center justify-center text-2xl mx-auto">
              🔥
            </div>
            <h3 className="font-serif font-bold text-slate-900 text-base">Horneado Diario</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Nuestra vitrina se abastece fresca cada mañana. Garantizamos esponjosidad, aroma irresistible y la frescura que mereces.
            </p>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-pink-100 shadow-sm text-center space-y-3 hover:shadow-md transition-shadow">
            <div className="w-14 h-14 bg-rose-50 text-rose-700 rounded-2xl flex items-center justify-center text-2xl mx-auto">
              🎂
            </div>
            <h3 className="font-serif font-bold text-slate-900 text-base">Tortas & Celebraciones</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Tortas enteras para cumpleaños, bocaditos gourmet y pedidos especiales preparados con la dedicación de un taller de alta pastelería.
            </p>
          </div>
        </div>
      </section>

      {/* 6. GALERÍA DE ESPECIALIDADES DESTACADAS */}
      <section className="bg-gradient-to-b from-pink-50/40 via-pink-50/20 to-transparent py-16 px-4 border-t border-pink-100/60">
        <div className="max-w-6xl mx-auto space-y-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-brand-700 block">
                Nuestras Joyas
              </span>
              <h2 className="font-serif font-black text-2xl sm:text-3xl text-slate-900 mt-1">
                Especialidades de la Casa
              </h2>
            </div>
            <button
              onClick={() => onNavigate('carta')}
              className="px-5 py-2.5 rounded-full bg-brand-700 hover:bg-brand-800 text-white font-extrabold text-xs shadow-md shadow-brand-700/20 flex items-center gap-1.5 transition-all"
            >
              <span>Ver Stock del Día en la Carta</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {ESPECIALIDADES.map((esp, i) => (
              <div 
                key={i}
                className="bg-white rounded-3xl overflow-hidden border border-pink-100 shadow-sm hover:shadow-xl transition-all duration-300 group flex flex-col justify-between"
              >
                <div>
                  <div className="aspect-[4/3] w-full overflow-hidden bg-slate-100 relative">
                    <img 
                      src={esp.imagen} 
                      alt={esp.titulo} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <span className="absolute top-3 left-3 bg-slate-950/80 backdrop-blur-md text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                      {esp.tag}
                    </span>
                  </div>
                  <div className="p-4 space-y-1.5">
                    <h3 className="font-serif font-bold text-slate-900 text-sm group-hover:text-brand-700 transition-colors">
                      {esp.titulo}
                    </h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      {esp.descripcion}
                    </p>
                  </div>
                </div>

                <div className="p-4 pt-0">
                  <button
                    onClick={() => onNavigate('carta')}
                    className="w-full py-2 rounded-xl bg-pink-50 hover:bg-pink-100 text-brand-800 font-bold text-xs transition-colors flex items-center justify-center gap-1"
                  >
                    <span>Ver disponibilidad</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. BANNER LLAMADO A LA ACCIÓN FINAL */}
      <section className="max-w-5xl mx-auto px-4 py-12">
        <div className="rounded-3xl bg-gradient-to-r from-brand-900 via-rose-900 to-pink-800 p-8 sm:p-10 text-white shadow-2xl relative overflow-hidden text-center md:text-left flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="relative z-10 space-y-2 max-w-lg">
            <span className="text-xs font-bold text-pink-200 tracking-wider uppercase block">
              Atención hoy en Nuevo Chimbote
            </span>
            <h2 className="font-serif font-black text-2xl sm:text-3xl text-white">
              ¿Listo para endulzar tu tarde con Dolciangel?
            </h2>
            <p className="text-xs sm:text-sm text-pink-100/90 leading-relaxed">
              Consulta nuestra carta digital en tiempo real con stock confirmado y realiza tu pedido directo a nuestro WhatsApp oficial.
            </p>
          </div>

          <div className="relative z-10 flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            <button
              onClick={() => onNavigate('carta')}
              className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-white hover:bg-pink-50 text-brand-900 font-black text-xs sm:text-sm shadow-xl transition-all flex items-center justify-center gap-2 active:scale-95"
            >
              <span>Explorar Carta Digital</span>
              <span>🍰</span>
            </button>
            <button
              onClick={handleOpenWhatsApp}
              className="w-full sm:w-auto px-5 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-xs sm:text-sm shadow-xl transition-all flex items-center justify-center gap-2 active:scale-95"
            >
              <MessageCircle className="w-4 h-4 fill-white" />
              <span>WhatsApp</span>
            </button>
          </div>
        </div>
      </section>

      {/* 8. FOOTER CORPORATIVO */}
      <footer className="border-t border-pink-100 bg-white py-12 px-4 text-center text-xs text-slate-500 space-y-4">
        <div className="flex items-center justify-center gap-2">
          <span className="text-2xl">🧁</span>
          <span className="font-serif font-black text-slate-900 text-base">DOLCIANGEL</span>
        </div>
        <p className="max-w-md mx-auto text-xs text-slate-500 leading-relaxed">
          Pastelería Fina & Café • Nuevo Chimbote (Av. Pacífico Mz. B Lt. 12) & Chimbote (Villa España Mz. A Lt. 8)
        </p>
        <p className="text-[11px] text-slate-400">
          RUC: 10427321351 • RUTH PATRICIA CIRILO JARA • © {new Date().getFullYear()} Dolciangel.
        </p>

        {/* Acceso restringido al Core/POS */}
        <div className="pt-4 border-t border-slate-100 max-w-xs mx-auto">
          <button
            onClick={() => onNavigate('core')}
            className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-400 hover:text-brand-700 transition-colors py-1 px-3 rounded-full hover:bg-pink-50"
          >
            <Lock className="w-3 h-3" />
            <span>Acceso Colaboradores / POS (Dolciangel Core)</span>
          </button>
        </div>
      </footer>
    </div>
  );
};

export default LandingPageView;
