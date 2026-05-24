-- MarketPiePie MySQL schema
-- Target: MySQL 8.0.13+ / utf8mb4

CREATE DATABASE IF NOT EXISTS marketpiepie
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE marketpiepie;

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(191) PRIMARY KEY,
  nickname VARCHAR(255) NOT NULL,
  profile_image TEXT,
  bio TEXT,
  kyc_status VARCHAR(50) NOT NULL DEFAULT 'unverified',
  trust_score INT NOT NULL DEFAULT 0,
  rating DECIMAL(3,2) NOT NULL DEFAULT 0,
  trade_count INT NOT NULL DEFAULT 0,
  activity_region VARCHAR(255),
  verified_region VARCHAR(255),
  display_activity_badge_id VARCHAR(191),
  seller_type VARCHAR(50),
  pi_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS products (
  id VARCHAR(191) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  price INT NOT NULL,
  category VARCHAR(100),
  region VARCHAR(255),
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  images JSON NOT NULL DEFAULT (JSON_ARRAY()),
  seller_id VARCHAR(191),
  trade_methods JSON NOT NULL DEFAULT (JSON_ARRAY()),
  today_trade_available BOOLEAN NOT NULL DEFAULT FALSE,
  is_free_share BOOLEAN NOT NULL DEFAULT FALSE,
  allow_offer BOOLEAN NOT NULL DEFAULT FALSE,
  liked INT NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_products_seller FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(191) PRIMARY KEY,
  product_id VARCHAR(191),
  buyer_id VARCHAR(191),
  seller_id VARCHAR(191),
  status VARCHAR(50) NOT NULL,
  proposed_price INT,
  trade_method VARCHAR(100),
  meetup_location TEXT,
  meetup_time VARCHAR(255),
  shipping_address TEXT,
  shipping_name VARCHAR(255),
  shipping_phone VARCHAR(100),
  tracking_number VARCHAR(255),
  shipping_company VARCHAR(255),
  memo TEXT,
  seller_completed BOOLEAN NOT NULL DEFAULT FALSE,
  buyer_completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_orders_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
  CONSTRAINT fk_orders_buyer FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_orders_seller FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_timeline_events (
  id VARCHAR(191) PRIMARY KEY,
  order_id VARCHAR(191),
  type VARCHAR(100) NOT NULL,
  description TEXT,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_order_timeline_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chat_rooms (
  id VARCHAR(191) PRIMARY KEY,
  product_id VARCHAR(191),
  order_id VARCHAR(191),
  buyer_id VARCHAR(191),
  seller_id VARCHAR(191),
  last_message TEXT,
  last_message_time DATETIME(3),
  unread_count INT NOT NULL DEFAULT 0,
  left_user_ids JSON NOT NULL DEFAULT (JSON_ARRAY()),
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_chat_rooms_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
  CONSTRAINT fk_chat_rooms_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
  CONSTRAINT fk_chat_rooms_buyer FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_chat_rooms_seller FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chat_messages (
  id VARCHAR(191) PRIMARY KEY,
  room_id VARCHAR(191),
  sender_id VARCHAR(191),
  content TEXT,
  type VARCHAR(50) NOT NULL DEFAULT 'user',
  images JSON NOT NULL DEFAULT (JSON_ARRAY()),
  order_id VARCHAR(191),
  original_price INT,
  proposed_price INT,
  offer_result VARCHAR(50),
  meetup_location TEXT,
  meetup_time VARCHAR(255),
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_chat_messages_room FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE,
  CONSTRAINT fk_chat_messages_sender FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS community_posts (
  id VARCHAR(191) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  content TEXT,
  category VARCHAR(100) NOT NULL,
  author_id VARCHAR(191),
  images JSON NOT NULL DEFAULT (JSON_ARRAY()),
  tags JSON NOT NULL DEFAULT (JSON_ARRAY()),
  comment_count INT NOT NULL DEFAULT 0,
  like_count INT NOT NULL DEFAULT 0,
  region VARCHAR(255),
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  order_id VARCHAR(191),
  attached_product_id VARCHAR(191),
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_community_posts_author FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS post_likes (
  user_id VARCHAR(191) NOT NULL,
  post_id VARCHAR(191) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id, post_id),
  CONSTRAINT fk_post_likes_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_post_likes_post FOREIGN KEY (post_id) REFERENCES community_posts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS comments (
  id VARCHAR(191) PRIMARY KEY,
  post_id VARCHAR(191),
  author_id VARCHAR(191),
  content TEXT NOT NULL,
  parent_id VARCHAR(191),
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_comments_post FOREIGN KEY (post_id) REFERENCES community_posts(id) ON DELETE CASCADE,
  CONSTRAINT fk_comments_author FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_comments_parent FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reviews (
  id VARCHAR(191) PRIMARY KEY,
  reviewer_id VARCHAR(191),
  reviewee_id VARCHAR(191),
  order_id VARCHAR(191),
  rating INT NOT NULL,
  tags JSON NOT NULL DEFAULT (JSON_ARRAY()),
  comment TEXT,
  product_title VARCHAR(255),
  product_image TEXT,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT chk_reviews_rating CHECK (rating BETWEEN 1 AND 5),
  CONSTRAINT fk_reviews_reviewer FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_reviews_reviewee FOREIGN KEY (reviewee_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_reviews_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(191) PRIMARY KEY,
  target_user_id VARCHAR(191),
  type VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT,
  link TEXT,
  `read` BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_notifications_target FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS disputes (
  id VARCHAR(191) PRIMARY KEY,
  order_id VARCHAR(191),
  product_title VARCHAR(255),
  product_image TEXT,
  proposed_price INT,
  trade_method VARCHAR(100),
  buyer_id VARCHAR(191),
  seller_id VARCHAR(191),
  reason VARCHAR(255),
  action VARCHAR(255),
  description TEXT,
  evidence JSON NOT NULL DEFAULT (JSON_ARRAY()),
  status VARCHAR(50) NOT NULL DEFAULT 'OPEN',
  admin_response TEXT,
  resolved_at DATETIME(3),
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_disputes_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
  CONSTRAINT fk_disputes_buyer FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_disputes_seller FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS favorites (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id VARCHAR(191),
  product_id VARCHAR(191),
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_favorites_user_product (user_id, product_id),
  CONSTRAINT fk_favorites_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_favorites_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inquiries (
  id VARCHAR(191) PRIMARY KEY,
  user_id VARCHAR(191),
  email VARCHAR(255),
  category VARCHAR(200) NOT NULL DEFAULT 'general',
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  images JSON NOT NULL DEFAULT (JSON_ARRAY()),
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  admin_reply TEXT,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  replied_at DATETIME(3),
  CONSTRAINT fk_inquiries_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sessions (
  token VARCHAR(191) PRIMARY KEY,
  user_id VARCHAR(191) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reports (
  id VARCHAR(191) PRIMARY KEY,
  reporter_id VARCHAR(191),
  target_type VARCHAR(50) NOT NULL,
  target_id VARCHAR(191) NOT NULL,
  reason VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'open',
  admin_note TEXT,
  resolved_by VARCHAR(191),
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  resolved_at DATETIME(3),
  CONSTRAINT fk_reports_reporter FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_reports_resolved_by FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_products_seller ON products(seller_id);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_orders_buyer ON orders(buyer_id);
CREATE INDEX idx_orders_seller ON orders(seller_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_chat_rooms_buyer ON chat_rooms(buyer_id);
CREATE INDEX idx_chat_rooms_seller ON chat_rooms(seller_id);
CREATE INDEX idx_chat_messages_room ON chat_messages(room_id);
CREATE INDEX idx_community_posts_category ON community_posts(category);
CREATE INDEX idx_community_posts_author ON community_posts(author_id);
CREATE INDEX idx_post_likes_post ON post_likes(post_id);
CREATE INDEX idx_post_likes_user ON post_likes(user_id);
CREATE INDEX idx_comments_post ON comments(post_id);
CREATE INDEX idx_reviews_reviewee ON reviews(reviewee_id);
CREATE INDEX idx_notifications_target ON notifications(target_user_id);
CREATE INDEX idx_notifications_read ON notifications(`read`);
CREATE INDEX idx_favorites_user ON favorites(user_id);
CREATE INDEX idx_inquiries_status ON inquiries(status);
CREATE INDEX idx_inquiries_user ON inquiries(user_id);
CREATE INDEX idx_inquiries_created ON inquiries(created_at DESC);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_created ON sessions(created_at);
CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_reports_target ON reports(target_type, target_id);
CREATE INDEX idx_reports_reporter ON reports(reporter_id);
CREATE INDEX idx_reports_created ON reports(created_at DESC);
