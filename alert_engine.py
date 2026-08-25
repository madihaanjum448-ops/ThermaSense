"""
alert_engine.py — Pair C Alert & Response layer.

Reads the latest risk score for a ward and creates an alert in alerts_log
when the risk is HIGH or EXTREME.

External delivery is done through a webhook.

Alert policy:
- LOW / MODERATE → no alert
- MODERATE → HIGH → send alert
- HIGH → HIGH → no repeated alert
- HIGH → EXTREME → send escalation alert
- EXTREME → EXTREME → no repeated alert
- EXTREME → HIGH → no new alert
"""

import os
import requests
from datetime import datetime, timezone

from sqlalchemy import text
from dotenv import load_dotenv

from db import engine


load_dotenv(override=True)

WEBHOOK_URL = os.getenv(
    "WEBHOOK_URL",
    "http://127.0.0.1:8000/webhook"
)


def get_latest_risk(ward_id: int):
    """Get the most recently calculated risk score for a ward."""

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
                ORDER BY computed_at DESC
                LIMIT 1
                """
            ),
            {"ward_id": ward_id},
        ).fetchone()

    return dict(row._mapping) if row else None


def get_previous_alert(ward_id: int):
    """
    Get the most recent HIGH/EXTREME alert for this ward.

    This is used to prevent repeated alerts while a ward
    remains at the same risk level.
    """

    with engine.connect() as conn:
        row = conn.execute(
            text(
                """
                SELECT
                    id,
                    risk_band,
                    status,
                    triggered_at
                FROM alerts_log
                WHERE ward_id = :ward_id
                  AND risk_band IN ('high', 'extreme')
                ORDER BY triggered_at DESC
                LIMIT 1
                """
            ),
            {"ward_id": ward_id},
        ).fetchone()

    return dict(row._mapping) if row else None


def send_webhook(
    alert_id: int,
    ward_id: int,
    risk: dict,
    message: str
):
    """Send an alert to the configured webhook."""

    payload = {
        "alert_id": alert_id,
        "ward_id": ward_id,
        "risk_band": risk["risk_band"],
        "risk_score": float(risk["risk_score_raw"]),
        "heat_index_c": float(risk["heat_index_c"]),
        "wbgt_c": float(risk["wbgt_c"]),
        "utci_c": float(risk["utci_c"]),
        "message": message,
        "triggered_at": datetime.now(timezone.utc).isoformat(),
    }

    response = requests.post(
        WEBHOOK_URL,
        json=payload,
        timeout=10,
    )

    response.raise_for_status()

    return response


def update_alert_status(alert_id: int, status: str):
    """Update the delivery status of an alert."""

    with engine.begin() as conn:
        conn.execute(
            text(
                """
                UPDATE alerts_log
                SET status = :status
                WHERE id = :alert_id
                """
            ),
            {
                "alert_id": alert_id,
                "status": status,
            },
        )


def create_alert(ward_id: int, risk: dict):
    """
    Create and deliver an alert when risk enters or escalates
    to HIGH or EXTREME.
    """

    risk_band = risk["risk_band"]

    # Only HIGH and EXTREME risks generate alerts.
    if risk_band not in ("high", "extreme"):
        return None

    # Risk severity levels.
    severity = {
        "high": 1,
        "extreme": 2,
    }

    # Check the previous HIGH/EXTREME alert state.
    previous = get_previous_alert(ward_id)

    if previous:
        previous_band = previous["risk_band"]

        # If the ward remains at the same severity or moves
        # to a less severe state, do not send another alert.
        if severity[risk_band] <= severity[previous_band]:
            print(
                f"No new alert. Ward {ward_id} remains "
                f"{risk_band.upper()} risk."
            )
            return None

        # If we get here:
        # previous = HIGH
        # current  = EXTREME
        #
        # This is a genuine escalation, so send an alert.
        print(
            f"Risk escalation detected: "
            f"{previous_band.upper()} → {risk_band.upper()}"
        )

    message = (
        f"{risk_band.upper()} heat risk detected for ward {ward_id}. "
        f"Risk score: {risk['risk_score_raw']}, "
        f"WBGT: {risk['wbgt_c']}°C, "
        f"UTCI: {risk['utci_c']}°C."
    )

    # Link this alert to the exact risk_scores row
    # that caused it.
    risk_score_id = risk["id"]

    # Create the alert in the database.
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
                "triggered_at": datetime.now(timezone.utc),
                "risk_band": risk_band,
                "channel": "webhook",
                "message": message,
                "status": "pending",
                "risk_score_id": risk_score_id,
            },
        )

        alert_id = result.scalar_one()

    # Deliver the alert through the webhook.
    try:
        response = send_webhook(
            alert_id,
            ward_id,
            risk,
            message,
        )

        update_alert_status(
            alert_id,
            "sent"
        )

        print(
            f"Webhook delivered successfully. "
            f"HTTP {response.status_code}"
        )

    except Exception as exc:
        update_alert_status(
            alert_id,
            "failed"
        )

        print(
            f"Webhook delivery failed: {exc}"
        )

    return alert_id


def check_and_alert(ward_id: int):
    """
    Check the latest risk and create an alert when necessary.
    """

    risk = get_latest_risk(ward_id)

    if not risk:
        raise ValueError(
            f"No risk score found for ward {ward_id}"
        )

    alert_id = create_alert(
        ward_id,
        risk
    )

    if alert_id is None:
        return {
            "alert_created": False,
            "reason": (
                f"Risk band is {risk['risk_band']}"
            ),
            "risk": risk,
        }

    return {
        "alert_created": True,
        "alert_id": alert_id,
        "risk": risk,
    }