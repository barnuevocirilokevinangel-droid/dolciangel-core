import React, { useState, useEffect } from 'react';
import { db, doc, onSnapshot } from '../services/firebase';
import { LegalModals } from './LegalModals';
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
  BookOpen,
  FileText,
  Share2
} from 'lucide-react';

const DEFAULT_CONFIG = {
  titulo: 'Hay momentos que\nmerecen quedarse.',
  subtitulo: 'Elaboración diaria con ingredientes seleccionados.\nEncuéntranos en Villa España y Nuevo Chimbote.',
  imagenUrl: 'assets/hero/cheesecake-maracuya.png',
  avisoSuperior: '✨ Atención hoy en Buenos Aires de 3:00 PM a 10:00 PM • Pedidos y delivery vía WhatsApp',
  telefonoWhatsapp: '51963810237'
};

export const LandingPageView = ({ onNavigate }) => {
  const [webConfig, setWebConfig] = useState(DEFAULT_CONFIG);

  // Estados de Modales Legales
  const [isLibroOpen, setIsLibroOpen] = useState(false);
  const [isTerminosOpen, setIsTerminosOpen] = useState(false);
  const [isPrivacidadOpen, setIsPrivacidadOpen] = useState(false);

  // Club Dolciangel Form
  const [clubName, setClubName] = useState('');
  const [clubPhone, setClubPhone] = useState('');
  const [clubJoined, setClubJoined] = useState(false);

  // 1. Suscripción en tiempo real a 'configuracion/web_publica'
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
      console.warn('Aviso leyendo configuracion/web_publica en Landing:', err);
    });

    return () => unsub();
  }, []);

  const handleOpenWhatsApp = () => {
    const phone = webConfig.telefonoWhatsapp || '51963810237';
    const msg = encodeURIComponent('¡Hola Dolciangel! 🧁 Deseo consultar por disponibilidad de postres y pedidos.');
    window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
  };

  const handleClubSubmit = (e) => {
    e.preventDefault();
    if (!clubName.trim() || !clubPhone.trim()) return;
    setClubJoined(true);
  };

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="landing-body selection:bg-amber-800 selection:text-white" style={{ background: 'var(--page)', color: 'var(--ink)' }}>
      
      {/* 0. Noise texture background */}
      <div className="noise" aria-hidden="true"></div>

      {/* 1. BARRA DE AVISO / TICKER SUPERIOR */}
      {webConfig.avisoSuperior && (
        <div className="bg-gradient-to-r from-[#2C1810] via-[#4A2411] to-[#2C1810] text-[#FFFDF8] text-xs font-semibold py-2 px-4 shadow-sm text-center flex items-center justify-center gap-2 border-b border-amber-900/20">
          <span className="text-amber-400">✨</span>
          <span className="tracking-wide text-xs">{webConfig.avisoSuperior}</span>
        </div>
      )}

      {/* 2. NAV LANDING BOUTIQUE (1:1 de dolciangel-carta-web) */}
      <nav className="nav" id="mainNav" aria-label="Navegación principal">
        <div className="container nav__inner">
          <a href="#top" className="nav__logo font-serif">Dolciangel</a>

          <ul className="nav__links">
            <li><a href="#historia" onClick={(e) => { e.preventDefault(); scrollToSection('historia'); }} className="nav__link">Historia</a></li>
            <li><a href="#destacados" onClick={(e) => { e.preventDefault(); scrollToSection('destacados'); }} className="nav__link">Favoritos</a></li>
            <li><a href="#fidelidad" onClick={(e) => { e.preventDefault(); scrollToSection('fidelidad'); }} className="nav__link">Club</a></li>
            <li><a href="#sedes" onClick={(e) => { e.preventDefault(); scrollToSection('sedes'); }} className="nav__link">Visítanos</a></li>
          </ul>

          <div className="nav__actions flex items-center gap-2">
            <button
              onClick={() => onNavigate && onNavigate('carta')}
              className="btn btn--outline btn--sm hidden sm:inline-flex"
            >
              Carta Digital 🍰
            </button>
            <button 
              className="btn btn--wa btn--sm nav__wa" 
              onClick={handleOpenWhatsApp}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14" aria-hidden="true">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              <span>Pedir</span>
            </button>
          </div>
        </div>
      </nav>

      {/* 3. HERO EDITORIAL BOUTIQUE — DOLCIANGEL (1:1 de dolciangel-carta-web) */}
      <section className="hero hero-boutique" id="top" aria-label="Portada boutique Dolciangel">
        <div className="hero-boutique__container">
          
          {/* Lado Izquierdo: Copy Editorial */}
          <div className="hero-boutique__left">
            <div className="hero-boutique__badge">
              🍰 BOUTIQUE DE POSTRES ARTESANALES
            </div>
            <h1 className="hero-boutique__title">
              <em>{webConfig.titulo}</em>
            </h1>
            <p className="hero-boutique__sub">
              {webConfig.subtitulo}
            </p>
            <div className="hero-boutique__actions">
              <button 
                className="btn-boutique-gold" 
                onClick={() => onNavigate && onNavigate('carta')}
              >
                <span>Explorar Carta Web</span>
                <span aria-hidden="true">👉</span>
              </button>
              <button 
                className="btn-boutique-outline" 
                type="button" 
                onClick={() => scrollToSection('sedes')}
              >
                <span aria-hidden="true">📍</span>
                <span>Nuestras Sedes</span>
              </button>
            </div>
          </div>

          {/* Lado Derecho: Composición 2.5D con postres y frutas flotantes */}
          <div className="hero-boutique__right">
            <div 
              className="hero-boutique__stage hero-interactive" 
              onClick={() => onNavigate && onNavigate('carta')} 
              role="button" 
              tabIndex={0} 
              aria-label="Explorar postres en la Carta Web"
            >
              {/* Postre 1: Torta de Chocolate */}
              <div className="boutique-cake boutique-cake--chocolate hero-interactive">
                <img src="assets/hero/torta-chocolate.png" alt="Torta Suprema de Chocolate" draggable="false" />
                <div className="boutique-cake__shadow"></div>
              </div>

              {/* Postre 2: Cheesecake de Maracuyá */}
              <div className="boutique-cake boutique-cake--maracuya hero-interactive">
                <img src={webConfig.imagenUrl || "assets/hero/cheesecake-maracuya.png"} alt="Cheesecake de Maracuyá" draggable="false" />
                <div className="boutique-cake__shadow boutique-cake__shadow--large"></div>
              </div>

              {/* Frutas e ingredientes satélites flotantes */}
              <div className="boutique-sat boutique-sat--berry">
                <img src="assets/hero/strawberry-top.png" alt="" draggable="false" />
              </div>
              <div className="boutique-sat boutique-sat--mint">
                <img src="assets/hero/mint-top.png" alt="" draggable="false" />
              </div>
              <div className="boutique-sat boutique-sat--blueberry">
                <img src="assets/hero/blueberry-right.png" alt="" draggable="false" />
              </div>
              <div className="boutique-sat boutique-sat--whole-berry">
                <img src="assets/hero/strawberry-small.png" alt="" draggable="false" />
              </div>
            </div>
          </div>

        </div>

        {/* Borde Inferior: Marquee continuo animado de 20s */}
        <div className="marquee-container py-3 border-t border-amber-900/10 bg-amber-50/40 select-none" aria-hidden="true">
          <div className="marquee-content font-semibold tracking-widest text-xs uppercase text-amber-950/70">
            <span className="inline-flex gap-8 px-4">
              <span>✨ BOUTIQUE ARTESANAL</span> <span>•</span>
              <span>🍰 HORNEADO DIARIO EN VILLA ESPAÑA Y BUENOS AIRES</span> <span>•</span>
              <span>🍓 FRUTAS FRESCAS SELECCIONADAS</span> <span>•</span>
              <span>🤎 HECHO CON AMOR Y PASIÓN</span> <span>•</span>
            </span>
            <span className="inline-flex gap-8 px-4">
              <span>✨ BOUTIQUE ARTESANAL</span> <span>•</span>
              <span>🍰 HORNEADO DIARIO EN VILLA ESPAÑA Y BUENOS AIRES</span> <span>•</span>
              <span>🍓 FRUTAS FRESCAS SELECCIONADAS</span> <span>•</span>
              <span>🤎 HECHO CON AMOR Y PASIÓN</span> <span>•</span>
            </span>
          </div>
        </div>
      </section>

      {/* 4. HISTORIA Y MOMENTOS (1:1 de dolciangel-carta-web) */}
      <section className="momentos" id="historia" aria-label="Momentos Dolciangel">
        <div className="container">
          <div className="momentos__hd reveal-item">
            <span className="momentos__eyebrow">✦ Momentos Dolciangel</span>
            <h2 className="momentos__title">Lo que pasa cuando nos visitas</h2>
            <p className="momentos__sub">Un dulce nunca es solo un dulce. Es una pausa, un reencuentro, una celebración o simplemente darte el gusto que te mereces.</p>
          </div>

          <div className="momentos__quotes">
            <blockquote className="momentos__quote reveal-item">
              <p>"Nunca me habían atendido así. Salí pensando: tengo que traer a alguien especial."</p>
              <cite>— Andrea M., cliente habitual</cite>
            </blockquote>
            <blockquote className="momentos__quote reveal-item">
              <p>"El cheesecake de maracuyá es un antes y un después. Siempre fresco, siempre perfecto."</p>
              <cite>— Sofía R., Villa España</cite>
            </blockquote>
            <blockquote className="momentos__quote reveal-item">
              <p>"Un lugar que se siente como hogar pero con la elegancia de algo muy especial."</p>
              <cite>— Miguel T., Buenos Aires</cite>
            </blockquote>
          </div>
        </div>
      </section>

      {/* 5. FAVORITOS DESTACADOS */}
      <section className="featured" id="destacados">
        <div className="container">
          <div className="featured__hd reveal-item">
            <h2 className="section-title">Nuestros favoritos</h2>
            <p className="section-sub">Los postres más queridos de la familia Dolciangel</p>
          </div>

          <div className="feat-grid" id="featuredGrid">
            {/* Card 1: Cheesecake Maracuyá */}
            <div className="feat-card reveal-item" onClick={() => onNavigate && onNavigate('carta')}>
              <div className="feat-card__img">
                <div className="feat-card__bg" style={{ background: 'linear-gradient(135deg, #4A2010 0%, #8B4513 50%, #3A180A 100%)' }}></div>
                <div className="feat-card__fade"></div>
                <span className="feat-card__emoji">🌸</span>
                <span className="feat-card__badge badge-popular">Popular</span>
              </div>
              <div className="feat-card__body">
                <div className="feat-card__name">Cheesecake Maracuyá</div>
                <div className="feat-card__desc">Base crujiente de galleta, relleno cremoso de queso y coulis de maracuyá fresco.</div>
                <div className="feat-card__foot">
                  <span className="feat-card__price">S/ 9.00</span>
                  <span className="feat-card__wa">Ver en carta →</span>
                </div>
              </div>
            </div>

            {/* Card 2: Torta de Chocolate */}
            <div className="feat-card reveal-item" onClick={() => onNavigate && onNavigate('carta')}>
              <div className="feat-card__img">
                <div className="feat-card__bg" style={{ background: 'linear-gradient(135deg, #3A1A08 0%, #6A2C12 50%, #2C1208 100%)' }}></div>
                <div className="feat-card__fade"></div>
                <span className="feat-card__emoji">🎂</span>
                <span className="feat-card__badge badge-popular">Favorita</span>
              </div>
              <div className="feat-card__body">
                <div className="feat-card__name">Torta Suprema Chocolate</div>
                <div className="feat-card__desc">Bizcocho húmedo de cacao puro bañado en abundante fudge artesanal hecho en casa.</div>
                <div className="feat-card__foot">
                  <span className="feat-card__price">S/ 8.50</span>
                  <span className="feat-card__wa">Ver en carta →</span>
                </div>
              </div>
            </div>

            {/* Card 3: Red Velvet */}
            <div className="feat-card reveal-item" onClick={() => onNavigate && onNavigate('carta')}>
              <div className="feat-card__img">
                <div className="feat-card__bg" style={{ background: 'linear-gradient(135deg, #4A1020 0%, #8B2040 50%, #2C0810 100%)' }}></div>
                <div className="feat-card__fade"></div>
                <span className="feat-card__emoji">🍓</span>
                <span className="feat-card__badge badge-popular">Especial</span>
              </div>
              <div className="feat-card__body">
                <div className="feat-card__name">Red Velvet Artesanal</div>
                <div className="feat-card__desc">Suave bizcocho terciopelo rojo relleno y cubierto con frosting artesanal de queso crema.</div>
                <div className="feat-card__foot">
                  <span className="feat-card__price">S/ 8.50</span>
                  <span className="feat-card__wa">Ver en carta →</span>
                </div>
              </div>
            </div>
          </div>

          <div className="featured__more reveal-item text-center mt-8">
            <button 
              className="btn btn--outline" 
              onClick={() => onNavigate && onNavigate('carta')}
            >
              Ver carta completa →
            </button>
          </div>
        </div>
      </section>

      {/* 6. CLUB DOLCIANGEL (1:1 de dolciangel-carta-web) */}
      <section className="loyalty" id="fidelidad">
        <div className="container">
          <div className="loyalty__inner">
            <div className="loyalty__copy reveal-item">
              <span className="loyalty__badge-tag">✦ Club Dolciangel</span>
              <h2 className="section-title">Únete a la familia</h2>
              <p className="loyalty__text">Regístrate y sé parte de la comunidad Dolciangel. Los miembros del club reciben lo mejor antes que nadie: promociones exclusivas, sorpresas en tu cumpleaños y acceso anticipado a nuevas creaciones.</p>
              <ul className="loyalty__perks">
                <li className="loyalty__perk"><span className="loyalty__perk-ico">🎁</span>Promociones exclusivas para miembros</li>
                <li className="loyalty__perk"><span className="loyalty__perk-ico">🎂</span>Regalo especial en tu cumpleaños</li>
                <li className="loyalty__perk"><span className="loyalty__perk-ico">🌟</span>Acceso anticipado a novedades</li>
                <li className="loyalty__perk"><span className="loyalty__perk-ico">💚</span>Descuentos especiales del club</li>
              </ul>
            </div>

            <div className="loyalty__form-wrap reveal-item">
              {clubJoined ? (
                <div className="loyalty-success p-6 text-center space-y-2">
                  <span className="text-4xl">🎉</span>
                  <h3 className="font-serif font-bold text-lg text-slate-900">¡Ya eres parte del club, {clubName}!</h3>
                  <p className="text-xs text-slate-500">Te avisaremos de las mejores promociones y novedades vía WhatsApp.</p>
                </div>
              ) : (
                <form className="loyalty-form" onSubmit={handleClubSubmit}>
                  <div className="form-field">
                    <label className="form-label" htmlFor="flName">Nombre completo *</label>
                    <input 
                      className="form-input" 
                      id="flName" 
                      type="text" 
                      placeholder="Tu nombre" 
                      required 
                      value={clubName}
                      onChange={(e) => setClubName(e.target.value)}
                    />
                  </div>
                  <div className="form-field">
                    <label className="form-label" htmlFor="flPhone">WhatsApp / Teléfono *</label>
                    <input 
                      className="form-input" 
                      id="flPhone" 
                      type="tel" 
                      placeholder="+51 963 810 237" 
                      required 
                      value={clubPhone}
                      onChange={(e) => setClubPhone(e.target.value)}
                    />
                  </div>
                  <button className="btn btn--green btn--lg form-submit w-full" type="submit">
                    Unirme al club ✦
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 7. SEDES / VISÍTANOS (CHIMBOTE & NUEVO CHIMBOTE) */}
      <section className="sedes" id="sedes">
        <div className="container">
          <div className="text-center mb-8">
            <h2 className="section-title">Dónde encontrarnos</h2>
            <p className="section-sub">Locales en Chimbote y Nuevo Chimbote • Consulta disponibilidad antes de venir</p>
          </div>

          <div className="sedes__grid">
            {/* Sede Villa España */}
            <article className="sede reveal-item">
              <div className="sede__pin">📍</div>
              <h3 className="sede__name">Villa España</h3>
              <p className="sede__city">Chimbote, Perú</p>
              <div className="sede__hours">
                <Clock className="w-3.5 h-3.5 mr-1" />
                Lun–Sáb: 3:30pm – 9:30pm
              </div>
              <p className="sede__nota">Taller artesanal & despacho de pedidos para llevar</p>
              <div className="sede__actions">
                <button 
                  className="btn btn--gold-outline btn--sm" 
                  onClick={handleOpenWhatsApp}
                >
                  WhatsApp
                </button>
                <a 
                  className="btn btn--map btn--sm" 
                  href="https://maps.google.com/?q=Villa+Espana+Chimbote" 
                  target="_blank" 
                  rel="noopener"
                >
                  Ver en Maps
                </a>
              </div>
            </article>

            {/* Sede Buenos Aires */}
            <article className="sede reveal-item">
              <div className="sede__pin">📍</div>
              <h3 className="sede__name">Buenos Aires</h3>
              <p className="sede__city">Nuevo Chimbote, Perú</p>
              <div className="sede__hours">
                <Clock className="w-3.5 h-3.5 mr-1" />
                Lun–Dom: 3:00pm – 10:00pm
              </div>
              <p className="sede__nota">Av. Pacífico Mz. B Lt. 12 • Cafetería, salón y delivery</p>
              <div className="sede__actions">
                <button 
                  className="btn btn--gold-outline btn--sm" 
                  onClick={handleOpenWhatsApp}
                >
                  WhatsApp
                </button>
                <a 
                  className="btn btn--map btn--sm" 
                  href="https://maps.google.com/?q=Av.+Pacifico+Mz.+B+Lt.+12+Nuevo+Chimbote" 
                  target="_blank" 
                  rel="noopener"
                >
                  Ver en Maps
                </a>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* 8. CTA FINAL */}
      <section className="cta-final">
        <div className="container">
          <div className="cta-final__inner reveal-item">
            <span className="cta-final__em" aria-hidden="true">🍰</span>
            <h2 className="cta-final__heading">Hoy también puede ser un buen día para un postre.</h2>
            <p className="cta-final__sub">Hecho con amor, pensado para ti.</p>
            <div className="cta-final__actions">
              <button 
                className="btn btn--ghost btn--lg" 
                onClick={() => onNavigate && onNavigate('carta')}
              >
                Explorar la carta
              </button>
              <button 
                className="btn btn--wa btn--lg" 
                onClick={handleOpenWhatsApp}
              >
                Pedir por WhatsApp
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 9. FOOTER CORPORATIVO CON REQUISITOS LEGALES PERÚ (INDECOPI & LEY 29733) */}
      <footer className="footer" id="footer">
        <div className="container">
          <div className="footer__top">
            <div className="footer__brand">
              <span className="footer__logo font-serif">Dolciangel</span>
              <p className="footer__tagline">Postres artesanales hechos con amor</p>
              <p className="text-[11px] text-amber-200/60 mt-1">
                RUTH PATRICIA CIRILO JARA • RUC: 10427321351
              </p>
              <p className="text-[11px] text-amber-200/60">
                Chimbote & Nuevo Chimbote, Áncash - Perú
              </p>
            </div>

            <nav className="footer__nav" aria-label="Navegación footer">
              <a href="#historia" onClick={(e) => { e.preventDefault(); scrollToSection('historia'); }} className="footer__nav-link">Historia</a>
              <a href="#destacados" onClick={(e) => { e.preventDefault(); scrollToSection('destacados'); }} className="footer__nav-link">Favoritos</a>
              <a href="#fidelidad" onClick={(e) => { e.preventDefault(); scrollToSection('fidelidad'); }} className="footer__nav-link">Club</a>
              <a href="#sedes" onClick={(e) => { e.preventDefault(); scrollToSection('sedes'); }} className="footer__nav-link">Sedes</a>
              <button onClick={() => onNavigate && onNavigate('carta')} className="footer__nav-link text-left">Carta</button>
            </nav>

            <div className="footer__right">
              <p className="footer__hours-lbl">Horario</p>
              <p className="footer__hours-txt">Lun–Dom · 3pm – 10pm</p>
              
              {/* Botón Libro de Reclamaciones Oficial */}
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setIsLibroOpen(true)}
                  className="inline-flex items-center gap-2 bg-[#FFFDF8] hover:bg-amber-100/90 text-[#2C1810] px-3.5 py-1.5 rounded-xl border border-amber-300 font-bold text-xs shadow-sm transition-all active:scale-95 text-left"
                >
                  <span className="text-base">📖</span>
                  <div>
                    <span className="block leading-tight font-black text-[10px] uppercase tracking-wider text-brand-900">
                      Libro de Reclamaciones
                    </span>
                    <span className="block text-[9px] text-slate-500 font-normal">
                      Conforme al Código de Protección al Consumidor
                    </span>
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Enlaces Legales y Copyright */}
          <div className="pt-6 mt-6 border-t border-amber-900/30 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-amber-200/70">
            <p className="footer__copy m-0">
              Dolciangel © {new Date().getFullYear()} · Hecho con amor · Todos los derechos reservados
            </p>

            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setIsTerminosOpen(true)}
                className="hover:text-white underline transition-colors"
              >
                Términos y Condiciones
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={() => setIsPrivacidadOpen(true)}
                className="hover:text-white underline transition-colors"
              >
                Política de Privacidad
              </button>
              <span>•</span>
              {onNavigate && (
                <button
                  type="button"
                  onClick={() => onNavigate('core')}
                  className="hover:text-white text-amber-300/80 transition-colors flex items-center gap-1"
                >
                  <Lock className="w-3 h-3" />
                  <span>Acceso POS</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </footer>

      {/* FAB WhatsApp Flotante */}
      <button 
        className="fab" 
        id="fabWa" 
        onClick={handleOpenWhatsApp} 
        aria-label="Pedir por WhatsApp"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" width="26" height="26" aria-hidden="true">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
        <span className="fab__ring"></span>
      </button>

      {/* Modales Legales Reutilizables */}
      <LegalModals
        isLibroOpen={isLibroOpen}
        onCloseLibro={() => setIsLibroOpen(false)}
        isTerminosOpen={isTerminosOpen}
        onCloseTerminos={() => setIsTerminosOpen(false)}
        isPrivacidadOpen={isPrivacidadOpen}
        onClosePrivacidad={() => setIsPrivacidadOpen(false)}
      />
    </div>
  );
};

export default LandingPageView;
