import os

from dotenv import load_dotenv
from twilio.rest import Client

load_dotenv(override=True)


TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
TWILIO_PHONE_NUMBER = os.getenv("TWILIO_PHONE_NUMBER")
ALERT_PHONE_NUMBER = os.getenv("ALERT_PHONE_NUMBER")


def send_sms(message: str, to: str | None = None):
    """
    Send an SMS alert using Twilio.
    """

    if not TWILIO_ACCOUNT_SID:
        raise ValueError("TWILIO_ACCOUNT_SID is missing")

    if not TWILIO_AUTH_TOKEN:
        raise ValueError("TWILIO_AUTH_TOKEN is missing")

    if not TWILIO_PHONE_NUMBER:
        raise ValueError("TWILIO_PHONE_NUMBER is missing")

    recipient = to or ALERT_PHONE_NUMBER

    if not recipient:
        raise ValueError("ALERT_PHONE_NUMBER is missing")

    client = Client(
        TWILIO_ACCOUNT_SID,
        TWILIO_AUTH_TOKEN
    )

    sms = client.messages.create(
        body=message,
        from_=TWILIO_PHONE_NUMBER,
        to=recipient,
    )

    print(f"SMS sent successfully. SID: {sms.sid}")

    return sms