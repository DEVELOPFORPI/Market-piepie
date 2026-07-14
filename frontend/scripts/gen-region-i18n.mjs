import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const keys = [
  'useCurrentLocation',
  'detectingLocation',
  'gpsHint',
  'enterManually',
  'regionPlaceholder',
  'regionHint',
  'saveRegionFailed',
  'detectLocationFailed',
];

const table = {
  en: [
    'Use current location',
    'Detecting location…',
    'We use GPS or IP to suggest your area.',
    'Enter manually',
    'e.g. Manhattan, NY or London',
    'Type your area if it does not appear above.',
    'Could not save region. Check your connection and try again.',
    'Could not detect location. Enter your area manually.',
  ],
  ko: [
    '현재 위치 사용',
    '위치 확인 중…',
    'GPS 또는 IP로 지역을 제안합니다.',
    '직접 입력',
    '예: 수원 영통구 또는 서울 강남구',
    '위에 없다면 지역을 직접 입력하세요.',
    '지역을 저장하지 못했습니다. 연결을 확인한 뒤 다시 시도하세요.',
    '위치를 찾지 못했습니다. 지역을 직접 입력하세요.',
  ],
  zh: [
    '使用当前位置',
    '正在定位…',
    '我们使用 GPS 或 IP 建议您的地区。',
    '手动输入',
    '例如：首尔江南区 或 上海',
    '如果上方没有，请手动输入地区。',
    '无法保存地区。请检查连接后重试。',
    '无法检测位置。请手动输入地区。',
  ],
  ja: [
    '現在地を使う',
    '位置情報を取得中…',
    'GPSまたはIPでエリアを提案します。',
    '手動で入力',
    '例：東京・渋谷 または 大阪',
    '上にない場合はエリアを入力してください。',
    '地域を保存できませんでした。接続を確認して再試行してください。',
    '位置を取得できませんでした。手動で入力してください。',
  ],
  es: [
    'Usar ubicación actual',
    'Detectando ubicación…',
    'Usamos GPS o IP para sugerir tu zona.',
    'Introducir manualmente',
    'p. ej. Madrid o Barcelona',
    'Escribe tu zona si no aparece arriba.',
    'No se pudo guardar la zona. Revisa la conexión e inténtalo de nuevo.',
    'No se pudo detectar la ubicación. Introdúcela manualmente.',
  ],
  pt: [
    'Usar localização atual',
    'Detectando localização…',
    'Usamos GPS ou IP para sugerir sua área.',
    'Inserir manualmente',
    'ex.: Lisboa ou Porto',
    'Digite sua área se ela não aparecer acima.',
    'Não foi possível salvar a região. Verifique a conexão e tente de novo.',
    'Não foi possível detectar a localização. Insira manualmente.',
  ],
  fr: [
    'Utiliser la position actuelle',
    'Détection de la position…',
    'Nous utilisons le GPS ou l’IP pour suggérer votre zone.',
    'Saisir manuellement',
    'ex. : Paris ou Lyon',
    'Saisissez votre zone si elle n’apparaît pas ci-dessus.',
    'Impossible d’enregistrer la région. Vérifiez la connexion et réessayez.',
    'Impossible de détecter la position. Saisissez votre zone manuellement.',
  ],
  de: [
    'Aktuellen Standort nutzen',
    'Standort wird ermittelt…',
    'Wir nutzen GPS oder IP, um Ihre Region vorzuschlagen.',
    'Manuell eingeben',
    'z. B. Berlin oder München',
    'Geben Sie Ihre Region ein, wenn sie oben nicht erscheint.',
    'Region konnte nicht gespeichert werden. Verbindung prüfen und erneut versuchen.',
    'Standort konnte nicht ermittelt werden. Region manuell eingeben.',
  ],
  id: [
    'Gunakan lokasi saat ini',
    'Mendeteksi lokasi…',
    'Kami memakai GPS atau IP untuk menyarankan wilayah Anda.',
    'Masukkan secara manual',
    'mis. Jakarta atau Bandung',
    'Ketik wilayah Anda jika tidak muncul di atas.',
    'Gagal menyimpan wilayah. Periksa koneksi dan coba lagi.',
    'Gagal mendeteksi lokasi. Masukkan wilayah secara manual.',
  ],
  vi: [
    'Dùng vị trí hiện tại',
    'Đang xác định vị trí…',
    'Chúng tôi dùng GPS hoặc IP để gợi ý khu vực của bạn.',
    'Nhập thủ công',
    'vd: Hà Nội hoặc TP. Hồ Chí Minh',
    'Hãy nhập khu vực nếu không thấy ở trên.',
    'Không lưu được khu vực. Kiểm tra kết nối và thử lại.',
    'Không xác định được vị trí. Vui lòng nhập khu vực thủ công.',
  ],
  th: [
    'ใช้ตำแหน่งปัจจุบัน',
    'กำลังตรวจหาตำแหน่ง…',
    'เราใช้ GPS หรือ IP เพื่อแนะนำพื้นที่ของคุณ',
    'ป้อนด้วยตนเอง',
    'เช่น กรุงเทพฯ หรือ เชียงใหม่',
    'พิมพ์พื้นที่ของคุณหากไม่ปรากฏด้านบน',
    'บันทึกภูมิภาคไม่ได้ ตรวจสอบการเชื่อมต่อแล้วลองใหม่',
    'ตรวจหาตำแหน่งไม่ได้ กรุณาป้อนพื้นที่ด้วยตนเอง',
  ],
  hi: [
    'वर्तमान स्थान उपयोग करें',
    'स्थान ढूँढा जा रहा है…',
    'हम आपका क्षेत्र सुझाने के लिए GPS या IP का उपयोग करते हैं।',
    'मैन्युअल दर्ज करें',
    'उदा. मुंबई या दिल्ली',
    'अगर ऊपर न दिखे तो अपना क्षेत्र लिखें।',
    'क्षेत्र सहेजा नहीं जा सका। कनेक्शन जाँचकर फिर कोशिश करें।',
    'स्थान नहीं मिला। क्षेत्र मैन्युअल दर्ज करें।',
  ],
  ar: [
    'استخدام الموقع الحالي',
    'جارٍ تحديد الموقع…',
    'نستخدم GPS أو IP لاقتراح منطقتك.',
    'إدخال يدوي',
    'مثال: دبي أو الرياض',
    'اكتب منطقتك إذا لم تظهر أعلاه.',
    'تعذّر حفظ المنطقة. تحقّق من الاتصال وحاول مجددًا.',
    'تعذّر تحديد الموقع. أدخِل منطقتك يدويًا.',
  ],
  ru: [
    'Использовать текущее местоположение',
    'Определение местоположения…',
    'Мы используем GPS или IP, чтобы предложить ваш район.',
    'Ввести вручную',
    'напр. Москва или Санкт-Петербург',
    'Введите район, если его нет выше.',
    'Не удалось сохранить регион. Проверьте соединение и попробуйте снова.',
    'Не удалось определить местоположение. Введите район вручную.',
  ],
  tr: [
    'Mevcut konumu kullan',
    'Konum algılanıyor…',
    'Bölgenizi önermek için GPS veya IP kullanırız.',
    'Elle gir',
    'örn. İstanbul veya Ankara',
    'Yukarıda yoksa bölgenizi yazın.',
    'Bölge kaydedilemedi. Bağlantıyı kontrol edip tekrar deneyin.',
    'Konum algılanamadı. Bölgenizi elle girin.',
  ],
  it: [
    'Usa posizione attuale',
    'Rilevamento posizione…',
    'Usiamo GPS o IP per suggerire la tua zona.',
    'Inserisci manualmente',
    'es. Roma o Milano',
    'Digita la tua zona se non compare sopra.',
    'Impossibile salvare la regione. Controlla la connessione e riprova.',
    'Impossibile rilevare la posizione. Inseriscila manualmente.',
  ],
  pl: [
    'Użyj bieżącej lokalizacji',
    'Wykrywanie lokalizacji…',
    'Używamy GPS lub IP, aby zasugerować Twój obszar.',
    'Wpisz ręcznie',
    'np. Warszawa lub Kraków',
    'Wpisz swój obszar, jeśli nie ma go powyżej.',
    'Nie udało się zapisać regionu. Sprawdź połączenie i spróbuj ponownie.',
    'Nie udało się wykryć lokalizacji. Wpisz obszar ręcznie.',
  ],
  nl: [
    'Huidige locatie gebruiken',
    'Locatie wordt bepaald…',
    'We gebruiken GPS of IP om je regio voor te stellen.',
    'Handmatig invoeren',
    'bijv. Amsterdam of Rotterdam',
    'Typ je regio als deze hierboven niet verschijnt.',
    'Regio kon niet worden opgeslagen. Controleer de verbinding en probeer opnieuw.',
    'Locatie kon niet worden bepaald. Voer je regio handmatig in.',
  ],
  fil: [
    'Gamitin ang kasalukuyang lokasyon',
    'Kinukuha ang lokasyon…',
    'Gumagamit kami ng GPS o IP para imungkahi ang iyong lugar.',
    'Manu-manong ilagay',
    'hal. Manila o Cebu',
    'I-type ang iyong lugar kung hindi ito lumabas sa itaas.',
    'Hindi ma-save ang rehiyon. Suriin ang koneksyon at subukan ulit.',
    'Hindi ma-detect ang lokasyon. Ilagay ang lugar nang manu-mano.',
  ],
  uk: [
    'Використати поточне місцезнаходження',
    'Визначення місцезнаходження…',
    'Ми використовуємо GPS або IP, щоб запропонувати ваш район.',
    'Ввести вручну',
    'напр. Київ або Львів',
    'Введіть свій район, якщо його немає вище.',
    'Не вдалося зберегти регіон. Перевірте з’єднання і спробуйте знову.',
    'Не вдалося визначити місцезнаходження. Введіть район вручну.',
  ],
  bn: [
    'বর্তমান অবস্থান ব্যবহার করুন',
    'অবস্থান খোঁজা হচ্ছে…',
    'আপনার এলাকা সাজাতে আমরা GPS বা IP ব্যবহার করি।',
    'নিজে লিখুন',
    'যেমন ঢাকা বা চট্টগ্রাম',
    'উপরে না থাকলে আপনার এলাকা লিখুন।',
    'অঞ্চল সংরক্ষণ করা যায়নি। সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।',
    'অবস্থান পাওয়া যায়নি। এলাকা নিজে লিখুন।',
  ],
  ms: [
    'Gunakan lokasi semasa',
    'Mengesan lokasi…',
    'Kami menggunakan GPS atau IP untuk mencadangkan kawasan anda.',
    'Masukkan secara manual',
    'cth. Kuala Lumpur atau Penang',
    'Taip kawasan anda jika ia tidak muncul di atas.',
    'Tidak dapat menyimpan wilayah. Semak sambungan dan cuba lagi.',
    'Tidak dapat mengesan lokasi. Masukkan kawasan secara manual.',
  ],
  sw: [
    'Tumia eneo la sasa',
    'Inatafuta eneo…',
    'Tunatumia GPS au IP kupendekeza eneo lako.',
    'Ingiza mwenyewe',
    'mf. Nairobi au Mombasa',
    'Andika eneo lako ikiwa halionekani hapo juu.',
    'Imeshindwa kuhifadhi eneo. Angalia muunganisho kisha jaribu tena.',
    'Imeshindwa kugundua eneo. Ingiza eneo mwenyewe.',
  ],
  fa: [
    'استفاده از موقعیت فعلی',
    'در حال یافتن موقعیت…',
    'برای پیشنهاد منطقه از GPS یا IP استفاده می‌کنیم.',
    'ورود دستی',
    'مثلاً تهران یا اصفهان',
    'اگر بالا نبود منطقه را خودتان بنویسید.',
    'ذخیره منطقه ممکن نشد. اتصال را بررسی و دوباره تلاش کنید.',
    'موقعیت پیدا نشد. منطقه را دستی وارد کنید.',
  ],
  ur: [
    'موجودہ مقام استعمال کریں',
    'مقام معلوم کیا جا رہا ہے…',
    'ہم آپ کا علاقہ تجویز کرنے کے لیے GPS یا IP استعمال کرتے ہیں۔',
    'خود درج کریں',
    'مثلًا کراچی یا لاہور',
    'اگر اوپر نہ ہو تو اپنا علاقہ لکھیں۔',
    'علاقہ محفوظ نہیں ہو سکا۔ کنکشن چیک کر کے دوبارہ کوشش کریں۔',
    'مقام معلوم نہیں ہو سکا۔ علاقہ خود درج کریں۔',
  ],
};

for (const [lang, arr] of Object.entries(table)) {
  if (arr.length !== keys.length) throw new Error(`${lang}: ${arr.length} != ${keys.length}`);
}

let out = `/* Auto-generated by scripts/gen-region-i18n.mjs */
import type { AppLanguage } from '@/utils/languageStorage';

export type RegionMessageKey =
${keys.map((k) => `  | '${k}'`).join('\n')};

const REGION_MESSAGES: Record<AppLanguage, Record<RegionMessageKey, string>> = {\n`;

for (const lang of Object.keys(table)) {
  out += `  ${lang}: {\n`;
  keys.forEach((k, i) => {
    const v = table[lang][i].replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    out += `    ${k}: '${v}',\n`;
  });
  out += `  },\n`;
}
out += `};

export function regionT(lang: AppLanguage, key: RegionMessageKey): string {
  return REGION_MESSAGES[lang]?.[key] ?? REGION_MESSAGES.en[key] ?? key;
}
`;

const dest = path.join(__dirname, '../src/i18n/regionMessages.ts');
fs.writeFileSync(dest, out, 'utf8');
console.log('Wrote', dest);
