import sys
import os

# Ensure backend directory is in path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.append(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend"))

import app.liljegren
from app.thermal import get_derive_all

# Define the 4 cases (temperatures in C, winds in m/s, solar in W/m2)
# Solar rad is 800 W/m2 for clear sky (0% cloud cover) and 400 W/m2 for 50% cloud cover
cases = [
    {
        "name": "A - Humid/monsoon-like",
        "temp_c": 35.0,        # 95 F
        "humidity": 80.0,
        "wind_ms": 2.235,      # 5 mph
        "solar_rad": 800.0,
        "nws_wbgt_f": 92.0
    },
    {
        "name": "B - Dry heat",
        "temp_c": 40.0,        # 104 F
        "humidity": 20.0,
        "wind_ms": 6.705,      # 15 mph
        "solar_rad": 800.0,
        "nws_wbgt_f": 83.0
    },
    {
        "name": "C - Partly cloudy",
        "temp_c": 30.0,        # 86 F
        "humidity": 55.0,
        "wind_ms": 4.470,      # 10 mph
        "solar_rad": 400.0,    # 50% cloud cover
        "nws_wbgt_f": 79.0
    },
    {
        "name": "D - Extreme dry heat",
        "temp_c": 45.0,        # 113 F
        "humidity": 30.0,
        "wind_ms": 3.576,      # 8 mph
        "solar_rad": 800.0,
        "nws_wbgt_f": 96.0
    }
]

# Common parameters (La Crosse, WI, July 15 solar noon)
common_params = {
    "timestamp": "2023-07-15T20:00:00Z",
    "latitude": 43.80,
    "longitude": -91.24,
    "pressure_hpa": 1013.25
}

def c_to_f(temp_c):
    return temp_c * 9/5 + 32

def run_evaluation(albedo):
    app.liljegren.ALB_SFC = albedo
    results = []
    
    for c in cases:
        res = get_derive_all(
            temp_c=c["temp_c"],
            humidity=c["humidity"],
            wind_ms=c["wind_ms"],
            solar_rad=c["solar_rad"],
            timestamp=common_params["timestamp"],
            latitude=common_params["latitude"],
            longitude=common_params["longitude"],
            pressure_hpa=common_params["pressure_hpa"]
        )
        wbgt_c = res["indices"]["wbgt"]
        wbgt_f = c_to_f(wbgt_c)
        nws_wbgt_c = (c["nws_wbgt_f"] - 32) * 5/9
        delta_c = wbgt_c - nws_wbgt_c
        
        results.append({
            "name": c["name"],
            "temp_f": c_to_f(c["temp_c"]),
            "rh": c["humidity"],
            "wind_mph": c["wind_ms"] * 2.237,
            "cloud_cover": "0%" if c["solar_rad"] == 800.0 else "50%",
            "model_wbgt_c": wbgt_c,
            "model_wbgt_f": wbgt_f,
            "nws_wbgt_f": c["nws_wbgt_f"],
            "nws_wbgt_c": nws_wbgt_c,
            "delta_c": delta_c
        })
        
    return results

if __name__ == "__main__":
    print("Running calculations...")
    results_15 = run_evaluation(0.15)
    results_25 = run_evaluation(0.25)
    
    # Print Markdown Table
    print("\n# WBGT Model Comparison Table (ALB_SFC = 0.15 vs 0.25)\n")
    print("| Case | Albedo | Model WBGT (°C / °F) | NWS WBGT (°C / °F) | Delta (°C) |")
    print("| :--- | :---: | :---: | :---: | :---: |")
    
    for r15, r25 in zip(results_15, results_25):
        # ALB_SFC = 0.15 row
        print(f"| {r15['name']} | 0.15 | {r15['model_wbgt_c']:.1f}°C / {r15['model_wbgt_f']:.1f}°F | {r15['nws_wbgt_c']:.1f}°C / {r15['nws_wbgt_f']:.1f}°F | {r15['delta_c']:.2f}°C |")
        # ALB_SFC = 0.25 row
        print(f"| {r25['name']} | 0.25 | {r25['model_wbgt_c']:.1f}°C / {r25['model_wbgt_f']:.1f}°F | {r25['nws_wbgt_c']:.1f}°C / {r25['nws_wbgt_f']:.1f}°F | {r25['delta_c']:.2f}°C |")
