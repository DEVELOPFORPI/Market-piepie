/** img src. blob: is a local form preview and stays valid until revoked. */
export function getDisplayImageUrl(url: string | undefined): string {
  if (!url) return '/placeholder.jpg';
  return url;
}
