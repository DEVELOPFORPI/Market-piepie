ALTER TABLE reviews ADD UNIQUE KEY uq_reviews_order_reviewer (order_id, reviewer_id);
