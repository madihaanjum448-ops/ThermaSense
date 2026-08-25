"""Test Pair C alert detection."""

from sqlalchemy import text

from db import engine
from alert_engine import check_and_alert


WARD_ID = 2

print(f"Checking alerts for ward_id={WARD_ID}...")

result = check_and_alert(WARD_ID)

print("\nAlert result:")
print(result)

with engine.connect() as conn:
    rows = conn.execute(
        text(
            """
            SELECT id, ward_id, triggered_at, risk_band,
                   channel, message, status
            FROM alerts_log
            WHERE ward_id = :ward_id
            ORDER BY triggered_at DESC
            LIMIT 5
            """
        ),
        {"ward_id": WARD_ID},
    ).fetchall()

print("\nRecent alerts:")
for row in rows:
    print(dict(row._mapping))

print("\nALERT ENGINE TEST COMPLETE")