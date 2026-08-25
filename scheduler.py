"""
scheduler.py — Runs the heatwave pipeline periodically.
"""

import time
import traceback

from run_pipeline import run_pipeline

INTERVAL_SECONDS = 15 * 60


def main():
    print("Heatwave monitoring scheduler started.")
    print(f"Pipeline interval: {INTERVAL_SECONDS // 60} minutes")
    print("Press Ctrl+C to stop.\n")

    while True:
        try:
            print("=" * 60)
            print("Starting scheduled pipeline...")
            run_pipeline()
            print("Scheduled pipeline finished.")

        except Exception as exc:
            print(f"Pipeline failed: {exc}")
            traceback.print_exc()

        print(
            f"\nWaiting {INTERVAL_SECONDS // 60} minutes "
            "before the next run...\n"
        )

        time.sleep(INTERVAL_SECONDS)


if __name__ == "__main__":
    main()