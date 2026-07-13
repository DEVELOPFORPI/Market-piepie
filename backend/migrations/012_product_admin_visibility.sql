ALTER TABLE products ADD COLUMN admin_hidden TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN admin_hidden_reason VARCHAR(500);
ALTER TABLE products ADD COLUMN admin_hidden_at DATETIME(3);

CREATE INDEX idx_products_admin_hidden ON products(admin_hidden);
