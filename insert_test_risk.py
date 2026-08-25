from sqlalchemy import text
from db import engine
from datetime import datetime, timezone

with engine.begin() as conn:
    result = conn.execute(
        text("""
            INSERT INTO risk_scores
                (ward_id, score_time, is_forecast, heat_index_c,
                 wbgt_c, utci_c, risk_band, risk_score_raw)
            VALUES
                (2, :t, false, 42.0, 32.5, 38.0, 'high', 85.0)
            RETURNING id
        """),
        {"t": datetime.now(timezone.utc)}
    )

    print("Test HIGH-risk score inserted, ID:", result.scalar())