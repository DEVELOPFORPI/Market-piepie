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
  badge01: {
    en: 'First deal', ko: '첫 거래', zh: '第一笔成交', ja: '初めての取引',
    es: 'Primer trato', pt: 'Primeiro negócio', fr: 'Premier échange', de: 'Erster Deal',
    id: 'Transaksi pertama', vi: 'Giao dịch đầu', th: 'ดีลแรก', hi: 'पहला सौदा',
    ar: 'أول صفقة', ru: 'Первая сделка', tr: 'İlk anlaşma', it: 'Primo affare',
    pl: 'Pierwsza transakcja', nl: 'Eerste deal', fil: 'Unang deal', uk: 'Перша угода',
    bn: 'প্রথম ডিল', ms: 'Urus niaga pertama', sw: 'Biashara ya kwanza', fa: 'اولین معامله',
    ur: 'پہلا سودا',
  },
  badge02: {
    en: 'Chat starter', ko: '채팅 시작', zh: '聊天开场', ja: 'チャットスタート',
    es: 'Inicio de chat', pt: 'Início de chat', fr: 'Début de chat', de: 'Chat-Starter',
    id: 'Pemula chat', vi: 'Bắt đầu chat', th: 'เริ่มแชท', hi: 'चैट शुरू',
    ar: 'بدء المحادثة', ru: 'Старт чата', tr: 'Sohbet başlatıcı', it: 'Avvio chat',
    pl: 'Start czatu', nl: 'Chatstarter', fil: 'Simula ng chat', uk: 'Старт чату',
    bn: 'চ্যাট শুরু', ms: 'Mula sembang', sw: 'Anza gumzo', fa: 'شروع گفتگو',
    ur: 'چیٹ شروع',
  },
  badge03: {
    en: 'Word of mouth', ko: '입소문', zh: '口碑传播', ja: '口コミ',
    es: 'Boca a boca', pt: 'Boca a boca', fr: 'Bouche à oreille', de: 'Mundpropaganda',
    id: 'Dari mulut ke mulut', vi: 'Truyền miệng', th: 'ปากต่อปาก', hi: 'मुंहज़बानी',
    ar: 'كلام الناس', ru: 'Сарафанное радио', tr: 'Kulaktan kulağa', it: 'Passaparola',
    pl: 'Poczta pantoflowa', nl: 'Mond-tot-mond', fil: 'Salita ng bayan', uk: 'З уст в уста',
    bn: 'মুখে মুখে', ms: 'Mulut ke mulut', sw: 'Kwa midomo', fa: 'دهان‌به‌دهان',
    ur: 'منہ زبانی',
  },
  badge04: {
    en: 'First stroke', ko: '첫 글', zh: '首篇帖子', ja: '初めての投稿',
    es: 'Primer escrito', pt: 'Primeiro escrito', fr: 'Premier texte', de: 'Erster Beitrag',
    id: 'Tulisan pertama', vi: 'Bài đầu tiên', th: 'โพสต์แรก', hi: 'पहली पोस्ट',
    ar: 'أول منشور', ru: 'Первый пост', tr: 'İlk yazı', it: 'Primo post',
    pl: 'Pierwszy wpis', nl: 'Eerste post', fil: 'Unang post', uk: 'Перший допис',
    bn: 'প্রথম লেখ', ms: 'Tulisan pertama', sw: 'Chapisho la kwanza', fa: 'اولین نوشته',
    ur: 'پہلی تحریر',
  },
  badge05: {
    en: 'Wordsmith', ko: '글솜씨', zh: '文字巧匠', ja: '言葉の職人',
    es: 'Maestro de palabras', pt: 'Mestre das palavras', fr: 'Plume fine', de: 'Wortkünstler',
    id: 'Pengrajin kata', vi: 'Bậc thầy chữ', th: 'มือเขียน', hi: 'शब्दशिल्पी',
    ar: 'صائغ الكلام', ru: 'Мастер слова', tr: 'Kelime ustası', it: 'Maestro di parole',
    pl: 'Mistrz słowa', nl: 'Woordsmeder', fil: 'Salitang husay', uk: 'Майстер слова',
    bn: 'শব্দশিল্পী', ms: 'Pakar kata', sw: 'Fundi wa maneno', fa: 'استاد واژه',
    ur: 'لفظ ساز',
  },
  badge06: {
    en: 'Power writer', ko: '파워 라이터', zh: '创作达人', ja: 'パワーライター',
    es: 'Escritor pro', pt: 'Escritor poderoso', fr: 'Plume énergique', de: 'Power-Autor',
    id: 'Penulis andal', vi: 'Cây viết mạnh', th: 'นักเขียนพลัง', hi: 'पावर राइटर',
    ar: 'كاتب قوي', ru: 'Сильный автор', tr: 'Güçlü yazar', it: 'Scrittore pro',
    pl: 'Potężny autor', nl: 'Power schrijver', fil: 'Power writer', uk: 'Потужний автор',
    bn: 'পাওয়ার লেখক', ms: 'Penulis kuasa', sw: 'Mwandishi hodari', fa: 'نویسنده قدرتمند',
    ur: 'پاور رائٹر',
  },
  badge07: {
    en: 'Sharing newbie', ko: '나눔 새내기', zh: '分享新手', ja: 'シェア初心者',
    es: 'Novato en regalos', pt: 'Iniciante em doações', fr: 'Débutant du don', de: 'Teilen-Neuling',
    id: 'Pemula berbagi', vi: 'Newbie chia sẻ', th: 'มือใหม่แจก', hi: 'शेयर नौसिखिया',
    ar: 'مبتدئ المشاركة', ru: 'Новичок шаринга', tr: 'Paylaşım acemisi', it: 'Novizio del regalo',
    pl: 'Nowicjusz oddawania', nl: 'Deel-beginner', fil: 'Baguhang share', uk: 'Новачок шерингу',
    bn: 'শেয়ার নতুন', ms: 'Pemula kongsi', sw: 'Anayeanza kushiriki', fa: 'تازه‌کار اشتراک',
    ur: 'شیئر نوآموز',
  },
  badge08: {
    en: 'Warm hands', ko: '따뜻한 손', zh: '温暖的手', ja: '温かい手',
    es: 'Manos cálidas', pt: 'Mãos quentes', fr: 'Mains chaleureuses', de: 'Warme Hände',
    id: 'Tangan hangat', vi: 'Bàn tay ấm', th: 'มืออบอุ่น', hi: 'गर्म हाथ',
    ar: 'أيدي دافئة', ru: 'Тёплые руки', tr: 'Sıcak eller', it: 'Mani calde',
    pl: 'Ciepłe dłonie', nl: 'Warme handen', fil: 'Mainit na kamay', uk: 'Теплі руки',
    bn: 'উষ্ণ হাত', ms: 'Tangan mesra', sw: 'Mikono yenye joto', fa: 'دست‌های گرم',
    ur: 'گرم ہاتھ',
  },
  badge09: {
    en: 'Kind neighbor', ko: '착한 이웃', zh: '友善邻居', ja: '優しい隣人',
    es: 'Vecino amable', pt: 'Vizinho gentil', fr: 'Voisin bienveillant', de: 'Netter Nachbar',
    id: 'Tetangga baik', vi: 'Hàng xóm tốt', th: 'เพื่อนบ้านใจดี', hi: 'दयालु पड़ोसी',
    ar: 'جار لطيف', ru: 'Добрый сосед', tr: 'Nazik komşu', it: 'Vicino gentile',
    pl: 'Miły sąsiad', nl: 'Vriendelijke buur', fil: 'Mabait na kapitbahay', uk: 'Добрий сусід',
    bn: 'দয়ালু প্রতিবেশী', ms: 'Jiran baik', sw: 'Jirani mwenye fadhili', fa: 'همسایه مهربان',
    ur: 'مہربان پڑوسی',
  },
  badge10: {
    en: 'Sharing angel', ko: '나눔 천사', zh: '分享天使', ja: 'シェアの天使',
    es: 'Ángel del regalo', pt: 'Anjo da doação', fr: 'Ange du don', de: 'Engel des Teilens',
    id: 'Malaikat berbagi', vi: 'Thiên thần chia sẻ', th: 'เทพแห่งการแจก', hi: 'शेयर देवदूत',
    ar: 'ملاك المشاركة', ru: 'Ангел шаринга', tr: 'Paylaşım meleği', it: 'Angelo del regalo',
    pl: 'Anioł oddawania', nl: 'Deelengel', fil: 'Sharing angel', uk: 'Ангел шерингу',
    bn: 'শেয়ার দেবদূত', ms: 'Malaikat kongsi', sw: 'Malaika wa kushiriki', fa: 'فرشته اشتراک',
    ur: 'شیئر فرشتہ',
  },
  badge11: {
    en: 'Giveaway champ', ko: '나눔 챔피언', zh: '赠送冠军', ja: 'シェア王',
    es: 'Campeón de regalos', pt: 'Campeão de doações', fr: 'Champion du don', de: 'Verschenk-Champion',
    id: 'Juara giveaway', vi: 'Quán quân chia sẻ', th: 'แชมป์แจก', hi: 'गिवअवे चैंपियन',
    ar: 'بطل العطاء', ru: 'Чемпион раздач', tr: 'Hediye şampiyonu', it: 'Campione dei regali',
    pl: 'Mistrz oddawania', nl: 'Giveaway-kampioen', fil: 'Giveaway champ', uk: 'Чемпіон роздач',
    bn: 'গিভেওয়ে চ্যাম্প', ms: 'Juara giveaway', sw: 'Bingwa wa kutoa', fa: 'قهرمان هدیه',
    ur: 'گیو اوے چیمپ',
  },
  badge12: {
    en: 'Badge rookie', ko: '배지 새내기', zh: '徽章新手', ja: 'バッジ初心者',
    es: 'Novato de insignias', pt: 'Iniciante em emblemas', fr: 'Débutant badges', de: 'Abzeichen-Neuling',
    id: 'Pemula lencana', vi: 'Newbie huy hiệu', th: 'มือใหม่แบดจ์', hi: 'बैज नौसिखिया',
    ar: 'مبتدئ الشارات', ru: 'Новичок бейджей', tr: 'Rozet acemisi', it: 'Novizio badge',
    pl: 'Nowicjusz odznak', nl: 'Badge-beginner', fil: 'Baguhang badge', uk: 'Новачок бейджів',
    bn: 'ব্যাজ নতুন', ms: 'Pemula lencana', sw: 'Anayeanza beji', fa: 'تازه‌کار نشان',
    ur: 'بیج نوآموز',
  },
  badge13: {
    en: 'Badge fan', ko: '배지 팬', zh: '徽章粉丝', ja: 'バッジファン',
    es: 'Fan de insignias', pt: 'Fã de emblemas', fr: 'Fan de badges', de: 'Abzeichen-Fan',
    id: 'Penggemar lencana', vi: 'Fan huy hiệu', th: 'แฟนแบดจ์', hi: 'बैज फैन',
    ar: 'محب الشارات', ru: 'Фан бейджей', tr: 'Rozet hayranı', it: 'Fan dei badge',
    pl: 'Fan odznak', nl: 'Badge-fan', fil: 'Badge fan', uk: 'Фан бейджів',
    bn: 'ব্যাজ ফ্যান', ms: 'Peminat lencana', sw: 'Shabiki wa beji', fa: 'طرفدار نشان',
    ur: 'بیج فین',
  },
  badge14: {
    en: 'Excitement alert', ko: '설렘 경보', zh: '兴奋警报', ja: 'ワクワク警報',
    es: 'Alerta de emoción', pt: 'Alerta de empolgação', fr: 'Alerte excitation', de: 'Aufregungsalarm',
    id: 'Peringatan antusias', vi: 'Cảnh báo hứng khởi', th: 'แจ้งเตือนความตื่นเต้น', hi: 'उत्साह अलर्ट',
    ar: 'تنبيه الحماس', ru: 'Тревога азарта', tr: 'Heyecan alarmı', it: 'Allerta entusiasmo',
    pl: 'Alert ekscytacji', nl: 'Opwindingsalarm', fil: 'Excitement alert', uk: 'Сигнал захоплення',
    bn: 'উত্তেজনা অ্যালার্ট', ms: 'Amaran keseronokan', sw: 'Tahadhari ya msisimko', fa: 'هشدار هیجان',
    ur: 'جوش الاٹ',
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

let out = `/* Auto-generated by scripts/gen-badge-name-i18n.mjs */
import type { AppLanguage } from '@/utils/languageStorage';

export type BadgeNameMessageKey =
${keys.map((k) => `  | '${k}'`).join('\n')};

const BADGE_NAME_MESSAGES: Record<AppLanguage, Record<BadgeNameMessageKey, string>> = {\n`;

for (const lang of LANGS) {
  out += `  ${lang}: {\n`;
  for (const k of keys) {
    const v = entries[k][lang]
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'");
    out += `    ${k}: '${v}',\n`;
  }
  out += `  },\n`;
}
out += `};

export function badgeNameT(lang: AppLanguage, key: BadgeNameMessageKey): string {
  return BADGE_NAME_MESSAGES[lang]?.[key] ?? BADGE_NAME_MESSAGES.en[key] ?? key;
}

export function activityBadgeLabelKey(id: string): BadgeNameMessageKey | null {
  if (/^(0[1-9]|1[0-4])$/.test(id)) return ('badge' + id) as BadgeNameMessageKey;
  return null;
}
`;

fs.writeFileSync(path.join(__dirname, '../src/i18n/badgeNameMessages.ts'), out, 'utf8');
console.log('Wrote badgeNameMessages.ts', keys.length, 'keys');
