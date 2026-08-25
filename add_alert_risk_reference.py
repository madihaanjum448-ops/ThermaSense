from sqlalchemy import text
from db import engine

with engine.begin() as conn:
    print("Adding risk_score_id column...")

    conn.execute(
        text("""
            ALTER TABLE alerts_log
            ADD COLUMN IF NOT EXISTS risk_score_id BIGINT
            REFERENCES risk_scores(id) ON DELETE SET NULL
        """)
    )

    print("Creating index...")

    conn.execute(
        text("""
            CREATE INDEX IF NOT EXISTS idx_alerts_risk_score
            ON alerts_log (risk_score_id)
        """)
    )

print("Migration completed successfully.")