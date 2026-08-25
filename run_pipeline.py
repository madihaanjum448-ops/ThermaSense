"""
run_pipeline.py — End-to-end Heatwave Early Warning pipeline.

Flow:
1. Get wards
2. Fetch current weather + hourly forecast from Open-Meteo
3. Store current weather
4. Store hourly forecast
5. Fetch latest available NASA POWER solar radiation
6. Store solar data
7. Calculate current thermal risk
8. Check and send current HIGH/EXTREME alerts
9. Calculate forecast thermal risk
10. Check and send upcoming HIGH/EXTREME forecast warning

Reliability:
- Each ward is processed independently.
- A failure for one ward does not stop the remaining wards.
"""

from datetime import date, timedelta, datetime, timezone, time

from db import get_wards, insert_weather_reading
from fetch_weather import fetch_with_fallback
from fetch_solar import fetch_solar_radiation
from thermal_engine import run_for_ward
from alert_engine import check_and_alert
from forecast_risk_engine import run_forecast_for_ward
from forecast_warning_dispatcher import (
    check_and_dispatch_forecast_warning,
)


def store_forecast(ward_id: int, forecast: list):
    """
    Store Open-Meteo hourly forecast records.

    Datetimes cannot be placed directly inside JSONB, so reading_time
    is converted to ISO format inside raw_payload.
    """

    stored = 0

    for item in forecast:
        reading_time = item["reading_time"]

        raw_forecast = dict(item)
        raw_forecast["reading_time"] = reading_time.isoformat()

        try:
            insert_weather_reading(
                ward_id,
                reading_time,
                "open-meteo",
                temp_c=item.get("temp_c"),
                humidity_pct=item.get("humidity_pct"),
                wind_speed_ms=item.get("wind_speed_ms"),
                is_forecast=True,
                raw_payload=raw_forecast,
            )

            stored += 1

        except Exception as exc:
            print(f"Forecast row skipped: {exc}")

    return stored


def process_ward(ward: dict):
    """
    Process one ward completely.

    Any exception raised here is caught by run_pipeline(), allowing
    the next ward to continue processing.
    """

    ward_id = ward["id"]
    name = ward["name"]

    lat = float(ward["centroid_lat"])
    lon = float(ward["centroid_lon"])

    print(f"\nProcessing ward {ward_id}: {name}")

    # ==========================================================
    # 1. Fetch current weather + forecast
    # ==========================================================

    weather = fetch_with_fallback(lat, lon)

    current = weather["current"]
    forecast = weather.get("forecast", [])

    print(
        f"Weather: "
        f"{current['temp_c']}°C, "
        f"{current['humidity_pct']}% humidity, "
        f"{current['wind_speed_ms']:.2f} m/s wind"
    )

    print(
        f"Weather source: "
        f"{weather.get('source', 'Open-Meteo')}"
    )

    # ==========================================================
    # 2. Store current weather
    # ==========================================================

    insert_weather_reading(
        ward_id,
        current["reading_time"],
        "open-meteo",
        temp_c=current["temp_c"],
        humidity_pct=current["humidity_pct"],
        wind_speed_ms=current["wind_speed_ms"],
        is_forecast=False,
        raw_payload=current.get("raw", {}),
    )

    print("Weather reading stored.")

    # ==========================================================
    # 3. Store hourly forecast
    # ==========================================================

    if forecast:
        stored_forecasts = store_forecast(
            ward_id,
            forecast,
        )

        print(
            f"Forecast hours fetched: "
            f"{len(forecast)}"
        )

        print(
            f"Forecast records stored: "
            f"{stored_forecasts}"
        )

    else:
        print("No forecast records available.")

    # ==========================================================
    # 4. Fetch latest available NASA POWER solar data
    # ==========================================================

    requested_solar_date = (
        date.today() - timedelta(days=2)
    )

    solar_result = fetch_solar_radiation(
        lat,
        lon,
        requested_solar_date,
    )

    if solar_result is not None:

        solar_value = solar_result["value"]
        solar_date = solar_result["date"]

        print(
            f"Solar radiation: "
            f"{solar_value} W/m²"
        )

        print(
            f"Solar data date: "
            f"{solar_date}"
        )

        # ======================================================
        # 5. Store solar data
        # ======================================================

        solar_time = datetime.combine(
            solar_date,
            time.min,
            tzinfo=timezone.utc,
        )

        insert_weather_reading(
            ward_id,
            solar_time,
            "nasa_power",
            solar_radiation_wm2=solar_value,
            is_forecast=False,
            raw_payload={
                "actual_date": solar_date.isoformat(),
                "requested_date": (
                    requested_solar_date.isoformat()
                ),
                "solar_radiation_wm2": solar_value,
                "source": "NASA POWER",
            },
        )

        print("Solar reading stored.")

    else:
        print(
            "No usable NASA POWER "
            "solar data found."
        )

    # ==========================================================
    # 6. Calculate current thermal risk
    # ==========================================================

    risk = run_for_ward(ward_id)

    print(
        f"Risk: "
        f"{risk['risk_band'].upper()} | "
        f"Score: {risk['risk_score_raw']} | "
        f"WBGT: {risk['wbgt_c']}°C | "
        f"UTCI: {risk['utci_c']}°C"
    )

    # ==========================================================
    # 7. Current HIGH / EXTREME alert
    # ==========================================================

    alert = check_and_alert(ward_id)

    if alert["alert_created"]:
        print(
            f"ALERT: "
            f"alert_id={alert['alert_id']}"
        )
    else:
        print(
            f"No alert: "
            f"{alert['reason']}"
        )

    # ==========================================================
    # 8. Calculate forecast thermal risk
    # ==========================================================

    if forecast:

        try:
            forecast_risks = run_forecast_for_ward(
                ward_id,
                limit=len(forecast),
            )

            print(
                f"Forecast risk rows processed: "
                f"{len(forecast_risks)}"
            )

            if forecast_risks:

                high_count = sum(
                    1
                    for item in forecast_risks
                    if item["risk_band"]
                    in ("high", "extreme")
                )

                print(
                    f"Upcoming HIGH/EXTREME "
                    f"forecast rows: "
                    f"{high_count}"
                )

        except Exception as exc:
            print(
                "Forecast risk calculation "
                f"failed: {exc}"
            )

    else:
        print(
            "Forecast risk skipped: "
            "no forecast data."
        )

    # ==========================================================
    # 9. Forecast early warning
    # ==========================================================

    try:

        forecast_warning = (
            check_and_dispatch_forecast_warning(
                ward_id
            )
        )

        if forecast_warning.get("warning"):

            if forecast_warning.get("sent"):

                print(
                    "FORECAST WARNING: "
                    f"alert_id="
                    f"{forecast_warning['alert_id']}"
                )

            elif (
                forecast_warning.get("reason")
                == "duplicate"
            ):

                print(
                    "Forecast warning already "
                    "sent for this forecast event."
                )

            else:

                print(
                    "Forecast warning detected "
                    "but not sent."
                )

        else:

            print(
                "No forecast warning: "
                f"{forecast_warning.get('reason')}"
            )

    except Exception as exc:

        print(
            "Forecast warning check "
            f"failed: {exc}"
        )

    print("-" * 60)


def run_pipeline():

    wards = get_wards()

    if not wards:
        print("No wards found in database.")
        return

    print(
        f"Found {len(wards)} ward(s)."
    )

    print("=" * 60)

    # Each ward gets its own failure boundary.
    # If Ward 1 fails, Ward 2 still gets processed.
    for ward in wards:

        try:
            process_ward(ward)

        except Exception as exc:

            print(
                f"\nWARD {ward['id']} FAILED: {exc}"
            )

            print(
                "Continuing with the next ward."
            )

            print("-" * 60)

    print(
        "\nPIPELINE COMPLETED SUCCESSFULLY"
    )


if __name__ == "__main__":
    run_pipeline()