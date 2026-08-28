import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const keys = [
  'myTitle', 'editProfile', 'profileTab', 'badgesTab', 'activityBadges', 'back', 'guest',
  'myListings', 'saved', 'orders', 'myPosts', 'reviews', 'inquiries', 'disputes', 'settings',
  'badgesEarnHint', 'badgesTapHint', 'badgeMain', 'badgeEarnFree', 'badgeUnlockNow',
  'close', 'payPi', 'processing', 'paymentCancelled', 'paymentFailed',
  'ariaBadgeFeatured', 'ariaBadgeSet', 'ariaBadgeLocked',
  'noSavedListings', 'browseListings', 'removeFromSavedConfirm', 'noSavedMatchFilter',
  'listingWasRemoved', 'removeFromList', 'removeFromSavedAria',
];

/** @type {Record<string, string[]>} */
const table = {
  en: [
    'MY', 'Edit profile', 'Profile', 'Badges', 'Activity badges', 'Back', 'Guest',
    'My listings', 'Saved', 'Orders', 'My posts', 'Reviews', 'Inquiries', 'Disputes', 'Settings',
    'Earn badges by trading and joining the community.',
    'Tap an unlocked badge to show it on your profile photo. Tap again to clear.',
    'Main', 'Complete missions to earn this badge for free.', 'Want to unlock it now?',
    'Close', 'Pay {n} Pi', 'Processing...', 'Payment cancelled.', 'Payment failed. Please try again in Pi Browser.',
    '{name}, featured on profile, tap to remove', '{name}, tap to set as profile badge', '{name}, locked — tap to purchase',
    'No saved listings.', 'Browse listings', 'Remove "{title}" from saved?', 'No saved listings match this filter.',
    'This listing was removed.', 'Remove from list', 'Remove from saved',
  ],
  ko: [
    'MY', '프로필 수정', '프로필', '배지', '활동 배지', '뒤로', '게스트',
    '내 상품', '관심목록', '주문', '내 게시글', '후기', '문의', '분쟁', '설정',
    '거래와 커뮤니티 활동으로 배지를 모으세요.',
    '해금된 배지를 탭하면 프로필 사진에 표시됩니다. 다시 탭하면 해제됩니다.',
    '대표', '미션을 완료하면 이 배지를 무료로 받을 수 있습니다.', '지금 바로 잠금 해제할까요?',
    '닫기', '{n} Pi 결제', '처리 중...', '결제가 취소되었습니다.', '결제에 실패했습니다. Pi Browser에서 다시 시도해 주세요.',
    '{name}, 프로필에 표시 중, 탭하여 해제', '{name}, 탭하여 프로필 배지로 설정', '{name}, 잠김 — 탭하여 구매',
    '관심 상품이 없습니다.', '상품 둘러보기', '"{title}"을(를) 관심목록에서 제거할까요?', '이 필터에 맞는 관심 상품이 없습니다.',
    '삭제된 상품입니다.', '목록에서 제거', '관심목록에서 제거',
  ],
  zh: [
    '我的', '编辑资料', '资料', '徽章', '活动徽章', '返回', '访客',
    '我的商品', '收藏', '订单', '我的帖子', '评价', '咨询', '争议', '设置',
    '通过交易和参与社区获取徽章。',
    '点按已解锁徽章可显示在头像上，再点一次可取消。',
    '主', '完成任务可免费获得此徽章。', '要现在解锁吗？',
    '关闭', '支付 {n} Pi', '处理中...', '已取消支付。', '支付失败。请在 Pi Browser 中重试。',
    '{name}，已在资料展示，点按移除', '{name}，点按设为资料徽章', '{name}，未解锁 — 点按购买',
    '暂无收藏。', '浏览商品', '将“{title}”从收藏中移除？', '没有符合此筛选的收藏。',
    '该商品已删除。', '从列表移除', '从收藏移除',
  ],
  ja: [
    'MY', 'プロフィール編集', 'プロフィール', 'バッジ', 'アクティビティバッジ', '戻る', 'ゲスト',
    '出品一覧', '保存済み', '注文', '投稿', 'レビュー', 'お問い合わせ', '紛争', '設定',
    '取引やコミュニティ参加でバッジを集めましょう。',
    '解除済みバッジをタップするとプロフィール写真に表示。もう一度で解除。',
    'メイン', 'ミッションを達成すると無料で獲得できます。', '今すぐ解除しますか？',
    '閉じる', '{n} Pi を支払う', '処理中...', '支払いがキャンセルされました。', '支払いに失敗しました。Pi Browserで再試行してください。',
    '{name}、プロフィール表示中、タップで解除', '{name}、タップでプロフィールバッジに設定', '{name}、ロック中 — タップで購入',
    '保存した出品はありません。', '出品を見る', '「{title}」を保存から削除しますか？', 'この条件に合う保存はありません。',
    'この出品は削除されました。', 'リストから削除', '保存から削除',
  ],
  es: [
    'YO', 'Editar perfil', 'Perfil', 'Insignias', 'Insignias de actividad', 'Atrás', 'Invitado',
    'Mis anuncios', 'Guardados', 'Pedidos', 'Mis publicaciones', 'Reseñas', 'Consultas', 'Disputas', 'Ajustes',
    'Gana insignias comerciando y uniéndote a la comunidad.',
    'Toca una insignia desbloqueada para mostrarla en tu foto. Toca de nuevo para quitarla.',
    'Principal', 'Completa misiones para ganar esta insignia gratis.', '¿Quieres desbloquearla ahora?',
    'Cerrar', 'Pagar {n} Pi', 'Procesando...', 'Pago cancelado.', 'Pago fallido. Inténtalo de nuevo en Pi Browser.',
    '{name}, destacada en el perfil, toca para quitar', '{name}, toca para poner como insignia', '{name}, bloqueada — toca para comprar',
    'No hay guardados.', 'Ver anuncios', '¿Quitar "{title}" de guardados?', 'Ningún guardado coincide con este filtro.',
    'Este anuncio se eliminó.', 'Quitar de la lista', 'Quitar de guardados',
  ],
  pt: [
    'EU', 'Editar perfil', 'Perfil', 'Emblemas', 'Emblemas de atividade', 'Voltar', 'Convidado',
    'Meus anúncios', 'Salvos', 'Pedidos', 'Minhas postagens', 'Avaliações', 'Consultas', 'Disputas', 'Configurações',
    'Ganhe emblemas negociando e participando da comunidade.',
    'Toque num emblema desbloqueado para mostrar na foto. Toque de novo para limpar.',
    'Principal', 'Conclua missões para ganhar este emblema de graça.', 'Quer desbloquear agora?',
    'Fechar', 'Pagar {n} Pi', 'Processando...', 'Pagamento cancelado.', 'Pagamento falhou. Tente de novo no Pi Browser.',
    '{name}, em destaque no perfil, toque para remover', '{name}, toque para definir no perfil', '{name}, bloqueado — toque para comprar',
    'Nenhum anúncio salvo.', 'Ver anúncios', 'Remover "{title}" dos salvos?', 'Nenhum salvo corresponde a este filtro.',
    'Este anúncio foi removido.', 'Remover da lista', 'Remover dos salvos',
  ],
  fr: [
    'MOI', 'Modifier le profil', 'Profil', 'Badges', 'Badges d’activité', 'Retour', 'Invité',
    'Mes annonces', 'Enregistrés', 'Commandes', 'Mes publications', 'Avis', 'Demandes', 'Litiges', 'Paramètres',
    'Gagnez des badges en échangeant et en rejoignant la communauté.',
    'Appuyez sur un badge débloqué pour l’afficher sur votre photo. Appuyez à nouveau pour le retirer.',
    'Principal', 'Terminez des missions pour gagner ce badge gratuitement.', 'Débloquer maintenant ?',
    'Fermer', 'Payer {n} Pi', 'Traitement...', 'Paiement annulé.', 'Échec du paiement. Réessayez dans Pi Browser.',
    '{name}, affiché sur le profil, appuyer pour retirer', '{name}, appuyer pour définir comme badge', '{name}, verrouillé — appuyer pour acheter',
    'Aucun enregistrement.', 'Parcourir les annonces', 'Retirer « {title} » des enregistrés ?', 'Aucun enregistrement ne correspond à ce filtre.',
    'Cette annonce a été supprimée.', 'Retirer de la liste', 'Retirer des enregistrés',
  ],
  de: [
    'ICH', 'Profil bearbeiten', 'Profil', 'Abzeichen', 'Aktivitätsabzeichen', 'Zurück', 'Gast',
    'Meine Angebote', 'Gespeichert', 'Bestellungen', 'Meine Beiträge', 'Bewertungen', 'Anfragen', 'Streits', 'Einstellungen',
    'Verdiene Abzeichen durch Handeln und Community-Teilnahme.',
    'Tippe auf ein freigeschaltetes Abzeichen für dein Profilfoto. Erneut tippen zum Entfernen.',
    'Haupt', 'Erledige Missionen, um dieses Abzeichen gratis zu erhalten.', 'Jetzt freischalten?',
    'Schließen', '{n} Pi zahlen', 'Wird verarbeitet...', 'Zahlung abgebrochen.', 'Zahlung fehlgeschlagen. Bitte im Pi Browser erneut versuchen.',
    '{name}, im Profil hervorgehoben, tippen zum Entfernen', '{name}, tippen als Profilabzeichen', '{name}, gesperrt — tippen zum Kaufen',
    'Keine gespeicherten Anzeigen.', 'Anzeigen durchsuchen', '„{title}“ aus Gespeichert entfernen?', 'Keine gespeicherten Anzeigen passen zu diesem Filter.',
    'Diese Anzeige wurde entfernt.', 'Aus Liste entfernen', 'Aus Gespeichert entfernen',
  ],
  id: [
    'SAYA', 'Edit profil', 'Profil', 'Lencana', 'Lencana aktivitas', 'Kembali', 'Tamu',
    'Listing saya', 'Tersimpan', 'Pesanan', 'Postingan saya', 'Ulasan', 'Pertanyaan', 'Sengketa', 'Pengaturan',
    'Dapatkan lencana dengan bertransaksi dan bergabung di komunitas.',
    'Ketuk lencana terbuka untuk ditampilkan di foto profil. Ketuk lagi untuk menghapus.',
    'Utama', 'Selesaikan misi untuk mendapatkan lencana ini gratis.', 'Ingin membuka sekarang?',
    'Tutup', 'Bayar {n} Pi', 'Memproses...', 'Pembayaran dibatalkan.', 'Pembayaran gagal. Coba lagi di Pi Browser.',
    '{name}, ditampilkan di profil, ketuk untuk menghapus', '{name}, ketuk untuk set sebagai lencana profil', '{name}, terkunci — ketuk untuk beli',
    'Belum ada listing tersimpan.', 'Jelajahi listing', 'Hapus "{title}" dari tersimpan?', 'Tidak ada tersimpan yang cocok dengan filter ini.',
    'Listing ini telah dihapus.', 'Hapus dari daftar', 'Hapus dari tersimpan',
  ],
  vi: [
    'TÔI', 'Sửa hồ sơ', 'Hồ sơ', 'Huy hiệu', 'Huy hiệu hoạt động', 'Quay lại', 'Khách',
    'Tin đăng của tôi', 'Đã lưu', 'Đơn hàng', 'Bài viết của tôi', 'Đánh giá', 'Hỏi đáp', 'Tranh chấp', 'Cài đặt',
    'Kiếm huy hiệu bằng giao dịch và tham gia cộng đồng.',
    'Chạm huy hiệu đã mở để hiện trên ảnh hồ sơ. Chạm lại để gỡ.',
    'Chính', 'Hoàn thành nhiệm vụ để nhận huy hiệu miễn phí.', 'Muốn mở khóa ngay?',
    'Đóng', 'Thanh toán {n} Pi', 'Đang xử lý...', 'Đã hủy thanh toán.', 'Thanh toán thất bại. Thử lại trong Pi Browser.',
    '{name}, đang gắn hồ sơ, chạm để gỡ', '{name}, chạm để đặt làm huy hiệu hồ sơ', '{name}, đã khóa — chạm để mua',
    'Chưa có tin đã lưu.', 'Xem tin đăng', 'Xóa "{title}" khỏi đã lưu?', 'Không có tin đã lưu khớp bộ lọc này.',
    'Tin này đã bị xóa.', 'Xóa khỏi danh sách', 'Xóa khỏi đã lưu',
  ],
  th: [
    'ของฉัน', 'แก้ไขโปรไฟล์', 'โปรไฟล์', 'เหรียญ', 'เหรียญกิจกรรม', 'กลับ', 'แขก',
    'ประกาศของฉัน', 'ที่บันทึก', 'คำสั่งซื้อ', 'โพสต์ของฉัน', 'รีวิว', 'สอบถาม', 'ข้อพิพาท', 'ตั้งค่า',
    'สะสมเหรียญจากการซื้อขายและชุมชน',
    'แตะเหรียญที่ปลดแล้วเพื่อแสดงบนรูปโปรไฟล์ แตะอีกครั้งเพื่อล้าง',
    'หลัก', 'ทำภารกิจเพื่อรับเหรียญนี้ฟรี', 'ต้องการปลดล็อกตอนนี้ไหม?',
    'ปิด', 'จ่าย {n} Pi', 'กำลังดำเนินการ...', 'ยกเลิกการชำระเงินแล้ว', 'ชำระเงินไม่สำเร็จ ลองใหม่ใน Pi Browser',
    '{name} แสดงบนโปรไฟล์ แตะเพื่อเอาออก', '{name} แตะเพื่อตั้งเป็นเหรียญโปรไฟล์', '{name} ล็อก — แตะเพื่อซื้อ',
    'ยังไม่มีรายการที่บันทึก', 'ดูประกาศ', 'ลบ "{title}" ออกจากที่บันทึก?', 'ไม่มีรายการที่บันทึกตรงกับตัวกรองนี้',
    'รายการนี้ถูกลบแล้ว', 'ลบออกจากรายการ', 'ลบออกจากที่บันทึก',
  ],
  hi: [
    'मेरा', 'प्रोफ़ाइल संपादित', 'प्रोफ़ाइल', 'बैज', 'गतिविधि बैज', 'वापस', 'अतिथि',
    'मेरी लिस्टिंग', 'सेव्ड', 'ऑर्डर', 'मेरी पोस्ट', 'रिव्यू', 'पूछताछ', 'विवाद', 'सेटिंग्स',
    'ट्रेड और कम्युनिटी से बैज कमाएँ।',
    'अनलॉक बैज टैप करें प्रोफ़ाइल फ़ोटो पर दिखाने के लिए। फिर से टैप करें हटाने के लिए।',
    'मुख्य', 'मुफ़्त बैज के लिए मिशन पूरे करें।', 'अभी अनलॉक करें?',
    'बंद', '{n} Pi भुगतान', 'प्रोसेसिंग...', 'भुगतान रद्द।', 'भुगतान विफल। Pi Browser में फिर कोशिश करें।',
    '{name}, प्रोफ़ाइल पर, हटाने के लिए टैप', '{name}, प्रोफ़ाइल बैज के लिए टैप', '{name}, लॉक — खरीदने के लिए टैप',
    'कोई सेव्ड लिस्टिंग नहीं।', 'लिस्टिंग देखें', '"{title}" को सेव्ड से हटाएँ?', 'इस फ़िल्टर से कोई सेव्ड मैच नहीं।',
    'यह लिस्टिंग हटा दी गई।', 'सूची से हटाएँ', 'सेव्ड से हटाएँ',
  ],
  ar: [
    'حسابي', 'تعديل الملف', 'الملف', 'الشارات', 'شارات النشاط', 'رجوع', 'زائر',
    'إعلاناتي', 'المحفوظات', 'الطلبات', 'منشوراتي', 'التقييمات', 'الاستفسارات', 'النزاعات', 'الإعدادات',
    'احصل على شارات بالتداول والمشاركة في المجتمع.',
    'اضغط شارة مفتوحة لعرضها على صورتك. اضغط مجددًا لإزالتها.',
    'أساسي', 'أكمل المهام للحصول على هذه الشارة مجانًا.', 'هل تريد فتحها الآن؟',
    'إغلاق', 'ادفع {n} Pi', 'جارٍ المعالجة...', 'أُلغي الدفع.', 'فشل الدفع. أعد المحاولة في Pi Browser.',
    '{name}، معروضة على الملف، اضغط للإزالة', '{name}، اضغط لتعيينها كشارة ملف', '{name}، مقفلة — اضغط للشراء',
    'لا محفوظات.', 'تصفح الإعلانات', 'إزالة "{title}" من المحفوظات؟', 'لا محفوظات تطابق هذا الفلتر.',
    'تم حذف هذا الإعلان.', 'إزالة من القائمة', 'إزالة من المحفوظات',
  ],
  ru: [
    'Я', 'Изменить профиль', 'Профиль', 'Значки', 'Значки активности', 'Назад', 'Гость',
    'Мои объявления', 'Сохранённое', 'Заказы', 'Мои посты', 'Отзывы', 'Запросы', 'Споры', 'Настройки',
    'Зарабатывайте значки сделками и участием в сообществе.',
    'Нажмите разблокированный значок, чтобы показать на фото. Нажмите снова, чтобы убрать.',
    'Главный', 'Выполните задания, чтобы получить значок бесплатно.', 'Разблокировать сейчас?',
    'Закрыть', 'Оплатить {n} Pi', 'Обработка...', 'Оплата отменена.', 'Оплата не удалась. Повторите в Pi Browser.',
    '{name}, на профиле, нажмите чтобы убрать', '{name}, нажмите чтобы поставить на профиль', '{name}, закрыт — нажмите чтобы купить',
    'Нет сохранённых объявлений.', 'Смотреть объявления', 'Убрать «{title}» из сохранённых?', 'Нет сохранённых по этому фильтру.',
    'Это объявление удалено.', 'Убрать из списка', 'Убрать из сохранённых',
  ],
  tr: [
    'BEN', 'Profili düzenle', 'Profil', 'Rozetler', 'Etkinlik rozetleri', 'Geri', 'Misafir',
    'İlanlarım', 'Kaydedilenler', 'Siparişler', 'Gönderilerim', 'Yorumlar', 'Sorular', 'Anlaşmazlıklar', 'Ayarlar',
    'Alışveriş ve topluluk ile rozet kazanın.',
    'Açık rozete dokunup profil fotoğrafında gösterin. Tekrar dokununca kaldırılır.',
    'Ana', 'Görevleri tamamlayarak bu rozeti ücretsiz kazanın.', 'Şimdi açılsın mı?',
    'Kapat', '{n} Pi öde', 'İşleniyor...', 'Ödeme iptal edildi.', 'Ödeme başarısız. Pi Browser’da tekrar deneyin.',
    '{name}, profilde öne çıkarıldı, kaldırmak için dokunun', '{name}, profil rozeti yapmak için dokunun', '{name}, kilitli — satın almak için dokunun',
    'Kaydedilmiş ilan yok.', 'İlanlara göz at', '"{title}" kaydedilenlerden kaldırılsın mı?', 'Bu filtreye uyan kayıt yok.',
    'Bu ilan kaldırıldı.', 'Listeden kaldır', 'Kaydedilenlerden kaldır',
  ],
  it: [
    'IO', 'Modifica profilo', 'Profilo', 'Badge', 'Badge attività', 'Indietro', 'Ospite',
    'I miei annunci', 'Salvati', 'Ordini', 'I miei post', 'Recensioni', 'Richieste', 'Controversie', 'Impostazioni',
    'Guadagna badge scambiando e partecipando alla community.',
    'Tocca un badge sbloccato per mostrarlo sulla foto. Tocca di nuovo per rimuoverlo.',
    'Principale', 'Completa le missioni per ottenere questo badge gratis.', 'Sbloccare ora?',
    'Chiudi', 'Paga {n} Pi', 'Elaborazione...', 'Pagamento annullato.', 'Pagamento non riuscito. Riprova in Pi Browser.',
    '{name}, in evidenza sul profilo, tocca per rimuovere', '{name}, tocca per impostare come badge', '{name}, bloccato — tocca per acquistare',
    'Nessun annuncio salvato.', 'Sfoglia gli annunci', 'Rimuovere "{title}" dai salvati?', 'Nessun salvato corrisponde a questo filtro.',
    'Questo annuncio è stato rimosso.', 'Rimuovi dall’elenco', 'Rimuovi dai salvati',
  ],
  pl: [
    'JA', 'Edytuj profil', 'Profil', 'Odznaki', 'Odznaki aktywności', 'Wstecz', 'Gość',
    'Moje ogłoszenia', 'Zapisane', 'Zamówienia', 'Moje posty', 'Opinie', 'Zapytania', 'Spory', 'Ustawienia',
    'Zdobywaj odznaki handlując i działając w społeczności.',
    'Dotknij odblokowanej odznaki, by pokazać na zdjęciu. Dotknij ponownie, by usunąć.',
    'Główna', 'Ukończ misje, by dostać tę odznakę za darmo.', 'Odblokować teraz?',
    'Zamknij', 'Zapłać {n} Pi', 'Przetwarzanie...', 'Płatność anulowana.', 'Płatność nieudana. Spróbuj w Pi Browser.',
    '{name}, wyróżniona na profilu, dotknij aby usunąć', '{name}, dotknij aby ustawić na profilu', '{name}, zablokowana — dotknij aby kupić',
    'Brak zapisanych ogłoszeń.', 'Przeglądaj ogłoszenia', 'Usunąć „{title}” z zapisanych?', 'Brak zapisanych dla tego filtra.',
    'To ogłoszenie zostało usunięte.', 'Usuń z listy', 'Usuń z zapisanych',
  ],
  nl: [
    'IK', 'Profiel bewerken', 'Profiel', 'Badges', 'Activiteitsbadges', 'Terug', 'Gast',
    'Mijn advertenties', 'Opgeslagen', 'Bestellingen', 'Mijn posts', 'Reviews', 'Vragen', 'Geschillen', 'Instellingen',
    'Verdien badges door te handelen en mee te doen in de community.',
    'Tik op een ontgrendelde badge voor je profielfoto. Tik opnieuw om te wissen.',
    'Hoofd', 'Voltooi missies om deze badge gratis te verdienen.', 'Nu ontgrendelen?',
    'Sluiten', 'Betaal {n} Pi', 'Bezig...', 'Betaling geannuleerd.', 'Betaling mislukt. Probeer opnieuw in Pi Browser.',
    '{name}, uitgelicht op profiel, tik om te verwijderen', '{name}, tik om als profielbadge te zetten', '{name}, vergrendeld — tik om te kopen',
    'Geen opgeslagen advertenties.', 'Advertenties bekijken', '"{title}" uit opgeslagen verwijderen?', 'Geen opgeslagen items voor dit filter.',
    'Deze advertentie is verwijderd.', 'Uit lijst verwijderen', 'Uit opgeslagen verwijderen',
  ],
  fil: [
    'AKO', 'I-edit ang profile', 'Profile', 'Badges', 'Activity badges', 'Bumalik', 'Bisita',
    'Mga listing ko', 'Naka-save', 'Mga order', 'Mga post ko', 'Mga review', 'Mga tanong', 'Mga dispute', 'Settings',
    'Kumita ng badges sa pakikipagtrade at pagsali sa community.',
    'I-tap ang unlocked badge para ipakita sa profile photo. I-tap ulit para alisin.',
    'Pangunahin', 'Kumpletuhin ang missions para libre ang badge na ito.', 'I-unlock ngayon?',
    'Isara', 'Magbayad ng {n} Pi', 'Pinoproseso...', 'Kinansela ang bayad.', 'Hindi nagtagumpay ang bayad. Subukan ulit sa Pi Browser.',
    '{name}, naka-display sa profile, i-tap para alisin', '{name}, i-tap para gawing profile badge', '{name}, naka-lock — i-tap para bilhin',
    'Walang naka-save na listing.', 'Tumingin ng listings', 'Alisin ang "{title}" sa naka-save?', 'Walang naka-save na tumutugma sa filter na ito.',
    'Natanggal na ang listing na ito.', 'Alisin sa listahan', 'Alisin sa naka-save',
  ],
  uk: [
    'Я', 'Редагувати профіль', 'Профіль', 'Значки', 'Значки активності', 'Назад', 'Гість',
    'Мої оголошення', 'Збережене', 'Замовлення', 'Мої пости', 'Відгуки', 'Запити', 'Суперечки', 'Налаштування',
    'Заробляйте значки угодами та участю в спільноті.',
    'Торкніться розблокованого значка, щоб показати на фото. Ще раз — щоб прибрати.',
    'Головний', 'Виконайте місії, щоб отримати цей значок безкоштовно.', 'Розблокувати зараз?',
    'Закрити', 'Сплатити {n} Pi', 'Обробка...', 'Оплату скасовано.', 'Оплата не вдалася. Спробуйте знову в Pi Browser.',
    '{name}, на профілі, торкніться щоб прибрати', '{name}, торкніться щоб поставити на профіль', '{name}, заблоковано — торкніться щоб купити',
    'Немає збережених оголошень.', 'Переглянути оголошення', 'Прибрати «{title}» зі збережених?', 'Немає збережених за цим фільтром.',
    'Це оголошення видалено.', 'Прибрати зі списку', 'Прибрати зі збережених',
  ],
  bn: [
    'আমি', 'প্রোফাইল সম্পাদনা', 'প্রোফাইল', 'ব্যাজ', 'অ্যাক্টিভিটি ব্যাজ', 'ফিরে যান', 'অতিথি',
    'আমার তালিকা', 'সেভড', 'অর্ডার', 'আমার পোস্ট', 'রিভিউ', 'জিজ্ঞাসা', 'বিরোধ', 'সেটিংস',
    'লেনদেন ও কমিউনিটিতে যোগ দিয়ে ব্যাজ অর্জন করুন।',
    'আনলক ব্যাজে ট্যাপ করলে প্রোফাইল ছবিতে দেখাবে। আবার ট্যাপ করলে সরবে।',
    'মেইন', 'মিশন সম্পন্ন করে এই ব্যাজ বিনামূল্যে পান।', 'এখন আনলক করবেন?',
    'বন্ধ', '{n} Pi পরিশোধ', 'প্রসেস হচ্ছে...', 'পেমেন্ট বাতিল।', 'পেমেন্ট ব্যর্থ। Pi Browser-এ আবার চেষ্টা করুন।',
    '{name}, প্রোফাইলে দেখানো, সরাতে ট্যাপ', '{name}, প্রোফাইল ব্যাজ করতে ট্যাপ', '{name}, লক — কিনতে ট্যাপ',
    'কোনো সেভড লিস্টিং নেই।', 'লিস্টিং দেখুন', '"{title}" সেভড থেকে সরবেন?', 'এই ফিল্টারে কোনো সেভড নেই।',
    'এই লিস্টিং সরানো হয়েছে।', 'তালিকা থেকে সরান', 'সেভড থেকে সরান',
  ],
  ms: [
    'SAYA', 'Edit profil', 'Profil', 'Lencana', 'Lencana aktiviti', 'Kembali', 'Tetamu',
    'Senarai saya', 'Disimpan', 'Pesanan', 'Siaran saya', 'Ulasan', 'Pertanyaan', 'Pertikaian', 'Tetapan',
    'Dapatkan lencana dengan berdagang dan menyertai komuniti.',
    'Ketik lencana dibuka untuk papar pada foto profil. Ketik lagi untuk buang.',
    'Utama', 'Lengkapkan misi untuk dapatkan lencana ini percuma.', 'Buka kunci sekarang?',
    'Tutup', 'Bayar {n} Pi', 'Memproses...', 'Pembayaran dibatalkan.', 'Pembayaran gagal. Cuba lagi dalam Pi Browser.',
    '{name}, dipaparkan pada profil, ketik untuk buang', '{name}, ketik untuk tetapkan lencana profil', '{name}, dikunci — ketik untuk beli',
    'Tiada senarai disimpan.', 'Lihat senarai', 'Buang "{title}" daripada disimpan?', 'Tiada yang disimpan sepadan dengan penapis ini.',
    'Senarai ini telah dialih keluar.', 'Buang dari senarai', 'Buang dari disimpan',
  ],
  sw: [
    'MIMI', 'Hariri wasifu', 'Wasifu', 'Beji', 'Beji za shughuli', 'Rudi', 'Mgeni',
    'Matangazo yangu', 'Yaliyohifadhiwa', 'Oda', 'Machapisho yangu', 'Mapitio', 'Maswali', 'Migogoro', 'Mipangilio',
    'Pata beji kwa biashara na kujiunga na jamii.',
    'Gusa beji iliyofunguliwa kuionyesha kwenye picha. Gusa tena kuondoa.',
    'Kuu', 'Kamilisha misheni ili upate beji hii bure.', 'Fungua sasa?',
    'Funga', 'Lipa {n} Pi', 'Inachakata...', 'Malipo yameghairiwa.', 'Malipo yameshindwa. Jaribu tena kwenye Pi Browser.',
    '{name}, kwenye wasifu, gusa kuondoa', '{name}, gusa kuweka kama beji ya wasifu', '{name}, imefungwa — gusa kununua',
    'Hakuna orodha zilizohifadhiwa.', 'Angalia orodha', 'Ondoa "{title}" kutoka zilizohifadhiwa?', 'Hakuna zilizohifadhiwa zinazolingana na kichujio hiki.',
    'Orodha hii imeondolewa.', 'Ondoa kwenye orodha', 'Ondoa kutoka zilizohifadhiwa',
  ],
  fa: [
    'من', 'ویرایش پروفایل', 'پروفایل', 'نشان‌ها', 'نشان‌های فعالیت', 'بازگشت', 'مهمان',
    'آگهی‌های من', 'ذخیره‌شده', 'سفارش‌ها', 'پست‌های من', 'نظرها', 'پرسش‌ها', 'اختلافات', 'تنظیمات',
    'با معامله و حضور در جامعه نشان بگیرید.',
    'روی نشان بازشده بزنید تا روی عکس پروفایل نمایش داده شود. دوباره بزنید تا برداشته شود.',
    'اصلی', 'با انجام مأموریت‌ها این نشان را رایگان بگیرید.', 'همین حالا باز شود؟',
    'بستن', 'پرداخت {n} Pi', 'در حال پردازش...', 'پرداخت لغو شد.', 'پرداخت ناموفق. در Pi Browser دوباره تلاش کنید.',
    '{name}، روی پروفایل، برای برداشتن ضربه بزنید', '{name}، برای تنظیم به‌عنوان نشان پروفایل ضربه بزنید', '{name}، قفل — برای خرید ضربه بزنید',
    'آگهی ذخیره‌شده‌ای نیست.', 'مشاهده آگهی‌ها', '«{title}» از ذخیره‌شده‌ها برداشته شود؟', 'هیچ ذخیره‌شده‌ای با این فیلتر نیست.',
    'این آگهی حذف شده است.', 'حذف از فهرست', 'حذف از ذخیره‌شده‌ها',
  ],
  ur: [
    'میرا', 'پروفائل میں ترمیم', 'پروفائل', 'بیجز', 'سرگرمی بیجز', 'واپس', 'مہمان',
    'میری لسٹنگز', 'محفوظ', 'آرڈرز', 'میری پوسٹس', 'ریویوز', 'استفسارات', 'تنازعات', 'ترتیبات',
    'لین دین اور کمیونٹی سے بیجز حاصل کریں۔',
    'انلاک بیج ٹیپ کریں پروفائل تصویر پر دکھانے کے لیے۔ دوبارہ ٹیپ کریں ہٹانے کے لیے۔',
    'مین', 'مفت بیج کے لیے مشن مکمل کریں۔', 'ابھی انلاک کریں؟',
    'بند', '{n} Pi ادا کریں', 'پروسیسنگ...', 'ادائیگی منسوخ۔', 'ادائیگی ناکام۔ Pi Browser میں دوبارہ کوشش کریں۔',
    '{name}، پروفائل پر، ہٹانے کے لیے ٹیپ', '{name}، پروفائل بیج کے لیے ٹیپ', '{name}، لاک — خریدنے کے لیے ٹیپ',
    'کوئی محفوظ لسٹنگ نہیں۔', 'لسٹنگ دیکھیں', '"{title}" محفوظ سے ہٹائیں؟', 'اس فلٹر سے کوئی محفوظ نہیں ملتی۔',
    'یہ لسٹنگ ہٹا دی گئی۔', 'فہرست سے ہٹائیں', 'محفوظ سے ہٹائیں',
  ],
};

keys.push('myComments', 'noMyComments', 'commentOnPost', 'commentFilterReplies', 'noCommentsInFilter');
const COMMENT_LIST = {
  en: ['My comments', 'No comments yet.', 'On "{title}"', 'Replies', 'No comments in this filter.'],
  ko: ['내가 쓴 댓글', '작성한 댓글이 없습니다.', '"{title}"에 남긴 댓글', '대댓글', '이 분류에 댓글이 없습니다.'],
  zh: ['我的评论', '暂无评论。', '发表于“{title}”', '回复', '该筛选下没有评论。'],
  ja: ['自分のコメント', 'コメントはまだありません。', '「{title}」へのコメント', '返信', 'この条件のコメントはありません。'],
};
for (const lang of Object.keys(table)) {
  table[lang].push(...(COMMENT_LIST[lang] || COMMENT_LIST.en));
}

let out = `/* Auto-generated by scripts/gen-profile-i18n.mjs */
import type { AppLanguage } from '@/utils/languageStorage';

export type ProfileMessageKey =
${keys.map((k) => `  | '${k}'`).join('\n')};

const PROFILE_MESSAGES: Record<AppLanguage, Record<ProfileMessageKey, string>> = {\n`;

for (const lang of Object.keys(table)) {
  if (table[lang].length !== keys.length) {
    console.error(lang, table[lang].length, '!=', keys.length);
    process.exit(1);
  }
  out += `  ${lang}: {\n`;
  keys.forEach((k, i) => {
    const v = table[lang][i]
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\r/g, '\\r')
      .replace(/\n/g, '\\n');
    out += `    ${k}: '${v}',\n`;
  });
  out += `  },\n`;
}
out += `};

export function profileT(lang: AppLanguage, key: ProfileMessageKey, vars?: Record<string, string | number>): string {
  const raw = PROFILE_MESSAGES[lang]?.[key] ?? PROFILE_MESSAGES.en[key] ?? key;
  if (!vars) return raw;
  return Object.entries(vars).reduce(
    (s, [k, v]) => s.split('{' + k + '}').join(String(v)),
    raw,
  );
}
`;

fs.writeFileSync(path.join(__dirname, '../src/i18n/profileMessages.ts'), out, 'utf8');
console.log('Wrote profileMessages.ts', keys.length, 'keys');
