"""
cleanup_forecasts.py — forecast retention policy.

Decision: retain 5 days of forecast data internally.

Why 5, not 3 or 7:
- Open-Meteo's short-range accuracy degrades noticeably past day 5;
  showing day 6/7 risk bands would overstate confidence to ward officials.
- 3 days is too short to plan ahead for staffing/water-point deployment.
- 5 days matches the dashboard spec (Today..Day5) with one spare day of
  buffer so a slightly-late scheduler run still has 5 clean days to show.

We still *fetch* 7 days from Open-Meteo (fetch_weather.py) because a wider
raw pull is cheap and harmless — but we only *persist forward* 5 days, and
we purge:
  1. Forecast rows whose reading_time is more than RETENTION_DAYS ahead
     (defensive — in case forecast_days is ever bumped up).
  2. Forecast rows whose reading_time has already passed. Once "tomorrow
     3pm" becomes "now", the forecast row is superseded by an actual
     (is_forecast=FALSE) reading and is just clutter/confusing in charts
     that show forecast vs. actual side by side.

Run this after every pipeline run (see run_pipeline.py), or as its own
scheduled job.
"""

from datetime import timedelta, datetime, timezone

from sqlalchemy import text
from db import engine

RETENTION_DAYS = 5


def cleanup_forecasts(retention_days: int = RETENTION_DAYS) -> dict:
    cutoff = datetime.now(timezone.utc) + timedelta(days=retention_days)

    with engine.begin() as conn:
        expired_future = conn.execute(
            text(
                """
                DELETE FROM weather_readings
                WHERE is_forecast = TRUE
                  AND reading_time > :cutoff
                """
            ),
            {"cutoff": cutoff},
        ).rowcount

        stale_past_weather = conn.execute(
            text(
                """
                DELETE FROM weather_readings
                WHERE is_forecast = TRUE
                  AND reading_time < now()
                """
            )
        ).rowcount

        expired_future_risk = conn.execute(
            text(
                """
                DELETE FROM risk_scores
                WHERE is_forecast = TRUE
                  AND score_time > :cutoff
                """
            ),
            {"cutoff": cutoff},
        ).rowcount

        stale_past_risk = conn.execute(
            text(
                """
                DELETE FROM risk_scores
                WHERE is_forecast = TRUE
                  AND score_time < now()
                """
            )
        ).rowcount

    result = {
        "retention_days": retention_days,
        "weather_rows_deleted_beyond_horizon": expired_future,
        "weather_rows_deleted_stale_past": stale_past_weather,
        "risk_rows_deleted_beyond_horizon": expired_future_risk,
        "risk_rows_deleted_stale_past": stale_past_risk,
    }

    print(
        f"Retention cleanup ({retention_days}d): "
        f"weather beyond horizon={expired_future}, "
        f"weather stale past={stale_past_weather}, "
        f"risk beyond horizon={expired_future_risk}, "
        f"risk stale past={stale_past_risk}"
    )

    return result


if __name__ == "__main__":
    cleanup_forecasts()