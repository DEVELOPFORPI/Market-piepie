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
  orderDetailTitle: {
    en: 'Order detail', ko: '주문 상세', zh: '订单详情', ja: '注文詳細',
    es: 'Detalle del pedido', pt: 'Detalhe do pedido', fr: 'Détail de la commande', de: 'Bestelldetails',
    id: 'Detail pesanan', vi: 'Chi tiết đơn hàng', th: 'รายละเอียดคำสั่งซื้อ', hi: 'ऑर्डर विवरण',
    ar: 'تفاصيل الطلب', ru: 'Детали заказа', tr: 'Sipariş detayı', it: 'Dettaglio ordine',
    pl: 'Szczegóły zamówienia', nl: 'Bestelgegevens', fil: 'Detalye ng order', uk: 'Деталі замовлення',
    bn: 'অর্ডার বিবরণ', ms: 'Butiran pesanan', sw: 'Maelezo ya agizo', fa: 'جزئیات سفارش',
    ur: 'آرڈر کی تفصیل',
  },
  freePrice: {
    en: 'Free', ko: '무료', zh: '免费', ja: '無料',
    es: 'Gratis', pt: 'Grátis', fr: 'Gratuit', de: 'Kostenlos',
    id: 'Gratis', vi: 'Miễn phí', th: 'ฟรี', hi: 'मुफ़्त',
    ar: 'مجاني', ru: 'Бесплатно', tr: 'Ücretsiz', it: 'Gratis',
    pl: 'Gratis', nl: 'Gratis', fil: 'Libre', uk: 'Безкоштовно',
    bn: 'বিনামূল্যে', ms: 'Percuma', sw: 'Bure', fa: 'رایگان',
    ur: 'مفت',
  },
  listingSection: {
    en: 'Listing', ko: '상품', zh: '商品', ja: '出品',
    es: 'Anuncio', pt: 'Anúncio', fr: 'Annonce', de: 'Anzeige',
    id: 'Listing', vi: 'Tin đăng', th: 'ประกาศ', hi: 'लिस्टिंग',
    ar: 'الإعلان', ru: 'Объявление', tr: 'İlan', it: 'Annuncio',
    pl: 'Ogłoszenie', nl: 'Advertentie', fil: 'Listing', uk: 'Оголошення',
    bn: 'লিস্টিং', ms: 'Senarai', sw: 'Tangazo', fa: 'آگهی',
    ur: 'لسٹنگ',
  },
  listingRemovedBySeller: {
    en: 'The seller removed this listing.',
    ko: '판매자가 이 상품을 삭제했습니다.',
    zh: '卖家已删除该商品。',
    ja: '出品者がこの出品を削除しました。',
    es: 'El vendedor eliminó este anuncio.',
    pt: 'O vendedor removeu este anúncio.',
    fr: 'Le vendeur a supprimé cette annonce.',
    de: 'Der Verkäufer hat diese Anzeige entfernt.',
    id: 'Penjual menghapus listing ini.',
    vi: 'Người bán đã xóa tin đăng này.',
    th: 'ผู้ขายลบประกาศนี้แล้ว',
    hi: 'विक्रेता ने यह लिस्टिंग हटा दी।',
    ar: 'حذف البائع هذا الإعلان.',
    ru: 'Продавец удалил это объявление.',
    tr: 'Satıcı bu ilanı kaldırdı.',
    it: 'Il venditore ha rimosso questo annuncio.',
    pl: 'Sprzedawca usunął to ogłoszenie.',
    nl: 'De verkoper heeft deze advertentie verwijderd.',
    fil: 'Inalis ng seller ang listing na ito.',
    uk: 'Продавець видалив це оголошення.',
    bn: 'বিক্রেতা এই লিস্টিং সরিয়েছেন।',
    ms: 'Penjual telah mengalih keluar senarai ini.',
    sw: 'Muuzaji ameondoa tangazo hili.',
    fa: 'فروشنده این آگهی را حذف کرده است.',
    ur: 'فروخت کنندہ نے یہ لسٹنگ ہٹا دی۔',
  },
  noteLabel: {
    en: 'Note', ko: '메모', zh: '备注', ja: 'メモ',
    es: 'Nota', pt: 'Nota', fr: 'Note', de: 'Notiz',
    id: 'Catatan', vi: 'Ghi chú', th: 'หมายเหตุ', hi: 'नोट',
    ar: 'ملاحظة', ru: 'Заметка', tr: 'Not', it: 'Nota',
    pl: 'Notatka', nl: 'Notitie', fil: 'Tala', uk: 'Нотатка',
    bn: 'নোট', ms: 'Nota', sw: 'Dokezo', fa: 'یادداشت',
    ur: 'نوٹ',
  },
  timelineHeading: {
    en: 'Timeline', ko: '타임라인', zh: '时间线', ja: 'タイムライン',
    es: 'Cronología', pt: 'Linha do tempo', fr: 'Chronologie', de: 'Zeitverlauf',
    id: 'Linimasa', vi: 'Dòng thời gian', th: 'ไทม์ไลน์', hi: 'टाइमलाइन',
    ar: 'الجدول الزمني', ru: 'Хронология', tr: 'Zaman çizelgesi', it: 'Cronologia',
    pl: 'Oś czasu', nl: 'Tijdlijn', fil: 'Timeline', uk: 'Хронологія',
    bn: 'টাইমলাইন', ms: 'Garis masa', sw: 'Ratiba', fa: 'جدول زمانی',
    ur: 'ٹائم لائن',
  },
  partiesHeading: {
    en: 'Parties', ko: '거래 당사자', zh: '交易双方', ja: '当事者',
    es: 'Partes', pt: 'Partes', fr: 'Parties', de: 'Parteien',
    id: 'Pihak', vi: 'Các bên', th: 'คู่สัญญา', hi: 'पक्ष',
    ar: 'الأطراف', ru: 'Стороны', tr: 'Taraflar', it: 'Parti',
    pl: 'Strony', nl: 'Partijen', fil: 'Mga partido', uk: 'Сторони',
    bn: 'পক্ষসমূহ', ms: 'Pihak', sw: 'Wahusika', fa: 'طرفین',
    ur: 'فریقین',
  },
  buyerLabel: {
    en: 'Buyer', ko: '구매자', zh: '买家', ja: '購入者',
    es: 'Comprador', pt: 'Comprador', fr: 'Acheteur', de: 'Käufer',
    id: 'Pembeli', vi: 'Người mua', th: 'ผู้ซื้อ', hi: 'खरीदार',
    ar: 'المشتري', ru: 'Покупатель', tr: 'Alıcı', it: 'Acquirente',
    pl: 'Kupujący', nl: 'Koper', fil: 'Buyer', uk: 'Покупець',
    bn: 'ক্রেতা', ms: 'Pembeli', sw: 'Mnunuzi', fa: 'خریدار',
    ur: 'خریدار',
  },
  sellerLabel: {
    en: 'Seller', ko: '판매자', zh: '卖家', ja: '出品者',
    es: 'Vendedor', pt: 'Vendedor', fr: 'Vendeur', de: 'Verkäufer',
    id: 'Penjual', vi: 'Người bán', th: 'ผู้ขาย', hi: 'विक्रेता',
    ar: 'البائع', ru: 'Продавец', tr: 'Satıcı', it: 'Venditore',
    pl: 'Sprzedawca', nl: 'Verkoper', fil: 'Seller', uk: 'Продавець',
    bn: 'বিক্রেতা', ms: 'Penjual', sw: 'Muuzaji', fa: 'فروشنده',
    ur: 'فروخت کنندہ',
  },
  methodLabel: {
    en: 'Method', ko: '거래 방식', zh: '交易方式', ja: '取引方法',
    es: 'Método', pt: 'Método', fr: 'Méthode', de: 'Methode',
    id: 'Metode', vi: 'Phương thức', th: 'วิธี', hi: 'तरीका',
    ar: 'الطريقة', ru: 'Способ', tr: 'Yöntem', it: 'Metodo',
    pl: 'Metoda', nl: 'Methode', fil: 'Paraan', uk: 'Спосіб',
    bn: 'পদ্ধতি', ms: 'Kaedah', sw: 'Njia', fa: 'روش',
    ur: 'طریقہ',
  },
  offerDateLabel: {
    en: 'Offer date', ko: '제안일', zh: '报价日期', ja: 'オファー日',
    es: 'Fecha de oferta', pt: 'Data da oferta', fr: 'Date de l’offre', de: 'Angebotsdatum',
    id: 'Tanggal penawaran', vi: 'Ngày đề nghị', th: 'วันที่เสนอ', hi: 'ऑफ़र तिथि',
    ar: 'تاريخ العرض', ru: 'Дата предложения', tr: 'Teklif tarihi', it: 'Data offerta',
    pl: 'Data oferty', nl: 'Datum van bod', fil: 'Petsa ng offer', uk: 'Дата пропозиції',
    bn: 'অফারের তারিখ', ms: 'Tarikh tawaran', sw: 'Tarehe ya ofa', fa: 'تاریخ پیشنهاد',
    ur: 'پیشکش کی تاریخ',
  },
  tlFreeShareRequest: {
    en: 'Free share request', ko: '나눔 요청', zh: '免费分享请求', ja: '無料譲渡リクエスト',
    es: 'Solicitud de regalo', pt: 'Pedido de doação', fr: 'Demande de don', de: 'Verschenk-Anfrage',
    id: 'Permintaan berbagi gratis', vi: 'Yêu cầu chia sẻ miễn phí', th: 'คำขอแจกฟรี', hi: 'मुफ़्त शेयर अनुरोध',
    ar: 'طلب مشاركة مجانية', ru: 'Запрос на бесплатную передачу', tr: 'Ücretsiz paylaşım isteği', it: 'Richiesta regalo',
    pl: 'Prośba o darmowe oddanie', nl: 'Gratis deelverzoek', fil: 'Kahilingan sa libreng share', uk: 'Запит на безоплатну передачу',
    bn: 'ফ্রি শেয়ার অনুরোধ', ms: 'Permintaan kongsi percuma', sw: 'Ombi la kushiriki bila malipo', fa: 'درخواست اشتراک رایگان',
    ur: 'مفت شیئر کی درخواست',
  },
  tlPurchaseOffer: {
    en: '{n} Pi purchase offer', ko: '{n} Pi 구매 제안', zh: '{n} Pi 购买报价', ja: '{n} Pi 購入オファー',
    es: 'Oferta de compra de {n} Pi', pt: 'Oferta de compra de {n} Pi', fr: 'Offre d’achat de {n} Pi', de: 'Kaufangebot über {n} Pi',
    id: 'Penawaran beli {n} Pi', vi: 'Đề nghị mua {n} Pi', th: 'ข้อเสนอซื้อ {n} Pi', hi: '{n} Pi खरीद ऑफ़र',
    ar: 'عرض شراء {n} Pi', ru: 'Предложение покупки {n} Pi', tr: '{n} Pi satın alma teklifi', it: 'Offerta di acquisto {n} Pi',
    pl: 'Oferta zakupu {n} Pi', nl: 'Koopbod van {n} Pi', fil: 'Purchase offer na {n} Pi', uk: 'Пропозиція купівлі {n} Pi',
    bn: '{n} Pi ক্রয় অফার', ms: 'Tawaran belian {n} Pi', sw: 'Ofa ya kununua {n} Pi', fa: 'پیشنهاد خرید {n} Pi',
    ur: '{n} Pi خرید پیشکش',
  },
  tlInPersonFreeShare: {
    en: 'In-person free share', ko: '직거래 나눔', zh: '当面免费分享', ja: '対面の無料譲渡',
    es: 'Regalo en persona', pt: 'Doação presencial', fr: 'Don en personne', de: 'Persönliches Verschenken',
    id: 'Berbagi gratis tatap muka', vi: 'Chia sẻ miễn phí trực tiếp', th: 'แจกฟรีแบบพบกัน', hi: 'व्यक्तिगत मुफ़्त शेयर',
    ar: 'مشاركة مجانية شخصيًا', ru: 'Личная бесплатная передача', tr: 'Yüz yüze ücretsiz paylaşım', it: 'Regalo di persona',
    pl: 'Osobiste darmowe oddanie', nl: 'Gratis delen face-to-face', fil: 'In-person free share', uk: 'Особиста безоплатна передача',
    bn: 'সাক্ষাৎ ফ্রি শেয়ার', ms: 'Kongsi percuma bersemuka', sw: 'Ugawaji bila malipo ana kwa ana', fa: 'اشتراک رایگان حضوری',
    ur: 'روبرو مفت شیئر',
  },
  tlChatStarted: {
    en: 'Chat started', ko: '채팅 시작', zh: '开始聊天', ja: 'チャット開始',
    es: 'Chat iniciado', pt: 'Chat iniciado', fr: 'Discussion commencée', de: 'Chat gestartet',
    id: 'Obrolan dimulai', vi: 'Đã bắt đầu chat', th: 'เริ่มแชท', hi: 'चैट शुरू',
    ar: 'بدأ الدردشة', ru: 'Чат начат', tr: 'Sohbet başladı', it: 'Chat avviata',
    pl: 'Czat rozpoczęty', nl: 'Chat gestart', fil: 'Nagsimula ang chat', uk: 'Чат почато',
    bn: 'চ্যাট শুরু', ms: 'Sembang dimulakan', sw: 'Mazungumzo yameanza', fa: 'گفتگو شروع شد',
    ur: 'چیٹ شروع',
  },
  tlInPersonTradeAt: {
    en: 'In-person trade at {n} Pi', ko: '{n} Pi 직거래', zh: '{n} Pi 当面交易', ja: '{n} Pi の対面取引',
    es: 'Trato en persona por {n} Pi', pt: 'Negócio presencial por {n} Pi', fr: 'Échange en personne à {n} Pi', de: 'Persönlicher Handel für {n} Pi',
    id: 'Transaksi tatap muka {n} Pi', vi: 'Giao dịch trực tiếp {n} Pi', th: 'ซื้อขายพบกัน {n} Pi', hi: '{n} Pi पर व्यक्तिगत लेन-देन',
    ar: 'صفقة شخصية بـ {n} Pi', ru: 'Личная сделка за {n} Pi', tr: '{n} Pi yüz yüze ticaret', it: 'Scambio di persona a {n} Pi',
    pl: 'Transakcja osobista za {n} Pi', nl: 'Face-to-face handel voor {n} Pi', fil: 'In-person trade sa {n} Pi', uk: 'Особиста угода за {n} Pi',
    bn: '{n} Pi সাক্ষাৎ লেনদেন', ms: 'Dagangan bersemuka {n} Pi', sw: 'Biashara ana kwa ana kwa {n} Pi', fa: 'معامله حضوری با {n} Pi',
    ur: '{n} Pi روبرو لین دین',
  },
  tlMeetupConfirmed: {
    en: 'Meetup confirmed', ko: '약속 확정', zh: '见面已确认', ja: '待ち合わせ確定',
    es: 'Quedada confirmada', pt: 'Encontro confirmado', fr: 'Rendez-vous confirmé', de: 'Treffen bestätigt',
    id: 'Temu dikonfirmasi', vi: 'Đã xác nhận hẹn', th: 'ยืนยันนัดพบแล้ว', hi: 'मुलाकात पुष्टि',
    ar: 'تم تأكيد اللقاء', ru: 'Встреча подтверждена', tr: 'Buluşma onaylandı', it: 'Incontro confermato',
    pl: 'Spotkanie potwierdzone', nl: 'Afspraak bevestigd', fil: 'Kumpirmado ang meetup', uk: 'Зустріч підтверджено',
    bn: 'মিলনের নিশ্চিতকরণ', ms: 'Perjumpaan disahkan', sw: 'Mkutano umethibitishwa', fa: 'ملاقات تأیید شد',
    ur: 'ملاقات کی تصدیق',
  },
  tlBuyerAcceptedMeetup: {
    en: 'Buyer accepted the meetup', ko: '구매자가 약속을 수락했습니다', zh: '买家已接受见面', ja: '購入者が待ち合わせを承認',
    es: 'El comprador aceptó la quedada', pt: 'O comprador aceitou o encontro', fr: 'L’acheteur a accepté le rendez-vous', de: 'Käufer hat das Treffen angenommen',
    id: 'Pembeli menerima temu', vi: 'Người mua chấp nhận cuộc hẹn', th: 'ผู้ซื้อยอมรับนัดพบ', hi: 'खरीदार ने मुलाकात स्वीकार की',
    ar: 'قبل المشتري اللقاء', ru: 'Покупатель принял встречу', tr: 'Alıcı buluşmayı kabul etti', it: 'L’acquirente ha accettato l’incontro',
    pl: 'Kupujący zaakceptował spotkanie', nl: 'Koper accepteerde de afspraak', fil: 'Tinanggap ng buyer ang meetup', uk: 'Покупець прийняв зустріч',
    bn: 'ক্রেতা মিলন গ্রহণ করেছেন', ms: 'Pembeli menerima perjumpaan', sw: 'Mnunuzi amekubali mkutano', fa: 'خریدار ملاقات را پذیرفت',
    ur: 'خریدار نے ملاقات قبول کی',
  },
  tlMeetupCanceled: {
    en: 'Meetup canceled', ko: '약속 취소됨', zh: '见面已取消', ja: '待ち合わせキャンセル',
    es: 'Quedada cancelada', pt: 'Encontro cancelado', fr: 'Rendez-vous annulé', de: 'Treffen abgesagt',
    id: 'Temu dibatalkan', vi: 'Đã hủy hẹn', th: 'ยกเลิกนัดพบแล้ว', hi: 'मुलाकात रद्द',
    ar: 'أُلغي اللقاء', ru: 'Встреча отменена', tr: 'Buluşma iptal edildi', it: 'Incontro annullato',
    pl: 'Spotkanie anulowane', nl: 'Afspraak geannuleerd', fil: 'Nakansela ang meetup', uk: 'Зустріч скасовано',
    bn: 'মিলন বাতিল', ms: 'Perjumpaan dibatalkan', sw: 'Mkutano umeghairiwa', fa: 'ملاقات لغو شد',
    ur: 'ملاقات منسوخ',
  },
  tlBuyerConfirmedComplete: {
    en: 'Buyer confirmed trade complete', ko: '구매자가 거래 완료를 확인했습니다', zh: '买家确认交易完成', ja: '購入者が取引完了を確認',
    es: 'El comprador confirmó el fin del trato', pt: 'Comprador confirmou a conclusão', fr: 'L’acheteur a confirmé la fin de l’échange', de: 'Käufer bestätigte Abschluss',
    id: 'Pembeli mengonfirmasi selesai', vi: 'Người mua xác nhận hoàn tất', th: 'ผู้ซื้อยืนยันเสร็จสิ้น', hi: 'खरीदार ने लेन-देन पूर्ण की पुष्टि की',
    ar: 'أكد المشتري اكتمال الصفقة', ru: 'Покупатель подтвердил завершение', tr: 'Alıcı tamamlamayı onayladı', it: 'L’acquirente ha confermato il completamento',
    pl: 'Kupujący potwierdził zakończenie', nl: 'Koper bevestigde afronding', fil: 'Kinumpirma ng buyer ang tapos', uk: 'Покупець підтвердив завершення',
    bn: 'ক্রেতা লেনদেন সম্পন্ন নিশ্চিত করেছেন', ms: 'Pembeli sahkan selesai', sw: 'Mnunuzi amethibitisha kukamilika', fa: 'خریدار تکمیل معامله را تأیید کرد',
    ur: 'خریدار نے لین دین کی تکمیل کی تصدیق کی',
  },
  tlSellerConfirmedComplete: {
    en: 'Seller confirmed trade complete', ko: '판매자가 거래 완료를 확인했습니다', zh: '卖家确认交易完成', ja: '出品者が取引完了を確認',
    es: 'El vendedor confirmó el fin del trato', pt: 'Vendedor confirmou a conclusão', fr: 'Le vendeur a confirmé la fin de l’échange', de: 'Verkäufer bestätigte Abschluss',
    id: 'Penjual mengonfirmasi selesai', vi: 'Người bán xác nhận hoàn tất', th: 'ผู้ขายยืนยันเสร็จสิ้น', hi: 'विक्रेता ने लेन-देन पूर्ण की पुष्टि की',
    ar: 'أكد البائع اكتمال الصفقة', ru: 'Продавец подтвердил завершение', tr: 'Satıcı tamamlamayı onayladı', it: 'Il venditore ha confermato il completamento',
    pl: 'Sprzedawca potwierdził zakończenie', nl: 'Verkoper bevestigde afronding', fil: 'Kinumpirma ng seller ang tapos', uk: 'Продавець підтвердив завершення',
    bn: 'বিক্রেতা লেনদেন সম্পন্ন নিশ্চিত করেছেন', ms: 'Penjual sahkan selesai', sw: 'Muuzaji amethibitisha kukamilika', fa: 'فروشنده تکمیل معامله را تأیید کرد',
    ur: 'فروخت کنندہ نے لین دین کی تکمیل کی تصدیق کی',
  },
  tlTradeCompleted: {
    en: 'Trade completed', ko: '거래 완료', zh: '交易完成', ja: '取引完了',
    es: 'Trato completado', pt: 'Negócio concluído', fr: 'Échange terminé', de: 'Handel abgeschlossen',
    id: 'Transaksi selesai', vi: 'Giao dịch hoàn tất', th: 'การซื้อขายเสร็จสิ้น', hi: 'लेन-देन पूरा',
    ar: 'اكتملت الصفقة', ru: 'Сделка завершена', tr: 'Ticaret tamamlandı', it: 'Scambio completato',
    pl: 'Transakcja zakończona', nl: 'Handel afgerond', fil: 'Tapos na ang trade', uk: 'Угоду завершено',
    bn: 'লেনদেন সম্পন্ন', ms: 'Dagangan selesai', sw: 'Biashara imekamilika', fa: 'معامله کامل شد',
    ur: 'لین دین مکمل',
  },
  tlReceiptConfirmed: {
    en: 'Receipt confirmed', ko: '수령 확인', zh: '已确认收货', ja: '受領確認',
    es: 'Recepción confirmada', pt: 'Recebimento confirmado', fr: 'Réception confirmée', de: 'Erhalt bestätigt',
    id: 'Penerimaan dikonfirmasi', vi: 'Đã xác nhận nhận hàng', th: 'ยืนยันการรับแล้ว', hi: 'प्राप्ति की पुष्टि',
    ar: 'تم تأكيد الاستلام', ru: 'Получение подтверждено', tr: 'Teslimat onaylandı', it: 'Ricezione confermata',
    pl: 'Odbiór potwierdzony', nl: 'Ontvangst bevestigd', fil: 'Kumpirmado ang pagtanggap', uk: 'Отримання підтверджено',
    bn: 'প্রাপ্তি নিশ্চিত', ms: 'Penerimaan disahkan', sw: 'Upokeaji umethibitishwa', fa: 'دریافت تأیید شد',
    ur: 'وصولی کی تصدیق',
  },
  tlBuyerShippingDetails: {
    en: 'Buyer submitted shipping details', ko: '구매자가 배송 정보를 제출했습니다', zh: '买家已提交收货信息', ja: '購入者が配送情報を送信',
    es: 'El comprador envió los datos de envío', pt: 'Comprador enviou dados de envio', fr: 'L’acheteur a envoyé les infos d’expédition', de: 'Käufer übermittelte Versanddaten',
    id: 'Pembeli mengirim detail pengiriman', vi: 'Người mua gửi thông tin giao hàng', th: 'ผู้ซื้อส่งข้อมูลจัดส่งแล้ว', hi: 'खरीदार ने शिपिंग विवरण भेजे',
    ar: 'أرسل المشتري تفاصيل الشحن', ru: 'Покупатель отправил данные доставки', tr: 'Alıcı kargo bilgilerini gönderdi', it: 'L’acquirente ha inviato i dettagli di spedizione',
    pl: 'Kupujący przesłał dane wysyłki', nl: 'Koper stuurde verzendgegevens', fil: 'Nagsumite ang buyer ng shipping details', uk: 'Покупець надіслав дані доставки',
    bn: 'ক্রেতা শিপিং বিবরণ জমা দিয়েছেন', ms: 'Pembeli hantar butiran penghantaran', sw: 'Mnunuzi amewasilisha maelezo ya usafirishaji', fa: 'خریدار جزئیات ارسال را فرستاد',
    ur: 'خریدار نے شپنگ تفصیلات جمع کرائیں',
  },
  tlShippedVia: {
    en: 'Shipped via {company}', ko: '{company}(으)로 발송', zh: '已通过{company}发货', ja: '{company}で発送',
    es: 'Enviado por {company}', pt: 'Enviado via {company}', fr: 'Expédié via {company}', de: 'Versendet mit {company}',
    id: 'Dikirim via {company}', vi: 'Đã gửi qua {company}', th: 'จัดส่งผ่าน {company}', hi: '{company} से भेजा गया',
    ar: 'شُحن عبر {company}', ru: 'Отправлено через {company}', tr: '{company} ile gönderildi', it: 'Spedito tramite {company}',
    pl: 'Wysłano przez {company}', nl: 'Verzonden via {company}', fil: 'Na-ship via {company}', uk: 'Відправлено через {company}',
    bn: '{company} দিয়ে পাঠানো', ms: 'Dihantar melalui {company}', sw: 'Imesafirishwa kupitia {company}', fa: 'ارسال‌شده با {company}',
    ur: '{company} کے ذریعے بھیجا گیا',
  },
  tlPurchaseOfferCreated: {
    en: 'Purchase offer created', ko: '구매 제안 생성', zh: '已创建购买报价', ja: '購入オファー作成',
    es: 'Oferta de compra creada', pt: 'Oferta de compra criada', fr: 'Offre d’achat créée', de: 'Kaufangebot erstellt',
    id: 'Penawaran beli dibuat', vi: 'Đã tạo đề nghị mua', th: 'สร้างข้อเสนอซื้อแล้ว', hi: 'खरीद ऑफ़र बनाई गई',
    ar: 'تم إنشاء عرض الشراء', ru: 'Создано предложение покупки', tr: 'Satın alma teklifi oluşturuldu', it: 'Offerta di acquisto creata',
    pl: 'Utworzono ofertę zakupu', nl: 'Koopbod aangemaakt', fil: 'Nagawa ang purchase offer', uk: 'Створено пропозицію купівлі',
    bn: 'ক্রয় অফার তৈরি', ms: 'Tawaran belian dicipta', sw: 'Ofa ya kununua imeundwa', fa: 'پیشنهاد خرید ایجاد شد',
    ur: 'خرید پیشکش بنائی گئی',
  },
  tlOfferAccepted: {
    en: 'Offer accepted', ko: '제안 수락', zh: '已接受报价', ja: 'オファー承認',
    es: 'Oferta aceptada', pt: 'Oferta aceita', fr: 'Offre acceptée', de: 'Angebot angenommen',
    id: 'Penawaran diterima', vi: 'Đã chấp nhận đề nghị', th: 'ยอมรับข้อเสนอแล้ว', hi: 'ऑफ़र स्वीकार',
    ar: 'تم قبول العرض', ru: 'Предложение принято', tr: 'Teklif kabul edildi', it: 'Offerta accettata',
    pl: 'Oferta zaakceptowana', nl: 'Bod geaccepteerd', fil: 'Tinanggap ang offer', uk: 'Пропозицію прийнято',
    bn: 'অফার গৃহীত', ms: 'Tawaran diterima', sw: 'Ofa imekubaliwa', fa: 'پیشنهاد پذیرفته شد',
    ur: 'پیشکش قبول',
  },
  tlOfferDeclined: {
    en: 'Offer declined', ko: '제안 거절', zh: '已拒绝报价', ja: 'オファー辞退',
    es: 'Oferta rechazada', pt: 'Oferta recusada', fr: 'Offre refusée', de: 'Angebot abgelehnt',
    id: 'Penawaran ditolak', vi: 'Đã từ chối đề nghị', th: 'ปฏิเสธข้อเสนอแล้ว', hi: 'ऑफ़र अस्वीकृत',
    ar: 'تم رفض العرض', ru: 'Предложение отклонено', tr: 'Teklif reddedildi', it: 'Offerta rifiutata',
    pl: 'Oferta odrzucona', nl: 'Bod afgewezen', fil: 'Tinanggihan ang offer', uk: 'Пропозицію відхилено',
    bn: 'অফার প্রত্যাখ্যাত', ms: 'Tawaran ditolak', sw: 'Ofa imekataliwa', fa: 'پیشنهاد رد شد',
    ur: 'پیشکش مسترد',
  },
  offerAlreadyPending: {
    en: 'Your offer is already waiting for a reply.',
    ko: '이미 보낸 제안이 답변을 기다리고 있어요.',
    zh: '你的报价正在等待对方回复。',
    ja: '送信済みのオファーが返答待ちです。',
    es: 'Tu oferta ya está esperando respuesta.',
    pt: 'Sua oferta já está aguardando resposta.',
    fr: 'Votre offre attend déjà une réponse.',
    de: 'Dein Angebot wartet bereits auf eine Antwort.',
    id: 'Penawaran Anda masih menunggu jawaban.',
    vi: 'Đề nghị của bạn đang chờ phản hồi.',
    th: 'ข้อเสนอของคุณกำลังรอคำตอบอยู่',
    hi: 'आपका ऑफ़र पहले से जवाब का इंतज़ार कर रहा है।',
    ar: 'عرضك ينتظر ردًا بالفعل.',
    ru: 'Ваше предложение уже ожидает ответа.',
    tr: 'Teklifiniz zaten yanıt bekliyor.',
    it: 'La tua offerta è già in attesa di risposta.',
    pl: 'Twoja oferta już czeka na odpowiedź.',
    nl: 'Je bod wacht al op een reactie.',
    fil: 'Naghihintay pa ng sagot ang offer mo.',
    uk: 'Ваша пропозиція вже очікує на відповідь.',
    bn: 'আপনার অফার ইতিমধ্যে উত্তরের অপেক্ষায় আছে।',
    ms: 'Tawaran anda sedang menunggu jawapan.',
    sw: 'Ofa yako inasubiri jibu.',
    fa: 'پیشنهاد شما در انتظار پاسخ است.',
    ur: 'آپ کی پیشکش پہلے ہی جواب کی منتظر ہے۔',
  },
  offerAlreadyAccepted: {
    en: 'This trade is already underway, so you cannot send another offer.',
    ko: '이미 진행 중인 거래라 새 제안을 보낼 수 없어요.',
    zh: '交易已在进行中，无法再次报价。',
    ja: 'すでに進行中の取引のため、新しいオファーは送れません。',
    es: 'La compraventa ya está en curso, no puedes enviar otra oferta.',
    pt: 'A negociação já está em andamento, não é possível enviar outra oferta.',
    fr: 'La transaction est déjà en cours, vous ne pouvez pas envoyer une autre offre.',
    de: 'Der Handel läuft bereits, du kannst kein weiteres Angebot senden.',
    id: 'Transaksi sudah berjalan, Anda tidak bisa mengirim penawaran lagi.',
    vi: 'Giao dịch đang diễn ra nên bạn không thể gửi đề nghị mới.',
    th: 'การซื้อขายกำลังดำเนินอยู่ จึงส่งข้อเสนอใหม่ไม่ได้',
    hi: 'यह सौदा पहले से चल रहा है, नया ऑफ़र नहीं भेज सकते।',
    ar: 'الصفقة جارية بالفعل، لا يمكنك إرسال عرض آخر.',
    ru: 'Сделка уже идёт, отправить новое предложение нельзя.',
    tr: 'Alışveriş zaten sürüyor, yeni teklif gönderemezsiniz.',
    it: 'La trattativa è già in corso, non puoi inviare un’altra offerta.',
    pl: 'Transakcja już trwa, nie możesz wysłać kolejnej oferty.',
    nl: 'De handel loopt al, je kunt geen nieuw bod sturen.',
    fil: 'Kasalukuyan nang isinasagawa ang trade, hindi ka na makakapag-offer ulit.',
    uk: 'Угода вже триває, надіслати нову пропозицію не можна.',
    bn: 'লেনদেন ইতিমধ্যে চলছে, তাই নতুন অফার পাঠানো যাবে না।',
    ms: 'Urus niaga sedang berjalan, anda tidak boleh hantar tawaran baharu.',
    sw: 'Muamala tayari unaendelea, huwezi kutuma ofa nyingine.',
    fa: 'معامله در جریان است، نمی‌توانید پیشنهاد تازه بفرستید.',
    ur: 'سودا پہلے سے جاری ہے، نئی پیشکش نہیں بھیج سکتے۔',
  },
  tlAdminResolvedDispute: {
    en: 'Dispute resolved by admin', ko: '관리자 분쟁 해결', zh: '管理员已处理纠纷', ja: '管理者が紛争を解決',
    es: 'Disputa resuelta por el administrador', pt: 'Disputa resolvida pelo administrador', fr: 'Litige résolu par l’administrateur', de: 'Streitfall vom Admin gelöst',
    id: 'Sengketa diselesaikan admin', vi: 'Quản trị viên đã giải quyết tranh chấp', th: 'ผู้ดูแลระบบแก้ไขข้อพิพาทแล้ว', hi: 'व्यवस्थापक ने विवाद सुलझाया',
    ar: 'حل النزاع بواسطة المشرف', ru: 'Спор урегулирован администратором', tr: 'Anlaşmazlık yönetici tarafından çözüldü', it: 'Controversia risolta dall’amministratore',
    pl: 'Spór rozwiązany przez administratora', nl: 'Geschil opgelost door beheerder', fil: 'Nalutas ng admin ang dispute', uk: 'Спір вирішено адміністратором',
    bn: 'অ্যাডমিন বিরোধ নিষ্পত্তি করেছেন', ms: 'Pertikaian diselesaikan oleh admin', sw: 'Mzozo umetatuliwa na msimamizi', fa: 'اختلاف توسط مدیر حل شد',
    ur: 'ایڈمن نے تنازع حل کر دیا',
  },
  statusAdminResolved: {
    en: 'Admin resolved', ko: '관리자 해결', zh: '管理员已处理', ja: '管理者が解決',
    es: 'Resuelto por admin', pt: 'Resolvido pelo admin', fr: 'Résolu par l’admin', de: 'Vom Admin gelöst',
    id: 'Diselesaikan admin', vi: 'Quản trị viên đã xử lý', th: 'ผู้ดูแลแก้ไขแล้ว', hi: 'व्यवस्थापक ने सुलझाया',
    ar: 'حلّه المشرف', ru: 'Решено админом', tr: 'Yönetici çözdü', it: 'Risolto dall’admin',
    pl: 'Rozwiązane przez admina', nl: 'Opgelost door beheerder', fil: 'Nalutas ng admin', uk: 'Вирішено адміном',
    bn: 'অ্যাডমিন নিষ্পত্তি করেছেন', ms: 'Diselesaikan admin', sw: 'Imetatuliwa na msimamizi', fa: 'حل‌شده توسط مدیر',
    ur: 'ایڈمن نے حل کیا',
  },
  tlAwaitingShipping: {
    en: 'Awaiting shipping details', ko: '배송정보 대기', zh: '等待收货信息', ja: '配送情報待ち',
    es: 'Esperando datos de envío', pt: 'Aguardando dados de envio', fr: 'En attente des infos d’expédition', de: 'Warte auf Versanddaten',
    id: 'Menunggu detail pengiriman', vi: 'Đang chờ thông tin giao hàng', th: 'รอข้อมูลจัดส่ง', hi: 'शिपिंग विवरण की प्रतीक्षा',
    ar: 'بانتظار تفاصيل الشحن', ru: 'Ожидание данных доставки', tr: 'Kargo bilgileri bekleniyor', it: 'In attesa dei dettagli di spedizione',
    pl: 'Oczekiwanie na dane wysyłki', nl: 'Wachten op verzendgegevens', fil: 'Naghihintay ng shipping details', uk: 'Очікування даних доставки',
    bn: 'শিপিং বিবরণের অপেক্ষা', ms: 'Menunggu butiran penghantaran', sw: 'Inasubiri maelezo ya usafirishaji', fa: 'در انتظار جزئیات ارسال',
    ur: 'شپنگ تفصیلات کا انتظار',
  },
  tlMarkedShipped: {
    en: 'Marked as shipped', ko: '발송 처리됨', zh: '已标记发货', ja: '発送済みに設定',
    es: 'Marcado como enviado', pt: 'Marcado como enviado', fr: 'Marqué comme expédié', de: 'Als versendet markiert',
    id: 'Ditandai sudah dikirim', vi: 'Đã đánh dấu gửi hàng', th: 'ทำเครื่องหมายว่าจัดส่งแล้ว', hi: 'भेजा गया चिह्नित',
    ar: 'تم التعليم كمشحون', ru: 'Отмечено как отправлено', tr: 'Gönderildi olarak işaretlendi', it: 'Segnato come spedito',
    pl: 'Oznaczono jako wysłane', nl: 'Gemarkeerd als verzonden', fil: 'Minarkahan bilang shipped', uk: 'Позначено як відправлено',
    bn: 'পাঠানো চিহ্নিত', ms: 'Ditanda dihantar', sw: 'Imewekwa alama kuwa imesafirishwa', fa: 'به‌عنوان ارسال‌شده علامت خورد',
    ur: 'بھیجا گیا نشان زد',
  },
  tlMarkedDelivered: {
    en: 'Marked as delivered', ko: '배송 완료 처리됨', zh: '已标记送达', ja: '配達完了に設定',
    es: 'Marcado como entregado', pt: 'Marcado como entregue', fr: 'Marqué comme livré', de: 'Als zugestellt markiert',
    id: 'Ditandai sudah diterima', vi: 'Đã đánh dấu giao hàng', th: 'ทำเครื่องหมายว่าส่งถึงแล้ว', hi: 'डिलीवर चिह्नित',
    ar: 'تم التعليم كمُسلَّم', ru: 'Отмечено как доставлено', tr: 'Teslim edildi olarak işaretlendi', it: 'Segnato come consegnato',
    pl: 'Oznaczono jako doręczone', nl: 'Gemarkeerd als bezorgd', fil: 'Minarkahan bilang delivered', uk: 'Позначено як доставлено',
    bn: 'ডেলিভার চিহ্নিত', ms: 'Ditanda dihantar sampai', sw: 'Imewekwa alama kuwa imetolewa', fa: 'به‌عنوان تحویل‌شده علامت خورد',
    ur: 'ڈیلیور نشان زد',
  },
  tlDisputeOpened: {
    en: 'Dispute opened', ko: '분쟁 접수', zh: '已发起争议', ja: '紛争開始',
    es: 'Disputa abierta', pt: 'Disputa aberta', fr: 'Litige ouvert', de: 'Streitfall eröffnet',
    id: 'Sengketa dibuka', vi: 'Đã mở tranh chấp', th: 'เปิดข้อพิพาทแล้ว', hi: 'विवाद खोला गया',
    ar: 'فُتح النزاع', ru: 'Спор открыт', tr: 'Anlaşmazlık açıldı', it: 'Controversia aperta',
    pl: 'Otwarto spór', nl: 'Geschil geopend', fil: 'Binuksan ang dispute', uk: 'Спір відкрито',
    bn: 'বিবাদ খোলা', ms: 'Pertikaian dibuka', sw: 'Mzozo umefunguliwa', fa: 'اختلاف باز شد',
    ur: 'تنازعہ کھولا گیا',
  },
  tlDisputeResolved: {
    en: 'Dispute resolved', ko: '분쟁 해결', zh: '争议已解决', ja: '紛争解決',
    es: 'Disputa resuelta', pt: 'Disputa resolvida', fr: 'Litige résolu', de: 'Streitfall gelöst',
    id: 'Sengketa diselesaikan', vi: 'Đã giải quyết tranh chấp', th: 'ยุติข้อพิพาทแล้ว', hi: 'विवाद सुलझा',
    ar: 'حُل النزاع', ru: 'Спор решён', tr: 'Anlaşmazlık çözüldü', it: 'Controversia risolta',
    pl: 'Spór rozwiązany', nl: 'Geschil opgelost', fil: 'Naresolba ang dispute', uk: 'Спір вирішено',
    bn: 'বিবাদ সমাধান', ms: 'Pertikaian diselesaikan', sw: 'Mzozo umetatuliwa', fa: 'اختلاف حل شد',
    ur: 'تنازعہ حل ہوا',
  },
  tlBuyerDisputeOpened: {
    en: 'Buyer dispute', ko: '구매자 분쟁', zh: '买家争议', ja: '購入者の紛争',
    es: 'Disputa del comprador', pt: 'Disputa do comprador', fr: 'Litige acheteur', de: 'Käufer-Streitfall',
    id: 'Sengketa pembeli', vi: 'Tranh chấp người mua', th: 'ข้อพิพาทผู้ซื้อ', hi: 'खरीदार विवाद',
    ar: 'نزاع المشتري', ru: 'Спор покупателя', tr: 'Alıcı anlaşmazlığı', it: 'Controversia acquirente',
    pl: 'Spór kupującego', nl: 'Geschil koper', fil: 'Dispute ng buyer', uk: 'Спір покупця',
    bn: 'ক্রেতার বিবাদ', ms: 'Pertikaian pembeli', sw: 'Mzozo wa mnunuzi', fa: 'اختلاف خریدار',
    ur: 'خریدار کا تنازعہ',
  },
  tlSellerDisputeOpened: {
    en: 'Seller dispute', ko: '판매자 분쟁', zh: '卖家争议', ja: '出品者の紛争',
    es: 'Disputa del vendedor', pt: 'Disputa do vendedor', fr: 'Litige vendeur', de: 'Verkäufer-Streitfall',
    id: 'Sengketa penjual', vi: 'Tranh chấp người bán', th: 'ข้อพิพาทผู้ขาย', hi: 'विक्रेता विवाद',
    ar: 'نزاع البائع', ru: 'Спор продавца', tr: 'Satıcı anlaşmazlığı', it: 'Controversia venditore',
    pl: 'Spór sprzedawcy', nl: 'Geschil verkoper', fil: 'Dispute ng seller', uk: 'Спір продавця',
    bn: 'বিক্রেতার বিবাদ', ms: 'Pertikaian penjual', sw: 'Mzozo wa muuzaji', fa: 'اختلاف فروشنده',
    ur: 'فروخت کنندہ کا تنازعہ',
  },
  tlBuyerDisputeResolved: {
    en: 'Buyer dispute resolved', ko: '구매자 분쟁 해결', zh: '买家争议已解决', ja: '購入者の紛争解決',
    es: 'Disputa del comprador resuelta', pt: 'Disputa do comprador resolvida', fr: 'Litige acheteur résolu', de: 'Käufer-Streitfall gelöst',
    id: 'Sengketa pembeli selesai', vi: 'Đã giải quyết tranh chấp người mua', th: 'ยุติข้อพิพาทผู้ซื้อ', hi: 'खरीदार विवाद सुलझा',
    ar: 'حُل نزاع المشتري', ru: 'Спор покупателя решён', tr: 'Alıcı anlaşmazlığı çözüldü', it: 'Controversia acquirente risolta',
    pl: 'Spór kupującego rozwiązany', nl: 'Geschil koper opgelost', fil: 'Naresolba ang dispute ng buyer', uk: 'Спір покупця вирішено',
    bn: 'ক্রেতার বিবাদ সমাধান', ms: 'Pertikaian pembeli diselesaikan', sw: 'Mzozo wa mnunuzi umetatuliwa', fa: 'اختلاف خریدار حل شد',
    ur: 'خریدار کا تنازعہ حل ہوا',
  },
  tlSellerDisputeResolved: {
    en: 'Seller dispute resolved', ko: '판매자 분쟁 해결', zh: '卖家争议已解决', ja: '出品者の紛争解決',
    es: 'Disputa del vendedor resuelta', pt: 'Disputa do vendedor resolvida', fr: 'Litige vendeur résolu', de: 'Verkäufer-Streitfall gelöst',
    id: 'Sengketa penjual selesai', vi: 'Đã giải quyết tranh chấp người bán', th: 'ยุติข้อพิพาทผู้ขาย', hi: 'विक्रेता विवाद सुलझा',
    ar: 'حُل نزاع البائع', ru: 'Спор продавца решён', tr: 'Satıcı anlaşmazlığı çözüldü', it: 'Controversia venditore risolta',
    pl: 'Spór sprzedawcy rozwiązany', nl: 'Geschil verkoper opgelost', fil: 'Naresolba ang dispute ng seller', uk: 'Спір продавця вирішено',
    bn: 'বিক্রেতার বিবাদ সমাধান', ms: 'Pertikaian penjual diselesaikan', sw: 'Mzozo wa muuzaji umetatuliwa', fa: 'اختلاف فروشنده حل شد',
    ur: 'فروخت کنندہ کا تنازعہ حل ہوا',
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

let out = `/* Auto-generated by scripts/gen-order-detail-i18n.mjs */
import type { AppLanguage } from '@/utils/languageStorage';

export type OrderDetailMessageKey =
${keys.map((k) => `  | '${k}'`).join('\n')};

const ORDER_DETAIL_MESSAGES: Record<AppLanguage, Record<OrderDetailMessageKey, string>> = {\n`;

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

export function orderDetailT(
  lang: AppLanguage,
  key: OrderDetailMessageKey,
  vars?: Record<string, string | number>,
): string {
  const raw = ORDER_DETAIL_MESSAGES[lang]?.[key] ?? ORDER_DETAIL_MESSAGES.en[key] ?? key;
  if (!vars) return raw;
  return Object.entries(vars).reduce(
    (s, [k, v]) => s.split('{' + k + '}').join(String(v)),
    raw,
  );
}
`;

fs.writeFileSync(path.join(__dirname, '../src/i18n/orderDetailMessages.ts'), out, 'utf8');
console.log('Wrote orderDetailMessages.ts', keys.length, 'keys');
