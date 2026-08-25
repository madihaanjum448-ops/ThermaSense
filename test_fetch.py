"""
test_fetch.py — Day 1 acceptance test for Pair A.

Run this against ONE sample ward to confirm the whole chain works:
    fetch OpenWeatherMap -> fetch NASA POWER -> insert into DB -> read back

Usage:
    python test_fetch.py                  # live mode (needs real API keys + DB)
    python test_fetch.py --mock           # mock mode (no keys/DB needed —
                                             use this to sanity-check the code
                                             structure before your keys/DB are ready)
"""

import sys
import argparse
from datetime import date, datetime, timezone

import db
import fetch_weather
import fetch_solar


SAMPLE_WARD = {
    "name": "Test Ward 1",
    "city": "Nagpur",     # swap for your actual chosen demo city
    "lat": 21.1458,
    "lon": 79.0882,
}


def run_mock():
    print("Running in MOCK mode — no live API calls, no live DB writes.\n")
    fake_weather = {
        "current": {
            "reading_time": datetime.now(timezone.utc),
            "temp_c": 41.2,
            "humidity_pct": 38,
            "wind_speed_ms": 2.1,
            "is_forecast": False,
        },
        "forecast": [
            {
                "reading_time": datetime.now(timezone.utc),
                "temp_c": 40.5 + i,
                "humidity_pct": 35 + i,
                "wind_speed_ms": 2.0,
                "is_forecast": True,
            }
            for i in range(5)
        ],
    }
    fake_solar = 620.5  # W/m^2, plausible peak-summer value

    print("Fetched (mock) current weather:", fake_weather["current"])
    print(f"Fetched (mock) {len(fake_weather['forecast'])}-day forecast")
    print("Fetched (mock) solar radiation:", fake_solar, "W/m^2")
    print("\nMOCK RUN OK — code structure is sound. Switch to live mode once "
          "your .env has real OPENWEATHERMAP_API_KEY and DATABASE_URL set.")


def run_live():
    print(f"Fetching live data for {SAMPLE_WARD['name']}, {SAMPLE_WARD['city']}...\n")

    # 1. Insert (or reuse) the sample ward
    existing = db.get_wards(city=SAMPLE_WARD["city"])
    ward_id = None
    for w in existing:
        if w["name"] == SAMPLE_WARD["name"]:
            ward_id = w["id"]
            break
    if ward_id is None:
        ward_id = db.insert_ward(
            name=SAMPLE_WARD["name"], city=SAMPLE_WARD["city"],
            lat=SAMPLE_WARD["lat"], lon=SAMPLE_WARD["lon"],
        )
    print(f"Using ward_id={ward_id}")

    # 2. Fetch weather (current + forecast), with automatic fallback
    weather = fetch_weather.fetch_with_fallback(SAMPLE_WARD["lat"], SAMPLE_WARD["lon"])
    print("Current weather:", weather["current"])
    print(f"Forecast days fetched: {len(weather['forecast'])}")

    # 3. Fetch solar radiation
    solar = fetch_solar.fetch_solar_radiation(SAMPLE_WARD["lat"], SAMPLE_WARD["lon"])
    print("Solar radiation (W/m^2):", solar)

    # 4. Insert current reading (OpenWeatherMap + NASA POWER merged)
    current = weather["current"]
    db.insert_weather_reading(
        ward_id=ward_id,
        reading_time=current["reading_time"],
        source="openweathermap",
        temp_c=current["temp_c"],
        humidity_pct=current["humidity_pct"],
        wind_speed_ms=current["wind_speed_ms"],
        solar_radiation_wm2=solar,
        is_forecast=False,
        raw_payload=weather.get("raw"),
    )

    # 5. Insert forecast readings
    for day in weather["forecast"]:
        db.insert_weather_reading(
            ward_id=ward_id,
            reading_time=day["reading_time"],
            source="openweathermap",
            temp_c=day["temp_c"],
            humidity_pct=day["humidity_pct"],
            wind_speed_ms=day["wind_speed_ms"],
            is_forecast=True,
        )

    # 6. Read back to confirm it actually landed
    latest = db.latest_reading(ward_id, source="openweathermap")
    print("\nRead back from DB:", latest)
    print("\nLIVE RUN OK — Day 1 acceptance test passed.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--mock", action="store_true", help="run without live API/DB access")
    args = parser.parse_args()

    if args.mock:
        run_mock()
    else:
        try:
            run_live()
        except Exception as e:
            print(f"\nLIVE RUN FAILED: {e}")
            print("Tip: run with --mock first to confirm code structure, "
                  "then check your .env keys and DB connection.")
            sys.exit(1)
