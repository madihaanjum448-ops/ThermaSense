"""
risk_scoring.py — Demographic vulnerability weighting.

Turns raw ward demographics into a 0-100 vulnerability score, then combines
that with a thermal severity score (from thermal_engine / forecast_risk_engine)
to produce a final Low/Moderate/High/Extreme band.

Kept separate from thermal_engine.py and forecast_risk_engine.py so both the
"current" and "forecast" pipelines apply identical demographic weighting —
they must never diverge, or a judge comparing today's risk to tomorrow's
forecasted risk for the same ward would see inconsistent logic.
"""

from __future__ import annotations


# Weights for each vulnerability signal. These are intentionally simple and
# documented so they can be defended in Q&A as transparent, not a black box.
WEIGHT_ELDERLY = 0.35
WEIGHT_OUTDOOR_WORKER = 0.30
WEIGHT_SLUM_HOUSEHOLD = 0.20
WEIGHT_GREEN_COVER = 0.15  # inverse — less green cover = more vulnerable

# How much the vulnerability score can shift the final thermal score.
# 0.0 = vulnerability ignored, 1.0 = vulnerability weighted equally with
# thermal severity. Kept as a named constant so it's one line to tune/justify.
VULNERABILITY_INFLUENCE = 0.30


def _pct(value) -> float:
    """Normalize a possibly-null demographic percentage into 0-100."""
    if value is None:
        return 0.0
    return max(0.0, min(100.0, float(value)))


def calculate_vulnerability_score(demographics: dict) -> float:
    """
    Combine ward demographics into a single 0-100 vulnerability score.

    Higher = more vulnerable (older population, more outdoor workers, more
    informal housing, less green cover to buffer urban heat).
    """
    elderly = _pct(demographics.get("elderly_pct"))
    outdoor = _pct(demographics.get("outdoor_worker_pct"))
    slum = _pct(demographics.get("slum_household_pct"))
    green = _pct(demographics.get("green_cover_pct"))

    green_deficit = 100.0 - green  # less green cover -> higher vulnerability

    score = (
        WEIGHT_ELDERLY * elderly
        + WEIGHT_OUTDOOR_WORKER * outdoor
        + WEIGHT_SLUM_HOUSEHOLD * slum
        + WEIGHT_GREEN_COVER * green_deficit
    )

    return round(max(0.0, min(100.0, score)), 2)


def combine_risk(thermal_score: float, vulnerability_score: float):
    """
    Blend thermal severity with vulnerability, where vulnerability can only
    push the final score UP from the thermal baseline, never down.

    A demographically resilient ward must never be told it's safer than the
    actual physical heat stress it's experiencing — vulnerability amplifies
    risk for at-risk populations, it does not dilute real thermal danger.
    """
    headroom = 100.0 - thermal_score  # how much room is left to push upward
    boost = VULNERABILITY_INFLUENCE * (vulnerability_score / 100.0) * headroom
    final_score = round(min(100.0, thermal_score + boost), 3)

    if final_score >= 80:
        band = "extreme"
    elif final_score >= 60:
        band = "high"
    elif final_score >= 35:
        band = "moderate"
    else:
        band = "low"

    return final_score, band