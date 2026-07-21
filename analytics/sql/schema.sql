-- schema.sql
-- Run once to set up the analytics database structure.
-- Usage (Windows / any OS with mysql CLI on PATH):
--   mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS video_blog_analytics;"
--   mysql -u root -p video_blog_analytics < sql\schema.sql

CREATE TABLE IF NOT EXISTS users (
    user_id       VARCHAR(24) PRIMARY KEY,   -- MongoDB ObjectId as string
    username      VARCHAR(255) NOT NULL,
    email         VARCHAR(255),
    fullname      VARCHAR(255),
    created_at    DATETIME NOT NULL,
    signup_month  VARCHAR(7) NOT NULL,        -- 'YYYY-MM', avoids repeated DATE_FORMAT calls
    INDEX idx_signup_month (signup_month)
);

CREATE TABLE IF NOT EXISTS videos (
    video_id          VARCHAR(24) PRIMARY KEY,
    title             VARCHAR(500),
    duration          INT,                    -- seconds
    duration_minutes  DECIMAL(6,1),
    views             INT DEFAULT 0,
    category          VARCHAR(50),
    ispublished       BOOLEAN DEFAULT TRUE,
    owner_id          VARCHAR(24),
    username          VARCHAR(255),
    created_at        DATETIME,
    upload_month      VARCHAR(7),
    video_age_days    INT,
    views_per_day     DECIMAL(10,2),
    FOREIGN KEY (owner_id) REFERENCES users(user_id)
        ON DELETE SET NULL,
    INDEX idx_category (category),
    INDEX idx_upload_month (upload_month),
    INDEX idx_owner (owner_id)
);

CREATE TABLE IF NOT EXISTS activity_summary (
    owner_id       VARCHAR(24) PRIMARY KEY,
    username       VARCHAR(255),
    signup_month   VARCHAR(7),
    video_count    INT,
    total_views    INT,
    avg_views      DECIMAL(10,1),
    FOREIGN KEY (owner_id) REFERENCES users(user_id)
        ON DELETE CASCADE
);
