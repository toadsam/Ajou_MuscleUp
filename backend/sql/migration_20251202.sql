-- Manual migration script for new AI history and analytics features.
-- Adjust types if your DB dialect differs (MySQL/MariaDB style below).

-- 1) ai_chat_messages: type/shared/share_slug
ALTER TABLE ai_chat_messages
    ADD COLUMN type VARCHAR(20) NOT NULL DEFAULT 'CHAT',
    ADD COLUMN shared TINYINT(1) NOT NULL DEFAULT 0,
    ADD COLUMN share_slug VARCHAR(64) NULL;

-- Backfill type for existing rows
UPDATE ai_chat_messages SET type = 'CHAT' WHERE type IS NULL;

-- Optional: enforce unique share slug
CREATE UNIQUE INDEX IF NOT EXISTS ux_ai_chat_messages_share_slug
    ON ai_chat_messages (share_slug);

-- 2) analytics_events: page/action/metadata logging
CREATE TABLE IF NOT EXISTS analytics_events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NULL,
    page VARCHAR(200) NOT NULL,
    action VARCHAR(50) NOT NULL,
    metadata TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_analytics_user FOREIGN KEY (user_id) REFERENCES users(id)
);

-- If your schema uses snake_case audit columns, BaseTimeEntity expects created_at/updated_at.
