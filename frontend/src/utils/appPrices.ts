import { useEffect, useState } from 'react';
import { ACTIVITY_BADGE_DEFINITIONS, getActivityBadgePricePi } from '@/constants/activityBadges';
import { api } from '@/utils/api';

export const DEFAULT_SIGNUP_FEE_PI = 3.14;

export type AppPrices = {
  signupFee: number;
  badges: Record<string, number>;
};

function defaultBadges(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const badge of ACTIVITY_BADGE_DEFINITIONS) out[badge.id] = badge.pricePi;
  return out;
}

let cache: AppPrices = {
  signupFee: DEFAULT_SIGNUP_FEE_PI,
  badges: defaultBadges(),
};

export function getCachedAppPrices(): AppPrices {
  return cache;
}

export function getSignupFeePi(): number {
  return cache.signupFee;
}

export function getLiveBadgePricePi(id: string): number | null {
  if (typeof cache.badges[id] === 'number') return cache.badges[id];
  return getActivityBadgePricePi(id);
}

export function setCachedAppPrices(next: AppPrices): void {
  cache = {
    signupFee: next.signupFee,
    badges: { ...next.badges },
  };
}

export async function syncAppPricesFromDB(): Promise<AppPrices> {
  const res = await api.get<{ signupFee?: number; badges?: Record<string, number> }>('/api/prices');
  if (!res.ok || !res.data) return cache;
  const next: AppPrices = {
    signupFee: cache.signupFee,
    badges: { ...cache.badges },
  };
  if (typeof res.data.signupFee === 'number' && res.data.signupFee > 0) {
    next.signupFee = res.data.signupFee;
  }
  if (res.data.badges && typeof res.data.badges === 'object') {
    for (const [id, amount] of Object.entries(res.data.badges)) {
      if (typeof amount === 'number' && amount > 0) next.badges[id] = amount;
    }
  }
  cache = next;
  return cache;
}

export function useAppPrices(): AppPrices {
  const [prices, setPrices] = useState(getCachedAppPrices);
  useEffect(() => {
    void syncAppPricesFromDB().then(setPrices);
  }, []);
  return prices;
}
