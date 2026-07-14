const LANGUAGE_KEY = 'app_language';

/** 25 languages (shell). UI translation rollout can gate on readiness later. */
export type AppLanguage =
  | 'en'
  | 'ko'
  | 'zh'
  | 'ja'
  | 'es'
  | 'pt'
  | 'fr'
  | 'de'
  | 'id'
  | 'vi'
  | 'th'
  | 'hi'
  | 'ar'
  | 'ru'
  | 'tr'
  | 'it'
  | 'pl'
  | 'nl'
  | 'fil'
  | 'uk'
  | 'bn'
  | 'ms'
  | 'sw'
  | 'fa'
  | 'ur';

export type LanguageOption = {
  value: AppLanguage;
  code: string;
};

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { value: 'en', code: 'EN' },
  { value: 'ko', code: 'KO' },
  { value: 'zh', code: 'ZH' },
  { value: 'ja', code: 'JA' },
  { value: 'es', code: 'ES' },
  { value: 'pt', code: 'PT' },
  { value: 'fr', code: 'FR' },
  { value: 'de', code: 'DE' },
  { value: 'id', code: 'ID' },
  { value: 'vi', code: 'VI' },
  { value: 'th', code: 'TH' },
  { value: 'hi', code: 'HI' },
  { value: 'ar', code: 'AR' },
  { value: 'ru', code: 'RU' },
  { value: 'tr', code: 'TR' },
  { value: 'it', code: 'IT' },
  { value: 'pl', code: 'PL' },
  { value: 'nl', code: 'NL' },
  { value: 'fil', code: 'FIL' },
  { value: 'uk', code: 'UK' },
  { value: 'bn', code: 'BN' },
  { value: 'ms', code: 'MS' },
  { value: 'sw', code: 'SW' },
  { value: 'fa', code: 'FA' },
  { value: 'ur', code: 'UR' },
];

const SUPPORTED = new Set<string>(LANGUAGE_OPTIONS.map((o) => o.value));

export function getAppLanguage(): AppLanguage {
  try {
    const saved = localStorage.getItem(LANGUAGE_KEY);
    if (saved && SUPPORTED.has(saved)) {
      return saved as AppLanguage;
    }
  } catch {
    /* ignore */
  }
  return 'en';
}

export function setAppLanguage(lang: AppLanguage): void {
  localStorage.setItem(LANGUAGE_KEY, lang);
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lang === 'fil' ? 'fil' : lang;
  }
  window.dispatchEvent(new Event('languageChanged'));
  // Refresh place label into the newly selected language when coords exist
  void import('@/utils/geoLocation').then(({ refreshRegionForLanguage }) => {
    void refreshRegionForLanguage(lang);
  });
}

export function labelAppLanguage(lang: AppLanguage): string {
  return LANGUAGE_OPTIONS.find((o) => o.value === lang)?.code ?? 'EN';
}

/** BCP 47 locale for Date#toLocaleDateString / toLocaleString */
export function localeForAppLanguage(lang: AppLanguage = getAppLanguage()): string {
  switch (lang) {
    case 'zh':
      return 'zh-CN';
    case 'fil':
      return 'fil-PH';
    default:
      return lang;
  }
}
