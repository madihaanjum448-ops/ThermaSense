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
from db import engine, latest_reading, get_ward_demographics
from risk_scoring import calculate_vulnerability_score, combine_risk
from db import engine, get_ward_demographics
from risk_scoring import calculate_vulnerability_score, combine_risk


import math
from datetime import datetime, timezone

from sqlalchemy import text

from db import engine, latest_reading
from backend.app.derivation import derive_thermal_inputs

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
        # Liljegren (2008): h_forced = 6.3 * v^0.6 / D^0.4. The D^0.4 term was
        # previously omitted, which understated forced-convection cooling.
        h_forced = 6.3 * (v ** 0.6) / (GLOBE_DIAMETER_M ** 0.4)
        h = max(h_free, h_forced)

        conv = h * (tg_k - ta_k)
        rad = EMISSIVITY * SIGMA * (tg_k**4 - sky_k**4)
        # Divide by 4: a sphere's projected (sun-facing) area is 1/4 of its
        # total surface area, so the absorbed flux must be averaged over the
        # full radiating surface, not applied at full intensity. Previously
        # missing, which inflated absorbed solar load by 4x.
        absorbed = SOLAR_ABSORPTIVITY * max(float(solar_wm2), 0.0) / 4.0

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
        # Retrieve coordinates from database for the Liljegren solver
        with engine.connect() as conn:
            ward_row = conn.execute(
                text("SELECT centroid_lat, centroid_lon FROM wards WHERE id = :ward_id"),
                {"ward_id": ward_id}
            ).fetchone()
        if not ward_row:
            raise ValueError(f"Ward {ward_id} not found in database")
        lat = float(ward_row._mapping["centroid_lat"])
        lon = float(ward_row._mapping["centroid_lon"])

        # Call the validated Liljegren derivation (which uses calibrated ground albedo 0.15)
        derived = derive_thermal_inputs(
            temp_c=tdb,
            humidity=rh,
            wind_ms=wind,
            solar_rad=solar,
            timestamp=reading["reading_time"].isoformat(),
            latitude=lat,
            longitude=lon
        )
        twb_natural = derived["twb_natural"]
        globe_c = derived["tg"]
        tr_c = derived["tr"]

        wbgt_result = wbgt(
            twb=twb_natural,
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
    demographics = get_ward_demographics(ward_id)
    vulnerability_score = calculate_vulnerability_score(demographics) if demographics else 0.0
    final_score, final_band = combine_risk(score, vulnerability_score)

    demographics = get_ward_demographics(ward_id)
    vulnerability_score = calculate_vulnerability_score(demographics) if demographics else 0.0
    final_score, final_band = combine_risk(score, vulnerability_score)

    return {
        "ward_id": ward_id,
        "score_time": reading["reading_time"],
        "is_forecast": bool(reading["is_forecast"]),
        "heat_index_c": round(heat_index_c, 2),
        "wbgt_c": round(wbgt_c, 2),
        "utci_c": round(utci_c, 2),
        "risk_score_raw": score,
        "risk_band": band,
        "risk_score_raw": score,
        "risk_band": band,
        "risk_score_raw": score,
        "risk_band": band,
        "vulnerability_score": vulnerability_score,
        "final_risk_score": final_score,
        "final_risk_band": final_band,
        "vulnerability_score": vulnerability_score,
        "final_risk_score": final_score,
        "final_risk_band": final_band,
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
                     utci_c, risk_band, risk_score_raw, vulnerability_score,
                     final_risk_score, final_risk_band, computed_at)
                VALUES
                    (:ward_id, :score_time, :is_forecast, :heat_index_c, :wbgt_c,
                     :utci_c, :risk_band, :risk_score_raw, :vulnerability_score,
                     :final_risk_score, :final_risk_band, :computed_at)
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