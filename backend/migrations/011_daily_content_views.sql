ALTER TABLE notices ADD COLUMN view_count INT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS content_views (
  target_type VARCHAR(20) NOT NULL,
  target_id VARCHAR(191) NOT NULL,
  viewer_key CHAR(64) NOT NULL,
  view_date DATE NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (target_type, target_id, viewer_key, view_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_content_views_target ON content_views(target_type, target_id);
CREATE INDEX idx_content_views_date ON content_views(view_date);
