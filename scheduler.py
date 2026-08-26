"""
scheduler.py — Runs the heatwave pipeline periodically using APScheduler.
"""

from datetime import datetime

from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.events import EVENT_JOB_ERROR, EVENT_JOB_EXECUTED

from run_pipeline import run_pipeline

INTERVAL_MINUTES = 15


def job():
    print("=" * 60)
    print("Starting scheduled pipeline...")
    run_pipeline()
    print("Scheduled pipeline finished.")


def log_result(event):
    if event.exception:
        print(f"Pipeline job failed: {event.exception}")
    else:
        print("Pipeline job completed successfully.")


def main():
    scheduler = BlockingScheduler()
    scheduler.add_listener(log_result, EVENT_JOB_EXECUTED | EVENT_JOB_ERROR)

    scheduler.add_job(
        job,
        trigger="interval",
        minutes=INTERVAL_MINUTES,
        id="heatwave_pipeline",
        next_run_time=datetime.now(),  # fire immediately on startup, then every interval
        max_instances=1,               # don't overlap runs if one is still going
        coalesce=True,                 # if we fall behind, skip missed runs, don't stack them
        misfire_grace_time=60,
    )

    print("Heatwave monitoring scheduler started (APScheduler).")
    print(f"Pipeline interval: {INTERVAL_MINUTES} minutes (first run: now)")
    print("Press Ctrl+C to stop.\n")

    try:
        scheduler.start()
    except (KeyboardInterrupt, SystemExit):
        print("Scheduler stopped.")


if __name__ == "__main__":
    main()