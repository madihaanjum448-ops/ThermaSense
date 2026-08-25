"""
thermal_engine.py — Pair B thermal stress engine.

Reads the latest weather data from the existing db.py layer and computes:
- Heat Index (HI)
- estimated outdoor WBGT
- UTCI
- normalized risk score
- risk band

Important:
WBGT and UTCI normally require radiant-temperature information. Our database
does not contain a measured globe temperature, so when solar radiation is
available this module estimates globe temperature from a simple energy-balance
model and then derives mean radiant temperature. When solar radiation is
missing, it uses air temperature as the radiant-temperature fallback and marks
the calculation accordingly.

The underlying HI/WBGT/UTCI calculations are delegated to pythermalcomfort,
rather than reimplementing the published thermal-stress algorithms.
"""

from __future__ import annotations

import math
from datetime import datetime, timezone

from sqlalchemy import text

from db import engine, latest_reading

try:
    from pythermalcomfort.models import heat_index_lu, wbgt, utci
    from pythermalcomfort.utilities import wet_bulb_tmp, mean_radiant_tmp
except ImportError as exc:
    raise ImportError(
        "pythermalcomfort is required. Install it with: "
        "pip install pythermalcomfort"
    ) from exc


SIGMA = 5.670374419e-8
EMISSIVITY = 0.95
GLOBE_DIAMETER_M = 0.15
SOLAR_ABSORPTIVITY = 0.70


def _finite(value: float | None) -> bool:
    return value is not None and math.isfinite(float(value))


def _estimate_globe_temperature(
    tdb_c: float,
    wind_speed_ms: float,
    solar_wm2: float,
) -> float:
    """
    Estimate black-globe temperature from an approximate steady-state
    radiation/convection energy balance.

    This is an engineering proxy because the system does not yet have a
    measured globe-temperature sensor. It is deliberately kept separate from
    the ISO WBGT calculation itself.
    """
    v = max(float(wind_speed_ms), 0.1)
    ta_k = float(tdb_c) + 273.15

    # Approximate effective sky temperature. This is a proxy, not a measured
    # sky temperature, and is used only to turn solar radiation into an
    # estimated globe temperature.
    sky_k = ta_k - 6.0

    def residual(tg_k: float) -> float:
        delta = abs(tg_k - ta_k)
        # Forced/free convection envelope commonly used for globe-temperature
        # engineering estimates.
        h_free = 1.4 * ((delta / GLOBE_DIAMETER_M) ** 0.25) if delta > 0 else 0.0
        h_forced = 6.3 * (v ** 0.6)
        h = max(h_free, h_forced)

        conv = h * (tg_k - ta_k)
        rad = EMISSIVITY * SIGMA * (tg_k**4 - sky_k**4)
        absorbed = SOLAR_ABSORPTIVITY * max(float(solar_wm2), 0.0)

        return rad + conv - absorbed

    # Bisection over a physically reasonable globe-temperature range.
    lo = ta_k - 20.0
    hi = ta_k + 80.0

    # Expand if the initial bracket does not contain the root.
    for _ in range(10):
        if residual(lo) * residual(hi) <= 0:
            break
        lo -= 20.0
        hi += 20.0

    if residual(lo) * residual(hi) > 0:
        return float(tdb_c)

    for _ in range(80):
        mid = (lo + hi) / 2.0
        r = residual(mid)
        if abs(r) < 1e-4:
            return mid - 273.15
        if residual(lo) * r <= 0:
            hi = mid
        else:
            lo = mid

    return ((lo + hi) / 2.0) - 273.15


def _latest_solar_for_ward(ward_id: int):
    """Return the latest NASA POWER solar value, if one exists."""
    with engine.connect() as conn:
        row = conn.execute(
            text(
                """
                SELECT reading_time, solar_radiation_wm2
                FROM weather_readings
                WHERE ward_id = :ward_id
                  AND source = 'nasa_power'
                  AND solar_radiation_wm2 IS NOT NULL
                ORDER BY reading_time DESC
                LIMIT 1
                """
            ),
            {"ward_id": ward_id},
        ).fetchone()

    if not row:
        return None, None

    return row._mapping["reading_time"], float(row._mapping["solar_radiation_wm2"])


def _risk_from_indices(heat_index_c: float, wbgt_c: float, utci_c: float):
    """
    Screening score for the application.

    The score is deliberately transparent rather than pretending to be a
    medical diagnosis. WBGT/UTCI are the primary thermal-stress signals.
    """
    wbgt_component = max(0.0, min(100.0, (wbgt_c - 22.0) / 10.0 * 100.0))
    utci_component = max(0.0, min(100.0, (utci_c - 20.0) / 20.0 * 100.0))
    hi_component = max(0.0, min(100.0, (heat_index_c - 26.0) / 29.0 * 100.0))

    score = round(
        0.50 * wbgt_component
        + 0.35 * utci_component
        + 0.15 * hi_component,
        3,
    )

    # Conservative screening band: the worst of the principal indices can
    # promote the overall band.
    if wbgt_c >= 31.0 or utci_c >= 38.0 or score >= 80:
        band = "extreme"
    elif wbgt_c >= 28.0 or utci_c >= 32.0 or score >= 60:
        band = "high"
    elif wbgt_c >= 25.0 or utci_c >= 26.0 or score >= 35:
        band = "moderate"
    else:
        band = "low"

    return score, band


def calculate_thermal_risk(ward_id: int) -> dict:
    """Calculate thermal metrics for the latest stored observation."""
    reading = latest_reading(ward_id)

    if not reading:
        raise ValueError(f"No current weather reading found for ward {ward_id}")

    tdb = float(reading["temp_c"])
    rh = max(0.0, min(100.0, float(reading["humidity_pct"])))
    wind = max(0.1, float(reading["wind_speed_ms"]))

    if not (_finite(tdb) and _finite(rh) and _finite(wind)):
        raise ValueError("Temperature, humidity and wind are required")

    # Lu & Romps heat index is designed to have a wider applicability range
    # than the older Rothfusz implementation.
    hi_result = heat_index_lu(tdb=tdb, rh=rh, round_output=False)
    heat_index_c = float(hi_result.hi)

    # Natural wet-bulb temperature used by the WBGT calculation.
    twb = float(wet_bulb_tmp(tdb=tdb, rh=rh))

    solar_time, solar = _latest_solar_for_ward(ward_id)

    if _finite(solar):
        globe_c = _estimate_globe_temperature(tdb, wind, solar)
        tr_c = float(
            mean_radiant_tmp(
                tg=globe_c,
                tdb=tdb,
                v=wind,
                d=GLOBE_DIAMETER_M,
                emissivity=EMISSIVITY,
                standard="ISO",
            )
        )
        wbgt_result = wbgt(
            twb=twb,
            tg=globe_c,
            tdb=tdb,
            with_solar_load=True,
            round_output=False,
        )
        solar_used = float(solar)
        solar_source_time = solar_time
    else:
        globe_c = tdb
        tr_c = tdb
        wbgt_result = wbgt(
            twb=twb,
            tg=globe_c,
            round_output=False,
        )
        solar_used = None
        solar_source_time = None

    wbgt_c = float(wbgt_result.wbgt)

    # UTCI expects outdoor air temperature, mean radiant temperature, wind
    # speed and RH. The library applies the published UTCI model.
    utci_result = utci(
        tdb=tdb,
        tr=tr_c,
        v=wind,
        rh=rh,
        limit_inputs=False,
        round_output=False,
    )
    utci_c = float(utci_result.utci)

    score, band = _risk_from_indices(heat_index_c, wbgt_c, utci_c)

    return {
        "ward_id": ward_id,
        "score_time": reading["reading_time"],
        "is_forecast": bool(reading["is_forecast"]),
        "heat_index_c": round(heat_index_c, 2),
        "wbgt_c": round(wbgt_c, 2),
        "utci_c": round(utci_c, 2),
        "risk_score_raw": score,
        "risk_band": band,
        "solar_radiation_wm2_used": solar_used,
        "solar_source_time": solar_source_time,
        "estimated_globe_temperature_c": round(globe_c, 2),
        "mean_radiant_temperature_c": round(tr_c, 2),
        "solar_note": (
            "Solar radiation used to estimate globe/MRT."
            if solar_used is not None
            else "No stored NASA POWER solar value; radiant temperature "
                 "fell back to air temperature."
        ),
    }


def save_risk_score(result: dict) -> None:
    """Insert the computed result into the existing risk_scores table."""
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                INSERT INTO risk_scores
                    (ward_id, score_time, is_forecast, heat_index_c, wbgt_c,
                     utci_c, risk_band, risk_score_raw, computed_at)
                VALUES
                    (:ward_id, :score_time, :is_forecast, :heat_index_c, :wbgt_c,
                     :utci_c, :risk_band, :risk_score_raw, :computed_at)
                """
            ),
            {
                **result,
                "computed_at": datetime.now(timezone.utc),
            },
        )


def run_for_ward(ward_id: int) -> dict:
    """Calculate and persist the thermal risk for one ward."""
    result = calculate_thermal_risk(ward_id)
    save_risk_score(result)
    return result