# Findings — Video Blog Platform Analytics

**Dataset:** 80 users, 450 videos, seeded Oct 2025 – Jul 2026
**Pipeline:** MongoDB → Python (extract/clean/transform) → MySQL → dashboard
**Source queries:** `sql/analysis_queries.sql`

## 1. User growth is accelerating
Monthly signups grew from 3 (Oct 2025) to 14 (Jul 2026) — roughly 4-5x over
9 months, taking cumulative users from 3 to 80. Growth wasn't perfectly
linear; there's a slowdown around Dec–Jan worth investigating if this were
a real product (seasonal effect vs. drop-off).

## 2. Engagement per user is growing faster than the user base
Monthly video uploads grew from 1 (Nov 2025) to 182 (Jul 2026) — far outpacing
the ~4x growth in users. This indicates existing users are posting more
over time, not just new signups adding volume. In a real product, this is a
healthy signal: activity is compounding, not just accumulating.

## 3. The top 14% of creators drive ~60% of total views
11 "Power creators" (15+ videos, out of 79 active creators) generated
216,076 of the platform's ~360K total views. By contrast, 11 one-time
posters contributed only 12,013 views combined. This is a classic
Pareto/power-law distribution common on content platforms — a small
creator segment disproportionately drives platform value, which has
direct implications for retention and creator-support strategy.

## 4. Music and Gaming outperform per video, despite lower volume than Tech
| Category  | Videos | Avg Views | Total Views |
|-----------|--------|-----------|-------------|
| Music     | 55     | 1,328.2   | 73,052      |
| Gaming    | 84     | 1,086.4   | 91,254      |
| Tech      | 112    | 940.4     | 105,320     |

Tech has the most uploads and highest total views, but the lowest average
views per video among the top three categories. Music and Gaming content
performs better per-upload despite lower volume — a quality-over-quantity
signal worth surfacing to creators or in a recommendation algorithm.

## 5. Recency drives short-term performance more than category
The top 20 videos ranked by views-per-day-since-published are almost all
1–3 days old at time of measurement, spanning multiple categories. This
points to strong recency bias in how content gets discovered — early
engagement likely predicts a video's eventual total performance, which is
common on most content platforms (front-loaded discovery/algorithm boost).

## 6. Video duration has only a shallow effect on views
| Duration Bucket | Videos | Avg Views |
|------------------|--------|-----------|
| 5–10 min         | 122    | 978.6     |
| Under 5 min      | 75     | 944.0     |
| Over 15 min      | 129    | 922.7     |
| 10–15 min        | 124    | 815.3     |

There's a mild peak at 5–10 minutes, but the spread across all buckets is
narrow (815–979). Duration alone isn't a strong predictor of performance —
worth noting honestly rather than overstating a weak pattern as a strong one.

## 7. A small but real share of content is unpublished
17 of 450 videos (3.8%) are unpublished, representing 11,022 views worth of
content that isn't live. Minor in scale, but worth flagging as an
operational/data-quality note.

---

## Suggested dashboard focus
Given limited dashboard real estate, the strongest, most visual findings to
lead with are **#1** (growth trend line), **#3** (creator concentration —
Pareto chart or treemap), and **#4** (category performance grouped bar
chart). These tell the clearest, most quotable story and are the ones an
interviewer is most likely to ask about.
