CREATE TABLE IF NOT EXISTS notices (
  id VARCHAR(191) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  published TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_notices_published ON notices(published);

CREATE TABLE IF NOT EXISTS home_popups (
  id VARCHAR(191) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  hero_image TEXT NOT NULL,
  detail_link VARCHAR(500),
  notice_id VARCHAR(191),
  revision INT NOT NULL DEFAULT 1,
  enabled TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_home_popups_notice FOREIGN KEY (notice_id) REFERENCES notices(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_home_popups_enabled ON home_popups(enabled);
CREATE INDEX idx_home_popups_revision ON home_popups(revision);
