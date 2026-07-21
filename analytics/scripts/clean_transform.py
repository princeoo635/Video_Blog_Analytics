"""
clean_transform.py
STEP 2 of the pipeline.

Reads the raw JSON dumped by extract_data.py, flattens MongoDB-specific
fields (ObjectId, nested dates), joins video ownership to usernames,
derives analysis-friendly columns, and writes clean CSVs to
data/processed/.

Run:
    python scripts/clean_transform.py
"""

import json
import sys
from datetime import datetime

import pandas as pd

from utils import get_logger, load_config

logger = get_logger("clean_transform")


def load_raw_json(path) -> list:
    """Loads a raw JSON export. Raises a clear error if the file is missing."""
    if not path.exists():
        raise FileNotFoundError(
            f"{path} not found. Run extract_data.py first."
        )
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def extract_oid(value):
    """MongoDB ObjectIds come through as {'$oid': '...'} after json_util export. Unwrap them."""
    if isinstance(value, dict) and "$oid" in value:
        return value["$oid"]
    return value


def extract_date(value):
    """MongoDB dates come through as {'$date': 'ISO string'}. Unwrap and parse to pandas Timestamp."""
    if isinstance(value, dict) and "$date" in value:
        return pd.to_datetime(value["$date"])
    if value is None:
        return pd.NaT
    return pd.to_datetime(value, errors="coerce")


def clean_users(raw_users: list) -> pd.DataFrame:
    """Flattens the users collection into a clean DataFrame."""
    if not raw_users:
        logger.warning("No user documents to clean.")
        return pd.DataFrame(columns=["user_id", "username", "email", "fullname", "created_at"])

    df = pd.DataFrame(raw_users)
    df["user_id"] = df["_id"].apply(extract_oid)
    df["created_at"] = df["createdAt"].apply(extract_date)

    keep_cols = ["user_id", "username", "email", "fullname", "created_at"]
    df = df[[c for c in keep_cols if c in df.columns]].copy()

    before = len(df)
    df = df.drop_duplicates(subset="user_id")
    df = df.dropna(subset=["user_id", "created_at"])
    dropped = before - len(df)
    if dropped:
        logger.info(f"Dropped {dropped} invalid/duplicate user rows during cleaning.")

    df["signup_month"] = df["created_at"].dt.tz_localize(None).dt.to_period("M").astype(str)
    return df.reset_index(drop=True)


def clean_videos(raw_videos: list, users_df: pd.DataFrame) -> pd.DataFrame:
    """Flattens the videos collection, joins owner -> username, and adds derived columns."""
    empty_columns = ["video_id", "title", "duration", "duration_minutes", "views", "category",
                     "ispublished", "owner_id", "username", "created_at", "upload_month",
                     "video_age_days", "views_per_day"]
    if not raw_videos:
        logger.warning(
            "No video documents found in videos_raw.json. "
            "Check that seed.js ran successfully and MONGO_DB_NAME in .env "
            "matches the database it seeded."
        )
        return pd.DataFrame(columns=empty_columns)

    df = pd.DataFrame(raw_videos)
    df["video_id"] = df["_id"].apply(extract_oid)
    df["owner_id"] = df["owner"].apply(extract_oid) if "owner" in df.columns else None
    df["created_at"] = df["createdAt"].apply(extract_date) if "createdAt" in df.columns else pd.NaT

    keep_cols = ["video_id", "title", "duration", "views", "category",
                 "ispublished", "owner_id", "created_at"]
    df = df[[c for c in keep_cols if c in df.columns]].copy()

    before = len(df)
    df = df.drop_duplicates(subset="video_id")
    df = df.dropna(subset=["video_id"])
    dropped = before - len(df)
    if dropped:
        logger.info(f"Dropped {dropped} invalid/duplicate video rows during cleaning.")

    # Join to get username for readability in downstream SQL/dashboard work
    if not users_df.empty:
        df = df.merge(
            users_df[["user_id", "username"]],
            left_on="owner_id", right_on="user_id",
            how="left"
        ).drop(columns=["user_id"])
        orphaned = df["username"].isna().sum()
        if orphaned:
            logger.warning(f"{orphaned} videos reference an owner_id not found in users collection.")

    # Derived columns for analysis
    # created_at from MongoDB is timezone-aware (UTC); "now" must match or subtraction fails
    now = pd.Timestamp.now(tz=df["created_at"].dt.tz) if df["created_at"].dt.tz else pd.Timestamp.now()
    df["video_age_days"] = (now - df["created_at"]).dt.days
    df["views_per_day"] = (df["views"] / df["video_age_days"].replace(0, 1)).round(2)
    df["duration_minutes"] = (df["duration"] / 60).round(1)
    df["upload_month"] = df["created_at"].dt.tz_localize(None).dt.to_period("M").astype(str)

    return df.reset_index(drop=True)


def build_activity_summary(users_df: pd.DataFrame, videos_df: pd.DataFrame) -> pd.DataFrame:
    """Per-user rollup: video count, total views, avg views — feeds the 'top creators' analysis."""
    if videos_df.empty:
        return pd.DataFrame()

    summary = videos_df.groupby("owner_id").agg(
        video_count=("video_id", "count"),
        total_views=("views", "sum"),
        avg_views=("views", "mean"),
    ).reset_index()

    summary = summary.merge(
        users_df[["user_id", "username", "signup_month"]],
        left_on="owner_id", right_on="user_id",
        how="left"
    ).drop(columns=["user_id"])

    summary["avg_views"] = summary["avg_views"].round(1)
    return summary.sort_values("total_views", ascending=False).reset_index(drop=True)


def main():
    start = datetime.now()
    logger.info("=== Clean/transform step started ===")

    config = load_config()
    raw_dir = config["raw_data_dir"]
    processed_dir = config["processed_data_dir"]
    processed_dir.mkdir(parents=True, exist_ok=True)

    try:
        raw_users = load_raw_json(raw_dir / "users_raw.json")
        raw_videos = load_raw_json(raw_dir / "videos_raw.json")
    except FileNotFoundError as e:
        logger.error(str(e))
        sys.exit(1)

    users_df = clean_users(raw_users)
    videos_df = clean_videos(raw_videos, users_df)
    activity_df = build_activity_summary(users_df, videos_df)

    users_df.to_csv(processed_dir / "users.csv", index=False)
    videos_df.to_csv(processed_dir / "videos.csv", index=False)
    activity_df.to_csv(processed_dir / "activity_summary.csv", index=False)

    logger.info(f"Wrote users.csv ({len(users_df)} rows)")
    logger.info(f"Wrote videos.csv ({len(videos_df)} rows)")
    logger.info(f"Wrote activity_summary.csv ({len(activity_df)} rows)")

    elapsed = (datetime.now() - start).total_seconds()
    logger.info(f"=== Clean/transform step complete in {elapsed:.2f}s ===")


if __name__ == "__main__":
    main()