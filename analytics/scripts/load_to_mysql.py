"""
load_to_mysql.py
STEP 3 of the pipeline.

Loads the cleaned CSVs (users.csv, videos.csv, activity_summary.csv)
into MySQL tables defined in sql/schema.sql. Uses batched inserts with
"INSERT ... ON DUPLICATE KEY UPDATE" so the script is safe to re-run
(idempotent) without creating duplicate rows.

Prerequisite:
    mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS video_blog_analytics;"
    mysql -u root -p video_blog_analytics < sql/schema.sql

Run:
    python scripts/load_to_mysql.py
"""

import sys
from datetime import datetime

import mysql.connector
import pandas as pd
from mysql.connector import Error as MySQLError

from utils import get_logger, load_config

logger = get_logger("load_to_mysql")

BATCH_SIZE = 500


def get_connection(config: dict):
    """Opens a MySQL connection. Exits with a clear message on auth/connection failure."""
    try:
        conn = mysql.connector.connect(
            host=config["mysql_host"],
            port=config["mysql_port"],
            user=config["mysql_user"],
            password=config["mysql_password"],
            database=config["mysql_database"],
        )
        logger.info(f"Connected to MySQL database '{config['mysql_database']}'")
        return conn
    except MySQLError as e:
        logger.error(f"Failed to connect to MySQL: {e}")
        logger.error("Confirm MySQL is running and schema.sql has been applied.")
        sys.exit(1)


def load_csv(path) -> pd.DataFrame:
    if not path.exists():
        raise FileNotFoundError(f"{path} not found. Run clean_transform.py first.")
    df = pd.read_csv(path)
    # pandas reads empty strings as NaN; MySQL connector needs None instead
    return df.where(pd.notnull(df), None)


def batch_upsert(conn, table: str, df: pd.DataFrame, insert_sql: str, columns: list):
    """Inserts a DataFrame into MySQL in batches, updating existing rows on primary key conflict."""
    if df.empty:
        logger.warning(f"No rows to load into '{table}' — skipping.")
        return 0

    cursor = conn.cursor()
    rows = [tuple(row[c] for c in columns) for _, row in df.iterrows()]

    total_written = 0
    try:
        for i in range(0, len(rows), BATCH_SIZE):
            batch = rows[i:i + BATCH_SIZE]
            cursor.executemany(insert_sql, batch)
            conn.commit()
            total_written += len(batch)
        logger.info(f"Loaded {total_written} rows into '{table}'")
    except MySQLError as e:
        conn.rollback()
        logger.error(f"Failed loading into '{table}': {e}")
        raise
    finally:
        cursor.close()

    return total_written


def load_users(conn, df: pd.DataFrame):
    columns = ["user_id", "username", "email", "fullname", "created_at", "signup_month"]
    sql = f"""
        INSERT INTO users ({", ".join(columns)})
        VALUES ({", ".join(["%s"] * len(columns))})
        ON DUPLICATE KEY UPDATE
            username=VALUES(username), email=VALUES(email),
            fullname=VALUES(fullname), created_at=VALUES(created_at),
            signup_month=VALUES(signup_month)
    """
    return batch_upsert(conn, "users", df, sql, columns)


def load_videos(conn, df: pd.DataFrame):
    columns = ["video_id", "title", "duration", "duration_minutes", "views", "category",
               "ispublished", "owner_id", "username", "created_at", "upload_month",
               "video_age_days", "views_per_day"]
    sql = f"""
        INSERT INTO videos ({", ".join(columns)})
        VALUES ({", ".join(["%s"] * len(columns))})
        ON DUPLICATE KEY UPDATE
            title=VALUES(title), duration=VALUES(duration), duration_minutes=VALUES(duration_minutes),
            views=VALUES(views), category=VALUES(category), ispublished=VALUES(ispublished),
            owner_id=VALUES(owner_id), username=VALUES(username), created_at=VALUES(created_at),
            upload_month=VALUES(upload_month), video_age_days=VALUES(video_age_days),
            views_per_day=VALUES(views_per_day)
    """
    return batch_upsert(conn, "videos", df, sql, columns)


def load_activity_summary(conn, df: pd.DataFrame):
    columns = ["owner_id", "username", "signup_month", "video_count", "total_views", "avg_views"]
    sql = f"""
        INSERT INTO activity_summary ({", ".join(columns)})
        VALUES ({", ".join(["%s"] * len(columns))})
        ON DUPLICATE KEY UPDATE
            username=VALUES(username), signup_month=VALUES(signup_month),
            video_count=VALUES(video_count), total_views=VALUES(total_views),
            avg_views=VALUES(avg_views)
    """
    return batch_upsert(conn, "activity_summary", df, sql, columns)


def main():
    start = datetime.now()
    logger.info("=== Load-to-MySQL step started ===")

    config = load_config()
    processed_dir = config["processed_data_dir"]

    try:
        users_df = load_csv(processed_dir / "users.csv")
        videos_df = load_csv(processed_dir / "videos.csv")
        activity_df = load_csv(processed_dir / "activity_summary.csv")
    except FileNotFoundError as e:
        logger.error(str(e))
        sys.exit(1)

    conn = get_connection(config)
    try:
        load_users(conn, users_df)
        load_videos(conn, videos_df)
        load_activity_summary(conn, activity_df)
    except MySQLError:
        logger.error("Load step failed. See errors above.")
        sys.exit(1)
    finally:
        conn.close()

    elapsed = (datetime.now() - start).total_seconds()
    logger.info(f"=== Load-to-MySQL step complete in {elapsed:.2f}s ===")


if __name__ == "__main__":
    main()
