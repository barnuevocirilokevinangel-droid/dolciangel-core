import React, { useState, useEffect } from 'react';
import { Cake, Sparkles, AlertCircle } from 'lucide-react';

/**
 * ProductImage Component
 * 
 * Implementa Skeleton Loading profesional con Tailwind CSS:
 * - Contenedor con animate-pulse en tonos pasteles suaves (#FDF2F8 / #FCE7F3) mientras la imagen descarga.
 * - loading="lazy" para optimizar ancho de banda móvil y cargar solo fotos visibles en viewport.
 * - Transición de opacidad suave (transition-opacity duration-300) al dispararse onLoad.
 * - Placeholder elegante de Dolciangel con ícono de postre estilizado si la imagen falla (onError) o es inválida.
 * - Respeta los contenedores de las tarjetas (rounded-2xl, aspect-square, h-40).
 */
export const ProductImage = ({
  src,
  alt = 'Producto Dolciangel',
  fallbackIcon,
  categoria,
  className = '',
  containerClassName = '',
  aspectRatio = '', // e.g. 'aspect-square', 'h-40', etc.
  rounded = 'rounded-2xl',
  objectFit = 'object-cover'
}) => {
  const [imageStatus, setImageStatus] = useState('loading'); // 'loading' | 'loaded' | 'error'

  // Reiniciar estado si cambia la URL de la imagen
  useEffect(() => {
    if (!src || typeof src !== 'string' || src.trim() === '') {
      setImageStatus('error');
    } else {
      setImageStatus('loading');
    }
  }, [src]);

  const hasValidSrc = Boolean(src && typeof src === 'string' && src.trim() !== '');

  return (
    <div 
      className={`relative overflow-hidden select-none ${rounded} ${aspectRatio} ${containerClassName} w-full h-full`}
      style={{ minHeight: '100%' }}
    >
      {/* 1. SKELETON LOADING CONTAINER (Tonos pasteles suaves #FDF2F8 / #FCE7F3) */}
      {hasValidSrc && imageStatus === 'loading' && (
        <div 
          className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-gradient-to-br from-[#FDF2F8] to-[#FCE7F3] animate-pulse transition-opacity duration-300"
          aria-hidden="true"
        >
          {/* Ícono sutil centrado con halo suave */}
          <div className="w-10 h-10 rounded-full bg-white/70 shadow-xs flex items-center justify-center border border-pink-200/50">
            <Cake className="w-5 h-5 text-pink-400/80 animate-pulse" />
          </div>
          <span className="text-[10px] font-bold text-pink-400/70 mt-1.5 tracking-wider uppercase">
            Dolciangel
          </span>
        </div>
      )}

      {/* 2. IMAGEN EXTERNA CON LAZY LOADING Y TRANSICIÓN DE OPACIDAD */}
      {hasValidSrc && imageStatus !== 'error' && (
        <img
          src={src.trim()}
          alt={alt}
          loading="lazy"
          decoding="async"
          onLoad={() => setImageStatus('loaded')}
          onError={() => setImageStatus('error')}
          className={`w-full h-full ${objectFit} transition-opacity duration-300 ease-in-out ${
            imageStatus === 'loaded' ? 'opacity-100' : 'opacity-0'
          } ${className}`}
        />
      )}

      {/* 3. PLACEHOLDER ELEGANTE DE DOLCIANGEL (OnError o Sin Imagen) */}
      {(!hasValidSrc || imageStatus === 'error') && (
        <div 
          className={`w-full h-full flex flex-col items-center justify-center p-3 text-center bg-gradient-to-br from-[#FFF5F7] via-[#FDF2F8] to-[#FEF3C7]/40 border border-pink-100/80 transition-all ${className}`}
        >
          {/* Emblema central de postre estilizado */}
          <div className="relative group">
            <div className="w-12 h-12 rounded-2xl bg-white shadow-sm border border-pink-200/70 flex items-center justify-center text-brand-700 transition-transform group-hover:scale-105">
              <Cake className="w-6 h-6 text-brand-600 stroke-[1.8]" />
            </div>
            {/* Destello dorado */}
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-r from-gold-400 to-amber-400 text-slate-950 flex items-center justify-center shadow-xs">
              <Sparkles className="w-3 h-3 text-amber-950" />
            </div>
          </div>

          {/* Nombre / Marca sutil */}
          <span className="font-serif font-bold text-[11px] text-slate-700 mt-2 line-clamp-1">
            {alt || 'Dolciangel'}
          </span>
          {categoria && (
            <span className="text-[9px] uppercase tracking-wider font-extrabold text-pink-600/80 bg-pink-100/60 px-2 py-0.5 rounded-full mt-0.5">
              {categoria}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
