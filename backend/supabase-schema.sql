-- =============================================
-- MarketPiePie - Supabase Schema
-- Supabase SQL Editor에서 실행하세요
-- =============================================

-- 1. 유저
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  nickname TEXT NOT NULL,
  profile_image TEXT,
  bio TEXT,
  kyc_status TEXT DEFAULT 'unverified',
  trust_score INTEGER DEFAULT 0,
  rating NUMERIC(3,2) DEFAULT 0,
  trade_count INTEGER DEFAULT 0,
  activity_region TEXT,
  verified_region TEXT,
  display_activity_badge_id TEXT,
  seller_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 상품
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  price INTEGER NOT NULL,
  category TEXT,
  region TEXT,
  status TEXT DEFAULT 'active',
  images TEXT[] DEFAULT '{}',
  seller_id TEXT REFERENCES users(id),
  trade_methods TEXT[] DEFAULT '{}',
  today_trade_available BOOLEAN DEFAULT false,
  is_free_share BOOLEAN DEFAULT false,
  allow_offer BOOLEAN DEFAULT false,
  liked INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 주문
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  product_id TEXT REFERENCES products(id),
  buyer_id TEXT REFERENCES users(id),
  seller_id TEXT REFERENCES users(id),
  status TEXT NOT NULL,
  proposed_price INTEGER,
  trade_method TEXT,
  meetup_location TEXT,
  meetup_time TEXT,
  shipping_address TEXT,
  shipping_name TEXT,
  shipping_phone TEXT,
  tracking_number TEXT,
  shipping_company TEXT,
  memo TEXT,
  seller_completed BOOLEAN DEFAULT false,
  buyer_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 주문 타임라인
CREATE TABLE IF NOT EXISTS order_timeline_events (
  id TEXT PRIMARY KEY,
  order_id TEXT REFERENCES orders(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. 채팅방
CREATE TABLE IF NOT EXISTS chat_rooms (
  id TEXT PRIMARY KEY,
  product_id TEXT REFERENCES products(id),
  order_id TEXT REFERENCES orders(id),
  buyer_id TEXT REFERENCES users(id),
  seller_id TEXT REFERENCES users(id),
  last_message TEXT,
  last_message_time TIMESTAMPTZ,
  unread_count INTEGER DEFAULT 0,
  left_user_ids TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. 채팅 메시지
CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  room_id TEXT REFERENCES chat_rooms(id) ON DELETE CASCADE,
  sender_id TEXT REFERENCES users(id),
  content TEXT,
  type TEXT DEFAULT 'user',
  images TEXT[] DEFAULT '{}',
  order_id TEXT,
  original_price INTEGER,
  proposed_price INTEGER,
  offer_result TEXT,
  meetup_location TEXT,
  meetup_time TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. 커뮤니티 게시글
CREATE TABLE IF NOT EXISTS community_posts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT,
  category TEXT NOT NULL,
  author_id TEXT REFERENCES users(id),
  images TEXT[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  comment_count INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  region TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  order_id TEXT,
  attached_product_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
-- 기존 스키마에 컬럼 추가(이미 만들어진 경우 대비)
ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS like_count INTEGER DEFAULT 0;

-- 7-1. 게시글 좋아요 (유저×게시글)
CREATE TABLE IF NOT EXISTS post_likes (
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  post_id TEXT REFERENCES community_posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, post_id)
);
CREATE INDEX IF NOT EXISTS idx_post_likes_post ON post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_user ON post_likes(user_id);

-- 8. 댓글
CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  post_id TEXT REFERENCES community_posts(id) ON DELETE CASCADE,
  author_id TEXT REFERENCES users(id),
  content TEXT NOT NULL,
  parent_id TEXT REFERENCES comments(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. 리뷰
CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  reviewer_id TEXT REFERENCES users(id),
  reviewee_id TEXT REFERENCES users(id),
  order_id TEXT REFERENCES orders(id),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  tags TEXT[] DEFAULT '{}',
  comment TEXT,
  product_title TEXT,
  product_image TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. 알림
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  target_user_id TEXT REFERENCES users(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  link TEXT,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. 분쟁
CREATE TABLE IF NOT EXISTS disputes (
  id TEXT PRIMARY KEY,
  order_id TEXT REFERENCES orders(id),
  product_title TEXT,
  product_image TEXT,
  proposed_price INTEGER,
  trade_method TEXT,
  buyer_id TEXT REFERENCES users(id),
  seller_id TEXT REFERENCES users(id),
  reason TEXT,
  action TEXT,
  description TEXT,
  evidence TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'OPEN',
  admin_response TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. 즐겨찾기
CREATE TABLE IF NOT EXISTS favorites (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  product_id TEXT REFERENCES products(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, product_id)
);

-- 13. 고객 문의 (API DB — 앱·관리자 동일)
CREATE TABLE IF NOT EXISTS inquiries (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  email TEXT,
  category TEXT DEFAULT 'general',
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  images TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'pending',
  admin_reply TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  replied_at TIMESTAMPTZ
);

-- Migration for existing tables (safe to run repeatedly)
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS images TEXT[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_inquiries_status ON inquiries(status);
CREATE INDEX IF NOT EXISTS idx_inquiries_user ON inquiries(user_id);

-- 14. 세션
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_created ON sessions(created_at);

-- 15. 신고 (Reports)
-- target_type: 'product' | 'post' | 'review' | 'user' | 'comment'
-- status: 'open' | 'resolved' | 'dismissed'
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  reporter_id TEXT REFERENCES users(id),
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'open',
  admin_note TEXT,
  resolved_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_target ON reports(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_reports_reporter ON reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_created ON reports(created_at DESC);

-- =============================================
-- 인덱스 (성능 최적화)
-- =============================================
CREATE INDEX IF NOT EXISTS idx_products_seller ON products(seller_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_orders_buyer ON orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_seller ON orders(seller_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_buyer ON chat_rooms(buyer_id);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_seller ON chat_rooms(seller_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_room ON chat_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_category ON community_posts(category);
CREATE INDEX IF NOT EXISTS idx_community_posts_author ON community_posts(author_id);
CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee ON reviews(reviewee_id);
CREATE INDEX IF NOT EXISTS idx_notifications_target ON notifications(target_user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_created ON inquiries(created_at DESC);

-- =============================================
-- Row Level Security (Supabase 클라이언트용)
-- 정책(POLICY)은 별도로 정의해야 anon/authenticated 접근이 가능합니다.
-- Node 백엔드는 DATABASE_URL 직접 연결이면 RLS를 우회합니다.
-- =============================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_timeline_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;
