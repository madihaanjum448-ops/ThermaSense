"""End-to-end test for Pair B thermal/risk engine."""

from sqlalchemy import text

from db import engine, get_wards
from thermal_engine import run_for_ward


WARD_ID = 2


print(f"Testing thermal engine for ward_id={WARD_ID}...")

wards = get_wards()
ward_ids = {w["id"] for w in wards}

if WARD_ID not in ward_ids:
    raise SystemExit(
        f"Ward {WARD_ID} does not exist. Available wards: {sorted(ward_ids)}"
    )

result = run_for_ward(WARD_ID)

print("\nCalculated thermal metrics:")
print(f"  Heat Index : {result['heat_index_c']} °C")
print(f"  WBGT       : {result['wbgt_c']} °C")
print(f"  UTCI       : {result['utci_c']} °C")
print(f"  Risk score : {result['risk_score_raw']}")
print(f"  Risk band  : {result['risk_band']}")
print(f"  Solar used : {result['solar_radiation_wm2_used']}")
print(f"  Globe temp : {result['estimated_globe_temperature_c']} °C")
print(f"  MRT        : {result['mean_radiant_temperature_c']} °C")
print(f"  Note       : {result['solar_note']}")

with engine.connect() as conn:
    row = conn.execute(
        text(
            """
            SELECT ward_id, score_time, heat_index_c, wbgt_c, utci_c,
                   risk_band, risk_score_raw
            FROM risk_scores
            WHERE ward_id = :ward_id
            ORDER BY computed_at DESC
            LIMIT 1
            """
        ),
        {"ward_id": WARD_ID},
    ).fetchone()

if not row:
    raise RuntimeError("Risk score was not found in the database.")

print("\nRead back from risk_scores:")
print(dict(row._mapping))

print("\nTHERMAL ENGINE TEST PASSED")