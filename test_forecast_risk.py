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

from db import get_ward_demographics
from risk_scoring import calculate_vulnerability_score, combine_risk

demographics = get_ward_demographics(WARD_ID)
expected_vuln = calculate_vulnerability_score(demographics) if demographics else 0.0
expected_final_score, expected_final_band = combine_risk(result["risk_score_raw"], expected_vuln)

print(f"  Vulnerability: {result['vulnerability_score']}")
print(f"  Final Risk   : {result['final_risk_score']}")
print(f"  Final Band   : {result['final_risk_band']}")

# Assertions verifying canonical risk combination in forecast engine
assert result["vulnerability_score"] == expected_vuln, "Forecast vulnerability score does not match canonical calculation"
assert result["final_risk_score"] == expected_final_score, "Forecast final risk score does not match canonical combine_risk"
assert result["final_risk_band"] == expected_final_band, "Forecast final risk band does not match canonical combine_risk"
assert result["final_risk_score"] >= result["risk_score_raw"], "Forecast final score cannot be lower than raw thermal score"

print("\nFORECAST THERMAL TEST PASSED — Assertions verified canonical risk alignment")