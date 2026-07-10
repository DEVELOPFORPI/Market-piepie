DELETE older
FROM disputes older
JOIN disputes newer
  ON newer.order_id = older.order_id
 AND newer.opened_by_user_id = older.opened_by_user_id
 AND newer.opened_by_user_id IS NOT NULL
 AND (
   newer.created_at > older.created_at
   OR (newer.created_at = older.created_at AND newer.id > older.id)
 );

ALTER TABLE disputes
  ADD UNIQUE KEY uq_disputes_order_opener (order_id, opened_by_user_id);
