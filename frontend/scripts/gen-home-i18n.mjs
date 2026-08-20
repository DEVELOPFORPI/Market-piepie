/** One-shot generator: node scripts/gen-home-i18n.mjs */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const keys = [
  'searchPlaceholder', 'filter', 'listingType', 'freeOnly', 'category', 'priceRange',
  'min', 'max', 'reset', 'apply', 'noResults', 'noListings',
  'chipAll', 'chipLatest', 'chipFree', 'chipForSale', 'chipPopular', 'chipPriceLow', 'chipPriceHigh', 'chipOldest',
  'catElectronics', 'catFurniture', 'catClothes', 'catHobby', 'catBooks', 'catOther',
  'piNetwork', 'language', 'translationComingSoon',
  'navHome', 'navCommunity', 'navChat', 'navProfile',
  'free', 'inDispute', 'trading', 'forSale', 'sold',
  'justNow', 'minutesAgo', 'hoursAgo', 'daysAgo', 'chooseRegion', 'notifications', 'collapse', 'expandPi',
];

/** @type {Record<string, string[]>} parallel arrays aligned to keys */
const table = {
  en: [
    'Search title, region, seller', 'Filter', 'Listing type', 'Free only', 'Category', 'Price range',
    'Min', 'Max', 'Reset', 'Apply', 'No results.', 'No listings yet.',
    'All', 'Latest', 'Free', 'For sale', 'Popular', 'Price low', 'Price high', 'Oldest',
    'Electronics', 'Furniture', 'Clothes', 'Hobby', 'Books', 'Other',
    'PI Network', 'Language', 'Translation coming soon. Preference is saved.',
    'home', 'Community', 'chat', 'profile',
    'Free', 'In dispute', 'Trading', 'For sale', 'Trade complete',
    'Just now', '{n}m ago', '{n}h ago', '{n}d ago', 'Choose region', 'Notifications', 'Collapse', 'Expand PI price',
  ],
  ko: [
    '제목, 지역, 판매자 검색', '필터', '상품 유형', '나눔만', '카테고리', '가격 범위',
    '최소', '최대', '초기화', '적용', '검색 결과가 없습니다.', '아직 등록된 상품이 없습니다.',
    '전체', '최신순', '나눔', '판매중', '인기순', '가격 낮은순', '가격 높은순', '오래된순',
    '전자기기', '가구', '의류', '취미', '도서', '기타',
    'PI 네트워크', '언어', '번역 준비 중입니다. 선택은 저장됩니다.',
    '홈', '커뮤니티', '채팅', '프로필',
    '나눔', '분쟁중', '거래중', '판매중', '거래완료',
    '방금 전', '{n}분 전', '{n}시간 전', '{n}일 전', '지역 선택', '알림', '접기', 'PI 시세 펼치기',
  ],
  zh: [
    '搜索标题、地区、卖家', '筛选', '上架类型', '仅免费', '分类', '价格范围',
    '最低', '最高', '重置', '应用', '无结果。', '暂无商品。',
    '全部', '最新', '免费', '在售', '热门', '价格从低到高', '价格从高到低', '最早',
    '电子产品', '家具', '服装', '爱好', '图书', '其他',
    'PI Network', '语言', '翻译即将上线。已保存偏好。',
    '首页', '社区', '聊天', '我的',
    '免费', '争议中', '交易中', '在售', '已完成',
    '刚刚', '{n}分钟前', '{n}小时前', '{n}天前', '选择地区', '通知', '收起', '展开 PI 价格',
  ],
  ja: [
    'タイトル・地域・出品者を検索', 'フィルター', '出品タイプ', '無料のみ', 'カテゴリー', '価格帯',
    '最低', '最高', 'リセット', '適用', '結果がありません。', '出品がまだありません。',
    'すべて', '新着', '無料', '出品中', '人気', '安い順', '高い順', '古い順',
    '電子機器', '家具', '衣類', '趣味', '本', 'その他',
    'PI Network', '言語', '翻訳準備中。設定は保存されます。',
    'ホーム', 'コミュニティ', 'チャット', 'プロフィール',
    '無料', '紛争中', '取引中', '出品中', '取引完了',
    'たった今', '{n}分前', '{n}時間前', '{n}日前', '地域を選択', '通知', '閉じる', 'PI価格を展開',
  ],
  es: [
    'Buscar título, zona, vendedor', 'Filtro', 'Tipo de anuncio', 'Solo gratis', 'Categoría', 'Rango de precio',
    'Mín', 'Máx', 'Restablecer', 'Aplicar', 'Sin resultados.', 'Aún no hay anuncios.',
    'Todos', 'Recientes', 'Gratis', 'En venta', 'Popular', 'Precio bajo', 'Precio alto', 'Antiguos',
    'Electrónica', 'Muebles', 'Ropa', 'Hobby', 'Libros', 'Otros',
    'PI Network', 'Idioma', 'Traducción pronto. Preferencia guardada.',
    'inicio', 'Comunidad', 'chat', 'perfil',
    'Gratis', 'En disputa', 'En trato', 'En venta', 'Completado',
    'Ahora', 'hace {n} min', 'hace {n} h', 'hace {n} d', 'Elegir zona', 'Notificaciones', 'Cerrar', 'Expandir precio PI',
  ],
  pt: [
    'Buscar título, região, vendedor', 'Filtro', 'Tipo de anúncio', 'Só grátis', 'Categoria', 'Faixa de preço',
    'Mín', 'Máx', 'Redefinir', 'Aplicar', 'Sem resultados.', 'Ainda sem anúncios.',
    'Todos', 'Recentes', 'Grátis', 'À venda', 'Popular', 'Menor preço', 'Maior preço', 'Antigos',
    'Eletrônicos', 'Móveis', 'Roupas', 'Hobby', 'Livros', 'Outros',
    'PI Network', 'Idioma', 'Tradução em breve. Preferência salva.',
    'início', 'Comunidade', 'chat', 'perfil',
    'Grátis', 'Em disputa', 'Em negociação', 'À venda', 'Concluído',
    'Agora', 'há {n} min', 'há {n} h', 'há {n} d', 'Escolher região', 'Notificações', 'Recolher', 'Expandir preço PI',
  ],
  fr: [
    'Rechercher titre, région, vendeur', 'Filtre', "Type d'annonce", 'Gratuit seulement', 'Catégorie', 'Fourchette de prix',
    'Min', 'Max', 'Réinitialiser', 'Appliquer', 'Aucun résultat.', 'Aucune annonce.',
    'Tous', 'Récents', 'Gratuit', 'En vente', 'Populaire', 'Prix croissant', 'Prix décroissant', 'Anciens',
    'Électronique', 'Meubles', 'Vêtements', 'Loisirs', 'Livres', 'Autre',
    'PI Network', 'Langue', 'Traduction bientôt. Préférence enregistrée.',
    'accueil', 'Communauté', 'chat', 'profil',
    'Gratuit', 'En litige', 'En cours', 'En vente', 'Terminé',
    "À l'instant", 'il y a {n} min', 'il y a {n} h', 'il y a {n} j', 'Choisir une région', 'Notifications', 'Réduire', 'Afficher le prix PI',
  ],
  de: [
    'Titel, Region, Verkäufer suchen', 'Filter', 'Anzeigentyp', 'Nur kostenlos', 'Kategorie', 'Preisbereich',
    'Min', 'Max', 'Zurücksetzen', 'Anwenden', 'Keine Ergebnisse.', 'Noch keine Anzeigen.',
    'Alle', 'Neueste', 'Kostenlos', 'Zu verkaufen', 'Beliebt', 'Preis aufsteigend', 'Preis absteigend', 'Älteste',
    'Elektronik', 'Möbel', 'Kleidung', 'Hobby', 'Bücher', 'Sonstiges',
    'PI Network', 'Sprache', 'Übersetzung folgt. Einstellung gespeichert.',
    'Start', 'Community', 'Chat', 'Profil',
    'Kostenlos', 'Im Streit', 'In Verhandlung', 'Zu verkaufen', 'Abgeschlossen',
    'Gerade eben', 'vor {n} Min.', 'vor {n} Std.', 'vor {n} T.', 'Region wählen', 'Benachrichtigungen', 'Einklappen', 'PI-Preis erweitern',
  ],
  id: [
    'Cari judul, wilayah, penjual', 'Filter', 'Jenis listing', 'Hanya gratis', 'Kategori', 'Rentang harga',
    'Min', 'Maks', 'Atur ulang', 'Terapkan', 'Tidak ada hasil.', 'Belum ada listing.',
    'Semua', 'Terbaru', 'Gratis', 'Dijual', 'Populer', 'Harga terendah', 'Harga tertinggi', 'Terlama',
    'Elektronik', 'Furnitur', 'Pakaian', 'Hobi', 'Buku', 'Lainnya',
    'PI Network', 'Bahasa', 'Terjemahan segera. Preferensi disimpan.',
    'beranda', 'Komunitas', 'chat', 'profil',
    'Gratis', 'Dalam sengketa', 'Dalam transaksi', 'Dijual', 'Selesai',
    'Baru saja', '{n}m lalu', '{n}j lalu', '{n}h lalu', 'Pilih wilayah', 'Notifikasi', 'Tutup', 'Perluas harga PI',
  ],
  vi: [
    'Tìm tiêu đề, khu vực, người bán', 'Bộ lọc', 'Loại tin', 'Chỉ miễn phí', 'Danh mục', 'Khoảng giá',
    'Tối thiểu', 'Tối đa', 'Đặt lại', 'Áp dụng', 'Không có kết quả.', 'Chưa có tin đăng.',
    'Tất cả', 'Mới nhất', 'Miễn phí', 'Đang bán', 'Phổ biến', 'Giá thấp', 'Giá cao', 'Cũ nhất',
    'Điện tử', 'Nội thất', 'Quần áo', 'Sở thích', 'Sách', 'Khác',
    'PI Network', 'Ngôn ngữ', 'Bản dịch sắp có. Đã lưu tùy chọn.',
    'trang chủ', 'Cộng đồng', 'chat', 'hồ sơ',
    'Miễn phí', 'Đang tranh chấp', 'Đang giao dịch', 'Đang bán', 'Hoàn tất',
    'Vừa xong', '{n} phút trước', '{n} giờ trước', '{n} ngày trước', 'Chọn khu vực', 'Thông báo', 'Thu gọn', 'Mở giá PI',
  ],
  th: [
    'ค้นหาชื่อ ภูมิภาค ผู้ขาย', 'ตัวกรอง', 'ประเภทประกาศ', 'เฉพาะฟรี', 'หมวดหมู่', 'ช่วงราคา',
    'ต่ำสุด', 'สูงสุด', 'รีเซ็ต', 'ใช้', 'ไม่พบผลลัพธ์', 'ยังไม่มีประกาศ',
    'ทั้งหมด', 'ล่าสุด', 'ฟรี', 'ขายอยู่', 'ยอดนิยม', 'ราคาต่ำ', 'ราคาสูง', 'เก่าสุด',
    'อิเล็กทรอนิกส์', 'เฟอร์นิเจอร์', 'เสื้อผ้า', 'งานอดิเรก', 'หนังสือ', 'อื่นๆ',
    'PI Network', 'ภาษา', 'การแปลจะมาเร็วๆ นี้ บันทึกการตั้งค่าแล้ว',
    'หน้าแรก', 'ชุมชน', 'แชท', 'โปรไฟล์',
    'ฟรี', 'มีข้อพิพาท', 'กำลังซื้อขาย', 'ขายอยู่', 'เสร็จสิ้น',
    'เมื่อกี้', '{n} นาทีที่แล้ว', '{n} ชม. ที่แล้ว', '{n} วันที่แล้ว', 'เลือกภูมิภาค', 'การแจ้งเตือน', 'ยุบ', 'ขยายราคา PI',
  ],
  hi: [
    'शीर्षक, क्षेत्र, विक्रेता खोजें', 'फ़िल्टर', 'लिस्टिंग प्रकार', 'केवल मुफ़्त', 'श्रेणी', 'मूल्य सीमा',
    'न्यूनतम', 'अधिकतम', 'रीसेट', 'लागू करें', 'कोई परिणाम नहीं।', 'अभी कोई लिस्टिंग नहीं।',
    'सभी', 'नवीनतम', 'मुफ़्त', 'बिक्री पर', 'लोकप्रिय', 'कम कीमत', 'ज़्यादा कीमत', 'पुराने',
    'इलेक्ट्रॉनिक्स', 'फ़र्नीचर', 'कपड़े', 'शौक', 'किताबें', 'अन्य',
    'PI Network', 'भाषा', 'अनुवाद जल्द। पसंद सहेजी गई।',
    'होम', 'कम्युनिटी', 'चैट', 'प्रोफ़ाइल',
    'मुफ़्त', 'विवाद में', 'लेन-देन में', 'बिक्री पर', 'पूर्ण',
    'अभी', '{n} मि पहले', '{n} घं पहले', '{n} दि पहले', 'क्षेत्र चुनें', 'सूचनाएँ', 'समेटें', 'PI कीमत खोलें',
  ],
  ar: [
    'ابحث عن العنوان والمنطقة والبائع', 'تصفية', 'نوع الإعلان', 'مجاني فقط', 'الفئة', 'نطاق السعر',
    'الأدنى', 'الأعلى', 'إعادة تعيين', 'تطبيق', 'لا نتائج.', 'لا إعلانات بعد.',
    'الكل', 'الأحدث', 'مجاني', 'للبيع', 'الأكثر شعبية', 'السعر الأقل', 'السعر الأعلى', 'الأقدم',
    'إلكترونيات', 'أثاث', 'ملابس', 'هوايات', 'كتب', 'أخرى',
    'PI Network', 'اللغة', 'الترجمة قريبًا. تم حفظ التفضيل.',
    'الرئيسية', 'المجتمع', 'دردشة', 'الملف',
    'مجاني', 'قيد النزاع', 'قيد الصفقة', 'للبيع', 'مكتمل',
    'الآن', 'قبل {n} د', 'قبل {n} س', 'قبل {n} ي', 'اختر المنطقة', 'الإشعارات', 'طي', 'توسيع سعر PI',
  ],
  ru: [
    'Поиск: название, район, продавец', 'Фильтр', 'Тип объявления', 'Только бесплатно', 'Категория', 'Диапазон цен',
    'Мин', 'Макс', 'Сбросить', 'Применить', 'Нет результатов.', 'Пока нет объявлений.',
    'Все', 'Новые', 'Бесплатно', 'В продаже', 'Популярное', 'Сначала дешёвые', 'Сначала дорогие', 'Старые',
    'Электроника', 'Мебель', 'Одежда', 'Хобби', 'Книги', 'Другое',
    'PI Network', 'Язык', 'Перевод скоро. Настройка сохранена.',
    'главная', 'Сообщество', 'чат', 'профиль',
    'Бесплатно', 'Спор', 'В сделке', 'В продаже', 'Завершено',
    'Только что', '{n} мин назад', '{n} ч назад', '{n} дн назад', 'Выберите регион', 'Уведомления', 'Свернуть', 'Показать цену PI',
  ],
  tr: [
    'Başlık, bölge, satıcı ara', 'Filtre', 'İlan türü', 'Yalnızca ücretsiz', 'Kategori', 'Fiyat aralığı',
    'Min', 'Maks', 'Sıfırla', 'Uygula', 'Sonuç yok.', 'Henüz ilan yok.',
    'Tümü', 'En yeni', 'Ücretsiz', 'Satılık', 'Popüler', 'Ucuzdan pahalıya', 'Pahalıdan ucuza', 'En eski',
    'Elektronik', 'Mobilya', 'Giysi', 'Hobi', 'Kitap', 'Diğer',
    'PI Network', 'Dil', 'Çeviri yakında. Tercih kaydedildi.',
    'ana sayfa', 'Topluluk', 'sohbet', 'profil',
    'Ücretsiz', 'İhtilafta', 'İşlemde', 'Satılık', 'Tamamlandı',
    'Az önce', '{n} dk önce', '{n} sa önce', '{n} g önce', 'Bölge seç', 'Bildirimler', 'Daralt', 'PI fiyatını aç',
  ],
  it: [
    'Cerca titolo, zona, venditore', 'Filtro', 'Tipo di annuncio', 'Solo gratis', 'Categoria', 'Fascia di prezzo',
    'Min', 'Max', 'Reimposta', 'Applica', 'Nessun risultato.', 'Nessun annuncio.',
    'Tutti', 'Recenti', 'Gratis', 'In vendita', 'Popolari', 'Prezzo basso', 'Prezzo alto', 'Più vecchi',
    'Elettronica', 'Mobili', 'Abbigliamento', 'Hobby', 'Libri', 'Altro',
    'PI Network', 'Lingua', 'Traduzione in arrivo. Preferenza salvata.',
    'home', 'Community', 'chat', 'profilo',
    'Gratis', 'In disputa', 'In trattativa', 'In vendita', 'Completato',
    'Ora', '{n} min fa', '{n} h fa', '{n} g fa', 'Scegli zona', 'Notifiche', 'Comprimi', 'Espandi prezzo PI',
  ],
  pl: [
    'Szukaj tytułu, regionu, sprzedawcy', 'Filtr', 'Typ ogłoszenia', 'Tylko za darmo', 'Kategoria', 'Zakres cen',
    'Min', 'Maks', 'Resetuj', 'Zastosuj', 'Brak wyników.', 'Brak ogłoszeń.',
    'Wszystkie', 'Najnowsze', 'Za darmo', 'Na sprzedaż', 'Popularne', 'Cena rosnąco', 'Cena malejąco', 'Najstarsze',
    'Elektronika', 'Meble', 'Ubrania', 'Hobby', 'Książki', 'Inne',
    'PI Network', 'Język', 'Tłumaczenie wkrótce. Zapisano preferencję.',
    'start', 'Społeczność', 'czat', 'profil',
    'Za darmo', 'W sporze', 'W transakcji', 'Na sprzedaż', 'Zakończone',
    'Przed chwilą', '{n} min temu', '{n} godz. temu', '{n} dn. temu', 'Wybierz region', 'Powiadomienia', 'Zwiń', 'Rozwiń cenę PI',
  ],
  nl: [
    'Zoek titel, regio, verkoper', 'Filter', 'Advertentietype', 'Alleen gratis', 'Categorie', 'Prijsbereik',
    'Min', 'Max', 'Reset', 'Toepassen', 'Geen resultaten.', 'Nog geen advertenties.',
    'Alles', 'Nieuwste', 'Gratis', 'Te koop', 'Populair', 'Prijs laag', 'Prijs hoog', 'Oudste',
    'Elektronica', 'Meubels', 'Kleding', 'Hobby', 'Boeken', 'Overig',
    'PI Network', 'Taal', 'Vertaling volgt. Voorkeur opgeslagen.',
    'home', 'Community', 'chat', 'profiel',
    'Gratis', 'In geschil', 'In handel', 'Te koop', 'Voltooid',
    'Zojuist', '{n}m geleden', '{n}u geleden', '{n}d geleden', 'Kies regio', 'Meldingen', 'Inklappen', 'PI-prijs uitklappen',
  ],
  fil: [
    'Maghanap ng pamagat, rehiyon, seller', 'Filter', 'Uri ng listing', 'Free lang', 'Kategorya', 'Saklaw ng presyo',
    'Min', 'Max', 'I-reset', 'Ilapat', 'Walang resulta.', 'Wala pang listing.',
    'Lahat', 'Pinakabago', 'Libre', 'Ipinagbibili', 'Sikat', 'Mababang presyo', 'Mataas na presyo', 'Pinakaluma',
    'Electronics', 'Muwebles', 'Damit', 'Hobby', 'Libro', 'Iba pa',
    'PI Network', 'Wika', 'Pagsasalin sa lalong madaling panahon. Na-save ang preference.',
    'home', 'Community', 'chat', 'profile',
    'Libre', 'May dispute', 'May deal', 'Ipinagbibili', 'Tapos na',
    'Ngayon lang', '{n}m ang nakalipas', '{n}o ang nakalipas', '{n}a ang nakalipas', 'Pumili ng rehiyon', 'Mga notification', 'I-collapse', 'I-expand ang PI price',
  ],
  uk: [
    'Пошук: назва, район, продавець', 'Фільтр', 'Тип оголошення', 'Лише безкоштовно', 'Категорія', 'Діапазон цін',
    'Мін', 'Макс', 'Скинути', 'Застосувати', 'Немає результатів.', 'Ще немає оголошень.',
    'Усі', 'Нові', 'Безкоштовно', 'Продається', 'Популярне', 'Дешевші', 'Дорожчі', 'Старі',
    'Електроніка', 'Меблі', 'Одяг', 'Хобі', 'Книги', 'Інше',
    'PI Network', 'Мова', 'Переклад незабаром. Налаштування збережено.',
    'головна', 'Спільнота', 'чат', 'профіль',
    'Безкоштовно', 'У спорі', 'У угоді', 'Продається', 'Завершено',
    'Щойно', '{n} хв тому', '{n} год тому', '{n} дн тому', 'Оберіть регіон', 'Сповіщення', 'Згорнути', 'Розгорнути ціну PI',
  ],
  bn: [
    'শিরোনাম, এলাকা, বিক্রেতা খুঁজুন', 'ফিল্টার', 'লিস্টিংয়ের ধরন', 'শুধু ফ্রি', 'বিভাগ', 'মূল্যসীমা',
    'সর্বনিম্ন', 'সর্বোচ্চ', 'রিসেট', 'প্রয়োগ', 'কোনো ফলাফল নেই।', 'এখনও কোনো লিস্টিং নেই।',
    'সব', 'নতুন', 'ফ্রি', 'বিক্রয়ের জন্য', 'জনপ্রিয়', 'কম দাম', 'বেশি দাম', 'পুরোনো',
    'ইলেকট্রনিক্স', 'আসবাব', 'পোশাক', 'শখ', 'বই', 'অন্যান্য',
    'PI Network', 'ভাষা', 'অনুবাদ শীঘ্রই। পছন্দ সংরক্ষিত।',
    'হোম', 'কমিউনিটি', 'চ্যাট', 'প্রোফাইল',
    'ফ্রি', 'বিরোধে', 'লেনদেনে', 'বিক্রয়ের জন্য', 'সম্পন্ন',
    'এইমাত্র', '{n}মি আগে', '{n}ঘণ্টা আগে', '{n}দিন আগে', 'এলাকা বেছে নিন', 'বিজ্ঞপ্তি', 'সংকুচিত', 'PI মূল্য খুলুন',
  ],
  ms: [
    'Cari tajuk, wilayah, penjual', 'Penapis', 'Jenis senarai', 'Percuma sahaja', 'Kategori', 'Julat harga',
    'Min', 'Maks', 'Set semula', 'Guna', 'Tiada hasil.', 'Belum ada senarai.',
    'Semua', 'Terbaru', 'Percuma', 'Dijual', 'Popular', 'Harga rendah', 'Harga tinggi', 'Terlama',
    'Elektronik', 'Perabot', 'Pakaian', 'Hobi', 'Buku', 'Lain-lain',
    'PI Network', 'Bahasa', 'Terjemahan tidak lama lagi. Pilihan disimpan.',
    'laman utama', 'Komuniti', 'sembang', 'profil',
    'Percuma', 'Dalam pertikaian', 'Dalam transaksi', 'Dijual', 'Selesai',
    'Baru sahaja', '{n}m lalu', '{n}j lalu', '{n}h lalu', 'Pilih wilayah', 'Pemberitahuan', 'Kuncupkan', 'Kembangkan harga PI',
  ],
  sw: [
    'Tafuta kichwa, eneo, muuzaji', 'Chuja', 'Aina ya orodha', 'Bure tu', 'Kategoria', 'Kiwango cha bei',
    'Min', 'Max', 'Weka upya', 'Tumia', 'Hakuna matokeo.', 'Bado hakuna orodha.',
    'Zote', 'Mpya', 'Bure', 'Inauzwa', 'Maarufu', 'Bei ya chini', 'Bei ya juu', 'Kongwe',
    'Elektroniki', 'Samani', 'Nguo', 'Hobby', 'Vitabu', 'Nyingine',
    'PI Network', 'Lugha', 'Tafsiri inakuja. Mapendeleo yamehifadhiwa.',
    'nyumbani', 'Jumuiya', 'gumzo', 'wasifu',
    'Bure', 'Katika mgogoro', 'Katika biashara', 'Inauzwa', 'Imekamilika',
    'Sasa hivi', 'dak {n} zilizopita', 'saa {n} zilizopita', 'siku {n} zilizopita', 'Chagua eneo', 'Arifa', 'Kunja', 'Panua bei ya PI',
  ],
  fa: [
    'جستجوی عنوان، منطقه، فروشنده', 'فیلتر', 'نوع آگهی', 'فقط رایگان', 'دسته‌بندی', 'بازه قیمت',
    'حداقل', 'حداکثر', 'بازنشانی', 'اعمال', 'نتیجه‌ای نیست.', 'هنوز آگهی نیست.',
    'همه', 'جدیدترین', 'رایگان', 'فروشی', 'محبوب', 'ارزان‌تر', 'گران‌تر', 'قدیمی‌تر',
    'الکترونیک', 'مبلمان', 'پوشاک', 'سرگرمی', 'کتاب', 'سایر',
    'PI Network', 'زبان', 'ترجمه به‌زودی. ترجیح ذخیره شد.',
    'خانه', 'جامعه', 'گفتگو', 'پروفایل',
    'رایگان', 'در اختلاف', 'در معامله', 'فروشی', 'تمام‌شده',
    'همین الان', '{n} دقیقه پیش', '{n} ساعت پیش', '{n} روز پیش', 'انتخاب منطقه', 'اعلان‌ها', 'جمع کردن', 'باز کردن قیمت PI',
  ],
  ur: [
    'عنوان، علاقہ، بیچنے والا تلاش کریں', 'فلٹر', 'لسٹنگ کی قسم', 'صرف مفت', 'زمرہ', 'قیمت کی حد',
    'کم از کم', 'زیادہ سے زیادہ', 'ری سیٹ', 'لاگو کریں', 'کوئی نتیجہ نہیں۔', 'ابھی کوئی لسٹنگ نہیں۔',
    'سب', 'تازہ ترین', 'مفت', 'فروخت پر', 'مقبول', 'سستا', 'مہنگا', 'پرانا',
    'الیکٹرانکس', 'فرنیچر', 'کپڑے', 'مشغلہ', 'کتابیں', 'دیگر',
    'PI Network', 'زبان', 'ترجمہ جلد۔ ترجیح محفوظ۔',
    'ہوم', 'کمیونٹی', 'چیٹ', 'پروفائل',
    'مفت', 'تنازع میں', 'سودے میں', 'فروخت پر', 'مکمل',
    'ابھی', '{n} منٹ پہلے', '{n} گھنٹے پہلے', '{n} دن پہلے', 'علاقہ منتخب کریں', 'اطلاعات', 'سکیڑیں', 'PI قیمت کھولیں',
  ],
};

// Keep bottom-navigation casing consistent while retaining familiar app terms.
const navOverrides = {
  en: ['Home', 'Community', 'Chat', 'Profile'],
  es: ['Inicio', 'Comunidad', 'Chat', 'Perfil'],
  pt: ['Início', 'Comunidade', 'Chat', 'Perfil'],
  fr: ['Accueil', 'Communauté', 'Chat', 'Profil'],
  de: ['Start', 'Community', 'Chat', 'Profil'],
  id: ['Beranda', 'Komunitas', 'Chat', 'Profil'],
  vi: ['Trang chủ', 'Cộng đồng', 'Chat', 'Hồ sơ'],
  tr: ['Ana sayfa', 'Topluluk', 'Sohbet', 'Profil'],
  it: ['Home', 'Community', 'Chat', 'Profilo'],
  pl: ['Start', 'Społeczność', 'Czat', 'Profil'],
  nl: ['Home', 'Community', 'Chat', 'Profiel'],
  fil: ['Home', 'Community', 'Chat', 'Profile'],
  ms: ['Laman utama', 'Komuniti', 'Sembang', 'Profil'],
  sw: ['Nyumbani', 'Jumuiya', 'Gumzo', 'Wasifu'],
};

const navIndexes = ['navHome', 'navCommunity', 'navChat', 'navProfile'].map((key) =>
  keys.indexOf(key),
);
for (const [lang, labels] of Object.entries(navOverrides)) {
  labels.forEach((label, index) => {
    table[lang][navIndexes[index]] = label;
  });
}

const tradingOverrides = {
  en: 'Reserved',
  ko: '예약중',
  zh: '已预订',
  ja: '予約中',
  es: 'Reservado',
  pt: 'Reservado',
  fr: 'Réservé',
  de: 'Reserviert',
  id: 'Dipesan',
  vi: 'Đã giữ chỗ',
  th: 'จองแล้ว',
  hi: 'आरक्षित',
  ar: 'محجوز',
  ru: 'Зарезервировано',
  tr: 'Rezerve',
  it: 'Prenotato',
  pl: 'Zarezerwowane',
  nl: 'Gereserveerd',
  fil: 'Naka-reserve',
  uk: 'Зарезервовано',
  bn: 'সংরক্ষিত',
  ms: 'Ditempah',
  sw: 'Imehifadhiwa',
  fa: 'رزرو شده',
  ur: 'محفوظ',
};
const tradingIndex = keys.indexOf('trading');
for (const [lang, label] of Object.entries(tradingOverrides)) {
  table[lang][tradingIndex] = label;
}

for (const [lang, arr] of Object.entries(table)) {
  if (arr.length !== keys.length) {
    throw new Error(`${lang}: expected ${keys.length} got ${arr.length}`);
  }
}

const langs = Object.keys(table);
let out = `/* Auto-generated by scripts/gen-home-i18n.mjs — home + shared chrome strings */
import type { AppLanguage } from '@/utils/languageStorage';

export type HomeMessageKey =
${keys.map((k) => `  | '${k}'`).join('\n')};

const HOME_MESSAGES: Record<AppLanguage, Record<HomeMessageKey, string>> = {\n`;

for (const lang of langs) {
  out += `  ${lang}: {\n`;
  keys.forEach((k, i) => {
    const v = table[lang][i].replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    out += `    ${k}: '${v}',\n`;
  });
  out += `  },\n`;
}
out += `};\n\n`;
out += `export function homeT(lang: AppLanguage, key: HomeMessageKey, vars?: Record<string, string | number>): string {
  const raw = HOME_MESSAGES[lang]?.[key] ?? HOME_MESSAGES.en[key] ?? key;
  if (!vars) return raw;
  return Object.entries(vars).reduce(
    (s, [k, v]) => s.split(\`{\${k}}\`).join(String(v)),
    raw,
  );
}
`;

const dest = path.join(__dirname, '../src/i18n/homeMessages.ts');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, out, 'utf8');
console.log('Wrote', dest, 'langs', langs.length, 'keys', keys.length);
