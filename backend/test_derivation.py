from app.derivation import derive_thermal_inputs
from app.thermal import get_derive_all
import json
import traceback

params = {
    "temp_c": 32.0,
    "humidity": 50.0,
    "wind_ms": 2.0,
    "solar_rad": 800.0,
    "timestamp": "2023-07-15T20:00:00Z",  # Solar noon in Los Angeles (13:00 PDT)
    "latitude": 34.0522,  # Los Angeles
    "longitude": -118.2437,
    "pressure_hpa": 1013.25
}

print("Running derive_all endpoint test...")
try:
    res = get_derive_all(**params)
    print("\nSUCCESS!")
    print(json.dumps(res, indent=2))
except Exception as e:
    traceback.print_exc()
