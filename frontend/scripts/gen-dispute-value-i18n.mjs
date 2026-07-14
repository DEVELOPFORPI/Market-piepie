import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Canonical stored English values (DB / localStorage). */
const storedKeys = [
  'Listing mismatch',
  'Not received',
  'Damaged item',
  'Seller no-show',
  'Buyer no-show',
  'Buyer not responding',
  'Payment not received',
  'Bad-faith behavior',
  'Other',
  'Request full refund',
  'Request partial refund',
  'Request seller action',
];

/** @type {Record<string, string[]>} */
const table = {
  en: [
    'Listing mismatch', 'Not received', 'Damaged item', 'Seller no-show', 'Buyer no-show',
    'Buyer not responding', 'Payment not received', 'Bad-faith behavior', 'Other',
    'Request full refund', 'Request partial refund', 'Request seller action',
  ],
  ko: [
    '물품 정보 불일치', '미수령', '파손·하자', '판매자 노쇼', '구매자 노쇼',
    '구매자 무응답', '미입금', '악의적 행위', '기타',
    '전액 환불 요청', '부분 환불 요청', '판매자 조치 요청',
  ],
  zh: [
    '商品不符', '未收到', '物品损坏', '卖家未到', '买家未到',
    '买家无回应', '未收到付款', '恶意行为', '其他',
    '请求全额退款', '请求部分退款', '请求卖家处理',
  ],
  ja: [
    '出品内容の相違', '未着', '破損・不良', '出品者の無断欠席', '購入者の無断欠席',
    '購入者の無返信', '未入金', '悪質な行為', 'その他',
    '全額返金を依頼', '一部返金を依頼', '出品者の対応を依頼',
  ],
  es: [
    'No coincide con el anuncio', 'No recibido', 'Artículo dañado', 'Ausencia del vendedor', 'Ausencia del comprador',
    'Comprador sin respuesta', 'Pago no recibido', 'Mala fe', 'Otro',
    'Solicitar reembolso total', 'Solicitar reembolso parcial', 'Solicitar acción del vendedor',
  ],
  pt: [
    'Não corresponde ao anúncio', 'Não recebido', 'Item danificado', 'Vendedor faltou', 'Comprador faltou',
    'Comprador sem resposta', 'Pagamento não recebido', 'Má-fé', 'Outro',
    'Pedir reembolso total', 'Pedir reembolso parcial', 'Pedir ação do vendedor',
  ],
  fr: [
    'Ne correspond pas à l’annonce', 'Non reçu', 'Article endommagé', 'Vendeur absent', 'Acheteur absent',
    'Acheteur sans réponse', 'Paiement non reçu', 'Mauvaise foi', 'Autre',
    'Demander un remboursement total', 'Demander un remboursement partiel', 'Demander une action du vendeur',
  ],
  de: [
    'Abweichung vom Angebot', 'Nicht erhalten', 'Beschädigter Artikel', 'Verkäufer nicht erschienen', 'Käufer nicht erschienen',
    'Käufer antwortet nicht', 'Zahlung nicht erhalten', 'Bösgläubiges Verhalten', 'Sonstiges',
    'Volle Rückerstattung anfordern', 'Teilrückerstattung anfordern', 'Verkäufermaßnahme anfordern',
  ],
  id: [
    'Tidak sesuai listing', 'Tidak diterima', 'Barang rusak', 'Penjual tidak datang', 'Pembeli tidak datang',
    'Pembeli tidak merespons', 'Pembayaran belum diterima', 'Niat buruk', 'Lainnya',
    'Minta pengembalian penuh', 'Minta pengembalian sebagian', 'Minta tindakan penjual',
  ],
  vi: [
    'Không khớp tin đăng', 'Chưa nhận được', 'Hàng hỏng', 'Người bán vắng mặt', 'Người mua vắng mặt',
    'Người mua không phản hồi', 'Chưa nhận thanh toán', 'Hành vi xấu', 'Khác',
    'Yêu cầu hoàn tiền đầy đủ', 'Yêu cầu hoàn một phần', 'Yêu cầu người bán xử lý',
  ],
  th: [
    'ไม่ตรงประกาศ', 'ไม่ได้รับของ', 'สินค้าเสียหาย', 'ผู้ขายไม่มา', 'ผู้ซื้อไม่มา',
    'ผู้ซื้อไม่ตอบ', 'ยังไม่ได้รับเงิน', 'เจตนาไม่ดี', 'อื่นๆ',
    'ขอคืนเงินเต็มจำนวน', 'ขอคืนเงินบางส่วน', 'ขอให้ผู้ขายดำเนินการ',
  ],
  hi: [
    'लिस्टिंग से मेल नहीं', 'प्राप्त नहीं हुआ', 'क्षतिग्रस्त वस्तु', 'विक्रेता नो-शो', 'खरीदार नो-शो',
    'खरीदार जवाब नहीं दे रहा', 'भुगतान नहीं मिला', 'दुर्भावनापूर्ण व्यवहार', 'अन्य',
    'पूर्ण धनवापसी का अनुरोध', 'आंशिक धनवापसी का अनुरोध', 'विक्रेता कार्रवाई का अनुरोध',
  ],
  ar: [
    'لا يطابق الإعلان', 'لم يُستلم', 'قطعة تالفة', 'غياب البائع', 'غياب المشتري',
    'المشتري لا يرد', 'لم يُستلم الدفع', 'سوء نية', 'أخرى',
    'طلب استرداد كامل', 'طلب استرداد جزئي', 'طلب إجراء من البائع',
  ],
  ru: [
    'Не соответствует объявлению', 'Не получено', 'Повреждённый товар', 'Продавец не явился', 'Покупатель не явился',
    'Покупатель не отвечает', 'Оплата не получена', 'Недобросовестное поведение', 'Другое',
    'Запросить полный возврат', 'Запросить частичный возврат', 'Запросить действия продавца',
  ],
  tr: [
    'İlanla uyuşmuyor', 'Teslim alınmadı', 'Hasarlı ürün', 'Satıcı gelmedi', 'Alıcı gelmedi',
    'Alıcı yanıt vermiyor', 'Ödeme alınmadı', 'Kötü niyetli davranış', 'Diğer',
    'Tam iade talep et', 'Kısmi iade talep et', 'Satıcı işlemi talep et',
  ],
  it: [
    'Non corrisponde all’annuncio', 'Non ricevuto', 'Articolo danneggiato', 'Venditore assente', 'Acquirente assente',
    'Acquirente non risponde', 'Pagamento non ricevuto', 'Comportamento in mala fede', 'Altro',
    'Richiedi rimborso totale', 'Richiedi rimborso parziale', 'Richiedi azione del venditore',
  ],
  pl: [
    'Niezgodność z ogłoszeniem', 'Nie otrzymano', 'Uszkodzony przedmiot', 'Sprzedawca się nie stawił', 'Kupujący się nie stawił',
    'Kupujący nie odpowiada', 'Nie otrzymano płatności', 'Działanie w złej wierze', 'Inne',
    'Poproś o pełny zwrot', 'Poproś o częściowy zwrot', 'Poproś o działanie sprzedawcy',
  ],
  nl: [
    'Komt niet overeen met advertentie', 'Niet ontvangen', 'Beschadigd artikel', 'Verkoper niet verschenen', 'Koper niet verschenen',
    'Koper reageert niet', 'Betaling niet ontvangen', 'Kwaadwillend gedrag', 'Overig',
    'Volledige terugbetaling vragen', 'Gedeeltelijke terugbetaling vragen', 'Actie van verkoper vragen',
  ],
  fil: [
    'Hindi tumutugma sa listing', 'Hindi natanggap', 'Sira ang item', 'Hindi dumating ang seller', 'Hindi dumating ang buyer',
    'Hindi sumasagot ang buyer', 'Hindi natanggap ang bayad', 'Masamang intensyon', 'Iba pa',
    'Humiling ng buong refund', 'Humiling ng partial refund', 'Humiling ng aksyon ng seller',
  ],
  uk: [
    'Не відповідає оголошенню', 'Не отримано', 'Пошкоджений товар', 'Продавець не з’явився', 'Покупець не з’явився',
    'Покупець не відповідає', 'Оплату не отримано', 'Недобросовісна поведінка', 'Інше',
    'Запитати повне повернення', 'Запитати часткове повернення', 'Запитати дію продавця',
  ],
  bn: [
    'লিস্টিংয়ের সাথে মিলছে না', 'পাওয়া যায়নি', 'ক্ষতিগ্রস্ত পণ্য', 'বিক্রেতা আসেনি', 'ক্রেতা আসেননি',
    'ক্রেতা সাড়া দিচ্ছেন না', 'পেমেন্ট পাওয়া যায়নি', 'দুরভিসন্ধিমূলক আচরণ', 'অন্যান্য',
    'পূর্ণ ফেরত অনুরোধ', 'আংশিক ফেরত অনুরোধ', 'বিক্রেতার পদক্ষেপ অনুরোধ',
  ],
  ms: [
    'Tidak sepadan dengan senarai', 'Tidak diterima', 'Item rosak', 'Penjual tidak hadir', 'Pembeli tidak hadir',
    'Pembeli tidak menjawab', 'Bayaran tidak diterima', 'Niat jahat', 'Lain-lain',
    'Minta bayaran balik penuh', 'Minta bayaran balik sebahagian', 'Minta tindakan penjual',
  ],
  sw: [
    'Haifanani na orodha', 'Haijapokelewa', 'Bidhaa iliyoharibika', 'Muuzaji hakufika', 'Mnunuzi hakufika',
    'Mnunuzi hajibu', 'Malipo hayajapokelewa', 'Tabia mbaya', 'Nyingine',
    'Omba urejesho kamili', 'Omba urejesho wa sehemu', 'Omba hatua ya muuzaji',
  ],
  fa: [
    'با آگهی مطابقت ندارد', 'دریافت نشده', 'کالای آسیب‌دیده', 'فروشنده حاضر نشد', 'خریدار حاضر نشد',
    'خریدار پاسخ نمی‌دهد', 'پرداخت دریافت نشد', 'رفتار بدخواهانه', 'سایر',
    'درخواست بازپرداخت کامل', 'درخواست بازپرداخت جزئی', 'درخواست اقدام فروشنده',
  ],
  ur: [
    'لسٹنگ سے میل نہیں کھاتا', 'موصول نہیں ہوا', 'خراب آئٹم', 'فروخت کنندہ نہیں آیا', 'خریدار نہیں آیا',
    'خریدار جواب نہیں دے رہا', 'ادائیگی موصول نہیں ہوئی', 'بدنیتی کا رویہ', 'دیگر',
    'مکمل رقم واپسی کی درخواست', 'جزوی رقم واپسی کی درخواست', 'فروخت کنندہ کی کارروائی کی درخواست',
  ],
};

for (const [lang, arr] of Object.entries(table)) {
  if (arr.length !== storedKeys.length) throw new Error(`${lang}: ${arr.length} != ${storedKeys.length}`);
}

let out = `/* Auto-generated by scripts/gen-dispute-value-i18n.mjs */
import type { AppLanguage } from '@/utils/languageStorage';

const STORED = ${JSON.stringify(storedKeys, null, 2)} as const;

export type StoredDisputeValue = (typeof STORED)[number];

const LABELS: Record<AppLanguage, Record<string, string>> = {\n`;

for (const lang of Object.keys(table)) {
  out += `  ${lang}: {\n`;
  storedKeys.forEach((k, i) => {
    const v = table[lang][i].replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    out += `    '${k.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}': '${v}',\n`;
  });
  out += `  },\n`;
}
out += `};

/** Map any language label (or EN key) back to the canonical stored English key. */
function canonicalizeStored(stored: string): string {
  if (LABELS.en[stored]) return stored;
  for (const lang of Object.keys(LABELS) as AppLanguage[]) {
    const row = LABELS[lang];
    for (const [enKey, label] of Object.entries(row)) {
      if (label === stored) return enKey;
    }
  }
  return stored;
}

/** Translate a stored dispute reason/action. Unknown custom text is returned as-is. */
export function labelDisputeStoredValue(lang: AppLanguage, stored: string | null | undefined): string {
  if (!stored) return '';
  const key = canonicalizeStored(stored.trim());
  return LABELS[lang]?.[key] ?? LABELS.en[key] ?? stored;
}
`;

fs.writeFileSync(path.join(__dirname, '../src/i18n/disputeValueMessages.ts'), out, 'utf8');
console.log('Wrote disputeValueMessages.ts');
