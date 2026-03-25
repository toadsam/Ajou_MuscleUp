CREATE TABLE IF NOT EXISTS workout_crews (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(60) NOT NULL,
  description VARCHAR(300) NULL,
  owner_id BIGINT NOT NULL,
  invite_code VARCHAR(20) NOT NULL UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_workout_crews_owner FOREIGN KEY (owner_id) REFERENCES users(id)
);

ALTER TABLE workout_crews
  ADD COLUMN IF NOT EXISTS invite_code VARCHAR(20) NULL;

CREATE TABLE IF NOT EXISTS workout_crew_members (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  crew_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  role VARCHAR(16) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_workout_crew_members_crew FOREIGN KEY (crew_id) REFERENCES workout_crews(id),
  CONSTRAINT fk_workout_crew_members_user FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE KEY uk_workout_crew_members_crew_user (crew_id, user_id)
);

CREATE TABLE IF NOT EXISTS crew_challenges (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  crew_id BIGINT NOT NULL,
  title VARCHAR(80) NOT NULL,
  description VARCHAR(300) NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  target_workout_days INT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_crew_challenges_crew FOREIGN KEY (crew_id) REFERENCES workout_crews(id)
);

CREATE TABLE IF NOT EXISTS friend_requests (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  requester_id BIGINT NOT NULL,
  receiver_id BIGINT NOT NULL,
  status VARCHAR(16) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_friend_requests_requester FOREIGN KEY (requester_id) REFERENCES users(id),
  CONSTRAINT fk_friend_requests_receiver FOREIGN KEY (receiver_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS friendships (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_low_id BIGINT NOT NULL,
  user_high_id BIGINT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_friendships_user_low FOREIGN KEY (user_low_id) REFERENCES users(id),
  CONSTRAINT fk_friendships_user_high FOREIGN KEY (user_high_id) REFERENCES users(id),
  UNIQUE KEY uk_friendships_user_pair (user_low_id, user_high_id)
);

CREATE TABLE IF NOT EXISTS friend_chat_rooms (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_low_id BIGINT NOT NULL,
  user_high_id BIGINT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_friend_chat_rooms_user_low FOREIGN KEY (user_low_id) REFERENCES users(id),
  CONSTRAINT fk_friend_chat_rooms_user_high FOREIGN KEY (user_high_id) REFERENCES users(id),
  UNIQUE KEY uk_friend_chat_rooms_user_pair (user_low_id, user_high_id)
);

CREATE TABLE IF NOT EXISTS friend_chat_messages (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  room_id BIGINT NOT NULL,
  sender_id BIGINT NOT NULL,
  content VARCHAR(1000) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_friend_chat_messages_room FOREIGN KEY (room_id) REFERENCES friend_chat_rooms(id),
  CONSTRAINT fk_friend_chat_messages_sender FOREIGN KEY (sender_id) REFERENCES users(id)
);

ALTER TABLE brag_post
  ADD COLUMN IF NOT EXISTS visibility VARCHAR(16) NOT NULL DEFAULT 'PUBLIC';
