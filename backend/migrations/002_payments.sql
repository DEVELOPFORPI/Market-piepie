-- Pi 결제 기록 (marketpiepiedev / marketpiepietest 등 기존 DB에 1회 실행)

CREATE TABLE IF NOT EXISTS payments (
  id VARCHAR(191) PRIMARY KEY COMMENT 'Pi payment identifier',
  user_id VARCHAR(191) NULL COMMENT 'Pi uid (users.id)',
  payment_type VARCHAR(50) NOT NULL DEFAULT 'other',
  amount DECIMAL(12, 4) NOT NULL DEFAULT 0,
  memo TEXT,
  txid VARCHAR(255) NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'created',
  pi_username VARCHAR(255) NULL COMMENT 'Pi @username',
  wallet_address VARCHAR(255) NULL COMMENT 'Payer wallet (from_address)',
  metadata JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  approved_at DATETIME(3) NULL,
  completed_at DATETIME(3) NULL,
  cancelled_at DATETIME(3) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_type ON payments(payment_type);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_pi_username ON payments(pi_username);
CREATE INDEX idx_payments_wallet ON payments(wallet_address);
CREATE INDEX idx_payments_created ON payments(created_at DESC);
