/** Matches `profileStorage` default; file may be absent — UI shows silhouette instead */
export const DEFAULT_AVATAR_PATH = '/default-avatar.jpg';

export function isPlaceholderProfileImage(url: string | undefined | null): boolean {
  if (!url || !url.trim()) return true;
  if (url === DEFAULT_AVATAR_PATH) return true;
  return false;
}

/** Default profile circle when no photo / missing asset */
export function ProfilePersonSilhouetteIcon({
  className = 'w-10 h-10 text-gray-400',
}: {
  className?: string;
}) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
    </svg>
  );
}
