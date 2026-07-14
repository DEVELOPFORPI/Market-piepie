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
  yourOfferPi: {
    en: 'Your offer (Pi)', ko: '제안 금액 (Pi)', zh: '你的报价 (Pi)', ja: 'オファー金額 (Pi)',
    es: 'Tu oferta (Pi)', pt: 'Sua oferta (Pi)', fr: 'Votre offre (Pi)', de: 'Dein Angebot (Pi)',
    id: 'Tawaran Anda (Pi)', vi: 'Giá đề nghị (Pi)', th: 'ข้อเสนอของคุณ (Pi)', hi: 'आपका ऑफ़र (Pi)',
    ar: 'عرضك (Pi)', ru: 'Ваше предложение (Pi)', tr: 'Teklifiniz (Pi)', it: 'La tua offerta (Pi)',
    pl: 'Twoja oferta (Pi)', nl: 'Jouw bod (Pi)', fil: 'Iyong offer (Pi)', uk: 'Ваша пропозиція (Pi)',
    bn: 'আপনার অফার (Pi)', ms: 'Tawaran anda (Pi)', sw: 'Ofa yako (Pi)', fa: 'پیشنهاد شما (Pi)',
    ur: 'آپ کی پیشکش (Pi)',
  },
  listPriceLine: {
    en: 'List price: {price} Pi',
    ko: '등록가: {price} Pi',
    zh: '标价：{price} Pi',
    ja: '出品価格: {price} Pi',
    es: 'Precio de lista: {price} Pi',
    pt: 'Preço anunciado: {price} Pi',
    fr: 'Prix affiché : {price} Pi',
    de: 'Listenpreis: {price} Pi',
    id: 'Harga listing: {price} Pi',
    vi: 'Giá niêm yết: {price} Pi',
    th: 'ราคาประกาศ: {price} Pi',
    hi: 'सूची मूल्य: {price} Pi',
    ar: 'سعر القائمة: {price} Pi',
    ru: 'Цена в объявлении: {price} Pi',
    tr: 'İlan fiyatı: {price} Pi',
    it: 'Prezzo elencato: {price} Pi',
    pl: 'Cena z ogłoszenia: {price} Pi',
    nl: 'Vraagprijs: {price} Pi',
    fil: 'List price: {price} Pi',
    uk: 'Ціна в оголошенні: {price} Pi',
    bn: 'তালিকা মূল্য: {price} Pi',
    ms: 'Harga senarai: {price} Pi',
    sw: 'Bei ya orodha: {price} Pi',
    fa: 'قیمت آگهی: {price} Pi',
    ur: 'لسٹ قیمت: {price} Pi',
  },
  belowListPct: {
    en: '({pct}% below list)',
    ko: '(등록가보다 {pct}% 낮음)',
    zh: '（比标价低 {pct}%）',
    ja: '（出品より{pct}%安い）',
    es: '({pct}% bajo el listado)',
    pt: '({pct}% abaixo do anúncio)',
    fr: '({pct}% sous le prix affiché)',
    de: '({pct}% unter Listenpreis)',
    id: '({pct}% di bawah listing)',
    vi: '(thấp hơn {pct}% so với giá đăng)',
    th: '(ต่ำกว่าราคาประกาศ {pct}%)',
    hi: '(सूची से {pct}% कम)',
    ar: '({pct}% أقل من السعر)',
    ru: '({pct}% ниже объявленной цены)',
    tr: '(ilandan %{pct} düşük)',
    it: '({pct}% sotto il listino)',
    pl: '({pct}% poniżej ceny ogłoszenia)',
    nl: '({pct}% onder vraagprijs)',
    fil: '({pct}% below list)',
    uk: '({pct}% нижче оголошеної ціни)',
    bn: '(তালিকা থেকে {pct}% কম)',
    ms: '({pct}% di bawah senarai)',
    sw: '({pct}% chini ya orodha)',
    fa: '({pct}٪ کمتر زیر آگهی)',
    ur: '(لسٹ سے {pct}% کم)',
  },
  tradeNotes: {
    en: 'Trade notes', ko: '거래 안내', zh: '交易须知', ja: '取引注意',
    es: 'Notas de la operación', pt: 'Notas da negociação', fr: 'Notes sur l’échange', de: 'Handelshinweise',
    id: 'Catatan transaksi', vi: 'Lưu ý giao dịch', th: 'หมายเหตุการซื้อขาย', hi: 'लेन-देन नोट्स',
    ar: 'ملاحظات التداول', ru: 'Заметки о сделке', tr: 'İşlem notları', it: 'Note sul commercio',
    pl: 'Uwagi do transakcji', nl: 'Handelsnotities', fil: 'Mga note sa trade', uk: 'Нотатки щодо угоди',
    bn: 'লেনদেনের নোট', ms: 'Nota dagangan', sw: 'Maelezo ya biashara', fa: 'نکات معامله',
    ur: 'تجارت نوٹس',
  },
  tradeNoteNoPayment: {
    en: 'The platform does not handle payment',
    ko: '결제·송금은 플랫폼이 대행하지 않습니다',
    zh: '平台不代收代付',
    ja: 'プラットフォームは支払いを仲介しません',
    es: 'La plataforma no gestiona el pago',
    pt: 'A plataforma não processa o pagamento',
    fr: 'La plateforme ne gère pas le paiement',
    de: 'Die Plattform wickelt keine Zahlungen ab',
    id: 'Platform tidak menangani pembayaran',
    vi: 'Nền tảng không xử lý thanh toán',
    th: 'แพลตฟอร์มไม่จัดการการชำระเงิน',
    hi: 'प्लेटफ़ॉर्म भुगतान नहीं संभालता',
    ar: 'المنصة لا تتولى الدفع',
    ru: 'Платформа не обрабатывает оплату',
    tr: 'Platform ödemeyi yönetmez',
    it: 'La piattaforma non gestisce il pagamento',
    pl: 'Platforma nie obsługuje płatności',
    nl: 'Het platform handelt betalingen niet af',
    fil: 'Hindi hinahawakan ng platform ang bayad',
    uk: 'Платформа не обробляє оплату',
    bn: 'প্ল্যাটফর্ম পেমেন্ট পরিচালনা করে না',
    ms: 'Platform tidak mengendalikan pembayaran',
    sw: 'Jukwaa halishughulikii malipo',
    fa: 'پلتفرم پرداخت را انجام نمی‌دهد',
    ur: 'پلیٹ فارم ادائیگی نہیں سنبھالتا',
  },
  tradeNoteArrangeDirect: {
    en: 'You arrange payment directly with the seller',
    ko: '판매자와 직접 결제 방법을 조율하세요',
    zh: '请与卖家直接约定付款',
    ja: '出品者と直接支払いを取り決めてください',
    es: 'Acuerdas el pago directamente con el vendedor',
    pt: 'Você combina o pagamento diretamente com o vendedor',
    fr: 'Vous convenez du paiement directement avec le vendeur',
    de: 'Du vereinbarst die Zahlung direkt mit dem Verkäufer',
    id: 'Anda atur pembayaran langsung dengan penjual',
    vi: 'Bạn thỏa thuận thanh toán trực tiếp với người bán',
    th: 'ตกลงชำระเงินกับผู้ขายโดยตรง',
    hi: 'विक्रेता के साथ सीधे भुगतान तय करें',
    ar: 'تنسّق الدفع مباشرة مع البائع',
    ru: 'Оплату вы согласовываете напрямую с продавцом',
    tr: 'Ödemeyi satıcıyla doğrudan ayarlarsınız',
    it: 'Organizzi il pagamento direttamente con il venditore',
    pl: 'Płatność ustalasz bezpośrednio ze sprzedawcą',
    nl: 'Je regelt betaling rechtstreeks met de verkoper',
    fil: 'Ikaw ang mag-aayos ng bayad sa seller',
    uk: 'Оплату ви узгоджуєте напряму з продавцем',
    bn: 'বিক্রেতার সাথে সরাসরি পেমেন্ট ঠিক করুন',
    ms: 'Anda aturkan bayaran terus dengan penjual',
    sw: 'Unapanga malipo moja kwa moja na muuzaji',
    fa: 'پرداخت را مستقیماً با فروشنده هماهنگ کنید',
    ur: 'فروخت کنندہ کے ساتھ براہِ راست ادائیگی طے کریں',
  },
  tradeNoteDisputes: {
    en: 'Use disputes if there is a problem',
    ko: '문제가 있으면 분쟁을 이용해 주세요',
    zh: '如有问题请使用争议功能',
    ja: '問題があれば紛争機能を使ってください',
    es: 'Usa disputas si hay un problema',
    pt: 'Use disputas se houver um problema',
    fr: 'Utilisez les litiges en cas de problème',
    de: 'Nutze Streitfälle bei Problemen',
    id: 'Gunakan sengketa jika ada masalah',
    vi: 'Dùng tranh chấp nếu có vấn đề',
    th: 'ใช้ข้อพิพาทหากมีปัญหา',
    hi: 'समस्या होने पर विवाद का उपयोग करें',
    ar: 'استخدم النزاعات إذا حدثت مشكلة',
    ru: 'При проблемах используйте споры',
    tr: 'Sorun olursa anlaşmazlık kullanın',
    it: 'Usa le controversie in caso di problemi',
    pl: 'W razie problemów skorzystaj ze sporów',
    nl: 'Gebruik geschillen bij problemen',
    fil: 'Gumamit ng dispute kung may problema',
    uk: 'У разі проблеми скористайтеся суперечками',
    bn: 'সমস্যা হলে বিরোধ ব্যবহার করুন',
    ms: 'Guna pertikaian jika ada masalah',
    sw: 'Tumiu migogoro ikiwa kuna tatizo',
    fa: 'در صورت مشکل از اختلاف استفاده کنید',
    ur: 'مسئلہ ہو تو تنازع استعمال کریں',
  },
  cannotOfferSold: {
    en: 'You cannot offer on a sold listing.',
    ko: '판매 완료된 상품에는 제안할 수 없습니다.',
    zh: '已售出的商品无法报价。',
    ja: '売却済みの出品にはオファーできません。',
    es: 'No puedes ofrecer en un anuncio vendido.',
    pt: 'Você não pode fazer oferta em um anúncio vendido.',
    fr: 'Vous ne pouvez pas offrir sur une annonce vendue.',
    de: 'Du kannst kein Angebot für verkaufte Anzeigen machen.',
    id: 'Anda tidak bisa menawar listing yang terjual.',
    vi: 'Bạn không thể đề nghị trên tin đã bán.',
    th: 'คุณไม่สามารถเสนอราคาในประกาศที่ขายแล้ว',
    hi: 'बेची गई लिस्टिंग पर ऑफ़र नहीं कर सकते।',
    ar: 'لا يمكنك تقديم عرض على إعلان مباع.',
    ru: 'Нельзя предлагать цену по проданному объявлению.',
    tr: 'Satılmış ilana teklif veremezsiniz.',
    it: 'Non puoi offrire su un annuncio venduto.',
    pl: 'Nie możesz składać oferty na sprzedane ogłoszenie.',
    nl: 'Je kunt niet bieden op een verkochte advertentie.',
    fil: 'Hindi ka makakapag-offer sa sold na listing.',
    uk: 'Не можна пропонувати ціну за продане оголошення.',
    bn: 'বিক্রি হওয়া লিস্টিংয়ে অফার করা যায় না।',
    ms: 'Anda tidak boleh tawar listing yang terjual.',
    sw: 'Huwezi kutoa ofa kwenye tangazo lililouzwa.',
    fa: 'روی آگهی فروخته‌شده نمی‌توانید پیشنهاد بدهید.',
    ur: 'فروخت شدہ لسٹنگ پر پیشکش نہیں کر سکتے۔',
  },
  couldNotSendOffer: {
    en: 'Could not send offer. Check your connection and try again.',
    ko: '제안을 보내지 못했습니다. 연결을 확인하고 다시 시도해 주세요.',
    zh: '无法发送报价，请检查网络后重试。',
    ja: 'オファーを送信できませんでした。接続を確認して再試行してください。',
    es: 'No se pudo enviar la oferta. Comprueba la conexión e inténtalo de nuevo.',
    pt: 'Não foi possível enviar a oferta. Verifique a conexão e tente novamente.',
    fr: 'Impossible d’envoyer l’offre. Vérifiez la connexion et réessayez.',
    de: 'Angebot konnte nicht gesendet werden. Verbindung prüfen und erneut versuchen.',
    id: 'Gagal mengirim tawaran. Periksa koneksi dan coba lagi.',
    vi: 'Không gửi được đề nghị. Kiểm tra kết nối và thử lại.',
    th: 'ส่งข้อเสนอไม่สำเร็จ ตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง',
    hi: 'ऑफ़र नहीं भेजा जा सका। कनेक्शन जाँचकर फिर कोशिश करें।',
    ar: 'تعذّر إرسال العرض. تحقق من الاتصال وحاول مجددًا.',
    ru: 'Не удалось отправить предложение. Проверьте соединение и повторите.',
    tr: 'Teklif gönderilemedi. Bağlantınızı kontrol edip tekrar deneyin.',
    it: 'Impossibile inviare l’offerta. Controlla la connessione e riprova.',
    pl: 'Nie udało się wysłać oferty. Sprawdź połączenie i spróbuj ponownie.',
    nl: 'Bod kon niet worden verzonden. Controleer je verbinding en probeer opnieuw.',
    fil: 'Hindi maipadala ang offer. Tingnan ang connection at subukan ulit.',
    uk: 'Не вдалося надіслати пропозицію. Перевірте з’єднання й спробуйте ще раз.',
    bn: 'অফার পাঠানো যায়নি। সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।',
    ms: 'Tidak dapat hantar tawaran. Semak sambungan dan cuba lagi.',
    sw: 'Imeshindwa kutuma ofa. Angalia muunganisho na ujaribu tena.',
    fa: 'ارسال پیشنهاد ممکن نشد. اتصال را بررسی و دوباره تلاش کنید.',
    ur: 'پیشکش نہیں بھیج سکے۔ کنکشن چیک کر کے دوبارہ کوشش کریں۔',
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

let out = `/* Auto-generated by scripts/gen-offer-i18n.mjs */
import type { AppLanguage } from '@/utils/languageStorage';

export type OfferMessageKey =
${keys.map((k) => `  | '${k}'`).join('\n')};

const OFFER_MESSAGES: Record<AppLanguage, Record<OfferMessageKey, string>> = {\n`;

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

export function offerT(
  lang: AppLanguage,
  key: OfferMessageKey,
  vars?: Record<string, string | number>,
): string {
  const raw = OFFER_MESSAGES[lang]?.[key] ?? OFFER_MESSAGES.en[key] ?? key;
  if (!vars) return raw;
  return Object.entries(vars).reduce(
    (s, [k, v]) => s.split('{' + k + '}').join(String(v)),
    raw,
  );
}
`;

fs.writeFileSync(path.join(__dirname, '../src/i18n/offerMessages.ts'), out, 'utf8');
console.log('Wrote offerMessages.ts', keys.length, 'keys');
