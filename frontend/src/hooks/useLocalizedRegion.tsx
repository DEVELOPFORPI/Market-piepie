import React, { useEffect, useState } from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import { localizeRegionForDisplay } from '@/utils/geoLocation';

/** Show stored region, then swap to a label in the selected language when possible. */
export function useLocalizedRegion(
  region?: string | null,
  latitude?: number | null,
  longitude?: number | null,
): string {
  const { lang } = useLanguage();
  const fallback = region?.trim() || '';
  const [label, setLabel] = useState(fallback);

  useEffect(() => {
    setLabel(fallback);
    if (!fallback && (latitude == null || longitude == null)) return;

    let cancelled = false;
    void localizeRegionForDisplay({ region: fallback, latitude, longitude, lang }).then(
      (resolved) => {
        if (!cancelled && resolved) setLabel(resolved);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [fallback, latitude, longitude, lang]);

  return label || fallback;
}

/** For lists/maps where a hook can't be called inline. */
export const LocalizedRegionText: React.FC<{
  region?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}> = ({ region, latitude, longitude }) => {
  const label = useLocalizedRegion(region, latitude, longitude);
  return <>{label}</>;
};
