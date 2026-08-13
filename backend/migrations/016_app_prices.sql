CREATE TABLE IF NOT EXISTS app_prices (
  price_key VARCHAR(32) PRIMARY KEY,
  amount DECIMAL(12,4) NOT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO app_prices (price_key, amount) VALUES
  ('signup', 3.14),
  ('badge_01', 15),
  ('badge_02', 75),
  ('badge_03', 150),
  ('badge_04', 10),
  ('badge_05', 50),
  ('badge_06', 100),
  ('badge_07', 12),
  ('badge_08', 60),
  ('badge_09', 120),
  ('badge_10', 180),
  ('badge_11', 240),
  ('badge_12', 80),
  ('badge_13', 200),
  ('badge_14', 10);
