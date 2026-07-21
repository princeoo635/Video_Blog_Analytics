"""
run_pipeline.py
Production-style entry point: runs extract -> clean/transform -> load,
in order, stopping immediately if any step fails so you never load
partial or stale data into MySQL.

Run:
    python scripts/run_pipeline.py

Options:
    python scripts/run_pipeline.py --skip-load
        Runs extract + clean/transform only (useful while iterating
        on transform logic without touching MySQL each time).
"""

import argparse
import subprocess
import sys
from datetime import datetime
from pathlib import Path

from utils import get_logger

logger = get_logger("run_pipeline")
SCRIPTS_DIR = Path(__file__).resolve().parent


def run_step(script_name: str) -> None:
    """Runs a pipeline step as a subprocess so each script's own logging stays intact."""
    script_path = SCRIPTS_DIR / script_name
    logger.info(f"--- Running {script_name} ---")
    result = subprocess.run([sys.executable, str(script_path)])
    if result.returncode != 0:
        logger.error(f"{script_name} failed (exit code {result.returncode}). Stopping pipeline.")
        sys.exit(result.returncode)


def main():
    parser = argparse.ArgumentParser(description="Run the video-blog analytics pipeline.")
    parser.add_argument("--skip-load", action="store_true",
                         help="Skip the MySQL load step (extract + transform only).")
    args = parser.parse_args()

    start = datetime.now()
    logger.info("########## PIPELINE START ##########")

    run_step("extract_data.py")
    run_step("clean_transform.py")

    if not args.skip_load:
        run_step("load_to_mysql.py")
    else:
        logger.info("Skipping load_to_mysql.py (--skip-load flag set)")

    elapsed = (datetime.now() - start).total_seconds()
    logger.info(f"########## PIPELINE COMPLETE in {elapsed:.2f}s ##########")


if __name__ == "__main__":
    main()
