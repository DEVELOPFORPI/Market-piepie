import { userKey } from '@/utils/authStorage';

const BASE_KEY = 'userRegion';

/** Save selected region */
export const saveRegion = (region: string) => {
  localStorage.setItem(userKey(BASE_KEY), region);
};

/** Load saved region */
export const getRegion = (): string => {
  return localStorage.getItem(userKey(BASE_KEY)) || '';
};

/** Clear saved region */
export const clearRegion = () => {
  localStorage.removeItem(userKey(BASE_KEY));
};
