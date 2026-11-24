import React, { useState, useRef } from 'react';
import { uploadImageToStorage } from '../services/imageUpload';
import { ProductImage } from './ProductImage';
import { UploadCloud, Loader2, Link2, CheckCircle2, Trash2 } from 'lucide-react';

/**
 * Componente de carga de imagen con compresión automática a WebP (<150KB, máx 800px)
 * hacia Firebase Storage, previsualización estricta object-cover y fallback opcional por URL.
 */
export const ImageUploader = ({
  value = '',
  onChange,
  alt = 'Producto Dolciangel',
  categoria = '',
  folder = 'productos',
  onNotify
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMeta, setUploadMeta] = useState(null);
  const [showExternalUrl, setShowExternalUrl] = useState(false);
  const fileInputRef = useRef(null);

  const handleFile = async (file) => {
    if (!file) return;
    setIsUploading(true);
    setUploadMeta(null);
    try {
      const result = await uploadImageToStorage(file, folder);
      onChange(result.url);
      setUploadMeta({ sizeKB: result.sizeKB, width: result.width, height: result.height });
      onNotify?.(`Imagen optimizada (${result.sizeKB} KB WebP) y subida con éxito`, 'success');
    } catch (err) {
      console.error('Error al subir imagen a Firebase Storage:', err);
      const isPermError = err?.code === 'storage/unauthorized' || err?.message?.includes('permission');
      onNotify?.(
        isPermError
          ? 'Permiso denegado en Firebase Storage. Revisa las reglas de Storage o usa el respaldo de URL externa.'
          : (err.message || 'No se pudo subir la imagen'),
        'error'
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <label className="font-bold text-slate-700 text-xs">
          Foto del Producto (WebP automático &lt;150 KB)
        </label>
        <button
          type="button"
          onClick={() => setShowExternalUrl((prev) => !prev)}
          className="text-[11px] font-bold text-slate-500 hover:text-brand-700 inline-flex items-center gap-1 transition-colors"
        >
          <Link2 className="w-3 h-3" />
          <span>{showExternalUrl ? 'Ocultar URL externa' : 'Usar URL externa'}</span>
        </button>
      </div>

      <div className="flex items-stretch gap-3">
        {/* Preview cuadrado estricto con object-cover */}
        <div className="relative w-24 h-24 rounded-2xl overflow-hidden border border-pink-200 shadow-sm flex-shrink-0 bg-slate-50">
          <ProductImage
            src={value}
            alt={alt}
            categoria={categoria}
            rounded="rounded-2xl"
            objectFit="object-cover"
          />
          {value && (
            <button
              type="button"
              onClick={() => {
                onChange('');
                setUploadMeta(null);
              }}
              title="Quitar imagen"
              className="absolute top-1 right-1 z-20 p-1 rounded-lg bg-slate-900/75 hover:bg-rose-600 text-white transition-colors"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Zona Drag & Drop / Botón de Subida */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => !isUploading && fileInputRef.current?.click()}
          className={`flex-1 rounded-2xl border-2 border-dashed p-3 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-brand-600 bg-pink-50'
              : 'border-slate-200 hover:border-brand-400 hover:bg-pink-50/40 bg-slate-50/70'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) handleFile(f);
            }}
          />

          {isUploading ? (
            <div className="flex flex-col items-center gap-1 text-brand-700">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-[11px] font-bold">Comprimiendo a WebP y subiendo...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <UploadCloud className="w-5 h-5 text-brand-600" />
              <span className="text-xs font-extrabold text-slate-800">
                Subir imagen o arrastrar aquí
              </span>
              <span className="text-[10px] text-slate-500">
                Optimización automática máx. 800px • WebP
              </span>
              {uploadMeta && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full mt-0.5">
                  <CheckCircle2 className="w-3 h-3" />
                  Subida: {uploadMeta.sizeKB} KB ({uploadMeta.width}×{uploadMeta.height})
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Respaldo discreto para pegar URL externa */}
      {showExternalUrl && (
        <div className="pt-1">
          <input
            type="url"
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              setUploadMeta(null);
            }}
            placeholder="https://res.cloudinary.com/.../foto.webp"
            className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-xs focus:outline-none focus:border-brand-500 bg-white"
          />
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            Respaldo opcional: pega un enlace directo si la imagen ya está alojada fuera.
          </span>
        </div>
      )}
    </div>
  );
};
