"""
fetch_weather.py — Open-Meteo weather ingestion.

Provides:
- Current weather
- Hourly forecast
- WeatherAPI fallback if Open-Meteo is unavailable

The rest of the project receives a normalized format:
{
    "current": {...},
    "forecast": [...],
    "raw": {...}
}

Open-Meteo requires no API key.
"""

import os
from datetime import datetime, timezone

import httpx
from dotenv import load_dotenv
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
)


load_dotenv(override=True)


OPEN_METEO_URL = (
    "https://api.open-meteo.com/v1/forecast"
)


WEATHERAPI_KEY = os.environ.get(
    "WEATHERAPI_KEY"
)

WEATHERAPI_URL = (
    "https://api.weatherapi.com/v1/current.json"
)


class WeatherFetchError(Exception):
    """Raised when all weather providers fail."""

    pass


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(
        multiplier=1,
        min=1,
        max=8,
    ),
    retry=retry_if_exception_type(
        (
            httpx.RequestError,
            httpx.HTTPStatusError,
        )
    ),
)
def _get(
    url: str,
    params: dict,
) -> dict:
    """HTTP GET with retry and exponential backoff."""

    response = httpx.get(
        url,
        params=params,
        timeout=15.0,
    )

    response.raise_for_status()

    return response.json()


def _parse_iso_time(
    value: str,
) -> datetime:
    """Convert ISO timestamp to UTC datetime."""

    dt = datetime.fromisoformat(
        value.replace("Z", "+00:00")
    )

    if dt.tzinfo is None:
        dt = dt.replace(
            tzinfo=timezone.utc
        )

    return dt.astimezone(timezone.utc)


def fetch_open_meteo(
    lat: float,
    lon: float,
) -> dict:
    """
    Fetch current weather and hourly forecast
    from Open-Meteo.
    """

    params = {
        "latitude": lat,
        "longitude": lon,

        # Current conditions.
        "current": (
            "temperature_2m,"
            "relative_humidity_2m,"
            "wind_speed_10m,"
            "apparent_temperature,"
            "weather_code"
        ),

        # Hourly forecast.
        "hourly": (
            "temperature_2m,"
            "relative_humidity_2m,"
            "wind_speed_10m,"
            "apparent_temperature,"
            "precipitation_probability,"
            "precipitation,"
            "weather_code"
        ),

        # 7-day hourly forecast.
        "forecast_days": 7,

        # Return local timestamps for easier interpretation.
        "timezone": "auto",

        # We want wind in m/s internally.
        "wind_speed_unit": "ms",

        # Celsius.
        "temperature_unit": "celsius",
    }

    data = _get(
        OPEN_METEO_URL,
        params,
    )

    current = data["current"]

    normalized_current = {
        "reading_time": _parse_iso_time(
            current["time"]
        ),
        "temp_c": current.get(
            "temperature_2m"
        ),
        "humidity_pct": current.get(
            "relative_humidity_2m"
        ),
        "wind_speed_ms": current.get(
            "wind_speed_10m"
        ),
        "is_forecast": False,
        "raw": data,
    }

    hourly = data.get(
        "hourly",
        {}
    )

    times = hourly.get(
        "time",
        []
    )

    temperatures = hourly.get(
        "temperature_2m",
        []
    )

    humidities = hourly.get(
        "relative_humidity_2m",
        []
    )

    winds = hourly.get(
        "wind_speed_10m",
        []
    )

    apparent_temperatures = hourly.get(
        "apparent_temperature",
        []
    )

    rain_probabilities = hourly.get(
        "precipitation_probability",
        []
    )

    precipitation = hourly.get(
        "precipitation",
        []
    )

    weather_codes = hourly.get(
        "weather_code",
        []
    )

    normalized_forecast = []

    for i, timestamp in enumerate(times):

        normalized_forecast.append(
            {
                "reading_time": _parse_iso_time(
                    timestamp
                ),
                "temp_c": (
                    temperatures[i]
                    if i < len(temperatures)
                    else None
                ),
                "humidity_pct": (
                    humidities[i]
                    if i < len(humidities)
                    else None
                ),
                "wind_speed_ms": (
                    winds[i]
                    if i < len(winds)
                    else None
                ),
                "apparent_temperature_c": (
                    apparent_temperatures[i]
                    if i < len(apparent_temperatures)
                    else None
                ),
                "precipitation_probability_pct": (
                    rain_probabilities[i]
                    if i < len(rain_probabilities)
                    else None
                ),
                "precipitation_mm": (
                    precipitation[i]
                    if i < len(precipitation)
                    else None
                ),
                "weather_code": (
                    weather_codes[i]
                    if i < len(weather_codes)
                    else None
                ),
                "is_forecast": True,
            }
        )

    return {
        "current": normalized_current,
        "forecast": normalized_forecast,
        "raw": data,
    }


def fetch_fallback_current(
    lat: float,
    lon: float,
) -> dict | None:
    """
    WeatherAPI fallback for current conditions.

    Forecast fallback is intentionally not used yet.
    """

    if not WEATHERAPI_KEY:
        return None

    try:

        data = _get(
            WEATHERAPI_URL,
            {
                "key": WEATHERAPI_KEY,
                "q": f"{lat},{lon}",
            },
        )

        current = data["current"]

        return {
            "reading_time": datetime.now(
                timezone.utc
            ),
            "temp_c": current["temp_c"],
            "humidity_pct": current["humidity"],
            "wind_speed_ms": (
                current["wind_kph"] / 3.6
            ),
            "is_forecast": False,
            "raw": data,
        }

    except Exception:
        return None


def fetch_with_fallback(
    lat: float,
    lon: float,
) -> dict:
    """
    Fetch weather from Open-Meteo first.

    If Open-Meteo fails completely, fall back
    to WeatherAPI for current conditions.
    """

    try:

        result = fetch_open_meteo(
            lat,
            lon,
        )

        print(
            "Weather source: Open-Meteo"
        )

        print(
            f"Forecast hours fetched: "
            f"{len(result['forecast'])}"
        )

        return result

    except Exception as exc:

        print(
            f"Open-Meteo failed: {exc}"
        )

        fallback = fetch_fallback_current(
            lat,
            lon,
        )

        if fallback:

            print(
                "Weather source: WeatherAPI fallback"
            )

            return {
                "current": fallback,
                "forecast": [],
                "raw": fallback["raw"],
            }

        raise WeatherFetchError(
            "Both Open-Meteo and WeatherAPI "
            "weather providers failed."
        )