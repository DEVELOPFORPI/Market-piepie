-- Tombstone for comments an admin removed while replies still reference them.
ALTER TABLE comments ADD COLUMN admin_removed TINYINT(1) NOT NULL DEFAULT 0;

CREATE INDEX idx_comments_admin_removed ON comments(admin_removed);
