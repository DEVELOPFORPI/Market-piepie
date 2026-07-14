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
  createProfile: {
    en: 'Create profile', ko: '프로필 만들기', zh: '创建资料', ja: 'プロフィール作成',
    es: 'Crear perfil', pt: 'Criar perfil', fr: 'Créer un profil', de: 'Profil erstellen',
    id: 'Buat profil', vi: 'Tạo hồ sơ', th: 'สร้างโปรไฟล์', hi: 'प्रोफ़ाइल बनाएं',
    ar: 'إنشاء ملف شخصي', ru: 'Создать профиль', tr: 'Profil oluştur', it: 'Crea profilo',
    pl: 'Utwórz profil', nl: 'Profiel maken', fil: 'Gumawa ng profile', uk: 'Створити профіль',
    bn: 'প্রোফাইল তৈরি', ms: 'Cipta profil', sw: 'Unda wasifu', fa: 'ایجاد پروفایل',
    ur: 'پروفائل بنائیں',
  },
  setupProfileHint: {
    en: 'Set up the profile you will use in piepie.',
    ko: 'piepie에서 사용할 프로필을 설정해 주세요.',
    zh: '设置你在 piepie 使用的资料。',
    ja: 'piepieで使うプロフィールを設定しましょう。',
    es: 'Configura el perfil que usarás en piepie.',
    pt: 'Configure o perfil que você usará no piepie.',
    fr: 'Configurez le profil que vous utiliserez sur piepie.',
    de: 'Richte das Profil ein, das du in piepie nutzt.',
    id: 'Siapkan profil yang akan Anda gunakan di piepie.',
    vi: 'Thiết lập hồ sơ bạn sẽ dùng trên piepie.',
    th: 'ตั้งค่าโปรไฟล์ที่จะใช้ใน piepie',
    hi: 'piepie में उपयोग होने वाली प्रोफ़ाइल सेट करें।',
    ar: 'أعد الملف الشخصي الذي ستستخدمه في piepie.',
    ru: 'Настройте профиль, который будете использовать в piepie.',
    tr: 'piepie’de kullanacağınız profili ayarlayın.',
    it: 'Imposta il profilo che userai su piepie.',
    pl: 'Ustaw profil, którego będziesz używać w piepie.',
    nl: 'Stel het profiel in dat je in piepie gebruikt.',
    fil: 'I-set up ang profile na gagamitin mo sa piepie.',
    uk: 'Налаштуйте профіль, який використовуватимете в piepie.',
    bn: 'piepie-তে ব্যবহারের প্রোফাইল সেট করুন।',
    ms: 'Sediakan profil yang akan anda guna di piepie.',
    sw: 'Sanidi wasifu utakaotumia kwenye piepie.',
    fa: 'پروفایلی را که در piepie استفاده می‌کنید تنظیم کنید.',
    ur: 'piepie میں استعمال ہونے والی پروفائل سیٹ کریں۔',
  },
  chooseProfilePhoto: {
    en: 'Choose profile photo', ko: '프로필 사진 선택', zh: '选择头像', ja: 'プロフィール写真を選択',
    es: 'Elegir foto de perfil', pt: 'Escolher foto de perfil', fr: 'Choisir une photo de profil', de: 'Profilfoto wählen',
    id: 'Pilih foto profil', vi: 'Chọn ảnh hồ sơ', th: 'เลือกรูปโปรไฟล์', hi: 'प्रोफ़ाइल फ़ोटो चुनें',
    ar: 'اختر صورة الملف', ru: 'Выбрать фото профиля', tr: 'Profil fotoğrafı seç', it: 'Scegli foto profilo',
    pl: 'Wybierz zdjęcie profilowe', nl: 'Profielfoto kiezen', fil: 'Pumili ng profile photo', uk: 'Вибрати фото профілю',
    bn: 'প্রোফাইল ছবি বেছে নিন', ms: 'Pilih foto profil', sw: 'Chagua picha ya wasifu', fa: 'انتخاب عکس پروفایل',
    ur: 'پروفائل فوٹو چنیں',
  },
  profilePhotoOptional: {
    en: 'Profile photo (optional)', ko: '프로필 사진 (선택)', zh: '头像（可选）', ja: 'プロフィール写真（任意）',
    es: 'Foto de perfil (opcional)', pt: 'Foto de perfil (opcional)', fr: 'Photo de profil (facultatif)', de: 'Profilfoto (optional)',
    id: 'Foto profil (opsional)', vi: 'Ảnh hồ sơ (tuỳ chọn)', th: 'รูปโปรไฟล์ (ไม่บังคับ)', hi: 'प्रोफ़ाइल फ़ोटो (वैकल्पिक)',
    ar: 'صورة الملف (اختياري)', ru: 'Фото профиля (необязательно)', tr: 'Profil fotoğrafı (isteğe bağlı)', it: 'Foto profilo (facoltativa)',
    pl: 'Zdjęcie profilowe (opcjonalne)', nl: 'Profielfoto (optioneel)', fil: 'Profile photo (opsyonal)', uk: 'Фото профілю (необов’язково)',
    bn: 'প্রোফাইল ছবি (ঐচ্ছিক)', ms: 'Foto profil (pilihan)', sw: 'Picha ya wasifu (si lazima)', fa: 'عکس پروفایل (اختیاری)',
    ur: 'پروفائل فوٹو (اختیاری)',
  },
  nicknameLengthPh: {
    en: '2–20 characters', ko: '2–20자', zh: '2–20 个字符', ja: '2～20文字',
    es: '2–20 caracteres', pt: '2–20 caracteres', fr: '2–20 caractères', de: '2–20 Zeichen',
    id: '2–20 karakter', vi: '2–20 ký tự', th: '2–20 ตัวอักษร', hi: '2–20 अक्षर',
    ar: '2–20 حرفًا', ru: '2–20 символов', tr: '2–20 karakter', it: '2–20 caratteri',
    pl: '2–20 znaków', nl: '2–20 tekens', fil: '2–20 karakter', uk: '2–20 символів',
    bn: '২–২০ অক্ষর', ms: '2–20 aksara', sw: 'Herufi 2–20', fa: '۲–۲۰ کاراکتر',
    ur: '۲–۲۰ حروف',
  },
  bioOptionalPh: {
    en: 'One-line bio (optional)', ko: '한 줄 소개 (선택)', zh: '一句话简介（可选）', ja: 'ひとこと自己紹介（任意）',
    es: 'Bio de una línea (opcional)', pt: 'Bio de uma linha (opcional)', fr: 'Bio en une ligne (facultatif)', de: 'Einzeilige Bio (optional)',
    id: 'Bio satu baris (opsional)', vi: 'Giới thiệu một dòng (tuỳ chọn)', th: 'แนะนำตัวสั้น ๆ (ไม่บังคับ)', hi: 'एक पंक्ति बायो (वैकल्पिक)',
    ar: 'نبذة بسطر واحد (اختياري)', ru: 'Краткое био (необязательно)', tr: 'Tek satır bio (isteğe bağlı)', it: 'Bio in una riga (facoltativa)',
    pl: 'Jednoliniowe bio (opcjonalne)', nl: 'Antregelige bio (optioneel)', fil: 'Isang-linyang bio (opsyonal)', uk: 'Коротке біо (необов’язково)',
    bn: 'এক লাইনের বায়ো (ঐচ্ছিক)', ms: 'Bio satu baris (pilihan)', sw: 'Bio ya mstari mmoja (si lazima)', fa: 'بیوی یک‌خطی (اختیاری)',
    ur: 'ایک لائن تعارف (اختیاری)',
  },
  areaLabel: {
    en: 'Area', ko: '활동 지역', zh: '活动地区', ja: '活動エリア',
    es: 'Área', pt: 'Área', fr: 'Zone', de: 'Gebiet',
    id: 'Area', vi: 'Khu vực', th: 'พื้นที่', hi: 'क्षेत्र',
    ar: 'المنطقة', ru: 'Район', tr: 'Bölge', it: 'Zona',
    pl: 'Obszar', nl: 'Gebied', fil: 'Lugar', uk: 'Район',
    bn: 'এলাকা', ms: 'Kawasan', sw: 'Eneo', fa: 'منطقه',
    ur: 'علاقہ',
  },
  nicknameMin2: {
    en: 'Nickname must be at least 2 characters.',
    ko: '닉네임은 2자 이상이어야 합니다.',
    zh: '昵称至少需要 2 个字符。',
    ja: 'ニックネームは2文字以上にしてください。',
    es: 'El apodo debe tener al menos 2 caracteres.',
    pt: 'O apelido deve ter pelo menos 2 caracteres.',
    fr: 'Le pseudonyme doit contenir au moins 2 caractères.',
    de: 'Der Spitzname muss mindestens 2 Zeichen haben.',
    id: 'Nama panggilan minimal 2 karakter.',
    vi: 'Biệt danh phải có ít nhất 2 ký tự.',
    th: 'ชื่อเล่นต้องมีอย่างน้อย 2 ตัวอักษร',
    hi: 'उपनाम कम से कम 2 अक्षर का होना चाहिए।',
    ar: 'يجب أن يكون الاسم المستعار حرفين على الأقل.',
    ru: 'Никнейм должен быть не короче 2 символов.',
    tr: 'Takma ad en az 2 karakter olmalı.',
    it: 'Il nickname deve avere almeno 2 caratteri.',
    pl: 'Pseudonim musi mieć co najmniej 2 znaki.',
    nl: 'Bijnaam moet minstens 2 tekens hebben.',
    fil: 'Ang palayaw ay dapat hindi bababa sa 2 character.',
    uk: 'Нікнейм має містити щонайменше 2 символи.',
    bn: 'নিকনেম কমপক্ষে ২ অক্ষরের হতে হবে।',
    ms: 'Nama panggilan mestilah sekurang-kurangnya 2 aksara.',
    sw: 'Jina la utani lazima liwe na herufi angalau 2.',
    fa: 'نام مستعار باید حداقل ۲ کاراکتر باشد.',
    ur: 'عرفی نام کم از کم ۲ حروف کا ہونا چاہیے۔',
  },
  nicknameMax20: {
    en: 'Nickname must be 20 characters or fewer.',
    ko: '닉네임은 20자 이하여야 합니다.',
    zh: '昵称最多 20 个字符。',
    ja: 'ニックネームは20文字以内にしてください。',
    es: 'El apodo debe tener 20 caracteres o menos.',
    pt: 'O apelido deve ter no máximo 20 caracteres.',
    fr: 'Le pseudonyme doit contenir 20 caractères ou moins.',
    de: 'Der Spitzname darf höchstens 20 Zeichen haben.',
    id: 'Nama panggilan maksimal 20 karakter.',
    vi: 'Biệt danh tối đa 20 ký tự.',
    th: 'ชื่อเล่นต้องไม่เกิน 20 ตัวอักษร',
    hi: 'उपनाम 20 अक्षर या उससे कम होना चाहिए।',
    ar: 'يجب ألا يزيد الاسم المستعار عن 20 حرفًا.',
    ru: 'Никнейм должен быть не длиннее 20 символов.',
    tr: 'Takma ad en fazla 20 karakter olmalı.',
    it: 'Il nickname deve avere al massimo 20 caratteri.',
    pl: 'Pseudonim może mieć najwyżej 20 znaków.',
    nl: 'Bijnaam mag maximaal 20 tekens hebben.',
    fil: 'Ang palayaw ay dapat 20 character o mas kaunti.',
    uk: 'Нікнейм має містити не більше 20 символів.',
    bn: 'নিকনেম সর্বোচ্চ ২০ অক্ষরের হতে হবে।',
    ms: 'Nama panggilan mestilah 20 aksara atau kurang.',
    sw: 'Jina la utani lazima liwe herufi 20 au chache.',
    fa: 'نام مستعار باید حداکثر ۲۰ کاراکتر باشد.',
    ur: 'عرفی نام زیادہ سے زیادہ ۲۰ حروف کا ہونا چاہیے۔',
  },
  saving: {
    en: 'Saving...', ko: '저장 중...', zh: '保存中...', ja: '保存中...',
    es: 'Guardando...', pt: 'Salvando...', fr: 'Enregistrement...', de: 'Speichern...',
    id: 'Menyimpan...', vi: 'Đang lưu...', th: 'กำลังบันทึก...', hi: 'सहेजा जा रहा है...',
    ar: 'جارٍ الحفظ...', ru: 'Сохранение...', tr: 'Kaydediliyor...', it: 'Salvataggio...',
    pl: 'Zapisywanie...', nl: 'Opslaan...', fil: 'Sineseave...', uk: 'Збереження...',
    bn: 'সংরক্ষণ হচ্ছে...', ms: 'Menyimpan...', sw: 'Inahifadhi...', fa: 'در حال ذخیره...',
    ur: 'محفوظ ہو رہا ہے...',
  },
  getStarted: {
    en: 'Get started', ko: '시작하기', zh: '开始使用', ja: 'はじめる',
    es: 'Empezar', pt: 'Começar', fr: 'Commencer', de: 'Loslegen',
    id: 'Mulai', vi: 'Bắt đầu', th: 'เริ่มต้น', hi: 'शुरू करें',
    ar: 'ابدأ', ru: 'Начать', tr: 'Başla', it: 'Inizia',
    pl: 'Zaczynamy', nl: 'Aan de slag', fil: 'Magsimula', uk: 'Почати',
    bn: 'শুরু করুন', ms: 'Mulakan', sw: 'Anza', fa: 'شروع کنید',
    ur: 'شروع کریں',
  },
  defaultBio: {
    en: 'I value safe, quick trades.',
    ko: '안전하고 빠른 거래를 지향합니다.',
    zh: '我重视安全、快捷的交易。',
    ja: '安全でスピーディーな取引を大切にしています。',
    es: 'Valoro tratos seguros y rápidos.',
    pt: 'Valorizo negócios seguros e rápidos.',
    fr: 'J’apprécie les échanges sûrs et rapides.',
    de: 'Mir sind sichere, schnelle Deals wichtig.',
    id: 'Saya menghargai transaksi aman dan cepat.',
    vi: 'Tôi coi trọng giao dịch sáng.safe và nhanh.',
    th: 'ฉันให้ความสำคัญกับธุรกรรมที่ปลอดภัยและรวดเร็ว',
    hi: 'मैं सुरक्षित, तेज़ लेन-देन को महत्व देता/देती हूँ।',
    ar: 'أُقدّر الصفقات الآمنة والسريعة.',
    ru: 'Ценю безопасные и быстрые сделки.',
    tr: 'Güvenli, hızlı ticarete önem veririm.',
    it: 'Valoro scambi sicuri e rapidi.',
    pl: 'Cenię bezpieczne i szybkie transakcje.',
    nl: 'Ik hecht aan veilige, snelle deals.',
    fil: 'Pinahahalagahan ko ang ligtas at mabilis na trade.',
    uk: 'Ціную безпечні й швидкі угоди.',
    bn: 'আমি নিরাপদ, দ্রুত লেনদেনকে গুরুত্ব দিই।',
    ms: 'Saya menghargai dagangan yang selamat dan pantas.',
    sw: 'Nathamini biashara salama na za haraka.',
    fa: 'به معاملات امن و سریع اهمیت می‌دهم.',
    ur: 'میں محفوظ، تیز لین دین کو اہمیت دیتا/دیتی ہوں۔',
  },
};

// Fix typo in Vietnamese
entries.defaultBio.vi = 'Tôi coi trọng giao dịch an toàn và nhanh.';

const keys = Object.keys(entries);
for (const k of keys) {
  for (const lang of LANGS) {
    if (!entries[k][lang]) {
      console.error(`Missing ${lang} for ${k}`);
      process.exit(1);
    }
  }
}

let out = `/* Auto-generated by scripts/gen-signup-profile-i18n.mjs */
import type { AppLanguage } from '@/utils/languageStorage';

export type SignupProfileMessageKey =
${keys.map((k) => `  | '${k}'`).join('\n')};

const SIGNUP_PROFILE_MESSAGES: Record<AppLanguage, Record<SignupProfileMessageKey, string>> = {\n`;

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

export function signupProfileT(
  lang: AppLanguage,
  key: SignupProfileMessageKey,
  vars?: Record<string, string | number>,
): string {
  const raw = SIGNUP_PROFILE_MESSAGES[lang]?.[key] ?? SIGNUP_PROFILE_MESSAGES.en[key] ?? key;
  if (!vars) return raw;
  return Object.entries(vars).reduce(
    (s, [k, v]) => s.split('{' + k + '}').join(String(v)),
    raw,
  );
}
`;

fs.writeFileSync(path.join(__dirname, '../src/i18n/signupProfileMessages.ts'), out, 'utf8');
console.log('Wrote signupProfileMessages.ts', keys.length, 'keys');
