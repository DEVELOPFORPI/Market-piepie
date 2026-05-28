import { API_BASE } from '@/utils/apiConfig';
import { ensureImplicitSession, getSessionToken } from '@/utils/authStorage';
import { getAdminPassword } from '@/utils/adminAccessStorage';

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

async function authHeaders(options?: UploadImageOptions): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};

  if (options?.admin) {
    const adminPassword = getAdminPassword();
    if (adminPassword) headers['x-admin-password'] = adminPassword;
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
  if (!file.type.startsWith('image/')) {
    throw new Error('Only image files can be uploaded');
  }

  const formData = new FormData();
  formData.append('image', file);
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
