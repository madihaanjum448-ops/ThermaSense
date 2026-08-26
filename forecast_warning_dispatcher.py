"""
forecast_warning_dispatcher.py

Connects forecast early-warning detection to the existing webhook.

Each forecast warning is linked directly to the risk_scores row
that triggered it using alerts_log.risk_score_id.

This prevents duplicate webhook alerts for the same forecast event.
"""

from datetime import datetime, timezone

import requests
from sqlalchemy import text

from db import engine
from alert_engine import WEBHOOK_URL
from forecast_alert_engine import check_forecast_warning


def _warning_already_sent(
    risk_score_id: int,
) -> bool:
    """
    Check whether this exact forecast risk-score event
    already has a successfully delivered alert.
    """

    with engine.connect() as conn:

        row = conn.execute(
            text(
                """
                SELECT id
                FROM alerts_log
                WHERE risk_score_id = :risk_score_id
                  AND status = 'sent'
                LIMIT 1
                """
            ),
            {
                "risk_score_id": risk_score_id,
            },
        ).fetchone()

    return row is not None


def send_forecast_warning(
    warning: dict,
):
    """
    Store and deliver one forecast warning.
    """

    ward_id = warning["ward_id"]

    forecast = warning[
        "next_high_risk"
    ]

    risk_score_id = forecast[
        "risk_score_id"
    ]

    risk_band = forecast[
        "risk_band"
    ]

    risk_score = float(
        forecast.get("final_risk_score")
        if forecast.get("final_risk_score") is not None
        else forecast.get("risk_score_raw", 0.0)
    )

    forecast_time = forecast[
        "score_time"
    ]

    if forecast_time.tzinfo is None:

        forecast_time = forecast_time.replace(
            tzinfo=timezone.utc
        )

    # --------------------------------------------------
    # Prevent duplicate delivery
    # --------------------------------------------------

    if _warning_already_sent(
        risk_score_id
    ):

        print(
            f"Forecast warning already sent "
            f"for risk score {risk_score_id}."
        )

        return {
            "sent": False,
            "reason": "duplicate",
        }

    lead_hours = warning[
        "lead_time_hours"
    ]

    message = (
        f"FORECAST {risk_band.upper()} heat risk "
        f"expected for ward {ward_id}. "
        f"Expected at {forecast_time.isoformat()}. "
        f"Lead time: approximately "
        f"{lead_hours} hours. "
        f"Final risk score: {risk_score}, "
        f"WBGT: {forecast['wbgt_c']}°C, "
        f"UTCI: {forecast['utci_c']}°C."
    )

    # --------------------------------------------------
    # Create alert record
    # --------------------------------------------------

    with engine.begin() as conn:

        result = conn.execute(
            text(
                """
                INSERT INTO alerts_log
                    (
                        ward_id,
                        triggered_at,
                        risk_band,
                        channel,
                        message,
                        status,
                        risk_score_id
                    )
                VALUES
                    (
                        :ward_id,
                        :triggered_at,
                        :risk_band,
                        :channel,
                        :message,
                        :status,
                        :risk_score_id
                    )
                RETURNING id
                """
            ),
            {
                "ward_id": ward_id,
                "triggered_at": datetime.now(
                    timezone.utc
                ),
                "risk_band": risk_band,
                "channel": "webhook",
                "message": message,
                "status": "pending",
                "risk_score_id": risk_score_id,
            },
        )

        alert_id = result.scalar_one()

    # --------------------------------------------------
    # Deliver webhook
    # --------------------------------------------------

    payload = {
        "alert_id": alert_id,
        "alert_type": "forecast_warning",
        "ward_id": ward_id,
        "risk_score_id": risk_score_id,
        "risk_band": risk_band,
        "risk_score": risk_score,
        "raw_risk_score": float(
            forecast.get("risk_score_raw", 0.0)
        ),
        "vulnerability_score": float(
            forecast.get("vulnerability_score") or 0.0
        ),
        "heat_index_c": float(
            forecast["heat_index_c"]
        ),
        "wbgt_c": float(
            forecast["wbgt_c"]
        ),
        "utci_c": float(
            forecast["utci_c"]
        ),
        "forecast_time": forecast_time.isoformat(),
        "lead_time_hours": lead_hours,
        "message": message,
        "triggered_at": datetime.now(
            timezone.utc
        ).isoformat(),
    }

    try:

        response = requests.post(
            WEBHOOK_URL,
            json=payload,
            timeout=10,
        )

        response.raise_for_status()

        with engine.begin() as conn:

            conn.execute(
                text(
                    """
                    UPDATE alerts_log
                    SET status = 'sent'
                    WHERE id = :alert_id
                    """
                ),
                {
                    "alert_id": alert_id,
                },
            )

        print(
            f"Forecast warning delivered successfully. "
            f"HTTP {response.status_code}"
        )

        return {
            "sent": True,
            "alert_id": alert_id,
            "risk_score_id": risk_score_id,
            "message": message,
        }

    except Exception as exc:

        with engine.begin() as conn:

            conn.execute(
                text(
                    """
                    UPDATE alerts_log
                    SET status = 'failed'
                    WHERE id = :alert_id
                    """
                ),
                {
                    "alert_id": alert_id,
                },
            )

        print(
            f"Forecast warning delivery failed: {exc}"
        )

        return {
            "sent": False,
            "alert_id": alert_id,
            "risk_score_id": risk_score_id,
            "reason": str(exc),
        }


def check_and_dispatch_forecast_warning(
    ward_id: int,
):
    """
    Detect and dispatch an upcoming HIGH/EXTREME
    forecast warning.
    """

    warning = check_forecast_warning(
        ward_id
    )

    if not warning["warning"]:

        print(
            f"No forecast warning for ward "
            f"{ward_id}: "
            f"{warning['reason']}"
        )

        return {
            "warning": False,
            "sent": False,
            "reason": warning["reason"],
        }

    return {
        "warning": True,
        **send_forecast_warning(
            warning
        ),
    }