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
  nicknameLabel: {
    en: 'Nickname', ko: '닉네임', zh: '昵称', ja: 'ニックネーム',
    es: 'Apodo', pt: 'Apelido', fr: 'Pseudonyme', de: 'Spitzname',
    id: 'Nama panggilan', vi: 'Biệt danh', th: 'ชื่อเล่น', hi: 'उपनाम',
    ar: 'الاسم المستعار', ru: 'Никнейм', tr: 'Takma ad', it: 'Nickname',
    pl: 'Pseudonim', nl: 'Bijnaam', fil: 'Palayaw', uk: 'Нікнейм',
    bn: 'নিকনেম', ms: 'Nama panggilan', sw: 'Jina la utani', fa: 'نام مستعار',
    ur: 'عرفی نام',
  },
  bioLabel: {
    en: 'Bio', ko: '소개', zh: '简介', ja: '自己紹介',
    es: 'Bio', pt: 'Bio', fr: 'Bio', de: 'Bio',
    id: 'Bio', vi: 'Giới thiệu', th: 'เกี่ยวกับฉัน', hi: 'बायो',
    ar: 'نبذة', ru: 'О себе', tr: 'Biyografi', it: 'Bio',
    pl: 'Bio', nl: 'Bio', fil: 'Bio', uk: 'Про себе',
    bn: 'বায়ো', ms: 'Bio', sw: 'Wasifu', fa: 'بیو',
    ur: 'تعارف',
  },
  regionLabel: {
    en: 'Region', ko: '지역', zh: '地区', ja: '地域',
    es: 'Región', pt: 'Região', fr: 'Région', de: 'Region',
    id: 'Wilayah', vi: 'Khu vực', th: 'พื้นที่', hi: 'क्षेत्र',
    ar: 'المنطقة', ru: 'Регион', tr: 'Bölge', it: 'Regione',
    pl: 'Region', nl: 'Regio', fil: 'Rehiyon', uk: 'Регіон',
    bn: 'অঞ্চল', ms: 'Wilayah', sw: 'Eneo', fa: 'منطقه',
    ur: 'علاقہ',
  },
  nicknamePlaceholder: {
    en: 'Enter nickname', ko: '닉네임을 입력하세요', zh: '输入昵称', ja: 'ニックネームを入力',
    es: 'Escribe un apodo', pt: 'Digite o apelido', fr: 'Entrez un pseudonyme', de: 'Spitzname eingeben',
    id: 'Masukkan nama panggilan', vi: 'Nhập biệt danh', th: 'ใส่ชื่อเล่น', hi: 'उपनाम दर्ज करें',
    ar: 'أدخل الاسم المستعار', ru: 'Введите никнейм', tr: 'Takma ad girin', it: 'Inserisci nickname',
    pl: 'Wpisz pseudonim', nl: 'Voer bijnaam in', fil: 'Ilagay ang palayaw', uk: 'Введіть нікнейм',
    bn: 'নিকনেম লিখুন', ms: 'Masukkan nama panggilan', sw: 'Andika jina la utani', fa: 'نام مستعار را وارد کنید',
    ur: 'عرفی نام درج کریں',
  },
  bioPlaceholder: {
    en: 'Tell others about yourself', ko: '자신을 소개해 주세요', zh: '向其他人介绍自己', ja: '自己紹介を書いてください',
    es: 'Cuéntales a otros sobre ti', pt: 'Conte sobre você', fr: 'Parlez de vous', de: 'Erzähl etwas über dich',
    id: 'Ceritakan tentang diri Anda', vi: 'Giới thiệu bản thân', th: 'เล่าเกี่ยวกับตัวคุณ', hi: 'अपने बारे में बताएं',
    ar: 'عرّف بنفسك للآخرين', ru: 'Расскажите о себе', tr: 'Kendinizden bahsedin', it: 'Parla di te',
    pl: 'Opowiedz o sobie', nl: 'Vertel iets over jezelf', fil: 'Sabihin ang tungkol sa iyo', uk: 'Розкажіть про себе',
    bn: 'নিজের সম্পর্কে বলুন', ms: 'Ceritakan tentang diri anda', sw: 'Waambie wengine kujihusu', fa: 'درباره خود بگویید',
    ur: 'اپنے بارے میں بتائیں',
  },
  save: {
    en: 'Save', ko: '저장', zh: '保存', ja: '保存',
    es: 'Guardar', pt: 'Salvar', fr: 'Enregistrer', de: 'Speichern',
    id: 'Simpan', vi: 'Lưu', th: 'บันทึก', hi: 'सहेजें',
    ar: 'حفظ', ru: 'Сохранить', tr: 'Kaydet', it: 'Salva',
    pl: 'Zapisz', nl: 'Opslaan', fil: 'I-save', uk: 'Зберегти',
    bn: 'সংরক্ষণ', ms: 'Simpan', sw: 'Hifadhi', fa: 'ذخیره',
    ur: 'محفوظ',
  },
  discardUnsavedConfirm: {
    en: 'You have unsaved changes. Discard them?',
    ko: '저장하지 않은 변경사항이 있습니다. 되돌릴까요?',
    zh: '有未保存的更改。要放弃吗？',
    ja: '未保存の変更があります。破棄しますか？',
    es: 'Tienes cambios sin guardar. ¿Descartarlos?',
    pt: 'Há alterações não salvas. Descartar?',
    fr: 'Modifications non enregistrées. Les abandonner ?',
    de: 'Ungespeicherte Änderungen. Verwerfen?',
    id: 'Ada perubahan belum disimpan. Buang?',
    vi: 'Có thay đổi chưa lưu. Hủy bỏ?',
    th: 'มีการเปลี่ยนแปลงที่ยังไม่บันทึก ละทิ้งหรือไม่?',
    hi: 'असहेजे बदलाव हैं। छोड़ें?',
    ar: 'لديك تغييرات غير محفوظة. هل تتجاهلها؟',
    ru: 'Есть несохранённые изменения. Отменить?',
    tr: 'Kaydedilmemiş değişiklikler var. Vazgeçilsin mi?',
    it: 'Modifiche non salvate. Scartarle?',
    pl: 'Masz niezapisane zmiany. Odrzucić?',
    nl: 'Je hebt niet-opgeslagen wijzigingen. Weggooien?',
    fil: 'May hindi na-save na mga pagbabago. I-discard?',
    uk: 'Є незбережені зміни. Відхилити?',
    bn: 'অসংরক্ষিত পরিবর্তন আছে। বাতিল করবেন?',
    ms: 'Ada perubahan belum disimpan. Buang?',
    sw: 'Una mabadiliko yasiyohifadhiwa. Yatupwe?',
    fa: 'تغییرات ذخیره‌نشده دارید. دور ریخته شوند؟',
    ur: 'غیر محفوظ تبدیلیاں ہیں۔ مسترد کریں؟',
  },
  discardUnsaved: {
    en: 'Leave', ko: '나가기', zh: '离开', ja: '離れる',
    es: 'Salir', pt: 'Sair', fr: 'Quitter', de: 'Verlassen',
    id: 'Keluar', vi: 'Rời đi', th: 'ออก', hi: 'छोड़ें',
    ar: 'مغادرة', ru: 'Уйти', tr: 'Çık', it: 'Esci',
    pl: 'Wyjdź', nl: 'Verlaten', fil: 'Umalis', uk: 'Вийти',
    bn: 'বেরোন', ms: 'Keluar', sw: 'Toka', fa: 'خروج',
    ur: 'باہر نکلیں',
  },
  couldNotSaveProfile: {
    en: 'Could not save profile to server. Check your connection and try again.',
    ko: '프로필을 서버에 저장하지 못했습니다. 연결을 확인하고 다시 시도해 주세요.',
    zh: '无法将资料保存到服务器，请检查网络后重试。',
    ja: 'プロフィールをサーバーに保存できませんでした。接続を確認して再試行してください。',
    es: 'No se pudo guardar el perfil. Comprueba la conexión e inténtalo de nuevo.',
    pt: 'Não foi possível salvar o perfil. Verifique a conexão e tente novamente.',
    fr: 'Impossible d’enregistrer le profil. Vérifiez la connexion et réessayez.',
    de: 'Profil konnte nicht gespeichert werden. Verbindung prüfen und erneut versuchen.',
    id: 'Tidak dapat menyimpan profil. Periksa koneksi dan coba lagi.',
    vi: 'Không lưu được hồ sơ. Kiểm tra kết nối và thử lại.',
    th: 'บันทึกโปรไฟล์ไม่ได้ ตรวจการเชื่อมต่อแล้วลองใหม่',
    hi: 'प्रोफ़ाइल सहेजी नहीं जा सकी। कनेक्शन जांचें।',
    ar: 'تعذر حفظ الملف الشخصي. تحقق من الاتصال وحاول مرة أخرى.',
    ru: 'Не удалось сохранить профиль. Проверьте соединение.',
    tr: 'Profil kaydedilemedi. Bağlantınızı kontrol edin.',
    it: 'Impossibile salvare il profilo. Controlla la connessione.',
    pl: 'Nie udało się zapisać profilu. Sprawdź połączenie.',
    nl: 'Profiel kon niet worden opgeslagen. Controleer je verbinding.',
    fil: 'Hindi ma-save ang profile. Suriin ang koneksyon.',
    uk: 'Не вдалося зберегти профіль. Перевірте з’єднання.',
    bn: 'প্রোফাইল সংরক্ষণ যায়নি। সংযোগ পরীক্ষা করুন।',
    ms: 'Tidak dapat simpan profil. Semak sambungan.',
    sw: 'Imeshindwa kuhifadhi wasifu. Angalia muunganisho.',
    fa: 'ذخیره پروفایل ممکن نشد. اتصال را بررسی کنید.',
    ur: 'پروفائل محفوظ نہ ہو سکی۔ کنکشن چیک کریں۔',
  },
  profileAlt: {
    en: 'Profile', ko: '프로필', zh: '资料', ja: 'プロフィール',
    es: 'Perfil', pt: 'Perfil', fr: 'Profil', de: 'Profil',
    id: 'Profil', vi: 'Hồ sơ', th: 'โปรไฟล์', hi: 'प्रोफ़ाइल',
    ar: 'الملف', ru: 'Профиль', tr: 'Profil', it: 'Profilo',
    pl: 'Profil', nl: 'Profiel', fil: 'Profile', uk: 'Профіль',
    bn: 'প্রোফাইল', ms: 'Profil', sw: 'Wasifu', fa: 'پروفایل',
    ur: 'پروفائل',
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

let out = `/* Auto-generated by scripts/gen-profile-edit-i18n.mjs */
import type { AppLanguage } from '@/utils/languageStorage';

export type ProfileEditMessageKey =
${keys.map((k) => `  | '${k}'`).join('\n')};

const PROFILE_EDIT_MESSAGES: Record<AppLanguage, Record<ProfileEditMessageKey, string>> = {\n`;

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

export function profileEditT(
  lang: AppLanguage,
  key: ProfileEditMessageKey,
  vars?: Record<string, string | number>,
): string {
  const raw = PROFILE_EDIT_MESSAGES[lang]?.[key] ?? PROFILE_EDIT_MESSAGES.en[key] ?? key;
  if (!vars) return raw;
  return Object.entries(vars).reduce(
    (s, [k, v]) => s.split('{' + k + '}').join(String(v)),
    raw,
  );
}
`;

fs.writeFileSync(path.join(__dirname, '../src/i18n/profileEditMessages.ts'), out, 'utf8');
console.log('Wrote profileEditMessages.ts', keys.length, 'keys');
