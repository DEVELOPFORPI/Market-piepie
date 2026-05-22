import { useState, useEffect } from 'react';
import {
  isPlaceholderProfileImage,
  ProfilePersonSilhouetteIcon,
} from '@/components/common/profileAvatarPlaceholder';
import { profileAvatarObjectClass } from '@/utils/profileStorage';

interface Props {
  /** Resolved avatar URL (e.g. from resolveProfileAvatarUrl). May be empty/placeholder. */
  src: string | undefined | null;
  alt?: string;
  /** Tailwind classes for the silhouette icon when no image. Defaults to filling parent. */
  iconClassName?: string;
  /** Override <img> class. Defaults to profileAvatarObjectClass(src). */
  imgClassName?: string;
}

/**
 * Renders a user profile <img>, but falls back to a person silhouette
 * when src is missing/default OR the image fails to load (e.g. /default-avatar.jpg
 * 404 in deploys without the asset).
 */
export function UserAvatarImage({ src, alt = '', iconClassName, imgClassName }: Props) {
  const isPlaceholder = isPlaceholderProfileImage(src);
  const [failed, setFailed] = useState(false);

  // Reset error state when src changes
  useEffect(() => { setFailed(false); }, [src]);

  if (isPlaceholder || failed) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-200">
        <ProfilePersonSilhouetteIcon className={iconClassName ?? 'w-3/5 h-3/5 text-gray-500'} />
      </div>
    );
  }

  return (
    <img
      src={src ?? ''}
      alt={alt}
      className={imgClassName ?? profileAvatarObjectClass(src)}
      onError={() => setFailed(true)}
    />
  );
}
