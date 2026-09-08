"""
forecast_risk_engine.py

Forecast thermal-risk engine.

Calculates future thermal risk from Open-Meteo forecast weather readings.

Important:
- Current risk continues to use thermal_engine.py.
- Forecast risk is calculated separately.
- Forecast rows are identified by is_forecast = TRUE.
- Future NASA POWER radiation is not available, so forecast MRT is
  conservatively approximated from air temperature.
- Results are stored in risk_scores with is_forecast = TRUE.
- Existing forecast risk rows are UPDATED rather than deleted/reinserted.
  This keeps the risk_scores.id stable across scheduler runs.
"""

from __future__ import annotations

import math
from datetime import datetime, timezone

from sqlalchemy import text
from db import engine, get_ward_demographics
from risk_scoring import calculate_vulnerability_score, combine_risk
from mortality_risk import calculate_mortality_risk

from pythermalcomfort.models import (
    heat_index_lu,
    wbgt,
    utci,
)

from pythermalcomfort.utilities import (
    wet_bulb_tmp,
)


def _finite(value):
    """Return True when a value is a finite number."""

    return (
        value is not None
        and math.isfinite(float(value))
    )


def _detect_climate_zone(city: str | None) -> str:
    """Infer climate zone from city name, defaulting to semi_arid."""
    if not city:
        return "semi_arid"
    c = str(city).lower().strip()
    if any(k in c for k in ["chennai", "mumbai", "kochi", "coastal"]):
        return "humid_tropical"
    if any(k in c for k in ["varanasi", "lucknow", "patna", "kanpur", "gangetic"]):
        return "humid_subtropical"
    return "semi_arid"


def _risk_from_indices(
    heat_index_c: float,
    wbgt_c: float,
    utci_c: float,
):
    """
    Same transparent screening score used by the current-risk engine.

    This keeps current and forecast risk bands consistent.
    """

    wbgt_component = max(
        0.0,
        min(
            100.0,
            (wbgt_c - 22.0)
            / 10.0
            * 100.0,
        ),
    )

    utci_component = max(
        0.0,
        min(
            100.0,
            (utci_c - 20.0)
            / 20.0
            * 100.0,
        ),
    )

    hi_component = max(
        0.0,
        min(
            100.0,
            (heat_index_c - 26.0)
            / 29.0
            * 100.0,
        ),
    )

    score = round(
        0.50 * wbgt_component
        + 0.35 * utci_component
        + 0.15 * hi_component,
        3,
    )

    if (
        wbgt_c >= 31.0
        or utci_c >= 38.0
        or score >= 80
    ):
        band = "extreme"

    elif (
        wbgt_c >= 28.0
        or utci_c >= 32.0
        or score >= 60
    ):
        band = "high"

    elif (
        wbgt_c >= 25.0
        or utci_c >= 26.0
        or score >= 35
    ):
        band = "moderate"

    else:
        band = "low"

    return score, band


def get_forecast_rows(
    ward_id: int,
    limit: int = 168,
):
    """
    Get future Open-Meteo forecast rows for a ward.

    Only rows with:
        is_forecast = TRUE
        source = open-meteo

    are considered.
    """

    with engine.connect() as conn:

        rows = conn.execute(
            text(
                """
                SELECT
                    id,
                    ward_id,
                    reading_time,
                    temp_c,
                    humidity_pct,
                    wind_speed_ms,
                    source,
                    is_forecast
                FROM weather_readings
                WHERE ward_id = :ward_id
                  AND is_forecast = TRUE
                  AND source = 'open-meteo'
                  AND reading_time > now()
                ORDER BY reading_time ASC
                LIMIT :limit
                """
            ),
            {
                "ward_id": ward_id,
                "limit": limit,
            },
        ).fetchall()

    return [
        dict(row._mapping)
        for row in rows
    ]


def calculate_forecast_risk(
    forecast_row: dict,
) -> dict:
    """
    Calculate thermal risk for one future weather observation.

    Because future solar radiation is unavailable from NASA POWER,
    mean radiant temperature is conservatively approximated as equal
    to air temperature.
    """

    tdb = float(
        forecast_row["temp_c"]
    )

    rh = max(
        0.0,
        min(
            100.0,
            float(
                forecast_row["humidity_pct"]
            ),
        ),
    )

    wind = max(
        0.1,
        float(
            forecast_row["wind_speed_ms"]
        ),
    )

    if not (
        _finite(tdb)
        and _finite(rh)
        and _finite(wind)
    ):
        raise ValueError(
            "Forecast temperature, humidity "
            "and wind are required."
        )

    # --------------------------------------------------
    # Heat Index
    # --------------------------------------------------

    hi_result = heat_index_lu(
        tdb=tdb,
        rh=rh,
        round_output=False,
    )

    heat_index_c = float(
        hi_result.hi
    )

    # --------------------------------------------------
    # Wet-bulb temperature
    # --------------------------------------------------

    twb = float(
        wet_bulb_tmp(
            tdb=tdb,
            rh=rh,
        )
    )

    # --------------------------------------------------
    # Forecast radiant-temperature assumption
    # --------------------------------------------------

    globe_c = tdb
    mrt_c = tdb

    wbgt_result = wbgt(
        twb=twb,
        tg=globe_c,
        round_output=False,
    )

    wbgt_c = float(
        wbgt_result.wbgt
    )

    # --------------------------------------------------
    # UTCI
    # --------------------------------------------------

    utci_result = utci(
        tdb=tdb,
        tr=mrt_c,
        v=wind,
        rh=rh,
        limit_inputs=False,
        round_output=False,
    )

    utci_c = float(
        utci_result.utci
    )

    # --------------------------------------------------
    # Risk score
    # --------------------------------------------------

    score, band = _risk_from_indices(
        heat_index_c,
        wbgt_c,
        utci_c,
    )
        # --------------------------------------------------
    # Vulnerability-weighted risk (Canonical risk_scoring.py)
    # --------------------------------------------------

    ward_id = forecast_row["ward_id"]
    demographics = get_ward_demographics(ward_id)
    vulnerability_score = (
        calculate_vulnerability_score(demographics)
        if demographics
        else 0.0
    )
    final_risk_score, final_risk_band = combine_risk(
        score,
        vulnerability_score,
    )

    # --------------------------------------------------
    # Public-Health Mortality & Hospitalization Risk
    # --------------------------------------------------
    city_name = demographics.get("city") if demographics else None
    zone = _detect_climate_zone(city_name)
    base_mort_rate = (
        float(demographics.get("baseline_mortality_rate", 6.20))
        if demographics and demographics.get("baseline_mortality_rate") is not None
        else 6.20
    )
    pop = (
        int(demographics.get("population", 40000))
        if demographics and demographics.get("population") is not None
        else 40000
    )

    mortality = calculate_mortality_risk(
        heat_index_c=heat_index_c,
        wbgt_c=wbgt_c,
        thermal_score=final_risk_score,
        vulnerability_score=vulnerability_score,
        baseline_daily_mortality_rate=base_mort_rate,
        ward_population=pop,
        climate_zone=zone,
    )

    return {
        "ward_id": forecast_row["ward_id"],

        "score_time": forecast_row[
            "reading_time"
        ],

        "is_forecast": True,

        "heat_index_c": round(
            heat_index_c,
            2,
        ),

        "wbgt_c": round(
            wbgt_c,
            2,
        ),

        "utci_c": round(
            utci_c,
            2,
        ),

        "risk_score_raw": score,

        "risk_band": band,
        "vulnerability_score": vulnerability_score,

        "final_risk_score": final_risk_score,

        "final_risk_band": final_risk_band,

        "mortality_risk_index": mortality["mortality_risk_index"],
        "relative_risk": mortality["relative_risk"],
        "excess_mortality_pct": mortality["excess_mortality_pct"],
        "predicted_excess_deaths_daily": mortality["predicted_excess_deaths_daily"],
        "predicted_hospitalization_estimate": mortality["predicted_hospitalization_estimate"],
        "mortality_confidence_note": mortality["confidence_note"],
        "hospitalization_note": mortality["hospitalization_note"],

        "solar_radiation_wm2_used": None,

        "estimated_globe_temperature_c": round(
            globe_c,
            2,
        ),

        "mean_radiant_temperature_c": round(
            mrt_c,
            2,
        ),

        "solar_note": (
            "Forecast solar radiation unavailable; "
            "MRT conservatively approximated from "
            "forecast air temperature."
        ),
    }


def save_forecast_risk(
    result: dict,
):
    """
    Save one forecast risk result.

    If the same ward + forecast timestamp already exists,
    update that row instead of deleting/reinserting it.

    This keeps risk_scores.id stable across scheduler runs.
    """

    with engine.begin() as conn:

        # --------------------------------------------------
        # First try to update an existing forecast row.
        # --------------------------------------------------

        updated = conn.execute(
            text(
                """
                UPDATE risk_scores
                SET
                  heat_index_c = :heat_index_c,
                  wbgt_c = :wbgt_c,
                  utci_c = :utci_c,
                  risk_band = :risk_band,
                  risk_score_raw = :risk_score_raw,
                  vulnerability_score = :vulnerability_score,
                  final_risk_score = :final_risk_score,
                  final_risk_band = :final_risk_band,
                  mortality_risk_index = :mortality_risk_index,
                  excess_mortality_pct = :excess_mortality_pct,
                  predicted_excess_deaths = :predicted_excess_deaths,
                  predicted_hospitalizations = :predicted_hospitalizations,
                  computed_at = :computed_at
                WHERE ward_id = :ward_id
                  AND score_time = :score_time
                  AND is_forecast = TRUE
                """
            ),
            {
                "ward_id": result["ward_id"],
                "score_time": result["score_time"],
                "heat_index_c": result["heat_index_c"],
                "wbgt_c": result["wbgt_c"],
                "utci_c": result["utci_c"],
                "risk_band": result["risk_band"],
                "risk_score_raw": result["risk_score_raw"],
                "vulnerability_score": result["vulnerability_score"],
                "final_risk_score": result["final_risk_score"],
                "final_risk_band": result["final_risk_band"],
                "mortality_risk_index": result.get("mortality_risk_index"),
                "excess_mortality_pct": result.get("excess_mortality_pct"),
                "predicted_excess_deaths": result.get("predicted_excess_deaths_daily"),
                "predicted_hospitalizations": result.get("predicted_hospitalization_estimate"),
                "computed_at": datetime.now(
                    timezone.utc
                ),
            },
        )

        # --------------------------------------------------
        # If no existing row was updated, insert one.
        # --------------------------------------------------

        if updated.rowcount == 0:

            conn.execute(
                text(
                    """
                    
        INSERT INTO risk_scores
            (
                ward_id,
                score_time,
                is_forecast,
                heat_index_c,
                wbgt_c,
                utci_c,
                risk_band,
                risk_score_raw,
                vulnerability_score,
                final_risk_score,
                final_risk_band,
                mortality_risk_index,
                excess_mortality_pct,
                predicted_excess_deaths,
                predicted_hospitalizations,
                computed_at
            )
        VALUES
            (
                :ward_id,
                :score_time,
                :is_forecast,
                :heat_index_c,
                :wbgt_c,
                :utci_c,
                :risk_band,
                :risk_score_raw,
                :vulnerability_score,
                :final_risk_score,
                :final_risk_band,
                :mortality_risk_index,
                :excess_mortality_pct,
                :predicted_excess_deaths,
                :predicted_hospitalizations,
                :computed_at
            )
        """
    ),
    {
        "ward_id": result["ward_id"],
        "score_time": result["score_time"],
        "is_forecast": True,
        "heat_index_c": result["heat_index_c"],
        "wbgt_c": result["wbgt_c"],
        "utci_c": result["utci_c"],
        "risk_band": result["risk_band"],
        "risk_score_raw": result["risk_score_raw"],
        "vulnerability_score": result["vulnerability_score"],
        "final_risk_score": result["final_risk_score"],
        "final_risk_band": result["final_risk_band"],
        "mortality_risk_index": result.get("mortality_risk_index"),
        "excess_mortality_pct": result.get("excess_mortality_pct"),
        "predicted_excess_deaths": result.get("predicted_excess_deaths_daily"),
        "predicted_hospitalizations": result.get("predicted_hospitalization_estimate"),
        "computed_at": datetime.now(timezone.utc),
    },
)


def run_forecast_for_ward(
    ward_id: int,
    limit: int = 168,
):
    """
    Calculate and store forecast risk for a ward.

    Returns a list of forecast risk results.
    """

    forecast_rows = get_forecast_rows(
        ward_id,
        limit,
    )

    results = []

    for row in forecast_rows:

        result = calculate_forecast_risk(
            row
        )

        save_forecast_risk(
            result
        )

        results.append(
            result
        )

    return results


if __name__ == "__main__":

    import sys

    ward_id = (
        int(sys.argv[1])
        if len(sys.argv) > 1
        else 1
    )

    results = run_forecast_for_ward(
        ward_id,
        limit=168,
    )

    print(
        f"Forecast risk rows processed: "
        f"{len(results)}"
    )

    if results:

        print(
            "First:",
            results[0]
        )

        print(
            "Last:",
            results[-1]
        )