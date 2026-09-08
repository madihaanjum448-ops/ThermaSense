"""
test_mortality_pipeline.py — End-to-end black-box validation of the live
ThermaSense thermal & mortality risk pipeline.

Calls calculate_thermal_risk() directly as a single black-box entry point,
matching the exact way the FastAPI endpoints (/wards/geojson, /wards/{id}/forecast)
execute. Does NOT reimplement WBGT, globe temperature, or heat index manually.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import json
import math
from datetime import datetime, timezone
from sqlalchemy import text

import db
from thermal_engine import calculate_thermal_risk, save_risk_score

def run_blackbox_weather_matrix():
    print("==========================================================================================================")
    print("BLACK-BOX LIVE PIPELINE VALIDATION (12 WEATHER SCENARIOS)")
    print("Invoking calculate_thermal_risk() end-to-end for every scenario...")
    print("==========================================================================================================")

    scenarios = [
        {"id": 1, "desc": "Delhi dry extreme heatwave, midday", "tdb": 46.0, "rh": 15.0, "wind": 2.5, "solar": 950.0, "city": "Delhi", "lat": 28.6139, "lon": 77.2090},
        {"id": 2, "desc": "Chennai humid heat, midday", "tdb": 38.0, "rh": 78.0, "wind": 1.8, "solar": 850.0, "city": "Chennai", "lat": 13.0827, "lon": 80.2707},
        {"id": 3, "desc": "Mumbai coastal humid, low wind", "tdb": 36.0, "rh": 85.0, "wind": 0.8, "solar": 700.0, "city": "Mumbai", "lat": 19.0760, "lon": 72.8777},
        {"id": 4, "desc": "Bengaluru moderate, cloudy", "tdb": 33.0, "rh": 55.0, "wind": 3.0, "solar": 400.0, "city": "Bengaluru", "lat": 12.9716, "lon": 77.5946},
        {"id": 5, "desc": "Night-time, no solar (fallback path)", "tdb": 32.0, "rh": 60.0, "wind": 1.2, "solar": 0.0, "city": "Delhi", "lat": 28.6139, "lon": 77.2090},
        {"id": 6, "desc": "Very low wind edge case", "tdb": 40.0, "rh": 50.0, "wind": 0.1, "solar": 800.0, "city": "Nagpur", "lat": 21.1458, "lon": 79.0882},
        {"id": 7, "desc": "High wind, dry", "tdb": 41.0, "rh": 20.0, "wind": 8.0, "solar": 900.0, "city": "Jodhpur", "lat": 26.2389, "lon": 73.0243},
        {"id": 8, "desc": "RH boundary — near 100%", "tdb": 34.0, "rh": 98.0, "wind": 1.0, "solar": 500.0, "city": "Kochi", "lat": 9.9312, "lon": 76.2673},
        {"id": 9, "desc": "RH boundary — near 0%", "tdb": 42.0, "rh": 3.0, "wind": 4.0, "solar": 900.0, "city": "Bikaner", "lat": 28.0229, "lon": 73.3119},
        {"id": 10, "desc": "Cool baseline (should land 'low' band)", "tdb": 24.0, "rh": 40.0, "wind": 3.0, "solar": 300.0, "city": "Shimla", "lat": 31.1048, "lon": 77.1734},
        {"id": 11, "desc": "Just below 'moderate' threshold (WBGT≈24.9)", "tdb": 29.0, "rh": 35.0, "wind": 3.5, "solar": 400.0, "city": "Pune", "lat": 18.5204, "lon": 73.8567},
        {"id": 12, "desc": "Just above 'extreme' threshold (WBGT≥31)", "tdb": 44.0, "rh": 40.0, "wind": 1.5, "solar": 900.0, "city": "Ahmedabad", "lat": 23.0225, "lon": 72.5714},
    ]

    population = 40000
    baseline_mortality = 6.20

    # Ensure test ward exists in DB
    ward_name = "Blackbox Test Ward"
    with db.engine.connect() as conn:
        row = conn.execute(text("SELECT id FROM wards WHERE name = :name"), {"name": ward_name}).fetchone()
    
    if row:
        test_ward_id = row[0]
    else:
        test_ward_id = db.insert_ward(
            name=ward_name, city="Delhi", lat=28.6139, lon=77.2090,
            population=population, elderly_pct=10.0, outdoor_worker_pct=20.0,
            slum_household_pct=15.0, green_cover_pct=25.0,
            baseline_mortality_rate=baseline_mortality
        )

    results = []
    now_utc = datetime(2026, 5, 15, 12, 0, 0, tzinfo=timezone.utc) # noon summer timestamp

    for s in scenarios:
        # Update ward city / coords for appropriate solar geometry & climate zone
        with db.engine.begin() as conn:
            conn.execute(
                text("""
                    UPDATE wards SET
                        city = :city, centroid_lat = :lat, centroid_lon = :lon,
                        population = :pop, elderly_pct = 10.0, outdoor_worker_pct = 20.0,
                        slum_household_pct = 15.0, green_cover_pct = 25.0,
                        baseline_mortality_rate = :mort
                    WHERE id = :ward_id
                """),
                {"ward_id": test_ward_id, "city": s["city"], "lat": s["lat"], "lon": s["lon"], "pop": population, "mort": baseline_mortality}
            )

        # Clear old readings and insert scenario reading
        with db.engine.begin() as conn:
            conn.execute(text("DELETE FROM weather_readings WHERE ward_id = :w"), {"w": test_ward_id})
            
            # Insert main reading
            conn.execute(
                text("""
                    INSERT INTO weather_readings
                        (ward_id, reading_time, fetched_at, is_forecast, temp_c, humidity_pct, wind_speed_ms, solar_radiation_wm2, source)
                    VALUES
                        (:ward_id, :time, :time, FALSE, :temp, :rh, :wind, :solar, 'open-meteo')
                """),
                {"ward_id": test_ward_id, "time": now_utc, "temp": s["tdb"], "rh": s["rh"], "wind": s["wind"], "solar": s["solar"]}
            )

            # Insert NASA POWER reading if solar > 0
            if s["solar"] > 0:
                conn.execute(
                    text("""
                        INSERT INTO weather_readings
                            (ward_id, reading_time, fetched_at, is_forecast, temp_c, humidity_pct, wind_speed_ms, solar_radiation_wm2, source)
                        VALUES
                            (:ward_id, :time, :time, FALSE, :temp, :rh, :wind, :solar, 'nasa_power')
                    """),
                    {"ward_id": test_ward_id, "time": now_utc, "temp": s["tdb"], "rh": s["rh"], "wind": s["wind"], "solar": s["solar"]}
                )

        # CALL PURE LIVE PIPELINE
        res = calculate_thermal_risk(test_ward_id)
        save_risk_score(res)

        results.append({
            "id": s["id"],
            "desc": s["desc"],
            "city": s["city"],
            "tdb": s["tdb"],
            "rh": s["rh"],
            "wind": s["wind"],
            "solar": s["solar"],
            "tg": res["estimated_globe_temperature_c"],
            "mrt": res["mean_radiant_temperature_c"],
            "hi": res["heat_index_c"],
            "wbgt": res["wbgt_c"],
            "utci": res["utci_c"],
            "raw_score": res["risk_score_raw"],
            "final_score": res["final_risk_score"],
            "final_band": res["final_risk_band"],
            "relative_risk": res["relative_risk"],
            "excess_mortality_pct": res["excess_mortality_pct"],
            "predicted_excess_deaths": res["predicted_excess_deaths_daily"],
            "predicted_hospitalizations": res["predicted_hospitalization_estimate"],
            "mortality_index": res["mortality_risk_index"],
        })

        print(
            f"Row {s['id']:2d} | {s['desc'][:30]:30s} | Tdb={s['tdb']:4.1f}°C WBGT={res['wbgt_c']:5.2f}°C UTCI={res['utci_c']:5.2f}°C | "
            f"Band={res['final_risk_band']:8s} RR={res['relative_risk']:.4f} (+{res['excess_mortality_pct']:5.2f}%) | "
            f"Deaths/Day=+{res['predicted_excess_deaths_daily']:5.3f} Hosp/Day=+{res['predicted_hospitalization_estimate']:5.3f} | "
            f"MortIndex={res['mortality_risk_index']:5.2f}"
        )

    # Invariant assertions
    for r in results:
        assert r["relative_risk"] >= 1.0, f"Row {r['id']}: Relative risk {r['relative_risk']} < 1.0"
        assert not math.isnan(r["relative_risk"]), f"Row {r['id']}: NaN in relative risk"
        assert r["excess_mortality_pct"] >= 0.0, f"Row {r['id']}: Negative excess mortality"
        assert 0.0 <= r["mortality_index"] <= 100.0, f"Row {r['id']}: Index out of bounds [0, 100]"

    print("\nALL 12 BLACK-BOX LIVE PIPELINE WEATHER SCENARIOS PASSED INVARIANT VERIFICATIONS.")
    return results

if __name__ == "__main__":
    run_blackbox_weather_matrix()
