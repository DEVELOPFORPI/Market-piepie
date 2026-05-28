/** For img src: blob URLs become placeholder to avoid broken images after reload */
export function getDisplayImageUrl(url: string | undefined): string {
  if (!url) return '/placeholder.jpg';
  if (url.startsWith('blob:')) return '/placeholder.jpg';
  return url;
}
