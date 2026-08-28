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
  listingsTab: {
    en: 'Listings', ko: '상품', zh: '商品', ja: '出品',
    es: 'Anuncios', pt: 'Anúncios', fr: 'Annonces', de: 'Anzeigen',
    id: 'Listing', vi: 'Tin đăng', th: 'ประกาศ', hi: 'लिस्टिंग',
    ar: 'الإعلانات', ru: 'Объявления', tr: 'İlanlar', it: 'Annunci',
    pl: 'Ogłoszenia', nl: 'Advertenties', fil: 'Mga listing', uk: 'Оголошення',
    bn: 'লিস্টিং', ms: 'Listing', sw: 'Matangazo', fa: 'آگهی‌ها',
    ur: 'لسٹنگز',
  },
  commentsTab: {
    en: 'Comments', ko: '댓글', zh: '评论', ja: 'コメント',
    es: 'Comentarios', pt: 'Comentários', fr: 'Commentaires', de: 'Kommentare',
    id: 'Komentar', vi: 'Bình luận', th: 'ความคิดเห็น', hi: 'टिप्पणियाँ',
    ar: 'التعليقات', ru: 'Комментарии', tr: 'Yorumlar', it: 'Commenti',
    pl: 'Komentarze', nl: 'Reacties', fil: 'Mga komento', uk: 'Коментарі',
    bn: 'মন্তব্য', ms: 'Komen', sw: 'Maoni', fa: 'نظرها',
    ur: 'تبصرے',
  },
  noProfileComments: {
    en: 'No comments yet.', ko: '작성한 댓글이 없습니다.', zh: '暂无评论。', ja: 'コメントはまだありません。',
    es: 'Aún no hay comentarios.', pt: 'Ainda sem comentários.', fr: 'Pas encore de commentaires.', de: 'Noch keine Kommentare.',
    id: 'Belum ada komentar.', vi: 'Chưa có bình luận.', th: 'ยังไม่มีความคิดเห็น', hi: 'अभी कोई टिप्पणी नहीं।',
    ar: 'لا تعليقات بعد.', ru: 'Пока нет комментариев.', tr: 'Henüz yorum yok.', it: 'Nessun commento ancora.',
    pl: 'Brak komentarzy.', nl: 'Nog geen reacties.', fil: 'Wala pang komento.', uk: 'Поки немає коментарів.',
    bn: 'এখনও কোনো মন্তব্য নেই।', ms: 'Belum ada komen.', sw: 'Bado hakuna maoni.', fa: 'هنوز نظری نیست.',
    ur: 'ابھی کوئی تبصرہ نہیں۔',
  },
  commentOnPost: {
    en: 'On "{title}"', ko: '"{title}"에 남긴 댓글', zh: '发表于“{title}”', ja: '「{title}」へのコメント',
    es: 'En "{title}"', pt: 'Em "{title}"', fr: 'Sur « {title} »', de: 'Zu „{title}“',
    id: 'Di "{title}"', vi: 'Trên "{title}"', th: 'ใน "{title}"', hi: '"{title}" पर',
    ar: 'على "{title}"', ru: 'К «{title}»', tr: '"{title}" üzerinde', it: 'Su "{title}"',
    pl: 'W „{title}”', nl: 'Op "{title}"', fil: 'Sa "{title}"', uk: 'До «{title}»',
    bn: '"{title}"-এ', ms: 'Pada "{title}"', sw: 'Kwenye "{title}"', fa: 'در «{title}»',
    ur: '"{title}" پر',
  },
  postsTab: {
    en: 'Posts', ko: '게시글', zh: '帖子', ja: '投稿',
    es: 'Publicaciones', pt: 'Posts', fr: 'Publications', de: 'Beiträge',
    id: 'Postingan', vi: 'Bài viết', th: 'โพสต์', hi: 'पोस्ट',
    ar: 'المنشورات', ru: 'Посты', tr: 'Gönderiler', it: 'Post',
    pl: 'Posty', nl: 'Berichten', fil: 'Mga post', uk: 'Пости',
    bn: 'পোস্ট', ms: 'Siaran', sw: 'Machapisho', fa: 'پست‌ها',
    ur: 'پوسٹس',
  },
  userNotFound: {
    en: 'User not found.', ko: '사용자를 찾을 수 없습니다.', zh: '未找到用户。', ja: 'ユーザーが見つかりません。',
    es: 'Usuario no encontrado.', pt: 'Usuário não encontrado.', fr: 'Utilisateur introuvable.', de: 'Benutzer nicht gefunden.',
    id: 'Pengguna tidak ditemukan.', vi: 'Không tìm thấy người dùng.', th: 'ไม่พบผู้ใช้', hi: 'उपयोगकर्ता नहीं मिला।',
    ar: 'المستخدم غير موجود.', ru: 'Пользователь не найден.', tr: 'Kullanıcı bulunamadı.', it: 'Utente non trovato.',
    pl: 'Nie znaleziono użytkownika.', nl: 'Gebruiker niet gevonden.', fil: 'Hindi nahanap ang user.', uk: 'Користувача не знайдено.',
    bn: 'ব্যবহারকারী পাওয়া যায়নি।', ms: 'Pengguna tidak dijumpai.', sw: 'Mtumiaji hajapatikana.', fa: 'کاربر پیدا نشد.',
    ur: 'صارف نہیں ملا۔',
  },
  sellerNoListings: {
    en: 'No listings.', ko: '등록된 상품이 없습니다.', zh: '暂无商品。', ja: '出品がありません。',
    es: 'Sin anuncios.', pt: 'Sem anúncios.', fr: 'Aucune annonce.', de: 'Keine Anzeigen.',
    id: 'Tidak ada listing.', vi: 'Không có tin đăng.', th: 'ไม่มีประกาศ', hi: 'कोई लिस्टिंग नहीं।',
    ar: 'لا إعلانات.', ru: 'Нет объявлений.', tr: 'İlan yok.', it: 'Nessun annuncio.',
    pl: 'Brak ogłoszeń.', nl: 'Geen advertenties.', fil: 'Walang listing.', uk: 'Немає оголошень.',
    bn: 'কোনো লিস্টিং নেই।', ms: 'Tiada listing.', sw: 'Hakuna matangazo.', fa: 'آگهی نیست.',
    ur: 'کوئی لسٹنگ نہیں۔',
  },
  noListingsInCategory: {
    en: 'No listings in this category.',
    ko: '이 분류에 상품이 없습니다.',
    zh: '该分类下暂无商品。',
    ja: 'このカテゴリーに出品はありません。',
    es: 'No hay anuncios en esta categoría.',
    pt: 'Não há anúncios nesta categoria.',
    fr: 'Aucune annonce dans cette catégorie.',
    de: 'Keine Anzeigen in dieser Kategorie.',
    id: 'Tidak ada listing di kategori ini.',
    vi: 'Không có tin đăng trong danh mục này.',
    th: 'ไม่มีประกาศในหมวดนี้',
    hi: 'इस श्रेणी में कोई लिस्टिंग नहीं।',
    ar: 'لا إعلانات في هذه الفئة.',
    ru: 'В этой категории нет объявлений.',
    tr: 'Bu kategoride ilan yok.',
    it: 'Nessun annuncio in questa categoria.',
    pl: 'Brak ogłoszeń w tej kategorii.',
    nl: 'Geen advertenties in deze categorie.',
    fil: 'Walang listing sa category na ito.',
    uk: 'У цій категорії немає оголошень.',
    bn: 'এই বিভাগে কোনো লিস্টিং নেই।',
    ms: 'Tiada listing dalam kategori ini.',
    sw: 'Hakuna matangazo katika kategoria hii.',
    fa: 'در این دسته آگهی نیست.',
    ur: 'اس زمرے میں کوئی لسٹنگ نہیں۔',
  },
  noReviewsYet: {
    en: 'No reviews yet.', ko: '아직 후기가 없습니다.', zh: '暂无评价。', ja: 'まだレビューはありません。',
    es: 'Aún no hay reseñas.', pt: 'Ainda sem avaliações.', fr: 'Pas encore d’avis.', de: 'Noch keine Bewertungen.',
    id: 'Belum ada ulasan.', vi: 'Chưa có đánh giá.', th: 'ยังไม่มีรีวิว', hi: 'अभी कोई रिव्यू नहीं।',
    ar: 'لا تقييمات بعد.', ru: 'Пока нет отзывов.', tr: 'Henüz yorum yok.', it: 'Nessuna recensione ancora.',
    pl: 'Brak opinii.', nl: 'Nog geen reviews.', fil: 'Wala pang review.', uk: 'Поки немає відгуків.',
    bn: 'এখনও কোনো রিভিউ নেই।', ms: 'Belum ada ulasan.', sw: 'Bado hakuna mapitio.', fa: 'هنوز نظری نیست.',
    ur: 'ابھی کوئی ریویو نہیں۔',
  },
  noDisputesInCategory: {
    en: 'No disputes in this category.',
    ko: '이 분류에 분쟁이 없습니다.',
    zh: '该分类下暂无争议。',
    ja: 'このカテゴリーに紛争はありません。',
    es: 'No hay disputas en esta categoría.',
    pt: 'Não há disputas nesta categoria.',
    fr: 'Aucun litige dans cette catégorie.',
    de: 'Keine Streitfälle in dieser Kategorie.',
    id: 'Tidak ada sengketa di kategori ini.',
    vi: 'Không có tranh chấp trong danh mục này.',
    th: 'ไม่มีข้อพิพาทในหมวดนี้',
    hi: 'इस श्रेणी में कोई विवाद नहीं।',
    ar: 'لا نزاعات في هذه الفئة.',
    ru: 'В этой категории нет споров.',
    tr: 'Bu kategoride anlaşmazlık yok.',
    it: 'Nessuna controversia in questa categoria.',
    pl: 'Brak sporów w tej kategorii.',
    nl: 'Geen geschillen in deze categorie.',
    fil: 'Walang dispute sa category na ito.',
    uk: 'У цій категорії немає суперечок.',
    bn: 'এই বিভাগে কোনো বিরোধ নেই।',
    ms: 'Tiada pertikaian dalam kategori ini.',
    sw: 'Hakuna migogoro katika kategoria hii.',
    fa: 'در این دسته اختلافی نیست.',
    ur: 'اس زمرے میں کوئی تنازع نہیں۔',
  },
  reviewCountOne: {
    en: '1 review', ko: '후기 1개', zh: '1 条评价', ja: 'レビュー1件',
    es: '1 reseña', pt: '1 avaliação', fr: '1 avis', de: '1 Bewertung',
    id: '1 ulasan', vi: '1 đánh giá', th: '1 รีวิว', hi: '1 रिव्यू',
    ar: 'تقييم واحد', ru: '1 отзыв', tr: '1 yorum', it: '1 recensione',
    pl: '1 opinia', nl: '1 review', fil: '1 review', uk: '1 відгук',
    bn: '১টি রিভিউ', ms: '1 ulasan', sw: 'Mapitio 1', fa: '۱ نظر',
    ur: '۱ ریویو',
  },
  reviewCountMany: {
    en: '{n} reviews', ko: '후기 {n}개', zh: '{n} 条评价', ja: 'レビュー{n}件',
    es: '{n} reseñas', pt: '{n} avaliações', fr: '{n} avis', de: '{n} Bewertungen',
    id: '{n} ulasan', vi: '{n} đánh giá', th: '{n} รีวิว', hi: '{n} रिव्यू',
    ar: '{n} تقييمات', ru: '{n} отзывов', tr: '{n} yorum', it: '{n} recensioni',
    pl: '{n} opinii', nl: '{n} reviews', fil: '{n} reviews', uk: '{n} відгуків',
    bn: '{n}টি রিভিউ', ms: '{n} ulasan', sw: 'Mapitio {n}', fa: '{n} نظر',
    ur: '{n} ریویوز',
  },
  anonymous: {
    en: 'Anonymous', ko: '익명', zh: '匿名', ja: '匿名',
    es: 'Anónimo', pt: 'Anônimo', fr: 'Anonyme', de: 'Anonym',
    id: 'Anonim', vi: 'Ẩn danh', th: 'ไม่ระบุชื่อ', hi: 'अनाम',
    ar: 'مجهول', ru: 'Аноним', tr: 'Anonim', it: 'Anonimo',
    pl: 'Anonim', nl: 'Anoniem', fil: 'Anonymous', uk: 'Анонім',
    bn: 'নামহীন', ms: 'Tanpa nama', sw: 'Bila jina', fa: 'ناشناس',
    ur: 'گمنام',
  },
};

const keys = Object.keys(entries);
for (const k of keys) {
  for (const lang of LANGS) {
    if (!entries[k][lang]) {
      console.error(`Missing ${lang} for ${k}`);
      process.exit(1);
    }
  }
}

let out = `/* Auto-generated by scripts/gen-seller-profile-i18n.mjs */
import type { AppLanguage } from '@/utils/languageStorage';

export type SellerProfileMessageKey =
${keys.map((k) => `  | '${k}'`).join('\n')};

const SELLER_PROFILE_MESSAGES: Record<AppLanguage, Record<SellerProfileMessageKey, string>> = {\n`;

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

export function sellerProfileT(
  lang: AppLanguage,
  key: SellerProfileMessageKey,
  vars?: Record<string, string | number>,
): string {
  const raw = SELLER_PROFILE_MESSAGES[lang]?.[key] ?? SELLER_PROFILE_MESSAGES.en[key] ?? key;
  if (!vars) return raw;
  return Object.entries(vars).reduce(
    (s, [k, v]) => s.split('{' + k + '}').join(String(v)),
    raw,
  );
}
`;

fs.writeFileSync(path.join(__dirname, '../src/i18n/sellerProfileMessages.ts'), out, 'utf8');
console.log('Wrote sellerProfileMessages.ts', keys.length, 'keys');
