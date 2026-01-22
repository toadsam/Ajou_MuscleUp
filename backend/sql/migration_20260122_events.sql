-- Events domain + attendance points for character growth
CREATE TABLE IF NOT EXISTS events (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(80) NOT NULL,
  description VARCHAR(200) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  required_attendance_count INT NOT NULL,
  status VARCHAR(12) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS event_participants (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  event_id BIGINT NOT NULL,
  joined_at DATETIME NOT NULL,
  current_attendance_count INT NOT NULL DEFAULT 0,
  success BOOLEAN NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_event_participants_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_event_participants_event FOREIGN KEY (event_id) REFERENCES events(id),
  UNIQUE KEY uk_event_participants_user_event (user_id, event_id)
);

ALTER TABLE character_profiles
  ADD COLUMN IF NOT EXISTS attendance_points INT NOT NULL DEFAULT 0;
