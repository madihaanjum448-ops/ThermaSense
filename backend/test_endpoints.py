from app.thermal import get_heat_index, get_wbgt, get_utci, get_derive_all
import json

print("Heat Index:", get_heat_index(tdb=30, rh=70))
print("WBGT:", get_wbgt(twb=25, tg=30, tdb=30, with_solar_load=True))
print("UTCI:", get_utci(tdb=29, tr=32, v=1.0, rh=60))

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
print("Derive All:")
print(json.dumps(get_derive_all(**params), indent=2))
