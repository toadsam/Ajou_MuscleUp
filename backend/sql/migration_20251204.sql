-- Manual migration script for attendance logs.
-- Adjust types if your DB dialect differs (MySQL/MariaDB style below).

CREATE TABLE IF NOT EXISTS attendance_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    workout_date DATE NOT NULL,
    did_workout TINYINT(1) NOT NULL,
    memo VARCHAR(200) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_attendance_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT uq_attendance_user_date UNIQUE (user_id, workout_date)
);
