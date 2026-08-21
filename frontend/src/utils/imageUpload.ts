import { API_BASE } from '@/utils/apiConfig';
import { ensureImplicitSession, getSessionToken } from '@/utils/authStorage';
import { getAdminToken } from '@/utils/adminAccessStorage';

type UploadImageOptions = {
  folder?: string;
  admin?: boolean;
};

type UploadImageResponse = {
  ok?: boolean;
  url?: string;
  key?: string;
  error?: string;
};

function fileNameForMime(mimeType: string): string {
  const ext =
    mimeType === 'image/png' ? 'png' :
    mimeType === 'image/webp' ? 'webp' :
    mimeType === 'image/gif' ? 'gif' :
    mimeType === 'image/avif' ? 'avif' :
    'jpg';
  return `upload-${Date.now()}.${ext}`;
}

function dataUrlToFile(dataUrl: string): File {
  const [header, payload = ''] = dataUrl.split(',');
  const mimeMatch = header.match(/^data:([^;]+);base64$/);
  const mimeType = mimeMatch?.[1] || 'image/jpeg';
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new File([bytes], fileNameForMime(mimeType), { type: mimeType });
}

async function blobUrlToFile(blobUrl: string): Promise<File> {
  const res = await fetch(blobUrl);
  if (!res.ok) throw new Error('Could not load local image');
  const blob = await res.blob();
  return new File([blob], fileNameForMime(blob.type), { type: blob.type || 'image/jpeg' });
}

const MAX_IMAGE_EDGE = 1920;
const JPEG_QUALITY = 0.82;

function scaledSize(width: number, height: number): { width: number; height: number } {
  const edge = Math.max(width, height);
  if (edge <= MAX_IMAGE_EDGE) return { width, height };
  const scale = MAX_IMAGE_EDGE / edge;
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}

function canvasToJpegBlob(source: CanvasImageSource, width: number, height: number): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new Error('Could not process image'));
  ctx.drawImage(source, 0, 0, width, height);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not encode image'))),
      'image/jpeg',
      JPEG_QUALITY,
    );
  });
}

function loadHtmlImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read image'));
    };
    img.src = url;
  });
}

async function prepareImageForUpload(file: File): Promise<File> {
  if (file.type === 'image/gif') return file;

  let width = 0;
  let height = 0;
  let blob: Blob | null = null;

  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      ({ width, height } = scaledSize(bitmap.width, bitmap.height));
      blob = await canvasToJpegBlob(bitmap, width, height);
      bitmap.close();
    } catch {
      blob = null;
    }
  }

  if (!blob) {
    const img = await loadHtmlImage(file);
    ({ width, height } = scaledSize(img.naturalWidth || img.width, img.naturalHeight || img.height));
    blob = await canvasToJpegBlob(img, width, height);
  }

  return new File([blob], fileNameForMime('image/jpeg'), { type: 'image/jpeg' });
}

async function authHeaders(options?: UploadImageOptions): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};

  if (options?.admin) {
    const adminToken = getAdminToken();
    if (adminToken) headers['x-admin-token'] = adminToken;
  }

  await ensureImplicitSession();
  const token = getSessionToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  return headers;
}

export async function uploadImageToR2(
  file: File,
  options?: UploadImageOptions,
): Promise<string> {
  if (file.type && !file.type.startsWith('image/')) {
    throw new Error('Only image files can be uploaded');
  }

  const prepared = await prepareImageForUpload(file);

  const formData = new FormData();
  formData.append('image', prepared);
  if (options?.folder) formData.append('folder', options.folder);

  const res = await fetch(`${API_BASE}/api/uploads/image`, {
    method: 'POST',
    headers: await authHeaders(options),
    body: formData,
  });
  const data = await res.json().catch(() => null) as UploadImageResponse | null;

  if (!res.ok || !data?.url) {
    throw new Error(data?.error || `Image upload failed (${res.status})`);
  }

  return data.url;
}

export function createLocalPreviewUrls(files: File[]): string[] {
  return files
    .filter((file) => !file.type || file.type.startsWith('image/'))
    .map((file) => URL.createObjectURL(file));
}

export function revokeLocalPreviewUrl(url: string | undefined): void {
  if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
}

export async function uploadImagesToR2(
  files: File[],
  options?: UploadImageOptions,
): Promise<string[]> {
  return Promise.all(files.map((file) => uploadImageToR2(file, options)));
}

export async function uploadImageReferenceToR2(
  image: string,
  options?: UploadImageOptions,
): Promise<string> {
  if (!image || image.startsWith('http://') || image.startsWith('https://') || image.startsWith('/')) {
    return image;
  }
  if (image.startsWith('data:image/')) {
    return uploadImageToR2(dataUrlToFile(image), options);
  }
  if (image.startsWith('blob:')) {
    return uploadImageToR2(await blobUrlToFile(image), options);
  }
  return image;
}

export async function uploadImageReferencesToR2(
  images: string[],
  options?: UploadImageOptions,
): Promise<string[]> {
  const uploaded = await Promise.all(images.map((image) => uploadImageReferenceToR2(image, options)));
  return uploaded.filter((image) => image.length > 0);
}
