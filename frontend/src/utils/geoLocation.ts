/**
 * IP-based rough location (city/region), not country-specific.
 * Multiple free APIs with fallback for 403/CORS.
 */

import { getAppLanguage, type AppLanguage } from '@/utils/languageStorage';
import {
  getRegion,
  getRegionCoords,
  saveRegion,
  type RegionCoords,
} from '@/utils/regionStorage';

export type DetectedLocation = { region: string; coords?: RegionCoords };

const UNKNOWN_REGION = 'Unknown';

/** Map app locale → Nominatim / Accept-Language */
function toGeocodeLanguage(lang: AppLanguage): string {
  switch (lang) {
    case 'zh':
      return 'zh-CN';
    case 'fil':
      return 'tl';
    default:
      return lang;
  }
}

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

type NominatimAddressWithCode = NominatimAddress & { country_code?: string };

function alreadyHasAdminUnit(label: string): boolean {
  return (
    /[시군구동읍면]$/.test(label) ||
    /광역시$/.test(label) ||
    /특별시$/.test(label) ||
    /특별자치시$/.test(label) ||
    /-si\b/i.test(label) ||
    /-gu\b/i.test(label) ||
    /-gun\b/i.test(label) ||
    /-do\b/i.test(label) ||
    /\bmetropolitan\b/i.test(label)
  );
}

function isSouthKorea(address: NominatimAddressWithCode): boolean {
  const cc = address.country_code?.toLowerCase();
  if (cc === 'kr') return true;
  return /대한민국|한국|South Korea|Korea, Republic|Republic of Korea/i.test(address.country || '');
}

function normalizeRegionFromNominatimAddress(address: NominatimAddress | undefined): string | null {
  if (!address) return null;
  const addr = address as NominatimAddressWithCode;
  const label = normalizeRegionLabel({
    district: pickDistrict(addr),
    city: pickFirst(addr.city, addr.town, addr.municipality),
    state: addr.state,
    country: addr.country,
  });
  if (!label || alreadyHasAdminUnit(label)) return label;

  // City-only KR labels often come back as "Gwangju" / "광주" without 시 — unify to …-si / …시
  const city = pickFirst(addr.city, addr.town, addr.municipality)?.trim();
  if (isSouthKorea(addr) && city && label === city) {
    const latin = /^[\x00-\x7F]+$/.test(label.replace(/[\s,.-]/g, ''));
    return latin ? `${label}-si` : `${label}시`;
  }
  return label;
}

function acceptLanguageHeader(lang: AppLanguage): string {
  const locale = toGeocodeLanguage(lang);
  // Nominatim follows this preference order. If the selected locale has no
  // translated place name, request English before its local/native default.
  return locale === 'en' ? 'en' : `${locale},en;q=0.9`;
}

async function reverseGeocode(
  latitude: number,
  longitude: number,
  lang: AppLanguage = getAppLanguage(),
): Promise<string | null> {
  const acceptLanguage = acceptLanguageHeader(lang);
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=${encodeURIComponent(acceptLanguage)}`,
      {
        signal: AbortSignal.timeout(5000),
        headers: {
          'User-Agent': 'MarketPiePie/1.0',
          'Accept-Language': acceptLanguage,
        },
      },
    );
    if (!response.ok) return null;
    const data = await response.json();
    return normalizeRegionFromNominatimAddress(data.address as NominatimAddress);
  } catch {
    return null;
  }
}

/** Forward-geocode a stored region string, then pick a label in `lang`. */
async function searchRegionLabel(
  query: string,
  lang: AppLanguage,
): Promise<string | null> {
  const q = query.trim();
  if (!q) return null;
  const acceptLanguage = acceptLanguageHeader(lang);
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=1&q=${encodeURIComponent(q)}&accept-language=${encodeURIComponent(acceptLanguage)}`,
      {
        signal: AbortSignal.timeout(5000),
        headers: {
          'User-Agent': 'MarketPiePie/1.0',
          'Accept-Language': acceptLanguage,
        },
      },
    );
    if (!response.ok) return null;
    const data = (await response.json()) as Array<{ address?: NominatimAddress }>;
    const first = data[0];
    if (!first?.address) return null;
    return normalizeRegionFromNominatimAddress(first.address);
  } catch {
    return null;
  }
}

const regionDisplayCache = new Map<string, string>();
const regionDisplayInflight = new Map<string, Promise<string | null>>();

/**
 * Nominatim often drops KR admin suffixes (광주/Gwangju vs 광주시/Gwangju-si).
 * Restore them from the stored label when the re-labeled name lost that unit.
 */
export function preserveAdminUnitSuffix(
  original: string | null | undefined,
  localized: string,
): string {
  const src = original?.trim() || '';
  let out = localized.trim();
  if (!out || !src) return out;

  const latin = /^[\x00-\x7F]+$/.test(out.replace(/[\s,.-]/g, ''));
  if (alreadyHasAdminUnit(out)) return out;

  if (/광역시$/.test(src) || /특별시$/.test(src) || /특별자치시$/.test(src) || /시$/.test(src)) {
    return latin ? `${out}-si` : `${out}시`;
  }
  if (/구$/.test(src)) return latin ? `${out}-gu` : `${out}구`;
  if (/군$/.test(src)) return latin ? `${out}-gun` : `${out}군`;
  if (/도$/.test(src)) return latin ? `${out}-do` : `${out}도`;
  return out;
}

/**
 * Re-label a listing/post region for the current UI language.
 * Prefers lat/lon reverse geocode; falls back to searching the stored name.
 */
export async function localizeRegionForDisplay(
  opts: {
    region?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    lang?: AppLanguage;
  },
): Promise<string | null> {
  const lang = opts.lang ?? getAppLanguage();
  const region = opts.region?.trim() || '';
  const lat = opts.latitude;
  const lon = opts.longitude;
  const hasCoords =
    typeof lat === 'number' &&
    typeof lon === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lon);

  // v2: admin-suffix preservation (avoid stale cache without 시/-si)
  const cacheKey = hasCoords
    ? `c2:${lat!.toFixed(4)},${lon!.toFixed(4)}:${lang}:${region.toLowerCase()}`
    : region
      ? `n2:${region.toLowerCase()}:${lang}`
      : '';
  if (!cacheKey) return region || null;

  const cached = regionDisplayCache.get(cacheKey);
  if (cached) return cached;

  const existing = regionDisplayInflight.get(cacheKey);
  if (existing) return existing;

  const promise = (async () => {
    let resolved: string | null = null;
    if (hasCoords) {
      resolved = await reverseGeocode(lat!, lon!, lang);
    }
    if (!resolved && region) {
      resolved = await searchRegionLabel(region, lang);
    }
    if (resolved) {
      resolved = preserveAdminUnitSuffix(region, resolved);
      regionDisplayCache.set(cacheKey, resolved);
    }
    return resolved;
  })().finally(() => {
    regionDisplayInflight.delete(cacheKey);
  });

  regionDisplayInflight.set(cacheKey, promise);
  return promise;
}

// Free IP geolocation APIs (try next on failure)
const IP_APIS = [
  {
    url: 'https://ipapi.co/json/',
    parser: (data: {
      city?: string;
      region?: string;
      country_name?: string;
      latitude?: number;
      longitude?: number;
    }) => ({
      region: normalizeRegionLabel({
        city: data.city,
        state: data.region,
        country: data.country_name,
      }),
      latitude: typeof data.latitude === 'number' ? data.latitude : undefined,
      longitude: typeof data.longitude === 'number' ? data.longitude : undefined,
    }),
  },
  {
    url: 'https://freeipapi.com/api/json',
    parser: (data: {
      cityName?: string;
      regionName?: string;
      countryName?: string;
      latitude?: number;
      longitude?: number;
    }) => ({
      region: normalizeRegionLabel({
        city: data.cityName,
        state: data.regionName,
        country: data.countryName,
      }),
      latitude: typeof data.latitude === 'number' ? data.latitude : undefined,
      longitude: typeof data.longitude === 'number' ? data.longitude : undefined,
    }),
  },
];

/** Resolve region label via IP; null if all APIs fail */
export async function detectLocationByIp(
  lang: AppLanguage = getAppLanguage(),
): Promise<DetectedLocation | null> {
  for (const api of IP_APIS) {
    try {
      const res = await fetch(api.url, {
        signal: AbortSignal.timeout(5000),
        mode: 'cors',
      });
      if (!res.ok) continue;

      const data = await res.json();
      const parsed = api.parser(data);

      if (parsed.latitude != null && parsed.longitude != null) {
        const coords = { latitude: parsed.latitude, longitude: parsed.longitude };
        const localized = await reverseGeocode(coords.latitude, coords.longitude, lang);
        if (localized && localized !== UNKNOWN_REGION) {
          return { region: localized, coords };
        }
      }

      if (parsed.region && parsed.region !== UNKNOWN_REGION) {
        return { region: parsed.region };
      }
    } catch {
      continue;
    }
  }
  return null;
}

/** GPS via browser API; needs permission */
export async function detectLocationByGPS(
  lang: AppLanguage = getAppLanguage(),
): Promise<DetectedLocation | null> {
  if (!navigator?.geolocation) {
    return null;
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const coords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        const region = await reverseGeocode(coords.latitude, coords.longitude, lang);
        resolve(region ? { region, coords } : null);
      },
      () => {
        resolve(null);
      },
      {
        timeout: 10000,
        enableHighAccuracy: false,
      },
    );
  });
}

/** Try GPS first, then IP — labels follow the selected app language */
export async function detectLocation(
  lang: AppLanguage = getAppLanguage(),
): Promise<DetectedLocation | null> {
  const gpsResult = await detectLocationByGPS(lang);
  if (gpsResult) return gpsResult;

  const ipResult = await detectLocationByIp(lang);
  if (ipResult) return ipResult;

  return null;
}

/** Re-label stored region into the new app language (needs saved GPS/IP coords) */
export async function refreshRegionForLanguage(
  lang: AppLanguage = getAppLanguage(),
): Promise<boolean> {
  const coords = getRegionCoords();
  if (!coords) return false;
  const previous = getRegion();
  const region = await reverseGeocode(coords.latitude, coords.longitude, lang);
  if (!region) return false;
  return saveRegion(preserveAdminUnitSuffix(previous, region), coords);
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
