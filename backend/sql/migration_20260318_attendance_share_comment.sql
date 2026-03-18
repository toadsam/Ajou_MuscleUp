ALTER TABLE attendance_logs
    ADD COLUMN IF NOT EXISTS share_comment VARCHAR(280) NULL;
