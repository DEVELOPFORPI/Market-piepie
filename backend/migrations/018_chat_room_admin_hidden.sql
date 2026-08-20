ALTER TABLE chat_rooms ADD COLUMN admin_hidden TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE chat_rooms ADD COLUMN admin_hidden_reason VARCHAR(500) NULL;
ALTER TABLE chat_rooms ADD COLUMN admin_hidden_at DATETIME(3) NULL;

CREATE INDEX idx_chat_rooms_admin_hidden ON chat_rooms(admin_hidden);
