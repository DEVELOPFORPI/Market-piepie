/**
 * blob: URLs are only valid in the current document; persisting them breaks after navigation.
 * Convert to data URLs before storage.
 */

/** For img src: blob URLs become placeholder to avoid broken images after reload */
export function getDisplayImageUrl(url: string | undefined): string {
  if (!url) return '/placeholder.jpg';
  if (url.startsWith('blob:')) return '/placeholder.jpg';
  return url;
}

/** Read file as data URL (avoid blob URLs for persistence) */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string) || '');
    reader.onerror = () => reject(new Error('FileReader error'));
    reader.readAsDataURL(file);
  });
}

/** Convert blob URL to data URL; pass through if already data: or http(s). Empty string on failure. */
export async function blobUrlToDataUrl(blobUrl: string): Promise<string> {
  if (!blobUrl || blobUrl.startsWith('data:')) return blobUrl;
  if (!blobUrl.startsWith('blob:')) return blobUrl;
  try {
    const res = await fetch(blobUrl);
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string) || '');
      reader.onerror = () => reject(new Error('FileReader error'));
      reader.readAsDataURL(blob);
    });
  } catch {
    return '';
  }
}

/** Convert only blob: entries in a list; drop failures */
export async function convertBlobUrlsToDataUrls(urls: string[]): Promise<string[]> {
  const results = await Promise.all(
    urls.map(async (url) => (url.startsWith('blob:') ? blobUrlToDataUrl(url) : url))
  );
  return results.filter((url) => url.length > 0);
}

const MAX_IMAGE_WIDTH = 800;
const JPEG_QUALITY = 0.82;

/**
 * Resize/compress a data URL image to save space (localStorage).
 * If wider than maxWidth, scale down; re-encode as JPEG. On error return original.
 */
export async function compressDataUrl(dataUrl: string): Promise<string> {
  if (!dataUrl || !dataUrl.startsWith('data:image')) return dataUrl;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      if (w <= MAX_IMAGE_WIDTH && h <= MAX_IMAGE_WIDTH) {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(dataUrl);
            return;
          }
          ctx.drawImage(img, 0, 0);
          const out = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
          resolve(out || dataUrl);
        } catch {
          resolve(dataUrl);
        }
        return;
      }
      if (w > h) {
        h = Math.round((h * MAX_IMAGE_WIDTH) / w);
        w = MAX_IMAGE_WIDTH;
      } else {
        w = Math.round((w * MAX_IMAGE_WIDTH) / h);
        h = MAX_IMAGE_WIDTH;
      }
      try {
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const out = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
        resolve(out || dataUrl);
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/** Compress an array of data URLs */
export async function compressDataUrls(urls: string[]): Promise<string[]> {
  return Promise.all(urls.map((url) => compressDataUrl(url)));
}
