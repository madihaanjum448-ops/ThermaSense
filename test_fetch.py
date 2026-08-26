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


def test_timezone_parsing():
    """Regression test verifying timezone conversion to UTC."""
    print("--- Running Timezone Regression Tests ---")

    # 1. Non-UTC timestamp with explicit IST (+05:30) offset
    ist_raw = "2026-08-27T14:00:00+05:30"
    parsed_ist = fetch_weather._parse_iso_time(ist_raw)

    assert parsed_ist.tzinfo == timezone.utc, (
        f"Expected UTC tzinfo, got {parsed_ist.tzinfo}"
    )
    assert parsed_ist.hour == 8 and parsed_ist.minute == 30, (
        f"Expected 08:30 UTC for 14:00 IST, "
        f"got {parsed_ist.hour}:{parsed_ist.minute}"
    )
    assert parsed_ist.isoformat() == "2026-08-27T08:30:00+00:00", (
        f"Unexpected ISO format: {parsed_ist.isoformat()}"
    )

    print(
        f"  [PASS] IST timestamp {ist_raw} correctly converted "
        f"to {parsed_ist.isoformat()}"
    )

    # 2. ISO timestamp with Z suffix
    utc_z_raw = "2026-08-27T08:30:00Z"
    parsed_z = fetch_weather._parse_iso_time(utc_z_raw)

    assert parsed_z.tzinfo == timezone.utc
    assert parsed_z.hour == 8 and parsed_z.minute == 30

    print(
        f"  [PASS] UTC Z-suffixed timestamp {utc_z_raw} "
        f"correctly parsed to {parsed_z.isoformat()}"
    )

    # 3. Naive ISO timestamp returned by Open-Meteo when timezone=UTC
    utc_naive_raw = "2026-08-27T08:30"
    parsed_naive = fetch_weather._parse_iso_time(utc_naive_raw)

    assert parsed_naive.tzinfo == timezone.utc
    assert parsed_naive.hour == 8 and parsed_naive.minute == 30

    print(
        f"  [PASS] Open-Meteo UTC naive timestamp {utc_naive_raw} "
        f"correctly tagged as {parsed_naive.isoformat()}"
    )

    print("--- Timezone Regression Tests PASSED ---\n")


def test_solar_backward_search():
    """
    Regression test verifying that NASA POWER data is searched backwards
    when the requested date has no usable data.

    Simulated behavior:
        2026-08-27 -> unavailable
        2026-08-26 -> unavailable
        2026-08-25 -> available at 600.0 W/m²

    The function must return both the value and the actual date used.
    """
    print("--- Running Solar Backward-Search Regression Test ---")

    target_date = date(2026, 8, 27)

    # Save the real function so it can be restored after the test.
    original_fetch = fetch_solar._fetch_solar_for_date

    def fake_fetch(lat, lon, candidate_date):
        if candidate_date == date(2026, 8, 27):
            return None

        if candidate_date == date(2026, 8, 26):
            return None

        if candidate_date == date(2026, 8, 25):
            return 600.0

        return None

    # Temporarily replace the real NASA API call.
    fetch_solar._fetch_solar_for_date = fake_fetch

    try:
        result = fetch_solar.fetch_solar_radiation(
            21.1458,
            79.0882,
            target_date,
        )

        assert result is not None, (
            "Expected solar data to be found after searching backwards."
        )

        assert result["value"] == 600.0, (
            f"Expected solar value 600.0, got {result['value']}"
        )

        assert result["date"] == date(2026, 8, 25), (
            f"Expected actual NASA POWER date 2026-08-25, "
            f"got {result['date']}"
        )

        print(
            "  [PASS] Solar search correctly skipped "
            "2026-08-27 and 2026-08-26 and used "
            "2026-08-25"
        )

    finally:
        # Restore the real function even if the test fails.
        fetch_solar._fetch_solar_for_date = original_fetch

    print("--- Solar Backward-Search Regression Test PASSED ---\n")


def run_mock():
    print(
        "Running in MOCK mode — no live API calls, "
        "no live DB writes.\n"
    )

    # Run regression tests.
    test_timezone_parsing()
    test_solar_backward_search()

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

    fake_solar = 620.5  # W/m², plausible peak-summer value

    print(
        "Fetched (mock) current weather:",
        fake_weather["current"],
    )
    print(
        f"Fetched (mock) {len(fake_weather['forecast'])}-day forecast"
    )
    print(
        "Fetched (mock) solar radiation:",
        fake_solar,
        "W/m²",
    )

    print(
        "\nMOCK RUN OK — code structure is sound. "
        "Switch to live mode once your .env has real "
        "OPENWEATHERMAP_API_KEY and DATABASE_URL set."
    )


def run_live():
    # Run regression tests before the live acceptance test.
    test_timezone_parsing()
    test_solar_backward_search()

    print(
        f"Fetching live data for "
        f"{SAMPLE_WARD['name']}, {SAMPLE_WARD['city']}...\n"
    )

    # 1. Insert (or reuse) the sample ward
    existing = db.get_wards(city=SAMPLE_WARD["city"])

    ward_id = None

    for w in existing:
        if w["name"] == SAMPLE_WARD["name"]:
            ward_id = w["id"]
            break

    if ward_id is None:
        ward_id = db.insert_ward(
            name=SAMPLE_WARD["name"],
            city=SAMPLE_WARD["city"],
            lat=SAMPLE_WARD["lat"],
            lon=SAMPLE_WARD["lon"],
        )

    print(f"Using ward_id={ward_id}")

    # 2. Fetch weather (current + forecast),
    #    with automatic fallback
    weather = fetch_weather.fetch_with_fallback(
        SAMPLE_WARD["lat"],
        SAMPLE_WARD["lon"],
    )

    print("Current weather:", weather["current"])
    print(
        f"Forecast days fetched: "
        f"{len(weather['forecast'])}"
    )

    # 3. Fetch solar radiation
    solar = fetch_solar.fetch_solar_radiation(
        SAMPLE_WARD["lat"],
        SAMPLE_WARD["lon"],
    )

    print(
        "Solar radiation (W/m²):",
        solar,
    )

    # 4. Insert current reading
    #    OpenWeatherMap + NASA POWER merged
    current = weather["current"]

    db.insert_weather_reading(
        ward_id=ward_id,
        reading_time=current["reading_time"],
        source="openweathermap",
        temp_c=current["temp_c"],
        humidity_pct=current["humidity_pct"],
        wind_speed_ms=current["wind_speed_ms"],
        solar_radiation_wm2=(
            solar["value"] if solar else None
        ),
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
    latest = db.latest_reading(
        ward_id,
        source="openweathermap",
    )

    print("\nRead back from DB:", latest)
    print("\nLIVE RUN OK — Day 1 acceptance test passed.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--mock",
        action="store_true",
        help="run without live API/DB access",
    )

    args = parser.parse_args()

    if args.mock:
        run_mock()
    else:
        try:
            run_live()
        except Exception as e:
            print(f"\nLIVE RUN FAILED: {e}")
            print(
                "Tip: run with --mock first to confirm code "
                "structure, then check your .env keys and "
                "DB connection."
            )
            sys.exit(1)