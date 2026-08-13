ALTER TABLE users ADD COLUMN pi_username VARCHAR(255) NULL AFTER pi_verified;

CREATE INDEX idx_users_pi_username ON users(pi_username);

UPDATE users u
INNER JOIN guests g ON g.converted_user_id = u.id
SET u.pi_username = g.pi_username
WHERE u.pi_username IS NULL AND g.pi_username IS NOT NULL AND g.pi_username <> '';

UPDATE users u
INNER JOIN guests g ON g.pi_uid = u.id
SET u.pi_username = g.pi_username
WHERE u.pi_username IS NULL AND g.pi_username IS NOT NULL AND g.pi_username <> '';

UPDATE users u
INNER JOIN (
  SELECT user_id, MAX(pi_username) AS pi_username
    FROM payments
   WHERE pi_username IS NOT NULL AND pi_username <> '' AND user_id IS NOT NULL
   GROUP BY user_id
) p ON p.user_id = u.id
SET u.pi_username = p.pi_username
WHERE u.pi_username IS NULL;
