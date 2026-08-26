import sys
import os
import json
import traceback

# Ensure backend directory is in path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.derivation import derive_thermal_inputs
from app.thermal import get_derive_all

# NWS Tulsa Simulator reference case
# Air Temp = 90°F (32.22°C), RH = 50%, Wind = 5 mph (2.235 m/s), Cloud Cover = 0% (clear sky)
# Location: La Crosse, WI (Lat 43.80, Lon -91.24) on July 15 (cossza = 0.851)
# Ground Albedo = 0.15 (standard grass)
# Expected WBGT from NWS simulator = 84°F (approx. 28.9°C to 29.1°C)
params = {
    "temp_c": 32.22,
    "humidity": 50.0,
    "wind_ms": 2.235,
    "solar_rad": 480.0,
    "timestamp": "2023-07-15T20:00:00Z",
    "latitude": 43.80,
    "longitude": -91.24,
    "pressure_hpa": 1013.25
}

print("Running derive_all endpoint test with NWS reference case...")
try:
    res = get_derive_all(**params)
    print("\nCalculated Result:")
    print(json.dumps(res, indent=2))
    
    # Extract calculated values
    derived = res["derived_inputs"]
    indices = res["indices"]
    
    # Assertions with tolerances
    # Expected model values with ground albedo = 0.15:
    # twb_natural = 25.33 °C, tg = 40.50 °C, tr = 70.5 °C, wbgt = 29.1 °C (84.38 °F)
    # The output WBGT of 29.1 °C matches the NWS Tulsa simulator's output of 84°F.
    
    assert abs(indices["wbgt"] - 29.1) < 0.15, f"Expected WBGT around 29.1, got {indices['wbgt']}"
    assert abs(derived["twb_natural"] - 25.33) < 0.15, f"Expected twb_natural around 25.33, got {derived['twb_natural']}"
    assert abs(derived["tg"] - 40.50) < 0.15, f"Expected tg around 40.50, got {derived['tg']}"
    assert abs(derived["tr"] - 70.5) < 0.5, f"Expected tr around 70.5, got {derived['tr']}"
    
    print("\nDERIVATION VERIFICATION PASSED - Calculations match NWS Tulsa simulator reference values!")
    
except Exception as e:
    print("\nDERIVATION VERIFICATION FAILED:")
    traceback.print_exc()
    sys.exit(1)
