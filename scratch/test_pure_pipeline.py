import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import json
import math
from thermal_engine import (
    _estimate_globe_temperature,
    _risk_from_indices,
    SIGMA,
    EMISSIVITY,
    GLOBE_DIAMETER_M,
    SOLAR_ABSORPTIVITY
)
from pythermalcomfort.models import heat_index_lu, wbgt, utci
from pythermalcomfort.utilities import wet_bulb_tmp, mean_radiant_tmp
from risk_scoring import calculate_vulnerability_score, combine_risk

def noaa_heat_index(t_c: float, rh: float) -> float:
    """NOAA / Rothfusz 1990 regression equation for Heat Index in Celsius."""
    t_f = t_c * 9.0 / 5.0 + 32.0
    hi_simple = 0.5 * (t_f + 61.0 + ((t_f - 68.0) * 1.2) + (rh * 0.094))
    if (hi_simple + t_f) / 2.0 < 80.0:
        hi_f = hi_simple
    else:
        hi_f = (
            -42.379
            + 2.04901523 * t_f
            + 10.14333127 * rh
            - 0.22475541 * t_f * rh
            - 0.00683783 * (t_f ** 2)
            - 0.05481717 * (rh ** 2)
            + 0.00122874 * (t_f ** 2) * rh
            + 0.00085282 * t_f * (rh ** 2)
            - 0.00000199 * (t_f ** 2) * (rh ** 2)
        )
        if rh < 13.0 and (80.0 <= t_f <= 112.0):
            adj = -((13.0 - rh) / 4.0) * math.sqrt(max(0.0, (17.0 - abs(t_f - 95.0)) / 17.0))
            hi_f += adj
        elif rh > 85.0 and (80.0 <= t_f <= 87.0):
            adj = ((rh - 85.0) / 10.0) * ((87.0 - t_f) / 5.0)
            hi_f += adj

    return (hi_f - 32.0) * 5.0 / 9.0

def stull_wet_bulb(t_c: float, rh: float) -> float:
    """Stull (2011) empirical wet-bulb temperature formula."""
    return (
        t_c * math.atan(0.151977 * math.sqrt(rh + 8.313659))
        + math.atan(t_c + rh)
        - math.atan(rh - 1.676331)
        + 0.00391838 * (rh ** 1.5) * math.atan(0.023101 * rh)
        - 4.686035
    )

def evaluate_all():
    rows = [
        {"id": 1, "desc": "Delhi dry extreme heatwave, midday", "tdb": 46.0, "rh": 15.0, "wind": 2.5, "solar": 950.0},
        {"id": 2, "desc": "Chennai humid heat, midday", "tdb": 38.0, "rh": 78.0, "wind": 1.8, "solar": 850.0},
        {"id": 3, "desc": "Mumbai coastal humid, low wind", "tdb": 36.0, "rh": 85.0, "wind": 0.8, "solar": 700.0},
        {"id": 4, "desc": "Bengaluru moderate, cloudy", "tdb": 33.0, "rh": 55.0, "wind": 3.0, "solar": 400.0},
        {"id": 5, "desc": "Night-time, no solar (fallback path)", "tdb": 32.0, "rh": 60.0, "wind": 1.2, "solar": 0.0},
        {"id": 6, "desc": "Very low wind edge case", "tdb": 40.0, "rh": 50.0, "wind": 0.1, "solar": 800.0},
        {"id": 7, "desc": "High wind, dry", "tdb": 41.0, "rh": 20.0, "wind": 8.0, "solar": 900.0},
        {"id": 8, "desc": "RH boundary — near 100%", "tdb": 34.0, "rh": 98.0, "wind": 1.0, "solar": 500.0},
        {"id": 9, "desc": "RH boundary — near 0%", "tdb": 42.0, "rh": 3.0, "wind": 4.0, "solar": 900.0},
        {"id": 10, "desc": "Cool baseline (should land 'low' band)", "tdb": 24.0, "rh": 40.0, "wind": 3.0, "solar": 300.0},
        {"id": 11, "desc": "Just below 'moderate' threshold (WBGT≈24.9)", "tdb": 29.0, "rh": 35.0, "wind": 3.5, "solar": 400.0},
        {"id": 12, "desc": "Just above 'extreme' threshold (WBGT≥31)", "tdb": 44.0, "rh": 40.0, "wind": 1.5, "solar": 900.0},
    ]

    weather_results = []
    for r in rows:
        tdb = r["tdb"]
        rh = r["rh"]
        wind = r["wind"]
        solar = r["solar"]
        
        # 1. Globe temp
        if solar > 0:
            tg = _estimate_globe_temperature(tdb, wind, solar)
        else:
            tg = tdb  # fallback path in thermal_engine.py
            
        # Also compute direct solver if solar=0
        tg_direct_sol0 = _estimate_globe_temperature(tdb, wind, solar)
        
        # 2. HI
        hi_res = heat_index_lu(tdb=tdb, rh=rh, round_output=False)
        hi = float(hi_res.hi)
        
        # 3. Twb
        twb = float(wet_bulb_tmp(tdb=tdb, rh=rh))
        
        # 4. MRT
        if solar > 0:
            tr = float(mean_radiant_tmp(tg=tg, tdb=tdb, v=wind, d=0.15, emissivity=0.95, standard="ISO"))
        else:
            tr = tdb
            
        # 5. WBGT
        if solar > 0:
            wbgt_res = wbgt(twb=twb, tg=tg, tdb=tdb, with_solar_load=True, round_output=False)
        else:
            wbgt_res = wbgt(twb=twb, tg=tg, round_output=False)
        wbgt_val = float(wbgt_res.wbgt)
        
        # 6. UTCI
        utci_res = utci(tdb=tdb, tr=tr, v=wind, rh=rh, limit_inputs=False, round_output=False)
        utci_val = float(utci_res.utci)
        
        # 7. Risk
        score, band = _risk_from_indices(hi, wbgt_val, utci_val)
        
        # Reference checks
        noaa_hi = noaa_heat_index(tdb, rh)
        stull_twb = stull_wet_bulb(tdb, rh)
        wbgt_manual = (0.7 * twb + 0.2 * tg + 0.1 * tdb) if solar > 0 else (0.7 * twb + 0.3 * tg)
        
        weather_results.append({
            "id": r["id"],
            "desc": r["desc"],
            "tdb": tdb, "rh": rh, "wind": wind, "solar": solar,
            "tg": round(tg, 2),
            "tg_direct_sol0": round(tg_direct_sol0, 2),
            "hi": round(hi, 2),
            "noaa_hi": round(noaa_hi, 2),
            "twb": round(twb, 2),
            "stull_twb": round(stull_twb, 2),
            "mrt": round(tr, 2),
            "wbgt": round(wbgt_val, 2),
            "wbgt_manual": round(wbgt_manual, 2),
            "utci": round(utci_val, 2),
            "score_raw": round(score, 2),
            "band": band
        })
        
    print("=== WEATHER RESULTS ===")
    print(json.dumps(weather_results, indent=2))
    
    # Demographic test
    demo_rows = [
        {"id": "A", "elderly_pct": 0, "outdoor_worker_pct": 0, "slum_household_pct": 0, "green_cover_pct": 100},
        {"id": "B", "elderly_pct": 100, "outdoor_worker_pct": 100, "slum_household_pct": 100, "green_cover_pct": 0},
        {"id": "C", "elderly_pct": 18, "outdoor_worker_pct": 31, "slum_household_pct": 27, "green_cover_pct": 9},
        {"id": "D", "elderly_pct": 5, "outdoor_worker_pct": 5, "slum_household_pct": 5, "green_cover_pct": 60},
    ]
    thermal_score = 70.0
    demo_results = []
    for d in demo_rows:
        vuln = calculate_vulnerability_score(d)
        final_score, final_band = combine_risk(thermal_score, vuln)
        demo_results.append({
            "id": d["id"],
            "elderly": d["elderly_pct"],
            "outdoor": d["outdoor_worker_pct"],
            "slum": d["slum_household_pct"],
            "green": d["green_cover_pct"],
            "vulnerability_score": vuln,
            "final_score": final_score,
            "final_band": final_band,
            "boost": round(final_score - thermal_score, 2)
        })
    print("\n=== DEMOGRAPHICS RESULTS ===")
    print(json.dumps(demo_results, indent=2))

if __name__ == "__main__":
    evaluate_all()
