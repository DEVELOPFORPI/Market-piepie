/**
 * IP-based rough location (city/region), not country-specific.
 * Multiple free APIs with fallback for 403/CORS.
 */

const UNKNOWN_REGION = 'Unknown';

// Free IP geolocation APIs (try next on failure)
const IP_APIS = [
  {
    url: 'https://ipapi.co/json/',
    parser: (data: { city?: string; region?: string; country_name?: string }) =>
      data.city || data.region || data.country_name,
  },
  {
    url: 'https://freeipapi.com/api/json',
    parser: (data: { cityName?: string; regionName?: string; countryName?: string }) =>
      data.cityName || data.regionName || data.countryName,
  },
];

/** Resolve region label via IP; null if all APIs fail */
export async function detectLocationByIp(): Promise<{ region: string } | null> {
  for (const api of IP_APIS) {
    try {
      const res = await fetch(api.url, {
        signal: AbortSignal.timeout(5000),
        mode: 'cors',
      });
      if (!res.ok) continue;

      const data = await res.json();
      const region = api.parser(data);

      if (region && region !== UNKNOWN_REGION) {
        return { region };
      }
    } catch {
      continue;
    }
  }
  return null;
}

/** GPS via browser API; needs permission */
export async function detectLocationByGPS(): Promise<{ region: string } | null> {
  if (!navigator?.geolocation) {
    return null;
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;

        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=en`,
            {
              signal: AbortSignal.timeout(5000),
              headers: { 'User-Agent': 'MarketPiePie/1.0' },
            }
          );

          if (!response.ok) {
            resolve(null);
            return;
          }

          const data = await response.json();
          const address = data.address;

          const region =
            address?.borough ??
            address?.city ??
            address?.town ??
            address?.municipality ??
            address?.state ??
            address?.country ??
            UNKNOWN_REGION;

          resolve({ region });
        } catch {
          resolve(null);
        }
      },
      () => {
        resolve(null);
      },
      {
        timeout: 10000,
        enableHighAccuracy: false,
      }
    );
  });
}

/** Try GPS first, then IP */
export async function detectLocation(): Promise<{ region: string } | null> {
  const gpsResult = await detectLocationByGPS();
  if (gpsResult) return gpsResult;

  const ipResult = await detectLocationByIp();
  if (ipResult) return ipResult;

  return null;
}

/** Current lat/lon only (for distance filter) */
export function getCurrentCoordinates(): Promise<{ latitude: number; longitude: number } | null> {
  if (!navigator?.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      }),
      () => resolve(null),
      { timeout: 10000, enableHighAccuracy: false }
    );
  });
}

/** Haversine distance in km */
export function getDistanceKm(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export const NEARBY_RADIUS_KM = 10;
