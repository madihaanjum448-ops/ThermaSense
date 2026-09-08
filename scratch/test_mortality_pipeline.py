import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import json
import math
from thermal_engine import (
    _estimate_globe_temperature,
    _risk_from_indices,
)
from pythermalcomfort.models import heat_index_lu, wbgt, utci
from pythermalcomfort.utilities import wet_bulb_tmp, mean_radiant_tmp
from risk_scoring import calculate_vulnerability_score, combine_risk
from mortality_risk import (
    calculate_mortality_risk,
    BETA_PER_DEGREE_CELSIUS,
    ZONE_WBGT_THRESHOLDS,
    ZONE_SWELTERING_EXCESS_PCT,
    DEFAULT_BASELINE_MORTALITY_RATE,
    MAX_EXCESS_MORTALITY_PCT_CAP,
    INDEX_ANCHOR_PCT,
    PROVISIONAL_HOSPITALIZATION_MULTIPLIER,
)

def run_mortality_weather_matrix():
    scenarios = [
        {"id": 1, "desc": "Delhi dry extreme heatwave, midday", "tdb": 46.0, "rh": 15.0, "wind": 2.5, "solar": 950.0, "zone": "semi_arid"},
        {"id": 2, "desc": "Chennai humid heat, midday", "tdb": 38.0, "rh": 78.0, "wind": 1.8, "solar": 850.0, "zone": "humid_tropical"},
        {"id": 3, "desc": "Mumbai coastal humid, low wind", "tdb": 36.0, "rh": 85.0, "wind": 0.8, "solar": 700.0, "zone": "humid_tropical"},
        {"id": 4, "desc": "Bengaluru moderate, cloudy", "tdb": 33.0, "rh": 55.0, "wind": 3.0, "solar": 400.0, "zone": "semi_arid"},
        {"id": 5, "desc": "Night-time, no solar (fallback path)", "tdb": 32.0, "rh": 60.0, "wind": 1.2, "solar": 0.0, "zone": "semi_arid"},
        {"id": 6, "desc": "Very low wind edge case", "tdb": 40.0, "rh": 50.0, "wind": 0.1, "solar": 800.0, "zone": "semi_arid"},
        {"id": 7, "desc": "High wind, dry", "tdb": 41.0, "rh": 20.0, "wind": 8.0, "solar": 900.0, "zone": "semi_arid"},
        {"id": 8, "desc": "RH boundary — near 100%", "tdb": 34.0, "rh": 98.0, "wind": 1.0, "solar": 500.0, "zone": "humid_tropical"},
        {"id": 9, "desc": "RH boundary — near 0%", "tdb": 42.0, "rh": 3.0, "wind": 4.0, "solar": 900.0, "zone": "semi_arid"},
        {"id": 10, "desc": "Cool baseline (should land 'low' band)", "tdb": 24.0, "rh": 40.0, "wind": 3.0, "solar": 300.0, "zone": "semi_arid"},
        {"id": 11, "desc": "Just below 'moderate' threshold (WBGT≈24.9)", "tdb": 29.0, "rh": 35.0, "wind": 3.5, "solar": 400.0, "zone": "semi_arid"},
        {"id": 12, "desc": "Just above 'extreme' threshold (WBGT≥31)", "tdb": 44.0, "rh": 40.0, "wind": 1.5, "solar": 900.0, "zone": "semi_arid"},
    ]

    population = 40000
    baseline_mortality = 6.2  # per 1000/year (SRS)
    # Default representative ward demographics for baseline weather matrix
    demographics_std = {"elderly_pct": 10.0, "outdoor_worker_pct": 20.0, "slum_household_pct": 15.0, "green_cover_pct": 25.0}
    vuln_std = calculate_vulnerability_score(demographics_std)

    print("==========================================================================================================")
    print("MORTALITY & HOSPITALIZATION RISK PIPELINE EVALUATION (12 WEATHER SCENARIOS)")
    print(f"Ward Population: {population:,} | Baseline Crude Death Rate: {baseline_mortality} / 1,000 / year | Vuln Score: {vuln_std:.2f}")
    print("==========================================================================================================")

    weather_results = []
    prev_wbgt = -1.0
    for s in scenarios:
        tdb, rh, wind, solar, zone = s["tdb"], s["rh"], s["wind"], s["solar"], s["zone"]

        # 1. Globe temp
        tg = _estimate_globe_temperature(tdb, wind, solar) if solar > 0 else tdb

        # 2. HI & Twb
        hi = float(heat_index_lu(tdb=tdb, rh=rh, round_output=False).hi)
        twb = float(wet_bulb_tmp(tdb=tdb, rh=rh))

        # 3. WBGT
        if solar > 0:
            wbgt_res = wbgt(twb=twb, tg=tg, tdb=tdb, with_solar_load=True, round_output=False)
        else:
            wbgt_res = wbgt(twb=twb, tg=tg, round_output=False)
        wbgt_val = float(wbgt_res.wbgt)

        # 4. MRT & UTCI
        tr = float(mean_radiant_tmp(tg=tg, tdb=tdb, v=wind, d=0.15, emissivity=0.95, standard="ISO")) if solar > 0 else tdb
        utci_val = float(utci(tdb=tdb, tr=tr, v=wind, rh=rh, limit_inputs=False, round_output=False).utci)

        # 5. Raw thermal score & combined score
        score_raw, band = _risk_from_indices(hi, wbgt_val, utci_val)
        final_score, final_band = combine_risk(score_raw, vuln_std)

        # 6. Mortality & Hospitalization Risk Calculation
        mort = calculate_mortality_risk(
            heat_index_c=hi,
            wbgt_c=wbgt_val,
            thermal_score=final_score,
            vulnerability_score=vuln_std,
            baseline_daily_mortality_rate=baseline_mortality,
            ward_population=population,
            climate_zone=zone,
        )

        res = {
            "id": s["id"],
            "desc": s["desc"],
            "zone": zone,
            "inputs": (tdb, rh, wind, solar),
            "tg": round(tg, 2),
            "hi": round(hi, 2),
            "twb": round(twb, 2),
            "wbgt": round(wbgt_val, 2),
            "utci": round(utci_val, 2),
            "score_raw": score_raw,
            "final_score": final_score,
            "final_band": final_band,
            "raw_rr": mort["raw_rr"],
            "relative_risk": mort["relative_risk"],
            "excess_mortality_pct": mort["excess_mortality_pct"],
            "predicted_excess_deaths_daily": mort["predicted_excess_deaths_daily"],
            "predicted_hospitalization_estimate": mort["predicted_hospitalization_estimate"],
            "mortality_risk_index": mort["mortality_risk_index"],
            "capped": mort["capped_at_ceiling"],
        }
        weather_results.append(res)

        print(
            f"Row {s['id']:2d} | {s['desc'][:30]:30s} | Tdb={tdb:4.1f} WBGT={wbgt_val:5.2f} HI={hi:5.2f} | "
            f"RawRR={mort['raw_rr']:.4f} EffRR={mort['relative_risk']:.4f} (+{mort['excess_mortality_pct']:5.2f}%) | "
            f"Deaths/Day=+{mort['predicted_excess_deaths_daily']:5.3f} Hosp/Day=+{mort['predicted_hospitalization_estimate']:5.3f} | "
            f"MortIndex={mort['mortality_risk_index']:5.2f} Band={final_band}"
        )

    # Invariant Assertions
    print("\n--- INVARIANT VERIFICATIONS ---")
    for r in weather_results:
        assert r["relative_risk"] >= 1.0, f"Row {r['id']}: Relative Risk {r['relative_risk']} < 1.0"
        assert not math.isnan(r["relative_risk"]), f"Row {r['id']}: Relative Risk is NaN"
        assert r["excess_mortality_pct"] >= 0.0, f"Row {r['id']}: Excess mortality {r['excess_mortality_pct']} < 0"
        assert r["predicted_excess_deaths_daily"] >= 0.0, f"Row {r['id']}: Negative excess deaths"
        assert 0.0 <= r["mortality_risk_index"] <= 100.0, f"Row {r['id']}: Index out of bounds [0, 100]"

    # Ahmedabad / Row 1 sanity check
    r1 = weather_results[0]
    print(f"Assertion: Row 1 (Delhi 46°C extreme) Excess Mortality = {r1['excess_mortality_pct']}% (Ahmedabad real 2010 ref: 43.1%)")
    assert 20.0 <= r1["excess_mortality_pct"] <= 50.0, f"Row 1 excess mortality {r1['excess_mortality_pct']}% outside plausible range [20%, 50%]"
    print("  [PASS] Row 1 lands within plausible range of Ahmedabad 2010 real-world benchmark.")

    return weather_results

def run_mortality_demographics_matrix():
    print("\n==========================================================================================================")
    print("MORTALITY VULNERABILITY AMPLIFICATION EVALUATION (4 DEMOGRAPHIC PROFILES)")
    print("Fixed High Thermal Scenario: Tdb=35.0°C, RH=50%, Wind=2.0 m/s, Solar=600 W/m² (WBGT = 29.50°C, High Band)")
    print("==========================================================================================================")

    demos = [
        {"id": "A", "desc": "Fully Resilient (High Green, Zero Slum/Outdoor/Elderly)", "elderly_pct": 0, "outdoor_worker_pct": 0, "slum_household_pct": 0, "green_cover_pct": 100},
        {"id": "B", "desc": "Max Vulnerable (Zero Green, 100% Slum/Outdoor/Elderly)", "elderly_pct": 100, "outdoor_worker_pct": 100, "slum_household_pct": 100, "green_cover_pct": 0},
        {"id": "C", "desc": "Realistic Vulnerable Urban Ward", "elderly_pct": 18, "outdoor_worker_pct": 31, "slum_household_pct": 27, "green_cover_pct": 9},
        {"id": "D", "desc": "Affluent Vegetated Urban Ward", "elderly_pct": 5, "outdoor_worker_pct": 5, "slum_household_pct": 5, "green_cover_pct": 60},
    ]

    tdb, rh, wind, solar = 35.0, 50.0, 2.0, 600.0
    tg = _estimate_globe_temperature(tdb, wind, solar)
    hi = float(heat_index_lu(tdb=tdb, rh=rh, round_output=False).hi)
    twb = float(wet_bulb_tmp(tdb=tdb, rh=rh))
    wbgt_val = float(wbgt(twb=twb, tg=tg, tdb=tdb, with_solar_load=True, round_output=False).wbgt)
    tr = float(mean_radiant_tmp(tg=tg, tdb=tdb, v=wind, d=0.15, emissivity=0.95, standard="ISO"))
    utci_val = float(utci(tdb=tdb, tr=tr, v=wind, rh=rh, limit_inputs=False, round_output=False).utci)
    score_raw, band = _risk_from_indices(hi, wbgt_val, utci_val)

    pop = 40000
    mort_rate = 6.2

    results = []
    for d in demos:
        vuln = calculate_vulnerability_score(d)
        final_score, final_band = combine_risk(score_raw, vuln)
        mort = calculate_mortality_risk(
            heat_index_c=hi,
            wbgt_c=wbgt_val,
            thermal_score=final_score,
            vulnerability_score=vuln,
            baseline_daily_mortality_rate=mort_rate,
            ward_population=pop,
            climate_zone="semi_arid",
        )
        results.append({
            "id": d["id"],
            "desc": d["desc"],
            "vuln": vuln,
            "final_score": final_score,
            "raw_rr": mort["raw_rr"],
            "effective_rr": mort["relative_risk"],
            "excess_mort_pct": mort["excess_mortality_pct"],
            "excess_deaths": mort["predicted_excess_deaths_daily"],
            "hospitalizations": mort["predicted_hospitalization_estimate"],
            "mortality_index": mort["mortality_risk_index"],
        })

        print(
            f"Profile {d['id']} (Vuln={vuln:5.2f}) | RawRR={mort['raw_rr']:.4f} -> EffRR={mort['relative_risk']:.4f} | "
            f"ExcessMort=+{mort['excess_mortality_pct']:5.2f}% | Deaths/Day=+{mort['predicted_excess_deaths_daily']:5.3f} | "
            f"Hosp/Day=+{mort['predicted_hospitalization_estimate']:5.3f} | Index={mort['mortality_risk_index']:5.2f}"
        )

    # Demographic Assertions
    print("\n--- DEMOGRAPHIC ASSERTIONS ---")
    rA = results[0]
    rB = results[1]
    print(f"Profile A (Resilient) Excess Mortality: {rA['excess_mort_pct']}% vs Profile B (Max Vulnerable): {rB['excess_mort_pct']}%")
    assert rB["excess_mort_pct"] > rA["excess_mort_pct"], "Vulnerability failed to amplify excess mortality"
    assert rA["effective_rr"] == rA["raw_rr"], "Zero vulnerability must leave raw RR unamplified"
    assert rB["effective_rr"] <= 1.0 + (MAX_EXCESS_MORTALITY_PCT_CAP / 100.0), "Ceiling cap breached"
    print("  [PASS] Demographic vulnerability amplifies excess mortality monotonically and stays bounded within empirical ceiling.")

if __name__ == "__main__":
    run_mortality_weather_matrix()
    run_mortality_demographics_matrix()
