import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import json
from datetime import datetime, timezone
import fetch_weather
import fetch_solar
import db
from thermal_engine import calculate_thermal_risk, save_risk_score

CITIES = [
    {"name": "Delhi", "city": "Delhi", "lat": 28.6139, "lon": 77.2090, "pop": 55000, "eld": 10.2, "out": 22.5, "slum": 18.0, "grn": 14.0, "mort": 6.2},
    {"name": "Chennai", "city": "Chennai", "lat": 13.0827, "lon": 80.2707, "pop": 48000, "eld": 11.5, "out": 28.0, "slum": 22.0, "grn": 10.0, "mort": 6.2},
    {"name": "Ahmedabad", "city": "Ahmedabad", "lat": 23.0225, "lon": 72.5714, "pop": 42000, "eld": 9.8, "out": 25.0, "slum": 16.0, "grn": 12.0, "mort": 6.2},
    {"name": "Mumbai", "city": "Mumbai", "lat": 19.0760, "lon": 72.8777, "pop": 62000, "eld": 8.5, "out": 30.0, "slum": 38.0, "grn": 8.0, "mort": 6.2},
    {"name": "Bengaluru", "city": "Bengaluru", "lat": 12.9716, "lon": 77.5946, "pop": 45000, "eld": 9.0, "out": 15.0, "slum": 8.0, "grn": 32.0, "mort": 6.2},
]

def run_live_pipeline():
    print("==========================================================================================================")
    print("LIVE REAL-WORLD WEATHER & MORTALITY RISK PIPELINE TEST (5 INDIAN CITIES)")
    print("Fetching real Open-Meteo current observations & NASA POWER solar radiation...")
    print("==========================================================================================================")

    results = []
    for c in CITIES:
        # 1. Ensure ward exists in DB with realistic demographics
        with db.engine.connect() as conn:
            from sqlalchemy import text
            row = conn.execute(text("SELECT id FROM wards WHERE name = :name AND city = :city"), {"name": c["name"], "city": c["city"]}).fetchone()
        
        if row:
            ward_id = row[0]
            with db.engine.begin() as conn:
                conn.execute(
                    text("""
                        UPDATE wards SET
                            centroid_lat = :lat, centroid_lon = :lon,
                            population = :pop, elderly_pct = :eld, outdoor_worker_pct = :out,
                            slum_household_pct = :slum, green_cover_pct = :grn,
                            baseline_mortality_rate = :mort
                        WHERE id = :ward_id
                    """),
                    {"ward_id": ward_id, "lat": c["lat"], "lon": c["lon"], "pop": c["pop"], "eld": c["eld"], "out": c["out"], "slum": c["slum"], "grn": c["grn"], "mort": c["mort"]}
                )
        else:
            ward_id = db.insert_ward(
                name=c["name"], city=c["city"], lat=c["lat"], lon=c["lon"],
                population=c["pop"], elderly_pct=c["eld"], outdoor_worker_pct=c["out"],
                slum_household_pct=c["slum"], green_cover_pct=c["grn"],
                baseline_mortality_rate=c["mort"]
            )

        # 2. Fetch live real weather
        w_data = fetch_weather.fetch_with_fallback(c["lat"], c["lon"])
        curr = w_data["current"]
        
        # 3. Fetch live solar
        solar_res = fetch_solar.fetch_solar_radiation(c["lat"], c["lon"])
        solar_val = solar_res["value"] if solar_res else None

        # 4. Insert reading into DB for calculate_thermal_risk()
        now_utc = datetime.now(timezone.utc)
        db.insert_weather_reading(
            ward_id=ward_id,
            reading_time=now_utc,
            source="open-meteo",
            temp_c=curr["temp_c"],
            humidity_pct=curr["humidity_pct"],
            wind_speed_ms=curr["wind_speed_ms"],
            solar_radiation_wm2=solar_val,
            is_forecast=False,
            raw_payload=w_data.get("raw")
        )

        if solar_val is not None:
            # Also store solar reading under source nasa_power for _latest_solar_for_ward
            db.insert_weather_reading(
                ward_id=ward_id,
                reading_time=now_utc,
                source="nasa_power",
                temp_c=curr["temp_c"],
                humidity_pct=curr["humidity_pct"],
                wind_speed_ms=curr["wind_speed_ms"],
                solar_radiation_wm2=solar_val,
                is_forecast=False
            )

        # 5. Call calculate_thermal_risk() as black-box entry point
        risk_result = calculate_thermal_risk(ward_id)
        save_risk_score(risk_result)

        results.append({
            "city": c["name"],
            "ward_id": ward_id,
            "temp_c": curr["temp_c"],
            "humidity_pct": curr["humidity_pct"],
            "wind_speed_ms": curr["wind_speed_ms"],
            "solar_wm2": solar_val,
            "heat_index_c": risk_result["heat_index_c"],
            "wbgt_c": risk_result["wbgt_c"],
            "utci_c": risk_result["utci_c"],
            "risk_band": risk_result["risk_band"],
            "final_risk_band": risk_result["final_risk_band"],
            "vulnerability_score": risk_result["vulnerability_score"],
            "relative_risk": risk_result["relative_risk"],
            "excess_mortality_pct": risk_result["excess_mortality_pct"],
            "predicted_excess_deaths_daily": risk_result["predicted_excess_deaths_daily"],
            "predicted_hospitalization_estimate": risk_result["predicted_hospitalization_estimate"],
            "mortality_risk_index": risk_result["mortality_risk_index"],
        })

        print(
            f"City: {c['name']:10s} | T={curr['temp_c']:4.1f}°C RH={curr['humidity_pct']:4.1f}% Wind={curr['wind_speed_ms']:3.1f}m/s Sol={solar_val or 0:5.1f}W/m² | "
            f"WBGT={risk_result['wbgt_c']:5.2f}°C UTCI={risk_result['utci_c']:5.2f}°C HI={risk_result['heat_index_c']:5.2f}°C | "
            f"Band={risk_result['final_risk_band']:8s} RR={risk_result['relative_risk']:.4f} (+{risk_result['excess_mortality_pct']:5.2f}%) | "
            f"ExcessDeaths/Day=+{risk_result['predicted_excess_deaths_daily']:5.3f} Hosp/Day=+{risk_result['predicted_hospitalization_estimate']:5.3f} | "
            f"MortIndex={risk_result['mortality_risk_index']:5.2f}"
        )

    print("\nJSON Summary:")
    print(json.dumps(results, indent=2))
    return results

if __name__ == "__main__":
    run_live_pipeline()
