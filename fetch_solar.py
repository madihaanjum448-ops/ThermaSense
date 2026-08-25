"""
fetch_solar.py — pulls solar radiation from NASA POWER.

NASA POWER daily solar data can have a few days of latency.
This module searches backwards for the most recent available
value and returns both the value and the actual date used.
"""

import os
import httpx

from datetime import date, timedelta

from tenacity import retry, stop_after_attempt, wait_exponential


NASA_POWER_BASE_URL = os.environ.get(
    "NASA_POWER_BASE_URL",
    "https://power.larc.nasa.gov/api/temporal/daily/point",
)


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(
        multiplier=1,
        min=1,
        max=8,
    ),
)
def _get(url: str, params: dict) -> dict:
    """Make a NASA POWER API request with retry."""

    response = httpx.get(
        url,
        params=params,
        timeout=15.0,
    )

    response.raise_for_status()

    return response.json()


def _fetch_solar_for_date(
    lat: float,
    lon: float,
    target_date: date,
) -> float | None:
    """Fetch solar radiation for exactly one date."""

    date_str = target_date.strftime("%Y%m%d")

    params = {
        "parameters": "ALLSKY_SFC_SW_DWN",
        "community": "RE",
        "longitude": lon,
        "latitude": lat,
        "start": date_str,
        "end": date_str,
        "format": "JSON",
    }

    data = _get(
        NASA_POWER_BASE_URL,
        params,
    )

    try:
        values = data["properties"]["parameter"]["ALLSKY_SFC_SW_DWN"]

        if not values:
            return None

        daily_kwh_m2 = list(values.values())[0]

        if daily_kwh_m2 in (-999, None):
            return None

        avg_wm2 = (
            float(daily_kwh_m2) * 1000
        ) / 24

        return round(avg_wm2, 2)

    except (
        KeyError,
        IndexError,
        TypeError,
        ValueError,
    ):
        return None


def fetch_solar_radiation(
    lat: float,
    lon: float,
    target_date: date = None,
):
    """
    Find the most recent available NASA POWER solar value.

    Returns:
        {
            "value": <solar radiation in W/m²>,
            "date": <actual NASA POWER date>
        }

    Returns None if no usable value is found within 7 days.
    """

    if target_date is None:
        target_date = date.today() - timedelta(days=2)

    for days_back in range(0, 8):

        candidate_date = (
            target_date - timedelta(days=days_back)
        )

        value = _fetch_solar_for_date(
            lat,
            lon,
            candidate_date,
        )

        if value is not None:
            print(
                f"NASA POWER solar data found for "
                f"{candidate_date}: {value} W/m²"
            )

            return {
                "value": value,
                "date": candidate_date,
            }

    print(
        "NASA POWER: no usable solar data found "
        "within the previous 7 days."
    )

    return None


def fetch_solar_for_wards(
    wards: list[dict],
    target_date: date = None,
) -> dict:
    """
    Fetch solar radiation for multiple wards.

    Returns:

        {
            ward_id: {
                "value": ...,
                "date": ...
            }
        }
    """

    cache = {}
    results = {}

    for ward in wards:

        key = (
            round(
                float(ward["centroid_lat"]),
                2,
            ),
            round(
                float(ward["centroid_lon"]),
                2,
            ),
        )

        if key not in cache:
            cache[key] = fetch_solar_radiation(
                float(ward["centroid_lat"]),
                float(ward["centroid_lon"]),
                target_date,
            )

        results[ward["id"]] = cache[key]

    return results