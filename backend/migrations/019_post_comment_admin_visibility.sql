ALTER TABLE community_posts ADD COLUMN admin_hidden TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE community_posts ADD COLUMN admin_hidden_reason VARCHAR(500);
ALTER TABLE community_posts ADD COLUMN admin_hidden_at DATETIME(3);

CREATE INDEX idx_community_posts_admin_hidden ON community_posts(admin_hidden);

ALTER TABLE comments ADD COLUMN admin_hidden TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE comments ADD COLUMN admin_hidden_reason VARCHAR(500);
ALTER TABLE comments ADD COLUMN admin_hidden_at DATETIME(3);

CREATE INDEX idx_comments_admin_hidden ON comments(admin_hidden);
