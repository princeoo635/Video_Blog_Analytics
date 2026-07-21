-- analysis_queries.sql
-- Run individually, or all at once:
--   mysql -u root -p video_blog_analytics < sql\analysis_queries.sql
-- Each query answers one of the business questions defined for this project.

-- 1. Monthly signup growth with running total (window function)
SELECT
    signup_month,
    COUNT(*) AS new_signups,
    SUM(COUNT(*)) OVER (ORDER BY signup_month) AS cumulative_signups
FROM users
GROUP BY signup_month
ORDER BY signup_month;

-- 2. Top 10 creators by video count and total views
SELECT
    username,
    video_count,
    total_views,
    avg_views
FROM activity_summary
ORDER BY total_views DESC
LIMIT 10;

-- 3. Category performance: average views and duration per category
SELECT
    category,
    COUNT(*) AS video_count,
    ROUND(AVG(views), 1) AS avg_views,
    ROUND(AVG(duration_minutes), 1) AS avg_duration_minutes,
    SUM(views) AS total_views
FROM videos
WHERE ispublished = TRUE
GROUP BY category
ORDER BY total_views DESC;

-- 4. Monthly upload trend
SELECT
    upload_month,
    COUNT(*) AS videos_uploaded,
    SUM(views) AS total_views_that_month
FROM videos
GROUP BY upload_month
ORDER BY upload_month;

-- 5. Views-per-day-since-published, ranked (finds videos performing well relative to their age)
SELECT
    title,
    username,
    category,
    views,
    video_age_days,
    views_per_day,
    RANK() OVER (ORDER BY views_per_day DESC) AS performance_rank
FROM videos
WHERE ispublished = TRUE AND video_age_days > 0
ORDER BY views_per_day DESC
LIMIT 20;

-- 6. Creator engagement tiers: bucket creators by video count
SELECT
    CASE
        WHEN video_count = 1 THEN 'One-time poster'
        WHEN video_count BETWEEN 2 AND 5 THEN 'Casual (2-5 videos)'
        WHEN video_count BETWEEN 6 AND 15 THEN 'Regular (6-15 videos)'
        ELSE 'Power creator (15+)'
    END AS creator_tier,
    COUNT(*) AS num_creators,
    SUM(total_views) AS combined_views
FROM activity_summary
GROUP BY creator_tier
ORDER BY combined_views DESC;

-- 7. Duration vs. views correlation check (bucketed, since raw correlation needs application code)
SELECT
    CASE
        WHEN duration_minutes < 5 THEN 'Under 5 min'
        WHEN duration_minutes BETWEEN 5 AND 10 THEN '5-10 min'
        WHEN duration_minutes BETWEEN 10 AND 15 THEN '10-15 min'
        ELSE 'Over 15 min'
    END AS duration_bucket,
    COUNT(*) AS video_count,
    ROUND(AVG(views), 1) AS avg_views
FROM videos
GROUP BY duration_bucket
ORDER BY avg_views DESC;

-- 8. Unpublished vs published video split, with view impact
SELECT
    ispublished,
    COUNT(*) AS video_count,
    SUM(views) AS total_views
FROM videos
GROUP BY ispublished;
