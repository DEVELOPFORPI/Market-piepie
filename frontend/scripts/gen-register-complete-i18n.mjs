import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const LANGS = [
  'en', 'ko', 'zh', 'ja', 'es', 'pt', 'fr', 'de', 'id', 'vi', 'th', 'hi', 'ar', 'ru', 'tr',
  'it', 'pl', 'nl', 'fil', 'uk', 'bn', 'ms', 'sw', 'fa', 'ur',
];

/** @type {Record<string, Record<string, string>>} */
const entries = {
  publishedTitle: {
    en: 'Published', ko: '등록 완료', zh: '已发布', ja: '掲載完了',
    es: 'Publicado', pt: 'Publicado', fr: 'Publié', de: 'Veröffentlicht',
    id: 'Dipublikasikan', vi: 'Đã đăng', th: 'เผยแพร่แล้ว', hi: 'प्रकाशित',
    ar: 'تم النشر', ru: 'Опубликовано', tr: 'Yayınlandı', it: 'Pubblicato',
    pl: 'Opublikowano', nl: 'Gepubliceerd', fil: 'Nai-publish', uk: 'Опубліковано',
    bn: 'প্রকাশিত', ms: 'Diterbitkan', sw: 'Imechapishwa', fa: 'منتشر شد',
    ur: 'شائع ہو گیا',
  },
  listingPublished: {
    en: 'Listing published', ko: '상품이 등록되었습니다', zh: '商品已发布', ja: '出品が掲載されました',
    es: 'Anuncio publicado', pt: 'Anúncio publicado', fr: 'Annonce publiée', de: 'Anzeige veröffentlicht',
    id: 'Listing dipublikasikan', vi: 'Tin đăng đã được đăng', th: 'เผยแพร่ประกาศแล้ว', hi: 'लिस्टिंग प्रकाशित',
    ar: 'تم نشر الإعلان', ru: 'Объявление опубликовано', tr: 'İlan yayınlandı', it: 'Annuncio pubblicato',
    pl: 'Ogłoszenie opublikowane', nl: 'Advertentie gepubliceerd', fil: 'Nai-publish ang listing', uk: 'Оголошення опубліковано',
    bn: 'লিস্টিং প্রকাশিত', ms: 'Listing diterbitkan', sw: 'Tangazo limechapishwa', fa: 'آگهی منتشر شد',
    ur: 'لسٹنگ شائع ہو گئی',
  },
  listingVisibleHint: {
    en: 'Your listing is visible in the marketplace.',
    ko: '등록한 상품이 마켓에 공개되었습니다.',
    zh: '你的商品已在市场中显示。',
    ja: '出品がマーケットに表示されています。',
    es: 'Tu anuncio es visible en el mercado.',
    pt: 'Seu anúncio está visível no marketplace.',
    fr: 'Votre annonce est visible sur le marché.',
    de: 'Deine Anzeige ist im Marktplatz sichtbar.',
    id: 'Listing Anda terlihat di marketplace.',
    vi: 'Tin đăng của bạn đã hiện trên marketplace.',
    th: 'ประกาศของคุณปรากฏในตลาดแล้ว',
    hi: 'आपकी लिस्टिंग मार्केटप्लेस में दिख रही है।',
    ar: 'إعلانك ظاهر في السوق.',
    ru: 'Ваше объявление видно на площадке.',
    tr: 'İlanınız pazarda görünür.',
    it: 'Il tuo annuncio è visibile nel marketplace.',
    pl: 'Twoje ogłoszenie jest widoczne na marketplace.',
    nl: 'Je advertentie is zichtbaar op de marktplaats.',
    fil: 'Visible na ang listing mo sa marketplace.',
    uk: 'Ваше оголошення видно на маркетплейсі.',
    bn: 'আপনার লিস্টিং মার্কেটপ্লেসে দৃশ্যমান।',
    ms: 'Listing anda kelihatan di marketplace.',
    sw: 'Tangazo lako linaonekana kwenye soko.',
    fa: 'آگهی شما در مارکت‌پلیس دیده می‌شود.',
    ur: 'آپ کی لسٹنگ مارکیٹ پلیس میں نظر آ رہی ہے۔',
  },
  yourListingFallback: {
    en: 'Your listing', ko: '내 상품', zh: '你的商品', ja: 'あなたの出品',
    es: 'Tu anuncio', pt: 'Seu anúncio', fr: 'Votre annonce', de: 'Deine Anzeige',
    id: 'Listing Anda', vi: 'Tin đăng của bạn', th: 'ประกาศของคุณ', hi: 'आपकी लिस्टिंग',
    ar: 'إعلانك', ru: 'Ваше объявление', tr: 'İlanınız', it: 'Il tuo annuncio',
    pl: 'Twoje ogłoszenie', nl: 'Jouw advertentie', fil: 'Iyong listing', uk: 'Ваше оголошення',
    bn: 'আপনার লিস্টিং', ms: 'Listing anda', sw: 'Tangazo lako', fa: 'آگهی شما',
    ur: 'آپ کی لسٹنگ',
  },
  tipsHeading: {
    en: 'Tips', ko: '팁', zh: '小贴士', ja: 'ヒント',
    es: 'Consejos', pt: 'Dicas', fr: 'Conseils', de: 'Tipps',
    id: 'Tips', vi: 'Mẹo', th: 'เคล็ดลับ', hi: 'टिप्स',
    ar: 'نصائح', ru: 'Советы', tr: 'İpuçları', it: 'Suggerimenti',
    pl: 'Wskazówki', nl: 'Tips', fil: 'Mga tip', uk: 'Поради',
    bn: 'টিপস', ms: 'Petua', sw: 'Vidokezo', fa: 'نکات',
    ur: 'ٹپس',
  },
  tipClearPhotos: {
    en: 'Clear photos get more views',
    ko: '선명한 사진이 조회수를 높여 줍니다',
    zh: '清晰照片能获得更多浏览',
    ja: '鮮明な写真は閲覧が増えます',
    es: 'Fotos claras reciben más visitas',
    pt: 'Fotos nítidas geram mais visualizações',
    fr: 'Des photos nettes attirent plus de vues',
    de: 'Klare Fotos bringen mehr Aufrufe',
    id: 'Foto jelas mendapat lebih banyak tayangan',
    vi: 'Ảnh rõ giúp nhiều người xem hơn',
    th: 'รูปคมชัดช่วยให้มียอดดูมากขึ้น',
    hi: 'साफ़ फ़ोटो से ज़्यादा व्यू मिलते हैं',
    ar: 'الصور الواضحة تحصل على مزيد من المشاهدات',
    ru: 'Чёткие фото получают больше просмотров',
    tr: 'Net fotoğraflar daha çok görüntü alır',
    it: 'Foto nitide ottengono più visualizzazioni',
    pl: 'Wyraźne zdjęcia zbierają więcej wyświetleń',
    nl: 'Duidelijke foto’s krijgen meer weergaven',
    fil: 'Mas maraming views ang malinaw na larawan',
    uk: 'Чіткі фото отримують більше переглядів',
    bn: 'স্পষ্ট ছবি বেশি ভিউ পায়',
    ms: 'Foto jelas dapat lebih banyak tontonan',
    sw: 'Picha wazi hupata maonyesho zaidi',
    fa: 'عکس‌های واضح بازدید بیشتری می‌گیرند',
    ur: 'صاف فوٹوز کو زیادہ ویوز ملتے ہیں',
  },
  tipAccurateDesc: {
    en: 'Accurate descriptions close deals faster',
    ko: '정확한 설명이 거래를 더 빠르게 합니다',
    zh: '准确描述能更快成交',
    ja: '正確な説明は成約が早くなります',
    es: 'Descripciones precisas cierran tratos más rápido',
    pt: 'Descrições precisas fecham negócios mais rápido',
    fr: 'Des descriptions précises concluent plus vite',
    de: 'Genaue Beschreibungen schließen schneller ab',
    id: 'Deskripsi akurat mempercepat kesepakatan',
    vi: 'Mô tả chính xác giúp chốt giao dịch nhanh hơn',
    th: 'คำอธิบายแม่นยำช่วยปิดการซื้อขายได้เร็วขึ้น',
    hi: 'सटीक विवरण से सौदा जल्दी होता है',
    ar: 'الوصف الدقيق يُنجز الصفقات أسرع',
    ru: 'Точные описания быстрее приводят к сделке',
    tr: 'Doğru açıklamalar anlaşmayı hızlandırır',
    it: 'Descrizioni precise chiudono prima gli affari',
    pl: 'Dokładne opisy szybciej zamykają transakcje',
    nl: 'Nauwkeurige omschrijvingen sluiten sneller af',
    fil: 'Mas mabilis mag-deal ang tumpak na deskripsyon',
    uk: 'Точні описи швидше закривають угоди',
    bn: 'সঠিক বিবরণে দ্রুত চুক্তি হয়',
    ms: 'Penerangan tepat Tutup urus niaga lebih cepat',
    sw: 'Maelezo sahihi hufunga biashara haraka',
    fa: 'توضیح دقیق معامله را زودتر می‌بندد',
    ur: 'درست تفصیل سے سودا جلدی ہوتا ہے',
  },
  tipSameDay: {
    en: 'Same-day trade can attract more interest',
    ko: '당일 거래 가능하면 관심이 더 모일 수 있습니다',
    zh: '当日可交易能吸引更多关注',
    ja: '即日取引可能だと関心が増えることがあります',
    es: 'El intercambio el mismo día atrae más interés',
    pt: 'Negócio no mesmo dia atrai mais interesse',
    fr: 'L’échange le jour même attire plus d’intérêt',
    de: 'Same-Day-Handel kann mehr Interesse wecken',
    id: 'Transaksi hari ini bisa menarik lebih banyak minat',
    vi: 'Giao dịch trong ngày có thể thu hút thêm quan tâm',
    th: 'เทรดวันเดียวกันช่วยดึงความสนใจได้มากขึ้น',
    hi: 'उसी दिन का व्यापार अधिक रुचि ला सकता है',
    ar: 'التداول في نفس اليوم قد يجذب اهتمامًا أكبر',
    ru: 'Сделка в тот же день может привлечь больше интереса',
    tr: 'Aynı gün ticaret daha fazla ilgi çekebilir',
    it: 'Lo scambio in giornata può attrarre più interesse',
    pl: 'Transakcja tego samego dnia może przyciągnąć więcej uwagi',
    nl: 'Handelen op dezelfde dag kan meer interesse trekken',
    fil: 'Mas maraming interes ang same-day trade',
    uk: 'Угода того ж дня може привернути більше уваги',
    bn: 'একদিনে লেনদেন বেশি আগ্রহ আনতে পারে',
    ms: 'Dagangan hari sama boleh tarik lebih minat',
    sw: 'Biashara ya siku moja inaweza kuvutia riba zaidi',
    fa: 'معامله همان‌روز می‌تواند توجه بیشتری جلب کند',
    ur: 'اسی دن کی تجارت زیادہ دلچسپی لا سکتی ہے',
  },
  doneAlt: {
    en: 'Done', ko: '완료', zh: '完成', ja: '完了',
    es: 'Listo', pt: 'Concluído', fr: 'Terminé', de: 'Fertig',
    id: 'Selesai', vi: 'Xong', th: 'เสร็จ', hi: 'हो गया',
    ar: 'تم', ru: 'Готово', tr: 'Bitti', it: 'Fatto',
    pl: 'Gotowe', nl: 'Klaar', fil: 'Tapos', uk: 'Готово',
    bn: 'সম্পন্ন', ms: 'Selesai', sw: 'Imekamilika', fa: 'انجام شد',
    ur: ' ہو گیا',
  },
};

entries.doneAlt.ur = 'ہو گیا';
entries.tipAccurateDesc.ms = 'Penerangan tepat tutup urus niaga lebih cepat';

const keys = Object.keys(entries);
for (const k of keys) {
  for (const lang of LANGS) {
    if (!entries[k][lang]) {
      console.error(`Missing ${lang} for ${k}`);
      process.exit(1);
    }
  }
}

let out = `/* Auto-generated by scripts/gen-register-complete-i18n.mjs */
import type { AppLanguage } from '@/utils/languageStorage';

export type RegisterCompleteMessageKey =
${keys.map((k) => `  | '${k}'`).join('\n')};

const REGISTER_COMPLETE_MESSAGES: Record<AppLanguage, Record<RegisterCompleteMessageKey, string>> = {\n`;

for (const lang of LANGS) {
  out += `  ${lang}: {\n`;
  for (const k of keys) {
    const v = entries[k][lang]
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\r/g, '\\r')
      .replace(/\n/g, '\\n');
    out += `    ${k}: '${v}',\n`;
  }
  out += `  },\n`;
}
out += `};

export function registerCompleteT(
  lang: AppLanguage,
  key: RegisterCompleteMessageKey,
  vars?: Record<string, string | number>,
): string {
  const raw = REGISTER_COMPLETE_MESSAGES[lang]?.[key] ?? REGISTER_COMPLETE_MESSAGES.en[key] ?? key;
  if (!vars) return raw;
  return Object.entries(vars).reduce(
    (s, [k, v]) => s.split('{' + k + '}').join(String(v)),
    raw,
  );
}
`;

fs.writeFileSync(path.join(__dirname, '../src/i18n/registerCompleteMessages.ts'), out, 'utf8');
console.log('Wrote registerCompleteMessages.ts', keys.length, 'keys');
