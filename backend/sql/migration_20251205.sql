-- Manual migration script for body stats + character profiles.
-- Adjust types if your DB dialect differs (MySQL/MariaDB style below).

CREATE TABLE IF NOT EXISTS user_body_stats (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    height_cm INT NULL,
    gender VARCHAR(10) NOT NULL DEFAULT 'MALE',
    weight_kg DOUBLE NOT NULL,
    skeletal_muscle_kg DOUBLE NULL,
    bench_kg DOUBLE NULL,
    squat_kg DOUBLE NULL,
    deadlift_kg DOUBLE NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_body_stats_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT uq_body_stats_user UNIQUE (user_id)
);

-- If user_body_stats already exists without gender, run:
-- ALTER TABLE user_body_stats ADD COLUMN gender VARCHAR(10) NOT NULL DEFAULT 'MALE';

CREATE TABLE IF NOT EXISTS character_profiles (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    level INT NOT NULL DEFAULT 1,
    tier VARCHAR(20) NOT NULL DEFAULT 'BRONZE',
    evolution_stage INT NOT NULL DEFAULT 0,
    title VARCHAR(40) NOT NULL DEFAULT '초보 헬린이',
    is_public TINYINT(1) NOT NULL DEFAULT 0,
    last_evaluated_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_character_profile_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT uq_character_profile_user UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS character_evolution_history (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    trigger_type VARCHAR(30) NOT NULL,
    before_level INT NOT NULL,
    after_level INT NOT NULL,
    before_tier VARCHAR(20) NOT NULL,
    after_tier VARCHAR(20) NOT NULL,
    before_stage INT NOT NULL,
    after_stage INT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_character_history_user FOREIGN KEY (user_id) REFERENCES users(id)
);

