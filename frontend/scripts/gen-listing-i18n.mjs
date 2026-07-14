import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const keys = [
  'newListing', 'editListing', 'tradeArea', 'change', 'setRegion', 'photos',
  'listingTitle', 'listingTitlePlaceholder', 'listingType', 'freeShare', 'pricePi',
  'description', 'optional', 'describeItem', 'allowOffers', 'allowOffersHint', 'freeShareNoOffers',
  'publishListing', 'soldCannotEdit', 'cannotEditDispute', 'upToPhotos',
  'fillRequired', 'addOnePhoto', 'couldNotSaveListing', 'listingUpdated', 'chooseRegion',
];

/** @type {Record<string, string[]>} */
const table = {
  en: [
    'New listing', 'Edit listing', 'Trade area', 'Change', 'Set', 'Photos',
    'Title', 'Listing title', 'Listing type', 'Free share', 'Price (Pi)',
    'Description', '(optional)', 'Describe your item', 'Allow offers', 'Buyers can send price offers when enabled', 'Free shares cannot receive offers.',
    'Publish listing', 'Sold listings cannot be edited.', 'You cannot edit while a dispute is open.', 'You can upload up to {n} photos.',
    'Fill in all required fields, including at least one photo.', 'Add at least one photo.', 'Could not save listing. Check your connection and try again.', 'Listing updated.', 'Choose region',
  ],
  ko: [
    '상품 등록', '상품 수정', '거래 지역', '변경', '설정', '사진',
    '제목', '상품 제목', '거래 유형', '나눔', '가격 (Pi)',
    '설명', '(선택)', '상품을 설명해 주세요', '가격 제안 허용', '켜면 구매자가 가격을 제안할 수 있습니다', '나눔은 가격 제안을 받을 수 없습니다.',
    '등록하기', '판매 완료된 상품은 수정할 수 없습니다.', '분쟁 진행 중에는 수정할 수 없습니다.', '사진은 최대 {n}장까지 업로드할 수 있습니다.',
    '필수 항목과 사진 1장 이상을 입력해 주세요.', '사진을 1장 이상 추가해 주세요.', '저장하지 못했습니다. 연결을 확인하고 다시 시도하세요.', '상품이 수정되었습니다.', '지역 선택',
  ],
  zh: [
    '发布商品', '编辑商品', '交易地区', '更改', '设置', '照片',
    '标题', '商品标题', '上架类型', '免费分享', '价格 (Pi)',
    '描述', '（可选）', '描述你的商品', '允许议价', '开启后买家可发送报价', '免费分享不可接收报价。',
    '发布商品', '已售出的商品无法编辑。', '争议进行中无法编辑。', '最多可上传 {n} 张照片。',
    '请填写所有必填项，并至少添加一张照片。', '请至少添加一张照片。', '无法保存，请检查网络后重试。', '商品已更新。', '选择地区',
  ],
  ja: [
    '出品する', '出品を編集', '取引エリア', '変更', '設定', '写真',
    'タイトル', '出品タイトル', '出品タイプ', '無料譲渡', '価格 (Pi)',
    '説明', '（任意）', '商品の説明を書く', 'オファーを許可', 'オンにすると購入者が価格オファーを送れます', '無料譲渡はオファーを受けられません。',
    '出品する', '売却済みの出品は編集できません。', '紛争中は編集できません。', '写真は最大 {n} 枚までです。',
    '必須項目と写真を1枚以上入力してください。', '写真を1枚以上追加してください。', '保存できませんでした。接続を確認して再試行してください。', '出品を更新しました。', '地域を選ぶ',
  ],
  es: [
    'Nuevo anuncio', 'Editar anuncio', 'Zona de trato', 'Cambiar', 'Elegir', 'Fotos',
    'Título', 'Título del anuncio', 'Tipo de anuncio', 'Regalo', 'Precio (Pi)',
    'Descripción', '(opcional)', 'Describe tu artículo', 'Permitir ofertas', 'Los compradores pueden enviar ofertas si está activo', 'Los regalos no reciben ofertas.',
    'Publicar anuncio', 'Los anuncios vendidos no se pueden editar.', 'No puedes editar mientras hay una disputa.', 'Puedes subir hasta {n} fotos.',
    'Completa los campos obligatorios, incluida al menos una foto.', 'Añade al menos una foto.', 'No se pudo guardar. Revisa la conexión e inténtalo de nuevo.', 'Anuncio actualizado.', 'Elegir región',
  ],
  pt: [
    'Novo anúncio', 'Editar anúncio', 'Área de troca', 'Alterar', 'Definir', 'Fotos',
    'Título', 'Título do anúncio', 'Tipo de anúncio', 'Doação', 'Preço (Pi)',
    'Descrição', '(opcional)', 'Descreva seu item', 'Permitir ofertas', 'Compradores podem enviar ofertas quando ativado', 'Doações não recebem ofertas.',
    'Publicar anúncio', 'Anúncios vendidos não podem ser editados.', 'Não é possível editar com disputa aberta.', 'Você pode enviar até {n} fotos.',
    'Preencha os campos obrigatórios, incluindo ao menos uma foto.', 'Adicione ao menos uma foto.', 'Não foi possível salvar. Verifique a conexão e tente de novo.', 'Anúncio atualizado.', 'Escolher região',
  ],
  fr: [
    'Nouvelle annonce', 'Modifier l’annonce', 'Zone d’échange', 'Modifier', 'Définir', 'Photos',
    'Titre', 'Titre de l’annonce', 'Type d’annonce', 'Don', 'Prix (Pi)',
    'Description', '(facultatif)', 'Décrivez votre article', 'Autoriser les offres', 'Les acheteurs peuvent envoyer des offres si activé', 'Les dons ne peuvent pas recevoir d’offres.',
    'Publier l’annonce', 'Les annonces vendues ne peuvent pas être modifiées.', 'Impossible de modifier pendant un litige.', 'Vous pouvez téléverser jusqu’à {n} photos.',
    'Remplissez tous les champs obligatoires, dont au moins une photo.', 'Ajoutez au moins une photo.', 'Échec de l’enregistrement. Vérifiez la connexion et réessayez.', 'Annonce mise à jour.', 'Choisir la région',
  ],
  de: [
    'Neue Anzeige', 'Anzeige bearbeiten', 'Handelsgebiet', 'Ändern', 'Festlegen', 'Fotos',
    'Titel', 'Anzeigentitel', 'Anzeigentyp', 'Gratisgabe', 'Preis (Pi)',
    'Beschreibung', '(optional)', 'Beschreiben Sie Ihren Artikel', 'Angebote erlauben', 'Käufer können bei Aktivierung Preisangebote senden', 'Gratisgaben können keine Angebote erhalten.',
    'Anzeige veröffentlichen', 'Verkaufte Anzeigen können nicht bearbeitet werden.', 'Während eines Streits ist keine Bearbeitung möglich.', 'Sie können bis zu {n} Fotos hochladen.',
    'Füllen Sie alle Pflichtfelder aus, einschließlich mindestens eines Fotos.', 'Fügen Sie mindestens ein Foto hinzu.',
    'Speichern fehlgeschlagen. Verbindung prüfen und erneut versuchen.', 'Anzeige aktualisiert.', 'Region wählen',
  ],
  id: [
    'Listing baru', 'Edit listing', 'Area transaksi', 'Ubah', 'Atur', 'Foto',
    'Judul', 'Judul listing', 'Jenis listing', 'Berbagi gratis', 'Harga (Pi)',
    'Deskripsi', '(opsional)', 'Jelaskan barang Anda', 'Izinkan penawaran', 'Pembeli dapat mengirim penawaran harga jika diaktifkan', 'Berbagi gratis tidak dapat menerima penawaran.',
    'Terbitkan listing', 'Listing terjual tidak bisa diedit.', 'Tidak bisa mengedit saat ada sengketa.', 'Anda dapat mengunggah hingga {n} foto.',
    'Isi semua bidang wajib, termasuk setidaknya satu foto.', 'Tambahkan setidaknya satu foto.', 'Gagal menyimpan. Periksa koneksi dan coba lagi.', 'Listing diperbarui.', 'Pilih wilayah',
  ],
  vi: [
    'Tin mới', 'Sửa tin', 'Khu vực giao dịch', 'Đổi', 'Đặt', 'Ảnh',
    'Tiêu đề', 'Tiêu đề tin', 'Loại tin', 'Chia sẻ miễn phí', 'Giá (Pi)',
    'Mô tả', '(tuỳ chọn)', 'Mô tả món đồ của bạn', 'Cho phép trả giá', 'Người mua có thể gửi giá khi bật', 'Chia sẻ miễn phí không nhận trả giá.',
    'Đăng tin', 'Tin đã bán không thể sửa.', 'Không thể sửa khi đang tranh chấp.', 'Bạn có thể tải lên tối đa {n} ảnh.',
    'Điền đủ các mục bắt buộc, gồm ít nhất một ảnh.', 'Thêm ít nhất một ảnh.', 'Không lưu được. Kiểm tra kết nối và thử lại.', 'Đã cập nhật tin.', 'Chọn khu vực',
  ],
  th: [
    'ประกาศใหม่', 'แก้ไขประกาศ', 'พื้นที่เทรด', 'เปลี่ยน', 'ตั้งค่า', 'รูปภาพ',
    'หัวข้อ', 'ชื่อประกาศ', 'ประเภทประกาศ', 'แชร์ฟรี', 'ราคา (Pi)',
    'รายละเอียด', '(ไม่บังคับ)', 'อธิบายสินค้าของคุณ', 'อนุญาตเสนอราคา', 'ผู้ซื้อสามารถส่งข้อเสนอราคาเมื่อเปิดใช้', 'แชร์ฟรีไม่รับข้อเสนอราคา',
    'เผยแพร่ประกาศ', 'ประกาศที่ขายแล้วแก้ไขไม่ได้', 'แก้ไขไม่ได้ระหว่างมีข้อพิพาท', 'อัปโหลดได้สูงสุด {n} รูป',
    'กรอกช่องที่จำเป็น รวมถึงรูปอย่างน้อย 1 รูป', 'เพิ่มรูปอย่างน้อย 1 รูป', 'บันทึกไม่สำเร็จ ตรวจสอบการเชื่อมต่อแล้วลองใหม่', 'อัปเดตประกาศแล้ว', 'เลือกภูมิภาค',
  ],
  hi: [
    'नई लिस्टिंग', 'लिस्टिंग संपादित करें', 'ट्रेड क्षेत्र', 'बदलें', 'सेट करें', 'फ़ोटो',
    'शीर्षक', 'लिस्टिंग शीर्षक', 'लिस्टिंग प्रकार', 'मुफ़्त शेयर', 'कीमत (Pi)',
    'विवरण', '(वैकल्पिक)', 'अपनी वस्तु का वर्णन करें', 'ऑफ़र अनुमति दें', 'चालू होने पर खरीदार कीमत ऑफ़र भेज सकते हैं', 'मुफ़्त शेयर पर ऑफ़र नहीं मिल सकते।',
    'लिस्टिंग प्रकाशित करें', 'बेची गई लिस्टिंग संपादित नहीं की जा सकती।', 'विवाद खुला होने पर संपादित नहीं कर सकते।', 'आप अधिकतम {n} फ़ोटो अपलोड कर सकते हैं।',
    'सभी आवश्यक फ़ील्ड भरें, कम से कम एक फ़ोटो सहित।', 'कम से कम एक फ़ोटो जोड़ें।', 'सहेज नहीं सके। कनेक्शन जाँचें और फिर कोशिश करें।', 'लिस्टिंग अपडेट हुई।', 'क्षेत्र चुनें',
  ],
  ar: [
    'إعلان جديد', 'تعديل الإعلان', 'منطقة التداول', 'تغيير', 'تعيين', 'صور',
    'العنوان', 'عنوان الإعلان', 'نوع الإعلان', 'مشاركة مجانية', 'السعر (Pi)',
    'الوصف', '(اختياري)', 'صف سلعتك', 'السماح بالعروض', 'يمكن للمشترين إرسال عروض سعر عند التفعيل', 'المشاركات المجانية لا تستقبل عروضًا.',
    'نشر الإعلان', 'لا يمكن تعديل الإعلانات المباعة.', 'لا يمكن التعديل أثناء وجود نزاع.', 'يمكنك رفع حتى {n} صور.',
    'أكمل كل الحقول المطلوبة، بما في ذلك صورة واحدة على الأقل.', 'أضف صورة واحدة على الأقل.', 'تعذّر الحفظ. تحقق من الاتصال وحاول مجددًا.', 'تم تحديث الإعلان.', 'اختر المنطقة',
  ],
  ru: [
    'Новое объявление', 'Редактировать объявление', 'Зона сделки', 'Изменить', 'Задать', 'Фото',
    'Заголовок', 'Название объявления', 'Тип объявления', 'Безвозмездно', 'Цена (Pi)',
    'Описание', '(необяз.)', 'Опишите товар', 'Разрешить предложения', 'Покупатели могут отправлять ценовые предложения', 'Безвозмездные объявления не принимают предложения.',
    'Опубликовать', 'Проданные объявления нельзя редактировать.', 'Нельзя редактировать при открытом споре.', 'Можно загрузить до {n} фото.',
    'Заполните все обязательные поля, включая хотя бы одно фото.', 'Добавьте хотя бы одно фото.', 'Не удалось сохранить. Проверьте соединение и попробуйте снова.', 'Объявление обновлено.', 'Выбрать регион',
  ],
  tr: [
    'Yeni ilan', 'İlanı düzenle', 'Takas bölgesi', 'Değiştir', 'Ayarla', 'Fotoğraflar',
    'Başlık', 'İlan başlığı', 'İlan türü', 'Ücretsiz paylaşım', 'Fiyat (Pi)',
    'Açıklama', '(isteğe bağlı)', 'Ürününüzü açıklayın', 'Tekliflere izin ver', 'Açıkken alıcılar fiyat teklifi gönderebilir', 'Ücretsiz paylaşımlar teklif alamaz.',
    'İlanı yayınla', 'Satılmış ilanlar düzenlenemez.', 'Anlaşmazlık varken düzenleyemezsiniz.', 'En fazla {n} fotoğraf yükleyebilirsiniz.',
    'En az bir fotoğraf dahil tüm zorunlu alanları doldurun.', 'En az bir fotoğraf ekleyin.', 'Kaydedilemedi. Bağlantıyı kontrol edip tekrar deneyin.', 'İlan güncellendi.', 'Bölge seç',
  ],
  it: [
    'Nuovo annuncio', 'Modifica annuncio', 'Zona di scambio', 'Cambia', 'Imposta', 'Foto',
    'Titolo', 'Titolo annuncio', 'Tipo di annuncio', 'Condivisione gratuita', 'Prezzo (Pi)',
    'Descrizione', '(facoltativo)', 'Descrivi il tuo articolo', 'Consenti offerte', 'Gli acquirenti possono inviare offerte se attivo', 'Le condivisioni gratuite non ricevono offerte.',
    'Pubblica annuncio', 'Gli annunci venduti non si possono modificare.', 'Non puoi modificare durante una controversia.', 'Puoi caricare fino a {n} foto.',
    'Compila tutti i campi obbligatori, inclusa almeno una foto.', 'Aggiungi almeno una foto.', 'Salvataggio non riuscito. Controlla la connessione e riprova.', 'Annuncio aggiornato.', 'Scegli regione',
  ],
  pl: [
    'Nowe ogłoszenie', 'Edytuj ogłoszenie', 'Obszar transakcji', 'Zmień', 'Ustaw', 'Zdjęcia',
    'Tytuł', 'Tytuł ogłoszenia', 'Typ ogłoszenia', 'Darmowe oddanie', 'Cena (Pi)',
    'Opis', '(opcjonalnie)', 'Opisz swój przedmiot', 'Zezwalaj na oferty', 'Kupujący mogą wysyłać oferty cenowe, gdy włączone', 'Darmowe oddania nie przyjmują ofert.',
    'Opublikuj ogłoszenie', 'Sprzedanych ogłoszeń nie można edytować.', 'Nie możesz edytować podczas sporu.', 'Możesz przesłać do {n} zdjęć.',
    'Wypełnij wszystkie wymagane pola, w tym co najmniej jedno zdjęcie.', 'Dodaj co najmniej jedno zdjęcie.', 'Nie udało się zapisać. Sprawdź połączenie i spróbuj ponownie.', 'Ogłoszenie zaktualizowane.', 'Wybierz region',
  ],
  nl: [
    'Nieuwe advertentie', 'Advertentie bewerken', 'Handelsgebied', 'Wijzigen', 'Instellen', 'Foto’s',
    'Titel', 'Advertentietitel', 'Advertentietype', 'Gratis delen', 'Prijs (Pi)',
    'Beschrijving', '(optioneel)', 'Beschrijf je item', 'Biedingen toestaan', 'Kopers kunnen prijsbiedingen sturen als ingeschakeld', 'Gratis delen kan geen biedingen ontvangen.',
    'Advertentie publiceren', 'Verkochte advertenties kunnen niet worden bewerkt.', 'Je kunt niet bewerken tijdens een geschil.', 'Je kunt maximaal {n} foto’s uploaden.',
    'Vul alle verplichte velden in, inclusief minstens één foto.', 'Voeg minstens één foto toe.', 'Opslaan mislukt. Controleer de verbinding en probeer opnieuw.', 'Advertentie bijgewerkt.', 'Kies regio',
  ],
  fil: [
    'Bagong listing', 'I-edit ang listing', 'Trade area', 'Palitan', 'Itakda', 'Mga larawan',
    'Pamagat', 'Pamagat ng listing', 'Uri ng listing', 'Free share', 'Presyo (Pi)',
    'Paglalarawan', '(opsyonal)', 'Ilarawan ang item mo', 'Payagan ang mga offer', 'Maaaring magpadala ang buyers ng price offer kapag naka-on', 'Hindi tumatanggap ng offer ang free shares.',
    'I-publish ang listing', 'Hindi made-edit ang nabentang listing.', 'Hindi made-edit habang may dispute.', 'Hanggang {n} larawan ang maaaring i-upload.',
    'Punan ang lahat ng required fields, kasama ang kahit isang larawan.', 'Magdagdag ng kahit isang larawan.', 'Hindi ma-save. Suriin ang connection at subukan ulit.', 'Na-update ang listing.', 'Pumili ng rehiyon',
  ],
  uk: [
    'Нове оголошення', 'Редагувати оголошення', 'Зона угоди', 'Змінити', 'Встановити', 'Фото',
    'Заголовок', 'Назва оголошення', 'Тип оголошення', 'Безоплатно', 'Ціна (Pi)',
    'Опис', '(необов’язково)', 'Опишіть свій товар', 'Дозволити пропозиції', 'Покупці можуть надсилати цінові пропозиції, коли ввімкнено', 'Безоплатні оголошення не приймають пропозиції.',
    'Опублікувати', 'Продані оголошення не можна редагувати.', 'Не можна редагувати під час відкритої суперечки.', 'Можна завантажити до {n} фото.',
    'Заповніть усі обов’язкові поля, включно щонайменше з одним фото.', 'Додайте щонайменше одне фото.', 'Не вдалося зберегти. Перевірте з’єднання й спробуйте знову.', 'Оголошення оновлено.', 'Обрати регіон',
  ],
  bn: [
    'নতুন লিস্টিং', 'লিস্টিং সম্পাদনা', 'লেনদেনের এলাকা', 'পরিবর্তন', 'সেট', 'ছবি',
    'শিরোনাম', 'লিস্টিংয়ের শিরোনাম', 'লিস্টিংয়ের ধরন', 'ফ্রি শেয়ার', 'মূল্য (Pi)',
    'বিবরণ', '(ঐচ্ছিক)', 'আপনার জিনিসটি বর্ণনা করুন', 'অফার অনুমতি দিন', 'চালু থাকলে ক্রেতারা দামের অফার পাঠাতে পারে', 'ফ্রি শেয়ারে অফার নেওয়া যায় না।',
    'লিস্টিং প্রকাশ করুন', 'বিক্রি হওয়া লিস্টিং সম্পাদনা করা যায় না।', 'বিরোধ চলাকালীন সম্পাদনা করা যায় না।', 'আপনি সর্বোচ্চ {n}টি ছবি আপলোড করতে পারেন।',
    'সব আবশ্যক ক্ষেত্র পূরণ করুন, অন্তত একটি ছবিসহ।', 'অন্তত একটি ছবি যোগ করুন।', 'সংরক্ষণ ব্যর্থ। সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।', 'লিস্টিং আপডেট হয়েছে।', 'অঞ্চল বেছে নিন',
  ],
  ms: [
    'Senarai baharu', 'Edit senarai', 'Kawasan dagangan', 'Tukar', 'Tetapkan', 'Foto',
    'Tajuk', 'Tajuk senarai', 'Jenis senarai', 'Kongsi percuma', 'Harga (Pi)',
    'Penerangan', '(pilihan)', 'Terangkan item anda', 'Benarkan tawaran', 'Pembeli boleh menghantar tawaran harga apabila diaktifkan', 'Kongsi percuma tidak boleh menerima tawaran.',
    'Terbitkan senarai', 'Senarai terjual tidak boleh diedit.', 'Anda tidak boleh mengedit semasa pertikaian dibuka.', 'Anda boleh memuat naik sehingga {n} foto.',
    'Isikan semua medan wajib, termasuk sekurang-kurangnya satu foto.', 'Tambah sekurang-kurangnya satu foto.', 'Tidak dapat menyimpan. Semak sambungan dan cuba lagi.', 'Senarai dikemas kini.', 'Pilih wilayah',
  ],
  sw: [
    'Orodha mpya', 'Hariri orodha', 'Eneo la biashara', 'Badilisha', 'Weka', 'Picha',
    'Kichwa', 'Kichwa cha orodha', 'Aina ya orodha', 'Shiriki bure', 'Bei (Pi)',
    'Maelezo', '(si lazima)', 'Eleza bidhaa yako', 'Ruhusu ofa', 'Wanunuzi wanaweza kutuma ofa za bei zinapowashwa', 'Ushiriki wa bure hauwezi kupokea ofa.',
    'Chapisha orodha', 'Orodha zilizouzwa haziwezi kuhaririwa.', 'Huwezi kuhariri mgogoro ukiwa wazi.', 'Unaweza kupakia hadi picha {n}.',
    'Jaza sehemu zote zinazohitajika, ikijumuisha angalau picha moja.', 'Ongeza angalau picha moja.', 'Imeshindwa kuhifadhi. Angalia muunganisho na ujaribu tena.', 'Orodha imesasishwa.', 'Chagua eneo',
  ],
  fa: [
    'آگهی جدید', 'ویرایش آگهی', 'منطقه معامله', 'تغییر', 'تنظیم', 'عکس‌ها',
    'عنوان', 'عنوان آگهی', 'نوع آگهی', 'اشتراک رایگان', 'قیمت (Pi)',
    'توضیحات', '(اختیاری)', 'کالای خود را توضیح دهید', 'اجازه پیشنهاد', 'خریداران می‌توانند وقتی فعال است پیشنهاد قیمت بفرستند', 'اشتراک رایگان پیشنهاد نمی‌پذیرد.',
    'انتشار آگهی', 'آگهی‌های فروخته‌شده قابل ویرایش نیستند.', 'در هنگام اختلاف باز نمی‌توان ویرایش کرد.', 'می‌توانید تا {n} عکس آپلود کنید.',
    'همه فیلدهای الزامی را پر کنید، از جمله حداقل یک عکس.', 'حداقل یک عکس اضافه کنید.', 'ذخیره نشد. اتصال را بررسی و دوباره تلاش کنید.', 'آگهی به‌روز شد.', 'انتخاب منطقه',
  ],
  ur: [
    'نئی لسٹنگ', 'لسٹنگ میں ترمیم', 'ٹریڈ ایریا', 'تبدیل کریں', 'سیٹ کریں', 'تصاویر',
    'عنوان', 'لسٹنگ کا عنوان', 'لسٹنگ کی قسم', 'مفت شیئر', 'قیمت (Pi)',
    'تفصیل', '(اختیاری)', 'اپنی چیز بیان کریں', 'پیشکشوں کی اجازت', 'آن ہونے پر خریدار قیمت کی پیشکش بھیج سکتے ہیں', 'مفت شیئر پیشکشیں وصول نہیں کر سکتے۔',
    'لسٹنگ شائع کریں', 'فروخت شدہ لسٹنگ میں ترمیم نہیں ہو سکتی۔', 'تنازع کھلا ہونے پر ترمیم نہیں کر سکتے۔', 'آپ زیادہ سے زیادہ {n} تصاویر اپ لوڈ کر سکتے ہیں۔',
    'تمام ضروری خانے بھریں، کم از کم ایک تصویر سمیت۔', 'کم از کم ایک تصویر شامل کریں۔', 'محفوظ نہیں ہو سکی۔ کنکشن چیک کر کے دوبارہ کوشش کریں۔', 'لسٹنگ اپڈیٹ ہو گئی۔', 'علاقہ منتخب کریں',
  ],
};

for (const [lang, arr] of Object.entries(table)) {
  if (arr.length !== keys.length) throw new Error(`${lang}: ${arr.length} != ${keys.length}`);
}

let out = `/* Auto-generated by scripts/gen-listing-i18n.mjs */
import type { AppLanguage } from '@/utils/languageStorage';

export type ListingMessageKey =
${keys.map((k) => `  | '${k}'`).join('\n')};

const LISTING_MESSAGES: Record<AppLanguage, Record<ListingMessageKey, string>> = {\n`;

for (const lang of Object.keys(table)) {
  out += `  ${lang}: {\n`;
  keys.forEach((k, i) => {
    const v = table[lang][i].replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    out += `    ${k}: '${v}',\n`;
  });
  out += `  },\n`;
}
out += `};

export function listingT(lang: AppLanguage, key: ListingMessageKey, vars?: Record<string, string | number>): string {
  const raw = LISTING_MESSAGES[lang]?.[key] ?? LISTING_MESSAGES.en[key] ?? key;
  if (!vars) return raw;
  return Object.entries(vars).reduce(
    (s, [k, v]) => s.split('{' + k + '}').join(String(v)),
    raw,
  );
}
`;

fs.writeFileSync(path.join(__dirname, '../src/i18n/listingMessages.ts'), out, 'utf8');
console.log('Wrote listingMessages.ts', keys.length, 'keys');
