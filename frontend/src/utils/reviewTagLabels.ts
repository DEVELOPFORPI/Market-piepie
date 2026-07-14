import { accountT, type AccountMessageKey } from '@/i18n/accountMessages';
import { getAppLanguage, type AppLanguage } from '@/utils/languageStorage';

const TAG_KEYS: Record<string, AccountMessageKey> = {
  'Quick response': 'tagQuickResponse',
  'On time': 'tagOnTime',
  Kind: 'tagKind',
  'As described': 'tagAsDescribed',
  Recommend: 'tagRecommend',
};

export function labelReviewTag(tag: string, lang: AppLanguage = getAppLanguage()): string {
  const key = TAG_KEYS[tag];
  return key ? accountT(lang, key) : tag;
}
