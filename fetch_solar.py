"""
fetch_solar.py — pulls solar radiation from NASA POWER.

NASA POWER daily solar data can have a few days of latency.
This module searches backwards for the most recent available
value and returns both the value and the actual date used.
"""

import os
import httpx

from datetime import date, datetime, timedelta, timezone

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


def estimate_realtime_solar(
    lat: float,
    lon: float,
    dt_utc: datetime = None,
    cloud_cover_pct: float = 0.0,
) -> dict:
    """
    Compute instantaneous real-time solar irradiance from astronomical solar position,
    clear-sky Haurwitz GHI, and live cloud-cover attenuation.

    Parameters
    ----------
    lat : float
        Latitude in decimal degrees.
    lon : float
        Longitude in decimal degrees.
    dt_utc : datetime, optional
        UTC timestamp. Defaults to datetime.now(timezone.utc).
    cloud_cover_pct : float, optional
        Cloud cover percentage (0-100%). Defaults to 0.0.

    Returns
    -------
    dict:
        {
            "effective_solar_wm2": float, # Attenuated GHI for live thermal derivation
            "clear_sky_ghi": float,       # Theoretical clear-sky GHI in W/m²
            "elevation_deg": float,       # Solar elevation angle in degrees
            "cossza": float,              # Cosine of solar zenith angle
            "is_daylight": bool,          # True if sun is above horizon
            "cloud_cover_pct": float,
        }
    """
    import math

    if dt_utc is None:
        dt_utc = datetime.now(timezone.utc)
    elif dt_utc.tzinfo is None:
        dt_utc = dt_utc.replace(tzinfo=timezone.utc)
    else:
        dt_utc = dt_utc.astimezone(timezone.utc)

    n = dt_utc.timetuple().tm_yday
    gamma = 2.0 * math.pi / 365.0 * (n - 1.0 + (dt_utc.hour - 12.0) / 24.0)

    # NOAA Equation of Time (minutes)
    eqtime = 229.18 * (
        0.000075
        + 0.001868 * math.cos(gamma)
        - 0.032077 * math.sin(gamma)
        - 0.014615 * math.cos(2 * gamma)
        - 0.040849 * math.sin(2 * gamma)
    )

    # Solar Declination (radians)
    decl = (
        0.006918
        - 0.399912 * math.cos(gamma)
        + 0.070257 * math.sin(gamma)
        - 0.006758 * math.cos(2 * gamma)
        + 0.000907 * math.sin(2 * gamma)
        - 0.002697 * math.cos(3 * gamma)
        + 0.00148 * math.sin(3 * gamma)
    )

    time_offset = eqtime + 4.0 * float(lon)
    tst = dt_utc.hour * 60.0 + dt_utc.minute + dt_utc.second / 60.0 + time_offset
    ha_rad = math.radians((tst / 4.0) - 180.0)
    lat_rad = math.radians(float(lat))

    cossza = math.sin(lat_rad) * math.sin(decl) + math.cos(lat_rad) * math.cos(decl) * math.cos(ha_rad)
    cossza = max(-1.0, min(1.0, cossza))
    elevation_deg = math.degrees(math.asin(cossza))

    if cossza <= 0.0:
        return {
            "effective_solar_wm2": 0.0,
            "clear_sky_ghi": 0.0,
            "elevation_deg": round(elevation_deg, 2),
            "cossza": round(cossza, 4),
            "is_daylight": False,
            "cloud_cover_pct": float(cloud_cover_pct or 0.0),
        }

    # Haurwitz clear-sky global horizontal irradiance (W/m²)
    clear_sky_ghi = max(0.0, 1098.0 * cossza * math.exp(-0.057 / cossza))

    # Attenuate with current cloud cover: effective = clear_sky * (1 - 0.75 * cloud_fraction)
    c_frac = max(0.0, min(1.0, float(cloud_cover_pct or 0.0) / 100.0))
    effective_solar = clear_sky_ghi * (1.0 - 0.75 * c_frac)

    return {
        "effective_solar_wm2": round(effective_solar, 2),
        "clear_sky_ghi": round(clear_sky_ghi, 2),
        "elevation_deg": round(elevation_deg, 2),
        "cossza": round(cossza, 4),
        "is_daylight": True,
        "cloud_cover_pct": float(cloud_cover_pct or 0.0),
    }