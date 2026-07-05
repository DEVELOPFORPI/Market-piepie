-- Run once on existing databases (marketpiepiedev, marketpiepietest, etc.)

CREATE TABLE IF NOT EXISTS guests (
  id VARCHAR(191) PRIMARY KEY,
  pi_username VARCHAR(255) NULL,
  pi_uid VARCHAR(191) NULL,
  device_id VARCHAR(191) NULL,
  region VARCHAR(255) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  last_seen_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  converted_user_id VARCHAR(191) NULL,
  CONSTRAINT fk_guests_converted_user FOREIGN KEY (converted_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_guests_pi_uid ON guests(pi_uid);
CREATE INDEX idx_guests_converted ON guests(converted_user_id);
CREATE INDEX idx_guests_last_seen ON guests(last_seen_at);

-- Allow session tokens for guest IDs (not in users yet)
ALTER TABLE sessions DROP FOREIGN KEY fk_sessions_user;
