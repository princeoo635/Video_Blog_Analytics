"""
extract_data.py
STEP 1 of the pipeline.

Connects to MongoDB and dumps the `users` and `videos` collections to
raw JSON files, untouched. Keeping an unmodified raw copy is standard
practice: if a later transform step has a bug, you can always re-run
from raw data instead of re-extracting from the database.

Run:
    python scripts/extract_data.py
"""

import json
import sys
from datetime import datetime

from bson import json_util
from pymongo import MongoClient
from pymongo.errors import PyMongoError

from utils import get_logger, load_config

logger = get_logger("extract_data")


def connect_to_mongo(uri: str, db_name: str):
    """Connects to MongoDB and returns the database handle. Fails fast on bad connection."""
    try:
        client = MongoClient(uri, serverSelectionTimeoutMS=5000)
        client.admin.command("ping")  # forces connection check now, not on first query
        logger.info(f"Connected to MongoDB database '{db_name}'")
        return client[db_name]
    except PyMongoError as e:
        logger.error(f"Failed to connect to MongoDB: {e}")
        sys.exit(1)


def export_collection(db, collection_name: str, output_path) -> int:
    """
    Exports a single collection to a JSON file.
    Uses bson.json_util so ObjectId and datetime fields serialize correctly
    (plain json.dumps would crash on these types).
    Returns the number of documents exported.
    """
    try:
        docs = list(db[collection_name].find({}))
    except PyMongoError as e:
        logger.error(f"Failed to read collection '{collection_name}': {e}")
        raise

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(docs, f, default=json_util.default, indent=2)

    logger.info(f"Exported {len(docs)} documents from '{collection_name}' -> {output_path}")
    return len(docs)


def main():
    start = datetime.now()
    logger.info("=== Extract step started ===")

    config = load_config()
    db = connect_to_mongo(config["mongo_uri"], config["mongo_db_name"])

    raw_dir = config["raw_data_dir"]
    counts = {}
    try:
        counts["users"] = export_collection(db, "users", raw_dir / "users_raw.json")
        counts["videos"] = export_collection(db, "videos", raw_dir / "videos_raw.json")
    except PyMongoError:
        logger.error("Extract step failed. See errors above.")
        sys.exit(1)

    if counts["users"] == 0 or counts["videos"] == 0:
        logger.warning(
            "One or more collections returned 0 documents. "
            "Confirm MONGO_URI in .env points to the seeded database."
        )

    elapsed = (datetime.now() - start).total_seconds()
    logger.info(f"=== Extract step complete in {elapsed:.2f}s ===")


if __name__ == "__main__":
    main()
