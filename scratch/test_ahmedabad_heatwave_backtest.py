import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import json
from datetime import datetime, timezone
import db
from thermal_engine import calculate_thermal_risk, save_risk_score

def run_backtest_with_contrast():
    print("==========================================================================================================")
    print("HISTORICAL HEATWAVE BACKTEST (AHMEDABAD MAY 2010) WITH LIVE CALM CONTROL DAY (BENGALURU)")
    print("Reference Recorded Benchmark: 43.1% Excess All-Cause Mortality (95% CI: 34.3% - 52.6%, 1,344 excess deaths)")
    print("==========================================================================================================")

    # Scenarios: 3 Ahmedabad Heatwave rows (14:00 IST = 08:30 UTC) + 1 Bengaluru Live Calm Control Day
    SCENARIOS = [
        {
            "row_type": "ahmedabad",
            "scenario": "Peak Day (May 21, 2010, 14:00 IST)",
            "city": "Ahmedabad",
            "lat": 23.0225,
            "lon": 72.5714,
            "pop": 42000,
            "eld": 9.8,
            "out": 25.0,
            "slum": 16.0,
            "grn": 12.0,
            "mort": 6.20,
            "temp_c": 46.8,
            "humidity_pct": 20.0,
            "wind_speed_ms": 2.5,
            "solar_wm2": 920.0,
            "timestamp": datetime(2010, 5, 21, 8, 30, tzinfo=timezone.utc),
            "notes": "Absolute peak temperature recorded in Ahmedabad during the May 2010 heatwave (Azhar et al. 2014)"
        },
        {
            "row_type": "ahmedabad",
            "scenario": "Multi-Day Severe High (May 20-23 Avg)",
            "city": "Ahmedabad",
            "lat": 23.0225,
            "lon": 72.5714,
            "pop": 42000,
            "eld": 9.8,
            "out": 25.0,
            "slum": 16.0,
            "grn": 12.0,
            "mort": 6.20,
            "temp_c": 45.5,
            "humidity_pct": 22.0,
            "wind_speed_ms": 2.2,
            "solar_wm2": 900.0,
            "timestamp": datetime(2010, 5, 22, 8, 30, tzinfo=timezone.utc),
            "notes": "Severe daytime peak sustained over 4 days of extreme heat (Tmax > 45°C)"
        },
        {
            "row_type": "ahmedabad",
            "scenario": "Weekly Heatwave Mean (May 20-27 Avg)",
            "city": "Ahmedabad",
            "lat": 23.0225,
            "lon": 72.5714,
            "pop": 42000,
            "eld": 9.8,
            "out": 25.0,
            "slum": 16.0,
            "grn": 12.0,
            "mort": 6.20,
            "temp_c": 44.5,
            "humidity_pct": 24.0,
            "wind_speed_ms": 2.0,
            "solar_wm2": 880.0,
            "timestamp": datetime(2010, 5, 24, 8, 30, tzinfo=timezone.utc),
            "notes": "Average daily maximum temperature across the entire 7-day heatwave period (Azhar et al. 2014)"
        },
        {
            "row_type": "control",
            "scenario": "Calm Control Day (Bengaluru, live)",
            "city": "Bengaluru",
            "lat": 12.9716,
            "lon": 77.5946,
            "pop": 45000,
            "eld": 9.0,
            "out": 15.0,
            "slum": 8.0,
            "grn": 32.0,
            "mort": 6.20,
            "temp_c": 31.9,
            "humidity_pct": 31.0,
            "wind_speed_ms": 3.91,
            "solar_wm2": 263.02,
            "timestamp": datetime.now(timezone.utc),
            "notes": "Live observation from Bengaluru with 88% cloud cover and moderate thermal stress"
        }
    ]

    results = []
    for sc in SCENARIOS:
        ward_name = f"{sc['city']}-Validation-Ward"
        with db.engine.connect() as conn:
            from sqlalchemy import text
            row = conn.execute(text("SELECT id FROM wards WHERE name = :name AND city = :city"), {"name": ward_name, "city": sc["city"]}).fetchone()

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
                    {"ward_id": ward_id, "lat": sc["lat"], "lon": sc["lon"], "pop": sc["pop"], "eld": sc["eld"], "out": sc["out"], "slum": sc["slum"], "grn": sc["grn"], "mort": sc["mort"]}
                )
        else:
            ward_id = db.insert_ward(
                name=ward_name, city=sc["city"], lat=sc["lat"], lon=sc["lon"],
                population=sc["pop"], elderly_pct=sc["eld"], outdoor_worker_pct=sc["out"],
                slum_household_pct=sc["slum"], green_cover_pct=sc["grn"],
                baseline_mortality_rate=sc["mort"]
            )

        # Clear previous readings for this ward
        with db.engine.begin() as conn:
            from sqlalchemy import text
            conn.execute(text("DELETE FROM weather_readings WHERE ward_id = :ward_id"), {"ward_id": ward_id})

        # Insert scenario weather reading
        db.insert_weather_reading(
            ward_id=ward_id,
            reading_time=sc["timestamp"],
            source="backtest_validation",
            temp_c=sc["temp_c"],
            humidity_pct=sc["humidity_pct"],
            wind_speed_ms=sc["wind_speed_ms"],
            solar_radiation_wm2=sc["solar_wm2"],
            is_forecast=False,
            raw_payload={"notes": sc["notes"]}
        )

        # Black-box pipeline call
        risk_result = calculate_thermal_risk(ward_id)
        save_risk_score(risk_result)

        results.append({
            "scenario": sc["scenario"],
            "city": sc["city"],
            "temp_c": sc["temp_c"],
            "humidity_pct": sc["humidity_pct"],
            "wind_speed_ms": sc["wind_speed_ms"],
            "solar_wm2": sc["solar_wm2"],
            "heat_index_c": risk_result["heat_index_c"],
            "wbgt_c": risk_result["wbgt_c"],
            "tg_c": risk_result["estimated_globe_temperature_c"],
            "tr_c": risk_result["mean_radiant_temperature_c"],
            "utci_c": risk_result["utci_c"],
            "thermal_score": risk_result["risk_score_raw"],
            "risk_band": risk_result["risk_band"],
            "vulnerability_score": risk_result["vulnerability_score"],
            "final_risk_score": risk_result["final_risk_score"],
            "final_risk_band": risk_result["final_risk_band"],
            "relative_risk": risk_result["relative_risk"],
            "model_excess_mortality_pct": risk_result["excess_mortality_pct"],
            "recorded_excess_mortality_pct": 43.1 if sc["row_type"] == "ahmedabad" else 0.0,
            "predicted_excess_deaths_daily": risk_result["predicted_excess_deaths_daily"],
            "predicted_hospitalization_estimate": risk_result["predicted_hospitalization_estimate"],
            "mortality_risk_index": risk_result["mortality_risk_index"],
            "notes": sc["notes"]
        })

        print(
            f"Scenario: {sc['scenario'][:36]:36s} | T={sc['temp_c']:4.1f}C RH={sc['humidity_pct']:4.1f}% Wind={sc['wind_speed_ms']:3.1f}m/s Sol={sc['solar_wm2']:5.1f}W/m2 | "
            f"Tg={risk_result['estimated_globe_temperature_c']:4.1f}C WBGT={risk_result['wbgt_c']:5.2f}C UTCI={risk_result['utci_c']:5.2f}C HI={risk_result['heat_index_c']:5.2f}C | "
            f"Band={risk_result['final_risk_band'].upper():8s} | "
            f"RR={risk_result['relative_risk']:.4f} (+{risk_result['excess_mortality_pct']:5.2f}%) | "
            f"ExcessDeaths/Day=+{risk_result['predicted_excess_deaths_daily']:5.3f} | "
            f"MortIndex={risk_result['mortality_risk_index']:5.2f}"
        )

    print("\n--- RESULTS JSON ---")
    print(json.dumps(results, indent=2))
    return results

if __name__ == "__main__":
    run_backtest_with_contrast()
