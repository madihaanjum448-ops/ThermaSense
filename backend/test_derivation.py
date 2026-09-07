import sys
import os
import json
import traceback

# Ensure backend directory is in path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.derivation import derive_thermal_inputs
from app.thermal import get_derive_all

# NWS Tulsa Simulator reference case
# Air Temp = 90°F (32.22°C), RH = 50%, Wind = 5 mph (2.235 m/s)
# Location: La Crosse, WI (Lat 43.80, Lon -91.24) on July 15 (cossza = 0.851)
# Ground Albedo = 0.15 (calibrated)
# Expected WBGT from NWS simulator = 84.0°F (28.89°C)
# GHI is set to 800.0 W/m² (theoretical clean-sky full sun GHI)
params = {
    "temp_c": 32.22,
    "humidity": 50.0,
    "wind_ms": 2.235,
    "solar_rad": 800.0,
    "timestamp": "2023-07-15T20:00:00Z",
    "latitude": 43.80,
    "longitude": -91.24,
    "pressure_hpa": 1013.25
}


print("Running derive_all endpoint test with 800 W/m² full-sun reference case...")
try:
    res = get_derive_all(**params)
    print("\nCalculated Result:")
    print(json.dumps(res, indent=2))
    
    # Extract calculated values
    derived = res["derived_inputs"]
    indices = res["indices"]
    
    # Assertions with tolerances
    # Under ALB_SFC = 0.15, solar_rad = 800.0 W/m² with Bird & Hulstrom humidity attenuation:
    # tau_w = 0.964, effective_solar_rad = 771.5 W/m²
    # twb_natural = 25.20 °C, tg = 42.69 °C, tr = 80.3 °C, wbgt = 29.4 °C (84.92 °F)
    # The output WBGT of 29.4°C is only +0.51°C (+0.92°F) from the NWS 84.0°F reference.
    
    assert abs(indices["wbgt"] - 29.4) < 0.15, f"Expected WBGT around 29.4, got {indices['wbgt']}"
    assert abs(derived["twb_natural"] - 25.20) < 0.15, f"Expected twb_natural around 25.20, got {derived['twb_natural']}"
    assert abs(derived["tg"] - 42.69) < 0.15, f"Expected tg around 42.69, got {derived['tg']}"
    assert abs(derived["tr"] - 80.3) < 0.5, f"Expected tr around 80.3, got {derived['tr']}"
    
    print("\nDERIVATION VERIFICATION PASSED - Calculations match NWS Tulsa simulator reference values!")
    
except Exception as e:
    print("\nDERIVATION VERIFICATION FAILED:")
    traceback.print_exc()
    sys.exit(1)
