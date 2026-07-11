/**
 * IP-based rough location (city/region), not country-specific.
 * Multiple free APIs with fallback for 403/CORS.
 */

const UNKNOWN_REGION = 'Unknown';

type NominatimAddress = {
  neighbourhood?: string;
  suburb?: string;
  quarter?: string;
  hamlet?: string;
  village?: string;
  borough?: string;
  city_district?: string;
  district?: string;
  county?: string;
  city?: string;
  town?: string;
  municipality?: string;
  state?: string;
  state_district?: string;
  country?: string;
};

function pickFirst(...values: (string | undefined)[]): string | undefined {
  for (const v of values) {
    const t = v?.trim();
    if (t) return t;
  }
  return undefined;
}

function normalizeToken(value: string): string {
  return value.toLowerCase().replace(/[\s,.-]+/g, '');
}

function includesPart(haystack: string, needle: string): boolean {
  const h = normalizeToken(haystack);
  const n = normalizeToken(needle);
  return h.includes(n) || n.includes(h);
}

/** Neighbourhood / block level — too granular for trade area */
function isNeighbourhoodLevel(name: string): boolean {
  const n = name.trim();
  if (!n) return true;
  if (/동$/.test(n)) return true;
  if (/-dong$/i.test(n)) return true;
  if (/\bdong\b/i.test(n) && n.length <= 12) return true;
  return false;
}

/** District / county level — skip neighbourhood-sized borough names */
function pickDistrict(address: NominatimAddress): string | undefined {
  const candidates = [
    address.city_district,
    address.county,
    address.district,
    address.borough,
    address.state_district,
  ];
  for (const c of candidates) {
    const t = c?.trim();
    if (t && !isNeighbourhoodLevel(t)) return t;
  }
  return undefined;
}

/** City + district/state label for consistent global trade area display */
export function normalizeRegionLabel(parts: {
  district?: string;
  city?: string;
  state?: string;
  country?: string;
}): string | null {
  const district = parts.district?.trim();
  const city = parts.city?.trim();
  const state = parts.state?.trim();
  const country = parts.country?.trim();

  if (district && city) {
    if (includesPart(district, city)) return district;
    return `${district}, ${city}`;
  }
  if (district && state) {
    if (includesPart(district, state)) return district;
    return `${district}, ${state}`;
  }
  if (city && state) {
    if (includesPart(city, state)) return city;
    return `${city}, ${state}`;
  }
  if (district) return district;
  if (city) return city;
  if (state) return state;
  if (country) return country;
  return null;
}

function normalizeRegionFromNominatimAddress(address: NominatimAddress | undefined): string | null {
  if (!address) return null;
  return normalizeRegionLabel({
    district: pickDistrict(address),
    city: pickFirst(address.city, address.town, address.municipality),
    state: address.state,
    country: address.country,
  });
}

// Free IP geolocation APIs (try next on failure)
const IP_APIS = [
  {
    url: 'https://ipapi.co/json/',
    parser: (data: { city?: string; region?: string; country_name?: string }) =>
      normalizeRegionLabel({
        city: data.city,
        state: data.region,
        country: data.country_name,
      }),
  },
  {
    url: 'https://freeipapi.com/api/json',
    parser: (data: { cityName?: string; regionName?: string; countryName?: string }) =>
      normalizeRegionLabel({
        city: data.cityName,
        state: data.regionName,
        country: data.countryName,
      }),
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
          const region = normalizeRegionFromNominatimAddress(data.address as NominatimAddress);

          resolve(region ? { region } : null);
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
