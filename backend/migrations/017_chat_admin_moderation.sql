-- 관리자 채팅 중재: 메시지는 지우지 않고 가린다.
-- 분쟁 판정 근거가 되는 대화는 남겨 두어야 하므로 원문은 DB에 보존한다.
ALTER TABLE chat_messages ADD COLUMN deleted_at DATETIME(3) NULL;
ALTER TABLE chat_messages ADD COLUMN deleted_by_admin TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE chat_messages ADD COLUMN deleted_reason VARCHAR(500) NULL;

CREATE INDEX idx_chat_messages_deleted ON chat_messages(deleted_at);
CREATE INDEX idx_reports_target ON reports(target_type, target_id);
