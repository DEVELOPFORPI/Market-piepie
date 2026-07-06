-- payments 테이블에 Pi 계정·지갑 컬럼 추가 (002 실행 후 1회)

ALTER TABLE payments
  ADD COLUMN pi_username VARCHAR(255) NULL COMMENT 'Pi @username' AFTER status,
  ADD COLUMN wallet_address VARCHAR(255) NULL COMMENT 'Payer wallet (from_address)' AFTER pi_username;

CREATE INDEX idx_payments_pi_username ON payments(pi_username);
CREATE INDEX idx_payments_wallet ON payments(wallet_address);
