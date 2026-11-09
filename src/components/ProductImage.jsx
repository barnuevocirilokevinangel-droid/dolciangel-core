import React, { useState, useEffect } from 'react';
import { Cake, Sparkles, AlertCircle } from 'lucide-react';
import { getCategoryIcon } from '../services/productUtils';

/**
 * ProductImage Component
 * 
 * Implementa Skeleton Loading profesional con Tailwind CSS:
 * - Contenedor con animate-pulse en tonos pasteles suaves mientras la imagen descarga.
 * - loading="lazy" para optimizar ancho de banda móvil y cargar solo fotos visibles en viewport.
 * - Transición de opacidad suave (transition-opacity duration-300) al dispararse onLoad.
 * - Placeholder editorial boutique si la imagen falla (onError) o es inválida (emoji grande, fondo crema, serif).
 * - Respeta los contenedores de las tarjetas (rounded-2xl, aspect-[4/3], aspect-square).
 */
export const ProductImage = ({
  src,
  alt = 'Producto Dolciangel',
  fallbackIcon,
  categoria,
  className = '',
  containerClassName = '',
  aspectRatio = '', // e.g. 'aspect-[4/3]', 'aspect-square', etc.
  rounded = 'rounded-2xl',
  objectFit = 'object-contain'
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

      {/* 3. PLACEHOLDER EDITORIAL DE DOLCIANGEL (OnError o Sin Imagen) */}
      {(!hasValidSrc || imageStatus === 'error') && (
        <div 
          className={`w-full h-full flex flex-col items-center justify-center p-3 text-center bg-gradient-to-br from-[#FFFDF9] via-[#FDFBF7] to-[#F5ECE0] border border-amber-900/10 transition-all ${className}`}
        >
          {/* Emoji de categoría grande */}
          <div className="relative group mb-1">
            <span className="text-3xl sm:text-4xl select-none filter drop-shadow-xs transition-transform group-hover:scale-110">
              {fallbackIcon || getCategoryIcon(categoria) || '🧁'}
            </span>
          </div>

          {/* Nombre / Marca en serif bold */}
          <span className="font-serif font-bold text-xs sm:text-sm text-[#4A2D19] mt-1 line-clamp-1 max-w-[90%]">
            {alt || 'Dolciangel'}
          </span>
          {categoria && (
            <span className="text-[9px] uppercase tracking-wider font-extrabold text-amber-800/80 bg-amber-100/60 px-2 py-0.5 rounded-full mt-0.5">
              {categoria}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
