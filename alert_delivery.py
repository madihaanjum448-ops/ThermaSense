import os

from dotenv import load_dotenv

from sms_service import send_sms

load_dotenv(override=True)

ALERT_CHANNEL = os.getenv(
    "ALERT_CHANNEL",
    "sms"
).lower()


def send_alert(
    alert_id: int,
    ward_id: int,
    risk: dict,
    message: str
):
    """
    Send an alert through the configured delivery channel.

    Supported channels:
    - sms
    - webhook
    """

    if ALERT_CHANNEL == "sms":
        return send_sms_alert(
            alert_id,
            ward_id,
            risk,
            message
        )

    elif ALERT_CHANNEL == "webhook":
        return send_webhook_alert(
            alert_id,
            ward_id,
            risk,
            message
        )

    else:
        raise ValueError(
            f"Unsupported ALERT_CHANNEL: {ALERT_CHANNEL}"
        )


def send_sms_alert(
    alert_id: int,
    ward_id: int,
    risk: dict,
    message: str
):
    """Send a heat-risk alert through SMS."""

    risk_band = (
        risk.get("final_risk_band")
        or risk.get("risk_band")
    )

    final_score = float(
        risk.get("final_risk_score")
        if risk.get("final_risk_score") is not None
        else risk.get("risk_score_raw", 0.0)
    )

    sms_message = (
        f"THERMASENSE HEAT ALERT\n"
        f"Ward: {ward_id}\n"
        f"Risk: {risk_band.upper()}\n"
        f"Risk Score: {final_score:.1f}\n"
        f"WBGT: {float(risk.get('wbgt_c', 0.0)):.1f} C\n"
        f"UTCI: {float(risk.get('utci_c', 0.0)):.1f} C\n\n"
        f"{message}\n\n"
        f"Avoid prolonged outdoor exposure and stay hydrated."
    )

    return send_sms(sms_message)


def send_webhook_alert(
    alert_id: int,
    ward_id: int,
    risk: dict,
    message: str
):
    """Send an alert through the existing webhook."""

    import requests
    from datetime import datetime, timezone

    webhook_url = os.getenv(
        "WEBHOOK_URL",
        "http://127.0.0.1:8000/webhook"
    )

    risk_band = (
        risk.get("final_risk_band")
        or risk.get("risk_band")
    )

    final_score = float(
        risk.get("final_risk_score")
        if risk.get("final_risk_score") is not None
        else risk.get("risk_score_raw", 0.0)
    )

    payload = {
        "alert_id": alert_id,
        "ward_id": ward_id,
        "risk_band": risk_band,
        "risk_score": final_score,
        "raw_risk_score": float(
            risk.get("risk_score_raw", 0.0)
        ),
        "vulnerability_score": float(
            risk.get("vulnerability_score") or 0.0
        ),
        "heat_index_c": float(
            risk.get("heat_index_c", 0.0)
        ),
        "wbgt_c": float(
            risk.get("wbgt_c", 0.0)
        ),
        "utci_c": float(
            risk.get("utci_c", 0.0)
        ),
        "message": message,
        "triggered_at": datetime.now(
            timezone.utc
        ).isoformat(),
    }

    response = requests.post(
        webhook_url,
        json=payload,
        timeout=10,
    )

    response.raise_for_status()

    return response