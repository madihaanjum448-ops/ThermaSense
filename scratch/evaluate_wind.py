import sys
import os
from datetime import datetime

# Ensure backend in path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.append(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend"))

import app.liljegren
from app.liljegren import solve_globe, solve_wetbulb, celsius_to_kelvin
from app.derivation import calculate_solar_geometry_and_fraction

app.liljegren.ALB_SFC = 0.15
dt = datetime.fromisoformat("2023-07-15T20:00:00Z")
# Lat/Lon for La Crosse, WI
cza, fdir = calculate_solar_geometry_and_fraction(dt, 43.80, -91.24, 800.0)

cases = [
    ("A - Humid", 95.0, 0.8, 5.0, 800.0, 92.0),
    ("B - Dry Heat", 104.0, 0.2, 15.0, 800.0, 83.0),
    ("C - Partly Cloudy", 86.0, 0.55, 10.0, 400.0, 79.0),
    ("D - Extreme", 113.0, 0.3, 8.0, 800.0, 96.0)
]

print("=== 2m Wind speed = Slider wind speed (No 10m scaling) ===")
for name, t_f, rh, wind_mph, solar, nws_f in cases:
    # Under partly cloudy (Case C), cza and fdir are recalculated with 400 W/m2 GHI
    if solar == 400.0:
        cza_c, fdir_c = calculate_solar_geometry_and_fraction(dt, 43.80, -91.24, 400.0)
    else:
        cza_c, fdir_c = cza, fdir
        
    ta = celsius_to_kelvin((t_f - 32) * 5/9)
    speed = wind_mph * 0.44704 # Convert mph to m/s
    
    tg_c = solve_globe(ta, rh, 1013.25, speed, solar, fdir_c, cza_c)
    twb_c = solve_wetbulb(ta, rh, 1013.25, speed, solar, fdir_c, cza_c, 1.0)
    wbgt_c = 0.7*twb_c + 0.2*tg_c + 0.1*(t_f - 32)*5/9
    wbgt_f = wbgt_c * 9/5 + 32
    delta_c = wbgt_c - (nws_f - 32) * 5/9
    
    print(f"{name:18} | Model: {wbgt_f:.1f}°F ({wbgt_c:.1f}°C) | NWS: {nws_f:.1f}°F | Delta: {delta_c:+.2f}°C")
