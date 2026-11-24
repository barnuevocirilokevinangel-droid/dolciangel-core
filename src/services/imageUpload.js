// src/services/imageUpload.js
import { storage, storageRef, uploadBytes, getDownloadURL } from './firebase';

/**
 * Comprime y redimensiona una imagen en el navegador a formato WebP
 * (máximo 800px por lado y peso objetivo < 150KB).
 */
export async function compressImageToWebP(
  file,
  { maxDimension = 800, maxBytes = 150 * 1024 } = {}
) {
  if (!file || !file.type?.startsWith('image/')) {
    throw new Error('Selecciona un archivo de imagen válido (JPG, PNG, WebP).');
  }

  let bitmap = null;
  let imgEl = null;
  let objectUrl = null;
  let origWidth = 0;
  let origHeight = 0;

  try {
    if (typeof createImageBitmap === 'function') {
      bitmap = await createImageBitmap(file);
      origWidth = bitmap.width;
      origHeight = bitmap.height;
    } else {
      objectUrl = URL.createObjectURL(file);
      imgEl = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('No se pudo leer la imagen seleccionada.'));
        img.src = objectUrl;
      });
      origWidth = imgEl.naturalWidth || imgEl.width;
      origHeight = imgEl.naturalHeight || imgEl.height;
    }

    const scale = Math.min(1, maxDimension / Math.max(origWidth, origHeight));
    const targetWidth = Math.max(1, Math.round(origWidth * scale));
    const targetHeight = Math.max(1, Math.round(origHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap || imgEl, 0, 0, targetWidth, targetHeight);

    const qualities = [0.84, 0.72, 0.6, 0.48, 0.36, 0.25];
    let bestBlob = null;

    for (const q of qualities) {
      const blob = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/webp', q)
      );
      if (!blob) break;
      bestBlob = blob;
      if (blob.size <= maxBytes) break;
    }

    // Fallback a JPEG si el navegador no soporta WebP en canvas
    if (!bestBlob) {
      bestBlob = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.75)
      );
    }

    if (!bestBlob) {
      throw new Error('No se pudo comprimir la imagen en este navegador.');
    }

    return {
      blob: bestBlob,
      width: targetWidth,
      height: targetHeight,
      sizeKB: Math.round(bestBlob.size / 1024),
      mimeType: bestBlob.type || 'image/webp'
    };
  } finally {
    if (bitmap && typeof bitmap.close === 'function') bitmap.close();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Comprime la foto a WebP (<150KB, max 800px) y la sube a Firebase Storage.
 */
export async function uploadImageToStorage(file, folder = 'productos') {
  const { blob, width, height, sizeKB, mimeType } = await compressImageToWebP(file);
  const ext = mimeType.includes('jpeg') ? 'jpg' : 'webp';
  const baseName = (file.name || 'imagen')
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_')
    .slice(0, 40);

  const filePath = `${folder}/${Date.now()}_${baseName}.${ext}`;
  const fileRef = storageRef(storage, filePath);

  await uploadBytes(fileRef, blob, {
    contentType: mimeType,
    cacheControl: 'public,max-age=31536000'
  });

  const url = await getDownloadURL(fileRef);
  return { url, sizeKB, width, height, filePath };
}
