-- Add workout detail fields to attendance logs.
ALTER TABLE attendance_logs
    ADD COLUMN IF NOT EXISTS workout_types VARCHAR(80) NULL,
    ADD COLUMN IF NOT EXISTS workout_intensity VARCHAR(16) NULL;
