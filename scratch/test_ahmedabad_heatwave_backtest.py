import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import json
from datetime import datetime, timezone, timedelta
import db
from thermal_engine import calculate_thermal_risk, save_risk_score

def run_ahmedabad_backtest():
    print("==========================================================================================================")
    print("HISTORICAL HEATWAVE BACKTEST: AHMEDABAD MAY 2010 (Azhar et al. 2014, PLOS ONE)")
    print("Reference Recorded Benchmark: 43.1% Excess All-Cause Mortality (95% CI: 34.3% - 52.6%, 1,344 excess deaths)")
    print("==========================================================================================================")

    # Scenarios from Azhar et al. 2014 (14:00 IST = 08:30 UTC peak solar zenith)
    SCENARIOS = [
        {
            "scenario": "Peak Day (May 21, 2010, 14:00 IST)",
            "temp_c": 46.8,
            "humidity_pct": 20.0,
            "wind_speed_ms": 2.5,
            "solar_wm2": 920.0,
            "timestamp": datetime(2010, 5, 21, 8, 30, tzinfo=timezone.utc),
            "notes": "Absolute peak temperature recorded in Ahmedabad during the May 2010 heatwave (Azhar et al. 2014)"
        },
        {
            "scenario": "Heatwave Multi-Day Severe High (May 20-23 Average)",
            "temp_c": 45.5,
            "humidity_pct": 22.0,
            "wind_speed_ms": 2.2,
            "solar_wm2": 900.0,
            "timestamp": datetime(2010, 5, 22, 8, 30, tzinfo=timezone.utc),
            "notes": "Severe daytime peak sustained over 4 days of extreme heat (Tmax > 45°C)"
        },
        {
            "scenario": "Heatwave Weekly Average Tmax (May 20-27)",
            "temp_c": 44.5,
            "humidity_pct": 24.0,
            "wind_speed_ms": 2.0,
            "solar_wm2": 880.0,
            "timestamp": datetime(2010, 5, 24, 8, 30, tzinfo=timezone.utc),
            "notes": "Average daily maximum temperature across the entire 7-day heatwave period (Azhar et al. 2014)"
        },
        {
            "scenario": "Pre-Heatwave Normal Reference (Baseline)",
            "temp_c": 36.0,
            "humidity_pct": 35.0,
            "wind_speed_ms": 3.0,
            "solar_wm2": 800.0,
            "timestamp": datetime(2010, 5, 10, 8, 30, tzinfo=timezone.utc),
            "notes": "Typical early May summer day prior to the extreme heatwave event"
        }
    ]

    # Setup Ahmedabad ward with representative demographics
    ward_name = "Ahmedabad-Central (Historical 2010)"
    city_name = "Ahmedabad"
    lat = 23.0225
    lon = 72.5714
    population = 42000
    elderly_pct = 9.8
    outdoor_worker_pct = 25.0
    slum_household_pct = 16.0
    green_cover_pct = 12.0
    baseline_mortality_rate = 6.20 # SRS national urban crude death rate (per 1000/year)

    with db.engine.connect() as conn:
        from sqlalchemy import text
        row = conn.execute(text("SELECT id FROM wards WHERE name = :name AND city = :city"), {"name": ward_name, "city": city_name}).fetchone()

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
                {"ward_id": ward_id, "lat": lat, "lon": lon, "pop": population, "eld": elderly_pct, "out": outdoor_worker_pct, "slum": slum_household_pct, "grn": green_cover_pct, "mort": baseline_mortality_rate}
            )
    else:
        ward_id = db.insert_ward(
            name=ward_name, city=city_name, lat=lat, lon=lon,
            population=population, elderly_pct=elderly_pct, outdoor_worker_pct=outdoor_worker_pct,
            slum_household_pct=slum_household_pct, green_cover_pct=green_cover_pct,
            baseline_mortality_rate=baseline_mortality_rate
        )

    results = []
    for sc in SCENARIOS:
        # Clear previous readings for this ward so latest_reading selects this exact scenario
        with db.engine.begin() as conn:
            from sqlalchemy import text
            conn.execute(text("DELETE FROM weather_readings WHERE ward_id = :ward_id"), {"ward_id": ward_id})

        # Insert historical weather reading into DB
        db.insert_weather_reading(
            ward_id=ward_id,
            reading_time=sc["timestamp"],
            source="historical_azhar_2014",
            temp_c=sc["temp_c"],
            humidity_pct=sc["humidity_pct"],
            wind_speed_ms=sc["wind_speed_ms"],
            solar_radiation_wm2=sc["solar_wm2"],
            is_forecast=False,
            raw_payload={"notes": sc["notes"], "citation": "Azhar et al. 2014, PLOS ONE"}
        )

        # Call live pipeline calculate_thermal_risk() as black-box entry point
        risk_result = calculate_thermal_risk(ward_id)
        save_risk_score(risk_result)

        results.append({
            "scenario": sc["scenario"],
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
            "recorded_excess_mortality_pct": 43.1 if "Heatwave" in sc["scenario"] or "Peak" in sc["scenario"] else 0.0,
            "predicted_excess_deaths_daily": risk_result["predicted_excess_deaths_daily"],
            "predicted_hospitalization_estimate": risk_result["predicted_hospitalization_estimate"],
            "mortality_risk_index": risk_result["mortality_risk_index"],
            "notes": sc["notes"]
        })

        print(
            f"Scenario: {sc['scenario'][:40]:40s} | T={sc['temp_c']:4.1f}C RH={sc['humidity_pct']:4.1f}% Wind={sc['wind_speed_ms']:3.1f}m/s Sol={sc['solar_wm2']:5.1f}W/m2 | "
            f"Tg={risk_result['estimated_globe_temperature_c']:4.1f}C WBGT={risk_result['wbgt_c']:5.2f}C UTCI={risk_result['utci_c']:5.2f}C HI={risk_result['heat_index_c']:5.2f}C | "
            f"Band={risk_result['final_risk_band'].upper():7s} (Score={risk_result['final_risk_score']:5.1f}) | "
            f"Model_ExcessMort=+{risk_result['excess_mortality_pct']:5.2f}% (Actual Recorded=43.1%) | "
            f"ExcessDeaths/Day=+{risk_result['predicted_excess_deaths_daily']:5.3f} | MortIndex={risk_result['mortality_risk_index']:5.2f}"
        )

    print("\n--- AHMEDABAD BACKTEST JSON ---")
    print(json.dumps(results, indent=2))
    return results

if __name__ == "__main__":
    run_ahmedabad_backtest()
