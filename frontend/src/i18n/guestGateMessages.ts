import type { AppLanguage } from '@/utils/languageStorage';

export type GuestGateMessageKey =
  | 'signInToContinue'
  | 'notNow'
  | 'suspendedTitle'
  | 'suspendedBody'
  | 'suspendedReason'
  | 'suspendedBrowseOnly';

const EN: Record<GuestGateMessageKey, string> = {
  signInToContinue: 'Sign in to continue',
  notNow: 'Not now',
  suspendedTitle: 'This account is suspended',
  suspendedBody: 'This account is suspended. You can browse only.',
  suspendedReason: 'Reason: {reason}',
  suspendedBrowseOnly: 'You can browse only for now.',
};

const MESSAGES: Record<AppLanguage, Record<GuestGateMessageKey, string>> = {
  en: EN,
  ko: {
    signInToContinue: '계속하려면 로그인하세요',
    notNow: '나중에',
    suspendedTitle: '정지 중인 계정입니다',
    suspendedBody: '이 계정은 관리자에 의해 정지되어 지금은 둘러보기만 가능합니다.',
    suspendedReason: '사유: {reason}',
    suspendedBrowseOnly: '지금은 둘러보기만 가능합니다.',
  },
  zh: {
    signInToContinue: '登录后继续',
    notNow: '以后再说',
    suspendedTitle: '该账号已被停用',
    suspendedBody: '该账号已被管理员停用，目前只能浏览。',
    suspendedReason: '原因：{reason}',
    suspendedBrowseOnly: '目前只能浏览。',
  },
  ja: {
    signInToContinue: '続けるにはログインしてください',
    notNow: 'あとで',
    suspendedTitle: 'このアカウントは停止中です',
    suspendedBody: 'このアカウントは停止されているため、閲覧のみできます。',
    suspendedReason: '理由: {reason}',
    suspendedBrowseOnly: '現在は閲覧のみできます。',
  },
  es: {
    signInToContinue: 'Inicia sesión para continuar',
    notNow: 'Ahora no',
    suspendedTitle: 'Esta cuenta está suspendida',
    suspendedBody: 'Esta cuenta está suspendida. Solo puedes explorar.',
    suspendedReason: 'Motivo: {reason}',
    suspendedBrowseOnly: 'Por ahora solo puedes explorar.',
  },
  pt: {
    signInToContinue: 'Entre para continuar',
    notNow: 'Agora não',
    suspendedTitle: 'Esta conta está suspensa',
    suspendedBody: 'Esta conta está suspensa. Você só pode explorar.',
    suspendedReason: 'Motivo: {reason}',
    suspendedBrowseOnly: 'Por enquanto, só é possível explorar.',
  },
  fr: {
    signInToContinue: 'Connectez-vous pour continuer',
    notNow: 'Pas maintenant',
    suspendedTitle: 'Ce compte est suspendu',
    suspendedBody: 'Ce compte est suspendu. Vous pouvez seulement parcourir.',
    suspendedReason: 'Motif : {reason}',
    suspendedBrowseOnly: 'Vous pouvez seulement parcourir pour le moment.',
  },
  de: {
    signInToContinue: 'Melde dich an, um fortzufahren',
    notNow: 'Nicht jetzt',
    suspendedTitle: 'Dieses Konto ist gesperrt',
    suspendedBody: 'Dieses Konto ist gesperrt. Du kannst nur stöbern.',
    suspendedReason: 'Grund: {reason}',
    suspendedBrowseOnly: 'Du kannst vorerst nur stöbern.',
  },
  id: {
    signInToContinue: 'Masuk untuk lanjut',
    notNow: 'Nanti saja',
    suspendedTitle: 'Akun ini ditangguhkan',
    suspendedBody: 'Akun ini ditangguhkan. Anda hanya bisa menjelajah.',
    suspendedReason: 'Alasan: {reason}',
    suspendedBrowseOnly: 'Untuk saat ini hanya bisa menjelajah.',
  },
  vi: {
    signInToContinue: 'Đăng nhập để tiếp tục',
    notNow: 'Để sau',
    suspendedTitle: 'Tài khoản này đã bị tạm khóa',
    suspendedBody: 'Tài khoản này đã bị tạm khóa. Bạn chỉ có thể xem.',
    suspendedReason: 'Lý do: {reason}',
    suspendedBrowseOnly: 'Hiện chỉ có thể xem.',
  },
  th: {
    signInToContinue: 'เข้าสู่ระบบเพื่อดำเนินการต่อ',
    notNow: 'ไว้ก่อน',
    suspendedTitle: 'บัญชีนี้ถูกระงับ',
    suspendedBody: 'บัญชีนี้ถูกระงับ ดูได้อย่างเดียว',
    suspendedReason: 'เหตุผล: {reason}',
    suspendedBrowseOnly: 'ตอนนี้ดูได้อย่างเดียว',
  },
  hi: {
    signInToContinue: 'जारी रखने के लिए साइन इन करें',
    notNow: 'अभी नहीं',
    suspendedTitle: 'यह खाता निलंबित है',
    suspendedBody: 'यह खाता निलंबित है। आप केवल देख सकते हैं।',
    suspendedReason: 'कारण: {reason}',
    suspendedBrowseOnly: 'अभी केवल देखा जा सकता है।',
  },
  ar: {
    signInToContinue: 'سجّل الدخول للمتابعة',
    notNow: 'ليس الآن',
    suspendedTitle: 'هذا الحساب معلّق',
    suspendedBody: 'هذا الحساب معلّق. يمكنك التصفح فقط.',
    suspendedReason: 'السبب: {reason}',
    suspendedBrowseOnly: 'يمكنك التصفح فقط في الوقت الحالي.',
  },
  ru: {
    signInToContinue: 'Войдите, чтобы продолжить',
    notNow: 'Не сейчас',
    suspendedTitle: 'Этот аккаунт заблокирован',
    suspendedBody: 'Этот аккаунт заблокирован. Доступен только просмотр.',
    suspendedReason: 'Причина: {reason}',
    suspendedBrowseOnly: 'Сейчас доступен только просмотр.',
  },
  tr: {
    signInToContinue: 'Devam etmek için giriş yapın',
    notNow: 'Şimdi değil',
    suspendedTitle: 'Bu hesap askıya alındı',
    suspendedBody: 'Bu hesap askıya alındı. Yalnızca gezinebilirsiniz.',
    suspendedReason: 'Neden: {reason}',
    suspendedBrowseOnly: 'Şimdilik yalnızca gezinebilirsiniz.',
  },
  it: {
    signInToContinue: 'Accedi per continuare',
    notNow: 'Non ora',
    suspendedTitle: 'Questo account è sospeso',
    suspendedBody: 'Questo account è sospeso. Puoi solo sfogliare.',
    suspendedReason: 'Motivo: {reason}',
    suspendedBrowseOnly: 'Per ora puoi solo sfogliare.',
  },
  pl: {
    signInToContinue: 'Zaloguj się, aby kontynuować',
    notNow: 'Nie teraz',
    suspendedTitle: 'To konto jest zawieszone',
    suspendedBody: 'To konto jest zawieszone. Możesz tylko przeglądać.',
    suspendedReason: 'Powód: {reason}',
    suspendedBrowseOnly: 'Na razie możesz tylko przeglądać.',
  },
  nl: {
    signInToContinue: 'Log in om door te gaan',
    notNow: 'Niet nu',
    suspendedTitle: 'Dit account is geschorst',
    suspendedBody: 'Dit account is geschorst. Je kunt alleen rondkijken.',
    suspendedReason: 'Reden: {reason}',
    suspendedBrowseOnly: 'Je kunt nu alleen rondkijken.',
  },
  fil: {
    signInToContinue: 'Mag-sign in para magpatuloy',
    notNow: 'Hindi ngayon',
    suspendedTitle: 'Naka-suspend ang account na ito',
    suspendedBody: 'Naka-suspend ang account na ito. Puwede ka lang mag-browse.',
    suspendedReason: 'Dahilan: {reason}',
    suspendedBrowseOnly: 'Makakapag-browse ka lang sa ngayon.',
  },
  uk: {
    signInToContinue: 'Увійдіть, щоб продовжити',
    notNow: 'Не зараз',
    suspendedTitle: 'Цей обліковий запис призупинено',
    suspendedBody: 'Цей обліковий запис призупинено. Можна лише переглядати.',
    suspendedReason: 'Причина: {reason}',
    suspendedBrowseOnly: 'Зараз можна лише переглядати.',
  },
  bn: {
    signInToContinue: 'চালিয়ে যেতে সাইন ইন করুন',
    notNow: 'এখন নয়',
    suspendedTitle: 'এই অ্যাকাউন্ট স্থগিত',
    suspendedBody: 'এই অ্যাকাউন্ট স্থগিত। আপনি শুধু দেখতে পারবেন।',
    suspendedReason: 'কারণ: {reason}',
    suspendedBrowseOnly: 'এখন শুধু দেখা যাবে।',
  },
  ms: {
    signInToContinue: 'Log masuk untuk teruskan',
    notNow: 'Bukan sekarang',
    suspendedTitle: 'Akaun ini digantung',
    suspendedBody: 'Akaun ini digantung. Anda hanya boleh lihat-lihat.',
    suspendedReason: 'Sebab: {reason}',
    suspendedBrowseOnly: 'Buat masa ini anda hanya boleh lihat-lihat.',
  },
  sw: {
    signInToContinue: 'Ingia ili uendelee',
    notNow: 'Sio sasa',
    suspendedTitle: 'Akaunti hii imesimamishwa',
    suspendedBody: 'Akaunti hii imesimamishwa. Unaweza kuvinjari tu.',
    suspendedReason: 'Sababu: {reason}',
    suspendedBrowseOnly: 'Kwa sasa unaweza kuvinjari tu.',
  },
  fa: {
    signInToContinue: 'برای ادامه وارد شوید',
    notNow: 'الان نه',
    suspendedTitle: 'این حساب مسدود شده است',
    suspendedBody: 'این حساب مسدود شده است. فقط می‌توانید مرور کنید.',
    suspendedReason: 'دلیل: {reason}',
    suspendedBrowseOnly: 'فعلاً فقط می‌توانید مرور کنید.',
  },
  ur: {
    signInToContinue: 'جاری رکھنے کے لیے سائن ان کریں',
    notNow: 'ابھی نہیں',
    suspendedTitle: 'یہ اکاؤنٹ معطل ہے',
    suspendedBody: 'یہ اکاؤنٹ معطل ہے۔ آپ صرف دیکھ سکتے ہیں۔',
    suspendedReason: 'وجہ: {reason}',
    suspendedBrowseOnly: 'ابھی صرف دیکھا جا سکتا ہے۔',
  },
};

export function guestGateT(
  lang: AppLanguage,
  key: GuestGateMessageKey,
  vars?: Record<string, string | number>,
): string {
  let text = (MESSAGES[lang] || EN)[key] || EN[key];
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.split(`{${name}}`).join(String(value));
    }
  }
  return text;
}
