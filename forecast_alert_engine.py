"""
forecast_alert_engine.py

Detects upcoming thermal-risk periods from stored forecast risk scores.

Important:
- Current risk comes only from is_forecast = FALSE.
- Forecast risk comes only from is_forecast = TRUE.
- Only genuinely future forecast timestamps are considered.
- The forecast risk-score ID is returned so alerts can be
  linked directly to the exact forecast event.
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import text

from db import engine


ALERT_BANDS = {"high", "extreme"}


def get_current_risk(ward_id: int):
    """
    Get the latest actual/current risk score for a ward.

    Forecast rows are explicitly excluded.
    """

    with engine.connect() as conn:
        row = conn.execute(
            text(
                """
                SELECT
                    id,
                    ward_id,
                    score_time,
                    risk_band,
                    risk_score_raw,
                    heat_index_c,
                    wbgt_c,
                    utci_c
                FROM risk_scores
                WHERE ward_id = :ward_id
                  AND is_forecast = FALSE
                ORDER BY score_time DESC, id DESC
                LIMIT 1
                """
            ),
            {"ward_id": ward_id},
        ).fetchone()

    return dict(row._mapping) if row else None


def get_upcoming_forecast_risks(
    ward_id: int,
    current_time: datetime,
    limit: int = 168,
):
    """
    Return only forecast risk scores that are genuinely
    in the future.
    """

    with engine.connect() as conn:
        rows = conn.execute(
            text(
                """
                SELECT
                    id,
                    ward_id,
                    score_time,
                    risk_band,
                    risk_score_raw,
                    heat_index_c,
                    wbgt_c,
                    utci_c
                FROM risk_scores
                WHERE ward_id = :ward_id
                  AND is_forecast = TRUE
                  AND score_time > :current_time
                ORDER BY score_time ASC, id ASC
                LIMIT :limit
                """
            ),
            {
                "ward_id": ward_id,
                "current_time": current_time,
                "limit": limit,
            },
        ).fetchall()

    return [
        dict(row._mapping)
        for row in rows
    ]


def find_next_high_risk(
    ward_id: int,
    current_time: datetime,
    limit: int = 168,
):
    """
    Find the first future HIGH or EXTREME forecast.
    """

    forecasts = get_upcoming_forecast_risks(
        ward_id,
        current_time,
        limit,
    )

    for forecast in forecasts:
        if forecast["risk_band"] in ALERT_BANDS:
            return forecast

    return None


def calculate_lead_time(
    current_time: datetime,
    forecast_time: datetime,
):
    """
    Calculate the warning lead time in hours.
    """

    delta = forecast_time - current_time

    return round(
        delta.total_seconds() / 3600.0,
        2,
    )


def check_forecast_warning(
    ward_id: int,
    limit: int = 168,
):
    """
    Main forecast-warning function.

    Finds the first genuinely future HIGH/EXTREME
    forecast and calculates the available warning
    lead time.
    """

    current = get_current_risk(ward_id)

    if not current:
        return {
            "warning": False,
            "reason": "No current risk score found.",
            "ward_id": ward_id,
        }

    # Capture one current UTC time and use it consistently.
    now = datetime.now(timezone.utc)

    next_high = find_next_high_risk(
        ward_id,
        now,
        limit,
    )

    if not next_high:
        return {
            "warning": False,
            "reason": (
                "No upcoming HIGH or EXTREME "
                "forecast found."
            ),
            "ward_id": ward_id,
            "current": current,
        }

    forecast_time = next_high["score_time"]

    if forecast_time.tzinfo is None:
        forecast_time = forecast_time.replace(
            tzinfo=timezone.utc
        )

    lead_hours = calculate_lead_time(
        now,
        forecast_time,
    )

    return {
        "warning": True,
        "ward_id": ward_id,

        "current": {
            "risk_band": current["risk_band"],
            "risk_score_raw": float(
                current["risk_score_raw"]
            ),
            "score_time": current["score_time"],
        },

        "next_high_risk": {
            # IMPORTANT:
            # This ID identifies the exact forecast
            # risk_scores row that triggered the warning.
            "risk_score_id": next_high["id"],

            "risk_band": next_high["risk_band"],

            "risk_score_raw": float(
                next_high["risk_score_raw"]
            ),

            "score_time": forecast_time,

            "heat_index_c": float(
                next_high["heat_index_c"]
            ),

            "wbgt_c": float(
                next_high["wbgt_c"]
            ),

            "utci_c": float(
                next_high["utci_c"]
            ),
        },

        "lead_time_hours": lead_hours,

        "message": (
            f"Ward {ward_id} is forecast to reach "
            f"{next_high['risk_band'].upper()} thermal risk "
            f"in approximately {lead_hours} hours."
        ),
    }


if __name__ == "__main__":

    import sys

    ward_id = (
        int(sys.argv[1])
        if len(sys.argv) > 1
        else 1
    )

    result = check_forecast_warning(
        ward_id
    )

    print("=" * 60)
    print(
        f"FORECAST EARLY WARNING — WARD {ward_id}"
    )
    print("=" * 60)

    print(result)