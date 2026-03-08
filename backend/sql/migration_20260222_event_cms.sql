CREATE TABLE IF NOT EXISTS cms_events (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(120) NOT NULL,
  summary VARCHAR(300) NOT NULL,
  content MEDIUMTEXT NOT NULL,
  thumbnail_url VARCHAR(500) NOT NULL,
  banner_url VARCHAR(500) NULL,
  start_at DATETIME NOT NULL,
  end_at DATETIME NOT NULL,
  status VARCHAR(20) NOT NULL,
  is_main_banner BOOLEAN NOT NULL DEFAULT FALSE,
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  priority INT NOT NULL DEFAULT 0,
  cta_text VARCHAR(60) NOT NULL DEFAULT '자세히 보기',
  cta_link VARCHAR(500) NOT NULL,
  view_count BIGINT NOT NULL DEFAULT 0,
  click_count BIGINT NOT NULL DEFAULT 0,
  created_by BIGINT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cms_event_tags (
  event_id BIGINT NOT NULL,
  tag VARCHAR(40) NOT NULL,
  PRIMARY KEY (event_id, tag),
  CONSTRAINT fk_cms_event_tags_event FOREIGN KEY (event_id) REFERENCES cms_events(id) ON DELETE CASCADE
);

CREATE INDEX idx_cms_events_status ON cms_events(status);
CREATE INDEX idx_cms_events_main_banner ON cms_events(is_main_banner, status);
CREATE INDEX idx_cms_events_sort ON cms_events(is_pinned, priority, start_at);
CREATE INDEX idx_cms_events_title ON cms_events(title);
