"""
Test forecast thermal-risk engine for one ward.
"""

from forecast_risk_engine import (
    get_forecast_rows,
    calculate_forecast_risk,
)


WARD_ID = 2


print(
    f"Testing forecast thermal engine "
    f"for ward_id={WARD_ID}..."
)


rows = get_forecast_rows(
    WARD_ID,
    limit=1,
)


if not rows:
    raise SystemExit(
        "No future forecast rows found."
    )


row = rows[0]


print("\nFirst forecast weather row:")

print(
    f"  Time       : "
    f"{row['reading_time']}"
)

print(
    f"  Temperature: "
    f"{row['temp_c']} °C"
)

print(
    f"  Humidity   : "
    f"{row['humidity_pct']} %"
)

print(
    f"  Wind       : "
    f"{row['wind_speed_ms']} m/s"
)


result = calculate_forecast_risk(
    row
)


print("\nCalculated forecast risk:")

print(
    f"  Heat Index : "
    f"{result['heat_index_c']} °C"
)

print(
    f"  WBGT       : "
    f"{result['wbgt_c']} °C"
)

print(
    f"  UTCI       : "
    f"{result['utci_c']} °C"
)

print(
    f"  Risk score : "
    f"{result['risk_score_raw']}"
)

print(
    f"  Risk band  : "
    f"{result['risk_band']}"
)

print(
    f"  MRT        : "
    f"{result['mean_radiant_temperature_c']} °C"
)

print(
    f"  Note       : "
    f"{result['solar_note']}"
)


print(
    "\nFORECAST THERMAL TEST PASSED"
)