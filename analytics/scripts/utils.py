"""
utils.py
Shared configuration loading and logging setup for all pipeline scripts.
Keeping this in one place avoids repeating boilerplate in every script
and makes sure all scripts log consistently.
"""

import logging
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

# Project root is one level above /scripts
PROJECT_ROOT = Path(__file__).resolve().parent.parent


def load_config() -> dict:
    """
    Loads environment variables from .env at the project root and
    returns them as a validated dict. Fails loudly if required
    variables are missing, rather than silently defaulting.
    """
    env_path = PROJECT_ROOT / ".env"
    if not env_path.exists():
        raise FileNotFoundError(
            f".env not found at {env_path}. Copy .env.example to .env and fill in values."
        )
    load_dotenv(dotenv_path=env_path)

    required = ["MONGO_URI", "MONGO_DB_NAME"]
    missing = [key for key in required if not os.getenv(key)]
    if missing:
        raise EnvironmentError(f"Missing required environment variables: {missing}")

    return {
        "mongo_uri": os.getenv("MONGO_URI"),
        "mongo_db_name": os.getenv("MONGO_DB_NAME"),
        "mysql_host": os.getenv("MYSQL_HOST", "127.0.0.1"),
        "mysql_port": int(os.getenv("MYSQL_PORT", 3306)),
        "mysql_user": os.getenv("MYSQL_USER", "root"),
        "mysql_password": os.getenv("MYSQL_PASSWORD", ""),
        "mysql_database": os.getenv("MYSQL_DATABASE", "video_blog_analytics"),
        "raw_data_dir": PROJECT_ROOT / os.getenv("RAW_DATA_DIR", "data/raw"),
        "processed_data_dir": PROJECT_ROOT / os.getenv("PROCESSED_DATA_DIR", "data/processed"),
    }


def get_logger(name: str) -> logging.Logger:
    """
    Returns a logger that prints timestamped, leveled messages to stdout.
    Using this everywhere instead of print() so output is consistent
    and easy to redirect to a log file later if needed.
    """
    logger = logging.getLogger(name)
    if not logger.handlers:  # avoid duplicate handlers if called twice
        logger.setLevel(logging.INFO)
        handler = logging.StreamHandler(sys.stdout)
        formatter = logging.Formatter(
            fmt="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)
    return logger
