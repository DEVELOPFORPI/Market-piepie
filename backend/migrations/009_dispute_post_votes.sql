CREATE TABLE IF NOT EXISTS dispute_post_votes (
  user_id VARCHAR(191) NOT NULL,
  post_id VARCHAR(191) NOT NULL,
  vote VARCHAR(10) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id, post_id),
  CONSTRAINT fk_dispute_post_votes_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_dispute_post_votes_post FOREIGN KEY (post_id) REFERENCES community_posts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_dispute_post_votes_post ON dispute_post_votes(post_id);
CREATE INDEX idx_dispute_post_votes_user ON dispute_post_votes(user_id);
