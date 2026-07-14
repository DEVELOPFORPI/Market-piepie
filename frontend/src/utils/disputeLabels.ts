import { labelDisputeStoredValue } from '@/i18n/disputeValueMessages';
import type { AppLanguage } from '@/utils/languageStorage';

const REASON_KEYS = [
  'Listing mismatch',
  'Not received',
  'Damaged item',
  'Seller no-show',
  'Buyer no-show',
  'Buyer not responding',
  'Payment not received',
  'Bad-faith behavior',
  'Other',
] as const;

/** Localize auto dispute post title: `[Dispute] … - Seller no-show` → selected language. */
export function localizeDisputePostTitle(
  lang: AppLanguage,
  title: string,
  categoryLabel: string,
): string {
  let out = title.replace(/^\[Dispute\]\s*/i, `[${categoryLabel}] `);
  for (const key of REASON_KEYS) {
    const suffix = ` - ${key}`;
    if (out.endsWith(suffix)) {
      return `${out.slice(0, -suffix.length)} - ${labelDisputeStoredValue(lang, key)}`;
    }
  }
  return out;
}

export { labelDisputeStoredValue };
